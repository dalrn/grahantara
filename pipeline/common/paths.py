"""Canonical paths and frozen reference data.

The hexagon set is FROZEN. It is read from reference/hex_index.txt, never
regenerated. Regenerating it would silently desynchronise the pipeline from the
frontend, which joins on h3_index.
"""
from functools import lru_cache
from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parents[2]

DATA_RAW = ROOT / "data" / "raw"
DATA_INTERIM = ROOT / "data" / "interim"
DATA_PROCESSED = ROOT / "data" / "processed"
REFERENCE = ROOT / "reference"
WEB_DATA = ROOT / "web" / "public" / "data"

JUMLAH_HEKSAGON = 2134


@lru_cache(maxsize=1)
def hex_index() -> list[str]:
    """The 2,134 canonical H3 res-9 cells, sorted. This is the join key."""
    cells = REFERENCE.joinpath("hex_index.txt").read_text(encoding="utf-8").split()
    if len(cells) != JUMLAH_HEKSAGON:
        raise ValueError(f"expected {JUMLAH_HEKSAGON} cells, found {len(cells)}")
    return cells


@lru_cache(maxsize=1)
def study_area():
    """Dissolved study-area boundary as a shapely geometry (EPSG:4326)."""
    import json
    from shapely.geometry import shape

    fc = json.loads(REFERENCE.joinpath("study_area.geojson").read_text(encoding="utf-8"))
    return shape(fc["features"][0]["geometry"])


@lru_cache(maxsize=1)
def load_weights() -> dict:
    """Weights from pipeline/config/weights.yaml."""
    return yaml.safe_load(
        ROOT.joinpath("pipeline", "config", "weights.yaml").read_text(encoding="utf-8")
    )


def ensure_dirs() -> None:
    for d in (DATA_RAW, DATA_INTERIM, DATA_PROCESSED):
        d.mkdir(parents=True, exist_ok=True)
