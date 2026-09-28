"""causal-duplo: build a causal DAG once, and derive everything else from it.

    from duplo import CausalDAG, simulate, true_total_effect

    dag = (
        CausalDAG()
        .add("confounder", to={"treatment": 1.0, "outcome": 2.0})
        .add("treatment", to={"outcome": 1.5})
    )
    print(dag.explain("treatment", "outcome"))
    df = simulate(dag, n=5_000, seed=0)
"""

from .dag import CausalDAG, CyclicGraphError, Role
from .examples import confounded, m_bias, mediated
from .plot import correlation_heatmap, effect_comparison
from .simulate import simulate, true_direct_effect, true_total_effect
from .style import set_theme

__all__ = [
    "CausalDAG",
    "CyclicGraphError",
    "Role",
    "confounded",
    "correlation_heatmap",
    "effect_comparison",
    "m_bias",
    "mediated",
    "set_theme",
    "simulate",
    "true_direct_effect",
    "true_total_effect",
]
