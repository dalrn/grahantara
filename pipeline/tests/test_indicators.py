#!/usr/bin/env python3
"""Unit tests for the scoring logic in pipeline/common/indicators.py.

    python pipeline/tests/test_indicators.py

These cover the rules that would fail SILENTLY -- producing plausible numbers
that are wrong -- rather than raising. That is why they exist: a percentile that
is off by a rank, or a weight that fails to renormalise, looks like data.

No pytest dependency; run the file directly.
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

import numpy as np
import pandas as pd

from pipeline.common.indicators import (
    EPS, ecdf_percentile, indikator, skor_akhir, subskor, tidak_tersedia,
)

lulus, gagal = 0, []


def cek(nama: str, syarat: bool, detail: str = "") -> None:
    global lulus
    if syarat:
        lulus += 1
    else:
        gagal.append(f"{nama}: {detail}")


def hampir(a: float, b: float, tol: float = 1e-6) -> bool:
    return abs(a - b) < tol


# --- ecdf_percentile ------------------------------------------------------
s = pd.Series([10, 20, 30, 40])
p = ecdf_percentile(s)
cek("ecdf urutan naik", list(p) == [0.25, 0.5, 0.75, 1.0], str(list(p)))

# Ties must share the average rank, or two identical hexagons would be ordered
# arbitrarily and one would score higher than the other for no reason.
p = ecdf_percentile(pd.Series([10, 20, 20, 30]))
cek("ecdf seri berbagi peringkat rata-rata",
    hampir(p[1], p[2]) and hampir(p[1], 0.625), str(list(p)))

# Missing must stay missing. A percentile for an unknown value would assert a
# rank we do not have.
p = ecdf_percentile(pd.Series([10, np.nan, 30]))
cek("ecdf NaN tetap NaN", pd.isna(p[1]), str(list(p)))
cek("ecdf mengabaikan NaN dari pool", hampir(p[0], 0.5) and hampir(p[2], 1.0),
    str(list(p)))

cek("ecdf seri kosong", len(ecdf_percentile(pd.Series([], dtype=float))) == 0)
cek("ecdf nilai tunggal", hampir(ecdf_percentile(pd.Series([5.0]))[0], 1.0))

# --- indikator() contract guard -------------------------------------------
r = indikator(123.456789, "m", 0.5, "osm")
cek("indikator membulatkan nilai", r["nilai"] == 123.4568, str(r))
cek("indikator membulatkan persentil", r["persentil"] == 0.5, str(r))

try:
    indikator(5, "m", 0.5, "entah")
    cek("indikator tolak sumber tak dikenal", False, "tidak melempar")
except ValueError:
    cek("indikator tolak sumber tak dikenal", True)

try:
    indikator(5, "m", 1.5, "osm")
    cek("indikator tolak persentil >1", False, "tidak melempar")
except ValueError:
    cek("indikator tolak persentil >1", True)

try:
    indikator(None, "m", None, "osm")
    cek("indikator tolak persentil None saat sumber ada", False, "tidak melempar")
except ValueError:
    cek("indikator tolak persentil None saat sumber ada", True)

# The dangerous inverse: a tidak_tersedia record carrying a value would let a
# guess enter the score wearing an "unknown" label.
try:
    indikator(5, "m", 0.5, "tidak_tersedia")
    cek("indikator tolak tidak_tersedia berisi nilai", False, "tidak melempar")
except ValueError:
    cek("indikator tolak tidak_tersedia berisi nilai", True)

t = tidak_tersedia("m")
cek("tidak_tersedia nilai None", t["nilai"] is None, str(t))
cek("tidak_tersedia persentil None", t["persentil"] is None, str(t))

# --- subskor: renormalisation --------------------------------------------
ind = {"a": indikator(1, None, 0.8, "osm"), "b": indikator(1, None, 0.4, "osm")}
cek("subskor tanpa yang hilang",
    hampir(subskor(ind, {"a": 0.5, "b": 0.5}), 60.0), str(subskor(ind, {"a": .5, "b": .5})))

# The core rule: a missing indicator is dropped and the rest renormalise, so the
# result must equal what the present indicators alone would give.
ind = {"a": indikator(1, None, 0.8, "osm"), "b": tidak_tersedia(),
       "c": indikator(1, None, 0.4, "osm")}
got = subskor(ind, {"a": 0.5, "b": 0.3, "c": 0.2})
mau = 100 * (0.5 * 0.8 + 0.2 * 0.4) / 0.7
cek("subskor normalisasi ulang saat ada yang hilang", hampir(got, round(mau, 2)),
    f"dapat {got}, mau {round(mau, 2)}")

# Dropping an indicator must not shift the score when the remaining ones agree;
# this catches a renormalisation that divides by the wrong total.
ind = {"a": indikator(1, None, 0.6, "osm"), "b": tidak_tersedia(),
       "c": indikator(1, None, 0.6, "osm")}
cek("subskor nilai sama tetap sama meski satu hilang",
    hampir(subskor(ind, {"a": 0.5, "b": 0.3, "c": 0.2}), 60.0))

cek("subskor semua hilang mengembalikan None",
    subskor({"a": tidak_tersedia(), "b": tidak_tersedia()},
            {"a": 0.5, "b": 0.5}) is None)

# --- skor_akhir: geometric mean ------------------------------------------
W = {"connectivity": 0.40, "affordability": 0.25, "amenity": 0.20,
     "walkability": 0.15}

sub = {"connectivity": 50.0, "affordability": 50.0, "amenity": 50.0,
       "walkability": 50.0}
cek("skor semua 50 mendekati 51", 50 < skor_akhir(sub, W) < 52, str(skor_akhir(sub, W)))

# The whole reason for a geometric mean: one dead dimension must sink the total.
mati = {"connectivity": 0.0, "affordability": 95.0, "amenity": 95.0,
        "walkability": 95.0}
arit = sum(W[d] * v for d, v in mati.items())
cek("geometrik menghukum satu dimensi nol", skor_akhir(mati, W) < 20,
    f"skor {skor_akhir(mati, W)}, aritmetik akan {arit:.1f}")

cek("skor terikat 0..100", 0 <= skor_akhir(
    {d: 100.0 for d in W}, W) <= 100)

# An excluded dimension must give the same answer as scoring only the rest.
tiga = {"connectivity": 40.0, "amenity": 50.0, "walkability": 60.0}
Wt = {k: W[k] for k in tiga}
cek("dimensi None sama dengan menghitung sisanya saja",
    hampir(skor_akhir({**tiga, "affordability": None}, W),
           skor_akhir(tiga, Wt), tol=0.01))

# Excluding must not equal scoring the gap as zero -- that was the bug that made
# 93% of the map look terrible.
nol = skor_akhir({**tiga, "affordability": 0.0}, W)
keluar = skor_akhir({**tiga, "affordability": None}, W)
cek("dimensi dikeluarkan != dinilai nol", keluar > nol + 10,
    f"dikeluarkan {keluar}, dinilai nol {nol}")

cek("semua dimensi None mengembalikan 0",
    skor_akhir({d: None for d in W}, W) == 0.0)

# --- consistency with the published contract ------------------------------
# eps keeps the log defined when a subscore is genuinely 0.
cek("eps menjaga skor terdefinisi saat subskor nol",
    skor_akhir({d: 0.0 for d in W}, W) > 0)
cek("EPS sesuai kontrak 0,01", hampir(EPS, 0.01))

# --- report ---------------------------------------------------------------
print(f"\n{lulus} lulus, {len(gagal)} gagal")
for g in gagal:
    print(f"  GAGAL {g}")
raise SystemExit(1 if gagal else 0)
