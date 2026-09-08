#!/usr/bin/env python3
"""C2: number of distinct Trans Jogja corridors reachable on foot within 400 m.

    python pipeline/20_network/03_c2.py [--force]

Distinct CORRIDORS, not stops. Three stops served by the same corridor offer one
journey, not three, and C2 is meant to measure choice of destination.

Uses a cutoff Dijkstra from each halte node outward (457 searches bounded at
400 m) rather than from each hexagon, because bounded searches from the smaller
set are far cheaper and the relation is symmetric.

    C2 = 1 - exp(-r/2)     where r = number of distinct corridors

Output: data/interim/c2.parquet
"""
import sys
from collections import defaultdict
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

import geopandas as gpd
import networkx as nx
import numpy as np
import osmnx as ox
import pandas as pd

from pipeline.common.cache import cached, interim
from pipeline.common.geo import CRS_UTM49S
from pipeline.common.paths import hex_index

RADIUS_M = 400


def main(force: bool = False) -> int:
    out_path = interim("c2.parquet")
    if cached(out_path, force):
        return 0

    G = ox.project_graph(ox.load_graphml(interim("walk_graph.graphml")),
                         to_crs=CRS_UTM49S)
    snap = pd.read_parquet(interim("snap.parquet"))
    halte = gpd.read_parquet(interim("halte_rute.parquet"))

    # node -> set of corridors served by any stop snapped to that node
    node_koridor: dict[int, set[str]] = defaultdict(set)
    key_to_node = dict(zip(snap.loc[snap.kind == "halte", "key"],
                           snap.loc[snap.kind == "halte", "node"]))
    for _, r in halte.iterrows():
        if not r["koridor"]:
            continue
        node = key_to_node.get(str(r["osm_id"]))
        if node is not None:
            node_koridor[node].update(r["koridor"].split(","))

    print(f"  {len(node_koridor)} simpul halte membawa koridor diketahui")

    # Undirected view: walking 400 m is symmetric.
    U = nx.Graph()
    for u, v, data in G.edges(data=True):
        w = float(data.get("length", 0.0))
        if U.has_edge(u, v):
            if w < U[u][v]["length"]:
                U[u][v]["length"] = w
        else:
            U.add_edge(u, v, length=w)

    # For each halte node, every graph node within 400 m gains its corridors.
    reach: dict[int, set[str]] = defaultdict(set)
    for i, (hn, kor) in enumerate(node_koridor.items(), 1):
        if hn not in U:
            continue
        seen = nx.single_source_dijkstra_path_length(U, hn, cutoff=RADIUS_M,
                                                     weight="length")
        for n in seen:
            reach[n].update(kor)
        if i % 100 == 0:
            print(f"    {i}/{len(node_koridor)} halte diproses")

    hexes = snap[snap.kind == "hexagon"].set_index("key")
    rows = []
    for h3 in hex_index():
        node = hexes.at[h3, "node"]
        snap_m = float(hexes.at[h3, "snap_m"])
        # A hexagon whose centre is already further than the radius from its own
        # graph node cannot honestly claim stops found at that node.
        kor = reach.get(node, set()) if snap_m <= RADIUS_M else set()
        rows.append({"h3_index": h3, "c2_rute": len(kor),
                     "c2_koridor": ",".join(sorted(kor))})

    df = pd.DataFrame(rows)
    df["C2_nilai"] = 1.0 - np.exp(-df["c2_rute"] / 2.0)
    df.to_parquet(out_path)

    print(f"  rute unik per heksagon: median {df.c2_rute.median():.0f}, "
          f"maks {df.c2_rute.max()}")
    print(f"  heksagon tanpa rute dalam {RADIUS_M} m: {(df.c2_rute == 0).sum()} "
          f"({100*(df.c2_rute==0).mean():.1f}%)")
    print(f"  -> {out_path.name}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main("--force" in sys.argv))
