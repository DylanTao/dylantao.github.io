// Actual browser comparison with the same current lighting/runtime. "before"
// serves the original committed Ghibli model and its unoffset manifest entry;
// no other assets are omitted or substituted.
const { chromium } = require("playwright");
const fs = require("node:fs/promises");
const { execFileSync } = require("node:child_process");
const assert = require("node:assert/strict");

(async () => {
  const args = process.argv.slice(2);
  const mode = args.find((argument) => !argument.startsWith("--")) || "after";
  assert.ok(["before", "after"].includes(mode), "Use before or after");
  const option = (name, fallback) =>
    args
      .find((argument) => argument.startsWith(`--${name}=`))
      ?.split("=")
      .slice(1)
      .join("=") || fallback;
  const before = mode === "before";
  const baseURL = option("base-url", process.env.COASTAL_BASE_URL || "http://127.0.0.1:8080").replace(/\/$/, "");
  const baselineRef = option("baseline-ref", "0f948c5ba");
  const output = option("output", ".jekyll-cache/visual-qa/coastal-grip-matched-" + mode);
  await fs.mkdir(output, { recursive: true });
  const browser = await chromium.launch({ args: ["--use-angle=d3d11", "--ignore-gpu-blocklist"] });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });
    const errors = [],
      samples = [];
    page.on("pageerror", (error) => errors.push(String(error)));
    if (before) {
      const model = execFileSync("git", ["show", `${baselineRef}:assets/models/home/sirui-ghibli.glb`], { maxBuffer: 2097152 });
      await page.route("**/assets/models/home/sirui-ghibli.glb", (route) => route.fulfill({ contentType: "model/gltf-binary", body: model }));
      await page.route("**/assets/models/home/manifest.json", async (route) => {
        const response = await route.fetch();
        const manifest = await response.json();
        delete manifest.avatars.find((avatar) => avatar.id === "ghibli").gripWristOffsets;
        await route.fulfill({ response, json: manifest });
      });
    }
    await page.addInitScript(() => {
      sessionStorage.setItem("theme", "noon");
      sessionStorage.setItem("theme-manual", "true");
    });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto(baseURL + "/?scene-lab=1", { waitUntil: "domcontentloaded" });
    await page.locator('[data-home-desk-mode="3d"]').click();
    const scene = page.locator("[data-home-desk-scene]"),
      controls = page.locator("[data-home-world-controls]");
    await page.waitForFunction(() => document.querySelector("[data-home-desk-scene]")?.dataset.sceneState === "ready");
    await controls.locator("[data-world-lab]>summary").click();
    await controls.locator("[data-world-avatar]").selectOption("ghibli");
    await page.waitForFunction(() => document.querySelector("[data-home-desk-scene]")?.dataset.avatar === "ghibli");
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await controls.locator("[data-world-activity]").selectOption("workout");
    await scene.scrollIntoViewIfNeeded();
    for (const [phase, name] of [
      ["pull-ups", "pullup"],
      ["dips", "dip"],
    ]) {
      await page.waitForFunction((phase) => document.querySelector("[data-home-desk-scene]").getSceneEvidence().activityPhase === phase, phase, {
        timeout: 55000,
      });
      await page.waitForTimeout(4500);
      const evidence = await scene.evaluate((element) => element.getSceneEvidence());
      samples.push({ name, evidence });
      await fs.writeFile(output + "/evidence.json", JSON.stringify({ before, errors, samples }, null, 2));
      assert.equal(evidence.activityPhase, phase);
      assert.equal(evidence.gripTargetMode, before ? "equipment-anchor" : "anatomical-wrist");
      assert.equal(evidence.actorCount, 1);
      assert.equal(evidence.animations.length, 14);
      assert.ok(evidence.gripDrift.every((distance) => distance < 0.004));
      await scene.screenshot({ path: output + "/" + name + ".png" });
    }
    if (!before) {
      await controls.locator("[data-world-pause]").click();
      for (const activity of ["work", "soak", "sleep"]) {
        await controls.locator("[data-world-activity]").selectOption(activity);
        await page.waitForTimeout(500);
        const evidence = await scene.evaluate((element) => element.getSceneEvidence());
        assert.equal(evidence.gripTargetMode, "equipment-anchor");
        samples.push({ name: activity, evidence });
        await scene.screenshot({ path: output + "/" + activity + ".png" });
      }
    }
    assert.deepEqual(errors, []);
    await fs.writeFile(output + "/evidence.json", JSON.stringify({ before, errors, samples }, null, 2));
    console.log(
      JSON.stringify({
        output,
        errors,
        samples: samples.map(({ name, evidence }) => ({
          name,
          phase: evidence.activityPhase,
          mode: evidence.gripTargetMode,
          drift: evidence.gripDrift,
        })),
      })
    );
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
