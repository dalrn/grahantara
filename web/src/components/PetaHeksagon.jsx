import { useEffect, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

const COLORS = ["#efeccd", "#d8dcc5", "#a9c2a0", "#5f9a73", "#0f3d30"];
const BOUNDS = [[110.334, -7.837], [110.473, -7.643]];

function colorExpression(thresholds) {
  return ["step", ["get", "skor_dinamis"], COLORS[0], thresholds[0] ?? 20, COLORS[1], thresholds[1] ?? 40, COLORS[2], thresholds[2] ?? 60, COLORS[3], thresholds[3] ?? 80, COLORS[4]];
}

export default function PetaHeksagon({ data, campuses, stops, boardingHouses, thresholds, selected, onSelect, showSelectedBoardingHouses }) {
  const container = useRef(null);
  const mapRef = useRef(null);
  const hoverId = useRef(null);
  const selectedId = useRef(null);
  const dataRef = useRef(data);
  const auxiliaryRef = useRef({ campuses, stops, boardingHouses });
  const onSelectRef = useRef(onSelect);
  const [ready, setReady] = useState(false);
  const [layers, setLayers] = useState({ campuses: true, stops: false, boarding: false });

  dataRef.current = data;
  auxiliaryRef.current = { campuses, stops, boardingHouses };
  onSelectRef.current = onSelect;

  useEffect(() => {
    if (!container.current || mapRef.current) return;
    const map = new maplibregl.Map({
      container: container.current,
      style: {
        version: 8,
        sources: { osm: { type: "raster", tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"], tileSize: 256, attribution: "© OpenStreetMap contributors" } },
        layers: [{ id: "osm", type: "raster", source: "osm", paint: { "raster-saturation": -0.55, "raster-opacity": 0.72 } }],
      },
      center: [110.403, -7.75],
      zoom: 12,
    });
    mapRef.current = map;
    map.addControl(new maplibregl.NavigationControl({ showCompass: true }), "top-right");

    map.on("load", () => {
      installSources(map, dataRef.current, auxiliaryRef.current);
      map.fitBounds(BOUNDS, { padding: 34 });
      setReady(true);
    });

    map.on("mousemove", "hex-fill", (event) => {
      if (!event.features?.length) return;
      const id = event.features[0].properties.h3_index;
      if (hoverId.current && hoverId.current !== id) map.setFeatureState({ source: "hexagons", id: hoverId.current }, { hover: false });
      hoverId.current = id;
      map.setFeatureState({ source: "hexagons", id }, { hover: true });
      map.getCanvas().style.cursor = "pointer";
    });
    map.on("mouseleave", "hex-fill", () => {
      if (hoverId.current) map.setFeatureState({ source: "hexagons", id: hoverId.current }, { hover: false });
      hoverId.current = null;
      map.getCanvas().style.cursor = "";
    });
    map.on("click", "hex-fill", (event) => {
      if (!event.features?.length) return;
      const props = event.features[0].properties;
      const subskor = typeof props.subskor === "string" ? JSON.parse(props.subskor) : props.subskor;
      const indikator = typeof props.indikator === "string" ? JSON.parse(props.indikator) : props.indikator;
      onSelectRef.current({ ...event.features[0], properties: { ...props, subskor, indikator } });
    });
    return () => { map.remove(); mapRef.current = null; };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map || !data) return;
    if (!map.getSource("hexagons")) installSources(map, data, auxiliaryRef.current);
    else map.getSource("hexagons").setData(data);
    if (map.getLayer("hex-fill")) map.setPaintProperty("hex-fill", "fill-color", colorExpression(thresholds));
  }, [data, thresholds, ready]);

  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    const id = selected?.properties?.h3_index;
    if (selectedId.current && selectedId.current !== id) map.setFeatureState({ source: "hexagons", id: selectedId.current }, { selected: false });
    if (id) map.setFeatureState({ source: "hexagons", id }, { selected: true });
    selectedId.current = id;
  }, [selected, ready]);

  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    const selectedIndex = selected?.properties?.h3_index;
    const all = boardingHouses?.features ?? [];
    const filtered = showSelectedBoardingHouses && selectedIndex ? { ...boardingHouses, features: all.filter((f) => f.properties.h3_index === selectedIndex) } : boardingHouses;
    map.getSource("boarding")?.setData(filtered ?? { type: "FeatureCollection", features: [] });
    if (showSelectedBoardingHouses) {
      map.setLayoutProperty("boarding-points", "visibility", "visible");
      setLayers((old) => ({ ...old, boarding: true }));
    }
  }, [showSelectedBoardingHouses, selected, boardingHouses, ready]);

  function toggleLayer(key, layerId) {
    const next = !layers[key];
    setLayers((old) => ({ ...old, [key]: next }));
    mapRef.current?.setLayoutProperty(layerId, "visibility", next ? "visible" : "none");
  }

  return <div className="map-wrap">
    <div ref={container} className="map-canvas" />
    <div className="layer-control">
      <b>LAPISAN</b>
      <label><input type="checkbox" checked={layers.campuses} onChange={() => toggleLayer("campuses", "campus-points")} /> Kampus</label>
      <label><input type="checkbox" checked={layers.stops} onChange={() => toggleLayer("stops", "stop-points")} /> Halte</label>
      <label><input type="checkbox" checked={layers.boarding} onChange={() => toggleLayer("boarding", "boarding-points")} /> Kos</label>
    </div>
  </div>;
}

function installSources(map, data, auxiliary) {
  if (!data) return;
  map.addSource("hexagons", { type: "geojson", data, promoteId: "h3_index" });
  map.addLayer({ id: "hex-fill", type: "fill", source: "hexagons", paint: { "fill-color": colorExpression([]), "fill-opacity": ["case", ["boolean", ["feature-state", "selected"], false], 0.92, ["boolean", ["feature-state", "hover"], false], 0.82, 0.68] } });
  map.addLayer({ id: "hex-line", type: "line", source: "hexagons", paint: { "line-color": ["case", ["boolean", ["feature-state", "selected"], false], "#b5482b", "rgba(255,255,255,.6)"], "line-width": ["case", ["boolean", ["feature-state", "selected"], false], 2.5, 0.45] } });

  const empty = { type: "FeatureCollection", features: [] };
  map.addSource("campuses", { type: "geojson", data: auxiliary.campuses ?? empty });
  map.addLayer({ id: "campus-points", type: "circle", source: "campuses", paint: { "circle-radius": 6, "circle-color": "#0f3d30", "circle-stroke-width": 2, "circle-stroke-color": "#fff" } });
  map.addSource("stops", { type: "geojson", data: auxiliary.stops ?? empty });
  map.addLayer({ id: "stop-points", type: "circle", source: "stops", layout: { visibility: "none" }, paint: { "circle-radius": 4, "circle-color": "#ba7517", "circle-stroke-width": 1.5, "circle-stroke-color": "#fff" } });
  map.addSource("boarding", { type: "geojson", data: auxiliary.boardingHouses ?? empty });
  map.addLayer({ id: "boarding-points", type: "circle", source: "boarding", layout: { visibility: "none" }, paint: { "circle-radius": 5, "circle-color": "#b5482b", "circle-stroke-width": 1.5, "circle-stroke-color": "#fff" } });
}
