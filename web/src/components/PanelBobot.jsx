import { useEffect, useRef, useState } from "react";

import { DIMENSI_UI } from "../lib/kamus";
import AlokasiPoin, { TOTAL_POIN } from "./AlokasiPoin";

// Label dan urutan diambil dari sumber yang sama dengan kartu prioritas di
// beranda. Kalau keduanya berbeda kata, pilihan di beranda terasa tidak
// mendarat di peta.
// App menyimpan bobot sebagai angka mentah 0-100 dan skor memakai bobot
// RELATIF (w / Sigma-w). Kontrol alokasi bekerja dalam 12 poin, jadi konversi
// dilakukan di batas komponen ini saja — logika skor di App tidak disentuh.
function bobotKeAlokasi(bobot) {
  const total = DIMENSI_UI.reduce((a, { kunci }) => a + (bobot[kunci] ?? 0), 0);
  const hasil = {};
  if (total <= 0) {
    for (const { kunci } of DIMENSI_UI) hasil[kunci] = 0;
    return hasil;
  }
  let terpakai = 0;
  for (const { kunci } of DIMENSI_UI) {
    hasil[kunci] = Math.min(
      6,
      Math.round(((bobot[kunci] ?? 0) / total) * TOTAL_POIN),
    );
    terpakai += hasil[kunci];
  }
  // Selisih pembulatan dibebankan ke dimensi terbesar supaya totalnya tepat 12.
  let beda = TOTAL_POIN - terpakai;
  const urut = DIMENSI_UI.map((d) => d.kunci).sort(
    (x, y) => (bobot[y] ?? 0) - (bobot[x] ?? 0),
  );
  for (const k of urut) {
    if (beda === 0) break;
    const naik = beda > 0 ? 1 : -1;
    const calon = hasil[k] + naik;
    if (calon < 0 || calon > 6) continue;
    hasil[k] = calon;
    beda -= naik;
  }
  return hasil;
}

export default function PanelBobot({
  bobot,
  bobotBawaan,
  onBobotBerubah,
  onKembalikanBawaan,
}) {
  // Acuan bawaan datang dari App (metadata.bobot_default), BUKAN dari
  // BOBOT_DEFAULT di config. Sebelumnya panel ini memakai konstanta config
  // sementara App memakai metadata: keduanya kebetulan bernilai sama, jadi
  // tidak ada gejala — tapi begitu pipeline mengubah bobot bawaan, panel dan
  // tombol "Kembalikan bawaan" akan berselisih diam-diam.
  const bedaDariBawaan = DIMENSI_UI.some(
    ({ kunci }) => Math.abs((bobot[kunci] ?? 0) - (bobotBawaan[kunci] ?? 0)) > 0.5,
  );

  // Alokasi 12 poin yang paling mendekati bobot bawaan (5-3-2-2 untuk
  // 40/25/20/15). Dihitung dengan fungsi yang sama dengan konversi biasa,
  // supaya pintasan "Mendekati bawaan" tidak pernah berbeda dari hasil
  // "Kembalikan bawaan".
  const alokasiBawaan = bobotKeAlokasi(bobotBawaan);

  // Alokasi disimpan di sini sebagai sumber kebenaran, BUKAN diturunkan
  // ulang dari `bobot` setiap render. Bobot yang dikirim ke App sudah
  // dibulatkan ke skala 0-100, jadi menurunkannya kembali ke 12 poin
  // kehilangan presisi: 6 poin -> 50 -> 6, tapi 1 poin -> 8 -> 1 tidak selalu
  // bulat, dan hasilnya klik terasa meleset satu langkah.
  const [alokasi, setAlokasi] = useState(() => bobotKeAlokasi(bobot));

  // Ikuti perubahan bobot yang datang dari LUAR panel (profil beranda,
  // "Kembalikan bawaan"), tapi jangan menimpa alokasi yang baru saja diubah
  // pengguna di sini.
  const bobotTerakhir = useRef(bobot);
  useEffect(() => {
    const berubahDariLuar = DIMENSI_UI.some(
      ({ kunci }) => (bobot[kunci] ?? 0) !== (bobotTerakhir.current[kunci] ?? 0),
    );
    if (berubahDariLuar) {
      bobotTerakhir.current = bobot;
      setAlokasi(bobotKeAlokasi(bobot));
    }
  }, [bobot]);

  // Satu poin = 1/12 bobot, dikirim dalam skala 0-100 yang sudah dipakai App.
  //
  // JANGAN dibulatkan di sini. Pembulatan tiap dimensi membuat totalnya
  // meleset dari 100 (mis. 5-4-1-1 -> 42+33+8+8 = 91), lalu panel kanan yang
  // menormalisasi ulang atas total 91 menampilkan 46/36/9/9 sementara panel
  // kiri menampilkan 42/33/8/8. Dua angka untuk bobot yang sama persis.
  // Dengan pecahan utuh, w/sum(w) mengembalikan proporsi aslinya dan kedua
  // panel selalu sepakat.
  const ubahAlokasi = (baru) => {
    setAlokasi(baru);
    const bobotBaru = {};
    for (const { kunci } of DIMENSI_UI) {
      bobotBaru[kunci] = ((baru[kunci] ?? 0) / TOTAL_POIN) * 100;
    }
    bobotTerakhir.current = bobotBaru;
    onBobotBerubah(bobotBaru);
  };

  return (
    <div className="weight-panel">
      {/* Alokasi 12 poin, bukan empat slider bebas: dengan slider, menggeser
          satu dimensi mengubah porsi tiga lainnya lewat normalisasi, dan
          pengguna tidak pernah bisa mengunci sebaran yang diinginkannya. */}
      <AlokasiPoin
        nilai={alokasi}
        onUbah={ubahAlokasi}
        rentang={false}
        pinjamDariLain
        alokasiBawaan={alokasiBawaan}
      />
      <button
        onClick={onKembalikanBawaan}
        className="mt-3 w-full rounded bg-white/10 px-2 py-1.5 text-xs text-slate-200 hover:bg-white/20"
      >
        Kembalikan bawaan
      </button>
      {bedaDariBawaan && (
        <div className="mt-2 text-xs leading-snug text-slate-500">
          Peta menampilkan skor dengan bobot pilihan Anda, bukan skor bawaan.
        </div>
      )}
    </div>
  );
}
