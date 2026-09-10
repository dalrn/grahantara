import { Collapse } from "./Motion";
import { useState } from "react";

import { BOBOT_DEFAULT } from "../config";

const DIMENSI = [
  ["connectivity", "Akses transportasi"],
  ["affordability", "Keterjangkauan"],
  ["amenity", "Kenyamanan"],
  ["walkability", "Kenyamanan berjalan kaki"],
];

export default function PanelBobot({
  bobot,
  onBobotBerubah,
  onKembalikanBawaan,
}) {
  // terlipat bawaan di mobile (< md), terbuka di desktop
  const [terbuka, setTerbuka] = useState(
    () => window.matchMedia("(min-width: 768px)").matches,
  );
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
    connectivity: "Akses kampus & transportasi",
    affordability: "Biaya kos & makan",
    amenity: "Pilihan fasilitas harian",
    walkability: "Kenyamanan berjalan kaki",
  };

  return (
    <div className="weight-panel absolute left-2 top-14 z-20 w-48 rounded-lg bg-slate-900/85 p-3 text-white shadow-lg backdrop-blur-sm md:left-4 md:top-3 md:w-72">
      <button
        onClick={() => setTerbuka((t) => !t)}
        aria-expanded={terbuka}
        className="flex w-full items-center justify-between text-left"
      >
        <span className="text-sm font-semibold">Bobot prioritas</span>
        <span className="text-xs text-slate-400">{terbuka ? "▴" : "▾"}</span>
      </button>
      <Collapse open={terbuka}>
        <div className="mt-2 space-y-3">
          <p className="text-xs text-slate-400">
            Geser prioritas. Lihat kawasan mana yang lebih sesuai.
          </p>
          {DIMENSI.map(([kunci, nama]) => (
            <label key={kunci} className="block text-xs">
              <div className="flex justify-between">
                <span>{nama}</span>
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
                aria-valuetext={`${pct(kunci)} persen prioritas`}
                className="mt-1 w-full accent-emerald-400"
              />
              <div className="text-xs text-slate-400">
                {impact[kunci]} ·{" "}
                {pct(kunci) >= 35
                  ? "Prioritas utama"
                  : pct(kunci) === 0
                    ? "Tidak diprioritaskan"
                    : "Ikut dipertimbangkan"}
              </div>
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
      </Collapse>
    </div>
  );
}
