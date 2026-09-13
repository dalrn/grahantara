/**
 * SUMBER TUNGGAL seluruh teks yang tampil di halaman beranda.
 *
 * Strukturnya mengikuti struktur halaman dari atas ke bawah — nav, hero,
 * kartu form (tahap 1 lalu tahap 2), bagian dimensi, bagian data, footer —
 * supaya bisa ditelusuri dari apa yang terlihat di layar ke tempatnya di kode.
 *
 * Yang TIDAK ada di sini, dan memang tidak boleh dipindahkan ke sini:
 *   - Angka yang berasal dari data: jumlah kawasan, versi, dan tanggal
 *     dihitung dibaca dari `public/data/metadata.json` saat runtime.
 *   - Persentase bobot: dihitung dari pilihan pengguna di `Beranda.jsx`.
 *   - Nama dan urutan dimensi: `src/lib/kamus.js` (DIMENSI_UI), dipakai
 *     bersama oleh beranda dan slider di halaman peta.
 *   - Daftar kampus: `src/kampus.js`.
 *
 * Fungsi (bukan string) dipakai bila kalimatnya menyisipkan angka dari data.
 */
export const TEKS = {
  nav: {
    labelBeranda: "Grahantara beranda",
    beranda: "Beranda",
    peta: "Peta",
    metodologi: "Metodologi",
  },

  hero: {
    judul: "Peta kawasan untuk memilih tempat tinggal di Sleman.",
    // jumlah datang dari metadata.json, bukan ditulis tangan.
    pembuka: (jumlah) =>
      `Grahantara menilai ${jumlah} kawasan di sabuk kampus Sleman. Tentukan yang paling penting bagimu dan bandingkan langsung kawasannya di peta.`,
    keteranganPeta:
      "Tiap heksagon adalah satu kawasan seluas sekitar 0,1 km², diwarnai menurut skor default.",
  },

  // Overlay di dalam peta hero (PetaHero.jsx).
  peta: {
    buka: "Buka peta lengkap",
    legendaRendah: "Kurang sesuai",
    legendaTinggi: "Lebih sesuai",
    // skor dibulatkan dari data heksagon yang sedang disorot.
    artiSkor: (persen) => `lebih baik daripada ${persen}% kawasan lain`,
    gagal:
      "Peta tidak dapat dimuat. Data kawasan tetap bisa dibuka di halaman peta.",
  },

  form: {
    // Tahap 1 — menulis.
    tulis: {
      judul: "Kawasan bagaimana yang kamu cari?",
      labelTextarea: "Ceritakan kebutuhanmu",
      placeholder:
        "maba UGM, budget sekitar 800 ribu, pengennya deket halte soalnya belum bawa motor",
      contoh: [
        "maba UGM, budget 800 ribuan, pengennya deket halte",
        "kos dekat UPN, jalan kaki, jalanan jangan gelap",
        "anggaran 1,5 juta, yang penting banyak warung murah",
      ],
      lanjut: "Lanjut",
      sedangMembaca: "Membaca catatanmu…",
      lewatiKePeta: "Jelajahi peta tanpa mengisi",
      lewatiKePilihan: "Lebih suka memilih daripada menulis",
    },

    // Tahap 2 — konfirmasi hasil pembacaan.
    konfirmasi: {
      judul: "Periksa dulu",
      dariCatatan: "Ini hasil pembacaan catatanmu. Ubah yang belum tepat.",
      tanpaCatatan:
        "Isi yang kamu tahu. Yang dibiarkan kosong memakai nilai bawaan.",
      tanpaAI:
        "Catatanmu dibaca tanpa AI karena layanan bahasa sedang tidak merespons. Periksa isian di bawah.",
      gagalBaca:
        "Catatanmu belum bisa dibaca otomatis. Isi sendiri di bawah; teks yang kamu tulis tetap tersimpan.",
      tandaBelum: "belum terbaca",

      kampus: "Kampus tujuan",
      kampusKosong: "Belum ditentukan",

      anggaran: "Anggaran per bulan",
      anggaranTidakTahu: "Belum tahu",
      anggaranCentang: "Belum tahu anggaran",

      prioritas: "Mana dua hal yang paling penting?",
      prioritasSetara: "Semuanya sama penting bagiku",

      catatanmu: "Catatanmu",
      lihatPeta: "Lihat peta",
      kembali: "Kembali ubah catatan",
    },

    // Peringatan data palsu; hanya muncul bila metadata.versi diawali "stub".
    stub: (versi) =>
      `DATA PALSU (${versi}) - angka pada peta ini acak, bukan hasil analisis`,
  },

  dimensi: {
    judul: "Empat hal yang dinilai di tiap kawasan",
    // Kunci mengikuti DIMENSI_UI di src/lib/kamus.js.
    penjelasan: {
      connectivity:
        "Jarak ke halte, jumlah rute, dan apakah ada koridor yang benar-benar sampai ke kampusmu.",
      affordability:
        "Harga kos di sekitar kawasan, bersumber dari survei harga tim di lapangan.",
      amenity:
        "Kepadatan dan keragaman tempat makan, serta layanan harian seperti minimarket dan laundry.",
      walkability:
        "Keteduhan, penerangan malam, kerapatan simpang, ketenangan lalu lintas, dan ketersediaan jalur pejalan kaki.",
    },
    // Kalimat cakupan DIHASILKAN dari data, bukan ditulis manual: menyebut
    // dimensi tertentu "hanya terisi sebagian" akan basi begitu datanya
    // berubah. `kurang` berisi nama dimensi yang cakupannya belum penuh,
    // dihitung SebaranDimensi dari hexagons.geojson.
    catatan: (jumlah, kurang = []) =>
      kurang.length === 0
        ? `Tiap grafik adalah sebaran skor dimensi itu, dihitung untuk seluruh ${jumlah} kawasan.`
        : `Tiap grafik adalah sebaran skor dimensi itu. Semuanya dihitung untuk seluruh ${jumlah} kawasan, kecuali ${kurang.join(" dan ")} yang baru terisi di sebagian kawasan.`,
  },

  data: {
    judul: "Dasar penilaiannya",
    catatan: [
      "Skor adalah peringkat terhadap seluruh wilayah studi. Skor 70 berarti kawasan itu lebih baik daripada 70% kawasan lain di Sleman.",
      "Indikator yang datanya belum ada ditandai “tidak tersedia” dan dikeluarkan dari perhitungan, tidak dihitung sebagai nol. Kawasan tanpa data tidak dianggap buruk.",
    ],
    // `angka` diisi dari data saat render; hanya keterangannya yang statis.
    angka: {
      kawasan:
        "kawasan dinilai, masing-masing heksagon seluas ~0,1 km² atau selebar ~380 m",
      kampus:
        "kampus dalam cakupan, dari UGM dan UNY sampai Instiper dan STIE YKPN",
      indikator:
        "indikator dari OpenStreetMap, MAPID, citra Sentinel-2, dan survei lapangan",
    },
    versi: (versi, tanggal) =>
      `Data versi ${versi}${tanggal ? `, dihitung ${tanggal}` : ""}.`,
    tautanMetodologi: "Pelajari metodologi dan sumber data",
  },

  footer: {
    nama: "Grahantara",
    deskripsi: "Peta kawasan untuk memilih kos mahasiswa di Sleman, DIY.",
    peta: "Peta",
    metodologi: "Metodologi",
    diperbarui: (tanggal) => `Data diperbarui ${tanggal}`,
    versiCadangan: (versi) => `Data versi ${versi}`,
    tim: "cinajawabatak",
  },
};

// Jumlah kampus yang datanya tercakup. Bukan teks: dihitung dari daftar
// kampus supaya angka di halaman tidak pernah berbeda dari isi peta.
export { DAFTAR_KAMPUS } from "../kampus.js";
