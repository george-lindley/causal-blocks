"""Tests for graph construction, export, and role inference."""

import networkx as nx
import pytest

from causalblocks import CausalDAG, CyclicGraphError, Role, confounded, m_bias, mediated


class TestConstruction:
    def test_forward_references_are_allowed(self):
        """You can point at a node before defining it -- graphs get built in any order."""
        dag = CausalDAG().add("X", to=["Y"])
        assert set(dag.nodes) == {"X", "Y"}

    def test_to_accepts_string_iterable_or_mapping(self):
        single = CausalDAG().add("A", to="B")
        listed = CausalDAG().add("A", to=["B"])
        mapped = CausalDAG().add("A", to={"B": 1.0})
        assert single.edges == listed.edges == mapped.edges == [("A", "B", 1.0)]

    def test_weights_default_to_one_and_are_kept(self):
        dag = CausalDAG().add("A", to={"B": 2.5}).add("B", to=["C"])
        assert dict(((p, c), w) for p, c, w in dag.edges) == {
            ("A", "B"): 2.5,
            ("B", "C"): 1.0,
        }

    def test_node_order_follows_first_mention(self):
        dag = CausalDAG().add("Z", to=["A"]).add("M")
        assert dag.nodes == ["Z", "A", "M"]

    def test_parents(self):
        dag = CausalDAG().add("A", to=["C"]).add("B", to=["C"])
        assert sorted(dag.parents("C")) == ["A", "B"]
        assert dag.parents("A") == []


class TestAcyclicity:
    def test_self_loop_rejected_immediately(self):
        with pytest.raises(CyclicGraphError, match="cannot cause itself"):
            CausalDAG().add("A", to=["A"])

    @pytest.mark.parametrize(
        "edges",
        [
            [("A", "B"), ("B", "A")],
            [("A", "B"), ("B", "C"), ("C", "A")],
        ],
        ids=["two-cycle", "three-cycle"],
    )
    def test_cycles_rejected_on_export(self, edges):
        dag = CausalDAG()
        for parent, child in edges:
            dag.add(parent, to=[child])
        with pytest.raises(CyclicGraphError, match="cycle"):
            dag.to_networkx()
        with pytest.raises(CyclicGraphError):
            dag.to_dot()


class TestExport:
    def test_dot_and_networkx_agree_on_edges(self):
        """The two exports feed DoWhy and GCM respectively; they must not diverge."""
        import re

        dag = confounded()
        from_dot = set(re.findall(r"(\w+)->(\w+)", dag.to_dot()))
        assert from_dot == set(dag.to_networkx().edges())

    def test_networkx_carries_weights(self):
        g = confounded().to_networkx()
        assert g["X"]["Y"]["weight"] == 1.5

    def test_isolated_nodes_survive_export(self):
        """A node with no edges is still an assumption worth drawing."""
        dag = CausalDAG().add("A", to=["B"]).add("lonely")
        assert "lonely" in dag.to_networkx().nodes


class TestRoles:
    def test_confounder(self):
        roles = confounded().roles("X", "Y")
        assert roles["Z"] == {Role.CONFOUNDER}
        assert roles["X"] == {Role.TREATMENT}
        assert roles["Y"] == {Role.OUTCOME}

    def test_mediator(self):
        assert mediated().roles("X", "Y")["M"] == {Role.MEDIATOR}

    def test_collider(self):
        """The case that matters: M is a collider, so adjusting for it adds bias."""
        assert Role.COLLIDER in m_bias().roles("X", "Y")["M"]

    def test_instrument_distinguished_from_confounder(self):
        """Both are ancestors of the treatment; only the confounder reaches the
        outcome by a route that bypasses it."""
        dag = (
            CausalDAG()
            .add("Z", to=["X"])            # instrument: reaches Y only through X
            .add("C", to=["X", "Y"])       # confounder: has its own path to Y
            .add("X", to=["Y"])
        )
        roles = dag.roles("X", "Y")
        assert roles["Z"] == {Role.INSTRUMENT}
        assert roles["C"] == {Role.CONFOUNDER}

    def test_precision_covariate(self):
        """Causes the outcome only: safe to adjust for, but not required."""
        dag = CausalDAG().add("X", to=["Y"]).add("P", to=["Y"])
        assert dag.roles("X", "Y")["P"] == {Role.PRECISION}

    def test_unrelated(self):
        dag = CausalDAG().add("X", to=["Y"]).add("noise")
        assert dag.roles("X", "Y")["noise"] == {Role.UNRELATED}

    def test_node_can_play_several_roles(self):
        """Both a mediator and a collider. Flattening this to one label would
        hide the fact that no adjustment choice here is clean."""
        dag = (
            CausalDAG()
            .add("X", to=["M"])
            .add("U", to=["M", "Y"])
            .add("M", to=["Y"])
        )
        assert dag.roles("X", "Y")["M"] == {Role.MEDIATOR, Role.COLLIDER}

    def test_roles_are_symmetric_under_swapping_treatment_and_outcome(self):
        """Role is a property of the graph *and* the question, not of the node."""
        dag = mediated()
        assert dag.roles("X", "Y")["M"] == {Role.MEDIATOR}
        assert Role.MEDIATOR not in dag.roles("M", "Y")["X"]

    def test_collider_precedence_beats_mediator_for_colouring(self):
        """Adjusting for a collider creates bias; that is the worse surprise, so
        it wins the single label used for colour."""
        dag = (
            CausalDAG().add("X", to=["M"]).add("U", to=["M", "Y"]).add("M", to=["Y"])
        )
        assert dag.primary_role("M", "X", "Y") == Role.COLLIDER

    def test_unknown_node_raises(self):
        with pytest.raises(KeyError):
            confounded().roles("X", "nope")

    def test_treatment_and_outcome_must_differ(self):
        with pytest.raises(ValueError):
            confounded().roles("X", "X")


class TestExplain:
    def test_names_the_estimand_when_a_mediator_is_present(self):
        text = mediated().explain("X", "Y")
        assert "DIRECT" in text and "TOTAL" in text

    def test_warns_when_there_is_no_causal_path(self):
        """m_bias asserts no effect at all; saying so up front stops a reader
        interpreting an estimate of zero as a failure to detect something."""
        assert "no directed path" in m_bias().explain("X", "Y")

    def test_lists_confounders_to_adjust_for(self):
        text = confounded().explain("X", "Y")
        assert "CONFOUNDER: Z" in text


class TestDraw:
    def test_draws_without_treatment_or_outcome(self):
        """Role is undefined until you say what you are estimating."""
        source = CausalDAG().add("A", to=["B"]).draw().source
        assert "A" in source and "B" in source

    def test_labels_carry_roles_when_asked(self):
        source = confounded().draw("X", "Y").source
        assert "confounder" in source and "treatment" in source

    def test_collider_gets_a_distinct_shape(self):
        """Colour alone fails in greyscale and for colour-blind readers."""
        assert "octagon" in m_bias().draw("X", "Y").source
