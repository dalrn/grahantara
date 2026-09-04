const DIMENSI = [
  ["connectivity", "Konektivitas"],
  ["affordability", "Keterjangkauan"],
  ["amenity", "Amenitas"],
  ["walkability", "Kelayakan Jalan Kaki"],
];

const fmt = (v) => (typeof v === "number" ? v.toLocaleString("id-ID", { minimumFractionDigits: 1, maximumFractionDigits: 1 }) : "-");

export default function PanelRingkas({ heksagon, onTutup }) {
  if (!heksagon) return null;
  const sub = heksagon.subskor ?? {};
  return (
    <div className="absolute right-3 top-16 z-10 w-80 rounded-lg bg-slate-900/90 p-4 text-white shadow-xl backdrop-blur-sm">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="text-xs font-medium text-slate-400">Skor total</div>
          <div className="text-3xl font-bold text-emerald-400">{fmt(heksagon.skor)}</div>
        </div>
        <button
          onClick={onTutup}
          className="rounded p-1 text-slate-400 hover:bg-white/10 hover:text-white"
          aria-label="Tutup panel"
        >
          ✕
        </button>
      </div>
      <div className="mt-1 font-mono text-[10px] text-slate-500">{heksagon.h3_index}</div>
      <div className="mt-3 space-y-2">
        {DIMENSI.map(([kunci, nama]) => {
          const nilai = sub[kunci];
          return (
            <div key={kunci}>
              <div className="flex justify-between text-xs text-slate-300">
                <span>{nama}</span>
                <span className="font-semibold">{fmt(nilai)}</span>
              </div>
              <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-emerald-400"
                  style={{ width: `${Math.max(0, Math.min(100, nilai ?? 0))}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
