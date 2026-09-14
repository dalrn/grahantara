import { panggilDeepseek, parseJsonLonggar } from "./_klienLLM.js";
import {
  NAMA_DIMENSI,
  KELOMPOK_NAMA,
  BOBOT_INDIKATOR_NAMA,
} from "./_namaDimensi.js";
import { temuanKawasan } from "./_temuan.js";
import { kalimatKonteks, kalimatTemuan } from "./_kalimatTemuan.js";


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

function fallback(subskor, kosong, msLatensi) {
  const ada = Object.entries(subskor).filter(([k]) => !kosong.has(k));
  const urut = ada.sort((a, b) => b[1] - a[1]);
  const kekuatan = urut.slice(0, 2).map(([k, n]) =>
    `${NAMA_DIMENSI[k]} tergolong kuat di kawasan ini, dengan nilai ${Math.round(n)} dari 100.`);
  const kelemahan = urut.length >= 2
    ? [`${NAMA_DIMENSI[urut[urut.length - 1][0]]} tergolong lemah, dengan nilai ${Math.round(urut[urut.length - 1][1])} dari 100.`]
    : [];
  return {
    kekuatan,
    kelemahan,
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
  // Dimensi yang seluruh indikatornya tidak tersedia ditulis 0 pada skema,
  // tapi dikeluarkan dari skor. "0" di sini berarti tidak ada data.
  const kosong = new Set((Array.isArray(b.dimensiKosong) ? b.dimensiKosong : []).filter((k) => wajibSub.includes(k)));
  if (!Array.isArray(b.indikator) || b.indikator.length < 1 || b.indikator.length > 16) {
    res.status(400).json({ galat: "Indikator wajib 1-16 butir." });
    return;
  }

  const mulai = Date.now();
  // Model menerima LABEL KUALITATIF dan peringkat, bukan nilai mentah dan
  // satuan teknis. Selama "43,1 m" atau "23,9 nW/sr/cm2" masuk ke konteks,
  // model mengulanginya dan keluarannya berbunyi seperti pembacaan instrumen.
  // Klien mengirim bentuk ini lewat muatanIndikatorAI (lib/bahasaIndikator.js);
  // bentuk lama tetap diterima sebagai cadangan.
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

  const { konteks, temuan } = temuanKawasan({
    h3Index: b.h3_index,
    subskor: sub,
    dimensiKosong: [...kosong],
    bobot: b.bobot,
    indikator: b.indikator,
    kelompok: KELOMPOK_NAMA,
    bobotIndikator: BOBOT_INDIKATOR_NAMA,
  });

  const pengguna = [
    `Skor total: ${Math.round(b.skor)}`,
    `Subskor: ${wajibSub.map((k) => kosong.has(k)
      ? `${NAMA_DIMENSI[k]}: tidak tersedia, dikeluarkan dari perhitungan skor`
      : `${NAMA_DIMENSI[k]} ${Math.round(sub[k])}`).join(" | ")}`,
    `Bobot: ${wajibSub.filter((k) => !kosong.has(k))
      .map((k) => `${NAMA_DIMENSI[k]} ${b.bobot?.[k] ?? "-"}`).join(" | ") || "-"}`,
    `Indikator:\n${barisIndikator}`,
    `\nPosisi tiap dimensi di seluruh wilayah studi (konteks):\n${
      konteks.map(kalimatKonteks).join("\n") || "-"
    }`,
    `\nTEMUAN (sudah dihitung, salin apa adanya):\n${
      temuan.map(kalimatTemuan).join("\n") || "(tidak ada temuan menonjol)"
    }`,
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
- Setiap kalimat WAJIB berlabuh pada TEMUAN atau indikator yang diberikan.
  Kalimat yang menyampaikan sebuah temuan TIDAK perlu menyebut nama
  indikator, cukup menyampaikan isi temuannya.
- Utamakan menyampaikan TEMUAN. Bagian "Indikator" dan "konteks" hanya
  bahan pendukung; menyebut ulang angkanya tanpa menambah makna tidak
  berguna bagi pembaca yang sudah melihat panel.
- DILARANG memulai kalimat dengan kata "Indikator".
- DILARANG memakai kata "persentil" sebagai istilah. Nyatakan artinya,
  misalnya "lebih teduh daripada sebagian besar kawasan lain".
- DILARANG menyebut angka berdesimal. Bulatkan, atau lebih baik pakai
  kata-kata.
- Maksimal dua kalimat per butir.
- DILARANG menghitung sendiri. SELURUH perbandingan besaran, selisih, dan
  posisi relatif SUDAH dihitung dan diberikan sebagai temuan atau konteks.
  Kamu menyalin temuan, bukan menghitungnya. Angka yang tidak ada di data
  yang diberikan DILARANG dipakai.
- Bila ada temuan bertanda KONFLIK PRIORITAS, temuan itu WAJIB muncul di
  kalimat ringkas.
- Temuan bertanda DIKUNJUNGI TIM DILARANG dijadikan kekuatan maupun
  kelemahan, dan DILARANG disebut sebagai alasan skornya tinggi atau rendah.
  Kawasan yang disurvei tidak lebih baik daripada yang tidak; skornya
  dihitung dari data yang sama. Boleh disebut sekali pada kalimat ringkas
  sebagai keterangan bahwa kondisinya sempat diperiksa langsung.
- Bila sebuah keunggulan ditandai bertumpu pada satu indikator, atau
  berasal dari angka taksiran, sebutkan keterbatasan itu DI KALIMAT YANG
  SAMA, jangan dipisah jadi kalimat sendiri.
- DILARANG menyebut indikator yang bertanda "tidak tersedia" sebagai
  kekuatan atau kelemahan. Boleh disebut sebagai keterbatasan data.
- Dimensi bertanda "tidak tersedia, dikeluarkan dari perhitungan skor"
  DILARANG dijadikan kekuatan maupun kelemahan. Boleh disebut sekali
  sebagai keterbatasan data pada kalimat ringkas.
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
    hasil = fallback(sub, kosong, Date.now() - mulai);
  }
  res.status(200).json(hasil);
}
