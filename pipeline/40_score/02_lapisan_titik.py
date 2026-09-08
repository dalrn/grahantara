#!/usr/bin/env python3
"""Replace the three stub point layers with real geometry.

    python pipeline/40_score/02_lapisan_titik.py [--force]

Writes kampus, halte, kos and (new) krl into data/processed/, ready to copy to
web/public/data/.

The property names are NOT free choice: web/src/components/PetaHeksagon.jsx
reads specific fields to build its popups, so the real data must use exactly the
names the stub established.

    kampus  nama, jumlah_gerbang
    halte   nama, koridor (array)
    kos     id, nama, jenis, harga_median, sumber_harga, h3_index, jarak_halte_m
    krl     nama

Two things the stub got wrong that this fixes:

  * kampus.geojson listed "Universitas Respati", which has no gates in the
    survey data. The real tenth campus is UIN Sunan Kalijaga. The frontend
    constant was corrected earlier; this closes the loop on the data.
  * jumlah_gerbang was random. Real counts come from the 219-gate reference.

A stub krl layer never existed -- lapisan.js declares the layer with
`tersedia: false`. The data exists now, so it is written; Devon can flip that
flag when he chooses.
"""
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

import geopandas as gpd
import pandas as pd

from pipeline.common.cache import cached, interim
from pipeline.common.geo import CRS_WGS84
from pipeline.common.paths import DATA_PROCESSED, REFERENCE, study_area


def _tulis(nama: str, fitur: list) -> Path:
    out = DATA_PROCESSED / f"{nama}.geojson"
    out.write_text(json.dumps({
        "type": "FeatureCollection",
        "name": nama,
        "crs": {"type": "name",
                "properties": {"name": "urn:ogc:def:crs:OGC:1.3:CRS84"}},
        "features": fitur,
    }, ensure_ascii=False), encoding="utf-8")
    print(f"  {nama:8s} {len(fitur):4d} fitur -> {out.name}")
    return out


def _titik(geom, props: dict) -> dict:
    return {"type": "Feature",
            "geometry": {"type": "Point",
                         "coordinates": [round(geom.x, 6), round(geom.y, 6)]},
            "properties": props}


def main(force: bool = False) -> int:
    out_kampus = DATA_PROCESSED / "kampus.geojson"
    if cached(out_kampus, force):
        return 0

    area = study_area()

    # ---- kampus: one point per campus, at the centroid of its gates ---------
    gerbang = gpd.read_file(REFERENCE / "kampus_gerbang_10.geojson")
    gerbang = gerbang.drop_duplicates(subset=["osm_node", "kampus"])
    fitur = []
    for nama, g in gerbang.groupby("kampus"):
        pusat = g.geometry.union_all().centroid
        fitur.append(_titik(pusat, {"nama": nama, "jumlah_gerbang": len(g)}))
    fitur.sort(key=lambda f: -f["properties"]["jumlah_gerbang"])
    _tulis("kampus", fitur)

    # ---- halte: only those serving a known corridor, inside the study area --
    halte = gpd.read_parquet(interim("halte_rute.parquet")).to_crs(CRS_WGS84)
    halte = halte[halte.geometry.within(area)]
    fitur = []
    for r in halte.itertuples():
        koridor = [k for k in str(r.koridor).split(",") if k] if r.koridor else []
        nama = r.name if isinstance(getattr(r, "name", None), str) else None
        fitur.append(_titik(r.geometry, {
            "nama": nama or "Halte tanpa nama",
            "koridor": koridor,
        }))
    _tulis("halte", fitur)

    # ---- kos: the surveyed kos, with their recovered coordinates ------------
    kos = pd.read_parquet(interim("survei_kos.parquet"))
    koord = pd.read_csv(Path("kos_koordinat_untuk_dicek.csv"), encoding="utf-8-sig")
    k = kos.merge(koord[["ID", "lat", "lon", "presisi"]], on="ID", how="left")
    k = k[k.lat.notna()]

    import h3
    fitur = []
    for _, r in k.iterrows():
        harga = r["Harga median (Rp)"]
        h3i = h3.latlng_to_cell(r["lat"], r["lon"], 9)
        jarak = pd.to_numeric(r.get("Jarak ke halte (m)"), errors="coerce")
        fitur.append({
            "type": "Feature",
            "geometry": {"type": "Point",
                         "coordinates": [round(r["lon"], 6), round(r["lat"], 6)]},
            "properties": {
                "id": r["ID"],
                "nama": r["Nama atau alamat kos"],
                "jenis": r["Jenis"] if pd.notna(r["Jenis"]) else None,
                "harga_median": None if pd.isna(harga) else int(harga),
                # sumber_harga becomes the popup badge. It says how the PRICE was
                # obtained, which is what a reader needs to judge it.
                "sumber_harga": (r["Sumber harga"]
                                 if pd.notna(r["Sumber harga"]) else None),
                "h3_index": h3i,
                "jarak_halte_m": None if pd.isna(jarak) else int(jarak),
                # Coordinates were recovered after the fact, so how precisely is
                # part of the record rather than a hidden assumption.
                "presisi_koordinat": r["presisi"],
            },
        })
    _tulis("kos", fitur)

    # ---- krl: stations, for the layer lapisan.js already declares ----------
    krl = gpd.read_parquet(interim("krl_stasiun.parquet")).to_crs(CRS_WGS84)
    # OSM maps some stations twice (a node and a building/area), so the same
    # station appears at nearly the same point with one copy unnamed. Keep the
    # named one and drop an unnamed duplicate within 200 m of it.
    krl = krl[krl["name"].notna()].copy()
    krl["_k"] = krl.geometry.apply(lambda g: (round(g.x, 3), round(g.y, 3)))
    krl = krl.drop_duplicates(subset=["name"]).drop_duplicates(subset=["_k"])
    fitur = [_titik(r.geometry, {"nama": r._asdict()["name"]})
             for r in krl.itertuples()]
    _tulis("krl", fitur)
    return 0


if __name__ == "__main__":
    raise SystemExit(main("--force" in sys.argv))
