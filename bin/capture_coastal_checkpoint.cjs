// Actual browser frames at stable camera/activity states. Keep output out of Jekyll.
const { chromium } = require("playwright");
const fs = require("node:fs/promises");
const path = require("node:path");
(async () => {
  const tag = process.argv[2] || "current";
  const output = path.resolve(".jekyll-cache/visual-qa/coastal-" + tag);
  await fs.mkdir(output, { recursive: true });
  const browser = await chromium.launch({ headless: true, args: ["--use-angle=d3d11", "--ignore-gpu-blocklist"] });
  try {
    const width = Number(process.env.COAST_WIDTH || 1440);
    const period = process.env.COAST_PERIOD || "day";
    const page = await browser.newPage({ viewport: { width, height: width === 1280 ? 800 : width === 768 ? 1024 : 1000 }, deviceScaleFactor: 1 });
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.stack));
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.addInitScript((period) => {
      sessionStorage.setItem("theme", period === "night" ? "evening" : "noon");
      sessionStorage.setItem("theme-manual", "true");
    }, period);
    const baseURL = process.env.COAST_BASE_URL || "http://127.0.0.1:8080";
    await page.goto(baseURL.replace(/\/$/, "") + "/?scene-lab=1", { waitUntil: "domcontentloaded" });
    await page.locator('[data-home-desk-mode="3d"]').click();
    const scene = page.locator("[data-home-desk-scene]");
    await page.waitForFunction(() => document.querySelector("[data-home-desk-scene]")?.dataset.sceneState === "ready");
    const ui = page.locator("[data-home-world-controls]");
    await ui.locator("summary").first().click();
    await ui.locator("[data-world-activity]").selectOption(process.env.COAST_ACTIVITY || (period === "night" ? "coding" : "work"));
    await ui.locator("[data-world-avatar]").selectOption("ghibli");
    for (const room of (process.argv[3] || "outside,overview,study,gym,onsen,sleep,kitchen,lounge").split(",")) {
      await ui.locator(`[data-world-room="${room}"]`).first().click();
      await scene.scrollIntoViewIfNeeded();
      await page.waitForTimeout(1500);
      await fs.writeFile(path.join(output, room + ".json"), JSON.stringify(await scene.evaluate((e) => e.getSceneEvidence()), null, 2));
      await scene.screenshot({ path: path.join(output, room + ".png") });
    }
    if (process.env.COAST_AVATARS === "all") {
      await ui.locator('[data-world-room="study"]').first().click();
      for (const avatar of ["lizard", "south-park", "simpsons", "ghibli", "rick-and-morty"]) {
        await ui.locator("[data-world-avatar]").selectOption(avatar);
        await page.waitForFunction((avatar) => document.querySelector("[data-home-desk-scene]").dataset.avatar === avatar, avatar);
        await scene.scrollIntoViewIfNeeded();
        await page.waitForTimeout(600);
        await scene.screenshot({ path: path.join(output, "avatar-" + avatar + ".png") });
      }
    }
    await fs.writeFile(
      path.join(output, "evidence.json"),
      JSON.stringify({ width, period, errors, scene: await scene.evaluate((e) => e.getSceneEvidence()) }, null, 2)
    );
    console.log(output, errors);
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
