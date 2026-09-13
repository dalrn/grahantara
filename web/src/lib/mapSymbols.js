// Local sprites keep labels and transport icons available without a glyph server.
const campusLabels = {
  UGM: "UGM",
  UNY: "UNY",
  "UII Kaliurang": "UII",
  "UIN Sunan Kalijaga": "UIN",
  "UPN Veteran": "UPN",
  "STIE YKPN": "STIE YKPN",
  Instiper: "INSTIPER",
  AMIKOM: "AMIKOM",
  "Atma Jaya Babarsari": "UAJY",
  "Sanata Dharma III": "USD",
};

function sprite(width, height, draw) {
  const canvas = document.createElement("canvas");
  canvas.width = width * 2;
  canvas.height = height * 2;
  const ctx = canvas.getContext("2d");
  ctx.scale(2, 2);
  draw(ctx);
  return ctx.getImageData(0, 0, canvas.width, canvas.height);
}

// Geometri sprite kampus. Dipisah sebagai konstanta supaya lebar kotak dan
// posisi teks tidak bisa lagi berselisih.
const KAMPUS_FONT = "700 13px 'Plus Jakarta Sans', sans-serif";
const KAMPUS_TEKS_X = 33; // teks mulai setelah ikon toga
const KAMPUS_PAD_KANAN = 12; // jarak teks ke tepi dalam kotak

/**
 * Lebar sprite diukur dari lebar teks sebenarnya, bukan jumlah huruf: huruf
 * kapital lebar seperti M dan W melewati taksiran per-huruf dan membuat
 * labelnya meluber dari kotak.
 */
function lebarSpriteKampus(ctx, label) {
  const teks = ctx.measureText(label).width;
  return Math.max(70, Math.ceil(KAMPUS_TEKS_X + teks + KAMPUS_PAD_KANAN));
}

/**
 * Sprite kampus. `sorot` menandai kampus TUJUAN pengguna.
 *
 * Kampus pilihan diberi KUNING TERANG, sedangkan kampus lain tetap
 * krem-cokelat.
 *
 * Isian kuning saja TIDAK cukup membedakan: diukur, #ffd400 hanya berselisih
 * 1,36:1 terhadap krem #fff8ed milik kampus lain, jadi dalam grayscale
 * keduanya nyaris sama terang. Karena itu pembedanya bertumpu pada GARIS TEPI
 * (cokelat tua #7a4a00, 2,8 px vs 1,5 px) dan tinta gelap, bukan pada warna
 * isian. Tinta #2b2000 di atas kuning berkontras 11,2:1.
 */
export function campusImage(name, sorot = false) {
  const label = campusLabels[name] || name;
  // Pengukur sekali pakai: lebar kanvas harus diketahui SEBELUM kanvas
  // sprite dibuat, jadi tidak bisa memakai ctx milik sprite itu sendiri.
  const pengukur = document.createElement("canvas").getContext("2d");
  pengukur.font = KAMPUS_FONT;
  const width = lebarSpriteKampus(pengukur, label);
  const isi = sorot ? "#ffd400" : "#fff8ed";
  const garis = sorot ? "#7a4a00" : "#9a4610";
  const tinta = sorot ? "#2b2000" : "#9a4610";
  return sprite(width, 46, (ctx) => {
    ctx.fillStyle = isi;
    ctx.strokeStyle = garis;
    ctx.lineWidth = sorot ? 2.8 : 1.5;
    ctx.beginPath();
    ctx.roundRect(2, 2, width - 4, 33, 10);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(width / 2 - 5, 35);
    ctx.lineTo(width / 2, 43);
    ctx.lineTo(width / 2 + 5, 35);
    ctx.fill();
    ctx.stroke();
    // Mortarboard silhouette.
    ctx.fillStyle = tinta;
    ctx.beginPath();
    ctx.moveTo(10, 16);
    ctx.lineTo(19, 11);
    ctx.lineTo(28, 16);
    ctx.lineTo(19, 21);
    ctx.closePath();
    ctx.fill();
    ctx.fillRect(14, 21, 10, 3);
    ctx.font = KAMPUS_FONT;
    ctx.textBaseline = "middle";
    ctx.fillText(label, KAMPUS_TEKS_X, 19);
  });
}

export function busImage() {
  return sprite(32, 36, (ctx) => {
    ctx.fillStyle = "#effaff";
    ctx.strokeStyle = "#075985";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(2, 2, 28, 28, 8);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#075985";
    ctx.beginPath();
    ctx.roundRect(9, 7, 14, 16, 3);
    ctx.fill();
    ctx.fillRect(10, 22, 3, 4);
    ctx.fillRect(19, 22, 3, 4);
    ctx.fillStyle = "#effaff";
    ctx.fillRect(11, 10, 10, 7);
    ctx.beginPath();
    ctx.arc(12, 20, 1.3, 0, Math.PI * 2);
    ctx.arc(20, 20, 1.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#075985";
    ctx.beginPath();
    ctx.moveTo(12, 30);
    ctx.lineTo(16, 35);
    ctx.lineTo(20, 30);
    ctx.fill();
  });
}

// Use the original, unclipped polygon so the label stays stable across zooms.
export function polygonCenter(feature) {
  const ring = feature.geometry?.coordinates?.[0];
  if (!Array.isArray(ring) || ring.length < 4) return null;
  const points = ring.slice(0, -1);
  return [0, 1].map(
    (axis) => points.reduce((sum, p) => sum + p[axis], 0) / points.length,
  );
}
