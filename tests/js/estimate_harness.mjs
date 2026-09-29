// Reads estimation cases as JSON on stdin, answers with site/js/estimate.js.
// Driven by tests/test_estimate_parity.py.
import { readFileSync } from "node:fs";
import { estimateEffect, refute } from "../../site/js/estimate.js";

const cases = JSON.parse(readFileSync(0, "utf8"));
const out = cases.map(({ data, spec, withRefutations }) => {
  const s = { ...spec, categorical: new Set(spec.categorical) };
  const est = estimateEffect(data, s);
  return withRefutations ? { ...est, refutations: refute(data, s, est) } : est;
});
process.stdout.write(JSON.stringify(out));
