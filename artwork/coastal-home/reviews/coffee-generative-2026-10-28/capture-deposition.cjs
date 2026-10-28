// Visual phase samples seek the real once-only CSS animation. The public test
// separately waits for actual completion, global pause/resume and reduced motion.
const { chromium } = require("playwright"),
  fs = require("node:fs/promises"),
  path = require("node:path"),
  crypto = require("node:crypto");
const output = path.join(__dirname, "deposition");
const base = process.env.COFFEE_REVIEW_URL || "http://127.0.0.1:4132/al-folio";
(async () => {
  await fs.mkdir(output, { recursive: true });
  const browser = await chromium.launch({ args: process.platform === "win32" ? ["--use-angle=d3d11", "--ignore-gpu-blocklist"] : [] });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, reducedMotion: "no-preference" });
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text());
    });
    await page.goto(base.replace(/\/$/, "") + "/?coffeeSeed=31&cinematic=live", { waitUntil: "domcontentloaded" });
    const stack = page.locator(".home-artifact-stack.has-coffee-stain");
    await stack.scrollIntoViewIfNeeded();
    await page.waitForFunction(() => document.querySelector('[data-coffee-stain-drying="true"]'));
    const bitmaps = await stack.evaluate(async (node) => {
      for (const [name, value] of Object.entries({ rotation: "0deg", x: "0rem", y: "0rem", scale: "1" }))
        node.style.setProperty(`--home-coffee-stain-${name}`, value);
      const animations = document.getAnimations().filter((animation) => /^home-coffee-/.test(animation.animationName || ""));
      animations.forEach((animation) => animation.pause());
      await Promise.all(animations.map((animation) => animation.ready));
      return {
        dry: getComputedStyle(node, "::before").backgroundImage.slice(5, -2),
        wash: getComputedStyle(node, "::after").backgroundImage.slice(5, -2),
      };
    });
    const hashes = {};
    for (const [name, url] of Object.entries(bitmaps)) {
      const png = Buffer.from(url.split(",")[1], "base64");
      hashes[name] = { bytes: png.length, sha256: crypto.createHash("sha256").update(png).digest("hex") };
      await fs.writeFile(path.join(output, name + "-native.png"), png);
    }
    const phases = [];
    for (const time of [0, 1600, 3199]) {
      await stack.evaluate(
        (node, time) =>
          document
            .getAnimations()
            .filter((animation) => /^home-coffee-/.test(animation.animationName || ""))
            .forEach((animation) => {
              animation.currentTime = time;
            }),
        time
      );
      await page.evaluate(() => new Promise(requestAnimationFrame));
      const state = await stack.evaluate((node) => {
        const dry = getComputedStyle(node, "::before"),
          wet = getComputedStyle(node, "::after"),
          box = node.getBoundingClientRect();
        return {
          dryOpacity: dry.opacity,
          washOpacity: wet.opacity,
          transform: dry.transform,
          filter: dry.filter,
          animations: document
            .getAnimations()
            .filter((animation) => /^home-coffee-/.test(animation.animationName || ""))
            .map((animation) => ({ name: animation.animationName, currentTime: animation.currentTime, playState: animation.playState })),
          generation: node.coffeeStainEvidence,
          size: parseFloat(dry.width),
          x: box.right - parseFloat(dry.right) - parseFloat(dry.width),
          y: box.top + parseFloat(dry.top),
        };
      });
      const filename = `phase-${time}ms.png`;
      await page.screenshot({
        path: path.join(output, filename),
        clip: { x: state.x - 8, y: state.y - 8, width: state.size + 16, height: state.size + 16 },
      });
      phases.push({ authoredAnimationTimeMs: time, filename, ...state });
    }
    await fs.writeFile(
      path.join(output, "phases.json"),
      JSON.stringify(
        {
          scope:
            "Frozen complete compiled candidate. Explicitly sought visual samples of authored deposition, not elapsed-time, a simulation or a performance measurement. The functional public case waits for actual once-only completion.",
          browser: browser.version(),
          seed: "31",
          bitmaps: hashes,
          phases,
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
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
