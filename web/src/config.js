export const BOBOT_DEFAULT = {
  connectivity: 0.4,
  affordability: 0.25,
  amenity: 0.2,
  walkability: 0.15,
};

// CADANGAN bila metadata.bobot_default tidak ada di GeoJSON. Bila metadata
// menyediakannya, App.jsx memakai nilai metadata sebagai bobot bawaan dan
// acuan "Kembalikan bawaan". Nilai ini identik dengan metadata versi 1.0.
export const EPS = 0.01;

export { scoreColors as WARNA_KELAS } from "./design.js";

// Slug terverifikasi dengan kunci nyata: dark-v2.0 -> 200.
// Keputusan tim: basemap gelap (street-v2.0 terang membuat kelas skor
// tertinggi #fde725 nyaris menyatu dengan latar).
export const GAYA_BASEMAP_MAPID = "dark-v2.0";

// Bobot antar-indikator DI DALAM dimensinya. Salinan klien dari
// pipeline/config/weights.yaml (blok `indikator`), yang tetap jadi sumber
// tunggal sebenarnya.
//
// Berbeda dengan bobot dimensi, bobot ini TETAP dan tidak bisa digeser
// pengguna, jadi tidak ikut dikirim lewat metadata berkas data. Dipakai
// halaman Metodologi untuk menjelaskan langkah agregasi indikator -> subskor.
// Kalau weights.yaml berubah, ubah juga di sini.
export const BOBOT_INDIKATOR = {
  C1_jarak_halte: 0.3,
  C2_rute_unik: 0.2,
  C3_keterjangkauan_kampus: 0.4,
  C4_jarak_krl: 0.1,
  A1_harga_kos: 0.6,
  A2_harga_makan: 0.4,
  M1_kepadatan_makan: 0.35,
  M2_keragaman: 0.2,
  M3_keramaian: 0.2,
  M4_layanan_harian: 0.25,
  W1_kerapatan_simpang: 0.15,
  W2_keteduhan: 0.2,
  W3_penerangan: 0.15,
  W4_banjir: 0.15,
  W5_tekanan_lalin: 0.15,
  W6_integritas_jalur: 0.2,
};

// Penekanan antar-indikator DI DALAM satu dimensi, dipilih AI-1 dari kalimat
// pengguna. Nilainya pengali bobot indikator, bukan bobot itu sendiri.
//
// Alasannya: "yang penting banyak tempat makan, fasilitas lain tidak
// penting" sebelumnya hanya menaikkan seluruh dimensi Fasilitas — termasuk
// apotek dan minimarket yang justru dikecilkan pengguna. Terukur: 20 kawasan
// teratas berubah 60% antara bobot campuran dan penekanan tempat makan.
export const PENEKANAN = {
  makan: {
    M1_kepadatan_makan: 2.5,
    M2_keragaman: 1.5,
    M3_keramaian: 0.5,
    M4_layanan_harian: 0.2,
  },
  layanan: {
    M1_kepadatan_makan: 0.3,
    M2_keragaman: 0.3,
    M4_layanan_harian: 3,
  },
  transit: {
    C1_jarak_halte: 2,
    C2_rute_unik: 1.5,
    C3_keterjangkauan_kampus: 1.5,
    C4_jarak_krl: 0.2,
  },
};

// Dimensi yang disentuh tiap penekanan.
export const DIMENSI_PENEKANAN = {
  makan: "amenity",
  layanan: "amenity",
  transit: "connectivity",
};

// Kategori POI yang DISOROT untuk tiap penekanan, dipakai daftar tempat di
// panel kawasan.
//
// Bobot indikator saja tidak cukup menjawab "dekat apotek": M4 layanan harian
// adalah SATU indikator gabungan (apotek + minimarket + warung), jadi
// menaikkan bobotnya menaikkan ketiganya sekaligus. Yang bisa dibedakan
// adalah daftar tempatnya — di situ apotek, minimarket, dan warung memang
// tercatat terpisah. Jadi penekanan menentukan kategori mana yang tampil
// lebih dulu dan tidak terpotong oleh batas daftar.
export const SOROT_POI = {
  makan: ["makan"],
  layanan: ["apotek", "minimarket", "warung"],
};
