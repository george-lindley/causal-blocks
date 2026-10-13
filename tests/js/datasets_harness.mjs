// Checks every worksheet the way the page uses it: each map's frozen blocks (DoWhy's backdoor rule)
// are looked up in the precomputed results (site/data/worksheets/<key>.json, made by
// scripts/precompute_worksheets.mjs), and each map's estimate is printed as JSON.
// Driven by tests/test_datasets.py. No CSVs: the data isn't published.
import { existsSync, readFileSync } from "node:fs";
import { dowhyBackdoor } from "../../site/js/causal.js";
import { DATASETS } from "../../site/js/datasets/index.js";
import { frozenKey, lookup } from "../../site/js/results.js";

const subsets = (cols) => cols.reduce((all, c) => [...all, ...all.map((x) => [...x, c])], [[]]);

const out = DATASETS.map((set) => {
  const problems = [];
  const file = new URL(`../../site/data/worksheets/${set.key}.json`, import.meta.url);
  if (!existsSync(file)) return { key: set.key, rows: 0, problems: ["no precomputed results: run scripts/precompute_worksheets.mjs"], versions: [] };
  const answers = JSON.parse(readFileSync(file, "utf8"));
  // Every set of frozen columns must be worked out, so any map (including the tutor's) has an answer.
  const others = Object.keys(set.columns).filter((c) => c !== set.cause && c !== set.effect);
  for (const s of subsets(others)) if (!answers.frozen[frozenKey(s)]) problems.push(`not precomputed: freeze [${s.join(", ")}]`);
  if (existsSync(new URL(`../../site/data/samples/${set.key}.csv`, import.meta.url))) problems.push("a CSV is published: the data must not be on the site");
  // Every dataset credits its original source and states its licence (see LICENCES.md).
  if (!set.credit || !set.origin) problems.push("no credit or origin: every worksheet credits its original source");
  if (!set.licence?.name || !["green", "amber", "red"].includes(set.licence?.group)) problems.push("licence needs a name and a group (green, amber or red)");
  if (set.licence?.group !== "red" && !set.licence?.url) problems.push("a green or amber licence needs a url");
  const order = set.order ?? set.versions.map((_, i) => i);
  if ([...order].sort().join() !== set.versions.map((_, i) => i).join()) problems.push("order must list every map once");
  const first = set.versions[order[0]];
  if (first.edges.length !== 1 || first.edges[0][0] !== set.cause || first.edges[0][1] !== set.effect)
    problems.push("the story must start with the basic correlation (cause -> effect only)");
  if (order[1] !== 0) problems.push("the best map must come straight after the first look");
  if (set.versions.slice(1).some((v) => !v.lesson)) problems.push("every map needs a lesson");
  if (!["easy", "medium", "hard"].includes(set.level)) problems.push(`level must be easy, medium or hard, not ${set.level}`);
  const versions = set.versions.map((v) => {
    const nodes = Object.keys(v.pos);
    for (const c of nodes) {
      if (!set.columns[c]) problems.push(`${v.name}: no column config for ${c}`);
    }
    for (const e of v.edges) for (const c of e) if (!nodes.includes(c)) problems.push(`${v.name}: arrow uses ${c}, which has no position`);
    const id = dowhyBackdoor({ nodes, edges: v.edges }, set.cause, set.effect);
    const adjust = id.adjustmentSet ?? [];
    const r = lookup(answers, adjust) ?? { effect: NaN, n: 0 };
    if (r.error) problems.push(`${v.name}: its frozen blocks can't be estimated (${r.error})`);
    if (!r.error && !r.chart?.groups?.length) problems.push(`${v.name}: no chart`);
    return { name: v.name, mistake: !!v.mistake, effect: r.effect ?? NaN, n: r.n ?? 0, adjust };
  });
  return { key: set.key, rows: answers.rows, problems, versions };
});
process.stdout.write(JSON.stringify(out));
