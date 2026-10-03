// Validates every v7 level file listed in site/play/v7/levels/index.json and prints
// {id: [errors]} as JSON for tests/test_v2_levels.py.
import { readFileSync } from "node:fs";
import { validateLevel } from "../../site/play/v7/js/validate.js";

const dir = new URL("../../site/play/v7/levels/", import.meta.url);
const order = JSON.parse(readFileSync(new URL("index.json", dir)));
const out = {};
for (const id of order) {
  const level = JSON.parse(readFileSync(new URL(`${id}.json`, dir)));
  out[id] = level.id === id ? validateLevel(level) : [`file ${id}.json has id "${level.id}"`];
}
console.log(JSON.stringify(out));
