"""Render jaringan jalan Sleman jadi satu berkas SVG statis untuk latar beranda.

Dijalankan SEKALI secara manual, bukan saat build dan bukan saat runtime:

    python web/scripts/buat_tekstur_jalan.py

Sumbernya graf jalan kaki OSM yang sudah dipakai pipeline
(`data/interim/walk_graph.graphml`, ~70 MB). Keluarannya
`web/public/tekstur-jalan.svg`, hanya garis, tanpa isian, label, atau penanda.

Graf dibaca dengan iterparse, bukan networkx: yang dibutuhkan cuma koordinat
simpul, pasangan ujung tiap sisi, dan tag `highway` — tidak perlu membangun
objek graf lengkap di memori.

Keluarannya TIGA <path>, satu per kelas jalan (utama / menengah / kecil),
masing-masing dengan `class` sendiri. Ketebalan dan warnanya ditentukan CSS,
bukan di sini, supaya bisa diubah tanpa membangkitkan ulang berkas 70 MB.
Tiap path juga membawa `pathLength="1"` agar animasi stroke-dashoffset bisa
memakai angka 0..1 tanpa perlu mengukur panjang nyata di runtime.
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

# Ambang panjang segmen per kelas. Jalan utama dipertahankan sampai yang
# pendek karena justru merekalah rangka teksturnya; jalan kecil disaring
# lebih keras supaya ukuran berkas tetap masuk akal.
AMBANG = {"utama": 2.0, "menengah": 4.0, "kecil": 11.0}

# Tag highway OSM -> kelas tekstur.
KELAS = {
    "motorway": "utama",
    "trunk": "utama",
    "primary": "utama",
    "motorway_link": "utama",
    "trunk_link": "utama",
    "primary_link": "utama",
    "secondary": "menengah",
    "tertiary": "menengah",
    "secondary_link": "menengah",
    "tertiary_link": "menengah",
}


def kelas_jalan(teks):
    """Tag highway bisa berupa string atau daftar Python yang di-str().

    Kalau daftar, kelas paling tinggi yang menang.
    """
    if not teks:
        return "kecil"
    t = teks.strip()
    if t.startswith("["):
        # "['living_street', 'residential']"
        isi = [b.strip(" '\"") for b in t.strip("[]").split(",")]
        peringkat = [KELAS.get(b, "kecil") for b in isi]
        for k in ("utama", "menengah"):
            if k in peringkat:
                return k
        return "kecil"
    return KELAS.get(t, "kecil")


def kunci_atribut():
    """Cari id key untuk x/y pada simpul dan highway pada sisi."""
    kx = ky = kh = None
    for _, el in ET.iterparse(GRAF, events=("start",)):
        if el.tag == f"{NS}key":
            if el.get("for") == "node":
                if el.get("attr.name") == "x":
                    kx = el.get("id")
                elif el.get("attr.name") == "y":
                    ky = el.get("id")
            elif el.get("for") == "edge" and el.get("attr.name") == "highway":
                kh = el.get("id")
        if el.tag == f"{NS}graph":
            break
    return kx, ky, kh


def baca_graf(kx, ky, kh):
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
            hw = None
            for d in el.findall(f"{NS}data"):
                if d.get("key") == kh:
                    hw = d.text
            sisi.append((el.get("source"), el.get("target"), kelas_jalan(hw)))
            el.clear()
    return simpul, sisi


def main():
    if not GRAF.exists():
        raise SystemExit(f"Graf tidak ditemukan: {GRAF}")

    kx, ky, kh = kunci_atribut()
    if not kx or not ky:
        raise SystemExit("Tidak menemukan key koordinat x/y pada graphml.")

    simpul, sisi = baca_graf(kx, ky, kh)
    print(f"simpul: {len(simpul):,} | sisi: {len(sisi):,}")

    span_lon = LON_MAKS - LON_MIN
    span_lat = LAT_MAKS - LAT_MIN
    # Koreksi proyeksi sederhana agar bentuknya tidak gepeng di lintang -7,7.
    tinggi = round(LEBAR * (span_lat / span_lon) / 0.99)

    def proyeksi(x, y):
        return (
            (x - LON_MIN) / span_lon * LEBAR,
            (LAT_MAKS - y) / span_lat * tinggi,
        )

    garis = {"utama": [], "menengah": [], "kecil": []}
    terlihat = set()
    dilewati = 0

    for a, b, kelas in sisi:
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
        ambang = AMBANG[kelas]
        if abs(x1 - x2) < ambang and abs(y1 - y2) < ambang:
            continue
        kunci = (kelas, round(x1), round(y1), round(x2), round(y2))
        if kunci in terlihat:
            continue
        terlihat.add(kunci)
        garis[kelas].append(
            f"M{kunci[1]} {kunci[2]}L{kunci[3]} {kunci[4]}"
        )

    for k, v in garis.items():
        print(f"  {k:9s}: {len(v):,} garis")
    print(f"di luar batas: {dilewati:,}")

    # Urutan path: kecil dulu, utama terakhir, supaya jalan utama menimpa.
    bagian = "".join(
        f'<path class="jalan-{k}" pathLength="1" d="{"".join(garis[k])}"/>'
        for k in ("kecil", "menengah", "utama")
        if garis[k]
    )
    svg = (
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {LEBAR} {tinggi}" '
        f'fill="none" stroke="currentColor" stroke-linecap="round">'
        f"{bagian}</svg>"
    )
    KELUARAN.parent.mkdir(parents=True, exist_ok=True)
    KELUARAN.write_text(svg, encoding="utf-8")
    kb = KELUARAN.stat().st_size / 1024
    print(f"ditulis: {KELUARAN} ({kb:.0f} KB, viewBox {LEBAR}x{tinggi})")


if __name__ == "__main__":
    main()
