import { AnimatePresence, motion } from "framer-motion";
import { lazy, Suspense, useEffect, useRef, useState } from "react";

const PetaHeksagon = lazy(() => import("./components/PetaHeksagon"));
import Legenda from "./components/Legenda";
import PanelBobot from "./components/PanelBobot";
import PanelKawasan from "./components/PanelKawasan";
import PanelLapisan from "./components/PanelLapisan";
import PanelBanding from "./components/PanelBanding";
import PitaPeringatan from "./components/PitaPeringatan";
import Beranda from "./components/Beranda";
import Metodologi from "./components/Metodologi";
import { labelKelas } from "./lib/kelas";
import { normalisasiBobot, hitungSemua } from "./lib/mesinSkor";
import { DEFINISI_LAPISAN } from "./lib/lapisan";
import { KELOMPOK_INDIKATOR, NAMA_INDIKATOR } from "./lib/kamus";
import { formatNilai } from "./lib/format";

const BAWAAN_MENTAH = {
  connectivity: 40,
  affordability: 25,
  amenity: 20,
  walkability: 15,
};

function lapisanAwal() {
  return Object.fromEntries(DEFINISI_LAPISAN.map((d) => [d.id, d.aktifAwal]));
}

function skorProfilKeBobot(profil, bawaan) {
  // bobot dari chip berangka 0-100 (mentah), sama dengan state bobot
  const b = profil?.bobot;
  if (!b) return bawaan;
  const salin = { ...bawaan };
  for (const k of ["connectivity", "affordability", "amenity", "walkability"]) {
    if (typeof b[k] === "number" && Number.isFinite(b[k]))
      salin[k] = Math.max(0, Math.min(100, b[k]));
  }
  return salin;
}

// metadata.bobot_default datang sebagai pecahan 0-1; ubah ke skala 0-100.
function bobotMetadataKeMentah(meta) {
  const salin = { ...BAWAAN_MENTAH };
  for (const k of ["connectivity", "affordability", "amenity", "walkability"]) {
    if (typeof meta?.[k] === "number" && Number.isFinite(meta[k]))
      salin[k] = Math.round(meta[k] * 100);
  }
  return salin;
}

export default function App() {
  const [tampilan, setTampilan] = useState("beranda");
  const [profilTerakhir, setProfilTerakhir] = useState(null);
  const [bobot, setBobot] = useState(BAWAAN_MENTAH);
  const [bobotBawaan, setBobotBawaan] = useState(BAWAAN_MENTAH);
  const [bobotDariMetadata, setBobotDariMetadata] = useState(false);
  const [heksagonTerpilih, setHeksagonTerpilih] = useState(null);
  const [versi, setVersi] = useState(null);
  const [dihitungPada, setDihitungPada] = useState(null);
  const [basemapAktif, setBasemapAktif] = useState(false);
  const [labels, setLabels] = useState(null);
  const [skorTerkini, setSkorTerkini] = useState(null);
  const [lapisanAktif, setLapisanAktif] = useState(lapisanAwal);
  const [jumlahLapisan, setJumlahLapisan] = useState({});
  const [narasiCache, setNarasiCache] = useState({});
  const [modeBanding, setModeBanding] = useState(false);
  const [pilihanBanding, setPilihanBanding] = useState({ a: null, b: null });
  const [hasilBanding, setHasilBanding] = useState(null);
  const [cacheBanding, setCacheBanding] = useState({});
  const [galatBanding, setGalatBanding] = useState(null);
  const mesin = useRef(null);
  const indeksH3 = useRef(null);
  const timer = useRef(null);
  const memuatBanding = useRef(false);

  useEffect(() => () => clearTimeout(timer.current), []);

  const klikBanding = (props) => {
    setGalatBanding(null);
    setHasilBanding(null);
    setPilihanBanding((sebelum) => {
      if (!sebelum.a) return { a: props, b: null };
      if (!sebelum.b) {
        if (sebelum.a.h3_index === props.h3_index) return sebelum;
        return { a: sebelum.a, b: props };
      }
      return { a: props, b: sebelum.b };
    });
  };

  const gantiSlot = (slot) => {
    setPilihanBanding((s) => ({ ...s, [slot]: null }));
    setHasilBanding(null);
    setGalatBanding(null);
  };

  const skorUntuk = (props) => {
    if (!props || !mesin.current || !skorTerkini || !indeksH3.current)
      return null;
    const i = indeksH3.current.get(props.h3_index);
    return i === undefined ? null : skorTerkini[i];
  };

  const mintaBanding = () => {
    const { a, b } = pilihanBanding;
    if (!a || !b || memuatBanding.current) return;
    const kunci = `${a.h3_index}|${b.h3_index}`;
    if (cacheBanding[kunci]) {
      setHasilBanding(cacheBanding[kunci]);
      return;
    }
    memuatBanding.current = true;
    setHasilBanding("memuat");
    setGalatBanding(null);
    const buat = (d) => ({
      h3_index: d.h3_index,
      skor: d.skor,
      subskor: d.subskor,
      dimensiKosong: d.dimensi_kosong ?? [],
      indikator: KELOMPOK_INDIKATOR.flatMap((kel) =>
        kel.kunci.map((k) => {
          const ik = d.indikator?.[k];
          return {
            nama: NAMA_INDIKATOR[k] ?? k,
            nilai:
              ik && ik.nilai !== null && ik.nilai !== undefined
                ? formatNilai(ik.nilai, ik.satuan)
                : null,
            persentil:
              ik && typeof ik.persentil === "number" ? ik.persentil : null,
            sumber: ik?.sumber ?? null,
          };
        }),
      ),
    });
    fetch("/api/compare", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bobot, a: buat(a), b: buat(b) }),
    })
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((j) => {
        setCacheBanding((c) => ({ ...c, [kunci]: j }));
        setHasilBanding(j);
      })
      .catch(() =>
        setGalatBanding("Tidak dapat menghubungi server. Coba lagi."),
      )
      .finally(() => {
        memuatBanding.current = false;
      });
  };

  const keluarBanding = () => {
    setModeBanding(false);
    setPilihanBanding({ a: null, b: null });
    setHasilBanding(null);
    setGalatBanding(null);
  };

  // debounce 120 ms: normalisasi -> hitungSemua -> skorTerkini
  useEffect(() => {
    if (!mesin.current) return;
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      const { bobot: ternormalisasi } = normalisasiBobot(bobot);
      setSkorTerkini(hitungSemua(mesin.current, ternormalisasi));
    }, 120);
  }, [bobot]);

  const ubahBobot = (kunci, nilai) =>
    setBobot((b) => ({ ...b, [kunci]: nilai }));
  const kembalikanBawaan = () => setBobot(bobotBawaan);
  const toggleLapisan = (id) =>
    setLapisanAktif((l) => ({ ...l, [id]: !l[id] }));

  const bedaDariBawaan =
    Math.abs(bobot.connectivity - bobotBawaan.connectivity) > 0.5 ||
    Math.abs(bobot.affordability - bobotBawaan.affordability) > 0.5 ||
    Math.abs(bobot.amenity - bobotBawaan.amenity) > 0.5 ||
    Math.abs(bobot.walkability - bobotBawaan.walkability) > 0.5;

  const skorTerpilih = (() => {
    if (!heksagonTerpilih || !mesin.current || !skorTerkini) return null;
    if (!indeksH3.current) return null;
    const i = indeksH3.current.get(heksagonTerpilih.h3_index);
    return i === undefined ? null : skorTerkini[i];
  })();

  const renderView = () => {
    if (tampilan === "metodologi") {
      return (
        <div className="h-screen w-screen overflow-hidden bg-slate-950">
          <Metodologi onKembali={() => setTampilan("peta")} versi={versi} />
        </div>
      );
    }

    if (tampilan === "beranda") {
      return (
        <div className="h-screen w-screen overflow-hidden bg-slate-950">
          <Beranda
            profilAwal={profilTerakhir}
            onMetodologi={() => setTampilan("metodologi")}
            onProfil={(profil) => {
              setProfilTerakhir(profil);
              setBobot(skorProfilKeBobot(profil, bobotBawaan));
              setTampilan("peta");
            }}
            onLewati={() => {
              setProfilTerakhir(null);
              setBobot(bobotBawaan);
              setTampilan("peta");
            }}
          />
        </div>
      );
    }

    return (
      <div className="flex h-screen w-screen flex-col overflow-hidden bg-slate-900">
        <div className="flex-none">
          <PitaPeringatan versi={versi} basemapAktif={basemapAktif} />
        </div>
        <div className="relative flex-1 overflow-hidden">
          <div className="map-nav absolute left-1/2 top-3 z-30 flex -translate-x-1/2 gap-1.5">
            <button
              onClick={() => setTampilan("beranda")}
              className="rounded bg-slate-900/85 px-3 py-1 text-xs text-slate-300 ring-1 ring-slate-700 hover:text-white"
            >
              ← Beranda
            </button>
            <button
              onClick={() => setTampilan("metodologi")}
              className="rounded bg-slate-900/85 px-3 py-1 text-xs text-slate-300 ring-1 ring-slate-700 hover:text-white"
            >
              Metodologi
            </button>
            {modeBanding ? (
              <button
                onClick={keluarBanding}
                className="rounded bg-orange-600 px-3 py-1 text-xs font-semibold text-white hover:bg-orange-500"
              >
                Selesai banding
              </button>
            ) : (
              <button
                onClick={() => {
                  setHeksagonTerpilih(null);
                  setModeBanding(true);
                }}
                className="rounded bg-slate-900/85 px-3 py-1 text-xs text-slate-300 ring-1 ring-slate-700 hover:text-white"
              >
                Bandingkan
              </button>
            )}
          </div>
          {modeBanding && (
            <div className="absolute left-2 top-14 z-10 rounded bg-slate-900/85 px-2 py-1 text-xs text-slate-300 md:left-auto md:right-3">
              Klik dua heksagon di peta.
            </div>
          )}
          <PanelBobot
            bobot={bobot}
            onBobotBerubah={ubahBobot}
            onKembalikanBawaan={kembalikanBawaan}
          />
          <Suspense
            fallback={
              <div className="loading-map" role="status">
                <p className="animate-pulse text-sm text-emerald-400">
                  Menyiapkan peta kawasan…
                </p>
              </div>
            }
          >
            <PetaHeksagon
              onPilih={setHeksagonTerpilih}
              onStatusBasemap={setBasemapAktif}
              onPetaSiap={({
                versi: v,
                dihitungPada: t,
                bobotDefault: m,
                labels: l,
              }) => {
                setVersi(v);
                if (t) setDihitungPada(t);
                setLabels(l);
                if (m) {
                  // metadata menyediakan bobot bawaan: pakai sebagai nilai awal
                  // slider dan acuan "Kembalikan bawaan".
                  const b = bobotMetadataKeMentah(m);
                  setBobotBawaan(b);
                  if (!bobotDariMetadata && !profilTerakhir) setBobot(b);
                  setBobotDariMetadata(true);
                } else {
                  setBobotDariMetadata(false);
                  console.warn(
                    "metadata.bobot_default tidak ada; memakai BOBOT_DEFAULT cadangan dari config.",
                  );
                }
              }}
              skorTerkini={skorTerkini}
              onDataSiap={(m) => {
                mesin.current = m;
                indeksH3.current = new Map(m.h3.map((id, i) => [id, i]));
                const { bobot: ternormalisasi } = normalisasiBobot(bobot);
                setSkorTerkini(hitungSemua(m, ternormalisasi));
              }}
              onAmbangBerubah={({ ambang, minSkor, maksSkor }) => {
                setLabels(labelKelas(ambang, minSkor, maksSkor));
              }}
              lapisanAktif={lapisanAktif}
              onJumlahLapisan={setJumlahLapisan}
              modeBanding={modeBanding}
              pilihanBanding={pilihanBanding}
              onPilihBanding={klikBanding}
            />
          </Suspense>
          <Legenda labels={labels} />
          <PanelLapisan
            lapisanAktif={lapisanAktif}
            onToggle={toggleLapisan}
            jumlahLapisan={jumlahLapisan}
          />
          <AnimatePresence>
            {!modeBanding && heksagonTerpilih && (
              <PanelKawasan
                key="kawasan"
                heksagon={heksagonTerpilih}
                versi={versi}
                dihitungPada={dihitungPada}
                bobotDariMetadata={bobotDariMetadata}
                skorKini={skorTerpilih}
                bobotKini={
                  bedaDariBawaan ? normalisasiBobot(bobot).bobot : null
                }
                onTutup={() => setHeksagonTerpilih(null)}
                narasiCache={narasiCache}
                simpanNarasi={(h3, hasil) =>
                  setNarasiCache((c) => (c[h3] ? c : { ...c, [h3]: hasil }))
                }
              />
            )}
            {modeBanding && (pilihanBanding.a || pilihanBanding.b) && (
              <PanelBanding
                key="banding"
                pilihan={pilihanBanding}
                skorKini={{
                  a: skorUntuk(pilihanBanding.a),
                  b: skorUntuk(pilihanBanding.b),
                }}
                versi={versi}
                dihitungPada={dihitungPada}
                onTutup={keluarBanding}
                onGanti={gantiSlot}
                hasilBanding={hasilBanding}
                galat={galatBanding}
                padaBanding={mintaBanding}
              />
            )}
          </AnimatePresence>
        </div>
      </div>
    );
  };
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={tampilan}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        transition={{ duration: 0.3 }}
        className="h-dvh"
      >
        {renderView()}
      </motion.div>
    </AnimatePresence>
  );
}
