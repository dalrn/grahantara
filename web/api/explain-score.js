import { panggilDeepseek, parseJsonLonggar } from "./_klienLLM.js";

const NAMA_DIMENSI = {
  connectivity: "Konektivitas",
  affordability: "Keterjangkauan",
  amenity: "Amenitas",
  walkability: "Kelayakan Jalan Kaki",
};

function sumberLabel(sumber) {
  const peta = {
    survei: "survei", mapid_poi: "MAPID POI", osm: "OpenStreetMap",
    sentinel2: "Sentinel-2", viirs: "VIIRS", inarisk: "InaRISK",
    krl: "Jadwal KRL", model: "Estimasi model", tidak_tersedia: "tidak tersedia",
  };
  return peta[sumber] ?? sumber;
}

function validasiBentuk(j) {
  if (!j || !Array.isArray(j.kekuatan) || j.kekuatan.length !== 2 ||
      !Array.isArray(j.kelemahan) || j.kelemahan.length !== 1 ||
      typeof j.ringkas !== "string") {
    return null;
  }
  return {
    kekuatan: j.kekuatan.map((s) => String(s).slice(0, 300)),
    kelemahan: j.kelemahan.map((s) => String(s).slice(0, 300)),
    ringkas: j.ringkas.slice(0, 300),
  };
}

function fallback(subskor, msLatensi) {
  const urut = Object.entries(subskor).sort((a, b) => b[1] - a[1]);
  const duaTertinggi = urut.slice(0, 2);
  const terendah = urut[urut.length - 1];
  return {
    kekuatan: duaTertinggi.map(([k, n]) =>
      `${NAMA_DIMENSI[k]} tergolong tinggi di kawasan ini, skor ${n}.`),
    kelemahan: [`${NAMA_DIMENSI[terendah[0]]} tergolong rendah, skor ${terendah[1]}.`],
    ringkas: "Ringkasan otomatis tanpa AI karena layanan bahasa tidak merespons.",
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
  const wajibSub = ["connectivity", "affordability", "amenity", "walkability"];
  if (!wajibSub.every((k) => angkaSah(sub[k]))) {
    res.status(400).json({ galat: "Keempat subskor harus angka 0-100." });
    return;
  }
  if (!Array.isArray(b.indikator) || b.indikator.length < 1 || b.indikator.length > 16) {
    res.status(400).json({ galat: "Indikator wajib 1-16 butir." });
    return;
  }

  const mulai = Date.now();
  const barisIndikator = b.indikator.map((ik) => {
    const labelSumber = sumberLabel(ik.sumber);
    if (ik.sumber === "tidak_tersedia") {
      return `${ik.nama}: tidak tersedia`;
    }
    const nilai = ik.nilai ?? "tidak tersedia";
    const persentil = typeof ik.persentil === "number" ? Math.round(ik.persentil * 100) : "-";
    const estimasi = ik.sumber === "model" ? " (estimasi)" : "";
    return `${ik.nama}: ${nilai} (persentil ${persentil}, sumber ${labelSumber}${estimasi})`;
  }).join("\n");

  const pengguna = [
    `Skor total: ${b.skor}`,
    `Subskor: Konektivitas ${sub.connectivity} | Keterjangkauan ${sub.affordability} | Amenitas ${sub.amenity} | Kelayakan Jalan Kaki ${sub.walkability}`,
    `Bobot: Konektivitas ${b.bobot?.connectivity ?? "-"} | Keterjangkauan ${b.bobot?.affordability ?? "-"} | Amenitas ${b.bobot?.amenity ?? "-"} | Kelayakan Jalan Kaki ${b.bobot?.walkability ?? "-"}`,
    `Indikator:\n${barisIndikator}`,
  ].join("\n");

  const sistem = `Kamu penjelas skor kelayakan hunian kos untuk mahasiswa di Sleman, DIY.
Balas HANYA JSON, tanpa preamble, tanpa pagar markdown.
Bentuk keluaran:
{
  "kekuatan": ["<kalimat>", "<kalimat>"],
  "kelemahan": ["<kalimat>"],
  "ringkas": "<satu kalimat, maksimal 25 kata>"
}
Tepat dua kekuatan dan tepat satu kelemahan.
ATURAN:
- Setiap kalimat WAJIB menyebut nama indikator atau nama dimensi yang
  diberikan, apa adanya.
- HANYA boleh memakai angka yang ada di data yang diberikan. DILARANG
  menghitung, menaksir, atau mengarang angka baru.
- DILARANG menyebut indikator yang bertanda "tidak tersedia" sebagai
  kekuatan atau kelemahan. Boleh disebut sebagai keterbatasan data.
- DILARANG menyebut nama tempat, jalan, kampus, atau kos tertentu.
  Kamu tidak diberi informasi itu.
- DILARANG memberi saran finansial atau menyuruh pengguna menyewa.
- Bahasa Indonesia, kalimat pendek, nada netral.`;

  let hasil;
  try {
    const isi = await panggilDeepseek({ sistem, pengguna });
    const parsed = parseJsonLonggar(isi);
    const bentuk = validasiBentuk(parsed);
    if (!bentuk) throw new Error("bentuk tidak sah");
    hasil = { ...bentuk, sumber: "llm", msLatensi: Date.now() - mulai };
  } catch {
    hasil = fallback(sub, Date.now() - mulai);
  }
  res.status(200).json(hasil);
}
