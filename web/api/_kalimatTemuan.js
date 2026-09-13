/**
 * Mengubah objek temuan jadi satu baris teks untuk prompt.
 *
 * Bentuknya sengaja dibuat terbaca sebagai HASIL PERHITUNGAN, bukan sebagai
 * data mentah: tiap baris diawali penanda jenis dalam huruf kapital, supaya
 * model bisa dirujuk ke jenis tertentu di aturan prompt ("bila ada temuan
 * bertanda KONFLIK PRIORITAS, ...") tanpa perlu menebak.
 *
 * Tidak ada angka berdesimal yang bocor ke sini: semua sudah dibulatkan di
 * lapisan temuan.
 */
import { JENIS } from "./_temuan.js";

/** Satu baris konteks posisi dimensi. */
export function kalimatKonteks(k) {
  if (k.jenis === JENIS.POSISI_DIMENSI) {
    return `- ${k.nama}: ${k.subskor} dari 100, tergolong ${k.tingkat} (lebih baik daripada ${k.persentil}% kawasan lain; median wilayah ${Math.round(k.medianWilayah)})`;
  }
  if (k.jenis === JENIS.SELISIH_DIMENSI) {
    const arah =
      k.unggul === "setara" ? "praktis setara" : `unggul: ${k.unggul}`;
    return `- ${k.nama}: A ${k.subskorA}, B ${k.subskorB} -> selisih ${k.selisih} poin, tergolong ${k.tingkat}, ${arah}`;
  }
  return `- ${JSON.stringify(k)}`;
}

/** Satu baris temuan. */
export function kalimatTemuan(t) {
  switch (t.jenis) {
    case JENIS.KONFLIK_PRIORITAS:
      return `- KONFLIK PRIORITAS: pengguna paling mementingkan ${t.nama} (${t.bobot} dari 100 poin), tetapi kawasan ini justru lemah di sana — lebih baik daripada hanya ${t.persentil}% kawasan lain.`;

    case JENIS.KEUNGGULAN_RAPUH:
      return `- KEUNGGULAN BERTUMPU SATU HAL: ${t.nama} tergolong kuat (${t.subskor}), tetapi hampir seluruhnya ditopang "${t.penopang}". Tanpa indikator itu nilainya ${t.tanpaPenopang}, di bawah median wilayah ${Math.round(t.medianWilayah)}.`;

    case JENIS.BERGANTUNG_TAKSIRAN:
      return `- BERGANTUNG ANGKA TAKSIRAN: kekuatan ${t.nama} sebagian bersandar pada ${t.indikator.join(", ")}, yang nilainya ditaksir model, bukan diukur langsung.`;

    case JENIS.SEBARAN_TERBELAH:
      return `- SEBARAN TERBELAH: di dalam ${t.nama}, "${t.tertinggi}" jauh lebih baik daripada "${t.terendah}". Nilai rata-ratanya menyembunyikan perbedaan setajam itu.`;

    case JENIS.PRAKTIS_SETARA:
      return `- KEDUA KAWASAN PRAKTIS SETARA: seluruh selisih dimensi tergolong dapat diabaikan, dan skor akhirnya hanya berbeda ${t.selisihSkor} poin.`;

    case JENIS.PEMENANG_KALAH_PRIORITAS:
      return `- PEMENANG KALAH DI PRIORITAS: Kawasan ${t.pemenangTotal} unggul pada skor akhir, TETAPI Kawasan ${t.unggulDiPrioritas} yang lebih baik pada ${t.nama} — dimensi yang paling dipentingkan pengguna (${t.bobot} dari 100 poin). Selisihnya tergolong ${t.tingkat}.`;

    case JENIS.UNGGUL_SATU_INDIKATOR:
      return `- KEUNGGULAN TIPIS: Kawasan ${t.kawasan} unggul pada ${t.nama}, tetapi justru kalah pada ${t.kalahDi} dari ${t.dari} indikator penyusunnya.`;

    case JENIS.UNGGUL_DARI_TAKSIRAN:
      return `- KEUNGGULAN DARI TAKSIRAN: keunggulan Kawasan ${t.kawasan} pada ${t.nama} disumbang ${t.indikator.join(", ")}, yang nilainya ditaksir model, bukan diukur langsung.`;

    default:
      return `- ${JSON.stringify(t)}`;
  }
}
