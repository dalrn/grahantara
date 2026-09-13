/**
 * Menghitung statistik sebaran subskor tiap dimensi dari hexagons.geojson,
 * lalu menulisnya sebagai konstanta di api/_sebaran.js.
 *
 *     node scripts/buat_sebaran.mjs
 *
 * DIJALANKAN SEKALI, bukan per permintaan. Endpoint AI membutuhkan angka ini
 * untuk tahu apakah subskor 27 itu rendah dan apakah selisih 6 poin itu besar,
 * dan menghitungnya ulang untuk tiap permintaan berarti membaca berkas 4 MB
 * di dalam fungsi serverless yang punya batas waktu.
 *
 * Jalankan ulang setiap kali pipeline menghasilkan hexagons.geojson baru.
 * `dihitungDari` pada keluarannya mencatat versi data sumbernya, jadi
 * ketidakcocokan bisa terlihat.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const AKAR = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const SUMBER = path.join(AKAR, "public", "data", "hexagons.geojson");
const TUJUAN = path.join(AKAR, "api", "_sebaran.js");

const DIMENSI = ["connectivity", "affordability", "amenity", "walkability"];

/** Persentil tipe "nearest-rank" atas larik yang SUDAH terurut menaik. */
function persentil(urut, q) {
  if (!urut.length) return null;
  const pos = (urut.length - 1) * q;
  const bawah = Math.floor(pos);
  const atas = Math.ceil(pos);
  if (bawah === atas) return urut[bawah];
  return urut[bawah] + (urut[atas] - urut[bawah]) * (pos - bawah);
}

function statistik(nilai) {
  const urut = [...nilai].sort((a, b) => a - b);
  const n = urut.length;
  const rata = urut.reduce((a, b) => a + b, 0) / n;
  // Simpangan baku populasi: ini seluruh wilayah studi, bukan sampel darinya.
  const ragam = urut.reduce((a, b) => a + (b - rata) ** 2, 0) / n;
  return {
    n,
    median: +persentil(urut, 0.5).toFixed(2),
    simpanganBaku: +Math.sqrt(ragam).toFixed(2),
    p5: +persentil(urut, 0.05).toFixed(2),
    p95: +persentil(urut, 0.95).toFixed(2),
    min: +urut[0].toFixed(2),
    maks: +urut[n - 1].toFixed(2),
  };
}

const data = JSON.parse(fs.readFileSync(SUMBER, "utf-8"));
const fitur = data.features;

const sebaran = {};
// Larik subskor terurut per dimensi, dipakai mengubah subskor mana pun jadi
// persentil tanpa menyimpan 2.134 angka per dimensi di berkas keluaran.
const terurut = {};
for (const d of DIMENSI) {
  const nilai = fitur
    .filter((f) => !(f.properties.dimensi_kosong ?? []).includes(d))
    .map((f) => f.properties.subskor?.[d])
    .filter(Number.isFinite);
  sebaran[d] = statistik(nilai);
  terurut[d] = [...nilai].sort((a, b) => a - b);
}

const skorTotal = statistik(fitur.map((f) => f.properties.skor));

// Alih-alih menyimpan seluruh nilai, simpan 101 titik kuantil per dimensi
// (0%, 1%, ... 100%). Mencari persentil sebuah subskor cukup dengan mencari
// posisi sisip di larik 101 elemen itu — cukup presisi untuk kalimat seperti
// "termasuk 20% terendah", dan berkasnya tetap kecil.
const kuantil = {};
for (const d of DIMENSI) {
  kuantil[d] = Array.from({ length: 101 }, (_, i) =>
    +persentil(terurut[d], i / 100).toFixed(2),
  );
}

const isi = `// BERKAS HASIL BANGKITAN -- JANGAN DISUNTING TANGAN.
// Dibuat oleh scripts/buat_sebaran.mjs dari public/data/hexagons.geojson.
// Jalankan ulang skrip itu setiap kali pipeline menghasilkan data baru.
//
// Statistik sebaran subskor tiap dimensi atas seluruh wilayah studi. Dipakai
// lapisan temuan (_temuan.js) untuk menilai apakah sebuah subskor tergolong
// tinggi atau rendah, dan apakah selisih antar kawasan berarti atau bisa
// diabaikan. Tanpa ini model bahasa hanya bisa mengulang angka mentah.
export const DIHITUNG_DARI = ${JSON.stringify({
  versi: data.metadata?.versi ?? null,
  dihitung_pada: data.metadata?.dihitung_pada ?? null,
  jumlah: fitur.length,
})};

export const SEBARAN_SKOR = ${JSON.stringify(skorTotal)};

export const SEBARAN = ${JSON.stringify(sebaran, null, 2)};

// 101 titik kuantil per dimensi: indeks i = persentil ke-i.
export const KUANTIL = ${JSON.stringify(kuantil)};
`;

fs.writeFileSync(TUJUAN, isi, "utf-8");

console.log(`Data versi ${data.metadata?.versi} - ${fitur.length} heksagon`);
console.log(`skor total      median ${skorTotal.median}  sd ${skorTotal.simpanganBaku}  p5 ${skorTotal.p5}  p95 ${skorTotal.p95}`);
for (const d of DIMENSI) {
  const s = sebaran[d];
  console.log(
    `${d.padEnd(15)} median ${String(s.median).padStart(5)}  sd ${String(s.simpanganBaku).padStart(5)}` +
      `  p5 ${String(s.p5).padStart(5)}  p95 ${String(s.p95).padStart(5)}  n ${s.n}`,
  );
}
console.log(`-> ${path.relative(AKAR, TUJUAN)}`);
