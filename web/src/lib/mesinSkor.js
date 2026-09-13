import { BOBOT_DEFAULT, BOBOT_INDIKATOR, EPS } from "../config";
import { KELOMPOK_INDIKATOR } from "./kamus";

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
  // Persentil tiap indikator disimpan juga, supaya PENEKANAN antar-indikator
  // bisa dihitung ulang di klien (mis. "yang penting tempat makan saja").
  // Tanpa ini hanya subskor jadi yang tersedia, dan penekanan macam itu
  // mustahil: bobot antar-indikator terkunci di pipeline.
  //
  // Biayanya 16 Float64Array; dibangun sekali saat data dimuat, bukan per
  // gerakan slider.
  const P = {};
  for (const kel of KELOMPOK_INDIKATOR)
    for (const k of kel.kunci) P[k] = new Float64Array(n).fill(NaN);
  featureCollection.features.forEach((f, i) => {
    const ind = f.properties.indikator;
    if (!ind) return;
    for (const kel of KELOMPOK_INDIKATOR) {
      for (const k of kel.kunci) {
        const v = ind[k]?.persentil;
        if (typeof v === "number") P[k][i] = v;
      }
    }
  });
  return { h3, L, ada, n, P };
}

/**
 * Hitung ulang log-subskor satu dimensi dengan bobot indikator yang diubah.
 *
 * `penekanan` memetakan kunci indikator -> pengali bobotnya. Indikator tanpa
 * entri memakai bobot aslinya. Indikator tanpa data tetap DIKELUARKAN dan
 * bobot sisanya dinormalisasi ulang, persis aturan pipeline, kalau tidak,
 * penekanan akan diam-diam mengubah arti data hilang jadi nol.
 */
export function logSubskorDitekan(mesin, dimensi, penekanan) {
  const kel = KELOMPOK_INDIKATOR.find((x) => x.dimensi === dimensi);
  if (!kel || !mesin.P) return null;
  const { n, P } = mesin;
  const keluar = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    let jumlah = 0;
    let total = 0;
    for (const k of kel.kunci) {
      const p = P[k]?.[i];
      if (!Number.isFinite(p)) continue;
      const w = (BOBOT_INDIKATOR[k] ?? 0) * (penekanan[k] ?? 1);
      if (w <= 0) continue;
      jumlah += w * p;
      total += w;
    }
    keluar[i] = total > 0 ? Math.log((100 * jumlah) / total / 100 + EPS) : NaN;
  }
  return keluar;
}

// Skor = 100 * exp(SUM bobot[d] * L[d]) atas dimensi yang ADA saja, dengan
// bobotnya dinormalisasi ulang. Clamp ke [0,100].
export function hitungSemua(mesin, bobotTernormalisasi, timpaL = null) {
  const { L: Lasli, ada, n } = mesin;
  // `timpaL` menggantikan log-subskor sebuah dimensi, dipakai saat pengguna
  // menekankan indikator tertentu. Jalur cepat biasa tidak terpengaruh.
  const L = timpaL ? { ...Lasli, ...timpaL } : Lasli;
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
