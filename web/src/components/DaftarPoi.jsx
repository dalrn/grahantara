import { useEffect, useState } from "react";

/**
 * Daftar tempat makan dan layanan harian DI DALAM satu heksagon.
 *
 * Menjawab pertanyaan yang pasti muncul begitu pengguna melihat skor
 * Fasilitas: "jadi apa saja dan di mana saja tempat makannya?". Sebelum ini
 * produk hanya bisa menyebut angka.
 *
 * Berkasnya (455 KB) dimuat MALAS — hanya saat panel pertama kali dibuka, dan
 * hanya sekali per sesi. Menaruhnya di muat awal akan memperlambat peta untuk
 * fitur yang dipakai sebagian pengguna saja.
 */

// Cache tingkat modul: satu unduhan untuk seluruh sesi, dibagi semua panel.
let cachePoi = null;
let sedangMuat = null;

function muatPoi() {
  if (cachePoi) return Promise.resolve(cachePoi);
  if (sedangMuat) return sedangMuat;
  sedangMuat = fetch("/data/poi.json")
    .then((r) => {
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.json();
    })
    .then((j) => {
      cachePoi = j;
      return j;
    })
    .finally(() => {
      sedangMuat = null;
    });
  return sedangMuat;
}

const LABEL = {
  makan: "Tempat makan",
  warung: "Warung kelontong",
  minimarket: "Minimarket",
  apotek: "Apotek",
};
const URUTAN = ["makan", "warung", "minimarket", "apotek"];

export default function DaftarPoi({ h3Index }) {
  const [data, setData] = useState(cachePoi);
  const [galat, setGalat] = useState(false);
  const [semua, setSemua] = useState(false);

  useEffect(() => {
    setSemua(false);
  }, [h3Index]);

  useEffect(() => {
    if (cachePoi) return;
    let batal = false;
    muatPoi()
      .then((j) => !batal && setData(j))
      .catch(() => !batal && setGalat(true));
    return () => {
      batal = true;
    };
  }, []);

  if (galat) {
    return (
      <p className="poi-catatan">Daftar tempat makan tidak dapat dimuat.</p>
    );
  }
  if (!data) {
    return <p className="poi-catatan">Memuat daftar tempat…</p>;
  }

  const daftar = data.per_heksagon?.[h3Index] ?? [];
  if (!daftar.length) {
    return (
      <p className="poi-catatan">
        Tidak ada tempat makan atau layanan harian yang tercatat di dalam
        kawasan ini. Skor Fasilitas tetap bisa tinggi bila banyak tempat berada
        tepat di luar batasnya.
      </p>
    );
  }

  const perKategori = {};
  for (const r of daftar) (perKategori[r.k] ??= []).push(r);

  // Tampilkan lima lebih dulu. Satu heksagon bisa memuat 28 titik, dan daftar
  // sepanjang itu mengubur sisa panel.
  const BATAS = 5;
  const tampil = semua ? daftar : daftar.slice(0, BATAS);

  return (
    <div className="poi-daftar">
      <div className="poi-ringkas">
        {URUTAN.filter((k) => perKategori[k]?.length).map((k) => (
          <span key={k} className="poi-lencana">
            {perKategori[k].length} {LABEL[k].toLowerCase()}
          </span>
        ))}
      </div>
      <ul>
        {tampil.map((r, i) => (
          <li key={`${r.n}-${i}`}>
            <span className={`poi-titik poi-titik--${r.k}`} aria-hidden="true" />
            <span className="poi-isi">
              <span className="poi-nama">{r.n}</span>
              <span className="poi-jenis">{r.t ?? LABEL[r.k]}</span>
              {r.a && <span className="poi-alamat">{r.a}</span>}
            </span>
          </li>
        ))}
      </ul>
      {daftar.length > BATAS && (
        <button
          type="button"
          className="poi-lainnya"
          onClick={() => setSemua((v) => !v)}
        >
          {semua
            ? "Tampilkan lebih sedikit"
            : `Tampilkan ${daftar.length - BATAS} tempat lainnya`}
        </button>
      )}
      {/* Perbedaan ini WAJIB disebut: daftar ini isi heksagon, sedangkan skor
          Fasilitas menghitung radius 800 m dari pusatnya. Tanpa keterangan,
          kawasan berskor tinggi dengan daftar pendek terlihat seperti bug. */}
      <p className="poi-catatan">
        Daftar ini memuat tempat di dalam kawasan. Skor Fasilitas menghitung
        semua tempat dalam radius 800 m dari pusat kawasan, termasuk yang tepat
        di luar batasnya.
      </p>
    </div>
  );
}
