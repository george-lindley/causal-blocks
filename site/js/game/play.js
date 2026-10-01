// The game. Chapter 1, Hilltop School: each level adds one idea and uses only
// the steps it needs (The data, Draw, Freeze, Test, Verdict), with an
// optional bonus round on the later levels. The engine is world.js; the
// drawing canvas is the site's shared board.

import { createBoard } from "../board.js";
import { Role, roles } from "../causal.js";
import { CAST, CHARACTER_TEXT, DETECTIVE, portrait, silhouette } from "./cast.js";
import { LEVELS } from "./levels.js";
import { direction, pokeResult, predict, simulate, trueGraph, verdict, watched } from "./world.js";

const $ = (id) => document.getElementById(id);

const STAGE_NAMES = { watch: "The data", build: "Draw", freeze: "Freeze", poke: "Test", verdict: "Verdict" };
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
  truth: null, // what making it happen really does; shown only after the player does it
  model: [],
  freeze: new Set(),
  prediction: null,
  result: null,
  twist: false, // level 6: has the player found out where the numbers came from?
  wholeSchool: false, // level 6: showing everyone instead of the headline's pupils
  switchOn: false, // test: has the switch been flipped to everyone?
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

/** Block names, bold and joined: "A", "A and B", "A, B and C". */
function list(ids) {
  const names = ids.map((id) => `<b>${escapeHtml(label(id))}</b>`);
  return names.length <= 1 ? names.join("") : `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`;
}

/** An arrow as a sentence: "Revision club causes pupils to understand the topic." */
function claim(from, to) {
  const [subject] = block(from).say ?? [label(from)];
  const [, object] = block(to).say ?? [null, label(to).toLowerCase()];
  return `<b>${escapeHtml(subject)}</b> causes <b>${escapeHtml(object)}</b>.`;
}

/** "8 in 10" */
const inTen = (r) => `${Math.round(r * 10)} in 10`;

/** A change in the outcome, counted in pupils: "5 more in every 10", "no change". */
function change(e) {
  const n = Math.round(Math.abs(e) * 10 * 2) / 2; // to the nearest half pupil
  if (n === 0) return "no change";
  const count = Number.isInteger(n) ? n : n.toFixed(1);
  return `${count} ${e > 0 ? "more" : "fewer"} in every 10`;
}

// How to say "more / fewer / no change" for each outcome, before and after it happens.
const WILL = {
  pass: { more: "more pupils will pass", fewer: "fewer pupils will pass", same: "the same number will pass" },
  maths: { more: "more pupils will be good at maths", fewer: "fewer pupils will be good at maths", same: "the same number will be good at maths" },
};
const DID = {
  pass: { more: "more pupils passed", fewer: "fewer pupils passed", same: "the same number passed" },
  maths: { more: "more pupils were good at maths", fewer: "fewer pupils were good at maths", same: "just as many were good at maths" },
};
const PAST = { pass: "passed", maths: "were good at maths" };
const dir = (e) => direction(e, lv().tolerance);

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
// Pictures
// ---------------------------------------------------------------------------

function figures(lit, cls) {
  return Array.from({ length: 10 }, (_, k) => {
    const x = 20 + k * 38;
    return `<g class="fig ${k < lit ? cls : "off"}"><circle cx="${x}" cy="16" r="9"/><rect x="${x - 10}" y="27" width="20" height="25" rx="8"/></g>`;
  }).join("");
}

/** A row of 10 pupils with some lit up, and "8 in 10" in big type. */
function crowd(title, r) {
  const lit = Math.round(r * 10);
  return `<div class="crowd">
    <div class="crowd-head"><span>${escapeHtml(title)}</span><b>${lit} in 10</b></div>
    <svg viewBox="0 0 400 58" role="img" aria-label="${escapeHtml(title)}: ${lit} in 10">${figures(lit, "hit")}</svg>
  </div>`;
}

function crowdPair([a, b], names, note) {
  return `<div class="crowd-block"><div class="crowds">${crowd(names[0], a)}${crowd(names[1], b)}</div>
    <p class="legend"><i class="dot"></i>${escapeHtml(note)}</p></div>`;
}

/** "pass" / "are good at maths": the outcome as a verb phrase. */
function outcomeVerb() {
  return { pass: "pass", maths: "are good at maths" }[q().outcome] ?? label(q().outcome).toLowerCase();
}

/** "who passes" / "who's good at maths": the outcome as a noun phrase. */
function outcomeWho() {
  return { pass: "who passes", maths: "who's good at maths" }[q().outcome] ?? label(q().outcome).toLowerCase();
}

/** "5 more in every 10 pass", or "No change in who passes". */
function changeSentence(e) {
  const c = change(e);
  return c === "no change" ? `No change in ${outcomeWho()}` : `${c} ${outcomeVerb()}`;
}

/** A difference as pupils: green figures for more, red for fewer. */
function diffCard(title, e, tone) {
  const n = Math.min(10, Math.round(Math.abs(e) * 10));
  const cls = e > 0 ? "more" : "fewer";
  return `<div class="diff ${tone}">
    <span class="label">${escapeHtml(title)}</span>
    <p><b>${escapeHtml(changeSentence(e))}</b></p>
    <svg viewBox="0 0 400 58" aria-hidden="true">${figures(n, cls)}</svg>
  </div>`;
}

/** New action: Test. Flip the switch and the block happens for everyone. */
function makeItHappenIntro() {
  return `<div class="action-intro">
    <svg class="anim-switch" viewBox="0 0 320 150" aria-hidden="true">
      <rect class="forced" x="100" y="30" width="120" height="40" rx="11" fill="#fa953d"/>
      <text x="160" y="55" text-anchor="middle" font-size="14" font-weight="700" fill="#1f2933">Everyone</text>
      <rect x="125" y="92" width="70" height="30" rx="15" fill="#e1e7ee" stroke="#1f2933" stroke-width="2.5"/>
      <circle class="knob" cx="141" cy="107" r="11" fill="#fff" stroke="#1f2933" stroke-width="2.5"/>
    </svg>
    <div><span class="label">New action</span><h4>Test</h4>
      <p>To test a theory, flip the switch: every pupil goes to revision club. Then watch what changes.
        If more pupils pass, revision club caused it.</p></div>
  </div>`;
}

/** New idea (breakfast club): testing switches off every arrow into the block. */
function switchOffIntro() {
  const { treatment: t } = q();
  const cut = game.model.filter(([, c]) => c === t).map(([p]) => p);
  const what = cut.length
    ? `The arrow from ${list(cut)} switches off: it no longer decides who goes. Only your switch does.`
    : "Any arrow into it switches off: nothing else decides who goes now. Only your switch does.";
  return `<div class="action-intro">
    <svg class="anim-switch" viewBox="0 0 320 150" aria-hidden="true">
      <rect x="10" y="22" width="80" height="30" rx="9" fill="#3498db"/>
      <g class="snap snap-a"><path d="M90 37 L150 62" stroke="#74828f" stroke-width="4" fill="none"/><path d="M142 54 l10 9 l-13 3 z" fill="#74828f"/></g>
      <rect class="forced" x="155" y="56" width="120" height="40" rx="11" fill="#fa953d"/>
      <text x="215" y="81" text-anchor="middle" font-size="14" font-weight="700" fill="#1f2933">Everyone</text>
      <rect x="180" y="112" width="70" height="30" rx="15" fill="#e1e7ee" stroke="#1f2933" stroke-width="2.5"/>
      <circle class="knob" cx="196" cy="127" r="11" fill="#fff" stroke="#1f2933" stroke-width="2.5"/>
    </svg>
    <div><span class="label">New idea</span><h4>Testing switches arrows off</h4>
      <p>When you send everyone to <b>${escapeHtml(label(t))}</b>, nothing else gets a say in who goes.
        ${what} That's what makes a test fair.</p></div>
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
  let currentCase = null;
  $("levels").innerHTML = LEVELS.map((l, i) => {
    const heading = l.case !== currentCase ? `<li class="case-heading">${escapeHtml(l.case)}</li>` : "";
    currentCase = l.case;
    return `${heading}
    <li>
      <button type="button" class="level-card${progress.levels[l.id] ? " done" : ""}" data-level="${i}">
        <span class="level-no">${progress.levels[l.id] ? "✓" : i + 1}</span>
        <span class="level-text">
          <span class="level-place">${escapeHtml(l.title)}</span>
          <span class="level-headline">“${escapeHtml(l.headline)}”</span>
          <span class="level-lesson">${escapeHtml(l.teaches)}${progress.bonus[l.id] ? " · ★ bonus" : ""}</span>
        </span>
      </button>
    </li>`;
  }).join("");
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
  game.freeze = new Set();
  game.model = [];
  game.prediction = game.result = null;
  game.twist = false;
  game.wholeSchool = false;
  game.newlyMet = [];
  board.load(l.layout, l.startEdges ?? []);
  $("map").hidden = true;
  $("level").hidden = false;
  $("level-place").textContent = `Level ${i + 1} of ${LEVELS.length} · ${l.title}`;
  $("paper-case").textContent = l.case;
  $("headline").textContent = `“${l.headline}”`;
  $("story").textContent = l.story;
  // The investigation: after the newspaper's claim, the detective's own hunch.
  $("case-card").innerHTML = `
    <svg class="detective" viewBox="0 0 200 200" aria-hidden="true">${DETECTIVE}</svg>
    <div><span class="label">${l.caseIntro ? (i === 0 ? "Your first case" : "New case") : "The investigation"}</span>
      <h2>${escapeHtml(l.caseIntro ? l.case : "Your hunch")}</h2>
      <p class="hunch">${escapeHtml(l.hunch)}</p></div>`;
  history.replaceState(null, "", `#${l.id}`);
  // One thing at a time: the newspaper's claim, then the investigation, then the task.
  $("read-on").hidden = false;
  $("level-body").hidden = true;
  $("to-task").hidden = false;
  $("task").hidden = true;
  setStage("watch");
  $("level").scrollIntoView({ block: "start" });
}

$("read-on-btn").addEventListener("click", () => {
  $("read-on").hidden = true;
  $("level-body").hidden = false;
  $("case-card").scrollIntoView({ behavior: "smooth", block: "start" });
});

$("to-task-btn").addEventListener("click", () => {
  $("to-task").hidden = true;
  $("task").hidden = false;
  $("stages").scrollIntoView({ behavior: "smooth", block: "start" });
});

function setStage(stage) {
  game.stage = stage;
  const stages = lv().stages;
  const at = stages.indexOf(stage);
  $("stages").innerHTML = stages.map((s, n) =>
    `<li class="${s === stage ? "current" : n < at || stage === "bonus" ? "past" : ""}">${STAGE_NAMES[s]}</li>`).join("");
  $("watch-screen").hidden = stage !== "watch";
  $("play-screen").hidden = stage === "watch";
  $("stage-board").classList.remove("busted");
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
  $("stage-panel").innerHTML = { build: buildPanel, freeze: freezePanel, poke: makeItHappenPanel, verdict: verdictPanel, bonus: bonusPanel }[game.stage]();
}

document.addEventListener("click", (e) => {
  const action = e.target.closest("[data-action]")?.dataset.action;
  if (!action || !game.level) return;
  if (action === "twist") { game.twist = true; refresh(); }
  if (action === "whole-school") { game.wholeSchool = !game.wholeSchool; refresh(); }
  if (action === "continue") setStage(next(game.stage));
  if (action === "check") checkArrow();
  if (action === "make-it-happen") toMakeItHappen();
  if (action === "switch") flip();
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

/** The watch statement with this school's real counts filled in. */
function factsSentence(template, [a, b]) {
  return template.replace("{a}", Math.round(a * 10)).replace("{b}", Math.round(b * 10));
}

/** Names what the data shows: a correlation, which the headline turns into a causal claim. */
function correlationNote(a, b) {
  const { treatment: t } = q();
  const as = `That's ${ratioWords(a, b)} as likely.`;
  if (lv().tutorial) {
    return `<p class="correlation">${as} A <b>correlation</b> means two things go together: here, ${escapeHtml(label(t).toLowerCase())} and passing.
      The newspaper goes further. It says one <i>causes</i> the other. Is it right?</p>`;
  }
  return `<p class="correlation">${as} They go together. The newspaper turns that into a cause: <i>“${escapeHtml(lv().headline)}”</i></p>`;
}
function watchScreen() {
  const l = lv();
  const note = `Lit up: ${l.watch.outcome}`;
  if (l.world.select) return twistWatch(l, note);
  const [a, b] = rates(game.data);
  return `
    <p class="data-label">This year's results at Hilltop</p>
    <p class="statement"><span class="tag">Correlation</span> ${escapeHtml(factsSentence(l.watch.statement, [a, b]))}</p>
    ${correlationNote(a, b)}
    ${crowdPair([a, b], l.watch.groups, note)}
    <div class="controls">
      <button type="button" class="btn primary-btn" data-action="continue">${l.freezeOnly ? "Freeze a block →" : "Draw your theory →"}</button>
    </div>`;
}

/** Level 6: first the paper's numbers; then where they came from; then the whole school. */
function twistWatch(l, note) {
  const [a, b] = rates(game.data);
  if (!game.twist) {
    return `
      <p class="data-label">The paper's numbers</p>
      <p class="statement"><span class="tag">Correlation</span> ${escapeHtml(factsSentence(l.watch.statement, [a, b]))}</p>
      <p class="correlation">Sport and maths seem to go against each other. The newspaper says sport <i>causes</i> worse maths.</p>
      ${crowdPair([a, b], l.watch.groups, note)}
      <div class="controls"><button type="button" class="btn primary-btn" data-action="twist">Where did these numbers come from? →</button></div>`;
  }
  const [wa, wb] = rates(game.everyone);
  return `
    <div class="gate">
      <div>
        <p class="statement">${escapeHtml(l.watch.twist)}<small>${game.wholeSchool
          ? `Across the whole school: ${inTen(wa)} against ${inTen(wb)}. No link at all.`
          : `Scholarship pupils only: ${inTen(a)} against ${inTen(b)}.`}</small></p>
        ${game.wholeSchool ? crowdPair([wa, wb], l.watch.groups, note) : crowdPair([a, b], l.watch.groups, note)}
      </div>
      <div class="bouncer-box">
        <div class="bubble">Sporty, or good at maths? You get a scholarship. Everyone else, no.</div>
        ${portrait(Role.COLLIDER, 120)}
        <button type="button" class="btn ${game.wholeSchool ? "ghost-btn" : "collider-btn"}" data-action="whole-school">${game.wholeSchool ? "Back to the paper's pupils" : "Show the whole school"}</button>
      </div>
    </div>
    <div class="controls"><button type="button" class="btn primary-btn" data-action="continue">Draw your theory →</button></div>`;
}

// ---- Draw ----------------------------------------------------------------

/** "went to revision club", "had free breakfast", "were sporty": for sentences about the switch. */
function actionPhrase() {
  return { revision: "went to revision club", club: "went to breakfast club", sporty: "were sporty" }[q().treatment] ?? `had ${label(q().treatment).toLowerCase()}`;
}

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
  const edges = board.graph().edges;
  return `
    <h3>Draw your theory</h3>
    <p>Drag from a block's round handle onto the block it causes. Click an arrow to flip or remove it.</p>
    <div class="drawn">
      <span class="label">What you've drawn</span>
      ${edges.length
        ? `<ul>${edges.map(([a, b]) => `<li>${claim(a, b)}</li>`).join("")}</ul>`
        : `<p class="meta">No arrows yet.</p>`}
    </div>
    ${predictionLine()}
    <button type="button" class="btn primary-btn" data-action="make-it-happen">Test it →</button>`;
}

/** "Your theory predicts: if everyone went to revision club, more pupils will pass." */
function predictionLine() {
  const p = currentPrediction();
  if (p.effect === null) return "";
  const who = lv().freezeOnly ? "If you freeze that" : "If what you've drawn is right";
  const test = lv().poke.label.replace(/^Magic: /, "");
  return `<p class="prediction">${who}: ${escapeHtml(test.charAt(0).toLowerCase() + test.slice(1))}, and <b>${escapeHtml(WILL[q().outcome][dir(p.effect)])}</b>.</p>`;
}
function checkArrow() {
  const { treatment: t, outcome: y } = q();
  const edges = board.graph().edges;
  game.model = edges.map((e) => [...e]);
  const right = edges.some(([p, c]) => p === t && c === y);
  game.result = { stands: right };
  if (right) meet();
  setStage("verdict");
  if (!right) $("stage-board").classList.add("busted");
}

// ---- Freeze --------------------------------------------------------------

function freezePanel() {
  const l = lv();
  const { treatment: t, outcome: y } = q();
  const others = Object.keys(l.world.blocks).filter((id) => id !== t && id !== y);
  const frozen = [...game.freeze].filter((id) => id !== y);
  const note = `Lit up: ${l.watch.outcome}`;
  let crowdsHtml;
  if (frozen.length === 1) {
    const z = frozen[0];
    crowdsHtml = [1, 0].map((v) => {
      const [a, b] = rates(game.data, (i) => game.data[z][i] === v);
      return `<p class="group-title">❄ ${escapeHtml(label(z))}: ${v ? "yes" : "no"}</p>${crowdPair([a, b], l.watch.groups, note)}`;
    }).join("");
  } else {
    crowdsHtml = `<p class="group-title">Nothing frozen: everyone together</p>${crowdPair(rates(game.data), l.watch.groups, note)}`;
  }
  return `
    ${l.introduces === "freeze" ? freezeIntro() : ""}
    <h3>Freeze a block</h3>
    <p>Which block should you hold still, so you compare <b>${escapeHtml(label(t))}</b> with no <b>${escapeHtml(label(t))}</b> fairly?</p>
    <div class="freeze-list">
      ${others.map((id) => `<label class="freeze-chip"><input type="checkbox" data-freeze="${id}" ${game.freeze.has(id) ? "checked" : ""}> ❄ ${escapeHtml(label(id))}</label>`).join("")}
    </div>
    <div class="freeze-crowds">${crowdsHtml}</div>
    ${predictionLine()}
    <button type="button" class="btn primary-btn" data-action="make-it-happen">Test it with magic →</button>`;
}

// ---- Test ------------------------------------------------------------------

function toMakeItHappen() {
  game.prediction = currentPrediction();
  game.model = board.graph().edges.map((e) => [...e]);
  game.switchOn = false;
  const t = q().treatment;
  setStage("poke");
  // Forcing a block cuts every arrow into it: let them visibly snap off, then remove them.
  const into = game.model.map((e, i) => (e[1] === t ? i : -1)).filter((i) => i >= 0);
  if (!into.length) return;
  for (const i of into) $("canvas").querySelector(`[data-edge="${i}"]`)?.classList.add("snapping");
  setTimeout(() => {
    if (game.stage !== "poke") return;
    board.load(lv().layout, game.model.filter(([, c]) => c !== t));
    drawBoard();
  }, 900);
}

function flip() {
  game.switchOn = !game.switchOn;
  refresh();
}

function makeItHappenPanel() {
  const l = lv();
  const { treatment: t, outcome: y } = q();
  const r = game.truth;
  const on = game.switchOn;
  const lo = Math.round(r.lo * 10);
  const hi = Math.round(r.hi * 10);
  // One crowd of 10: flipping the switch gives everyone the cause (a badge),
  // then the pupils whose result changes light up (or go out) one at a time.
  const figs = Array.from({ length: 10 }, (_, k) => {
    const x = 20 + k * 38;
    let cls = k < lo ? "hit" : "off";
    let delay = 0;
    if (on) {
      if (k < Math.min(lo, hi)) cls = "hit";
      else if (k >= lo && k < hi) { cls = "hit newly"; delay = 0.5 + (k - lo) * 0.25; }
      else if (k >= hi && k < lo) { cls = "off going"; delay = 0.5 + (k - hi) * 0.25; }
      else cls = "off";
    }
    const badge = on ? `<circle class="badge" cx="${x + 9}" cy="6" r="6"/>` : "";
    return `<g class="fig ${cls}" style="--delay:${delay}s"><circle cx="${x}" cy="16" r="9"/><rect x="${x - 10}" y="27" width="20" height="25" rx="8"/>${badge}</g>`;
  }).join("");
  const caption = on
    ? `Everyone ${escapeHtml(actionPhrase())}: <b>${hi} in 10 ${PAST[y] ?? ""}</b>${hi === lo ? ", just like before" : `, ${hi > lo ? "up" : "down"} from ${lo} in 10`}.`
    : `No one ${escapeHtml(actionPhrase())}: <b>${lo} in 10 ${PAST[y] ?? ""}</b>.`;
  return `
    ${l.introduces === "poke" ? makeItHappenIntro() : ""}
    ${l.introducesSwitchOff ? switchOffIntro() : ""}
    <h3>${l.freezeOnly ? "Test it with magic" : "Test it"}</h3>
    <p>${l.freezeOnly ? "In real life you can't. In the game you can." : "Flip the switch and watch the school."}</p>
    <div class="switch-row">
      <span class="${on ? "" : "on"}">No one</span>
      <button type="button" class="switch" data-action="switch" role="switch" aria-checked="${on}" aria-label="${escapeHtml(l.poke.label)}"><span class="knob"></span></button>
      <span class="${on ? "on" : ""}">Everyone</span>
    </div>
    <div class="crowd happen"><svg viewBox="0 0 400 58" role="img" aria-label="${on ? hi : lo} in 10">${figs}</svg></div>
    <p class="happen-caption">${caption}</p>
    ${on ? `<button type="button" class="btn primary-btn reveal-late" data-action="verdict">Was my theory right? →</button>` : ""}`;
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
  $("stage-board").classList.add("busted");
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

/** Why the theory predicted what it did, in a sentence, when that's the lesson. */
function whyTheory() {
  const { treatment: t, outcome: y } = q();
  if (!game.prediction.noPath) return "";
  return `Your theory has no arrow path from <b>${escapeHtml(label(t))}</b> to <b>${escapeHtml(label(y))}</b>,
    so it says making ${escapeHtml(label(t).toLowerCase())} happen for everyone can't change ${escapeHtml(outcomeWho())}.`;
}

function verdictPanel() {
  const l = lv();
  const last = game.index + 1 >= LEVELS.length;
  const nextBtn = `<button type="button" class="btn primary-btn" data-action="next">${last ? "Back to the map" : "Next level →"}</button>`;
  const y = q().outcome;
  if (game.result.stands) {
    const did = game.result.did;
    const headline = l.tutorial ? "Your first causal claim!" : "Congratulations!";
    const lead = l.tutorial ? "" : `<p class="big-result">That's what happened: ${escapeHtml(DID[y][did])}. ${did === "same"
      ? "You showed the newspaper's link was fake."
      : "You found a causal link."}</p>`;
    return `
      ${celebrate()}
      <h3 class="win">${headline}</h3>
      ${lead}
      <p>${escapeHtml(l.reveal)}</p>
      ${l.meets.map(characterCard).join("")}
      <div class="step-actions">
        ${nextBtn}
        ${l.bonus ? `<button type="button" class="link-button" data-action="bonus">★ Bonus: try to break this theory</button>` : ""}
      </div>`;
  }
  const why = l.tutorial ? "" : whyTheory();
  return `
    <h3 class="lose">${l.tutorial ? "Not quite" : "Theory busted!"}</h3>
    ${l.tutorial ? "" : `<p class="big-result">What you drew predicted: ${escapeHtml(WILL[y][game.result.said])}. But ${escapeHtml(DID[y][game.result.did])}.</p>`}
    ${why ? `<p>${why}</p>` : ""}
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
    <h3>★ Bonus: break the theory</h3>
    <p>The board shows how this school really works. Now ${l.freezeOnly ? "change what's frozen" : "move, flip or remove arrows"}
      and watch the theory's prediction drift away from what really happens.</p>
    ${chips}
    <div class="diffs">
      ${p.effect === null ? "" : diffCard("This theory says", p.effect, "theory")}
      ${diffCard("What really happens", game.truth.effect, "reality")}
    </div>
    <p class="${close ? "win" : "lose"}"><b>${close ? "This theory still holds up." : "Theory busted!"}</b></p>
    ${progress.bonus[l.id] ? `<p class="challenge done"><span class="label">★ Bonus earned</span> You built a theory that gets this school wrong. That's exactly the mistake the headline made.</p>` : ""}
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
