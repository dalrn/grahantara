// Pengetahuan proyek untuk prompt sistem endpoint AI.
// Konstanta statis; bukan bacaan berkas repo lain saat runtime.

export const PENGETAHUAN_PROYEK = `- Grahantara menilai kelayakan kawasan hunian kos untuk mahasiswa di sabuk
  kampus Sleman, DIY. Premisnya: memilih tempat tinggal adalah keputusan
  mobilitas.
- Wilayah studi dibagi 2.134 heksagon H3 resolusi 9.
- Empat dimensi: Akses transportasi (bobot bawaan 40), Biaya (25),
  Fasilitas (20), Lingkungan jalan kaki (15). Total 16 indikator.
- Skor memakai RATA-RATA GEOMETRIK BERBOBOT, bukan aritmetik. Satu dimensi
  yang sangat rendah menjatuhkan skor total. Alasannya: kos dengan warung
  melimpah tapi tanpa akses transit tetap salah pilihan bagi mahasiswa
  tanpa kendaraan.
- Setiap indikator dinilai dengan peringkat persentil terhadap seluruh
  heksagon wilayah studi, bukan terhadap nilai maksimum teoretis.
- Dimensi yang seluruh indikatornya tidak tersedia DIKELUARKAN dari
  perhitungan, dan bobotnya dibagi ulang ke dimensi lain.
- Pengguna dapat menggeser bobot antar-dimensi. Bobot antar-indikator
  di dalam satu dimensi tetap dan tidak bisa diubah.
- Grahantara TIDAK menyimpan nama kos, alamat, nomor kontak, nama jalan,
  atau nama tempat usaha. Yang ada hanya skor dan indikator per kawasan.
- Penjelasan lengkap metode ada di halaman Metodologi aplikasi.`;

export const PENGETAHUAN_METODE = `- Grahantara dibuat untuk MAPID WebGIS Competition 2026, tema
  "Maps That Think! Mass Transportation Edition", oleh tim cinajawabatak.
- Premisnya: memilih tempat tinggal adalah keputusan mobilitas. Mahasiswa
  biasanya menilai kos dari harga dan jarak ke kampus saja, padahal kos murah
  tanpa akses transit memaksa membeli kendaraan.
- Wilayah studi adalah sabuk kampus Sleman, DIY, dibagi menjadi 2.134
  heksagon H3 resolusi 9.
- Empat dimensi: Akses transportasi (bobot bawaan 40), Biaya (25),
  Fasilitas (20), Lingkungan jalan kaki (15). Total 16 indikator.
- Skor memakai rata-rata geometrik berbobot. Rumusnya: skor = 100 dikali
  hasil kali atas dimensi yang punya data, dari (subskor dibagi 100 ditambah
  0,01) dipangkatkan (bobot dimensi dibagi jumlah bobot dimensi yang ada).
- Rata-rata geometrik dipilih supaya satu dimensi yang sangat rendah
  menjatuhkan skor total. Rata-rata aritmetik akan menutupi kelemahan itu.
- Konstanta 0,01 mencegah skor nol absolut. Akibatnya skor terendah yang
  mungkin adalah 1, dan rumus bisa melebihi 100 sehingga hasilnya dipotong.
- Setiap indikator dinilai dengan peringkat persentil terhadap seluruh
  heksagon wilayah studi, bukan terhadap nilai maksimum teoretis.
- Indikator tanpa data dikeluarkan dari subskor dimensinya, bobot indikator
  yang tersisa dinormalisasi ulang. Tidak ada imputasi nilai tengah.
- Dimensi yang seluruh indikatornya tidak tersedia dikeluarkan dari
  perhitungan skor dan bobotnya dibagi ulang ke dimensi lain.
- Bobot antar-dimensi bisa digeser pengguna. Bobot antar-indikator tetap.
- Sumber data: dataset MAPID, OpenStreetMap, Sentinel-2, VIIRS, dan survei
  lapangan tim.
- Analisis spasial memakai perangkat sumber terbuka: QGIS, Python geospatial
  (GeoPandas, OSMnx, NetworkX, H3), dan Google Earth Engine.
- Arsitektur: analisis berat dijalankan offline sebelum deploy, hasilnya
  dibekukan jadi GeoJSON statis. Tidak ada basis data runtime dan tidak ada
  server aplikasi. Panggilan server saat runtime hanya ke serverless function
  yang memproksi model bahasa dan routing.
- Ada empat fungsi AI di antarmuka: penerjemah kebutuhan dari kalimat bebas,
  penjelas skor kawasan, tanya lanjutan tentang kawasan, dan pembanding dua
  kawasan.
- Model bahasa tidak pernah menghitung skor dan tidak pernah menerima data
  mentah. Masukannya selalu angka yang sudah jadi dan sudah tampil di layar.
- Setiap fungsi AI punya jalur cadangan deterministik. Bila layanan bahasa
  gagal, antarmuka menandainya dengan pita "Dijawab tanpa AI".
- Grahantara tidak menyimpan nama kos, alamat, nomor kontak, nama jalan,
  atau nama tempat usaha.
- Skor tidak berubah kecuali pipeline analisis dijalankan ulang.`;
