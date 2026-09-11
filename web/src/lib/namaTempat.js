/**
 * Nama desa/kelurahan terdekat untuk sebuah titik, dibaca dari BASEMAP.
 *
 * Data heksagon tidak memuat nama tempat sama sekali (hanya `h3_index`), dan
 * lintang-bujur tidak berarti apa-apa bagi pembaca. Nama desa sudah ada di
 * basemap MAPID sebagai lapisan simbol, jadi diambil dari sana — sumber yang
 * sama dengan yang dilihat pengguna di peta, tanpa permintaan jaringan baru.
 *
 * Yang dipakai: `place_village_indonesia` (desa/kelurahan) lalu
 * `place_town_indonesia` (kota/kecamatan) sebagai konteks yang lebih luas.
 * Keduanya hanya berisi fitur yang sedang DIRENDER, jadi hasilnya bergantung
 * pada area yang terlihat; kalau tidak ketemu, pemanggil wajib menyiapkan
 * cadangan (koordinat).
 */

const LAPISAN_DESA = "place_village_indonesia";
const LAPISAN_KOTA = "place_town_indonesia";

function namaFitur(f) {
  const p = f?.properties ?? {};
  return p.name ?? p["name:latin"] ?? p["name:id"] ?? null;
}

function terdekat(peta, lapisan, koordinat) {
  if (!peta.getLayer(lapisan)) return null;
  let fitur;
  try {
    fitur = peta.queryRenderedFeatures({ layers: [lapisan] });
  } catch {
    return null;
  }
  let terbaik = null;
  let jarakTerbaik = Infinity;
  for (const f of fitur) {
    const c = f.geometry?.coordinates;
    if (!Array.isArray(c) || c.length < 2) continue;
    const nama = namaFitur(f);
    if (!nama) continue;
    // Jarak kuadrat di derajat sudah cukup: yang dicari hanya yang terdekat,
    // dan seluruh wilayah studi hanya membentang ~0,2 derajat.
    const dx = c[0] - koordinat[0];
    const dy = c[1] - koordinat[1];
    const d = dx * dx + dy * dy;
    if (d < jarakTerbaik) {
      jarakTerbaik = d;
      terbaik = nama;
    }
  }
  return terbaik;
}

/**
 * Mengembalikan string seperti "Sekitar Sinduadi, Mlati", atau null bila
 * basemap belum memuat nama tempat mana pun.
 */
export function namaTempatTerdekat(peta, koordinat) {
  if (!peta || !Array.isArray(koordinat) || koordinat.length < 2) return null;
  if (!koordinat.slice(0, 2).every(Number.isFinite)) return null;

  const desa = terdekat(peta, LAPISAN_DESA, koordinat);
  const kota = terdekat(peta, LAPISAN_KOTA, koordinat);

  if (desa && kota && desa !== kota) return `Sekitar ${desa}, ${kota}`;
  if (desa) return `Sekitar ${desa}`;
  if (kota) return `Sekitar ${kota}`;
  return null;
}
