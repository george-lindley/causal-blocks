// Checks every case-study dataset the way the page uses it, and prints each
// map's estimate as JSON. Driven by tests/test_datasets.py.
import { readFileSync } from "node:fs";
import { dowhyBackdoor } from "../../site/js/causal.js";
import { encode, Kind } from "../../site/js/data.js";
import { estimateEffect } from "../../site/js/estimate.js";
import { DATASETS } from "../../site/js/datasets/index.js";

const out = DATASETS.map((set) => {
  const text = readFileSync(new URL(`../../site/${set.file}`, import.meta.url), "utf8");
  const [head, ...rows] = text.trim().split(/\r?\n/).map((l) => l.split(","));
  const problems = [];
  if (text.includes('"')) problems.push("CSV has quotes; the page's reader doesn't handle them");
  if (rows.some((r) => r.length !== head.length)) problems.push("CSV rows have the wrong number of fields");
  const versions = set.versions.map((v) => {
    const nodes = Object.keys(v.pos);
    for (const c of nodes) {
      if (!set.columns[c]) problems.push(`${v.name}: no column config for ${c}`);
      if (!head.includes(c)) problems.push(`${v.name}: ${c} is not in the CSV`);
    }
    for (const e of v.edges) for (const c of e) if (!nodes.includes(c)) problems.push(`${v.name}: arrow uses ${c}, which has no position`);
    const id = dowhyBackdoor({ nodes, edges: v.edges }, set.cause, set.effect);
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
    return { name: v.name, mistake: !!v.mistake, effect: r.effect, n: r.n, adjust };
  });
  return { key: set.key, rows: rows.length, problems, versions };
});
process.stdout.write(JSON.stringify(out));
