"""Every Free Build dataset loads, and every one of its maps gives an estimate.

The page (site/js/free-build.js) estimates each map in the browser; this runs
the same steps in Node over site/js/datasets/, so a new dataset with a typo in
a column name or an arrow fails here rather than on the live site.
"""

import json
import math
import shutil
import subprocess
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
HARNESS = ROOT / "tests" / "js" / "datasets_harness.mjs"

pytestmark = pytest.mark.skipif(shutil.which("node") is None, reason="needs Node")


@pytest.fixture(scope="module")
def datasets():
    out = subprocess.run(["node", str(HARNESS)], capture_output=True, text=True, check=True)
    return json.loads(out.stdout)


def test_datasets_are_well_formed(datasets):
    assert datasets
    for d in datasets:
        assert d["problems"] == [], d["key"]


def test_each_dataset_has_three_to_five_maps_best_first(datasets):
    for d in datasets:
        vs = d["versions"]
        assert 3 <= len(vs) <= 5, d["key"]
        assert not vs[0]["mistake"], d["key"]
        assert all(v["mistake"] for v in vs[1:]), d["key"]


def test_every_map_gives_an_estimate_on_every_row(datasets):
    for d in datasets:
        for v in d["versions"]:
            assert math.isfinite(v["effect"]), (d["key"], v["name"])
            assert v["n"] == d["rows"], (d["key"], v["name"])


def test_mistakes_change_the_answer(datasets):
    # A "mistake" that gives the same number teaches nothing.
    for d in datasets:
        best = d["versions"][0]["effect"]
        for v in d["versions"][1:]:
            assert abs(v["effect"] - best) >= 0.02, (d["key"], v["name"])
