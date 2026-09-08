#!/usr/bin/env python3
"""A1: kos rent, reported ONLY where it was actually surveyed.

    python pipeline/30_indicators/06_a1_harga_kos.py [--force]

    A1 = 1 - persentil(median harga)     cheaper is better

WHY THERE IS NO MODEL HERE.

The dictionary anticipated A1 being modelled from secondary data. That was
tested and rejected on evidence, not preference. With 29 price labels, every
model scored WORSE than guessing the mean (leave-one-out):

    guess the mean          R2  0.000    MAE Rp 259,067
    Ridge, 9 features       R2 -0.386    MAE Rp 297,467
    RandomForest            R2 -0.152    MAE Rp 284,665
    survey-area median      R2 -0.045    MAE Rp 252,635

A negative R2 means the model is actively worse than a constant. The reason is
structural and no feature set fixes it: 45% of price variance occurs BETWEEN KOS
ON THE SAME STREET. In KWS-06 prices run Rp 350k to Rp 1.2M within one survey
area. That is room size, private vs shared bathroom, building age -- none of it
spatial. The ceiling for any location-based predictor is about 55%, and the best
single correlate we have (food density) reaches r = 0.30.

So A1 reports measured prices where they exist and tidak_tersedia elsewhere,
exactly as W4 does for flood hazard. That matches the PRD, which says
Affordability "bertumpu pada harga hasil survei lapangan".

RADIUS. 500 m, not the 800 m used by the amenity indicators. Rationale:

  * The surveyor-measured kos-to-halte distance has median 220 m and p75 500 m,
    so 500 m is the distance a student actually treats as "here".
  * A price is a point observation about one building, not a field like light or
    greenery. Amenity can honestly use 800 m because "is there a warung within a
    walk" stays true across that span; "rent here is Rp 700k" does not.
  * Widening the radius mixes wider price ranges into one hexagon: the median
    spread between kos inside one hexagon grows from Rp 350k at 500 m to
    Rp 450k at 800 m and Rp 550k at 1,500 m. Coverage bought that way is
    coverage of a number that means less.
  * A leave-one-out test of whether nearby kos predict a held-out kos gave
    R2 between +0.14 and -0.24 with no trend across radii -- noise at this n.
    Since the data cannot choose the radius, the conservative choice wins.

500 m covers 153 hexagons (7.2%). 800 m would cover 310 (14.5%). The smaller,
more defensible number is preferred: an honest gap beats a vague figure.

Output: data/interim/a1.parquet
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

import geopandas as gpd
import h3
import pandas as pd

from pipeline.common.cache import cached, interim
from pipeline.common.geo import CRS_UTM49S, CRS_WGS84, hex_centroids
from pipeline.common.paths import ROOT, hex_index

RADIUS_M = 500
KOORDINAT = ROOT / "kos_koordinat_untuk_dicek.csv"


def main(force: bool = False) -> int:
    out_path = interim("a1.parquet")
    if cached(out_path, force):
        return 0

    kos = pd.read_parquet(interim("survei_kos.parquet"))[
        ["ID", "Kawasan", "Harga median (Rp)"]]
    koord = pd.read_csv(KOORDINAT, encoding="utf-8-sig")[
        ["ID", "lat", "lon", "presisi"]]
    df = kos.merge(koord, on="ID", how="left")

    berharga = df[df["Harga median (Rp)"].notna() & df.lat.notna()].copy()
    print(f"  kos berharga dan berkoordinat: {len(berharga)} dari {len(df)}")
    print(f"    presisi: {dict(berharga.presisi.value_counts())}")

    cells = hex_index()
    kos_cell = [h3.latlng_to_cell(la, lo, 9)
                for la, lo in zip(berharga.lat, berharga.lon)]
    berharga["h3"] = kos_cell
    luar = ~berharga.h3.isin(set(cells))
    if luar.any():
        # Mulia Sari sits ~250 m west of the boundary; it cannot attach to any
        # hexagon, so it is excluded rather than snapped to a nearby one.
        print(f"    di luar wilayah studi, dikeluarkan: {list(berharga.loc[luar, 'ID'])}")
        berharga = berharga[~luar]

    pts = gpd.GeoDataFrame(
        berharga,
        geometry=gpd.points_from_xy(berharga.lon, berharga.lat),
        crs=CRS_WGS84).to_crs(CRS_UTM49S)

    zona = hex_centroids(cells, metric=True)
    zona["geometry"] = zona.geometry.buffer(RADIUS_M)

    hit = gpd.sjoin(zona, pts[["geometry", "Harga median (Rp)", "ID"]],
                    how="inner", predicate="intersects")
    agg = hit.groupby("h3_index").agg(
        a1_harga=("Harga median (Rp)", "median"),
        a1_n_kos=("ID", "count"))

    out = pd.DataFrame({"h3_index": cells})
    out["a1_harga_rp"] = out.h3_index.map(agg["a1_harga"])
    out["a1_n_kos"] = out.h3_index.map(agg["a1_n_kos"]).fillna(0).astype(int)
    # Cheaper is better, so the indicator inverts the price. The percentile is
    # applied later in 40_score against the pool of hexagons that HAVE a price.
    out["A1_nilai"] = -out["a1_harga_rp"]

    out.to_parquet(out_path)

    ada = out.a1_harga_rp.notna()
    print(f"  radius {RADIUS_M} m")
    print(f"  heksagon dengan harga terukur: {int(ada.sum())} "
          f"({100 * ada.mean():.1f}%)")
    print(f"  tidak_tersedia: {int((~ada).sum())}")
    if ada.any():
        s = out.loc[ada, "a1_harga_rp"]
        print(f"  harga: min Rp{s.min():,.0f}  median Rp{s.median():,.0f}  "
              f"maks Rp{s.max():,.0f}")
        print(f"  kos per heksagon: median {out.loc[ada, 'a1_n_kos'].median():.0f}, "
              f"maks {out.a1_n_kos.max()}")
    print(f"  -> {out_path.name}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main("--force" in sys.argv))
