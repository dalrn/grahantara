# reference/

Hand-curated pipeline **inputs**. Unlike `data/`, this directory **is committed** —
these files are small, were made by hand, and the pipeline cannot be reproduced
without them.

## `kampus_gerbang_10.geojson` — CANONICAL

219 campus gate points across 10 campuses, extracted from OSM nodes tagged
`barrier=gate` (196) or `entrance=yes` (24).

This is the C3 input. C3 asks "does the nearest halte actually take you to *your*
campus", which requires real entry points — a campus centroid would put the gate
in the middle of a field.

| Campus | Gates |
|---|---|
| UGM | 106 |
| UNY | 56 |
| UII Kaliurang | 15 |
| UIN Sunan Kalijaga | 8 |
| UPN Veteran | 8 |
| STIE YKPN | 7 |
| Instiper | 6 |
| AMIKOM | 5 |
| Atma Jaya Babarsari | 4 |
| Sanata Dharma III | 4 |

**Duplicate `osm_node` values are intentional.** Nodes `12317733863` and
`12335959201` sit on the shared UGM/UNY boundary and serve both campuses, so they
appear twice with different `kampus`. Deduplicate on `(osm_node, kampus)`, never
on `osm_node` alone.

## `kampus_gerbang_103.geojson` — SUPERSEDED

Earlier draft (2026-07-16), 103 gates, 9 campuses. Kept for provenance only.
All 101 of its unique nodes are a strict subset of the canonical file, it is
missing UIN Sunan Kalijaga entirely, and it badly under-covers the large
campuses (UGM 42 vs 106, UNY 25 vs 56, UII 2 vs 15). **Do not read this file.**

## `hex_index.txt` — FROZEN

The 2,134 canonical H3 resolution-9 cells, one per line, sorted.

This is the primary key shared with the frontend. It is **frozen**: derived once
from the stub `hexagons.geojson` and never regenerated. Regenerating it from a
boundary polygon would risk a slightly different cell set, which would silently
desynchronise every `h3_index` join in `web/`.

Verified: 2,134 unique cells, all valid, all resolution 9, forming a single
connected component.

## `study_area.geojson` — DERIVED

The 2,134 hexagons dissolved into one boundary polygon. 213,19 km².
Bounds: lon 110,3341…110,4727 · lat −7,8371…−7,6433.

Use this to clip every OSM and raster download. For **routing graphs**, buffer it
by ~2 km first — clipping a walk graph to the analysis boundary makes edge
hexagons look unreachable when in reality the path just leaves and re-enters.

---

## `mapid/` — enam layer MAPID yang WAJIB ada

Ditambahkan 2026-09-09. Sebelumnya keenam berkas ini hanya hidup di
`data/raw/mapid/` yang di-.gitignore, sehingga **pipeline tidak bisa dijalankan
ulang oleh siapa pun selain pemilik mesin aslinya**.

| Berkas | Ukuran | Dipakai |
|---|---|---|
| `makanan_minuman_2025.geojson` | 1,06 MB | **M1, M2** |
| `toko_kelontong_2025.geojson` | 0,69 MB | **M4** (warung) |
| `bahaya_banjir.geojson` | 0,42 MB | **W4** |
| `apotek_2025.geojson` | 0,27 MB | **M4** |
| `minimarket_2025.geojson` | 0,22 MB | **M4** |
| `nighttime_light_2023.geojson` | 0,16 MB | **W3** |

Totalnya 2,9 MB — lebih kecil daripada PRD yang sudah ada di `docs/`.

**Kenapa ini dilacak git padahal `data/` tidak.** Aturan 3 CLAUDE.md melarang
commit `data/` karena isinya dump mentah yang bisa diunduh ulang. Keenam berkas
ini **tidak bisa** diunduh ulang: Open API MAPID `get_layer` berplafon keras 200
fitur, sedangkan `makanan_minuman` saja berisi 1.712. Semuanya **diekspor manual
dari UI MAPID**. Kalau hilang, M1, M2, M4, W3, dan W4 tidak bisa dihitung ulang.

Sama alasannya dengan berkas gerbang kampus di direktori ini: masukan hasil
kurasi tangan, bukan data mentah.

## `Hasil_Survei_BERSIH.xlsx`

Seluruh data survei lapangan tim: 84 ruas, 12 halte, 12 titik ekonomi, 31 kos.
Sumber tunggal untuk W5, W6, A1, dan M3.

Kolom I-1..I-5, `Bobot terpakai`, `W-6 integritas`, dan `W-6 status` adalah
**rumus Excel hidup** yang membaca sheet `Panduan_W6`, bukan nilai statis. Kalau
menyunting berkas ini lewat kode, ubah **hanya kolom sumber** — menulis nilai ke
kolom rumus akan merusak logika workbook.

## Bagaimana pipeline memilih berkas

`pipeline/common/paths.py` menyediakan `masukan(nama)` yang mencari berurutan:

```
reference/mapid/  →  reference/  →  data/raw/mapid/  →  data/raw/  →  data/processed/
```

`reference/` menang lebih dulu, sehingga salinan yang dilacak git selalu dipakai
dan suntingan liar di `data/` tidak bisa diam-diam mengubah hasil.
