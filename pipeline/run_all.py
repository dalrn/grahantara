#!/usr/bin/env python3
"""Run the whole pipeline, in order, from raw sources to published GeoJSON.

    python pipeline/run_all.py              # skip steps whose output exists
    python pipeline/run_all.py --force      # recompute everything
    python pipeline/run_all.py --from 30    # start at stage 30
    python pipeline/run_all.py --dry-run    # list the steps, run nothing

Every step caches its own output, so a plain run after a completed one does
almost nothing. --force is the honest full rebuild: expect the OSM download and
the Earth Engine reduction to dominate, roughly 15-25 minutes total.

The order matters and is not alphabetical by accident: 20_network needs the walk
graph from 00_ingest, 30_indicators needs both the graph and the cleaned survey,
and 40_score needs every indicator. A step that runs early with a missing input
fails loudly rather than writing a half-empty layer.
"""
import argparse
import subprocess
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

# (stage, script, what it produces, whether the network is required)
LANGKAH = [
    ("00", "00_ingest/01_walk_graph.py",        "graf jalan kaki OSM",          True),
    ("00", "00_ingest/02_transit.py",           "halte, rute, stasiun",         True),
    ("00", "00_ingest/03_halte_rute_join.py",   "halte + koridornya",           True),
    ("00", "00_ingest/04_activities.py",        "158 aktivitas survei",         True),
    ("10", "10_clean/01_baca_survei.py",        "tabel survei",                 False),
    ("10", "10_clean/02_geocode_kos.py",        "koordinat kos",                False),
    ("20", "20_network/01_snap.py",             "titik ditempel ke graf",       False),
    ("20", "20_network/02_c1_c4.py",            "C1, C4",                       False),
    ("20", "20_network/03_c2.py",               "C2",                           False),
    ("20", "20_network/04_c3.py",               "C3 + per kampus",              False),
    ("20", "20_network/05_w1.py",               "W1",                           False),
    ("30", "30_indicators/01_amenity.py",       "M1, M2, M4",                   False),
    ("30", "30_indicators/02_w4_banjir.py",     "W4",                           False),
    ("30", "30_indicators/03_w3_penerangan.py", "W3",                           False),
    ("30", "30_indicators/04_w5_lalin.py",      "W5",                           False),
    ("30", "30_indicators/05_w2_keteduhan.py",  "W2 (butuh Earth Engine)",      True),
    ("30", "30_indicators/06_a1_harga_kos.py",  "A1",                           False),
    ("30", "30_indicators/07_w6_integritas.py", "W6",                           False),
    ("40", "40_score/01_skor.py",               "hexagons.geojson",             False),
    ("40", "40_score/02_lapisan_titik.py",      "lapisan titik",                False),
]

UJI = [
    ("tests/test_indicators.py", []),
    ("tests/validate_schema.py", ["data/processed/hexagons.geojson"]),
    ("tests/test_keluaran.py", []),
]


def jalankan(skrip: str, argumen: list[str]) -> tuple[bool, float]:
    mulai = time.time()
    hasil = subprocess.run([sys.executable, str(ROOT / "pipeline" / skrip), *argumen],
                           cwd=ROOT)
    return hasil.returncode == 0, time.time() - mulai


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--force", action="store_true",
                    help="hitung ulang semua, abaikan cache")
    ap.add_argument("--from", dest="mulai", default="00",
                    help="mulai dari tahap ini (00/10/20/30/40)")
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--skip-tests", action="store_true")
    a = ap.parse_args()

    langkah = [x for x in LANGKAH if x[0] >= a.mulai]
    if a.dry_run:
        for tahap, skrip, apa, net in langkah:
            print(f"  {tahap}  {skrip:34s} {apa}" + ("  [jaringan]" if net else ""))
        print(f"\n{len(langkah)} langkah" + ("" if a.skip_tests else f" + {len(UJI)} uji"))
        return 0

    total = time.time()
    for i, (tahap, skrip, apa, _net) in enumerate(langkah, 1):
        print(f"\n[{i}/{len(langkah)}] {skrip} -- {apa}")
        ok, detik = jalankan(skrip, ["--force"] if a.force else [])
        if not ok:
            print(f"\nGAGAL di {skrip} setelah {detik:.0f}s. Pipeline dihentikan.")
            return 1
        print(f"  selesai {detik:.0f}s")

    if not a.skip_tests:
        print("\n--- uji ---")
        for skrip, argumen in UJI:
            print(f"\n{skrip}")
            ok, _ = jalankan(skrip, argumen)
            if not ok:
                print(f"\nUJI GAGAL: {skrip}")
                return 1

    print(f"\nSELESAI dalam {(time.time() - total) / 60:.1f} menit")
    print("Salin ke frontend bila hasilnya sudah benar:")
    print("  cp data/processed/{hexagons,kampus,halte,kos,krl}.geojson "
          "data/processed/c3_per_kampus.json web/public/data/")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
