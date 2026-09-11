// Skala skor: merah (rendah) -> kuning -> hijau (tinggi). Urutannya searah
// dengan intuisi umum, jadi heksagon hijau = kawasan paling sesuai. Kelima
// warna sudah >= 3:1 terhadap basemap gelap #16201f sehingga tetap terbaca
// di peta.
export const scoreColors = [
  "#c2352c",
  "#e58b3c",
  "#f0d45e",
  "#9bcf5f",
  "#46a35a",
];

// Token warna halaman, SEMUANYA diturunkan dari scoreColors di atas supaya
// beranda dan peta terbaca sebagai satu produk. Tiap nilai adalah versi lebih
// gelap dari satu kelas skala (lightness HSL dikalikan/disetel), dipilih
// sampai kontrasnya lolos WCAG AA pada latar terang.
//
//   hijau  <- scoreColors[4] #46a35a  <- warna interaktif utama
//   kuning <- scoreColors[2] #f0d45e
//   merah  <- scoreColors[0] #c2352c
//
// scoreColors[2] (kuning) SENGAJA tidak punya turunan teks di latar terang:
// kontrasnya terlalu rendah. Ia hanya dipakai sebagai isian heksagon dan
// aksen non-teks, serta apa adanya di pita gelap.
export const uiColors = {
  aksen: "#285d33",
  aksenPekat: "#20492a",
  tinta: "#1d2a21",
  angkaKawasan: "#e0685e",
  angkaKampus: "#f0d45e",
  angkaIndikator: "#7fc98a",
};

// Warna pembeda Kawasan/Kos A dan B saat membandingkan. SENGAJA di luar
// skala skor: hue-nya 198 dan 320, jauh dari rentang 4-133 milik
// scoreColors. Oranye yang dipakai sebelumnya untuk B berada tepat di tengah
// skala (hue 28 = skor rendah), sehingga B terbaca "buruk" padahal skornya
// bisa lebih tinggi. Keduanya >= 5,1:1 di panel gelap.
export const bandingColors = {
  a: "#38bdf8",
  b: "#e857b8",
};

export const motionTokens = {
  micro: 0.2,
  panel: 0.3,
  ease: [0.22, 1, 0.36, 1],
};
