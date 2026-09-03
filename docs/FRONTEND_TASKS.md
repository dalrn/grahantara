# Rencana kerja frontend

Urutannya disusun supaya tiap tahap menghasilkan sesuatu yang bisa dilihat. Kerjakan
berurutan; jangan mulai fitur AI sebelum peta dan panel jalan.

## Tahap 1 — Peta berjalan

- [ ] Scaffold Vite + React + Tailwind di `web/`
- [ ] MapLibre GL JS dengan basemap MAPID MAPS (kunci basemap di `.env`)
- [ ] Muat `public/data/hexagons.geojson`, render 2.134 poligon
- [ ] Warnai per `properties.skor` dengan skala 5 kelas + legenda
- [ ] Hover menampilkan skor, klik memilih heksagon

**Selesai kalau:** peta Sleman tampil, heksagon berwarna gradasi, legenda menjelaskan
rentang kelasnya.

Catatan performa: 2.134 poligon aman untuk MapLibre, tapi jangan pakai satu React component
per heksagon. Satu `geojson` source, satu `fill` layer, satu `line` layer. Seleksi diurus
lewat `feature-state`, bukan dengan menulis ulang source.

## Tahap 2 — Panel kawasan

- [ ] Klik heksagon membuka panel samping
- [ ] Tampilkan skor total, empat subskor dengan bar
- [ ] Daftar 16 indikator: nama, nilai + satuan, persentil
- [ ] Indikator `sumber: "model"` diberi label **estimasi**
- [ ] Indikator `sumber: "tidak_tersedia"` ditampilkan **"tidak tersedia"**, bukan 0

**Selesai kalau:** setiap angka di panel bisa ditelusuri sampai indikator asalnya, dan
tidak ada indikator kosong yang menyamar jadi nol.

## Tahap 3 — Slider bobot runtime

- [ ] Empat slider: Connectivity, Affordability, Amenity, Walkability
- [ ] Normalisasi otomatis supaya total selalu 1,0
- [ ] Hitung ulang skor **di sisi klien**, peta berubah warna tanpa reload

Rumusnya:

```js
const EPS = 0.01;
const score = (sub, w) =>
  100 *
  Math.pow(sub.connectivity  / 100 + EPS, w.connectivity)  *
  Math.pow(sub.affordability / 100 + EPS, w.affordability) *
  Math.pow(sub.amenity       / 100 + EPS, w.amenity)       *
  Math.pow(sub.walkability   / 100 + EPS, w.walkability);
```

Subskor sudah dihitung pipeline dan tidak berubah. Yang berubah hanya cara menggabungkannya.
Jangan menghitung ulang indikator di frontend.

Perhitungan 2.134 heksagon per gerakan slider terasa berat kalau dilakukan naif. Debounce,
atau simpan `Math.log` subskor sekali supaya slider hanya perlu perkalian dan `Math.exp`.

## Tahap 4 — Kontrol layer

- [ ] Toggle terpisah: kampus, halte Trans Jogja, stasiun KRL, titik kos
- [ ] Status aktif terlihat di panel kontrol
- [ ] Popup titik kos: harga + label sumber (`survei` atau `model`)
- [ ] Titik kos tanpa harga pakai penanda berbeda

## Tahap 5 — Beranda dan input kebutuhan

- [ ] Halaman beranda dengan textarea bahasa bebas
- [ ] Kirim ke `api/parse-preference`, tampilkan chip hasil parsing
- [ ] Chip bisa dikoreksi pengguna sebelum peta dihitung
- [ ] Tombol "lihat peta" membawa ke peta dengan bobot dari profil

## Tahap 6 — Narasi AI dan pembanding

- [ ] Panel insight memanggil `api/explain-score` untuk heksagon terpilih
- [ ] Halaman "Bandingkan": pilih dua heksagon, tabel skor + subskor, simpulan
- [ ] Kedua heksagon tersorot di peta

## Tahap 7 — Metodologi, responsif, publikasi

- [ ] Halaman metodologi: rumus, bobot, definisi indikator, sumber data + tahun, batasan
- [ ] Uji di layar mobile
- [ ] Deploy ke Vercel, petakan ke subdomain MAPID
- [ ] Video demo

## Serverless function

Semuanya di `web/api/`. Kunci API tidak pernah sampai ke browser.

| Endpoint | Fungsi | Input | Output |
|---|---|---|---|
| `POST /api/parse-preference` | AI-1 | `{ teks }` | `{ kampus, anggaran, bobot }` |
| `POST /api/explain-score` | AI-2 | `{ h3_index, indikator, bobot }` | `{ narasi }` |
| `POST /api/compare` | AI-4 | `{ a, b, bobot }` | `{ tabel, simpulan }` |

Semua prompt menyuruh model membalas **JSON saja**, tanpa preamble dan tanpa pagar
markdown. Parse dengan try/catch dan sediakan fallback kalau parsing gagal — jangan sampai
seluruh halaman rusak karena LLM mengarang format.

## Yang tidak boleh dilakukan

- Jangan menaruh API key LLM di kode klien
- Jangan menghitung ulang indikator atau persentil di frontend
- Jangan merender `null` sebagai `0`
- Jangan menambah field ke GeoJSON tanpa mengubah `contracts/hexagon.schema.json` dulu
- Jangan menyimpulkan apa pun dari angka stub
