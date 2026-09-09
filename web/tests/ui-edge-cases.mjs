import { chromium } from "playwright";
import assert from "node:assert/strict";
import fs from "node:fs";
fs.mkdirSync("test-results", { recursive: true });
const base = process.env.UI_TEST_URL || "http://127.0.0.1:5178";
const browser = await chromium.launch({
  headless: true,
  ...(process.env.PLAYWRIGHT_CHANNEL
    ? { channel: process.env.PLAYWRIGHT_CHANNEL }
    : {}),
  args: [
    "--use-gl=angle",
    "--use-angle=swiftshader",
    "--enable-unsafe-swiftshader",
  ],
});
try {
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1000 },
    reducedMotion: "reduce",
  });
  await page.route("**/data/hexagons.geojson", async (route) => {
    await new Promise((r) => setTimeout(r, 1200));
    await route.fulfill({ status: 503, body: "Unavailable" });
  });
  await page.goto(base);
  await page.getByRole("button", { name: "Lewati, langsung ke peta" }).click();
  await page.getByText("Menyiapkan peta kawasan…").waitFor();
  await page.getByText("Peta belum berhasil dimuat.").waitFor();
  assert.ok(
    await page
      .getByRole("button", { name: "Coba lagi", exact: true })
      .isVisible(),
  );
  await page.close();
  const modelPage = await browser.newPage({
    viewport: { width: 1440, height: 1000 },
    reducedMotion: "reduce",
  });
  const kos = JSON.parse(fs.readFileSync("public/data/kos.geojson"));
  const target = kos.features[0];
  target.properties.sumber_harga = "model";
  await modelPage.route("**/data/kos.geojson", (r) => r.fulfill({ json: kos }));
  await modelPage.route(
    "**/src/components/PetaHeksagon.jsx*",
    async (route) => {
      const response = await route.fetch();
      await route.fulfill({
        response,
        body: (await response.text()).replace(
          "peta.current = map;",
          "peta.current = map; window.__qaMap = map;",
        ),
      });
    },
  );
  await modelPage.goto(base);
  await modelPage
    .getByRole("button", { name: "Lewati, langsung ke peta" })
    .click();
  await modelPage.waitForFunction(() => window.__qaMap?.getLayer("titik-kos"));
  await modelPage.getByRole("checkbox", { name: "Titik kos" }).check();
  await modelPage.evaluate(
    (coords) => __qaMap.jumpTo({ center: coords, zoom: 16 }),
    target.geometry.coordinates,
  );
  await modelPage.waitForTimeout(500);
  const p = await modelPage.evaluate((coords) => {
    const p = __qaMap.project(coords),
      r = __qaMap.getCanvas().getBoundingClientRect();
    return { x: p.x + r.x, y: p.y + r.y };
  }, target.geometry.coordinates);
  await modelPage.mouse.click(p.x, p.y - 24);
  await modelPage.locator(".maplibregl-popup").waitFor();
  assert.match(
    await modelPage.locator(".maplibregl-popup").innerText(),
    /Estimasi/,
  );
  await modelPage.setViewportSize({ width: 390, height: 844 });
  await modelPage.getByRole("button", { name: "← Beranda" }).click();
  await modelPage.waitForTimeout(500);
  await modelPage.screenshot({
    path: "test-results/qa-mobile-home.png",
    fullPage: true,
  });
  await modelPage.setViewportSize({ width: 1440, height: 1000 });
  await modelPage.screenshot({ path: "test-results/qa-home.png" });
  console.log(
    "Passed: loading state, fetch failure/retry control, model estimate badge, reduced-motion flow.",
  );
} finally {
  await browser.close();
}
