"""Colour palette, shared by the DAG renderer and the matplotlib charts.

Colours are keyed by *role*, not by node, so a diagram cannot say something the
graph does not. See :mod:`causalblocks.dag` for where roles come from.
"""

from .dag import Role

PALETTE = {
    "orange": "#fa953d",
    "teal": "#16a085",
    "blue": "#3498db",
    "coral": "#e74c3c",
    "grey": "#95a5a6",
    "purple": "#9b59b6",
    "yellow": "#f1c40f",
    "light_bg": "#ecf0f1",
    "dark_text": "#2c3e50",
}

#: Role -> fill colour. Treatment and outcome are the two warm/cool anchors;
#: colliders take the alarm colour because they are the trap.
ROLE_COLORS = {
    Role.TREATMENT: PALETTE["orange"],
    Role.OUTCOME: PALETTE["teal"],
    Role.CONFOUNDER: PALETTE["blue"],
    Role.MEDIATOR: PALETTE["purple"],
    Role.COLLIDER: PALETTE["coral"],
    # Yellow rather than gold: gold sits close enough to the treatment orange
    # that the two are hard to tell apart when adjacent in a diagram.
    Role.INSTRUMENT: PALETTE["yellow"],
    Role.PRECISION: PALETTE["light_bg"],
    Role.UNRELATED: PALETTE["grey"],
}

_BORDERS = {
    PALETTE["orange"]: "#e67e22",
    PALETTE["teal"]: "#138d75",
    PALETTE["blue"]: "#2980b9",
    PALETTE["coral"]: "#c0392b",
    PALETTE["purple"]: "#8e44ad",
    PALETTE["yellow"]: "#d4ac0d",
    PALETTE["light_bg"]: "#bdc3c7",
    PALETTE["grey"]: "#7f8c8d",
}

#: Ordered colours for categorical matplotlib/seaborn plots.
CATEGORICAL = [
    PALETTE["orange"],
    PALETTE["teal"],
    PALETTE["blue"],
    PALETTE["coral"],
    PALETTE["purple"],
    PALETTE["yellow"],
    "#27ae60",
]


def role_border(role: str) -> str:
    """Darker border for a role's fill colour."""
    return _BORDERS.get(ROLE_COLORS.get(role, PALETTE["grey"]), "#7f8c8d")


def set_theme() -> None:
    """Apply the palette to seaborn/matplotlib. No-op if seaborn is absent."""
    try:
        import seaborn as sns
    except ImportError:
        return

    sns.set_theme(
        style="whitegrid",
        palette=CATEGORICAL,
        context="notebook",
        rc={
            "figure.figsize": (10, 6),
            "axes.labelcolor": PALETTE["dark_text"],
            "xtick.color": PALETTE["dark_text"],
            "ytick.color": PALETTE["dark_text"],
            "grid.color": PALETTE["light_bg"],
            "axes.edgecolor": PALETTE["grey"],
        },
    )
