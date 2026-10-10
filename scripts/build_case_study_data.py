"""Write the case-study datasets (site/data/samples/).

Each one is a small CSV with friendly column names and only the columns its
story needs. The towns data uses exactly the variables of the original
analysis (scripts/build_demo_data.py).

    python scripts/build_case_study_data.py
"""

from pathlib import Path

import pandas as pd

from build_demo_data import VARIABLES, load

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "site" / "data" / "samples"

# Ordered levels become words, listed low → high in each dataset module.
WORDS = {
    "town_size": ["Small", "Medium", "Large"],
    "deprivation": ["Lower", "Mid", "Higher"],
    "adult_qualifications": ["Low", "Medium", "High"],
}
BINARY = {"coastal": ("Coastal", "Not coastal"), "university": ("University", "No university")}


def towns() -> pd.DataFrame:
    df = load()
    out = pd.DataFrame()
    for v in VARIABLES:
        col = df[v["id"]]
        if v["id"] in WORDS:
            col = col.map(dict(enumerate(WORDS[v["id"]])))
        elif v["id"] in BINARY:
            yes, no = BINARY[v["id"]]
            col = col.map({1: yes, 0: no})
        out[v["label"]] = col
    return out



if __name__ == "__main__":
    OUT.mkdir(parents=True, exist_ok=True)
    for name, df in [("towns", towns())]:
        df.to_csv(OUT / f"{name}.csv", index=False)
        print(f"{name}.csv: {len(df)} rows, columns {list(df.columns)}")
