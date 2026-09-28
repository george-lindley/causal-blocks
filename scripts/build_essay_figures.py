"""Draw the essay's three charts from the ONS towns data.

    python scripts/build_essay_figures.py    # writes essay/figures/*.png

Every number is computed here, from the same sample and models as the essay's
tables, so a chart cannot disagree with the paragraph next to it.
"""

from __future__ import annotations

from pathlib import Path

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt  # noqa: E402
from matplotlib.transforms import blended_transform_factory  # noqa: E402
import pandas as pd  # noqa: E402
import statsmodels.formula.api as smf  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "essay" / "figures"

SIZES = ["Small Towns", "Medium Towns", "Large Towns"]
BANDS = ["Lower deprivation towns", "Mid deprivation towns", "Higher deprivation towns"]

INK = "#1f2933"
MUTED = "#5b6673"
GRID = "#e2e6eb"
QUIET = "#b8c1ca"  # common-practice readings: deliberately recessive
TOTAL = "#e67e22"
VIA = "#9b59b6"  # the mediator colour, as on the site
DIRECT = "#16a085"
BAND_RAMP = ["#e3d4ea", "#b98ccb", "#7d3c98"]  # one hue, light -> dark = less -> more deprived

plt.rcParams.update({
    "font.family": "Liberation Sans",
    "font.size": 13,
    "text.color": INK,
    "axes.labelcolor": MUTED,
    "xtick.color": MUTED,
    "ytick.color": INK,
    "axes.edgecolor": GRID,
    "figure.dpi": 200,
    "savefig.dpi": 200,
    "savefig.bbox": "tight",
    "savefig.pad_inches": 0.25,
    "savefig.facecolor": "white",
})


def load() -> pd.DataFrame:
    cols = ["size_flag", "education_score", "rgn11nm", "income_flag", "coastal",
            "university_flag", "level4qual_residents35_64_2011"]
    df = pd.read_csv(ROOT / "data" / "english_education.csv")
    df = df[df["size_flag"].isin(SIZES)].dropna(subset=cols)
    return df.rename(columns={"level4qual_residents35_64_2011": "adult_quals"})


def large_vs_small(df: pd.DataFrame, extra: str = "") -> float:
    term = 'C(size_flag, Treatment("Small Towns"))[T.Large Towns]'
    fit = smf.ols('education_score ~ C(size_flag, Treatment("Small Towns"))' + extra, data=df).fit()
    return fit.params[term]


def title(ax, text: str, sub: str) -> None:
    ax.set_title(text, loc="left", fontsize=17, fontweight="bold", color=INK, pad=30)
    ax.text(0, 1.02, sub, transform=ax.transAxes, fontsize=12.5, color=MUTED, va="bottom")


def clean(ax) -> None:
    for side in ("top", "right", "left"):
        ax.spines[side].set_visible(False)
    ax.tick_params(length=0)


def attainment_by_size(df: pd.DataFrame) -> None:
    means = df.groupby("size_flag")["education_score"].mean().reindex(SIZES)
    labels = ["Small towns", "Medium towns", "Large towns"]
    fig, ax = plt.subplots(figsize=(8, 4.2))
    bars = ax.bar(labels, means.values, width=0.55, color=QUIET, edgecolor="white", linewidth=2)
    bars[0].set_color("#7f8c8d")
    ax.axhline(0, color=MUTED, linewidth=1)
    for bar, v in zip(bars, means.values):
        ax.annotate(f"{v:+.2f}", (bar.get_x() + bar.get_width() / 2, v),
                    xytext=(0, 6 if v >= 0 else -6), textcoords="offset points",
                    ha="center", va="bottom" if v >= 0 else "top", fontweight="bold", color=INK)
    ax.set_ylim(-1.15, 0.65)
    ax.set_yticks([])
    clean(ax)
    ax.spines["bottom"].set_visible(False)
    ax.tick_params(axis="x", pad=8)
    title(ax, "Small towns score higher on education",
          "Average education score by town size, 1,082 English towns (ONS, 2023)")
    fig.savefig(OUT / "01-attainment-by-size.png")
    plt.close(fig)


def deprivation_by_size(df: pd.DataFrame) -> None:
    shares = pd.crosstab(df["size_flag"], df["income_flag"], normalize="index").reindex(
        index=SIZES, columns=BANDS) * 100
    labels = ["Small towns", "Medium towns", "Large towns"]
    fig, ax = plt.subplots(figsize=(8, 3.6))
    left = [0.0] * len(SIZES)
    for band, color in zip(BANDS, BAND_RAMP):
        vals = shares[band].values
        ax.barh(labels, vals, left=left, color=color, edgecolor="white", linewidth=2, height=0.6)
        for i, v in enumerate(vals):
            if v >= 8:
                ax.text(left[i] + v / 2, i, f"{v:.0f}%", ha="center", va="center", fontsize=12.5,
                        fontweight="bold", color="white" if color == BAND_RAMP[-1] else INK)
        left = [a + b for a, b in zip(left, vals)]
    ax.invert_yaxis()
    ax.set_xlim(0, 100)
    ax.set_xticks([])
    clean(ax)
    ax.spines["bottom"].set_visible(False)
    handles = [plt.Rectangle((0, 0), 1, 1, color=c) for c in BAND_RAMP]
    ax.legend(handles, ["Lower deprivation", "Mid deprivation", "Higher deprivation"], ncol=3,
              loc="upper left", bbox_to_anchor=(0, -0.02), frameon=False, fontsize=12,
              handlelength=1, handleheight=1)
    title(ax, "Larger towns are far more deprived",
          "Share of towns in each income-deprivation band")
    fig.savefig(OUT / "02-deprivation-by-size.png")
    plt.close(fig)


def three_readings(df: pd.DataFrame) -> None:
    correlation = large_vs_small(df)
    everything = large_vs_small(df, " + C(rgn11nm) + C(income_flag) + C(coastal)"
                                    " + C(university_flag) + C(adult_quals)")
    total = large_vs_small(df, " + C(rgn11nm)")
    direct = large_vs_small(df, " + C(rgn11nm) + C(income_flag)")
    via = total - direct

    rows = [  # label, value, colour, group
        ("The correlation (ONS)", correlation, QUIET),
        ("Control for everything", everything, QUIET),
        ("Total effect", total, TOTAL),
        ("   through deprivation", via, VIA),
        ("   direct effect, deprivation held fixed", direct, DIRECT),
    ]
    fig, ax = plt.subplots(figsize=(9, 4.6))
    y = [0, 1, 2.6, 3.6, 4.6]
    for yi, (label, v, color) in zip(y, rows):
        ax.barh(yi, v, color=color, height=0.62, edgecolor="white", linewidth=2)
        ax.text(v + (0.06 if v >= 0 else -0.06), yi, f"{v:+.2f}", va="center",
                ha="left" if v >= 0 else "right", fontweight="bold", color=INK)
    ax.set_yticks(y, [r[0] for r in rows])
    for tick, (_, _, color) in zip(ax.get_yticklabels(), rows):
        tick.set_color(MUTED if color == QUIET else INK)
    ax.axvline(0, color=MUTED, linewidth=1)
    ax.set_xlim(-2.6, 1.3)
    ax.set_ylim(5.2, -1.0)
    ax.set_xticks([-2, -1, 0, 1], ["−2", "−1", "0", "+1"])
    ax.xaxis.grid(True, color=GRID, linewidth=1)
    ax.set_axisbelow(True)
    clean(ax)
    ax.spines["bottom"].set_visible(False)
    # Group headings, right-aligned with the row labels, just above each group.
    edge = blended_transform_factory(ax.transAxes, ax.transData)
    for yi, text, color in [(-0.62, "COMMON PRACTICE", MUTED), (1.98, "THE CAUSAL STORY", INK)]:
        ax.text(-0.02, yi, text, transform=edge, ha="right", va="center",
                fontsize=10.5, fontweight="bold", color=color)
    ax.set_xlabel("Large vs small towns, points of education score", labelpad=10)
    title(ax, "Three readings of the same data",
          "Only the causal one says why: the gap runs through deprivation")
    fig.savefig(OUT / "03-three-readings.png")
    plt.close(fig)


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    df = load()
    assert len(df) == 1082, len(df)
    attainment_by_size(df)
    deprivation_by_size(df)
    three_readings(df)
    print(f"wrote {sorted(p.name for p in OUT.glob('0*.png'))}")


if __name__ == "__main__":
    main()
