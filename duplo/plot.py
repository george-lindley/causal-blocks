"""Charts that appear in more than one notebook.

Deliberately thin. Anything used once belongs in the notebook that uses it,
where the reader can see it next to the result it produced.
"""

from __future__ import annotations

import matplotlib.pyplot as plt
import numpy as np
import pandas as pd

from .style import PALETTE


def correlation_heatmap(data: pd.DataFrame, variables: list[str] | None = None, ax=None):
    """Correlation matrix with the values written in.

    Correlation only, and labelled as such -- the point of the rest of this
    package is that these numbers are not effects.
    """
    frame = data[variables] if variables else data.select_dtypes(include=[np.number])
    corr = frame.corr()

    if ax is None:
        _, ax = plt.subplots(figsize=(8, 6))

    image = ax.imshow(corr, cmap="coolwarm", vmin=-1, vmax=1)
    ax.figure.colorbar(image, ax=ax, label="Pearson correlation")

    ax.set_xticks(range(len(corr.columns)), corr.columns, rotation=45, ha="right")
    ax.set_yticks(range(len(corr.columns)), corr.columns)

    for i in range(len(corr.columns)):
        for j in range(len(corr.columns)):
            value = corr.iloc[i, j]
            ax.text(
                j,
                i,
                f"{value:.2f}",
                ha="center",
                va="center",
                color="white" if abs(value) > 0.5 else PALETTE["dark_text"],
            )

    ax.set_title("Correlation (not causation)")
    ax.figure.tight_layout()
    return ax


def effect_comparison(effects: dict[str, float], title: str, ax=None):
    """Horizontal bars comparing effect estimates, with a zero line.

    ``effects`` maps a label to an estimate. Pass the fitted values, never
    transcribed numbers -- a chart with hardcoded results silently stops
    matching its analysis the first time the data changes.
    """
    if ax is None:
        _, ax = plt.subplots(figsize=(10, 6))

    labels = list(effects)
    values = [effects[label] for label in labels]
    colors = [
        PALETTE["coral"] if value < 0 else PALETTE["teal"] for value in values
    ]

    bars = ax.barh(labels, values, color=colors, edgecolor=PALETTE["dark_text"])
    ax.axvline(0, color="black", linewidth=0.8)
    ax.bar_label(bars, fmt="%+.2f", padding=4, fontweight="bold")

    ax.set_xlabel("Effect size")
    ax.set_title(title, fontsize=14, fontweight="bold")
    ax.margins(x=0.18)
    ax.figure.tight_layout()
    return ax
