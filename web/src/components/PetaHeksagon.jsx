import { useEffect, useRef } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

import { GAYA_BASEMAP_MAPID, WARNA_KELAS } from "../config";
import { hitungKuintil, ekspresiWarna, labelKelas } from "../lib/kelas";

const BATAS = [[110.334, -7.837], [110.473, -7.643]];

export default function PetaHeksagon({ onPilih, onStatusBasemap, onPetaSiap }) {
  const wadah = useRef(null);
  const peta = useRef(null);
  const hoverId = useRef(null);
  const terpilihId = useRef(null);

  useEffect(() => {
    if (!wadah.current || peta.current) return;

    const kunci = import.meta.env.VITE_MAPID_BASEMAP_KEY;
    const gaya = kunci
      ? `https://v2.basemap.mapid.io/styles/${GAYA_BASEMAP_MAPID}/style.json?key=${kunci}`
      : {
          version: 8,
          sources: {},
          layers: [
            { id: "latar", type: "background", paint: { "background-color": "#0b1220" } },
          ],
        };
    onStatusBasemap(Boolean(kunci));

    const map = new maplibregl.Map({
      container: wadah.current,
      style: gaya,
      center: [110.403, -7.75],
      zoom: 12,
    });
    peta.current = map;
    map.addControl(new maplibregl.NavigationControl(), "top-right");

    map.on("load", async () => {
      const data = await (await fetch("/data/hexagons.geojson")).json();
      const skorArr = data.features.map((f) => f.properties.skor);
      const minSkor = Math.min(...skorArr);
      const maksSkor = Math.max(...skorArr);
      const ambang = hitungKuintil(skorArr);

      map.addSource("heksagon", {
        type: "geojson",
        data,
        promoteId: "h3_index",
      });
      map.addLayer({
        id: "heksagon-isi",
        type: "fill",
        source: "heksagon",
        paint: {
          "fill-color": ekspresiWarna(ambang, WARNA_KELAS),
          "fill-opacity": [
            "case",
            ["boolean", ["feature-state", "terpilih"], false], 0.95,
            ["boolean", ["feature-state", "hover"], false], 0.85,
            0.7,
          ],
        },
      });
      map.addLayer({
        id: "heksagon-garis",
        type: "line",
        source: "heksagon",
        paint: {
          "line-color": [
            "case",
            ["boolean", ["feature-state", "terpilih"], false], "#ffffff",
            "rgba(255,255,255,0.15)",
          ],
          "line-width": [
            "case",
            ["boolean", ["feature-state", "terpilih"], false], 2,
            0.4,
          ],
        },
      });
      map.fitBounds(BATAS, { padding: 40 });

      onPetaSiap({ versi: data.metadata?.versi ?? null, labels: labelKelas(ambang, minSkor, maksSkor) });
    });

    map.on("mousemove", "heksagon-isi", (e) => {
      if (!e.features?.length) return;
      const id = e.features[0].properties.h3_index;
      if (id !== hoverId.current) {
        if (hoverId.current) {
          map.setFeatureState({ source: "heksagon", id: hoverId.current }, { hover: false });
        }
        hoverId.current = id;
        map.setFeatureState({ source: "heksagon", id }, { hover: true });
      }
      map.getCanvas().style.cursor = "pointer";
    });
    map.on("mouseleave", "heksagon-isi", () => {
      if (hoverId.current) {
        map.setFeatureState({ source: "heksagon", id: hoverId.current }, { hover: false });
        hoverId.current = null;
      }
      map.getCanvas().style.cursor = "";
    });
    map.on("click", "heksagon-isi", (e) => {
      if (!e.features?.length) return;
      const id = e.features[0].properties.h3_index;
      if (terpilihId.current && terpilihId.current !== id) {
        map.setFeatureState({ source: "heksagon", id: terpilihId.current }, { terpilih: false });
      }
      terpilihId.current = id;
      map.setFeatureState({ source: "heksagon", id }, { terpilih: true });
      // MapLibre menyerikan objek bersarang jadi string JSON; pulihkan.
      const props = e.features[0].properties;
      const sub = typeof props.subskor === "string" ? JSON.parse(props.subskor) : props.subskor;
      onPilih({ ...props, subskor: sub });
    });

    return () => {
      map.remove();
      peta.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <div ref={wadah} className="absolute inset-0" style={{ position: "absolute" }} />;
}
