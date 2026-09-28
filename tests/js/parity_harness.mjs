// Reads graph cases as JSON on stdin, answers with site/js/causal.js.
// Driven by tests/test_web_parity.py.
import { readFileSync } from "node:fs";
import { dowhyBackdoor, roles } from "../../site/js/causal.js";

const cases = JSON.parse(readFileSync(0, "utf8"));
const out = cases.map(({ graph, treatment, outcome }) => {
  const id = dowhyBackdoor(graph, treatment, outcome);
  const direct = dowhyBackdoor(graph, treatment, outcome, { directEffect: true });
  return {
    directAdjustmentSet: direct.adjustmentSet ?? null,
    noDirectedPath: id.noDirectedPath,
    adjustmentSet: id.adjustmentSet ?? null,
    instruments: id.instruments ?? null,
    roles: roles(graph, treatment, outcome),
  };
});
process.stdout.write(JSON.stringify(out));
