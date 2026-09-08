import { BOBOT_DEFAULT, EPS } from "../config";

const DIMENSI = ["connectivity", "affordability", "amenity", "walkability"];

export function siapkanMesin(featureCollection) {
  const n = featureCollection.features.length;
  const h3 = new Array(n);
  const L = {};
  // ada[d][i] = 1 kalau dimensi d punya data di heksagon i, 0 kalau tidak.
  // Dimensi yang seluruh indikatornya tidak_tersedia ditulis 0 pada subskor
  // demi kesesuaian skema, tapi pipeline MENGELUARKANNYA dari skor, bukan
  // menilainya 0. Tanpa membedakan keduanya, hitung ulang di klien akan
  // memberi angka berbeda dari properties.skor pada 1.981 heksagon.
  const ada = {};
  for (const d of DIMENSI) {
    L[d] = new Float64Array(n);
    ada[d] = new Uint8Array(n);
  }
  featureCollection.features.forEach((f, i) => {
    const sub = f.properties.subskor;
    const kosong = new Set(f.properties.dimensi_kosong ?? []);
    h3[i] = f.properties.h3_index;
    for (const d of DIMENSI) {
      L[d][i] = Math.log(sub[d] / 100 + EPS);
      ada[d][i] = kosong.has(d) ? 0 : 1;
    }
  });
  return { h3, L, ada, n };
}

// Skor = 100 * exp(SUM bobot[d] * L[d]) atas dimensi yang ADA saja, dengan
// bobotnya dinormalisasi ulang. Clamp ke [0,100].
export function hitungSemua(mesin, bobotTernormalisasi) {
  const { L, ada, n } = mesin;
  const hasil = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    let jumlah = 0;
    let totalBobot = 0;
    for (const d of DIMENSI) {
      if (!ada[d][i]) continue;
      jumlah += bobotTernormalisasi[d] * L[d][i];
      totalBobot += bobotTernormalisasi[d];
    }
    if (totalBobot <= 0) {
      hasil[i] = 0;
      continue;
    }
    // Bagi dengan totalBobot = normalisasi ulang bobot dimensi yang tersisa.
    const skor = 100 * Math.exp(jumlah / totalBobot);
    hasil[i] = Math.min(100, Math.max(0, skor));
  }
  return hasil;
}

export function normalisasiBobot(bobot) {
  let total = 0;
  for (const d of DIMENSI) total += bobot[d] ?? 0;
  if (total <= 0) {
    return { bobot: { ...BOBOT_DEFAULT }, jatuhKeBawaan: true };
  }
  const ternormalisasi = {};
  for (const d of DIMENSI) ternormalisasi[d] = (bobot[d] ?? 0) / total;
  return { bobot: ternormalisasi, jatuhKeBawaan: false };
}
