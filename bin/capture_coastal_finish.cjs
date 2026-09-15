// Actual browser orbit and contact review. No replacement of rendered assets.
const { chromium } = require("playwright");
const fs = require("node:fs/promises");
const assert = require("node:assert/strict");
(async () => {
  const out = ".jekyll-cache/visual-qa/coastal-finish-motion";
  await fs.mkdir(out, { recursive: true });
  const browser = await chromium.launch({ args: ["--use-angle=d3d11", "--ignore-gpu-blocklist"] });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });
    const errors = [];
    page.on("pageerror", (e) => errors.push(String(e)));
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto((process.env.COAST_BASE_URL || "http://127.0.0.1:8080") + "/?scene-lab=1", { waitUntil: "domcontentloaded" });
    await page.locator('[data-home-desk-mode="3d"]').click();
    const scene = page.locator("[data-home-desk-scene]"),
      ui = page.locator("[data-home-world-controls]"),
      canvas = scene.locator("canvas");
    await page.waitForFunction(() => document.querySelector("[data-home-desk-scene]")?.dataset.sceneState === "ready");
    await ui.locator("summary").first().click();
    await ui.locator('[data-world-room="outside"]').first().click();
    await scene.scrollIntoViewIfNeeded();
    await canvas.focus();
    const orbit = [];
    for (let i = 0; i < 8; i++) {
      for (let j = 0; j < (i ? 4 : 0); j++) await canvas.press("ArrowLeft");
      await page.waitForTimeout(120);
      orbit.push(await scene.evaluate((e) => e.getSceneEvidence()));
      await scene.screenshot({ path: `${out}/orbit-${i}.png` });
    }
    // Exercise the remaining quadrant and wrap back through the start.
    for (let j = 0; j < 8; j++) await canvas.press("ArrowLeft");
    orbit.push(await scene.evaluate((e) => e.getSceneEvidence()));
    await ui.locator("[data-world-activity]").selectOption("workout");
    await page.emulateMedia({ reducedMotion: "no-preference" });
    const contacts = [];
    for (const avatar of ["lizard", "south-park", "simpsons", "ghibli", "rick-and-morty"]) {
      await ui.locator("[data-world-avatar]").selectOption(avatar);
      await page.waitForFunction((a) => document.querySelector("[data-home-desk-scene]").dataset.avatar === a, avatar);
      await scene.scrollIntoViewIfNeeded();
      await page.waitForTimeout(8000);
      const data = await scene.evaluate((e) => e.getSceneEvidence());
      contacts.push(data);
      await scene.screenshot({ path: `${out}/${avatar}-pullup.png` });
    }
    await page.waitForTimeout(26000);
    contacts.push(await scene.evaluate((e) => e.getSceneEvidence()));
    await scene.screenshot({ path: `${out}/dip.png` });
    await ui.locator("[data-world-activity]").selectOption("breakfast");
    await scene.scrollIntoViewIfNeeded();
    await page.waitForTimeout(11500);
    contacts.push(await scene.evaluate((e) => e.getSceneEvidence()));
    await scene.screenshot({ path: `${out}/coffee-grind.png` });
    await page.waitForTimeout(21500);
    contacts.push(await scene.evaluate((e) => e.getSceneEvidence()));
    await scene.screenshot({ path: `${out}/coffee-carry.png` });
    await fs.writeFile(out + "/evidence.json", JSON.stringify({ errors, orbit, contacts }, null, 2));
    assert.equal(errors.length, 0);
    for (const sample of contacts) {
      assert.ok(sample.activityPhase);
      assert.ok(sample.gripDrift.length > 0);
      assert.ok(
        sample.gripDrift.every((d) => d < 0.02),
        `${sample.avatarId} ${sample.activityPhase} lost its grip`
      );
    }
    console.log(
      JSON.stringify({
        errors,
        contacts: contacts.map((e) => ({ avatar: e.avatarId, phase: e.activityPhase, drift: e.gripDrift })),
        orbitViews: orbit.length,
      })
    );
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
