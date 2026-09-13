import { chromium } from "playwright";
const b = await chromium.launch({
  args: ["--enable-unsafe-swiftshader", "--use-gl=angle", "--use-angle=swiftshader"],
});
const p = await b.newPage({ viewport: { width: 1440, height: 1000 } });
const errs = [];
p.on("pageerror", (e) => errs.push("PAGEERROR: " + e.message));
const ok = (l, c) => console.log((c ? "  PASS  " : "  FAIL  ") + l);
const klik = (t) =>
  p.evaluate((x) => {
    const el = [...document.querySelectorAll("button")].find(
      (b) => b.textContent.trim() === x);
    if (!el) throw new Error("tombol tidak ada: " + x);
    el.click();
  }, t);

await p.goto("http://127.0.0.1:5178/", { waitUntil: "networkidle" });
await klik("Jelajahi peta tanpa mengisi");
await p.waitForFunction(() => window.__qaMap?.getLayer?.("heksagon-isi"), null, { timeout: 60000 });
await p.waitForFunction(
  () => window.__qaMap.queryRenderedFeatures({ layers: ["heksagon-isi"] }).length > 50,
  null, { timeout: 60000 });
await p.waitForTimeout(3000);
await p.evaluate(() => {
  const m = window.__qaMap;
  for (const id of ["titik-kos","titik-kampus","titik-halte","titik-krl","titik-gerbang"])
    if (m.getLayer(id)) m.setLayoutProperty(id, "visibility", "none");
});

// --- Tab gabungan ---
const pt = await p.evaluate(() => {
  const m = window.__qaMap;
  const f = m.queryRenderedFeatures({ layers: ["heksagon-isi"] })[0];
  const q = m.project(f.geometry.coordinates[0][0]);
  const cv = m.getCanvas().getBoundingClientRect();
  return { x: cv.left + q.x + 12, y: cv.top + q.y + 12 };
});
await p.mouse.click(pt.x, pt.y);
await p.waitForSelector(".detail-panel", { timeout: 20000 });
await p.waitForTimeout(600);
const tabs = await p.locator(".panel-tabs button").allInnerTexts();
console.log("== TAB ==");
ok(`dua tab: ${JSON.stringify(tabs)}`, tabs.length === 2 && tabs.includes("Rincian skor"));
ok("tab '16 Indikator' hilang", !tabs.includes("16 Indikator"));

await p.getByRole("tab", { name: "Rincian skor" }).click();
await p.waitForTimeout(500);
const sebelum = await p.locator(".detail-panel .py-1\\.5").count();
console.log("== KLIK DIMENSI UNTUK REVEAL ==");
ok(`indikator tertutup saat dibuka (${sebelum} baris)`, sebelum === 0);
await p.locator(".detail-panel button[aria-expanded]").first().click();
await p.waitForTimeout(600);
const sesudah = await p.locator(".detail-panel .py-1\\.5").count();
ok(`klik dimensi memunculkan indikatornya (${sesudah} baris)`, sesudah > sebelum);

const teks = await p.locator(".detail-panel").innerText();
console.log("== PANEL SKOR ==");
ok("'Skor bawaan' hilang", !/Skor bawaan/.test(teks));
ok("keterangan 'dari titik tengah kawasan' ada",
   /dari titik tengah kawasan/.test(teks));

// --- Escape menghapus pin ---
console.log("== ESCAPE HAPUS PIN ==");
await p.keyboard.press("Escape");
await p.waitForTimeout(300);
const box = await p.locator("canvas.maplibregl-canvas").first().boundingBox();
await p.mouse.click(box.x + box.width * 0.3, box.y + box.height * 0.4, { button: "right" });
await p.waitForTimeout(1200);
const adaPanelRute = await p.locator(".route-panel").count();
ok("klik kanan menjatuhkan pin (panel rute muncul)", adaPanelRute > 0);
await p.keyboard.press("Escape");
await p.waitForTimeout(600);
ok("Escape menghapus pin", (await p.locator(".route-panel").count()) === 0);

console.log("\nERRORS:", errs.length ? errs.slice(0, 3) : "none");
await b.close();
