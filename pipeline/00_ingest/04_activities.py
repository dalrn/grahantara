#!/usr/bin/env python3
"""Download the survey Activities from MAPID (evidence layer, not numbers).

    python pipeline/00_ingest/04_activities.py [--force]

Per docs/ARCHITECTURE.md these carry no structured numeric fields, so they are
NOT a source of indicator values. They are photographs and provenance, used to
back the AI-2 narrative with real evidence for a hexagon.

Two API details that are easy to get wrong, both learned the hard way:

  * `feature` must be a bare GeoJSON Polygon geometry. Passing a Feature wrapper
    returns HTTP 400 with a misleading message about MultiPolygon.
  * The payload nests under data.activities, and meta.total carries the true
    count. len() on the top-level dict gives 1.

Output: data/interim/activities.parquet
"""
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

import geopandas as gpd
import requests
from shapely.geometry import Point, shape

from pipeline.common.cache import cached, interim, require_env
from pipeline.common.geo import CRS_WGS84
from pipeline.common.paths import study_area

URL = "https://server.mapid.io/web/competition/activities"
HASHTAG = "cinajawabatak"
START, END = "2026-01-01", "2026-12-31"


def main(force: bool = False) -> int:
    out = interim("activities.parquet")
    if cached(out, force):
        return 0

    key = require_env("MAPID_API_KEY_MISSION")
    geom = json.loads(
        Path("reference/study_area.geojson").read_text(encoding="utf-8")
    )["features"][0]["geometry"]

    r = requests.post(
        URL,
        headers={"x-api-key": key, "Content-Type": "application/json"},
        json={"feature": geom, "start_date": START, "end_date": END,
              "hashtag": [HASHTAG]},
        timeout=120,
    )
    if r.status_code != 200:
        raise SystemExit(f"Activities API HTTP {r.status_code}: {r.text[:300]}")

    payload = r.json()
    acts = payload["data"]["activities"]
    total = payload.get("meta", {}).get("total")
    if total is not None and total != len(acts):
        print(f"  PERINGATAN meta.total={total} tapi terambil {len(acts)}")

    rows = []
    for a in acts:
        g = a.get("geometry")
        if not g:
            continue
        pt = shape(g)
        if pt.geom_type != "Point":
            pt = pt.centroid
        rows.append({
            "activity_id": a.get("_id"),
            "title": a.get("title"),
            "description": a.get("description"),
            "n_media": len(a.get("medias") or []),
            "created_at": a.get("created_at"),
            "user_name": a.get("user_name"),
            "geometry": pt,
        })

    gdf = gpd.GeoDataFrame(rows, geometry="geometry", crs=CRS_WGS84)
    gdf.to_parquet(out)
    print(f"  activities   {len(gdf):5d} (meta.total={total}) -> {out.name}")
    print(f"    dengan foto: {(gdf['n_media'] > 0).sum()}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main("--force" in sys.argv))
