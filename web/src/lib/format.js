export function formatNilai(nilai, satuan) {
  if (nilai === null || nilai === undefined) return null;
  if (typeof nilai === "string") return nilai;
  const angka = nilai.toLocaleString("id-ID", { maximumFractionDigits: 1 });
  return satuan ? `${angka} ${satuan}` : angka;
}

export function formatPersentil(p) {
  if (p === null || p === undefined) return null;
  return "persentil " + Math.round(p * 100);
}

export function formatSkor(n) {
  if (n === null || n === undefined) return "-";
  return n.toLocaleString("id-ID", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}
