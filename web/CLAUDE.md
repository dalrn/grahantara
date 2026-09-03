# web/ — konteks untuk asisten AI

Kamu sedang bekerja di wilayah **Devon**. Jangan menyentuh `../pipeline/` atau `../data/`.

## Tumpukan teknologi

React + Vite · MapLibre GL JS · Tailwind CSS · Vercel serverless function.

Basemap dari MAPID MAPS lewat style API. Bukan Leaflet, bukan Mapbox GL (berbayar).

## Sumber data

Empat file di `public/data/`, semuanya statis, dimuat lewat `fetch` saat aplikasi start.

| File | Isi | Ukuran |
|---|---|---|
| `hexagons.geojson` | 2.134 poligon, skor + 4 subskor + 16 indikator | ~4 MB |
| `kampus.geojson` | 10 titik kampus | kecil |
| `halte.geojson` | Titik halte + daftar koridor | kecil |
| `kos.geojson` | Titik kos + harga + label sumber | kecil |

**Semuanya masih stub berisi angka acak.** Cek `metadata.versi` pada `hexagons.geojson`:
`"stub-0.1"` berarti palsu. Bentuk dan skalanya benar, jadi UI yang dibangun di atasnya akan
langsung bekerja saat data asli masuk. Tapi jangan menyimpulkan apa pun dari nilainya, dan
jangan menulis logika yang bergantung pada angka tertentu.

Kontraknya ada di `../contracts/hexagon.schema.json`. Baca itu sebelum menulis kode yang
membaca GeoJSON.

## Hal yang mudah salah

**Urutan koordinat.** GeoJSON memakai `[lon, lat]`. MapLibre juga. Tapi H3 memakai
`(lat, lng)`. Kalau peta muncul di Somalia, ini penyebabnya.

**Jangan render `null` sebagai `0`.** Indikator dengan `sumber: "tidak_tersedia"` punya
`nilai: null` dan `persentil: null`. Itu artinya kita tidak tahu, bukan nilainya nol.
Tampilkan sebagai "tidak tersedia". Ini bukan detail kosmetik — menampilkannya sebagai nol
membuat kawasan terlihat buruk padahal datanya cuma belum ada, dan itu salah satu kriteria
penerimaan produk.

**Tandai indikator `sumber: "model"` sebagai estimasi.** Sebagian besar harga kos akan
ditaksir, bukan diukur. Menampilkannya tanpa label akan terbaca sebagai klaim palsu.

**Performa slider.** Menghitung ulang 2.134 skor tiap gerakan slider bisa berat. Simpan
`Math.log(subskor/100 + 0.01)` untuk keempat dimensi sekali di awal; setelah itu tiap
perubahan bobot hanya perlu satu perkalian dan satu `Math.exp` per heksagon.

**Jangan pakai satu komponen React per heksagon.** Satu source, satu fill layer, satu line
layer. Seleksi lewat `feature-state`, bukan menulis ulang source.

**`h3_index` adalah kunci utama.** Stabil antar versi data. Pakai itu untuk join dan untuk
menyimpan pilihan pengguna, jangan indeks array — urutan feature bisa berubah.

## Environment variable

```
VITE_MAPID_BASEMAP_KEY=   # boleh sampai ke klien, publik terbatas
LLM_API_KEY=              # HANYA di sisi server. Jangan diberi awalan VITE_.
```

Awalan `VITE_` membuat variabel ikut ter-bundle ke browser. Kunci LLM tidak boleh punya
awalan itu.

## Bahasa

Teks yang dilihat pengguna: Bahasa Indonesia. Nama variabel dan komentar: Inggris.

## Rencana kerja

Lihat `../docs/FRONTEND_TASKS.md`. Kerjakan berurutan dari Tahap 1.
