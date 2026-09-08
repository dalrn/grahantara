#!/usr/bin/env python3
"""W6: pedestrian path integrity, modelled from road class calibrated on survey.

    python pipeline/30_indicators/07_w6_integritas.py [--force]

Unlike A1, a model IS justified here, and the difference is measurable. Leave-one-out
over the 83 surveyed segments:

    guess the mean                    R2  0.000   MAE 0.285
    road class only                   R2 +0.262   MAE 0.220
    road class + width                R2 +0.394   MAE 0.197
    road class + width + density      R2 +0.411   MAE 0.191

A1's equivalent test produced NEGATIVE R2 for every model, so A1 reports only
measured values. Here the model explains ~39% of variance with features OSM
supplies everywhere, so modelling is the honest choice rather than leaving 96%
of the map blank.

Why it works: sidewalk provision is a function of road hierarchy, and the survey
shows it plainly.

    Trotoar        segments   mean W6        Jenis jalan    mean W6
    Ada                  22     0.731        Jalan raya       0.449
    Sebagian              7     0.440        Jalan kecil      0.129
    Tidak ada            54     0.049        Gang             0.044

Arterials get pavements; gang do not. That is a real planning regularity, not a
statistical accident, which is why it generalises where rent did not.

FEATURES. Only what OSM has for every edge:
  * highway class, mapped to the survey's three road types
  * width where tagged (24% of edges), else the median for that class

Vehicle density is excluded even though it adds R2 0.017: it comes from the
survey, and W5 already derives it from the same road class, so including it
would launder one feature as two.

Per hexagon, the prediction is LENGTH-WEIGHTED over the roads inside it, so a
cell is judged by the paths a walker would actually use.

Output: data/interim/w6.parquet
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

import geopandas as gpd
import numpy as np
import osmnx as ox
import pandas as pd
from sklearn.linear_model import Ridge
from sklearn.model_selection import LeaveOneOut, cross_val_predict
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler

from pipeline.common.cache import cached, interim
from pipeline.common.geo import CRS_UTM49S, hex_polygons
from pipeline.common.paths import hex_index

# OSM highway class -> the survey's three road types (0 gang, 1 kecil, 2 raya).
KELAS_OSM = {
    "trunk": 2, "trunk_link": 2, "primary": 2, "primary_link": 2,
    "secondary": 2, "secondary_link": 2, "tertiary": 2, "tertiary_link": 2,
    "unclassified": 1, "residential": 1,
    "living_street": 0, "service": 0, "track": 0,
    "footway": 0, "path": 0, "pedestrian": 0, "steps": 0, "corridor": 0,
}
KELAS_SURVEI = {"Gang": 0, "Jalan kecil": 1, "Jalan raya": 2}


def _first(v):
    return v[0] if isinstance(v, list) else v


def _to_float(v):
    try:
        return float(str(_first(v)).split(";")[0])
    except (TypeError, ValueError):
        return np.nan


def main(force: bool = False) -> int:
    out_path = interim("w6.parquet")
    if cached(out_path, force):
        return 0

    # ---- train on the surveyed segments ------------------------------------
    ruas = pd.read_parquet(interim("survei_ruas.parquet"))
    w = ruas[ruas["W-6 integritas"].notna()].copy()
    w["f_kelas"] = w["Jenis jalan"].map(KELAS_SURVEI)
    w["f_lebar"] = pd.to_numeric(w["Lebar Jalan (m)"], errors="coerce")
    w = w[w.f_kelas.notna()]

    fitur = ["f_kelas", "f_lebar"]
    X = w[fitur].fillna(w[fitur].median())
    y = w["W-6 integritas"].values

    model = make_pipeline(StandardScaler(), Ridge(alpha=1.0))
    pred = cross_val_predict(model, X, y, cv=LeaveOneOut())
    r2 = 1 - ((y - pred) ** 2).sum() / ((y - y.mean()) ** 2).sum()
    mae = np.abs(y - pred).mean()
    dasar = np.abs(y - y.mean()).mean()
    print(f"  latih pada {len(y)} ruas survei")
    print(f"  validasi silang leave-one-out: R2 {r2:+.3f}, MAE {mae:.3f} "
          f"(tebak rata-rata MAE {dasar:.3f})")
    if r2 <= 0:
        raise SystemExit("model tidak lebih baik dari menebak rata-rata; hentikan")

    model.fit(X, y)

    # ---- apply to every OSM edge -------------------------------------------
    G = ox.load_graphml(interim("walk_graph.graphml"))
    edges = ox.graph_to_gdfs(G, nodes=False, edges=True).to_crs(CRS_UTM49S)
    edges["f_kelas"] = edges["highway"].apply(
        lambda h: max((KELAS_OSM.get(x) for x in (h if isinstance(h, list) else [h])
                       if x in KELAS_OSM), default=np.nan))
    edges = edges[edges.f_kelas.notna()].copy()

    edges["f_lebar"] = (edges["width"].apply(_to_float)
                        if "width" in edges.columns else np.nan)
    # Untagged width falls back to the median width of that class in the survey,
    # so the fallback comes from measured ground truth rather than a guess.
    med = w.groupby("f_kelas")["f_lebar"].median()
    edges["f_lebar"] = edges.apply(
        lambda r: r.f_lebar if pd.notna(r.f_lebar) else med.get(r.f_kelas),
        axis=1)
    edges["f_lebar"] = edges["f_lebar"].fillna(w["f_lebar"].median())
    print(f"  terapkan ke {len(edges):,} ruas OSM "
          f"(lebar tertag {int(edges['width'].notna().sum()) if 'width' in edges else 0:,})")

    edges["w6"] = np.clip(model.predict(edges[fitur]), 0.0, 1.0)
    edges["panjang"] = edges.geometry.length

    # ---- length-weighted mean per hexagon ----------------------------------
    cells = hex_index()
    heks = hex_polygons(cells, metric=True)
    potong = gpd.overlay(heks, edges[["w6", "geometry"]], how="intersection",
                        keep_geom_type=False)
    potong = potong[potong.geometry.geom_type.isin(["LineString", "MultiLineString"])]
    potong["panjang"] = potong.geometry.length
    potong["tertimbang"] = potong["w6"] * potong["panjang"]
    agg = potong.groupby("h3_index").agg(
        bobot=("tertimbang", "sum"), panjang=("panjang", "sum"))
    agg["w6"] = agg.bobot / agg.panjang

    df = pd.DataFrame({"h3_index": cells})
    df["W6_nilai"] = df.h3_index.map(agg["w6"])
    df["w6_panjang_jalan_m"] = df.h3_index.map(agg["panjang"]).fillna(0.0)
    df.to_parquet(out_path)

    ada = df.W6_nilai.notna()
    print(f"  heksagon dengan jalan: {int(ada.sum())} ({100 * ada.mean():.1f}%)")
    print(f"  tanpa jalan -> tidak_tersedia: {int((~ada).sum())}")
    if ada.any():
        s = df.loc[ada, "W6_nilai"]
        print(f"  W6: min {s.min():.3f}, median {s.median():.3f}, maks {s.max():.3f}")
    print(f"  -> {out_path.name}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main("--force" in sys.argv))
