/**
 * Menerjemahkan nilai indikator jadi kalimat yang bisa dibaca pengguna awam.
 *
 * labelKualitatif() memberi kata sifat dari PERSENTIL, bukan nilai mentah,
 * sehingga satuan seperti NDVI atau nW/sr/cm2 tetap bisa dijelaskan.
 * kalimatKonteks() menyatakan posisinya terhadap kawasan lain. Satuan yang
 * sudah dipahami langsung (meter, rupiah, cacah) tidak diterjemahkan.
 */

import { formatNilai } from "./format.js";

// Satuan yang tidak perlu diterjemahkan: pembaca langsung paham.
const SATUAN_JELAS = new Set([
  "m",
  "rute",
  "titik",
  "kategori",
  "Rp/bulan",
  "Rp/porsi",
]);

// Kata sifat per indikator, dari persentil terendah ke tertinggi (kuintil).
// Arahnya mengikuti ARTI NILAI yang disimpan, bukan nama indikatornya: W5
// menyimpan `1 - tekanan`, jadi nilai tinggi berarti lalu lintas tenang.
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

// Nilai kategorikal. Tanpa peta ini "tidak_terjangkau" bocor ke layar dan
// mudah disalahartikan sebagai data kosong, padahal itu temuan nyata.
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
 */
// Satuan hitungan yang tetap boleh ditampilkan meski tidak ada di
// SATUAN_JELAS: cacah per satuan waktu yang dipahami awam.
const SATUAN_HITUNG_AWAM = new Set(["orang/10 menit"]);

/**
 * Nilai + satuan untuk dibaca manusia, HANYA bila bermakna bagi awam.
 * Memakai ulang satuanAbstrak (SATUAN_JELAS) sebagai penyaring utama.
 */
function nilaiTeksAwam(data) {
  const nilai = data?.nilai;
  // Enum / teks: labelnya sudah cukup, angka mentah malah membingungkan.
  if (typeof nilai === "string") return null;
  const satuan = data?.satuan;
  // Satuan instrumen (indeks, NDVI, nW/sr/cm2, per km2, ...) tidak berarti
  // bagi pencari kos.
  if (satuanAbstrak(satuan) && !SATUAN_HITUNG_AWAM.has(satuan)) return null;
  const teks = formatNilai(nilai, satuan);
  if (teks === null || teks === undefined) return null;
  // Nol asli ditolak (rawan bertabrakan dengan label kualitatif); angka
  // bukan-nol yang terbulatkan jadi nol juga ditolak.
  if (nilai === 0) return null;
  const angka = Number(
    String(teks).replace(/[^\d,-]/g, "").replace(/\./g, "").replace(",", "."),
  );
  if (Number.isFinite(angka) && angka === 0) return null;
  return teks;
}

export function muatanIndikatorAI(kunci, data, nama) {
  const tersedia =
    data && data.sumber !== "tidak_tersedia" && data.nilai !== null;
  // Tanpa nilaiTeks model menyimpulkan datanya tidak ada padahal hanya tidak
  // diberikan; tapi hanya nilai yang bermakna awam yang dikirim.
  const nilaiTeks = tersedia ? nilaiTeksAwam(data) : null;
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
    ...(nilaiTeks !== null && nilaiTeks !== undefined ? { nilaiTeks } : {}),
  };
}
