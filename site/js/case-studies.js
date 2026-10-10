// Case studies: real datasets, each with a handful of fixed maps (the right
// one first, then the classic mistakes). Nothing is edited: pick a map and
// see what it freezes, what answer it gets, and why. The tutor can draw other
// maps ("what if…"), and they're estimated here the same way.

import { createBoard } from "./board.js";
import { dowhyBackdoor, roles, Role } from "./causal.js";
import { encode, Kind } from "./data.js";
import { estimateEffect } from "./estimate.js";
import { CHARACTER } from "./names.js";
import { fmt } from "./ui.js";
import { createTutor } from "./tutor.js";
import { DATASETS } from "./datasets/index.js";

const $ = (id) => document.getElementById(id);
const state = { set: null, table: null, results: [], version: 0, whatIf: null };
const cache = new Map(); // dataset key -> {table, results}
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

// The sample CSVs are written by scripts/build_case_study_data.py: a header
// row, then plain comma-separated values with no quoting.
function parseCsv(text) {
  const [head, ...lines] = text.trim().split(/\r?\n/).map((l) => l.split(","));
  return { head, rows: lines };
}

/**
 * One map's estimate on the dataset: what the backdoor rule freezes, the
 * effect and its 95% range, and each block's roles. Throws with a plain
 * message if the map can't be estimated.
 */
function estimateMap(set, { head, rows }, edges) {
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
  const ids = [set.cause, set.effect, ...adjust];
  const data = Object.fromEntries(ids.map((c) => [c, []]));
  for (const row of rows) {
    const vals = ids.map((c) => encode(set.columns[c], row[head.indexOf(c)]));
    if (vals.some((x) => x === null)) continue;
    vals.forEach((x, i) => data[ids[i]].push(x));
  }
  const categorical = new Set(adjust.filter((c) => [Kind.ORDERED, Kind.CATEGORIES].includes(set.columns[c].kind)));
  const r = estimateEffect(data, { treatment: set.cause, outcome: set.effect, adjust, categorical });
  return { ...r, adjust, roles: roles(g, set.cause, set.effect) };
}

async function open(key) {
  const set = DATASETS.find((d) => d.key === key) ?? DATASETS[0];
  if (!cache.has(set.key)) {
    const res = await fetch(set.file);
    const table = parseCsv(await res.text());
    cache.set(set.key, { table, results: set.versions.map((v) => estimateMap(set, table, v.edges)) });
  }
  const changed = state.set !== set;
  state.set = set;
  ({ table: state.table, results: state.results } = cache.get(set.key));
  state.whatIf = null;
  const url = new URL(location.href);
  url.searchParams.set("data", set.key);
  history.replaceState(null, "", url);
  renderCase();
  if (changed) tutor.reset();
  show(0);
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
    r = estimateMap(set, state.table, clean);
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
      <a class="see-map" href="#versions">See it on the map ↑</a>`,
  };
}

/** The case study, for the tutor: everything on the page, as plain data. */
function tutorContext() {
  const set = state.set;
  const looking = state.version === "whatIf" ? `the tutor's map “${state.whatIf.name}”` : `“${set.versions[state.version].name}”`;
  const maps = set.versions.map((v, i) => ({
    name: v.name,
    kind: v.mistake ? "mistake" : "best map",
    arrows: v.edges,
    frozen: state.results[i].adjust,
    estimate: Number(state.results[i].effect.toFixed(2)),
    range_95: state.results[i].ci.map((x) => Number(x.toFixed(2))),
    explanation: plain(v.explain),
    lesson: v.lesson,
  }));
  if (state.whatIf) {
    const w = state.whatIf;
    maps.push({ name: w.name, kind: "the tutor's what-if", arrows: w.edges, frozen: w.r.adjust, estimate: Number(w.r.effect.toFixed(2)) });
  }
  return `CASE STUDY: ${set.name}
Question: ${set.question}
About the data: ${plain(set.about)} ${state.table.rows.length} rows.
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

function renderLegend() {
  const shown = [Role.TREATMENT, Role.OUTCOME, Role.CONFOUNDER, Role.MEDIATOR];
  $("legend").innerHTML = shown.map((r) => `<span><i style="background: var(--role-${r})"></i>${CHARACTER[r]}</span>`).join("")
    + `<span><i class="frozen-key"></i>❄ Frozen (held fixed)</span>`;
}

// How hard a case study is to untangle: a word and dots, so it never rests on colour alone.
const LEVELS = { easy: ["Easy", "●○○"], medium: ["Medium", "●●○"], hard: ["Hard", "●●●"] };
const levelBadge = (level) => {
  if (!LEVELS[level]) return "";
  const [word, dots] = LEVELS[level];
  return `<span class="level level-${level}"><span aria-hidden="true">${dots}</span> ${word}</span>`;
};

function renderPicker() {
  $("datasets").innerHTML = DATASETS.map((d) => `
    <button type="button" class="sample" data-key="${d.key}">
      <span class="sample-tag">${d.tag}</span>
      <strong>${d.name}</strong>
      ${levelBadge(d.level)}
    </button>`).join("");
}

function renderCase() {
  const set = state.set;
  for (const b of document.querySelectorAll("#datasets .sample")) b.setAttribute("aria-pressed", b.dataset.key === set.key);
  $("case").hidden = false;
  $("case-question").textContent = set.question;
  $("case-about").innerHTML = `${set.about}
    <a href="${set.story.url}" target="_blank" rel="noopener">${set.story.label} ↗</a> ·
    <a href="${set.file}" download>Download the data</a>`;
  // The story in plain words, before the maps translate it into arrows. Optional per dataset.
  $("case-story").hidden = !set.intro;
  $("case-story-body").innerHTML = (set.intro ?? []).map((p) => `<p>${p}</p>`).join("");
  $("versions").innerHTML = set.versions.map((v, i) => `
    <button type="button" class="version${v.mistake ? " mistake" : ""}" data-v="${i}">
      <span class="version-tag">${v.mistake ? "✗ Mistake" : "✓ Best map"}</span>
      <span class="version-name">${v.name}</span>
      <span class="version-value">${fmt(state.results[i].effect)}</span>
    </button>`).join("") + `<span id="whatif-slot"></span>`;
}

function renderWhatIf() {
  const w = state.whatIf;
  $("whatif-slot").innerHTML = w ? `
    <button type="button" class="version whatif" data-v="whatIf">
      <span class="version-tag">🧪 Tutor's map</span>
      <span class="version-name">${escapeHtml(w.name)}</span>
      <span class="version-value">${fmt(w.r.effect)}</span>
    </button>` : "";
}

function show(i) {
  state.version = i;
  const set = state.set;
  for (const b of document.querySelectorAll("#versions .version")) b.setAttribute("aria-pressed", b.dataset.v === String(i));
  tutor.suggest(suggestions());

  if (i === "whatIf") {
    const w = state.whatIf;
    board.load(w.pos, w.edges);
    board.draw(w.r.roles, { frozen: new Set(w.r.adjust) });
    $("lesson").className = "card lesson whatif";
    $("lesson").innerHTML = `
      <span class="label">🧪 The tutor's map: ${escapeHtml(w.name)}</span>
      <div class="lesson-value">${fmt(w.r.effect)}</div>
      <p class="lesson-reads">${set.reads.replace("{est}", fmt(w.r.effect))}</p>
      <p class="lesson-best">The best map says <b>${fmt(state.results[0].effect)}</b>.</p>
      <p>This map isn't one of the worked examples. Ask the tutor why its answer is different.</p>`;
    return;
  }

  const v = set.versions[i];
  const r = state.results[i];
  board.load(v.pos, v.edges);
  board.draw(r.roles, { frozen: new Set(r.adjust) });

  const best = v.mistake ? `<p class="lesson-best">The best map says <b>${fmt(state.results[0].effect)}</b>.</p>` : "";
  $("lesson").className = `card lesson${v.mistake ? " mistake" : ""}`;
  $("lesson").innerHTML = `
    <span class="label">${v.mistake ? "✗ Mistake" : "✓ Best map"}: ${v.name}</span>
    <div class="lesson-value">${fmt(r.effect)}</div>
    <p class="lesson-reads">${set.reads.replace("{est}", fmt(r.effect))}</p>
    ${best}
    <p>${v.explain}</p>
    <p class="lesson-point"><b>Lesson:</b> ${v.lesson}</p>`;
}

function showTab(name) {
  for (const t of document.querySelectorAll(".side-tabs [role=tab]")) t.setAttribute("aria-selected", t.dataset.tab === name);
  $("lesson").hidden = name !== "lesson";
  $("tutor").hidden = name !== "tutor";
  if (name === "tutor") $("tutor-input").focus({ preventScroll: true });
}

// ---- Events ----------------------------------------------------------------

$("datasets").addEventListener("click", (e) => {
  const b = e.target.closest(".sample");
  if (b) open(b.dataset.key);
});
$("versions").addEventListener("click", (e) => {
  const b = e.target.closest(".version");
  if (b) show(b.dataset.v === "whatIf" ? "whatIf" : Number(b.dataset.v));
});
document.querySelector(".side-tabs").addEventListener("click", (e) => {
  const t = e.target.closest("[role=tab]");
  if (t) showTab(t.dataset.tab);
});
renderPicker();
renderLegend();
open(new URL(location.href).searchParams.get("data"));
