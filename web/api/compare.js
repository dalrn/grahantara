import { panggilDeepseek, parseJsonLonggar } from "./_klienLLM.js";

const NAMA_DIMENSI = {
  connectivity: "Konektivitas",
  affordability: "Keterjangkauan",
  amenity: "Amenitas",
  walkability: "Kelayakan Jalan Kaki",
};
const DIMENSI = Object.keys(NAMA_DIMENSI);

function sumberLabel(sumber) {
  const peta = {
    survei: "survei", mapid_poi: "MAPID POI", osm: "OpenStreetMap",
    sentinel2: "Sentinel-2", viirs: "VIIRS", inarisk: "InaRISK",
    krl: "Jadwal KRL", model: "Estimasi model", tidak_tersedia: "tidak tersedia",
  };
  return peta[sumber] ?? sumber;
}

function angkaSah(x) {
  return typeof x === "number" && Number.isFinite(x) && x >= 0 && x <= 100;
}

function validasiBentuk(j) {
  if (!j || !Array.isArray(j.unggulA) || j.unggulA.length !== 2 ||
      !Array.isArray(j.unggulB) || j.unggulB.length !== 2 ||
      typeof j.simpulan !== "string" ||
      !j.cocokUntuk || typeof j.cocokUntuk.A !== "string" || typeof j.cocokUntuk.B !== "string") {
    return null;
  }
  return {
    unggulA: j.unggulA.map((s) => String(s).slice(0, 300)),
    unggulB: j.unggulB.map((s) => String(s).slice(0, 300)),
    simpulan: j.simpulan.slice(0, 300),
    cocokUntuk: { A: j.cocokUntuk.A.slice(0, 300), B: j.cocokUntuk.B.slice(0, 300) },
  };
}

function barisIndikator(ind) {
  const labelSumber = sumberLabel(ind.sumber);
  if (ind.sumber === "tidak_tersedia") return `${ind.nama}: tidak tersedia`;
  const nilai = ind.nilai ?? "tidak tersedia";
  const persentil = typeof ind.persentil === "number" ? Math.round(ind.persentil * 100) : "-";
  const estimasi = ind.sumber === "model" ? " (estimasi)" : "";
  return `${ind.nama}: ${nilai} (persentil ${persentil}, sumber ${labelSumber}${estimasi})`;
}

function blokKawasan(label, x) {
  return [
    `${label}: h3 ${x.h3_index}`,
    `  skor: ${x.skor}`,
    `  subskor: ${DIMENSI.map((d) => `${NAMA_DIMENSI[d]} ${x.subskor[d]}`).join(" | ")}`,
    `  indikator:\n${x.indikator.map(barisIndikator).join("\n")}`,
  ].join("\n");
}

function fallback(a, b, msLatensi) {
  const selisih = {};
  for (const d of DIMENSI) selisih[d] = a.subskor[d] - b.subskor[d];
  const menangA = DIMENSI.filter((d) => selisih[d] > 0).sort((x, y) => selisih[y] - selisih[x]);
  const menangB = DIMENSI.filter((d) => selisih[d] < 0).sort((x, y) => selisih[x] - selisih[y]);
  const pilih = (pemenang) => {
    const hasil = [];
    const sisi = pemenang === menangA ? "A" : "B";
    for (const d of pemenang.slice(0, 2)) {
      hasil.push(`${NAMA_DIMENSI[d]} lebih tinggi di Kawasan ${sisi}, ${a.subskor[d]} berbanding ${b.subskor[d]}.`);
    }
    if (hasil.length < 2) {
      // cadangan: dimensi yang tidak dimenangkan kawasan ini, berselisih terkecil
      const kandidat = DIMENSI.filter((d) => !pemenang.includes(d))
        .sort((x, y) => Math.abs(selisih[x]) - Math.abs(selisih[y]));
      for (const d of kandidat) {
        if (hasil.length >= 2) break;
        hasil.push(`${NAMA_DIMENSI[d]} hampir setara, ${a.subskor[d]} berbanding ${b.subskor[d]}.`);
      }
    }
    return hasil;
  };

  return {
    unggulA: pilih(menangA),
    unggulB: pilih(menangB),
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

  const mulai = Date.now();
  const bobotTeks = DIMENSI.map((d) => `${NAMA_DIMENSI[d]} ${b.bobot?.[d] ?? "-"}`).join(" | ");
  const pengguna = `Bobot yang dipakai: ${bobotTeks}\n\n${blokKawasan("Kawasan A", b.a)}\n\n${blokKawasan("Kawasan B", b.b)}`;

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
Tepat dua keunggulan untuk masing-masing kawasan.
ATURAN:
- Setiap kalimat WAJIB menyebut nama indikator atau dimensi yang diberikan.
- HANYA boleh memakai angka yang ada di data. DILARANG menghitung,
  menaksir, atau mengarang angka. Selisih antar kawasan boleh disebut
  secara kualitatif ("lebih tinggi"), bukan sebagai angka baru.
- Salin angka beserta satuannya PERSIS seperti diberikan, termasuk
  posisi "Rp". Jangan menata ulang format.
- DILARANG menyebut indikator bertanda "tidak tersedia" sebagai keunggulan.
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
    hasil = fallback(b.a, b.b, Date.now() - mulai);
  }
  res.status(200).json(hasil);
}
