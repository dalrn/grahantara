import { useEffect, useState } from "react";

/**
 * Lapisan latar dari jaringan jalan Sleman (OSM), bukan pola hias generik.
 *
 * Berkasnya `public/tekstur-jalan.svg`, dirender SEKALI oleh
 * `scripts/buat_tekstur_jalan.py` dari graf yang sama yang dipakai pipeline
 * (`data/interim/walk_graph.graphml`). Tidak ada penggambaran ulang saat
 * runtime: komponen ini hanya mengambil berkas statis lalu menyisipkannya.
 *
 * Disisipkan sebagai elemen <svg>, bukan background-image: pada lebar 1600
 * unit, garis setebal 0,7 jadi sub-piksel saat diskalakan CSS dan hilang sama
 * sekali. Sebagai elemen, ketebalan garis bisa dinaikkan tanpa membesarkan
 * berkasnya.
 *
 * Warna diwarisi lewat `currentColor` dari CSS, yang mengambilnya dari token
 * di design.js. Opasitasnya diatur CSS (5%); di atas itu polanya mulai
 * terbaca sebagai peta dan mengganggu teks.
 */
export default function TeksturJalan() {
  const [svg, setSvg] = useState(null);

  useEffect(() => {
    let batal = false;
    const controller = new AbortController();
    fetch("/tekstur-jalan.svg", { signal: controller.signal })
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.text();
      })
      .then((t) => {
        if (batal) return;
        // Garis dinaikkan dari 0,7 (ukuran berkas) ke 1,6 (keterbacaan).
        setSvg(t.replace('stroke-width="0.7"', 'stroke-width="1.6"'));
      })
      // Tekstur murni dekorasi turunan data; kalau gagal, latar polos saja.
      .catch(() => {});
    return () => {
      batal = true;
      controller.abort();
    };
  }, []);

  if (!svg) return null;
  // dangerouslySetInnerHTML aman di sini: isinya artefak build milik sendiri
  // dari public/, bukan masukan pengguna dan bukan konten pihak ketiga.
  return (
    <div
      className="tekstur-jalan"
      aria-hidden="true"
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
