export const BOBOT_DEFAULT = {
  connectivity: 0.4,
  affordability: 0.25,
  amenity: 0.2,
  walkability: 0.15,
};

// CADANGAN bila metadata.bobot_default tidak ada di GeoJSON. Bila metadata
// menyediakannya, App.jsx memakai nilai metadata sebagai bobot bawaan dan
// acuan "Kembalikan bawaan". Nilai ini identik dengan metadata versi 1.0.
export const EPS = 0.01;

export const WARNA_KELAS = ["#440154", "#3b528b", "#21918c", "#5ec962", "#fde725"];

// Slug terverifikasi dengan kunci nyata: dark-v2.0 -> 200.
// Keputusan tim: basemap gelap (street-v2.0 terang membuat kelas skor
// tertinggi #fde725 nyaris menyatu dengan latar).
export const GAYA_BASEMAP_MAPID = "dark-v2.0";
