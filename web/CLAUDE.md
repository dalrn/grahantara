# web/ — konteks untuk asisten AI

Kamu sedang bekerja di wilayah **Devon**. Jangan menyentuh `../pipeline/` atau `../data/`.

## Tumpukan teknologi

React + Vite · MapLibre GL JS · Tailwind CSS · Vercel serverless function.

Basemap dari MAPID MAPS lewat style API. Bukan Leaflet, bukan Mapbox GL (berbayar).

## Sumber data

Enam berkas di `public/data/`, semuanya statis, dimuat lewat `fetch` saat aplikasi start.

| File | Isi | Ukuran |
|---|---|---|
| `hexagons.geojson` | 2.134 poligon, skor + 4 subskor + 16 indikator | ~4,5 MB |
| `kampus.geojson` | 10 titik kampus + jumlah gerbang | kecil |
| `halte.geojson` | 566 halte + daftar koridor | kecil |
| `kos.geojson` | 31 kos survei + harga + presisi koordinat | kecil |
| `krl.geojson` | 12 stasiun KRL | kecil |
| `c3_per_kampus.json` | keterjangkauan tiap kampus per heksagon | ~0,5 MB |

**Data sudah ASLI sejak 2026-09-08 (`metadata.versi: "1.0"`).** Stub sudah ditimpa.
Sebaran skor: minimum 14,4 · median 45,1 · maksimum 87,5.

**Dua hal baru yang perlu diperhatikan:**

1. **`properties.dimensi_kosong`** — daftar dimensi yang seluruh indikatornya
   `tidak_tersedia`. Dimensi itu **dikeluarkan** dari skor dan bobot dimensi sisanya
   dinormalisasi ulang; nilainya ditulis `0` pada `subskor` hanya demi kesesuaian skema.
   `mesinSkor.js` sudah membacanya. Kalau menulis kode lain yang menghitung skor,
   **wajib** membaca field ini — 1.981 dari 2.134 heksagon tidak punya Affordability,
   dan mengabaikannya membuat angkanya meleset sampai 59 poin.

2. **`krl.geojson` sekarang ada.** `lapisan.js` sudah mendeklarasikan lapisan itu dengan
   `tersedia: false` karena datanya belum ada. Sekarang sudah ada.

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
