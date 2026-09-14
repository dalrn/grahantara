#!/usr/bin/env python3
"""Build web/public/data/aktivitas.json from the survey Activities.

    python web/scripts/buat_aktivitas.py

Activities are field documentation from MAPID Apps: a title, a description,
photos, and a point. They carry no numeric fields, so they are not an indicator
source. What they can do is tell the narrative layer which hexagons the team
actually visited.

The raw description is NOT shipped. The AI endpoints work on facts computed on
the server, never on free text, and a 457-character description would reopen
exactly the hole the prompt rules close: names and numbers the model could
quote as if they were scores. This script therefore reduces each hexagon to
counts and a coarse type, and the client never sees the prose.

Output: web/public/data/aktivitas.json
"""
import json
import re
import sys
from collections import Counter, defaultdict
from pathlib import Path

import h3
import pandas as pd
from shapely import wkb, wkt

AKAR = Path(__file__).resolve().parents[2]
SUMBER = AKAR / "data" / "interim" / "activities.parquet"
TUJUAN = AKAR / "web" / "public" / "data" / "aktivitas.json"
HEX_INDEX = AKAR / "reference" / "hex_index.txt"
H3_RES = 9

# Judul aktivitas jatuh ke dua kelompok: titik tempat (warung, penginapan,
# bengkel) dan ruas jalan. Keduanya menjawab pertanyaan berbeda, jadi dibedakan.
POLA_RUAS = re.compile(
    r"^(jl\.?|jalan|gang|gg\.?|ruas|terusan|lanjutan|portal|simpang|perempatan)\b",
    re.IGNORECASE,
)


def jenis(judul: str) -> str:
    return "ruas_jalan" if POLA_RUAS.match(judul.strip()) else "tempat"


def ke_titik(geom):
    """Geometri parquet -> (lat, lon), atau None bila tidak terbaca."""
    try:
        g = wkb.loads(bytes(geom)) if isinstance(geom, (bytes, bytearray)) else wkt.loads(str(geom))
    except Exception:
        return None
    if g.is_empty:
        return None
    p = g if g.geom_type == "Point" else g.centroid
    return (p.y, p.x)


def main() -> int:
    if not SUMBER.exists():
        print(f"  {SUMBER} tidak ada. Jalankan pipeline/00_ingest/04_activities.py dulu.")
        return 1

    df = pd.read_parquet(SUMBER)
    cells = set(HEX_INDEX.read_text(encoding="utf-8").split())

    per_hex = defaultdict(lambda: {"tempat": 0, "ruas_jalan": 0, "foto": 0})
    di_luar = 0
    tak_terbaca = 0

    for row in df.itertuples(index=False):
        titik = ke_titik(row.geometry)
        if titik is None:
            tak_terbaca += 1
            continue
        h3i = h3.latlng_to_cell(titik[0], titik[1], H3_RES)
        if h3i not in cells:
            di_luar += 1
            continue
        rec = per_hex[h3i]
        rec[jenis(row.title or "")] += 1
        rec["foto"] += int(getattr(row, "n_media", 0) or 0)

    hasil = {
        "metadata": {
            "catatan": (
                "Ringkasan dokumentasi survei lapangan per heksagon. Hanya cacah "
                "dan jenis; deskripsi dan foto tidak disertakan. Dipakai lapisan "
                "temuan untuk menandai kawasan yang benar-benar dikunjungi tim."
            ),
            "h3_resolution": H3_RES,
            "jumlah_aktivitas": int(len(df) - tak_terbaca - di_luar),
            "jumlah_heksagon": len(per_hex),
        },
        "per_heksagon": {k: dict(v) for k, v in sorted(per_hex.items())},
    }

    TUJUAN.parent.mkdir(parents=True, exist_ok=True)
    TUJUAN.write_text(json.dumps(hasil, ensure_ascii=False), encoding="utf-8")

    total = sum(v["tempat"] + v["ruas_jalan"] for v in per_hex.values())
    cacah = Counter(
        "tempat" if v["tempat"] >= v["ruas_jalan"] else "ruas_jalan"
        for v in per_hex.values()
    )
    print(f"  {total} aktivitas di {len(per_hex)} heksagon "
          f"({100 * len(per_hex) / len(cells):.1f}% dari {len(cells)})")
    print(f"  dominan tempat: {cacah['tempat']}  dominan ruas jalan: {cacah['ruas_jalan']}")
    if di_luar:
        print(f"  {di_luar} aktivitas di luar wilayah studi, dilewati")
    if tak_terbaca:
        print(f"  {tak_terbaca} geometri tidak terbaca, dilewati")
    print(f"  -> {TUJUAN.relative_to(AKAR)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
