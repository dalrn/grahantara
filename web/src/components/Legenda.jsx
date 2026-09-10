import { useState } from "react";
import { WARNA_KELAS } from "../config";
import { Collapse } from "./Motion";
export default function Legenda({ labels }) {
  const [open, setOpen] = useState(
    () => window.matchMedia("(min-width: 768px)").matches,
  );
  return (
    <div className="legend-panel absolute bottom-16 left-2 z-10 p-3 text-white md:bottom-4 md:left-4 md:w-52">
      <button
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-4 text-xs font-semibold"
      >
        Skor kawasan <span className="text-slate-400">{open ? "−" : "+"}</span>
      </button>
      <div
        className="mt-3 flex h-2 overflow-hidden rounded-full"
        aria-hidden="true"
      >
        {WARNA_KELAS.map((color) => (
          <span key={color} style={{ background: color }} className="flex-1" />
        ))}
      </div>
      <Collapse open={open}>
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
              Memuat rentang skor…
            </p>
          )}
          <p className="border-t border-white/10 pt-2 text-xs leading-relaxed text-slate-400">
            Lima kelas relatif (kuintil). Warna kawasan dan pin kos menggunakan
            skala yang sama.
          </p>
        </div>
      </Collapse>
    </div>
  );
}
