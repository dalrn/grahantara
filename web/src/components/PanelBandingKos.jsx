import { PanelMotion } from "./Motion";
import { formatCoordinates, formatSkor } from "../lib/format";

const empty = "Tidak tersedia";
const money = (value) =>
  Number.isFinite(value)
    ? `Rp ${value.toLocaleString("id-ID")} / bulan`
    : empty;
const distance = (value) =>
  Number.isFinite(value) ? `${value.toLocaleString("id-ID")} m` : empty;
const priceSource = (kos) =>
  kos?.sumber_harga === "model" ? "Estimasi" : kos?.sumber_harga || empty;

export default function PanelBandingKos({
  pilihan,
  scores,
  onClose,
  onReplace,
}) {
  const { a, b } = pilihan;
  const complete = Boolean(a && b);
  const rows = complete
    ? [
        ["Harga per bulan", money(a.harga_median), money(b.harga_median)],
        ["Sumber harga", priceSource(a), priceSource(b)],
        ["Jenis kos", a.jenis || empty, b.jenis || empty],
        [
          "Jarak ke halte",
          distance(a.jarak_halte_m),
          distance(b.jarak_halte_m),
        ],
        [
          "Skor kawasan",
          Number.isFinite(scores.a) ? formatSkor(scores.a) : empty,
          Number.isFinite(scores.b) ? formatSkor(scores.b) : empty,
        ],
        [
          "Koordinat",
          formatCoordinates(a.coordinates),
          formatCoordinates(b.coordinates),
        ],
        [
          "Ketelitian lokasi",
          a.presisi_koordinat?.replaceAll("_", " ") || empty,
          b.presisi_koordinat?.replaceAll("_", " ") || empty,
        ],
      ]
    : [];
  const difference =
    complete &&
    Number.isFinite(a.harga_median) &&
    Number.isFinite(b.harga_median)
      ? Math.abs(a.harga_median - b.harga_median)
      : null;

  return (
    <PanelMotion
      className={`kos-comparison absolute inset-x-2 bottom-2 z-30 overflow-y-auto rounded-2xl border border-slate-700 bg-slate-900/95 p-4 text-slate-100 shadow-xl backdrop-blur-md md:inset-x-auto md:bottom-4 md:right-4 ${complete ? "max-h-[65dvh] md:w-[510px]" : "md:w-96"}`}
    >
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-bold">Bandingkan kos</h2>
        <button
          onClick={onClose}
          aria-label="Tutup perbandingan kos"
          className="rounded-lg px-3 py-2 text-slate-300 hover:bg-slate-800"
        >
          ✕
        </button>
      </div>
      <p className="mb-3 text-xs text-slate-300">
        {complete
          ? "Data kos dan kondisi kawasan di sekitarnya."
          : `Pilih pin kos ${a ? "B" : "A"} di peta untuk melengkapi perbandingan.`}
      </p>
      <div className="grid grid-cols-2 gap-2">
        {["a", "b"].map((slot) => {
          const kos = pilihan[slot];
          return (
            <div
              key={slot}
              className="min-w-0 rounded-xl border-t-4 bg-slate-800 p-3"
              style={{ borderColor: slot === "a" ? "#38bdf8" : "#f97316" }}
            >
              <div className="flex items-center justify-between gap-2 text-xs">
                <span className="font-bold">Kos {slot.toUpperCase()}</span>
                {kos && (
                  <button
                    onClick={() => onReplace(slot)}
                    aria-label={`Ganti kos ${slot.toUpperCase()}`}
                    className="py-1 text-slate-200 underline"
                  >
                    Ganti
                  </button>
                )}
              </div>
              <p className="mt-1 break-words text-sm font-semibold">
                {kos?.nama || "Belum dipilih"}
              </p>
            </div>
          );
        })}
      </div>
      {complete && (
        <>
          <table className="mt-4 w-full table-fixed text-left text-xs">
            <caption className="sr-only">
              Perbandingan data kos A dan kos B
            </caption>
            <thead>
              <tr className="text-slate-300">
                <th scope="col" className="w-[30%] py-2">
                  Aspek
                </th>
                <th scope="col">Kos A</th>
                <th scope="col">Kos B</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(([label, first, second]) => (
                <tr key={label} className="border-t border-slate-700">
                  <th
                    scope="row"
                    className="py-3 pr-2 align-top font-medium text-slate-300"
                  >
                    {label}
                  </th>
                  <td className="break-words py-3 pr-2 align-top">{first}</td>
                  <td className="break-words py-3 align-top">{second}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {difference !== null && (
            <p className="mt-2 rounded-lg bg-slate-800 p-3 text-sm">
              {difference === 0
                ? "Harga kedua kos sama."
                : `Kos ${a.harga_median < b.harga_median ? "A" : "B"} lebih murah Rp ${difference.toLocaleString("id-ID")} per bulan.`}
              {(a.sumber_harga === "model" || b.sumber_harga === "model") &&
                " Selisih menggunakan harga estimasi."}
            </p>
          )}
          <p className="mt-3 text-xs text-slate-300">
            Skor kawasan mengikuti bobot prioritas Anda dan menggambarkan
            kondisi sekitar, bukan kualitas bangunan kos. Data yang belum
            tercatat ditampilkan sebagai “Tidak tersedia”.
          </p>
        </>
      )}
    </PanelMotion>
  );
}
