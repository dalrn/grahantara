import { useEffect, useRef, useState } from "react";

import PetaHeksagon from "./components/PetaHeksagon";
import Legenda from "./components/Legenda";
import PanelBobot from "./components/PanelBobot";
import PanelKawasan from "./components/PanelKawasan";
import PanelLapisan from "./components/PanelLapisan";
import PitaPeringatan from "./components/PitaPeringatan";
import Beranda from "./components/Beranda";
import Metodologi from "./components/Metodologi";
import { BOBOT_DEFAULT } from "./config";
import { labelKelas } from "./lib/kelas";
import { normalisasiBobot, hitungSemua } from "./lib/mesinSkor";
import { DEFINISI_LAPISAN } from "./lib/lapisan";

const BAWAAN_MENTAH = {
  connectivity: 40,
  affordability: 25,
  amenity: 20,
  walkability: 15,
};

function lapisanAwal() {
  return Object.fromEntries(DEFINISI_LAPISAN.map((d) => [d.id, d.aktifAwal]));
}

function skorProfilKeBobot(profil) {
  // bobot dari chip berangka 0-100 (mentah), sama dengan state bobot
  const b = profil?.bobot;
  if (!b) return BAWAAN_MENTAH;
  const salin = { ...BAWAAN_MENTAH };
  for (const k of ["connectivity", "affordability", "amenity", "walkability"]) {
    if (typeof b[k] === "number" && Number.isFinite(b[k])) salin[k] = Math.max(0, Math.min(100, b[k]));
  }
  return salin;
}

export default function App() {
  const [tampilan, setTampilan] = useState("beranda");
  const [profilTerakhir, setProfilTerakhir] = useState(null);
  const [bobot, setBobot] = useState(BAWAAN_MENTAH);
  const [heksagonTerpilih, setHeksagonTerpilih] = useState(null);
  const [versi, setVersi] = useState(null);
  const [basemapAktif, setBasemapAktif] = useState(false);
  const [labels, setLabels] = useState(null);
  const [skorTerkini, setSkorTerkini] = useState(null);
  const [ambangInfo, setAmbangInfo] = useState(null);
  const [lapisanAktif, setLapisanAktif] = useState(lapisanAwal);
  const [jumlahLapisan, setJumlahLapisan] = useState({});
  const [narasiCache, setNarasiCache] = useState({});
  const mesin = useRef(null);
  const indeksH3 = useRef(null);
  const timer = useRef(null);

  useEffect(() => () => clearTimeout(timer.current), []);

  // debounce 120 ms: normalisasi -> hitungSemua -> skorTerkini
  useEffect(() => {
    if (!mesin.current) return;
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      const { bobot: ternormalisasi } = normalisasiBobot(bobot);
      setSkorTerkini(hitungSemua(mesin.current, ternormalisasi));
    }, 120);
  }, [bobot]);

  const ubahBobot = (kunci, nilai) => setBobot((b) => ({ ...b, [kunci]: nilai }));
  const kembalikanBawaan = () => setBobot(BAWAAN_MENTAH);
  const toggleLapisan = (id) =>
    setLapisanAktif((l) => ({ ...l, [id]: !l[id] }));

  const bedaDariBawaan =
    Math.abs(bobot.connectivity - BOBOT_DEFAULT.connectivity * 100) > 0.5 ||
    Math.abs(bobot.affordability - BOBOT_DEFAULT.affordability * 100) > 0.5 ||
    Math.abs(bobot.amenity - BOBOT_DEFAULT.amenity * 100) > 0.5 ||
    Math.abs(bobot.walkability - BOBOT_DEFAULT.walkability * 100) > 0.5;

  const skorTerpilih = (() => {
    if (!heksagonTerpilih || !mesin.current || !skorTerkini) return null;
    if (!indeksH3.current) return null;
    const i = indeksH3.current.get(heksagonTerpilih.h3_index);
    return i === undefined ? null : skorTerkini[i];
  })();

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
            setBobot(skorProfilKeBobot(profil));
            setTampilan("peta");
          }}
          onLewati={() => {
            setProfilTerakhir(null);
            setBobot(BAWAAN_MENTAH);
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
        <div className="absolute left-1/2 top-3 z-10 flex -translate-x-1/2 gap-1.5">
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
        </div>
        <PanelBobot
          bobot={bobot}
          onBobotBerubah={ubahBobot}
          onKembalikanBawaan={kembalikanBawaan}
        />
        <PetaHeksagon
        onPilih={setHeksagonTerpilih}
        onStatusBasemap={setBasemapAktif}
        onPetaSiap={({ versi: v, labels: l }) => {
          setVersi(v);
          setLabels(l);
        }}
        skorTerkini={skorTerkini}
        onDataSiap={(m) => {
          mesin.current = m;
          indeksH3.current = new Map(m.h3.map((id, i) => [id, i]));
          const { bobot: ternormalisasi } = normalisasiBobot(BAWAAN_MENTAH);
          setSkorTerkini(hitungSemua(m, ternormalisasi));
        }}
        onAmbangBerubah={({ ambang, minSkor, maksSkor }) => {
          setAmbangInfo({ ambang, minSkor, maksSkor });
          setLabels(labelKelas(ambang, minSkor, maksSkor));
        }}
        lapisanAktif={lapisanAktif}
        onJumlahLapisan={setJumlahLapisan}
      />
      <Legenda labels={labels} />
      <PanelLapisan
        lapisanAktif={lapisanAktif}
        onToggle={toggleLapisan}
        jumlahLapisan={jumlahLapisan}
      />
      {heksagonTerpilih && (
        <PanelKawasan
          heksagon={heksagonTerpilih}
          versi={versi}
          skorKini={skorTerpilih}
          bobotKini={bedaDariBawaan ? normalisasiBobot(bobot).bobot : null}
          onTutup={() => setHeksagonTerpilih(null)}
          narasiCache={narasiCache}
          simpanNarasi={(h3, hasil) =>
            setNarasiCache((c) => (c[h3] ? c : { ...c, [h3]: hasil }))
          }
        />
      )}
      </div>
    </div>
  );
}
