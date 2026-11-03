const fs = require("node:fs"),
  path = require("node:path");
const q = __dirname,
  out = path.join(q, "live-brand-report-v1");
if (fs.existsSync(out)) throw Error("Keep prior evidence");
fs.mkdirSync(out);
const snapshot = (p) =>
  p.locator("#navbar .site-brand").evaluate((e) => ({
    state: e.dataset.brandState || null,
    static: e.hasAttribute("data-brand-static"),
    html: e.outerHTML,
    button: e.querySelector("[data-brand-discover]")?.tagName,
    label: e.querySelector("[data-brand-discover]")?.getAttribute("aria-label"),
    primaryFine: matchMedia("(hover:hover) and (pointer:fine)").matches,
    anyFine: matchMedia("(any-hover:hover) and (any-pointer:fine)").matches,
    reduced: matchMedia("(prefers-reduced-motion:reduce)").matches,
    paused: window.siteMotion?.paused,
    box: e.getBoundingClientRect().toJSON(),
  }));
(async () => {
  const rows = [];
  for (const [kind, width, height, route] of [
    ["desktop", 1440, 1000, "/"],
    ["laptop", 1280, 800, "/blog/"],
    ["phone", 390, 1000, "/"],
    ["phone-blog", 390, 1000, "/blog/"],
    ["ai", 1440, 1000, "/ai/"],
  ]) {
    const phone = kind.startsWith("phone"),
      sdk = phone ? require(path.join(q, "webkit-1.65-alpha-20261028/node_modules/@playwright/test")) : require("@playwright/test");
    const browser = await sdk[phone ? "webkit" : "chromium"].launch({
      headless: true,
      ...(phone ? {} : { args: ["--use-angle=d3d11", "--ignore-gpu-blocklist"] }),
    });
    try {
      const context = await browser.newContext({
          ...(phone ? sdk.devices["iPhone 13"] : {}),
          viewport: { width, height },
          deviceScaleFactor: 1,
          reducedMotion: "no-preference",
        }),
        p = await context.newPage();
      p.setDefaultTimeout(30000);
      const errors = [],
        requests = [];
      p.on("pageerror", (e) => errors.push(e.message));
      p.on("response", (r) => {
        if (/brand-orange\.js/.test(r.url())) requests.push({ url: r.url(), status: r.status() });
      });
      await p.route(/https:\/\/(?:analytics\.google\.com|www\.google-analytics\.com|www\.googletagmanager\.com|plausible\.io)\//, (r) =>
        r.fulfill({ status: 204, body: "" })
      );
      await p.goto("https://dylantao.github.io" + route + "?brand-review=20261103", { waitUntil: "domcontentloaded" });
      await p.evaluate(() => document.fonts.ready);
      await p.waitForTimeout(1200);
      const before = await snapshot(p);
      await p.locator("#navbar .site-brand").screenshot({ path: path.join(out, kind + "-before.png") });
      const name = p.locator("[data-brand-discover]");
      if (await name.count()) {
        if (phone) await name.tap();
        else {
          await p.mouse.move(width - 20, 250);
          await name.hover();
        }
        await p.waitForTimeout(900);
        await p.locator("#navbar .site-brand").screenshot({ path: path.join(out, kind + "-during.png") });
      }
      await p.waitForTimeout(4800);
      if (!phone) await p.mouse.move(width - 20, 250);
      const after = await snapshot(p);
      await p.locator("#navbar .site-brand").screenshot({ path: path.join(out, kind + "-after.png") });
      rows.push({ kind, width, height, route, browser: browser.version(), before, after, requests, errors });
      fs.writeFileSync(path.join(out, "REPORT.json"), JSON.stringify(rows, null, 2) + "\n");
      console.log(JSON.stringify({ kind, button: before.button, before: before.state, after: after.state, static: before.static, errors }));
      await context.close();
    } finally {
      await browser.close();
    }
  }
})().catch((e) => {
  fs.writeFileSync(path.join(out, "FAILURE.json"), JSON.stringify({ error: String(e) }, null, 2));
  console.error(e);
  process.exitCode = 1;
});
