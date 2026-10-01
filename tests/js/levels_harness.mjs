// For every level: the truth, the right answer's prediction, and each trap's.
// Driven by tests/test_levels.py.
import { LEVELS } from "../../site/js/game/levels.js";
import { predict, trueGraph, truthEffect, watched } from "../../site/js/game/world.js";

const out = LEVELS.map((level) => {
  const truth = truthEffect(level);
  const data = watched(level);
  const nodes = Object.keys(level.world.blocks);
  const right = level.freezeAnswer
    ? predict(level, { freeze: level.freezeAnswer, data })
    : predict(level, { graph: trueGraph(level.world), data });
  const traps = level.freezeAnswer
    ? level.freezeTraps.map((t) => ({ name: t.name, ...predict(level, { freeze: t.freeze, data }) }))
    : level.traps.map((t) => ({ name: t.name, ...predict(level, { graph: { nodes, edges: t.edges }, data }) }));
  const alsoRight = level.freezeAnswer
    ? level.freezeAlsoRight.map((t) => ({ name: t.name, ...predict(level, { freeze: t.freeze, data }) }))
    : level.alsoRight.map((t) => ({ name: t.name, ...predict(level, { graph: { nodes, edges: t.edges }, data }) }));
  return { id: level.id, tolerance: level.tolerance, truth, seen: data[level.question.outcome].length, right, alsoRight, traps };
});
process.stdout.write(JSON.stringify(out));
