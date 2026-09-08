# Daftar Layer MAPID yang Perlu Diekspor

Belum pernah ada daftar seperti ini. `DATA_DICTIONARY.md` hanya menyebut "POI
premium MAPID yang menutupi seluruh wilayah studi" tanpa merinci layer mana.
Dokumen ini merinci apa yang benar-benar dibutuhkan tiap indikator.

## Kenapa harus ekspor manual

Open API `get_layer` **berplafon 200 fitur**. Dikonfirmasi: `page=2` mengembalikan
hasil identik byte per byte, dan semua parameter paginasi tidak berpengaruh.
Layer di bawah 200 aman (HALTE 87, KOS 60 — jumlah aslinya), tetapi layer besar
akan terpotong diam-diam.

Karena itu **layer besar wajib diekspor manual sebagai CSV/GeoJSON dari UI
MAPID**, bukan diambil lewat API. Simpan hasilnya di `data/raw/mapid/`.

## Konvensi penyimpanan

```
data/raw/mapid/<nama_pendek>.geojson
```

Huruf kecil, tanpa spasi, tanpa tanggal impor. Seluruh `data/` di-.gitignore.

## Sudah ada

| Berkas | Fitur | Di wilayah studi | Catatan |
|---|---|---|---|
| `halte_sleman_2025.geojson` | 87 | 74 | pembanding halte OSM |
| `kos_sleman_2025.geojson` | 60 | 51 | **tidak ada field harga** |

**Penting soal KOS.** Layer ini berisi lokasi (nama, alamat, telepon, status
buka), **bukan harga**. Jadi ia tidak bisa menjadi label pelatihan untuk A1.
Kegunaannya hanya sebagai kovariat — kepadatan kos per heksagon. Label harga
tetap hanya berasal dari 31 kos hasil survei.

## Yang masih dibutuhkan

Urut berdasarkan dampak. Semua harus dari kategori **Sleman**.

### Prioritas 1 — memblokir Amenity (M1, M2, M4)

| Kebutuhan | Etalase MAPID | Dipakai |
|---|---|---|
| **Tempat makan** — warung, rumah makan, resto, kafe, kaki lima | Makanan dan Minuman (2.491) | **M1** kepadatan, **M2** keragaman |
| **Minimarket** — Indomaret dsb. | Retail (19.980) | **M4** |
| **Apotek** | Kesehatan (7.206) | **M4** |

M1 dan M2 adalah 55% dimensi Amenity dan sepenuhnya bergantung pada layer
tempat makan. Ini ekspor paling penting.

Untuk M2 (entropi Shannon keragaman kuliner), **pertahankan kolom `TIPE_1`,
`TIPE_2`, `TIPE_3`**. Hierarki tipe itulah yang menjadi kategori keragaman.
Tanpa kolom itu M2 tidak bisa dihitung.

### Prioritas 2 — memperkuat indikator yang sudah jalan

| Kebutuhan | Etalase | Dipakai |
|---|---|---|
| Fotokopi, laundry, layanan harian lain | Retail / Sosial | memperluas **M4** |
| Kampus / pendidikan tinggi | Sosial (23.254) | pembanding 219 gerbang |
| Apartemen, penginapan | Perumahan (4.063) | kovariat **A1** |

### Prioritas 3 — opsional

| Kebutuhan | Etalase | Dipakai |
|---|---|---|
| Demografi desa | sudah ada di proyek (86 poligon, 110 field) | konteks, bukan skor |
| Transportasi lain | Transportasi (5.599) | pembanding |

## Yang TIDAK dibutuhkan

- **SITE SELECTION SLEMAN** — hasil skoring pihak lain. Memakainya berisiko
  melingkar: menilai kawasan memakai penilaian orang lain atas kawasan yang sama.
- **Layer Cyberjaya** — Malaysia, di luar wilayah studi.
- **Harga makan (A2)** — tidak ada layer harga di MAPID sejauh ini. A2 kemungkinan
  besar tetap `tidak_tersedia` kecuali Menu Go menutupinya.

## Cara ekspor

1. Buka layer di MAPID, gunakan menu ekspor (CSV atau GeoJSON).
2. Simpan ke `data/raw/mapid/` dengan nama pendek huruf kecil.
3. Beri tahu — pipeline akan membacanya, tidak perlu lewat API.

Kalau UI membatasi ekspor per wilayah, cukup Kabupaten Sleman. Wilayah studi
hanya 213 km² di dalam Sleman, jadi ekspor tingkat kabupaten sudah lebih dari
cukup.
