"""Precompute every DoWhy result the web demo can ask for.

The demo lets students draw any graph over a fixed set of columns from the ONS
towns data. A backdoor linear-regression estimate depends only on three things
-- treatment, outcome, adjustment set -- and the graph only decides which
adjustment set. With seven columns that is under a thousand combinations, so
every one is run through real DoWhy here, once, and the page looks the answer up
instead of shipping Python to the browser.

    python scripts/build_demo_data.py            # writes site/data/demo.json
    python scripts/build_demo_data.py --quick    # 1 simulation per refuter, for testing

Each result is genuinely DoWhy's: the script builds a graph whose default
backdoor set is exactly the requested adjustment set, and asserts that DoWhy
identifies that set before estimating.
"""

from __future__ import annotations

import os

# Parallelism comes from worker processes. Multi-threaded BLAS inside each one
# oversubscribes the cores and makes the whole run several times slower. Must
# be set before numpy is imported.
for _var in ("OMP_NUM_THREADS", "OPENBLAS_NUM_THREADS", "MKL_NUM_THREADS"):
    os.environ.setdefault(_var, "1")

import argparse  # noqa: E402
import itertools  # noqa: E402
import json  # noqa: E402
import logging  # noqa: E402
import warnings  # noqa: E402
from concurrent.futures import ProcessPoolExecutor  # noqa: E402
from datetime import date  # noqa: E402
from pathlib import Path  # noqa: E402

import pandas as pd  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data" / "english_education.csv"
OUT = ROOT / "site" / "data" / "demo.json"

SIZES = ["Small Towns", "Medium Towns", "Large Towns"]

# kind decides encoding. As treatment or outcome every non-nominal variable is
# numeric (ordinals as 0, 1, 2 -- "one band up"). When adjusted for, ordinals
# and nominals enter as categories, so adjustment does not impose linearity.
VARIABLES = [
    {
        "id": "town_size",
        "label": "Town size",
        "kind": "ordinal",
        "column": "size_flag",
        "levels": SIZES,
        "description": "Small, medium or large town (2011 population).",
    },
    {
        "id": "education_score",
        "label": "Education score",
        "kind": "continuous",
        "column": "education_score",
        "description": "ONS composite of young people's attainment, standardised.",
    },
    {
        "id": "deprivation",
        "label": "Deprivation",
        "kind": "ordinal",
        "column": "income_flag",
        "levels": ["Lower deprivation towns", "Mid deprivation towns", "Higher deprivation towns"],
        "description": "Income deprivation band: lower, mid or higher.",
    },
    {
        "id": "adult_qualifications",
        "label": "Adult degrees",
        "kind": "ordinal",
        "column": "level4qual_residents35_64_2011",
        "levels": ["Low", "Medium", "High"],
        "description": "Share of residents aged 35-64 with a degree-level qualification: low, medium or high.",
    },
    {
        "id": "region",
        "label": "Region",
        "kind": "nominal",
        "column": "rgn11nm",
        "description": "English region. Categorical, so it can be adjusted for but not used as a treatment or outcome.",
    },
    {
        "id": "coastal",
        "label": "Coastal",
        "kind": "binary",
        "column": "coastal",
        "positive": "Coastal",
        "description": "Whether the town is on the coast.",
    },
    {
        "id": "university",
        "label": "University",
        "kind": "binary",
        "column": "university_flag",
        "positive": "University",
        "description": "Whether the town has a university.",
    },
]

REFUTERS = {
    "random_common_cause": {},
    "placebo_treatment_refuter": {"placebo_type": "permute"},
    "data_subset_refuter": {"subset_fraction": 0.8},
}
SEED = 20260927


def load() -> pd.DataFrame:
    raw = pd.read_csv(DATA)
    raw = raw[raw["size_flag"].isin(SIZES)]
    raw = raw.dropna(subset=[v["column"] for v in VARIABLES])

    df = pd.DataFrame(index=raw.index)
    for v in VARIABLES:
        col = raw[v["column"]]
        if v["kind"] == "ordinal":
            df[v["id"]] = pd.Categorical(col, categories=v["levels"], ordered=True).codes
            assert (df[v["id"]] >= 0).all(), f"unexpected level in {v['column']}"
        elif v["kind"] == "binary":
            df[v["id"]] = (col == v["positive"]).astype(int)
        else:
            df[v["id"]] = col
    return df.reset_index(drop=True)


def key(treatment: str, outcome: str, adjust: tuple[str, ...]) -> str:
    return f"{treatment}|{outcome}|{','.join(sorted(adjust))}"


def run_one(args) -> tuple[str, dict]:
    treatment, outcome, adjust, df, simulations = args
    warnings.filterwarnings("ignore")
    logging.disable(logging.WARNING)
    from dowhy import CausalModel

    kinds = {v["id"]: v["kind"] for v in VARIABLES}
    data = df[[treatment, outcome, *adjust]].copy()
    for z in adjust:
        if kinds[z] in ("ordinal", "nominal"):
            data[z] = data[z].astype(str)  # DoWhy one-hot encodes string columns

    edges = [f"{treatment}->{outcome}"] + [f"{z}->{t}" for z in adjust for t in (treatment, outcome)]
    model = CausalModel(
        data=data, treatment=treatment, outcome=outcome, graph="digraph{" + ";".join(edges) + ";}"
    )
    estimand = model.identify_effect(proceed_when_unidentifiable=True)
    identified = sorted(estimand.get_backdoor_variables())
    assert identified == sorted(adjust), f"DoWhy chose {identified}, wanted {sorted(adjust)}"

    est = model.estimate_effect(
        estimand,
        method_name="backdoor.linear_regression",
        effect_modifiers=[],
        confidence_intervals=True,
        test_significance=True,
    )
    lo, hi = (float(x) for x in est.get_confidence_intervals()[0])
    result = {
        "effect": round(float(est.value), 4),
        "ci": [round(lo, 4), round(hi, 4)],
        "p": round(float(est.test_stat_significance()["p_value"][0]), 4),
        "refutations": {},
    }
    for method, kwargs in REFUTERS.items():
        ref = model.refute_estimate(
            estimand, est, method_name=method, random_seed=SEED, num_simulations=simulations, **kwargs
        )
        p = (ref.refutation_result or {}).get("p_value")
        result["refutations"][method] = {
            "new_effect": round(float(ref.new_effect), 4),
            "p": None if p is None else round(float(p), 4),
        }
    return key(treatment, outcome, adjust), result


def jobs(df: pd.DataFrame, simulations: int):
    ids = [v["id"] for v in VARIABLES]
    estimable = [v["id"] for v in VARIABLES if v["kind"] != "nominal"]
    for treatment, outcome in itertools.permutations(estimable, 2):
        rest = [i for i in ids if i not in (treatment, outcome)]
        for size in range(len(rest) + 1):
            for adjust in itertools.combinations(rest, size):
                yield treatment, outcome, adjust, df, simulations


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    parser.add_argument("--quick", action="store_true", help="1 simulation per refuter")
    parser.add_argument("--workers", type=int, default=max(1, (os.cpu_count() or 2) - 2))
    args = parser.parse_args()

    import dowhy

    df = load()
    simulations = 1 if args.quick else 100
    todo = list(jobs(df, simulations))
    print(f"{len(df)} towns, {len(todo)} combinations, {args.workers} workers")

    results = {}
    with ProcessPoolExecutor(max_workers=args.workers) as pool:
        for i, (k, r) in enumerate(pool.map(run_one, todo, chunksize=4), 1):
            results[k] = r
            if i % 50 == 0 or i == len(todo):
                print(f"  {i}/{len(todo)}", flush=True)

    payload = {
        "meta": {
            "source": "ONS, Educational attainment of young people in English towns (2023), OGL v3.0",
            "n": len(df),
            "dowhy_version": dowhy.__version__,
            "method": "backdoor.linear_regression, effect_modifiers=[]",
            "refuter_simulations": simulations,
            "seed": SEED,
            "generated": date.today().isoformat(),
        },
        "variables": [{k: v for k, v in var.items() if k != "column"} for var in VARIABLES],
        "results": dict(sorted(results.items())),
    }
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(payload, separators=(",", ":")))
    print(f"wrote {OUT.relative_to(ROOT)} ({OUT.stat().st_size / 1024:.0f} KB)")


if __name__ == "__main__":
    main()
