#!/usr/bin/env python3
"""Percentile-normalise the 16 indicators, aggregate, and write the GeoJSON.

    python pipeline/40_score/01_skor.py [--force]

Three stages, each enforcing a rule from docs/DATA_DICTIONARY.md:

  1. ECDF percentile per indicator, against the pool of hexagons that HAVE a
     value. Missing stays missing -- it never receives a percentile, because a
     percentile would imply we know where it ranks.
  2. Subscore = weighted mean of percentiles, renormalising the weights over
     whichever indicators are present in that dimension.
  3. Score = 100 * PROD((subscore/100 + eps) ** dimension weight), the weighted
     geometric mean, so one dead dimension drags the total down.

DIRECTION MATTERS. Some indicators are "more is better" (food density) and some
are "less is better" (distance to a halte, rent). The percentile is taken on the
value as stored, and every indicator here is already oriented so that HIGHER IS
BETTER before this script sees it -- C1 is exp(-d/400), A1 is negated rent. The
ARAH table below states each one explicitly so the orientation is auditable
rather than implied.

Output: data/processed/hexagons.geojson, plus c3_per_kampus.json alongside it.
"""
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

import h3
import numpy as np
import pandas as pd

from pipeline.common.cache import cached, interim
from pipeline.common.indicators import (
    EPS, ecdf_percentile, indikator, skor_akhir, subskor, tidak_tersedia,
)
from pipeline.common.paths import DATA_PROCESSED, hex_index, load_weights

# indicator -> (parquet, value column, raw column, unit, source, higher-is-better)
SPEK = {
    "C1_jarak_halte":          ("c1_c4",   "C1_nilai", "c1_jarak_m",   "m",         "osm",       True),
    "C2_rute_unik":            ("c2",      "C2_nilai", "c2_rute",      "rute",      "osm",       True),
    "C3_keterjangkauan_kampus":("c3",      "C3_nilai", None,           None,        "osm",       True),
    "C4_jarak_krl":            ("c1_c4",   "C4_nilai", "c4_jarak_m",   "m",         "osm",       True),
    "A1_harga_kos":            ("a1",      "A1_nilai", "a1_harga_rp",  "Rp/bulan",  "survei",    True),
    "M1_kepadatan_makan":      ("amenity", "M1_nilai", "m1_n",         "titik",     "mapid_poi", True),
    "M2_keragaman":            ("amenity", "M2_nilai", None,           "indeks",    "mapid_poi", True),
    "M4_layanan_harian":       ("amenity", "M4_nilai", "m4_k",         "kategori",  "mapid_poi", True),
    "W1_kerapatan_simpang":    ("w1",      "W1_nilai", "n_simpang",    "per km2",   "osm",       True),
    "W2_keteduhan":            ("w2",      "W2_nilai", "w2_ndvi",      "NDVI",      "sentinel2", True),
    "W3_penerangan":           ("w3",      "W3_nilai", "w3_radians",   "nW/sr/cm2", "viirs",     True),
    "W4_banjir":               ("w4",      "W4_nilai", None,           "indeks",    "inarisk",   True),
    "W5_tekanan_lalin":        ("w5",      "W5_nilai", None,           "indeks",    "osm",       True),
    "W6_integritas_jalur":     ("w6",      "W6_nilai", None,           "indeks",    "model",     True),
}
# Never computed; both are honest gaps, recorded so the frontend still sees the key.
KOSONG = {
    "A2_harga_makan": "Rp/porsi",
    "M3_keramaian": None,
}

DIMENSI = {
    "connectivity":  ["C1_jarak_halte", "C2_rute_unik", "C3_keterjangkauan_kampus",
                      "C4_jarak_krl"],
    "affordability": ["A1_harga_kos", "A2_harga_makan"],
    "amenity":       ["M1_kepadatan_makan", "M2_keragaman", "M3_keramaian",
                      "M4_layanan_harian"],
    "walkability":   ["W1_kerapatan_simpang", "W2_keteduhan", "W3_penerangan",
                      "W4_banjir", "W5_tekanan_lalin", "W6_integritas_jalur"],
}

# C3 is discrete; show the class rather than the number.
C3_LABEL = {1.00: "langsung", 0.60: "satu_transfer", 0.20: "tidak_terjangkau"}


def main(force: bool = False) -> int:
    out_path = DATA_PROCESSED / "hexagons.geojson"
    if cached(out_path, force):
        return 0

    cells = hex_index()
    bobot = load_weights()
    w_dim = bobot["dimensi"]
    w_ind = bobot["indikator"]

    # ---- gather every indicator into one frame -----------------------------
    df = pd.DataFrame({"h3_index": cells})
    dimuat = {}
    for kunci, (berkas, kol, mentah, _sat, _sum, _naik) in SPEK.items():
        if berkas not in dimuat:
            dimuat[berkas] = pd.read_parquet(interim(f"{berkas}.parquet"))
        d = dimuat[berkas]
        ambil = ["h3_index", kol] + ([mentah] if mentah and mentah in d.columns else [])
        df = df.merge(d[ambil].rename(columns={kol: f"v_{kunci}",
                                               mentah: f"r_{kunci}"} if mentah else
                                      {kol: f"v_{kunci}"}),
                      on="h3_index", how="left")

    # ---- 1. ECDF percentile ------------------------------------------------
    print("  persentil ECDF (pool = heksagon yang punya nilai):")
    for kunci in SPEK:
        df[f"p_{kunci}"] = ecdf_percentile(df[f"v_{kunci}"])
        n = int(df[f"p_{kunci}"].notna().sum())
        print(f"    {kunci:26s} {n:5d} heksagon")

    # ---- 2 & 3. per-hexagon records, subscores, score -----------------------
    c3_kelas = df["v_C3_keterjangkauan_kampus"]
    fitur, ringkas = [], []
    for i, h3i in enumerate(cells):
        row = df.iloc[i]
        ind = {}

        for kunci, (_b, _k, mentah, satuan, sumber, _naik) in SPEK.items():
            pct = row[f"p_{kunci}"]
            if pd.isna(pct):
                ind[kunci] = tidak_tersedia(satuan)
                continue
            if kunci == "C3_keterjangkauan_kampus":
                nilai = C3_LABEL.get(round(float(row["v_C3_keterjangkauan_kampus"]), 2),
                                     "tidak_terjangkau")
            elif mentah and f"r_{kunci}" in df.columns and pd.notna(row.get(f"r_{kunci}")):
                nilai = float(row[f"r_{kunci}"])
            else:
                nilai = round(float(row[f"v_{kunci}"]), 4)
            ind[kunci] = indikator(nilai, satuan, float(pct), sumber)

        for kunci, satuan in KOSONG.items():
            ind[kunci] = tidak_tersedia(satuan)

        sub_raw = {d: subskor({k: ind[k] for k in ks}, w_ind_flat(w_ind, d))
                   for d, ks in DIMENSI.items()}
        skor = skor_akhir(sub_raw, w_dim)

        # The schema requires all four subscores to be numbers, so a dimension
        # with no data at all is written as 0 -- but it was EXCLUDED from the
        # score above, not scored as 0. dimensi_kosong records which ones, so
        # the client can reproduce the same arithmetic.
        kosong = [d for d, v in sub_raw.items() if v is None]
        sub = {d: (0.0 if v is None else v) for d, v in sub_raw.items()}

        ring = h3.cell_to_boundary(h3i)
        cincin = [[lng, lat] for lat, lng in ring]
        cincin.append(cincin[0])

        fitur.append({
            "type": "Feature",
            "geometry": {"type": "Polygon", "coordinates": [cincin]},
            "properties": {"h3_index": h3i, "skor": skor, "subskor": sub,
                           "dimensi_kosong": kosong, "indikator": ind},
        })
        ringkas.append({"h3_index": h3i, "skor": skor, "kosong": kosong, **sub})

    # ---- write -------------------------------------------------------------
    fc = {
        "type": "FeatureCollection",
        "name": "hexagons",
        "metadata": {
            "versi": "1.0",
            "h3_resolution": 9,
            "jumlah": len(fitur),
            "dihitung_pada": datetime.now(timezone.utc).isoformat(timespec="seconds"),
            "bobot_default": w_dim,
            "aturan_dimensi_kosong": (
                "Dimensi yang seluruh indikatornya tidak_tersedia DIKELUARKAN "
                "dari rata-rata geometrik dan bobot dimensi sisanya "
                "dinormalisasi ulang. Dimensi itu ditulis 0 pada subskor demi "
                "kesesuaian skema, dan didaftar di properties.dimensi_kosong. "
                "Klien yang menghitung ulang skor WAJIB membaca field itu."
            ),
        },
        "features": fitur,
    }
    DATA_PROCESSED.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(fc, ensure_ascii=False), encoding="utf-8")

    # C3 per campus, as a companion file so the GeoJSON does not carry ten
    # extra fields per hexagon and mesinSkor.js needs no change.
    per = pd.read_parquet(interim("c3_per_kampus.parquet"))
    kampus = [c for c in per.columns if c != "h3_index"]
    c3_out = {r["h3_index"]: {k: round(float(r[k]), 2) for k in kampus}
              for _, r in per.iterrows()}
    (DATA_PROCESSED / "c3_per_kampus.json").write_text(
        json.dumps({"kampus": kampus, "data": c3_out}, ensure_ascii=False),
        encoding="utf-8")

    s = pd.DataFrame(ringkas)
    print()
    kk = pd.Series([len(r.get("kosong", [])) for r in ringkas])
    print(f"  heksagon dengan dimensi dikeluarkan: {int((kk > 0).sum())}")
    print(f"  skor: min {s.skor.min():.1f}  median {s.skor.median():.1f}  "
          f"maks {s.skor.max():.1f}  rata-rata {s.skor.mean():.1f}")
    for d in DIMENSI:
        print(f"    subskor {d:14s} median {s[d].median():6.1f}  "
              f"nol {int((s[d] == 0).sum()):4d}")
    print(f"  -> {out_path}  ({out_path.stat().st_size / 1e6:.1f} MB)")
    print(f"  -> {(DATA_PROCESSED / 'c3_per_kampus.json').name}")
    return 0


def w_ind_flat(w_ind: dict, dim: str) -> dict:
    """Indicator weights for one dimension, keyed by indicator name."""
    return dict(w_ind[dim])


if __name__ == "__main__":
    raise SystemExit(main("--force" in sys.argv))
