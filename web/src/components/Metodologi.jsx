import { StorySection } from "./Motion";
import { useEffect, useState } from "react";

import { KELOMPOK_INDIKATOR, NAMA_INDIKATOR, LABEL_SUMBER } from "../lib/kamus";
import { BOBOT_DEFAULT } from "../config";

const URUTAN_INDIKATOR = [
  "C1_jarak_halte",
  "C2_rute_unik",
  "C3_keterjangkauan_kampus",
  "C4_jarak_krl",
  "A1_harga_kos",
  "A2_harga_makan",
  "M1_kepadatan_makan",
  "M2_keragaman",
  "M3_keramaian",
  "M4_layanan_harian",
  "W1_kerapatan_simpang",
  "W2_keteduhan",
  "W3_penerangan",
  "W4_banjir",
  "W5_tekanan_lalin",
  "W6_integritas_jalur",
];

const DIMENSI = ["connectivity", "affordability", "amenity", "walkability"];

// Korelasi peringkat Spearman nilai vs persentil. Indikator berpolaritas
// terbalik menghasilkan rho negatif (nilai kecil = persentil tinggi).
function rhoSpearman(xs, ys) {
  const peringkat = (a) => {
    const idx = a.map((v, i) => [v, i]).sort((p, q) => p[0] - q[0]);
    const r = new Array(a.length);
    let i = 0;
    while (i < idx.length) {
      let j = i;
      while (j + 1 < idx.length && idx[j + 1][0] === idx[i][0]) j++;
      const rata = (i + j) / 2 + 1;
      for (let k = i; k <= j; k++) r[idx[k][1]] = rata;
      i = j + 1;
    }
    return r;
  };
  const rx = peringkat(xs);
  const ry = peringkat(ys);
  const mx = rx.reduce((a, b) => a + b, 0) / rx.length;
  const my = ry.reduce((a, b) => a + b, 0) / ry.length;
  let atas = 0,
    bx = 0,
    by = 0;
  for (let i = 0; i < xs.length; i++) {
    atas += (rx[i] - mx) * (ry[i] - my);
    bx += (rx[i] - mx) ** 2;
    by += (ry[i] - my) ** 2;
  }
  return bx && by ? atas / Math.sqrt(bx * by) : 0;
}

function kelompokDimensi(kunci) {
  return KELOMPOK_INDIKATOR.find((k) => k.kunci.includes(kunci));
}

export default function Metodologi({ onKembali, versi }) {
  const [data, setData] = useState(null);
  const [kos, setKos] = useState(null);

  useEffect(() => {
    Promise.all([
      fetch("/data/hexagons.geojson").then((r) => r.json()),
      fetch("/data/kos.geojson").then((r) => r.json()),
    ])
      .then(([h, k]) => {
        setData(h);
        setKos(k);
      })
      .catch(() => setData(null));
  }, []);

  const formatTanggal = (iso) => {
    if (typeof iso !== "string") return null;
    const t = new Date(iso);
    if (Number.isNaN(t.getTime())) return null;
    return t.toLocaleDateString("id-ID", {
      day: "numeric",
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    });
  };

  const formatBilangan = (n) =>
    typeof n === "number" ? n.toLocaleString("id-ID") : "—";
  const formatPecahan = (n) =>
    typeof n === "number"
      ? `${n.toLocaleString("id-ID", { maximumFractionDigits: 1 })}%`
      : "—";

  const versiData = data?.metadata?.versi ?? versi;
  const dihitung = data?.metadata?.dihitung_pada ?? null;
  const stub = typeof versiData === "string" && versiData.startsWith("stub");
  const jumlah = data?.metadata?.jumlah ?? data?.features?.length ?? null;
  const bobotMeta = data?.metadata?.bobot_default ?? null;

  // --- cakupan per indikator: jumlah nilai non-null, satuan, sumber ---
  const indikator = {};
  if (data) {
    for (const k of URUTAN_INDIKATOR) {
      let punya = 0;
      let satuan = null;
      const sumber = new Set();
      for (const f of data.features) {
        const ik = f.properties.indikator?.[k];
        if (!ik) continue;
        if (ik.nilai !== null && ik.nilai !== undefined) {
          punya++;
          if (satuan === null && ik.satuan !== null) satuan = ik.satuan;
          if (ik.sumber) sumber.add(ik.sumber);
        }
      }
      indikator[k] = {
        punya,
        satuan,
        sumber: [...sumber].map((s) => LABEL_SUMBER[s] ?? s).join(", "),
        dimensi: kelompokDimensi(k)?.label ?? "",
      };
    }
  }

  // --- dimensi kosong (properties.dimensi_kosong) ---
  const kosongPerDimensi = {};
  let denganKosong = 0;
  if (data) {
    for (const d of DIMENSI) kosongPerDimensi[d] = 0;
    for (const f of data.features) {
      const k = f.properties.dimensi_kosong ?? [];
      if (k.length) denganKosong++;
      for (const d of k) if (d in kosongPerDimensi) kosongPerDimensi[d]++;
    }
  }
  const dimKosong = DIMENSI.filter((d) => kosongPerDimensi[d] > 0)
    .map(
      (d) =>
        `${KELOMPOK_INDIKATOR.find((x) => x.dimensi === d)?.label ?? d} (${formatBilangan(kosongPerDimensi[d])})`,
    )
    .join(", ");

  // --- polaritas: indikator yang rho-nya negatif kuat ---
  const polarTerbalik = [];
  if (data && jumlah) {
    for (const k of URUTAN_INDIKATOR) {
      const xs = [],
        ys = [];
      for (const f of data.features) {
        const ik = f.properties.indikator?.[k];
        if (
          ik &&
          typeof ik.nilai === "number" &&
          typeof ik.persentil === "number"
        ) {
          xs.push(ik.nilai);
          ys.push(ik.persentil);
        }
      }
      if (xs.length >= 10 && rhoSpearman(xs, ys) <= -0.5) {
        polarTerbalik.push(NAMA_INDIKATOR[k] ?? k);
      }
    }
  }

  // --- kos ---
  const kosData = kos?.features ?? [];
  const kosTotal = kosData.length;
  const sebarSumber = {};
  const sebarPresisi = {};
  let kosTanpaHarga = 0;
  for (const f of kosData) {
    const s = f.properties.sumber_harga;
    sebarSumber[s == null || s === "" ? "tanpa label" : s] =
      (sebarSumber[s == null || s === "" ? "tanpa label" : s] ?? 0) + 1;
    const p = f.properties.presisi_koordinat;
    sebarPresisi[p == null ? "(tanpa presisi)" : p] =
      (sebarPresisi[p == null ? "(tanpa presisi)" : p] ?? 0) + 1;
    if (f.properties.harga_median == null) kosTanpaHarga++;
  }
  const ARTIKEL_PRESISI = {
    ruas_terkait:
      "koordinat diambil dari ruas jalan terkait, bukan titik bangunannya",
    pusat_kawasan: "koordinat memakai titik pusat kawasan",
    manual: "koordinat diisi manual oleh tim",
    nama_kos:
      "koordinat dipulihkan dari nama kos di catatan survei, bukan direkam saat survei",
  };

  const indikatorPerSumber = {};
  if (data) {
    for (const k of URUTAN_INDIKATOR) {
      const iks = indikator[k].sumber;
      if (!iks) continue;
      for (const label of iks.split(", ")) {
        const kunci =
          Object.entries(LABEL_SUMBER).find(([, l]) => l === label)?.[0] ??
          label;
        (indikatorPerSumber[kunci] ??= []).push(NAMA_INDIKATOR[k] ?? k);
      }
    }
  }
  return (
    <div className="flex h-full w-full flex-col overflow-y-auto bg-slate-950">
      <div className="mx-auto w-full max-w-[760px] px-4 py-6">
        <button
          onClick={onKembali}
          className="rounded bg-slate-900 px-3 py-1 text-xs text-slate-300 ring-1 ring-slate-700 hover:text-white"
        >
          ← Kembali ke peta
        </button>
        <h1 className="mt-4 text-3xl font-bold text-emerald-400">
          Di balik setiap kawasan.
        </h1>
        <p className="mt-3 text-slate-400">
          Dari data lingkungan menjadi pilihan yang lebih bermakna.
        </p>
        {stub ? (
          <div className="mt-3 rounded bg-red-800 px-4 py-1.5 text-center text-xs font-semibold text-white sm:text-sm">
            DATA PALSU ({versiData ?? "stub-0.1"}) - angka pada peta ini acak,
            bukan hasil analisis
          </div>
        ) : versiData ? (
          <div className="mt-3 rounded bg-slate-800 px-4 py-1.5 text-center text-xs font-semibold text-slate-200 sm:text-sm">
            Data versi {versiData}
            {formatTanggal(dihitung)
              ? `, dihitung ${formatTanggal(dihitung)}.`
              : "."}
          </div>
        ) : null}

        <StorySection className="story-section">
          <h2 className="mt-6 text-xl font-semibold text-white">
            Wilayah studi
          </h2>
          <p className="mt-1 text-sm text-slate-300">
            {jumlah !== null ? `${formatBilangan(jumlah)} heksagon` : "—"} H3
            resolusi 9, sabuk kampus Sleman, DIY. Sebaran skor pada data ini:
            14,4–87,5.
          </p>
        </StorySection>
        <StorySection className="story-section">
          <h2 className="mt-6 text-xl font-semibold text-white">Rumus skor</h2>
          <pre className="mt-2 overflow-x-auto rounded bg-slate-900 p-3 text-sm text-emerald-300">
            {`D    = himpunan dimensi yang PUNYA data pada heksagon itu
W    = jumlah bobot dimensi di D
skor = 100 x PRODUK atas d di D dari (subskor_d/100 + 0,01)^(bobot_d / W)`}
          </pre>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-300">
            <li>
              <b>Kenapa rata-rata geometrik, bukan aritmetik.</b> Bila satu
              dimensi mendekati nol, skor total ikut jatuh. Kos dengan warung
              melimpah tapi tanpa akses transit tetap salah pilihan bagi
              mahasiswa tanpa kendaraan.
            </li>
            <li>
              <b>Fungsi epsilon 0,01.</b> Mencegah satu dimensi nol membuat
              seluruh skor nol, dan menjaga fungsi tetap terdefinisi.
            </li>
            <li>
              <b>Konsekuensi epsilon.</b> Skor terendah yang mungkin adalah 1,
              bukan 0. Rumus juga bisa melebihi 100 bila seluruh subskor 100,
              karena itu hasil dipotong di 100.
            </li>
            {jumlah !== null && (
              <li>
                <b>Eksklusi dimensi kosong.</b> Dimensi yang seluruh
                indikatornya tidak tersedia ditulis subskor 0 di berkas data
                karena skema mewajibkan angka, TETAPI dikeluarkan dari
                perhitungan dan bobotnya dibagi ulang ke dimensi yang tersisa.
                Nol di situ berarti tidak ada data, bukan nilai nol. Pada data
                ini {formatBilangan(denganKosong)} dari {formatBilangan(jumlah)}{" "}
                heksagon memiliki dimensi kosong
                {dimKosong ? ` — ${dimKosong}` : ""}.
              </li>
            )}
            {denganKosong > 0 && (
              <li>
                <b>Konsekuensi bagi pengguna.</b> Pada heksagon itu skor
                dibentuk dari tiga dimensi yang tersisa, dan menggeser slider
                Keterjangkauan tidak mengubah skornya.
              </li>
            )}
          </ul>
        </StorySection>
        <StorySection className="story-section">
          <h2 className="mt-6 text-xl font-semibold text-white">
            Bobot bawaan
          </h2>
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
                      {(
                        ((bobotMeta ?? BOBOT_DEFAULT)[k.dimensi] ?? 0) * 100
                      ).toLocaleString("id-ID")}
                      %
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            {bobotMeta
              ? "Bobot bawaan berasal dari metadata.bobot_default pada berkas data."
              : "Bobot bawaan diasumsikan dari dokumen proyek; metadata.bobot_default tidak ada."}
          </p>
        </StorySection>
        <StorySection className="story-section">
          <h2 className="mt-6 text-xl font-semibold text-white">
            Cakupan data
          </h2>
          <p className="mt-1 text-sm text-slate-300">
            Jumlah heksagon yang punya nilai untuk tiap indikator. Cakupan yang
            jujur lebih bernilai daripada tabel yang terlihat penuh.
          </p>
          <div className="mt-2 overflow-x-auto">
            <table className="w-full text-sm text-slate-300">
              <thead>
                <tr className="border-b border-slate-700 text-left text-slate-400">
                  <th className="py-1 pr-2">Indikator</th>
                  <th className="py-1 pr-2">Satuan</th>
                  <th className="py-1 pr-2">Sumber</th>
                  <th className="py-1 pr-2 text-right">Jumlah</th>
                  <th className="py-1 text-right">Cakupan</th>
                </tr>
              </thead>
              <tbody>
                {URUTAN_INDIKATOR.map((k) => {
                  const ik = indikator[k] ?? {};
                  const cakupan = jumlah ? (ik.punya ?? 0) / jumlah : 0;
                  return (
                    <tr key={k} className="border-b border-slate-800">
                      <td className="py-1 pr-2">
                        {NAMA_INDIKATOR[k] ?? k}
                        <span className="ml-1 text-xs text-slate-500">
                          {ik.dimensi}
                        </span>
                      </td>
                      <td className="py-1 pr-2">{ik.satuan ?? "—"}</td>
                      <td className="py-1 pr-2">{ik.sumber || "—"}</td>
                      <td className="py-1 pr-2 text-right">
                        {formatBilangan(ik.punya ?? 0)}
                      </td>
                      <td className="py-1 text-right">
                        {cakupan === 0 ? (
                          <span className="rounded bg-red-900/70 px-1.5 py-0.5 text-xs font-semibold text-red-100">
                            0% — tanpa data
                          </span>
                        ) : (
                          formatPecahan(cakupan * 100)
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-xs text-slate-400">
            Indikator tanpa data dikeluarkan dari subskor dimensinya, dan
            dimensi yang seluruh indikatornya kosong dikeluarkan dari skor
            total.
          </p>
        </StorySection>
        <StorySection className="story-section">
          <h2 className="mt-6 text-xl font-semibold text-white">
            Polaritas indikator
          </h2>
          <p className="mt-1 text-sm text-slate-300">
            Sebagian indikator berpolaritas terbalik: nilai lebih kecil berarti
            kondisi lebih baik (misalnya jarak ke halte, jarak ke stasiun, dan
            harga sewa). Pada data ini, dihitung dari arah nilai terhadap
            persentilnya:
          </p>
          {polarTerbalik.length ? (
            <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-slate-300">
              {polarTerbalik.map((n) => (
                <li key={n}>{n}</li>
              ))}
            </ul>
          ) : (
            <p className="mt-1 text-sm text-slate-400">(belum termuat)</p>
          )}
          <p className="mt-2 text-sm text-slate-300">
            Perhitungan skor dan perbandingan antar kawasan memakai persentil,
            bukan nilai mentah, sehingga polaritas sudah tertangani tanpa aturan
            khusus per indikator.
          </p>
        </StorySection>
        <StorySection className="story-section">
          <h2 className="mt-6 text-xl font-semibold text-white">
            Survei lapangan
          </h2>
          {kosTotal ? (
            <>
              <p className="mt-1 text-sm text-slate-300">
                {formatBilangan(kosTotal)} titik kos disurvei tim di lapangan
                {kosTanpaHarga
                  ? `; ${kosTanpaHarga} di antaranya tanpa harga tercatat.`
                  : "."}
              </p>
              <h3 className="mt-3 text-sm font-semibold text-emerald-400">
                Cara harga diperoleh
              </h3>
              <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-slate-300">
                {Object.entries(sebarSumber)
                  .sort((a, b) => b[1] - a[1])
                  .map(([s, n]) => (
                    <li key={s}>
                      {s} — {formatBilangan(n)} titik
                    </li>
                  ))}
              </ul>
              <h3 className="mt-3 text-sm font-semibold text-emerald-400">
                Presisi koordinat
              </h3>
              <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-slate-300">
                {Object.entries(sebarPresisi)
                  .sort((a, b) => b[1] - a[1])
                  .map(([p, n]) => (
                    <li key={p}>
                      {p} — {formatBilangan(n)} titik
                      {ARTIKEL_PRESISI[p] ? <>: {ARTIKEL_PRESISI[p]}.</> : ""}
                    </li>
                  ))}
              </ul>
            </>
          ) : (
            <p className="mt-1 text-sm text-slate-400">(belum termuat)</p>
          )}
        </StorySection>
        <StorySection className="story-section">
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
                      {indikatorPerSumber[kunci]?.length
                        ? indikatorPerSumber[kunci].join(", ")
                        : "—"}
                    </td>
                    <td className="py-1 text-slate-500">
                      menunggu konfirmasi pipeline
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </StorySection>
        <StorySection className="story-section">
          <h2 className="mt-6 text-xl font-semibold text-white">Batasan</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-300">
            {jumlah !== null && (
              <li>
                Keterjangkauan tidak tersedia pada{" "}
                {formatBilangan(jumlah - (indikator.A1_harga_kos?.punya ?? 0))}{" "}
                dari {formatBilangan(jumlah)} heksagon karena harga sewa hanya
                terdata di kawasan yang disurvei (
                {formatBilangan(indikator.A1_harga_kos?.punya ?? 0)} heksagon).
              </li>
            )}
            <li>
              Harga makan dan keramaian kawasan belum tersedia sama sekali.
            </li>
            <li>
              Harga sewa berasal dari{" "}
              {kosTotal ? formatBilangan(kosTotal) : "31"} titik survei —
              sebagian dari media sosial dan spanduk, bukan seluruhnya wawancara
              langsung.
            </li>
            <li>
              Sebagian koordinat kos adalah perkiraan tingkat ruas jalan, bukan
              titik bangunan (ruas_terkait{" "}
              {formatBilangan(sebarPresisi.ruas_terkait ?? 0)}, nama_kos{" "}
              {formatBilangan(sebarPresisi.nama_kos ?? 0)}).
            </li>
            <li>
              Penerangan kawasan memakai piksel VIIRS berukuran sekitar 464
              meter, jadi hanya sah sebagai proksi tingkat kawasan, bukan
              tingkat jalan.
            </li>
            <li>
              Skor bersifat relatif terhadap wilayah studi, bukan nilai mutlak.
            </li>
          </ul>
        </StorySection>
        <StorySection className="story-section">
          <h2 className="mt-6 text-xl font-semibold text-white">Peran AI</h2>
          <p className="mt-2 text-sm text-slate-300">
            <b>AI-1</b> menerjemahkan kalimat bebas jadi bobot. <b>AI-2</b>{" "}
            menyusun narasi dari angka yang sudah tampil di panel. Model bahasa
            tidak menghitung skor dan tidak menerima data mentah. Masukannya
            selalu angka hasil analisis yang sudah jadi.
          </p>
        </StorySection>
      </div>
    </div>
  );
}
