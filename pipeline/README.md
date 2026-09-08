# pipeline/

Analisis spasial offline. Masukan: OSM, MAPID, Sentinel-2, survei lapangan.
Keluaran: `web/public/data/hexagons.geojson` sesuai
`contracts/hexagon.schema.json`.

Alasan di balik tiap keputusan — termasuk yang salah lalu diperbaiki — ada di
[`docs/PIPELINE_LOG.md`](../docs/PIPELINE_LOG.md).
Ringkasan untuk pembaca luar ada di
[`docs/METHODOLOGY.md`](../docs/METHODOLOGY.md).

## Pasang

```bash
pip install -r pipeline/requirements.txt
cp .env.example .env          # lalu isi kuncinya
earthengine authenticate      # sekali saja, untuk W2
```

Isi `.env` (berkas ini di-.gitignore; **jangan** mengisi `.env.example`):

| Kunci | Untuk |
|---|---|
| `MAPID_API_KEY_MISSION` | Activities API |
| `MAPID_API_KEY_DATA` | Open API layer geoserver |
| `MAPID_PROJECT_ID` | id proyek MAPID |
| `EE_PROJECT` | Google Earth Engine (W2) |

Beberapa layer MAPID **diekspor manual** ke `data/raw/mapid/`, bukan lewat API,
karena `get_layer` berplafon keras 200 fitur. Daftarnya di
[`docs/MAPID_UNDUH.md`](../docs/MAPID_UNDUH.md), kegunaan tiap layer di
[`docs/MAPID_PENGGUNAAN.md`](../docs/MAPID_PENGGUNAAN.md).

## Jalankan

```bash
python pipeline/run_all.py             # lewati langkah yang keluarannya sudah ada
python pipeline/run_all.py --force     # bangun ulang semuanya (~15-25 menit)
python pipeline/run_all.py --from 30   # mulai dari tahap indikator
python pipeline/run_all.py --dry-run   # lihat daftar langkah saja
```

Tiap langkah menyimpan cache-nya sendiri, jadi menjalankan ulang tanpa `--force`
hampir tidak melakukan apa-apa. Yang lama hanya unduhan OSM dan reduksi Earth
Engine.

Setelah hasilnya diperiksa, salin ke frontend:

```bash
cp data/processed/{hexagons,kampus,halte,kos,krl}.geojson \
   data/processed/c3_per_kampus.json web/public/data/
```

## Tahapan

| Tahap | Isi | Keluaran |
|---|---|---|
| `00_ingest/` | OSM, MAPID Activities | graf jalan kaki, halte, rute, stasiun |
| `10_clean/` | baca survei, geokode kos | 4 tabel survei, koordinat kos |
| `20_network/` | rute jalan kaki | C1, C2, C3, C4, W1 |
| `30_indicators/` | POI, raster, model | M1, M2, M4, A1, W2–W6 |
| `40_score/` | persentil, agregasi | `hexagons.geojson`, lapisan titik |

## Uji

```bash
python pipeline/tests/test_indicators.py                          # 26 uji logika
python pipeline/tests/validate_schema.py <geojson>                # kesesuaian skema
python pipeline/tests/test_keluaran.py [geojson]                  # 20 uji invarian
```

`run_all.py` menjalankan ketiganya di akhir. `test_keluaran.py` memeriksa hal
yang **lolos skema tapi tetap salah**: himpunan heksagon yang bergeser dari
indeks beku, skor yang tidak cocok dengan subskornya sendiri, `tidak_tersedia`
yang bocor jadi angka, atau geometri di luar wilayah studi.

## `common/`

Impor dari sini, jangan definisikan ulang konstanta per tahap.

- `paths` — lokasi berkas, `hex_index()` (2.134 sel beku), `study_area()`, `load_weights()`
- `geo` — CRS metrik EPSG:32749, helper H3
- `cache` — pemuat `.env`, lewati langkah yang sudah ada
- `indicators` — `ecdf_percentile()`, `indikator()`, `subskor()`, `skor_akhir()`

Tiga aturan kontrak ditegakkan di `indicators.py` dan tidak boleh diakali:

1. Normalisasi selalu **peringkat persentil ECDF**, bukan nilai absolut.
2. `tidak_tersedia` **dikeluarkan** dan bobot dinormalisasi ulang — di tingkat
   indikator maupun di tingkat dimensi. **Tidak ada imputasi 0,5.** Jangan
   pernah menulis `0` untuk "tidak tahu".
3. Skor akhir adalah **rata-rata geometrik terbobot** — satu dimensi mendekati
   nol menyeret total.

Konstruktor `indikator()` menolak rekaman yang melanggar aturan 2, jadi
pelanggaran gagal saat dibuat, bukan diam-diam masuk ke peta.

## Aturan tetap

- Semua jarak dihitung di **EPSG:32749 (UTM 49S)**, tidak pernah di 4326.
- Graf diunduh dengan **buffer 2 km** di luar batas studi, supaya heksagon tepi
  tidak tampak tak terjangkau hanya karena grafnya terpotong.
- `reference/hex_index.txt` **beku**. Jangan dibangkitkan ulang — `h3_index`
  adalah kunci join dengan frontend, dan himpunan sel yang sedikit berbeda akan
  memutus join tanpa error yang terlihat.
- Nama properti pada lapisan titik **mengikuti yang dibaca `PetaHeksagon.jsx`**.
  Mengubahnya memutus popup di peta.
