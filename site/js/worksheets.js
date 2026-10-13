// Worksheets: real datasets, each with a handful of fixed maps (the right
// one first, then the classic mistakes). Nothing is edited: pick a map and
// see what it freezes, what answer it gets, and why. The tutor can draw other
// maps ("what if…"), and they're estimated here the same way.

import { createBoard } from "./board.js";
import { dowhyBackdoor, primaryRole, roles, Role } from "./causal.js";
import { CHARACTER } from "./names.js";
import { fmt } from "./ui.js";
import { createTutor } from "./tutor.js";
import { DATASETS } from "./datasets/index.js";
import { drawChart } from "./datachart.js";
import { lookup } from "./results.js";

const $ = (id) => document.getElementById(id);
const state = { set: null, answers: null, results: [], version: 0, whatIf: null, revealed: 0, guess: null };
const cache = new Map(); // dataset key -> {answers, results}
const MAX_BLOCKS = 8;

const board = createBoard($("canvas"), {
  label: (id) => id,
  roleText: CHARACTER,
  faces: true,
  onChange: () => {},
  toast: () => {},
});

const escapeHtml = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const plain = (html) => html.replace(/<[^>]+>/g, "");

// ---- Data ------------------------------------------------------------------

/**
 * One map's estimate on the dataset: what the backdoor rule freezes, the
 * effect and its 95% range, and each block's roles. Throws with a plain
 * message if the map can't be estimated.
 */
function estimateMap(set, results, edges) {
  const nodes = [...new Set([set.cause, set.effect, ...edges.flat()])];
  for (const c of nodes) if (!set.columns[c]) throw new Error(`There's no column called “${c}”.`);
  const g = { nodes, edges };
  let id;
  try {
    id = dowhyBackdoor(g, set.cause, set.effect);
  } catch {
    throw new Error("The arrows go round in a loop, so it isn't a valid map.");
  }
  if (id.noDirectedPath) throw new Error(`There's no path of arrows from ${set.cause} to ${set.effect}, so this map says it has no effect at all.`);
  if (!id.adjustmentSet) throw new Error("No set of blocks can be frozen to make this a fair comparison.");
  const adjust = id.adjustmentSet;
  const r = lookup(results, adjust);                 // worked out in advance for every set of frozen columns
  if (!r) throw new Error("That combination of frozen blocks hasn't been worked out for this worksheet.");
  if (r.error) throw new Error("Those frozen blocks repeat each other (one is calculated from the others), so there's nothing left to compare.");
  return { effect: r.effect, ci: r.ci, n: r.n, chart: r.chart, adjust, roles: roles(g, set.cause, set.effect) };
}

async function open(key) {
  const set = DATASETS.find((d) => d.key === key) ?? DATASETS[0];
  if (!cache.has(set.key)) {
    const res = await fetch(`data/worksheets/${set.key}.json`);
    const answers = await res.json();                // worked out in advance (results.js), not the data itself
    cache.set(set.key, { answers, results: set.versions.map((v) => estimateMap(set, answers, v.edges)) });
  }
  const changed = state.set !== set;
  state.set = set;
  ({ answers: state.answers, results: state.results } = cache.get(set.key));
  state.whatIf = null;
  state.revealed = 0;
  state.guess = null;
  const url = new URL(location.href);
  url.searchParams.set("data", set.key);
  history.replaceState(null, "", url);
  renderCase();
  renderLegend();
  if (changed) tutor.reset();
  show(storyOrder(set)[0]);
}

// ---- The tutor's maps ------------------------------------------------------

/** Positions for a map the tutor drew: cause left, effect right, what comes before the cause on top. */
function layout(set, nodes, roleMap) {
  const pos = { [set.cause]: [60, 207], [set.effect]: [576, 207] };
  const others = nodes.filter((n) => n !== set.cause && n !== set.effect);
  const above = others.filter((n) => (roleMap[n] ?? []).some((r) => [Role.CONFOUNDER, Role.INSTRUMENT].includes(r)));
  const below = others.filter((n) => !above.includes(n));
  const row = (ids, y, yExtra) => ids.forEach((id, i) => {
    const k = Math.min(ids.length, 4);
    const x = k === 1 ? 318 : 24 + (i % 4) * (612 / (k - 1));
    pos[id] = i < 4 ? [x, y] : [218 + (i - 4) * 194, yExtra];
  });
  row(above, 30, 118);
  row(below, 384, 296);
  return pos;
}

function tryMap({ name, edges }) {
  const set = state.set;
  const title = String(name || "The tutor's map").slice(0, 30);
  const valid = Array.isArray(edges) && edges.length && edges.every((e) => Array.isArray(e) && e.length === 2 && e.every((c) => typeof c === "string"));
  if (!valid) return { result: { ok: false, error: "edges must be a list of [from, to] column names." } };
  const fail = (error) => ({
    result: { ok: false, error },
    card: `<b>${escapeHtml(title)}</b><span class="map-card-error">${escapeHtml(error)}</span>`,
  });
  const clean = edges.map(([a, b]) => [a.trim(), b.trim()]);
  if (new Set(clean.flat()).size > MAX_BLOCKS) return fail(`That's more than ${MAX_BLOCKS} blocks; the board can't fit them.`);
  let r;
  try {
    r = estimateMap(set, state.answers, clean);
  } catch (err) {
    return fail(err.message);
  }
  const nodes = [...new Set([set.cause, set.effect, ...clean.flat()])];
  state.whatIf = { name: title, edges: clean, pos: layout(set, nodes, r.roles), r };
  renderWhatIf();
  show("whatIf");
  const best = state.results[0];
  return {
    result: {
      ok: true,
      map: title,
      frozen: r.adjust,
      estimate: Number(r.effect.toFixed(2)),
      range_95: r.ci.map((x) => Number(x.toFixed(2))),
      rows_used: r.n,
      best_map_estimate: Number(best.effect.toFixed(2)),
      shown_to_learner: true,
    },
    card: `<span class="label">🧪 Drawn on the map</span><b>${escapeHtml(title)}</b>
      <span class="map-card-value">${fmt(r.effect)}</span>
      <span class="meta">Frozen: ${r.adjust.length ? r.adjust.map(escapeHtml).join(", ") : "nothing"}. The best map says ${fmt(best.effect)}.</span>
      <a class="see-map" href="#board">See it on the map ↑</a>`,
  };
}

/** The case study, for the tutor: everything on the page, as plain data. */
function tutorContext() {
  const set = state.set;
  const looking = state.version === "whatIf" ? `the tutor's map “${state.whatIf.name}”`
    : `“${set.versions[state.version].name}”`;
  const maps = set.versions.map((v, i) => ({
    name: v.name,
    kind: v.mistake ? "mistake" : "best map",
    arrows: v.edges,
    frozen: state.results[i].adjust,
    estimate: Number(state.results[i].effect.toFixed(2)),
    range_95: state.results[i].ci.map((x) => Number(x.toFixed(2))),
    explanation: plain(stepText(i)),
    lesson: v.lesson,
  }));
  if (state.whatIf) {
    const w = state.whatIf;
    maps.push({ name: w.name, kind: "the tutor's what-if", arrows: w.edges, frozen: w.r.adjust, estimate: Number(w.r.effect.toFixed(2)) });
  }
  return `CASE STUDY: ${set.name}
Question: ${set.question}
About the data: ${plain(set.about)} ${state.answers.rows} rows.
The cause: ${set.cause}. The effect: ${set.effect}.
How to read an estimate: ${set.reads.replace("{est}", "<estimate>")}
Columns: ${JSON.stringify(set.columns)}
Maps on the page: ${JSON.stringify(maps)}
The learner is looking at: ${looking}.`;
}

const tutor = createTutor($("tutor"), { context: tutorContext, tryMap });

function suggestions() {
  const set = state.set;
  if (state.version === "whatIf") return ["Why did the answer change?", "Which map should I trust most?", "What does frozen actually mean?"];
  const v = set.versions[state.version];
  const onMap = new Set(v.edges.flat());
  const offMap = Object.keys(set.columns).find((c) => !onMap.has(c));
  const frozen = state.results[state.version].adjust[0];
  return [
    v.mistake ? "What goes wrong on this map?" : "Why is this the best map?",
    offMap ? `What if we also froze ${offMap}?` : frozen ? `What if we didn't freeze ${frozen}?` : "What would make this map wrong?",
    "What's the difference between a confounder and a mediator?",
  ];
}

// ---- Rendering -------------------------------------------------------------

/** The legend lists only the characters this case's maps use. */
function renderLegend() {
  const used = new Set(state.results.flatMap((r) => Object.values(r.roles).map(primaryRole)));
  const order = [Role.TREATMENT, Role.OUTCOME, Role.CONFOUNDER, Role.MEDIATOR, Role.COLLIDER, Role.INSTRUMENT, Role.PRECISION, Role.UNRELATED];
  const frozen = state.results.some((r) => r.adjust.length);
  $("legend").innerHTML = order.filter((r) => used.has(r)).map((r) => `<span><i style="background: var(--role-${r})"></i>${CHARACTER[r]}</span>`).join("")
    + (frozen ? `<span><i class="frozen-key"></i>❄ Frozen (held fixed)</span>` : "");
}

// How hard a case study is to untangle: a word and dots, so it never rests on colour alone.
const LEVELS = { easy: ["Easy", "●○○"], medium: ["Medium", "●●○"], hard: ["Hard", "●●●"] };
const levelBadge = (level) => {
  if (!LEVELS[level]) return "";
  const [word, dots] = LEVELS[level];
  return `<span class="level level-${level}"><span aria-hidden="true">${dots}</span> ${word}</span>`;
};

// Every map is the best map, a mistake, or "also fine": a different map that gets the same answer,
// which teaches that not everything you could freeze matters.
// The story's first step is a "first look": the plain correlation, before anything is frozen.
const KIND = { first: "👀 First look", best: "✓ Best map", mistake: "✗ Mistake", fine: "✓ Also fine" };
const kindOf = (v, i) => (i === storyOrder(state.set)[0] ? "first" : i === 0 ? "best" : v.mistake ? "mistake" : "fine");
const TIDYTUESDAY = "https://github.com/rfordatascience/tidytuesday/tree/main/data/";
// Story order: every story starts with the basic correlation. The data keeps the best map first.
const storyOrder = (set) => set.order ?? set.versions.map((_, i) => i);
// A step's words, with {est} (this map's answer) and {best} (the best map's) filled in from the live estimates.
const stepText = (i) => state.set.versions[i].explain
  .replaceAll("{est}", fmt(state.results[i].effect)).replaceAll("{best}", fmt(state.results[0].effect));

// The picker: one dropdown per level, easy to hard, left to right.
function renderPicker() {
  $("datasets").innerHTML = Object.keys(LEVELS).map((level) => {
    const sets = DATASETS.filter((d) => d.level === level);
    return `
    <label class="level-pick level-${level}">
      ${levelBadge(level)}
      <select data-level="${level}" aria-label="${LEVELS[level][0]} worksheets">
        <option value="" disabled selected hidden>Choose one of ${sets.length}</option>
        ${sets.map((d) => `<option value="${d.key}">${d.icon ?? ""} ${d.name}</option>`).join("")}
      </select>
    </label>`;
  }).join("");
}

function renderCase() {
  const set = state.set;
  for (const s of document.querySelectorAll("#datasets select")) {
    s.value = s.dataset.level === set.level ? set.key : "";
    s.closest(".level-pick").classList.toggle("current", s.dataset.level === set.level);
  }
  $("case").hidden = false;
  $("case-icon").textContent = set.icon ?? "";
  $("case-question").textContent = set.question;
  $("case-lede").innerHTML = `${(set.intro ?? []).join(" ")} <span class="case-about">${set.about}</span>`;
  const story = set.story ? `<a href="${set.story.url}" target="_blank" rel="noopener">${set.story.label} ↗</a> · ` : "";
  const week = set.tidytuesday
    ? ` via <a href="${TIDYTUESDAY}${set.tidytuesday.slice(0, 4)}/${set.tidytuesday}" target="_blank" rel="noopener">TidyTuesday ${set.tidytuesday} ↗</a>` : "";
  // Credit the original source and its licence. The data itself isn't published here: the results are
  // worked out in advance (results.js), and the link goes to the original source (see LICENCES.md).
  const lic = set.licence;
  const licence = lic.url ? `<a href="${lic.url}" target="_blank" rel="noopener">${lic.name}</a>` : lic.name;
  const get = `<a href="${set.origin}" target="_blank" rel="noopener">Get the data from the original source ↗</a>`;
  $("case-about").innerHTML = `${story}${get}
    <span class="case-source">Data: <a href="${set.origin}" target="_blank" rel="noopener">${set.credit}</a>, ${licence}${week}. Filtered and renamed for this worksheet.</span>`;
  // The story, one map at a time: each step's sentence sits beside the map it describes.
  $("steps").innerHTML = storyOrder(set).map((i) => [set.versions[i], i]).map(([v, i]) => `
    <li class="step ${kindOf(v, i)}" data-step="${i}">
      <button type="button" class="step-map" data-v="${i}">
        <span class="step-tag">${KIND[kindOf(v, i)]}</span>
        <span class="step-name">${v.name}</span>
      </button>
      <p>${stepText(i)}</p>
      <div class="step-extra"></div>
    </li>`).join("");
  renderPredict();
  renderReveal();
  renderWhatIf();
}

// ---- Predict, then reveal one step at a time ---------------------------------

const GUESS = { up: "↑ It goes up", down: "↓ It goes down", zero: "≈ About zero" };
/** The right guess, under the best map: about zero if its 95% range includes zero. */
function rightGuess() {
  const r = state.results[0];
  return r.ci[0] <= 0 && r.ci[1] >= 0 ? "zero" : r.effect > 0 ? "up" : "down";
}

function renderPredict() {
  const set = state.set;
  const prompt = set.reads.replace("{est}", "<b class=\"blank\">?</b>");
  $("predict").innerHTML = state.guess === null
    ? `<p class="predict-q"><b>Before you start, make a guess.</b> ${prompt}</p>
       <div class="predict-options">${Object.entries(GUESS).map(([k, t]) => `<button type="button" data-guess="${k}">${t}</button>`).join("")}</div>
       <button type="button" class="link" data-guess="skip">Skip the guess</button>`
    : state.guess === "skip" ? "" : `<p class="predict-made">Your guess: <b>${GUESS[state.guess]}</b></p>`;
}

/** The story's steps in reading order (map indexes). */
const sequence = () => storyOrder(state.set);

function renderReveal() {
  const seq = sequence();
  document.querySelectorAll("#steps .step").forEach((li, k) => { li.hidden = k >= state.revealed; });
  const done = state.revealed >= seq.length;
  $("story-nav").hidden = state.revealed === 0 || done;
  const order = storyOrder(state.set);
  // The verdict on the guess sits under the best map's step, once it's been read.
  const bestLi = document.querySelector('#steps .step[data-step="0"] .step-extra');
  const seenBest = seq.indexOf(0) < state.revealed;
  if (bestLi) {
    bestLi.querySelector(".verdict")?.remove();
    if (seenBest && state.guess && state.guess !== "skip") {
      const right = state.guess === rightGuess();
      const says = { up: "it goes up", down: "it goes down", zero: "it's about zero" }[rightGuess()];
      const guessed = { up: "up", down: "down", zero: "about zero" }[state.guess];
      bestLi.insertAdjacentHTML("afterbegin", right
        ? `<p class="verdict right">✓ You guessed right: under the best map, ${says}.</p>`
        : `<p class="verdict wrong">You guessed ${guessed}. Under the best map, ${says}.</p>`);
    }
  }
}

function reveal(n) {
  const seq = sequence();
  state.revealed = Math.min(seq.length, Math.max(state.revealed, n));
  renderReveal();
  show(seq[state.revealed - 1]);
}

function renderWhatIf() {
  const w = state.whatIf;
  $("whatif-slot").innerHTML = w ? `
    <div class="step whatif">
      <button type="button" class="step-map" data-v="whatIf">
        <span class="step-tag">🧪 Tutor's map</span>
        <span class="step-name">${escapeHtml(w.name)}</span>
      </button>
    </div>` : "";
}

function show(i) {
  state.version = i;
  const set = state.set;
  for (const b of document.querySelectorAll(".story .step-map")) b.setAttribute("aria-pressed", b.dataset.v === String(i));
  tutor.suggest(suggestions());

  for (const el of document.querySelectorAll(".story .data-chart")) el.remove();

  if (i === "whatIf") {
    const w = state.whatIf;
    board.load(w.pos, w.edges);
    board.draw(w.r.roles, { frozen: new Set(w.r.adjust) });
    renderAnswer(w.r.effect, "whatif");
    $("whatif-slot").querySelector(".step")?.insertAdjacentHTML("beforeend", drawChart(set, w.r.chart));
    $("lesson").className = "card lesson whatif";
    $("lesson").innerHTML = `
      <span class="label">🧪 The tutor's map: ${escapeHtml(w.name)}</span>
      <p class="lesson-reads">${set.reads.replace("{est}", fmt(w.r.effect))}</p>
      <p class="lesson-best">The best map says <b>${fmt(state.results[0].effect)}</b>.</p>
      <p>This map isn't one of the worked examples. Ask the tutor why its answer is different.</p>`;
    return;
  }

  const v = set.versions[i];
  const r = state.results[i];
  board.load(v.pos, v.edges);
  board.draw(r.roles, { frozen: new Set(r.adjust) });

  // Before the guess, the map is shown but the answer isn't.
  if (state.revealed === 0) {
    renderAnswer(null);
    $("lesson").className = "card lesson waiting";
    $("lesson").innerHTML = `<p class="lesson-reads">Make your guess in the story to start.</p>`;
    return;
  }
  const kind = kindOf(v, i);
  renderAnswer(r.effect, kind);
  document.querySelector(`#steps .step[data-step="${i}"] .step-extra`)?.insertAdjacentHTML("beforeend", drawChart(set, r.chart));
  const best = kind !== "best" ? `<p class="lesson-best">The best map says <b>${fmt(state.results[0].effect)}</b>.</p>` : "";
  $("lesson").className = `card lesson ${kind}`;
  $("lesson").innerHTML = `
    <span class="label">${KIND[kind]}: ${v.name}</span>
    <p class="lesson-reads">${set.reads.replace("{est}", fmt(r.effect))}</p>
    ${best}
    <p class="lesson-point"><b>Lesson:</b> ${v.lesson}</p>`;
}

// ---- The answer: a big number and a number line where the dot moves with each map ----------------

function renderAnswer(effect, kind) {
  const all = [...state.results.map((r) => r.effect), ...(state.whatIf ? [state.whatIf.r.effect] : []), 0];
  let lo = Math.min(...all), hi = Math.max(...all);
  const pad = (hi - lo) * 0.08 || 1;
  lo -= pad; hi += pad;
  const X = (x) => 16 + ((x - lo) / (hi - lo)) * 568;
  const seen = sequence().slice(0, state.revealed);
  const ghosts = seen.map((i) => `<circle class="nl-seen ${kindOf(state.set.versions[i], i)}" cx="${X(state.results[i].effect).toFixed(1)}" cy="22" r="5"><title>${escapeHtml(state.set.versions[i].name)}: ${fmt(state.results[i].effect)}</title></circle>`).join("");
  $("answer-value").textContent = effect === null ? "?" : fmt(effect);
  $("answer-value").className = `answer-value ${kind ?? ""}`;
  $("answer-line").innerHTML = `
    <line x1="16" x2="584" y1="22" y2="22" class="nl-axis"/>
    <line x1="${X(0)}" x2="${X(0)}" y1="12" y2="32" class="nl-zero"/>
    <text x="${X(0)}" y="46" text-anchor="middle" class="nl-label">0</text>
    ${ghosts}
    ${effect === null ? "" : `<circle class="nl-now ${kind ?? ""}" cx="${X(effect).toFixed(1)}" cy="22" r="9"/>`}`;
}

function showTab(name) {
  for (const t of document.querySelectorAll(".side-tabs [role=tab]")) t.setAttribute("aria-selected", t.dataset.tab === name);
  $("lesson").hidden = name !== "lesson";
  $("tutor").hidden = name !== "tutor";
  if (name === "tutor") $("tutor-input").focus({ preventScroll: true });
}

// ---- Events ----------------------------------------------------------------

$("datasets").addEventListener("change", (e) => {
  if (e.target.value) open(e.target.value);
});
document.querySelector(".story").addEventListener("click", (e) => {
  const g = e.target.closest("[data-guess]");
  if (g) {
    state.guess = g.dataset.guess;
    renderPredict();
    reveal(1);
    return;
  }
  if (e.target.closest("#next-step")) return reveal(state.revealed + 1);
  if (e.target.closest("#show-all")) return reveal(sequence().length);
  const b = e.target.closest(".step-map");
  if (!b) return;
  show(b.dataset.v === "whatIf" ? "whatIf" : Number(b.dataset.v));
  // On one column the map is below the story: bring it into view.
  if (matchMedia("(max-width: 900px)").matches) $("board").scrollIntoView({ behavior: "smooth", block: "start" });
});
document.querySelector(".side-tabs").addEventListener("click", (e) => {
  const t = e.target.closest("[role=tab]");
  if (t) showTab(t.dataset.tab);
});
renderPicker();
open(new URL(location.href).searchParams.get("data"));
