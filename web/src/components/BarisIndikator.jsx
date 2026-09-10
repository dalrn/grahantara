import { NAMA_INDIKATOR, LABEL_SUMBER } from "../lib/kamus";
import { formatNilai, formatPersentil } from "../lib/format";

export function Lencana({ teks, warna }) {
  return (
    <span
      className={`shrink-0 rounded px-1.5 py-0.5 text-xs font-medium ${warna}`}
    >
      {teks}
    </span>
  );
}

export default function BarisIndikator({ kunci, data }) {
  const nama = NAMA_INDIKATOR[kunci] ?? kunci;
  const tidakTersedia =
    !data || data.sumber === "tidak_tersedia" || data.nilai === null;
  const nilai = formatNilai(data?.nilai, data?.satuan);

  if (tidakTersedia) {
    return (
      <div className="py-1.5">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs text-slate-500">{nama}</span>
          <Lencana teks="Tidak tersedia" warna="bg-slate-700 text-slate-300" />
        </div>
        <div className="text-xs italic text-slate-500">tidak tersedia</div>
      </div>
    );
  }

  const persentil = data.persentil ?? null;
  const lencana =
    data.sumber === "model" ? (
      <Lencana teks="Estimasi" warna="bg-yellow-700/80 text-yellow-100" />
    ) : (
      <Lencana
        teks={LABEL_SUMBER[data.sumber] ?? data.sumber}
        warna="bg-slate-700/80 text-slate-300"
      />
    );

  return (
    <div className="py-1.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-slate-200">{nama}</span>
        {lencana}
      </div>
      <div className="mt-0.5 flex items-center justify-between gap-2">
        <span className="text-sm font-medium text-white">{nilai}</span>
        <span className="text-xs text-slate-400">
          {formatPersentil(persentil)}
        </span>
      </div>
      {typeof persentil === "number" && (
        <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full rounded-full bg-sky-400"
            style={{ width: `${Math.max(0, Math.min(100, persentil * 100))}%` }}
          />
        </div>
      )}
    </div>
  );
}
