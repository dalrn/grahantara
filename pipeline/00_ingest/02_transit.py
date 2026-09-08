#!/usr/bin/env python3
"""Download transit geometry from OSM: bus stops, route relations, rail stations.

    python pipeline/00_ingest/02_transit.py [--force]

Three outputs, all EPSG:4326 GeoParquet in data/interim/:

  halte.parquet       bus stops / platforms inside the study area
  rute.parquet        Trans Jogja route relations, with their ORDERED stop list
  krl_stasiun.parquet rail stations (C4)

The route relations are the part that matters. C3 asks whether the nearest halte
actually carries you to your campus, which needs the corridor topology -- which
stops sit on which corridor, in order -- not merely a buffer around each stop.
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

import geopandas as gpd
import osmnx as ox
import pandas as pd

from pipeline.common.cache import cached, interim
from pipeline.common.geo import CRS_UTM49S, CRS_WGS84
from pipeline.common.paths import study_area

# Route relations often extend well past the study area; query a wider box so a
# corridor is not truncated mid-route, then keep whatever we get.
BUFFER_M = 8000


def _buffered_area(m: int):
    return (
        gpd.GeoSeries([study_area()], crs=CRS_WGS84)
        .to_crs(CRS_UTM49S).buffer(m).to_crs(CRS_WGS84).iloc[0]
    )


OVERPASS_URLS = (
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
)
# Overpass answers 406 to requests without a User-Agent.
UA = {"User-Agent": "grahantara-pipeline/0.1 (MAPID WebGIS competition)"}


def _overpass(query: str, tries: int = 3) -> dict:
    """POST to Overpass with retry across mirrors.

    504 from the public instances is usually transient load, not a bad query --
    the same request often succeeds seconds later. Retry with a backoff before
    falling through to the mirror.
    """
    import time

    import requests

    last = None
    for attempt in range(tries):
        for url in OVERPASS_URLS:
            try:
                r = requests.post(url, data={"data": query}, headers=UA, timeout=300)
                if r.status_code == 200:
                    return r.json()
                last = f"{url}: HTTP {r.status_code}"
            except Exception as e:  # noqa: BLE001 - try the mirror before giving up
                last = f"{url}: {e}"
        if attempt < tries - 1:
            time.sleep(4 * (attempt + 1))
    raise SystemExit(f"Overpass gagal setelah {tries} percobaan. Terakhir: {last}")


def _flatten_index(gdf: gpd.GeoDataFrame) -> gpd.GeoDataFrame:
    """OSMnx 2.x indexes features by (element, id). Flatten to a plain osm_id.

    The exact index names have moved between OSMnx versions, so read them off
    the frame rather than hardcoding them.
    """
    flat = gdf.reset_index()
    id_col = next((c for c in ("id", "osmid", "osm_id") if c in flat.columns), None)
    el_col = next((c for c in ("element", "element_type") if c in flat.columns), None)
    if id_col:
        flat["osm_id"] = flat[id_col].astype(str)
        if el_col is not None:
            flat["osm_type"] = flat[el_col].astype(str)
        flat = flat.drop(columns=[c for c in (id_col, el_col) if c and c != "osm_id"])
    return flat


def ingest_halte(force: bool) -> None:
    out = interim("halte.parquet")
    if cached(out, force):
        return
    area = _buffered_area(2000)
    tags = {"highway": "bus_stop", "public_transport": ["platform", "stop_position"]}
    gdf = ox.features_from_polygon(area, tags)
    gdf = gdf[gdf.geometry.notna()].copy()
    gdf["geometry"] = gdf.geometry.centroid  # platforms are sometimes ways
    keep = [c for c in ("name", "highway", "public_transport", "network", "operator",
                        "shelter", "bench") if c in gdf.columns]
    gdf = _flatten_index(gdf[keep + ["geometry"]])
    gdf.to_parquet(out)
    named = gdf["name"].notna().sum() if "name" in gdf.columns else 0
    print(f"  halte        {len(gdf):5d} titik ({named} bernama) -> {out.name}")


def ingest_rute(force: bool) -> None:
    """Route relations WITH their ordered stop sequence, via Overpass.

    ox.features_from_polygon() cannot be used here: it returns only features
    whose geometry it can assemble, and bus route relations frequently fail
    that, so it reports "no matching features" even though the relations exist.
    We query Overpass directly and keep the member list, which is the thing C3
    actually needs -- the corridor topology, not the drawn line.

    Overpass returns HTTP 406 without a User-Agent, so one is always sent.
    """
    out = interim("rute.parquet")
    if cached(out, force):
        return

    minx, miny, maxx, maxy = _buffered_area(BUFFER_M).bounds

    # Two passes. Asking for `out body` over the whole bbox in one go times out
    # on the public Overpass instances (HTTP 504), because it expands every
    # member of every relation. Tags first, then members in small id batches.
    head = _overpass(f"""
    [out:json][timeout:180];
    relation["type"="route"]["route"="bus"]({miny},{minx},{maxy},{maxx});
    out tags;
    """)
    ids = [e["id"] for e in head.get("elements", [])]
    print(f"    {len(ids)} relasi ditemukan, mengambil anggota per batch...")

    els = []
    BATCH = 5
    for i in range(0, len(ids), BATCH):
        chunk = ids[i:i + BATCH]
        body = _overpass(f"""
        [out:json][timeout:180];
        relation(id:{",".join(str(x) for x in chunk)});
        out body;
        """)
        els.extend(body.get("elements", []))

    rows = []
    for el in els:
        tags = el.get("tags", {})
        # A physical stop is usually mapped twice in a route relation: once as
        # role=stop (the point on the carriageway) and once as role=platform
        # (the kerbside waiting area). Both carry the same journey, so dedupe
        # while preserving travel order -- the order IS the corridor topology.
        seen = set()
        stops = []
        for m in el.get("members", []):
            if m.get("type") != "node":
                continue
            if not m.get("role", "").startswith(("stop", "platform", "bus_stop")):
                continue
            ref = m["ref"]
            if ref not in seen:
                seen.add(ref)
                stops.append(ref)
        rows.append({
            "rel_id": str(el["id"]),
            "ref": tags.get("ref"),
            "name": tags.get("name"),
            "network": tags.get("network"),
            "operator": tags.get("operator"),
            "from": tags.get("from"),
            "to": tags.get("to"),
            "n_stop": len(stops),
            "stop_ids": ",".join(str(s) for s in stops),
        })

    df = pd.DataFrame(rows)
    df.to_parquet(out)
    tj = df["network"].astype(str).str.contains("Trans Jogja", case=False, na=False).sum()
    tgm = df["network"].astype(str).str.contains("Trans Gadjah", case=False, na=False).sum()
    print(f"  rute         {len(df):5d} relasi -> {out.name}")
    print(f"    Trans Jogja {tj}, Trans Gadjah Mada {tgm}, "
          f"median {int(df['n_stop'].median())} halte per rute")
    kosong = (df["n_stop"] == 0).sum()
    if kosong:
        print(f"    PERINGATAN {kosong} relasi tanpa anggota halte")


def ingest_krl(force: bool) -> None:
    out = interim("krl_stasiun.parquet")
    if cached(out, force):
        return
    area = _buffered_area(15000)  # nearest station may sit outside the study area
    gdf = ox.features_from_polygon(area, {"railway": ["station", "halt"]})
    gdf = gdf[gdf.geometry.notna()].copy()
    gdf["geometry"] = gdf.geometry.centroid
    keep = [c for c in ("name", "railway", "operator", "network", "usage") if c in gdf.columns]
    gdf = gdf[keep + ["geometry"]].reset_index(drop=True)
    gdf.to_parquet(out)
    names = ", ".join(sorted(str(n) for n in gdf.get("name", pd.Series()).dropna().unique())[:12])
    print(f"  krl_stasiun  {len(gdf):5d} stasiun -> {out.name}")
    print(f"    {names}")


def main(force: bool = False) -> int:
    ingest_halte(force)
    ingest_rute(force)
    ingest_krl(force)
    return 0


if __name__ == "__main__":
    raise SystemExit(main("--force" in sys.argv))
