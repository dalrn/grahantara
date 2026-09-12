// Salinan server dari DIMENSI_UI di web/src/lib/kamus.js.
//
// Folder api/ adalah fungsi serverless Vercel dan TIDAK boleh mengimpor dari
// src/, jadi nama dimensi disalin ke sini — pola yang sama dengan
// _daftarKampus.js. Berkas berawalan garis bawah tidak diperlakukan Vercel
// sebagai endpoint.
//
// Kalau label di kamus.js berubah, ubah juga di sini. Satu salinan untuk
// seluruh api/, bukan satu per endpoint seperti sebelumnya.
export const NAMA_DIMENSI = {
  connectivity: "Akses transportasi",
  affordability: "Biaya",
  amenity: "Fasilitas",
  walkability: "Lingkungan jalan kaki",
};
