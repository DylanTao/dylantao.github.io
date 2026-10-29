const { chromium, expect } = require("@playwright/test"),
  fs = require("node:fs/promises"),
  path = require("node:path"),
  crypto = require("node:crypto");
const { preparePage, collectRuntimeErrors } = require(path.resolve("test/visual/helpers.js"));
(async () => {
  const q = path.resolve(".jekyll-cache/visual-qa/coffee-light-20261029"),
    browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    await preparePage(page, "dark");
    const errors = collectRuntimeErrors(page);
    await page.goto("http://127.0.0.1:4152/al-folio/?coffeeSeed=52", { waitUntil: "domcontentloaded" });
    await page.locator('[data-home-desk-mode="2d"]').click();
    const stack = page.locator(".home-artifact-stack.has-coffee-stain");
    await expect(stack).toHaveAttribute("data-coffee-stain-ready", "true", { timeout: 30000 });
    const source = await stack.getAttribute("data-coffee-stain-source");
    expect(source).toBe("procedural");
    const url = await page.locator('script[src*="home-coffee-stain.js"]').getAttribute("src"),
      body = await (await page.request.get(new URL(url, page.url()).href)).body(),
      expected = await fs.readFile(path.join(q, "candidate.min.js"));
    expect(body.equals(expected)).toBe(true);
    expect(errors).toEqual([]);
    const receipt = {
      source,
      url,
      bytes: body.length,
      sha256: crypto.createHash("sha256").update(body).digest("hex"),
      errors,
      scope: "Actual final production Jekyll route and ordinary compiled asset, with no interception or forced placement",
    };
    await fs.writeFile(path.join(q, "compiled-readback.json"), JSON.stringify(receipt, null, 2) + "\n");
    console.log(JSON.stringify(receipt));
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
