// SUMBER TUNGGAL label, urutan, dan warna keempat dimensi untuk SELURUH
// antarmuka: beranda, panel Bobot, panel Kawasan Terpilih, panel Bandingkan,
// legenda, dan halaman Metodologi.
//
// Sebelumnya ada dua himpunan nama yang berbeda, DIMENSI_UI di beranda
// ("Biaya", "Fasilitas") dan KELOMPOK_INDIKATOR.label di panel detail
// ("Keterjangkauan", "Kenyamanan"), dengan alasan yang satu lebih teknis
// daripada yang lain. Akibatnya dua dari empat dimensi berganti nama saat
// pengguna pindah halaman, dan di panel detail "Kenyamanan" (amenity)
// berdampingan dengan "Kenyamanan berjalan kaki" (walkability): dua dimensi
// berbeda dengan nama nyaris identik. Semua turunan di bawah sekarang
// membaca dari sini; jangan menulis ulang nama dimensi di komponen mana pun.
export const DIMENSI_UI = [
  { kunci: "connectivity", label: "Akses transportasi", warna: "#5379a5" },
  { kunci: "affordability", label: "Biaya", warna: "#319b98" },
  { kunci: "amenity", label: "Fasilitas", warna: "#94ca91" },
  { kunci: "walkability", label: "Lingkungan jalan kaki", warna: "#b08fd4" },
];

// Peta kunci -> label, diturunkan dari DIMENSI_UI. Dipakai di tempat yang
// hanya memegang kunci dimensi (mis. daftar dimensi_kosong).
export const NAMA_DIMENSI = Object.fromEntries(
  DIMENSI_UI.map(({ kunci, label }) => [kunci, label]),
);

// Indikator per dimensi. `label` SELALU diturunkan dari DIMENSI_UI supaya
// panel detail dan beranda tidak pernah menyebut dimensi yang sama dengan
// dua nama berbeda.
const KUNCI_INDIKATOR = {
  connectivity: [
    "C1_jarak_halte",
    "C2_rute_unik",
    "C3_keterjangkauan_kampus",
    "C4_jarak_krl",
  ],
  affordability: ["A1_harga_kos", "A2_harga_makan"],
  amenity: [
    "M1_kepadatan_makan",
    "M2_keragaman",
    "M3_keramaian",
    "M4_layanan_harian",
  ],
  walkability: [
    "W1_kerapatan_simpang",
    "W2_keteduhan",
    "W3_penerangan",
    "W4_banjir",
    "W5_tekanan_lalin",
    "W6_integritas_jalur",
  ],
};

export const KELOMPOK_INDIKATOR = DIMENSI_UI.map(({ kunci, label }) => ({
  dimensi: kunci,
  label,
  kunci: KUNCI_INDIKATOR[kunci],
}));

/**
 * Keterangan pengukuran untuk indikator yang tanpa itu ambigu.
 *
 * "Jarak ke halte terdekat 483 m" tidak memberi tahu diukur dari MANA. Semua
 * jarak dihitung dari titik tengah heksagon, bukan dari kos atau dari tepi
 * kawasan, dan selisihnya bisa ratusan meter di sel selebar ~380 m.
 */
export const KETERANGAN_UKUR = {
  C1_jarak_halte: "dari titik tengah kawasan",
  C4_jarak_krl: "dari titik tengah kawasan",
  M1_kepadatan_makan: "dalam radius 800 m dari titik tengah",
  M2_keragaman: "dalam radius 800 m dari titik tengah",
  M4_layanan_harian: "dalam radius 800 m dari titik tengah",
};

export const NAMA_INDIKATOR = {
  C1_jarak_halte: "Jarak ke halte terdekat",
  C2_rute_unik: "Jumlah rute unik terjangkau",
  C3_keterjangkauan_kampus: "Keterjangkauan kampus",
  C4_jarak_krl: "Jarak ke stasiun KRL",
  A1_harga_kos: "Harga sewa kos",
  A2_harga_makan: "Harga makan",
  M1_kepadatan_makan: "Kepadatan tempat makan",
  M2_keragaman: "Keragaman kuliner",
  M3_keramaian: "Keramaian kawasan",
  M4_layanan_harian: "Ragam layanan harian",
  W1_kerapatan_simpang: "Kerapatan simpang jalan",
  W2_keteduhan: "Keteduhan jalur",
  W3_penerangan: "Penerangan malam",
  W4_banjir: "Keamanan dari genangan",
  // Pipeline menyimpan `1 - tekanan` (lihat 30_indicators/04_w5_lalin.py),
  // jadi nilai tinggi = lalu lintas TENANG. Label lama "Tekanan lalu lintas"
  // membalik artinya bagi pembaca: nilai 0,7 tampak "lebih padat" padahal
  // justru lebih tenang. Skornya sendiri sudah benar sejak awal.
  W5_tekanan_lalin: "Ketenangan lalu lintas",
  W6_integritas_jalur: "Jalur pejalan kaki",
};

// viirs dan inarisk hanya muncul pada berkas data lama; sejak 2026-09-11
// W3 dan W4 memakai sumber "mapid" (lapisan MAPID non-POI).
export const LABEL_SUMBER = {
  survei: "Survei lapangan",
  mapid_poi: "MAPID POI",
  mapid: "MAPID",
  osm: "OpenStreetMap",
  sentinel2: "Sentinel-2",
  viirs: "VIIRS",
  inarisk: "InaRISK",
  krl: "Jadwal KRL",
  model: "Estimasi model",
  tidak_tersedia: "Tidak tersedia",
};
