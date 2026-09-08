#!/usr/bin/env python3
"""W4: safety from flooding, from the MAPID flood hazard layer.

    python pipeline/30_indicators/02_w4_banjir.py [--force]

    W4 = 1 - indeks bahaya          (docs/DATA_DICTIONARY.md)

Uses WILAYAH BAHAYA ATAU TERANCAM BANJIR rather than WILAYAH RISIKO BANJIR:
five hazard classes instead of three, and twice the coverage inside the study
area (248 vs 118 polygons). The dictionary defines W4 in terms of an "indeks
BAHAYA", and this is the hazard layer. This replaces InaRISK, so the whole
indicator now rests on official competition data.

Hazard is area-weighted where a hexagon straddles several polygons, so a cell
half in a high-hazard zone lands between the two classes rather than taking
whichever polygon happens to contain its centre.

A hexagon touching NO hazard polygon is NOT scored 0 hazard. The layer maps
flood-prone areas, not the whole regency, so absence means "not mapped as
flood-prone", which is unknown rather than safe. Those become tidak_tersedia
and the weight renormalises within Walkability.

Output: data/interim/w4.parquet
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

import geopandas as gpd
import numpy as np
import pandas as pd

from pipeline.common.cache import cached, interim
from pipeline.common.geo import CRS_UTM49S, CRS_WGS84, hex_polygons
from pipeline.common.paths import DATA_RAW, hex_index

LAYER = DATA_RAW / "mapid" / "bahaya_banjir.geojson"

# Five ordinal classes -> hazard index in [0,1].
KELAS = {
    "Sangat Rendah": 0.0,
    "Cukup Rendah": 0.25,
    "Sedang": 0.50,
    "Cukup Tinggi": 0.75,
    "Tinggi": 1.0,
}


def main(force: bool = False) -> int:
    out_path = interim("w4.parquet")
    if cached(out_path, force):
        return 0

    cells = hex_index()
    bahaya = gpd.read_file(LAYER)
    if bahaya.crs is None:
        bahaya = bahaya.set_crs(CRS_WGS84)
    bahaya = bahaya.to_crs(CRS_UTM49S)

    tak_dikenal = set(bahaya["Kelas"].dropna().unique()) - set(KELAS)
    if tak_dikenal:
        raise SystemExit(f"kelas bahaya tidak dikenal: {tak_dikenal}")
    bahaya["indeks"] = bahaya["Kelas"].map(KELAS)
    bahaya = bahaya[bahaya.indeks.notna()][["indeks", "geometry"]]
    print(f"  poligon bahaya {len(bahaya)}")

    heks = hex_polygons(cells, metric=True)

    # Intersect, then weight each hazard class by the area it covers.
    potong = gpd.overlay(heks, bahaya, how="intersection", keep_geom_type=True)
    potong["luas"] = potong.geometry.area
    potong["tertimbang"] = potong["indeks"] * potong["luas"]
    agg = potong.groupby("h3_index").agg(
        bobot=("tertimbang", "sum"), luas=("luas", "sum"))
    agg["indeks_bahaya"] = agg.bobot / agg.luas

    df = pd.DataFrame({"h3_index": cells})
    df["w4_indeks_bahaya"] = df.h3_index.map(agg["indeks_bahaya"])
    df["w4_luas_terpetakan_m2"] = df.h3_index.map(agg["luas"]).fillna(0.0)
    df["W4_nilai"] = 1.0 - df["w4_indeks_bahaya"]

    df.to_parquet(out_path)

    ada = df.w4_indeks_bahaya.notna()
    print(f"  heksagon bersinggungan dengan peta bahaya: {int(ada.sum())} "
          f"({100 * ada.mean():.1f}%)")
    print(f"  tidak terpetakan -> tidak_tersedia: {int((~ada).sum())}")
    if ada.any():
        s = df.loc[ada, "w4_indeks_bahaya"]
        print(f"  indeks bahaya: min {s.min():.2f}, median {s.median():.2f}, "
              f"maks {s.max():.2f}")
        print(f"  W4 nilai:      min {(1-s).min():.2f}, median {(1-s).median():.2f}, "
              f"maks {(1-s).max():.2f}")
    print(f"  -> {out_path.name}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main("--force" in sys.argv))
