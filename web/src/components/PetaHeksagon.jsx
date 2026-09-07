import { useEffect, useRef } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

import { GAYA_BASEMAP_MAPID, WARNA_KELAS } from "../config";
import { hitungKuintil, ekspresiWarna, labelKelas } from "../lib/kelas";
import { siapkanMesin } from "../lib/mesinSkor";
import { DEFINISI_LAPISAN } from "../lib/lapisan";

const BATAS = [[110.334, -7.837], [110.473, -7.643]];
const ID_LAYER_TITIK = DEFINISI_LAPISAN.filter((d) => d.tersedia).map((d) => `titik-${d.id}`);

function ekspresiWarnaTerkini(ambang) {
  // Skor hasil hitung klien (feature-state) bila ada, fallback skor bawaan.
  return [
    "step",
    ["coalesce", ["feature-state", "skorHitung"], ["get", "skor"]],
    WARNA_KELAS[0],
    ambang[0], WARNA_KELAS[1],
    ambang[1], WARNA_KELAS[2],
    ambang[2], WARNA_KELAS[3],
    ambang[3], WARNA_KELAS[4],
  ];
}

function hargaPopup(kos) {
  if (typeof kos.harga_median !== "number") {
    return { harga: "harga tidak tercatat", lencana: null };
  }
  return { harga: `Rp ${kos.harga_median.toLocaleString("id-ID")} / bulan`, lencana: kos.sumber_harga };
}

export default function PetaHeksagon({
  onPilih,
  onStatusBasemap,
  onPetaSiap,
  skorTerkini,
  onDataSiap,
  onAmbangBerubah,
  lapisanAktif,
  onJumlahLapisan,
  modeBanding,
  pilihanBanding,
  onPilihBanding,
}) {
  const wadah = useRef(null);
  const peta = useRef(null);
  const hoverId = useRef(null);
  const terpilihId = useRef(null);
  const mesin = useRef(null);
  const raf = useRef(null);
  const ambangBawaan = useRef(null);

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
            ["boolean", ["feature-state", "terpilih"], false], 0.85,
            ["boolean", ["feature-state", "hover"], false], 0.75,
            0.55,
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
            ["boolean", ["feature-state", "bandingA"], false], "#38bdf8",
            ["boolean", ["feature-state", "bandingB"], false], "#f97316",
            ["boolean", ["feature-state", "terpilih"], false], "#0f172a",
            "rgba(15,23,42,0.25)",
          ],
          "line-width": [
            "case",
            ["boolean", ["feature-state", "bandingA"], false], 3,
            ["boolean", ["feature-state", "bandingB"], false], 3,
            ["boolean", ["feature-state", "terpilih"], false], 2,
            0.4,
          ],
        },
      });
      map.fitBounds(BATAS, { padding: 40 });

      // --- layer titik (fetch paralel) ---
      const jumlah = {};
      const hasilFetch = await Promise.all(
        DEFINISI_LAPISAN.filter((d) => d.berkas).map(async (def) => {
          const geo = await (await fetch(def.berkas)).json();
          return { def, geo };
        }),
      );
      for (const { def, geo } of hasilFetch) {
        const n = geo.features?.length ?? 0;
        jumlah[def.id] = n;
        map.addSource(`titik-${def.id}`, { type: "geojson", data: geo });
        const jari = def.jari;
        const radius = [
          "interpolate",
          ["linear"],
          ["zoom"],
          11, jari * 0.6,
          15, jari,
          17, jari * 1.6,
        ];
        let warna = def.warna;
        let stroke = "#ffffff";
        if (def.id === "kos") {
          warna = ["case", ["==", ["get", "harga_median"], null], "#64748b", "#f43f5e"];
          stroke = ["case", ["==", ["get", "harga_median"], null], "#0f172a", "#ffffff"];
        }
        map.addLayer({
          id: `titik-${def.id}`,
          type: "circle",
          source: `titik-${def.id}`,
          paint: {
            "circle-radius": radius,
            "circle-color": warna,
            "circle-stroke-width": 1,
            "circle-stroke-color": stroke,
          },
        });
        if (!lapisanAktif[def.id]) {
          map.setLayoutProperty(`titik-${def.id}`, "visibility", "none");
        }
      }
      onJumlahLapisan(jumlah);

      onPetaSiap({ versi: data.metadata?.versi ?? null, labels: labelKelas(ambang, minSkor, maksSkor) });
      mesin.current = siapkanMesin(data);
      ambangBawaan.current = ambang;
      onDataSiap(mesin.current);
    });

    // popup titik (handler didaftarkan lebih dulu)
    for (const def of DEFINISI_LAPISAN.filter((d) => d.tersedia)) {
      map.on("click", `titik-${def.id}`, (e) => {
        if (!e.features?.length) return;
        const p = e.features[0].properties;
        let isi;
        if (def.id === "kampus") {
          isi = `<div class="text-sm"><b>${p.nama}</b><br/><span class="text-slate-400">Jumlah gerbang: ${p.jumlah_gerbang}</span></div>`;
        } else if (def.id === "halte") {
          let koridor = p.koridor;
          if (typeof koridor === "string") {
            try {
              koridor = JSON.parse(koridor);
            } catch {
              koridor = null;
            }
          }
          const teksKoridor =
            Array.isArray(koridor) && koridor.length ? koridor.join(", ") : null;
          isi = `<div class="text-sm"><b>${p.nama}</b><br/><span class="text-slate-400">Koridor: ${teksKoridor ?? "tidak tercatat"}</span></div>`;
        } else {
          const { harga, lencana } = hargaPopup(p);
          const lencanaHtml =
            lencana === "model"
              ? '<span class="ml-1 rounded bg-yellow-700 px-1 text-[10px] text-yellow-100">Estimasi</span>'
              : lencana === "survei"
                ? '<span class="ml-1 rounded bg-slate-500 px-1 text-[10px] text-slate-100">Survei lapangan</span>'
                : "";
          const jarak = typeof p.jarak_halte_m === "number" ? `<br/><span class="text-slate-400">Jarak ke halte: ${p.jarak_halte_m.toLocaleString("id-ID")} m</span>` : "";
          isi = `<div class="text-sm"><b>${p.nama}</b>${lencanaHtml}<br/><span class="text-slate-300">${p.jenis}</span><br/><b>${harga}</b>${jarak}</div>`;
        }
        new maplibregl.Popup({ closeButton: false, offset: 12 })
          .setLngLat(e.lngLat)
          .setHTML(isi)
          .addTo(map);
      });
      map.on("mouseenter", `titik-${def.id}`, () => {
        map.getCanvas().style.cursor = "pointer";
      });
      map.on("mouseleave", `titik-${def.id}`, () => {
        map.getCanvas().style.cursor = "";
      });
    }

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
      // klik titik tidak boleh memicu seleksi heksagon
      if (e.originalEvent && ID_LAYER_TITIK.length) {
        const titik = map.queryRenderedFeatures(e.point, { layers: ID_LAYER_TITIK });
        if (titik.length) return;
      }
      if (!e.features?.length) return;
      const id = e.features[0].properties.h3_index;
      if (modeRef.current) {
        // MapLibre menyerikan objek bersarang jadi string JSON; pulihkan.
        const props = { ...e.features[0].properties };
        for (const k of ["subskor", "indikator"]) {
          if (typeof props[k] === "string") {
            try {
              props[k] = JSON.parse(props[k]);
            } catch {
              props[k] = null;
            }
          }
        }
        onPilihBanding({ ...props, h3_index: id });
        return;
      }
      if (terpilihId.current && terpilihId.current !== id) {
        map.setFeatureState({ source: "heksagon", id: terpilihId.current }, { terpilih: false });
      }
      terpilihId.current = id;
      map.setFeatureState({ source: "heksagon", id }, { terpilih: true });
      // MapLibre menyerikan objek bersarang jadi string JSON; pulihkan.
      const props = { ...e.features[0].properties };
      let galat = false;
      for (const k of ["subskor", "indikator"]) {
        if (typeof props[k] === "string") {
          try {
            props[k] = JSON.parse(props[k]);
          } catch {
            galat = true;
            props[k] = null;
          }
        }
      }
      onPilih({ ...props, galatParsing: galat || undefined });
    });

    return () => {
      if (raf.current) cancelAnimationFrame(raf.current);
      map.remove();
      peta.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // visibilitas layer titik mengikuti lapisanAktif
  useEffect(() => {
    const map = peta.current;
    if (!map) return;
    for (const def of DEFINISI_LAPISAN.filter((d) => d.tersedia)) {
      if (!map.getLayer(`titik-${def.id}`)) continue;
      map.setLayoutProperty(
        `titik-${def.id}`,
        "visibility",
        lapisanAktif[def.id] ? "visible" : "none",
      );
    }
  }, [lapisanAktif]);

  // sorotan banding A/B lewat feature-state (modeBanding via ref, klik pakai nilai terbaru)
  const modeRef = useRef(modeBanding);
  const pilihanRef = useRef(pilihanBanding);
  const bandingAId = useRef(null);
  const bandingBId = useRef(null);
  useEffect(() => {
    modeRef.current = modeBanding;
    pilihanRef.current = pilihanBanding;
    const map = peta.current;
    if (!map || !map.getLayer("heksagon-isi")) return;
    const set = (lama, baru, kunci, ref) => {
      if (lama && lama !== baru) {
        map.setFeatureState({ source: "heksagon", id: lama }, { [kunci]: false });
      }
      if (baru && baru !== lama) {
        map.setFeatureState({ source: "heksagon", id: baru }, { [kunci]: true });
      }
      ref.current = baru;
    };
    if (!modeBanding) {
      if (bandingAId.current) map.setFeatureState({ source: "heksagon", id: bandingAId.current }, { bandingA: false });
      if (bandingBId.current) map.setFeatureState({ source: "heksagon", id: bandingBId.current }, { bandingB: false });
      bandingAId.current = null;
      bandingBId.current = null;
      return;
    }
    set(bandingAId.current, pilihanBanding?.a ?? null, "bandingA", bandingAId);
    set(bandingBId.current, pilihanBanding?.b ?? null, "bandingB", bandingBId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modeBanding, pilihanBanding]);

  // skor hasil hitung klien -> feature-state + ambang + warna (satu rAF per gerakan)
  useEffect(() => {
    const map = peta.current;
    if (!map || !mesin.current || !map.getLayer("heksagon-isi")) return;
    if (raf.current) cancelAnimationFrame(raf.current);
    raf.current = requestAnimationFrame(() => {
      if (skorTerkini === null) {
        map.setPaintProperty("heksagon-isi", "fill-color",
          ekspresiWarna(ambangBawaan.current, WARNA_KELAS));
        return;
      }
      const { h3, n } = mesin.current;
      for (let i = 0; i < n; i++) {
        map.setFeatureState({ source: "heksagon", id: h3[i] }, { skorHitung: skorTerkini[i] });
      }
      const urut = [...skorTerkini].sort((a, b) => a - b);
      const ambang = hitungKuintil(urut);
      const minSkor = urut[0];
      const maksSkor = urut[n - 1];
      map.setPaintProperty("heksagon-isi", "fill-color", ekspresiWarnaTerkini(ambang));
      onAmbangBerubah({ ambang, minSkor, maksSkor });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [skorTerkini]);

  return <div ref={wadah} className="absolute inset-0" style={{ position: "absolute" }} />;
}
