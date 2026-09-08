#!/usr/bin/env python3
"""M1, M2, M4 -- the Amenity dimension, from MAPID premium POI.

    python pipeline/30_indicators/01_amenity.py [--force]

M1 kepadatan tempat makan  count of eating places in the hexagon, 1-exp(-n/5)
M2 keragaman kuliner       normalised Shannon entropy over TIPE_2 categories
M4 layanan harian          k/3 over apotek, minimarket, warung within 800 m
M3 keramaian               NOT computed here; survey covers 12 points only

Which layer feeds which indicator matters, because the MAPID layers nest inside
one another. Verified by matching name+coordinates, not assumed:

  * APOTEK (425) is entirely inside KESEHATAN DAN PENGOBATAN (1,250), so M4
    uses APOTEK alone.
  * TOKO MAKANAN DAN MINUMAN (1,603) is entirely inside PERDAGANGAN DAN RETAIL
    (8,208).
  * MINIMARKET (351) contains every brand -- Indomaret 178, Alfamart 60,
    Circle K 20 -- so the brand layers must never be added on top.
  * TOKO KELONTONG (1,136) is NOT inside retail (1 point overlaps), so it is an
    independent layer and the closest match to the dictionary's "warung".

M1/M2 use eating PLACES only (makanan_minuman). Food SHOPS
(toko_makanan_minuman) belong to M4's daily-needs sense instead: a student
looking for lunch is not served by a grocery.

Output: data/interim/amenity.parquet
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

import geopandas as gpd
import h3
import numpy as np
import pandas as pd

from pipeline.common.cache import cached, interim
from pipeline.common.geo import CRS_UTM49S, CRS_WGS84, hex_centroids
from pipeline.common.paths import DATA_RAW, hex_index

MAPID = DATA_RAW / "mapid"
LAYANAN_RADIUS_M = 800   # docs/DATA_DICTIONARY.md: "kategori layanan <=800 m"
MAKAN_RADIUS_M = 800     # M1/M2 walking radius; see the note where it is used
M1_SKALA = 5.0           # 1 - exp(-n/5)


def _load(name: str) -> gpd.GeoDataFrame:
    gdf = gpd.read_file(MAPID / name)
    if gdf.crs is None:
        gdf = gdf.set_crs(CRS_WGS84)
    gdf = gdf.to_crs(CRS_WGS84)
    gdf = gdf[gdf.geometry.notna()].copy()
    # A few layers ship MultiPoint; collapse to a representative point.
    gdf["geometry"] = gdf.geometry.apply(
        lambda g: g if g.geom_type == "Point" else g.centroid)
    gdf["h3_index"] = [h3.latlng_to_cell(p.y, p.x, 9) for p in gdf.geometry]
    return gdf


def _shannon(series: pd.Series) -> float:
    """Shannon entropy over category counts, normalised to [0,1].

    Normalised by log(k) where k is the number of categories PRESENT in that
    hexagon, so a hexagon with two evenly-split categories scores 1.0. A single
    category scores 0 -- no diversity. Empty returns NaN, never 0, because "no
    eating places" is not "no variety".
    """
    counts = series.value_counts()
    if len(counts) == 0:
        return np.nan
    if len(counts) == 1:
        return 0.0
    p = counts / counts.sum()
    return float(-(p * np.log(p)).sum() / np.log(len(counts)))


def main(force: bool = False) -> int:
    out_path = interim("amenity.parquet")
    if cached(out_path, force):
        return 0

    cells = hex_index()
    df = pd.DataFrame({"h3_index": cells})

    # ---- M1 and M2: eating places within walking distance ------------------
    # Counted within MAKAN_RADIUS_M of the hexagon centre, NOT strictly inside
    # the hexagon. A res-9 cell is only ~380 m across, so a warung 200 m past
    # the boundary is a five-minute walk yet would count as zero -- that
    # measures the grid, not the neighbourhood. Counting inside-only gave 75%
    # zeros; at 800 m it is 25%. Same radius as M4 and C3's walk budget.
    makan = _load("makanan_minuman_2025.geojson")
    in_area = makan[makan.h3_index.isin(set(cells))]
    print(f"  tempat makan {len(makan):5d} total, {len(in_area):5d} di wilayah studi")
    print(f"    kategori TIPE_2: {dict(in_area['TIPE_2'].value_counts())}")

    pusat = hex_centroids(cells, metric=True).set_index("h3_index")
    zona = pusat.copy()
    zona["geometry"] = zona.geometry.buffer(MAKAN_RADIUS_M)
    zona = zona.reset_index()

    makan_m = makan.to_crs(CRS_UTM49S)[["geometry", "TIPE_2"]]
    dekat = gpd.sjoin(zona, makan_m, how="inner", predicate="intersects")

    m1 = dekat.groupby("h3_index").size()
    df["m1_n"] = df.h3_index.map(m1).fillna(0).astype(int)
    df["M1_nilai"] = 1.0 - np.exp(-df.m1_n / M1_SKALA)

    m2 = dekat.groupby("h3_index")["TIPE_2"].apply(_shannon)
    df["M2_nilai"] = df.h3_index.map(m2)
    # No eating places within reach means there is no variety to measure. That
    # is tidak_tersedia, not zero -- writing 0 would claim we looked and found
    # uniformity, when in fact there was nothing to look at.
    df.loc[df.m1_n == 0, "M2_nilai"] = np.nan

    # ---- M4: daily services within walking distance ------------------------
    # Three categories from docs/DATA_DICTIONARY.md: apotek, minimarket, warung.
    kategori = {
        "apotek": _load("apotek_2025.geojson"),
        "minimarket": _load("minimarket_2025.geojson"),
        "warung": _load("toko_kelontong_2025.geojson"),
    }
    for nama, gdf in kategori.items():
        print(f"  {nama:11s} {len(gdf):5d} total, "
              f"{len(gdf[gdf.h3_index.isin(set(cells))]):5d} di wilayah studi")

    # Reuses the same 800 m zones built for M1/M2 above. The dictionary says
    # k/3 over categories PRESENT, not a count of shops.
    hadir = pd.DataFrame({"h3_index": cells}).set_index("h3_index")
    for nama, gdf in kategori.items():
        pts = gdf.to_crs(CRS_UTM49S)[["geometry"]].copy()
        hit = gpd.sjoin(zona, pts, how="inner", predicate="intersects")
        punya = set(hit["h3_index"])
        hadir[nama] = [c in punya for c in hadir.index]
        print(f"    heksagon dengan {nama:11s} <= {LAYANAN_RADIUS_M} m: {len(punya):5d}")

    df["m4_k"] = hadir[list(kategori)].sum(axis=1).values
    df["M4_nilai"] = df.m4_k / 3.0

    df.to_parquet(out_path)

    print()
    print(f"  M1 tempat makan/heksagon: median {df.m1_n.median():.0f}, "
          f"maks {df.m1_n.max()}, nol di {int((df.m1_n == 0).sum())} heksagon")
    print(f"  M2 keragaman: terisi {int(df.M2_nilai.notna().sum())}, "
          f"kosong {int(df.M2_nilai.isna().sum())} (tidak ada tempat makan)")
    print(f"  M4 kategori hadir: {dict(df.m4_k.value_counts().sort_index())}")
    print(f"  -> {out_path.name}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main("--force" in sys.argv))
