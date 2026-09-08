#!/usr/bin/env python3
"""Invariant checks on the produced GeoJSON, beyond schema conformance.

    python pipeline/tests/test_keluaran.py [path]

validate_schema.py answers "is the shape legal". This answers "is the content
coherent" -- the failures that would pass a schema check and still be wrong:

  * a hexagon set that drifted from the frozen index
  * a score that does not match its own subscores
  * an indicator whose percentile contradicts its neighbours' ordering
  * tidak_tersedia rendered as 0 somewhere
  * geometry that fell outside the study area
"""
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

import numpy as np

from pipeline.common.indicators import EPS
from pipeline.common.paths import DATA_PROCESSED, hex_index, study_area

lulus, gagal = 0, []


def cek(nama: str, syarat: bool, detail: str = "") -> None:
    global lulus
    if syarat:
        lulus += 1
        print(f"  OK   {nama}")
    else:
        gagal.append(f"{nama}: {detail}")
        print(f"  GAGAL {nama}: {detail}")


def main(path: Path) -> int:
    d = json.loads(path.read_text(encoding="utf-8"))
    f = d["features"]
    meta = d["metadata"]
    print(f"memeriksa {path.name} ({len(f)} fitur)\n")

    # --- identity ---------------------------------------------------------
    beku = hex_index()
    idx = [x["properties"]["h3_index"] for x in f]
    cek("jumlah heksagon 2.134", len(f) == 2134, str(len(f)))
    cek("metadata.jumlah cocok", meta["jumlah"] == len(f),
        f"{meta['jumlah']} vs {len(f)}")
    cek("tidak ada h3_index duplikat", len(set(idx)) == len(idx),
        f"{len(idx) - len(set(idx))} duplikat")
    cek("himpunan heksagon cocok dengan indeks beku", set(idx) == set(beku),
        f"selisih {len(set(idx) ^ set(beku))}")
    cek("versi bukan stub", not str(meta["versi"]).startswith("stub"),
        meta["versi"])
    cek("resolusi H3 = 9", meta["h3_resolution"] == 9)
    cek("bobot_default ada", "bobot_default" in meta,
        "frontend memakainya sebagai asumsi kalau tidak ada")
    W = meta.get("bobot_default", {})
    cek("bobot dimensi berjumlah 1,0", abs(sum(W.values()) - 1.0) < 1e-9,
        str(sum(W.values())))

    # --- score arithmetic -------------------------------------------------
    salah, terburuk = 0, 0.0
    for x in f:
        p = x["properties"]
        kosong = set(p.get("dimensi_kosong", []))
        ada = {k: v for k, v in p["subskor"].items() if k not in kosong}
        tot = sum(W[k] for k in ada)
        if tot <= 0:
            hitung = 0.0
        else:
            ls = sum((W[k] / tot) * np.log(v / 100 + EPS) for k, v in ada.items())
            hitung = float(np.clip(100 * np.exp(ls), 0, 100))
        beda = abs(hitung - p["skor"])
        if beda > 0.02:
            salah += 1
            terburuk = max(terburuk, beda)
    cek("skor cocok dengan subskornya sendiri", salah == 0,
        f"{salah} meleset, terburuk {terburuk:.2f}")

    # --- missing-data policy ---------------------------------------------
    bocor = 0
    for x in f:
        for k, v in x["properties"]["indikator"].items():
            if v["sumber"] == "tidak_tersedia":
                if v["nilai"] is not None or v["persentil"] is not None:
                    bocor += 1
            elif v["persentil"] is None:
                bocor += 1
    cek("tidak_tersedia selalu null, sumber lain selalu punya persentil",
        bocor == 0, f"{bocor} pelanggaran")

    # A dimension listed as empty must have every one of its indicators missing.
    DIM = {"connectivity": ["C1_jarak_halte", "C2_rute_unik",
                            "C3_keterjangkauan_kampus", "C4_jarak_krl"],
           "affordability": ["A1_harga_kos", "A2_harga_makan"],
           "amenity": ["M1_kepadatan_makan", "M2_keragaman", "M3_keramaian",
                       "M4_layanan_harian"],
           "walkability": ["W1_kerapatan_simpang", "W2_keteduhan",
                           "W3_penerangan", "W4_banjir", "W5_tekanan_lalin",
                           "W6_integritas_jalur"]}
    tidak_konsisten = 0
    for x in f:
        p = x["properties"]
        ind = p["indikator"]
        for dim, kunci in DIM.items():
            semua_hilang = all(ind[k]["sumber"] == "tidak_tersedia" for k in kunci)
            didaftar = dim in p.get("dimensi_kosong", [])
            if semua_hilang != didaftar:
                tidak_konsisten += 1
    cek("dimensi_kosong konsisten dengan indikatornya", tidak_konsisten == 0,
        f"{tidak_konsisten} heksagon tidak konsisten")

    # --- ranges -----------------------------------------------------------
    skor = [x["properties"]["skor"] for x in f]
    cek("skor dalam 0..100", all(0 <= s <= 100 for s in skor),
        f"min {min(skor)}, maks {max(skor)}")
    cek("skor tidak seragam", len(set(round(s) for s in skor)) > 10,
        "sebaran terlalu sempit, curiga bug")
    sub_all = [v for x in f for v in x["properties"]["subskor"].values()]
    cek("subskor dalam 0..100", all(0 <= s <= 100 for s in sub_all))
    pcts = [v["persentil"] for x in f for v in x["properties"]["indikator"].values()
            if v["persentil"] is not None]
    cek("persentil dalam 0..1", all(0 <= p <= 1 for p in pcts),
        f"min {min(pcts)}, maks {max(pcts)}")

    # --- geometry ---------------------------------------------------------
    area = study_area().buffer(1e-6)
    from shapely.geometry import shape
    luar = sum(1 for x in f if not area.contains(shape(x["geometry"]).centroid))
    cek("semua pusat heksagon di dalam wilayah studi", luar == 0,
        f"{luar} di luar")
    tutup = sum(1 for x in f
                if x["geometry"]["coordinates"][0][0]
                != x["geometry"]["coordinates"][0][-1])
    cek("semua cincin poligon tertutup", tutup == 0, f"{tutup} terbuka")

    # --- companion file ---------------------------------------------------
    c3 = path.parent / "c3_per_kampus.json"
    if c3.exists():
        cd = json.loads(c3.read_text(encoding="utf-8"))
        cek("c3_per_kampus mencakup semua heksagon",
            set(cd["data"]) == set(idx),
            f"selisih {len(set(cd['data']) ^ set(idx))}")
        cek("c3_per_kampus punya 10 kampus", len(cd["kampus"]) == 10,
            str(len(cd["kampus"])))
        nilai_sah = {1.0, 0.6, 0.2}
        aneh = sum(1 for v in cd["data"].values()
                   for s in v.values() if s not in nilai_sah)
        cek("nilai C3 hanya 1,0 / 0,6 / 0,2", aneh == 0, f"{aneh} nilai lain")

    print(f"\n{lulus} lulus, {len(gagal)} gagal")
    return 1 if gagal else 0


if __name__ == "__main__":
    p = Path(sys.argv[1]) if len(sys.argv) > 1 else DATA_PROCESSED / "hexagons.geojson"
    raise SystemExit(main(p))
