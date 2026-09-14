// Ringkasan dokumentasi survei per heksagon, dibaca dari
// public/data/aktivitas.json (dibangkitkan scripts/buat_aktivitas.py).
//
// Berkasnya kecil (sekitar 2 KB) dan dibaca sekali per instance serverless,
// bukan per permintaan. Isinya hanya cacah dan jenis; deskripsi aktivitas
// sengaja tidak ikut supaya model tetap tidak pernah menerima teks bebas.
import fs from "node:fs";
import path from "node:path";

let cache = null;

function muat() {
  if (cache) return cache;
  try {
    const p = path.join(process.cwd(), "public", "data", "aktivitas.json");
    cache = JSON.parse(fs.readFileSync(p, "utf-8"));
  } catch {
    // Berkasnya opsional. Tanpa itu, temuan bukti lapangan tidak pernah
    // muncul dan sisa lapisan temuan tetap berjalan.
    cache = { per_heksagon: {} };
  }
  return cache;
}

/** { tempat, ruas_jalan, foto } untuk satu heksagon, atau null. */
export function aktivitasHeksagon(h3Index) {
  const rec = muat().per_heksagon?.[h3Index];
  if (!rec) return null;
  const total = (rec.tempat ?? 0) + (rec.ruas_jalan ?? 0);
  return total > 0 ? { ...rec, total } : null;
}
