# Grahantara

![Grahantara](docs/gambar/hero.png)

**Memilih tempat tinggal itu keputusan mobilitas.**

Grahantara menilai kelayakan kawasan hunian kos buat mahasiswa di sabuk kampus
Sleman, DIY. Bukan dari harga sewanya saja, tapi dari apakah kawasan itu bisa
dijalani tanpa kendaraan pribadi.

**Coba di sini:** https://grahantara.vercel.app

Dibuat untuk MAPID WebGIS Competition 2026, tema *Maps That Think! Mass
Transportation Edition*. Tim `cinajawabatak`.

---

## Masalahnya

Anak baru cari kos biasanya lihat dua angka saja. Harga, sama jarak ke kampus.
Dua-duanya menyesatkan.

Kos murah tapi kawasannya nggak ada halte. Ujungnya beli motor, dan hitungan
murahnya bubar. Kos dekat kampus tapi trotoarnya putus-putus dan gelap. Setiap
hujan jadi masalah. Biaya yang sebenarnya baru kelihatan setelah kontrak
ditandatangani.

Padahal informasinya ada. Rute Trans Jogja, sebaran warung, penerangan jalan,
riwayat genangan. Cuma tersebar di sumber yang nggak pernah ketemu di satu peta.

## Yang kami buat

Wilayah studi dipecah jadi **2.134 heksagon H3 resolusi 9**. Tiap heksagon
dinilai pakai **16 indikator** dalam **4 dimensi**.

| Dimensi | Bobot bawaan | Indikator |
|---|---|---|
| Akses transportasi | 40 | jarak halte, rute unik, keterjangkauan kampus, jarak stasiun KRL |
| Biaya | 25 | harga sewa kos, harga makan |
| Fasilitas | 20 | kepadatan tempat makan, keragaman kuliner, keramaian, layanan harian |
| Lingkungan jalan kaki | 15 | kerapatan simpang, keteduhan, penerangan, keamanan genangan, ketenangan lalu lintas, jalur pejalan kaki |

Tiap indikator dinilai pakai peringkat persentil terhadap seluruh heksagon
wilayah studi, bukan terhadap nilai maksimum teoretis. Bobot antar-dimensi bisa
digeser pengguna. Bobot antar-indikator tetap.

### Rumusnya

```
D    = himpunan dimensi yang punya data pada heksagon itu
W    = jumlah bobot dimensi di dalam D
skor = 100 × ∏ atas d di D dari (subskor_d/100 + 0,01)^(bobot_d / W)
```

Rata-rata geometrik, bukan aritmetik. Jadi satu dimensi yang jeblok bakal
menjatuhkan skor totalnya. Kos yang warungnya melimpah tapi nggak ada akses
transit tetap salah pilihan buat mahasiswa tanpa kendaraan. Rata-rata aritmetik
bakal menutupi itu, geometrik nggak.

Dimensi yang semua indikatornya kosong **dikeluarkan** dari perhitungan, bobotnya
dibagi ulang ke dimensi lain. Dimensi itu ditulis `0` di subskor cuma karena
skemanya mewajibkan angka, lalu didaftar di `properties.dimensi_kosong`. Nol di
situ artinya nggak ada data, bukan nilainya nol.

Penjelasan panjangnya ada di halaman Metodologi aplikasi, sama di
[`docs/METHODOLOGY.md`](docs/METHODOLOGY.md).

---

## Cara pakai

### 1. Mulai dari beranda

![Beranda](docs/gambar/01-beranda.png)

Ketik kebutuhanmu pakai kalimat biasa. Misalnya "maba UGM, budget sekitar 800
ribu, pengennya deket halte soalnya belum bawa motor". AI bakal menerjemahkannya
jadi kampus tujuan, anggaran, sama empat bobot dimensi.

Nggak mau ngetik juga boleh. Ada tombol buat langsung memilih, atau langsung
jelajahi petanya pakai bobot bawaan.

### 2. Periksa hasil bacaannya

![Prioritas](docs/gambar/02-prioritas.png)

Sebelum masuk ke peta, kamu bisa lihat dulu AI menangkap maksudmu atau nggak.
Kampus tujuan, anggaran per bulan, sama dua hal yang paling kamu pentingkan.
Ubah kalau ada yang meleset.

Kenapa cuma boleh pilih dua? Karena skornya pakai bobot relatif. Kalau semuanya
dicentang, hasilnya sama persis dengan nggak mencentang apa pun. Dibatasi dua
supaya pilihanmu beneran ngefek.

### 3. Baca petanya

![Peta](docs/gambar/03-peta.png)

Hijau berarti skornya tinggi, merah berarti rendah. Kelas warnanya diambil dari
kuintil data asli, bukan ambang 0-20-40-60-80-100. Soalnya rentang skor nyatanya
nggak sampai ke ujung, jadi ambang tetap cuma bikin dua kelas kosong.

Panel kiri isinya legenda, pengatur prioritas, sama toggle lapisan. Halte, kos,
kampus, stasiun KRL, POI, semuanya bisa dinyalakan atau dimatikan.

### 4. Klik heksagon mana saja

![Panel kawasan](docs/gambar/04-panel.png)

Panel kanan bakal kebuka. Ada skor totalnya, bobot yang lagi kamu pakai, sama
penjelasan dari AI berisi dua kekuatan dan satu kelemahan kawasan itu.

Buka tab **Rincian skor** kalau mau lihat sampai ke dalamnya. Empat subskor
dimensi, plus 16 indikator pembentuknya. Indikator yang datanya nggak ada ditulis
"tidak tersedia", bukan dipaksa jadi nol. Yang asalnya dari model dikasih lencana
"Estimasi".

Ini disengaja. Tabel yang kelihatan penuh padahal separuhnya tebakan itu lebih
berbahaya daripada tabel yang jujur bolong.

### 5. Tanya kalau masih penasaran

![Tanya lanjutan](docs/gambar/06-tanya.png)

Di bawah penjelasan ada kolom tanya. Bisa dipakai berkali-kali, jawabannya
nyambung sama pertanyaan sebelumnya. Tanya apa saja soal kawasan itu. Kenapa
skornya segitu, berapa jarak ke halte, atau kenapa rumusnya pakai rata-rata
geometrik.

Kalau kamu tanya hal yang datanya memang nggak ada, dia bakal bilang nggak ada.
Bukan ngarang.

### 6. Bandingkan dua kawasan

![Bandingkan](docs/gambar/07-banding.png)

Lagi galau antara dua lokasi? Bandingkan berdampingan. Arah perbandingannya
dihitung di server, jadi AI cuma merangkai kalimat, bukan menyimpulkan sendiri
siapa yang menang.

Kalau salah satu kawasan datanya kosong di dimensi tertentu, dimensi itu ditandai
"tidak dapat dibandingkan". Nggak dipaksa ada pemenangnya.

---

## AI-nya ngapain saja

Empat fungsi, semuanya kelihatan di antarmuka, bukan cuma proses di belakang.

| | Fungsi | Masukan | Keluaran |
|---|---|---|---|
| AI-1 | Penerjemah kebutuhan | kalimat bebas pengguna | kampus, anggaran, empat bobot |
| AI-2 | Penjelas skor | nilai dan peringkat kawasan terpilih | dua kekuatan, satu kelemahan |
| AI-2b | Tanya lanjutan | riwayat percakapan dan data kawasan | jawaban percakapan, banyak giliran |
| AI-4 | Pembanding kawasan | komponen dua kawasan | arah perbandingan tiap dimensi |

Satu batas yang nggak pernah kami langgar. Model bahasa nggak pernah menghitung
skor, dan nggak pernah menerima data mentah. Masukannya selalu angka yang sudah
jadi dan sudah tampil di layar.

Ini bukan soal gaya. Itu yang bikin keluarannya bisa dicek. Tiap kalimat AI
merujuk angka yang bisa kamu verifikasi sendiri di panel yang sama.

Tiap endpoint AI punya jalur cadangan yang deterministik. Kalau layanan bahasanya
mati, endpointnya tetap jawab, terus antarmukanya kasih pita "Dijawab tanpa AI".
Nggak ada layar kosong.

## Arsitektur

Analisis beratnya dibakar offline, sekali, sebelum deploy. Hasilnya dibekukan jadi
GeoJSON statis. Runtime-nya tipis. Nggak ada basis data, nggak ada server
aplikasi. Satu-satunya panggilan server pas pengguna buka aplikasi itu ke
serverless function yang memproksi API bahasa sama routing.

```
Fase 1, offline
  MAPID, OSM, Sentinel-2, VIIRS, survei lapangan
      |
      v  pipeline Python (GeoPandas, OSMnx, NetworkX, H3, GEE)
  web/public/data/hexagons.geojson
      kontraknya di contracts/hexagon.schema.json

Fase 2, runtime
  Browser (React, MapLibre GL JS)
      |- CDN ....................... GeoJSON statis
      |- MAPID MAPS ................ basemap
      |- Serverless function ....... proksi LLM dan OSRM
```

Untungnya murah, cepat, dan nggak bisa mati gara-gara database down. Ruginya,
skor nggak berubah kecuali pipeline dijalankan ulang.

Detailnya di [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

## Isi repo

```
pipeline/      analisis spasial offline, bernomor sesuai urutan jalan
  00_ingest/     unduh dan bersihkan sumber
  10_clean/      baca survei, geocode kos
  20_network/    graf jalan, indikator berbasis jaringan (C1 sampai C4, W1)
  30_indicators/ indikator sisanya (M1, W2 sampai W6, A1)
  40_score/      skor akhir dan lapisan titik
  common/        utilitas bersama
  config/        bobot
  tests/         uji indikator dan validasi skema
contracts/     skema GeoJSON, kontrak antara pipeline dan frontend
reference/     masukan hasil kurasi tangan yang dilacak git
docs/          metodologi, arsitektur, kamus data, log keputusan
web/           frontend WebGIS
  src/           komponen React, pustaka, konten
  api/           serverless function
  public/data/   GeoJSON hasil pipeline
```

## Menjalankan

### Frontend

```bash
cd web
npm install
npm run dev        # Vite doang, folder api/ NGGAK ikut jalan
```

Serverless function cuma hidup lewat `vercel dev` atau di produksi. Kalau pakai
`npm run dev`, semua endpoint `/api/*` bakal jawab 404. Itu normal, bukan bug.

```bash
vercel dev         # frontend plus serverless function
npm run build
npm run lint
```

Butuh `DEEPSEEK_API_KEY` di environment buat fungsi AI. Tanpa itu endpointnya
tetap jawab 200 lewat jalur cadangan.

### Pipeline

```bash
pip install -r pipeline/requirements.txt
cp .env.example .env          # terus isi kuncinya
earthengine authenticate      # sekali saja, buat W2
python pipeline/run_all.py
```

Daftar kunci yang dibutuhkan ada di [`pipeline/README.md`](pipeline/README.md).

## Data MAPID nggak disertakan

Enam layer MAPID yang dipakai pipeline **nggak ada di repo ini**. Ketentuan
kompetisi melarang penyebaran data mentah MAPID di luar kompetisi.

| Layer | Dipakai buat |
|---|---|
| Makanan dan Minuman 2025 | M1, M2 |
| Toko Kelontong 2025 | M4 |
| Apotek 2025 | M4 |
| Minimarket 2025 | M4 |
| Bahaya Banjir | W4 |
| Nighttime Light 2023 | W3 |

Keenamnya diekspor manual dari antarmuka MAPID, bukan lewat API. Soalnya
`get_layer` berplafon keras 200 fitur, padahal satu layer saja isinya ribuan.
Simpan hasil ekspornya sebagai GeoJSON di `data/raw/mapid/`. Kolom `TIPE_1`,
`TIPE_2`, `TIPE_3` wajib dipertahankan karena itu kategori buat M2. Daftar lengkap
sama nomor layernya ada di [`mapid_data.txt`](mapid_data.txt).

Tanpa berkas-berkas itu, M1, M2, M4, W3, dan W4 nggak bisa dihitung ulang.

## Tim

`cinajawabatak`

| | Bagian |
|---|---|
| Devon Rama Wikunanda | frontend WebGIS, serverless function, halaman metodologi |
| Andalan Raihad | analisis spasial, pipeline, skor, integrasi AI |
| Theo | UI/UX |
| Delon | QC |

## Perangkat analisis

Semua analisis spasialnya pakai perangkat sumber terbuka. QGIS, Python geospatial
(GeoPandas, OSMnx, NetworkX, H3), sama Google Earth Engine. Basemap dari MAPID
MAPS.
