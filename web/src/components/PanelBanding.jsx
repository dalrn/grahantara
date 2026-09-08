import { useEffect, useState } from "react";

import { KELOMPOK_INDIKATOR, NAMA_INDIKATOR } from "../lib/kamus";
import { formatNilai, formatSkor } from "../lib/format";

const WARNA_A = "#38bdf8";
const WARNA_B = "#f97316";

const fmtAngka = (v) =>
  typeof v === "number"
    ? v.toLocaleString("id-ID", { minimumFractionDigits: 1, maximumFractionDigits: 1 })
    : "-";

export default function PanelBanding({
  pilihan, skorKini, versi, onTutup, onGanti, hasilBanding, galat, padaBanding,
}) {
  const [galatLokal, setGalatLokal] = useState(null);
  const a = pilihan.a;
  const b = pilihan.b;

  useEffect(() => {
    setGalatLokal(null);
  }, [a?.h3_index, b?.h3_index]);

  const memuat = hasilBanding === "memuat";

  const kirim = () => {
    if (!a || !b || memuat) return;
    padaBanding();
  };

  const dimUnggul = (k, dX, dY) => {
    const ix = dX?.indikator?.[k];
    const iy = dY?.indikator?.[k];
    const takTersedia = (i) => !i || i.sumber === "tidak_tersedia" || i.nilai === null;
    if (takTersedia(ix) || takTersedia(iy)) return null;
    if (typeof ix.nilai === "number" && typeof iy.nilai === "number") {
      if (ix.nilai > iy.nilai) return "A";
      if (iy.nilai > ix.nilai) return "B";
    }
    return null;
  };

  const Kartu = ({ data, warna, label, skor, ganti }) => (
    <div className="flex-1 rounded-lg bg-slate-800/70 p-2">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-semibold" style={{ color: warna }}>
          Kawasan {label}
        </span>
        <button onClick={ganti} className="text-[10px] text-slate-400 underline hover:text-white">
          ganti
        </button>
      </div>
      <div className="font-mono text-[9px] text-slate-500">{data?.h3_index ?? "—"}</div>
      <div className="text-2xl font-bold" style={{ color: warna }}>
        {skor !== null && skor !== undefined ? formatSkor(skor) : "—"}
      </div>
    </div>
  );

  if (!a || !b) {
    // Bar kompak: jangan menutupi peta saat satu slot masih kosong.
    return (
      <div className="absolute inset-x-2 bottom-2 z-20 rounded-xl bg-slate-900/95 px-3 py-2 text-white shadow-xl backdrop-blur-sm md:inset-x-auto md:bottom-4 md:right-4 md:w-80">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-semibold text-slate-300">
            {a ? "Bandingkan kawasan — klik kawasan B di peta" : "Bandingkan kawasan — klik dua heksagon di peta"}
          </span>
          <button onClick={onTutup} className="shrink-0 text-slate-400 hover:text-white" aria-label="Tutup panel banding">
            ✕
          </button>
        </div>
        {a && (
          <div className="mt-1 flex items-center gap-2 text-[10px]">
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: WARNA_A }} />
            <span className="font-mono text-slate-400">{a.h3_index}</span>
            <span className="ml-auto font-bold text-sky-300">
              {skorKini?.a !== null && skorKini?.a !== undefined ? formatSkor(skorKini.a) : "—"}
            </span>
          </div>
        )}
      </div>
    );
  }

  const isiIndikator = (k, dX) => {
    const ik = dX?.indikator?.[k];
    if (!ik || ik.sumber === "tidak_tersedia" || ik.nilai === null) return "tidak tersedia";
    const teks = formatNilai(ik.nilai, ik.satuan) ?? "tidak tersedia";
    if (ik.sumber === "model") return `${teks} (estimasi)`;
    return teks;
  };

  return (
    <div className="absolute inset-x-0 bottom-0 z-20 flex h-[80dvh] flex-col rounded-t-2xl bg-slate-900/95 text-white shadow-2xl backdrop-blur-sm md:inset-x-auto md:inset-y-0 md:right-0 md:h-full md:w-[460px] md:rounded-none">
      <div className="mx-auto mt-1.5 h-1 w-10 shrink-0 rounded-full bg-white/25 md:hidden" />
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
        <span className="text-sm font-semibold">Bandingkan kawasan</span>
        <button onClick={onTutup} className="text-slate-400 hover:text-white" aria-label="Tutup panel banding">
          ✕
        </button>
      </div>
      <div className="flex-1 overflow-y-auto px-4 pb-4">
        <div className="flex gap-2">
          <Kartu data={a} warna={WARNA_A} label="A" skor={skorKini?.a} ganti={() => onGanti("a")} />
          <Kartu data={b} warna={WARNA_B} label="B" skor={skorKini?.b} ganti={() => onGanti("b")} />
        </div>

        {a && b && a && b && (
          <>
            <div className="mt-4 text-xs font-semibold text-slate-300">Subskor dimensi</div>
            <div className="mt-1 overflow-hidden rounded border border-white/10">
              {KELOMPOK_INDIKATOR.map((kel) => {
                const vA = a.subskor?.[kel.dimensi];
                const vB = b.subskor?.[kel.dimensi];
                const unggul = vA > vB ? "A" : vB > vA ? "B" : null;
                return (
                  <div key={kel.dimensi} className="flex items-center gap-2 border-b border-white/5 px-2 py-1.5 text-xs last:border-0">
                    <span className="w-36 shrink-0 text-slate-300">{kel.label}</span>
                    <div className="flex-1">
                      <div className="flex h-1.5 gap-0.5">
                        <div className="h-full rounded-l bg-sky-400" style={{ width: `${Math.min(100, vA ?? 0)}%` }} />
                        <div className="h-full flex-1 rounded-r bg-orange-400" style={{ opacity: Math.min(1, (vB ?? 0) / 100) }} />
                      </div>
                    </div>
                    <span className="w-16 text-right text-sky-300">{fmtAngka(vA)}</span>
                    <span className="w-16 text-right text-orange-300">{fmtAngka(vB)}</span>
                    <span className="w-5 text-center text-[10px]">
                      {unggul === "A" ? "▲" : unggul === "B" ? "◆" : ""}
                    </span>
                  </div>
                );
              })}
            </div>

            <div className="mt-4 text-xs font-semibold text-slate-300">Indikator</div>
            <div className="mt-1 overflow-hidden rounded border border-white/10">
              {KELOMPOK_INDIKATOR.flatMap((kel) =>
                kel.kunci.map((k) => {
                  const unggul = dimUnggul(k, a, b);
                  return (
                    <div key={k} className="flex items-center gap-2 border-b border-white/5 px-2 py-1 text-[11px] last:border-0">
                      <span className="flex-1 text-slate-300">{NAMA_INDIKATOR[k] ?? k}</span>
                      <span className={`w-28 shrink-0 text-right ${unggul === "A" ? "text-sky-300" : "text-slate-400"}`}>
                        {isiIndikator(k, a)}
                      </span>
                      <span className={`w-28 shrink-0 text-right ${unggul === "B" ? "text-orange-300" : "text-slate-400"}`}>
                        {isiIndikator(k, b)}
                      </span>
                      <span className="w-5 shrink-0 text-center">
                        {unggul === "A" ? "▲" : unggul === "B" ? "◆" : ""}
                      </span>
                    </div>
                  );
                }),
              )}
            </div>

            <button
              onClick={kirim}
              disabled={memuat}
              className="mt-4 w-full rounded-lg bg-sky-600 py-2.5 text-sm font-semibold text-white hover:bg-sky-500 disabled:bg-slate-700 disabled:text-slate-400"
            >
              {memuat ? "Menyusun perbandingan..." : "Bandingkan dengan AI"}
            </button>

            {galatLokal && (
              <div className="mt-2 rounded bg-red-900/60 p-2 text-xs text-red-100">
                {galat}{" "}
                <button onClick={kirim} className="underline">
                  Coba lagi
                </button>
              </div>
            )}

            {hasilBanding && (
              <div className="mt-3 space-y-2 text-xs">
                <div className="text-[10px] font-semibold uppercase tracking-wide text-sky-400">Kelebihan kawasan A</div>
                {hasilBanding.unggulA?.map((s) => (
                  <div key={s} className="rounded bg-sky-900/40 px-2 py-1 text-sky-200">▲ {s}</div>
                ))}
                <div className="pt-1 text-[10px] font-semibold uppercase tracking-wide text-orange-400">Kelebihan kawasan B</div>
                {hasilBanding.unggulB?.map((s) => (
                  <div key={s} className="rounded bg-orange-900/40 px-2 py-1 text-orange-200">◆ {s}</div>
                ))}
                <div className="pt-1 text-xs italic text-slate-300">{hasilBanding.simpulan}</div>
                {hasilBanding.cocokUntuk && (
                  <div className="text-[11px] text-slate-400">
                    Cocok untuk: A — {hasilBanding.cocokUntuk.A} | B — {hasilBanding.cocokUntuk.B}
                  </div>
                )}
                {hasilBanding.sumber === "fallback" && (
                  <div className="rounded bg-yellow-700 px-2 py-1 text-[10px] font-semibold text-white">
                    Disusun tanpa AI. Layanan bahasa tidak merespons.
                  </div>
                )}
                <div className="text-[10px] text-slate-600">Disusun AI dari angka pada panel ini.</div>
              </div>
            )}
          </>
        )}

        <div className="mt-3 border-t border-white/10 pt-2 text-[10px] text-slate-600">
          Data {versi ?? "stub"}. Angka acak, bukan hasil analisis.
        </div>
      </div>
    </div>
  );
}
