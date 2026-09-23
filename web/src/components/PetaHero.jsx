import { useEffect, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

import { GAYA_BASEMAP_MAPID, WARNA_KELAS } from "../config";
import { hitungKuintil, ekspresiWarna } from "../lib/kelas";
import { prepareBasemap } from "../lib/basemap";
import { campusImage } from "../lib/mapSymbols";
import { muatHeksagon } from "../lib/muatHeksagon";
import { TEKS } from "../content/landing.js";

// Wilayah studi penuh; sama dengan BATAS di PetaHeksagon supaya kedua peta
// memperlihatkan cakupan yang sama.
const BATAS = [
  [110.334, -7.837],
  [110.473, -7.643],
];

/**
 * Peta ringkas untuk hero beranda: heksagon asli berwarna skor komposit di
 * atas basemap MAPID. Bukan tiruan PetaHeksagon, tidak ada panel, lapisan
 * titik, banding, atau rute. Yang dibagi hanya pipeline data dan warnanya
 * (hitungKuintil + ekspresiWarna + WARNA_KELAS), supaya warna di beranda dan
 * di halaman peta berarti hal yang sama.
 *
 * onBuka dipanggil saat peta diklik; App membuka halaman peta penuh.
 */
// Modul-level, bukan state React: animasi masuk hanya sekali per sesi, tidak
// diulang saat pengguna kembali ke beranda dari halaman peta.
let sudahDianimasikan = false;

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
      // DPR 2,75 di HP mid-range berarti kanvas 2,6 juta piksel; batasi 2.
      pixelRatio: Math.min(window.devicePixelRatio || 1, 2),
      fadeDuration: 0,
    });
    peta.current = map;
    // Kait untuk uji otomatis; sama pola dengan __qaMap di halaman peta.
    if (import.meta.env.DEV) window.__heroMap = map;
    map.touchZoomRotate.enable({ around: "center" });
    map.touchZoomRotate.disableRotation();

    const controller = new AbortController();
    let dibuang = false;
    let rafId = null;

    const muat = async () => {
      try {
        const data = await muatHeksagon();
        if (dibuang) return;

        // Indikator (16 per heksagon, ~3,3 MB) tidak dipakai di hero.
        // Lepas sebelum diserahkan ke MapLibre supaya tidak disalin dan
        // diserikan percuma.
        // Jarak ternormalisasi tiap heksagon dari pusat gugus (0 di tengah,
        // 1 di tepi terjauh). Dipakai untuk memunculkan heksagon bertahap
        // dari pusat ke luar; dihitung sekali di sini, bukan per frame.
        const titik = data.features.map((f) => {
          const c = f.geometry.coordinates[0][0];
          return [c[0], c[1]];
        });
        const pusatX =
          titik.reduce((a, p) => a + p[0], 0) / (titik.length || 1);
        const pusatY =
          titik.reduce((a, p) => a + p[1], 0) / (titik.length || 1);
        let jauhMaks = 0;
        const jarak = titik.map(([x, y]) => {
          const d = Math.hypot(x - pusatX, y - pusatY);
          if (d > jauhMaks) jauhMaks = d;
          return d;
        });

        const ringan = {
          ...data,
          features: data.features.map((f, i) => ({
            type: f.type,
            geometry: f.geometry,
            properties: {
              h3_index: f.properties.h3_index,
              skor: f.properties.skor,
              jauh: jauhMaks > 0 ? jarak[i] / jauhMaks : 0,
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
            // Opasitas awal 0; animasi masuk menaikkannya lewat
            // setPaintProperty per frame (lihat jalankanAnimasiMasuk).
            "fill-opacity": 0,
            "fill-opacity-transition": { duration: 0 },
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
            // terpisah sendiri yang muat. symbol-sort-key tidak mengubah hasil.
          },
        });

        // Animasi masuk heksagon: muncul bertahap dari pusat ke luar, ~0,5
        // detik, sekali saja. Basemap dan penanda kampus sudah tampil lebih
        // dulu karena lapisan heksagon dimulai dari fill-opacity 0.
        //
        // Dijalankan lewat setPaintProperty per frame, bukan ekspresi
        // MapLibre: tidak ada variabel ekspresi yang bisa dianimasikan.
        const opasitasNormal = [
          "case",
          ["boolean", ["feature-state", "hover"], false],
          0.78,
          0.55,
        ];
        const kurangGerak = window.matchMedia(
          "(prefers-reduced-motion: reduce)",
        ).matches;

        // Dihormati mutlak: langsung tampil penuh, tanpa transisi apa pun.
        if (kurangGerak || sudahDianimasikan) {
          map.setPaintProperty("heksagon-isi", "fill-opacity", opasitasNormal);
          map.setPaintProperty("heksagon-isi", "fill-opacity-transition", {
            duration: 150,
          });
        } else {
          sudahDianimasikan = true;
          const DURASI = 520;
          const mulai = performance.now();
          const langkah = (t) => {
            if (dibuang || !map.getLayer("heksagon-isi")) return;
            const maju = Math.min(1, (t - mulai) / DURASI);
            if (maju >= 1) {
              map.setPaintProperty(
                "heksagon-isi",
                "fill-opacity",
                opasitasNormal,
              );
              map.setPaintProperty("heksagon-isi", "fill-opacity-transition", {
                duration: 150,
              });
              return;
            }
            // Gerbang bergerak dari pusat (jauh=0) ke tepi (jauh=1). Lebar
            // 0,35 membuat tepinya lembut, bukan lingkaran keras.
            map.setPaintProperty("heksagon-isi", "fill-opacity", [
              "*",
              opasitasNormal,
              [
                "interpolate",
                ["linear"],
                ["-", maju * 1.35, ["get", "jauh"]],
                0,
                0,
                0.35,
                1,
              ],
            ]);
            rafId = requestAnimationFrame(langkah);
          };
          rafId = requestAnimationFrame(langkah);
        }

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

    // "load" hanya menyala sekali, setelah style selesai dimuat. Di dev,
    // StrictMode memasang komponen dua kali dan pembongkaran mount pertama
    // membatalkan permintaan style.json milik mount kedua; akibatnya "load"
    // tidak pernah menyala dan tidak ada satu pun lapisan yang terbentuk.
    // Karena itu jangan bergantung pada satu peristiwa saja: kalau style
    // ternyata sudah siap, jalankan langsung; kalau belum, tunggu "load"
    // sekaligus "styledata" sebagai jaring pengaman.
    let sudahMuat = false;
    const muatSekali = () => {
      if (sudahMuat || dibuang) return;
      // isStyleLoaded() TIDAK dipakai sebagai syarat: saat permintaan sprite
      // atau glyph dibatalkan, nilainya tetap false selamanya walau style
      // sudah punya lapisan lengkap. Yang menentukan cukup ada style dengan
      // lapisan, karena addSource/addLayer hanya butuh itu.
      if (!map.getStyle()?.layers?.length) return;
      sudahMuat = true;
      muat();
    };
    muatSekali();
    map.on("load", muatSekali);
    map.on("styledata", muatSekali);
    map.on("mousemove", "heksagon-isi", onMove);
    map.on("mouseleave", "heksagon-isi", onLeave);

    return () => {
      dibuang = true;
      controller.abort();
      if (rafId) cancelAnimationFrame(rafId);
      map.remove();
      peta.current = null;
      // Jangan tinggalkan rujukan ke peta yang sudah dibuang.
      if (import.meta.env.DEV && window.__heroMap === map) {
        window.__heroMap = null;
      }
    };
  }, []);

  return (
    <div className={`hero-peta${siap ? " is-siap" : ""}`}>
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
          {/* Heksagon tidak punya nama tempat di data, hanya h3_index, yang
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
