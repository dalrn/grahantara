import { panggilDeepseek, parseJsonLonggar } from "./_klienLLM.js";

const NAMA_DIMENSI = {
  connectivity: "Akses transportasi",
  affordability: "Keterjangkauan",
  amenity: "Kenyamanan",
  walkability: "Kenyamanan berjalan kaki",
};
const DIMENSI = Object.keys(NAMA_DIMENSI);
const AMBANG_SETARA = 0.02;

// Tidak ada peta label sumber di sini: baris data hanya perlu penanda
// "(estimasi)" untuk sumber "model", dan barisData() menuliskannya langsung.
// Label sumber lengkap dipakai explain-score.js, bukan endpoint ini.

function angkaSah(x) {
  return typeof x === "number" && Number.isFinite(x) && x >= 0 && x <= 100;
}

function validasiBentuk(j) {
  if (!j || !Array.isArray(j.unggulA) || !Array.isArray(j.unggulB) ||
      typeof j.simpulan !== "string" ||
      !j.cocokUntuk || typeof j.cocokUntuk.A !== "string" || typeof j.cocokUntuk.B !== "string") {
    return null;
  }
  return {
    unggulA: j.unggulA.slice(0, 2).map((s) => String(s).slice(0, 300)),
    unggulB: j.unggulB.slice(0, 2).map((s) => String(s).slice(0, 300)),
    simpulan: j.simpulan.slice(0, 300),
    cocokUntuk: { A: j.cocokUntuk.A.slice(0, 300), B: j.cocokUntuk.B.slice(0, 300) },
  };
}

// --- SATU sumber kebenaran arah perbandingan ---
function ekstrakAngka(s) {
  // nilai datang sebagai string terformat Indonesia ("Rp 1.025.000/bulan",
  // "3.504,1 m", "0,4 NDVI"). Ambil token numerik lalu normalisasi ribuan/desimal.
  if (typeof s === "number") return s;
  if (typeof s !== "string") return null;
  const m = s.match(/[\d.,]+/);
  if (!m) return null;
  const bersih = m[0].replace(/\./g, "").replace(",", ".");
  const v = Number(bersih);
  return Number.isFinite(v) ? v : null;
}

// bandingNilai: dari NILAI numerik. unggul: dari PERSENTIL (polaritas sudah
// terkandung di persentil). Ambang 'setara' persentil: selisih < 0,02.
function arahBanding(nilaiA, nilaiB, persentilA, persentilB) {
  const nA = ekstrakAngka(nilaiA);
  const nB = ekstrakAngka(nilaiB);
  let bandingNilai = "tidak dapat dibandingkan";
  if (nA !== null && nB !== null) {
    bandingNilai = nA > nB ? "A lebih tinggi" : nB > nA ? "B lebih tinggi" : "setara";
  }
  let unggul = "tidak dapat dibandingkan";
  if (typeof persentilA === "number" && typeof persentilB === "number") {
    const beda = persentilA - persentilB;
    unggul = beda > AMBANG_SETARA ? "A" : beda < -AMBANG_SETARA ? "B" : "setara";
  }
  return { bandingNilai, unggul };
}

const fmtPersentil = (p) => (typeof p === "number" ? Math.round(p * 100) : "NA");

function barisData(nama, nilaiA, nilaiB, persentilA, persentilB, sumberA, sumberB, unavailableKedua) {
  if (unavailableKedua) {
    return `${nama}: tidak tersedia di kedua kawasan, dikeluarkan dari perbandingan`;
  }
  const estimA = sumberA === "model" && nilaiA ? " (estimasi)" : "";
  const estimB = sumberB === "model" && nilaiB ? " (estimasi)" : "";
  const { bandingNilai, unggul } = arahBanding(nilaiA, nilaiB, persentilA, persentilB);
  const teksA = nilaiA == null ? "tidak tersedia" : `${nilaiA}${estimA}`;
  const teksB = nilaiB == null ? "tidak tersedia" : `${nilaiB}${estimB}`;
  return `${nama}: A = ${teksA} (persentil ${fmtPersentil(persentilA)}), ` +
         `B = ${teksB} (persentil ${fmtPersentil(persentilB)}) -> ${bandingNilai}, unggul: ${unggul}`;
}

function arahDimensi(a, b, kosongA, kosongB) {
  const hasil = {};
  for (const d of DIMENSI) {
    const vA = a.subskor[d];
    const vB = b.subskor[d];
    // Nol pada dimensi kosong berarti "tidak ada data", bukan nilai nol:
    // perbandingannya tidak sah dan tidak boleh dipakai.
    const kosong = kosongA.has(d) || kosongB.has(d);
    const r = kosong
      ? { bandingNilai: "tidak dapat dibandingkan", unggul: "tidak dapat dibandingkan" }
      : arahBanding(vA, vB, vA, vB); // angka skala 0-100; persentil=bukan di sini
    hasil[d] = { ...r, vA, vB, kosongA: kosongA.has(d), kosongB: kosongB.has(d) };
  }
  return hasil;
}

function fallback(a, b, kosongA, kosongB, msLatensi) {
  const perDimensi = arahDimensi(a, b, kosongA, kosongB);
  const pilih = (sisi) => {
    const menang = DIMENSI.filter((d) => perDimensi[d].unggul === sisi)
      .sort((x, y) => Math.abs(perDimensi[y].vA - perDimensi[y].vB) - Math.abs(perDimensi[x].vA - perDimensi[x].vB));
    const hasil = [];
    for (const d of menang.slice(0, 2)) {
      hasil.push(`${NAMA_DIMENSI[d]} lebih tinggi di Kawasan ${sisi}, ${perDimensi[d].vA} berbanding ${perDimensi[d].vB}.`);
    }
    if (hasil.length < 2) {
      const cadangan = DIMENSI.filter((d) => perDimensi[d].unggul !== sisi && perDimensi[d].unggul !== "tidak dapat dibandingkan")
        .sort((x, y) => Math.abs(perDimensi[x].vA - perDimensi[x].vB) - Math.abs(perDimensi[y].vA - perDimensi[y].vB));
      for (const d of cadangan) {
        if (hasil.length >= 2) break;
        hasil.push(`${NAMA_DIMENSI[d]} hampir setara, ${perDimensi[d].vA} berbanding ${perDimensi[d].vB}.`);
      }
    }
    return hasil;
  };
  return {
    unggulA: pilih("A"),
    unggulB: pilih("B"),
    simpulan: "Perbandingan otomatis tanpa AI karena layanan bahasa tidak merespons.",
    cocokUntuk: { A: "tidak tersedia", B: "tidak tersedia" },
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
  const sahH3 = (x) => typeof x === "string" && /^[0-9a-f]{15}$/.test(x);
  if (!sahH3(b.a?.h3_index) || !sahH3(b.b?.h3_index)) {
    res.status(400).json({ galat: "h3_index tidak sah." });
    return;
  }
  if (b.a.h3_index === b.b.h3_index) {
    res.status(400).json({ galat: "Dua kawasan yang dibandingkan harus berbeda." });
    return;
  }
  const valid = (x) =>
    angkaSah(x?.skor) && DIMENSI.every((d) => angkaSah(x?.subskor?.[d])) &&
    Array.isArray(x?.indikator) && x.indikator.length >= 1 && x.indikator.length <= 16;
  if (!valid(b.a)) {
    res.status(400).json({ galat: "Kawasan A tidak sah: skor/subskor harus 0-100 dan indikator 1-16." });
    return;
  }
  if (!valid(b.b)) {
    res.status(400).json({ galat: "Kawasan B tidak sah: skor/subskor harus 0-100 dan indikator 1-16." });
    return;
  }
  const wajib = Object.keys(NAMA_DIMENSI);
  const kosongA = new Set((Array.isArray(b.a.dimensiKosong) ? b.a.dimensiKosong : []).filter((d) => wajib.includes(d)));
  const kosongB = new Set((Array.isArray(b.b.dimensiKosong) ? b.b.dimensiKosong : []).filter((d) => wajib.includes(d)));

  const mulai = Date.now();

  // baris-baris data dengan arah yang SUDAH dihitung server
  const garis = [];
  const rSkor = arahBanding(b.a.skor, b.b.skor, b.a.skor, b.b.skor);
  garis.push(`Skor total: A = ${b.a.skor}, B = ${b.b.skor} -> ${rSkor.bandingNilai}, unggul: ${rSkor.unggul}`);
  const perDimensi = arahDimensi(b.a, b.b, kosongA, kosongB);
  for (const d of DIMENSI) {
    const r = perDimensi[d];
    const teksA = r.kosongA ? "tidak tersedia" : b.a.subskor[d];
    const teksB = r.kosongB ? "tidak tersedia" : b.b.subskor[d];
    garis.push(`${NAMA_DIMENSI[d]} (subskor): A = ${teksA}, B = ${teksB} -> ${r.bandingNilai}, unggul: ${r.unggul}`);
  }
  const n = Math.min(b.a.indikator.length, b.b.indikator.length);
  for (let i = 0; i < n; i++) {
    const ia = b.a.indikator[i];
    const ib = b.b.indikator[i];
    const unavailableKedua = (ia.sumber === "tidak_tersedia" && ib.sumber === "tidak_tersedia") ||
      (ia.nilai == null && ib.nilai == null);
    garis.push(barisData(ia.nama, ia.nilai, ib.nilai, ia.persentil, ib.persentil, ia.sumber, ib.sumber, unavailableKedua));
  }
  const pengguna = `Bobot yang dipakai: ${DIMENSI.map((d) => `${NAMA_DIMENSI[d]} ${b.bobot?.[d] ?? "-"}`).join(" | ")}\n\nKawasan A: h3 ${b.a.h3_index} | Kawasan B: h3 ${b.b.h3_index}\n\n${garis.join("\n")}`;

  const sistem = `Kamu membandingkan dua kawasan hunian kos untuk mahasiswa di Sleman, DIY.
Kawasan disebut Kawasan A dan Kawasan B. Balas HANYA JSON, tanpa preamble,
tanpa pagar markdown.
Bentuk keluaran:
{
  "unggulA": ["<kalimat>", "<kalimat>"],
  "unggulB": ["<kalimat>", "<kalimat>"],
  "simpulan": "<dua kalimat, maksimal 45 kata>",
  "cocokUntuk": { "A": "<satu frasa singkat>", "B": "<satu frasa singkat>" }
}
Hingga dua keunggulan untuk masing-masing kawasan; pilih dua yang terkuat.
Bila sebuah kawasan tidak unggul pada dimensi maupun indikator mana pun,
tulis array keunggulannya KOSONG ([]) — jangan mengarang keunggulan.
ATURAN:
- Setiap kalimat WAJIB menyebut nama indikator atau dimensi yang diberikan.
- HANYA boleh memakai angka yang ada di data. DILARANG menghitung,
  menaksir, atau mengarang angka.
- Arah perbandingan SUDAH DIHITUNG dan diberikan pada setiap baris data
  sebagai "-> ... , unggul: ...". Salin arah itu apa adanya.
  DILARANG menyimpulkan sendiri kawasan mana yang lebih tinggi, lebih
  rendah, lebih murah, lebih dekat, atau lebih baik. Bila arah tertulis
  "unggul: B", kawasan yang unggul adalah B, tanpa kecuali.
- Kata "lebih rendah" hanya boleh dipakai bila bandingNilai memang
  menyatakan kawasan itu lebih rendah.
- Indikator bertanda "tidak dapat dibandingkan" atau "tidak tersedia"
  DILARANG dijadikan keunggulan.
- Dimensi yang bertanda "tidak dapat dibandingkan, unggul: tidak dapat
  dibandingkan" DILARANG dijadikan keunggulan salah satu kawasan.
- Salin angka beserta satuannya PERSIS seperti diberikan, termasuk
  posisi "Rp". Jangan menata ulang format.
- DILARANG menyebut nama tempat, jalan, kampus, atau kos tertentu.
- DILARANG memberi saran finansial atau menyuruh pengguna menyewa.
- "cocokUntuk" adalah tipe mahasiswa, contoh: "mahasiswa tanpa kendaraan",
  "mahasiswa berbudget ketat". Bukan nama orang, bukan nama kampus.
- Simpulan wajib netral. Jangan menyatakan satu kawasan mutlak lebih baik.
  Sebutkan pertukarannya.
- Bahasa Indonesia, kalimat pendek.`;

  let hasil;
  try {
    const isi = await panggilDeepseek({ sistem, pengguna });
    const parsed = parseJsonLonggar(isi);
    const bentuk = validasiBentuk(parsed);
    if (!bentuk) throw new Error("bentuk tidak sah");
    hasil = { ...bentuk, sumber: "llm", msLatensi: Date.now() - mulai };
  } catch {
    hasil = fallback(b.a, b.b, kosongA, kosongB, Date.now() - mulai);
  }
  res.status(200).json(hasil);
}
