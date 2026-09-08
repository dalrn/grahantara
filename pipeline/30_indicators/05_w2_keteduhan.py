#!/usr/bin/env python3
"""W2: shade along walking routes, from Sentinel-2 NDVI via Google Earth Engine.

    python pipeline/30_indicators/05_w2_keteduhan.py [--force]

    W2 = mean NDVI in a 15 m buffer along paths, then percentile

The one indicator still needing GEE: MAPID's TUTUPAN LAHAN and URBAN HEAT ISLAND
layers were considered as substitutes, but land cover is categorical (not a
continuous greenness measure) and heat island is an effect of vegetation rather
than vegetation itself. NDVI measures the canopy directly.

NDVI is computed on a cloud-masked median composite over the dry season, so a
single cloudy pass cannot skew a hexagon. Reduced over a 15 m buffer around the
walking network rather than the whole hexagon: shade matters where people walk,
and a hexagon that is half paddy field is not shaded on its footpaths.

Needs EE_PROJECT in .env and a one-time `earthengine authenticate`.

Output: data/interim/w2.parquet
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

import geopandas as gpd
import osmnx as ox
import pandas as pd

from pipeline.common.cache import cached, interim, require_env
from pipeline.common.geo import CRS_UTM49S, CRS_WGS84, hex_polygons
from pipeline.common.paths import hex_index

BUFFER_M = 15
# Dry season: fewer clouds, and canopy that persists then is real shade rather
# than a seasonal rice crop.
MULAI, SELESAI = "2025-04-01", "2025-10-31"
AWAN_MAKS = 40
BATCH = 200


def main(force: bool = False) -> int:
    out_path = interim("w2.parquet")
    if cached(out_path, force):
        return 0

    import ee

    proj = require_env("EE_PROJECT")
    ee.Initialize(project=proj)
    print(f"  GEE siap (project {proj[:6]}...)")

    cells = hex_index()

    # Walking-route buffer, intersected with each hexagon.
    G = ox.load_graphml(interim("walk_graph.graphml"))
    edges = ox.graph_to_gdfs(G, nodes=False, edges=True).to_crs(CRS_UTM49S)
    jalur = edges.geometry.buffer(BUFFER_M).union_all()
    print(f"  buffer jalur {BUFFER_M} m dibangun dari {len(edges):,} ruas")

    heks = hex_polygons(cells, metric=True)
    heks["geometry"] = heks.geometry.intersection(jalur)
    kosong = heks.geometry.is_empty
    print(f"  heksagon tanpa jalur di dalamnya: {int(kosong.sum())}")
    heks = heks[~kosong].to_crs(CRS_WGS84)

    def ndvi_composite():
        col = (ee.ImageCollection("COPERNICUS/S2_SR_HARMONIZED")
               .filterDate(MULAI, SELESAI)
               .filter(ee.Filter.lt("CLOUDY_PIXEL_PERCENTAGE", AWAN_MAKS)))

        def mask(img):
            scl = img.select("SCL")
            # Drop cloud shadow (3), medium/high cloud (8,9), cirrus (10).
            ok = (scl.neq(3).And(scl.neq(8)).And(scl.neq(9)).And(scl.neq(10)))
            return img.updateMask(ok)

        return col.map(mask).median().normalizedDifference(["B8", "B4"]).rename("ndvi")

    ndvi = ndvi_composite()

    hasil = {}
    for i in range(0, len(heks), BATCH):
        chunk = heks.iloc[i:i + BATCH]
        fc = ee.FeatureCollection([
            ee.Feature(ee.Geometry(g.__geo_interface__), {"h3_index": h})
            for h, g in zip(chunk["h3_index"], chunk.geometry)
        ])
        red = ndvi.reduceRegions(collection=fc, reducer=ee.Reducer.mean(), scale=10)
        for f in red.getInfo()["features"]:
            p = f["properties"]
            if p.get("mean") is not None:
                hasil[p["h3_index"]] = p["mean"]
        print(f"    {min(i + BATCH, len(heks))}/{len(heks)} heksagon")

    df = pd.DataFrame({"h3_index": cells})
    df["w2_ndvi"] = df.h3_index.map(hasil)
    df["W2_nilai"] = df["w2_ndvi"]

    df.to_parquet(out_path)

    ada = df.w2_ndvi.notna()
    print(f"  heksagon dengan NDVI: {int(ada.sum())} ({100 * ada.mean():.1f}%)")
    print(f"  tanpa nilai -> tidak_tersedia: {int((~ada).sum())}")
    if ada.any():
        s = df.loc[ada, "w2_ndvi"]
        print(f"  NDVI: min {s.min():.3f}, median {s.median():.3f}, maks {s.max():.3f}")
    print(f"  -> {out_path.name}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main("--force" in sys.argv))
