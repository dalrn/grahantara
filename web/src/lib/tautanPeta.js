/**
 * Tautan ke Google Maps untuk sebuah titik.
 *
 * Dipakai popup kos, popup halte/kampus/gerbang/KRL, dan pin yang dijatuhkan
 * pengguna. Grahantara menilai kawasan; navigasi belokan-per-belokan bukan
 * tugasnya, jadi untuk itu pengguna diantar ke Google Maps.
 *
 * Format `?api=1` adalah URL universal yang resmi didukung Google: di ponsel
 * ia membuka aplikasi Maps bila terpasang, di desktop membuka peta web.
 * Koordinat ditulis `lat,lon` — urutan Google, KEBALIKAN dari [lon, lat] milik
 * GeoJSON/MapLibre. Salah urutan di sini memindahkan titiknya ke Somalia.
 */

const sah = (c) =>
  Array.isArray(c) && Number.isFinite(c[0]) && Number.isFinite(c[1]);

/** Tampilkan satu titik di Google Maps. `coordinates` = [lon, lat]. */
export function tautanGoogleMaps(coordinates) {
  if (!sah(coordinates)) return null;
  const [lon, lat] = coordinates;
  return `https://www.google.com/maps/search/?api=1&query=${lat},${lon}`;
}

/**
 * Petunjuk arah dari satu titik ke titik lain. Keduanya [lon, lat].
 *
 * `mode` mengikuti kosakata Google: "walking", "transit", "driving".
 */
export function tautanArahGoogleMaps(dari, ke, mode = "walking") {
  if (!sah(dari) || !sah(ke)) return null;
  const asal = `${dari[1]},${dari[0]}`;
  const tujuan = `${ke[1]},${ke[0]}`;
  return (
    `https://www.google.com/maps/dir/?api=1&origin=${asal}` +
    `&destination=${tujuan}&travelmode=${encodeURIComponent(mode)}`
  );
}
