/**
 * Deteksi jenis perangkat, untuk memilih kata yang benar di teks bantuan.
 *
 * Menyebut "klik kanan" atau "Ctrl+klik" di ponsel membuat petunjuknya mustahil
 * diikuti; menyebut "tekan lama" di desktop membuatnya terasa salah alamat.
 * Karena itu kalimatnya dipilih, bukan ditampilkan dua-duanya sekaligus.
 *
 * Dasarnya `pointer: coarse` (jari, bukan tetikus), bukan lebar layar: tablet
 * lebar tetap perangkat sentuh, dan jendela desktop yang disempitkan tetap
 * punya tetikus.
 */

export function adalahSentuh() {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia("(pointer: coarse)").matches;
}

/**
 * Kata untuk jalan pintas menjatuhkan pin.
 *
 * Dipakai tooltip tombolnya sendiri, bukan hanya di panel lain: pengguna
 * menemukan jalan pintas dari kontrol yang sedang dipakainya.
 */
export function pintasJatuhkanPin(sentuh = adalahSentuh()) {
  return sentuh ? "tekan lama di peta" : "klik kanan di peta";
}

/** Kata untuk jalan pintas membandingkan kos. */
export function pintasBandingKos(sentuh = adalahSentuh()) {
  return sentuh ? "tekan lama pin kos" : "Ctrl+klik pin kos";
}
