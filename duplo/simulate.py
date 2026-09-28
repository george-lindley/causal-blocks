"""Generate data from a DAG, with a known answer.

This is a linear-Gaussian structural causal model: every variable is a weighted
sum of its parents plus independent noise. That is a strong assumption and a
deliberate one -- because the model is linear, the true causal effect is
computable in closed form (see :func:`true_total_effect`), so you can check
whether an estimator recovers the number you planted. An estimator you cannot
check on data with a known answer is an estimator you are trusting on faith.
"""

from __future__ import annotations

import networkx as nx
import numpy as np
import pandas as pd

from .dag import CausalDAG


def simulate(
    dag: CausalDAG,
    n: int = 1000,
    noise_sd: float = 1.0,
    seed: int | None = None,
) -> pd.DataFrame:
    """Draw ``n`` samples from the DAG's linear-Gaussian SCM.

    Parents are always generated before their children -- the graph is walked
    in topological order rather than in the order nodes happened to be added,
    so how you authored the DAG cannot change the data it produces.
    """
    rng = np.random.default_rng(seed)
    g = dag.to_networkx()  # raises CyclicGraphError if this is not a DAG

    data: dict[str, np.ndarray] = {}
    for node in nx.topological_sort(g):
        values = rng.normal(scale=noise_sd, size=n)
        for parent in g.predecessors(node):
            values = values + g[parent][node]["weight"] * data[parent]
        data[node] = values

    # Preserve authoring order in the output, which is what the user reads.
    return pd.DataFrame({name: data[name] for name in dag.nodes})


def true_total_effect(dag: CausalDAG, treatment: str, outcome: str) -> float:
    """The total causal effect implied by the edge weights.

    Uses Wright's path-tracing rule: in a linear SCM the total effect is the sum,
    over every directed path from treatment to outcome, of the product of that
    path's edge weights. This is the ground truth an estimate should recover --
    it is what makes a simulation a test rather than a demonstration.
    """
    g = dag.to_networkx()
    for node in (treatment, outcome):
        if node not in g:
            raise KeyError(f"{node!r} is not in this graph")

    return float(
        sum(
            np.prod([g[a][b]["weight"] for a, b in zip(path, path[1:])])
            for path in nx.all_simple_paths(g, treatment, outcome)
        )
    )


def true_direct_effect(dag: CausalDAG, treatment: str, outcome: str) -> float:
    """The effect carried by the treatment -> outcome edge alone.

    The difference between this and :func:`true_total_effect` is exactly what
    flows through mediators.
    """
    g = dag.to_networkx()
    return float(g[treatment][outcome]["weight"]) if g.has_edge(treatment, outcome) else 0.0
