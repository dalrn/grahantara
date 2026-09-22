import { lazy, Suspense, useEffect, useRef, useState } from "react";

import { DAFTAR_KAMPUS } from "../kampus.js";
import { DIMENSI_UI } from "../lib/kamus";
import { BOBOT_DEFAULT } from "../config";
import { TEKS } from "../content/landing.js";
import AngkaNaik from "./AngkaNaik.jsx";

// MapLibre + hexagons.geojson berat; jangan masuk bundel awal beranda.
const PetaHero = lazy(() => import("./PetaHero.jsx"));
const SebaranDimensi = lazy(() => import("./SebaranDimensi.jsx"));
const TeksturJalan = lazy(() => import("./TeksturJalan.jsx"));

// Label dan urutan dari DIMENSI_UI (dipakai bersama slider /peta), kalimat
// penjelasnya dari modul teks.
const DIMENSI = DIMENSI_UI.map((d) => [
  d.kunci,
  d.label,
  TEKS.dimensi.penjelasan[d.kunci],
]);

// "Pilih dua": bobot mentah 0-100, skala yang sama dengan state bobot App dan
// slider /peta.
//
// Empat slider kepentingan diganti kontrol berbatas karena skor komposit
// memakai bobot RELATIF (w/Sigma-w). Keempat slider di maksimum menghasilkan
// 0,25 per dimensi, identik dengan keempatnya di minimum dan identik dengan
// tidak mengisi apa pun. Pengguna merasa sudah menyetel padahal hasilnya sama
// dengan bawaan. Batas dua pilihan membuat perbedaan bobot selalu nyata.
//
// Angka final (didokumentasikan di halaman Metodologi). Total SELALU 100,
// sama dengan jatah poin di panel bobot halaman peta:
//   dua terpilih  -> 40/40/10/10
//   satu terpilih -> 55/15/15/15
//   "semuanya sama" -> bobot bawaan (40/25/20/15), BUKAN 25 merata
const BOBOT_DIPILIH = 40;
const BOBOT_SISA = 10;
const MAKS_PILIH = 2;

// "Semuanya sama penting bagiku" berarti "aku tidak punya preferensi khusus",
// dan jawaban yang benar untuk itu adalah bobot bawaan produk, bukan
// pembagian rata.
//
// "Semuanya sama penting" berarti tidak ada preferensi khusus, jadi yang
// dipakai adalah bobot bawaan. Pembagian rata akan menyiratkan keempat
// dimensi sama pentingnya, padahal metodologi menyatakan sebaliknya.
function bobotDariPilihan(pilihan, setara, bawaan) {
  const b = {};
  if (setara || pilihan.length === 0) {
    for (const { kunci } of DIMENSI_UI) b[kunci] = bawaan[kunci];
    return b;
  }
  // Satu pilihan saja: sisanya dibagi rata agar totalnya tetap 100.
  if (pilihan.length === 1) {
    for (const { kunci } of DIMENSI_UI) {
      b[kunci] = pilihan.includes(kunci) ? 55 : 15;
    }
    return b;
  }
  for (const { kunci } of DIMENSI_UI) {
    b[kunci] = pilihan.includes(kunci) ? BOBOT_DIPILIH : BOBOT_SISA;
  }
  return b;
}

// Rentang anggaran dari survei kos: 30 kos terdata, Rp 350.000-1.400.000.
// Slider dibulatkan ke luar supaya ujungnya tidak terasa mentok.
const ANGGARAN_MIN = 300000;
const ANGGARAN_MAKS = 1500000;
const ANGGARAN_LANGKAH = 50000;
const ANGGARAN_AWAL = 800000;

const formatRupiah = (n) =>
  Number.isFinite(n) ? `Rp ${n.toLocaleString("id-ID")}` : "";

// Anggaran dari AI/regex bisa di luar jangkauan slider. Nilai di luar batas
// dipatok ke batas dan dicatat asalnya supaya panel bisa menjelaskannya;
// nilai di dalam batas dibulatkan ke langkah slider terdekat.
function sesuaikanAnggaran(nilai) {
  if (nilai < ANGGARAN_MIN)
    return { nilai: ANGGARAN_MIN, catatan: { asli: nilai, arah: "bawah" } };
  if (nilai > ANGGARAN_MAKS)
    return { nilai: ANGGARAN_MAKS, catatan: { asli: nilai, arah: "atas" } };
  return {
    nilai: Math.round(nilai / ANGGARAN_LANGKAH) * ANGGARAN_LANGKAH,
    catatan: null,
  };
}

export default function Beranda({
  onProfil,
  onLewati,
  onMetodologi,
  profilAwal,
}) {
  // "tulis" = tahap 1, "konfirmasi" = tahap 2.
  const [tahap, setTahap] = useState(profilAwal ? "konfirmasi" : "tulis");
  const [teks, setTeks] = useState(profilAwal?.teks ?? "");
  const [memuat, setMemuat] = useState(false);
  const [meta, setMeta] = useState(null);

  // Isi tahap 2.
  const [kampus, setKampus] = useState(profilAwal?.kampus ?? "");
  const [anggaran, setAnggaran] = useState(
    profilAwal?.anggaran ?? ANGGARAN_AWAL,
  );
  const [adaAnggaran, setAdaAnggaran] = useState(profilAwal?.anggaran != null);
  // { asli, arah } bila anggaran dari AI dipatok ke batas slider.
  const [catatanAnggaran, setCatatanAnggaran] = useState(null);
  const [pilihan, setPilihan] = useState(profilAwal?.prioritas ?? []);
  const [setara, setSetara] = useState(
    Boolean(profilAwal) && (profilAwal.prioritas ?? []).length === 0,
  );
  // Dimensi yang TIDAK berhasil diisi dari narasi; dipakai untuk penanda halus.
  const [tidakTerbaca, setTidakTerbaca] = useState([]);
  const [ringkasAI, setRingkasAI] = useState(null);
  // Bagian kebutuhan yang TIDAK tertampung kontrol lain. Bukan seluruh prompt.
  const [catatanEkstra, setCatatanEkstra] = useState([]);
  // Penekanan antar-indikator dari AI-1, mis. "makan" untuk pengguna yang
  // bilang fasilitas lain tidak penting.
  const [penekanan, setPenekanan] = useState(null);
  // Jenis tempat yang disebut spesifik ("dekat apotek"), dipakai panel
  // kawasan untuk menampilkan tempat itu lebih dulu.
  const [kategoriPoi, setKategoriPoi] = useState([]);
  const [pesanBaca, setPesanBaca] = useState(null);
  // Nama dimensi yang cakupannya belum penuh, dilaporkan SebaranDimensi dari
  // data. Dipakai kalimat cakupan di bawah grafik.
  const [dimensiKurang, setDimensiKurang] = useState([]);
  const kartuRef = useRef(null);

  useEffect(() => {
    // Metadata saja, ratusan byte. Berkas heksagon 4,5 MB hanya dimuat di
    // halaman peta.
    let batal = false;
    fetch("/data/metadata.json")
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((d) => {
        if (!batal) setMeta(d ?? null);
      })
      .catch(() => {
        if (!batal) setMeta(null);
      });
    return () => {
      batal = true;
    };
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

  const stub =
    meta && typeof meta.versi === "string" && meta.versi.startsWith("stub");

  // Bobot bawaan dari metadata berkas data (pecahan 0-1) ke skala 0-100 yang
  // dipakai App. metadata.json sudah diunduh di atas, jadi tidak ada
  // permintaan jaringan tambahan. BOBOT_DEFAULT hanya cadangan.
  const bobotBawaan = (() => {
    const b = {};
    for (const { kunci } of DIMENSI_UI) {
      const m = meta?.bobot_default?.[kunci];
      b[kunci] = Number.isFinite(m)
        ? Math.round(m * 100)
        : Math.round(BOBOT_DEFAULT[kunci] * 100);
    }
    return b;
  })();

  // Dua dimensi berbobot tertinggi dari hasil AI jadi pilihan awal tahap 2.
  const pilihanDariBobot = (bobot) => {
    if (!bobot) return [];
    const urut = DIMENSI_UI.map(({ kunci }) => [kunci, bobot[kunci] ?? 0]).sort(
      (a, b) => b[1] - a[1],
    );
    // Kalau keempatnya sama, AI tidak benar-benar memilih apa pun.
    if (urut[0][1] === urut[3][1]) return [];
    return urut.slice(0, MAKS_PILIH).map(([k]) => k);
  };

  const kePilih = (kunci) => {
    setSetara(false);
    setPilihan((p) => {
      if (p.includes(kunci)) return p.filter((x) => x !== kunci);
      // Kuota penuh: opsi lain dinonaktifkan, jadi cabang ini tidak tercapai
      // lewat klik. Dijaga supaya tetap benar bila dipanggil dari tempat lain.
      if (p.length >= MAKS_PILIH) return p;
      return [...p, kunci];
    });
  };

  const keKonfirmasi = (hasil, pesan) => {
    if (hasil) {
      if (hasil.kampus) setKampus(hasil.kampus);
      setCatatanAnggaran(null);
      if (hasil.anggaran != null) {
        const { nilai, catatan } = sesuaikanAnggaran(hasil.anggaran);
        setAnggaran(nilai);
        setAdaAnggaran(true);
        setCatatanAnggaran(catatan);
      }
      const dipilih = pilihanDariBobot(hasil.bobot);
      setPilihan(dipilih);
      setSetara(dipilih.length === 0);
      const luput = [];
      if (!hasil.kampus) luput.push("kampus");
      if (hasil.anggaran == null) luput.push("anggaran");
      if (dipilih.length === 0) luput.push("prioritas");
      setTidakTerbaca(luput);
      setRingkasAI(hasil.ringkas ?? null);
      // Larik; bentuk lama (string tunggal) tetap diterima.
      setCatatanEkstra(
        Array.isArray(hasil.catatanEkstra)
          ? hasil.catatanEkstra
          : hasil.catatanEkstra
            ? [hasil.catatanEkstra]
            : [],
      );
      setPenekanan(hasil.penekanan ?? null);
      setKategoriPoi(Array.isArray(hasil.kategoriPoi) ? hasil.kategoriPoi : []);
    } else {
      setTidakTerbaca([]);
      setRingkasAI(null);
      setCatatanEkstra([]);
      setPenekanan(null);
      setCatatanAnggaran(null);
    }
    setPesanBaca(pesan ?? null);
    setTahap("konfirmasi");
    requestAnimationFrame(() => kartuRef.current?.focus?.());
  };

  // Tahap 1 -> tahap 2. Kegagalan API TIDAK menghentikan alur: tahap 2 tetap
  // dibuka dalam keadaan default dengan satu kalimat netral.
  const baca = async () => {
    if (memuat) return;
    const isi = teks.trim();
    if (!isi) {
      keKonfirmasi(null, null);
      return;
    }
    setMemuat(true);
    try {
      const r = await fetch("/api/parse-preference", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teks: isi }),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const data = await r.json();
      keKonfirmasi(
        data,
        data.sumber === "fallback" ? TEKS.form.konfirmasi.tanpaAI : null,
      );
    } catch {
      keKonfirmasi(null, TEKS.form.konfirmasi.gagalBaca);
    } finally {
      setMemuat(false);
    }
  };

  const bobotFinal = () =>
    bobotDariPilihan(pilihan, setara || pilihan.length === 0, bobotBawaan);
  const kuotaPenuh = !setara && pilihan.length >= MAKS_PILIH;

  const kePeta = () => {
    onProfil({
      kampus: kampus || null,
      anggaran: adaAnggaran ? anggaran : null,
      bobot: bobotFinal(),
      ringkas: ringkasAI,
      penekanan,
      kategoriPoi,
      catatanEkstra,
      sumber: "beranda",
      teks: teks.trim(),
      // Dibaca App untuk memberi tahu peta apa yang dipilih di beranda.
      prioritas: setara || pilihan.length === 0 ? [] : pilihan,
    });
  };

  const jumlahKawasan = meta?.jumlah?.toLocaleString("id-ID") ?? "2.134";
  const tanggalData = formatTanggal(meta?.dihitung_pada);
  const belum = (k) => tidakTerbaca.includes(k);

  const ikonCentang = (
    <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true">
      <path
        d="M2.5 8.5l3.5 3.5 7.5-8"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );

  const tandaBelum = (k) =>
    belum(k) ? (
      <span className="tanda-belum">{TEKS.form.konfirmasi.tandaBelum}</span>
    ) : null;

  return (
    <div className="home-page h-full overflow-y-auto">
      <div className="home-isi">
        {/* SATU lapisan tekstur untuk seluruh halaman, bukan satu per seksi.
          Tingginya mengikuti tinggi dokumen dan ikut menggulir bersama
          konten (bukan position: fixed). */}
        <Suspense fallback={null}>
          <TeksturJalan />
        </Suspense>

        <header className="home-nav">
          <a href="#" className="brand" aria-label={TEKS.nav.labelBeranda}>
            <img className="brand-wordmark" src="/grahantara-wordmark.svg" alt="Grahantara" width="170" height="70" />
          </a>
          <nav>
            <span className="nav-active" aria-current="page">
              {TEKS.nav.beranda}
            </span>
            <button onClick={onLewati}>{TEKS.nav.peta}</button>
            <button onClick={onMetodologi}>{TEKS.nav.metodologi}</button>
          </nav>
        </header>

        {/* Bagian 1-2: dua kolom. Kiri judul, paragraf, lalu peta. Kanan kartu
          form yang berdiri sendiri, tidak melayang di atas peta. */}
        <div className="home-layout">
          <section className="home-intro">
            {/* <span> pembungkus: alas teksnya diulang per baris sehingga
                tepinya mengikuti panjang tiap baris, bukan satu kotak. */}
            <h1>
              <span className="alas-teks">{TEKS.hero.judul}</span>
            </h1>
            <p className="intro-lead">
              <span className="alas-teks">
                {TEKS.hero.pembuka(jumlahKawasan)}
              </span>
            </p>

            <Suspense
              fallback={
                <div className="hero-peta-cadangan" aria-hidden="true" />
              }
            >
              <PetaHero onBuka={onLewati} />
            </Suspense>
            <p className="hero-peta-keterangan">
              <span className="alas-teks">{TEKS.hero.keteranganPeta}</span>
            </p>
          </section>

          <section
            className="preference-card"
            aria-labelledby="judul-form"
            ref={kartuRef}
            tabIndex={-1}
          >
            {stub ? (
              <div className="peringatan-stub">
                {TEKS.form.stub(meta.versi)}
              </div>
            ) : null}

            {tahap === "tulis" ? (
              <>
                <h2 id="judul-form">{TEKS.form.tulis.judul}</h2>

                <label htmlFor="needs" className="label-tersembunyi">
                  {TEKS.form.tulis.labelTextarea}
                </label>
                <textarea
                  id="needs"
                  rows={4}
                  value={teks}
                  maxLength={500}
                  onChange={(e) => setTeks(e.target.value)}
                  placeholder={TEKS.form.tulis.placeholder}
                  className="textarea-utama"
                />

                <div className="contoh-baris">
                  {TEKS.form.tulis.contoh.map((c) => (
                    <button
                      key={c}
                      type="button"
                      className="contoh-chip"
                      onClick={() => setTeks(c)}
                    >
                      {c}
                    </button>
                  ))}
                </div>

                <button
                  type="button"
                  className="tombol-primer"
                  onClick={baca}
                  disabled={memuat}
                >
                  {memuat
                    ? TEKS.form.tulis.sedangMembaca
                    : TEKS.form.tulis.lanjut}
                </button>

                <button
                  type="button"
                  onClick={onLewati}
                  className="tombol-sekunder"
                >
                  {TEKS.form.tulis.lewatiKePeta}
                </button>

                <button
                  type="button"
                  className="tautan-lewati"
                  onClick={() => keKonfirmasi(null, null)}
                >
                  {TEKS.form.tulis.lewatiKePilihan}
                </button>
              </>
            ) : (
              <>
                <h2 id="judul-form">{TEKS.form.konfirmasi.judul}</h2>
                <p className="card-description">
                  {pesanBaca ??
                    (teks.trim()
                      ? TEKS.form.konfirmasi.dariCatatan
                      : TEKS.form.konfirmasi.tanpaCatatan)}
                </p>

                <div className="kolom-form">
                  <label className="bidang">
                    <span className="bidang-label">
                      {TEKS.form.konfirmasi.kampus} {tandaBelum("kampus")}
                    </span>
                    <select
                      value={kampus}
                      onChange={(e) => setKampus(e.target.value)}
                    >
                      <option value="">
                        {TEKS.form.konfirmasi.kampusKosong}
                      </option>
                      {DAFTAR_KAMPUS.map((k) => (
                        <option key={k} value={k}>
                          {k}
                        </option>
                      ))}
                    </select>
                  </label>

                  <div className="bidang">
                    <div className="bidang-kepala">
                      <span className="bidang-label" id="label-anggaran">
                        {TEKS.form.konfirmasi.anggaran} {tandaBelum("anggaran")}
                      </span>
                      <span className="bidang-nilai">
                        {adaAnggaran
                          ? formatRupiah(anggaran)
                          : TEKS.form.konfirmasi.anggaranTidakTahu}
                      </span>
                    </div>
                    <input
                      type="range"
                      min={ANGGARAN_MIN}
                      max={ANGGARAN_MAKS}
                      step={ANGGARAN_LANGKAH}
                      value={anggaran}
                      aria-labelledby="label-anggaran"
                      onChange={(e) => {
                        setAnggaran(Number(e.target.value));
                        setAdaAnggaran(true);
                        setCatatanAnggaran(null);
                      }}
                    />
                    {catatanAnggaran && (
                      <p className="bidang-bantuan">
                        Anggaranmu {formatRupiah(catatanAnggaran.asli)}{" "}
                        {catatanAnggaran.arah === "atas"
                          ? "melebihi"
                          : "di bawah"}{" "}
                        batas pencarian. Disesuaikan ke{" "}
                        {formatRupiah(
                          catatanAnggaran.arah === "atas"
                            ? ANGGARAN_MAKS
                            : ANGGARAN_MIN,
                        )}
                        .
                      </p>
                    )}
                    <div className="bidang-kaki">
                      <span>
                        {formatRupiah(ANGGARAN_MIN)} -{" "}
                        {formatRupiah(ANGGARAN_MAKS)}
                      </span>
                      <label className="kotak-centang">
                        <input
                          type="checkbox"
                          checked={!adaAnggaran}
                          onChange={(e) => {
                            setAdaAnggaran(!e.target.checked);
                            setCatatanAnggaran(null);
                          }}
                        />
                        {TEKS.form.konfirmasi.anggaranCentang}
                      </label>
                    </div>
                  </div>

                  <fieldset className="bidang bidang-prioritas">
                    <legend className="bidang-label">
                      {TEKS.form.konfirmasi.prioritas} {tandaBelum("prioritas")}
                    </legend>
                    {/* Batas dua pilihan dikomunikasikan lewat kontrolnya:
                      begitu kuota penuh, opsi sisanya benar-benar disabled.
                      Tidak ada kalimat bantuan yang menjelaskan batas itu. */}
                    <div className="pilih-daftar">
                      {DIMENSI_UI.map(({ kunci, label }) => {
                        const aktif = !setara && pilihan.includes(kunci);
                        const nonaktif = kuotaPenuh && !aktif;
                        return (
                          <button
                            key={kunci}
                            type="button"
                            className={`pilih-opsi${aktif ? " is-aktif" : ""}`}
                            aria-pressed={aktif}
                            disabled={nonaktif}
                            onClick={() => kePilih(kunci)}
                          >
                            <span className="pilih-kotak">
                              {aktif ? ikonCentang : null}
                            </span>
                            <span className="pilih-nama">{label}</span>
                          </button>
                        );
                      })}
                      <button
                        type="button"
                        className={`pilih-opsi pilih-setara${
                          setara ? " is-aktif" : ""
                        }`}
                        aria-pressed={setara}
                        disabled={kuotaPenuh}
                        onClick={() => {
                          // Bisa dibatalkan seperti opsi lain.
                          setSetara((v) => !v);
                          setPilihan([]);
                        }}
                      >
                        <span className="pilih-kotak">
                          {setara ? ikonCentang : null}
                        </span>
                        <span className="pilih-nama">
                          {TEKS.form.konfirmasi.prioritasSetara}
                        </span>
                      </button>
                    </div>
                  </fieldset>

                  {/* Hanya bagian yang TIDAK tertampung kontrol di atasnya.
                      Mengulang seluruh catatan membuat pengguna membaca hal
                      yang sama dua kali: kampus, anggaran, dan prioritas
                      sudah punya kontrolnya sendiri. */}
                  {catatanEkstra.length > 0 && (
                    <div className="bidang">
                      <span className="bidang-label">
                        {TEKS.form.konfirmasi.catatanmu}
                      </span>
                      <ul className="catatan-asli catatan-daftar">
                        {catatanEkstra.map((c) => (
                          <li key={c}>{c}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>

                {/* Nonaktif selama masih ada poin tersisa. Penjelasannya
                    sudah ada di penghitung sisa; tidak perlu pesan validasi
                    tersendiri. */}
                <button
                  type="button"
                  className="tombol-primer"
                  onClick={kePeta}
                >
                  {TEKS.form.konfirmasi.lihatPeta}
                </button>

                <button
                  type="button"
                  className="tombol-sekunder"
                  onClick={() => setTahap("tulis")}
                >
                  {TEKS.form.konfirmasi.kembali}
                </button>
              </>
            )}
          </section>
        </div>

        <div className="home-bawah">
          {/* Bagian 3: dua kolom selebar konten. Kiri menjelaskan APA yang dinilai,
          kanan menjelaskan BAGAIMANA menafsirkan angkanya. Tingginya memang
          berbeda dan tidak dipaksa sama. */}
          <div className="home-penjelasan">
            <section className="dimensi-bagian" aria-labelledby="judul-dimensi">
              <h2 id="judul-dimensi">{TEKS.dimensi.judul}</h2>
              <Suspense fallback={<div className="dimensi-cadangan" />}>
                <SebaranDimensi dimensi={DIMENSI} onCakupan={setDimensiKurang} />
              </Suspense>
              <p className="dimensi-catatan">
                {TEKS.dimensi.catatan(jumlahKawasan, dimensiKurang)}
              </p>
            </section>
          </div>
        </div>

        {/* Seksi gelap selebar layar (full-bleed), memakai warna gelap yang sama
          dengan basemap peta. Pergantian terang-gelap ini yang memberi ritme
          halaman. Tekstur jalan tetap tampil di sini, versi terang di atas
          gelap. */}
        <section className="home-data" aria-labelledby="judul-data">
          {/* Pita gelap ini menutupi lapisan tekstur di level halaman, jadi ia
            membawa salinannya sendiri: versi terang di atas gelap, opasitas
            lebih tinggi. */}
          <Suspense fallback={null}>
            <TeksturJalan />
          </Suspense>
          <div className="data-isi">
            <h2 id="judul-data">{TEKS.data.judul}</h2>
            <div className="data-catatan">
              {TEKS.data.catatan.map((p) => (
                <p key={p}>{p}</p>
              ))}
            </div>
            <div className="data-grid">
              <div>
                <AngkaNaik nilai={meta?.jumlah ?? 2134} id="kawasan" />
                <span>{TEKS.data.angka.kawasan}</span>
              </div>
              <div>
                {/* Dihitung dari daftar kampus, bukan ditulis tangan, supaya
                  tidak pernah berbeda dari penanda di peta. */}
                <AngkaNaik nilai={DAFTAR_KAMPUS.length} id="kampus" />
                <span>{TEKS.data.angka.kampus}</span>
              </div>
              <div>
                <AngkaNaik nilai={16} id="indikator" />
                <span>{TEKS.data.angka.indikator}</span>
              </div>
            </div>
            <p className="data-versi">
              {TEKS.data.versi(meta?.versi ?? "-", tanggalData)}{" "}
              <button onClick={onMetodologi}>
                {TEKS.data.tautanMetodologi}
              </button>
            </p>
          </div>
        </section>

        <footer className="home-footer">
          <div className="footer-brand">
            <img className="brand-wordmark" src="/grahantara-wordmark.svg" alt={TEKS.footer.nama} width="170" height="70" loading="lazy" />
            <span>{TEKS.footer.deskripsi}</span>
          </div>
          <nav className="footer-nav">
            <button onClick={onLewati}>{TEKS.footer.peta}</button>
            <button onClick={onMetodologi}>{TEKS.footer.metodologi}</button>
          </nav>
          <div className="footer-meta">
            <span>
              {tanggalData
                ? TEKS.footer.diperbarui(tanggalData)
                : TEKS.footer.versiCadangan(meta?.versi ?? "-")}
            </span>
            <span>{TEKS.footer.tim}</span>
          </div>
        </footer>
      </div>
    </div>
  );
}
