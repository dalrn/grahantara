// Rute kos -> kampus: jalan kaki saja, atau jalan kaki + satu koridor
// Trans Jogja. Geometri jalan sebenarnya diambil dari OSRM lewat /api/route;
// bila gagal, rute tetap ditampilkan sebagai garis lurus dan ditandai
// sebagai perkiraan.

export const KECEPATAN_JALAN_M_PER_MENIT = 75; // ~4,5 km/jam
export const KECEPATAN_BUS_M_PER_MENIT = 250; // ~15 km/jam, sudah termasuk henti
const MAKS_JALAN_LANGSUNG_M = 1200; // di atas ini, tawarkan opsi bus
const MAKS_JALAN_KE_HALTE_M = 1500; // masih wajar dijalani menuju halte
const KANDIDAT_HALTE = 8;

export function jarakMeter(a, b) {
  const R = 6371000;
  const p1 = (a[1] * Math.PI) / 180;
  const p2 = (b[1] * Math.PI) / 180;
  const dp = p2 - p1;
  const dl = ((b[0] - a[0]) * Math.PI) / 180;
  const x =
    Math.sin(dp / 2) ** 2 +
    Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}

export const menitJalan = (m) => Math.max(1, Math.round(m / KECEPATAN_JALAN_M_PER_MENIT));
export const menitBus = (m) => Math.max(1, Math.round(m / KECEPATAN_BUS_M_PER_MENIT));

function koridorHalte(h) {
  const k = h.properties?.koridor;
  if (Array.isArray(k)) return k;
  if (typeof k === "string") {
    try {
      const j = JSON.parse(k);
      return Array.isArray(j) ? j : [];
    } catch {
      return [];
    }
  }
  return [];
}

function terdekat(titik, daftar, n) {
  return daftar
    .map((h) => ({ h, d: jarakMeter(titik, h.geometry.coordinates) }))
    .sort((a, b) => a.d - b.d)
    .slice(0, n);
}

// Susun rencana rute (belum ada geometri jalan). Mengembalikan objek dengan
// daftar `langkah` dan pasangan titik yang perlu digambar.
export function rencanaRute(kos, kampus, halte) {
  if (!kos || !kampus) return null;
  const asal = kos.coordinates ?? kos.geometry?.coordinates;
  // Bila sebuah gerbang dipilih, itulah tujuan sebenarnya. Untuk kampus luas
  // seperti UGM, titik tengah bisa ratusan meter dari pintu yang dipakai.
  const titik = (c) =>
    Array.isArray(c) && Number.isFinite(c[0]) && Number.isFinite(c[1])
      ? c
      : null;
  const tujuan =
    titik(kampus.gerbang?.coordinates) ??
    titik(kampus.pusat) ??
    titik(kampus.geometry?.coordinates);
  if (!titik(asal) || !tujuan) return null;
  // Nama yang dipakai di teks langkah.
  const namaTujuan = kampus.gerbang?.label ?? kampus.nama;

  const langsung = jarakMeter(asal, tujuan);

  // Cukup dekat: jalan kaki saja.
  if (langsung <= MAKS_JALAN_LANGSUNG_M || !halte?.length) {
    return {
      jenis: "jalan",
      totalMenit: menitJalan(langsung),
      totalMeter: Math.round(langsung),
      ruas: [{ mode: "jalan", dari: asal, ke: tujuan, meter: langsung }],
      langkah: [
        {
          mode: "jalan",
          teks: `Jalan kaki ke ${namaTujuan}`,
          meter: Math.round(langsung),
          menit: menitJalan(langsung),
        },
      ],
    };
  }

  // Cari pasangan halte yang berbagi satu koridor.
  const dekatKos = terdekat(asal, halte, KANDIDAT_HALTE);
  const dekatKampus = terdekat(tujuan, halte, KANDIDAT_HALTE);
  let terbaik = null;
  for (const a of dekatKos) {
    if (a.d > MAKS_JALAN_KE_HALTE_M) continue;
    for (const b of dekatKampus) {
      if (b.d > MAKS_JALAN_KE_HALTE_M) continue;
      if (a.h === b.h) continue;
      const sama = koridorHalte(a.h).filter((k) =>
        koridorHalte(b.h).includes(k),
      );
      if (!sama.length) continue;
      const naik = jarakMeter(
        a.h.geometry.coordinates,
        b.h.geometry.coordinates,
      );
      // Bus yang menjauh dari tujuan bukan pilihan masuk akal.
      if (naik > langsung * 1.6) continue;
      const skor = a.d + b.d + naik * 0.35;
      if (!terbaik || skor < terbaik.skor)
        terbaik = { skor, a: a.h, b: b.h, da: a.d, db: b.d, naik, koridor: sama };
    }
  }

  if (!terbaik) {
    // Tidak ada koridor langsung. Rute jalan kaki tetap digambar sebagai
    // rujukan jarak, tetapi jangan disajikan seolah pilihan yang masuk akal
    // bila jaraknya jauh.
    return {
      jenis: "jalan",
      totalMenit: menitJalan(langsung),
      totalMeter: Math.round(langsung),
      tanpaKoridor: true,
      jauh: langsung > 2500,
      ruas: [{ mode: "jalan", dari: asal, ke: tujuan, meter: langsung }],
      langkah: [
        {
          mode: "jalan",
          teks:
            langsung > 2500
              ? `Tidak ada koridor Trans Jogja langsung ke ${namaTujuan}. Perlu ganti koridor atau kendaraan sendiri.`
              : `Jalan kaki ke ${namaTujuan}`,
          meter: Math.round(langsung),
          menit: menitJalan(langsung),
        },
      ],
    };
  }

  const { a, b, da, db, naik, koridor } = terbaik;
  const totalMenit = menitJalan(da) + menitBus(naik) + menitJalan(db);
  return {
    jenis: "bus",
    koridor,
    totalMenit,
    totalMeter: Math.round(da + naik + db),
    ruas: [
      { mode: "jalan", dari: asal, ke: a.geometry.coordinates, meter: da },
      {
        mode: "bus",
        dari: a.geometry.coordinates,
        ke: b.geometry.coordinates,
        meter: naik,
      },
      { mode: "jalan", dari: b.geometry.coordinates, ke: tujuan, meter: db },
    ],
    langkah: [
      {
        mode: "jalan",
        teks: `Jalan kaki ke ${a.properties.nama}`,
        meter: Math.round(da),
        menit: menitJalan(da),
      },
      {
        mode: "bus",
        teks: `Naik Trans Jogja koridor ${koridor.join(" / ")}`,
        meter: Math.round(naik),
        menit: menitBus(naik),
      },
      {
        mode: "jalan",
        teks: `Turun di ${b.properties.nama}, jalan kaki ke ${namaTujuan}`,
        meter: Math.round(db),
        menit: menitJalan(db),
      },
    ],
  };
}

// Ambil geometri jalan sebenarnya untuk tiap ruas. Ruas bus memakai profil
// mengemudi (mendekati jalur bus di jalan raya), ruas jalan kaki profil foot.
export async function lengkapiGeometri(rencana, signal) {
  if (!rencana) return rencana;
  const hasil = await Promise.all(
    rencana.ruas.map(async (r) => {
      try {
        const q = new URLSearchParams({
          profil: r.mode === "bus" ? "driving" : "foot",
          dari: `${r.dari[0]},${r.dari[1]}`,
          ke: `${r.ke[0]},${r.ke[1]}`,
        });
        const res = await fetch(`/api/route?${q}`, { signal });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const j = await res.json();
        if (!Array.isArray(j.geometri) || j.geometri.length < 2)
          throw new Error("geometri kosong");
        return { ...r, geometri: j.geometri, meterJalan: j.meter };
      } catch (e) {
        if (e?.name === "AbortError") throw e;
        return { ...r, geometri: [r.dari, r.ke], perkiraan: true };
      }
    }),
  );

  const adaPerkiraan = hasil.some((r) => r.perkiraan);
  // Bila OSRM menjawab, pakai jarak jalan sebenarnya untuk estimasi waktu.
  const langkah = rencana.langkah.map((l, i) => {
    const r = hasil[i];
    if (!r || r.perkiraan || typeof r.meterJalan !== "number") return l;
    const meter = Math.round(r.meterJalan);
    return {
      ...l,
      meter,
      menit: l.mode === "bus" ? menitBus(meter) : menitJalan(meter),
    };
  });

  return {
    ...rencana,
    ruas: hasil,
    langkah,
    perkiraan: adaPerkiraan,
    totalMeter: langkah.reduce((a, l) => a + l.meter, 0),
    totalMenit: langkah.reduce((a, l) => a + l.menit, 0),
  };
}
