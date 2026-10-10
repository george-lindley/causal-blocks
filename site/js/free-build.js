// Free Build: real datasets, each with a handful of fixed maps (the right
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

// The sample CSVs are written by scripts/build_free_build_samples.py: a header
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

const fill = (text, i) => {
  const r = state.results[i].effect;
  const ours = state.results[0].effect;
  return text.replace("{est}", fmt(r)).replace("{ours}", fmt(ours)).replace("{diff}", fmt(r - ours));
};

function renderLegend() {
  const shown = [Role.TREATMENT, Role.OUTCOME, Role.CONFOUNDER, Role.MEDIATOR, Role.COLLIDER];
  $("legend").innerHTML = shown.map((r) => `<span><i style="background: var(--role-${r})"></i>${CHARACTER[r]}</span>`).join("")
    + `<span><i class="frozen-key"></i>❄ Frozen: held fixed, so only like is compared with like</span>`;
}

function renderPicker() {
  $("datasets").innerHTML = DATASETS.map((d) => `
    <button type="button" class="sample" data-key="${d.key}">
      <span class="sample-tag">${d.tag}</span>
      <strong>${d.name}</strong>
      <span>${d.blurb}</span>
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
      <span class="version-tag">${v.mistake ? "✗ Mistake" : "✓ Best map"}</span>${v.name}
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

  const frozen = r.adjust.length ? r.adjust.map((a) => `<b>${a}</b>`).join(", ") : "nothing";
  $("verdict").className = `verdict${v.mistake ? " mistake" : ""}`;
  $("verdict").innerHTML = `
    <div class="verdict-value">${fmt(r.effect)}</div>
    <div>
      <p class="verdict-reads">${fill(set.reads, i)}</p>
      <p class="meta">Frozen: ${frozen}. 95% range ${fmt(r.ci[0])} to ${fmt(r.ci[1])}.</p>
    </div>`;

  $("lesson").className = `card lesson${v.mistake ? " mistake" : ""}`;
  $("lesson").innerHTML = `
    <span class="label">${v.mistake ? "✗ Mistake" : "✓ Best map"}</span>
    <h3>${v.name}</h3>
    <h4>What's happening</h4>
    <p>${v.happened}</p>
    <h4>How the answer changed</h4>
    <p>${fill(v.change, i)}</p>
    <p class="lesson-point"><b>The lesson:</b> ${v.lesson}</p>`;

  $("compare-plot").innerHTML = comparePlot();
}

/** Every map's estimate and 95% range on one axis, the chosen one highlighted. */
function comparePlot() {
  const rs = state.results;
  const vs = state.set.versions;
  const ext = Math.max(...rs.flatMap((r) => r.ci.map(Math.abs))) * 1.1;
  const [x0, x1, top, rowH] = [176, 388, 10, 46];
  const x = (val) => x0 + ((val + ext) / (2 * ext)) * (x1 - x0);
  const h = top + rs.length * rowH + 26;
  const rows = rs.map((r, i) => {
    const y = top + i * rowH + rowH / 2;
    const on = i === state.version;
    const colour = on ? "var(--role-treatment)" : "var(--surface)";
    return `<g class="cmp-row${on ? " on" : ""}" data-v="${i}" role="button" tabindex="0" aria-label="${vs[i].name}: ${fmt(r.effect)}">
      <rect class="cmp-hit" x="0" y="${y - rowH / 2}" width="400" height="${rowH}" rx="10"/>
      <text class="cmp-name" x="12" y="${y - 3}">${vs[i].name}</text>
      <text class="cmp-tag${vs[i].mistake ? " mistake" : ""}" x="12" y="${y + 14}">${vs[i].mistake ? "✗ mistake" : "✓ best map"}</text>
      <line x1="${x(r.ci[0])}" x2="${x(r.ci[1])}" y1="${y}" y2="${y}" stroke="var(--ink)" stroke-width="${on ? 4 : 2}" stroke-linecap="round" opacity="${on ? 1 : 0.5}"/>
      <circle cx="${x(r.effect)}" cy="${y}" r="${on ? 8 : 6}" fill="${colour}" stroke="var(--ink)" stroke-width="2"/>
    </g>`;
  });
  const zero = x(0);
  return `<svg viewBox="0 0 400 ${h}" role="group" aria-label="Every map's estimate compared">
    <line x1="${zero}" x2="${zero}" y1="${top}" y2="${h - 22}" stroke="var(--muted)" stroke-dasharray="3 3"/>
    <line x1="${x(rs[0].effect)}" x2="${x(rs[0].effect)}" y1="${top}" y2="${h - 22}" stroke="var(--good)" stroke-width="1.5" opacity="0.6"/>
    ${rows.join("")}
    <text class="cmp-axis" x="${zero}" y="${h - 6}" text-anchor="middle">0</text>
    <text class="cmp-axis" x="${x0}" y="${h - 6}">${fmt(-ext, 1)}</text>
    <text class="cmp-axis" x="${x1}" y="${h - 6}" text-anchor="end">${fmt(ext, 1)}</text>
  </svg>`;
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
$("compare-plot").addEventListener("click", (e) => {
  const g = e.target.closest(".cmp-row");
  if (g) show(Number(g.dataset.v));
});
$("compare-plot").addEventListener("keydown", (e) => {
  const g = e.target.closest(".cmp-row");
  if (g && (e.key === "Enter" || e.key === " ")) {
    e.preventDefault();
    show(Number(g.dataset.v));
  }
});

renderPicker();
renderLegend();
open(new URL(location.href).searchParams.get("data"));
