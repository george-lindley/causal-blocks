// The game. Chapter 1, Hilltop School: each level adds one idea and uses only
// the steps it needs (Watch, Build, Freeze, Poke, Verdict), with an optional
// bonus Experiment after a win. The engine is world.js; the drawing canvas
// is the site's shared board.

import { createBoard } from "../board.js";
import { Role, roles } from "../causal.js";
import { CAST, CHARACTER_TEXT, portrait, silhouette } from "./cast.js";
import { LEVELS } from "./levels.js";
import { pokeResult, predict, simulate, trueGraph, verdict, watched } from "./world.js";

const $ = (id) => document.getElementById(id);

const STAGE_NAMES = { watch: "Watch", build: "Build", freeze: "Freeze", poke: "Poke", verdict: "Verdict" };
const CAST_ORDER = [Role.TREATMENT, Role.OUTCOME, Role.MEDIATOR, Role.CONFOUNDER, Role.COLLIDER];

// ---------------------------------------------------------------------------
// Progress, remembered in this browser only
// ---------------------------------------------------------------------------

const PROGRESS_KEY = "causalblocks-progress-v2";
function loadProgress() {
  let saved = {};
  try {
    saved = JSON.parse(localStorage.getItem(PROGRESS_KEY)) ?? {};
  } catch {
    // Storage blocked: start fresh.
  }
  return { levels: saved.levels ?? {}, met: saved.met ?? {}, bonus: saved.bonus ?? {} };
}
const progress = loadProgress();
function saveProgress() {
  try {
    localStorage.setItem(PROGRESS_KEY, JSON.stringify(progress));
  } catch {
    // Private mode or storage blocked: progress just isn't remembered.
  }
}

// ---------------------------------------------------------------------------
// State and helpers
// ---------------------------------------------------------------------------

const game = {
  index: 0,
  level: null,
  stage: null,
  data: null, // what the headline looked at
  everyone: null, // the whole school, when the headline only looked at some of it
  truth: null, // the poke, computed up front, shown only after poking
  naive: 0,
  model: [],
  freeze: new Set(),
  prediction: null,
  result: null,
  narrowed: false, // bouncer level: looking only at who got in?
  newlyMet: [],
  toastTimer: null,
};

const block = (id) => game.level.world.blocks[id];
const label = (id) => block(id)?.label ?? id;
const q = () => game.level.question;
const lv = () => game.level;

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]);
}

function toast(message) {
  const t = $("toast");
  t.textContent = message;
  t.hidden = false;
  clearTimeout(game.toastTimer);
  game.toastTimer = setTimeout(() => (t.hidden = true), 4000);
}

const pct = (v) => `${Math.round(v * 100)}%`;

/** A change in the outcome, signed: "+15 percentage points". */
function change(e, { signed = true } = {}) {
  const x = Math.round(e * 100);
  const sign = !signed || x === 0 ? "" : x < 0 ? "−" : "+";
  return `${sign}${Math.abs(x)} ${lv().units}`;
}

/** "twice as likely", "half as likely", "2.6 times as likely". */
function ratioWords(a, b) {
  const r = a / b;
  if (r > 1.85 && r < 2.15) return "twice";
  if (r > 0.45 && r < 0.55) return "half";
  if (r >= 1) return `${r.toFixed(1)} times`;
  return `${(1 / r).toFixed(1)} times less`;
}

const rate = (data, rows) => rows.reduce((s, i) => s + data[q().outcome][i], 0) / rows.length;

/** Outcome rates for treatment yes and no, optionally within rows matching `where`. */
function rates(data, where = () => true) {
  const t = q().treatment;
  const idx = [...data[t].keys()].filter((i) => where(i));
  return [rate(data, idx.filter((i) => data[t][i] === 1)), rate(data, idx.filter((i) => data[t][i] === 0))];
}

// ---------------------------------------------------------------------------
// Board
// ---------------------------------------------------------------------------

const board = createBoard($("canvas"), {
  label,
  locked: () => true,
  onEdit: () => {
    if (game.stage === "poke") setStage("build");
  },
  onChange: () => refresh(),
  toast,
  unknownCaption: "",
  roleText: CHARACTER_TEXT,
  faces: true,
});

function drawBoard() {
  if (!game.level) return;
  const { treatment: t, outcome: y } = q();
  const revealed = (game.stage === "verdict" && game.result?.stands) || game.stage === "bonus";
  // The Cause and the Effect are always named; everyone else stays a mystery until the level is won.
  let roleMap = { [t]: [Role.TREATMENT], [y]: [Role.OUTCOME] };
  if (revealed) {
    try {
      roleMap = roles(board.graph(), t, y);
    } catch {
      // A loop mid-edit: keep the simple colouring.
    }
  }
  const showFreeze = game.stage === "freeze" || (game.stage === "bonus" && lv().freezeOnly);
  board.draw(roleMap, { frozen: showFreeze ? new Set(game.freeze) : new Set() });
  // Tutorial: make the Cause's handle pulse until an arrow is drawn.
  if (lv().tutorial && game.stage === "build" && !board.graph().edges.length) {
    $("canvas").querySelector(`[data-port="${t}"]`)?.classList.add("pulse");
  }
}

function currentPrediction() {
  if (lv().freezeOnly) return predict(lv(), { freeze: [...game.freeze], data: game.data });
  try {
    return predict(lv(), { graph: board.graph(), data: game.data });
  } catch {
    return { effect: null, adjust: [] };
  }
}

// ---------------------------------------------------------------------------
// Pictures: crowds, the meter, and the two action animations
// ---------------------------------------------------------------------------

/** A row of 10 figures with some of them lit up, and a big percentage. */
function crowd(title, r) {
  const hits = Math.round(r * 10);
  const figs = Array.from({ length: 10 }, (_, k) => {
    const x = 20 + k * 38;
    return `<g class="fig ${k < hits ? "hit" : "off"}"><circle cx="${x}" cy="16" r="9"/><rect x="${x - 10}" y="27" width="20" height="25" rx="8"/></g>`;
  }).join("");
  return `<div class="crowd">
    <div class="crowd-head"><span>${escapeHtml(title)}</span><b>${pct(r)}</b></div>
    <svg viewBox="0 0 400 58" role="img" aria-label="${escapeHtml(title)}: ${hits} in 10">${figs}</svg>
  </div>`;
}

function crowdPair([a, b], names, note) {
  return `<div class="crowd-block"><div class="crowds">${crowd(names[0], a)}${crowd(names[1], b)}</div>
    <p class="legend"><i class="dot"></i>${escapeHtml(note)}</p></div>`;
}

function meter(predicted, { truth = null } = {}) {
  const span = Math.max(Math.abs(game.naive), Math.abs(game.truth.effect), Math.abs(predicted ?? 0), lv().tolerance * 3) * 1.25;
  const x = (v) => 30 + ((v + span) / (2 * span)) * 540;
  const anchor = (v) => (x(v) < 170 ? "start" : x(v) > 430 ? "end" : "middle");
  const parts = [
    `<line x1="30" x2="570" y1="74" y2="74" stroke="#c9d4de" stroke-width="5" stroke-linecap="round"/>`,
    `<line x1="${x(0)}" x2="${x(0)}" y1="60" y2="88" stroke="#8a9aa8" stroke-width="3"/>`,
  ];
  if (truth === null || Math.abs(x(truth) - x(0)) > 40) parts.push(`<text x="${x(0)}" y="112" text-anchor="middle">0</text>`);
  if (truth !== null) {
    const tl = x(truth - lv().tolerance);
    const tr = x(truth + lv().tolerance);
    parts.push(
      `<rect x="${tl}" y="56" width="${tr - tl}" height="36" rx="8" fill="#16a085" opacity="0.18"/>`,
      `<line x1="${x(truth)}" x2="${x(truth)}" y1="50" y2="98" stroke="#16a085" stroke-width="6" stroke-linecap="round"/>`,
      `<text x="${x(truth)}" y="136" text-anchor="${anchor(truth)}" class="m-truth">The school: ${escapeHtml(change(truth))}</text>`,
    );
  }
  if (predicted !== null) {
    parts.push(
      `<path d="M${x(predicted) - 15},34 h30 l-15,22 z" fill="#fa953d" stroke="#1f2933" stroke-width="2.5" stroke-linejoin="round"/>`,
      `<text x="${x(predicted)}" y="24" text-anchor="${anchor(predicted)}">Your model: ${escapeHtml(change(predicted))}</text>`,
    );
  }
  return `<svg class="meter" viewBox="0 0 600 ${truth !== null ? 146 : 120}" role="img" aria-label="Your model predicts ${escapeHtml(change(predicted ?? 0))}${truth !== null ? `; the school did ${escapeHtml(change(truth))}` : ""}">${parts.join("")}</svg>`;
}

/** New action: Poke. A finger presses a block; the arrows into it snap off. */
function pokeIntro() {
  return `<div class="action-intro">
    <svg class="anim-poke" viewBox="0 0 320 150" aria-hidden="true">
      <rect x="10" y="20" width="70" height="34" rx="9" fill="#cfd8df"/>
      <rect x="10" y="96" width="70" height="34" rx="9" fill="#cfd8df"/>
      <g class="snap snap-a"><path d="M80 37 L160 66" stroke="#74828f" stroke-width="4" fill="none"/><path d="M152 58 l10 9 l-13 3 z" fill="#74828f"/></g>
      <g class="snap snap-b"><path d="M80 113 L160 86" stroke="#74828f" stroke-width="4" fill="none"/><path d="M149 81 l13 3 l-10 9 z" fill="#74828f"/></g>
      <rect class="poked" x="165" y="56" width="110" height="40" rx="11" fill="#fa953d"/>
      <text x="220" y="81" text-anchor="middle" font-size="14" font-weight="700" fill="#1f2933">Forced</text>
      <g class="finger"><circle cx="220" cy="24" r="12" fill="#f3c9a4" stroke="#1f2933" stroke-width="2.5"/><rect x="211" y="-20" width="18" height="44" rx="8" fill="#f3c9a4" stroke="#1f2933" stroke-width="2.5"/></g>
    </svg>
    <div><span class="label">New action</span><h4>Poke</h4>
      <p>Poking a block forces it for everyone: here, every pupil goes to revision club. The arrows into it snap off,
        because nothing else decides it any more. Whatever changes afterwards, the poke caused it.</p></div>
  </div>`;
}

/** New action: Freeze. A mixed crowd sorts itself into groups that are the same on the frozen block. */
function freezeIntro() {
  const figs = Array.from({ length: 12 }, (_, k) => {
    const poorer = k % 3 !== 0;
    const fromX = 20 + ((k * 7) % 12) * 24;
    const fromY = 30 + ((k * 5) % 3) * 30;
    const slot = poorer ? k - Math.floor(k / 3) - 1 : Math.floor(k / 3);
    const toX = 20 + slot * 30;
    const toY = poorer ? 108 : 40;
    const color = poorer ? "#3498db" : "#9fc9e8";
    return `<g class="sorter" style="--dx:${toX - fromX}px;--dy:${toY - fromY}px">
      <circle cx="${fromX}" cy="${fromY}" r="7" fill="${color}"/><rect x="${fromX - 7}" y="${fromY + 8}" width="14" height="16" rx="6" fill="${color}"/></g>`;
  }).join("");
  return `<div class="action-intro">
    <svg class="anim-freeze" viewBox="0 0 320 150" aria-hidden="true">
      ${figs}
      <text class="ice" x="300" y="56" text-anchor="end" font-size="13" font-weight="700" fill="#2b7bb5">❄ Richer</text>
      <text class="ice" x="300" y="124" text-anchor="end" font-size="13" font-weight="700" fill="#2b7bb5">❄ Poorer</text>
    </svg>
    <div><span class="label">New action</span><h4>Freeze</h4>
      <p>Freezing a block sorts pupils into groups that are the same on it, then compares like with like inside each group.
        If that block was faking the link, the fake disappears.</p></div>
  </div>`;
}

function celebrate() {
  const colors = ["#fa953d", "#16a085", "#3498db", "#9b59b6", "#e74c3c", "#f1c40f"];
  const bits = Array.from({ length: 18 }, (_, k) =>
    `<i style="--x:${(k * 37) % 100}%;--d:${(k % 6) * 0.08}s;background:${colors[k % 6]}"></i>`).join("");
  return `<div class="confetti" aria-hidden="true">${bits}</div>`;
}

// ---------------------------------------------------------------------------
// Map
// ---------------------------------------------------------------------------

function castCard(role) {
  const c = CAST[role];
  if (!progress.met[role]) return `<div class="cast-card unmet">${silhouette(72)}<span class="cast-name">???</span></div>`;
  return `<div class="cast-card" title="${escapeHtml(c.line)}">${portrait(role, 72)}<span class="cast-name">${c.name}</span></div>`;
}

function showMap() {
  game.level = null;
  $("level").hidden = true;
  $("map").hidden = false;
  $("cast-list").innerHTML = CAST_ORDER.map(castCard).join("");
  $("levels").innerHTML = LEVELS.map((l, i) => `
    <li>
      <button type="button" class="level-card${progress.levels[l.id] ? " done" : ""}" data-level="${i}">
        <span class="level-no">${progress.levels[l.id] ? "✓" : i + 1}</span>
        <span class="level-text">
          <span class="level-place">${escapeHtml(l.title)}</span>
          <span class="level-headline">“${escapeHtml(l.headline)}”</span>
          <span class="level-lesson">${escapeHtml(l.teaches)}${progress.bonus[l.id] ? " · ★ bonus" : ""}</span>
        </span>
      </button>
    </li>`).join("");
  history.replaceState(null, "", location.pathname);
}

$("levels").addEventListener("click", (e) => {
  const card = e.target.closest("[data-level]");
  if (card) startLevel(Number(card.dataset.level));
});
$("to-map").addEventListener("click", showMap);

// ---------------------------------------------------------------------------
// A level
// ---------------------------------------------------------------------------

function startLevel(i) {
  const l = LEVELS[i];
  game.index = i;
  game.level = l;
  game.data = watched(l);
  game.everyone = l.world.select ? simulate(l.world, 5000) : null;
  game.truth = pokeResult(l);
  game.naive = predict(l, { freeze: [], data: game.data }).effect;
  game.freeze = new Set();
  game.model = [];
  game.prediction = game.result = null;
  game.narrowed = false;
  game.newlyMet = [];
  board.load(l.layout, l.startEdges ?? []);
  $("map").hidden = true;
  $("level").hidden = false;
  $("level-place").textContent = `Level ${i + 1} of ${LEVELS.length} · ${l.title}`;
  $("headline").textContent = `“${l.headline}”`;
  $("story").textContent = l.story;
  history.replaceState(null, "", `#${l.id}`);
  setStage("watch");
  $("level").scrollIntoView({ block: "start" });
}

function setStage(stage) {
  game.stage = stage;
  const stages = lv().stages;
  const at = stages.indexOf(stage);
  $("stages").innerHTML = stages.map((s, n) =>
    `<li class="${s === stage ? "current" : n < at || stage === "bonus" ? "past" : ""}">${STAGE_NAMES[s]}</li>`).join("");
  $("watch-screen").hidden = stage !== "watch";
  $("play-screen").hidden = stage === "watch";
  $("stage-board").classList.remove("falling");
  refresh();
}

function next(stage) {
  const stages = lv().stages;
  return stages[stages.indexOf(stage) + 1];
}

function refresh() {
  if (!game.level) return;
  if (game.stage === "watch") {
    $("watch-screen").innerHTML = watchScreen();
    return;
  }
  drawBoard();
  $("stage-panel").innerHTML = { build: buildPanel, freeze: freezePanel, poke: pokePanel, verdict: verdictPanel, bonus: bonusPanel }[game.stage]();
}

document.addEventListener("click", (e) => {
  const action = e.target.closest("[data-action]")?.dataset.action;
  if (!action || !game.level) return;
  if (action === "narrow") { game.narrowed = true; refresh(); }
  if (action === "widen") { game.narrowed = false; refresh(); }
  if (action === "continue") setStage(next(game.stage));
  if (action === "check") checkArrow();
  if (action === "to-poke") toPoke();
  if (action === "verdict") judge();
  if (action === "rebuild") {
    board.load(lv().layout, game.model);
    setStage(lv().freezeOnly ? "freeze" : "build");
  }
  if (action === "bonus") setStage("bonus");
  if (action === "next") (game.index + 1 < LEVELS.length ? startLevel(game.index + 1) : showMap());
  if (action === "map") showMap();
});

document.addEventListener("change", (e) => {
  const id = e.target.dataset?.freeze;
  if (!id || !game.level) return;
  if (e.target.checked) game.freeze.add(id);
  else game.freeze.delete(id);
  refresh();
});

// ---- Watch ---------------------------------------------------------------

function watchScreen() {
  const l = lv();
  let statement;
  let detail;
  let visual;
  let ready = true;
  if (l.world.select) {
    const data = game.narrowed ? game.data : game.everyone;
    const [a, b] = rates(data);
    statement = game.narrowed ? l.watch.statement : l.watch.everyone;
    detail = game.narrowed
      ? `${pct(a)} against ${pct(b)}. The headline only looks at the scholarship pupils.`
      : `${pct(a)} against ${pct(b)}. That's everyone at Hilltop. But the headline didn't look at everyone.`;
    visual = `<div class="gate">
      ${crowdPair([a, b], l.watch.groups, `Lit up: ${l.watch.outcome}`)}
      <div class="bouncer-box">
        <div class="bubble">${game.narrowed ? "Sporty or good at maths? You're in. Everyone else, out!" : "I guard the scholarship door."}</div>
        ${portrait(Role.COLLIDER, 130)}
        ${game.narrowed
          ? `<button type="button" class="btn ghost-btn" data-action="widen">Show the whole school</button>`
          : `<button type="button" class="btn collider-btn" data-action="narrow">Look only at scholarship pupils</button>`}
      </div>
    </div>`;
    ready = game.narrowed;
  } else {
    const [a, b] = rates(game.data);
    statement = l.watch.statement.replace("{ratio}", ratioWords(a, b));
    detail = `${pct(a)} against ${pct(b)}.`;
    visual = crowdPair([a, b], l.watch.groups, `Lit up: ${l.watch.outcome}`);
  }
  return `
    <p class="statement">${escapeHtml(statement)}<small>${escapeHtml(detail)}</small></p>
    ${visual}
    <div class="controls">
      ${ready ? `<button type="button" class="btn primary-btn" data-action="continue">${l.freezeOnly ? "Freeze a block →" : "Draw what causes what →"}</button>` : ""}
    </div>`;
}

// ---- Build ---------------------------------------------------------------

function buildPanel() {
  const l = lv();
  const { treatment: t, outcome: y } = q();
  if (l.tutorial) {
    return `
      <h3>Draw your first arrow</h3>
      <p>The headline claims <b>${escapeHtml(label(t))}</b> causes <b>${escapeHtml(label(y))}</b>. Draw that claim:</p>
      <ol class="tutorial-steps">
        <li>Find the round handle on the edge of <b>${escapeHtml(label(t))}</b>. It's pulsing.</li>
        <li>Drag from it onto <b>${escapeHtml(label(y))}</b>, and let go.</li>
      </ol>
      <button type="button" class="btn primary-btn" data-action="check">Check my arrow</button>`;
  }
  const p = currentPrediction();
  return `
    <h3>Draw what causes what</h3>
    <p>Drag from a block's round handle onto the block it causes. Click an arrow to flip or remove it.</p>
    <p class="meter-label">What your drawing predicts if you poke <b>${escapeHtml(label(t))}</b>:</p>
    ${meter(p.effect)}
    <button type="button" class="btn primary-btn" data-action="to-poke">Poke →</button>`;
}

function checkArrow() {
  const { treatment: t, outcome: y } = q();
  const edges = board.graph().edges;
  game.model = edges.map((e) => [...e]);
  const right = edges.some(([p, c]) => p === t && c === y);
  game.result = { stands: right };
  if (right) meet();
  setStage("verdict");
  if (!right) $("stage-board").classList.add("falling");
}

// ---- Freeze --------------------------------------------------------------

function freezePanel() {
  const l = lv();
  const { treatment: t, outcome: y } = q();
  const others = Object.keys(l.world.blocks).filter((id) => id !== t && id !== y);
  const p = currentPrediction();
  const frozen = [...game.freeze].filter((id) => id !== y);
  // What freezing does, with the real data: one pair of crowds per group.
  let crowdsHtml;
  if (frozen.length === 1) {
    const z = frozen[0];
    crowdsHtml = [1, 0].map((v) => {
      const [a, b] = rates(game.data, (i) => game.data[z][i] === v);
      return `<p class="group-title">❄ ${escapeHtml(label(z))}: ${v ? "yes" : "no"}</p>${crowdPair([a, b], l.watch.groups, `Lit up: ${l.watch.outcome}`)}`;
    }).join("");
  } else {
    crowdsHtml = `<p class="group-title">Nothing frozen: everyone together</p>${crowdPair(rates(game.data), l.watch.groups, `Lit up: ${l.watch.outcome}`)}`;
  }
  return `
    ${l.introduces === "freeze" ? freezeIntro() : ""}
    <h3>Freeze a block</h3>
    <p>Which block should you hold still, so you compare <b>${escapeHtml(label(t))}</b> with no <b>${escapeHtml(label(t))}</b> fairly?</p>
    <div class="freeze-list">
      ${others.map((id) => `<label class="freeze-chip"><input type="checkbox" data-freeze="${id}" ${game.freeze.has(id) ? "checked" : ""}> ❄ ${escapeHtml(label(id))}</label>`).join("")}
    </div>
    <div class="freeze-crowds">${crowdsHtml}</div>
    <p class="meter-label">What your frozen comparison predicts:</p>
    ${meter(p.effect)}
    <button type="button" class="btn primary-btn" data-action="to-poke">${escapeHtml(l.poke.label)} →</button>`;
}

// ---- Poke ----------------------------------------------------------------

function toPoke() {
  game.prediction = currentPrediction();
  game.model = board.graph().edges.map((e) => [...e]);
  // Graph surgery: forcing a block cuts every arrow into it.
  const t = q().treatment;
  board.load(lv().layout, game.model.filter(([, c]) => c !== t));
  setStage("poke");
}

function pokePanel() {
  const l = lv();
  const { treatment: t } = q();
  const r = game.truth;
  const cut = game.model.filter(([, c]) => c === t);
  return `
    ${l.introduces === "poke" ? pokeIntro() : ""}
    <h3>${escapeHtml(l.poke.label)}!</h3>
    ${cut.length && l.introduces !== "poke" ? `<p>The arrows into <b>${escapeHtml(label(t))}</b> snap off: nothing else decides it now.</p>` : ""}
    ${crowdPair([r.hi, r.lo], [`${label(t)} for everyone`, `${label(t)} for no one`], `Lit up: ${l.watch.outcome}`)}
    ${meter(game.prediction.effect, { truth: r.effect })}
    <button type="button" class="btn primary-btn" data-action="verdict">Was my model right? →</button>`;
}

// ---- Verdict -------------------------------------------------------------

function meet() {
  game.newlyMet = lv().meets.filter((r) => !progress.met[r]);
  for (const r of lv().meets) progress.met[r] = true;
  progress.levels[lv().id] = true;
  saveProgress();
}

function judge() {
  const l = lv();
  game.result = verdict(l, game.prediction.effect, game.truth.effect);
  if (game.result.stands) {
    meet();
    board.load(l.layout, trueGraph(l.world).edges);
    setStage("verdict");
    return;
  }
  board.load(l.layout, game.model);
  setStage("verdict");
  $("stage-board").classList.add("falling");
}

function characterCard(role) {
  const c = CAST[role];
  return `<div class="new-character" style="--c: ${c.color}">
    ${portrait(role, 92, c.name)}
    <div><span class="label">${game.newlyMet.includes(role) ? "New character" : "Character"}</span>
      <h4>${c.name}</h4>
      <p>${escapeHtml(c.line)}</p><p class="meta">${escapeHtml(c.does)}</p></div>
  </div>`;
}

function verdictPanel() {
  const l = lv();
  const last = game.index + 1 >= LEVELS.length;
  const nextBtn = `<button type="button" class="btn primary-btn" data-action="next">${last ? "Back to the map" : "Next level →"}</button>`;
  if (game.result.stands) {
    const score = l.tutorial ? "" : `<p>Your model predicted <b>${change(game.prediction.effect)}</b> and the school did <b>${change(game.truth.effect)}</b>.</p>`;
    return `
      ${celebrate()}
      <h3 class="win">${l.tutorial ? "Your first causal claim!" : "Your model was right!"}</h3>
      ${score}
      <p>${escapeHtml(l.reveal)}</p>
      ${l.meets.map(characterCard).join("")}
      <div class="step-actions">
        ${nextBtn}
        ${l.tutorial ? "" : `<button type="button" class="link-button" data-action="bonus">★ Bonus: experiment with this school</button>`}
      </div>`;
  }
  return `
    <h3 class="lose">${l.tutorial ? "Not quite" : "The tower falls!"}</h3>
    ${l.tutorial ? "" : `<p>Your model predicted <b>${change(game.prediction.effect)}</b>, but the school did <b>${change(game.truth.effect)}</b>.</p>${meter(game.prediction.effect, { truth: game.truth.effect })}`}
    <p class="hint-box"><b>Hint:</b> ${escapeHtml(l.hint)}</p>
    <button type="button" class="btn primary-btn" data-action="rebuild">Try again</button>`;
}

// ---- Bonus ---------------------------------------------------------------

function bonusPanel() {
  const l = lv();
  const p = currentPrediction();
  const close = p.effect !== null && Math.abs(p.effect - game.truth.effect) <= l.tolerance;
  const far = p.effect !== null && Math.abs(p.effect - game.truth.effect) > 2 * l.tolerance;
  if (far && !progress.bonus[l.id]) {
    progress.bonus[l.id] = true;
    saveProgress();
  }
  const chips = l.freezeOnly
    ? `<div class="freeze-list">${Object.keys(l.world.blocks).filter((id) => id !== q().treatment && id !== q().outcome)
      .map((id) => `<label class="freeze-chip"><input type="checkbox" data-freeze="${id}" ${game.freeze.has(id) ? "checked" : ""}> ❄ ${escapeHtml(label(id))}</label>`).join("")}</div>`
    : "";
  return `
    <h3>★ Bonus: experiment</h3>
    <p>The board shows how this school really works. Now break it: ${l.freezeOnly ? "change what's frozen" : "move, flip or remove arrows"}
      and watch your model's prediction drift away from what the school really does.</p>
    ${chips}
    ${meter(p.effect, { truth: game.truth.effect })}
    <p class="${close ? "win" : "lose"}"><b>${close ? "This model would still stand." : "This model's tower would fall."}</b></p>
    ${progress.bonus[l.id] ? `<p class="challenge done"><span class="label">★ Bonus earned</span> You found a model that gets this school wrong. That gap is exactly the mistake a headline makes.</p>` : ""}
    <div class="step-actions">
      <button type="button" class="btn primary-btn" data-action="next">${game.index + 1 < LEVELS.length ? "Next level →" : "Back to the map"}</button>
      <button type="button" class="link-button" data-action="map">All levels</button>
    </div>`;
}

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------

const fromHash = LEVELS.findIndex((l) => `#${l.id}` === location.hash);
if (fromHash >= 0) startLevel(fromHash);
else showMap();
