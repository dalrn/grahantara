import { createPinImage, scoreColor, PIN_SIZE } from "../lib/pins";
import { useEffect, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

import { GAYA_BASEMAP_MAPID, WARNA_KELAS } from "../config";
import { hitungKuintil, ekspresiWarna, labelKelas } from "../lib/kelas";
import { siapkanMesin } from "../lib/mesinSkor";
import { DEFINISI_LAPISAN } from "../lib/lapisan";
import { prepareBasemap } from "../lib/basemap";
import { busImage, campusImage, polygonCenter } from "../lib/mapSymbols";
import { formatCoordinates } from "../lib/format";

const BATAS = [
  [110.334, -7.837],
  [110.473, -7.643],
];
const ID_LAYER_TITIK = DEFINISI_LAPISAN.filter((d) => d.tersedia).map(
  (d) => `titik-${d.id}`,
);

// Ruang yang ditempati panel melayang, agar isi peta tidak tersembunyi di
// bawah panel bobot (kiri) dan panel kawasan (kanan).
function paddingPeta() {
  const lebar = window.innerWidth;
  if (lebar < 768) return { top: 70, bottom: 120, left: 20, right: 20 };
  return { top: 76, bottom: 40, left: 320, right: 60 };
}

const escapeHTML = (value) =>
  String(value).replace(
    /[&<>"']/g,
    (char) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[char],
  );

// MapLibre kadang menyerahkan geometri sebagai string JSON, dan geometri
// bisa absen pada beberapa sumber. Selalu kembalikan [lon, lat] berupa angka.
function koordinatFitur(e) {
  let g = e.features?.[0]?.geometry;
  if (typeof g === "string") {
    try {
      g = JSON.parse(g);
    } catch {
      g = null;
    }
  }
  const c = g?.coordinates;
  if (Array.isArray(c) && Number.isFinite(c[0]) && Number.isFinite(c[1]))
    return [c[0], c[1]];
  return [e.lngLat.lng, e.lngLat.lat];
}

function ekspresiWarnaTerkini(ambang) {
  // Skor hasil hitung klien (feature-state) bila ada, fallback skor bawaan.
  return [
    "step",
    ["coalesce", ["feature-state", "skorHitung"], ["get", "skor"]],
    WARNA_KELAS[0],
    ambang[0],
    WARNA_KELAS[1],
    ambang[1],
    WARNA_KELAS[2],
    ambang[2],
    WARNA_KELAS[3],
    ambang[3],
    WARNA_KELAS[4],
  ];
}

function hargaPopup(kos) {
  if (typeof kos.harga_median !== "number") {
    return { harga: "harga tidak tercatat", lencana: null };
  }
  return {
    harga: `Rp ${kos.harga_median.toLocaleString("id-ID")} / bulan`,
    lencana: kos.sumber_harga,
  };
}

// Pemetaan nilai sumber_harga nyata (metode pengumpulan survei lapangan)
// ke lencana. Nilai 'model'/'survei' lama dipertahankan untuk kompatibilitas
// bila pipeline berubah.
const LENCANA_SUMBER_KOS = {
  model: { teks: "Estimasi", warna: "bg-yellow-700 text-yellow-100" },
  survei: { teks: "Survei lapangan", warna: "bg-slate-500 text-slate-100" },
  "Tanya pengelola": {
    teks: "Survei lapangan",
    warna: "bg-slate-500 text-slate-100",
  },
  "Tanya penghuni": {
    teks: "Survei lapangan",
    warna: "bg-slate-500 text-slate-100",
  },
  Spanduk: { teks: "Survei lapangan", warna: "bg-slate-500 text-slate-100" },
  "Spanduk atau papan": {
    teks: "Survei lapangan",
    warna: "bg-slate-500 text-slate-100",
  },
  "Sosial media": {
    teks: "Sosial media",
    warna: "bg-slate-500 text-slate-100",
  },
};

function lencanaKos(sumber) {
  if (!sumber)
    return {
      teks: "Sumber tidak tercatat",
      warna: "bg-slate-600 text-slate-200",
      mentah: null,
    };
  const peta = LENCANA_SUMBER_KOS[sumber];
  if (peta) return { ...peta, mentah: sumber };
  return {
    teks: "Sumber tidak tercatat",
    warna: "bg-slate-600 text-slate-200",
    mentah: sumber,
  };
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
  comparisonType,
  onCompareKos,
  fokus,
  onMintaRute,
  onPilihGerbang,
  rute,
}) {
  const wadah = useRef(null);
  const peta = useRef(null);
  const hoverId = useRef(null);
  const terpilihId = useRef(null);
  const mesin = useRef(null);
  const raf = useRef(null);
  const ambangBawaan = useRef(null);
  const pinFeatures = useRef([]);
  const renderedColors = useRef(new Map());
  const colorRaf = useRef(null);
  const pinHover = useRef(null);
  const pinSelected = useRef(null);
  const hexCoordinates = useRef(new Map());
  const indikatorPerH3 = useRef(new Map());
  const popupGerbang = useRef(null);
  const comparisonRef = useRef({ comparisonType, onCompareKos });
  comparisonRef.current = { comparisonType, onCompareKos };
  const ruteRef = useRef({ onMintaRute, onPilihGerbang, adaRute: false });
  ruteRef.current = { onMintaRute, onPilihGerbang, adaRute: Boolean(rute) };
  const fokusRef = useRef(fokus);
  fokusRef.current = fokus;
  const [loadState, setLoadState] = useState("loading");
  const layerVisibility = useRef(lapisanAktif);
  layerVisibility.current = lapisanAktif;

  useEffect(() => {
    if (!wadah.current || peta.current) return;

    const kunci = import.meta.env.VITE_MAPID_BASEMAP_KEY;
    const { style: gaya, configured } = prepareBasemap(
      kunci,
      GAYA_BASEMAP_MAPID,
    );
    onStatusBasemap(configured);

    const map = new maplibregl.Map({
      container: wadah.current,
      style: gaya,
      center: fokusRef.current?.pusat ?? [110.403, -7.75],
      zoom: fokusRef.current?.zoom ?? 12,
    });
    peta.current = map;
    map.addControl(new maplibregl.NavigationControl(), "top-right");

    let disposed = false;
    let holdTimer = null;
    let holdStart = null;
    let suppressTapUntil = 0;
    let heldKosId = null;
    let activePopup = null;
    const cancelHold = () => {
      clearTimeout(holdTimer);
      holdTimer = null;
      holdStart = null;
    };
    const controller = new AbortController();
    const fetchGeo = async (url) => {
      const response = await fetch(url, { signal: controller.signal });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return response.json();
    };
    const muatData = async () => {
      try {
        const data = await fetchGeo("/data/hexagons.geojson");
        if (disposed) return;
        hexCoordinates.current = new Map(
          data.features.map((f) => [f.properties.h3_index, polygonCenter(f)]),
        );
        const skorArr = data.features.map((f) => f.properties.skor);
        // Math.min(...arr) menyebar 2.134 argumen; reduce lebih murah dan
        // tidak berisiko melewati batas argumen.
        let minSkor = Infinity;
        let maksSkor = -Infinity;
        for (const v of skorArr) {
          if (v < minSkor) minSkor = v;
          if (v > maksSkor) maksSkor = v;
        }
        const ambang = hitungKuintil(skorArr);
        renderedColors.current = new Map(
          data.features.map((f) => [
            f.properties.h3_index,
            scoreColor(f.properties.skor, ambang),
          ]),
        );

        // Indikator (16 per heksagon, ~3,3 MB) hanya dipakai panel detail
        // untuk SATU heksagon. Simpan terpisah dan jangan diserahkan ke
        // MapLibre, supaya sumber peta tidak menyalin dan menyerikannya.
        indikatorPerH3.current = new Map(
          data.features.map((f) => [
            f.properties.h3_index,
            f.properties.indikator,
          ]),
        );
        const dataPeta = {
          ...data,
          features: data.features.map((f) => {
            // eslint-disable-next-line no-unused-vars
            const { indikator, ...sisa } = f.properties;
            return { ...f, properties: sisa };
          }),
        };

        map.addSource("heksagon", {
          type: "geojson",
          data: dataPeta,
          promoteId: "h3_index",
        });
        map.addLayer({
          id: "heksagon-isi",
          type: "fill",
          source: "heksagon",
          paint: {
            "fill-color": ekspresiWarna(ambang, WARNA_KELAS),
            "fill-color-transition": { duration: 200 },
            "fill-opacity-transition": { duration: 200 },
            "fill-opacity": [
              "case",
              ["boolean", ["feature-state", "terpilih"], false],
              0.72,
              ["boolean", ["feature-state", "hover"], false],
              0.58,
              0.38,
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
              ["boolean", ["feature-state", "bandingA"], false],
              "#38bdf8",
              ["boolean", ["feature-state", "bandingB"], false],
              "#f97316",
              ["boolean", ["feature-state", "terpilih"], false],
              "#ffffff",
              ["boolean", ["feature-state", "hover"], false],
              "#b4f1db",
              "rgba(255,255,255,0.15)",
            ],
            "line-width": [
              "case",
              ["boolean", ["feature-state", "bandingA"], false],
              3,
              ["boolean", ["feature-state", "bandingB"], false],
              3,
              ["boolean", ["feature-state", "terpilih"], false],
              2,
              ["boolean", ["feature-state", "hover"], false],
              1.4,
              0.4,
            ],
          },
        });
        if (fokusRef.current) {
          // Kampus disebut di beranda: langsung perlihatkan kawasan
          // sekitarnya, bukan seluruh wilayah studi.
          map.jumpTo({
            center: fokusRef.current.pusat,
            zoom: fokusRef.current.zoom,
            padding: paddingPeta(),
          });
        } else {
          map.fitBounds(BATAS, { padding: paddingPeta(), duration: 0 });
        }

        // --- layer titik (fetch paralel) ---
        const jumlah = {};
        const hasilFetch = await Promise.allSettled(
          DEFINISI_LAPISAN.filter((d) => d.berkas).map(async (def) => {
            const geo = await fetchGeo(def.berkas);
            return { def, geo };
          }),
        );
        if (disposed) return;
        for (const result of hasilFetch) {
          if (result.status !== "fulfilled") continue;
          const { def, geo } = result.value;
          const n = geo.features?.length ?? 0;
          jumlah[def.id] = n;
          map.addSource(`titik-${def.id}`, {
            type: "geojson",
            data: geo,
            ...(def.id === "kos" ? { promoteId: "id" } : {}),
          });
          if (def.id === "kos") {
            pinFeatures.current = geo.features;
            const scoresByH3 = new Map(
              data.features.map((f) => [
                f.properties.h3_index,
                f.properties.skor,
              ]),
            );
            for (const feature of geo.features) {
              const { id, h3_index, harga_median } = feature.properties;
              map.addImage(
                `kos-pin-${id}`,
                createPinImage(
                  map,
                  id,
                  !Number.isFinite(harga_median),
                  scoreColor(scoresByH3.get(h3_index), ambang),
                ),
                { pixelRatio: 2 },
              );
            }
            map.addLayer({
              id: "titik-kos",
              type: "symbol",
              source: "titik-kos",
              layout: {
                "icon-image": ["concat", "kos-pin-", ["get", "id"]],
                "icon-size": PIN_SIZE,
                "icon-anchor": "bottom",
                "icon-offset": [0, 3],
                "icon-allow-overlap": true,
                "icon-ignore-placement": true,
                visibility: layerVisibility.current.kos ? "visible" : "none",
              },
              paint: { "icon-opacity": 1 },
            });
            continue;
          }
          if (def.id === "kampus" || def.id === "halte") {
            const campus = def.id === "kampus";
            if (campus) {
              await document.fonts.ready;
              if (disposed) return;
              for (const feature of geo.features) {
                const name = feature.properties.nama;
                if (!map.hasImage(`campus-${name}`))
                  map.addImage(`campus-${name}`, campusImage(name), {
                    pixelRatio: 2,
                  });
              }
            } else map.addImage("bus-stop", busImage(), { pixelRatio: 2 });
            map.addLayer({
              id: `titik-${def.id}`,
              type: "symbol",
              source: `titik-${def.id}`,
              layout: {
                "icon-image": campus
                  ? ["concat", "campus-", ["get", "nama"]]
                  : "bus-stop",
                "icon-size": campus
                  ? ["interpolate", ["linear"], ["zoom"], 10, 1, 17, 1.15]
                  : [
                      "interpolate",
                      ["linear"],
                      ["zoom"],
                      10,
                      0.6,
                      14,
                      0.8,
                      17,
                      1,
                    ],
                "icon-anchor": "bottom",
                "icon-padding": campus ? 3 : 5,
                "icon-allow-overlap": false,
                visibility: layerVisibility.current[def.id]
                  ? "visible"
                  : "none",
              },
            });
            continue;
          }
          const jari = def.jari;
          const radius = [
            "interpolate",
            ["linear"],
            ["zoom"],
            11,
            jari * 0.6,
            15,
            jari,
            17,
            jari * 1.6,
          ];
          let warna = def.warna;
          let stroke = "#192b27";
          if (def.id === "kos") {
            warna = [
              "case",
              ["==", ["get", "harga_median"], null],
              "#64748b",
              "#f43f5e",
            ];
            stroke = [
              "case",
              ["==", ["get", "harga_median"], null],
              "#f8fafc",
              "#192b27",
            ];
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
          if (!layerVisibility.current[def.id]) {
            map.setLayoutProperty(`titik-${def.id}`, "visibility", "none");
          }
        }
        // Campus labels take priority over dense bus stops; kos remain clickable on top.
        if (map.getLayer("titik-kampus")) map.moveLayer("titik-kampus");
        if (map.getLayer("titik-kos")) map.moveLayer("titik-kos");
        onJumlahLapisan(jumlah);

        onPetaSiap({
          versi: data.metadata?.versi ?? null,
          dihitungPada: data.metadata?.dihitung_pada ?? null,
          bobotDefault: data.metadata?.bobot_default ?? null,
          labels: labelKelas(ambang, minSkor, maksSkor),
        });
        mesin.current = siapkanMesin(data);
        ambangBawaan.current = ambang;
        onDataSiap(mesin.current);
        setLoadState(
          hasilFetch.some((r) => r.status === "rejected") ? "partial" : "ready",
        );
      } catch (error) {
        if (!disposed && error.name !== "AbortError") setLoadState("error");
      }
    };
    // MapLibre tidak memicu "load" lagi bila gaya sudah selesai dimuat saat
    // handler didaftarkan (terjadi pada mount kedua React StrictMode, dan
    // saat gaya terlayani dari cache). Tanpa cabang ini, peta berhenti di
    // kartu "Menyiapkan peta" selamanya.
    if (map.isStyleLoaded()) muatData();
    else map.once("load", muatData);

    // popup titik (handler didaftarkan lebih dulu)
    map.on("touchstart", "titik-kos", (e) => {
      cancelHold();
      if (e.originalEvent.touches.length !== 1 || !e.features?.length) return;
      const feature = e.features[0];
      holdStart = e.point;
      holdTimer = setTimeout(() => {
        holdTimer = null;
        holdStart = null;
        suppressTapUntil = performance.now() + 1000;
        heldKosId = feature.properties.id;
        activePopup?.remove();
        comparisonRef.current.onCompareKos({
          ...feature.properties,
          coordinates: feature.geometry.coordinates,
          kind: "kos",
        });
      }, 550);
    });
    map.on("touchstart", (e) => {
      if (e.originalEvent.touches.length !== 1) cancelHold();
    });
    map.on("touchmove", (e) => {
      if (
        holdStart &&
        (e.originalEvent.touches.length !== 1 ||
          Math.hypot(e.point.x - holdStart.x, e.point.y - holdStart.y) > 10)
      )
        cancelHold();
    });
    map.on("touchend", cancelHold);
    map.on("dragstart", cancelHold);
    map.on("zoomstart", cancelHold);
    map.getCanvas().addEventListener("touchcancel", cancelHold);
    map.on("contextmenu", "titik-kos", (e) => {
      if (holdTimer || performance.now() < suppressTapUntil)
        e.originalEvent.preventDefault();
    });
    for (const def of DEFINISI_LAPISAN.filter((d) => d.tersedia)) {
      map.on("click", `titik-${def.id}`, (e) => {
        if (
          def.id === "kos" &&
          e.features?.[0]?.properties.id === heldKosId &&
          performance.now() < suppressTapUntil
        )
          return;
        if (!e.features?.length) return;
        const top = map.queryRenderedFeatures(e.point, {
          layers: ID_LAYER_TITIK.filter((id) => map.getLayer(id)),
        })[0];
        if (top && top.layer.id !== `titik-${def.id}`) return;
        const feature = e.features[0];
        const kosData = {
          ...feature.properties,
          coordinates: feature.geometry.coordinates,
          kind: "kos",
        };
        if (
          def.id === "kos" &&
          (e.originalEvent?.ctrlKey ||
            e.originalEvent?.metaKey ||
            (modeRef.current && comparisonRef.current.comparisonType === "kos"))
        ) {
          activePopup?.remove();
          comparisonRef.current.onCompareKos(kosData);
          return;
        }
        const p = Object.fromEntries(
          Object.entries(e.features[0].properties).map(([key, value]) => [
            key,
            typeof value === "string" && key !== "koridor"
              ? escapeHTML(value)
              : value,
          ]),
        );
        activePopup?.remove();
        if (def.id === "kos") {
          if (pinSelected.current)
            map.setFeatureState(
              { source: "titik-kos", id: pinSelected.current },
              { selected: false },
            );
          pinSelected.current = p.id;
          map.setFeatureState(
            { source: "titik-kos", id: p.id },
            { selected: true },
          );
          map.triggerRepaint();
        }
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
            Array.isArray(koridor) && koridor.length
              ? escapeHTML(koridor.join(", "))
              : null;
          isi = `<div class="text-sm"><b>${p.nama}</b><br/><span class="text-slate-400">Koridor: ${teksKoridor ?? "tidak tercatat"}</span></div>`;
        } else if (def.id === "gerbang") {
          // Label sudah memuat kampus + jalan terdekat; tidak perlu diulang.
          isi = `<div class="text-sm"><b>${escapeHTML(String(p.label ?? `Gerbang ${p.kampus}`))}</b></div>`;
        } else if (def.id === "krl") {
          // berkas KRL hanya memuat nama — jangan mengarang isi lain.
          isi = `<div class="text-sm"><b>${p.nama}</b></div>`;
        } else {
          const { harga } = hargaPopup(p);
          const lencana = lencanaKos(p.sumber_harga);
          const lencanaHtml = `<span class="ml-1 rounded px-1 text-xs font-medium ${lencana.warna}">${lencana.teks}</span>`;
          const jarak =
            typeof p.jarak_halte_m === "number"
              ? `<br/><span class="text-slate-400">Jarak ke halte: ${p.jarak_halte_m.toLocaleString("id-ID")} m</span>`
              : "";
          isi = `<div class="text-sm"><b>${p.nama}</b>${lencanaHtml}<br/><span class="text-slate-300">${p.jenis}</span><br/><b>${harga}</b>${jarak}</div>`;
        }
        const popup = new maplibregl.Popup({ closeButton: true, offset: 24 })
          .setLngLat(e.features[0].geometry.coordinates)
          .setHTML(isi)
          .addTo(map)
          .on("close", () => {
            if (def.id === "kos" && pinSelected.current === p.id) {
              map.setFeatureState(
                { source: "titik-kos", id: p.id },
                { selected: false },
              );
              pinSelected.current = null;
              map.triggerRepaint();
            }
          });
        activePopup = popup;
        if (def.id === "kos") {
          const content = popup
            .getElement()
            .querySelector(".maplibregl-popup-content");
          const coordinates = document.createElement("p");
          coordinates.className = "mt-2 text-xs text-slate-300";
          coordinates.textContent = formatCoordinates(kosData.coordinates);
          content.append(coordinates);
          const tombolRute = document.createElement("button");
          tombolRute.type = "button";
          tombolRute.className =
            "mt-3 w-full rounded-lg bg-sky-500 px-3 py-2 text-sm font-bold text-white";
          tombolRute.textContent = "Rute ke kampus";
          tombolRute.addEventListener("click", () => {
            ruteRef.current.onMintaRute(kosData);
            popup.remove();
          });
          content.append(tombolRute);
          const button = document.createElement("button");
          button.type = "button";
          button.className =
            "mt-2 w-full rounded-lg bg-emerald-400 px-3 py-2 text-sm font-bold text-slate-950";
          button.textContent = "Bandingkan kos ini";
          button.addEventListener("click", () => {
            comparisonRef.current.onCompareKos(kosData);
            popup.remove();
          });
          content.append(button);
        }
        if (def.id === "gerbang") {
          const content = popup
            .getElement()
            .querySelector(".maplibregl-popup-content");
          const aktif = ruteRef.current.adaRute;
          const tombol = document.createElement("button");
          tombol.type = "button";
          tombol.className = aktif
            ? "mt-3 w-full rounded-lg bg-sky-500 px-3 py-2 text-sm font-bold text-white"
            : "mt-3 w-full cursor-not-allowed rounded-lg bg-slate-700 px-3 py-2 text-sm font-semibold text-slate-400";
          tombol.textContent = aktif
            ? "Rute ke gerbang ini"
            : "Pilih kos dulu untuk rute";
          tombol.disabled = !aktif;
          if (aktif)
            tombol.addEventListener("click", () => {
              ruteRef.current.onPilihGerbang({
                kampus: p.kampus,
                label: p.label ?? `Gerbang ${p.kampus}`,
                coordinates: koordinatFitur(e),
              });
              popup.remove();
            });
          content.append(tombol);
        }
      });
      map.on("mousemove", `titik-${def.id}`, (e) => {
        if (def.id === "gerbang" && e.features?.length) {
          // Nama gerbang muncul saat hover, tanpa perlu diklik.
          const g = e.features[0].properties;
          const teks = String(g.label ?? `Gerbang ${g.kampus}`);
          if (!popupGerbang.current) {
            popupGerbang.current = new maplibregl.Popup({
              closeButton: false,
              closeOnClick: false,
              offset: 12,
              className: "popup-gerbang",
            });
          }
          popupGerbang.current
            .setLngLat(koordinatFitur(e))
            .setHTML(
              `<div class="text-xs font-semibold">${escapeHTML(teks)}</div>`,
            )
            .addTo(map);
        }
        if (def.id === "kos" && e.features?.length) {
          const id = e.features[0].properties.id;
          if (pinHover.current && pinHover.current !== id)
            map.setFeatureState(
              { source: "titik-kos", id: pinHover.current },
              { hover: false },
            );
          pinHover.current = id;
          map.setFeatureState({ source: "titik-kos", id }, { hover: true });
          map.triggerRepaint();
        }
        map.getCanvas().style.cursor = "pointer";
      });
      map.on("mouseleave", `titik-${def.id}`, () => {
        if (def.id === "gerbang") popupGerbang.current?.remove();
        if (def.id === "kos" && pinHover.current) {
          map.setFeatureState(
            { source: "titik-kos", id: pinHover.current },
            { hover: false },
          );
          pinHover.current = null;
          map.triggerRepaint();
        }
        map.getCanvas().style.cursor = "";
      });
    }

    map.on("mousemove", "heksagon-isi", (e) => {
      if (!e.features?.length) return;
      const id = e.features[0].properties.h3_index;
      if (id !== hoverId.current) {
        if (hoverId.current) {
          map.setFeatureState(
            { source: "heksagon", id: hoverId.current },
            { hover: false },
          );
        }
        hoverId.current = id;
        map.setFeatureState({ source: "heksagon", id }, { hover: true });
      }
      map.getCanvas().style.cursor = "pointer";
    });
    map.on("mouseleave", "heksagon-isi", () => {
      if (hoverId.current) {
        map.setFeatureState(
          { source: "heksagon", id: hoverId.current },
          { hover: false },
        );
        hoverId.current = null;
      }
      map.getCanvas().style.cursor = "";
    });
    map.on("click", "heksagon-isi", (e) => {
      // klik titik tidak boleh memicu seleksi heksagon
      if (e.originalEvent && ID_LAYER_TITIK.length) {
        const titik = map.queryRenderedFeatures(e.point, {
          layers: ID_LAYER_TITIK.filter((id) => map.getLayer(id)),
        });
        if (titik.length) return;
      }
      if (!e.features?.length) return;
      const id = e.features[0].properties.h3_index;
      if (modeRef.current) {
        if (comparisonRef.current.comparisonType === "kos") return;
        // MapLibre menyerikan objek bersarang jadi string JSON; pulihkan.
        const props = { ...e.features[0].properties };
        if (typeof props.subskor === "string") {
          try {
            props.subskor = JSON.parse(props.subskor);
          } catch {
            props.subskor = null;
          }
        }
        // indikator disimpan di luar sumber peta.
        props.indikator = indikatorPerH3.current.get(id) ?? null;
        onPilihBanding({
          ...props,
          h3_index: id,
          coordinates: hexCoordinates.current.get(id),
        });
        return;
      }
      if (terpilihId.current && terpilihId.current !== id) {
        map.setFeatureState(
          { source: "heksagon", id: terpilihId.current },
          { terpilih: false },
        );
      }
      terpilihId.current = id;
      map.setFeatureState({ source: "heksagon", id }, { terpilih: true });
      // MapLibre menyerikan objek bersarang jadi string JSON; pulihkan.
      const props = { ...e.features[0].properties };
      let galat = false;
      if (typeof props.subskor === "string") {
        try {
          props.subskor = JSON.parse(props.subskor);
        } catch {
          galat = true;
          props.subskor = null;
        }
      }
      props.indikator = indikatorPerH3.current.get(id) ?? null;
      onPilih({
        ...props,
        coordinates: hexCoordinates.current.get(id),
        galatParsing: galat || undefined,
      });
    });

    return () => {
      disposed = true;
      cancelHold();
      map.getCanvas().removeEventListener("touchcancel", cancelHold);
      controller.abort();
      if (raf.current) cancelAnimationFrame(raf.current);
      if (colorRaf.current) cancelAnimationFrame(colorRaf.current);
      map.remove();
      peta.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Beranda mengirim kampus baru: geser kamera ke kawasan sekitarnya.
  // Efek inisialisasi peta hanya berjalan sekali, jadi perpindahan dari
  // beranda ke peta pada sesi yang sama ditangani di sini.
  const fokusTerakhir = useRef(null);
  useEffect(() => {
    const map = peta.current;
    if (!map || !fokus) return;
    if (loadState !== "ready" && loadState !== "partial") return;
    if (fokusTerakhir.current === fokus.nama) return;
    fokusTerakhir.current = fokus.nama;
    map.easeTo({
      center: fokus.pusat,
      zoom: fokus.zoom,
      padding: paddingPeta(),
      duration: 600,
    });
  }, [fokus, loadState]);

  // Gambar rute kos -> kampus. Sumber dibuat sekali lalu datanya diganti,
  // supaya tidak menambah/menghapus layer setiap kali rute berubah.
  useEffect(() => {
    const map = peta.current;
    if (!map || loadState === "loading" || loadState === "error") return;

    const kosong = { type: "FeatureCollection", features: [] };
    if (!map.getSource("rute")) {
      map.addSource("rute", { type: "geojson", data: kosong });
      // line-dasharray tidak menerima ekspresi data, jadi ruas bus dan ruas
      // jalan kaki dipisah menjadi dua layer dengan filter.
      map.addLayer({
        id: "rute-garis-bus",
        type: "line",
        source: "rute",
        filter: ["==", ["get", "mode"], "bus"],
        layout: { "line-cap": "round", "line-join": "round" },
        paint: {
          "line-color": "#38bdf8",
          "line-width": ["interpolate", ["linear"], ["zoom"], 11, 3, 16, 6],
          "line-opacity": 0.95,
        },
      });
      map.addLayer({
        id: "rute-garis-jalan",
        type: "line",
        source: "rute",
        filter: ["!=", ["get", "mode"], "bus"],
        layout: { "line-cap": "round", "line-join": "round" },
        paint: {
          "line-color": "#facc15",
          "line-width": ["interpolate", ["linear"], ["zoom"], 11, 3, 16, 6],
          "line-dasharray": [2, 1.4],
          "line-opacity": 0.95,
        },
      });
    }

    if (!rute?.ruas?.length) {
      map.getSource("rute").setData(kosong);
      return;
    }

    const features = rute.ruas
      .filter((r) => Array.isArray(r.geometri) && r.geometri.length >= 2)
      .map((r) => ({
        type: "Feature",
        properties: { mode: r.mode },
        geometry: { type: "LineString", coordinates: r.geometri },
      }));
    map.getSource("rute").setData({
      type: "FeatureCollection",
      features,
    });

    // Perlihatkan seluruh rute.
    // Hanya koordinat yang benar-benar berupa angka; satu NaN saja membuat
    // fitBounds melempar dan menjatuhkan seluruh aplikasi.
    const semua = features
      .flatMap((f) => f.geometry.coordinates)
      .filter(
        (c) =>
          Array.isArray(c) &&
          Number.isFinite(c[0]) &&
          Number.isFinite(c[1]),
      );
    if (semua.length >= 2) {
      const b = semua.reduce(
        (acc, c) => [
          Math.min(acc[0], c[0]),
          Math.min(acc[1], c[1]),
          Math.max(acc[2], c[2]),
          Math.max(acc[3], c[3]),
        ],
        [Infinity, Infinity, -Infinity, -Infinity],
      );
      if (b.every(Number.isFinite)) {
        map.fitBounds(
          [
            [b[0], b[1]],
            [b[2], b[3]],
          ],
          { padding: paddingPeta(), duration: 600, maxZoom: 16 },
        );
      }
    }
  }, [rute, loadState]);

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
        map.setFeatureState(
          { source: "heksagon", id: lama },
          { [kunci]: false },
        );
      }
      if (baru && baru !== lama) {
        map.setFeatureState(
          { source: "heksagon", id: baru },
          { [kunci]: true },
        );
      }
      ref.current = baru;
    };
    if (!modeBanding || comparisonType === "kos") {
      if (bandingAId.current)
        map.setFeatureState(
          { source: "heksagon", id: bandingAId.current },
          { bandingA: false },
        );
      if (bandingBId.current)
        map.setFeatureState(
          { source: "heksagon", id: bandingBId.current },
          { bandingB: false },
        );
      bandingAId.current = null;
      bandingBId.current = null;
      return;
    }
    set(
      bandingAId.current,
      pilihanBanding?.a?.h3_index ?? null,
      "bandingA",
      bandingAId,
    );
    set(
      bandingBId.current,
      pilihanBanding?.b?.h3_index ?? null,
      "bandingB",
      bandingBId,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modeBanding, pilihanBanding, comparisonType, loadState]);

  useEffect(() => {
    const map = peta.current;
    if (!map?.getSource("titik-kos")) return;
    for (const feature of pinFeatures.current) {
      const id = feature.properties.id;
      map.setFeatureState(
        { source: "titik-kos", id },
        {
          bandingA:
            modeBanding &&
            comparisonType === "kos" &&
            pilihanBanding.a?.id === id,
          bandingB:
            modeBanding &&
            comparisonType === "kos" &&
            pilihanBanding.b?.id === id,
        },
      );
    }
    map.triggerRepaint();
  }, [modeBanding, comparisonType, pilihanBanding, loadState]);

  // skor hasil hitung klien -> feature-state + ambang + warna (satu rAF per gerakan)
  useEffect(() => {
    const map = peta.current;
    if (!map || !mesin.current || !map.getLayer("heksagon-isi")) return;
    if (raf.current) cancelAnimationFrame(raf.current);
    raf.current = requestAnimationFrame(() => {
      if (skorTerkini === null) {
        map.setPaintProperty(
          "heksagon-isi",
          "fill-color",
          ekspresiWarna(ambangBawaan.current, WARNA_KELAS),
        );
        return;
      }
      const { h3, n } = mesin.current;
      for (let i = 0; i < n; i++) {
        map.setFeatureState(
          { source: "heksagon", id: h3[i] },
          { skorHitung: skorTerkini[i] },
        );
      }
      const urut = [...skorTerkini].sort((a, b) => a - b);
      const ambang = hitungKuintil(urut);
      const minSkor = urut[0];
      const maksSkor = urut[n - 1];
      map.setPaintProperty("heksagon-isi", "fill-color", [
        "coalesce",
        ["feature-state", "displayColor"],
        ekspresiWarnaTerkini(ambang),
      ]);
      if (colorRaf.current) cancelAnimationFrame(colorRaf.current);
      const parseRGB = (value) =>
        value.startsWith("#")
          ? value.match(/[a-f0-9]{2}/gi).map((x) => parseInt(x, 16))
          : value
              .match(/[\d.]+/g)
              .slice(0, 3)
              .map(Number);
      const changes = h3.map((id, i) => {
        const target = scoreColor(skorTerkini[i], ambang);
        return {
          id,
          target,
          from: parseRGB(renderedColors.current.get(id) || target),
          to: parseRGB(target),
        };
      });
      const started = performance.now();
      const reduced = window.matchMedia(
        "(prefers-reduced-motion: reduce)",
      ).matches;
      const animateColors = (now) => {
        const progress = reduced ? 1 : Math.min(1, (now - started) / 200);
        const eased = 1 - (1 - progress) ** 3;
        for (const { id, target, from, to } of changes) {
          const color =
            progress === 1
              ? target
              : `rgb(${from.map((v, i) => Math.round(v + (to[i] - v) * eased)).join(",")})`;
          renderedColors.current.set(id, color);
          map.setFeatureState(
            { source: "heksagon", id },
            { displayColor: color },
          );
        }
        if (progress < 1)
          colorRaf.current = requestAnimationFrame(animateColors);
      };
      colorRaf.current = requestAnimationFrame(animateColors);
      if (map.getSource("titik-kos")) {
        const scoresByH3 = new Map(h3.map((id, i) => [id, skorTerkini[i]]));
        for (const feature of pinFeatures.current) {
          map.setFeatureState(
            { source: "titik-kos", id: feature.properties.id },
            {
              color: scoreColor(
                scoresByH3.get(feature.properties.h3_index),
                ambang,
              ),
            },
          );
        }
        map.triggerRepaint();
      }
      onAmbangBerubah({ ambang, minSkor, maksSkor });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [skorTerkini]);

  return (
    <>
      <div
        ref={wadah}
        className="absolute inset-0"
        style={{ position: "absolute" }}
        aria-label="Peta kawasan Sleman"
      />
      {(loadState === "loading" || loadState === "error") && (
        <div className="loading-map">
          <div
            className="loading-map-card"
            role={loadState === "error" ? "alert" : "status"}
          >
            <span className="text-3xl text-emerald-400">⬡</span>
            <p>
              {loadState === "error"
                ? "Peta belum berhasil dimuat."
                : "Menyiapkan peta kawasan…"}
            </p>
            {loadState === "error" ? (
              <button
                className="text-sm text-emerald-400"
                onClick={() => window.location.reload()}
              >
                Coba lagi
              </button>
            ) : (
              <>
                <div className="skeleton" />
                <div className="skeleton" style={{ width: "70%" }} />
              </>
            )}
          </div>
        </div>
      )}
      {loadState === "partial" && (
        <div
          role="status"
          className="absolute bottom-8 left-1/2 z-10 -translate-x-1/2 rounded-lg bg-slate-900 p-3 text-xs text-yellow-200"
        >
          Sebagian lapisan titik gagal dimuat.{" "}
          <button
            onClick={() => window.location.reload()}
            className="underline"
          >
            Muat ulang
          </button>
        </div>
      )}
    </>
  );
}
