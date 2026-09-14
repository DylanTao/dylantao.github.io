// Matched real route captures. Serve the retained baseline on 8081, current on 8080.
const { chromium } = require("playwright");
const fs = require("node:fs/promises");
const { execFileSync } = require("node:child_process");
(async () => {
  const browser = await chromium.launch({
    headless: true,
    args: process.platform === "win32" ? ["--use-angle=d3d11", "--ignore-gpu-blocklist"] : [],
  });
  const directory = ".jekyll-cache/visual-qa/reading-comparison";
  await fs.mkdir(directory, { recursive: true });
  const records = [];
  try {
    for (const [state, port] of [
      ["before", 8081],
      ["after", 8080],
    ]) {
      const page = await browser.newPage({
        viewport: { width: 1440, height: 650 },
        deviceScaleFactor: 1,
        reducedMotion: "reduce",
        timezoneId: "America/Los_Angeles",
      });
      await page.addInitScript(() => {
        localStorage.setItem("theme", "light");
        localStorage.setItem("theme-mode", "noon");
      });
      await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: "networkidle" });
      await page.evaluate(() => document.fonts.ready);
      await page.locator("#connect").evaluate((e) => scrollTo(0, scrollY + e.getBoundingClientRect().top - 96));
      await page.waitForTimeout(2000);
      await page.screenshot({ path: `${directory}/${state}.png` });
      records.push({
        state,
        source: state === "before" ? "bb56e6af5c8963f1a117dee1a46da924faa1bd52" : "working tree included with this capture",
        anchorTop: await page.locator("#connect").evaluate((e) => e.getBoundingClientRect().top),
        capturedAt: new Date().toISOString(),
      });
      await page.close();
    }
  } finally {
    await browser.close();
  }
  await fs.writeFile(
    `${directory}/provenance.json`,
    JSON.stringify(
      {
        route: "/#connect",
        viewport: { width: 1440, height: 650 },
        dpr: 1,
        theme: "noon",
        motion: "system reduced motion",
        browser: browser.version(),
        playwright: execFileSync(process.execPath, ["-e", "process.stdout.write(require('playwright/package.json').version)"]).toString(),
        records,
      },
      null,
      2
    ) + "\n"
  );
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
