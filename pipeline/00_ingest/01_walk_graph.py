#!/usr/bin/env python3
"""Download the pedestrian network for the study area.

    python pipeline/00_ingest/01_walk_graph.py [--force]

The graph is downloaded for the study area BUFFERED BY 2 KM, not the study area
itself. Clipping a routing graph to the analysis boundary makes edge hexagons
look unreachable: a real walking route is allowed to leave the boundary and come
back, and if the graph stops at the edge, Dijkstra reports no path where a
walker would simply carry on down the road.

Output: data/interim/walk_graph.graphml (WGS84, as OSMnx writes it)
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

import osmnx as ox

from pipeline.common.cache import cached, interim
from pipeline.common.geo import CRS_UTM49S, CRS_WGS84
from pipeline.common.paths import study_area

BUFFER_M = 2000


def main(force: bool = False) -> int:
    out = interim("walk_graph.graphml")
    if cached(out, force):
        return 0

    import geopandas as gpd

    area = study_area()
    buffered = (
        gpd.GeoSeries([area], crs=CRS_WGS84)
        .to_crs(CRS_UTM49S)
        .buffer(BUFFER_M)
        .to_crs(CRS_WGS84)
        .iloc[0]
    )
    print(f"  wilayah studi   {area.bounds}")
    print(f"  + buffer {BUFFER_M} m  {buffered.bounds}")

    print("  mengunduh jaringan pejalan kaki dari OSM (bisa beberapa menit)...")
    G = ox.graph_from_polygon(
        buffered,
        network_type="walk",
        simplify=True,
        retain_all=False,      # drop disconnected islands; they cannot be walked to
        truncate_by_edge=True, # keep edges that cross the boundary
    )
    print(f"  simpul {G.number_of_nodes():,}  ruas {G.number_of_edges():,}")

    ox.save_graphml(G, out)
    print(f"  -> {out}  ({out.stat().st_size / 1e6:.1f} MB)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main("--force" in sys.argv))
