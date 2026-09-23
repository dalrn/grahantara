import { useEffect, useState } from "react";

import { muatHeksagon } from "../lib/muatHeksagon";

const LEBAR = 132;
const TINGGI = 34;
const KELOMPOK = 22;

/**
 * Histogram subskor per dimensi, dihitung dari hexagons.geojson yang sama
 * dengan peta. Bukan grafik hiasan: tiap batang adalah cacah heksagon nyata
 * pada rentang subskor itu, dan cacah yang dilaporkan di bawahnya adalah
 * jumlah heksagon yang benar-benar punya data dimensi tersebut.
 *
 * Affordability hanya terisi di 153 dari 2.134 heksagon. Itu ditampilkan apa
 * adanya, karena justru itu yang perlu diketahui pembaca.
 */
export default function SebaranDimensi({ dimensi, onCakupan }) {
  const [sebaran, setSebaran] = useState(null);
  const [sorot, setSorot] = useState(null);

  useEffect(() => {
    let batal = false;
    muatHeksagon()
      .then((data) => {
        if (batal) return;
        const hasil = {};
        for (const [kunci] of dimensi) {
          const nilai = [];
          for (const f of data.features) {
            const kosong = f.properties.dimensi_kosong ?? [];
            const daftar = Array.isArray(kosong)
              ? kosong
              : String(kosong)
                  .split(/[,\s[\]"]+/)
                  .filter(Boolean);
            if (daftar.includes(kunci)) continue;
            nilai.push(f.properties.subskor[kunci]);
          }
          const bin = Array.from({ length: KELOMPOK }, () => 0);
          for (const v of nilai) {
            const i = Math.min(KELOMPOK - 1, Math.floor((v / 100) * KELOMPOK));
            bin[i] += 1;
          }
          const puncak = Math.max(...bin, 1);
          hasil[kunci] = { bin, puncak, jumlah: nilai.length };
        }
        setSebaran(hasil);
        // Laporkan dimensi yang cakupannya BELUM penuh, supaya kalimat
        // cakupan di beranda dihasilkan dari data dan tidak pernah basi.
        const total = data.features.length;
        onCakupan?.(
          dimensi
            .filter(([kunci]) => (hasil[kunci]?.jumlah ?? 0) < total)
            .map(([, nama]) => nama),
        );
      })
      .catch(() => {
        if (!batal) setSebaran(null);
      });
    return () => {
      batal = true;
    };
  // onCakupan sengaja bukan dependensi: identitasnya berubah tiap render
  // induk dan akan memicu fetch ulang tanpa henti.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dimensi]);

  return (
    <dl className="home-dimensi">
      {dimensi.map(([kunci, nama, jelas]) => {
        const s = sebaran?.[kunci];
        const lebarBatang = LEBAR / KELOMPOK;
        const aktif = sorot?.kunci === kunci ? sorot : null;
        return (
          <div key={kunci}>
            <dt>{nama}</dt>
            <dd>{jelas}</dd>
            <div className="dimensi-sebaran">
              {s ? (
                <div
                  className="sebaran-bingkai"
                  onMouseLeave={() => setSorot(null)}
                >
                  <svg
                    width={LEBAR}
                    height={TINGGI}
                    viewBox={`0 0 ${LEBAR} ${TINGGI}`}
                    role="img"
                    aria-label={`Sebaran subskor ${nama} pada ${s.jumlah.toLocaleString("id-ID")} kawasan`}
                  >
                    {s.bin.map((c, i) => {
                      const t = (c / s.puncak) * (TINGGI - 2);
                      const ini = aktif?.i === i;
                      // Batang yang ditunjuk naik sedikit; batang bernilai 0
                      // tetap punya area tangkap supaya rentangnya bisa
                      // dibaca juga.
                      const tinggiBatang = Math.max(t + (ini ? 3 : 0), 1);
                      return (
                        <rect
                          key={i}
                          className={ini ? "batang is-sorot" : "batang"}
                          x={i * lebarBatang}
                          y={TINGGI - tinggiBatang}
                          width={lebarBatang - 1}
                          height={tinggiBatang}
                          onMouseEnter={() => setSorot({ kunci, i, cacah: c })}
                        />
                      );
                    })}
                  </svg>
                  {aktif && (
                    <span
                      className="sebaran-tip"
                      style={{
                        left: `${((aktif.i + 0.5) / KELOMPOK) * 100}%`,
                      }}
                    >
                      {Math.round((aktif.i / KELOMPOK) * 100)}&ndash;
                      {Math.round(((aktif.i + 1) / KELOMPOK) * 100)} (
                      {aktif.cacah.toLocaleString("id-ID")} kawasan)
                    </span>
                  )}
                </div>
              ) : (
                <span className="sebaran-kosong">&nbsp;</span>
              )}
            </div>
          </div>
        );
      })}
    </dl>
  );
}
