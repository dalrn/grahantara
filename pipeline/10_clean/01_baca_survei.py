#!/usr/bin/env python3
"""Read the cleaned survey workbook into tidy Parquet.

    python pipeline/10_clean/01_baca_survei.py [--force]

The workbook was cleaned by hand in Excel, so this step does NOT reproduce that
cleaning -- a deliberate decision by the repo owner. It reads what is there,
verifies the arithmetic it can verify, and writes typed tables.

It does NOT silently repair contradictions. Two rows contradict themselves
(sidewalk absent yet a sidewalk width recorded); they are reported in
docs/SURVEI_ANOMALI.md and left exactly as recorded. Editing survey observations
to make a model behave is falsifying fieldwork, so any change must be a human
decision made in the workbook itself.

Outputs, all in data/interim/:
    survei_ruas.parquet     84 street segments, with W-6 components
    survei_halte.parquet    12 stop observations
    survei_ekonomi.parquet  12 economic points
    survei_kos.parquet      31 boarding houses, 29 with prices
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

import pandas as pd

from pipeline.common.cache import cached, interim
from pipeline.common.paths import DATA_PROCESSED

WORKBOOK = DATA_PROCESSED / "Hasil_Survei_BERSIH.xlsx"

# W-6 component weights, from docs/DATA_DICTIONARY.md.
W6 = {
    "I-1 ketersediaan": 0.25,
    "I-2 lebar": 0.15,
    "I-3 keutuhan": 0.20,
    "I-4 kemulusan": 0.15,
    "I-5 tidak turun": 0.25,
}


def _verify_w6(r: pd.DataFrame) -> None:
    """Recompute W-6 from its components and compare with the stored column.

    Renormalises the weights over whichever components are present, which is the
    same missing-data rule the dimensions use. Catches a workbook edited after
    the index was computed.
    """
    bad = []
    for _, x in r.iterrows():
        num = tot = 0.0
        for c, w in W6.items():
            v = x[c]
            if pd.notna(v):
                num += w * float(v)
                tot += w
        if tot == 0 or pd.isna(x["W-6 integritas"]):
            continue
        if abs(num / tot - float(x["W-6 integritas"])) > 0.02:
            bad.append(x["ID"])
    if bad:
        print(f"  PERINGATAN W-6 tidak cocok pada {len(bad)} ruas: {bad[:6]}")
    else:
        print(f"  W-6 terverifikasi: aritmetika cocok pada seluruh {len(r)} ruas")


def _report_anomalies(r: pd.DataFrame) -> None:
    """Re-detect the known contradictions so a workbook edit cannot hide them."""
    contra = r[(r["Trotoar"] == "Tidak ada") & (r["Lebar Trotoar (m)"] > 0)]
    if len(contra):
        print(f"  ANOMALI {len(contra)} ruas: Trotoar='Tidak ada' tapi lebar>0 "
              f"-> {list(contra['ID'])}")
        print("           lihat docs/SURVEI_ANOMALI.md, dibiarkan apa adanya")

    zero_road = r[r["Lebar Jalan (m)"] == 0]
    if len(zero_road):
        print(f"  ANOMALI {len(zero_road)} ruas: Lebar Jalan = 0 m "
              f"-> {list(zero_road['ID'])}")


def main(force: bool = False) -> int:
    outs = {n: interim(f"survei_{n}.parquet")
            for n in ("ruas", "halte", "ekonomi", "kos")}
    if all(cached(p, force) for p in outs.values()):
        return 0

    if not WORKBOOK.exists():
        raise SystemExit(f"tidak ada: {WORKBOOK}")

    xl = pd.ExcelFile(WORKBOOK)

    # ---- Ruas -------------------------------------------------------------
    ruas = xl.parse("Ruas")
    _verify_w6(ruas)
    _report_anomalies(ruas)

    # The structural-zero rule from docs/DATA_DICTIONARY.md: with no sidewalk,
    # width and broken length are genuinely 0, not unknown. Applied only where
    # the cell is EMPTY -- never over a recorded value, however contradictory.
    tz = ruas["Trotoar"] == "Tidak ada"
    for col in ("Lebar Trotoar (m)", "Panjang trotoar terputus (m)"):
        n = int((tz & ruas[col].isna()).sum())
        if n:
            ruas.loc[tz & ruas[col].isna(), col] = 0.0
            print(f"  nol struktural: {n} sel kosong '{col}' -> 0 "
                  f"(Trotoar='Tidak ada')")

    ruas["w6_lengkap"] = ruas["W-6 status"].eq("Lengkap")
    ruas.to_parquet(outs["ruas"])
    print(f"  ruas    {len(ruas):3d} baris, W-6 lengkap {int(ruas.w6_lengkap.sum())}, "
          f"belum {int((~ruas.w6_lengkap).sum())}")

    # ---- Halte ------------------------------------------------------------
    halte = xl.parse("Halte")
    halte.to_parquet(outs["halte"])
    teramati = int(halte["Durasi tunggu (detik)"].notna().sum())
    print(f"  halte   {len(halte):3d} baris, {teramati} dengan pengamatan waktu")

    # ---- Ekonomi ----------------------------------------------------------
    eko = xl.parse("Ekonomi")
    kategori = ["Warung makan", "Kaki Lima", "Fotokopi", "Laundry",
                "Minimarket", "Apotek", "Resto", "Usaha lain"]
    selisih = (eko[kategori].sum(axis=1) - eko["Total usaha"]).abs()
    if (selisih > 0).any():
        print(f"  PERINGATAN Total usaha tidak cocok pada "
              f"{int((selisih > 0).sum())} baris")
    else:
        print(f"  ekonomi {len(eko):3d} baris, Total usaha cocok di semua baris")
    eko.to_parquet(outs["ekonomi"])

    # ---- Kos --------------------------------------------------------------
    kos = xl.parse("Kos")
    # "Harga (teks asli)" is deliberately free text ("775rb/1.2jt"), but one row
    # was entered as a bare number, giving a mixed int/str column that Parquet
    # rejects. Cast to string so the original wording is preserved verbatim; the
    # parsed figures already live in Harga median/min/maks.
    kos["Harga (teks asli)"] = kos["Harga (teks asli)"].astype("string")
    berharga = int(kos["Harga median (Rp)"].notna().sum())
    kos.to_parquet(outs["kos"])
    print(f"  kos     {len(kos):3d} baris, {berharga} berharga "
          f"(median Rp{kos['Harga median (Rp)'].median():,.0f})")

    print(f"  -> {', '.join(p.name for p in outs.values())}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main("--force" in sys.argv))
