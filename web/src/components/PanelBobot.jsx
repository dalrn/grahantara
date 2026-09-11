import { BOBOT_DEFAULT } from "../config";
import { DIMENSI_UI } from "../lib/kamus";

// Label dan urutan diambil dari sumber yang sama dengan kartu prioritas di
// beranda. Kalau keduanya berbeda kata, pilihan di beranda terasa tidak
// mendarat di peta.
const DIMENSI = DIMENSI_UI.map((d) => [d.kunci, d.label]);

export default function PanelBobot({
  bobot,
  onBobotBerubah,
  onKembalikanBawaan,
}) {
  const total = DIMENSI.reduce((a, [k]) => a + (bobot[k] ?? 0), 0);
  const bedaDariBawaan =
    Math.abs(bobot.connectivity - BOBOT_DEFAULT.connectivity * 100) > 0.5 ||
    Math.abs(bobot.affordability - BOBOT_DEFAULT.affordability * 100) > 0.5 ||
    Math.abs(bobot.amenity - BOBOT_DEFAULT.amenity * 100) > 0.5 ||
    Math.abs(bobot.walkability - BOBOT_DEFAULT.walkability * 100) > 0.5;
  const pct = (k) =>
    total > 0
      ? Math.round(((bobot[k] ?? 0) / total) * 100)
      : Math.round(BOBOT_DEFAULT[k] * 100);
  const impact = {
    connectivity: "Halte, rute, dan jangkauan kampus",
    affordability: "Harga kos dan makan",
    amenity: "Tempat makan dan layanan harian",
    walkability: "Trotoar, keteduhan, penerangan",
  };

  return (
    <div className="weight-panel">
      <div>
        <div className="space-y-3">
          {DIMENSI.map(([kunci, nama]) => (
            <label key={kunci} className="block text-xs">
              <div className="flex justify-between">
                <span>{nama}</span>
                {/* Persentase relatif, bukan nilai mentah 0-100. Bobot mentah
                    tidak memberi tahu apa pun: 100 untuk semua dimensi sama
                    saja dengan 25 untuk semua. Persentase membuat itu
                    terlihat karena jumlahnya selalu 100%. */}
                <span className="font-semibold text-emerald-400">
                  {pct(kunci)}%
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                step={1}
                value={bobot[kunci]}
                onChange={(e) => onBobotBerubah(kunci, Number(e.target.value))}
                aria-valuetext={`${bobot[kunci]} dari 100, setara ${pct(kunci)} persen prioritas`}
                className="mt-1 w-full accent-emerald-400"
              />
              <div className="text-xs text-slate-400">{impact[kunci]}</div>
            </label>
          ))}
          <div className="flex items-center justify-between border-t border-white/10 pt-2 text-xs">
            <span className="text-slate-300">
              {total === 0 ? "Menggunakan bobot bawaan" : "Total prioritas"}
            </span>
            <span className="font-semibold text-emerald-400">100%</span>
          </div>
          <button
            onClick={onKembalikanBawaan}
            className="w-full rounded bg-white/10 px-2 py-1.5 text-xs text-slate-200 hover:bg-white/20"
          >
            Kembalikan bawaan
          </button>
          {bedaDariBawaan && (
            <div className="text-xs leading-snug text-slate-500">
              Peta menampilkan skor dengan bobot pilihan Anda, bukan skor
              bawaan.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
