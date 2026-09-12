import { useEffect, useState } from "react";

import PanelBobot from "./PanelBobot";
import PanelLapisan from "./PanelLapisan";
import Legenda from "./Legenda";

// Satu sidebar bertab menggantikan tiga panel melayang yang dulu saling
// menimpa di sudut yang sama. Hanya satu isi tampil sekaligus, jadi tinggi
// yang dipakai tetap terkendali di layar laptop.
// Legenda lebih dulu, dan jadi tab yang terbuka saat peta dibuka: yang
// pertama dibutuhkan pembaca adalah arti warna heksagon, bukan penyetelan
// bobot.
const TAB = [
  { id: "legenda", label: "Legenda" },
  { id: "bobot", label: "Prioritas" },
  { id: "lapisan", label: "Lapisan" },
];

export default function PanelKontrol({
  bobot,
  bobotBawaan,
  onBobotBerubah,
  onKembalikanBawaan,
  lapisanAktif,
  onToggleLapisan,
  jumlahLapisan,
  labels,
  // Saat rute terbuka, bobot dan legenda disembunyikan; Lapisan tetap
  // terjangkau supaya lapisan gerbang bisa dinyalakan tanpa menutup rute.
  modeRute = false,
}) {
  const [aktif, setAktif] = useState("legenda");
  const [terbuka, setTerbuka] = useState(() =>
    window.matchMedia("(min-width: 768px)").matches,
  );

  const tersedia = modeRute ? TAB.filter((t) => t.id === "lapisan") : TAB;

  useEffect(() => {
    // Tab yang sedang aktif bisa hilang saat masuk mode rute.
    if (!tersedia.some((t) => t.id === aktif)) setAktif(tersedia[0].id);
  }, [tersedia, aktif]);

  return (
    <div className="control-panel absolute left-2 top-14 z-20 w-64 overflow-hidden rounded-xl text-white md:left-4 md:top-3 md:w-72">
      <div className="flex items-center gap-1 px-1.5 pt-1.5">
        <div className="flex min-w-0 flex-1 gap-1" role="tablist">
          {tersedia.map((t) => (
            <button
              key={t.id}
              role="tab"
              aria-selected={aktif === t.id}
              onClick={() => {
                setAktif(t.id);
                setTerbuka(true);
              }}
              className={`control-tab flex-1 truncate rounded-lg px-2 py-1.5 text-xs font-semibold ${
                aktif === t.id && terbuka
                  ? "is-active"
                  : "text-slate-300 hover:text-white"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <button
          onClick={() => setTerbuka((v) => !v)}
          aria-expanded={terbuka}
          aria-label={terbuka ? "Sembunyikan panel" : "Tampilkan panel"}
          className="shrink-0 rounded px-2 py-1 text-xs text-slate-400 hover:text-white"
        >
          {terbuka ? "▴" : "▾"}
        </button>
      </div>

      {terbuka && (
        <div className="control-body max-h-[calc(100dvh-190px)] overflow-y-auto overscroll-contain px-3 pb-3 pt-2">
          {aktif === "bobot" && (
            <PanelBobot
              bobot={bobot}
              bobotBawaan={bobotBawaan}
              onBobotBerubah={onBobotBerubah}
              onKembalikanBawaan={onKembalikanBawaan}
            />
          )}
          {aktif === "lapisan" && (
            <PanelLapisan
              lapisanAktif={lapisanAktif}
              onToggle={onToggleLapisan}
              jumlahLapisan={jumlahLapisan}
            />
          )}
          {aktif === "legenda" && <Legenda labels={labels} />}
        </div>
      )}
    </div>
  );
}
