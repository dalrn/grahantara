# Konteks untuk asisten AI

Repo ini punya dua pemilik dengan wilayah terpisah. Sebelum mengubah apa pun, pastikan
kamu tahu sedang bekerja di wilayah siapa.

## Aturan keras

1. **Jangan pernah mengedit `pipeline/` kalau kamu sedang membantu Devon.**
   Jangan pernah mengedit `web/src/` kalau kamu sedang membantu Dal.
2. **`contracts/hexagon.schema.json` tidak diubah sepihak.** Kalau kode butuh field yang
   belum ada di schema, jangan menambahkannya sendiri — hentikan dan beri tahu pengguna
   bahwa ini perubahan kontrak yang perlu disepakati dua orang.
3. **Jangan commit apa pun di `data/`.** Sudah ada di `.gitignore`. Data mentah survei dan
   dump MAPID tidak masuk git.
4. **Jangan menaruh API key di kode klien.** Kunci LLM hidup sebagai environment variable
   di serverless function (`web/api/`). Kunci basemap MAPID boleh publik terbatas.
5. **Data di `web/public/data/` sudah asli sejak 2026-09-08 (`versi: "1.0"`).**
   Tetap cek `metadata.versi` sebelum menyimpulkan apa pun — `"stub-0.x"` berarti
   palsu. Jangan "memperbaiki" skor yang terlihat aneh tanpa menelusuri sumbernya:
   banyak heksagon memang kehilangan dimensi Affordability, dan itu disengaja.

## Bahasa

- Teks yang dilihat pengguna akhir: **Bahasa Indonesia.**
- Nama variabel, field, dan komentar kode: **Inggris.**
- Nama field di dalam GeoJSON mengikuti schema apa adanya (campuran, sudah ditetapkan).

## Yang perlu diketahui soal domainnya

- Unit analisis adalah **heksagon H3 resolusi 9** (~0,105 km², lebar ~380 m). Ada 2.134.
- Kata "kawasan" ambigu di dokumen tim: kadang berarti heksagon, kadang berarti 12 area
  sampel survei (KWS-01 … KWS-12) yang jauh lebih besar. Di kode, selalu pakai `hexagon`
  untuk unit skor dan `survey_area` untuk area sampel.
- Skor dinormalisasi sebagai **peringkat persentil terhadap seluruh wilayah studi**, bukan
  nilai absolut. Skor 70 berarti "lebih baik dari 70% kawasan lain", bukan "70 dari 100".
- Survei lapangan hanya menyentuh 12 area dari 2.134 heksagon. Sebagian besar indikator
  yang bersumber survei **kosong di hampir semua heksagon**. Itu bukan bug. Lihat kebijakan
  data hilang di bawah.

## Kebijakan data hilang (penting)

Setiap indikator punya field `sumber` yang menyatakan asal nilainya:

| `sumber` | Arti | Perlakuan di UI |
|---|---|---|
| `survei` | Diukur langsung di lapangan | Tampilkan biasa |
| `mapid_poi`, `osm`, `sentinel2`, `viirs`, `inarisk` | Data sekunder | Tampilkan biasa |
| `model` | **Ditaksir** dari data sekunder, dilatih pada survei | Tampilkan dengan penanda "estimasi" |
| `tidak_tersedia` | Tidak ada data | Tampilkan sebagai "tidak tersedia", **bukan nol** |

Indikator `tidak_tersedia` dikeluarkan dari perhitungan dan bobotnya dinormalisasi ulang
di dalam dimensinya. Jangan pernah merender `null` sebagai `0` — itu memberi kesan kawasan
tersebut buruk, padahal yang benar adalah kita tidak tahu.

## Perintah yang berguna

```bash
# frontend
cd web && npm install && npm run dev

# validasi output pipeline terhadap schema
python pipeline/tests/validate_schema.py web/public/data/hexagons.geojson
```
