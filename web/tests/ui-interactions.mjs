import { chromium } from "playwright";
import assert from "node:assert/strict";
import fs from "node:fs";
fs.mkdirSync("test-results", { recursive: true });
const browser = await chromium.launch({
  headless: true,
  ...(process.env.PLAYWRIGHT_CHANNEL
    ? { channel: process.env.PLAYWRIGHT_CHANNEL }
    : {}),
  args: [
    "--enable-webgl",
    "--use-gl=angle",
    "--use-angle=swiftshader",
    "--enable-unsafe-swiftshader",
  ],
});
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => {
  if (m.type() === "error") errors.push(m.text());
});
// Expose the real map in this test response only; production source is untouched.
await page.route("**/src/components/PetaHeksagon.jsx*", async (route) => {
  const response = await route.fetch();
  await route.fulfill({
    response,
    body: (await response.text()).replace(
      "peta.current = map;",
      "peta.current = map; window.__qaMap = map;",
    ),
  });
});
await page.goto(process.env.UI_TEST_URL || "http://127.0.0.1:5178");
await page.screenshot({
  path: "test-results/qa-home-desktop.png",
  fullPage: true,
});
await page.setViewportSize({ width: 390, height: 844 });
await page.screenshot({
  path: "test-results/qa-home-mobile.png",
  fullPage: true,
});
await page.setViewportSize({ width: 1440, height: 1000 });
await page.getByRole("button", { name: "Maba UGM", exact: false }).click();
await page.getByRole("button", { name: "Temukan kawasan saya" }).click();
await page.getByRole("button", { name: "Lihat peta", exact: true }).waitFor();
assert.match(await page.locator("body").innerText(), /Diproses tanpa AI/);
const priority = await page.locator("input[type=number]").first().inputValue();
await page.getByRole("button", { name: "Lihat peta", exact: true }).click();
await page.waitForFunction(() => window.__qaMap?.getLayer("titik-kos"));
await page.waitForFunction(
  () => __qaMap.queryRenderedFeatures({ layers: ["titik-kos"] }).length > 0,
);
await page.waitForTimeout(900);
await page.screenshot({ path: "test-results/qa-map-weights.png" });
assert.equal(
  await page.getByRole("slider").first().inputValue(),
  priority,
  "parsed priorities survive map loading",
);
await page.getByRole("checkbox", { name: "Titik kos" }).check();
await page.waitForTimeout(300);
assert.ok(
  await page.evaluate(
    () => __qaMap.queryRenderedFeatures({ layers: ["titik-kos"] }).length > 0,
  ),
  "kos pins remain visible at overview zoom",
);
const kos = JSON.parse(fs.readFileSync("public/data/kos.geojson"));
const missing = kos.features.find((f) => f.properties.harga_median === null);
assert.ok(missing);
await page.evaluate(
  (coords) => __qaMap.jumpTo({ center: coords, zoom: 16 }),
  missing.geometry.coordinates,
);
await page.waitForTimeout(800);
const pinCount = await page.evaluate(
  () => __qaMap.queryRenderedFeatures({ layers: ["titik-kos"] }).length,
);
assert.ok(pinCount > 0);
const point = await page.evaluate((coords) => {
  const p = __qaMap.project(coords),
    r = __qaMap.getCanvas().getBoundingClientRect();
  return { x: p.x + r.x, y: p.y + r.y };
}, missing.geometry.coordinates);
await page.mouse.move(point.x, point.y - 24);
await page.waitForTimeout(300);
assert.equal(
  await page.evaluate(
    (id) => __qaMap.getFeatureState({ source: "titik-kos", id }).hover,
    missing.properties.id,
  ),
  true,
);
await page.mouse.click(point.x, point.y - 24);
await page.locator(".maplibregl-popup").waitFor();
assert.match(
  await page.locator(".maplibregl-popup").innerText(),
  /harga tidak tercatat/,
);
await page.screenshot({ path: "test-results/qa-pins.png" });
await page.locator(".maplibregl-popup-close-button").click();
const before = await page.evaluate(
  (ids) =>
    ids.map((id) => __qaMap.getFeatureState({ source: "titik-kos", id }).color),
  kos.features.map((f) => f.properties.id),
);
await page.getByRole("slider").first().fill("0");
await page.getByRole("slider").nth(1).fill("100");
await page.waitForTimeout(800);
const after = await page.evaluate(
  (ids) =>
    ids.map((id) => __qaMap.getFeatureState({ source: "titik-kos", id }).color),
  kos.features.map((f) => f.properties.id),
);
assert.notDeepEqual(before, after, "pin colors change with weights");
const colorsMatch = await page.evaluate(
  (features) =>
    features.every(
      (f) =>
        __qaMap.getFeatureState({ source: "titik-kos", id: f.properties.id })
          .color ===
        __qaMap.getFeatureState({
          source: "heksagon",
          id: f.properties.h3_index,
        }).displayColor,
    ),
  kos.features,
);
assert.ok(colorsMatch, "all 31 pin colors match their joined H3");
await page.getByRole("checkbox", { name: "Titik kos" }).uncheck();
await page.mouse.click(700, 450);
await page.getByRole("tab", { name: "Subskor", exact: true }).waitFor();
assert.match(
  await page.locator(".detail-panel").innerText(),
  /Titik tengah: .*LS, .*BT/,
);
await page.getByRole("tab", { name: "Subskor", exact: true }).click();
await page.waitForTimeout(350);
await page.screenshot({ path: "test-results/qa-panel.png" });
await page.getByRole("tab", { name: "16 Indikator", exact: true }).click();
await page.waitForTimeout(350);
assert.ok((await page.getByRole("tabpanel").innerText()).length > 500);
await page.getByRole("button", { name: "Tutup panel", exact: true }).click();
await page.getByRole("button", { name: "Bandingkan", exact: true }).click();
await page.evaluate(() => __qaMap.jumpTo({ zoom: 14 }));
await page.waitForTimeout(400);
await page.mouse.click(600, 350);
await page.mouse.click(850, 620);
await page.waitForTimeout(500);
const highlighted = await page.evaluate(() => {
  const fs = __qaMap.queryRenderedFeatures({ layers: ["heksagon-isi"] });
  return {
    a: fs.some(
      (f) =>
        __qaMap.getFeatureState({
          source: "heksagon",
          id: f.properties.h3_index,
        }).bandingA,
    ),
    b: fs.some(
      (f) =>
        __qaMap.getFeatureState({
          source: "heksagon",
          id: f.properties.h3_index,
        }).bandingB,
    ),
  };
});
assert.ok(highlighted.a && highlighted.b);
await page.getByRole("button", { name: "Bandingkan dengan AI" }).click();
await page
  .getByText("Disusun tanpa AI. Layanan bahasa tidak merespons.", {
    exact: true,
  })
  .waitFor();
await page
  .locator(".detail-panel .overflow-y-auto")
  .evaluate((el) => (el.scrollTop = 0));
await page.screenshot({ path: "test-results/qa-compare.png" });
await page.getByRole("button", { name: "Metodologi", exact: true }).click();
await page.waitForTimeout(1000);
assert.ok(
  await page
    .getByRole("heading", { name: "Di balik setiap kawasan." })
    .isVisible(),
);
await page.screenshot({ path: "test-results/qa-method.png" });
await page.setViewportSize({ width: 390, height: 844 });
await page.getByRole("button", { name: /Kembali/ }).click();
await page.waitForTimeout(1200);
await page.screenshot({ path: "test-results/qa-mobile-map.png" });
assert.equal(
  await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),
  false,
);
console.log(
  JSON.stringify(
    {
      status: "passed",
      pins: 31,
      pinCount,
      checks: [
        "real local parsing fallback",
        "profile persistence",
        "zoom visibility",
        "missing-price popup",
        "hover feature-state",
        "reactive pin colors",
        "H3 palette match",
        "detail tabs",
        "A/B highlights",
        "comparison fallback",
        "methodology",
        "mobile width",
      ],
      errors,
    },
    null,
    2,
  ),
);
assert.deepEqual(errors, []);
await browser.close();
