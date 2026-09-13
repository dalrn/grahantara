import { useEffect, useRef, useState } from "react";

import { DAFTAR_KAMPUS } from "../kampus.js";
import { KOORDINAT_KAMPUS } from "../lib/fokusKampus";
import { rencanaRute, lengkapiGeometri } from "../lib/rute";
import { ruteColors } from "../design";

/**
 * Potongan garis pendek yang menyalin gaya garis di peta: biru penuh untuk
 * bus, kuning putus-putus untuk jalan kaki, keduanya di atas alas gelap yang
 * sama dengan casing di peta.
 *
 * Ini yang menggantikan legenda terpisah — pemetaan warna ke moda terbaca
 * langsung dari daftar langkah. Pembedanya bukan warna saja: penuh versus
 * putus-putus tetap terbaca dalam grayscale.
 */
function ContohGaris({ mode }) {
  const bus = mode === "bus";
  return (
    <span
      className="contoh-garis"
      aria-hidden="true"
      style={{ "--warna-rute": bus ? ruteColors.bus : ruteColors.jalan }}
      data-mode={bus ? "bus" : "jalan"}
    />
  );
}

export default function PanelRute({
  kos,
  kampusAwal,
  gerbang,
  onGerbangReset,
  onRute,
  onTutup,
  onSorotRuas,
}) {
  const [kampus, setKampus] = useState(kampusAwal ?? "UGM");
  // Berkas yang sama sudah dimuat peta, jadi permintaan ini dilayani cache
  // HTTP; tidak perlu mengalirkan datanya lewat props.
  const [halte, setHalte] = useState(null);
  const [rute, setRute] = useState(null);
  const [status, setStatus] = useState("memuat");
  const batal = useRef(null);

  useEffect(() => {
    if (kampusAwal) setKampus(kampusAwal);
  }, [kampusAwal]);

  useEffect(() => {
    let batalkan = false;
    fetch("/data/halte.geojson")
      .then((r) => r.json())
      .then((d) => {
        if (!batalkan) setHalte(d.features ?? []);
      })
      .catch(() => {
        if (!batalkan) setHalte([]);
      });
    return () => {
      batalkan = true;
    };
  }, []);

  useEffect(() => {
    const pusat = KOORDINAT_KAMPUS[kampus];
    if (!kos || !pusat || halte === null) return;
    batal.current?.abort();
    const controller = new AbortController();
    batal.current = controller;

    // Gerbang hanya berlaku untuk kampus yang sama; ganti kampus =
    // kembali ke titik tengah.
    const gerbangAktif =
      gerbang && gerbang.kampus === kampus ? gerbang : null;
    const rencana = rencanaRute(
      kos,
      { nama: kampus, pusat, gerbang: gerbangAktif },
      halte,
    );
    if (!rencana) {
      setStatus("galat");
      return;
    }
    // Tampilkan rencana lebih dulu (garis lurus) supaya panel tidak kosong,
    // lalu perbaiki dengan geometri jalan dari OSRM.
    setRute(rencana);
    setStatus("memuat");
    onRute?.(rencana);

    lengkapiGeometri(rencana, controller.signal)
      .then((lengkap) => {
        if (controller.signal.aborted) return;
        setRute(lengkap);
        setStatus("siap");
        onRute?.(lengkap);
      })
      .catch((e) => {
        if (e?.name === "AbortError") return;
        setStatus("siap");
      });

    return () => controller.abort();
    // onRute sengaja tidak jadi dependensi: identitasnya berubah tiap render
    // induk dan akan memicu perhitungan ulang tanpa henti.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kos, kampus, halte, gerbang]);

  useEffect(() => () => batal.current?.abort(), []);

  const tersedia = DAFTAR_KAMPUS.filter((k) => KOORDINAT_KAMPUS[k]);

  return (
    <div className="route-panel absolute bottom-2 right-2 z-30 w-[19rem] max-w-[calc(100vw-1rem)] rounded-xl bg-slate-900/95 p-3 text-white shadow-xl backdrop-blur-sm md:bottom-4 md:right-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-xs text-slate-400">Rute dari</div>
          <div className="truncate text-sm font-semibold">{kos?.nama}</div>
        </div>
        <button
          onClick={onTutup}
          aria-label="Tutup rute"
          className="shrink-0 rounded px-2 py-1 text-slate-400 hover:text-white"
        >
          ✕
        </button>
      </div>

      <label className="mt-2 block text-xs">
        <span className="text-slate-400">Ke kampus</span>
        <select
          value={kampus}
          onChange={(e) => setKampus(e.target.value)}
          className="mt-1 w-full rounded bg-slate-800 px-2 py-1.5 text-slate-100 outline-none focus:ring-1 focus:ring-emerald-400"
        >
          {tersedia.map((k) => (
            <option key={k} value={k}>
              {k}
            </option>
          ))}
        </select>
      </label>

      {gerbang && gerbang.kampus === kampus && (
        <div className="mt-2 flex items-start gap-2 rounded-lg bg-slate-800/70 px-2 py-1.5 text-xs">
          <span className="min-w-0 flex-1 text-slate-200">
            Menuju {gerbang.label}
          </span>
          <button
            onClick={onGerbangReset}
            className="shrink-0 text-slate-400 underline hover:text-white"
          >
            titik tengah
          </button>
        </div>
      )}

      {status === "galat" && (
        <p className="mt-3 text-xs text-slate-400">
          Rute tidak dapat dihitung untuk kos ini.
        </p>
      )}

      {rute && (
        <>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-emerald-400">
              {rute.totalMenit}
            </span>
            <span className="text-xs text-slate-400">
              menit · {(rute.totalMeter / 1000).toFixed(1)} km
            </span>
            {status === "memuat" && (
              <span className="ml-auto animate-pulse text-xs text-slate-500">
                menghitung…
              </span>
            )}
          </div>

          {/* Satu baris keterangan, tepat di bawah total dan sebelum daftar
              langkah. Menyebut arti gaya garis, bukan arti warnanya. */}
          <p className="rute-keterangan">
            Garis penuh berarti naik kendaraan, garis putus-putus berarti jalan
            kaki.
          </p>

          <ol className="mt-2 space-y-1">
            {rute.langkah.map((l, i) => (
              <li
                key={i}
                className="langkah-rute flex items-start gap-2 text-xs"
                onMouseEnter={() => onSorotRuas?.(i)}
                onMouseLeave={() => onSorotRuas?.(null)}
                // Penyorotan juga bisa dicapai lewat papan tunjuk dan
                // pembaca layar, bukan kursor saja.
                tabIndex={0}
                onFocus={() => onSorotRuas?.(i)}
                onBlur={() => onSorotRuas?.(null)}
              >
                <ContohGaris mode={l.mode} />
                {/* Moda ditulis sebagai KATA, bukan emoji: emoji tidak terbaca
                    pembaca layar dan tampilannya berbeda di tiap sistem.
                    Potongan garis di sebelahnya sudah membawa warna dan
                    gayanya. */}
                <span className="langkah-moda">
                  {l.mode === "bus" ? "Bus" : "Jalan"}
                </span>
                <span className="min-w-0">
                  <span className="text-slate-200">{l.teks}</span>
                  <span className="block text-slate-500">
                    {l.menit} menit · {l.meter.toLocaleString("id-ID")} m
                  </span>
                </span>
              </li>
            ))}
          </ol>

          <p className="mt-2 text-xs leading-snug text-slate-500">
            Nyalakan lapisan &quot;Gerbang kampus&quot;, lalu klik satu gerbang
            untuk mengarahkan rute ke pintu itu.
          </p>

          <p className="mt-3 border-t border-white/10 pt-2 text-xs leading-snug text-slate-500">
            {rute.perkiraan
              ? "Sebagian ruas digambar lurus karena layanan rute tidak menjawab. "
              : ""}
            Waktu adalah perkiraan dari jarak (jalan kaki ~4,5 km/jam, bus ~15
            km/jam), bukan jadwal resmi Trans Jogja.
          </p>
        </>
      )}
    </div>
  );
}
