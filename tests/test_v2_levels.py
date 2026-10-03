"""Every Causal Blocks v2 level's crowd must show what the level claims.

The validator lives in site/v2/js/validate.js so the game and the tests share
one definition of "link". This runs it on every level in levels/index.json,
plus a few broken levels to make sure it really catches mistakes.
"""

import json
import shutil
import subprocess
from pathlib import Path

import pytest

ROOT = Path(__file__).parent
HARNESS = ROOT / "js" / "v2_levels_harness.mjs"

pytestmark = pytest.mark.skipif(shutil.which("node") is None, reason="node is not installed")


def run_node(script):
    proc = subprocess.run(["node", "--input-type=module", "-e", script], capture_output=True, text=True, check=True, cwd=ROOT.parent)
    return json.loads(proc.stdout)


def test_every_level_is_valid():
    results = json.loads(subprocess.run(["node", str(HARNESS)], capture_output=True, text=True, check=True).stdout)
    assert results, "no levels found"
    for level_id, errors in results.items():
        assert errors == [], f"{level_id}: {errors}"


def validate_variant(change):
    """Validate the confounder level after applying a JS mutation to it."""
    return run_node(f"""
        import {{ readFileSync }} from "node:fs";
        import {{ validateLevel }} from "./site/v2/js/validate.js";
        const level = JSON.parse(readFileSync("site/v2/levels/confounder.json"));
        {change}
        console.log(JSON.stringify(validateLevel(level)));
    """)


def test_original_brief_numbers_are_too_weak():
    # The first draft's crowd (5 vs 4 of 9) is a link a player can't see.
    errors = validate_variant("""
        level.crowd = [
          {n: 4, icecream: true, sunburn: true, hot: true}, {n: 2, icecream: true, sunburn: false, hot: true},
          {n: 2, icecream: false, sunburn: true, hot: true}, {n: 1, icecream: false, sunburn: false, hot: true},
          {n: 1, icecream: true, sunburn: true, hot: false}, {n: 2, icecream: true, sunburn: false, hot: false},
          {n: 2, icecream: false, sunburn: true, hot: false}, {n: 4, icecream: false, sunburn: false, hot: false},
        ];
    """)
    assert any("whole crowd should show a link" in e for e in errors)


def test_catches_a_link_that_survives_the_split():
    errors = validate_variant("level.crowd[2].n = 0;")  # no non-eaters burnt on hot days
    assert any("pile should show no link" in e for e in errors)


def test_catches_an_empty_column():
    errors = validate_variant("level.crowd[4].n = 0;")  # no ice cream on cool days
    assert any("column is empty" in e for e in errors)


def test_catches_wrong_answer_key():
    errors = validate_variant('level.correctArrows.push(["icecream", "sunburn"]);')
    assert any("no role explains" in e for e in errors)
