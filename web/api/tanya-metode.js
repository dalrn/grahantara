import { panggilDeepseek, parseJsonLonggar } from "./_klienLLM.js";
import { PENGETAHUAN_METODE } from "./_pengetahuan.js";

// Kata kunci fallback deterministik -> kalimat dari PENGETAHUAN_METODE.
const KATA_TOPIK = [
  {
    kata: ["rumus", "geometrik", "aritmetik", "0,01", "dipotong", "skor 1"],
    jawaban:
      "Skor memakai rata-rata geometrik berbobot supaya satu dimensi yang sangat rendah menjatuhkan skor total; rata-rata aritmetik akan menutupi kelemahan itu. Konstanta 0,01 mencegah skor nol absolut, sehingga skor terendah yang mungkin adalah 1 dan hasil di atas 100 dipotong.",
  },
  {
    kata: ["persentil", "peringkat", "peringkat persentil"],
    jawaban:
      "Setiap indikator dinilai dengan peringkat persentil terhadap seluruh heksagon wilayah studi, bukan terhadap nilai maksimum teoretis.",
  },
  {
    kata: ["dimensi", "bobot"],
    jawaban:
      "Ada empat dimensi: Akses transportasi (bobot bawaan 40), Biaya (25), Fasilitas (20), dan Lingkungan jalan kaki (15); total 16 indikator. Bobot antar-dimensi bisa digeser pengguna, sedangkan bobot antar-indikator tetap.",
  },
  {
    kata: ["data", "sumber", "dataset", "qgis", "python", "earth engine", "mapid", "osm", "sentinel", "viirs", "survei"],
    jawaban:
      "Sumber data: dataset MAPID, OpenStreetMap, Sentinel-2, VIIRS, dan survei lapangan tim. Analisis spasial memakai QGIS, Python geospatial (GeoPandas, OSMnx, NetworkX, H3), dan Google Earth Engine.",
  },
  {
    kata: ["ai", "model bahasa", "llm", "chatbot", "fungsi ai"],
    jawaban:
      "Ada empat fungsi AI di antarmuka: penerjemah kebutuhan dari kalimat bebas, penjelas skor kawasan, tanya lanjutan tentang kawasan, dan pembanding dua kawasan. Model bahasa tidak pernah menghitung skor dan tidak menerima data mentah; setiap fungsi punya jalur cadangan deterministik yang ditandai pita \"Dijawab tanpa AI\".",
  },
  {
    kata: ["arsitektur", "offline", "serverless", "geojson", "basis data", "runtime", "deploy"],
    jawaban:
      "Analisis berat dijalankan offline sebelum deploy dan hasilnya dibekukan jadi GeoJSON statis. Tidak ada basis data runtime dan tidak ada server aplikasi; panggilan server saat runtime hanya ke serverless function yang memproksi model bahasa dan routing.",
  },
];

function fallbackJawaban(pertanyaan, msLatensi) {
  const t = pertanyaan.toLowerCase();
  for (const topik of KATA_TOPIK) {
    if (topik.kata.some((k) => t.includes(k))) {
      return { jawaban: topik.jawaban, sumber: "fallback", msLatensi };
    }
  }
  return {
    jawaban:
      "Layanan bahasa sedang tidak merespons. Penjelasan lengkap ada di halaman ini.",
    sumber: "fallback",
    msLatensi,
  };
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ galat: "metode tidak didukung" });
    return;
  }
  const b = req.body ?? {};
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
  const riwayatTeks = b.riwayat
    .map((g) => `${g.peran === "pengguna" ? "Giliran pengguna" : "Giliran asisten"}: ${g.isi}`)
    .join("\n");
  const pengguna = [
    riwayatTeks ? `Riwayat percakapan:\n${riwayatTeks}` : "",
    `Pertanyaan pengguna: ${b.pertanyaan}`,
  ].filter(Boolean).join("\n");

  const sistem = `Kamu menjawab pertanyaan tentang proyek Grahantara dan metodenya.
Balas HANYA JSON, tanpa preamble, tanpa pagar markdown.
Bentuk keluaran:
{
  "jawaban": "<maksimal 70 kata>"
}
ATURAN:
- Kamu TIDAK punya data kawasan mana pun. Bila ditanya skor, harga, jarak,
  atau angka suatu lokasi tertentu, jawab bahwa halaman ini hanya membahas
  metode, dan arahkan pengguna membuka peta lalu memilih kawasan di sana.
- HANYA boleh memakai informasi dari pengetahuan proyek di bawah. DILARANG
  mengarang angka, nama berkas, isi kode, nama anggota tim, atau klaim
  dokumen.
- Bila pertanyaan tidak terjawab oleh pengetahuan di bawah, katakan tidak
  tahu. DILARANG menebak.
- DILARANG memakai kata "persentil" sebagai istilah tanpa menjelaskan
  maknanya.
- DILARANG menjawab pertanyaan di luar topik Grahantara; alihkan dengan
  satu kalimat.
- DILARANG memberi saran finansial atau menyuruh pengguna menyewa.
- Bahasa Indonesia, kalimat pendek, nada netral.

PENGETAHUAN PROYEK:
${PENGETAHUAN_METODE}`;

  let hasil;
  try {
    const isi = await panggilDeepseek({ sistem, pengguna, maxTokens: 500 });
    const parsed = parseJsonLonggar(isi);
    const jawaban = typeof parsed?.jawaban === "string" ? parsed.jawaban.trim() : "";
    if (!jawaban) throw new Error("bentuk tidak sah");
    hasil = { jawaban: jawaban.slice(0, 600), sumber: "llm", msLatensi: Date.now() - mulai };
  } catch {
    hasil = fallbackJawaban(b.pertanyaan, Date.now() - mulai);
  }
  res.status(200).json(hasil);
}
