"""Causal DAGs you build by hand, look at, and hand to DoWhy unchanged.

The one idea here: you author a graph once, and everything else is *derived*
from it. What a variable is -- confounder, mediator, collider, instrument -- is
a property of the graph and a chosen treatment/outcome pair, not something the
author declares. Declaring it separately is how a picture and an analysis end
up disagreeing without anyone noticing.
"""

from __future__ import annotations

from collections.abc import Iterable, Mapping

import networkx as nx

# How many treatment--outcome paths to enumerate before giving up. Undirected
# simple-path enumeration is exponential in the worst case; teaching DAGs are
# nowhere near it, but a runaway graph should fail loudly rather than hang.
_MAX_PATHS = 20_000


class Role:
    """The roles a variable can play, relative to a treatment and an outcome."""

    TREATMENT = "treatment"
    OUTCOME = "outcome"
    CONFOUNDER = "confounder"
    MEDIATOR = "mediator"
    COLLIDER = "collider"
    INSTRUMENT = "instrument"
    PRECISION = "precision"  # causes the outcome only; adjusting is optional
    UNRELATED = "unrelated"

    #: Colouring/reporting precedence. Colliders outrank mediators because
    #: adjusting for a collider *creates* bias, which is the worse surprise.
    PRECEDENCE = (
        TREATMENT,
        OUTCOME,
        COLLIDER,
        MEDIATOR,
        CONFOUNDER,
        INSTRUMENT,
        PRECISION,
        UNRELATED,
    )

    #: What each role means for an adjustment set. This is the payload the
    #: whole module exists to deliver.
    GUIDANCE = {
        CONFOUNDER: "adjust for it -- it is a common cause and leaves an open backdoor path",
        MEDIATOR: "adjusting for it gives the DIRECT effect, not the total effect",
        COLLIDER: "do NOT adjust -- conditioning on a collider creates bias that was not there",
        INSTRUMENT: "do NOT adjust -- usable as an instrument for IV estimation",
        PRECISION: "optional -- affects only the outcome, so it tightens estimates without changing the estimand",
        UNRELATED: "irrelevant to this treatment/outcome pair",
    }


class CyclicGraphError(ValueError):
    """Raised when the edges you added do not describe a DAG."""


class CausalDAG:
    """A directed acyclic graph of causal assumptions.

    Build it incrementally; forward references are fine, so you can add a node
    that points at one you have not defined yet::

        dag = CausalDAG()
        dag.add("region", to=["income", "town_size"])
        dag.add("town_size", to={"income": 0.4, "attainment": 0.7})
        dag.add("income", to={"attainment": 2.1})

    Edge weights are only used by :func:`duplo.simulate.simulate`; they default
    to 1.0 and can be ignored entirely if you are not simulating.
    """

    def __init__(self) -> None:
        self._edges: dict[str, dict[str, float]] = {}
        self._nodes: list[str] = []  # insertion-ordered, for stable rendering

    # ------------------------------------------------------------------
    # Construction
    # ------------------------------------------------------------------

    def add(
        self,
        name: str,
        to: str | Iterable[str] | Mapping[str, float] | None = None,
    ) -> CausalDAG:
        """Add ``name`` and its outgoing edges. Returns self, so calls chain.

        ``to`` accepts a single name, an iterable of names (all weight 1.0), or
        a mapping of name to edge weight.
        """
        self._touch(name)

        if to is None:
            return self
        if isinstance(to, str):
            to = [to]

        targets = to.items() if isinstance(to, Mapping) else ((t, 1.0) for t in to)
        for target, weight in targets:
            if target == name:
                raise CyclicGraphError(f"{name!r} cannot cause itself")
            self._touch(target)
            self._edges[name][target] = float(weight)

        return self

    def _touch(self, name: str) -> None:
        if name not in self._edges:
            self._edges[name] = {}
            self._nodes.append(name)

    @property
    def nodes(self) -> list[str]:
        """Node names, in the order they were first mentioned."""
        return list(self._nodes)

    @property
    def edges(self) -> list[tuple[str, str, float]]:
        """``(parent, child, weight)`` triples."""
        return [(p, c, w) for p, kids in self._edges.items() for c, w in kids.items()]

    def parents(self, name: str) -> list[str]:
        return [p for p, kids in self._edges.items() if name in kids]

    def __repr__(self) -> str:
        return f"<CausalDAG {len(self._nodes)} nodes, {len(self.edges)} edges>"

    # ------------------------------------------------------------------
    # Export -- the three consumers of one authored graph
    # ------------------------------------------------------------------

    def to_networkx(self) -> nx.DiGraph:
        """A NetworkX DiGraph, with ``weight`` on each edge. Validates acyclicity."""
        g = nx.DiGraph()
        g.add_nodes_from(self._nodes)
        for parent, child, weight in self.edges:
            g.add_edge(parent, child, weight=weight)

        if not nx.is_directed_acyclic_graph(g):
            cycle = " -> ".join(n for n, _ in nx.find_cycle(g))
            raise CyclicGraphError(f"graph contains a cycle: {cycle} -> ...")
        return g

    def to_dot(self) -> str:
        """A DOT string for ``dowhy.CausalModel(graph=...)``."""
        self.to_networkx()  # validate before handing anything downstream
        edges = "; ".join(f"{p}->{c}" for p, c, _ in self.edges)
        return "digraph{" + edges + (";" if edges else "") + "}"

    # ------------------------------------------------------------------
    # Role inference -- the point of the whole module
    # ------------------------------------------------------------------

    def roles(self, treatment: str, outcome: str) -> dict[str, set[str]]:
        """Classify every node relative to ``treatment`` and ``outcome``.

        Returns a mapping of node name to the set of roles it plays. A node can
        genuinely play more than one -- being a confounder on one path and a
        collider on another is the case that makes adjustment decisions hard,
        so it is reported rather than flattened away.
        """
        g = self.to_networkx()
        for node in (treatment, outcome):
            if node not in g:
                raise KeyError(f"{node!r} is not in this graph")
        if treatment == outcome:
            raise ValueError("treatment and outcome must differ")

        ancestors_t = nx.ancestors(g, treatment)
        descendants_t = nx.descendants(g, treatment)
        ancestors_y = nx.ancestors(g, outcome)

        # Reachability to the outcome that does *not* route through the
        # treatment. This is what separates a confounder (has its own path to
        # the outcome) from an instrument (all influence flows through the
        # treatment).
        without_t = g.copy()
        without_t.remove_node(treatment)
        reaches_y_around_t = (
            nx.ancestors(without_t, outcome) if outcome in without_t else set()
        )

        colliders = self._colliders_on_paths(g, treatment, outcome)

        result: dict[str, set[str]] = {treatment: {Role.TREATMENT}, outcome: {Role.OUTCOME}}
        for node in self._nodes:
            if node in (treatment, outcome):
                continue

            found: set[str] = set()
            if node in descendants_t and node in ancestors_y:
                found.add(Role.MEDIATOR)
            if node in ancestors_t:
                found.add(
                    Role.CONFOUNDER if node in reaches_y_around_t else Role.INSTRUMENT
                )
            if node in colliders:
                found.add(Role.COLLIDER)
            if not found and node in ancestors_y:
                found.add(Role.PRECISION)

            result[node] = found or {Role.UNRELATED}

        return result

    def primary_role(self, node: str, treatment: str, outcome: str) -> str:
        """The single highest-precedence role of ``node``, for colouring."""
        return _highest(self.roles(treatment, outcome)[node])

    @staticmethod
    def _colliders_on_paths(g: nx.DiGraph, treatment: str, outcome: str) -> set[str]:
        """Nodes where two arrowheads meet on some treatment--outcome path.

        Walks undirected simple paths, because a path that connects treatment
        and outcome can run against the arrows -- that is exactly what a
        backdoor path is. On each path, a node with both neighbouring edges
        pointing *into* it is a collider: it blocks that path until you
        condition on it, at which point the path opens.
        """
        undirected = g.to_undirected(as_view=True)
        if treatment not in undirected or outcome not in undirected:
            return set()

        colliders: set[str] = set()
        for count, path in enumerate(
            nx.all_simple_paths(undirected, treatment, outcome)
        ):
            if count >= _MAX_PATHS:
                raise ValueError(
                    f"more than {_MAX_PATHS} paths between {treatment!r} and "
                    f"{outcome!r}; this graph is too dense to classify"
                )
            for prev, node, nxt in zip(path, path[1:], path[2:]):
                if g.has_edge(prev, node) and g.has_edge(nxt, node):
                    colliders.add(node)
        return colliders

    # ------------------------------------------------------------------
    # Explanation
    # ------------------------------------------------------------------

    def explain(self, treatment: str, outcome: str) -> str:
        """A plain-language reading of the graph: who is what, and what to adjust for.

        Also states which effect a backdoor adjustment will return, which is the
        question it is easiest to leave unanswered in a write-up.
        """
        roles = self.roles(treatment, outcome)
        by_role: dict[str, list[str]] = {}
        for node, node_roles in roles.items():
            if node in (treatment, outcome):
                continue
            by_role.setdefault(_highest(node_roles), []).append(node)

        lines = [
            f"Treatment: {treatment}",
            f"Outcome:   {outcome}",
            "",
        ]

        g = self.to_networkx()
        if not nx.has_path(g, treatment, outcome):
            lines.append(
                f"NOTE: no directed path from {treatment} to {outcome}. This graph "
                f"asserts that {treatment} has no causal effect on {outcome}; the true "
                "effect is zero by construction."
            )
            lines.append("")

        for role in Role.PRECEDENCE:
            names = by_role.get(role)
            if not names:
                continue
            lines.append(f"{role.upper()}: {', '.join(sorted(names))}")
            lines.append(f"    {Role.GUIDANCE[role]}")

        multi = {
            node: sorted(r)
            for node, r in roles.items()
            if len(r) > 1 and node not in (treatment, outcome)
        }
        if multi:
            lines += ["", "PLAYS MORE THAN ONE ROLE (no adjustment choice is clean here):"]
            lines += [f"    {node}: {' + '.join(r)}" for node, r in sorted(multi.items())]

        confounders = by_role.get(Role.CONFOUNDER, [])
        mediators = by_role.get(Role.MEDIATOR, [])
        lines += ["", "WHAT A BACKDOOR ADJUSTMENT GIVES YOU:"]
        if mediators:
            lines.append(
                f"    Adjusting for {{{', '.join(sorted(confounders)) or 'nothing'}}} "
                "-> TOTAL effect (through every pathway)."
            )
            lines.append(
                f"    Adding the mediator(s) {{{', '.join(sorted(mediators))}}} "
                "-> DIRECT effect only."
            )
            lines.append("    These answer different questions. Say which one you report.")
        elif confounders:
            lines.append(
                f"    Adjusting for {{{', '.join(sorted(confounders))}}} -> TOTAL effect. "
                "No mediators, so total and direct coincide."
            )
        else:
            lines.append(
                "    No confounders in this graph, so no adjustment is needed for "
                "identification. That is a strong assumption -- it says nothing "
                "unobserved causes both treatment and outcome."
            )

        return "\n".join(lines)

    # ------------------------------------------------------------------
    # Drawing
    # ------------------------------------------------------------------

    def draw(
        self,
        treatment: str | None = None,
        outcome: str | None = None,
        save_path: str | None = None,
    ):
        """Render the graph. Node colour is derived from role, never asserted.

        Without ``treatment``/``outcome`` the structure is drawn in neutral
        grey, since role is undefined until you say what you are estimating.
        """
        from graphviz import Digraph

        from .style import ROLE_COLORS, role_border

        roles = (
            {n: _highest(r) for n, r in self.roles(treatment, outcome).items()}
            if treatment and outcome
            else {}
        )

        dot = Digraph(format="png")
        dot.attr(rankdir="LR", bgcolor="white", dpi="300")
        dot.attr(
            "node",
            style="filled,rounded",
            shape="box",
            width="1.8",
            height="1",
            fontname="Arial",
            fontsize="13",
            fontcolor="#2c3e50",
            penwidth="2.5",
        )
        dot.attr("edge", arrowsize="0.8", penwidth="2.5", color="#7f8c8d")

        for node in self._nodes:
            role = roles.get(node, Role.UNRELATED)
            fill = ROLE_COLORS[role] if roles else ROLE_COLORS[Role.UNRELATED]
            # Colliders also get a distinct shape, so the warning survives
            # greyscale printing and colour-blind readers.
            shape = "octagon" if role == Role.COLLIDER else "box"
            label = f"{node}\n({role})" if roles and role != Role.UNRELATED else node
            dot.node(
                node, label=label, fillcolor=fill, color=role_border(role), shape=shape
            )

        for parent, child, _ in self.edges:
            dot.edge(parent, child)

        if save_path:
            dot.render(save_path.removesuffix(".png"), cleanup=True)

        return dot


def _highest(roles: set[str]) -> str:
    """Pick the role that matters most for a decision."""
    for role in Role.PRECEDENCE:
        if role in roles:
            return role
    return Role.UNRELATED
