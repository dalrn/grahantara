import { WARNA_KELAS } from "../config";

import { DEFINISI_LAPISAN } from "../lib/lapisan";

export default function PanelLapisan({
  lapisanAktif,
  onToggle,
  jumlahLapisan,
}) {
  return (
    <div className="layer-panel">
      <div>
        <div className="space-y-1.5">
          {DEFINISI_LAPISAN.map((def) => {
            const aktif = lapisanAktif[def.id] ?? false;
            const jumlah = jumlahLapisan[def.id];
            return (
              <label
                key={def.id}
                className={`layer-toggle ${aktif ? "is-active" : ""} flex items-center gap-2 text-xs ${
                  def.tersedia ? "cursor-pointer" : "cursor-not-allowed"
                }`}
              >
                <input
                  type="checkbox"
                  disabled={!def.tersedia}
                  checked={def.tersedia && aktif}
                  onChange={() => onToggle(def.id)}
                  className="accent-emerald-400"
                />
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={
                    def.id === "kos"
                      ? {
                          background: `linear-gradient(90deg, ${WARNA_KELAS.join(",")})`,
                        }
                      : { backgroundColor: def.warna }
                  }
                />
                <span
                  className={def.tersedia ? "text-slate-200" : "text-slate-600"}
                >
                  {def.label}
                  {!def.tersedia && " - data belum tersedia"}
                </span>
                {jumlah !== undefined && (
                  <span className="ml-auto text-slate-500">{jumlah}</span>
                )}
              </label>
            );
          })}
          {lapisanAktif.kos && (
            <p className="pt-2 text-xs text-slate-400">
              Pin rumah menandai kos; warnanya mengikuti skor kawasan. Ctrl+klik
              untuk membandingkan. Di HP, tekan lama pin kos atau gunakan tombol
              di detail kos.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
