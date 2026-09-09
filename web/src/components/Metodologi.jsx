import { useEffect, useState } from "react";

import { KELOMPOK_INDIKATOR, NAMA_INDIKATOR, LABEL_SUMBER } from "../lib/kamus";
import { BOBOT_DEFAULT } from "../config";

const URUTAN_INDIKATOR = [
  "C1_jarak_halte", "C2_rute_unik", "C3_keterjangkauan_kampus", "C4_jarak_krl",
  "A1_harga_kos", "A2_harga_makan",
  "M1_kepadatan_makan", "M2_keragaman", "M3_keramaian", "M4_layanan_harian",
  "W1_kerapatan_simpang", "W2_keteduhan", "W3_penerangan", "W4_banjir",
  "W5_tekanan_lalin", "W6_integritas_jalur",
];

export default function Metodologi({ onKembali, versi }) {
  const [data, setData] = useState(null);

  useEffect(() => {
    fetch("/data/hexagons.geojson")
      .then((r) => r.json())
      .then((d) => setData(d))
      .catch(() => setData(null));
  }, []);

  const jumlah = data?.metadata?.jumlah ?? null;

  // indikator -> (satuan, sumber) dari data nyata; sumber per kolom = nilai unik di seluruh data
  const kolomIndikator = {};
  const pemakaianSumber = {};
  if (data) {
    const seenSatuan = {};
    const seenSumber = {};
    for (const k of URUTAN_INDIKATOR) seenSatuan[k] = null;
    for (const feat of data.features) {
      for (const k of URUTAN_INDIKATOR) {
        const ik = feat.properties.indikator?.[k];
        if (!ik) continue;
        if (seenSatuan[k] === null && ik.satuan !== null) seenSatuan[k] = ik.satuan;
        (seenSumber[k] ??= new Set()).add(ik.sumber);
      }
    }
    for (const k of URUTAN_INDIKATOR) {
      kolomIndikator[k] = {
        satuan: seenSatuan[k] ?? "",
        sumber: [...(seenSumber[k] ?? [])].sort().join(", "),
        sumberSet: seenSumber[k] ?? new Set(),
      };
    }
    const indikatorPerSumber = {};
    for (const k of URUTAN_INDIKATOR) {
      for (const s of kolomIndikator[k].sumberSet) {
        (indikatorPerSumber[s] ??= []).push(NAMA_INDIKATOR[k] ?? k);
      }
    }
    for (const [s, list] of Object.entries(indikatorPerSumber)) {
      pemakaianSumber[s] = list;
    }
  }
  const tersedia = {};
  if (data) {
    for (const k of URUTAN_INDIKATOR) {
      const v = data.features.some((f) => f.properties.indikator?.[k]?.nilai !== null);
      tersedia[k] = v;
    }
  }

  const labelDimensi = (kunci) =>
    KELOMPOK_INDIKATOR.find((k) => k.dimensi === kunci)?.label ?? kunci;

  const formatTanggal = (iso) => {
    if (typeof iso !== "string") return null;
    const t = new Date(iso);
    if (Number.isNaN(t.getTime())) return null;
    return t.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
  };

  const versiData = data?.metadata?.versi ?? versi;
  const dihitung = data?.metadata?.dihitung_pada ?? null;
  const stub = typeof versiData === "string" && versiData.startsWith("stub");

  return (
    <div className="flex h-full w-full flex-col overflow-y-auto bg-slate-950">
      <div className="mx-auto w-full max-w-[760px] px-4 py-6">
        <button
          onClick={onKembali}
          className="rounded bg-slate-900 px-3 py-1 text-xs text-slate-300 ring-1 ring-slate-700 hover:text-white"
        >
          â† Kembali ke peta
        </button>
        <h1 className="mt-4 text-3xl font-bold text-emerald-400">Metodologi</h1>
        {stub ? (
          <div className="mt-3 rounded bg-red-800 px-4 py-1.5 text-center text-xs font-semibold text-white sm:text-sm">
            DATA PALSU ({versiData ?? "stub-0.1"}) - angka pada peta ini acak, bukan hasil analisis
          </div>
        ) : versiData ? (
          <div className="mt-3 rounded bg-slate-800 px-4 py-1.5 text-center text-xs font-semibold text-slate-200 sm:text-sm">
            Data versi {versiData}
            {formatTanggal(dihitung) ? `, dihitung ${formatTanggal(dihitung)}.` : "."}
          </div>
        ) : null}

        <h2 className="mt-6 text-xl font-semibold text-white">Wilayah studi</h2>
        <p className="mt-1 text-sm text-slate-300">
          {jumlah !== null ? `${jumlah.toLocaleString("id-ID")} heksagon` : "â€”"} H3 resolusi 9,
          sabuk kampus Sleman, DIY.
        </p>

        <h2 className="mt-6 text-xl font-semibold text-white">Rumus skor</h2>
        <pre className="mt-2 overflow-x-auto rounded bg-slate-900 p-3 text-sm text-emerald-300">
          skor = 100 x PRODUK (subskor_d/100 + 0,01)^bobot_d
        </pre>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-300">
          <li>
            Kenapa rata-rata geometrik, bukan aritmetik: bila satu dimensi mendekati nol, skor
            total ikut jatuh. Kos dengan warung melimpah tapi tanpa akses transit tetap salah
            pilihan bagi mahasiswa tanpa kendaraan.
          </li>
          <li>
            Fungsi epsilon 0,01: mencegah satu dimensi nol membuat seluruh skor nol, dan
            menjaga fungsi tetap terdefinisi.
          </li>
          <li>
            Konsekuensi epsilon: skor terendah yang mungkin adalah 1, bukan 0. Rumus juga bisa
            menghasilkan 101 bila seluruh subskor 100, karena itu hasil dipotong di 100.
          </li>
        </ul>

        <h2 className="mt-6 text-xl font-semibold text-white">Bobot bawaan</h2>
        <div className="mt-2 overflow-x-auto">
          <table className="w-full text-sm text-slate-300">
            <thead>
              <tr className="border-b border-slate-700 text-left text-slate-400">
                <th className="py-1 pr-3">Dimensi</th>
                <th className="py-1">Bobot</th>
              </tr>
            </thead>
            <tbody>
              {KELOMPOK_INDIKATOR.map((k) => (
                <tr key={k.dimensi} className="border-b border-slate-800">
                  <td className="py-1 pr-3">{k.label}</td>
                  <td className="py-1">
                    {(BOBOT_DEFAULT[k.dimensi] * 100).toLocaleString("id-ID")}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-1 text-xs text-slate-500">
          Bobot bawaan diasumsikan dari dokumen proyek, berkas GeoJSON belum memuat
          metadata.bobot_default.
        </p>

        <h2 className="mt-6 text-xl font-semibold text-white">Enam belas indikator</h2>
        {KELOMPOK_INDIKATOR.map((kelompok) => (
          <div key={kelompok.dimensi} className="mt-4">
            <h3 className="text-sm font-semibold text-emerald-400">{kelompok.label}</h3>
            <div className="mt-1 overflow-x-auto">
              <table className="w-full text-sm text-slate-300">
                <thead>
                  <tr className="border-b border-slate-700 text-left text-slate-400">
                    <th className="py-1 pr-3">Indikator</th>
                    <th className="py-1 pr-3">Satuan</th>
                    <th className="py-1 pr-3">Sumber</th>
                    <th className="py-1">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {kelompok.kunci.map((k) => (
                    <tr key={k} className="border-b border-slate-800">
                      <td className="py-1 pr-3">{NAMA_INDIKATOR[k] ?? k}</td>
                      <td className="py-1 pr-3">{kolomIndikator[k]?.satuan ?? "â€¦"}</td>
                      <td className="py-1 pr-3">{kolomIndikator[k]?.sumber ?? "â€¦"}</td>
                      <td className="py-1">
                        {data && !tersedia[k] ? (
                          <span className="rounded bg-slate-700 px-1.5 py-0.5 text-[10px] text-slate-300">
                            tidak tersedia
                          </span>
                        ) : (
                          ""
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}

        <h2 className="mt-6 text-xl font-semibold text-white">Sumber data</h2>
        <div className="mt-2 overflow-x-auto">
          <table className="w-full text-sm text-slate-300">
            <thead>
              <tr className="border-b border-slate-700 text-left text-slate-400">
                <th className="py-1 pr-3">Sumber</th>
                <th className="py-1 pr-3">Dipakai indikator</th>
                <th className="py-1">Tahun</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(LABEL_SUMBER).map(([kunci, label]) => (
                <tr key={kunci} className="border-b border-slate-800">
                  <td className="py-1 pr-3">{label}</td>
                  <td className="py-1 pr-3">
                    {pemakaianSumber[kunci]?.length ? pemakaianSumber[kunci].join(", ") : "â€”"}
                  </td>
                  <td className="py-1 text-slate-500">menunggu konfirmasi pipeline</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <h2 className="mt-6 text-xl font-semibold text-white">Batasan</h2>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-300">
          {stub && <li>Angka pada versi ini adalah data stub, bukan hasil analisis.</li>}
          <li>
            Dua indikator, harga makan dan keramaian kawasan, belum tersedia dan dikeluarkan
            dari perhitungan.
          </li>
          <li>Sebagian harga sewa kos adalah estimasi model, bukan hasil survei.</li>
          <li>
            Penerangan kawasan memakai piksel VIIRS berukuran sekitar 464 meter, jadi hanya sah
            sebagai proksi tingkat kawasan, bukan tingkat jalan.
          </li>
          <li>Skor bersifat relatif terhadap wilayah studi, bukan nilai mutlak.</li>
        </ul>

        <h2 className="mt-6 text-xl font-semibold text-white">Peran AI</h2>
        <p className="mt-2 text-sm text-slate-300">
          <b>AI-1</b> menerjemahkan kalimat bebas jadi bobot. <b>AI-2</b> menyusun narasi dari
          angka yang sudah tampil di panel. Model bahasa tidak menghitung skor dan tidak
          menerima data mentah. Masukannya selalu angka hasil analisis yang sudah jadi.
        </p>
      </div>
    </div>
  );
}
