import { useEffect, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

import { GAYA_BASEMAP_MAPID, WARNA_KELAS } from "../config";
import { hitungKuintil, ekspresiWarna } from "../lib/kelas";
import { prepareBasemap } from "../lib/basemap";
import { campusImage } from "../lib/mapSymbols";
import { TEKS } from "../content/landing.js";

// Wilayah studi penuh; sama dengan BATAS di PetaHeksagon supaya kedua peta
// memperlihatkan cakupan yang sama.
const BATAS = [
  [110.334, -7.837],
  [110.473, -7.643],
];

/**
 * Peta ringkas untuk hero beranda: heksagon asli berwarna skor komposit di
 * atas basemap MAPID. Bukan tiruan PetaHeksagon — tidak ada panel, lapisan
 * titik, banding, atau rute. Yang dibagi hanya pipeline data dan warnanya
 * (hitungKuintil + ekspresiWarna + WARNA_KELAS), supaya warna di beranda dan
 * di halaman peta berarti hal yang sama.
 *
 * onBuka dipanggil saat peta diklik; App membuka halaman peta penuh.
 */
export default function PetaHero({ onBuka }) {
  const wadah = useRef(null);
  const peta = useRef(null);
  const [siap, setSiap] = useState(false);
  const [gagal, setGagal] = useState(false);
  const [sorot, setSorot] = useState(null);
  const bukaRef = useRef(onBuka);
  bukaRef.current = onBuka;

  useEffect(() => {
    if (!wadah.current || peta.current) return;

    const kunci = import.meta.env.VITE_MAPID_BASEMAP_KEY;
    const { style: gaya } = prepareBasemap(kunci, GAYA_BASEMAP_MAPID);

    const map = new maplibregl.Map({
      container: wadah.current,
      style: gaya,
      bounds: BATAS,
      fitBoundsOptions: { padding: 24, duration: 0 },
      attributionControl: { compact: true },
      // Peta ini pengantar, bukan alat. Rotasi dimatikan supaya tidak ada
      // cara membuat peta miring lalu bingung mengembalikannya.
      pitchWithRotate: false,
      dragRotate: false,
      touchZoomRotate: false,
    });
    peta.current = map;
    // Kait untuk uji otomatis; sama pola dengan __qaMap di halaman peta.
    if (import.meta.env.DEV) window.__heroMap = map;
    map.touchZoomRotate.enable({ around: "center" });
    map.touchZoomRotate.disableRotation();

    const controller = new AbortController();
    let dibuang = false;

    const muat = async () => {
      try {
        const r = await fetch("/data/hexagons.geojson", {
          signal: controller.signal,
        });
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const data = await r.json();
        if (dibuang) return;

        // Indikator (16 per heksagon, ~3,3 MB) tidak dipakai di hero.
        // Lepas sebelum diserahkan ke MapLibre supaya tidak disalin dan
        // diserikan percuma.
        const ringan = {
          ...data,
          features: data.features.map((f) => ({
            type: f.type,
            geometry: f.geometry,
            properties: {
              h3_index: f.properties.h3_index,
              skor: f.properties.skor,
            },
          })),
        };
        const ambang = hitungKuintil(data.features.map((f) => f.properties.skor));

        map.addSource("heksagon", {
          type: "geojson",
          data: ringan,
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
              ["boolean", ["feature-state", "hover"], false],
              0.78,
              0.55,
            ],
            "fill-opacity-transition": { duration: 150 },
          },
        });
        map.addLayer({
          id: "heksagon-garis",
          type: "line",
          source: "heksagon",
          paint: {
            "line-color": [
              "case",
              ["boolean", ["feature-state", "hover"], false],
              "#ffffff",
              "rgba(255,255,255,0.16)",
            ],
            "line-width": [
              "case",
              ["boolean", ["feature-state", "hover"], false],
              1.6,
              0.35,
            ],
          },
        });

        // Kampus: sprite lokal yang sama dengan halaman peta.
        const rk = await fetch("/data/kampus.geojson", {
          signal: controller.signal,
        });
        if (!rk.ok) throw new Error(`HTTP ${rk.status}`);
        const kampus = await rk.json();
        if (dibuang) return;
        // Seluruh kampus dalam cakupan ditampilkan; cakupan data menyebut
        // sepuluh kampus, dan peta yang hanya memuat tiga membuat angka itu
        // tampak tidak cocok.
        const terpilih = kampus;
        for (const f of terpilih.features) {
          const id = `kampus-${f.properties.nama}`;
          if (!map.hasImage(id)) {
            map.addImage(id, campusImage(f.properties.nama), { pixelRatio: 2 });
          }
        }
        map.addSource("kampus", { type: "geojson", data: terpilih });

        // Dua lapisan, sesuai prinsip "semua kampus punya penanda, tidak semua
        // punya tulisan":
        //
        // 1. Titik kecil untuk SETIAP kampus, selalu tampil (allow-overlap).
        //    Sepuluh kampus dalam cakupan semuanya terlihat, cocok dengan
        //    angka yang disebut di bagian "Dasar penilaiannya".
        // 2. Sprite berlabel di atasnya, dengan penempatan menghindari
        //    tabrakan. Sprite ini lebar; yang berdesakan disembunyikan
        //    MapLibre dan muncul lagi saat zoom diperbesar.
        map.addLayer({
          id: "kampus-titik",
          type: "circle",
          source: "kampus",
          paint: {
            "circle-radius": 4,
            "circle-color": "#f6c98a",
            "circle-stroke-width": 1.5,
            "circle-stroke-color": "#7a3b0d",
          },
        });
        map.addLayer({
          id: "titik-kampus",
          type: "symbol",
          source: "kampus",
          layout: {
            "icon-image": ["concat", "kampus-", ["get", "nama"]],
            "icon-anchor": "bottom",
            "icon-offset": ["literal", [0, -4]],
            // Label kampus adalah sprite bertulisan, bukan text-field, jadi
            // text-allow-overlap tidak berlaku di sini.
            "icon-allow-overlap": false,
            "icon-ignore-placement": false,
            "icon-padding": 2,
            // Tidak ada symbol-sort-key di sini: pada zoom awal yang
            // menentukan label mana bertahan adalah ruang kosong di
            // sekitarnya, bukan prioritas. Delapan dari sepuluh kampus
            // berdesakan dalam ~80 px (UPN dan AMIKOM hanya berjarak 5 px)
            // sementara sprite-nya selebar 70-117 px, jadi hanya kampus yang
            // terpisah sendiri yang muat. Sort key diuji dan tidak mengubah
            // hasilnya; menyimpannya hanya menyesatkan pembaca berikutnya.
          },
        });

        if (!dibuang) setSiap(true);
      } catch (e) {
        if (e?.name === "AbortError" || dibuang) return;
        setGagal(true);
      }
    };

    let hoverId = null;
    const setHover = (id) => {
      if (hoverId === id) return;
      if (hoverId !== null) {
        map.setFeatureState(
          { source: "heksagon", id: hoverId },
          { hover: false },
        );
      }
      hoverId = id;
      if (hoverId !== null) {
        map.setFeatureState(
          { source: "heksagon", id: hoverId },
          { hover: true },
        );
      }
    };

    const onMove = (e) => {
      const f = e.features?.[0];
      if (!f) return;
      setHover(f.id);
      setSorot({
        skor: f.properties.skor,
        h3: f.properties.h3_index,
      });
    };
    const onLeave = () => {
      setHover(null);
      setSorot(null);
    };

    map.on("load", muat);
    map.on("mousemove", "heksagon-isi", onMove);
    map.on("mouseleave", "heksagon-isi", onLeave);

    return () => {
      dibuang = true;
      controller.abort();
      map.remove();
      peta.current = null;
    };
  }, []);

  return (
    <div className="hero-peta">
      <div
        ref={wadah}
        className="hero-peta-kanvas"
        // Peta hero adalah pengantar, bukan alat: seluruh permukaannya
        // membuka halaman peta penuh.
        onClick={() => bukaRef.current?.()}
        aria-hidden="true"
      />
      {!siap && !gagal && <div className="hero-peta-memuat" aria-hidden="true" />}
      {gagal && (
        <div className="hero-peta-gagal">
          {TEKS.peta.gagal}
        </div>
      )}
      {/* Chip skor hanya muncul saat kursor benar-benar berada di atas sebuah
          heksagon. Tidak ada label ajakan: instruksi itu tidak berlaku di
          perangkat sentuh, dan chip ini sudah menjelaskan dirinya saat
          muncul. */}
      {siap && sorot && (
        <div className="hero-peta-skor" aria-hidden="true">
          <strong>{sorot.skor.toFixed(1)}</strong>
          {/* Heksagon tidak punya nama tempat di data — hanya h3_index, yang
              tidak berarti apa-apa bagi pembaca. Yang ditampilkan adalah arti
              skornya, sesuai definisi persentil. */}
          <span>{TEKS.peta.artiSkor(Math.round(sorot.skor))}</span>
        </div>
      )}
      <button type="button" className="hero-peta-buka" onClick={onBuka}>
        {TEKS.peta.buka}
      </button>
      <div className="hero-legenda">
        <span>{TEKS.peta.legendaRendah}</span>
        <span className="legenda-skala" aria-hidden="true">
          {WARNA_KELAS.map((w) => (
            <span key={w} style={{ background: w }} />
          ))}
        </span>
        <span>{TEKS.peta.legendaTinggi}</span>
      </div>
    </div>
  );
}
