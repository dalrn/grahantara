import { useEffect, useState } from "react";

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
export default function SebaranDimensi({ dimensi }) {
  const [sebaran, setSebaran] = useState(null);

  useEffect(() => {
    let batal = false;
    const controller = new AbortController();
    fetch("/data/hexagons.geojson", { signal: controller.signal })
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((data) => {
        if (batal) return;
        const hasil = {};
        for (const [kunci] of dimensi) {
          const nilai = [];
          for (const f of data.features) {
            const kosong = f.properties.dimensi_kosong ?? [];
            const daftar = Array.isArray(kosong)
              ? kosong
              : String(kosong).split(/[,\s[\]"]+/).filter(Boolean);
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
      })
      .catch(() => {
        if (!batal) setSebaran(null);
      });
    return () => {
      batal = true;
      controller.abort();
    };
  }, [dimensi]);

  return (
    <dl className="home-dimensi">
      {dimensi.map(([kunci, nama, jelas]) => {
        const s = sebaran?.[kunci];
        const lebarBatang = LEBAR / KELOMPOK;
        return (
          <div key={kunci}>
            <dt>{nama}</dt>
            <dd>{jelas}</dd>
            <div className="dimensi-sebaran">
              {s ? (
                <>
                  <svg
                    width={LEBAR}
                    height={TINGGI}
                    viewBox={`0 0 ${LEBAR} ${TINGGI}`}
                    role="img"
                    aria-label={`Sebaran subskor ${nama} pada ${s.jumlah.toLocaleString("id-ID")} kawasan`}
                  >
                    {s.bin.map((c, i) => {
                      const t = (c / s.puncak) * (TINGGI - 2);
                      return (
                        <rect
                          key={i}
                          x={i * lebarBatang}
                          y={TINGGI - t}
                          width={lebarBatang - 1}
                          height={t}
                        />
                      );
                    })}
                  </svg>
                </>
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
