import { BOBOT_DEFAULT, EPS } from "../config";

export const CATATAN_RUMUS =
  "Skor = 100 * PROD((sub/100 + EPS)^bobot) di-clamp ke maksimum 100. " +
  "Tanpa clamp, semua subskor 100 menghasilkan 101+, melanggar kontrak schema " +
  "(skor maks 100). Clamp diterapkan eksplisit, bukan diam-diam.";

export function hitungSkor(subskor, bobot = BOBOT_DEFAULT) {
  let skor = 100;
  for (const [dimensi, w] of Object.entries(bobot)) {
    const sub = subskor?.[dimensi];
    if (typeof sub !== "number") return null;
    skor *= Math.pow(sub / 100 + EPS, w);
  }
  return Math.min(skor, 100);
}
