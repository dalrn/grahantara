import { PanelMotion, Collapse } from "./Motion";
import { useEffect, useState } from "react";

import {
  KELOMPOK_INDIKATOR,
  NAMA_INDIKATOR,
  DIMENSI_UI,
  LABEL_SUMBER,
} from "../lib/kamus";
import { warnaTeksSkor } from "../lib/kelas";
import { formatSkor, formatCoordinates } from "../lib/format";
import { muatanIndikatorAI } from "../lib/bahasaIndikator";
import { BOBOT_DEFAULT } from "../config";
import BarisIndikator, { Lencana } from "./BarisIndikator";
import DaftarPoi from "./DaftarPoi";

// MapLibre menyerikan array/objek bersarang jadi string JSON; pulihkan.
function daftarKosong(x) {
  if (Array.isArray(x)) return new Set(x);
  if (typeof x === "string") {
    try {
      return new Set(JSON.parse(x));
    } catch {
      return new Set();
    }
  }
  return new Set();
}

function BlokInsight({ heksagon, bobotKini, narasi, padaJelaskan }) {
  const [memuat, setMemuat] = useState(false);
  const [galat, setGalat] = useState(null);

  useEffect(() => {
    setMemuat(false);
    setGalat(null);
  }, [heksagon.h3_index]);

  const kirim = async () => {
    setMemuat(true);
    setGalat(null);
    try {
      const bobot = bobotKini
        ? Object.fromEntries(
            Object.entries(bobotKini).map(([k, v]) => [k, Math.round(v * 100)]),
          )
        : Object.fromEntries(
            Object.entries(BOBOT_DEFAULT).map(([k, v]) => [
              k,
              Math.round(v * 100),
            ]),
          );
      const indikator = [];
      for (const kelompok of KELOMPOK_INDIKATOR) {
        for (const k of kelompok.kunci) {
          indikator.push(
            muatanIndikatorAI(k, heksagon.indikator?.[k], NAMA_INDIKATOR[k] ?? k),
          );
        }
      }
      const r = await fetch("/api/explain-score", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          h3_index: heksagon.h3_index,
          skor: heksagon.skor,
          subskor: heksagon.subskor,
          dimensiKosong: heksagon.dimensi_kosong ?? [],
          bobot,
          indikator,
        }),
      });
      if (!r.ok) {
        const j = await r.json().catch(() => null);
        setGalat(j?.galat ?? `Server menjawab ${r.status}.`);
        return;
      }
      const hasil = await r.json();
      padaJelaskan(heksagon.h3_index, hasil);
    } catch {
      setGalat("Tidak dapat menghubungi server. Coba lagi.");
    } finally {
      setMemuat(false);
    }
  };

  return (
    <div className="border-t border-white/10 py-3">
      <div className="text-sm font-semibold text-white">Ringkasan</div>
      {!narasi && !memuat && !galat && (
        <button
          onClick={kirim}
          className="tombol-aksi mt-2 w-full rounded px-2 py-1.5 text-xs font-semibold"
        >
          Jelaskan kawasan ini
        </button>
      )}
      {memuat && (
        <div className="mt-2 text-xs text-slate-400">
          Menyusun penjelasan...
        </div>
      )}
      {galat && (
        <div className="mt-2 rounded bg-red-900/60 p-2 text-xs text-red-100">
          {galat}{" "}
          <button onClick={kirim} className="underline">
            Coba lagi
          </button>
        </div>
      )}
      {narasi && (
        <div className="mt-2 space-y-1.5 text-xs">
          {/* Kata, bukan simbol: tidak ada legenda untuk panah naik/turun,
              dan artinya sudah jelas kalau ditulis. */}
          {narasi.kekuatan?.map((k) => (
            <div key={k} className="flex gap-2 text-emerald-300">
              <span className="shrink-0 font-semibold">Unggul</span>
              <span>{k}</span>
            </div>
          ))}
          {narasi.kelemahan?.map((k) => (
            <div key={k} className="flex gap-2 text-yellow-300">
              <span className="shrink-0 font-semibold">Lemah</span>
              <span>{k}</span>
            </div>
          ))}
          <div className="pt-1 italic text-slate-300">{narasi.ringkas}</div>
          {narasi.sumber === "fallback" && (
            <div className="rounded bg-yellow-700 px-2 py-1 text-xs font-semibold text-white">
              Disusun tanpa AI. Layanan bahasa tidak merespons.
            </div>
          )}
          <div className="text-xs text-slate-500">
            Disusun AI dari angka pada panel ini.
          </div>
        </div>
      )}
    </div>
  );
}

function BlokDimensi({
  kelompok,
  subskor,
  indikator,
  bobot,
  kosong,
  terbuka,
  onToggle,
  angkaMentah,
  h3Index,
  kategoriPoi,
}) {
  const nilai = subskor?.[kelompok.dimensi];
  const kosongDimensi = kosong.has(kelompok.dimensi) || !Number.isFinite(nilai);
  const w = bobot ? bobot[kelompok.dimensi] : null;
  // Bobot yang tertera dinormalisasi ulang atas dimensi yang ADA saja,
  // mengikuti aturan mesinSkor (dimensi kosong dikeluarkan dari skor).
  let wTampil = w;
  if (w !== null && kosong.size > 0) {
    const totalAda = KELOMPOK_INDIKATOR.reduce(
      (t, k) => (kosong.has(k.dimensi) ? t : t + (bobot[k.dimensi] ?? 0)),
      0,
    );
    if (totalAda > 0) wTampil = w / totalAda;
  }
  return (
    <div className="border-t border-white/10 py-3">
      <button
        onClick={onToggle}
        className="flex w-full items-center justify-between text-left"
        aria-expanded={terbuka}
      >
        <span className="text-sm font-semibold text-white">
          {kelompok.label}
          {wTampil !== null && !kosongDimensi && (
            <span className="ml-1 text-xs font-normal text-slate-400">
              (bobot{" "}
              {(wTampil * 100).toLocaleString("id-ID", {
                maximumFractionDigits: 1,
              })}
              %)
            </span>
          )}
        </span>
        <span className="flex items-center gap-2">
          {kosongDimensi ? (
            <Lencana
              teks="Tidak tersedia"
              warna="bg-slate-700 text-slate-300"
            />
          ) : (
            <span className="text-sm font-bold text-emerald-400">
              {formatSkor(nilai)}
            </span>
          )}
          <span className="text-xs text-slate-400">{terbuka ? "▴" : "▾"}</span>
        </span>
      </button>
      {kosongDimensi ? (
        <div className="mt-1 text-xs italic text-slate-400">
          {kelompok.label} tidak punya data dan dikeluarkan dari perhitungan
          skor
        </div>
      ) : (
        <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full rounded-full bg-emerald-400"
            style={{ width: `${Math.max(0, Math.min(100, nilai ?? 0))}%` }}
          />
        </div>
      )}
      <Collapse open={terbuka}>
        <div className="mt-2 divide-y divide-white/5">
          {kelompok.kunci.map((k) => (
            <BarisIndikator
              key={k}
              kunci={k}
              data={indikator?.[k]}
              angkaMentah={angkaMentah}
            />
          ))}
        </div>
        {/* Fasilitas adalah satu-satunya dimensi yang bisa dijawab dengan
            DAFTAR TEMPAT, bukan hanya angka. "Apa saja dan di mana" adalah
            pertanyaan berikutnya yang pasti muncul. */}
        {kelompok.dimensi === "amenity" && h3Index && (
          <DaftarPoi
            h3Index={h3Index}
            sorot={kategoriPoi}
            jumlahRadius={indikator?.M1_kepadatan_makan?.nilai}
          />
        )}
      </Collapse>
    </div>
  );
}

/**
 * Bobot yang dipakai, sebagai daftar berlabel.
 *
 * Tiap dimensi jadi satu baris nama + persen, dipisahkan garis tipis, dengan
 * judul kecil di atasnya. Titik-tengah melayang hilang, dan pembaca bisa
 * memindai satu dimensi tanpa membaca seluruh kalimat.
 */
function BlokBobot({ judul, daftar }) {
  return (
    <div className="blok-bobot">
      <div className="blok-bobot-judul">{judul}</div>
      <dl className="blok-bobot-daftar">
        {daftar.map(({ label, persen }) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{persen}%</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function formatTanggal(iso) {
  if (typeof iso !== "string") return null;
  const t = new Date(iso);
  if (Number.isNaN(t.getTime())) return null;
  return t.toLocaleDateString("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

export default function PanelKawasan({
  heksagon,
  versi,
  dihitungPada,
  bobotDariMetadata,
  bobotBawaan,
  skorKini,
  bobotKini,
  ambangSkor,
  onTutup,
  onTabRinci,
  kategoriPoi,
  narasiCache,
  simpanNarasi,
}) {
  // Semua dimensi TERTUTUP saat panel dibuka: tab gabungan ini pertama-tama
  // adalah daftar subskor, dan indikator penyusunnya muncul hanya bila
  // dimensinya diklik. Membuka keempatnya sekaligus mengubur subskor di
  // antara 16 baris indikator.
  const [terbuka, setTerbuka] = useState(() => new Set());

  const [activeTab, setActiveTab] = useState("Ringkasan");
  // Satu toggle untuk SELURUH panel, bukan satu per baris.
  const [angkaMentah, setAngkaMentah] = useState(false);
  useEffect(() => setActiveTab("Ringkasan"), [heksagon?.h3_index]);
  if (!heksagon) return null;

  const kosong = daftarKosong(heksagon.dimensi_kosong);
  // Sebut NAMA dimensinya, bukan hanya jumlahnya: "Satu dimensi tidak punya
  // data" memaksa pengguna pindah tab hanya untuk tahu dimensi mana. Kalimat
  // soal pembagian bobot digabung ke sini karena keduanya menjelaskan satu
  // hal yang sama.
  const namaKosong = DIMENSI_UI.filter(({ kunci }) => kosong.has(kunci)).map(
    ({ label }) => label,
  );
  const daftarNamaKosong =
    namaKosong.length <= 1
      ? (namaKosong[0] ?? "")
      : `${namaKosong.slice(0, -1).join(", ")} dan ${namaKosong[namaKosong.length - 1]}`;
  const catatanKosong =
    namaKosong.length > 0
      ? `${daftarNamaKosong} tidak punya data di kawasan ini, jadi ${namaKosong.length > 1 ? "keduanya dikeluarkan" : "dimensi itu dikeluarkan"} dari perhitungan dan bobotnya dibagi ke dimensi lain.`
      : null;

  // Bobot bawaan ditulis dengan nama dimensi lengkap dan persentase, bukan
  // singkatan "C 0,40 / A 0,25 / M 0,20 / W 0,15": itu nama variabel internal
  // berbahasa Inggris yang tidak punya kunci di mana pun di antarmuka.
  // Angkanya dari metadata bila ada, bukan ditulis tangan.
  const bobotBawaanTampil = bobotBawaan ?? BOBOT_DEFAULT;
  // Daftar terstruktur, BUKAN satu kalimat panjang bertitik-tengah melayang.
  // Versi lama berbunyi "pada bobot bawaan Akses transportasi 40% · Biaya 25%
  // · ...", mengalir tanpa jeda, dan titik pemisahnya menggantung di ujung
  // baris saat teksnya terpotong.
  // Bobot yang SEDANG dipakai bila pengguna sudah menggesernya. bobotKini
  // datang sebagai pecahan ternormalisasi (jumlahnya 1).
  const daftarBobotKini = bobotKini
    ? DIMENSI_UI.map(({ kunci, label }) => ({
        label,
        persen: Math.round((bobotKini[kunci] ?? 0) * 100),
      }))
    : [];
  const daftarBobot = DIMENSI_UI.map(({ kunci, label }) => {
    const v = bobotBawaanTampil[kunci] ?? 0;
    // bobotBawaan datang sebagai skala 0-100, BOBOT_DEFAULT sebagai pecahan.
    return { label, persen: Math.round(v > 1 ? v : v * 100) };
  });

  const toggle = (dimensi) => {
    setTerbuka((sebelum) => {
      const baru = new Set(sebelum);
      if (baru.has(dimensi)) baru.delete(dimensi);
      else baru.add(dimensi);
      return baru;
    });
  };

  const pakaiBobotAnda = skorKini !== null && bobotKini !== null;

  // Sumber unik yang benar-benar dipakai di kawasan ini, untuk baris ringkas
  // di bawah daftar indikator. "model" tidak ikut: penandanya sudah ada di
  // barisnya sendiri sebagai lencana "Estimasi".
  const daftarSumber = [
    ...new Set(
      KELOMPOK_INDIKATOR.flatMap((kel) => kel.kunci)
        .map((k) => heksagon.indikator?.[k])
        .filter(
          (ik) =>
            ik &&
            ik.nilai !== null &&
            ik.sumber &&
            ik.sumber !== "tidak_tersedia" &&
            ik.sumber !== "model",
        )
        .map((ik) => LABEL_SUMBER[ik.sumber] ?? ik.sumber),
    ),
  ];

  return (
    <PanelMotion className="detail-panel absolute inset-x-0 bottom-0 z-20 flex h-[70dvh] flex-col rounded-t-2xl bg-slate-900/95 text-white shadow-2xl backdrop-blur-sm md:inset-x-auto md:inset-y-0 md:right-0 md:h-full md:w-[380px] md:rounded-none">
      <div className="mx-auto mt-1.5 h-1 w-10 shrink-0 rounded-full bg-white/25 md:hidden" />
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
        <span className="text-sm font-semibold">Kawasan terpilih</span>
        <button
          onClick={onTutup}
          className="rounded p-1 text-slate-400 hover:bg-white/10 hover:text-white"
          aria-label="Tutup panel"
        >
          ✕
        </button>
      </div>
      <div className="panel-tabs" role="tablist" aria-label="Detail kawasan">
        {["Ringkasan", "Rincian skor"].map((tab) => (
          <button
            key={tab}
            role="tab"
            aria-selected={activeTab === tab}
            onClick={() => {
              setActiveTab(tab);
              // Membuka Subskor / 16 Indikator = saat pengguna bertanya dari
              // mana angkanya. Itu pemicu petunjuk Metodologi.
              if (tab !== "Ringkasan") onTabRinci?.();
            }}
          >
            {tab}
          </button>
        ))}
      </div>
      <div
        role="tabpanel"
        aria-label={activeTab}
        className="flex-1 overflow-y-auto px-4 pb-4"
      >
        {/* Nama desa/kelurahan dari basemap, bukan koordinat: lintang-bujur
            tidak berarti apa-apa bagi pembaca, dan huruf monospace membuatnya
            makin terbaca sebagai kode. Koordinat turun ke balik toggle angka
            mentah. Kalau basemap belum memuat nama tempat, koordinat tetap
            tampil sebagai cadangan, tapi sebagai teks biasa. */}
        <div className="select-text pt-2 text-xs text-slate-400">
          {heksagon.namaTempat ?? formatCoordinates(heksagon.coordinates)}
        </div>
        {angkaMentah && heksagon.namaTempat && (
          <div className="select-text text-xs text-slate-500">
            Titik tengah: {formatCoordinates(heksagon.coordinates)}
          </div>
        )}
        {pakaiBobotAnda ? (
          <>
            <div className="text-xs text-slate-400">Skor dengan bobot Anda</div>
            {/* Angka skor diberi warna dari skala yang sama dengan heksagon:
                merah rendah, hijau tinggi. Pembaca tidak perlu membandingkan
                dengan legenda untuk tahu 34 itu buruk. */}
            <div
              className="text-4xl font-bold"
              style={{ color: warnaTeksSkor(skorKini, ambangSkor) ?? undefined }}
            >
              {formatSkor(skorKini)}
            </div>
            <BlokBobot judul="Bobot pilihanmu" daftar={daftarBobotKini} />
          </>
        ) : (
          <>
            <div
              className="text-4xl font-bold"
              style={{
                color: warnaTeksSkor(heksagon.skor, ambangSkor) ?? undefined,
              }}
            >
              {formatSkor(heksagon.skor)}
            </div>
            <BlokBobot judul="Bobot bawaan" daftar={daftarBobot} />
          </>
        )}
        {!bobotDariMetadata && (
          <div className="text-xs text-slate-500">
            Bobot bawaan diasumsikan dari dokumen proyek. GeoJSON belum memuat
            metadata.bobot_default.
          </div>
        )}
        {catatanKosong && (
          <div className="mt-1 rounded bg-slate-800 px-2 py-1 text-xs text-slate-300">
            {catatanKosong}
          </div>
        )}

        {activeTab === "Ringkasan" && (
          <BlokInsight
            heksagon={heksagon}
            bobotKini={bobotKini}
            narasi={narasiCache?.[heksagon.h3_index]}
            padaJelaskan={(h3, hasil) => simpanNarasi(h3, hasil)}
          />
        )}

        {activeTab !== "Ringkasan" && (
          <div>
            {/* Subskor dan skor komposit adalah DUA SKALA BERBEDA. Subskor
                membentang hampir 0-100, sedangkan skor komposit yang diwarnai
                di peta terkumpul di tengah karena rata-rata geometrik menarik
                nilai ekstrem ke tengah. Tanpa keterangan ini, subskor 88 di
                sebelah legenda yang berhenti di 75 terbaca seperti kesalahan. */}
            <p className="mt-2 text-xs leading-snug text-slate-500">
              Klik satu dimensi untuk melihat indikator penyusunnya. Subskor
              dinilai per dimensi, jadi rentangnya lebih lebar daripada rentang
              skor gabungan di legenda peta.
            </p>
            {KELOMPOK_INDIKATOR.map((kelompok) => (
              <BlokDimensi
                key={kelompok.dimensi}
                kelompok={kelompok}
                subskor={heksagon.subskor}
                indikator={heksagon.indikator}
                bobot={bobotKini}
                kosong={kosong}
                angkaMentah={angkaMentah}
                h3Index={heksagon.h3_index}
                kategoriPoi={kategoriPoi}
                terbuka={
                  terbuka.has(kelompok.dimensi)
                }
                onToggle={() => toggle(kelompok.dimensi)}
              />
            ))}
          </div>
        )}

        {activeTab !== "Ringkasan" && (
          <div className="mt-3 border-t border-white/10 pt-2">
            <label className="toggle-mentah">
              <input
                type="checkbox"
                checked={angkaMentah}
                onChange={(e) => setAngkaMentah(e.target.checked)}
              />
              Tampilkan angka mentah
            </label>
            {/* Sumber data diringkas SATU baris di bawah daftar, bukan 16
                lencana di tiap baris. "Sentinel-2" tidak berarti apa-apa bagi
                mahasiswa baru dan hanya jadi kebisingan bila diulang. Sumber
                per indikator muncul bersama angka mentah. */}
            {daftarSumber.length > 0 && (
              <p className="mt-2 text-xs leading-snug text-slate-500">
                Sumber data kawasan ini: {daftarSumber.join(", ")}.
              </p>
            )}
          </div>
        )}

        <div className="border-t border-white/10 pt-2 text-xs text-slate-500">
          {typeof versi === "string" && versi.startsWith("stub")
            ? `Data ${versi ?? "stub"}. Angka acak, bukan hasil analisis.`
            : versi
              ? `Data versi ${versi}${formatTanggal(dihitungPada) ? `, dihitung ${formatTanggal(dihitungPada)}.` : "."}`
              : ""}
        </div>
      </div>
    </PanelMotion>
  );
}
