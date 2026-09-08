#!/usr/bin/env python3
"""W3: night-time lighting, from the MAPID nighttime light layer.

    python pipeline/30_indicators/03_w3_penerangan.py [--force]

    W3 = log(1 + radiance), then percentile   (docs/DATA_DICTIONARY.md)

Uses MAPID's NIGHTTIME LIGHT 2023 instead of pulling VIIRS through Google Earth
Engine. Same underlying sensor, already clipped to Sleman and classified, and it
keeps the indicator on official competition data -- one less external
dependency, and one less thing that can silently change between runs.

The layer is classified rather than continuous: five DN classes, each carrying
an intensity RANGE in nW/sr/cm2. Radiance is estimated as the midpoint of each
range. The top class is open-ended (>=20), so it gets a representative value
rather than a midpoint; because everything is finally converted to a percentile
rank, only the ORDER of these values matters, not their exact magnitude.

Area-weighted where a hexagon straddles several classes.

Lighting is a proxy for perceived safety walking to a halte after dark. It is
NOT a measure of street lamps -- a brightly lit shopping street and a floodlit
car park read the same to a satellite. Stated on the methodology page.

Output: data/interim/w3.parquet
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

import geopandas as gpd
import numpy as np
import pandas as pd

from pipeline.common.cache import cached, interim
from pipeline.common.geo import CRS_UTM49S, CRS_WGS84, hex_polygons
from pipeline.common.paths import hex_index, masukan

LAYER = masukan("nighttime_light_2023.geojson")

# DN class -> estimated radiance (nW/sr/cm2), the midpoint of each stated range.
# DN=5 is open-ended (>=20); 30 is a representative value. Only the ordering
# survives into the score, since everything becomes a percentile rank.
RADIANS = {
    1: 1.5,    # TIDAK ADA CAHAYA      0 - 3
    2: 4.0,    # CAHAYA SANGAT RENDAH  3 - 5
    3: 7.5,    # CAHAYA RENDAH         5 - 10
    4: 15.0,   # CAHAYA SEDANG         10 - 20
    5: 30.0,   # CAHAYA TINGGI         >= 20
}


def main(force: bool = False) -> int:
    out_path = interim("w3.parquet")
    if cached(out_path, force):
        return 0

    cells = hex_index()
    cahaya = gpd.read_file(LAYER)
    if cahaya.crs is None:
        cahaya = cahaya.set_crs(CRS_WGS84)
    cahaya = cahaya.to_crs(CRS_UTM49S)

    tak_dikenal = set(cahaya["DN"].dropna().unique()) - set(RADIANS)
    if tak_dikenal:
        raise SystemExit(f"kelas DN tidak dikenal: {tak_dikenal}")
    cahaya["radians"] = cahaya["DN"].map(RADIANS)
    cahaya = cahaya[cahaya.radians.notna()][["DN", "radians", "geometry"]]
    print(f"  poligon cahaya {len(cahaya)}")
    print(f"    sebaran DN: {dict(cahaya['DN'].value_counts().sort_index())}")

    heks = hex_polygons(cells, metric=True)
    potong = gpd.overlay(heks, cahaya, how="intersection", keep_geom_type=True)
    potong["luas"] = potong.geometry.area
    potong["tertimbang"] = potong["radians"] * potong["luas"]
    agg = potong.groupby("h3_index").agg(
        bobot=("tertimbang", "sum"), luas=("luas", "sum"))
    agg["radians"] = agg.bobot / agg.luas

    df = pd.DataFrame({"h3_index": cells})
    df["w3_radians"] = df.h3_index.map(agg["radians"])
    # log(1+x) compresses the bright tail so one floodlit junction does not
    # dominate; the percentile rank afterwards makes the units irrelevant.
    df["W3_nilai"] = np.log1p(df["w3_radians"])

    df.to_parquet(out_path)

    ada = df.w3_radians.notna()
    print(f"  heksagon terpetakan: {int(ada.sum())} ({100 * ada.mean():.1f}%)")
    print(f"  tidak terpetakan -> tidak_tersedia: {int((~ada).sum())}")
    if ada.any():
        s = df.loc[ada, "w3_radians"]
        print(f"  radians: min {s.min():.1f}, median {s.median():.1f}, maks {s.max():.1f}")
    print(f"  -> {out_path.name}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main("--force" in sys.argv))
