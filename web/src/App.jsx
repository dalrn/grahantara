import { useState } from "react";

import PetaHeksagon from "./components/PetaHeksagon";
import Legenda from "./components/Legenda";
import PanelRingkas from "./components/PanelRingkas";
import PitaPeringatan from "./components/PitaPeringatan";

export default function App() {
  const [heksagonTerpilih, setHeksagonTerpilih] = useState(null);
  const [versi, setVersi] = useState(null);
  const [basemapAktif, setBasemapAktif] = useState(false);
  const [labels, setLabels] = useState(null);

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-slate-900">
      <PitaPeringatan versi={versi} basemapAktif={basemapAktif} />
      <PetaHeksagon
        onPilih={setHeksagonTerpilih}
        onStatusBasemap={setBasemapAktif}
        onPetaSiap={({ versi: v, labels: l }) => {
          setVersi(v);
          setLabels(l);
        }}
      />
      <Legenda labels={labels} />
      {heksagonTerpilih && (
        <PanelRingkas heksagon={heksagonTerpilih} onTutup={() => setHeksagonTerpilih(null)} />
      )}
    </div>
  );
}
