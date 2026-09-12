/**
 * Menerjemahkan nilai indikator jadi kalimat yang bisa dibaca mahasiswa baru.
 *
 * Dipakai panel kawasan dan panel pembanding. Ada tiga lapis:
 *
 *   1. labelKualitatif()  — "Cukup rindang", diturunkan dari PERSENTIL kawasan
 *                           terhadap seluruh wilayah studi, bukan dari nilai
 *                           mentah. Jadi satuan seaneh apa pun (NDVI,
 *                           nW/sr/cm2) tetap bisa dijelaskan.
 *   2. kalimatKonteks()   — "lebih teduh dari 64% kawasan"
 *   3. nilaiMentah()      — angka asli + satuannya, hanya untuk yang memang
 *                           mencarinya (di balik toggle).
 *
 * Satuan yang sudah langsung dipahami (meter, rupiah, jumlah titik/rute)
 * tidak diterjemahkan; angkanya justru lebih informatif apa adanya.
 */

// Satuan yang tidak perlu diterjemahkan: pembaca langsung paham.
const SATUAN_JELAS = new Set([
  "m",
  "rute",
  "titik",
  "kategori",
  "Rp/bulan",
  "Rp/porsi",
]);

/**
 * Kata sifat per indikator, diurut dari persentil terendah ke tertinggi.
 * Lima tingkat, dipetakan ke kuintil persentil.
 *
 * Arah kalimatnya mengikuti ARTI NILAI yang disimpan, bukan nama indikatornya.
 * Ini penting untuk W5: yang disimpan pipeline adalah `1 - tekanan`, jadi
 * nilai tinggi berarti lalu lintasnya TENANG, bukan padat.
 */
const SIFAT = {
  C1_jarak_halte: ["Sangat jauh", "Jauh", "Sedang", "Dekat", "Sangat dekat"],
  C2_rute_unik: ["Sangat sedikit", "Sedikit", "Sedang", "Banyak", "Sangat banyak"],
  C4_jarak_krl: ["Sangat jauh", "Jauh", "Sedang", "Dekat", "Sangat dekat"],
  A1_harga_kos: ["Sangat mahal", "Mahal", "Sedang", "Murah", "Sangat murah"],
  A2_harga_makan: ["Sangat mahal", "Mahal", "Sedang", "Murah", "Sangat murah"],
  M1_kepadatan_makan: ["Sangat sedikit", "Sedikit", "Sedang", "Banyak", "Sangat banyak"],
  M2_keragaman: ["Sangat seragam", "Kurang beragam", "Cukup beragam", "Beragam", "Sangat beragam"],
  M3_keramaian: ["Sangat sepi", "Sepi", "Sedang", "Ramai", "Sangat ramai"],
  M4_layanan_harian: ["Sangat terbatas", "Terbatas", "Cukup", "Lengkap", "Sangat lengkap"],
  W1_kerapatan_simpang: ["Sangat jarang", "Jarang", "Sedang", "Rapat", "Sangat rapat"],
  W2_keteduhan: ["Sangat gersang", "Kurang teduh", "Cukup rindang", "Rindang", "Sangat rindang"],
  W3_penerangan: ["Sangat gelap", "Gelap", "Cukup terang", "Terang", "Sangat terang"],
  W4_banjir: ["Sangat rawan", "Rawan", "Cukup aman", "Aman", "Sangat aman"],
  W5_tekanan_lalin: ["Sangat padat", "Padat", "Cukup tenang", "Tenang", "Sangat tenang"],
  W6_integritas_jalur: ["Hampir tidak ada", "Terputus-putus", "Cukup utuh", "Relatif utuh", "Sangat utuh"],
};

/**
 * Kata pembanding untuk kalimat konteks: "lebih ___ dari 64% kawasan".
 * Sekali lagi mengikuti arti nilai, bukan nama indikator.
 */
const PEMBANDING = {
  C1_jarak_halte: "dekat ke halte",
  C2_rute_unik: "banyak pilihan rute",
  C4_jarak_krl: "dekat ke stasiun",
  A1_harga_kos: "murah",
  A2_harga_makan: "murah",
  M1_kepadatan_makan: "banyak tempat makan",
  M2_keragaman: "beragam",
  M3_keramaian: "ramai",
  M4_layanan_harian: "lengkap layanannya",
  W1_kerapatan_simpang: "rapat simpangnya",
  W2_keteduhan: "teduh",
  W3_penerangan: "terang",
  W4_banjir: "aman dari genangan",
  W5_tekanan_lalin: "tenang lalu lintasnya",
  W6_integritas_jalur: "baik jalur pejalan kakinya",
};

/**
 * Nilai kategorikal. Tanpa peta ini, "tidak_terjangkau" bocor apa adanya ke
 * layar dan mudah disalahartikan sebagai data kosong atau error — padahal
 * artinya temuan nyata: tidak ada koridor transit yang sampai ke kampus itu.
 */
const ENUM = {
  C3_keterjangkauan_kampus: {
    langsung: {
      label: "Ada rute langsung",
      jelas: "Bisa sampai kampus tanpa berganti kendaraan.",
    },
    satu_transfer: {
      label: "Perlu sekali ganti",
      jelas: "Bisa sampai kampus dengan sekali berganti kendaraan.",
    },
    tidak_terjangkau: {
      label: "Belum terjangkau transit",
      jelas:
        "Tidak ada koridor transit yang sampai ke kampus tujuan dari kawasan ini. Bukan berarti datanya kosong.",
    },
  },
};

const kuintil = (persentil) =>
  Math.max(0, Math.min(4, Math.floor((persentil ?? 0) * 5)));

/** Label kualitatif dari persentil, mis. "Cukup rindang". */
export function labelKualitatif(kunci, data) {
  if (!data) return null;
  const e = ENUM[kunci]?.[data.nilai];
  if (e) return e.label;
  if (typeof data.persentil !== "number") return null;
  return SIFAT[kunci]?.[kuintil(data.persentil)] ?? null;
}

/** Kalimat konteks, mis. "lebih teduh dari 64% kawasan". */
export function kalimatKonteks(kunci, data) {
  if (!data) return null;
  if (ENUM[kunci]?.[data.nilai]) return ENUM[kunci][data.nilai].jelas;
  if (typeof data.persentil !== "number") return null;
  const kata = PEMBANDING[kunci];
  if (!kata) return null;
  const persen = Math.round(data.persentil * 100);
  // Di bawah median kalimatnya DIBALIK, bukan hanya di ujung bawah.
  //
  // Ambang lama 15% membuat baris seperti "Sangat jarang - lebih rapat
  // simpangnya dari 17% kawasan" lolos: label kualitatifnya negatif sementara
  // kalimatnya berbunyi positif, dan pembaca harus menghitung sendiri bahwa
  // 17% itu buruk. Di bawah 50 yang benar adalah menyebut mayoritas yang
  // lebih baik, supaya arah label dan arah kalimat selalu sepakat.
  if (persen < 50) {
    return `${100 - persen}% kawasan lain lebih ${kata}`;
  }
  return `lebih ${kata} dari ${persen}% kawasan`;
}

/** Apakah satuan indikator ini perlu disembunyikan di balik toggle. */
export function satuanAbstrak(satuan) {
  if (!satuan) return true;
  return !SATUAN_JELAS.has(satuan);
}


/**
 * Baris indikator siap tampil, dipakai bersama panel Kawasan dan panel
 * Bandingkan supaya keduanya tidak pernah menerjemahkan angka dengan aturan
 * yang berbeda.
 *
 * Mengembalikan { utama, konteks, mentah } di mana:
 *   utama   - yang ditampilkan secara bawaan. Label kualitatif untuk satuan
 *             abstrak (indeks, NDVI, nW/sr/cm2), angka apa adanya untuk
 *             satuan yang memang dipahami langsung (meter, rupiah, cacah).
 *   konteks - kalimat persentil, mis. "lebih teduh dari 88% kawasan".
 *   mentah  - angka + satuan asli, hanya untuk di balik toggle.
 *
 * Alasan memisahkan keduanya: menampilkan nilai mentah dan persentil
 * bersamaan sering saling bertentangan di mata pembaca. "0,2 indeks —
 * persentil 93" terbaca sebagai nilai buruk, padahal kawasan itu termasuk 7%
 * terbaik; angka rendah itu hanya berarti indikatornya memang rendah di mana-
 * mana. Yang menentukan baik-buruk adalah persentilnya, jadi itulah yang
 * tampil lebih dulu.
 */
export function barisIndikator(kunci, data) {
  if (!data || data.sumber === "tidak_tersedia" || data.nilai === null) {
    return null;
  }
  const label = labelKualitatif(kunci, data);
  const konteks = kalimatKonteks(kunci, data);
  const abstrak = satuanAbstrak(data.satuan);
  return { label, konteks, abstrak };
}

/**
 * Muatan indikator yang dikirim ke model bahasa.
 *
 * Model TIDAK menerima nilai mentah, satuan teknis, atau nama kunci internal.
 * Selama angka seperti "43,1 m" dan "23,9 nW/sr/cm2" masuk ke konteks, model
 * akan mengulanginya apa adanya dan keluarannya berbunyi seperti pembacaan
 * instrumen ("Indikator Jarak ke halte terdekat menunjukkan 43,1 m dengan
 * persentil 99"). Itu bukan masalah prompt, melainkan masalah masukan.
 *
 * Yang dikirim: nama indikator, label kualitatif, dan persentil sebagai
 * bilangan bulat 0-100. Cukup untuk menilai baik-buruk, tidak cukup untuk
 * mengarang presisi.
 */
export function muatanIndikatorAI(kunci, data, nama) {
  const tersedia =
    data && data.sumber !== "tidak_tersedia" && data.nilai !== null;
  return {
    nama,
    label: tersedia ? labelKualitatif(kunci, data) : null,
    persentil:
      tersedia && typeof data.persentil === "number"
        ? Math.round(data.persentil * 100)
        : null,
    tersedia: Boolean(tersedia),
    // Penanda kualitas data tetap dikirim supaya model bisa menghindari
    // menyebut angka taksiran sebagai fakta.
    estimasi: tersedia && data.sumber === "model",
  };
}
