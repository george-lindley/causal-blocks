"""Every game level must be fair.

A level is a simulated town with a known answer. The player wins when their
model's prediction lands within the level's tolerance of what really happens
when the town is poked. These tests check that the right answer always wins
and every listed trap clearly loses, so random noise can't decide a level.
"""

import json
import shutil
import subprocess
from pathlib import Path

import pytest

HARNESS = Path(__file__).parent / "js" / "levels_harness.mjs"

pytestmark = pytest.mark.skipif(shutil.which("node") is None, reason="node is not installed")


@pytest.fixture(scope="module")
def levels():
    proc = subprocess.run(["node", str(HARNESS)], capture_output=True, text=True, check=True)
    return json.loads(proc.stdout)


def test_right_answer_wins_comfortably(levels):
    for lv in levels:
        gap = abs(lv["right"]["effect"] - lv["truth"])
        assert gap <= lv["tolerance"] / 2, f"{lv['id']}: right answer misses by {gap:.3f}"


def test_harmless_extra_arrows_still_win(levels):
    """A model that keeps an arrow that makes no difference still predicts the poke."""
    for lv in levels:
        for ok in lv["alsoRight"]:
            gap = abs(ok["effect"] - lv["truth"])
            assert gap <= lv["tolerance"] / 2, f"{lv['id']} / {ok['name']}: misses by {gap:.3f}"


def test_every_trap_clearly_loses(levels):
    for lv in levels:
        for trap in lv["traps"]:
            gap = abs(trap["effect"] - lv["truth"])
            assert gap >= 2 * lv["tolerance"], f"{lv['id']} / {trap['name']}: only misses by {gap:.3f}"
