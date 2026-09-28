"""Three small DAGs with known answers.

These are fixtures, not abstractions: canned graphs used by the concepts
notebook and the test suite so both are arguing about the same examples. Each
one has a true effect you can compute in your head, which is the only reason
they are useful for checking an estimator.

In all three the treatment is ``X`` and the outcome is ``Y``.
"""

from .dag import CausalDAG


def confounded() -> CausalDAG:
    """The textbook case: ``Z`` causes both ``X`` and ``Y``.

    True effect of X on Y is 1.5. Regressing Y on X alone gives roughly 3.5,
    because Z's influence (1.0 * 2.0) is misattributed to X. Adjusting for Z
    recovers 1.5. This is the case that makes people believe adjusting for more
    variables is always safer -- see :func:`m_bias` for why it is not.
    """
    return (
        CausalDAG()
        .add("Z", to={"X": 1.0, "Y": 2.0})
        .add("X", to={"Y": 1.5})
        .add("Y")
    )


def mediated() -> CausalDAG:
    """``X`` affects ``Y`` directly and through the mediator ``M``.

    Total effect 2.0 (direct 1.0, plus 0.5 * 2.0 = 1.0 through M). Adjusting for
    M does not remove bias -- it changes the question, returning the direct
    effect of 1.0 instead. Both numbers are correct answers to different
    questions, which is why a write-up has to say which one it reports.
    """
    return (
        CausalDAG()
        .add("X", to={"M": 0.5, "Y": 1.0})
        .add("M", to={"Y": 2.0})
        .add("Y")
    )


def m_bias() -> CausalDAG:
    """The M-bias graph, where adjusting for a collider *creates* bias.

    ``U1 -> X``, ``U1 -> M``, ``U2 -> M``, ``U2 -> Y``, and crucially no edge
    from X to Y at all -- so the true effect is exactly zero, and a plain
    regression of Y on X correctly returns zero. Adjust for M and a spurious
    effect appears, because M is a collider on the path
    ``X <- U1 -> M <- U2 -> Y``: conditioning on it opens a path that was
    closed. Named for the shape the arrows make.
    """
    return (
        CausalDAG()
        .add("U1", to={"X": 1.0, "M": 1.0})
        .add("U2", to={"M": 1.0, "Y": 1.0})
        .add("X")
        .add("M")
        .add("Y")
    )
