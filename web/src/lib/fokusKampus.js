// Koordinat kampus untuk memusatkan peta saat pengguna menyebut kampus di
// beranda. Sumber angka: web/public/data/kampus.geojson (dibaca saat build
// pipeline; disalin ke sini agar peta bisa memusatkan sebelum layer titik
// kampus selesai di-fetch).
export const KOORDINAT_KAMPUS = {
  UGM: [110.377136, -7.770677],
  UNY: [110.386432, -7.774557],
  "UII Kaliurang": [110.412929, -7.687288],
  "UIN Sunan Kalijaga": [110.394472, -7.784983],
  "UPN Veteran": [110.409373, -7.762815],
  "STIE YKPN": [110.410486, -7.76941],
  Instiper: [110.424497, -7.760521],
  AMIKOM: [110.408506, -7.759457],
  "Atma Jaya Babarsari": [110.414859, -7.779114],
  "Sanata Dharma III": [110.421753, -7.754077],
};

// Zoom saat memusatkan ke satu kampus: memperlihatkan kawasan sekitar
// (radius ~1,5 km) alih-alih seluruh wilayah studi.
export const ZOOM_KAMPUS = 14.2;

// Sinonim yang lazim ditulis pengguna -> nama kanonik di kampus.geojson.
const ALIAS = {
  ugm: "UGM",
  "gadjah mada": "UGM",
  "gajah mada": "UGM",
  uny: "UNY",
  "negeri yogyakarta": "UNY",
  uii: "UII Kaliurang",
  "uii kaliurang": "UII Kaliurang",
  uin: "UIN Sunan Kalijaga",
  "sunan kalijaga": "UIN Sunan Kalijaga",
  upn: "UPN Veteran",
  "upn veteran": "UPN Veteran",
  ykpn: "STIE YKPN",
  "stie ykpn": "STIE YKPN",
  instiper: "Instiper",
  amikom: "AMIKOM",
  atma: "Atma Jaya Babarsari",
  "atma jaya": "Atma Jaya Babarsari",
  babarsari: "Atma Jaya Babarsari",
  sadhar: "Sanata Dharma III",
  "sanata dharma": "Sanata Dharma III",
};

// Menerima nama kampus dari profil ("UGM") atau kalimat bebas
// ("maba ugm, budget 800 ribuan") dan mengembalikan nama kanonik.
export function cocokkanKampus(teks) {
  if (typeof teks !== "string") return null;
  const bersih = teks.toLowerCase().trim();
  if (!bersih) return null;

  for (const nama of Object.keys(KOORDINAT_KAMPUS)) {
    if (bersih === nama.toLowerCase()) return nama;
  }
  if (ALIAS[bersih]) return ALIAS[bersih];

  // Cocokkan sebagai kata utuh agar "uii" tidak tertangkap di dalam kata lain.
  let terbaik = null;
  for (const [alias, nama] of Object.entries(ALIAS)) {
    const pola = new RegExp(`(^|[^a-z])${alias}([^a-z]|$)`);
    if (pola.test(bersih) && (!terbaik || alias.length > terbaik.alias.length))
      terbaik = { alias, nama };
  }
  return terbaik ? terbaik.nama : null;
}

// Titik fokus peta dari profil beranda; null bila kampus tidak dikenali.
export function fokusDariProfil(profil) {
  if (!profil) return null;
  const nama = cocokkanKampus(profil.kampus) ?? cocokkanKampus(profil.teks);
  if (!nama) return null;
  const pusat = KOORDINAT_KAMPUS[nama];
  return pusat ? { nama, pusat, zoom: ZOOM_KAMPUS } : null;
}
