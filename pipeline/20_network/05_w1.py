#!/usr/bin/env python3
"""W1: pedestrian intersection density per hexagon.

    python pipeline/20_network/05_w1.py [--force]

A dense mesh of junctions means short blocks, many route choices and frequent
safe crossing points -- the structural signature of a walkable street network.
A sparse mesh means long detours and arterial dependence.

Counts only true intersections: graph nodes with 3 or more distinct street
neighbours. Degree-2 nodes are geometry vertices where a road bends, not
junctions, and degree-1 nodes are cul-de-sac ends. Both are excluded, so the
measure is not inflated by how finely a road happens to be drawn in OSM.

Density is per km^2. An H3 resolution 9 cell is ~0.105 km^2, so a hexagon with
10 junctions scores about 95/km^2.

Output: data/interim/w1.parquet
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

import geopandas as gpd
import h3
import osmnx as ox
import pandas as pd

from pipeline.common.cache import cached, interim
from pipeline.common.geo import CRS_UTM49S, CRS_WGS84, hex_polygons
from pipeline.common.paths import hex_index

MIN_DEGREE = 3


def main(force: bool = False) -> int:
    out_path = interim("w1.parquet")
    if cached(out_path, force):
        return 0

    G = ox.load_graphml(interim("walk_graph.graphml"))

    # Undirected degree: a two-way street is one connection, not two.
    Und = G.to_undirected()
    inter = [n for n, deg in Und.degree() if deg >= MIN_DEGREE]
    print(f"  {Und.number_of_nodes():,} simpul -> {len(inter):,} simpang "
          f"(derajat >= {MIN_DEGREE})")

    pts = gpd.GeoDataFrame(
        {"node": inter},
        geometry=gpd.points_from_xy([Und.nodes[n]["x"] for n in inter],
                                    [Und.nodes[n]["y"] for n in inter]),
        crs=CRS_WGS84)

    # Assign each junction to its H3 cell directly; far cheaper than a spatial
    # join against 2,134 polygons and exactly equivalent.
    pts["h3_index"] = [h3.latlng_to_cell(p.y, p.x, 9) for p in pts.geometry]
    counts = pts.groupby("h3_index").size()

    cells = hex_index()
    areas = {c: h3.cell_area(c, unit="km^2") for c in cells}
    df = pd.DataFrame({"h3_index": cells})
    df["n_simpang"] = df["h3_index"].map(counts).fillna(0).astype(int)
    df["luas_km2"] = df["h3_index"].map(areas)
    df["W1_nilai"] = (df["n_simpang"] / df["luas_km2"]).round(2)
    df = df.drop(columns=["luas_km2"])
    df.to_parquet(out_path)

    print(f"  simpang per heksagon: median {df.n_simpang.median():.0f}, "
          f"maks {df.n_simpang.max()}")
    print(f"  kerapatan per km2:    median {df.W1_nilai.median():.1f}, "
          f"p90 {df.W1_nilai.quantile(.9):.1f}, maks {df.W1_nilai.max():.1f}")
    print(f"  heksagon tanpa simpang: {(df.n_simpang == 0).sum()} "
          f"({100 * (df.n_simpang == 0).mean():.1f}%)")
    print(f"  -> {out_path.name}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main("--force" in sys.argv))
