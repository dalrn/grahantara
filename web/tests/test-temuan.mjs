/**
 * Uji lapisan temuan (api/_temuan.js).
 *
 *     node tests/test-temuan.mjs
 *
 * Menguji LOGIKA TEMUAN, bukan keluaran model: tidak ada panggilan API di
 * sini, dan hasilnya deterministik. Itu memang inti gagasannya, penalaran
 * dipindahkan ke tempat yang bisa diuji.
 *
 * Kawasan uji dibuat tangan, bukan diambil dari data nyata, supaya tiap kasus
 * bisa dibuat tajam dan tidak ikut berubah saat pipeline menghasilkan data
 * baru.
 */
import assert from "node:assert/strict";
import {
  temuanKawasan,
  temuanBanding,
  persentilDimensi,
  prioritasPengguna,
  pilihTemuan,
  AMBANG,
  DAMPAK_PER_SD,
  JENIS,
} from "../api/_temuan.js";
import { KELOMPOK_NAMA } from "../api/_namaDimensi.js";
import { SEBARAN } from "../api/_sebaran.js";

let lulus = 0;
const uji = (nama, fn) => {
  try {
    fn();
    console.log(`  PASS  ${nama}`);
    lulus += 1;
  } catch (e) {
    console.log(`  FAIL  ${nama}\n        ${e.message}`);
    process.exitCode = 1;
  }
};

const ik = (nama, persentil, extra = {}) => ({
  nama,
  label: "-",
  persentil,
  tersedia: true,
  estimasi: false,
  ...extra,
});

/** Seluruh 16 indikator pada satu persentil seragam. */
const indikatorSeragam = (p) =>
  Object.values(KELOMPOK_NAMA).flatMap((daftar) => daftar.map((n) => ik(n, p)));

/** Ganti persentil beberapa indikator bernama. */
const dengan = (daftar, peta) =>
  daftar.map((x) => (peta[x.nama] === undefined ? x : { ...x, ...peta[x.nama] }));

const BOBOT_RATA = { connectivity: 25, affordability: 25, amenity: 25, walkability: 25 };
const kel = KELOMPOK_NAMA;
// Bobot antar-indikator, dipakai uji keunggulan terkonsentrasi.
const BOBOT_IK = {
  "Jarak ke halte terdekat": 0.3, "Jumlah rute unik terjangkau": 0.2,
  "Keterjangkauan kampus": 0.4, "Jarak ke stasiun KRL": 0.1,
  "Harga sewa kos": 0.6, "Harga makan": 0.4,
  "Kepadatan tempat makan": 0.35, "Keragaman kuliner": 0.2,
  "Keramaian kawasan": 0.2, "Ragam layanan harian": 0.25,
  "Kerapatan simpang jalan": 0.15, "Keteduhan jalur": 0.2,
  "Penerangan malam": 0.15, "Keamanan dari genangan": 0.15,
  "Ketenangan lalu lintas": 0.15, "Jalur pejalan kaki": 0.2,
};
// Pembungkus: uji lama memeriksa larik temuan; kini fungsinya mengembalikan
// { konteks, temuan }. Sebagian uji perlu SELURUH temuan tanpa seleksi.
const semuaKawasan = (arg) =>
  temuanKawasan({ ...arg, bobotIndikator: BOBOT_IK });

console.log("== prasyarat ==");
uji("persentilDimensi memetakan median ke sekitar 50", () => {
  const p = persentilDimensi("walkability", SEBARAN.walkability.median);
  assert.ok(Math.abs(p - 0.5) <= 0.02, `dapat ${p}`);
});
uji("persentilDimensi: p5 rendah, p95 tinggi", () => {
  assert.ok(persentilDimensi("amenity", SEBARAN.amenity.p5) <= 0.06);
  assert.ok(persentilDimensi("amenity", SEBARAN.amenity.p95) >= 0.94);
});
uji("prioritasPengguna null saat bobot rata", () => {
  assert.equal(prioritasPengguna(BOBOT_RATA), null);
});
uji("prioritasPengguna menemukan dimensi berpoin terbanyak", () => {
  assert.deepEqual(
    prioritasPengguna({ connectivity: 50, affordability: 17, amenity: 17, walkability: 16 }),
    ["connectivity"],
  );
});

console.log("\n== temuan kawasan ==");

uji("dimensi tinggi karena SATU indikator ekstrem -> TERKONSENTRASI", () => {
  // Keterjangkauan kampus (bobot 0,40) sangat tinggi, tiga indikator lain
  // biasa saja. Buang yang tertinggi -> subskor sisanya jatuh di bawah median
  // wilayah, jadi keunggulannya memang bertumpu pada satu hal.
  const indikator = dengan(indikatorSeragam(0.3), {
    "Keterjangkauan kampus": { persentil: 0.99 },
  });
  const t = semuaKawasan({
    subskor: { connectivity: SEBARAN.connectivity.p95, affordability: 52, amenity: 52, walkability: 50 },
    bobot: BOBOT_RATA,
    indikator,
    kelompok: kel,
  });
  const r = t.semuaTemuan.find((x) => x.jenis === JENIS.KEUNGGULAN_RAPUH && x.dimensi === "connectivity");
  assert.ok(r, "keunggulan terkonsentrasi tidak terdeteksi");
  assert.equal(r.penopang, "Keterjangkauan kampus");
  assert.ok(r.tanpaPenopang < r.medianWilayah,
    `tanpa penopang ${r.tanpaPenopang} seharusnya < median ${r.medianWilayah}`);
});

uji("dimensi kuat TANPA indikator lemah -> tidak rapuh", () => {
  const t = semuaKawasan({
    subskor: { connectivity: 41, affordability: 52, amenity: 52, walkability: SEBARAN.walkability.p95 },
    bobot: BOBOT_RATA,
    indikator: indikatorSeragam(0.85),
    kelompok: kel,
  });
  assert.equal(t.semuaTemuan.filter((x) => x.jenis === JENIS.KEUNGGULAN_RAPUH).length, 0);
});

uji("dimensi kuat mengandung indikator estimasi -> TERTANDAI", () => {
  const indikator = dengan(indikatorSeragam(0.8), {
    "Jalur pejalan kaki": { estimasi: true },
  });
  const t = semuaKawasan({
    subskor: { connectivity: 41, affordability: 52, amenity: 52, walkability: SEBARAN.walkability.p95 },
    bobot: BOBOT_RATA,
    indikator,
    kelompok: kel,
  });
  const r = t.semuaTemuan.find((x) => x.jenis === JENIS.BERGANTUNG_TAKSIRAN);
  assert.ok(r, "penanda taksiran tidak muncul");
  assert.deepEqual(r.indikator, ["Jalur pejalan kaki"]);
});

uji("dimensi LEMAH dengan indikator estimasi -> tidak ditandai", () => {
  const indikator = dengan(indikatorSeragam(0.2), {
    "Jalur pejalan kaki": { estimasi: true },
  });
  const t = semuaKawasan({
    subskor: { connectivity: 41, affordability: 52, amenity: 52, walkability: SEBARAN.walkability.p5 },
    bobot: BOBOT_RATA,
    indikator,
    kelompok: kel,
  });
  assert.equal(t.semuaTemuan.filter((x) => x.jenis === JENIS.BERGANTUNG_TAKSIRAN).length, 0);
});

uji("prioritas pengguna di dimensi lemah -> KONFLIK", () => {
  const t = semuaKawasan({
    subskor: { connectivity: SEBARAN.connectivity.p5, affordability: 52, amenity: 52, walkability: 50 },
    bobot: { connectivity: 50, affordability: 17, amenity: 17, walkability: 16 },
    indikator: indikatorSeragam(0.1),
    kelompok: kel,
  });
  const r = t.semuaTemuan.find((x) => x.jenis === JENIS.KONFLIK_PRIORITAS);
  assert.ok(r, "konflik tidak terdeteksi");
  assert.equal(r.dimensi, "connectivity");
  assert.equal(r.bobot, 50);
});

uji("BOBOT BERUBAH -> temuan konflik ikut berubah", () => {
  const subskor = {
    connectivity: SEBARAN.connectivity.p5, // lemah
    affordability: SEBARAN.affordability.p95, // kuat
    amenity: 52,
    walkability: 50,
  };
  const arg = { subskor, indikator: indikatorSeragam(0.5), kelompok: kel };
  // Prioritas pada dimensi lemah -> konflik muncul.
  const a = semuaKawasan({ ...arg, bobot: { connectivity: 50, affordability: 17, amenity: 17, walkability: 16 } });
  assert.ok(a.semuaTemuan.some((x) => x.jenis === JENIS.KONFLIK_PRIORITAS && x.dimensi === "connectivity"));
  // Prioritas dipindah ke dimensi kuat -> konflik hilang.
  const b = semuaKawasan({ ...arg, bobot: { connectivity: 16, affordability: 50, amenity: 17, walkability: 17 } });
  assert.equal(b.semuaTemuan.filter((x) => x.jenis === JENIS.KONFLIK_PRIORITAS).length, 0);
  // Bobot rata -> tidak ada prioritas, jadi tidak ada konflik.
  const c = semuaKawasan({ ...arg, bobot: BOBOT_RATA });
  assert.equal(c.semuaTemuan.filter((x) => x.jenis === JENIS.KONFLIK_PRIORITAS).length, 0);
});

uji("indikator sangat tinggi dan sangat rendah dalam satu dimensi -> TERBELAH", () => {
  const indikator = dengan(indikatorSeragam(0.5), {
    "Kepadatan tempat makan": { persentil: 0.95 },
    "Keramaian kawasan": { persentil: 0.05 },
  });
  const t = semuaKawasan({
    subskor: { connectivity: 41, affordability: 52, amenity: 52, walkability: 50 },
    bobot: BOBOT_RATA,
    indikator,
    kelompok: kel,
  });
  const r = t.semuaTemuan.find((x) => x.jenis === JENIS.SEBARAN_TERBELAH && x.dimensi === "amenity");
  assert.ok(r, "sebaran terbelah tidak terdeteksi");
  assert.equal(r.tertinggi, "Kepadatan tempat makan");
  assert.equal(r.terendah, "Keramaian kawasan");
});

uji("dimensi kosong dikeluarkan dari temuan", () => {
  const t = semuaKawasan({
    subskor: { connectivity: 41, affordability: 0, amenity: 52, walkability: 50 },
    dimensiKosong: ["affordability"],
    bobot: BOBOT_RATA,
    indikator: indikatorSeragam(0.5),
    kelompok: kel,
  });
  assert.equal(t.semuaTemuan.filter((x) => x.dimensi === "affordability").length, 0);
});

console.log("\n== temuan perbandingan ==");

const kawasan = (skor, subskor, indikator) => ({
  h3_index: "898d8c14083ffff",
  skor,
  subskor,
  dimensiKosong: [],
  indikator,
});

uji("dua kawasan hampir identik -> PRAKTIS SETARA", () => {
  const sub = { connectivity: 41, affordability: 52, amenity: 52, walkability: 50 };
  const t = temuanBanding({
    a: kawasan(45.0, sub, indikatorSeragam(0.5)),
    b: kawasan(45.2, { ...sub, connectivity: 41.4 }, indikatorSeragam(0.5)),
    bobot: BOBOT_RATA,
    kelompok: kel,
  });
  assert.ok(t.semuaTemuan.some((x) => x.jenis === JENIS.PRAKTIS_SETARA), "setara tidak terdeteksi");
  assert.ok(t.konteks.every((x) => x.tingkat === "dapat diabaikan"));
});

uji("selisih dinilai relatif terhadap simpangan baku dimensi", () => {
  // Selisih 7 poin sama besarnya di kedua dimensi, tapi artinya berbeda jauh:
  // di walkability (sd 7,6) itu hampir satu simpangan baku -> BESAR; di
  // affordability (sd 25,6) hanya 0,27 simpangan baku -> dapat diabaikan.
  const t = temuanBanding({
    a: kawasan(50, { connectivity: 41, affordability: 59, amenity: 52, walkability: 53.5 }, indikatorSeragam(0.5)),
    b: kawasan(48, { connectivity: 41, affordability: 52, amenity: 52, walkability: 46.5 }, indikatorSeragam(0.5)),
    bobot: BOBOT_RATA,
    kelompok: kel,
  });
  const w = t.konteks.find((x) => x.dimensi === "walkability");
  const a = t.konteks.find((x) => x.dimensi === "affordability");
  assert.equal(w.tingkat, "besar", `walkability dapat ${w.tingkat}`);
  assert.equal(a.tingkat, "dapat diabaikan", `affordability dapat ${a.tingkat}`);
});

uji("pemenang total kalah di dimensi prioritas -> KONFLIK", () => {
  const t = temuanBanding({
    // A menang total, tapi B jauh unggul di connectivity (prioritas pengguna).
    a: kawasan(50, { connectivity: 25, affordability: 90, amenity: 52, walkability: 50 }, indikatorSeragam(0.5)),
    b: kawasan(44, { connectivity: 85, affordability: 20, amenity: 52, walkability: 50 }, indikatorSeragam(0.5)),
    bobot: { connectivity: 50, affordability: 17, amenity: 17, walkability: 16 },
    kelompok: kel,
  });
  const r = t.semuaTemuan.find((x) => x.jenis === JENIS.PEMENANG_KALAH_PRIORITAS);
  assert.ok(r, "konflik pemenang tidak terdeteksi");
  assert.equal(r.pemenangTotal, "A");
  assert.equal(r.unggulDiPrioritas, "B");
  assert.equal(r.dimensi, "connectivity");
});

uji("pemenang total juga unggul di prioritas -> tidak ada konflik", () => {
  const t = temuanBanding({
    a: kawasan(50, { connectivity: 85, affordability: 52, amenity: 52, walkability: 50 }, indikatorSeragam(0.5)),
    b: kawasan(44, { connectivity: 25, affordability: 52, amenity: 52, walkability: 50 }, indikatorSeragam(0.5)),
    bobot: { connectivity: 50, affordability: 17, amenity: 17, walkability: 16 },
    kelompok: kel,
  });
  assert.equal(t.semuaTemuan.filter((x) => x.jenis === JENIS.PEMENANG_KALAH_PRIORITAS).length, 0);
});

uji("unggul di dimensi tapi kalah di mayoritas indikatornya -> RAPUH", () => {
  // A unggul subskor amenity, tapi kalah di 3 dari 4 indikator penyusunnya.
  const indA = dengan(indikatorSeragam(0.5), {
    "Kepadatan tempat makan": { persentil: 0.99 },
    "Keragaman kuliner": { persentil: 0.2 },
    "Keramaian kawasan": { persentil: 0.2 },
    "Ragam layanan harian": { persentil: 0.2 },
  });
  const indB = dengan(indikatorSeragam(0.5), {
    "Kepadatan tempat makan": { persentil: 0.1 },
    "Keragaman kuliner": { persentil: 0.6 },
    "Keramaian kawasan": { persentil: 0.6 },
    "Ragam layanan harian": { persentil: 0.6 },
  });
  const t = temuanBanding({
    a: kawasan(50, { connectivity: 41, affordability: 52, amenity: 80, walkability: 50 }, indA),
    b: kawasan(48, { connectivity: 41, affordability: 52, amenity: 45, walkability: 50 }, indB),
    bobot: BOBOT_RATA,
    kelompok: kel,
  });
  const r = t.semuaTemuan.find((x) => x.jenis === JENIS.UNGGUL_SATU_INDIKATOR && x.dimensi === "amenity");
  assert.ok(r, "keunggulan rapuh tidak terdeteksi");
  assert.equal(r.kawasan, "A");
  assert.equal(r.kalahDi, 3);
  assert.equal(r.dari, 4);
});

uji("keunggulan disumbang indikator estimasi -> TERTANDAI", () => {
  const indA = dengan(indikatorSeragam(0.8), { "Jalur pejalan kaki": { estimasi: true } });
  const indB = dengan(indikatorSeragam(0.3), { "Jalur pejalan kaki": { estimasi: true } });
  const t = temuanBanding({
    a: kawasan(52, { connectivity: 41, affordability: 52, amenity: 52, walkability: 62 }, indA),
    b: kawasan(46, { connectivity: 41, affordability: 52, amenity: 52, walkability: 40 }, indB),
    bobot: BOBOT_RATA,
    kelompok: kel,
  });
  const r = t.semuaTemuan.find((x) => x.jenis === JENIS.UNGGUL_DARI_TAKSIRAN && x.dimensi === "walkability");
  assert.ok(r, "penanda taksiran tidak muncul");
  assert.equal(r.kawasan, "A");
  assert.deepEqual(r.indikator, ["Jalur pejalan kaki"]);
});

uji("PENJAGAAN: rasio sd kecil tapi skor total berbeda -> BUKAN setara", () => {
  // Seluruh selisih dimensi di bawah ambang sd, tetapi skor akhirnya berbeda
  // 3 poin, cukup terlihat di panel, jadi tidak boleh disebut setara.
  const t = temuanBanding({
    a: kawasan(48.0, { connectivity: 47, affordability: 58, amenity: 57, walkability: 51 }, indikatorSeragam(0.5)),
    b: kawasan(45.0, { connectivity: 41, affordability: 52, amenity: 52, walkability: 50 }, indikatorSeragam(0.5)),
    bobot: BOBOT_RATA,
    kelompok: kel,
  });
  assert.ok(t.konteks.every((x) => x.tingkat === "dapat diabaikan"),
    "prasyarat: seluruh rasio sd harus kecil");
  assert.equal(t.semuaTemuan.filter((x) => x.jenis === JENIS.PRAKTIS_SETARA).length, 0,
    "selisih skor 3 poin tidak boleh disebut setara");
});

uji("SELEKSI: paling banyak 3 temuan, prioritas selalu lolos", () => {
  // Bikin banyak temuan sekaligus, lalu pastikan konflik prioritas tetap ada.
  const indikator = dengan(indikatorSeragam(0.5), {
    "Kepadatan tempat makan": { persentil: 0.97 },
    "Keramaian kawasan": { persentil: 0.03 },
    "Keteduhan jalur": { persentil: 0.95 },
    "Penerangan malam": { persentil: 0.04 },
    "Jalur pejalan kaki": { estimasi: true, persentil: 0.9 },
  });
  const t = semuaKawasan({
    subskor: {
      connectivity: SEBARAN.connectivity.p5, // lemah, sekaligus prioritas
      affordability: 52,
      amenity: SEBARAN.amenity.p95,
      walkability: SEBARAN.walkability.p95,
    },
    bobot: { connectivity: 50, affordability: 17, amenity: 17, walkability: 16 },
    indikator,
    kelompok: kel,
  });
  assert.ok(t.semuaTemuan.length > AMBANG.MAKS_TEMUAN,
    `prasyarat: butuh >3 temuan mentah, dapat ${t.semuaTemuan.length}`);
  assert.equal(t.temuan.length, AMBANG.MAKS_TEMUAN);
  assert.ok(t.temuan.some((x) => x.jenis === JENIS.KONFLIK_PRIORITAS),
    "konflik prioritas harus selalu lolos seleksi");
});

uji("KONTEKS terpisah dari temuan", () => {
  const t = semuaKawasan({
    subskor: { connectivity: 41, affordability: 52, amenity: 52, walkability: 50 },
    bobot: BOBOT_RATA,
    indikator: indikatorSeragam(0.5),
    kelompok: kel,
  });
  assert.equal(t.konteks.length, 4, "keempat dimensi selalu ada di konteks");
  assert.ok(t.konteks.every((x) => x.jenis === JENIS.POSISI_DIMENSI));
  assert.equal(t.temuan.filter((x) => x.jenis === JENIS.POSISI_DIMENSI).length, 0,
    "posisi_dimensi tidak boleh bocor ke array temuan");
});

uji("urutan temuan menimbang DAMPAK, bukan hanya kelangkaan", () => {
  // Dua temuan sejenis: satu di walkability (dampak 0,98), satu di
  // connectivity (dampak 7,57). Yang berdampak besar harus lebih dulu.
  const dipilih = pilihTemuan([
    { jenis: JENIS.SEBARAN_TERBELAH, dimensi: "walkability", nama: "W" },
    { jenis: JENIS.SEBARAN_TERBELAH, dimensi: "connectivity", nama: "C" },
  ]);
  assert.equal(dipilih[0].dimensi, "connectivity");
  assert.ok(DAMPAK_PER_SD.connectivity > DAMPAK_PER_SD.walkability);
});

uji("BUKTI LAPANGAN muncul untuk heksagon yang disurvei", () => {
  // h3 ini ada di aktivitas.json dengan 6 titik tempat dan 13 foto.
  const t = semuaKawasan({
    h3Index: "898d8c16137ffff",
    subskor: { connectivity: 41, affordability: 52, amenity: 52, walkability: 50 },
    bobot: BOBOT_RATA,
    indikator: indikatorSeragam(0.5),
    kelompok: kel,
  });
  const r = t.semuaTemuan.find((x) => x.jenis === JENIS.BUKTI_LAPANGAN);
  assert.ok(r, "temuan bukti lapangan tidak muncul");
  assert.ok(r.total > 0 && r.foto > 0, `dapat ${JSON.stringify(r)}`);
});

uji("heksagon tanpa survei TIDAK memunculkan bukti lapangan", () => {
  const t = semuaKawasan({
    h3Index: "890000000000000",
    subskor: { connectivity: 41, affordability: 52, amenity: 52, walkability: 50 },
    bobot: BOBOT_RATA,
    indikator: indikatorSeragam(0.5),
    kelompok: kel,
  });
  assert.equal(
    t.semuaTemuan.filter((x) => x.jenis === JENIS.BUKTI_LAPANGAN).length, 0,
    "98,4% kawasan tidak disurvei; ketiadaannya harus diam, bukan jadi temuan",
  );
});

uji("bukti lapangan berprioritas paling rendah", () => {
  // Temuan yang menggerakkan peringkat harus menang atas bukti lapangan.
  const dipilih = pilihTemuan([
    { jenis: JENIS.BUKTI_LAPANGAN, total: 9, tempat: 9, ruasJalan: 0, foto: 20 },
    { jenis: JENIS.KONFLIK_PRIORITAS, dimensi: "connectivity", nama: "C", persentil: 10, bobot: 50 },
  ], 1);
  assert.equal(dipilih[0].jenis, JENIS.KONFLIK_PRIORITAS);
});

uji("ambang tersedia sebagai konstanta bernama", () => {
  for (const k of [
    "DIMENSI_TINGGI", "DIMENSI_RENDAH", "INDIKATOR_TINGGI", "INDIKATOR_RENDAH",
    "MAYORITAS", "SELISIH_BESAR", "SELISIH_SEDANG", "RENTANG_TERBELAH",
    "SETARA_SELISIH_SKOR", "MAKS_TEMUAN",
  ]) {
    assert.equal(typeof AMBANG[k], "number", `AMBANG.${k} hilang`);
  }
});

console.log(`\n${lulus} uji lulus${process.exitCode ? " (ADA YANG GAGAL)" : ""}`);
