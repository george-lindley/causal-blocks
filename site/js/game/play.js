// The game: a level map, then each level as Headline -> Watch -> Build (or
// Freeze) -> Predict -> Poke -> Verdict. The engine is world.js; the drawing
// canvas is the site's shared board.

import { createBoard } from "../board.js";
import { Role, roles } from "../causal.js";
import { LEVELS } from "./levels.js";
import { pokeResult, predict, trueGraph, verdict, watched } from "./world.js";

const $ = (id) => document.getElementById(id);

const STAGE_NAMES = { watch: "Watch", build: "Build", freeze: "Freeze", predict: "Predict", poke: "Poke", verdict: "Verdict" };

// ---------------------------------------------------------------------------
// Progress, remembered in this browser only
// ---------------------------------------------------------------------------

const PROGRESS_KEY = "causalblocks-progress";
function loadProgress() {
  try {
    return JSON.parse(localStorage.getItem(PROGRESS_KEY)) ?? {};
  } catch {
    return {};
  }
}
const progress = loadProgress();
function complete(id) {
  progress[id] = true;
  try {
    localStorage.setItem(PROGRESS_KEY, JSON.stringify(progress));
  } catch {
    // Private mode or storage blocked: progress just isn't remembered.
  }
}

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

const game = {
  index: 0,
  level: null,
  stages: [],
  stage: null,
  data: null, // the watched town
  model: [], // the player's arrows when they asked for a prediction
  freeze: new Set(),
  prediction: null,
  poke: null,
  result: null,
  toastTimer: null,
};

const block = (id) => game.level.world.blocks[id];
const label = (id) => block(id)?.label ?? id;

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

/** A change in the outcome: "+23.0 percentage points". */
function change(e) {
  const out = block(game.level.question.outcome);
  const x = out.kind === "yesno" ? e * 100 : e;
  const s = Math.abs(x).toFixed(1);
  const sign = Number(s) === 0 ? "" : x < 0 ? "−" : "+";
  return `${sign}${s} ${game.level.units}`;
}

function list(ids) {
  const names = ids.map((id) => `<b>${escapeHtml(label(id))}</b>`);
  return names.length <= 1 ? names.join("") : `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`;
}

// ---------------------------------------------------------------------------
// Board
// ---------------------------------------------------------------------------

const board = createBoard($("canvas"), {
  label,
  locked: () => true, // a level's blocks always stay on the board
  onEdit: () => {
    // Changing the model after asking it means asking again.
    if (["predict", "poke"].includes(game.stage)) setStage(game.stages.includes("build") ? "build" : "freeze");
  },
  onChange: () => drawBoard(),
  toast,
  unknownCaption: "", // no hints: a block's role is revealed only when the level is won
});

function drawBoard() {
  if (!game.level) return;
  const { treatment: t, outcome: y } = game.level.question;
  if (game.stage === "verdict" && game.result?.stands) {
    board.draw(roles(board.graph(), t, y)); // the true graph, every role named
    return;
  }
  board.draw({ [t]: [Role.TREATMENT], [y]: [Role.OUTCOME] });
}

// ---------------------------------------------------------------------------
// Level map
// ---------------------------------------------------------------------------

function showMap() {
  game.level = null;
  $("level").hidden = true;
  $("map").hidden = false;
  $("levels").innerHTML = LEVELS.map((lv, i) => `
    <li>
      <button type="button" class="level-card${progress[lv.id] ? " done" : ""}" data-level="${i}">
        <span class="level-no">${i + 1}</span>
        <span class="level-text">
          <span class="level-place">${escapeHtml(lv.place)}</span>
          <span class="level-headline">“${escapeHtml(lv.headline)}”</span>
          <span class="level-lesson">${progress[lv.id] ? "✓ " : ""}${escapeHtml(lv.lesson)}</span>
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
  game.stages = lv.freezeOnly ? ["watch", "freeze", "predict", "poke", "verdict"] : ["watch", "build", "predict", "poke", "verdict"];
  game.data = watched(lv);
  game.freeze = new Set();
  game.model = [];
  game.prediction = game.poke = game.result = null;
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
  $("stages").innerHTML = game.stages.map((s) => {
    const n = game.stages.indexOf(s);
    const at = game.stages.indexOf(stage);
    return `<li class="${s === stage ? "current" : n < at ? "past" : ""}">${STAGE_NAMES[s]}</li>`;
  }).join("");
  $("stage-board").classList.remove("falling");
  $("stage-board").hidden = stage === "watch";
  $("stage-panel").innerHTML = { watch: watchPanel, build: buildPanel, freeze: freezePanel, predict: predictPanel, poke: pokePanel, verdict: verdictPanel }[stage]();
  drawBoard();
}

$("stage-panel").addEventListener("click", (e) => {
  const action = e.target.closest("[data-action]")?.dataset.action;
  if (!action) return;
  if (action === "to-build") setStage(game.stages[1]);
  if (action === "predict") askModel();
  if (action === "poke") pokeTown();
  if (action === "verdict") judge();
  if (action === "rebuild") {
    board.load(game.level.layout, game.model);
    setStage(game.stages[1]);
  }
  if (action === "next") (game.index + 1 < LEVELS.length ? startLevel(game.index + 1) : showMap());
  if (action === "map") showMap();
});

$("stage-panel").addEventListener("change", (e) => {
  const id = e.target.dataset.freeze;
  if (!id) return;
  if (e.target.checked) game.freeze.add(id);
  else game.freeze.delete(id);
});

// ---- Watch ---------------------------------------------------------------

function groups() {
  const { treatment: t, outcome: y } = game.level.question;
  const d = game.data;
  const avg = (rows) => rows.reduce((s, i) => s + d[y][i], 0) / rows.length;
  const idx = [...d[t].keys()];
  if (block(t).kind === "yesno") {
    return [
      { name: `${label(t)}: yes`, v: avg(idx.filter((i) => d[t][i] === 1)) },
      { name: `${label(t)}: no`, v: avg(idx.filter((i) => d[t][i] === 0)) },
    ];
  }
  const sorted = [...idx].sort((a, b) => d[t][a] - d[t][b]);
  const third = Math.floor(sorted.length / 3);
  return [
    { name: `Top third for ${label(t)}`, v: avg(sorted.slice(-third)) },
    { name: `Bottom third for ${label(t)}`, v: avg(sorted.slice(0, third)) },
  ];
}

function watchPanel() {
  const { outcome: y } = game.level.question;
  const g = groups();
  const top = Math.max(...g.map((x) => Math.abs(x.v)), 1e-9);
  const width = (v) => (block(y).kind === "yesno" ? v * 100 : (Math.abs(v) / top) * 100);
  const seen = game.level.world.select ? ` (we only get to see players who ${label(game.level.world.select[0]).toLowerCase()})` : "";
  return `
    <h3>Watch the town</h3>
    <p>Here's what the data shows${seen}: ${escapeHtml(label(y))} for each group.</p>
    <div class="bars">
      ${g.map((x) => `<div class="bar-row">
        <span class="bar-name">${escapeHtml(x.name)}</span>
        <span class="bar"><span style="width:${Math.max(2, width(x.v)).toFixed(1)}%"></span></span>
        <span class="bar-value">${value(x.v, y)}</span>
      </div>`).join("")}
    </div>
    <p class="meta">The headline looks right. But does one thing really cause the other?</p>
    <button type="button" class="primary" data-action="to-build">Build a model →</button>`;
}

// ---- Build / Freeze ------------------------------------------------------

function buildPanel() {
  const { treatment: t, outcome: y } = game.level.question;
  return `
    <h3>Build your model</h3>
    <p>Draw an arrow for everything you think causes something else. Drag from a block's round handle onto another block.</p>
    <p class="meta">The question: does <b>${escapeHtml(label(t))}</b> cause <b>${escapeHtml(label(y))}</b>? Click an arrow to reverse or remove it.</p>
    <button type="button" class="primary" data-action="predict">Ask my model →</button>`;
}

function freezePanel() {
  const { treatment: t, outcome: y } = game.level.question;
  const others = Object.keys(game.level.world.blocks).filter((id) => id !== t && id !== y);
  return `
    <h3>Freeze a block</h3>
    <p>You can't send every child to breakfast club, so you can't poke this town. Instead, hold a block steady:
      compare children who are the same on it. Which block do you freeze?</p>
    <p class="meta">You can draw arrows to help you think. Only the frozen blocks count.</p>
    <div class="freeze-list">
      ${others.map((id) => `<label class="freeze-chip"><input type="checkbox" data-freeze="${id}" ${game.freeze.has(id) ? "checked" : ""}> ❄ ${escapeHtml(label(id))}</label>`).join("")}
    </div>
    <button type="button" class="primary" data-action="predict">Ask my model →</button>`;
}

// ---- Predict -------------------------------------------------------------

function askModel() {
  const lv = game.level;
  game.model = board.graph().edges.map((e) => [...e]);
  game.prediction = lv.freezeOnly
    ? predict(lv, { freeze: [...game.freeze], data: game.data })
    : predict(lv, { graph: board.graph(), data: game.data });
  setStage("predict");
}

function predictPanel() {
  const lv = game.level;
  const { treatment: t, outcome: y } = lv.question;
  const p = game.prediction;
  const action = lv.poke?.label ?? `Change ${label(t)} for everyone`;
  let how;
  if (p.noPath) how = `Your model has no path of arrows from <b>${escapeHtml(label(t))}</b> to <b>${escapeHtml(label(y))}</b>, so it says poking one won't move the other.`;
  else if (p.adjust.length) how = `Your model compares like with like by holding ${list(p.adjust)} steady.`;
  else how = "Your model says there's nothing to hold steady: the groups can be compared as they are.";
  return `
    <h3>Your model's prediction</h3>
    <p>${how}</p>
    <p class="prediction">${escapeHtml(action)}, and <b>${escapeHtml(label(y))}</b> would change by <b>${change(p.effect)}</b>.</p>
    <button type="button" class="primary" data-action="poke">${lv.freezeOnly ? "Reveal the truth →" : "Poke the town →"}</button>`;
}

// ---- Poke ----------------------------------------------------------------

function pokeTown() {
  game.poke = pokeResult(game.level);
  // Graph surgery: forcing a block cuts every arrow into it.
  const t = game.level.question.treatment;
  board.load(game.level.layout, game.model.filter(([, c]) => c !== t));
  setStage("poke");
}

function pokePanel() {
  const lv = game.level;
  const { treatment: t, outcome: y } = lv.question;
  const r = game.poke;
  const yesno = block(t).kind === "yesno";
  const cut = game.model.filter(([, c]) => c === t);
  const intro = lv.freezeOnly
    ? `In real life you couldn't do this. In the game, we can: a magic poke sends every child to breakfast club, then no child.`
    : `${escapeHtml(lv.poke.label)}.${cut.length ? ` Forcing <b>${escapeHtml(label(t))}</b> snaps off every arrow into it: nothing else decides it now.` : ""}`;
  const rows = yesno
    ? [[`${label(t)} for everyone`, r.hi], [`${label(t)} for no one`, r.lo]]
    : [[`Everyone gets +1 ${label(t)}`, r.hi], ["The town as it was", r.lo]];
  return `
    <h3>What the town did</h3>
    <p>${intro}</p>
    <div class="bars">
      ${rows.map(([name, v]) => `<div class="bar-row">
        <span class="bar-name">${escapeHtml(name)}</span>
        <span class="bar-value big">${value(v, y)}</span>
      </div>`).join("")}
    </div>
    <p class="prediction">${escapeHtml(label(y))}: <b>${value(r.hi, y)}</b> against <b>${value(r.lo, y)}</b>, a real change of <b>${change(r.effect)}</b>.</p>
    <button type="button" class="primary" data-action="verdict">Was my model right? →</button>`;
}

// ---- Verdict -------------------------------------------------------------

function judge() {
  game.result = verdict(game.level, game.prediction.effect, game.poke.effect);
  if (game.result.stands) {
    complete(game.level.id);
    board.load(game.level.layout, trueGraph(game.level.world).edges);
  }
  setStage("verdict");
  if (!game.result.stands) {
    board.load(game.level.layout, game.model);
    drawBoard();
    $("stage-board").classList.add("falling");
  }
}

function verdictPanel() {
  const lv = game.level;
  const r = game.result;
  if (r.stands) {
    const last = game.index + 1 >= LEVELS.length;
    return `
      <h3 class="win">Your model was right!</h3>
      <p>It predicted <b>${change(game.prediction.effect)}</b>, and the town did <b>${change(game.poke.effect)}</b>.
        Close enough: within ${change(lv.tolerance).replace(/^\+/, "")} counts as right, because a real town is a little noisy.</p>
      <p>${escapeHtml(lv.reveal)}</p>
      <p class="meta">The board now shows how this town really works.</p>
      <div class="step-actions">
        <button type="button" class="primary" data-action="next">${last ? "Back to the map" : "Next level →"}</button>
        ${last ? "" : `<button type="button" class="link-button" data-action="map">All levels</button>`}
      </div>`;
  }
  return `
    <h3 class="lose">The tower falls</h3>
    <p>Your model predicted <b>${change(game.prediction.effect)}</b>, but the town did <b>${change(game.poke.effect)}</b>.</p>
    <p class="hint-box"><b>Hint:</b> ${escapeHtml(lv.hint)}</p>
    <button type="button" class="primary" data-action="rebuild">Rebuild your model</button>`;
}

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------

const fromHash = LEVELS.findIndex((lv) => `#${lv.id}` === location.hash);
if (fromHash >= 0) startLevel(fromHash);
else showMap();
