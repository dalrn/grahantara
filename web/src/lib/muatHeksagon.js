// Pemuat bersama /data/hexagons.geojson (4 MB, 2.134 heksagon).
//
// Berkas ini dipakai peta hero, grafik sebaran, peta utama, dan halaman
// metodologi. Promise disimpan di level modul supaya fetch + JSON.parse
// hanya terjadi sekali per muat halaman.
//
// HASILNYA DIPERLAKUKAN READ-ONLY. Konsumen yang butuh bentuk lain harus
// membuat salinan sendiri (mis. `features.map` baru dengan `properties`
// baru), bukan memutasi objek ini. Promise bersama juga tidak bisa
// dibatalkan oleh satu konsumen; pemanggil memakai flag "masih terpasang"
// untuk membersihkan diri saat unmount.

let promise = null;

export function muatHeksagon() {
  if (!promise) {
    promise = fetch("/data/hexagons.geojson")
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .catch((e) => {
        // Jangan menyimpan kegagalan: panggilan berikutnya boleh mencoba lagi.
        promise = null;
        throw e;
      });
  }
  return promise;
}
