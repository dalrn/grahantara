import { chromium } from "playwright";
import assert from "node:assert/strict";
import fs from "node:fs";

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
    hasTouch: true,
    isMobile: true,
  });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  const kos = JSON.parse(fs.readFileSync("public/data/kos.geojson"));
  const missing = kos.features.find((f) => f.properties.harga_median === null);
  const first = kos.features.find(
    (a) =>
      Number.isFinite(a.properties.harga_median) &&
      kos.features.some(
        (b) =>
          a.properties.id !== b.properties.id &&
          a.properties.h3_index === b.properties.h3_index,
      ),
  );
  const sameHex = kos.features.find(
    (f) =>
      f.properties.id !== first.properties.id &&
      f.properties.h3_index === first.properties.h3_index,
  );
  assert.ok(sameHex, "fixture includes different kos in one hexagon");
  first.properties.sumber_harga = "model";
  await page.route("**/data/kos.geojson", (route) =>
    route.fulfill({ json: kos }),
  );
  await page.goto(process.env.UI_TEST_URL || "http://127.0.0.1:5178");
  await page.getByRole("button", { name: "Jelajahi peta tanpa mengisi" }).click();
  await page.waitForFunction(() => window.__qaMap?.getLayer("titik-kos"));
  await page.waitForFunction(
    () => __qaMap.queryRenderedFeatures({ layers: ["titik-kos"] }).length > 0,
  );
  await page.waitForTimeout(800);
  assert.ok(
    await page.getByRole("checkbox", { name: "Titik kos" }).isChecked(),
  );
  const layers = await page.evaluate(() => ({
    campus: __qaMap.getLayer("titik-kampus").type,
    bus: __qaMap.getLayer("titik-halte").type,
    counts: ["titik-kos", "titik-kampus", "titik-halte"].map(
      (id) => __qaMap.queryRenderedFeatures({ layers: [id] }).length,
    ),
    sizes: __qaMap.getLayoutProperty("titik-kos", "icon-size"),
  }));
  assert.equal(layers.campus, "symbol");
  assert.equal(layers.bus, "symbol");
  assert.ok(
    layers.counts.every((n) => n > 0),
    "all symbol types visible in overview",
  );
  assert.equal(layers.sizes[0], "interpolate");
  assert.ok(
    layers.sizes.at(-1) > layers.sizes[4],
    "pin size increases with zoom",
  );
  await page.screenshot({ path: "test-results/qa-symbols-overview.png" });

  async function clickKos(feature, ctrl = false) {
    const point = await page.evaluate((coords) => {
      // Keep the target clear of the right-hand comparison panel.
      __qaMap.jumpTo({ center: coords, zoom: 17 });
      __qaMap.panBy([180, 0], { duration: 0 });
      const p = __qaMap.project(coords),
        r = __qaMap.getCanvas().getBoundingClientRect();
      return { x: p.x + r.x, y: p.y + r.y - 27 };
    }, feature.geometry.coordinates);
    await page.waitForTimeout(500);
    if (ctrl) await page.keyboard.down("Control");
    await page.mouse.click(point.x, point.y);
    if (ctrl) await page.keyboard.up("Control");
    await page.waitForTimeout(250);
  }
  await clickKos(first, true);
  await page
    .getByRole("heading", { name: "Bandingkan kos", exact: true })
    .waitFor();
  await clickKos(first, true);
  assert.equal(
    await page.locator(".kos-comparison table").count(),
    0,
    "duplicate kos does not fill B",
  );
  await clickKos(sameHex, true);
  await page.locator(".kos-comparison table").waitFor();
  assert.match(await page.locator(".kos-comparison").innerText(), /Estimasi/);
  const state = await page.evaluate(
    ([a, b]) => [
      __qaMap.getFeatureState({ source: "titik-kos", id: a }).bandingA,
      __qaMap.getFeatureState({ source: "titik-kos", id: b }).bandingB,
    ],
    [first.properties.id, sameHex.properties.id],
  );
  assert.deepEqual(
    state,
    [true, true],
    "two kos in the same hex compare independently",
  );
  assert.match(await page.locator(".kos-comparison").innerText(), /LS, .*BT/);
  await page.screenshot({ path: "test-results/qa-compare-kos-desktop.png" });
  await page.getByRole("button", { name: "Ganti kos B", exact: true }).click();
  await clickKos(missing);
  assert.match(
    await page.locator(".kos-comparison table").innerText(),
    /Tidak tersedia/,
  );
  assert.doesNotMatch(
    await page.locator(".kos-comparison").innerText(),
    /lebih murah/,
  );
  await page.getByRole("button", { name: "Tutup perbandingan kos" }).click();
  assert.equal(
    await page.evaluate(
      (id) => __qaMap.getFeatureState({ source: "titik-kos", id }).bandingA,
      first.properties.id,
    ),
    false,
  );

  // The popup button is the keyboard-free entry point, also available on phones.
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "Bobot prioritas" }).click();
  for (const panel of [".layer-panel", ".legend-panel"]) {
    const toggle = page.locator(`${panel} button[aria-expanded]`).first();
    if ((await toggle.getAttribute("aria-expanded")) === "true")
      await toggle.click();
  }
  await page.waitForFunction(() => __qaMap.getCanvas().clientWidth === 390);
  async function tapKos(feature) {
    await page.evaluate(
      (coords) => __qaMap.jumpTo({ center: coords, zoom: 17 }),
      feature.geometry.coordinates,
    );
    await page.waitForTimeout(550);
    const p = await page.evaluate((coords) => {
      const p = __qaMap.project(coords),
        r = __qaMap.getCanvas().getBoundingClientRect();
      return { x: p.x + r.x, y: p.y + r.y - 27 };
    }, feature.geometry.coordinates);
    await page.touchscreen.tap(p.x, p.y);
  }
  await tapKos(first);
  await page
    .getByRole("button", { name: "Bandingkan kos ini" })
    .waitFor({ timeout: 10000 })
    .catch(async (error) => {
      console.log("browser errors", errors);
      await page.screenshot({ path: "test-results/qa-touch-failure.png" });
      throw error;
    });
  await page.getByRole("button", { name: "Bandingkan kos ini" }).click();
  await tapKos(sameHex);
  await page.locator(".kos-comparison table").waitFor();
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
    false,
  );
  await page.screenshot({ path: "test-results/qa-compare-kos-mobile.png" });
  await page.getByRole("button", { name: "Tutup perbandingan kos" }).click();
  const touch = await page.context().newCDPSession(page);
  async function touchPoint(feature) {
    await page.evaluate(
      (coords) => __qaMap.jumpTo({ center: coords, zoom: 17 }),
      feature.geometry.coordinates,
    );
    await page.waitForTimeout(600);
    return page.evaluate((coords) => {
      const p = __qaMap.project(coords),
        r = __qaMap.getCanvas().getBoundingClientRect();
      return { x: p.x + r.x, y: p.y + r.y - 27, id: 0 };
    }, feature.geometry.coordinates);
  }
  const start = await touchPoint(first);
  await touch.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [start],
  });
  await page.waitForTimeout(150);
  await touch.send("Input.dispatchTouchEvent", {
    type: "touchMove",
    touchPoints: [{ ...start, x: start.x + 40 }],
  });
  await page.waitForTimeout(650);
  await touch.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  });
  assert.equal(
    await page.locator(".kos-comparison").count(),
    0,
    "dragging a pin does not activate long press",
  );
  const hold = await touchPoint(first);
  await touch.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [hold],
  });
  await page.waitForTimeout(650);
  await touch.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  });
  await page
    .getByRole("heading", { name: "Bandingkan kos", exact: true })
    .waitFor();
  assert.equal(
    await page.locator(".maplibregl-popup").count(),
    0,
    "holding does not also open a popup",
  );
  const secondTap = await touchPoint(sameHex);
  await touch.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [secondTap],
  });
  await touch.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  });
  await page.locator(".kos-comparison table").waitFor();
  await page.screenshot({ path: "test-results/qa-compare-kos-long-press.png" });
  assert.deepEqual(errors, []);
  console.log(
    JSON.stringify({
      status: "passed",
      checks: [
        "overview symbols",
        "zoom scale",
        "Ctrl+click",
        "duplicate prevention",
        "same-hex kos",
        "A/B pins",
        "replace slot",
        "coordinates",
        "missing price",
        "estimation label",
        "mobile popup comparison",
        "long press touch",
        "drag cancels hold",
        "second kos single tap",
      ],
    }),
  );
} finally {
  await browser.close();
}
