// Salinan server dari DIMENSI_UI di web/src/lib/kamus.js.
//
// Folder api/ adalah fungsi serverless Vercel dan TIDAK boleh mengimpor dari
// src/, jadi nama dimensi disalin ke sini, pola yang sama dengan
// _daftarKampus.js. Berkas berawalan garis bawah tidak diperlakukan Vercel
// sebagai endpoint.
//
// Kalau label di kamus.js berubah, ubah juga di sini. Satu salinan untuk
// seluruh api/, bukan satu per endpoint seperti sebelumnya.
export const NAMA_DIMENSI = {
  connectivity: "Akses transportasi",
  affordability: "Biaya",
  amenity: "Fasilitas",
  walkability: "Lingkungan jalan kaki",
};

// Nama indikator penyusun tiap dimensi, dalam bahasa yang SAMA dengan yang
// dikirim klien (muatanIndikatorAI mengirim `nama`, bukan kunci internal).
// Salinan dari KELOMPOK_INDIKATOR + NAMA_INDIKATOR di src/lib/kamus.js;
// api/ tidak boleh mengimpor dari src/.
//
// Dipakai lapisan temuan untuk tahu indikator mana menyusun dimensi mana.
export const KELOMPOK_NAMA = {
  connectivity: [
    "Jarak ke halte terdekat",
    "Jumlah rute unik terjangkau",
    "Keterjangkauan kampus",
    "Jarak ke stasiun KRL",
  ],
  affordability: ["Harga sewa kos", "Harga makan"],
  amenity: [
    "Kepadatan tempat makan",
    "Keragaman kuliner",
    "Keramaian kawasan",
    "Ragam layanan harian",
  ],
  walkability: [
    "Kerapatan simpang jalan",
    "Keteduhan jalur",
    "Penerangan malam",
    "Keamanan dari genangan",
    "Ketenangan lalu lintas",
    "Jalur pejalan kaki",
  ],
};

// Bobot antar-indikator di dalam dimensinya (pipeline/config/weights.yaml).
// Dipakai lapisan temuan untuk menghitung ulang subskor tanpa indikator
// penopangnya. Tetap, tidak bisa diubah pengguna.
export const BOBOT_INDIKATOR_NAMA = {
  "Jarak ke halte terdekat": 0.3,
  "Jumlah rute unik terjangkau": 0.2,
  "Keterjangkauan kampus": 0.4,
  "Jarak ke stasiun KRL": 0.1,
  "Harga sewa kos": 0.6,
  "Harga makan": 0.4,
  "Kepadatan tempat makan": 0.35,
  "Keragaman kuliner": 0.2,
  "Keramaian kawasan": 0.2,
  "Ragam layanan harian": 0.25,
  "Kerapatan simpang jalan": 0.15,
  "Keteduhan jalur": 0.2,
  "Penerangan malam": 0.15,
  "Keamanan dari genangan": 0.15,
  "Ketenangan lalu lintas": 0.15,
  "Jalur pejalan kaki": 0.2,
};
