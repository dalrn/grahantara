// Seluruh teks halaman beranda, disusun mengikuti urutan tampilannya.
export const TEKS = {
  nav: {
    labelBeranda: "Grahantara beranda",
    beranda: "Beranda",
    peta: "Peta",
    metodologi: "Metodologi",
  },

  hero: {
    judul: "Peta kawasan untuk memilih tempat tinggal di Sleman.",
    pembuka: (jumlah) =>
      `Grahantara menilai ${jumlah} kawasan di sabuk kampus Sleman. Tentukan yang paling penting bagimu dan bandingkan langsung kawasannya di peta.`,
    keteranganPeta:
      "Tiap heksagon adalah satu kawasan seluas sekitar 0,1 km², diwarnai menurut skor default.",
  },

  peta: {
    buka: "Buka peta lengkap",
    legendaRendah: "Kurang sesuai",
    legendaTinggi: "Lebih sesuai",
    artiSkor: (persen) => `lebih baik daripada ${persen}% kawasan lain`,
    gagal:
      "Peta tidak dapat dimuat. Data kawasan tetap bisa dibuka di halaman peta.",
  },

  form: {
    tulis: {
      judul: "Kawasan seperti apa yang kamu cari?",
      labelTextarea: "Ceritakan kebutuhanmu",
      placeholder:
        "maba UGM, budget sekitar 800 ribu, pengennya deket halte soalnya belum bawa motor",
      contoh: [
        "maba UGM, budget 800 ribuan, pengennya deket halte",
        "kos dekat UPN, jalan kaki, jalanan jangan gelap",
        "anggaran 1,5 juta, yang penting banyak warung murah",
      ],
      lanjut: "Lanjut",
      sedangMembaca: "Membaca catatanmu...",
      lewatiKePeta: "Jelajahi peta tanpa mengisi",
      lewatiKePilihan: "Lebih suka memilih daripada menulis",
    },

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

    // Hanya muncul bila metadata.versi diawali "stub".
    stub: (versi) =>
      `DATA PALSU (${versi}) - angka pada peta ini acak, bukan hasil analisis`,
  },

  dimensi: {
    judul: "Empat hal yang dinilai di tiap kawasan",
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
    // `kurang` berisi dimensi yang cakupannya belum penuh, dari SebaranDimensi.
    catatan: (jumlah, kurang = []) =>
      kurang.length === 0
        ? `Tiap grafik adalah sebaran skor dimensi itu, dihitung untuk seluruh ${jumlah} kawasan.`
        : `Tiap grafik adalah sebaran skor dimensi itu. Semuanya dihitung untuk seluruh ${jumlah} kawasan, kecuali ${kurang.join(" dan ")} yang baru terisi di sebagian kawasan.`,
  },

  data: {
    judul: "Dasar penilaiannya",
    catatan: [
      "Skor adalah peringkat terhadap seluruh wilayah studi. Skor 70 berarti kawasan itu lebih baik daripada 70% kawasan lain di Sleman.",
      "Indikator yang datanya belum ada ditandai 'tidak tersedia' dan dikeluarkan dari perhitungan, tidak dihitung sebagai nol. Kawasan tanpa data tidak dianggap buruk.",
    ],
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
    deskripsi: "Peta kawasan? untuk memilih kos mahasiswa di Sleman, DIY.",
    peta: "Peta",
    metodologi: "Metodologi",
    diperbarui: (tanggal) => `Data diperbarui ${tanggal}`,
    versiCadangan: (versi) => `Data versi ${versi}`,
    tim: "cinajawabatak",
  },
};

export { DAFTAR_KAMPUS } from "../kampus.js";
