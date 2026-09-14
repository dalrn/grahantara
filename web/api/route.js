// Proksi routing, diletakkan di serverless supaya tidak bergantung pada rate
// limit server publik dari tiap browser dan hasilnya bisa di-cache di edge.

// Tiap profil punya server sendiri. router.project-osrm.org hanya memuat
// profil mobil: path /foot/ diterima tapi hasilnya identik dengan /driving/,
// sehingga rute pejalan ikut mematuhi jalan satu arah dan melewatkan gang
// tembus. routing.openstreetmap.de memisahkan mesinnya per profil.
//
// Catatan: path-nya tetap /route/v1/driving/ untuk SEMUA profil, itu nama
// path bawaan OSRM, sedangkan profil sebenarnya ditentukan oleh server yang
// dipanggil (routed-foot / routed-car). Bukan salah tulis.
const SERVER = {
  foot: "https://routing.openstreetmap.de/routed-foot",
  driving: "https://routing.openstreetmap.de/routed-car",
};
const PROFIL_SAH = new Set(Object.keys(SERVER));
const BATAS = { lonMin: 110.2, lonMax: 110.6, latMin: -7.95, latMax: -7.55 };

function koordinat(teks) {
  if (typeof teks !== "string") return null;
  const bagian = teks.split(",");
  if (bagian.length !== 2) return null;
  const lon = Number(bagian[0]);
  const lat = Number(bagian[1]);
  if (!Number.isFinite(lon) || !Number.isFinite(lat)) return null;
  // Tolak titik di luar wilayah studi supaya endpoint ini tidak dipakai
  // sebagai proksi routing umum.
  if (lon < BATAS.lonMin || lon > BATAS.lonMax) return null;
  if (lat < BATAS.latMin || lat > BATAS.latMax) return null;
  return `${lon},${lat}`;
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.status(405).json({ galat: "metode tidak didukung" });
    return;
  }
  const profil = String(req.query.profil ?? "foot");
  const dari = koordinat(req.query.dari);
  const ke = koordinat(req.query.ke);
  if (!PROFIL_SAH.has(profil) || !dari || !ke) {
    res.status(400).json({ galat: "parameter rute tidak sah" });
    return;
  }

  const url =
    `${SERVER[profil]}/route/v1/driving/${dari};${ke}` +
    `?overview=full&geometries=geojson&alternatives=false&steps=false`;

  const batal = AbortSignal.timeout(7000);
  try {
    const r = await fetch(url, { signal: batal });
    if (!r.ok) throw new Error(`OSRM ${r.status}`);
    const j = await r.json();
    const rute = j?.routes?.[0];
    if (j?.code !== "Ok" || !rute?.geometry?.coordinates?.length)
      throw new Error("rute tidak ditemukan");

    // Rute jarang berubah; cache agresif di edge.
    res.setHeader(
      "Cache-Control",
      "public, s-maxage=86400, stale-while-revalidate=604800",
    );
    res.status(200).json({
      geometri: rute.geometry.coordinates,
      meter: Math.round(rute.distance),
      // durasi OSRM demo tidak dapat dipercaya untuk profil foot;
      // klien menghitung waktu sendiri dari jarak.
    });
  } catch {
    res.status(502).json({ galat: "layanan rute tidak tersedia" });
  }
}
