// Work out every worksheet's results in advance, from private CSVs that are never published.
//
//   node scripts/precompute_worksheets.mjs [data dir] [key ...]
//
// The data dir (default ~/Desktop/programming/dailycode/worksheet-data) holds <key>.csv for each
// dataset in site/js/datasets/index.js. Writes site/data/worksheets/<key>.json: every set of frozen
// columns with its estimate and chart (averages only). See site/js/results.js and LICENCES.md.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { DATASETS } from "../site/js/datasets/index.js";
import { precompute } from "../site/js/results.js";

const [dir = join(homedir(), "Desktop/programming/dailycode/worksheet-data"), ...keys] = process.argv.slice(2);
const out = new URL("../site/data/worksheets/", import.meta.url);
mkdirSync(out, { recursive: true });

for (const set of DATASETS.filter((d) => !keys.length || keys.includes(d.key))) {
  const [head, ...rows] = readFileSync(join(dir, `${set.key}.csv`), "utf8").trim().split(/\r?\n/).map((l) => l.split(","));
  const results = precompute(set, { head, rows });
  writeFileSync(new URL(`${set.key}.json`, out), JSON.stringify(results));
  console.log(`${set.key.padEnd(11)} ${String(rows.length).padStart(5)} rows  ${Object.keys(results.frozen).length} frozen sets`);
}
