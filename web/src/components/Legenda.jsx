import { WARNA_KELAS } from "../config";
export default function Legenda({ labels }) {
  return (
    <div className="legend-panel">
      <div
        className="flex h-2 overflow-hidden rounded-full"
        aria-hidden="true"
      >
        {WARNA_KELAS.map((color) => (
          <span key={color} style={{ background: color }} className="flex-1" />
        ))}
      </div>
      <div>
        <div className="mt-3 space-y-2">
          {labels ? (
            labels.map((label, i) => (
              <div
                key={i}
                className="flex items-center justify-between gap-5 text-xs"
              >
                <span className="flex items-center gap-2">
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ background: WARNA_KELAS[i] }}
                  />
                  {label}
                </span>
                <span className="text-slate-400">
                  {["Rendah", "", "Menengah", "", "Tinggi"][i]}
                </span>
              </div>
            ))
          ) : (
            <p className="animate-pulse text-xs text-slate-400">
              Memuat rentang skor...
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
