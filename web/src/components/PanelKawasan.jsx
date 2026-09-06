import { useState } from "react";

import { KELOMPOK_INDIKATOR } from "../lib/kamus";
import { formatSkor } from "../lib/format";
import BarisIndikator from "./BarisIndikator";

function BlokDimensi({ kelompok, subskor, indikator, bobot, terbuka, onToggle }) {
  const nilai = subskor?.[kelompok.dimensi];
  const w = bobot ? bobot[kelompok.dimensi] : null;
  return (
    <div className="border-t border-white/10 py-3">
      <button
        onClick={onToggle}
        className="flex w-full items-center justify-between text-left"
        aria-expanded={terbuka}
      >
        <span className="text-sm font-semibold text-white">
          {kelompok.label}
          {w !== null && (
            <span className="ml-1 text-[10px] font-normal text-slate-500">
              (bobot {(w * 100).toLocaleString("id-ID", { maximumFractionDigits: 1 })}%)
            </span>
          )}
        </span>
        <span className="flex items-center gap-2">
          <span className="text-sm font-bold text-emerald-400">{formatSkor(nilai)}</span>
          <span className="text-xs text-slate-400">{terbuka ? "▴" : "▾"}</span>
        </span>
      </button>
      <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full rounded-full bg-emerald-400"
          style={{ width: `${Math.max(0, Math.min(100, nilai ?? 0))}%` }}
        />
      </div>
      {terbuka && (
        <div className="mt-2 divide-y divide-white/5">
          {kelompok.kunci.map((k) => (
            <BarisIndikator key={k} kunci={k} data={indikator?.[k]} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function PanelKawasan({ heksagon, versi, skorKini, bobotKini, onTutup }) {
  const [terbuka, setTerbuka] = useState(
    () => new Set(KELOMPOK_INDIKATOR.map((k) => k.dimensi)),
  );

  if (!heksagon) return null;

  const toggle = (dimensi) => {
    setTerbuka((sebelum) => {
      const baru = new Set(sebelum);
      if (baru.has(dimensi)) baru.delete(dimensi);
      else baru.add(dimensi);
      return baru;
    });
  };

  const pakaiBobotAnda = skorKini !== null && bobotKini !== null;

  return (
    <div className="absolute right-0 top-0 z-20 flex h-full w-[380px] flex-col bg-slate-900/95 text-white shadow-2xl backdrop-blur-sm">
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
        <span className="text-sm font-semibold">Kawasan terpilih</span>
        <button
          onClick={onTutup}
          className="rounded p-1 text-slate-400 hover:bg-white/10 hover:text-white"
          aria-label="Tutup panel"
        >
          ✕
        </button>
      </div>
      <div className="flex-1 overflow-y-auto px-4 pb-4">
        <div className="select-text pt-2 font-mono text-[10px] text-slate-500">
          {heksagon.h3_index}
        </div>
        {pakaiBobotAnda ? (
          <>
            <div className="text-[11px] text-slate-400">Skor dengan bobot Anda</div>
            <div className="text-4xl font-bold text-emerald-400">{formatSkor(skorKini)}</div>
            <div className="text-[11px] text-slate-500">
              Skor bawaan: {formatSkor(heksagon.skor)}
            </div>
          </>
        ) : (
          <>
            <div className="text-4xl font-bold text-emerald-400">
              {formatSkor(heksagon.skor)}
            </div>
            <div className="text-[11px] text-slate-400">
              pada bobot bawaan C 0,40 / A 0,25 / M 0,20 / W 0,15
            </div>
          </>
        )}
        <div className="text-[10px] text-slate-600">
          Bobot bawaan diasumsikan dari dokumen proyek. GeoJSON belum memuat
          metadata.bobot_default.
        </div>

        <div>
          {KELOMPOK_INDIKATOR.map((kelompok) => (
            <BlokDimensi
              key={kelompok.dimensi}
              kelompok={kelompok}
              subskor={heksagon.subskor}
              indikator={heksagon.indikator}
              bobot={bobotKini}
              terbuka={terbuka.has(kelompok.dimensi)}
              onToggle={() => toggle(kelompok.dimensi)}
            />
          ))}
        </div>

        <div className="border-t border-white/10 pt-2 text-[10px] text-slate-600">
          Data {versi ?? "stub"}. Angka acak, bukan hasil analisis.
        </div>
      </div>
    </div>
  );
}
