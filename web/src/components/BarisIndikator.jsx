import { NAMA_INDIKATOR, LABEL_SUMBER } from "../lib/kamus";
import { formatNilai } from "../lib/format";
import { barisIndikator } from "../lib/bahasaIndikator";

export function Lencana({ teks, warna }) {
  return (
    <span
      className={`shrink-0 rounded px-1.5 py-0.5 text-xs font-medium ${warna}`}
    >
      {teks}
    </span>
  );
}

/**
 * Satu baris indikator di panel Kawasan Terpilih.
 *
 * Yang tampil secara bawaan adalah LABEL KUALITATIF dan kalimat persentil,
 * bukan nilai mentah. Sebelumnya keduanya tampil bersamaan dan sering saling
 * bertentangan: "Integritas jalur pejalan: 0,2 indeks - persentil 93" terbaca
 * sebagai nilai buruk, padahal kawasan itu termasuk 7% terbaik.
 *
 * `angkaMentah` membuka nilai asli beserta satuannya. Toggle-nya ada satu
 * untuk seluruh panel, bukan satu per baris.
 *
 * Lencana sumber data TIDAK tampil di baris lagi: 16 baris bersamaan membuat
 * "OpenStreetMap" / "MAPID POI" / "Sentinel-2" jadi kebisingan, dan
 * "Sentinel-2" tidak berarti apa-apa bagi mahasiswa baru. Sumber diringkas di
 * bawah daftar, dan muncul per baris hanya saat angka mentah dibuka.
 * Lencana "Estimasi" TETAP di barisnya: itu peringatan kualitas data, bukan
 * atribusi.
 */
export default function BarisIndikator({ kunci, data, angkaMentah = false }) {
  const nama = NAMA_INDIKATOR[kunci] ?? kunci;
  const tidakTersedia =
    !data || data.sumber === "tidak_tersedia" || data.nilai === null;

  if (tidakTersedia) {
    return (
      <div className="py-1.5">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs text-slate-500">{nama}</span>
          <Lencana teks="Tidak tersedia" warna="bg-slate-700 text-slate-300" />
        </div>
        <div className="text-xs italic text-slate-500">tidak tersedia</div>
      </div>
    );
  }

  const persentil = data.persentil ?? null;
  const mentah = formatNilai(data.nilai, data.satuan);
  const { label, konteks, abstrak } = barisIndikator(kunci, data) ?? {};
  // Satuan yang sudah dipahami langsung (meter, rupiah, cacah) tetap tampil
  // apa adanya: angkanya justru lebih informatif daripada kata sifat.
  const utama = abstrak ? (label ?? mentah) : mentah;

  return (
    <div className="py-1.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-slate-200">{nama}</span>
        {data.sumber === "model" && (
          <Lencana teks="Estimasi" warna="bg-yellow-700/80 text-yellow-100" />
        )}
      </div>
      <div className="mt-0.5 text-sm font-medium text-white">{utama}</div>
      {konteks && <div className="text-xs text-slate-400">{konteks}</div>}
      {angkaMentah && (
        <div className="mt-0.5 text-xs text-slate-500">
          {/* Untuk satuan yang sudah jelas, `utama` SUDAH angka mentahnya;
              mengulanginya di baris ini hanya menggandakan teks yang sama. */}
          {abstrak && mentah ? `${mentah} · ` : ""}
          {LABEL_SUMBER[data.sumber] ?? data.sumber}
        </div>
      )}
      {typeof persentil === "number" && (
        <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full rounded-full bg-sky-400"
            style={{ width: `${Math.max(0, Math.min(100, persentil * 100))}%` }}
          />
        </div>
      )}
    </div>
  );
}
