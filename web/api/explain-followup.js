import { panggilDeepseek, parseJsonLonggar } from "./_klienLLM.js";
import { NAMA_DIMENSI } from "./_namaDimensi.js";

const DIMENSI = ["connectivity", "affordability", "amenity", "walkability"];

// Blok pengetahuan proyek untuk prompt sistem. Konstanta statis; bukan bacaan
// berkas repo lain saat runtime.
const PENGETAHUAN_PROYEK = `- Grahantara menilai kelayakan kawasan hunian kos untuk mahasiswa di sabuk
  kampus Sleman, DIY. Premisnya: memilih tempat tinggal adalah keputusan
  mobilitas.
- Wilayah studi dibagi 2.134 heksagon H3 resolusi 9.
- Empat dimensi: Akses transportasi (bobot bawaan 40), Biaya (25),
  Fasilitas (20), Lingkungan jalan kaki (15). Total 16 indikator.
- Skor memakai RATA-RATA GEOMETRIK BERBOBOT, bukan aritmetik. Satu dimensi
  yang sangat rendah menjatuhkan skor total. Alasannya: kos dengan warung
  melimpah tapi tanpa akses transit tetap salah pilihan bagi mahasiswa
  tanpa kendaraan.
- Setiap indikator dinilai dengan peringkat persentil terhadap seluruh
  heksagon wilayah studi, bukan terhadap nilai maksimum teoretis.
- Dimensi yang seluruh indikatornya tidak tersedia DIKELUARKAN dari
  perhitungan, dan bobotnya dibagi ulang ke dimensi lain.
- Pengguna dapat menggeser bobot antar-dimensi. Bobot antar-indikator
  di dalam satu dimensi tetap dan tidak bisa diubah.
- Grahantara TIDAK menyimpan nama kos, alamat, nomor kontak, nama jalan,
  atau nama tempat usaha. Yang ada hanya skor dan indikator per kawasan.
- Penjelasan lengkap metode ada di halaman Metodologi aplikasi.`;

// Kata kunci fallback deterministik: pertanyaan -> dimensi.
const KATA_DIMENSI = [
  [["koneksi", "transit", "halte", "bus", "krl", "stasiun", "rute"], "connectivity"],
  [["harga", "murah", "biaya", "sewa", "anggaran", "budget"], "affordability"],
  [["warung", "makan", "minimarket", "apotek", "kuliner", "jajan"], "amenity"],
  [["jalan kaki", "trotoar", "teduh", "banjir", "penerangan", "gelap", "terang"], "walkability"],
];

function fallbackJawaban(subskor, kosong, pertanyaan, msLatensi) {
  const t = pertanyaan.toLowerCase();
  let dimensi = null;
  for (const [kata, d] of KATA_DIMENSI) {
    if (kata.some((k) => t.includes(k))) {
      dimensi = d;
      break;
    }
  }
  let jawaban;
  if (dimensi && kosong.has(dimensi)) {
    jawaban = `${NAMA_DIMENSI[dimensi]} tidak tersedia untuk kawasan ini, jadi dimensi itu tidak ikut dihitung dalam skor.`;
  } else if (dimensi && typeof subskor[dimensi] === "number") {
    jawaban = `${NAMA_DIMENSI[dimensi]} kawasan ini bernilai ${subskor[dimensi].toLocaleString("id-ID")} dari 100.`;
  } else {
    jawaban = "Layanan bahasa sedang tidak merespons. Angka lengkap tiap dimensi dan indikator ada di panel kawasan ini.";
  }
  return { jawaban, sumber: "fallback", msLatensi };
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ galat: "metode tidak didukung" });
    return;
  }
  const b = req.body ?? {};
  if (typeof b.h3_index !== "string" || !/^[0-9a-f]{15}$/.test(b.h3_index)) {
    res.status(400).json({ galat: "h3_index tidak sah." });
    return;
  }
  const angkaSah = (x) => typeof x === "number" && Number.isFinite(x) && x >= 0 && x <= 100;
  if (!angkaSah(b.skor)) {
    res.status(400).json({ galat: "Skor harus angka 0-100." });
    return;
  }
  const sub = b.subskor ?? {};
  if (!DIMENSI.every((k) => angkaSah(sub[k]))) {
    res.status(400).json({ galat: "Keempat subskor harus angka 0-100." });
    return;
  }
  const kosong = new Set(
    (Array.isArray(b.dimensiKosong) ? b.dimensiKosong : []).filter((k) => DIMENSI.includes(k)),
  );
  if (typeof b.bobot !== "object" || b.bobot === null || Array.isArray(b.bobot)) {
    res.status(400).json({ galat: "Bobot harus objek." });
    return;
  }
  if (!Array.isArray(b.indikator) || b.indikator.length < 1 || b.indikator.length > 16) {
    res.status(400).json({ galat: "Indikator wajib 1-16 butir." });
    return;
  }
  if (!Array.isArray(b.riwayat) || b.riwayat.length > 6) {
    res.status(400).json({ galat: "Riwayat maksimal 6 butir." });
    return;
  }
  const riwayatSah = b.riwayat.every(
    (g) =>
      g &&
      (g.peran === "pengguna" || g.peran === "asisten") &&
      typeof g.isi === "string",
  );
  if (!riwayatSah) {
    res.status(400).json({ galat: "Riwayat harus berisi giliran pengguna atau asisten." });
    return;
  }
  if (typeof b.pertanyaan !== "string" || b.pertanyaan.length < 1 || b.pertanyaan.length > 200) {
    res.status(400).json({ galat: "Pertanyaan wajib diisi, panjang 1 sampai 200 karakter." });
    return;
  }

  const mulai = Date.now();
  // Sama persis dengan explain-score.js: model menerima LABEL KUALITATIF dan
  // peringkat, bukan nilai mentah dan satuan teknis.
  const barisIndikator = b.indikator.map((ik) => {
    const tersedia = ik.tersedia ?? ik.sumber !== "tidak_tersedia";
    if (!tersedia) return `${ik.nama}: tidak tersedia`;
    const persentil =
      typeof ik.persentil === "number"
        ? Math.round(ik.persentil <= 1 ? ik.persentil * 100 : ik.persentil)
        : null;
    const label = ik.label ?? "tidak berlabel";
    const estimasi =
      ik.estimasi || ik.sumber === "model" ? " (angka taksiran)" : "";
    const peringkat =
      persentil === null
        ? ""
        : `, lebih baik daripada ${persentil}% kawasan lain`;
    return `${ik.nama}: ${label}${peringkat}${estimasi}`;
  }).join("\n");

  const riwayatTeks = b.riwayat
    .map((g) => `${g.peran === "pengguna" ? "Giliran pengguna" : "Giliran asisten"}: ${g.isi}`)
    .join("\n");

  const pengguna = [
    `Skor total: ${Math.round(b.skor)}`,
    `Subskor: ${DIMENSI.map((k) => kosong.has(k)
      ? `${NAMA_DIMENSI[k]}: tidak tersedia, dikeluarkan dari perhitungan skor`
      : `${NAMA_DIMENSI[k]} ${Math.round(sub[k])}`).join(" | ")}`,
    `Bobot: ${DIMENSI.filter((k) => !kosong.has(k))
      .map((k) => `${NAMA_DIMENSI[k]} ${b.bobot?.[k] ?? "-"}`).join(" | ") || "-"}`,
    `Indikator:\n${barisIndikator}`,
    riwayatTeks ? `Riwayat percakapan:\n${riwayatTeks}` : "",
    `Pertanyaan pengguna: ${b.pertanyaan}`,
  ].filter(Boolean).join("\n");

  const sistem = `Kamu melanjutkan penjelasan skor kelayakan hunian kos untuk mahasiswa di Sleman, DIY.
Balas HANYA JSON, tanpa preamble, tanpa pagar markdown.
Bentuk keluaran:
{
  "jawaban": "<maksimal 60 kata>"
}
ATURAN:
- HANYA boleh memakai angka yang ada di data yang diberikan. DILARANG
  menghitung, menaksir, menjumlahkan, merata-rata, atau mengarang angka baru.
- Bila pertanyaan menanyakan sesuatu yang tidak ada di data, jawab bahwa
  informasi itu tidak tersedia di Grahantara. DILARANG menebak.
- DILARANG memakai kata "persentil" sebagai istilah; nyatakan maknanya,
  misalnya "lebih teduh daripada sebagian besar kawasan lain".
- DILARANG menyebut angka berdesimal.
- Indikator atau dimensi bertanda "tidak tersedia" DILARANG dijadikan
  kekuatan maupun kelemahan; boleh disebut sebagai keterbatasan data.
- DILARANG menyebut nama tempat, jalan, kampus, atau kos tertentu.
  Kamu tidak diberi informasi itu.
- DILARANG memberi saran finansial atau menyuruh pengguna menyewa.
- DILARANG menjawab pertanyaan di luar topik kawasan ini; alihkan dengan
  satu kalimat.
- Bahasa Indonesia, kalimat pendek, nada netral.

PENGETAHUAN PROYEK:
${PENGETAHUAN_PROYEK}

ATURAN TAMBAHAN:
- Pengetahuan proyek di atas boleh dipakai untuk menjelaskan CARA KERJA
  Grahantara, misalnya kenapa memakai rata-rata geometrik, apa arti
  persentil, kenapa suatu dimensi dikeluarkan.
- ANGKA hanya boleh berasal dari data kawasan yang diberikan pada
  permintaan ini. DILARANG mengambil angka dari pengetahuan proyek
  kecuali bobot bawaan bila ditanya langsung.
- Bila pengguna bertanya tentang metode atau alasan, jawab dari
  pengetahuan proyek. Bila bertanya tentang kawasan, jawab dari data.
- DILARANG mengarang isi kode, nama berkas, atau klaim dokumen.`;

  let hasil;
  try {
    const isi = await panggilDeepseek({ sistem, pengguna, maxTokens: 500 });
    const parsed = parseJsonLonggar(isi);
    const jawaban = typeof parsed?.jawaban === "string" ? parsed.jawaban.trim() : "";
    if (!jawaban) throw new Error("bentuk tidak sah");
    hasil = { jawaban: jawaban.slice(0, 600), sumber: "llm", msLatensi: Date.now() - mulai };
  } catch {
    hasil = fallbackJawaban(sub, kosong, b.pertanyaan, Date.now() - mulai);
  }
  res.status(200).json(hasil);
}
