# pipeline/

Analisis spasial offline. Masukan: OSM, MAPID, GEE, survei lapangan.
Keluaran: `web/public/data/hexagons.geojson` sesuai `contracts/hexagon.schema.json`.

Catatan keputusan per fase ada di [`docs/PIPELINE_LOG.md`](../docs/PIPELINE_LOG.md).

## Pasang

```bash
pip install -r pipeline/requirements.txt
cp .env.example .env      # isi MAPID_API_KEY_MISSION
```

## Urutan jalan

| Tahap | Isi | Status |
|---|---|---|
| `00_ingest/` | Unduh OSM, MAPID POI, halte, rute, KRL, GEE, InaRISK | belum |
| `10_clean/` | Baca `Hasil_Survei_BERSIH.xlsx`, aturan nol struktural W6 | belum |
| `20_network/` | Graf jalan kaki, C1–C4, W1 | belum |
| `30_indicators/` | A1–A2, M1–M4, W2–W6 | belum |
| `40_score/` | Persentil ECDF, subskor, skor geometrik, tulis GeoJSON | belum |

Validasi setiap kali menghasilkan berkas baru, **sebelum** menyalin ke `web/`:

```bash
python pipeline/tests/validate_schema.py data/processed/hexagons.geojson
```

## `common/`

Modul bersama. Impor dari sini, jangan definisikan ulang konstanta per tahap.

- `paths` — lokasi berkas, `hex_index()` (2.134 sel beku), `study_area()`, `load_weights()`
- `geo` — CRS metrik EPSG:32749, helper H3
- `indicators` — `ecdf_percentile()`, `indikator()`, `subskor()`, `skor_akhir()`

Tiga aturan kontrak ditegakkan di `indicators.py` dan tidak boleh diakali:

1. Normalisasi selalu **peringkat persentil ECDF**, bukan nilai absolut.
2. `tidak_tersedia` dikeluarkan dari skor dan bobotnya dinormalisasi ulang di dalam
   dimensinya. **Tidak ada imputasi 0,5.** Jangan pernah menulis `0` untuk "tidak tahu".
3. Skor akhir adalah **rata-rata geometrik terbobot** — satu dimensi mendekati nol
   menyeret total, berapa pun dimensi lain.

## Aturan tetap

- Semua jarak dihitung di **EPSG:32749 (UTM 49S)**, tidak pernah di 4326.
- Graf rute di-buffer ~2 km di luar batas studi sebelum dipotong, supaya heksagon
  tepi tidak tampak tak terjangkau.
- `reference/hex_index.txt` **beku**. Jangan dibangkitkan ulang.
