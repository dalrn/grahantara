function kuintil(nilaiArray) {
  const urut = [...nilaiArray].sort((a, b) => a - b);
  const n = urut.length;
  const ambang = [0.2, 0.4, 0.6, 0.8].map((q) => {
    const pos = (n - 1) * q;
    const bawah = Math.floor(pos);
    const atas = Math.ceil(pos);
    if (bawah === atas) return urut[bawah];
    return urut[bawah] + (urut[atas] - urut[bawah]) * (pos - bawah);
  });
  return ambang;
}

// hitungKuintil: 4 ambang batas (P20/P40/P60/P80) dari data nyata.
// Alasan: skor stub hanya membentang 14,4-75,1; ambang tetap 0-20-40-60-80-100
// akan membuang 2 dari 5 kelas.
export function hitungKuintil(nilaiArray) {
  if (!nilaiArray || nilaiArray.length === 0) return null;
  return kuintil(nilaiArray);
}

// Ekspresi MapLibre 'step' pada ['get','skor']: warna[0] di bawah ambang pertama,
// dst hingga warna[4] dari ambang keempat ke atas.
export function ekspresiWarna(ambang, warna) {
  if (!ambang || ambang.length !== 4) {
    throw new Error("ekspresiWarna butuh tepat 4 ambang batas");
  }
  return [
    "step",
    ["get", "skor"],
    warna[0],
    ambang[0], warna[1],
    ambang[1], warna[2],
    ambang[2], warna[3],
    ambang[3], warna[4],
  ];
}

// Lima label rentang, satu desimal, koma pemisah desimal (id-ID).
// min/maks adalah rentang data nyata (bukan 0-100).
export function labelKelas(ambang, min, maks) {
  const fmt = (v) => v.toLocaleString("id-ID", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const batas = [min, ...ambang, maks];
  const label = [];
  for (let i = 0; i < 5; i++) {
    label.push(`${fmt(batas[i])} - ${fmt(batas[i + 1])}`);
  }
  return label;
}

// Warna TEKS untuk angka skor, sejajar dengan skala isian heksagon tapi lebih
// terang supaya terbaca di panel gelap (>= 4,68:1 terhadap #20332e).
// Dipakai agar pembaca langsung tahu 10 itu buruk dan 90 itu bagus tanpa
// membandingkan dengan legenda.
const WARNA_TEKS_SKOR = [
  "#f0736a",
  "#f0a662",
  "#f0d45e",
  "#b5d97a",
  "#7fc98a",
];

/**
 * Warna teks untuk sebuah skor 0-100.
 *
 * `ambang` adalah empat ambang kuintil dari data nyata (hitungKuintil), sama
 * dengan yang dipakai mewarnai heksagon, sehingga warna angka dan warna
 * heksagon selalu sepakat. Kalau ambang belum ada, dipakai pembagian rata
 * 20/40/60/80 sebagai cadangan.
 */
export function warnaTeksSkor(skor, ambang) {
  if (!Number.isFinite(skor)) return null;
  const batas = ambang ?? [20, 40, 60, 80];
  return WARNA_TEKS_SKOR[batas.filter((t) => skor >= t).length];
}
