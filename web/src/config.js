export const BOBOT_DEFAULT = {
  connectivity: 0.4,
  affordability: 0.25,
  amenity: 0.2,
  walkability: 0.15,
};

// CATATAN: metadata.bobot_default tidak ada di GeoJSON. Nilai ini ASUMSI
// dari dokumen proyek. Ganti bila pipeline menyediakannya.
export const EPS = 0.01;

export const WARNA_KELAS = ["#440154", "#3b528b", "#21918c", "#5ec962", "#fde725"];

// Slug terverifikasi dengan kunci nyata: dark-v2.0 -> 200.
// Keputusan tim: basemap gelap (street-v2.0 terang membuat kelas skor
// tertinggi #fde725 nyaris menyatu dengan latar).
export const GAYA_BASEMAP_MAPID = "dark-v2.0";
