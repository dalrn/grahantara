/**
 * SUMBER TUNGGAL teks panjang halaman Metodologi.
 *
 * Dipisahkan dari komponen karena isinya definisi 16 indikator — kalau
 * ditulis inline, komponennya jadi ribuan baris dan sulit disunting oleh
 * orang yang hanya ingin memperbaiki satu kalimat.
 *
 * Yang TIDAK ada di sini, dan memang tidak boleh dipindahkan ke sini:
 *   - Angka cakupan, jumlah heksagon, versi, tanggal: dibaca dari
 *     `public/data/hexagons.geojson` saat runtime. Semua kalimat tentang
 *     cakupan WAJIB dihasilkan dari data, jangan ditulis manual — kalimat
 *     manual jadi basi begitu datanya berubah.
 *   - Nama indikator dan dimensi: `src/lib/kamus.js`.
 *   - Bobot: `metadata.bobot_default` pada berkas data.
 *
 * Angka validasi model di PENJELASAN_MODEL berasal dari docstring
 * `pipeline/30_indicators/07_w6_integritas.py`; kalau pipeline dijalankan
 * ulang dengan fitur berbeda, angka di sini ikut diperbarui.
 */

/**
 * Definisi tiap indikator: apa yang diukur, cara hitungnya, cakupan
 * spasialnya, dan arah mana yang lebih baik.
 *
 * `arah` selalu menyebut arti NILAI YANG DISIMPAN, bukan nama indikatornya —
 * penting untuk W5, yang menyimpan `1 - tekanan` sehingga nilai tinggi
 * berarti lalu lintas TENANG, bukan padat.
 */
export const DEFINISI = {
  C1_jarak_halte: {
    ukur: "Seberapa dekat halte Trans Jogja terdekat dari pusat kawasan.",
    rumus: "exp(−jarak / 400 m)",
    cakupan:
      "Jarak jalan kaki menyusuri graf jalan OpenStreetMap, bukan garis lurus.",
    arah: "Makin dekat halte, makin tinggi nilainya.",
  },
  C2_rute_unik: {
    ukur: "Berapa banyak koridor Trans Jogja berbeda yang bisa dicapai.",
    rumus: "1 − exp(−jumlah rute / 2)",
    cakupan:
      "Semua halte yang terjangkau jalan kaki 800 m dari pusat kawasan. Koridor yang sama di dua halte dihitung sekali.",
    arah: "Makin banyak koridor berbeda, makin tinggi nilainya.",
  },
  C3_keterjangkauan_kampus: {
    ukur:
      "Apakah koridor yang lewat kawasan ini benar-benar sampai ke kampus, bukan sekadar apakah ada halte di dekatnya.",
    rumus:
      "Pergantian koridor paling sedikit menuju kampus: 0 kali → 1,00 · 1 kali → 0,60 · tidak terjangkau → 0,20. Dipakai nilai kampus terbaik.",
    cakupan:
      "Graf dengan simpul berupa pasangan (halte, koridor). Halte dianggap terjangkau bila ≤ 800 m jalan kaki, dan kampus bila ≤ 1.000 m dari halte tujuan.",
    arah: "Ada rute langsung lebih tinggi daripada perlu berganti kendaraan.",
    catatan:
      "Simpulnya pasangan (halte, koridor), bukan halte, karena 295 dari 589 halte dilayani lebih dari satu koridor. Memakai halte sebagai simpul menyatukan 20 koridor jadi satu gumpalan sehingga semua kampus tampak terjangkau langsung.",
  },
  C4_jarak_krl: {
    ukur: "Seberapa dekat stasiun KRL terdekat, untuk perjalanan antarkota.",
    rumus: "exp(−jarak / 800 m)",
    cakupan: "Jarak jalan kaki di graf OpenStreetMap ke stasiun KRL.",
    arah: "Makin dekat stasiun, makin tinggi nilainya.",
  },
  A1_harga_kos: {
    ukur: "Harga sewa kos bulanan di sekitar kawasan.",
    rumus: "Harga median, arahnya dibalik sebelum dijadikan peringkat.",
    cakupan: "Kos hasil survei lapangan.",
    arah: "Makin murah, makin tinggi nilainya.",
    catatan:
      "Indikator ini TIDAK dimodelkan. Validasi silang leave-one-out atas label harga memberi R² negatif untuk Ridge maupun RandomForest — keduanya lebih buruk daripada sekadar menebak rata-rata. Sebabnya struktural: sebagian besar ragam harga terjadi antar-kos di jalan yang sama (ukuran kamar, kamar mandi dalam, usia bangunan), dan tidak satu pun dari itu bersifat spasial.",
  },
  A2_harga_makan: {
    ukur: "Harga satu porsi makan di warung sekitar kawasan.",
    rumus: "Harga median, arahnya dibalik sebelum dijadikan peringkat.",
    cakupan: "Titik ekonomi hasil survei lapangan.",
    arah: "Makin murah, makin tinggi nilainya.",
  },
  M1_kepadatan_makan: {
    ukur: "Banyaknya tempat makan yang terjangkau jalan kaki.",
    rumus: "1 − exp(−jumlah tempat makan / 5)",
    cakupan:
      "Radius 800 m dari pusat kawasan, bukan hanya di dalam heksagon: sel selebar ~380 m akan menghitung nol untuk warung 200 m di luar batas, padahal itu lima menit jalan kaki.",
    arah: "Makin banyak tempat makan, makin tinggi nilainya.",
    catatan:
      "Hanya tempat makan. Toko makanan masuk ke layanan harian, karena mahasiswa yang mencari makan siang tidak terbantu oleh toko kelontong.",
  },
  M2_keragaman: {
    ukur: "Seberapa beragam jenis tempat makan, bukan hanya berapa banyak.",
    rumus:
      "Indeks keragaman Shannon atas kategori tempat makan, dinormalisasi dengan dibagi log(jumlah kategori yang hadir) sehingga hasilnya berada di 0–1.",
    cakupan: "Radius 800 m, kategori sama dengan kepadatan tempat makan.",
    arah: "Makin merata sebaran antar kategori, makin tinggi nilainya.",
    catatan:
      "Satu kategori saja bernilai 0 — tidak ada keragaman. Tanpa tempat makan sama sekali, hasilnya kosong dan bukan 0: tidak ada yang bisa diukur keragamannya.",
  },
  M3_keramaian: {
    ukur: "Seberapa ramai kawasan dilalui orang.",
    rumus: "Cacah pejalan per 10 menit pada titik pengamatan.",
    cakupan: "Titik pengamatan survei lapangan.",
    arah: "Makin ramai, makin tinggi nilainya.",
  },
  M4_layanan_harian: {
    ukur:
      "Kelengkapan layanan sehari-hari: apotek, minimarket, dan warung kelontong.",
    rumus:
      "Jumlah kategori yang HADIR dibagi 3. Bukan cacah toko — dua minimarket tetap dihitung satu kategori.",
    cakupan: "Radius 800 m dari pusat kawasan.",
    arah: "Makin lengkap kategorinya, makin tinggi nilainya.",
    catatan:
      "Lapisan POI saling bersarang, jadi yang dipakai sengaja yang paling spesifik: apotek (bukan seluruh lapisan kesehatan) dan minimarket (yang sudah memuat semua merek).",
  },
  W1_kerapatan_simpang: {
    ukur: "Kerapatan simpang jalan, penanda petak jalan yang mudah dilalui.",
    rumus: "Jumlah simpang dibagi luas kawasan (per km²)",
    cakupan: "Simpang graf jalan kaki OpenStreetMap di dalam heksagon.",
    arah: "Makin rapat simpangnya, makin tinggi nilainya.",
  },
  W2_keteduhan: {
    ukur: "Keteduhan sepanjang jalur yang dilalui pejalan.",
    rumus: "NDVI rata-rata — indeks kehijauan dari citra satelit.",
    cakupan:
      "Buffer 15 m di sekeliling jalur jalan kaki, dihitung dari komposit median Sentinel-2 musim kemarau yang sudah dibersihkan awan, sehingga satu lintasan berawan tidak menggeser hasilnya.",
    arah: "Makin hijau dan teduh, makin tinggi nilainya.",
  },
  W3_penerangan: {
    ukur: "Terangnya kawasan pada malam hari.",
    rumus: "log(1 + radiansi cahaya malam)",
    cakupan:
      "Lapisan cahaya malam 2023, dirata-ratakan berbobot luas bila satu heksagon melintasi beberapa kelas terang.",
    arah: "Makin terang, makin tinggi nilainya.",
    catatan:
      "Ini proksi rasa aman berjalan ke halte selepas magrib, BUKAN ukuran jumlah lampu jalan: jalan pertokoan yang terang dan lapangan bersorot tampak sama terang di citra.",
  },
  W4_banjir: {
    ukur: "Keamanan kawasan dari genangan dan banjir.",
    rumus: "1 − indeks bahaya banjir",
    cakupan:
      "Lapisan wilayah bahaya banjir, berbobot luas bila satu heksagon melintasi beberapa poligon.",
    arah: "Makin aman dari genangan, makin tinggi nilainya.",
  },
  W5_tekanan_lalin: {
    ukur: "Setenang apa lalu lintas bagi orang yang berjalan kaki.",
    rumus: "1 − tekanan lalu lintas, ditaksir dari kelas jalan.",
    cakupan:
      "Kelas jalan OpenStreetMap di dalam heksagon, dikalibrasi dengan ruas hasil survei lapangan.",
    arah:
      "NILAI TINGGI BERARTI LALU LINTAS TENANG, bukan padat — yang disimpan adalah kebalikan tekanan.",
    catatan:
      "Kalibrasinya tegas: seluruh gang yang disurvei tergolong sepi, sementara hampir semua jalan raya tergolong ramai. Kelas jalan memprediksi kepadatan hampir sempurna, dan OpenStreetMap punya kelas jalan untuk seluruh wilayah.",
  },
  W6_integritas_jalur: {
    ukur: "Ketersediaan dan keutuhan jalur pejalan kaki.",
    rumus:
      "Ditaksir dari kelas jalan dan lebar jalan, lalu dirata-ratakan berbobot PANJANG jalan di dalam heksagon, sehingga kawasan dinilai dari jalur yang benar-benar dilewati pejalan.",
    cakupan: "Seluruh ruas jalan OpenStreetMap di dalam heksagon.",
    arah: "Makin utuh jalur pejalannya, makin tinggi nilainya.",
    estimasi: true,
  },
};

/** Ringkasan pembuka, tanpa notasi apa pun. */
export const RINGKASAN = [
  "Grahantara menilai kawasan tempat tinggal di sabuk kampus Sleman, bukan menilai bangunan kos satu per satu.",
  "Wilayah studi dibagi menjadi heksagon seluas sekitar 0,1 km², lalu tiap heksagon dinilai pada empat hal: akses transportasi, biaya, fasilitas, dan kenyamanan berjalan kaki.",
  "Penilaiannya memakai 16 indikator dari OpenStreetMap, lapisan data MAPID, citra satelit Sentinel-2, dan survei lapangan tim.",
  "Tiap indikator diubah menjadi peringkat terhadap seluruh wilayah studi, digabung menjadi nilai per dimensi, lalu keempat dimensi digabung menjadi satu skor dengan bobot yang bisa diubah pengguna.",
  "Skor tinggi berarti kawasan itu lebih sesuai dibandingkan kawasan lain di Sleman. Itu peringkat, bukan nilai mutlak, dan bukan jaminan bahwa setiap kos di dalamnya cocok.",
];

/** Penjelasan model untuk indikator yang bersumber estimasi. */
export const PENJELASAN_MODEL = [
  "Ketersediaan jalur pejalan kaki tidak ada sebagai data siap pakai untuk seluruh wilayah: memetakannya berarti menyurvei tiap ruas jalan. Survei tim mencakup 83 ruas, kurang dari satu persen wilayah studi.",
  "Karena itu nilainya ditaksir dari dua hal yang dipunyai OpenStreetMap di seluruh wilayah — kelas jalan, dan lebar jalan bila tercatat — dengan model yang dilatih pada ruas hasil survei.",
  "Keputusan memodelkan diuji, bukan diasumsikan. Dengan validasi silang leave-one-out atas ruas survei: menebak rata-rata memberi R² 0,000; kelas jalan saja R² +0,262; kelas jalan ditambah lebar R² +0,394 dengan galat rata-rata 0,197. Model dipakai karena menjelaskan sekitar 39% ragam, jauh lebih baik daripada menebak.",
  "Yang membuatnya bekerja adalah keteraturan tata kota yang nyata: jalan arteri diberi trotoar, gang tidak. Pada ruas survei, rata-rata keutuhan jalur di jalan raya 0,449 sementara di gang 0,044.",
  "Kepadatan kendaraan sengaja TIDAK dipakai sebagai fitur meski menambah sedikit ketepatan, karena angkanya berasal dari survei yang sama dan indikator ketenangan lalu lintas sudah memakai kelas jalan yang sama. Memasukkannya berarti menghitung satu fitur dua kali.",
  "Indikator ini selalu diberi penanda “estimasi” di antarmuka. Harga kos, yang diuji dengan cara yang sama, justru TIDAK dimodelkan karena hasilnya lebih buruk daripada menebak rata-rata.",
];

/** Label Indonesia untuk nilai enum presisi koordinat kos. */
export const LABEL_PRESISI = {
  ruas_terkait: "Diambil dari ruas jalan terkait, bukan titik bangunannya",
  pusat_kawasan: "Memakai titik pusat kawasan",
  manual: "Diisi manual oleh tim",
  nama_kos: "Dipulihkan dari nama kos di catatan survei, bukan direkam saat survei",
};
