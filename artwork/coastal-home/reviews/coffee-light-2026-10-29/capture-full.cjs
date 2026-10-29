const { chromium, expect } = require("@playwright/test"),
  fs = require("node:fs/promises"),
  path = require("node:path"),
  crypto = require("node:crypto");
const { preparePage, collectRuntimeErrors } = require(path.resolve("test/visual/helpers.js"));
const q = path.resolve(".jekyll-cache/visual-qa/coffee-light-20261029");
(async () => {
  const browser = await chromium.launch({ args: ["--use-angle=d3d11", "--ignore-gpu-blocklist"] });
  const rows = [];
  try {
    for (const version of ["before", "candidate"])
      for (const seed of version === "before" ? ["52"] : ["52", "103"])
        for (const theme of ["light", "dark"]) {
          const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });
          await preparePage(page, theme);
          const errors = collectRuntimeErrors(page);
          await page.emulateMedia({ reducedMotion: "reduce" });
          if (version === "before")
            await page.route("**/assets/js/home-coffee-stain.js*", (route) =>
              route.fulfill({ path: path.join(q, "before.min.js"), contentType: "text/javascript" })
            );
          await page.goto("http://127.0.0.1:4152/al-folio/?coffeeSeed=" + seed, { waitUntil: "domcontentloaded" });
          await page.locator('[data-home-desk-mode="2d"]').click();
          const stack = page.locator(".home-artifact-stack.has-coffee-stain");
          await expect(stack).toHaveAttribute("data-coffee-stain-ready", "true", { timeout: 30000 });
          await stack.evaluate((e) => {
            for (const [key, value] of Object.entries({
              "--home-coffee-stain-rotation": "0deg",
              "--home-coffee-stain-x": "0rem",
              "--home-coffee-stain-y": "0rem",
              "--home-coffee-stain-scale": "1",
            }))
              e.style.setProperty(key, value);
          });
          await stack.scrollIntoViewIfNeeded();
          await stack.evaluate((e) => window.scrollBy(0, e.getBoundingClientRect().top - 280));
          const stamp = await stack.evaluate(async (e) => {
            const value = getComputedStyle(e).getPropertyValue("--home-coffee-stain-image").trim();
            if (!value.startsWith('url("data:')) throw Error("Expected actual generated image");
            const image = new Image();
            image.src = value.slice(5, -2);
            await image.decode();
            const c = document.createElement("canvas");
            c.width = image.naturalWidth;
            c.height = image.naturalHeight;
            const ctx = c.getContext("2d");
            ctx.drawImage(image, 0, 0);
            const rgba = ctx.getImageData(0, 0, c.width, c.height).data;
            let marked = 0,
              opacity = 0,
              opaque = 0;
            for (let i = 3; i < rgba.length; i += 4)
              if (rgba[i] >= 8) {
                marked++;
                opacity += rgba[i];
                opaque += rgba[i] >= 230;
              }
            return {
              width: c.width,
              height: c.height,
              palette: document.documentElement.dataset.theme,
              source: e.dataset.coffeeStainSource,
              opacity: getComputedStyle(e).getPropertyValue("--home-coffee-stain-opacity"),
              marked,
              meanMarkedAlpha: opacity / marked,
              opaqueFraction: opaque / marked,
              png: c.toDataURL("image/png").split(",")[1],
            };
          });
          expect(stamp.source).toBe("procedural");
          expect(stamp.palette).toBe(theme);
          expect(errors).toEqual([]);
          const png = Buffer.from(stamp.png, "base64");
          delete stamp.png;
          const id = version + "-" + theme + "-" + seed;
          await fs.writeFile(path.join(q, id + "-native.png"), png);
          stamp.pngSha256 = crypto.createHash("sha256").update(png).digest("hex");
          const bounds = await stack.evaluate((e) => {
            const r = e.getBoundingClientRect(),
              c = getComputedStyle(e, "::before"),
              w = parseFloat(c.width),
              h = parseFloat(c.height);
            return { x: r.right - parseFloat(c.right) - w - 20, y: r.top + parseFloat(c.top) - 20, width: w + 40, height: h + 40 };
          });
          await page.screenshot({ path: path.join(q, id + "-full-detail.png"), clip: bounds });
          rows.push({
            id,
            ...stamp,
            errors,
            scope:
              version === "before"
                ? "Matched full-site material control using exact old compiled script; no other interception"
                : "Complete copied production site with candidate compiled coffee script; no route interception. Explicit fixed CSS placement and reduced motion for comparison.",
          });
          console.log(JSON.stringify({ id, meanAlpha: stamp.meanMarkedAlpha, opaque: stamp.opaqueFraction, marked: stamp.marked }));
          await page.close();
        }
    await fs.writeFile(path.join(q, "comparison-full.json"), JSON.stringify({ rows }, null, 2) + "\n");
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
