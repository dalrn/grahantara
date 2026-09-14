/**
 * Uji mesin petunjuk (src/lib/petunjuk.js).
 *
 *     node tests/test-petunjuk.mjs
 *
 * Deterministik, tanpa browser. localStorage dipalsukan seadanya.
 */
import assert from "node:assert/strict";

// Palsukan localStorage SEBELUM modul diimpor.
const simpanan = new Map();
globalThis.localStorage = {
  getItem: (k) => (simpanan.has(k) ? simpanan.get(k) : null),
  setItem: (k, v) => simpanan.set(k, String(v)),
  removeItem: (k) => simpanan.delete(k),
  key: (i) => [...simpanan.keys()][i] ?? null,
  get length() {
    return simpanan.size;
  },
};

const {
  PETUNJUK, ANGGARAN_TOTAL, MAKS_TAMPIL, AWALAN,
  petunjukBerikut, catatTampil, tandaiSelesai, lewatiSemua, resetPetunjuk,
  bacaStatus,
} = await import("../src/lib/petunjuk.js");

let lulus = 0;
const uji = (nama, fn) => {
  simpanan.clear();
  try {
    fn();
    console.log(`  PASS  ${nama}`);
    lulus += 1;
  } catch (e) {
    console.log(`  FAIL  ${nama}\n        ${e.message}`);
    process.exitCode = 1;
  }
};

/** Keadaan halaman: pengguna baru masuk peta, belum melakukan apa pun. */
const awal = () => ({
  petaSiap: true,
  adaDisarankan: true,
  jumlahKawasanDibuka: 0,
  pernahBanding: false,
  bobotBawaan: true,
  pernahUbahBobot: false,
  kosDibuka: false,
  pernahRute: false,
  tabRinciDibuka: false,
  pernahMetodologi: false,
});

console.log("== pemicu ==");

uji("P1 muncul saat peta siap dan ada kawasan disarankan", () => {
  assert.equal(petunjukBerikut(awal())?.id, "p1_disarankan");
});

uji("P1 TIDAK muncul bila tidak ada kawasan berbingkai kuning", () => {
  const k = { ...awal(), adaDisarankan: false };
  assert.notEqual(petunjukBerikut(k)?.id, "p1_disarankan");
});

uji("P1 tidak muncul lagi setelah satu kawasan dibuka", () => {
  const k = { ...awal(), jumlahKawasanDibuka: 1 };
  assert.notEqual(petunjukBerikut(k)?.id, "p1_disarankan");
});

uji("P2 muncul setelah DUA kawasan berbeda dibuka", () => {
  const k = { ...awal(), jumlahKawasanDibuka: 2, bobotBawaan: false };
  assert.equal(petunjukBerikut(k)?.id, "p2_banding");
});

uji("P2 tidak muncul kalau baru satu kawasan dibuka", () => {
  const k = { ...awal(), jumlahKawasanDibuka: 1, bobotBawaan: false };
  assert.notEqual(petunjukBerikut(k)?.id, "p2_banding");
});

uji("P3 muncul bila bobot masih bawaan", () => {
  const k = { ...awal(), jumlahKawasanDibuka: 1 };
  assert.equal(petunjukBerikut(k)?.id, "p3_prioritas");
});

uji("P3 TIDAK muncul bila pengguna datang dengan alokasi sendiri", () => {
  const k = { ...awal(), jumlahKawasanDibuka: 1, bobotBawaan: false };
  assert.equal(petunjukBerikut(k), null);
});

uji("P4 muncul saat pin kos dibuka", () => {
  const k = { ...awal(), jumlahKawasanDibuka: 1, bobotBawaan: false, kosDibuka: true };
  assert.equal(petunjukBerikut(k)?.id, "p4_rute");
});

uji("P5 muncul saat tab Subskor / 16 Indikator dibuka", () => {
  const k = { ...awal(), jumlahKawasanDibuka: 1, bobotBawaan: false, tabRinciDibuka: true };
  assert.equal(petunjukBerikut(k)?.id, "p5_metodologi");
});

console.log("\n== aturan dasar ==");

uji("hanya SATU petunjuk walau beberapa syarat terpenuhi", () => {
  // P2, P3, P4, P5 syaratnya terpenuhi semua sekaligus.
  const k = {
    ...awal(), jumlahKawasanDibuka: 2, kosDibuka: true, tabRinciDibuka: true,
  };
  const p = petunjukBerikut(k);
  assert.ok(p, "harus ada satu");
  // Yang menang adalah yang paling awal di urutan PETUNJUK.
  assert.equal(p.id, "p2_banding");
});

uji("petunjuk selesai tidak muncul lagi, yang lain tetap jalan", () => {
  const k = { ...awal(), jumlahKawasanDibuka: 2 };
  tandaiSelesai("p2_banding");
  const p = petunjukBerikut(k);
  assert.notEqual(p?.id, "p2_banding");
  assert.equal(p?.id, "p3_prioritas", "menutup satu tidak mematikan yang lain");
});

uji(`petunjuk sama berhenti setelah ${MAKS_TAMPIL} kali tampil`, () => {
  for (let i = 0; i < MAKS_TAMPIL; i++) {
    assert.equal(petunjukBerikut(awal())?.id, "p1_disarankan", `tampilan ke-${i + 1}`);
    catatTampil("p1_disarankan");
  }
  assert.notEqual(petunjukBerikut(awal())?.id, "p1_disarankan");
});

uji(`anggaran total ${ANGGARAN_TOTAL} petunjuk, lalu berhenti selamanya`, () => {
  for (let i = 0; i < ANGGARAN_TOTAL; i++) catatTampil(`palsu_${i}`);
  const k = { ...awal(), jumlahKawasanDibuka: 2, kosDibuka: true, tabRinciDibuka: true };
  assert.equal(petunjukBerikut(k), null, "anggaran habis harus menghentikan semua");
});

uji("lewati semua mematikan seluruh rangkaian", () => {
  lewatiSemua();
  for (const k of [
    awal(),
    { ...awal(), jumlahKawasanDibuka: 2 },
    { ...awal(), kosDibuka: true },
    { ...awal(), tabRinciDibuka: true },
  ]) {
    assert.equal(petunjukBerikut(k), null);
  }
});

console.log("\n== penyimpanan ==");

uji("kunci localStorage memakai awalan berversi", () => {
  catatTampil("p1_disarankan");
  const kunci = [...simpanan.keys()];
  assert.ok(kunci.length > 0, "harus menulis sesuatu");
  assert.ok(kunci.every((k) => k.startsWith(AWALAN)), `dapat ${kunci}`);
});

uji("reset menghapus seluruh status, petunjuk bisa diulang", () => {
  lewatiSemua();
  catatTampil("p1_disarankan");
  tandaiSelesai("p2_banding");
  assert.equal(petunjukBerikut(awal()), null, "prasyarat: sedang dimatikan");
  resetPetunjuk();
  assert.equal(simpanan.size, 0, "localStorage harus bersih");
  assert.equal(petunjukBerikut(awal())?.id, "p1_disarankan", "harus tampil lagi");
});

uji("status rusak di localStorage tidak merusak halaman", () => {
  simpanan.set(`${AWALAN}status`, "{bukan json");
  const s = bacaStatus();
  assert.equal(s.total, 0);
  assert.equal(petunjukBerikut(awal())?.id, "p1_disarankan");
});

uji("petunjuk yang sudah tampil tidak muncul lagi, ditutup atau tidak", () => {
  const p = petunjukBerikut(awal());
  catatTampil(p.id);
  assert.equal(
    petunjukBerikut(awal())?.id ?? null,
    null,
    "sekali tampil cukup untuk satu lokasi",
  );
});

uji("MAKS_TAMPIL satu: tampil sekali per lokasi", () => {
  assert.equal(MAKS_TAMPIL, 1);
});

uji("setelah reset, keadaan awal memunculkan petunjuk pertama lagi", () => {
  catatTampil("p1_disarankan");
  tandaiSelesai("p1_disarankan");
  resetPetunjuk();
  assert.equal(petunjukBerikut(awal())?.id, "p1_disarankan");
});

uji("status versi lama diabaikan, dan ikut tersapu saat reset", () => {
  const lama = "grahantara.petunjuk.v1.status";
  simpanan.set(lama, JSON.stringify({ tampil: {}, selesai: {}, total: 5, lewati: true }));
  assert.equal(
    petunjukBerikut(awal())?.id,
    "p1_disarankan",
    "status v1 yang mentok tidak boleh memblokir v2",
  );
  resetPetunjuk();
  assert.equal(simpanan.has(lama), false, "sisa v1 harus ikut dihapus");
});

uji("tiap petunjuk punya id dan jangkar unik", () => {
  const id = PETUNJUK.map((p) => p.id);
  assert.equal(new Set(id).size, id.length, "id harus unik");
  assert.equal(PETUNJUK.length, ANGGARAN_TOTAL, "lima petunjuk, sesuai anggaran");
  assert.ok(PETUNJUK.every((p) => typeof p.jangkar === "string" && p.jangkar));
});

console.log(`\n${lulus} uji lulus${process.exitCode ? " (ADA YANG GAGAL)" : ""}`);
