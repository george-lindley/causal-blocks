// The game's engine. A level is a small fictional town defined by equations:
// each block is caused by the blocks it lists in `from`. We can watch the town
// as it is, or poke it (force a block for everyone) and see what really
// changes. The player's model makes a prediction from the graph they built;
// the verdict compares it with the poke.
//
// Block kinds:
//   yesno   P(yes) = logistic(base + sum of weight × parent)
//   number  base + sum of weight × parent + sd × noise
// A block with no `from` is a root: a number centred on `base`, or yes with
// probability logistic(base).

import { dowhyBackdoor } from "../causal.js";
import { estimateEffect } from "../estimate.js";

/** Seedable generator (mulberry32), so a level's town is the same every time. */
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function gaussian(rand) {
  const u = 1 - rand();
  const v = rand();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

const logistic = (x) => 1 / (1 + Math.exp(-x));

// People simulated per town: enough that estimates are steady, few enough to be instant.
const SAMPLE = 5000;

/** Blocks in an order where every block comes after the blocks it depends on. */
export function causalOrder(world) {
  const order = [];
  const seen = new Set();
  const visit = (id) => {
    if (seen.has(id)) return;
    seen.add(id);
    for (const parent of Object.keys(world.blocks[id].from ?? {})) visit(parent);
    order.push(id);
  };
  Object.keys(world.blocks).forEach(visit);
  return order;
}

/** The true graph of a world, as {nodes, edges}. */
export function trueGraph(world) {
  const nodes = Object.keys(world.blocks);
  const edges = nodes.flatMap((child) => Object.keys(world.blocks[child].from ?? {}).map((parent) => [parent, child]));
  return { nodes, edges };
}

/**
 * Generate a town of n people. `force` maps block id -> a value to give
 * everyone, or a function (person) -> value. Each person's random draws are
 * the same whatever is forced, so a poked town is the same people with one
 * thing changed.
 */
export function simulate(world, n, { seed = world.seed ?? 1, force = {} } = {}) {
  const order = causalOrder(world);
  const rand = rng(seed);
  const data = Object.fromEntries(order.map((id) => [id, new Array(n)]));
  for (let i = 0; i < n; i++) {
    // Draw every block's noise first, in a fixed order, so forcing one block
    // never shifts the random numbers another block sees.
    const noise = Object.fromEntries(order.map((id) => [id, world.blocks[id].kind === "yesno" ? rand() : gaussian(rand)]));
    const person = {};
    for (const id of order) {
      const b = world.blocks[id];
      let value;
      if (id in force) {
        value = typeof force[id] === "function" ? force[id](person, i) : force[id];
      } else {
        const signal = (b.base ?? 0) + Object.entries(b.from ?? {}).reduce((s, [p, w]) => s + w * person[p], 0);
        value = b.kind === "yesno" ? (noise[id] < logistic(signal) ? 1 : 0) : signal + (b.sd ?? 1) * noise[id];
      }
      person[id] = value;
      data[id][i] = value;
    }
  }
  return data;
}

/** Keep only the people the level lets us see (e.g. only players who made the team). */
export function observe(world, data) {
  if (!world.select) return data;
  const [id, value] = world.select;
  const keep = data[id].map((v, i) => (v === value ? i : -1)).filter((i) => i >= 0);
  return Object.fromEntries(Object.entries(data).map(([k, v]) => [k, keep.map((i) => v[i])]));
}

const mean = (xs) => xs.reduce((s, x) => s + x, 0) / xs.length;

/**
 * What really happens when you poke the treatment, measured on the whole town
 * (a poke reaches everyone). For a yes/no block: the outcome's average with
 * everyone yes (`hi`) and everyone no (`lo`). For a number: everyone one unit
 * higher (`hi`) against the town as it is (`lo`).
 */
export function pokeResult(level, n = level.sampleSize ?? SAMPLE) {
  const { world, question } = level;
  const t = question.treatment;
  const y = question.outcome;
  const yesno = world.blocks[t].kind === "yesno";
  const base = simulate(world, n);
  const hi = simulate(world, n, { force: { [t]: yesno ? 1 : (_, i) => base[t][i] + 1 } });
  const lo = yesno ? simulate(world, n, { force: { [t]: 0 } }) : base;
  return { hi: mean(hi[y]), lo: mean(lo[y]), effect: mean(hi[y]) - mean(lo[y]) };
}

/** The true effect of the treatment on the outcome. */
export function truthEffect(level, n) {
  return pokeResult(level, n).effect;
}

/** Data as the player sees it: the watched town (after any selection). */
export function watched(level, n = level.sampleSize ?? SAMPLE) {
  return observe(level.world, simulate(level.world, n));
}

function estimate(data, level, adjust) {
  const categorical = new Set(adjust.filter((id) => level.world.blocks[id].categorical));
  const { effect } = estimateEffect(data, { treatment: level.question.treatment, outcome: level.question.outcome, adjust, categorical });
  return effect;
}

/**
 * The player's model's prediction. Pass `graph` ({nodes, edges}) to let the
 * graph decide what to hold steady, or `freeze` (block ids) to choose
 * directly, as the detective level asks.
 */
export function predict(level, { graph, freeze, data = watched(level) }) {
  const { treatment, outcome } = level.question;
  if (freeze) return { effect: estimate(data, level, freeze), adjust: [...freeze].sort() };
  const id = dowhyBackdoor(graph, treatment, outcome);
  if (id.noDirectedPath) return { effect: 0, adjust: [], noPath: true };
  if (!id.adjustmentSet) return { effect: null, adjust: null };
  return { effect: estimate(data, level, id.adjustmentSet), adjust: id.adjustmentSet };
}

/**
 * Which way an effect goes, as a player would say it: "more", "fewer" or
 * "same". Anything within the level's tolerance of zero counts as no change.
 */
export function direction(effect, tolerance) {
  if (effect === null) return null;
  if (Math.abs(effect) < tolerance) return "same";
  return effect > 0 ? "more" : "fewer";
}

/** Did the theory predict the right thing: more, fewer or no change? */
export function verdict(level, predicted, truth) {
  const said = direction(predicted, level.tolerance);
  const did = direction(truth, level.tolerance);
  return { stands: said !== null && said === did, said, did };
}
