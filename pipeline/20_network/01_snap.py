#!/usr/bin/env python3
"""Snap hexagons, stops, stations and campus gates onto the walk graph.

    python pipeline/20_network/01_snap.py [--force]

Every later step routes between graph NODES, so each point of interest has to be
bound to one node exactly once. Doing it here means the expensive nearest-node
search runs a single time and every indicator agrees on which node represents
a given hexagon.

Output: data/interim/snap.parquet -- one row per point, with its node id and the
distance from the true position to that node.
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

import geopandas as gpd
import osmnx as ox
import pandas as pd

from pipeline.common.cache import cached, interim
from pipeline.common.geo import CRS_UTM49S, CRS_WGS84, hex_centroids
from pipeline.common.paths import REFERENCE, hex_index


def _snap(G, gdf: gpd.GeoDataFrame, kind: str) -> pd.DataFrame:
    g = gdf.to_crs(CRS_UTM49S)
    nodes, dist = ox.nearest_nodes(G, g.geometry.x, g.geometry.y, return_dist=True)
    out = pd.DataFrame({
        "kind": kind,
        "key": g["key"].astype(str).values,
        "node": nodes,
        "snap_m": [round(float(d), 1) for d in dist],
    })
    print(f"  {kind:8s} {len(out):5d} titik  snap median {out.snap_m.median():6.1f} m  "
          f"maks {out.snap_m.max():7.1f} m")
    return out


def main(force: bool = False) -> int:
    out_path = interim("snap.parquet")
    if cached(out_path, force):
        return 0

    print("  memuat graf...")
    G = ox.project_graph(ox.load_graphml(interim("walk_graph.graphml")),
                         to_crs=CRS_UTM49S)

    frames = []

    cells = hex_index()
    hexc = hex_centroids(cells)
    hexc["key"] = hexc["h3_index"]
    frames.append(_snap(G, hexc, "hexagon"))

    halte = gpd.read_parquet(interim("halte_rute.parquet"))
    halte["key"] = halte["osm_id"].astype(str)
    frames.append(_snap(G, halte, "halte"))

    krl = gpd.read_parquet(interim("krl_stasiun.parquet"))
    krl = krl.reset_index(drop=True)
    krl["key"] = krl.index.astype(str)
    frames.append(_snap(G, krl, "krl"))

    gates = gpd.read_file(REFERENCE / "kampus_gerbang_10.geojson")
    # Deduplicate on (osm_node, kampus): two nodes legitimately serve both UGM
    # and UNY on their shared boundary, and dropping either would remove a real
    # entrance for one of those campuses.
    gates = gates.drop_duplicates(subset=["osm_node", "kampus"]).reset_index(drop=True)
    gates["key"] = gates["kampus"] + "|" + gates["osm_node"].astype(str)
    frames.append(_snap(G, gates, "gerbang"))

    snap = pd.concat(frames, ignore_index=True)
    snap.to_parquet(out_path)
    print(f"  -> {out_path.name}  ({len(snap)} baris)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main("--force" in sys.argv))
