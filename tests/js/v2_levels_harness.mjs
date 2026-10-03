// Validates every v2 level file listed in site/v2/levels/index.json and prints
// {id: [errors]} as JSON for tests/test_v2_levels.py.
import { readFileSync } from "node:fs";
import { validateLevel } from "../../site/v2/js/validate.js";

const dir = new URL("../../site/v2/levels/", import.meta.url);
const order = JSON.parse(readFileSync(new URL("index.json", dir)));
const out = {};
for (const id of order) {
  const level = JSON.parse(readFileSync(new URL(`${id}.json`, dir)));
  out[id] = level.id === id ? validateLevel(level) : [`file ${id}.json has id "${level.id}"`];
}
console.log(JSON.stringify(out));
