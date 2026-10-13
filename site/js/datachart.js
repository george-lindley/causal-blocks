// What the data looks like under one map: the cause against the effect, split into the groups the map
// freezes. Two halves, so the data itself never has to reach the browser:
//
//   chartData({ set, table, frozen })  ->  aggregates only (averages along the cause, per group)
//                                          run at build time by scripts/precompute_worksheets.mjs
//   drawChart(set, data)               ->  HTML (an SVG chart, its legend and a one-line note)
//
// A number cause is shown as the average effect in slices along the cause; a yes/no cause as a slope
// chart between its two values. Frozen columns become coloured groups (numbers are split into low /
// mid / high). With more groups than colours, each row is compared with its own group's average
// instead, which is what freezing does.

import { Kind, encode } from "./data.js";

// Validated categorical palette (dataviz check: CVD and normal-vision separation pass; labels carry identity).
const COLORS = ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4", "#4a3aa7"];
const ONE = "#5b6673";
const W = 520, H = 230, M = { l: 50, r: 16, t: 14, b: 40 };

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const mean = (a) => a.reduce((s, x) => s + x, 0) / a.length;
const round = (x) => +x.toPrecision(5);

function ticks(lo, hi, n = 4) {
  const span = hi - lo || 1;
  const step0 = span / n;
  const mag = 10 ** Math.floor(Math.log10(step0));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => span / s <= n) ?? 10 * mag;
  const out = [];
  for (let t = Math.ceil(lo / step) * step; t <= hi + 1e-9; t += step) out.push(+t.toPrecision(10));
  return out;
}
const label = (t) => (Math.abs(t) >= 1000 ? t.toLocaleString("en-GB") : String(+t.toFixed(3)));

/** Group label for each row: frozen categories as they are, frozen numbers in thirds. */
function grouper(set, head, rows, frozen) {
  const parts = frozen.map((c) => {
    const i = head.indexOf(c), kind = set.columns[c].kind;
    if (kind !== Kind.NUMERIC) return (row) => `${c}: ${row[i]}`;
    const vals = rows.map((r) => Number(r[i])).filter(Number.isFinite).sort((a, b) => a - b);
    const q1 = vals[Math.floor(vals.length / 3)], q2 = vals[Math.floor((2 * vals.length) / 3)];
    return (row) => { const v = Number(row[i]); return `${c}: ${v <= q1 ? "low" : v <= q2 ? "mid" : "high"}`; };
  });
  return (row) => parts.map((f) => f(row)).join(" · ") || "All";
}

/** Averages of y in k equal-count slices along x. */
function slices(pts, k) {
  const sorted = [...pts].sort((a, b) => a.x - b.x), out = [];
  for (let b = 0; b < k; b++) {
    const chunk = sorted.slice(Math.floor((b * sorted.length) / k), Math.floor(((b + 1) * sorted.length) / k));
    if (chunk.length) out.push({ x: round(mean(chunk.map((p) => p.x))), y: round(mean(chunk.map((p) => p.y))) });
  }
  return out;
}

/** The chart for one set of frozen columns, as aggregates: no individual rows survive. */
export function chartData({ set, table, frozen }) {
  const { head, rows } = table;
  const cx = head.indexOf(set.cause), cy = head.indexOf(set.effect);
  const xCol = set.columns[set.cause], yCol = set.columns[set.effect];
  const xBin = xCol.kind === Kind.BINARY, yBin = yCol.kind === Kind.BINARY;
  const groupOf = grouper(set, head, rows, frozen);
  let pts = [];
  for (const row of rows) {
    const x = encode(xCol, row[cx]), y = encode(yCol, row[cy]);
    if (x === null || y === null) continue;
    pts.push({ x, y, g: groupOf(row) });
  }
  const band = (g) => g.replace(/: low\b/g, ": 0").replace(/: mid\b/g, ": 1").replace(/: high\b/g, ": 2");
  const names = [...new Set(pts.map((p) => p.g))].sort((a, b) => band(a).localeCompare(band(b)));
  const within = names.length > COLORS.length;          // too many groups to colour: compare within groups
  if (within) {
    const by = Object.fromEntries(names.map((n) => [n, pts.filter((p) => p.g === n)]));
    const mx = Object.fromEntries(names.map((n) => [n, mean(by[n].map((p) => p.x))]));
    const my = Object.fromEntries(names.map((n) => [n, mean(by[n].map((p) => p.y))]));
    const gx = mean(pts.map((p) => p.x)), gy = mean(pts.map((p) => p.y));
    pts = pts.map((p) => ({ x: xBin ? p.x : p.x - mx[p.g] + gx, y: p.y - my[p.g] + gy, g: "All" }));
  }
  const groups = (within ? ["All"] : names).map((g) => {
    const gp = pts.filter((p) => p.g === g);
    const points = xBin
      ? [0, 1].map((v) => gp.filter((p) => p.x === v)).filter((s) => s.length).map((s) => ({ x: s[0].x, y: round(mean(s.map((p) => p.y))) }))
      : slices(gp, groups1(names, within) ? 9 : 6);
    return { name: g, n: gp.length, points };
  });
  const n = pts.length.toLocaleString("en-GB");
  const note = frozen.length === 0
    ? `Nothing frozen: all ${n} rows together.`
    : within
      ? `Frozen: ${frozen.join(", ")}. With ${names.length} groups, each row is compared with its own group's average.`
      : `Frozen: ${frozen.join(", ")}. One colour per group.`;
  const xLabels = xBin ? [rows.find((r) => r[cx] !== xCol.positive)?.[cx] ?? "No", xCol.positive] : null;
  return { xBin, yBin, within, xLabels, groups, note };
}
const groups1 = (names, within) => within || names.length === 1;

/** Draw a chart from chartData's aggregates. */
export function drawChart(set, d) {
  const { xBin, yBin, within, groups } = d;
  const color = (k) => (groups.length === 1 ? ONE : COLORS[k]);
  const allX = xBin ? [0, 1] : groups.flatMap((g) => g.points.map((p) => p.x));
  const allY = groups.flatMap((g) => g.points.map((p) => p.y));
  let [x0, x1] = [Math.min(...allX), Math.max(...allX)];
  let [y0, y1] = [Math.min(...allY), Math.max(...allY)];
  if (yBin && !within) { y0 = Math.min(0, y0); y1 = Math.max(y1, 0.1); }
  const padX = xBin ? 0.35 : (x1 - x0) * 0.04 || 1, padY = (y1 - y0) * 0.12 || 0.5;
  x0 -= padX; x1 += padX; y0 -= padY; y1 += padY;
  const sx = (x) => M.l + ((x - x0) / (x1 - x0)) * (W - M.l - M.r);
  const sy = (y) => H - M.b - ((y - y0) / (y1 - y0)) * (H - M.t - M.b);

  const svg = [];
  for (const t of ticks(y0, y1)) {
    svg.push(`<line x1="${M.l}" x2="${W - M.r}" y1="${sy(t)}" y2="${sy(t)}" class="dc-grid"/>`,
      `<text x="${M.l - 6}" y="${sy(t) + 4}" class="dc-tick" text-anchor="end">${label(t)}</text>`);
  }
  for (const t of xBin ? [0, 1] : ticks(x0, x1, 5)) {
    const text = xBin ? d.xLabels[t] : label(t);
    svg.push(`<text x="${sx(t)}" y="${H - M.b + 16}" class="dc-tick" text-anchor="middle">${esc(text)}</text>`);
  }
  svg.push(`<text x="${(M.l + W - M.r) / 2}" y="${H - 4}" class="dc-axis" text-anchor="middle">${esc(set.cause)}</text>`,
    `<text x="12" y="${(M.t + H - M.b) / 2}" class="dc-axis" text-anchor="middle" transform="rotate(-90 12 ${(M.t + H - M.b) / 2})">${esc(`${set.effect} (${yBin ? "share" : "average"})`)}</text>`);
  groups.forEach((g, k) => {
    const pts = g.points.map((p) => `${sx(p.x).toFixed(1)},${sy(p.y).toFixed(1)}`).join(" ");
    if (g.points.length > 1) svg.push(`<polyline points="${pts}" fill="none" stroke="#fff" stroke-width="5" stroke-linecap="round"/>`,
      `<polyline points="${pts}" fill="none" stroke="${color(k)}" stroke-width="2.5" stroke-linecap="round"/>`);
    for (const p of g.points) svg.push(`<circle cx="${sx(p.x).toFixed(1)}" cy="${sy(p.y).toFixed(1)}" r="4.5" fill="${color(k)}" stroke="#fff" stroke-width="2"><title>${esc(g.name)}: ${label(p.y)}</title></circle>`);
  });
  const legend = groups.length > 1
    ? `<div class="dc-legend">${groups.map((g, k) => `<span><i style="background:${color(k)}"></i>${esc(g.name)} <small>(${g.n})</small></span>`).join("")}</div>` : "";
  return `<figure class="data-chart">
    <svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(`${set.cause} against ${set.effect}`)}">${svg.join("")}</svg>
    ${legend}<figcaption>${esc(d.note)} Each dot is an average of many rows.</figcaption></figure>`;
}
