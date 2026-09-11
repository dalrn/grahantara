import { lazy, Suspense, useEffect, useRef, useState } from "react";

import { DAFTAR_KAMPUS } from "../kampus.js";
import { DIMENSI_UI } from "../lib/kamus";
import { TEKS } from "../content/landing.js";

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
// 0,25 per dimensi — identik dengan keempatnya di minimum dan identik dengan
// tidak mengisi apa pun. Pengguna merasa sudah menyetel padahal hasilnya sama
// dengan bawaan. Batas dua pilihan membuat perbedaan bobot selalu nyata.
//
// Angka final (didokumentasikan di halaman Metodologi):
//   dua terpilih  -> 40/40/10/10 = 40% 40% 10% 10%
//   satu terpilih -> 40/10/10/10 = 57% 14% 14% 14%
//   "semuanya sama" -> 25 merata = 25% masing-masing
const BOBOT_DIPILIH = 40;
const BOBOT_SISA = 10;
const BOBOT_SETARA = 25;
const MAKS_PILIH = 2;

function bobotDariPilihan(pilihan, setara) {
  const b = {};
  for (const { kunci } of DIMENSI_UI) {
    if (setara) b[kunci] = BOBOT_SETARA;
    else b[kunci] = pilihan.includes(kunci) ? BOBOT_DIPILIH : BOBOT_SISA;
  }
  return b;
}

// Persentase relatif: angka yang benar-benar dipakai skor.
function persenBobot(bobot) {
  const total = DIMENSI_UI.reduce((a, { kunci }) => a + (bobot[kunci] ?? 0), 0);
  const out = {};
  for (const { kunci } of DIMENSI_UI) {
    out[kunci] =
      total > 0 ? Math.round(((bobot[kunci] ?? 0) / total) * 100) : 25;
  }
  return out;
}

// Rentang anggaran dari survei kos: 30 kos terdata, Rp 350.000-1.400.000.
// Slider dibulatkan ke luar supaya ujungnya tidak terasa mentok.
const ANGGARAN_MIN = 300000;
const ANGGARAN_MAKS = 1500000;
const ANGGARAN_LANGKAH = 50000;
const ANGGARAN_AWAL = 800000;

const formatRupiah = (n) =>
  Number.isFinite(n) ? `Rp ${n.toLocaleString("id-ID")}` : "";

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
  const [pilihan, setPilihan] = useState(profilAwal?.prioritas ?? []);
  const [setara, setSetara] = useState(
    Boolean(profilAwal) && (profilAwal.prioritas ?? []).length === 0,
  );
  // Dimensi yang TIDAK berhasil diisi dari narasi; dipakai untuk penanda halus.
  const [tidakTerbaca, setTidakTerbaca] = useState([]);
  const [ringkasAI, setRingkasAI] = useState(null);
  const [pesanBaca, setPesanBaca] = useState(null);
  const kartuRef = useRef(null);

  useEffect(() => {
    // Metadata saja (ratusan byte). Sebelumnya berkas heksagon 4,5 MB ikut
    // diunduh di beranda hanya untuk membaca metadata; berkas itu kini
    // ditinggalkan untuk halaman peta.
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
      if (hasil.anggaran != null) {
        setAnggaran(hasil.anggaran);
        setAdaAnggaran(true);
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
    } else {
      setTidakTerbaca([]);
      setRingkasAI(null);
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
    bobotDariPilihan(pilihan, setara || pilihan.length === 0);

  const kePeta = () => {
    onProfil({
      kampus: kampus || null,
      anggaran: adaAnggaran ? anggaran : null,
      bobot: bobotFinal(),
      ringkas: ringkasAI,
      sumber: "beranda",
      teks: teks.trim(),
      // Dibaca App untuk memberi tahu peta apa yang dipilih di beranda.
      prioritas: setara || pilihan.length === 0 ? [] : pilihan,
    });
  };

  const jumlahKawasan = meta?.jumlah?.toLocaleString("id-ID") ?? "2.134";
  const tanggalData = formatTanggal(meta?.dihitung_pada);
  const kuotaPenuh = !setara && pilihan.length >= MAKS_PILIH;
  const persen = persenBobot(bobotFinal());
  const belum = (k) => tidakTerbaca.includes(k);

  const tandaBelum = (k) =>
    belum(k) ? (
      <span className="tanda-belum">{TEKS.form.konfirmasi.tandaBelum}</span>
    ) : null;

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

  return (
    <div className="home-page h-full overflow-y-auto">
      <header className="home-nav">
        <a href="#" className="brand" aria-label={TEKS.nav.labelBeranda}>
          <span className="brand-mark" aria-hidden="true">
            <img src="/grahantara-mark.svg" alt="" width="40" height="47" />
          </span>
          grahantara
        </a>
        <nav>
          <span className="nav-active" aria-current="page">
            {TEKS.nav.beranda}
          </span>
          <button onClick={onLewati}>{TEKS.nav.peta}</button>
          <button onClick={onMetodologi}>{TEKS.nav.metodologi}</button>
        </nav>
      </header>

      {/* Bagian 1-2: judul melebar di atas, peta selebar konten di bawahnya,
          kartu form melayang di sisi kanan peta pada layar lebar. Di layar
          sempit kartu turun ke bawah peta (lihat .home-layout di index.css). */}
      <section className="home-intro">
        <h1>{TEKS.hero.judul}</h1>
        <p className="intro-lead">{TEKS.hero.pembuka(jumlahKawasan)}</p>
      </section>

      <div className="home-layout">
        <div className="hero-peta-wadah">
          <Suspense
            fallback={<div className="hero-peta-cadangan" aria-hidden="true" />}
          >
            <PetaHero onBuka={onLewati} />
          </Suspense>
          <p className="hero-peta-keterangan">{TEKS.hero.keteranganPeta}</p>
        </div>

        <section
          className="preference-card"
          aria-labelledby="judul-form"
          ref={kartuRef}
          tabIndex={-1}
        >
          {stub ? (
            <div className="peringatan-stub">{TEKS.form.stub(meta.versi)}</div>
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
                    }}
                  />
                  <div className="bidang-kaki">
                    <span>
                      {formatRupiah(ANGGARAN_MIN)} –{" "}
                      {formatRupiah(ANGGARAN_MAKS)}
                    </span>
                    <label className="kotak-centang">
                      <input
                        type="checkbox"
                        checked={!adaAnggaran}
                        onChange={(e) => setAdaAnggaran(!e.target.checked)}
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
                          <span className="pilih-persen">{persen[kunci]}%</span>
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
                        setSetara(true);
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

                {teks.trim() && (
                  <div className="bidang">
                    <span className="bidang-label">
                      {TEKS.form.konfirmasi.catatanmu}
                    </span>
                    <p className="catatan-asli">{teks.trim()}</p>
                  </div>
                )}
              </div>

              <button type="button" className="tombol-primer" onClick={kePeta}>
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

      {/* Tekstur jaringan jalan hanya di bagian bawah halaman. Sengaja TIDAK
          dipasang di belakang peta hero: akan bertabrakan dengan basemap. */}
      <div className="home-bawah">
        <Suspense fallback={null}>
          <TeksturJalan />
        </Suspense>

        {/* Bagian 3: dua kolom selebar konten. Kiri menjelaskan APA yang dinilai,
          kanan menjelaskan BAGAIMANA menafsirkan angkanya. Tingginya memang
          berbeda dan tidak dipaksa sama. */}
        <div className="home-penjelasan">
          <section className="dimensi-bagian" aria-labelledby="judul-dimensi">
            <h2 id="judul-dimensi">{TEKS.dimensi.judul}</h2>
            <Suspense fallback={<div className="dimensi-cadangan" />}>
              <SebaranDimensi dimensi={DIMENSI} />
            </Suspense>
            <p className="dimensi-catatan">
              {TEKS.dimensi.catatan(jumlahKawasan)}
            </p>
          </section>

          <section className="home-data" aria-labelledby="judul-data">
            <h2 id="judul-data">{TEKS.data.judul}</h2>
            <div className="data-catatan">
              {TEKS.data.catatan.map((p) => (
                <p key={p}>{p}</p>
              ))}
            </div>
            <div className="data-grid">
              <div>
                <strong>{jumlahKawasan}</strong>
                <span>{TEKS.data.angka.kawasan}</span>
              </div>
              <div>
                {/* Dihitung dari daftar kampus, bukan ditulis tangan, supaya
                  tidak pernah berbeda dari penanda di peta. */}
                <strong>{DAFTAR_KAMPUS.length}</strong>
                <span>{TEKS.data.angka.kampus}</span>
              </div>
              <div>
                <strong>16</strong>
                <span>{TEKS.data.angka.indikator}</span>
              </div>
            </div>
            <p className="data-versi">
              {TEKS.data.versi(meta?.versi ?? "—", tanggalData)}{" "}
              <button onClick={onMetodologi}>
                {TEKS.data.tautanMetodologi}
              </button>
            </p>
          </section>
        </div>
      </div>

      <footer className="home-footer">
        <div className="footer-brand">
          <strong>{TEKS.footer.nama}</strong>
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
              : TEKS.footer.versiCadangan(meta?.versi ?? "—")}
          </span>
          <span>{TEKS.footer.tim}</span>
        </div>
      </footer>
    </div>
  );
}
