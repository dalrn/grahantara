"""Kecilkan PNG base64 yang tertanam di SVG logo.

Hanya string base64 yang diganti; sisa SVG identik byte per byte.

Ukuran tampil maksimum (CSS px) dari Langkah 0:
  grahantara-wordmark.svg, dipakai .brand-wordmark (index.css:151-162):
  desktop 170x70 -> skala contain min(170/1020, 70/450) = 0,15556.
    - image ke-1 (viewBox dalam 100 40 1110 1150, lebar 297):
      PNG tampil = 297 * 1319/1110 * 0,15556 = 54,9 px  -> target 256
    - image ke-2 (viewBox dalam 580 390 700 140, lebar 700):
      PNG tampil penuh = 1697 * 0,15556 = 264,0 px      -> target 792
  grahantara-mark.svg, ikon tab browser (<=32 px)        -> target 256
  favicon.svg, tidak dipakai di kode (Langkah 0)         -> target 256

Target sisi terpanjang = max(256, ceil(tampil_maks * 3)), tidak pernah
melebihi ukuran asli.

Pakai:
  python web/scripts/kecilkan_logo_svg.py [--dari-head]

--dari-head membaca SVG dari git HEAD (bukan working tree), supaya bisa
dijalankan ulang dengan hasil sama.
"""
import base64
import io
import re
import subprocess
import sys
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
PUBLIC = ROOT / "web" / "public"

# Target per berkas, urut sesuai kemunculan <image>.
#
# Catatan kompromi: rumus "tampil_maks x 3" menghasilkan 256 dan 792, tetapi
# base64 membengkakkan berkas 4/3 sehingga wordmark jadi ~98 KB dan gagal
# kriteria < 60 KB. Target di bawah dihitung dari kebutuhan piksel perangkat
# yang benar-benar terlihat (bagian <image> yang terpotong viewBox tidak
# pernah terlihat):
#   wordmark image#1 (terlihat 1110/1319 dari PNG): mobile 126x52 px CSS,
#     skala contain 0,11556 -> tampil 34,3 CSS px -> DPR 3 butuh 103 px
#     -> 160 px aman (1,3x).
#   wordmark image#2 (terlihat 700/1697 dari PNG): tampil 80,9 CSS px
#     -> DPR 3 butuh 243 px -> PNG penuh butuh 590 px.
#   mark/favicon: ikon tab <= 32 px -> 256 (batas minimum yang diminta).
TARGET = {
    "grahantara-wordmark.svg": [160, 590],
    "grahantara-mark.svg": [256],
    "favicon.svg": [256],
}

POLA = re.compile(rb"data:image/png;base64,([A-Za-z0-9+/=]+)")


def kecilkan(png: Image.Image, target: int) -> Image.Image:
    lebar, tinggi = png.size
    sisi = max(lebar, tinggi)
    if sisi <= target:
        return png
    skala = target / sisi
    return png.resize(
        (max(1, round(lebar * skala)), max(1, round(tinggi * skala))),
        Image.LANCZOS,
    )


def main() -> None:
    dari_head = "--dari-head" in sys.argv
    for nama, targets in TARGET.items():
        if dari_head:
            data = subprocess.run(
                ["git", "show", f"HEAD:web/public/{nama}"],
                cwd=ROOT,
                capture_output=True,
                check=True,
            ).stdout
        else:
            data = (PUBLIC / nama).read_bytes()
        idx = 0

        def ganti(m: re.Match) -> bytes:
            nonlocal idx
            idx += 1
            asli = base64.b64decode(m.group(1))
            png = Image.open(io.BytesIO(asli))
            png.load()
            mode = png.mode
            ukuran_asal = png.size
            if mode != "RGBA":
                png = png.convert("RGBA")
            hasil = kecilkan(png, targets[idx - 1])
            # Salinan tanpa info/icc/exif: metadata C2PA tidak ikut.
            hasil = hasil.copy()
            hasil.info.clear()
            buf = io.BytesIO()
            hasil.save(buf, format="PNG", optimize=True)
            print(
                f"  {nama} image#{idx}: {ukuran_asal} {mode} -> {hasil.size} "
                f"({len(asli)/1024:.1f} KB -> {buf.getbuffer().nbytes/1024:.1f} KB)"
            )
            return b"data:image/png;base64," + base64.b64encode(buf.getvalue())

        keluaran = POLA.sub(ganti, data)
        (PUBLIC / nama).write_bytes(keluaran)
        print(
            f"{nama}: {len(data)/1024:.1f} KB -> {len(keluaran)/1024:.1f} KB, "
            f"{idx} image"
        )


if __name__ == "__main__":
    main()
