export function formatNilai(nilai, satuan) {
  if (nilai === null || nilai === undefined) return null;
  if (typeof nilai === "string") return nilai;
  const angka = nilai.toLocaleString("id-ID", { maximumFractionDigits: 1 });
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

export function formatSkor(n) {
  if (n === null || n === undefined) return "-";
  return n.toLocaleString("id-ID", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
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
