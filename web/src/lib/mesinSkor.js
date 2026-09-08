import { BOBOT_DEFAULT, EPS } from "../config";

const DIMENSI = ["connectivity", "affordability", "amenity", "walkability"];

export function siapkanMesin(featureCollection) {
  const n = featureCollection.features.length;
  const h3 = new Array(n);
  const L = {};
  for (const d of DIMENSI) L[d] = new Float64Array(n);
  featureCollection.features.forEach((f, i) => {
    const sub = f.properties.subskor;
    h3[i] = f.properties.h3_index;
    for (const d of DIMENSI) {
      L[d][i] = Math.log(sub[d] / 100 + EPS);
    }
  });
  return { h3, L, n };
}

// Skor = 100 * exp(SUM bobot[d] * L[d]); clamp ke [0,100].
export function hitungSemua(mesin, bobotTernormalisasi) {
  const { L, n } = mesin;
  const hasil = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    let jumlah = 0;
    for (const d of DIMENSI) {
      jumlah += bobotTernormalisasi[d] * L[d][i];
    }
    const skor = 100 * Math.exp(jumlah);
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
