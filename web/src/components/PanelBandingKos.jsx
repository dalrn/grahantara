import { useState } from "react";

import { PanelMotion } from "./Motion";
import { formatCoordinates, formatSkor } from "../lib/format";
import { warnaTeksSkor } from "../lib/kelas";
import { bandingColors } from "../design";

const empty = "Tidak tersedia";
const money = (value) =>
  Number.isFinite(value)
    ? `Rp ${value.toLocaleString("id-ID")} / bulan`
    : empty;
const distance = (value) =>
  Number.isFinite(value) ? `${value.toLocaleString("id-ID")} m` : empty;
const priceSource = (kos) =>
  kos?.sumber_harga === "model" ? "Estimasi" : kos?.sumber_harga || empty;

// Nilai enum dari basis data. Tanpa peta ini, "ruas_terkait" bocor apa adanya
// ke layar, dirapikan tanda bacanya saja tetap tidak menjelaskan artinya.
const PRESISI = {
  nama_kos: "Tepat di titik kos",
  pusat_kawasan: "Perkiraan, dipusatkan ke kawasan",
  manual: "Ditandai manual saat survei",
  ruas_terkait: "Perkiraan, mengikuti ruas jalan terdekat",
};

// Label band dari legenda skor, supaya angka tidak tampil telanjang.
function bandSkor(skor, ambang) {
  if (!Number.isFinite(skor)) return null;
  const batas = ambang ?? [20, 40, 60, 80];
  const i = batas.filter((t) => skor >= t).length;
  return ["Rendah", "Rendah", "Menengah", "Tinggi", "Tinggi"][i];
}

export default function PanelBandingKos({
  pilihan,
  scores,
  ambangSkor,
  onClose,
  onReplace,
}) {
  const { a, b } = pilihan;
  const complete = Boolean(a && b);
  const [detailTerbuka, setDetailTerbuka] = useState(false);

  const selisihHarga =
    complete &&
    Number.isFinite(a.harga_median) &&
    Number.isFinite(b.harga_median)
      ? a.harga_median - b.harga_median
      : null;
  const selisihSkor =
    complete && Number.isFinite(scores.a) && Number.isFinite(scores.b)
      ? scores.a - scores.b
      : null;

  // Vonis dihitung langsung dari data, bukan disembunyikan di bawah tabel.
  // Harga dan kondisi kawasan bisa menunjuk kos yang berbeda; itu justru
  // informasi yang paling berguna, jadi disampaikan apa adanya.
  const vonis = (() => {
    if (!complete) return null;
    const murah =
      selisihHarga === null || selisihHarga === 0
        ? null
        : selisihHarga < 0
          ? "A"
          : "B";
    const kawasan =
      selisihSkor === null || Math.abs(selisihSkor) < 0.05
        ? null
        : selisihSkor > 0
          ? "A"
          : "B";
    if (murah && kawasan && murah === kawasan) {
      return `Kos ${murah} lebih unggul di dua-duanya: harganya lebih murah dan kondisi kawasannya lebih baik.`;
    }
    if (murah && kawasan) {
      return `Kos ${murah} lebih murah, tapi kawasan di sekitar kos ${kawasan} lebih sesuai dengan prioritasmu.`;
    }
    if (murah) return `Kos ${murah} lebih murah; kondisi kawasannya setara.`;
    if (kawasan)
      return `Kawasan di sekitar kos ${kawasan} lebih sesuai; harganya setara.`;
    return "Kedua kos hampir setara, baik harga maupun kondisi kawasannya.";
  })();

  const alasan = complete
    ? [
        selisihHarga !== null && selisihHarga !== 0
          ? `Kos ${selisihHarga < 0 ? "A" : "B"} lebih murah Rp ${Math.abs(
              selisihHarga,
            ).toLocaleString("id-ID")} per bulan.`
          : null,
        selisihSkor !== null && Math.abs(selisihSkor) >= 0.05
          ? `Kawasan kos ${selisihSkor > 0 ? "A" : "B"} unggul ${formatSkor(
              Math.abs(selisihSkor),
            )} poin dengan bobot prioritasmu.`
          : null,
        Number.isFinite(a?.jarak_halte_m) && Number.isFinite(b?.jarak_halte_m)
          ? (() => {
              const d = a.jarak_halte_m - b.jarak_halte_m;
              if (Math.abs(d) < 50) return "Jarak ke halte keduanya mirip.";
              return `Kos ${d < 0 ? "A" : "B"} lebih dekat halte, selisih ${Math.abs(
                d,
              ).toLocaleString("id-ID")} m.`;
            })()
          : null,
      ].filter(Boolean)
    : [];

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
          "Ketelitian lokasi",
          PRESISI[a.presisi_koordinat] ?? empty,
          PRESISI[b.presisi_koordinat] ?? empty,
        ],
        [
          "Koordinat",
          formatCoordinates(a.coordinates),
          formatCoordinates(b.coordinates),
        ],
      ]
    : [];

  const Kartu = ({ slot }) => {
    const kos = pilihan[slot];
    const huruf = slot.toUpperCase();
    const warna = slot === "a" ? bandingColors.a : bandingColors.b;
    const skor = scores[slot];
    const band = bandSkor(skor, ambangSkor);
    return (
      <div
        className="kartu-banding min-w-0"
        data-huruf={huruf}
        style={{
          "--warna-banding": warna,
          background: `color-mix(in srgb, ${warna} 7%, #111c2e)`,
          borderColor: warna,
        }}
      >
        <div className="flex items-center justify-between gap-2">
          <span className="kartu-banding-judul" style={{ color: warna }}>
            Kos {huruf}
          </span>
          {kos && (
            <button
              onClick={() => onReplace(slot)}
              aria-label={`Ganti kos ${huruf}`}
              className="text-xs text-slate-300 underline hover:text-white"
            >
              Ganti
            </button>
          )}
        </div>
        <p className="mt-1 break-words text-sm font-semibold">
          {kos?.nama || "Belum dipilih"}
        </p>
        {kos && (
          <>
            <div className="mt-1 text-sm font-semibold text-slate-200">
              {money(kos.harga_median)}
            </div>
            <div
              className="text-lg font-bold"
              style={{ color: warnaTeksSkor(skor, ambangSkor) ?? undefined }}
            >
              {Number.isFinite(skor) ? formatSkor(skor) : "-"}
              <span className="ml-1 text-xs font-normal text-slate-400">
                skor kawasan
              </span>
            </div>
            {band && <div className="text-xs text-slate-400">{band}</div>}
          </>
        )}
      </div>
    );
  };

  return (
    <PanelMotion
      className={`kos-comparison absolute inset-x-2 bottom-2 z-30 overflow-y-auto rounded-2xl border border-slate-700 bg-slate-900/95 p-4 text-slate-100 shadow-xl md:backdrop-blur-md md:inset-x-auto md:bottom-4 md:right-4 ${complete ? "max-h-[65dvh] md:w-[510px]" : "md:w-96"}`}
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

      {!complete && (
        <p className="mb-3 text-xs text-slate-300">
          Pilih pin kos {a ? "B" : "A"} di peta untuk melengkapi perbandingan.
        </p>
      )}

      {/* Vonis dulu, tabel di balik tombol, sama dengan panel kawasan. */}
      {complete && vonis && (
        <div className="vonis mb-3">
          <p className="vonis-kalimat">{vonis}</p>
        </div>
      )}

      <div className="grid grid-cols-2 gap-2">
        <Kartu slot="a" />
        <Kartu slot="b" />
      </div>

      {complete && (
        <>
          {alasan.length > 0 && (
            <ul className="alasan-daftar">
              {alasan.map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ul>
          )}

          {(a.sumber_harga === "model" || b.sumber_harga === "model") && (
            <p className="mt-2 text-xs text-yellow-300">
              Salah satu harga adalah estimasi, bukan hasil survei langsung.
            </p>
          )}

          <button
            type="button"
            className="tombol-detail"
            aria-expanded={detailTerbuka}
            onClick={() => setDetailTerbuka((v) => !v)}
          >
            {detailTerbuka ? "Sembunyikan detail" : "Lihat detail"}
          </button>

          {detailTerbuka && (
            <table className="mt-3 w-full table-fixed text-left text-xs">
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
          )}

          <p className="mt-3 text-xs text-slate-300">
            Skor kawasan mengikuti bobot prioritasmu dan menggambarkan kondisi
            sekitar, bukan kualitas bangunan kos. Data yang belum tercatat
            ditampilkan sebagai &ldquo;Tidak tersedia&rdquo;.
          </p>
        </>
      )}
    </PanelMotion>
  );
}
