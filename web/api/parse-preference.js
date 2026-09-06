import { panggilDeepseek, parseJsonLonggar } from "./_klienLLM.js";
import { DAFTAR_KAMPUS } from "./_daftarKampus.js";

const BOBOT_BAWAAN = { connectivity: 40, affordability: 25, amenity: 20, walkability: 15 };

function bobotBawaanSalin() {
  return { ...BOBOT_BAWAAN };
}

function cocokKampus(teks) {
  const t = teks.toLowerCase();
  for (const nama of DAFTAR_KAMPUS) {
    if (t.includes(nama.toLowerCase())) return nama;
  }
  return null;
}

function cocokAnggaran(teks) {
  const t = teks.toLowerCase().replace(/\./g, "");
  const pola = [
    /(\d+(?:[.,]\d+)?)\s*(?:juta|jt)\b/,
    /(\d+(?:[.,]\d+)?)\s*(?:ribu|rb|k)\b/,
    /(\d{4,8})/,
  ];
  for (const re of pola) {
    const m = t.match(re);
    if (m) {
      const v = parseFloat(m[1].replace(",", "."));
      if (/jt|juta/.test(m[0])) return v * 1_000_000;
      if (/rb|ribu|k\b/.test(m[0])) return v * 1_000;
      return v;
    }
  }
  return null;
}

function fallback(teks, msLatensi) {
  const t = teks.toLowerCase();
  const bobot = bobotBawaanSalin();
  const aturan = [
    [["halte", "bus", "trans jogja", "krl", "stasiun", "transport", "kampus", "dekat"], "connectivity"],
    [["murah", "budget", "anggaran", "hemat", "ekonomis", "ribu", "juta"], "affordability"],
    [["warung", "makan", "kuliner", "minimarket", "apotek", "jajan"], "amenity"],
    [["jalan kaki", "trotoar", "teduh", "aman", "banjir", "gelap", "terang"], "walkability"],
  ];
  for (const [kata, dimensi] of aturan) {
    if (kata.some((k) => t.includes(k))) bobot[dimensi] = Math.min(100, bobot[dimensi] + 20);
  }
  return {
    kampus: cocokKampus(teks),
    anggaran: cocokAnggaran(teks),
    bobot,
    ringkas: "Diproses tanpa AI karena layanan tidak merespons.",
    sumber: "fallback",
    bobotDiganti: false,
    msLatensi,
  };
}

function validasiKetat(raw, msLatensi) {
  let bobotDiganti = false;
  const b = raw?.bobot;
  let bobot = null;
  if (b && ["connectivity", "affordability", "amenity", "walkability"].every((k) => typeof b[k] === "number" && b[k] >= 0 && b[k] <= 100)) {
    bobot = {
      connectivity: b.connectivity,
      affordability: b.affordability,
      amenity: b.amenity,
      walkability: b.walkability,
    };
  } else {
    bobot = bobotBawaanSalin();
    bobotDiganti = true;
  }
  const kampus = DAFTAR_KAMPUS.includes(raw?.kampus) ? raw.kampus : null;
  let anggaran = null;
  if (typeof raw?.anggaran === "number" && raw.anggaran >= 100000 && raw.anggaran <= 10000000) {
    anggaran = raw.anggaran;
  }
  const ringkas = typeof raw?.ringkas === "string" ? raw.ringkas.slice(0, 200) : "";
  return { kampus, anggaran, bobot, ringkas, sumber: "llm", bobotDiganti, msLatensi };
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ galat: "metode tidak didukung" });
    return;
  }
  let teks;
  try {
    teks = req.body?.teks;
  } catch {
    teks = null;
  }
  if (typeof teks !== "string" || teks.length < 1 || teks.length > 500) {
    res.status(400).json({ galat: "Teks wajib diisi, panjang 1 sampai 500 karakter." });
    return;
  }

  const mulai = Date.now();
  let hasil;
  try {
    const sistem = `Kamu penerjemah kebutuhan tempat tinggal mahasiswa di Sleman, DIY.
Balas HANYA JSON, tanpa preamble, tanpa pagar markdown, tanpa penjelasan.
Bentuk keluaran:
{
  "kampus": <salah satu nama dari daftar, atau null>,
  "anggaran": <angka rupiah per bulan, atau null>,
  "bobot": { "connectivity": <0-100>, "affordability": <0-100>,
             "amenity": <0-100>, "walkability": <0-100> },
  "ringkas": "<satu kalimat Indonesia, maksimal 20 kata>"
}
Daftar kampus yang sah: ${DAFTAR_KAMPUS.join(", ")}
Arti dimensi:
  connectivity  = kedekatan halte, rute bus, stasiun KRL, akses ke kampus
  affordability = harga sewa kos dan harga makan
  amenity       = warung, tempat makan, minimarket, apotek
  walkability   = trotoar, keteduhan, penerangan, aman dari banjir
Bobot mencerminkan penekanan pengguna. Bila pengguna tidak menyebut suatu
dimensi, beri nilai sedang, bukan nol.
Bila kampus tidak disebut atau tidak ada di daftar, isi null.
Bila anggaran tidak disebut, isi null. Jangan menebak angka.`;
    const isi = await panggilDeepseek({ sistem, pengguna: teks });
    const parsed = parseJsonLonggar(isi);
    if (parsed === null) throw new Error("JSON tidak terparse");
    hasil = validasiKetat(parsed, Date.now() - mulai);
  } catch {
    hasil = fallback(teks, Date.now() - mulai);
  }
  res.status(200).json(hasil);
}
