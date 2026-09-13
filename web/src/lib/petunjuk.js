/**
 * Mesin pengenalan progresif: petunjuk satu per satu, dipicu oleh KEADAAN,
 * bukan timer, dan tidak pernah lebih dari satu sekaligus.
 */

// Kunci BERVERSI. Kalau urutan atau makna petunjuk berubah, naikkan v1 -> v2
// supaya pengguna lama tidak terjebak status yang artinya sudah bergeser.
export const AWALAN = "grahantara.petunjuk.v1.";
const KUNCI_STATUS = `${AWALAN}status`;

/** Anggaran total seumur hidup pengguna. Setelah ini, tidak ada lagi. */
export const ANGGARAN_TOTAL = 5;
/** Sekali diabaikan, satu petunjuk boleh muncul lagi sebanyak ini. */
export const MAKS_TAMPIL = 3;

/**
 * Urutan petunjuk. `id` dipakai sebagai kunci penyimpanan, jadi jangan diubah
 * tanpa menaikkan versi awalan.
 *
 * `syarat(k)` menerima keadaan halaman dan mengembalikan true bila petunjuk
 * itu layak tampil SEKARANG. Urutan array menentukan prioritas bila dua
 * syarat terpenuhi bersamaan, hanya satu yang ditampilkan.
 */
export const PETUNJUK = [
  {
    id: "p1_disarankan",
    jangkar: "peta",
    // Hanya masuk akal kalau bingkai kuningnya memang ada di layar. Tanpa
    // kampus tujuan, lapisan "disarankan" kosong dan kalimatnya akan menunjuk
    // sesuatu yang tidak terlihat.
    syarat: (k) => k.petaSiap && k.adaDisarankan && k.jumlahKawasanDibuka === 0,
  },
  {
    id: "p2_banding",
    jangkar: "nav-banding",
    // Dua kawasan berbeda sudah dibuka satu per satu: saat itu pengguna
    // sedang membandingkan di kepalanya.
    syarat: (k) => k.jumlahKawasanDibuka >= 2 && !k.pernahBanding,
  },
  {
    id: "p3_prioritas",
    jangkar: "tab-prioritas",
    // Sudah melihat satu kawasan, tapi bobotnya masih bawaan -- artinya ia
    // melewati alokasi di beranda. Yang sudah mengalokasikan tidak diganggu.
    syarat: (k) =>
      k.jumlahKawasanDibuka >= 1 && k.bobotBawaan && !k.pernahUbahBobot,
  },
  {
    id: "p4_rute",
    jangkar: "panel-kos",
    syarat: (k) => k.kosDibuka && !k.pernahRute,
  },
  {
    id: "p5_metodologi",
    jangkar: "nav-metodologi",
    syarat: (k) => k.tabRinciDibuka && !k.pernahMetodologi,
  },
];

const kosong = () => ({ tampil: {}, selesai: {}, total: 0, lewati: false });

export function bacaStatus() {
  if (typeof localStorage === "undefined") return kosong();
  try {
    const mentah = localStorage.getItem(KUNCI_STATUS);
    if (!mentah) return kosong();
    const j = JSON.parse(mentah);
    return {
      tampil: j.tampil ?? {},
      selesai: j.selesai ?? {},
      total: j.total ?? 0,
      lewati: Boolean(j.lewati),
    };
  } catch {
    // localStorage bisa melempar di mode privat atau saat data situs
    // diblokir. Petunjuk adalah kenyamanan, bukan fitur inti: kalau gagal,
    // perlakukan seolah pengguna baru dan jangan merusak halaman.
    return kosong();
  }
}

function tulisStatus(s) {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(KUNCI_STATUS, JSON.stringify(s));
  } catch {
    /* abaikan: lihat alasan di bacaStatus */
  }
}

/** Petunjuk mana yang layak tampil sekarang, atau null. */
export function petunjukBerikut(keadaan, status = bacaStatus()) {
  if (status.lewati) return null;
  if (status.total >= ANGGARAN_TOTAL) return null;
  for (const p of PETUNJUK) {
    if (status.selesai[p.id]) continue;
    if ((status.tampil[p.id] ?? 0) >= MAKS_TAMPIL) continue;
    if (p.syarat(keadaan)) return p;
  }
  return null;
}

/** Catat bahwa sebuah petunjuk BARU SAJA ditampilkan. */
export function catatTampil(id) {
  const s = bacaStatus();
  s.tampil[id] = (s.tampil[id] ?? 0) + 1;
  s.total += 1;
  tulisStatus(s);
  return s;
}

/**
 * Tandai selesai permanen: pengguna melakukan aksi yang dimaksud, atau
 * menutup petunjuknya. Menutup satu petunjuk TIDAK mematikan yang lain.
 */
export function tandaiSelesai(id) {
  const s = bacaStatus();
  s.selesai[id] = true;
  tulisStatus(s);
  return s;
}

/** Matikan seluruh rangkaian sekaligus. Hanya ditawarkan di petunjuk pertama. */
export function lewatiSemua() {
  const s = bacaStatus();
  s.lewati = true;
  tulisStatus(s);
  return s;
}

/**
 * Hapus seluruh status. Dipakai tombol "Ulangi petunjuk" di navigasi peta.
 * Wajib ada: tanpa ini fiturnya tidak bisa didemokan saat presentasi dan
 * tidak bisa diuji ulang setelah sekali dilihat.
 */
export function resetPetunjuk() {
  if (typeof localStorage === "undefined") return kosong();
  try {
    localStorage.removeItem(KUNCI_STATUS);
    // Sapu juga kunci lain berawalan sama, kalau versi sebelumnya
    // meninggalkan sisa.
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const k = localStorage.key(i);
      if (k && k.startsWith(AWALAN)) localStorage.removeItem(k);
    }
  } catch {
    /* abaikan */
  }
  return kosong();
}
