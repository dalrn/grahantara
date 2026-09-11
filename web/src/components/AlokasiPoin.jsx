import { useRef, useState } from "react";

import { DIMENSI_UI } from "../lib/kamus";

export const TOTAL_POIN = 12;
export const KOTAK_PER_DIMENSI = 6;

/**
 * Rentang kondisi nyata tiap dimensi di Sleman, dari persentil 5 ke 95
 * subskor (bukan minimum/maksimum — satu kawasan ekstrem akan membuat
 * rentangnya terlihat lebih lebar daripada yang benar-benar dihadapi
 * pengguna).
 *
 * Angkanya MEDIAN indikator pada 5% kawasan terbawah dan 5% teratas tiap
 * dimensi, dihitung dari hexagons.geojson versi 1.0:
 *
 *   connectivity  p5 24,7  p95 88,4   halte 4.553 m / 0 rute / tidak terjangkau
 *                                     -> halte 167 m / 5 rute / rute langsung
 *   affordability p5  3,3  p95 95,1   Rp 1,4 juta -> Rp 575 ribu
 *   amenity       p5 10,7  p95 78,5   0 tempat makan -> 56 tempat makan, 3 layanan
 *   walkability   p5 38,4  p95 60,1   teduh 0,26 / terang 4 / trotoar 0,11
 *                                     -> teduh 0,39 / terang 15 / trotoar 0,14
 *
 * Diterjemahkan ke satuan yang dipahami orang, bukan angka subskor.
 */
const RENTANG = {
  connectivity: {
    buruk: "halte 4,5 km, tanpa rute ke kampus",
    baik: "halte 170 m, 5 rute, ada yang langsung ke kampus",
  },
  affordability: {
    buruk: "Rp 1,4 juta per bulan",
    baik: "Rp 575 ribu per bulan",
  },
  amenity: {
    buruk: "nyaris tidak ada tempat makan",
    baik: "puluhan tempat makan, minimarket, dan laundry",
  },
  walkability: {
    buruk: "jalan gelap, trotoar nyaris tidak ada",
    baik: "jauh lebih terang, lebih teduh, trotoar lebih utuh",
  },
};

/**
 * Alokasi 12 poin ke empat dimensi, enam kotak per dimensi.
 *
 * Sengaja hanya 12 poin untuk 24 kotak: pengguna TIDAK MUNGKIN mengisi
 * semuanya, jadi mengalokasikan berarti benar-benar memilih. Bobot tiap
 * dimensi = kotak/12, rentangnya 8,3% sampai 50%.
 *
 * `nilai` adalah objek {kunci: jumlahKotak}. `onUbah` menerima objek serupa.
 */
export default function AlokasiPoin({ nilai, onUbah, rentang = true }) {
  const [kedip, setKedip] = useState(false);
  const kedipTimer = useRef(null);

  const terpakai = DIMENSI_UI.reduce((a, { kunci }) => a + (nilai[kunci] ?? 0), 0);
  const sisa = TOTAL_POIN - terpakai;

  const kedipkanSisa = () => {
    clearTimeout(kedipTimer.current);
    setKedip(true);
    kedipTimer.current = setTimeout(() => setKedip(false), 450);
  };

  const setelKe = (kunci, target) => {
    const sekarang = nilai[kunci] ?? 0;
    const diminta = Math.max(0, Math.min(KOTAK_PER_DIMENSI, target));
    if (diminta === sekarang) return;

    if (diminta < sekarang) {
      // Menurunkan selalu boleh; poinnya kembali ke jatah.
      onUbah({ ...nilai, [kunci]: diminta });
      return;
    }
    const butuh = diminta - sekarang;
    if (butuh <= sisa) {
      onUbah({ ...nilai, [kunci]: diminta });
      return;
    }
    // Poin tidak cukup: isi sebanyak yang mampu, lalu kedipkan penghitung.
    // Tidak diam, tidak memunculkan pesan error.
    if (sisa > 0) onUbah({ ...nilai, [kunci]: sekarang + sisa });
    kedipkanSisa();
  };

  const klikKotak = (kunci, indeks) => {
    const sekarang = nilai[kunci] ?? 0;
    // Mengklik kotak terakhir yang terisi menurunkannya satu. Ini satu-satunya
    // jalan menuju 0, jadi harus tetap bekerja di kotak pertama.
    if (indeks + 1 === sekarang) setelKe(kunci, sekarang - 1);
    else setelKe(kunci, indeks + 1);
  };

  const padaTombol = (e, kunci) => {
    const sekarang = nilai[kunci] ?? 0;
    if (e.key === "ArrowRight" || e.key === "ArrowUp") {
      e.preventDefault();
      setelKe(kunci, sekarang + 1);
    } else if (e.key === "ArrowLeft" || e.key === "ArrowDown") {
      e.preventDefault();
      setelKe(kunci, sekarang - 1);
    } else if (e.key === "Home") {
      e.preventDefault();
      setelKe(kunci, 0);
    } else if (e.key === "End") {
      e.preventDefault();
      setelKe(kunci, KOTAK_PER_DIMENSI);
    }
  };

  const bagiRata = () => {
    const rata = {};
    for (const { kunci } of DIMENSI_UI) rata[kunci] = TOTAL_POIN / 4;
    onUbah(rata);
  };

  const persen = (k) =>
    terpakai > 0 ? Math.round(((nilai[k] ?? 0) / TOTAL_POIN) * 100) : 0;

  const semuaSama = DIMENSI_UI.every(
    ({ kunci }) => (nilai[kunci] ?? 0) === TOTAL_POIN / 4,
  );
  const adaNol =
    sisa === 0 && DIMENSI_UI.some(({ kunci }) => (nilai[kunci] ?? 0) === 0);

  return (
    <div className="alokasi">
      <div className="alokasi-kepala">
        <div>
          {/* Penghitung sisa SEKALIGUS jadi penjelasan kenapa tombol lanjut
              belum aktif; tidak ada pesan validasi terpisah. */}
          <span
            className={`alokasi-sisa${kedip ? " is-kedip" : ""}`}
            aria-live="polite"
          >
            {sisa > 0
              ? `${sisa} dari ${TOTAL_POIN} poin belum dibagi`
              : `Semua ${TOTAL_POIN} poin sudah dibagi`}
          </span>
        </div>
        <button type="button" className="alokasi-rata" onClick={bagiRata}>
          Bagi rata
        </button>
      </div>

      <div className="alokasi-daftar">
        {DIMENSI_UI.map(({ kunci, label }) => {
          const isi = nilai[kunci] ?? 0;
          const p = persen(kunci);
          return (
            <div key={kunci} className="alokasi-baris">
              <div className="alokasi-judul">
                <span className="alokasi-nama">{label}</span>
                <span className="alokasi-persen">{p}%</span>
              </div>
              <div
                className="alokasi-kotak"
                role="slider"
                tabIndex={0}
                aria-valuenow={isi}
                aria-valuemin={0}
                aria-valuemax={KOTAK_PER_DIMENSI}
                aria-valuetext={`${label}: ${isi} dari ${KOTAK_PER_DIMENSI} poin, ${p} persen`}
                aria-label={label}
                onKeyDown={(e) => padaTombol(e, kunci)}
              >
                {Array.from({ length: KOTAK_PER_DIMENSI }, (_, i) => (
                  <button
                    key={i}
                    type="button"
                    tabIndex={-1}
                    className={`kotak${i < isi ? " is-isi" : ""}`}
                    aria-hidden="true"
                    onClick={() => klikKotak(kunci, i)}
                  />
                ))}
              </div>
              {/* Baris rentang hanya relevan di beranda, tempat pengguna
                  belum melihat petanya. Di panel peta, kondisi nyata sudah
                  terlihat langsung dari warna heksagon. */}
              {rentang && (
                <p className="alokasi-rentang">
                  <span>{RENTANG[kunci].buruk}</span>
                  <span className="alokasi-panah" aria-hidden="true">
                    &rarr;
                  </span>
                  <span>{RENTANG[kunci].baik}</span>
                </p>
              )}
            </div>
          );
        })}
      </div>

      {/* Catatan tenang, bukan larangan. Muncul sekali, tidak diulang per
          dimensi dan tidak menghalangi lanjut. */}
      {semuaSama && (
        <p className="alokasi-catatan">
          Pembagian rata sama dengan bobot bawaan, jadi peta tidak akan berbeda
          dari tampilan awalnya.
        </p>
      )}
      {adaNol && !semuaSama && (
        <p className="alokasi-catatan">
          Dimensi yang kamu beri 0 poin tidak ikut dinilai sama sekali.
        </p>
      )}
    </div>
  );
}
