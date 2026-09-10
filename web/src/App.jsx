import { AnimatePresence, motion } from "framer-motion";
import { lazy, Suspense, useEffect, useRef, useState } from "react";

const PetaHeksagon = lazy(() => import("./components/PetaHeksagon"));
import PanelKontrol from "./components/PanelKontrol";
import PanelKawasan from "./components/PanelKawasan";
import PanelBanding from "./components/PanelBanding";
import PanelBandingKos from "./components/PanelBandingKos";
import PitaPeringatan from "./components/PitaPeringatan";
import PanelRute from "./components/PanelRute";
import Beranda from "./components/Beranda";
import Metodologi from "./components/Metodologi";
import { labelKelas } from "./lib/kelas";
import { normalisasiBobot, hitungSemua } from "./lib/mesinSkor";
import { DEFINISI_LAPISAN } from "./lib/lapisan";
import { KELOMPOK_INDIKATOR, NAMA_INDIKATOR } from "./lib/kamus";
import { formatNilai } from "./lib/format";
import { fokusDariProfil } from "./lib/fokusKampus";

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
  const [fokusPeta, setFokusPeta] = useState(null);
  const [kosRute, setKosRute] = useState(null);
  const [rute, setRute] = useState(null);
  const [gerbangRute, setGerbangRute] = useState(null);
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
  const [comparisonType, setComparisonType] = useState("kawasan");
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

  const compareKos = (kos) => {
    setModeBanding(true);
    setComparisonType("kos");
    setHeksagonTerpilih(null);
    setLapisanAktif((layers) => ({ ...layers, kos: true }));
    setPilihanBanding((previous) => {
      if ((previous.a || previous.b)?.kind !== "kos")
        return { a: kos, b: null };
      if (previous.a?.id === kos.id || previous.b?.id === kos.id)
        return previous;
      if (!previous.a) return { ...previous, a: kos };
      if (!previous.b) return { ...previous, b: kos };
      return { a: kos, b: previous.b };
    });
  };

  const changeComparisonType = (type) => {
    setComparisonType(type);
    setPilihanBanding({ a: null, b: null });
    setHasilBanding(null);
    setGalatBanding(null);
    if (type === "kos") setLapisanAktif((layers) => ({ ...layers, kos: true }));
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

  const tutupRute = () => {
    setKosRute(null);
    setRute(null);
    setGerbangRute(null);
  };

  const mintaRute = (kos) => {
    setHeksagonTerpilih(null);
    setModeBanding(false);
    setRute(null);
    setGerbangRute(null);
    setKosRute(kos);
  };

  // Gerbang dipilih di peta: rute diarahkan ke pintu itu, bukan titik tengah.
  const pilihGerbang = (g) => setGerbangRute(g);

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
              setFokusPeta(fokusDariProfil(profil));
              setTampilan("peta");
            }}
            onLewati={() => {
              setProfilTerakhir(null);
              setBobot(bobotBawaan);
              setFokusPeta(null);
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
        <div
          className={`relative flex-1 overflow-hidden ${modeBanding ? "map-comparing" : ""}`}
        >
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
                  changeComparisonType("kawasan");
                }}
                className="rounded bg-slate-900/85 px-3 py-1 text-xs text-slate-300 ring-1 ring-slate-700 hover:text-white"
              >
                Bandingkan
              </button>
            )}
          </div>
          {modeBanding && (
            <div className="comparison-controls absolute left-2 right-2 top-14 z-30 rounded-xl bg-slate-900/95 p-2 text-xs text-slate-200 shadow-lg md:left-auto md:right-14 md:w-80">
              <div
                className="flex gap-1"
                role="group"
                aria-label="Jenis perbandingan"
              >
                {["kawasan", "kos"].map((type) => (
                  <button
                    key={type}
                    aria-pressed={comparisonType === type}
                    onClick={() => changeComparisonType(type)}
                    className={`flex-1 rounded-lg px-3 py-2 font-semibold ${comparisonType === type ? "bg-emerald-400 text-slate-950" : "bg-slate-800 text-slate-200"}`}
                  >
                    {type === "kos" ? "Kos" : "Kawasan"}
                  </button>
                ))}
              </div>
              <p className="px-1 pt-2">
                {comparisonType === "kos"
                  ? "Pilih dua pin rumah. Pintasan: Ctrl+klik, atau tekan lama di HP."
                  : "Klik dua heksagon di peta."}
              </p>
            </div>
          )}
          <PanelKontrol
            bobot={bobot}
            onBobotBerubah={ubahBobot}
            onKembalikanBawaan={kembalikanBawaan}
            lapisanAktif={lapisanAktif}
            onToggleLapisan={toggleLapisan}
            jumlahLapisan={jumlahLapisan}
            labels={labels}
            modeRute={Boolean(kosRute)}
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
              fokus={fokusPeta}
              onMintaRute={mintaRute}
              onPilihGerbang={pilihGerbang}
              rute={rute}
              lapisanAktif={lapisanAktif}
              onJumlahLapisan={setJumlahLapisan}
              modeBanding={modeBanding}
              pilihanBanding={pilihanBanding}
              onPilihBanding={klikBanding}
              comparisonType={comparisonType}
              onCompareKos={compareKos}
            />
          </Suspense>
          {kosRute && (
            <PanelRute
              kos={kosRute}
              kampusAwal={fokusPeta?.nama}
              gerbang={gerbangRute}
              onGerbangReset={() => setGerbangRute(null)}
              onRute={setRute}
              onTutup={tutupRute}
            />
          )}
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
            {modeBanding &&
              comparisonType === "kos" &&
              (pilihanBanding.a || pilihanBanding.b) && (
                <PanelBandingKos
                  key="banding-kos"
                  pilihan={pilihanBanding}
                  scores={{
                    a: skorUntuk(pilihanBanding.a),
                    b: skorUntuk(pilihanBanding.b),
                  }}
                  onClose={keluarBanding}
                  onReplace={gantiSlot}
                />
              )}
            {modeBanding &&
              comparisonType === "kawasan" &&
              (pilihanBanding.a || pilihanBanding.b) && (
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
