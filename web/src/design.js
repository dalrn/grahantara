export const scoreColors = [
  "#534675",
  "#5379a5",
  "#319b98",
  "#94ca91",
  "#edd58b",
];
// Token warna halaman, SEMUANYA diturunkan dari scoreColors di atas supaya
// beranda dan peta terbaca sebagai satu produk. Tiap nilai adalah versi lebih
// gelap dari satu kelas skala (lightness HSL dikalikan faktor tetap), dipilih
// sampai kontrasnya lolos WCAG AA pada latar terang.
//
//   biru   <- scoreColors[1] #5379a5 x0,72
//   toska  <- scoreColors[2] #319b98 x0,70   <- warna interaktif utama
//   hijau  <- scoreColors[3] #94ca91 x0,52
//   ungu   <- scoreColors[0] #534675 x0,60   <- teks utama
//
// scoreColors[4] (#edd58b, kuning) SENGAJA tidak punya turunan teks: pada
// latar terang kontrasnya hanya 1,45:1. Ia hanya dipakai sebagai aksen kecil
// non-teks, dan tetap muncul apa adanya di legenda serta heksagon peta.
export const uiColors = {
  aksen: "#226c6a",
  aksenPekat: "#1c5a58",
  tinta: "#322a46",
  angkaKawasan: "#3c5777",
  angkaKampus: "#226c6a",
  angkaIndikator: "#3e7a3b",
};

export const motionTokens = {
  micro: 0.2,
  panel: 0.3,
  ease: [0.22, 1, 0.36, 1],
};
