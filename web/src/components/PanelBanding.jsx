import { PanelMotion } from "./Motion";

import { KELOMPOK_INDIKATOR, NAMA_INDIKATOR } from "../lib/kamus";
import { formatNilai, formatSkor, formatCoordinates } from "../lib/format";

const WARNA_A = "#38bdf8";
const WARNA_B = "#f97316";

const fmtAngka = (v) =>
  typeof v === "number"
    ? v.toLocaleString("id-ID", {
        minimumFractionDigits: 1,
        maximumFractionDigits: 1,
      })
    : "-";

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

function formatTanggal(iso) {
  if (typeof iso !== "string") return null;
  const t = new Date(iso);
  if (Number.isNaN(t.getTime())) return null;
  return t.toLocaleDateString("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

export default function PanelBanding({
  pilihan,
  skorKini,
  versi,
  dihitungPada,
  onTutup,
  onGanti,
  hasilBanding,
  galat,
  padaBanding,
}) {
  const a = pilihan.a;
  const b = pilihan.b;

  const memuat = hasilBanding === "memuat";

  const kosongA = daftarKosong(a?.dimensi_kosong);
  const kosongB = daftarKosong(b?.dimensi_kosong);

  const kirim = () => {
    if (!a || !b || memuat) return;
    padaBanding();
  };

  const dimUnggul = (k, dX, dY) => {
    const ix = dX?.indikator?.[k];
    const iy = dY?.indikator?.[k];
    const takTersedia = (i) =>
      !i || i.sumber === "tidak_tersedia" || i.nilai === null;
    if (takTersedia(ix) || takTersedia(iy)) return null;
    if (Number.isFinite(ix.persentil) && Number.isFinite(iy.persentil)) {
      if (ix.persentil > iy.persentil) return "A";
      if (iy.persentil > ix.persentil) return "B";
    }
    return null;
  };

  const Kartu = ({ data, warna, label, skor, ganti }) => (
    <div
      className="min-w-0 flex-1 rounded-lg bg-slate-800/70 p-3"
      style={{ borderTop: `3px solid ${warna}` }}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold" style={{ color: warna }}>
          Kawasan {label}
        </span>
        <button
          onClick={ganti}
          className="text-xs text-slate-400 underline hover:text-white"
        >
          ganti
        </button>
      </div>
      <div className="font-mono text-xs text-slate-400">
        {formatCoordinates(data?.coordinates)}
      </div>
      <div className="text-2xl font-bold" style={{ color: warna }}>
        {skor !== null && skor !== undefined ? formatSkor(skor) : "—"}
      </div>
    </div>
  );

  if (!a || !b) {
    // Bar kompak: jangan menutupi peta saat satu slot masih kosong.
    return (
      <PanelMotion className="comparison-prompt absolute inset-x-2 bottom-2 z-20 rounded-xl bg-slate-900/95 px-3 py-2 text-white shadow-xl backdrop-blur-sm md:inset-x-auto md:bottom-4 md:right-4 md:w-80">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-semibold text-slate-300">
            {a
              ? "Bandingkan kawasan — klik kawasan B di peta"
              : "Bandingkan kawasan — klik dua heksagon di peta"}
          </span>
          <button
            onClick={onTutup}
            className="shrink-0 text-slate-400 hover:text-white"
            aria-label="Tutup panel banding"
          >
            ✕
          </button>
        </div>
        {a && (
          <div className="mt-1 flex items-center gap-2 text-xs">
            <span
              className="h-2 w-2 rounded-full"
              style={{ backgroundColor: WARNA_A }}
            />
            <span className="font-mono text-slate-400">
              {formatCoordinates(a.coordinates)}
            </span>
            <span className="ml-auto font-bold text-sky-300">
              {skorKini?.a !== null && skorKini?.a !== undefined
                ? formatSkor(skorKini.a)
                : "—"}
            </span>
          </div>
        )}
      </PanelMotion>
    );
  }

  const isiIndikator = (k, dX) => {
    const ik = dX?.indikator?.[k];
    if (!ik || ik.sumber === "tidak_tersedia" || ik.nilai === null)
      return "tidak tersedia";
    const teks = formatNilai(ik.nilai, ik.satuan) ?? "tidak tersedia";
    if (ik.sumber === "model") return `${teks} (estimasi)`;
    return teks;
  };

  return (
    <PanelMotion className="detail-panel absolute inset-x-0 bottom-0 z-20 flex h-[80dvh] flex-col rounded-t-2xl bg-slate-900/95 text-white shadow-2xl backdrop-blur-sm md:inset-x-auto md:inset-y-0 md:right-0 md:h-full md:w-[460px] md:rounded-none">
      <div className="mx-auto mt-1.5 h-1 w-10 shrink-0 rounded-full bg-white/25 md:hidden" />
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
        <span className="text-sm font-semibold">Bandingkan kawasan</span>
        <button
          onClick={onTutup}
          className="text-slate-400 hover:text-white"
          aria-label="Tutup panel banding"
        >
          ✕
        </button>
      </div>
      <div className="flex-1 overflow-y-auto px-4 pb-4">
        <div className="flex gap-2">
          <Kartu
            data={a}
            warna={WARNA_A}
            label="A"
            skor={skorKini?.a}
            ganti={() => onGanti("a")}
          />
          <Kartu
            data={b}
            warna={WARNA_B}
            label="B"
            skor={skorKini?.b}
            ganti={() => onGanti("b")}
          />
        </div>

        {a && b && (
          <>
            <div className="compare-header">
              <span>Subskor dimensi</span>
              <span>Kawasan A</span>
              <span>Kawasan B</span>
            </div>
            <div className="mt-1 overflow-hidden rounded border border-white/10">
              {KELOMPOK_INDIKATOR.map((kel) => {
                const vA = a.subskor?.[kel.dimensi];
                const vB = b.subskor?.[kel.dimensi];
                const kA = kosongA.has(kel.dimensi) || !Number.isFinite(vA);
                const kB = kosongB.has(kel.dimensi) || !Number.isFinite(vB);
                const takSah = kA || kB;
                const unggul = takSah
                  ? null
                  : vA > vB
                    ? "A"
                    : vB > vA
                      ? "B"
                      : null;
                const isiSel = (v, kosong) =>
                  kosong ? (
                    <span className="italic text-slate-500">
                      tidak tersedia
                    </span>
                  ) : (
                    fmtAngka(v)
                  );
                return (
                  <div
                    key={kel.dimensi}
                    className="compare-row"
                    style={{
                      borderLeft: `3px solid ${unggul === "A" ? WARNA_A : unggul === "B" ? WARNA_B : "transparent"}`,
                    }}
                  >
                    <span className="w-36 shrink-0 text-slate-300">
                      {kel.label}
                    </span>
                    <span className="w-16 text-right text-sky-300">
                      {isiSel(vA, kA)}
                    </span>
                    <span className="w-16 text-right text-orange-300">
                      {isiSel(vB, kB)}
                    </span>
                    <span className="w-5 text-center text-xs">
                      {unggul === "A" ? "▲" : unggul === "B" ? "◆" : ""}
                    </span>
                  </div>
                );
              })}
            </div>

            <div className="mt-4 text-xs font-semibold text-slate-300">
              Indikator
            </div>
            <div className="mt-1 overflow-hidden rounded border border-white/10">
              {KELOMPOK_INDIKATOR.flatMap((kel) =>
                kel.kunci.map((k) => {
                  const unggul = dimUnggul(k, a, b);
                  return (
                    <div key={k} className="compare-row indicator-row">
                      <span className="flex-1 text-slate-300">
                        {NAMA_INDIKATOR[k] ?? k}
                      </span>
                      <span
                        className={`w-28 shrink-0 text-right ${unggul === "A" ? "text-sky-300" : "text-slate-400"}`}
                      >
                        {isiIndikator(k, a)}
                      </span>
                      <span
                        className={`w-28 shrink-0 text-right ${unggul === "B" ? "text-orange-300" : "text-slate-400"}`}
                      >
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

            {galat && (
              <div className="mt-2 rounded bg-red-900/60 p-2 text-xs text-red-100">
                {galat}{" "}
                <button onClick={kirim} className="underline">
                  Coba lagi
                </button>
              </div>
            )}

            {hasilBanding && !memuat && (
              <div className="mt-3 space-y-2 text-xs">
                <div className="text-xs font-semibold uppercase tracking-wide text-sky-400">
                  Kelebihan kawasan A
                </div>
                {hasilBanding.unggulA?.map((s) => (
                  <div
                    key={s}
                    className="rounded bg-sky-900/40 px-2 py-1 text-sky-200"
                  >
                    ▲ {s}
                  </div>
                ))}
                <div className="pt-1 text-xs font-semibold uppercase tracking-wide text-orange-400">
                  Kelebihan kawasan B
                </div>
                {hasilBanding.unggulB?.map((s) => (
                  <div
                    key={s}
                    className="rounded bg-orange-900/40 px-2 py-1 text-orange-200"
                  >
                    ◆ {s}
                  </div>
                ))}
                <div className="pt-1 text-xs italic text-slate-300">
                  {hasilBanding.simpulan}
                </div>
                {hasilBanding.cocokUntuk && (
                  <div className="text-xs text-slate-400">
                    Cocok untuk: A — {hasilBanding.cocokUntuk.A} | B —{" "}
                    {hasilBanding.cocokUntuk.B}
                  </div>
                )}
                {hasilBanding.sumber === "fallback" && (
                  <div className="rounded bg-yellow-700 px-2 py-1 text-xs font-semibold text-white">
                    Disusun tanpa AI. Layanan bahasa tidak merespons.
                  </div>
                )}
                <div className="text-xs text-slate-500">
                  Disusun AI dari angka pada panel ini.
                </div>
              </div>
            )}
          </>
        )}

        <div className="mt-3 border-t border-white/10 pt-2 text-xs text-slate-500">
          {typeof versi === "string" && versi.startsWith("stub")
            ? `Data ${versi ?? "stub"}. Angka acak, bukan hasil analisis.`
            : versi
              ? `Data versi ${versi}${formatTanggal(dihitungPada) ? `, dihitung ${formatTanggal(dihitungPada)}.` : "."}`
              : ""}
        </div>
      </div>
    </PanelMotion>
  );
}
