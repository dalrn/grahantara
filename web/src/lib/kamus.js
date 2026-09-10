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

export const LABEL_SUMBER = {
  survei: "Survei lapangan",
  mapid_poi: "MAPID POI",
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
