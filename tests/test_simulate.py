"""Tests for the simulator, and for whether estimators recover what it planted.

The last class is the one that matters. Everything else in this package is
plumbing; `TestEstimatorsRecoverTheTruth` is the part that would catch the
package being confidently wrong.
"""

import numpy as np
import pytest
import statsmodels.api as sm

from causalblocks import (
    CausalDAG,
    CyclicGraphError,
    confounded,
    m_bias,
    mediated,
    simulate,
    true_direct_effect,
    true_total_effect,
)

N = 40_000
SEED = 20260807
TOL = 0.05  # sampling tolerance at this n; generous enough not to flake


def ols(df, treatment, outcome, controls=()):
    design = sm.add_constant(df[[treatment, *controls]])
    return sm.OLS(df[outcome], design).fit().params[treatment]


class TestSimulate:
    def test_columns_follow_authoring_order(self):
        dag = CausalDAG().add("Z", to=["X"]).add("X", to=["Y"]).add("Y")
        assert list(simulate(dag, n=10, seed=1).columns) == ["Z", "X", "Y"]

    def test_parents_generated_before_children_regardless_of_authoring_order(self):
        """The old implementation walked the node list as written and raised
        KeyError whenever a child was defined before its parent."""
        forwards = CausalDAG().add("X", to={"M": 2.0}).add("M", to={"Y": 3.0}).add("Y")
        backwards = CausalDAG().add("Y").add("M", to={"Y": 3.0}).add("X", to={"M": 2.0})

        a = simulate(forwards, n=5_000, seed=SEED)
        b = simulate(backwards, n=5_000, seed=SEED)
        # Same SCM, so the same seed must give the same data.
        np.testing.assert_allclose(
            a[["X", "M", "Y"]].to_numpy(), b[["X", "M", "Y"]].to_numpy()
        )

    def test_seed_makes_it_reproducible(self):
        a = simulate(confounded(), n=100, seed=42)
        b = simulate(confounded(), n=100, seed=42)
        c = simulate(confounded(), n=100, seed=43)
        np.testing.assert_allclose(a.to_numpy(), b.to_numpy())
        assert not np.allclose(a.to_numpy(), c.to_numpy())

    def test_shape(self):
        df = simulate(confounded(), n=250, seed=1)
        assert df.shape == (250, 3)

    def test_cyclic_graph_refuses_to_simulate(self):
        dag = CausalDAG().add("A", to=["B"]).add("B", to=["A"])
        with pytest.raises(CyclicGraphError):
            simulate(dag, n=10)

    def test_root_nodes_are_standard_normal(self):
        df = simulate(confounded(), n=50_000, seed=SEED)
        assert abs(df["Z"].mean()) < 0.05
        assert abs(df["Z"].std() - 1.0) < 0.05


class TestGroundTruth:
    def test_total_effect_sums_over_paths(self):
        """Wright's rule: 1.0 direct + (0.5 * 2.0) through M = 2.0."""
        assert true_total_effect(mediated(), "X", "Y") == pytest.approx(2.0)

    def test_direct_effect_is_the_single_edge(self):
        assert true_direct_effect(mediated(), "X", "Y") == pytest.approx(1.0)

    def test_no_path_means_no_effect(self):
        assert true_total_effect(m_bias(), "X", "Y") == 0.0
        assert true_direct_effect(m_bias(), "X", "Y") == 0.0

    def test_parallel_paths_add(self):
        dag = (
            CausalDAG()
            .add("X", to={"A": 2.0, "B": 3.0})
            .add("A", to={"Y": 1.0})
            .add("B", to={"Y": 1.0})
            .add("Y")
        )
        assert true_total_effect(dag, "X", "Y") == pytest.approx(5.0)

    def test_unknown_node_raises(self):
        with pytest.raises(KeyError):
            true_total_effect(confounded(), "X", "missing")


class TestEstimatorsRecoverTheTruth:
    """Plant a known effect, then check the estimator finds it.

    Each case also asserts that the *naive* estimate is wrong, because a test
    that only checks the right answer cannot tell you the adjustment did any
    work.
    """

    def test_adjusting_for_a_confounder_recovers_the_effect(self):
        dag = confounded()
        df = simulate(dag, n=N, seed=SEED)
        truth = true_total_effect(dag, "X", "Y")  # 1.5

        assert ols(df, "X", "Y", ["Z"]) == pytest.approx(truth, abs=TOL)
        assert ols(df, "X", "Y") > truth + 0.5, "naive estimate should be biased upward"

    def test_adjusting_for_a_mediator_changes_the_estimand(self):
        """Not bias -- a different question. Unadjusted gives the total effect,
        adjusted gives the direct effect, and both are correct answers."""
        dag = mediated()
        df = simulate(dag, n=N, seed=SEED)

        assert ols(df, "X", "Y") == pytest.approx(true_total_effect(dag, "X", "Y"), abs=TOL)
        assert ols(df, "X", "Y", ["M"]) == pytest.approx(
            true_direct_effect(dag, "X", "Y"), abs=TOL
        )

    def test_adjusting_for_a_collider_creates_bias_from_nothing(self):
        """The whole argument in one assertion: the true effect is exactly zero,
        the naive estimate finds zero, and 'controlling for more variables'
        introduces an effect that does not exist."""
        dag = m_bias()
        df = simulate(dag, n=N, seed=SEED)

        assert ols(df, "X", "Y") == pytest.approx(0.0, abs=TOL)
        assert abs(ols(df, "X", "Y", ["M"])) > 0.1

    def test_dowhy_recovers_the_planted_effect_through_to_dot(self):
        """End to end: a DAG authored here, exported as DOT, estimated by DoWhy."""
        dowhy = pytest.importorskip("dowhy")

        dag = confounded()
        df = simulate(dag, n=N, seed=SEED)
        model = dowhy.CausalModel(
            data=df, treatment="X", outcome="Y", graph=dag.to_dot()
        )
        estimate = model.estimate_effect(
            model.identify_effect(), method_name="backdoor.linear_regression"
        )
        assert estimate.value == pytest.approx(
            true_total_effect(dag, "X", "Y"), abs=TOL
        )

    def test_dowhy_excludes_the_mediator_from_the_backdoor_set(self):
        """A mediator is a descendant of the treatment, so no valid backdoor set
        contains it -- meaning DoWhy returns the total effect here. The education
        notebook originally left this ambiguous."""
        dowhy = pytest.importorskip("dowhy")

        dag = mediated()
        df = simulate(dag, n=N, seed=SEED)
        model = dowhy.CausalModel(
            data=df, treatment="X", outcome="Y", graph=dag.to_dot()
        )
        estimand = model.identify_effect(proceed_when_unidentifiable=True)
        backdoor = estimand.get_backdoor_variables()
        assert "M" not in backdoor
