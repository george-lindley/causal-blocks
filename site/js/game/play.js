// The game: a level map with the cast, then each level as
// Watch -> Build -> Freeze -> Poke -> Verdict -> Experiment.
// The engine is world.js; the drawing canvas is the site's shared board.

import { createBoard } from "../board.js";
import { Role, dowhyBackdoor, roles } from "../causal.js";
import { CAST, CHARACTER_TEXT, portrait, silhouette } from "./cast.js";
import { LEVELS } from "./levels.js";
import { pokeResult, predict, simulate, trueGraph, verdict, watched } from "./world.js";

const $ = (id) => document.getElementById(id);

const STAGE_NAMES = { watch: "Watch", build: "Build", freeze: "Freeze", poke: "Poke", verdict: "Verdict", experiment: "Experiment" };
const STAGES = ["watch", "build", "freeze", "poke", "verdict", "experiment"];
// The order characters appear in the cast row.
const CAST_ORDER = [Role.TREATMENT, Role.OUTCOME, Role.MEDIATOR, Role.CONFOUNDER, Role.COLLIDER];

// ---------------------------------------------------------------------------
// Progress, remembered in this browser only
// ---------------------------------------------------------------------------

const PROGRESS_KEY = "causalblocks-progress";
function loadProgress() {
  let saved = {};
  try {
    saved = JSON.parse(localStorage.getItem(PROGRESS_KEY)) ?? {};
  } catch {
    // Storage blocked: start fresh.
  }
  // The Cause and the Effect are met before level 1.
  return {
    levels: saved.levels ?? {},
    met: { [Role.TREATMENT]: true, [Role.OUTCOME]: true, ...(saved.met ?? {}) },
    challenges: saved.challenges ?? {},
  };
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
  data: null, // the watched town (after any selection)
  town: null, // everyone, for the football gate
  truth: null, // the poke result, computed up front but shown only after poking
  naive: 0, // the association in the watched data
  model: [], // the player's arrows when they moved on from Build
  freeze: new Set(),
  prediction: null,
  result: null,
  picked: false, // football: has the Bouncer picked the team?
  showSuggestion: false,
  toastTimer: null,
};

const block = (id) => game.level.world.blocks[id];
const label = (id) => block(id)?.label ?? id;
const q = () => game.level.question;

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

/** An outcome value: "31%" for yes/no, "64.2" for a number. */
function value(v, id) {
  return block(id).kind === "yesno" ? `${Math.round(v * 100)}%` : v.toFixed(1);
}

/** A change in the outcome, signed: "+23.0 percentage points". */
function change(e, { signed = true } = {}) {
  const x = block(q().outcome).kind === "yesno" ? e * 100 : e;
  const s = Math.abs(x).toFixed(1);
  const sign = !signed || Number(s) === 0 ? "" : x < 0 ? "−" : "+";
  return `${sign}${s} ${game.level.units}`;
}

function list(ids) {
  const names = ids.map((id) => `<b>${escapeHtml(label(id))}</b>`);
  return names.length <= 1 ? names.join("") : `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`;
}

function fill(template, vars) {
  return template.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? "");
}

// ---------------------------------------------------------------------------
// Board
// ---------------------------------------------------------------------------

const board = createBoard($("canvas"), {
  label,
  locked: () => true, // a level's blocks always stay on the board
  onEdit: () => {
    // Changing the model after Build means building again; in Experiment it's the point.
    if (["freeze", "poke"].includes(game.stage) && !game.level.freezeOnly) setStage("build");
  },
  onChange: () => refresh(),
  toast,
  unknownCaption: "", // no hints: a block's role is revealed only when the level is won
  roleText: CHARACTER_TEXT,
  faces: true,
});

function drawBoard() {
  if (!game.level) return;
  const { treatment: t, outcome: y } = q();
  const reveal = (game.stage === "verdict" && game.result?.stands) || game.stage === "experiment";
  let roleMap = { [t]: [Role.TREATMENT], [y]: [Role.OUTCOME] };
  if (reveal) {
    try {
      roleMap = roles(board.graph(), t, y);
    } catch {
      // A loop mid-edit: keep the plain colouring.
    }
  }
  const frozen = ["freeze", "experiment"].includes(game.stage) ? frozenNow() : new Set();
  board.draw(roleMap, { frozen });
}

/** Blocks held steady right now: the player's choice, or what their graph says. */
function frozenNow() {
  if (game.level.freezeOnly) return new Set(game.freeze);
  const p = currentPrediction();
  return new Set(p.adjust ?? []);
}

function currentPrediction() {
  const lv = game.level;
  if (lv.freezeOnly) return predict(lv, { freeze: [...game.freeze], data: game.data });
  try {
    return predict(lv, { graph: board.graph(), data: game.data });
  } catch {
    return { effect: null, adjust: [] };
  }
}

// ---------------------------------------------------------------------------
// The prediction meter
// ---------------------------------------------------------------------------

function meter(predicted, { truth = null } = {}) {
  const span = Math.max(Math.abs(game.naive), Math.abs(game.truth.effect), Math.abs(predicted ?? 0), game.level.tolerance * 3) * 1.25;
  const x = (v) => 30 + ((v + span) / (2 * span)) * 540;
  // Labels near either end are anchored inwards so they never run off the meter.
  const anchor = (v) => (x(v) < 170 ? "start" : x(v) > 430 ? "end" : "middle");
  const parts = [
    `<line x1="30" x2="570" y1="74" y2="74" stroke="#c9d4de" stroke-width="5" stroke-linecap="round"/>`,
    `<line x1="${x(0)}" x2="${x(0)}" y1="60" y2="88" stroke="#8a9aa8" stroke-width="3"/>`,
  ];
  // The zero label, unless the truth line already sits on zero.
  if (truth === null || Math.abs(x(truth) - x(0)) > 40) parts.push(`<text x="${x(0)}" y="112" text-anchor="middle">0</text>`);
  if (truth !== null) {
    const tl = x(truth - game.level.tolerance);
    const tr = x(truth + game.level.tolerance);
    parts.push(
      `<rect x="${tl}" y="56" width="${tr - tl}" height="36" rx="8" fill="#16a085" opacity="0.18"/>`,
      `<line x1="${x(truth)}" x2="${x(truth)}" y1="50" y2="98" stroke="#16a085" stroke-width="6" stroke-linecap="round"/>`,
      `<text x="${x(truth)}" y="136" text-anchor="${anchor(truth)}" class="m-truth">The town: ${escapeHtml(change(truth))}</text>`,
    );
  }
  if (predicted !== null) {
    parts.push(
      `<path d="M${x(predicted) - 15},34 h30 l-15,22 z" fill="#fa953d" stroke="#1f2933" stroke-width="2.5" stroke-linejoin="round"/>`,
      `<text x="${x(predicted)}" y="24" text-anchor="${anchor(predicted)}" class="m-model">Your model: ${escapeHtml(change(predicted))}</text>`,
    );
  }
  return `<svg class="meter" viewBox="0 0 600 ${truth !== null ? 146 : 120}" role="img" aria-label="Your model predicts ${escapeHtml(change(predicted ?? 0))}${truth !== null ? `; the town did ${escapeHtml(change(truth))}` : ""}">${parts.join("")}</svg>`;
}

// ---------------------------------------------------------------------------
// Level map and cast
// ---------------------------------------------------------------------------

function castCard(role, met) {
  const c = CAST[role];
  if (!met) return `<div class="cast-card unmet">${silhouette(72)}<span class="cast-name">???</span></div>`;
  return `<div class="cast-card" style="--c: ${c.color}" title="${escapeHtml(c.line)}">${portrait(role, 72)}<span class="cast-name">${c.name}</span></div>`;
}

function showMap() {
  game.level = null;
  $("level").hidden = true;
  $("map").hidden = false;
  $("cast-list").innerHTML = CAST_ORDER.map((r) => castCard(r, progress.met[r])).join("");
  $("levels").innerHTML = LEVELS.map((lv, i) => `
    <li>
      <button type="button" class="level-card${progress.levels[lv.id] ? " done" : ""}" data-level="${i}">
        <span class="level-no">${progress.levels[lv.id] ? "✓" : i + 1}</span>
        <span class="level-text">
          <span class="level-place">${escapeHtml(lv.place)}</span>
          <span class="level-headline">“${escapeHtml(lv.headline)}”</span>
          <span class="level-lesson">${escapeHtml(lv.lesson)}${progress.challenges[lv.id] ? " · ★ challenge done" : ""}</span>
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
  const lv = LEVELS[i];
  game.index = i;
  game.level = lv;
  game.data = watched(lv);
  game.town = simulate(lv.world, 160);
  game.truth = pokeResult(lv);
  game.naive = predict(lv, { freeze: [], data: game.data }).effect;
  game.freeze = new Set();
  game.model = [];
  game.prediction = game.result = null;
  game.picked = false;
  game.showSuggestion = false;
  board.load(lv.layout, []);
  $("map").hidden = true;
  $("level").hidden = false;
  $("level-place").textContent = `Level ${i + 1} · ${lv.place}`;
  $("headline").textContent = `“${lv.headline}”`;
  $("story").textContent = lv.story;
  history.replaceState(null, "", `#${lv.id}`);
  setStage("watch");
  $("level").scrollIntoView({ block: "start" });
}

function setStage(stage) {
  game.stage = stage;
  const at = STAGES.indexOf(stage);
  $("stages").innerHTML = STAGES.map((s, n) =>
    `<li class="${s === stage ? "current" : n < at ? "past" : ""}">${STAGE_NAMES[s]}</li>`).join("");
  $("watch-screen").hidden = stage !== "watch";
  $("play-screen").hidden = stage === "watch";
  $("stage-board").classList.remove("falling");
  refresh();
}

/** Redraw whatever the current stage shows. */
function refresh() {
  if (!game.level) return;
  if (game.stage === "watch") {
    $("watch-screen").innerHTML = watchScreen();
    return;
  }
  drawBoard();
  $("stage-panel").innerHTML = { build: buildPanel, freeze: freezePanel, poke: pokePanel, verdict: verdictPanel, experiment: experimentPanel }[game.stage]();
}

document.addEventListener("click", (e) => {
  const action = e.target.closest("[data-action]")?.dataset.action;
  if (!action || !game.level) return;
  if (action === "pick") { game.picked = true; refresh(); }
  if (action === "everyone") { game.picked = false; refresh(); }
  if (action === "to-build") setStage("build");
  if (action === "to-freeze") toFreeze();
  if (action === "suggest") { game.showSuggestion = true; refresh(); }
  if (action === "poke") pokeTown();
  if (action === "verdict") judge();
  if (action === "rebuild") {
    board.load(game.level.layout, game.model);
    setStage("build");
  }
  if (action === "experiment") setStage("experiment");
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

function groupsOf(data) {
  const { treatment: t, outcome: y } = q();
  const idx = [...data[t].keys()];
  return [idx.filter((i) => data[t][i] === 1), idx.filter((i) => data[t][i] === 0)];
}

const avg = (data, id, rows) => rows.reduce((s, i) => s + data[id][i], 0) / rows.length;

function watchVars() {
  const { outcome: y } = q();
  const [yes, no] = groupsOf(game.data);
  const a = avg(game.data, y, yes);
  const b = avg(game.data, y, no);
  const ratio = a / b;
  return {
    a: value(a, y),
    b: value(b, y),
    diff: change(a - b, { signed: false }),
    absdiff: change(a - b, { signed: false }),
    ratio: ratio > 1.8 && ratio < 2.2 ? "twice" : `${ratio.toFixed(1)} times`,
    rates: [a, b],
    rows: [yes, no],
  };
}

function watchScreen() {
  const lv = game.level;
  const t = block(q().treatment);
  const y = block(q().outcome);
  let statement;
  let detail;
  let visual;
  if (t.kind === "yesno") {
    const v = watchVars();
    statement = fill(lv.watch.statement, v);
    detail = fill(lv.watch.detail, v);
    visual = y.kind === "yesno" ? crowds(v) : strips(v);
  } else {
    ({ statement, detail, visual } = gate());
  }
  return `
    <p class="statement">${escapeHtml(statement)}<small>${escapeHtml(detail)}</small></p>
    ${visual}
    <div class="controls">
      ${lv.world.select && !game.picked ? "" : `<button type="button" class="btn primary-btn" data-action="to-build">Build a model →</button>`}
      <span class="meta">The data agrees with the headline. But does one thing really cause the other?</span>
    </div>`;
}

/** Two crowds of 20, with the outcome shown on each figure (yes/no outcome). */
function crowds(v) {
  const lv = game.level;
  const outcome = label(q().outcome).toLowerCase();
  const order = [3, 17, 9, 12, 0, 6, 15, 10, 19, 5, 1, 13, 8, 18, 2, 11, 14, 4, 16, 7];
  const crowd = (rate, i) => {
    const hits = Math.round(rate * 20);
    const kids = order.map((slot, k) => {
      const col = slot % 10;
      const row = Math.floor(slot / 10);
      const x = 22 + col * 39;
      const yy = 52 + row * 76;
      const color = k < hits ? "var(--g-hit)" : "var(--g-figure)";
      const prop = i === 0 && lv.id === "beach" ? `<path d="M${x + 13} ${yy - 2} l5 14 l5 -14 z" fill="#d9a066"/><circle cx="${x + 18}" cy="${yy - 5}" r="6" fill="#ffd6e7"/>` : "";
      return `<circle cx="${x}" cy="${yy - 14}" r="10" fill="${color}"/><rect x="${x - 11}" y="${yy - 2}" width="22" height="28" rx="9" fill="${color}"/>${prop}`;
    }).join("");
    return `<div class="crowd"><h3>${escapeHtml(lv.watch.groups[i])} <span class="pct">${Math.round(rate * 100)}%</span></h3>
      <svg viewBox="0 0 400 170" role="img" aria-label="${hits} in 20 ${escapeHtml(outcome)}">${kids}</svg></div>`;
  };
  return `<div class="crowds">${crowd(v.rates[0], 0)}${crowd(v.rates[1], 1)}</div>
    <div class="legend"><span><i class="dot" style="background: var(--g-hit)"></i>${escapeHtml(label(q().outcome))}</span><span><i class="dot" style="background: var(--g-figure)"></i>Not</span></div>`;
}

/** Two rows of figures placed along the outcome's scale, with each group's average (number outcome). */
function strips(v) {
  const lv = game.level;
  const y = q().outcome;
  const pick = (rows) => rows.filter((_, k) => k % Math.max(1, Math.floor(rows.length / 26)) === 0).slice(0, 26);
  const rowsShown = v.rows.map(pick);
  const all = rowsShown.flat().map((i) => game.data[y][i]);
  const lo = Math.min(...all);
  const hi = Math.max(...all);
  const x = (val) => 30 + ((val - lo) / (hi - lo || 1)) * 540;
  const strip = (rows, i) => {
    const mean = v.rates[i];
    const figs = rows.map((r, k) => {
      const xx = x(game.data[y][r]);
      const yy = 44 + (k % 3) * 14;
      return `<circle cx="${xx}" cy="${yy - 6}" r="5" fill="var(--g-figure)"/><rect x="${xx - 5}" y="${yy - 1}" width="10" height="11" rx="4" fill="var(--g-figure)"/>`;
    }).join("");
    return `<div class="crowd"><h3>${escapeHtml(lv.watch.groups[i])} <span class="pct alt">${value(mean, y)}</span></h3>
      <svg viewBox="0 0 600 100" role="img" aria-label="${escapeHtml(lv.watch.groups[i])}: average ${value(mean, y)}">
        <line x1="30" x2="570" y1="88" y2="88" stroke="#c9d4de" stroke-width="2"/>
        ${figs}
        <line x1="${x(mean)}" x2="${x(mean)}" y1="20" y2="92" stroke="var(--g-mean)" stroke-width="4" stroke-linecap="round"/>
      </svg></div>`;
  };
  return `<div class="crowds stack">${strip(rowsShown[0], 0)}${strip(rowsShown[1], 1)}</div>
    <div class="legend"><span><i class="bar-key"></i>Average ${escapeHtml(label(y).toLowerCase())}</span><span>Each figure is one person, placed by their ${escapeHtml(label(y).toLowerCase())}.</span></div>`;
}

/** Football: a scatter of the whole town, then the Bouncer picks the team. */
function gate() {
  const lv = game.level;
  const { treatment: tx, outcome: ty } = q();
  const [sel, selValue] = lv.world.select;
  const town = game.town;
  const n = town[tx].length;
  const people = [...Array(n).keys()].map((i) => ({ x: town[tx][i], y: town[ty][i], in: town[sel][i] === selValue }));
  const visible = game.picked ? people.filter((p) => p.in) : people;
  const mx = visible.reduce((s, p) => s + p.x, 0) / visible.length;
  const my = visible.reduce((s, p) => s + p.y, 0) / visible.length;
  let num = 0;
  let den = 0;
  for (const p of visible) {
    num += (p.x - mx) * (p.y - my);
    den += (p.x - mx) ** 2;
  }
  const b = num / den;
  const W = 640;
  const H = 400;
  const PAD = 48;
  const clamp = (v) => Math.max(-2.7, Math.min(2.7, v));
  const sx = (v) => PAD + ((clamp(v) + 3) / 6) * (W - PAD - 20);
  const sy = (v) => H - PAD - ((clamp(v) + 3) / 6) * (H - PAD - 20);
  const line = (v) => my + b * (v - mx);
  const fig = (p) => {
    const color = game.picked && p.in ? "var(--role-collider)" : "var(--g-figure)";
    return `<g style="opacity:${game.picked && !p.in ? 0.12 : 1}"><circle cx="${sx(p.x)}" cy="${sy(p.y) - 7}" r="4.5" fill="${color}"/><rect x="${sx(p.x) - 5}" y="${sy(p.y) - 2}" width="10" height="10" rx="4" fill="${color}"/></g>`;
  };
  const kept = people.filter((p) => p.in).length;
  const visual = `
    <div class="gate">
      <svg class="plot" viewBox="0 0 ${W} ${H}" role="img" aria-label="${escapeHtml(label(tx))} against ${escapeHtml(label(ty))} for ${game.picked ? "players on the team" : "everyone"}">
        <line x1="${PAD}" y1="${H - PAD}" x2="${W - 20}" y2="${H - PAD}" stroke="#c9d4de" stroke-width="2"/>
        <line x1="${PAD}" y1="20" x2="${PAD}" y2="${H - PAD}" stroke="#c9d4de" stroke-width="2"/>
        <text x="${W - 20}" y="${H - 16}" text-anchor="end">${escapeHtml(label(tx))} →</text>
        <text x="${PAD - 10}" y="16">↑ ${escapeHtml(label(ty))}</text>
        ${people.map(fig).join("")}
        <line x1="${sx(-2.7)}" y1="${sy(line(-2.7))}" x2="${sx(2.7)}" y2="${sy(line(2.7))}" stroke="${game.picked ? "var(--role-collider)" : "#1f2933"}"
          stroke-width="4" stroke-linecap="round" stroke-dasharray="${game.picked ? "none" : "8 8"}" opacity="0.85"/>
      </svg>
      <div class="bouncer-box">
        <div class="bubble">${game.picked ? "Talented or lucky? You're in. Everyone else, out!" : "Everyone's here. No team picked yet."}</div>
        ${portrait(Role.COLLIDER, 150)}
        ${game.picked
          ? `<button type="button" class="btn ghost-btn" data-action="everyone">Show everyone again</button>`
          : `<button type="button" class="btn collider-btn" data-action="pick">Let the Bouncer pick the team</button>`}
      </div>
    </div>`;
  return game.picked
    ? { statement: lv.watch.statement, detail: fill(lv.watch.detail, { kept, total: n }), visual }
    : { statement: lv.watch.everyone, detail: lv.watch.everyoneDetail, visual };
}

// ---- Build ---------------------------------------------------------------

function buildPanel() {
  const { treatment: t, outcome: y } = q();
  const p = currentPrediction();
  return `
    <h3>Build your model</h3>
    <p>Draw an arrow for everything you think causes something else: drag from a block's round handle onto another block.</p>
    <p class="meta">The question: does <b>${escapeHtml(label(t))}</b> really cause <b>${escapeHtml(label(y))}</b>? Click an arrow to reverse or remove it.</p>
    <p class="meter-label">Your model's prediction, as you draw:</p>
    ${meter(p.effect)}
    <button type="button" class="btn primary-btn" data-action="to-freeze">Next: freeze →</button>`;
}

function toFreeze() {
  game.model = board.graph().edges.map((e) => [...e]);
  setStage("freeze");
}

// ---- Freeze --------------------------------------------------------------

function freezePanel() {
  const lv = game.level;
  const { treatment: t, outcome: y } = q();
  const p = currentPrediction();
  game.prediction = p;
  const T = `<b>${escapeHtml(label(t))}</b>`;
  const Y = `<b>${escapeHtml(label(y))}</b>`;
  const pokeLabel = escapeHtml(lv.poke.label);

  if (lv.freezeOnly) {
    const others = Object.keys(lv.world.blocks).filter((id) => id !== t && id !== y);
    let suggestion = "";
    if (game.showSuggestion) {
      try {
        const id = dowhyBackdoor(board.graph(), t, y);
        suggestion = id.noDirectedPath
          ? "Your drawing has no path from breakfast club to grades, so it says nothing needs freezing."
          : id.adjustmentSet.length ? `Your drawing says: freeze ${list(id.adjustmentSet)}.` : "Your drawing says: freeze nothing.";
      } catch {
        suggestion = "Your drawing has a loop, so it can't say.";
      }
    }
    return `
      <h3>Freeze a block</h3>
      <p>You can't send every child to breakfast club, so you can't poke this town. Instead, <b>freeze</b> a block: compare only children who are the same on it.</p>
      <div class="freeze-list">
        ${others.map((id) => `<label class="freeze-chip"><input type="checkbox" data-freeze="${id}" ${game.freeze.has(id) ? "checked" : ""}> ❄ ${escapeHtml(label(id))}</label>`).join("")}
      </div>
      ${game.showSuggestion ? `<p class="hint-box">${suggestion}</p>` : `<p><button type="button" class="link-button" data-action="suggest">What does my drawing say to freeze?</button></p>`}
      <p class="prediction">${pokeLabel}, and ${Y} would change by <b>${change(p.effect)}</b>.</p>
      ${meter(p.effect)}
      <button type="button" class="btn primary-btn" data-action="poke">Reveal the truth →</button>`;
  }

  let why;
  if (p.noPath) why = `Your model has no path of arrows from ${T} to ${Y}, so it says poking one won't move the other. Nothing to freeze.`;
  else if (p.adjust.length) {
    why = `Your model freezes ${list(p.adjust)} ❄. It compares ${T} and no ${T} among people who are the same on ${list(p.adjust)}, so that block can't fake a link.`;
  } else why = `Your model doesn't need to freeze anything: nothing in it pushes on both ${T} and ${Y}, so the groups can be compared as they are.`;
  return `
    <h3>Freeze</h3>
    <p>To test the headline fairly, compare like with like. Your drawing decides what to hold still.</p>
    <p>${why}</p>
    <p class="prediction">${pokeLabel}, and ${Y} would change by <b>${change(p.effect)}</b>.</p>
    ${meter(p.effect)}
    <div class="step-actions">
      <button type="button" class="btn primary-btn" data-action="poke">Poke the town →</button>
      <button type="button" class="link-button" data-action="rebuild">Change my model</button>
    </div>`;
}

// ---- Poke ----------------------------------------------------------------

function pokeTown() {
  game.prediction = currentPrediction();
  game.model = board.graph().edges.map((e) => [...e]);
  // Graph surgery: forcing a block cuts every arrow into it.
  const t = q().treatment;
  board.load(game.level.layout, game.model.filter(([, c]) => c !== t));
  setStage("poke");
}

function pokePanel() {
  const lv = game.level;
  const { treatment: t, outcome: y } = q();
  const r = game.truth;
  const yesno = block(t).kind === "yesno";
  const cut = game.model.filter(([, c]) => c === t);
  const intro = lv.freezeOnly
    ? "In real life you couldn't do this. In the game we can: a magic poke sends every child to breakfast club, then no child."
    : `${escapeHtml(lv.poke.label)}!${cut.length ? ` Forcing <b>${escapeHtml(label(t))}</b> snaps off every arrow into it: nothing else decides it now.` : ""}`;
  const rows = yesno
    ? [[`${label(t)} for everyone`, r.hi], [`${label(t)} for no one`, r.lo]]
    : [[`Everyone gets more ${label(t).toLowerCase()}`, r.hi], ["The town as it was", r.lo]];
  return `
    <h3>What the town did</h3>
    <p>${intro}</p>
    <div class="scoreboard">
      ${rows.map(([name, v]) => `<div><span>${escapeHtml(name)}</span><b>${value(v, y)}</b></div>`).join("")}
    </div>
    ${meter(game.prediction.effect, { truth: r.effect })}
    <button type="button" class="btn primary-btn" data-action="verdict">Was my model right? →</button>`;
}

// ---- Verdict -------------------------------------------------------------

function judge() {
  const lv = game.level;
  game.result = verdict(lv, game.prediction.effect, game.truth.effect);
  if (game.result.stands) {
    progress.levels[lv.id] = true;
    game.newCharacter = !progress.met[lv.meets];
    progress.met[lv.meets] = true;
    saveProgress();
    board.load(lv.layout, trueGraph(lv.world).edges);
    setStage("verdict");
    return;
  }
  board.load(lv.layout, game.model);
  setStage("verdict");
  $("stage-board").classList.add("falling");
}

function characterCard(role, fresh) {
  const c = CAST[role];
  return `<div class="new-character" style="--c: ${c.color}">
    ${portrait(role, 96, c.name)}
    <div><span class="label">${fresh ? "New character" : "You met again"}</span>
      <h4>${c.name} <small>(${c.term.toLowerCase()})</small></h4>
      <p>${escapeHtml(c.line)}</p><p class="meta">${escapeHtml(c.does)}</p></div>
  </div>`;
}

function verdictPanel() {
  const lv = game.level;
  const r = game.result;
  if (r.stands) {
    return `
      <h3 class="win">Your model was right!</h3>
      <p>It predicted <b>${change(game.prediction.effect)}</b> and the town did <b>${change(game.truth.effect)}</b>:
        close enough, within ${change(lv.tolerance, { signed: false })}.</p>
      ${characterCard(lv.meets, game.newCharacter)}
      <p>${escapeHtml(lv.reveal)}</p>
      <div class="step-actions">
        <button type="button" class="btn primary-btn" data-action="experiment">Experiment with this town →</button>
        <button type="button" class="link-button" data-action="next">${game.index + 1 < LEVELS.length ? "Skip to the next level" : "Back to the map"}</button>
      </div>`;
  }
  return `
    <h3 class="lose">The tower falls!</h3>
    <p>Your model predicted <b>${change(game.prediction.effect)}</b>, but the town did <b>${change(game.truth.effect)}</b>.</p>
    ${meter(game.prediction.effect, { truth: game.truth.effect })}
    <p class="hint-box"><b>Hint:</b> ${escapeHtml(lv.hint)}</p>
    <button type="button" class="btn primary-btn" data-action="rebuild">Rebuild your model</button>`;
}

// ---- Experiment ----------------------------------------------------------

function challengeStatus(p) {
  const lv = game.level;
  const target = lv.challenge.model.freeze
    ? predict(lv, { freeze: lv.challenge.model.freeze, data: game.data }).effect
    : predict(lv, { graph: { nodes: Object.keys(lv.world.blocks), edges: lv.challenge.model.edges }, data: game.data }).effect;
  const done = p.effect !== null && Math.abs(p.effect - target) <= lv.tolerance && Math.abs(p.effect - game.truth.effect) > lv.tolerance;
  if (done && !progress.challenges[lv.id]) {
    progress.challenges[lv.id] = true;
    saveProgress();
  }
  return { done, target };
}

function experimentPanel() {
  const lv = game.level;
  const p = currentPrediction();
  const { done, target } = challengeStatus(p);
  const freezeChips = lv.freezeOnly
    ? `<div class="freeze-list">${Object.keys(lv.world.blocks).filter((id) => id !== q().treatment && id !== q().outcome)
      .map((id) => `<label class="freeze-chip"><input type="checkbox" data-freeze="${id}" ${game.freeze.has(id) ? "checked" : ""}> ❄ ${escapeHtml(label(id))}</label>`).join("")}</div>`
    : "";
  const stands = p.effect !== null && Math.abs(p.effect - game.truth.effect) <= lv.tolerance;
  return `
    <h3>Experiment</h3>
    <p>Change the ${lv.freezeOnly ? "frozen blocks" : "arrows"} and watch your model's prediction move against what the town really does.
      ${stands ? "<b class='win'>Right now your model would stand.</b>" : "<b class='lose'>Right now your tower would fall.</b>"}</p>
    ${freezeChips}
    ${meter(p.effect, { truth: game.truth.effect })}
    <div class="challenge ${done || progress.challenges[lv.id] ? "done" : ""}">
      <span class="label">${done || progress.challenges[lv.id] ? "★ Challenge done" : "Challenge"}</span>
      <p>${escapeHtml(lv.challenge.text)}</p>
      ${done ? `<p class="meta">That model predicts ${escapeHtml(change(target))}. The town did ${escapeHtml(change(game.truth.effect))}. That gap is the headline's mistake.</p>` : ""}
    </div>
    <ul class="prompts">${lv.prompts.map((t) => `<li>${escapeHtml(t)}</li>`).join("")}</ul>
    <div class="step-actions">
      <button type="button" class="btn primary-btn" data-action="next">${game.index + 1 < LEVELS.length ? "Next level →" : "Back to the map"}</button>
      <button type="button" class="link-button" data-action="map">All levels</button>
    </div>`;
}

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------

const fromHash = LEVELS.findIndex((lv) => `#${lv.id}` === location.hash);
if (fromHash >= 0) startLevel(fromHash);
else showMap();
