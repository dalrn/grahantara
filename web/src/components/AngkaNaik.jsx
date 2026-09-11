import { useEffect, useRef, useState } from "react";

// Sekali per sesi, bukan per mount: kembali ke beranda dari halaman peta
// tidak mengulang hitungannya.
const sudahJalan = new Set();

/**
 * Angka yang menghitung naik dari nol saat masuk viewport.
 *
 * `nilai` adalah angka final (number). Formatnya mengikuti locale id-ID,
 * sama dengan angka statis yang digantikannya.
 *
 * `prefers-reduced-motion: reduce` dihormati mutlak: angka langsung tampil
 * penuh tanpa pernah menghitung.
 */
export default function AngkaNaik({ nilai, id }) {
  const [tampil, setTampil] = useState(() =>
    sudahJalan.has(id) ? nilai : null,
  );
  const ref = useRef(null);

  useEffect(() => {
    if (!Number.isFinite(nilai)) return;

    const kurangGerak = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    if (kurangGerak || sudahJalan.has(id)) {
      sudahJalan.add(id);
      setTampil(nilai);
      return;
    }

    const el = ref.current;
    if (!el) return;

    let raf = null;
    let batal = false;
    const io = new IntersectionObserver(
      (entri) => {
        if (!entri[0]?.isIntersecting || sudahJalan.has(id)) return;
        sudahJalan.add(id);
        io.disconnect();
        const DURASI = 1000;
        const mulai = performance.now();
        const langkah = (t) => {
          if (batal) return;
          const maju = Math.min(1, (t - mulai) / DURASI);
          // easeOutCubic: cepat di awal, melambat di akhir.
          const e = 1 - Math.pow(1 - maju, 3);
          setTampil(Math.round(nilai * e));
          if (maju < 1) raf = requestAnimationFrame(langkah);
        };
        raf = requestAnimationFrame(langkah);
      },
      { threshold: 0.4 },
    );
    io.observe(el);

    return () => {
      batal = true;
      if (raf) cancelAnimationFrame(raf);
      io.disconnect();
    };
  }, [nilai, id]);

  return (
    <strong ref={ref}>
      {(tampil ?? 0).toLocaleString("id-ID")}
    </strong>
  );
}
