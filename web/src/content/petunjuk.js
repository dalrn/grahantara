/**
 * Teks tiap petunjuk. Terpisah dari mesinnya (lib/petunjuk.js) supaya kalimat
 * bisa disunting tanpa menyentuh logika pemicu.
 *
 * Fungsi, bukan string, karena hampir semuanya menyesuaikan keadaan: dasar
 * rekomendasi berbeda antara pengguna yang memilih kampus dan yang melewati
 * beranda, dan kata jalan pintas berbeda antara tetikus dan sentuh.
 */
import { pintasBandingKos } from "../lib/perangkat";

export const TEKS_PETUNJUK = {
  p1_disarankan: ({ kampus, bobotBawaan }) => ({
    judul: "Kawasan berbingkai kuning",
    // Dasar rekomendasinya disebut EKSPLISIT. Tanpa itu bingkai kuning cuma
    // simbol tanpa kunci. Kalimatnya menyesuaikan: pengguna yang memilih
    // kampus dapat penjelasan berbeda dari yang melewati beranda.
    isi: kampus
      ? `Bingkai kuning menandai kawasan berskor tertinggi dalam radius sekitar 1,5 km dari ${kampus}, dihitung dengan bobot yang sedang berlaku${
          bobotBawaan ? " (bobot bawaan)" : " (prioritas pilihanmu)"
        }. Klik salah satunya untuk melihat rinciannya.`
      : "Bingkai kuning menandai kawasan berskor tertinggi di sekitar kampus tujuan, dihitung dengan bobot bawaan. Klik salah satunya untuk melihat rinciannya.",
    posisi: "tengah-atas",
  }),

  p2_banding: () => ({
    judul: "Bandingkan dua kawasan",
    isi: "Kamu sudah melihat dua kawasan. Tombol Bandingkan menaruh keduanya berdampingan, lengkap dengan selisih tiap dimensinya.",
    posisi: "nav",
  }),

  p3_prioritas: () => ({
    judul: "Sesuaikan dengan prioritasmu",
    isi: "Peta ini memakai bobot bawaan. Di tab Prioritas kamu bisa membagi ulang poin sesuai yang paling kamu pedulikan, dan warna peta ikut berubah.",
    posisi: "kiri-atas",
  }),

  p4_rute: ({ sentuh }) => ({
    judul: "Lihat rute ke kampus",
    isi: `Tombol "Rute ke kampus" di panel kos menghitung perjalanan dari kos itu ke kampus pilihanmu, termasuk ruas jalan kaki dan ruas busnya. Kos lain bisa dibandingkan lewat ${pintasBandingKos(
      sentuh,
    )}.`,
    posisi: "kanan-bawah",
  }),

  p5_metodologi: () => ({
    judul: "Dari mana angkanya?",
    isi: "Halaman Metodologi menjelaskan cara tiap indikator dihitung, sumber datanya, dan batasannya.",
    posisi: "nav",
  }),
};
