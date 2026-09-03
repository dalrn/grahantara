#!/usr/bin/env python3
"""Validasi hexagons.geojson terhadap contracts/hexagon.schema.json.

Pakai:
    python pipeline/tests/validate_schema.py web/public/data/hexagons.geojson

Jalankan ini setiap kali pipeline menghasilkan file baru, sebelum menyalinnya ke
web/public/data/. Kalau ini gagal, frontend Devon akan rusak.
"""
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SCHEMA = ROOT / "contracts" / "hexagon.schema.json"

INDIKATOR_WAJIB = [
    "C1_jarak_halte", "C2_rute_unik", "C3_keterjangkauan_kampus", "C4_jarak_krl",
    "A1_harga_kos", "A2_harga_makan",
    "M1_kepadatan_makan", "M2_keragaman", "M3_keramaian", "M4_layanan_harian",
    "W1_kerapatan_simpang", "W2_keteduhan", "W3_penerangan", "W4_banjir",
    "W5_tekanan_lalin", "W6_integritas_jalur",
]
SUMBER_SAH = {"survei", "mapid_poi", "osm", "sentinel2", "viirs", "inarisk",
              "krl", "model", "tidak_tersedia"}
SUBSKOR = ["connectivity", "affordability", "amenity", "walkability"]


def main(path: str) -> int:
    data = json.loads(Path(path).read_text())
    errs, warns = [], []

    meta = data.get("metadata", {})
    if meta.get("h3_resolution") != 9:
        errs.append("metadata.h3_resolution harus 9")
    if str(meta.get("versi", "")).startswith("stub"):
        warns.append(f"file ini masih STUB (versi={meta.get('versi')})")

    feats = data.get("features", [])
    if meta.get("jumlah") != len(feats):
        errs.append(f"metadata.jumlah={meta.get('jumlah')} tapi ada {len(feats)} feature")

    seen = set()
    for i, f in enumerate(feats):
        p = f.get("properties", {})
        h3i = p.get("h3_index")
        tag = h3i or f"#{i}"

        if not h3i or len(h3i) != 15:
            errs.append(f"{tag}: h3_index tidak valid")
        elif h3i in seen:
            errs.append(f"{tag}: h3_index duplikat")
        seen.add(h3i)

        skor = p.get("skor")
        if not isinstance(skor, (int, float)) or not 0 <= skor <= 100:
            errs.append(f"{tag}: skor di luar 0-100 ({skor})")

        sub = p.get("subskor", {})
        for k in SUBSKOR:
            v = sub.get(k)
            if not isinstance(v, (int, float)) or not 0 <= v <= 100:
                errs.append(f"{tag}: subskor.{k} tidak valid ({v})")

        ind = p.get("indikator", {})
        for k in INDIKATOR_WAJIB:
            if k not in ind:
                errs.append(f"{tag}: indikator {k} hilang")
                continue
            d = ind[k]
            s = d.get("sumber")
            if s not in SUMBER_SAH:
                errs.append(f"{tag}.{k}: sumber tidak dikenal '{s}'")
            pct = d.get("persentil")
            if s == "tidak_tersedia":
                if d.get("nilai") is not None or pct is not None:
                    errs.append(f"{tag}.{k}: sumber=tidak_tersedia tapi nilai/persentil terisi")
            else:
                if pct is None or not 0 <= pct <= 1:
                    errs.append(f"{tag}.{k}: persentil di luar 0-1 ({pct})")

        geom = f.get("geometry", {})
        if geom.get("type") != "Polygon":
            errs.append(f"{tag}: geometry bukan Polygon")
        else:
            ring = geom["coordinates"][0]
            if ring[0] != ring[-1]:
                errs.append(f"{tag}: cincin poligon tidak tertutup")
            lon, lat = ring[0]
            if not (109 < lon < 112 and -8.5 < lat < -7):
                errs.append(f"{tag}: koordinat di luar DIY — cek urutan lon/lat")

    for w in warns:
        print(f"  PERINGATAN  {w}")
    if errs:
        print(f"\nGAGAL — {len(errs)} kesalahan\n")
        for e in errs[:40]:
            print("  -", e)
        if len(errs) > 40:
            print(f"  ... dan {len(errs) - 40} lagi")
        return 1
    print(f"\nLOLOS — {len(feats)} heksagon, {len(INDIKATOR_WAJIB)} indikator, schema cocok\n")
    return 0


if __name__ == "__main__":
    if len(sys.argv) != 2:
        print(__doc__)
        sys.exit(2)
    sys.exit(main(sys.argv[1]))
