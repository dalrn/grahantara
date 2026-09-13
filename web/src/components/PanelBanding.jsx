import { useEffect, useState } from "react";

import { PanelMotion } from "./Motion";

import { KELOMPOK_INDIKATOR, NAMA_INDIKATOR, DIMENSI_UI } from "../lib/kamus";
import { formatNilai, formatSkor, formatCoordinates } from "../lib/format";
import { warnaTeksSkor } from "../lib/kelas";
import { bandingColors } from "../design";
import { SEBARAN_DIMENSI, AMBANG_SELISIH } from "../config";
import {
  labelKualitatif,
  kalimatKonteks,
  satuanAbstrak,
} from "../lib/bahasaIndikator";

// Warna A/B dari satu sumber (design.js), sama persis dengan garis heksagon
// di peta dan pin kos, supaya kartu di panel bisa langsung dicocokkan dengan
// heksagon yang disorot. Keduanya di luar skala skor agar tidak tertukar
// artinya dengan warna heksagon.
const WARNA_A = bandingColors.a;
const WARNA_B = bandingColors.b;

// Subskor dan selisihnya dibulatkan, sama dengan formatSkor: satu desimal
// pada peringkat persentil menyiratkan ketelitian yang tidak ada.
const fmtAngka = (v) =>
  typeof v === "number" ? Math.round(v).toLocaleString("id-ID") : "-";

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

// Label band dari legenda, supaya skor tidak tampil sebagai angka telanjang.
function bandSkor(skor, ambang) {
  if (!Number.isFinite(skor)) return null;
  const batas = ambang ?? [20, 40, 60, 80];
  const i = batas.filter((t) => skor >= t).length;
  return ["Rendah", "Rendah", "Menengah", "Tinggi", "Tinggi"][i];
}

export default function PanelBanding({
  pilihan,
  skorKini,
  versi,
  dihitungPada,
  ambangSkor,
  onTutup,
  onGanti,
  hasilBanding,
  galat,
  padaBanding,
}) {
  const a = pilihan.a;
  const b = pilihan.b;
  const [detailTerbuka, setDetailTerbuka] = useState(false);
  const [angkaMentah, setAngkaMentah] = useState(false);
  const [kosongTerbuka, setKosongTerbuka] = useState(false);

  const memuat = hasilBanding === "memuat";
  const hasil = memuat ? null : hasilBanding;

  const kosongA = daftarKosong(a?.dimensi_kosong);
  const kosongB = daftarKosong(b?.dimensi_kosong);

  const skorA = skorKini?.a;
  const skorB = skorKini?.b;

  // Vonis non-AI dihitung langsung dari selisih skor, jadi panel tidak pernah
  // kosong sambil menunggu AI. Begitu hasil AI datang, ringkasannya dipakai
  // untuk memperkaya bagian ini.
  const selisih =
    Number.isFinite(skorA) && Number.isFinite(skorB) ? skorA - skorB : null;
  const pemenang =
    selisih === null ? null : selisih > 0.05 ? "A" : selisih < -0.05 ? "B" : null;

  // Tiga selisih dimensi terbesar, jadi kalimat alasan.
  // Selisih dinilai terhadap simpangan baku dimensinya. Sd berbeda sampai
  // 3,4 kali antar dimensi: 7 poin hampir satu sd di Lingkungan jalan kaki
  // (sd 7,6), tetapi hanya 0,27 sd di Biaya (sd 25,6).
  const nilaiSelisih = (kunci, beda) => {
    const sd = SEBARAN_DIMENSI[kunci]?.simpanganBaku;
    if (!sd) return { rasio: null, tingkat: null };
    const rasio = Math.abs(beda) / sd;
    return {
      rasio,
      tingkat:
        rasio >= AMBANG_SELISIH.BESAR
          ? "selisih besar"
          : rasio >= AMBANG_SELISIH.SEDANG
            ? "selisih sedang"
            : "selisih kecil",
    };
  };

  const semuaSelisih = (() => {
    if (!a || !b) return [];
    const keluar = [];
    for (const { kunci, label } of DIMENSI_UI) {
      const vA = a.subskor?.[kunci];
      const vB = b.subskor?.[kunci];
      if (kosongA.has(kunci) || kosongB.has(kunci)) continue;
      if (!Number.isFinite(vA) || !Number.isFinite(vB)) continue;
      const beda = vA - vB;
      keluar.push({ kunci, label, beda, ...nilaiSelisih(kunci, beda) });
    }
    return keluar;
  })();

  // Dua kawasan praktis setara bila SELURUH selisihnya kecil. Kasus ini butuh
  // kalimat yang berbeda, bukan mengumumkan pemenang dari selisih 0,3 poin.
  const praktisSetara =
    semuaSelisih.length > 0 &&
    semuaSelisih.every((x) => x.tingkat === "selisih kecil");

  const alasan = semuaSelisih
    .filter((x) => x.tingkat !== "selisih kecil")
    .sort((x, y) => (y.rasio ?? 0) - (x.rasio ?? 0))
    .slice(0, 3);

  // AI dipanggil otomatis begitu dua kawasan lengkap; vonis non-AI sudah
  // tampil lebih dulu sehingga tidak ada layar kosong.
  useEffect(() => {
    if (a && b && hasilBanding === null) padaBanding();
    // padaBanding stabil dari App; sengaja hanya bergantung pada pasangan.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [a?.h3_index, b?.h3_index]);

  const dimUnggul = (k, dX, dY) => {
    const ix = dX?.indikator?.[k];
    const iy = dY?.indikator?.[k];
    const takTersedia = (i) =>
      !i || i.sumber === "tidak_tersedia" || i.nilai === null;
    if (takTersedia(ix) || takTersedia(iy)) return null;
    if (Number.isFinite(ix.persentil) && Number.isFinite(iy.persentil)) {
      if (ix.persentil > iy.persentil) return "A";
      if (iy.persentil > ix.persentil) return "B";
    }
    return null;
  };

  const Kartu = ({ data, warna, label, skor, ganti }) => {
    const band = bandSkor(skor, ambangSkor);
    return (
      <div
        className="kartu-banding min-w-0 flex-1"
        data-huruf={label}
        style={{
          "--warna-banding": warna,
          // Latar bersemu warna A/B supaya kartunya langsung terbaca sebagai
          // pasangan heksagon yang disorot di peta.
          background: `color-mix(in srgb, ${warna} 7%, #111c2e)`,
          borderColor: warna,
        }}
      >
        <div className="flex items-center justify-between">
          <span className="kartu-banding-judul" style={{ color: warna }}>
            Kawasan {label}
          </span>
          <button
            onClick={ganti}
            className="text-xs text-slate-400 underline hover:text-white"
          >
            ganti
          </button>
        </div>
        {/* Nama desa dari basemap; koordinat turun ke detail. */}
        <div className="truncate text-xs text-slate-300">
          {data?.namaTempat ?? "Kawasan terpilih"}
        </div>
        <div
          className="text-2xl font-bold"
          style={{ color: warnaTeksSkor(skor, ambangSkor) ?? undefined }}
        >
          {skor !== null && skor !== undefined ? formatSkor(skor) : "-"}
        </div>
        {band && <div className="text-xs text-slate-400">{band}</div>}
      </div>
    );
  };

  if (!a || !b) {
    // Bar kompak: jangan menutupi peta saat satu slot masih kosong.
    return (
      <PanelMotion className="comparison-prompt absolute inset-x-2 bottom-2 z-20 rounded-xl bg-slate-900/95 px-3 py-2 text-white shadow-xl backdrop-blur-sm md:inset-x-auto md:bottom-4 md:right-4 md:w-80">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-semibold text-slate-300">
            {a
              ? "Bandingkan kawasan: klik kawasan B di peta"
              : "Bandingkan kawasan: klik dua heksagon di peta"}
          </span>
          <button
            onClick={onTutup}
            className="shrink-0 text-slate-400 hover:text-white"
            aria-label="Tutup panel banding"
          >
            ✕
          </button>
        </div>
        {a && (
          <div className="mt-1 flex items-center gap-2 text-xs">
            <span
              className="h-2 w-2 rounded-full"
              style={{ backgroundColor: WARNA_A }}
            />
            <span className="truncate text-slate-400">
              {a.namaTempat ?? formatCoordinates(a.coordinates)}
            </span>
            <span
              className="ml-auto font-bold"
              style={{ color: warnaTeksSkor(skorKini?.a, ambangSkor) }}
            >
              {skorKini?.a !== null && skorKini?.a !== undefined
                ? formatSkor(skorKini.a)
                : "-"}
            </span>
          </div>
        )}
      </PanelMotion>
    );
  }

  // Indikator dipisah: yang punya data masuk tabel, yang kosong diringkas
  // jadi satu baris supaya panel tidak terlihat rusak.
  const semuaKunci = KELOMPOK_INDIKATOR.flatMap((kel) => kel.kunci);
  const adaData = (k) => {
    const ik = a?.indikator?.[k];
    const iy = b?.indikator?.[k];
    const kosong = (i) =>
      !i || i.sumber === "tidak_tersedia" || i.nilai === null;
    return !(kosong(ik) && kosong(iy));
  };
  const kunciAda = semuaKunci.filter(adaData);
  const kunciKosong = semuaKunci.filter((k) => !adaData(k));

  const selIndikator = (k, dX) => {
    const ik = dX?.indikator?.[k];
    if (!ik || ik.sumber === "tidak_tersedia" || ik.nilai === null)
      return <span className="italic text-slate-500">tidak ada data</span>;
    const label = labelKualitatif(k, ik);
    const mentah = formatNilai(ik.nilai, ik.satuan);
    // Satuan yang sudah jelas (meter, rupiah, jumlah) tetap ditampilkan apa
    // adanya; yang abstrak (indeks, NDVI, nW/sr/cm2) diganti label kualitatif.
    const utama = satuanAbstrak(ik.satuan) ? (label ?? mentah) : mentah;
    return (
      <>
        <span>{utama}</span>
        {ik.sumber === "model" && (
          <span className="ml-1 text-[11px] text-yellow-300">(estimasi)</span>
        )}
        {angkaMentah && satuanAbstrak(ik.satuan) && mentah && (
          <span className="ml-1 text-[11px] text-slate-500">{mentah}</span>
        )}
      </>
    );
  };

  return (
    <PanelMotion className="detail-panel absolute inset-x-0 bottom-0 z-20 flex h-[80dvh] flex-col rounded-t-2xl bg-slate-900/95 text-white shadow-2xl backdrop-blur-sm md:inset-x-auto md:inset-y-0 md:right-0 md:h-full md:w-[460px] md:rounded-none">
      <div className="mx-auto mt-1.5 h-1 w-10 shrink-0 rounded-full bg-white/25 md:hidden" />
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
        <span className="text-sm font-semibold">Bandingkan kawasan</span>
        <button
          onClick={onTutup}
          className="text-slate-400 hover:text-white"
          aria-label="Tutup panel banding"
        >
          ✕
        </button>
      </div>
      <div className="flex-1 overflow-y-auto px-4 pb-4">
        {/* 1a. VONIS lebih dulu, bukan tabel angka. */}
        <div className="vonis">
          <p className="vonis-kalimat">
            {praktisSetara
              ? "Kedua kawasan praktis setara: seluruh selisih dimensinya kecil dibandingkan sebaran wilayah studi. Pilih berdasarkan hal di luar cakupan analisis ini, misalnya kondisi bangunan atau kecocokan pribadi."
              : pemenang === null
              ? "Kedua kawasan hampir setara dengan bobot yang kamu pakai."
              : `Kawasan ${pemenang} lebih cocok secara keseluruhan${
                  alasan[0]
                    ? `, terutama kalau kamu mengutamakan ${alasan[0].label.toLowerCase()}`
                    : ""
                }.`}
          </p>
          {hasil?.simpulan && <p className="vonis-ai">{hasil.simpulan}</p>}
          {memuat && (
            <p className="vonis-tunggu">Menyusun ringkasan AI&hellip;</p>
          )}
        </div>

        <div className="mt-3 flex gap-2">
          <Kartu
            data={a}
            warna={WARNA_A}
            label="A"
            skor={skorA}
            ganti={() => onGanti("a")}
          />
          <Kartu
            data={b}
            warna={WARNA_B}
            label="B"
            skor={skorB}
            ganti={() => onGanti("b")}
          />
        </div>

        {/* 1b. ALASAN: maksimal tiga, sebagai kalimat. */}
        {alasan.length > 0 && (
          <ul className="alasan-daftar">
            {alasan.map((x) => (
              <li key={x.kunci}>
                <strong>Kawasan {x.beda > 0 ? "A" : "B"}</strong> unggul di{" "}
                {x.label.toLowerCase()} (selisih {fmtAngka(Math.abs(x.beda))}{" "}
                poin
                {x.tingkat ? `, ${x.tingkat}` : ""}).
              </li>
            ))}
          </ul>
        )}

        {hasil?.cocokUntuk && (
          <div className="cocok-untuk">
            <div>
              <strong>A</strong> {hasil.cocokUntuk.A}
            </div>
            <div>
              <strong>B</strong> {hasil.cocokUntuk.B}
            </div>
          </div>
        )}

        {hasil?.sumber === "fallback" && (
          <div className="mt-2 rounded bg-yellow-700 px-2 py-1 text-xs font-semibold text-white">
            Disusun tanpa AI. Layanan bahasa tidak merespons.
          </div>
        )}
        {hasil && (
          <div className="mt-1 text-xs text-slate-500">
            Ringkasan disusun AI dari angka pada panel ini.
          </div>
        )}
        {galat && (
          <div className="mt-2 rounded bg-red-900/60 p-2 text-xs text-red-100">
            {galat}{" "}
            <button onClick={padaBanding} className="underline">
              Coba lagi
            </button>
          </div>
        )}

        {/* 1c. Tombol detail; tabel tertutup secara bawaan. */}
        <button
          type="button"
          className="tombol-detail"
          aria-expanded={detailTerbuka}
          onClick={() => setDetailTerbuka((v) => !v)}
        >
          {detailTerbuka ? "Sembunyikan detail" : "Lihat detail"}
        </button>

        {detailTerbuka && (
          <>
            <div className="compare-header">
              <span>Subskor dimensi</span>
              <span>A</span>
              <span>B</span>
            </div>
            <div className="mt-1 overflow-hidden rounded border border-white/10">
              {KELOMPOK_INDIKATOR.map((kel) => {
                const vA = a.subskor?.[kel.dimensi];
                const vB = b.subskor?.[kel.dimensi];
                const kA = kosongA.has(kel.dimensi) || !Number.isFinite(vA);
                const kB = kosongB.has(kel.dimensi) || !Number.isFinite(vB);
                const takSah = kA || kB;
                const unggul = takSah
                  ? null
                  : vA > vB
                    ? "A"
                    : vB > vA
                      ? "B"
                      : null;
                const isiSel = (v, kosong) =>
                  kosong ? (
                    <span className="italic text-slate-500">
                      tidak ada data
                    </span>
                  ) : (
                    fmtAngka(v)
                  );
                const sig = semuaSelisih.find((x) => x.kunci === kel.dimensi);
                return (
                  <div key={kel.dimensi} className="compare-row">
                    <span className="w-36 shrink-0 text-slate-300">
                      {kel.label}
                      {/* Tanpa ini, selisih 7 poin di dua dimensi berbeda
                          terbaca sama besar padahal simpangan bakunya
                          berbeda 3,4 kali. */}
                      {sig?.tingkat && (
                        <span className="sig-label"> {sig.tingkat}</span>
                      )}
                    </span>
                    {/* Sel unggul ditebalkan dan diberi latar tipis, bukan
                        ditandai simbol tanpa legenda. */}
                    <span
                      className={`w-16 text-right ${unggul === "A" ? "sel-unggul" : "text-slate-400"}`}
                    >
                      {isiSel(vA, kA)}
                    </span>
                    <span
                      className={`w-16 text-right ${unggul === "B" ? "sel-unggul" : "text-slate-400"}`}
                    >
                      {isiSel(vB, kB)}
                    </span>
                  </div>
                );
              })}
            </div>

            <div className="mt-4 flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-300">
                Indikator
              </span>
              <label className="toggle-mentah">
                <input
                  type="checkbox"
                  checked={angkaMentah}
                  onChange={(e) => setAngkaMentah(e.target.checked)}
                />
                Tampilkan angka mentah
              </label>
            </div>
            <div className="mt-1 overflow-hidden rounded border border-white/10">
              {kunciAda.map((k) => {
                const unggul = dimUnggul(k, a, b);
                const konteks =
                  kalimatKonteks(k, a?.indikator?.[k]) ?? null;
                return (
                  <div key={k} className="indicator-row">
                    <div className="compare-row">
                      <span className="flex-1 text-slate-300">
                        {NAMA_INDIKATOR[k] ?? k}
                      </span>
                      <span
                        className={`w-28 shrink-0 text-right ${unggul === "A" ? "sel-unggul" : "text-slate-400"}`}
                      >
                        {selIndikator(k, a)}
                      </span>
                      <span
                        className={`w-28 shrink-0 text-right ${unggul === "B" ? "sel-unggul" : "text-slate-400"}`}
                      >
                        {selIndikator(k, b)}
                      </span>
                    </div>
                    {konteks && <div className="indicator-konteks">{konteks}</div>}
                  </div>
                );
              })}
            </div>

            {/* 5. Baris kosong diringkas jadi satu, bukan memenuhi tabel. */}
            {kunciKosong.length > 0 && (
              <div className="ringkas-kosong">
                <button
                  type="button"
                  onClick={() => setKosongTerbuka((v) => !v)}
                  aria-expanded={kosongTerbuka}
                >
                  {kunciKosong.length} indikator belum punya data untuk kedua
                  kawasan ini
                </button>
                {kosongTerbuka && (
                  <ul>
                    {kunciKosong.map((k) => (
                      <li key={k}>{NAMA_INDIKATOR[k] ?? k}</li>
                    ))}
                  </ul>
                )}
                <p>
                  Indikator tanpa data dikeluarkan dari perhitungan, tidak
                  dihitung sebagai nol.
                </p>
              </div>
            )}

            <div className="mt-3 text-xs text-slate-500">
              <div>A: {formatCoordinates(a.coordinates)}</div>
              <div>B: {formatCoordinates(b.coordinates)}</div>
            </div>
          </>
        )}

        <div className="mt-3 border-t border-white/10 pt-2 text-xs text-slate-500">
          Data versi {versi ?? "-"}
          {formatTanggal(dihitungPada)
            ? `, dihitung ${formatTanggal(dihitungPada)}`
            : ""}
          .
        </div>
      </div>
    </PanelMotion>
  );
}
