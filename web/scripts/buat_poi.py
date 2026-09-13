#!/usr/bin/env python3
"""Build web/public/data/poi.json -- the eating places and daily services
behind the Amenity indicators, grouped by the hexagon that contains them.

    python web/scripts/buat_poi.py

WHY THIS EXISTS. The map can already tell a reader that a hexagon scores 83 on
Fasilitas, but the obvious next question -- "so which eating places, and
where?" -- had no answer anywhere in the product. This file answers it from
the SAME MAPID layers the pipeline scores, so the list a user reads can never
disagree with the number that produced the score.

WHY GROUPED BY HEXAGON, AND WHY PYTHON. The detail panel only ever needs the
POIs of ONE hexagon. Shipping a flat point list would force the browser to
either load h3-js (a wasm dependency added for one panel) or scan 3,624
features on every click. Grouping here turns the client lookup into a single
object key, and lets us drop the geometry envelope entirely.

Membership uses h3.latlng_to_cell at resolution 9 -- the same call, same
resolution, and same library version the pipeline uses, so a POI lands in the
same cell the score was computed for.

CAVEAT WORTH KNOWING. M1/M2 count eating places within 800 m of the hexagon
CENTRE, not strictly inside the hexagon (see 30_indicators/01_amenity.py). This
file lists what is INSIDE the cell. The two therefore differ on purpose: the
list answers "what is here", the score answers "what is within walking
distance". The UI says so, and must keep saying so.
"""
import json
import sys
from collections import Counter
from pathlib import Path

import h3

AKAR = Path(__file__).resolve().parents[2]
REF = AKAR / "reference" / "mapid"
TUJUAN = AKAR / "web" / "public" / "data" / "poi.json"
HEX_INDEX = AKAR / "reference" / "hex_index.txt"

RES = 9

# Key is deliberately short: this file is downloaded by every user who opens a
# panel, and the category repeats on all 3,624 records.
SUMBER = [
    ("makanan_minuman_2025.geojson", "makan"),
    ("minimarket_2025.geojson", "minimarket"),
    ("apotek_2025.geojson", "apotek"),
    ("toko_kelontong_2025.geojson", "warung"),
]


def rapikan(teks):
    """MAPID ships ALL CAPS; title-case it so the panel does not shout."""
    if not isinstance(teks, str):
        return None
    t = " ".join(teks.split())
    if not t:
        return None
    if t != t.upper():
        return t
    return t.title()


def titik(geom):
    """Return (lon, lat) or None. A few layers ship MultiPoint."""
    if not geom:
        return None
    g = geom
    if g.get("type") == "MultiPoint" and g.get("coordinates"):
        c = g["coordinates"][0]
    elif g.get("type") == "Point":
        c = g.get("coordinates")
    else:
        return None
    if not isinstance(c, (list, tuple)) or len(c) < 2:
        return None
    try:
        lon, lat = float(c[0]), float(c[1])
    except (TypeError, ValueError):
        return None
    return lon, lat


def main() -> int:
    if not HEX_INDEX.exists():
        print(f"  ! {HEX_INDEX} tidak ada", file=sys.stderr)
        return 1
    # Only cells that are actually in the study area. A POI outside it has no
    # hexagon to attach to and would just bloat the file.
    sel_studi = {c.strip() for c in HEX_INDEX.read_text().split() if c.strip()}

    per_hex: dict[str, list] = {}
    luar = 0
    rusak = 0
    for berkas, kategori in SUMBER:
        jalur = REF / berkas
        if not jalur.exists():
            print(f"  ! lewati, tidak ada: {berkas}")
            continue
        data = json.loads(jalur.read_text(encoding="utf-8"))
        n = 0
        for f in data.get("features", []):
            p = titik(f.get("geometry"))
            if p is None:
                rusak += 1
                continue
            lon, lat = p
            # h3 takes (lat, lng) -- the REVERSE of GeoJSON's [lon, lat].
            sel = h3.latlng_to_cell(lat, lon, RES)
            if sel not in sel_studi:
                luar += 1
                continue
            prop = f.get("properties") or {}
            rec = {"n": rapikan(prop.get("NAMA")) or "Tanpa nama", "k": kategori}
            # Subtype only for eating places; the others are described well
            # enough by the category itself.
            if kategori == "makan":
                t = rapikan(prop.get("TIPE_2"))
                if t:
                    rec["t"] = t
            alamat = rapikan(prop.get("ALAMAT"))
            if alamat:
                rec["a"] = alamat
            rec["c"] = [round(lon, 5), round(lat, 5)]
            per_hex.setdefault(sel, []).append(rec)
            n += 1
        print(f"  {kategori:11s} {n:5d} titik di wilayah studi  ({berkas})")

    # Stable order inside each cell: eating places first, then alphabetical.
    urutan = {"makan": 0, "warung": 1, "minimarket": 2, "apotek": 3}
    for sel in per_hex:
        per_hex[sel].sort(key=lambda r: (urutan.get(r["k"], 9), r["n"]))

    total = sum(len(v) for v in per_hex.values())
    keluaran = {
        "metadata": {
            "catatan": (
                "POI penyusun indikator Fasilitas, dikelompokkan per heksagon. "
                "Dibuat web/scripts/buat_poi.py dari reference/mapid/. "
                "Berisi titik DI DALAM heksagon; skor M1/M2 memakai radius "
                "800 m dari pusat heksagon, jadi keduanya memang berbeda."
            ),
            "h3_resolution": RES,
            "jumlah_titik": total,
            "jumlah_heksagon": len(per_hex),
        },
        "per_heksagon": per_hex,
    }
    TUJUAN.write_text(json.dumps(keluaran, ensure_ascii=False), encoding="utf-8")

    kb = TUJUAN.stat().st_size / 1024
    cacah = Counter(r["k"] for v in per_hex.values() for r in v)
    print()
    print(f"  {total} titik di {len(per_hex)} heksagon; {luar} di luar wilayah studi, {rusak} geometri rusak")
    print(f"  sebaran kategori: {dict(cacah)}")
    isi = sorted((len(v) for v in per_hex.values()), reverse=True)
    print(f"  titik per heksagon: maks {isi[0]}, median {isi[len(isi)//2]}")
    print(f"  -> {TUJUAN.relative_to(AKAR)} ({kb:.0f} KB)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
