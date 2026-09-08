#!/usr/bin/env python3
"""Reconcile halte with route membership, producing the C1/C2/C3 stop table.

    python pipeline/00_ingest/03_halte_rute_join.py [--force]

Two problems this fixes:

1. `halte.parquet` is a tag query (highway=bus_stop, public_transport=*), so it
   misses nodes that carry no stop tag of their own and exist only as members of
   a route relation. Three such nodes fall inside the study area, and C3 would
   silently lose the corridors passing through them.

2. Route membership is what C2 and C3 consume: how many distinct corridors a
   stop serves, and which corridors reach which campus. That lives in the
   relation, not on the node.

Output: data/interim/halte_rute.parquet -- every stop, with the corridors it
serves, restricted to stops within reach of the study area.
"""
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

import geopandas as gpd
import pandas as pd
import requests
from shapely.geometry import Point

from pipeline.common.cache import cached, interim
from pipeline.common.geo import CRS_UTM49S, CRS_WGS84
from pipeline.common.paths import study_area

UA = {"User-Agent": "grahantara-pipeline/0.1 (MAPID WebGIS competition)"}
# Keep stops a little beyond the study area: a hexagon on the edge may sensibly
# walk to a stop just outside it.
KEEP_BUFFER_M = 2000


def _fetch_nodes(ids: list[str]) -> list[tuple]:
    """Resolve bare node ids to coordinates via Overpass."""
    got = []
    for i in range(0, len(ids), 50):
        chunk = ids[i:i + 50]
        q = f'[out:json][timeout:120];node(id:{",".join(chunk)});out skel;'
        for attempt in range(3):
            r = requests.post("https://overpass-api.de/api/interpreter",
                              data={"data": q}, headers=UA, timeout=200)
            if r.status_code == 200:
                got += [(str(e["id"]), e["lon"], e["lat"])
                        for e in r.json().get("elements", [])]
                break
            time.sleep(4 * (attempt + 1))
    return got


def main(force: bool = False) -> int:
    out = interim("halte_rute.parquet")
    if cached(out, force):
        return 0

    halte = gpd.read_parquet(interim("halte.parquet"))
    rute = pd.read_parquet(interim("rute.parquet"))

    # stop id -> list of corridor refs serving it
    serves: dict[str, list[str]] = {}
    for _, r in rute.iterrows():
        if not r["stop_ids"]:
            continue
        ref = r["ref"] or r["rel_id"]
        for sid in str(r["stop_ids"]).split(","):
            serves.setdefault(sid, []).append(str(ref))

    known = set(halte["osm_id"].astype(str))
    missing = sorted(set(serves) - known)
    print(f"  halte bertag        {len(known)}")
    print(f"  halte hanya anggota relasi {len(missing)}, mengambil koordinat...")

    extra = _fetch_nodes(missing)
    if extra:
        add = gpd.GeoDataFrame(
            {"osm_id": [e[0] for e in extra],
             "name": [None] * len(extra),
             "sumber_titik": ["relasi_rute"] * len(extra)},
            geometry=[Point(e[1], e[2]) for e in extra], crs=CRS_WGS84)
        halte["sumber_titik"] = "tag_osm"
        halte = pd.concat([halte, add], ignore_index=True)
        halte = gpd.GeoDataFrame(halte, geometry="geometry", crs=CRS_WGS84)

    halte["osm_id"] = halte["osm_id"].astype(str)
    halte["koridor"] = halte["osm_id"].map(
        lambda i: ",".join(sorted(set(serves.get(i, [])))))
    halte["n_koridor"] = halte["koridor"].map(lambda s: len(s.split(",")) if s else 0)

    # Clip to the study area plus a walking buffer.
    area = gpd.GeoSeries([study_area()], crs=CRS_WGS84).to_crs(CRS_UTM49S)
    keep_zone = area.buffer(KEEP_BUFFER_M).to_crs(CRS_WGS84).iloc[0]
    before = len(halte)
    halte = halte[halte.geometry.within(keep_zone)].reset_index(drop=True)

    halte.to_parquet(out)
    served = (halte["n_koridor"] > 0).sum()
    print(f"  dipangkas ke wilayah studi +{KEEP_BUFFER_M} m: {before} -> {len(halte)}")
    print(f"  halte dengan koridor diketahui: {served} "
          f"({100 * served / len(halte):.1f}%)")
    print(f"  koridor per halte: median {int(halte.loc[halte.n_koridor>0,'n_koridor'].median())}, "
          f"maks {halte['n_koridor'].max()}")
    print(f"  -> {out.name}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main("--force" in sys.argv))
