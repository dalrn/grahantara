// Pembulatan dibuat sesuai ketelitian datanya: jarak < 1 km bulat, >= 1 km
// jadi kilometer satu desimal, skor dan cacah bulat. Indeks abstrak (NDVI,
// nW/sr/cm2) tidak dibulatkan karena hanya tampil di balik toggle angka mentah.
const SATUAN_CACAH = new Set(["rute", "titik", "kategori", "per km2"]);

export function formatJarak(meter) {
  if (!Number.isFinite(meter)) return null;
  if (meter >= 1000) {
    return `${(meter / 1000).toLocaleString("id-ID", {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    })} km`;
  }
  return `${Math.round(meter).toLocaleString("id-ID")} m`;
}

export function formatNilai(nilai, satuan) {
  if (nilai === null || nilai === undefined) return null;
  if (typeof nilai === "string") return nilai;
  // Meter -> otomatis naik ke km di atas 1000, tanpa desimal palsu di bawahnya.
  if (satuan === "m") return formatJarak(nilai);
  const satuanBersih = typeof satuan === "string" ? satuan.trim() : satuan;
  const desimal = SATUAN_CACAH.has(satuanBersih) ? 0 : 1;
  const angka = nilai.toLocaleString("id-ID", {
    maximumFractionDigits: desimal,
  });
  if (typeof satuan === "string" && /^Rp/i.test(satuan.trim())) {
    const sisa = satuan.trim().replace(/^Rp/i, "");
    return `Rp ${angka}${sisa}`;
  }
  return satuan ? `${angka} ${satuan}` : angka;
}

export function formatPersentil(p) {
  if (p === null || p === undefined) return null;
  return "persentil " + Math.round(p * 100);
}

// Skor dan subskor dibulatkan ke bilangan bulat. "81,31" dan "81,3" sama-sama
// menyiratkan ketelitian yang tidak ada: skor adalah peringkat persentil,
// dan selisih 0,3 poin tidak berarti apa-apa bagi pembaca.
export function formatSkor(n) {
  if (n === null || n === undefined) return "-";
  if (!Number.isFinite(n)) return "-";
  return Math.round(n).toLocaleString("id-ID");
}

export function formatCoordinates(coordinates) {
  if (
    !Array.isArray(coordinates) ||
    coordinates.length < 2 ||
    !coordinates.slice(0, 2).every(Number.isFinite)
  )
    return "Tidak tersedia";
  const [longitude, latitude] = coordinates;
  return `${Math.abs(latitude).toFixed(5)}° ${latitude < 0 ? "LS" : "LU"}, ${Math.abs(longitude).toFixed(5)}° ${longitude < 0 ? "BB" : "BT"}`;
}
