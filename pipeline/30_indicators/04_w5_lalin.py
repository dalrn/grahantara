#!/usr/bin/env python3
"""W5: traffic pressure on pedestrians, from OSM road class calibrated to survey.

    python pipeline/30_indicators/04_w5_lalin.py [--force]

    W5 = 1 - tekanan          higher is calmer, safer to walk

The pattern the dictionary calls for: field survey does not supply the value
directly (84 segments cannot cover 2,134 hexagons), it CALIBRATES a rule applied
to secondary data that does cover everything.

Calibration evidence from the 84 surveyed segments:

    Jenis jalan  | Ramai  Sedang  Sepi      median width
    Gang         |     0       0    20          ~3 m
    Jalan kecil  |     1       8    15          5.25 m
    Jalan raya   |    30      10     0         10.50 m

Road type predicts traffic density almost perfectly: every gang is quiet, and
30 of 31 busy segments are jalan raya. Width separates the classes cleanly too
(3.8 / 6.9 / 13.4 m mean). So OSM highway class, which covers the whole area, is
a sound proxy for the surveyed density.

OSM class -> survey road type -> pressure:

    trunk, primary            jalan raya, busiest      1.00
    secondary                 jalan raya               0.85
    tertiary                  jalan raya / kecil       0.60
    unclassified, residential jalan kecil              0.35
    living_street, service    gang                     0.15
    footway, path, pedestrian pedestrian only          0.00

Each hexagon takes the LENGTH-WEIGHTED mean pressure of the road inside it, so a
cell with one arterial edge and many quiet lanes is not judged by the arterial
alone -- but a cell that is mostly arterial is.

Output: data/interim/w5.parquet
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

import geopandas as gpd
import osmnx as ox
import pandas as pd

from pipeline.common.cache import cached, interim
from pipeline.common.geo import CRS_UTM49S, hex_polygons
from pipeline.common.paths import hex_index

TEKANAN = {
    "trunk": 1.00, "trunk_link": 1.00,
    "primary": 1.00, "primary_link": 1.00,
    "secondary": 0.85, "secondary_link": 0.85,
    "tertiary": 0.60, "tertiary_link": 0.60,
    "unclassified": 0.35,
    "residential": 0.35,
    "living_street": 0.15,
    "service": 0.15,
    "track": 0.15,
    "footway": 0.00, "path": 0.00, "pedestrian": 0.00,
    "steps": 0.00, "corridor": 0.00,
}


def main(force: bool = False) -> int:
    out_path = interim("w5.parquet")
    if cached(out_path, force):
        return 0

    cells = hex_index()
    G = ox.load_graphml(interim("walk_graph.graphml"))
    edges = ox.graph_to_gdfs(G, nodes=False, edges=True).to_crs(CRS_UTM49S)

    def kelas(hw):
        if isinstance(hw, list):
            # A way carrying several classes takes the busiest, which is the
            # conservative reading for pedestrian pressure.
            return max((TEKANAN.get(h) for h in hw if h in TEKANAN),
                       default=None)
        return TEKANAN.get(hw)

    edges["tekanan"] = edges["highway"].apply(kelas)
    tak_dikenal = edges.loc[edges.tekanan.isna(), "highway"]
    if len(tak_dikenal):
        print(f"  PERINGATAN {len(tak_dikenal)} ruas kelas tak dikenal, dilewati: "
              f"{set(map(str, tak_dikenal.unique()))}")
    edges = edges[edges.tekanan.notna()].copy()
    edges["panjang"] = edges.geometry.length
    print(f"  ruas jalan dipakai: {len(edges):,}")

    heks = hex_polygons(cells, metric=True)
    potong = gpd.overlay(heks, edges[["tekanan", "geometry"]], how="intersection",
                        keep_geom_type=False)
    potong = potong[potong.geometry.geom_type.isin(["LineString", "MultiLineString"])]
    potong["panjang"] = potong.geometry.length
    potong["tertimbang"] = potong["tekanan"] * potong["panjang"]

    agg = potong.groupby("h3_index").agg(
        bobot=("tertimbang", "sum"), panjang=("panjang", "sum"))
    agg["tekanan"] = agg.bobot / agg.panjang

    df = pd.DataFrame({"h3_index": cells})
    df["w5_tekanan"] = df.h3_index.map(agg["tekanan"])
    df["w5_panjang_jalan_m"] = df.h3_index.map(agg["panjang"]).fillna(0.0)
    # Higher pressure is worse to walk beside, so the indicator is its inverse.
    df["W5_nilai"] = 1.0 - df["w5_tekanan"]

    df.to_parquet(out_path)

    ada = df.w5_tekanan.notna()
    print(f"  heksagon dengan jalan: {int(ada.sum())} ({100 * ada.mean():.1f}%)")
    print(f"  tanpa jalan sama sekali -> tidak_tersedia: {int((~ada).sum())}")
    if ada.any():
        s = df.loc[ada, "w5_tekanan"]
        print(f"  tekanan: min {s.min():.2f}, median {s.median():.2f}, maks {s.max():.2f}")
        print(f"  W5:      min {(1-s).max():.2f} (terbaik) .. {(1-s).min():.2f} (terburuk)")
    print(f"  -> {out_path.name}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main("--force" in sys.argv))
