"""Render jaringan jalan Sleman jadi satu berkas SVG statis untuk latar beranda.

Dijalankan SEKALI secara manual, bukan saat build dan bukan saat runtime:

    python web/scripts/buat_tekstur_jalan.py

Sumbernya graf jalan kaki OSM yang sudah dipakai pipeline
(`data/interim/walk_graph.graphml`, ~70 MB). Keluarannya
`web/public/tekstur-jalan.svg`, hanya garis, tanpa isian, label, atau penanda.

Graf dibaca dengan iterparse, bukan networkx: yang dibutuhkan cuma koordinat
simpul dan pasangan ujung tiap sisi, sehingga tidak perlu membangun objek graf
lengkap di memori.

Warnanya TIDAK ditulis di sini. SVG memakai `stroke="currentColor"` supaya
warna garis diwarisi dari CSS, yang mengambilnya dari token di design.js.
"""

import xml.etree.ElementTree as ET
from pathlib import Path

AKAR = Path(__file__).resolve().parents[2]
GRAF = AKAR / "data" / "interim" / "walk_graph.graphml"
KELUARAN = AKAR / "web" / "public" / "tekstur-jalan.svg"

NS = "{http://graphml.graphdrawing.org/xmlns}"

# Batas wilayah studi, sama dengan BATAS di PetaHeksagon/PetaHero. Simpul di
# luar ini dibuang supaya tekstur tidak memanjang ke buffer 2 km.
LON_MIN, LAT_MIN = 110.334, -7.837
LON_MAKS, LAT_MAKS = 110.473, -7.643

LEBAR = 1600  # satuan viewBox; rasio mengikuti bentang wilayah studi
# Segmen lebih pendek dari ini (dalam satuan viewBox) dibuang. Pada opasitas
# sangat rendah detail sehalus itu tidak terlihat, tapi sangat menaikkan
# ukuran berkas.
AMBANG_PX = 10.0


def kunci_atribut():
    """Cari id key untuk atribut x dan y pada simpul."""
    kx = ky = None
    for _, el in ET.iterparse(GRAF, events=("start",)):
        if el.tag == f"{NS}key" and el.get("for") == "node":
            if el.get("attr.name") == "x":
                kx = el.get("id")
            elif el.get("attr.name") == "y":
                ky = el.get("id")
        if el.tag == f"{NS}graph":
            break
    return kx, ky


def baca_graf(kx, ky):
    simpul = {}
    sisi = []
    for _, el in ET.iterparse(GRAF, events=("end",)):
        if el.tag == f"{NS}node":
            x = y = None
            for d in el.findall(f"{NS}data"):
                if d.get("key") == kx:
                    x = float(d.text)
                elif d.get("key") == ky:
                    y = float(d.text)
            if x is not None and y is not None:
                simpul[el.get("id")] = (x, y)
            el.clear()
        elif el.tag == f"{NS}edge":
            sisi.append((el.get("source"), el.get("target")))
            el.clear()
    return simpul, sisi


def main():
    if not GRAF.exists():
        raise SystemExit(f"Graf tidak ditemukan: {GRAF}")

    kx, ky = kunci_atribut()
    if not kx or not ky:
        raise SystemExit("Tidak menemukan key koordinat x/y pada graphml.")

    simpul, sisi = baca_graf(kx, ky)
    print(f"simpul: {len(simpul):,} | sisi: {len(sisi):,}")

    span_lon = LON_MAKS - LON_MIN
    span_lat = LAT_MAKS - LAT_MIN
    # Koreksi proyeksi sederhana agar bentuknya tidak gepeng di lintang -7,7.
    tinggi = round(LEBAR * (span_lat / span_lon) / 0.99)

    def proyeksi(x, y):
        px = (x - LON_MIN) / span_lon * LEBAR
        py = (LAT_MAKS - y) / span_lat * tinggi
        return px, py

    garis = []
    terlihat = set()
    dilewati = 0
    for a, b in sisi:
        pa, pb = simpul.get(a), simpul.get(b)
        if not pa or not pb:
            continue
        if not (LON_MIN <= pa[0] <= LON_MAKS and LAT_MIN <= pa[1] <= LAT_MAKS):
            dilewati += 1
            continue
        if not (LON_MIN <= pb[0] <= LON_MAKS and LAT_MIN <= pb[1] <= LAT_MAKS):
            dilewati += 1
            continue
        x1, y1 = proyeksi(*pa)
        x2, y2 = proyeksi(*pb)
        # Pada opasitas 3-6% detail halus tidak terlihat sama sekali; yang
        # tersisa hanya menambah ukuran berkas. Segmen pendek dibuang dan
        # koordinat dibulatkan ke bilangan bulat.
        if abs(x1 - x2) < AMBANG_PX and abs(y1 - y2) < AMBANG_PX:
            continue
        kunci = (round(x1), round(y1), round(x2), round(y2))
        if kunci in terlihat:
            continue
        terlihat.add(kunci)
        garis.append(f"M{kunci[0]} {kunci[1]}L{kunci[2]} {kunci[3]}")

    print(f"garis dipakai: {len(garis):,} | di luar batas: {dilewati:,}")

    d = "".join(garis)
    svg = (
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {LEBAR} {tinggi}" '
        f'preserveAspectRatio="xMidYMid slice" fill="none" '
        f'stroke="currentColor" stroke-width="0.7" stroke-linecap="round">'
        f'<path d="{d}"/></svg>'
    )
    KELUARAN.parent.mkdir(parents=True, exist_ok=True)
    KELUARAN.write_text(svg, encoding="utf-8")
    kb = KELUARAN.stat().st_size / 1024
    print(f"ditulis: {KELUARAN} ({kb:.0f} KB, viewBox {LEBAR}x{tinggi})")


if __name__ == "__main__":
    main()
