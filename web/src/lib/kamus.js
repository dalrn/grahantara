export const KELOMPOK_INDIKATOR = [
  {
    dimensi: "connectivity",
    label: "Akses transportasi",
    kunci: ["C1_jarak_halte", "C2_rute_unik", "C3_keterjangkauan_kampus", "C4_jarak_krl"],
  },
  {
    dimensi: "affordability",
    label: "Keterjangkauan",
    kunci: ["A1_harga_kos", "A2_harga_makan"],
  },
  {
    dimensi: "amenity",
    label: "Kenyamanan",
    kunci: ["M1_kepadatan_makan", "M2_keragaman", "M3_keramaian", "M4_layanan_harian"],
  },
  {
    dimensi: "walkability",
    label: "Kenyamanan berjalan kaki",
    kunci: [
      "W1_kerapatan_simpang",
      "W2_keteduhan",
      "W3_penerangan",
      "W4_banjir",
      "W5_tekanan_lalin",
      "W6_integritas_jalur",
    ],
  },
];

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
  W3_penerangan: "Penerangan kawasan",
  W4_banjir: "Keamanan dari genangan",
  W5_tekanan_lalin: "Tekanan lalu lintas",
  W6_integritas_jalur: "Integritas jalur pejalan",
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

export const NAMA_DIMENSI = {
  connectivity: "Akses transportasi",
  affordability: "Keterjangkauan",
  amenity: "Kenyamanan",
  walkability: "Kenyamanan berjalan kaki",
};

// SUMBER TUNGGAL label, urutan, dan warna keempat dimensi untuk kontrol yang
// dilihat pengguna: kartu prioritas di beranda dan slider bobot di /peta.
// Keduanya wajib memakai kata dan urutan yang sama, kalau tidak pilihan di
// beranda terasa tidak mendarat di peta.
//
// Sengaja terpisah dari KELOMPOK_INDIKATOR.label, yang dipakai panel detail,
// pembanding, dan metodologi dengan istilah yang lebih teknis
// ("Keterjangkauan", "Kenyamanan"). Label di sini dipilih supaya terbaca oleh
// mahasiswa baru.
export const DIMENSI_UI = [
  { kunci: "connectivity", label: "Akses transportasi", warna: "#5379a5" },
  { kunci: "affordability", label: "Biaya", warna: "#319b98" },
  { kunci: "amenity", label: "Fasilitas", warna: "#94ca91" },
  { kunci: "walkability", label: "Lingkungan jalan kaki", warna: "#b08fd4" },
];
