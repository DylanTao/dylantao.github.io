// Run from the repository root against an owned complete preview. Capture normal
// composition, an actual CSS-pixel crop and the uncomposited generated RGBA bitmap.
const { chromium } = require("playwright"),
  fs = require("node:fs/promises"),
  path = require("node:path"),
  crypto = require("node:crypto");
const name = process.argv[2] || "after",
  width = +(process.argv[3] || 1440),
  theme = process.argv[4] || "noon",
  seed = process.argv[5] || "52";
const base = (process.env.COFFEE_REVIEW_URL || "http://127.0.0.1:4132/al-folio").replace(/\/$/, "");
const dpr = +(process.env.COFFEE_DPR || 1);
const output = process.env.COFFEE_CAPTURE_DIR || path.join(__dirname, "captures");
const sha = (b) => crypto.createHash("sha256").update(b).digest("hex");
(async () => {
  await fs.mkdir(output, { recursive: true });
  const raster = process.env.COFFEE_RASTER ? await fs.readFile(process.env.COFFEE_RASTER) : null;
  const browser = await chromium.launch({ args: process.platform === "win32" ? ["--use-angle=d3d11", "--ignore-gpu-blocklist"] : [] });
  try {
    const page = await browser.newPage({
        viewport: { width, height: 1000 },
        deviceScaleFactor: dpr,
        isMobile: width < 600,
        hasTouch: width < 600,
        reducedMotion: "reduce",
      }),
      errors = [],
      requests = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text());
    });
    page.on("response", (response) => {
      if (/\/assets\/(?:js\/home-coffee-stain\.js|css\/main\.css|img\/home\/coffee-deposit-[^/]+\.webp)(?:\?|$)/.test(response.url()))
        requests.push(
          (async () => {
            const bytes = await response.body();
            return { url: response.url(), status: response.status(), bytes: bytes.length, sha256: sha(bytes) };
          })()
        );
    });
    const scriptOverride = process.env.COFFEE_SCRIPT ? await fs.readFile(process.env.COFFEE_SCRIPT) : null;
    if (scriptOverride)
      await page.route("**/assets/js/home-coffee-stain.js*", (route) => route.fulfill({ body: scriptOverride, contentType: "text/javascript" }));
    await page.goto(base + "/?coffeeSeed=" + seed, { waitUntil: "domcontentloaded" });
    await page.evaluate((t) => setThemeSetting(t), theme);
    const stack = page.locator(".home-artifact-stack.has-coffee-stain");
    await stack.scrollIntoViewIfNeeded();
    await page.waitForFunction(() => document.querySelector("[data-coffee-stain-ready]"), null, { timeout: 30000 });
    if (!scriptOverride)
      await page.waitForFunction(() => {
        const node = document.querySelector(".home-artifact-stack.has-coffee-stain");
        const palette = document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light";
        return node.coffeeStainEvidence.paintedPalette === palette;
      });
    await page.waitForTimeout(250);
    // Diagnostic image-only comparison: the procedural runtime stays intact.
    if (raster)
      await stack.evaluate(
        (node, url) => node.style.setProperty("--home-coffee-stain-image", `url("${url}")`),
        "data:image/png;base64," + raster.toString("base64")
      );
    if (process.env.COFFEE_FIXED_PLACEMENT === "1")
      await stack.evaluate((node) => {
        for (const [name, value] of Object.entries({ rotation: "0deg", x: "0rem", y: "0rem", scale: "1" }))
          node.style.setProperty(`--home-coffee-stain-${name}`, value);
      });
    const detail = await stack.evaluate((e) => {
      const s = getComputedStyle(e, "::before"),
        b = e.getBoundingClientRect();
      return {
        data: s.backgroundImage.slice(5, -2),
        source: e.dataset.coffeeStainSource,
        generation: e.coffeeStainEvidence,
        size: parseFloat(s.width),
        strength: s.opacity,
        filter: s.filter,
        animation: s.animationName,
        drying: e.dataset.coffeeStainDrying || null,
        settled: e.dataset.coffeeStainSettled || null,
        wetContent: getComputedStyle(e, "::after").content,
        transform: s.transform,
        top: s.top,
        right: s.right,
        stack: { x: b.x, y: b.y, width: b.width, height: b.height },
      };
    });
    const bitmap = Buffer.from(detail.data.split(",")[1], "base64");
    delete detail.data;
    detail.pngBytes = bitmap.length;
    detail.pngSha256 = sha(bitmap);
    await fs.writeFile(path.join(output, name + "-native.png"), bitmap);
    await page.locator(".home-hero").screenshot({ path: path.join(output, name + "-hero.png") });
    await stack.scrollIntoViewIfNeeded();
    const b = await stack.boundingBox(),
      x = b.x + b.width - parseFloat(detail.right) - detail.size,
      y = b.y + parseFloat(detail.top);
    await page.screenshot({
      path: path.join(output, name + "-detail.png"),
      clip: { x: Math.max(0, x - 8), y: Math.max(0, y - 8), width: detail.size + 16, height: detail.size + 16 },
    });
    await fs.writeFile(
      path.join(output, name + ".json"),
      JSON.stringify(
        {
          width,
          dpr,
          theme,
          seed,
          browser: browser.version(),
          platform: process.platform,
          fixedPlacement: process.env.COFFEE_FIXED_PLACEMENT === "1",
          scriptOverride: scriptOverride
            ? { sha256: sha(scriptOverride), scope: "Compiled coffee-only prototype over complete own site; not final full build" }
            : null,
          baselineScope: process.env.COFFEE_BASELINE_SCOPE || "Complete own compiled build",
          rasterOverride: raster ? { path: process.env.COFFEE_RASTER, sha256: sha(raster) } : null,
          detail,
          bindings: await Promise.all(requests),
          errors,
        },
        null,
        2
      ) + "\n"
    );
    if (errors.length) throw new Error(errors.join("\n"));
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
