"""The browser's estimator must give DoWhy's answer.

site/js/estimate.js re-implements DoWhy's backdoor linear regression so "Try
your own data" can answer instantly, before DoWhy itself has loaded. These
tests run both on random datasets mixing numeric, yes/no and categorical
columns, and require the estimate, 95% interval and p-value to agree.
"""

import json
import logging
import random
import shutil
import subprocess
import warnings
from pathlib import Path

import numpy as np
import pandas as pd
import pytest

HARNESS = Path(__file__).parent / "js" / "estimate_harness.mjs"

pytestmark = pytest.mark.skipif(shutil.which("node") is None, reason="node is not installed")


def random_case(rng: random.Random, np_rng: np.random.Generator):
    n = rng.choice([60, 250, 1500])
    cols = {}
    kinds = {}
    for i in range(rng.randint(0, 4)):
        kind = rng.choice(["numeric", "binary", "categorical"])
        name = f"z{i}"
        if kind == "numeric":
            cols[name] = np_rng.normal(size=n)
        elif kind == "binary":
            cols[name] = np_rng.integers(0, 2, size=n)
        else:
            cols[name] = np_rng.choice(["north", "south", "east", "west", "mid"][: rng.randint(2, 5)], size=n)
        kinds[name] = kind

    def signal(name):
        v = cols[name]
        return pd.Series(v).astype("category").cat.codes.to_numpy() if kinds[name] == "categorical" else v

    confounding = sum(signal(z) * rng.uniform(-1, 1) for z in cols) if cols else 0
    t_kind = rng.choice(["numeric", "binary", "ordered"])
    base = confounding + np_rng.normal(size=n)
    t = {"numeric": base, "binary": (base > 0).astype(int), "ordered": np.digitize(base, [-0.5, 0.5])}[t_kind]
    y = rng.uniform(-2, 2) * t + confounding + np_rng.normal(size=n)
    cols["t"], cols["y"] = t, y

    adjust = [z for z in kinds if rng.random() < 0.7]
    categorical = [z for z in adjust if kinds[z] == "categorical"]
    return cols, {"treatment": "t", "outcome": "y", "adjust": adjust, "categorical": categorical}


def dowhy_estimate(cols, spec):
    warnings.filterwarnings("ignore")
    logging.disable(logging.WARNING)
    from dowhy import CausalModel

    df = pd.DataFrame(cols)
    for z in spec["categorical"]:
        df[z] = df[z].astype(str)
    edges = ["t->y"] + [f"{z}->{v}" for z in spec["adjust"] for v in ("t", "y")]
    model = CausalModel(data=df[["t", "y", *spec["adjust"]]], treatment="t", outcome="y",
                        graph="digraph{" + ";".join(edges) + ";}")
    estimand = model.identify_effect(proceed_when_unidentifiable=True)
    assert sorted(estimand.get_backdoor_variables()) == sorted(spec["adjust"])
    est = model.estimate_effect(estimand, method_name="backdoor.linear_regression", effect_modifiers=[],
                                confidence_intervals=True, test_significance=True)
    lo, hi = est.get_confidence_intervals()[0]
    return {"effect": float(est.value), "ci": [float(lo), float(hi)],
            "p": float(est.test_stat_significance()["p_value"][0])}


def run_js(cases):
    proc = subprocess.run(["node", str(HARNESS)], input=json.dumps(cases), capture_output=True, text=True, check=True)
    return json.loads(proc.stdout)


def as_json(cols):
    return {k: [x.item() if hasattr(x, "item") else x for x in v] for k, v in cols.items()}


@pytest.fixture(scope="module")
def cases():
    rng = random.Random(11)
    np_rng = np.random.default_rng(11)
    return [random_case(rng, np_rng) for _ in range(60)]


def test_estimate_interval_and_p_match_dowhy(cases):
    js = run_js([{"data": as_json(c), "spec": s} for c, s in cases])
    for (cols, spec), got in zip(cases, js):
        want = dowhy_estimate(cols, spec)
        where = f"adjust={spec['adjust']} n={len(cols['y'])}"
        assert got["effect"] == pytest.approx(want["effect"], rel=1e-6, abs=1e-9), where
        assert got["ci"] == pytest.approx(want["ci"], rel=1e-6, abs=1e-9), where
        assert got["p"] == pytest.approx(want["p"], rel=1e-5, abs=1e-9), where


def test_refutations_behave_like_dowhys(cases):
    """Random draws differ from DoWhy's, so check what each refuter should show."""
    picked = [c for c in cases if len(c[0]["y"]) >= 250][:6]
    js = run_js([{"data": as_json(c), "spec": s, "withRefutations": True} for c, s in picked])
    for got in js:
        ref = got["refutations"]
        width = got["ci"][1] - got["ci"][0]
        assert abs(ref["placebo_treatment_refuter"]["new_effect"]) < width / 2
        assert ref["placebo_treatment_refuter"]["p"] >= 0.05
        assert ref["random_common_cause"]["new_effect"] == pytest.approx(got["effect"], abs=width / 10)
        assert ref["data_subset_refuter"]["new_effect"] == pytest.approx(got["effect"], abs=width / 4)
        assert ref["random_common_cause"]["p"] >= 0.05
