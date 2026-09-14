// Deteksi perangkat untuk memilih kata yang benar di teks bantuan: menyebut
// "klik kanan" di ponsel membuat petunjuknya mustahil diikuti. Dasarnya
// `pointer: coarse`, bukan lebar layar, karena tablet lebar tetap perangkat
// sentuh dan jendela desktop yang disempitkan tetap punya tetikus.

export function adalahSentuh() {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia("(pointer: coarse)").matches;
}

export function pintasJatuhkanPin(sentuh = adalahSentuh()) {
  return sentuh ? "tekan lama di peta" : "klik kanan di peta";
}

export function pintasBandingKos(sentuh = adalahSentuh()) {
  return sentuh ? "tekan lama pin kos" : "Ctrl+klik pin kos";
}
