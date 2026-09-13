import { StorySection } from "./Motion";
import TanyaMetode from "./TanyaMetode.jsx";
import { useEffect, useState } from "react";

import {
  KELOMPOK_INDIKATOR,
  NAMA_INDIKATOR,
  NAMA_DIMENSI,
  DIMENSI_UI,
  LABEL_SUMBER,
} from "../lib/kamus";
import { BOBOT_DEFAULT, BOBOT_INDIKATOR } from "../config";
import {
  DEFINISI,
  RINGKASAN,
  PENJELASAN_MODEL,
  LABEL_PRESISI,
} from "../content/metodologi.js";

const URUTAN_INDIKATOR = KELOMPOK_INDIKATOR.flatMap((k) => k.kunci);
const DIMENSI = DIMENSI_UI.map((d) => d.kunci);

// Tiga kelompok, karena delapan bagian sejajar menyembunyikan bahwa isinya
// bertingkat: cara menghitung, asal data, lalu hal yang perlu diketahui
// pembaca sebelum memakai angkanya.
const KELOMPOK = [
  {
    id: "cara",
    judul: "Cara skor dihitung",
    bagian: [
      { id: "wilayah", judul: "Wilayah studi" },
      { id: "definisi", judul: "Definisi indikator" },
      { id: "agregasi", judul: "Dari indikator ke subskor" },
      { id: "rumus", judul: "Rumus skor" },
      { id: "bobot", judul: "Bobot" },
    ],
  },
  {
    id: "data",
    judul: "Dari mana datanya",
    bagian: [
      { id: "cakupan", judul: "Cakupan data" },
      { id: "survei", judul: "Survei lapangan" },
      { id: "sumber", judul: "Sumber data" },
    ],
  },
  {
    id: "perlu",
    judul: "Yang perlu diketahui pembaca",
    bagian: [
      { id: "polaritas", judul: "Polaritas indikator" },
      { id: "skala", judul: "Skala skor dan subskor" },
      { id: "batasan", judul: "Batasan" },
      { id: "ai", judul: "Peran AI" },
      { id: "tanya", judul: "Tanya tentang metode" },
    ],
  },
];
const SEMUA_BAGIAN = KELOMPOK.flatMap((k) => k.bagian);

function kelompokDimensi(kunci) {
  return KELOMPOK_INDIKATOR.find((k) => k.kunci.includes(kunci));
}

/** Bagian yang bisa dilipat, tertutup secara bawaan. */
function Lipatan({ ringkas, terbukaAwal = false, children }) {
  const [terbuka, setTerbuka] = useState(terbukaAwal);
  return (
    <div className="lipatan">
      <button
        type="button"
        className="lipatan-kepala"
        aria-expanded={terbuka}
        onClick={() => setTerbuka((v) => !v)}
      >
        <span>{ringkas}</span>
        <span aria-hidden="true">{terbuka ? "▴" : "▾"}</span>
      </button>
      {terbuka && <div className="lipatan-isi">{children}</div>}
    </div>
  );
}

function Bagian({ id, judul, children }) {
  return (
    <StorySection className="story-section metodologi-bagian" id={id}>
      <h2 className="metodologi-h2">{judul}</h2>
      {children}
    </StorySection>
  );
}

export default function Metodologi({ onKembali, onBeranda, versi }) {
  const [data, setData] = useState(null);
  const [kos, setKos] = useState(null);
  const [aktif, setAktif] = useState(SEMUA_BAGIAN[0].id);

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

  // Tandai bagian yang sedang dibaca di daftar isi. rootMargin atas -45%
  // membuat penandanya berpindah saat judul mencapai sekitar sepertiga atas
  // layar, bukan saat baru menyentuh tepi bawah.
  useEffect(() => {
    if (!data) return;
    const pengamat = new IntersectionObserver(
      (entri) => {
        const terlihat = entri
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (terlihat[0]) setAktif(terlihat[0].target.id);
      },
      { rootMargin: "-45% 0px -45% 0px" },
    );
    for (const b of SEMUA_BAGIAN) {
      const el = document.getElementById(b.id);
      if (el) pengamat.observe(el);
    }
    return () => pengamat.disconnect();
  }, [data]);

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
  const satuDesimal = (n) =>
    typeof n === "number"
      ? n.toLocaleString("id-ID", {
          minimumFractionDigits: 1,
          maximumFractionDigits: 1,
        })
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
        sumberKunci: [...sumber],
        sumber: [...sumber].map((s) => LABEL_SUMBER[s] ?? s).join(", "),
        dimensi: kelompokDimensi(k)?.label ?? "",
      };
    }
  }

  // Cakupan diringkas DARI DATA, bukan ditulis manual: kalimat manual jadi
  // basi begitu datanya berubah.
  const indikatorPenuh = URUTAN_INDIKATOR.filter(
    (k) => jumlah && indikator[k]?.punya === jumlah,
  ).length;
  const indikatorSebagian = URUTAN_INDIKATOR.filter(
    (k) => jumlah && indikator[k]?.punya > 0 && indikator[k].punya < jumlah,
  );
  const indikatorKosong = URUTAN_INDIKATOR.filter(
    (k) => (indikator[k]?.punya ?? 0) === 0,
  );

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
    .map((d) => `${NAMA_DIMENSI[d] ?? d} (${formatBilangan(kosongPerDimensi[d])})`)
    .join(", ");

  // --- rentang skor dan subskor, dihitung dari data ---
  const rentang = (() => {
    if (!data) return null;
    const skor = data.features.map((f) => f.properties.skor);
    const perDimensi = {};
    for (const d of DIMENSI) {
      const nilai = data.features
        .filter((f) => !(f.properties.dimensi_kosong ?? []).includes(d))
        .map((f) => f.properties.subskor?.[d])
        .filter(Number.isFinite);
      if (nilai.length)
        perDimensi[d] = { min: Math.min(...nilai), maks: Math.max(...nilai) };
    }
    return {
      skor: { min: Math.min(...skor), maks: Math.max(...skor) },
      perDimensi,
    };
  })();

  // --- kos ---
  const kosData = kos?.features ?? [];
  const kosTotal = kosData.length;
  const sebarSumber = {};
  const sebarPresisi = {};
  let kosTanpaHarga = 0;
  for (const f of kosData) {
    const s = f.properties.sumber_harga;
    const kunciS = s == null || s === "" ? "Tanpa label" : s;
    sebarSumber[kunciS] = (sebarSumber[kunciS] ?? 0) + 1;
    const p = f.properties.presisi_koordinat;
    const kunciP = p == null ? "Tanpa keterangan" : p;
    sebarPresisi[kunciP] = (sebarPresisi[kunciP] ?? 0) + 1;
    if (f.properties.harga_median == null) kosTanpaHarga++;
  }

  const indikatorPerSumber = {};
  if (data) {
    for (const k of URUTAN_INDIKATOR) {
      for (const kunci of indikator[k].sumberKunci) {
        (indikatorPerSumber[kunci] ??= []).push(NAMA_INDIKATOR[k] ?? k);
      }
    }
  }
  // Hanya sumber yang BENAR-BENAR dipakai indikator. Sumber tanpa indikator
  // (mis. nilai enum kosong, atau sumber yang sudah digantikan) tidak punya
  // tempat di tabel yang dibaca orang luar.
  const sumberTerpakai = Object.keys(LABEL_SUMBER).filter(
    (k) => k !== "tidak_tersedia" && indikatorPerSumber[k]?.length,
  );

  return (
    <div className="metodologi-halaman flex h-full w-full flex-col overflow-y-auto bg-slate-950">
      <div className="mx-auto w-full max-w-[760px] px-4 py-6">
        <div className="flex flex-wrap gap-1.5">
          <button
            onClick={onBeranda}
            className="rounded bg-slate-900 px-3 py-1 text-xs text-slate-300 ring-1 ring-slate-700 hover:text-white"
          >
            Beranda
          </button>
          <button
            onClick={onKembali}
            className="rounded bg-slate-900 px-3 py-1 text-xs text-slate-300 ring-1 ring-slate-700 hover:text-white"
          >
            Peta
          </button>
          <span className="rounded bg-slate-800 px-3 py-1 text-xs font-semibold text-emerald-400">
            Metodologi
          </span>
        </div>

        <h1 className="mt-4 text-3xl font-bold text-white">
          Metodologi dan sumber data
        </h1>
        <p className="mt-2 text-sm text-slate-400">
          Bagaimana skor tiap kawasan dihitung, dari data apa, dan apa
          batasannya.
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

        {/* Ringkasan tanpa notasi, untuk pembaca yang datang dari beranda.
            Bagian teknis menyusul setelah daftar isi. */}
        <section className="metodologi-ringkasan">
          {RINGKASAN.map((k) => (
            <p key={k}>{k}</p>
          ))}
        </section>

        <div className="metodologi-isi">
          <nav className="metodologi-daftar" aria-label="Daftar isi">
            <span className="daftar-judul">Isi halaman</span>
            {KELOMPOK.map((kel) => (
              <div key={kel.id} className="daftar-kelompok">
                <span className="daftar-kelompok-judul">{kel.judul}</span>
                <ul>
                  {kel.bagian.map((b) => (
                    <li key={b.id}>
                      <a
                        href={`#${b.id}`}
                        className={aktif === b.id ? "is-aktif" : undefined}
                        aria-current={aktif === b.id ? "true" : undefined}
                      >
                        {b.judul}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>

          <div className="metodologi-utama">
            {/* ---------------- 1. Cara skor dihitung ---------------- */}
            <h2 className="metodologi-kelompok">{KELOMPOK[0].judul}</h2>

            <Bagian id="wilayah" judul="Wilayah studi">
              <p className="metodologi-p">
                Wilayah studi adalah sabuk kampus Sleman, DIY, dibagi menjadi{" "}
                {jumlah !== null ? formatBilangan(jumlah) : "—"} heksagon H3
                resolusi 9. Tiap heksagon berluas sekitar 0,1 km² dengan lebar
                sekitar 380 m — cukup kecil untuk terasa sebagai satu
                lingkungan, cukup besar untuk punya beberapa pilihan kos.
              </p>
              <p className="metodologi-p">
                Semua jarak dihitung pada proyeksi meter (UTM 49S), dan graf
                jalan diunduh dengan buffer 2 km di luar batas studi supaya
                heksagon di tepi tidak tampak tak terjangkau hanya karena
                grafnya terpotong.
              </p>
            </Bagian>

            <Bagian id="definisi" judul="Definisi indikator">
              <p className="metodologi-p">
                Enam belas indikator, empat dimensi. Satuan seperti
                &ldquo;indeks&rdquo; tidak berarti apa pun tanpa cara
                hitungnya, jadi tiap indikator dijabarkan: apa yang diukur,
                rumusnya, cakupan spasialnya, dan arah mana yang lebih baik.
              </p>
              {KELOMPOK_INDIKATOR.map((kel) => (
                <div key={kel.dimensi} className="definisi-dimensi">
                  <h3 className="metodologi-h3">{kel.label}</h3>
                  {kel.kunci.map((k) => {
                    const d = DEFINISI[k];
                    const ik = indikator[k];
                    if (!d) return null;
                    return (
                      <Lipatan
                        key={k}
                        ringkas={
                          <span className="definisi-ringkas">
                            <span className="definisi-nama">
                              {NAMA_INDIKATOR[k] ?? k}
                            </span>
                            {ik?.satuan && (
                              <span className="definisi-satuan">
                                {ik.satuan}
                              </span>
                            )}
                            {d.estimasi && (
                              <span className="definisi-estimasi">
                                estimasi
                              </span>
                            )}
                          </span>
                        }
                      >
                        <dl className="definisi-rinci">
                          <dt>Yang diukur</dt>
                          <dd>{d.ukur}</dd>
                          <dt>Cara menghitung</dt>
                          <dd>{d.rumus}</dd>
                          <dt>Cakupan spasial</dt>
                          <dd>{d.cakupan}</dd>
                          <dt>Arah</dt>
                          <dd>{d.arah}</dd>
                          {d.catatan && (
                            <>
                              <dt>Catatan</dt>
                              <dd>{d.catatan}</dd>
                            </>
                          )}
                        </dl>
                      </Lipatan>
                    );
                  })}
                </div>
              ))}
            </Bagian>

            <Bagian id="agregasi" judul="Dari indikator ke subskor">
              <p className="metodologi-p">
                Ini langkah yang paling menentukan hasil, dan urutannya tiga
                tahap.
              </p>
              <ol className="metodologi-ol">
                <li>
                  <b>Normalisasi jadi peringkat.</b> Nilai tiap indikator
                  diubah menjadi peringkat persentil (ECDF) terhadap{" "}
                  <b>seluruh heksagon wilayah studi yang punya nilai untuk
                  indikator itu</b>, bukan terhadap nilai maksimum teoretis dan
                  bukan terhadap subhimpunan mana pun. Hasilnya 0–1. Nilai yang
                  sama mendapat peringkat rata-rata. Indikator tanpa data tidak
                  mendapat persentil sama sekali — persentil akan menyiratkan
                  kita tahu sesuatu.
                </li>
                <li>
                  <b>Gabung dalam satu dimensi.</b> Subskor dimensi adalah
                  rata-rata <b>berbobot</b> persentil indikatornya, dikalikan
                  100. Bobot antar-indikator <b>tidak sama</b> dan tidak dapat
                  diubah pengguna; angkanya ada di tabel bawah.
                </li>
                <li>
                  <b>Normalisasi ulang bila ada yang hilang.</b> Indikator
                  tanpa data dikeluarkan, lalu bobot indikator yang tersisa di
                  dimensi itu dibagi ulang sehingga totalnya kembali 1. Tidak
                  ada imputasi nilai tengah 0,5.
                </li>
              </ol>
              <p className="metodologi-rumus-blok">
                <span className="rumus-baris">
                  subskor<sub>d</sub> = 100 × ( Σ<sub>i∈d</sub> w<sub>i</sub> ·
                  p<sub>i</sub> ) ÷ ( Σ<sub>i∈d</sub> w<sub>i</sub> )
                </span>
              </p>
              <ul className="metodologi-simbol">
                <li>
                  <b>
                    p<sub>i</sub>
                  </b>{" "}
                  — peringkat persentil indikator <i>i</i>, bernilai 0 sampai 1
                </li>
                <li>
                  <b>
                    w<sub>i</sub>
                  </b>{" "}
                  — bobot indikator <i>i</i> di dalam dimensinya
                </li>
                <li>
                  <b>i ∈ d</b> — hanya indikator dimensi itu yang{" "}
                  <b>punya data</b>
                </li>
              </ul>
              <p className="metodologi-p">
                Contohnya: subskor {NAMA_DIMENSI.connectivity} dibentuk dari
                empat indikatornya dengan bobot jarak halte 0,30, rute unik
                0,20, keterjangkauan kampus 0,40, dan jarak stasiun KRL 0,10 —
                masing-masing dikalikan persentilnya, dijumlahkan, lalu dikali
                100.
              </p>

              <h3 className="metodologi-h3">Bobot antar-indikator</h3>
              <Lipatan ringkas="Bobot tiap indikator di dalam dimensinya">
                <div className="metodologi-tabel">
                  <table>
                    <thead>
                      <tr>
                        <th>Dimensi</th>
                        <th>Indikator</th>
                        <th className="kanan">Bobot</th>
                      </tr>
                    </thead>
                    <tbody>
                      {KELOMPOK_INDIKATOR.map((kel) =>
                        kel.kunci.map((k, i) => (
                          <tr key={k}>
                            <td>{i === 0 ? kel.label : ""}</td>
                            <td>{NAMA_INDIKATOR[k] ?? k}</td>
                            <td className="kanan">
                              {satuDesimal(BOBOT_INDIKATOR[k] * 100)}%
                            </td>
                          </tr>
                        )),
                      )}
                    </tbody>
                  </table>
                </div>
                <p className="metodologi-catatan">
                  Bobot antar-indikator tetap. Yang bisa digeser pengguna hanya
                  bobot antar-dimensi.
                </p>
              </Lipatan>
            </Bagian>

            <Bagian id="rumus" judul="Rumus skor">
              <p className="metodologi-p">
                Keempat subskor digabung menjadi satu skor dengan rata-rata
                geometrik berbobot.
              </p>
              <p className="metodologi-rumus-blok">
                <span className="rumus-baris">
                  skor = 100 × ∏<sub>d∈D</sub> ( subskor<sub>d</sub>/100 + ε )
                  <sup>
                    w<sub>d</sub>/W
                  </sup>
                </span>
              </p>
              <ul className="metodologi-simbol">
                <li>
                  <b>D</b> — himpunan dimensi yang <b>punya data</b> pada
                  heksagon itu
                </li>
                <li>
                  <b>
                    w<sub>d</sub>
                  </b>{" "}
                  — bobot dimensi <i>d</i>
                </li>
                <li>
                  <b>W</b> — jumlah bobot dimensi di dalam D, sebagai penormal
                </li>
                <li>
                  <b>ε</b> — konstanta kecil 0,01
                </li>
                <li>
                  <b>∏</b> — hasil kali atas seluruh dimensi di D
                </li>
              </ul>
              <ul className="metodologi-ul">
                <li>
                  <b>Kenapa rata-rata geometrik, bukan aritmetik.</b> Bila satu
                  dimensi mendekati nol, skor total ikut jatuh. Kos dengan
                  warung melimpah tapi tanpa akses transit tetap salah pilihan
                  bagi mahasiswa tanpa kendaraan.
                </li>
                <li>
                  <b>Fungsi epsilon 0,01.</b> Mencegah satu dimensi nol membuat
                  seluruh skor nol, dan menjaga fungsi tetap terdefinisi.
                </li>
                <li>
                  <b>Konsekuensi epsilon.</b> Skor terendah yang mungkin adalah
                  1, bukan 0. Rumus juga bisa melebihi 100 bila seluruh subskor
                  100, karena itu hasil dipotong di 100.
                </li>
                <li>
                  <b>Eksklusi dimensi kosong.</b> Dimensi yang seluruh
                  indikatornya tidak tersedia ditulis subskor 0 di berkas data
                  karena skema mewajibkan angka, TETAPI dikeluarkan dari
                  perhitungan dan bobotnya dibagi ulang ke dimensi yang
                  tersisa. Nol di situ berarti tidak ada data, bukan nilai nol.
                  {jumlah !== null && denganKosong === 0 && (
                    <>
                      {" "}
                      Pada data ini tidak ada heksagon yang punya dimensi
                      kosong, jadi mekanisme itu tidak terpakai — penjelasannya
                      tetap dicantumkan karena aturannya berlaku untuk data
                      berikutnya.
                    </>
                  )}
                  {jumlah !== null && denganKosong > 0 && (
                    <>
                      {" "}
                      Pada data ini {formatBilangan(denganKosong)} dari{" "}
                      {formatBilangan(jumlah)} heksagon memiliki dimensi kosong
                      {dimKosong ? `, yaitu ${dimKosong}` : ""}.
                    </>
                  )}
                </li>
              </ul>
            </Bagian>

            <Bagian id="bobot" judul="Bobot antar-dimensi">
              <div className="metodologi-tabel">
                <table>
                  <thead>
                    <tr>
                      <th>Dimensi</th>
                      <th className="kanan">Bobot bawaan</th>
                    </tr>
                  </thead>
                  <tbody>
                    {KELOMPOK_INDIKATOR.map((k) => (
                      <tr key={k.dimensi}>
                        <td>{k.label}</td>
                        <td className="kanan">
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
              <p className="metodologi-catatan">
                Bobot bawaan ini ditetapkan tim, dan dapat diubah pengguna saat
                menjelajah peta. Mengubahnya mengubah skor dan urutan kawasan,
                tetapi tidak mengubah data apa pun di baliknya.
              </p>

              <h3 className="metodologi-h3">Bobot dari pilihan di beranda</h3>
              <p className="metodologi-p">
                Beranda meminta pengguna memilih paling banyak dua dimensi yang
                paling penting baginya, bukan menggeser empat slider. Alasannya:
                skor memakai bobot relatif, sehingga keempat slider di nilai
                maksimum menghasilkan bobot yang sama persis dengan keempatnya
                di nilai minimum, yaitu 25% untuk tiap dimensi. Pilihan
                berbatas membuat perbedaan bobot selalu nyata.
              </p>
              <div className="metodologi-tabel">
                <table>
                  <thead>
                    <tr>
                      <th>Pilihan di beranda</th>
                      <th>Bobot yang dipakai</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>Dua dimensi dipilih</td>
                      <td>40% · 40% · 10% · 10%</td>
                    </tr>
                    <tr>
                      <td>Satu dimensi dipilih</td>
                      <td>55% · 15% · 15% · 15%</td>
                    </tr>
                    <tr>
                      <td>&ldquo;Semuanya sama penting bagiku&rdquo;</td>
                      <td>Bobot bawaan di tabel atas</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <p className="metodologi-catatan">
                Bobot dari beranda menjadi posisi awal di panel prioritas
                halaman peta, lalu poinnya bisa dibagi ulang sesuka pengguna.
                Pilihan &ldquo;semuanya sama penting&rdquo; berarti tidak ada
                preferensi khusus, jadi yang dipakai adalah bobot bawaan —
                bukan pembagian rata, yang justru menyiratkan keempat dimensi
                sama pentingnya.
              </p>
            </Bagian>

            {/* ---------------- 2. Dari mana datanya ---------------- */}
            <h2 className="metodologi-kelompok">{KELOMPOK[1].judul}</h2>

            <Bagian id="cakupan" judul="Cakupan data">
              {jumlah !== null && (
                <p className="metodologi-p">
                  {indikatorKosong.length === 0 &&
                  indikatorSebagian.length === 0 ? (
                    <>
                      Seluruh {URUTAN_INDIKATOR.length} indikator tercakup penuh
                      pada {formatBilangan(jumlah)} heksagon (100%).
                    </>
                  ) : (
                    <>
                      {indikatorPenuh} dari {URUTAN_INDIKATOR.length} indikator
                      tercakup penuh pada {formatBilangan(jumlah)} heksagon
                      {indikatorSebagian.length > 0 && (
                        <>
                          ; {indikatorSebagian.length} tercakup sebagian
                        </>
                      )}
                      {indikatorKosong.length > 0 && (
                        <>
                          ; {indikatorKosong.length} belum punya data sama
                          sekali
                        </>
                      )}
                      .
                    </>
                  )}{" "}
                  Cakupan yang jujur lebih bernilai daripada tabel yang
                  terlihat penuh.
                </p>
              )}
              <Lipatan ringkas={`Cakupan per indikator (${URUTAN_INDIKATOR.length} baris)`}>
                <div className="metodologi-tabel">
                  <table>
                    <thead>
                      <tr>
                        <th>Indikator</th>
                        <th>Satuan</th>
                        <th>Sumber</th>
                        <th className="kanan">Jumlah</th>
                        <th className="kanan">Cakupan</th>
                      </tr>
                    </thead>
                    <tbody>
                      {URUTAN_INDIKATOR.map((k) => {
                        const ik = indikator[k] ?? {};
                        const cakupan = jumlah ? (ik.punya ?? 0) / jumlah : 0;
                        return (
                          <tr key={k}>
                            <td>
                              {NAMA_INDIKATOR[k] ?? k}
                              <span className="tabel-dimensi">
                                {ik.dimensi}
                              </span>
                            </td>
                            <td>{ik.satuan ?? "—"}</td>
                            <td>{ik.sumber || "—"}</td>
                            <td className="kanan">
                              {formatBilangan(ik.punya ?? 0)}
                            </td>
                            <td className="kanan">
                              {cakupan === 0 ? (
                                <span className="lencana-kosong">
                                  0%, tanpa data
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
              </Lipatan>
              <p className="metodologi-catatan">
                Indikator tanpa data dikeluarkan dari subskor dimensinya, dan
                dimensi yang seluruh indikatornya kosong dikeluarkan dari skor
                total.
              </p>
            </Bagian>

            <Bagian id="survei" judul="Survei lapangan">
              {kosTotal ? (
                <>
                  <p className="metodologi-p">
                    {formatBilangan(kosTotal)} titik kos disurvei tim di
                    lapangan
                    {kosTanpaHarga
                      ? `; ${kosTanpaHarga} di antaranya tanpa harga tercatat.`
                      : "."}
                  </p>
                  <h3 className="metodologi-h3">Cara harga diperoleh</h3>
                  <ul className="metodologi-ul">
                    {Object.entries(sebarSumber)
                      .sort((a, b) => b[1] - a[1])
                      .map(([s, n]) => (
                        <li key={s}>
                          {s}: {formatBilangan(n)} titik
                        </li>
                      ))}
                  </ul>
                  <h3 className="metodologi-h3">Presisi koordinat</h3>
                  <ul className="metodologi-ul">
                    {Object.entries(sebarPresisi)
                      .sort((a, b) => b[1] - a[1])
                      .map(([p, n]) => (
                        <li key={p}>
                          {LABEL_PRESISI[p] ?? p}: {formatBilangan(n)} titik
                        </li>
                      ))}
                  </ul>
                </>
              ) : (
                <p className="metodologi-p">(belum termuat)</p>
              )}
            </Bagian>

            <Bagian id="sumber" judul="Sumber data">
              <p className="metodologi-p">
                {sumberTerpakai.length} sumber dipakai, dari pemetaan
                sukarelawan, lapisan data pemerintah dan penyedia, citra
                satelit, sampai survei tim sendiri.
              </p>
              <Lipatan
                ringkas={`Sumber dan indikator yang memakainya (${sumberTerpakai.length} baris)`}
              >
                <div className="metodologi-tabel">
                  <table>
                    <thead>
                      <tr>
                        <th>Sumber</th>
                        <th>Dipakai indikator</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sumberTerpakai.map((kunci) => (
                        <tr key={kunci}>
                          <td>{LABEL_SUMBER[kunci]}</td>
                          <td>{indikatorPerSumber[kunci].join(", ")}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Lipatan>
            </Bagian>

            {/* ---------- 3. Yang perlu diketahui pembaca ---------- */}
            <h2 className="metodologi-kelompok">{KELOMPOK[2].judul}</h2>

            <Bagian id="polaritas" judul="Polaritas indikator">
              <p className="metodologi-p">
                Sebagian indikator berpolaritas terbalik: nilai lebih kecil
                berarti kondisi lebih baik. Jarak ke halte 200 m lebih baik
                daripada 2.000 m, dan harga sewa Rp 600 ribu lebih baik
                daripada Rp 1,4 juta.
              </p>
              <p className="metodologi-p">
                Peringkat persentil <b>tidak</b> membalik arah dengan
                sendirinya. Yang dilakukan adalah membalik arahnya lebih dulu,
                di tingkat indikator, sebelum persentil dihitung — dan tiap
                indikator memakai transformasi yang sesuai sifatnya, bukan satu
                aturan seragam:
              </p>
              <ul className="metodologi-ul">
                <li>
                  <b>{NAMA_INDIKATOR.C1_jarak_halte}</b> dan{" "}
                  <b>{NAMA_INDIKATOR.C4_jarak_krl}</b> memakai peluruhan
                  eksponensial atas jaraknya, exp(−jarak/400 m) dan
                  exp(−jarak/800 m). Jarak besar meluruh mendekati nol, jadi
                  nilai tinggi berarti dekat.
                </li>
                <li>
                  <b>{NAMA_INDIKATOR.A1_harga_kos}</b> dan{" "}
                  <b>{NAMA_INDIKATOR.A2_harga_makan}</b> memakai harga yang
                  dinegatifkan, sehingga harga termurah menempati peringkat
                  tertinggi.
                </li>
                <li>
                  <b>{NAMA_INDIKATOR.W5_tekanan_lalin}</b> dan{" "}
                  <b>{NAMA_INDIKATOR.W4_banjir}</b> menyimpan{" "}
                  <b>1 − tekanan</b> dan <b>1 − indeks bahaya</b>. Itu sebabnya
                  keduanya dinamai menurut hal baiknya (ketenangan, keamanan),
                  bukan hal buruknya.
                </li>
              </ul>
              <p className="metodologi-p">
                Akibatnya, setiap nilai yang tersimpan sudah berorientasi{" "}
                <b>makin tinggi makin baik</b>, dan langkah persentil tidak
                perlu tahu apa-apa soal polaritas. Ini juga sebabnya nilai
                mentah bisa terlihat berlawanan dengan persentilnya di panel
                peta: jarak 2,7 km punya persentil rendah justru karena arahnya
                sudah dibalik.
              </p>
            </Bagian>

            <Bagian id="skala" judul="Skala skor dan subskor">
              <p className="metodologi-p">
                Skor total dan subskor dimensi berada pada <b>skala berbeda</b>
                , dan angkanya tidak bisa dibandingkan langsung. Subskor adalah
                rata-rata persentil, jadi sebarannya melebar hampir penuh. Skor
                total adalah rata-rata geometrik atas keempat subskor, dan
                rata-rata geometrik menarik nilai ekstrem ke tengah — sehingga
                rentangnya selalu lebih sempit.
              </p>
              {rentang && (
                <div className="metodologi-tabel">
                  <table>
                    <thead>
                      <tr>
                        <th>Ukuran</th>
                        <th className="kanan">Terendah</th>
                        <th className="kanan">Tertinggi</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td>
                          <b>Skor total</b> (warna heksagon di peta)
                        </td>
                        <td className="kanan">
                          {satuDesimal(rentang.skor.min)}
                        </td>
                        <td className="kanan">
                          {satuDesimal(rentang.skor.maks)}
                        </td>
                      </tr>
                      {DIMENSI.filter((d) => rentang.perDimensi[d]).map((d) => (
                        <tr key={d}>
                          <td>Subskor {NAMA_DIMENSI[d]}</td>
                          <td className="kanan">
                            {satuDesimal(rentang.perDimensi[d].min)}
                          </td>
                          <td className="kanan">
                            {satuDesimal(rentang.perDimensi[d].maks)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <p className="metodologi-catatan">
                Karena itu subskor satu dimensi bisa melampaui skor tertinggi di
                legenda peta tanpa ada yang salah. Legenda peta mewarnai skor
                total, bukan subskor.
              </p>
            </Bagian>

            <Bagian id="batasan" judul="Batasan">
              <ul className="metodologi-ul">
                {indikatorKosong.length > 0 && (
                  <li>
                    {indikatorKosong.length} indikator belum punya data sama
                    sekali:{" "}
                    {indikatorKosong
                      .map((k) => NAMA_INDIKATOR[k] ?? k)
                      .join(", ")}
                    .
                  </li>
                )}
                {indikatorSebagian.length > 0 && (
                  <li>
                    {indikatorSebagian.length} indikator hanya tercakup
                    sebagian:{" "}
                    {indikatorSebagian
                      .map(
                        (k) =>
                          `${NAMA_INDIKATOR[k] ?? k} (${formatPecahan(
                            (indikator[k].punya / jumlah) * 100,
                          )})`,
                      )
                      .join(", ")}
                    .
                  </li>
                )}
                <li>
                  Harga sewa berasal dari{" "}
                  {kosTotal ? formatBilangan(kosTotal) : "—"} titik survei.
                  Sebagian dari media sosial dan spanduk, bukan seluruhnya
                  wawancara langsung.
                </li>
                <li>
                  Sebagian koordinat kos adalah perkiraan tingkat ruas jalan,
                  bukan titik bangunan.
                </li>
                <li>
                  {NAMA_INDIKATOR.W3_penerangan} memakai raster cahaya malam
                  beresolusi ratusan meter, jadi hanya sah sebagai proksi
                  tingkat kawasan, bukan tingkat jalan.
                </li>
                <li>
                  {NAMA_INDIKATOR.W6_integritas_jalur} adalah hasil{" "}
                  <b>estimasi model</b>, bukan pengukuran langsung di tiap
                  ruas. Penjelasan lengkapnya ada di bawah.
                </li>
                <li>
                  Skor bersifat relatif terhadap wilayah studi, bukan nilai
                  mutlak. Kawasan berskor tertinggi adalah yang terbaik{" "}
                  <i>di Sleman</i>, bukan yang memenuhi standar tertentu.
                </li>
                <li>
                  Unit analisisnya kawasan, bukan bangunan. Skor tinggi tidak
                  menjamin setiap kos di dalamnya cocok, dan skor rendah tidak
                  berarti tidak ada kos bagus di sana.
                </li>
              </ul>

              <h3 className="metodologi-h3">
                Bagaimana jalur pejalan kaki ditaksir
              </h3>
              {PENJELASAN_MODEL.map((p) => (
                <p key={p} className="metodologi-p">
                  {p}
                </p>
              ))}
            </Bagian>

            <Bagian id="ai" judul="Peran AI">
              <p className="metodologi-p">
                Model bahasa dipakai di dua tempat, dan keduanya di luar jalur
                perhitungan:
              </p>
              <ul className="metodologi-ul">
                <li>
                  <b>Menerjemahkan kebutuhan menjadi bobot.</b> Kalimat bebas
                  yang ditulis pengguna di beranda dibaca menjadi kampus
                  tujuan, anggaran, dan dimensi yang diprioritaskan. Hasilnya
                  selalu ditampilkan untuk dikoreksi lebih dulu, tidak langsung
                  dipakai.
                </li>
                <li>
                  <b>Menyusun narasi dari angka yang sudah tampil.</b>{" "}
                  Penjelasan kekuatan dan kelemahan kawasan, serta perbandingan
                  dua kawasan, disusun dari angka yang sudah ada di panel.
                </li>
              </ul>
              <p className="metodologi-p">
                Model bahasa <b>tidak menghitung skor</b> dan{" "}
                <b>tidak menerima data mentah</b>. Masukannya selalu angka hasil
                analisis yang sudah jadi, beserta arah perbandingan yang sudah
                ditetapkan lebih dulu, sehingga model tidak bisa menyimpulkan
                sendiri kawasan mana yang lebih baik. Bila layanannya tidak
                merespons, halaman tetap berjalan dengan ringkasan yang disusun
                tanpa AI dan diberi label demikian.
              </p>
            </Bagian>

            <Bagian id="tanya" judul="Tanya tentang metode ini">
              <TanyaMetode />
            </Bagian>
          </div>
        </div>
      </div>
    </div>
  );
}
