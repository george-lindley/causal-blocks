// A worksheet's results, worked out in advance so its data never has to be published.
//
//   precompute(set, table)  ->  { rows, frozen: { "<frozen columns>": { effect, ci, n, chart } } }
//                               at build time (scripts/precompute_worksheets.mjs), from a private CSV
//   lookup(results, frozen) ->  { effect, ci, n, chart } in the browser
//
// A map's answer depends only on which columns it freezes (DoWhy's backdoor rule picks them from the
// arrows), so working out every possible set of frozen columns answers every map anyone can draw,
// including the tutor's what-ifs.

import { Kind, encode } from "./data.js";
import { estimateEffect } from "./estimate.js";
import { chartData } from "./datachart.js";

export const frozenKey = (cols) => [...cols].sort().join("|");

/** Every subset of `cols`, including none and all. */
function subsets(cols) {
  return cols.reduce((all, c) => [...all, ...all.map((s) => [...s, c])], [[]]);
}

/** The estimate with exactly these columns frozen: the same steps the page used to run live. */
export function estimateFrozen(set, { head, rows }, adjust) {
  const ids = [set.cause, set.effect, ...adjust];
  const data = Object.fromEntries(ids.map((c) => [c, []]));
  for (const row of rows) {
    const vals = ids.map((c) => encode(set.columns[c], row[head.indexOf(c)]));
    if (vals.some((x) => x === null)) continue;
    vals.forEach((x, i) => data[ids[i]].push(x));
  }
  const categorical = new Set(adjust.filter((c) => [Kind.ORDERED, Kind.CATEGORIES].includes(set.columns[c].kind)));
  return estimateEffect(data, { treatment: set.cause, outcome: set.effect, adjust, categorical });
}

export function precompute(set, table) {
  const others = Object.keys(set.columns).filter((c) => c !== set.cause && c !== set.effect);
  const frozen = {};
  for (const adjust of subsets(others)) {
    try {
      const r = estimateFrozen(set, table, adjust);
      frozen[frozenKey(adjust)] = { effect: r.effect, ci: r.ci, n: r.n, chart: chartData({ set, table, frozen: adjust }) };
    } catch (err) {
      // e.g. a column calculated from others (rating gap = white - black): there's nothing left to compare
      frozen[frozenKey(adjust)] = { error: err.message };
    }
  }
  return { key: set.key, rows: table.rows.length, frozen };
}

export const lookup = (results, adjust) => results.frozen[frozenKey(adjust)] ?? null;
