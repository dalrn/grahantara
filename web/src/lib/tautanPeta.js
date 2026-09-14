// Tautan Google Maps. Format `?api=1` membuka aplikasi Maps di ponsel dan
// peta web di desktop. Koordinat ditulis `lat,lon`, kebalikan dari [lon, lat]
// milik GeoJSON.

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
