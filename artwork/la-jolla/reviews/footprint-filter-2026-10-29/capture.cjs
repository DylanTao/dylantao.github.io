const fs = require("node:fs"),
  path = require("node:path");
const { PNG } = require("pngjs");
const { chromium } = require("playwright");
const { preparePage, collectRuntimeErrors } = require("../../../../test/visual/helpers.js");
const q = __dirname,
  out = process.env.REVIEW_OUT || path.join(q, "generated");
fs.mkdirSync(out, { recursive: true });
(async () => {
  const b = await chromium.launch({ headless: true, args: ["--use-angle=d3d11", "--ignore-gpu-blocklist"] });
  const rows = [];
  try {
    for (const width of [390, 1440, 2560])
      for (const theme of ["noon", "evening"]) {
        const pair = [];
        for (const control of ["before", "after"]) {
          const c = await b.newContext({
            viewport: { width, height: 1000 },
            deviceScaleFactor: 1,
            reducedMotion: "reduce",
            timezoneId: "America/Los_Angeles",
          });
          const p = await c.newPage();
          await preparePage(p, theme);
          await p.clock.setFixedTime(new Date("2026-10-23T12:30:00-07:00"));
          if (control === "before")
            await p.route(/\/footer-coast\/sky\.mjs(?:\?.*)?$/, (r) =>
              r.fulfill({
                body: require("node:zlib").gunzipSync(fs.readFileSync(path.join(q, "baseline-compiled.mjs.gz"))),
                contentType: "text/javascript",
              })
            );
          const errors = collectRuntimeErrors(p);
          await p.goto((process.env.VISUAL_BASE_URL || "http://127.0.0.1:4151/al-folio").replace(/\/$/, "") + "/blog/", {
            waitUntil: "domcontentloaded",
          });
          const h = p.locator("footer [data-footer-coast]");
          await h.scrollIntoViewIfNeeded();
          await p.waitForFunction(() => document.querySelector("footer [data-footer-coast]")?.dataset.state === "ready");
          await p.waitForTimeout(750);
          const info = await h.evaluate((e) => e.getCoastEvidence());
          const data = await h.locator("canvas").screenshot({ path: path.join(out, `${control}-${width}-${theme}.png`) });
          pair.push({ control, info, errors, data });
          await c.close();
        }
        const a = PNG.sync.read(pair[0].data),
          z = PNG.sync.read(pair[1].data);
        let pixels = 0,
          max = 0,
          sum = 0,
          minY = a.height,
          maxY = 0;
        for (let i = 0; i < a.data.length; i += 4) {
          let delta = 0;
          for (let j = 0; j < 3; j++) delta = Math.max(delta, Math.abs(a.data[i + j] - z.data[i + j]));
          if (delta) {
            pixels++;
            sum += delta;
            max = Math.max(max, delta);
            const y = Math.floor(i / 4 / a.width);
            minY = Math.min(minY, y);
            maxY = Math.max(maxY, y);
          }
        }
        rows.push({
          width,
          theme,
          pixelDifference: { pixels, ratio: pixels / (a.width * a.height), max, meanChanged: pixels ? sum / pixels : 0, y: [minY, maxY] },
          renders: pair.map(({ control, info, errors }) => ({ control, info, errors })),
        });
      }
    fs.writeFileSync(path.join(out, "comparison.json"), JSON.stringify(rows, null, 2));
    console.log(
      JSON.stringify(
        rows.map(({ width, theme, pixelDifference, renders }) => ({ width, theme, pixelDifference, errors: renders.map((r) => r.errors) }))
      )
    );
  } finally {
    await b.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
