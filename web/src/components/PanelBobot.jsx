import { useState } from "react";

import { BOBOT_DEFAULT } from "../config";

const DIMENSI = [
  ["connectivity", "Konektivitas"],
  ["affordability", "Keterjangkauan"],
  ["amenity", "Amenitas"],
  ["walkability", "Kelayakan Jalan Kaki"],
];

export default function PanelBobot({ bobot, onBobotBerubah, onKembalikanBawaan }) {
  const [terbuka, setTerbuka] = useState(true);
  const total = DIMENSI.reduce((a, [k]) => a + (bobot[k] ?? 0), 0);
  const bedaDariBawaan =
    Math.abs(bobot.connectivity - BOBOT_DEFAULT.connectivity * 100) > 0.5 ||
    Math.abs(bobot.affordability - BOBOT_DEFAULT.affordability * 100) > 0.5 ||
    Math.abs(bobot.amenity - BOBOT_DEFAULT.amenity * 100) > 0.5 ||
    Math.abs(bobot.walkability - BOBOT_DEFAULT.walkability * 100) > 0.5;
  const pct = (k) => (total > 0 ? Math.round(((bobot[k] ?? 0) / total) * 100) : 0);

  return (
    <div className="absolute left-4 top-20 z-10 w-72 rounded-lg bg-slate-900/85 p-3 text-white shadow-lg backdrop-blur-sm">
      <button
        onClick={() => setTerbuka((t) => !t)}
        className="flex w-full items-center justify-between text-left"
      >
        <span className="text-sm font-semibold">Bobot prioritas</span>
        <span className="text-xs text-slate-400">{terbuka ? "▴" : "▾"}</span>
      </button>
      {terbuka && (
        <div className="mt-2 space-y-3">
          {DIMENSI.map(([kunci, nama]) => (
            <label key={kunci} className="block text-xs">
              <div className="flex justify-between">
                <span>{nama}</span>
                <span className="font-semibold text-emerald-400">{pct(kunci)}%</span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                step={1}
                value={bobot[kunci]}
                onChange={(e) => onBobotBerubah(kunci, Number(e.target.value))}
                className="mt-1 w-full accent-emerald-400"
              />
            </label>
          ))}
          <div className="flex items-center justify-between border-t border-white/10 pt-2 text-xs">
            <span className="text-slate-300">Total</span>
            <span className="font-semibold text-emerald-400">100%</span>
          </div>
          <button
            onClick={onKembalikanBawaan}
            className="w-full rounded bg-white/10 px-2 py-1.5 text-xs text-slate-200 hover:bg-white/20"
          >
            Kembalikan bawaan
          </button>
          {bedaDariBawaan && (
            <div className="text-[10px] leading-snug text-slate-500">
              Peta menampilkan skor dengan bobot pilihan Anda, bukan skor bawaan.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
