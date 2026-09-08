#!/usr/bin/env python3
"""C1 (walk distance to nearest halte) and C4 (to nearest KRL station).

    python pipeline/20_network/02_c1_c4.py [--force]

Both are network distances over the pedestrian graph, never straight lines. That
distinction is the product thesis: a halte 100 m away as the crow flies but on
the far side of a ring road is not 100 m away on foot.

Computed with a single multi-source Dijkstra per target set rather than one
search per hexagon. Adding a virtual source joined to every halte at zero cost
makes one search return the distance from every node to its nearest halte --
2,134 separate searches collapse into one.

Transforms, per docs/DATA_DICTIONARY.md:
    C1 = exp(-d/400)     C4 = exp(-d/800)

Output: data/interim/c1_c4.parquet
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

import networkx as nx
import numpy as np
import osmnx as ox
import pandas as pd

from pipeline.common.cache import cached, interim
from pipeline.common.geo import CRS_UTM49S
from pipeline.common.paths import hex_index

VIRTUAL = "__src__"


def multi_source_dist(G, targets: set) -> dict:
    """Shortest walk distance from every node to its nearest target node."""
    H = nx.DiGraph()
    # Reverse the graph: we want distance TO a target, and the walk graph is
    # very nearly symmetric, but reversing keeps it correct where it is not.
    for u, v, data in G.edges(data=True):
        w = float(data.get("length", 0.0))
        if H.has_edge(v, u):
            if w < H[v][u]["length"]:
                H[v][u]["length"] = w
        else:
            H.add_edge(v, u, length=w)
    for t in targets:
        if t in H or t in G:
            H.add_edge(VIRTUAL, t, length=0.0)
    return nx.single_source_dijkstra_path_length(H, VIRTUAL, weight="length")


def main(force: bool = False) -> int:
    out_path = interim("c1_c4.parquet")
    if cached(out_path, force):
        return 0

    G = ox.project_graph(ox.load_graphml(interim("walk_graph.graphml")),
                         to_crs=CRS_UTM49S)
    snap = pd.read_parquet(interim("snap.parquet"))

    hexes = snap[snap.kind == "hexagon"].set_index("key")
    halte_nodes = set(snap.loc[snap.kind == "halte", "node"])
    krl_nodes = set(snap.loc[snap.kind == "krl", "node"])
    print(f"  {len(hexes)} heksagon, {len(halte_nodes)} simpul halte, "
          f"{len(krl_nodes)} simpul stasiun")

    print("  Dijkstra multi-sumber ke halte...")
    d_halte = multi_source_dist(G, halte_nodes)
    print("  Dijkstra multi-sumber ke stasiun KRL...")
    d_krl = multi_source_dist(G, krl_nodes)

    cells = hex_index()
    rows = []
    for h3 in cells:
        node = hexes.at[h3, "node"]
        snap_m = float(hexes.at[h3, "snap_m"])
        # Add the snap distance: the walker starts at the hexagon centre, not at
        # the graph node it happens to be nearest to.
        dh = d_halte.get(node)
        dk = d_krl.get(node)
        rows.append({
            "h3_index": h3,
            "c1_jarak_m": None if dh is None else round(dh + snap_m, 1),
            "c4_jarak_m": None if dk is None else round(dk + snap_m, 1),
        })

    df = pd.DataFrame(rows)
    df["C1_nilai"] = np.exp(-df["c1_jarak_m"] / 400.0)
    df["C4_nilai"] = np.exp(-df["c4_jarak_m"] / 800.0)
    df.to_parquet(out_path)

    for col, lbl in (("c1_jarak_m", "C1 jarak halte"), ("c4_jarak_m", "C4 jarak KRL")):
        s = df[col].dropna()
        print(f"  {lbl:16s} median {s.median():8.0f} m   p90 {s.quantile(.9):8.0f} m   "
              f"maks {s.max():8.0f} m   kosong {df[col].isna().sum()}")
    print(f"  heksagon dengan halte <=400 m: {(df.c1_jarak_m <= 400).sum()}")
    print(f"  heksagon dengan halte <=800 m: {(df.c1_jarak_m <= 800).sum()}")
    print(f"  -> {out_path.name}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main("--force" in sys.argv))
