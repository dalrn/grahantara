import { useEffect, useState } from "react";

import { KELOMPOK_INDIKATOR, NAMA_INDIKATOR } from "../lib/kamus";
import { formatNilai, formatSkor } from "../lib/format";
import { BOBOT_DEFAULT } from "../config";
import BarisIndikator, { Lencana } from "./BarisIndikator";

// MapLibre menyerikan array/objek bersarang jadi string JSON; pulihkan.
function daftarKosong(x) {
  if (Array.isArray(x)) return new Set(x);
  if (typeof x === "string") {
    try {
      return new Set(JSON.parse(x));
    } catch {
      return new Set();
    }
  }
  return new Set();
}

function BlokInsight({ heksagon, bobotKini, narasi, padaJelaskan }) {
  const [memuat, setMemuat] = useState(false);
  const [galat, setGalat] = useState(null);

  useEffect(() => {
    setMemuat(false);
    setGalat(null);
  }, [heksagon.h3_index]);

  const kirim = async () => {
    setMemuat(true);
    setGalat(null);
    try {
      const bobot = bobotKini
        ? Object.fromEntries(Object.entries(bobotKini).map(([k, v]) => [k, Math.round(v * 100)]))
        : Object.fromEntries(Object.entries(BOBOT_DEFAULT).map(([k, v]) => [k, Math.round(v * 100)]));
      const indikator = [];
      for (const kelompok of KELOMPOK_INDIKATOR) {
        for (const k of kelompok.kunci) {
          const ik = heksagon.indikator?.[k];
          indikator.push({
            nama: NAMA_INDIKATOR[k] ?? k,
            nilai: ik && ik.nilai !== null && ik.nilai !== undefined
              ? formatNilai(ik.nilai, ik.satuan)
              : null,
            persentil: ik && typeof ik.persentil === "number" ? ik.persentil : null,
            sumber: ik?.sumber ?? null,
          });
        }
      }
      const r = await fetch("/api/explain-score", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          h3_index: heksagon.h3_index,
          skor: heksagon.skor,
          subskor: heksagon.subskor,
          dimensiKosong: heksagon.dimensi_kosong ?? [],
          bobot,
          indikator,
        }),
      });
      if (!r.ok) {
        const j = await r.json().catch(() => null);
        setGalat(j?.galat ?? `Server menjawab ${r.status}.`);
        return;
      }
      const hasil = await r.json();
      padaJelaskan(heksagon.h3_index, hasil);
    } catch {
      setGalat("Tidak dapat menghubungi server. Coba lagi.");
    } finally {
      setMemuat(false);
    }
  };

  return (
    <div className="border-t border-white/10 py-3">
      <div className="text-sm font-semibold text-white">Insight</div>
      {!narasi && !memuat && !galat && (
        <button
          onClick={kirim}
          className="mt-2 w-full rounded bg-sky-600 px-2 py-1.5 text-xs font-semibold text-white hover:bg-sky-500"
        >
          Jelaskan kawasan ini
        </button>
      )}
      {memuat && <div className="mt-2 text-xs text-slate-400">Menyusun penjelasan...</div>}
      {galat && (
        <div className="mt-2 rounded bg-red-900/60 p-2 text-xs text-red-100">
          {galat}{" "}
          <button onClick={kirim} className="underline">
            Coba lagi
          </button>
        </div>
      )}
      {narasi && (
        <div className="mt-2 space-y-1.5 text-xs">
          {narasi.kekuatan?.map((k) => (
            <div key={k} className="flex gap-1.5 text-emerald-300">
              <span className="shrink-0 font-bold">▲</span>
              <span>{k}</span>
            </div>
          ))}
          {narasi.kelemahan?.map((k) => (
            <div key={k} className="flex gap-1.5 text-yellow-300">
              <span className="shrink-0 font-bold">▼</span>
              <span>{k}</span>
            </div>
          ))}
          <div className="pt-1 italic text-slate-300">{narasi.ringkas}</div>
          {narasi.sumber === "fallback" && (
            <div className="rounded bg-yellow-700 px-2 py-1 text-[10px] font-semibold text-white">
              Disusun tanpa AI. Layanan bahasa tidak merespons.
            </div>
          )}
          <div className="text-[10px] text-slate-600">
            Disusun AI dari angka pada panel ini.
          </div>
        </div>
      )}
    </div>
  );
}

function BlokDimensi({ kelompok, subskor, indikator, bobot, kosong, terbuka, onToggle }) {
  const nilai = subskor?.[kelompok.dimensi];
  const kosongDimensi = kosong.has(kelompok.dimensi);
  const w = bobot ? bobot[kelompok.dimensi] : null;
  // Bobot yang tertera dinormalisasi ulang atas dimensi yang ADA saja,
  // mengikuti aturan mesinSkor (dimensi kosong dikeluarkan dari skor).
  let wTampil = w;
  if (w !== null && kosong.size > 0) {
    const totalAda = KELOMPOK_INDIKATOR.reduce(
      (t, k) => (kosong.has(k.dimensi) ? t : t + (bobot[k.dimensi] ?? 0)),
      0,
    );
    if (totalAda > 0) wTampil = w / totalAda;
  }
  return (
    <div className="border-t border-white/10 py-3">
      <button
        onClick={onToggle}
        className="flex w-full items-center justify-between text-left"
        aria-expanded={terbuka}
      >
        <span className="text-sm font-semibold text-white">
          {kelompok.label}
          {wTampil !== null && !kosongDimensi && (
            <span className="ml-1 text-[10px] font-normal text-slate-500">
              (bobot {(wTampil * 100).toLocaleString("id-ID", { maximumFractionDigits: 1 })}%)
            </span>
          )}
        </span>
        <span className="flex items-center gap-2">
          {kosongDimensi ? (
            <Lencana teks="Tidak tersedia" warna="bg-slate-700 text-slate-300" />
          ) : (
            <span className="text-sm font-bold text-emerald-400">{formatSkor(nilai)}</span>
          )}
          <span className="text-xs text-slate-400">{terbuka ? "▴" : "▾"}</span>
        </span>
      </button>
      {kosongDimensi ? (
        <div className="mt-1 text-[10px] italic text-slate-500">
          {kelompok.label} tidak punya data dan dikeluarkan dari perhitungan skor
        </div>
      ) : (
        <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full rounded-full bg-emerald-400"
            style={{ width: `${Math.max(0, Math.min(100, nilai ?? 0))}%` }}
          />
        </div>
      )}
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

export default function PanelKawasan({
  heksagon, versi, skorKini, bobotKini, onTutup, narasiCache, simpanNarasi,
}) {
  const [terbuka, setTerbuka] = useState(
    () => new Set(KELOMPOK_INDIKATOR.map((k) => k.dimensi)),
  );

  if (!heksagon) return null;

  const kosong = daftarKosong(heksagon.dimensi_kosong);
  const KATA_DIMENSI = ["", "Satu", "Dua", "Tiga", "Empat"];
  const catatanKosong =
    kosong.size > 0
      ? `${KATA_DIMENSI[kosong.size] ?? kosong.size} dimensi tidak punya data dan dikeluarkan dari perhitungan. Bobotnya dibagi ke dimensi lain.`
      : null;

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
    <div className="absolute inset-x-0 bottom-0 z-20 flex h-[70dvh] flex-col rounded-t-2xl bg-slate-900/95 text-white shadow-2xl backdrop-blur-sm md:inset-x-auto md:inset-y-0 md:right-0 md:h-full md:w-[380px] md:rounded-none">
      <div className="mx-auto mt-1.5 h-1 w-10 shrink-0 rounded-full bg-white/25 md:hidden" />
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
        {catatanKosong && (
          <div className="mt-1 rounded bg-slate-800 px-2 py-1 text-[10px] text-slate-300">
            {catatanKosong}
          </div>
        )}

        <BlokInsight
          heksagon={heksagon}
          bobotKini={bobotKini}
          narasi={narasiCache?.[heksagon.h3_index]}
          padaJelaskan={(h3, hasil) => simpanNarasi(h3, hasil)}
        />

        <div>
          {KELOMPOK_INDIKATOR.map((kelompok) => (
            <BlokDimensi
              key={kelompok.dimensi}
              kelompok={kelompok}
              subskor={heksagon.subskor}
              indikator={heksagon.indikator}
              bobot={bobotKini}
              kosong={kosong}
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
