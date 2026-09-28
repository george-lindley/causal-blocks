"""The web page's JavaScript must agree with DoWhy and with causalblocks.

site/js/causal.js re-implements two things in the browser: DoWhy's default
backdoor adjustment set, and CausalDAG.roles. The page looks up precomputed
DoWhy estimates by adjustment set, so a disagreement would put a number next to
a graph the student did not draw. These tests run both sides on random DAGs.
"""

import json
import random
import shutil
import subprocess
from pathlib import Path

import networkx as nx
import pytest

from causalblocks import CausalDAG

HARNESS = Path(__file__).parent / "js" / "parity_harness.mjs"

pytestmark = pytest.mark.skipif(shutil.which("node") is None, reason="node is not installed")


def random_cases(n_graphs=600, pairs_per_graph=6, seed=7):
    rng = random.Random(seed)
    cases = []
    for _ in range(n_graphs):
        size = rng.randint(2, 8)
        density = rng.choice([0.2, 0.35, 0.5, 0.7])
        # Shuffled names, so topological order is not alphabetical order and
        # sorted-order tie-breaking gets exercised against real structure.
        names = rng.sample([f"v{i}" for i in range(12)], size)
        edges = [
            [names[i], names[j]]
            for i in range(size)
            for j in range(i + 1, size)
            if rng.random() < density
        ]
        # Mostly treatment-before-outcome pairs, which can have a causal path;
        # the rest cover the "effect is zero by construction" branch.
        forward = [(names[i], names[j]) for i in range(size) for j in range(i + 1, size)]
        backward = [(y, t) for t, y in forward]
        pairs = rng.sample(forward, min(pairs_per_graph - 1, len(forward))) + rng.sample(backward, 1)
        for treatment, outcome in pairs:
            cases.append(
                {"graph": {"nodes": names, "edges": edges}, "treatment": treatment, "outcome": outcome}
            )
    return cases


def run_js(cases):
    proc = subprocess.run(
        ["node", str(HARNESS)], input=json.dumps(cases), capture_output=True, text=True, check=True
    )
    return json.loads(proc.stdout)


def dowhy_identify(case):
    """DoWhy's own answer, plus every set tied with it under DoWhy's tie-breaking rule."""
    from dowhy.causal_identifier import AutoIdentifier, EstimandType
    from dowhy.graph import get_instruments

    g = nx.DiGraph()
    g.add_nodes_from(case["graph"]["nodes"])
    g.add_edges_from(case["graph"]["edges"])
    t, y = case["treatment"], case["outcome"]

    estimand = AutoIdentifier(EstimandType.NONPARAMETRIC_ATE).identify_effect(
        g, [t], [y], list(g.nodes)
    )
    if estimand.no_directed_path:
        return {"no_directed_path": True}

    candidates = {
        k: frozenset(v) for k, v in estimand.backdoor_variables.items() if k != "backdoor" and v is not None
    }
    chosen = estimand.backdoor_variables.get("backdoor")
    if chosen is None:
        return {"no_directed_path": False, "chosen": None, "tied": set()}

    ivs = set(get_instruments(g, [t], [y]))
    score = lambda s: (len(s & ivs), len(s))  # noqa: E731 -- DoWhy's ordering
    best = min(score(s) for s in candidates.values())
    return {
        "no_directed_path": False,
        "chosen": frozenset(chosen),
        "tied": {s for s in candidates.values() if score(s) == best},
        "instruments": ivs,
    }


@pytest.fixture(scope="module")
def results():
    cases = random_cases()
    return list(zip(cases, run_js(cases)))


def test_enough_cases_have_a_real_choice(results):
    """Guard against a generator that only makes trivial graphs."""
    nontrivial = [js for _, js in results if js["adjustmentSet"]]
    assert len(nontrivial) > 300


def test_adjustment_set_matches_dowhy(results):
    for case, js in results:
        py = dowhy_identify(case)
        where = f"{case['treatment']} -> {case['outcome']} in {case['graph']}"

        assert js["noDirectedPath"] == py["no_directed_path"], where
        if py["no_directed_path"]:
            continue
        if py["chosen"] is None:
            assert js["adjustmentSet"] is None, where
            continue

        assert set(js["instruments"]) == py["instruments"], where
        # DoWhy's own pick among equally good sets depends on string hashing,
        # so any member of the tied group is an answer DoWhy can give.
        assert py["chosen"] in py["tied"], where
        assert frozenset(js["adjustmentSet"]) in py["tied"], where
        if len(py["tied"]) == 1:
            assert frozenset(js["adjustmentSet"]) == py["chosen"], where


def test_roles_match_causalblocks(results):
    for case, js in results:
        dag = CausalDAG()
        for node in case["graph"]["nodes"]:
            dag.add(node)
        for parent, child in case["graph"]["edges"]:
            dag.add(parent, to=[child])

        expected = {n: sorted(r) for n, r in dag.roles(case["treatment"], case["outcome"]).items()}
        assert js["roles"] == expected, f"{case['treatment']} -> {case['outcome']} in {case['graph']}"
