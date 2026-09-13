/**
 * Lapisan temuan: penalaran yang DIHITUNG di server, deterministik, dan bisa
 * diuji tanpa memanggil API mana pun.
 */
import { SEBARAN, KUANTIL } from "./_sebaran.js";
import { NAMA_DIMENSI } from "./_namaDimensi.js";

const DIMENSI = Object.keys(NAMA_DIMENSI);

/**
 * Ambang keputusan, SEMUANYA di sini sebagai konstanta bernama.
 *
 * Jangan menyebar angka ini ke dalam logika: kalau ambangnya perlu disetel,
 * yang disunting harus satu tempat, dan uji bisa mengacu ke nama, bukan ke
 * angka yang kebetulan sama.
 */
export const AMBANG = {
  // Persentil subskor dimensi terhadap seluruh wilayah studi.
  DIMENSI_TINGGI: 0.7,
  DIMENSI_RENDAH: 0.3,
  // Persentil indikator di dalam sebuah dimensi.
  INDIKATOR_TINGGI: 0.65,
  INDIKATOR_RENDAH: 0.35,
  // Berapa bagian indikator penyusun yang harus lemah sebelum sebuah
  // keunggulan disebut "rapuh".
  MAYORITAS: 0.5,
  // Selisih subskor antar kawasan, diukur dalam SIMPANGAN BAKU dimensi itu.
  // Dipakai supaya 6 poin di dimensi ber-sd 7,6 tidak disamakan dengan 6 poin
  // di dimensi ber-sd 25,6.
  SELISIH_BESAR: 0.8,
  SELISIH_SEDANG: 0.3,
  // Jarak persentil antara indikator tertinggi dan terendah dalam satu
  // dimensi, sebelum sebarannya disebut terbelah.
  RENTANG_TERBELAH: 0.5,
  // Selisih SKOR AKHIR (poin, bukan simpangan baku) yang masih boleh disebut
  // "praktis setara". Penjagaan terpisah dari rasio sd: karena sd tiap
  // dimensi berbeda jauh, seluruh rasio bisa kecil sementara skor totalnya
  // berbeda cukup terlihat di panel. Menyebut dua kawasan setara padahal
  // angkanya jelas berbeda akan merusak kepercayaan.
  SETARA_SELISIH_SKOR: 1.5,
  // Paling banyak sekian temuan dikirim ke model.
  MAKS_TEMUAN: 3,
};

/**
 * Dampak nyata satu simpangan baku tiap dimensi terhadap SKOR AKHIR, dalam
 * poin. Diukur dari data: menaikkan subskor dimensi itu sebesar 1 sd, lalu
 * menghitung ulang rata-rata geometrik berbobot pada seluruh 2.134 heksagon.
 */
export const DAMPAK_PER_SD = {
  connectivity: 7.57,
  affordability: 6.51,
  amenity: 4.21,
  walkability: 0.98,
};

export const JENIS = {
  POSISI_DIMENSI: "posisi_dimensi",
  KEUNGGULAN_RAPUH: "keunggulan_rapuh",
  KONFLIK_PRIORITAS: "konflik_prioritas",
  BERGANTUNG_TAKSIRAN: "bergantung_taksiran",
  SEBARAN_TERBELAH: "sebaran_terbelah",
  SELISIH_DIMENSI: "selisih_dimensi",
  PRAKTIS_SETARA: "praktis_setara",
  PEMENANG_KALAH_PRIORITAS: "pemenang_kalah_prioritas",
  UNGGUL_SATU_INDIKATOR: "unggul_satu_indikator",
  UNGGUL_DARI_TAKSIRAN: "unggul_dari_taksiran",
};

/**
 * Persentil sebuah subskor terhadap seluruh wilayah studi, lewat pencarian
 * biner pada 101 titik kuantil. Mengembalikan 0..1.
 */
export function persentilDimensi(dimensi, nilai) {
  const q = KUANTIL[dimensi];
  if (!q || !Number.isFinite(nilai)) return null;
  let lo = 0;
  let hi = q.length - 1;
  while (lo < hi) {
    const tengah = (lo + hi) >> 1;
    if (q[tengah] < nilai) lo = tengah + 1;
    else hi = tengah;
  }
  return lo / (q.length - 1);
}

/** Label kasar untuk sebuah persentil dimensi. */
function tingkat(p) {
  if (p === null) return null;
  if (p >= AMBANG.DIMENSI_TINGGI) return "tinggi";
  if (p <= AMBANG.DIMENSI_RENDAH) return "rendah";
  return "menengah";
}

/**
 * Dimensi mana yang diberi poin terbanyak pengguna.
 *
 * Mengembalikan null bila keempatnya sama rata, dalam keadaan itu pengguna
 * tidak benar-benar memilih apa pun, jadi tidak ada "prioritas" yang bisa
 * dilanggar.
 */
export function prioritasPengguna(bobot) {
  if (!bobot) return null;
  const nilai = DIMENSI.map((d) => [d, Number(bobot[d]) || 0]);
  const maks = Math.max(...nilai.map(([, v]) => v));
  if (maks <= 0) return null;
  const teratas = nilai.filter(([, v]) => v === maks);
  if (teratas.length === DIMENSI.length) return null;
  return teratas.map(([d]) => d);
}

/** Indikator satu dimensi dari larik indikator 16 butir yang berurutan. */
function indikatorDimensi(indikator, dimensi, kelompok) {
  const kunci = kelompok?.[dimensi];
  if (!kunci) return [];
  // Larik indikator dikirim berurutan mengikuti KELOMPOK_INDIKATOR, jadi
  // irisannya bisa diambil lewat offset. Bila pemanggil menyediakan peta
  // nama -> dimensi, itu yang dipakai.
  return indikator.filter((ik) => kunci.includes(ik.nama));
}

const pct = (ik) => {
  if (typeof ik?.persentil !== "number") return null;
  return ik.persentil <= 1 ? ik.persentil : ik.persentil / 100;
};
const ada = (ik) => Boolean(ik?.tersedia ?? ik?.sumber !== "tidak_tersedia");

/**
 * Urutan prioritas jenis temuan. Makin kecil angkanya, makin dulu dipilih.
 *
 * Dua jenis WAJIB lolos karena mengubah seluruh nada kalimat: konflik dengan
 * prioritas pengguna, dan dua kawasan yang praktis setara.
 */
const PRIORITAS_JENIS = {
  [JENIS.PEMENANG_KALAH_PRIORITAS]: 0,
  [JENIS.PRAKTIS_SETARA]: 0,
  [JENIS.KONFLIK_PRIORITAS]: 0,
  [JENIS.KEUNGGULAN_RAPUH]: 1,
  [JENIS.UNGGUL_SATU_INDIKATOR]: 1,
  [JENIS.BERGANTUNG_TAKSIRAN]: 2,
  [JENIS.UNGGUL_DARI_TAKSIRAN]: 2,
  [JENIS.SEBARAN_TERBELAH]: 3,
};

/**
 * Kekuatan sinyal sebuah temuan, dipakai mengurutkan di dalam satu tingkat
 * prioritas. Ditimbang DAMPAK dimensi terhadap skor akhir, bukan hanya
 * kelangkaannya, temuan di Lingkungan jalan kaki yang langka tapi hampir
 * tidak menggerakkan skor tidak boleh menggeser temuan di Akses transportasi.
 */
function kekuatan(t) {
  const dampak = DAMPAK_PER_SD[t.dimensi] ?? 1;
  if (t.jenis === JENIS.KEUNGGULAN_RAPUH)
    return dampak * Math.abs((t.subskor ?? 0) - (t.tanpaPenopang ?? 0));
  if (t.jenis === JENIS.UNGGUL_SATU_INDIKATOR)
    return dampak * (t.kalahDi / Math.max(1, t.dari)) * 50;
  if (t.jenis === JENIS.KONFLIK_PRIORITAS)
    return dampak * (100 - (t.persentil ?? 50));
  if (t.jenis === JENIS.SEBARAN_TERBELAH) return dampak * 10;
  return dampak * 20;
}

/**
 * Pilih paling banyak AMBANG.MAKS_TEMUAN temuan, urutan prioritas tetap.
 *
 * Menaikkan ambang deteksi hanya menggeser masalahnya; yang dibutuhkan adalah
 * seleksi. Dengan begini model tidak perlu memilih sendiri, dan temuan kuat
 * tidak tenggelam di antara temuan lemah.
 */
export function pilihTemuan(semua, maks = AMBANG.MAKS_TEMUAN) {
  return [...semua]
    .sort((a, b) => {
      const pa = PRIORITAS_JENIS[a.jenis] ?? 9;
      const pb = PRIORITAS_JENIS[b.jenis] ?? 9;
      if (pa !== pb) return pa - pb;
      return kekuatan(b) - kekuatan(a);
    })
    .slice(0, maks);
}

/**
 * Temuan untuk RINGKASAN SATU KAWASAN.
 *
 * `kelompok` memetakan dimensi -> daftar nama indikator penyusunnya, supaya
 * modul ini tidak perlu tahu urutan internal larik indikator.
 */
export function temuanKawasan({ subskor, dimensiKosong = [], bobot, indikator = [], kelompok, bobotIndikator }) {
  const temuan = [];
  const kosong = new Set(dimensiKosong);
  const posisi = {};

  // KONTEKS, bukan temuan. Posisi keempat dimensi SELALU ada, jadi kalau
  // dicampur ke array temuan, model tidak punya cara membedakan mana yang
  // menonjol dan mana yang cuma latar. Dikirim terpisah supaya "temuan"
  // benar-benar berarti "hal yang tidak selalu muncul".
  const konteks = [];
  for (const d of DIMENSI) {
    if (kosong.has(d)) continue;
    const nilai = subskor?.[d];
    if (!Number.isFinite(nilai)) continue;
    const p = persentilDimensi(d, nilai);
    posisi[d] = p;
    konteks.push({
      jenis: JENIS.POSISI_DIMENSI,
      dimensi: d,
      nama: NAMA_DIMENSI[d],
      subskor: Math.round(nilai),
      persentil: Math.round(p * 100),
      tingkat: tingkat(p),
      medianWilayah: SEBARAN[d]?.median,
    });
  }

  for (const d of DIMENSI) {
    if (kosong.has(d)) continue;
    const p = posisi[d];
    if (p === null || p === undefined) continue;
    const butir = indikatorDimensi(indikator, d, kelompok).filter(ada);
    if (!butir.length) continue;

    // (b) Keunggulan TERKONSENTRASI: dimensi tinggi karena satu indikator
    // ekstrem, sisanya biasa saja.
    //
    // Bentuk lama ("mayoritas indikator lemah") nyaris tidak pernah menyala:
    // subskor adalah rata-rata berbobot persentil indikatornya, jadi dimensi
    // tinggi dengan mayoritas indikator lemah memang jarang secara matematis.
    // Ujinya sekarang langsung: BUANG indikator tertinggi, hitung ulang
    // subskornya dengan bobot sisanya dinormalisasi. Kalau jatuh di bawah
    // median wilayah, keunggulan itu memang bertumpu pada satu hal.
    if (p >= AMBANG.DIMENSI_TINGGI && butir.length >= 2) {
      const berbobot = butir
        .map((ik) => ({ ik, q: pct(ik), w: bobotIndikator?.[ik.nama] ?? 1 }))
        .filter((x) => x.q !== null);
      if (berbobot.length >= 2) {
        const tertinggi = berbobot.reduce((a, b) => (b.q > a.q ? b : a));
        const sisa = berbobot.filter((x) => x !== tertinggi);
        const totalW = sisa.reduce((t, x) => t + x.w, 0);
        if (totalW > 0) {
          const tanpaTertinggi =
            (100 * sisa.reduce((t, x) => t + x.w * x.q, 0)) / totalW;
          const medianWilayah = SEBARAN[d]?.median;
          if (Number.isFinite(medianWilayah) && tanpaTertinggi < medianWilayah) {
            temuan.push({
              jenis: JENIS.KEUNGGULAN_RAPUH,
              dimensi: d,
              nama: NAMA_DIMENSI[d],
              penopang: tertinggi.ik.nama,
              subskor: Math.round(subskor[d]),
              tanpaPenopang: Math.round(tanpaTertinggi),
              medianWilayah,
            });
          }
        }
      }

    }

    // (d) Dimensi kuat yang mengandung indikator taksiran.
    if (p >= AMBANG.DIMENSI_TINGGI) {
      const taksiran = butir.filter((ik) => ik.estimasi || ik.sumber === "model");
      if (taksiran.length) {
        temuan.push({
          jenis: JENIS.BERGANTUNG_TAKSIRAN,
          dimensi: d,
          nama: NAMA_DIMENSI[d],
          indikator: taksiran.map((ik) => ik.nama),
        });
      }
    }

    // (e) Sebaran indikator terbelah di dalam satu dimensi.
    const q = butir.map(pct).filter((x) => x !== null);
    if (q.length >= 2) {
      const maks = Math.max(...q);
      const min = Math.min(...q);
      if (
        maks - min >= AMBANG.RENTANG_TERBELAH &&
        maks >= AMBANG.INDIKATOR_TINGGI &&
        min <= AMBANG.INDIKATOR_RENDAH
      ) {
        const tertinggi = butir.find((ik) => pct(ik) === maks);
        const terendah = butir.find((ik) => pct(ik) === min);
        temuan.push({
          jenis: JENIS.SEBARAN_TERBELAH,
          dimensi: d,
          nama: NAMA_DIMENSI[d],
          tertinggi: tertinggi?.nama,
          terendah: terendah?.nama,
        });
      }
    }
  }

  // (c) Konflik dengan prioritas pengguna.
  const prioritas = prioritasPengguna(bobot);
  if (prioritas) {
    for (const d of prioritas) {
      if (kosong.has(d)) continue;
      const p = posisi[d];
      if (p !== null && p !== undefined && p <= AMBANG.DIMENSI_RENDAH) {
        temuan.push({
          jenis: JENIS.KONFLIK_PRIORITAS,
          dimensi: d,
          nama: NAMA_DIMENSI[d],
          persentil: Math.round(p * 100),
          bobot: Number(bobot?.[d]) || 0,
        });
      }
    }
  }

  return { konteks, temuan: pilihTemuan(temuan), semuaTemuan: temuan };
}

/** Selisih dalam satuan simpangan baku dimensi itu. */
function beratSelisih(dimensi, selisih) {
  const sd = SEBARAN[dimensi]?.simpanganBaku;
  if (!sd) return { rasio: null, tingkat: "tidak diketahui" };
  const rasio = Math.abs(selisih) / sd;
  const t =
    rasio >= AMBANG.SELISIH_BESAR
      ? "besar"
      : rasio >= AMBANG.SELISIH_SEDANG
        ? "sedang"
        : "dapat diabaikan";
  return { rasio: +rasio.toFixed(2), tingkat: t };
}

/** Temuan untuk PERBANDINGAN DUA KAWASAN. */
export function temuanBanding({ a, b, bobot, kelompok }) {
  const temuan = [];
  // Selisih keempat dimensi SELALU ada -> konteks, bukan temuan.
  const konteks = [];
  const kosongA = new Set(a.dimensiKosong ?? []);
  const kosongB = new Set(b.dimensiKosong ?? []);
  const perDimensi = {};

  // (a) Apakah selisih tiap dimensi berarti.
  for (const d of DIMENSI) {
    if (kosongA.has(d) || kosongB.has(d)) continue;
    const vA = a.subskor?.[d];
    const vB = b.subskor?.[d];
    if (!Number.isFinite(vA) || !Number.isFinite(vB)) continue;
    const selisih = vA - vB;
    const berat = beratSelisih(d, selisih);
    const unggul =
      berat.tingkat === "dapat diabaikan" ? "setara" : selisih > 0 ? "A" : "B";
    perDimensi[d] = { selisih, unggul, ...berat };
    konteks.push({
      jenis: JENIS.SELISIH_DIMENSI,
      dimensi: d,
      nama: NAMA_DIMENSI[d],
      subskorA: Math.round(vA),
      subskorB: Math.round(vB),
      selisih: Math.round(Math.abs(selisih)),
      simpanganBaku: SEBARAN[d]?.simpanganBaku,
      rasioSd: berat.rasio,
      tingkat: berat.tingkat,
      // Dampak nyata ke skor akhir, supaya "besar" secara kelangkaan tidak
      // terbaca sebagai "besar" secara pengaruh.
      dampakSkor: +(berat.rasio * (DAMPAK_PER_SD[d] ?? 0)).toFixed(1),
      unggul,
    });
  }

  const terbandingkan = Object.values(perDimensi);

  // (b) Kedua kawasan praktis setara.
  //
  // DUA syarat, bukan satu. Rasio simpangan baku saja tidak cukup: karena sd
  // tiap dimensi berbeda jauh, seluruh rasio bisa kecil sementara skor
  // totalnya berbeda cukup terlihat di panel. Menyebut dua kawasan setara
  // padahal angkanya jelas berbeda akan merusak kepercayaan.
  const selisihSkor = Math.abs((a.skor ?? 0) - (b.skor ?? 0));
  if (
    terbandingkan.length &&
    terbandingkan.every((x) => x.tingkat === "dapat diabaikan") &&
    selisihSkor <= AMBANG.SETARA_SELISIH_SKOR
  ) {
    temuan.push({
      jenis: JENIS.PRAKTIS_SETARA,
      selisihSkor: +selisihSkor.toFixed(1),
    });
  }

  // (c) Pemenang total kalah di dimensi prioritas pengguna.
  const prioritas = prioritasPengguna(bobot);
  const pemenang =
    Number.isFinite(a.skor) && Number.isFinite(b.skor)
      ? a.skor > b.skor
        ? "A"
        : b.skor > a.skor
          ? "B"
          : null
      : null;
  if (prioritas && pemenang) {
    for (const d of prioritas) {
      const x = perDimensi[d];
      if (!x || x.unggul === "setara" || x.unggul === pemenang) continue;
      temuan.push({
        jenis: JENIS.PEMENANG_KALAH_PRIORITAS,
        dimensi: d,
        nama: NAMA_DIMENSI[d],
        pemenangTotal: pemenang,
        unggulDiPrioritas: x.unggul,
        tingkat: x.tingkat,
        bobot: Number(bobot?.[d]) || 0,
      });
    }
  }

  // (d) dan (e): keunggulan dimensi yang rapuh atau bersumber taksiran.
  for (const d of DIMENSI) {
    const x = perDimensi[d];
    if (!x || x.unggul === "setara") continue;
    const menang = x.unggul === "A" ? a : b;
    const kalah = x.unggul === "A" ? b : a;
    const butirMenang = indikatorDimensi(menang.indikator ?? [], d, kelompok).filter(ada);
    const butirKalah = indikatorDimensi(kalah.indikator ?? [], d, kelompok).filter(ada);
    if (!butirMenang.length) continue;

    // (d) Unggul di dimensi, tapi kalah pada mayoritas indikator penyusunnya.
    let kalahButir = 0;
    let dibandingkan = 0;
    for (const ik of butirMenang) {
      const lawan = butirKalah.find((y) => y.nama === ik.nama);
      const qm = pct(ik);
      const ql = pct(lawan);
      if (qm === null || ql === null) continue;
      dibandingkan += 1;
      if (qm < ql) kalahButir += 1;
    }
    if (dibandingkan && kalahButir / dibandingkan > AMBANG.MAYORITAS) {
      temuan.push({
        jenis: JENIS.UNGGUL_SATU_INDIKATOR,
        dimensi: d,
        nama: NAMA_DIMENSI[d],
        kawasan: x.unggul,
        kalahDi: kalahButir,
        dari: dibandingkan,
      });
    }

    // (e) Keunggulan disumbang indikator bertanda estimasi.
    const taksiran = butirMenang.filter(
      (ik) => ik.estimasi || ik.sumber === "model",
    );
    if (taksiran.length) {
      temuan.push({
        jenis: JENIS.UNGGUL_DARI_TAKSIRAN,
        dimensi: d,
        nama: NAMA_DIMENSI[d],
        kawasan: x.unggul,
        indikator: taksiran.map((ik) => ik.nama),
      });
    }
  }

  return { konteks, temuan: pilihTemuan(temuan), semuaTemuan: temuan };
}
