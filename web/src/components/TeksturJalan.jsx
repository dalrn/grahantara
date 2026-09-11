import { useEffect, useRef, useState } from "react";

/**
 * Lapisan latar dari jaringan jalan Sleman (OSM), bukan pola hias generik.
 *
 * Berkasnya `public/tekstur-jalan.svg`, dirender SEKALI oleh
 * `scripts/buat_tekstur_jalan.py` dari graf yang sama yang dipakai pipeline
 * (`data/interim/walk_graph.graphml`). Tidak ada penggambaran ulang saat
 * runtime: komponen ini hanya mengambil berkas statis lalu menyisipkannya.
 *
 * SATU lapisan untuk seluruh halaman, dipasang di level root beranda:
 *   - absolute, tinggi mengikuti tinggi DOKUMEN (bukan viewport), sehingga
 *     ikut menggulir bersama konten. Bukan position: fixed.
 *   - rasio aspek SVG dipertahankan; kalau dokumen lebih tinggi daripada satu
 *     salinan SVG, salinan berikutnya ditumpuk vertikal. Sambungannya tidak
 *     terlihat pada opasitas latar.
 *
 * Disisipkan sebagai elemen <svg>, bukan background-image: pada lebar 1600
 * unit, garis tipis jadi sub-piksel saat diskalakan CSS dan hilang sama
 * sekali. Sebagai elemen, ketebalan tiap kelas jalan diatur CSS.
 */

// Rasio viewBox berkas (1600 x 2256). Dipakai menghitung berapa salinan
// vertikal yang dibutuhkan; kalau berkas dibangkitkan ulang dengan rasio
// berbeda, nilai ini ikut dibaca dari viewBox-nya.
const RASIO_BAWAAN = 2256 / 1600;

export default function TeksturJalan() {
  const [svg, setSvg] = useState(null);
  const [rasio, setRasio] = useState(RASIO_BAWAAN);
  const [salinan, setSalinan] = useState(1);
  const wadah = useRef(null);

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
        const vb = t.match(/viewBox="0 0 ([\d.]+) ([\d.]+)"/);
        if (vb) setRasio(Number(vb[2]) / Number(vb[1]));
        setSvg(t);
      })
      // Tekstur murni dekorasi turunan data; kalau gagal, latar polos saja.
      .catch(() => {});
    return () => {
      batal = true;
      controller.abort();
    };
  }, []);

  // Berapa salinan vertikal yang dibutuhkan agar tekstur menerus sampai
  // dasar dokumen. Diukur ulang saat ukuran halaman berubah.
  useEffect(() => {
    if (!svg) return;
    const el = wadah.current;
    if (!el) return;
    const hitung = () => {
      const induk = el.parentElement;
      if (!induk) return;
      const tinggiDok = induk.scrollHeight;
      const tinggiSatu = induk.clientWidth * rasio;
      if (tinggiSatu <= 0) return;
      setSalinan(Math.max(1, Math.ceil(tinggiDok / tinggiSatu)));
    };
    hitung();
    const ro = new ResizeObserver(hitung);
    ro.observe(el.parentElement ?? el);
    return () => ro.disconnect();
  }, [svg, rasio]);

  if (!svg) return null;
  // dangerouslySetInnerHTML aman di sini: isinya artefak build milik sendiri
  // dari public/, bukan masukan pengguna dan bukan konten pihak ketiga.
  return (
    <div className="tekstur-jalan" aria-hidden="true" ref={wadah}>
      {Array.from({ length: salinan }, (_, i) => (
        <div
          key={i}
          className="tekstur-salinan"
          style={{ paddingTop: `${rasio * 100}%` }}
          dangerouslySetInnerHTML={{ __html: svg }}
        />
      ))}
    </div>
  );
}
