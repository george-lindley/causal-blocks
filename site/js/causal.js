// Graph logic for the browser: variable roles, and the adjustment set DoWhy
// would choose. Ported from causalblocks/dag.py (roles) and DoWhy 0.14's
// dowhy/causal_identifier/auto_identifier.py + dowhy/graph.py (identification).
//
// The port has to agree with DoWhy exactly: the page looks up precomputed
// DoWhy estimates by (treatment, outcome, adjustment set), so choosing a
// different set than DoWhy would show a number for a graph the student did not
// draw. tests/test_web_parity.py checks this on random graphs.
//
// A graph is {nodes: string[], edges: [parent, child][]}.

// Undirected simple-path enumeration is exponential in the worst case; a
// runaway graph should fail loudly rather than hang the page.
const MAX_PATHS = 20000;

export const Role = Object.freeze({
  TREATMENT: "treatment",
  OUTCOME: "outcome",
  CONFOUNDER: "confounder",
  MEDIATOR: "mediator",
  COLLIDER: "collider",
  INSTRUMENT: "instrument",
  PRECISION: "precision",
  UNRELATED: "unrelated",
});

// Colliders outrank mediators because adjusting for a collider *creates*
// bias, which is the worse surprise.
export const PRECEDENCE = [
  Role.TREATMENT,
  Role.OUTCOME,
  Role.COLLIDER,
  Role.MEDIATOR,
  Role.CONFOUNDER,
  Role.INSTRUMENT,
  Role.PRECISION,
  Role.UNRELATED,
];

export class CyclicGraphError extends Error {}

// ---------------------------------------------------------------------------
// Structure
// ---------------------------------------------------------------------------

function adjacency(g) {
  const parents = new Map(g.nodes.map((n) => [n, new Set()]));
  const children = new Map(g.nodes.map((n) => [n, new Set()]));
  for (const [p, c] of g.edges) {
    children.get(p).add(c);
    parents.get(c).add(p);
  }
  return { parents, children };
}

function reach(start, next) {
  const seen = new Set();
  const stack = [...start];
  while (stack.length) {
    for (const m of next(stack.pop())) {
      if (!seen.has(m)) {
        seen.add(m);
        stack.push(m);
      }
    }
  }
  return seen;
}

/** Strict descendants of `node` (networkx semantics: excludes the node itself). */
export function descendants(g, node) {
  const { children } = adjacency(g);
  return reach([node], (n) => children.get(n));
}

/** Strict ancestors of `node`. */
export function ancestors(g, node) {
  const { parents } = adjacency(g);
  return reach([node], (n) => parents.get(n));
}

/** One cycle as a list of nodes, or null if `g` is acyclic. */
export function findCycle(g) {
  const { children } = adjacency(g);
  const state = new Map(); // undefined = unvisited, 1 = on stack, 2 = done
  const stack = [];
  function visit(n) {
    state.set(n, 1);
    stack.push(n);
    for (const c of children.get(n)) {
      if (state.get(c) === 1) return stack.slice(stack.indexOf(c));
      if (!state.has(c)) {
        const cycle = visit(c);
        if (cycle) return cycle;
      }
    }
    stack.pop();
    state.set(n, 2);
    return null;
  }
  for (const n of g.nodes) {
    if (!state.has(n)) {
      const cycle = visit(n);
      if (cycle) return cycle;
    }
  }
  return null;
}

export function assertAcyclic(g) {
  const cycle = findCycle(g);
  if (cycle) throw new CyclicGraphError(`graph contains a cycle: ${[...cycle, cycle[0]].join(" -> ")}`);
}

function withoutEdges(g, keep) {
  return { nodes: g.nodes, edges: g.edges.filter(keep) };
}

/**
 * Are X and Y d-separated given Z? Ancestral moral graph method, equivalent to
 * networkx.is_d_separator, which is what DoWhy calls.
 */
export function dSeparated(g, xs, ys, zs) {
  const { parents } = adjacency(g);
  const relevant = reach([...xs, ...ys, ...zs], (n) => parents.get(n));
  for (const n of [...xs, ...ys, ...zs]) relevant.add(n);

  const moral = new Map([...relevant].map((n) => [n, new Set()]));
  const link = (a, b) => {
    moral.get(a).add(b);
    moral.get(b).add(a);
  };
  for (const n of relevant) {
    const ps = [...parents.get(n)];
    for (const p of ps) link(p, n);
    for (let i = 0; i < ps.length; i++) for (let j = i + 1; j < ps.length; j++) link(ps[i], ps[j]);
  }

  const blocked = new Set(zs);
  const targets = new Set(ys);
  const seen = new Set(xs);
  const stack = [...xs];
  while (stack.length) {
    const n = stack.pop();
    if (targets.has(n)) return false;
    for (const m of moral.get(n)) {
      if (!seen.has(m) && !blocked.has(m)) {
        seen.add(m);
        stack.push(m);
      }
    }
  }
  return true;
}

// ---------------------------------------------------------------------------
// Identification -- what DoWhy's identify_effect() does with default settings
// ---------------------------------------------------------------------------

/** Port of dowhy.graph.get_instruments. */
export function instruments(g, treatment, outcome) {
  const { parents } = adjacency(g);
  const cut = withoutEdges(g, ([, c]) => c !== treatment); // remove incoming edges to treatment
  const ancestorsY = ancestors(cut, outcome);
  const candidates = [...parents.get(treatment)].filter((p) => !ancestorsY.has(p));
  const causedByCauses = new Set();
  for (const v of ancestorsY) for (const d of descendants(cut, v)) causedByCauses.add(d);
  return candidates.filter((c) => !causedByCauses.has(c)).sort();
}

function* combinations(items, size, start = 0, prefix = []) {
  if (prefix.length === size) {
    yield prefix;
    return;
  }
  for (let i = start; i < items.length; i++) yield* combinations(items, size, i + 1, [...prefix, items[i]]);
}

/**
 * The backdoor adjustment set DoWhy's identify_effect() picks by default, for a
 * graph where every node is observed.
 *
 * With {directEffect: true} this is the set for the controlled direct effect
 * (DoWhy's estimand_type="nonparametric-cde"): only the treatment -> outcome
 * arrow is cut, and mediators become eligible for adjustment.
 *
 * Returns {noDirectedPath: true} when the graph says the effect is zero, else
 * {adjustmentSet, instruments, candidates}. adjustmentSet is null if no valid
 * backdoor set exists.
 *
 * DoWhy breaks ties between equally small sets by Python set iteration order,
 * which depends on string hashing and so varies between runs. Here ties go to
 * the first set in sorted order. The estimate is still one DoWhy could return.
 */
export function dowhyBackdoor(g, treatment, outcome, { directEffect = false } = {}) {
  assertAcyclic(g);
  if (!descendants(g, treatment).has(outcome)) return { noDirectedPath: true };

  const backdoorGraph = directEffect
    ? withoutEdges(g, ([p, c]) => !(p === treatment && c === outcome))
    : withoutEdges(g, ([p]) => p !== treatment);
  const valid = (set) => dSeparated(backdoorGraph, [treatment], [outcome], set);
  const sets = [];
  if (valid([])) sets.push([]);

  // Total effect: nothing downstream of the treatment. Direct effect: nothing
  // downstream of the outcome.
  const excluded = descendants(g, directEffect ? outcome : treatment);
  const eligible = g.nodes
    .filter((n) => n !== treatment && n !== outcome && !excluded.has(n))
    // A variable d-separated from both treatment and outcome cannot matter.
    .filter((v) => !dSeparated(g, [treatment], [v], []) || !dSeparated(g, [outcome], [v], []))
    .sort();

  // Default search: try the largest eligible set; with everything observed, if
  // it fails no subset can succeed. If it works, search up from size 1 for the
  // smallest valid sets.
  if (eligible.length && valid(eligible)) {
    sets.push(eligible);
    for (let size = 1; size <= eligible.length; size++) {
      let found = false;
      for (const combo of combinations(eligible, size)) {
        if (valid(combo)) {
          sets.push(combo);
          found = true;
        }
      }
      if (found) break;
    }
  }

  const ivs = instruments(g, treatment, outcome);
  if (!sets.length) return { noDirectedPath: false, adjustmentSet: null, instruments: ivs, candidates: [] };

  // Fewest instruments first (they cost treatment variance), then fewest variables.
  const ivCount = (s) => s.filter((v) => ivs.includes(v)).length;
  const minIv = Math.min(...sets.map(ivCount));
  let best = null;
  for (const s of sets) if (ivCount(s) === minIv && (best === null || s.length < best.length)) best = s;

  return { noDirectedPath: false, adjustmentSet: [...best].sort(), instruments: ivs, candidates: sets };
}

// ---------------------------------------------------------------------------
// Roles -- port of CausalDAG.roles
// ---------------------------------------------------------------------------

function collidersOnPaths(g, treatment, outcome) {
  const edgeSet = new Set(g.edges.map(([p, c]) => `${p}\u0000${c}`));
  const has = (p, c) => edgeSet.has(`${p}\u0000${c}`);
  const neighbours = new Map(g.nodes.map((n) => [n, new Set()]));
  for (const [p, c] of g.edges) {
    neighbours.get(p).add(c);
    neighbours.get(c).add(p);
  }

  const colliders = new Set();
  let count = 0;
  const path = [treatment];
  const onPath = new Set(path);
  function walk(n) {
    for (const m of neighbours.get(n)) {
      if (onPath.has(m)) continue;
      path.push(m);
      if (m === outcome) {
        if (++count > MAX_PATHS) {
          throw new Error(`more than ${MAX_PATHS} paths between ${treatment} and ${outcome}; this graph is too dense to classify`);
        }
        for (let i = 1; i < path.length - 1; i++) {
          if (has(path[i - 1], path[i]) && has(path[i + 1], path[i])) colliders.add(path[i]);
        }
      } else {
        onPath.add(m);
        walk(m);
        onPath.delete(m);
      }
      path.pop();
    }
  }
  walk(treatment);
  return colliders;
}

/**
 * Every node's roles relative to treatment and outcome, as {node: role[]}.
 * A node can genuinely play more than one role; that is reported, not flattened.
 */
export function roles(g, treatment, outcome) {
  assertAcyclic(g);
  if (treatment === outcome) throw new Error("treatment and outcome must differ");

  const ancT = ancestors(g, treatment);
  const descT = descendants(g, treatment);
  const ancY = ancestors(g, outcome);
  // Reaching the outcome without routing through the treatment separates a
  // confounder (own path to the outcome) from an instrument.
  const withoutT = {
    nodes: g.nodes.filter((n) => n !== treatment),
    edges: g.edges.filter(([p, c]) => p !== treatment && c !== treatment),
  };
  const aroundT = ancestors(withoutT, outcome);
  const colliders = collidersOnPaths(g, treatment, outcome);

  const result = { [treatment]: [Role.TREATMENT], [outcome]: [Role.OUTCOME] };
  for (const n of g.nodes) {
    if (n === treatment || n === outcome) continue;
    const found = [];
    if (descT.has(n) && ancY.has(n)) found.push(Role.MEDIATOR);
    if (ancT.has(n)) found.push(aroundT.has(n) ? Role.CONFOUNDER : Role.INSTRUMENT);
    if (colliders.has(n)) found.push(Role.COLLIDER);
    if (!found.length && ancY.has(n)) found.push(Role.PRECISION);
    result[n] = found.length ? found.sort() : [Role.UNRELATED];
  }
  return result;
}

/** The single role that matters most for a decision, for colouring. */
export function primaryRole(nodeRoles) {
  return PRECEDENCE.find((r) => nodeRoles.includes(r)) ?? Role.UNRELATED;
}
