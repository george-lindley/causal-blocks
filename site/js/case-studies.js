// Case studies: real datasets, each with a handful of fixed maps (the right
// one first, then the classic mistakes). Nothing is edited: pick a map and
// see what it freezes, what answer it gets, and why.

import { createBoard } from "./board.js";
import { dowhyBackdoor, roles, Role } from "./causal.js";
import { encode, Kind } from "./data.js";
import { estimateEffect } from "./estimate.js";
import { CHARACTER } from "./names.js";
import { fmt } from "./ui.js";
import { DATASETS } from "./datasets/index.js";

const $ = (id) => document.getElementById(id);
const state = { set: null, results: [], version: 0 };
const cache = new Map(); // dataset key -> results

const board = createBoard($("canvas"), {
  label: (id) => id,
  roleText: CHARACTER,
  faces: true,
  onChange: () => {},
  toast: () => {},
});

// ---- Data ------------------------------------------------------------------

// The sample CSVs are written by scripts/build_case_study_data.py: a header
// row, then plain comma-separated values with no quoting.
function parseCsv(text) {
  const [head, ...lines] = text.trim().split(/\r?\n/).map((l) => l.split(","));
  return { head, rows: lines };
}

/** Each version's estimate, with the set it freezes and each block's roles. */
function estimateAll(set, { head, rows }) {
  return set.versions.map((v) => {
    const g = { nodes: Object.keys(v.pos), edges: v.edges };
    const id = dowhyBackdoor(g, set.cause, set.effect);
    const adjust = id.adjustmentSet ?? [];
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
  });
}

async function open(key) {
  const set = DATASETS.find((d) => d.key === key) ?? DATASETS[0];
  if (!cache.has(set.key)) {
    const res = await fetch(set.file);
    cache.set(set.key, estimateAll(set, parseCsv(await res.text())));
  }
  state.set = set;
  state.results = cache.get(set.key);
  state.version = 0;
  const url = new URL(location.href);
  url.searchParams.set("data", set.key);
  history.replaceState(null, "", url);
  renderCase();
  show(0);
}

// ---- Rendering -------------------------------------------------------------

function renderLegend() {
  const shown = [Role.TREATMENT, Role.OUTCOME, Role.CONFOUNDER, Role.MEDIATOR];
  $("legend").innerHTML = shown.map((r) => `<span><i style="background: var(--role-${r})"></i>${CHARACTER[r]}</span>`).join("")
    + `<span><i class="frozen-key"></i>❄ Frozen (held fixed)</span>`;
}

function renderPicker() {
  $("datasets").innerHTML = DATASETS.map((d) => `
    <button type="button" class="sample" data-key="${d.key}">
      <span class="sample-tag">${d.tag}</span>
      <strong>${d.name}</strong>
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
  $("versions").innerHTML = set.versions.map((v, i) => `
    <button type="button" class="version${v.mistake ? " mistake" : ""}" data-v="${i}">
      <span class="version-tag">${v.mistake ? "✗ Mistake" : "✓ Best map"}</span>
      <span class="version-name">${v.name}</span>
      <span class="version-value">${fmt(state.results[i].effect)}</span>
    </button>`).join("");
}

function show(i) {
  state.version = i;
  const set = state.set;
  const v = set.versions[i];
  const r = state.results[i];
  for (const b of document.querySelectorAll("#versions .version")) b.setAttribute("aria-pressed", Number(b.dataset.v) === i);

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

// ---- Events ----------------------------------------------------------------

$("datasets").addEventListener("click", (e) => {
  const b = e.target.closest(".sample");
  if (b) open(b.dataset.key);
});
$("versions").addEventListener("click", (e) => {
  const b = e.target.closest(".version");
  if (b) show(Number(b.dataset.v));
});
renderPicker();
renderLegend();
open(new URL(location.href).searchParams.get("data"));
