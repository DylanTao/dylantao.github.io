// Real-house check of the primary-view Head-ownership exclusion: the complete root-served site
// (BASE_URL, default the coordinator's local build), with only the working walk-presence.mjs
// overlaid read-only (NO_OVERLAY=1 draws the previous module as a control). Native clocks and
// full assets; lab placement stages valid capsule poses at the maximum reachable down-look.
const fs = require("node:fs/promises");
const path = require("node:path");
const crypto = require("node:crypto");
const assert = require("node:assert/strict");
const dependencyRepo = process.env.DEPENDENCY_REPO || process.cwd();
const { chromium } = require(path.join(dependencyRepo, "node_modules/playwright"));
const { preparePage, collectRuntimeErrors } = require(path.join(dependencyRepo, "test/visual/helpers.js"));
const base = (process.env.BASE_URL || "http://127.0.0.1:4160/").replace(/\/?$/, "/");
const overlay = process.env.NO_OVERLAY !== "1";
const variant = overlay ? "after" : "before";
const out = path.join(process.cwd(), ".jekyll-cache/visual-qa/coord-2026-10-24/head-exclusion-house");
const avatars = ["south-park", "ghibli", "lizard", "simpsons", "rick-and-morty"];
const report = { base, overlay, variant, viewports: {}, passed: false };

async function runViewport(browser, id, viewport, touch, moduleBytes) {
  const context = await browser.newContext({ viewport, deviceScaleFactor: 1, hasTouch: touch, isMobile: touch });
  const page = await context.newPage();
  page.setDefaultTimeout(180000);
  const errors = collectRuntimeErrors(page);
  const receipt = (report.viewports[id] = { viewport, touch, steps: [], errors });
  const scene = page.locator("[data-home-desk-scene]");
  const state = () => scene.evaluate((e) => e.getSceneEvidence());
  const frame = async (action) => {
    const before = (await state()).frames;
    await action();
    await page.waitForFunction((n) => (document.querySelector("[data-home-desk-scene]")?.getSceneEvidence?.()?.frames || 0) > n + 1, before);
  };
  const save = async (label) => {
    const s = await state(),
      draw = await page.evaluate(() => window.__primaryDraw);
    receipt.steps.push({
      label,
      avatar: s.avatarId,
      walk: { active: s.walk?.active, position: s.walk?.position, pitch: s.walk?.pitch, room: s.walk?.room },
      presence: {
        active: s.walkPresence?.active,
        prepared: s.walkPresence?.prepared,
        sourceHidden: s.walkPresence?.sourceHidden,
        exclusion: s.walkPresence?.primaryHeadExclusion,
      },
      draw,
    });
    await page.screenshot({ path: path.join(out, `${id}-${label}-${variant}.png`) });
    console.log(id, label, s.avatarId, JSON.stringify(s.walkPresence?.primaryHeadExclusion), draw?.forward?.map((v) => v.toFixed(3)).join(","));
    return { s, draw };
  };
  const chooseAvatar = async (value) => {
    await frame(() => page.locator("[data-world-avatar]").selectOption(value));
    await page.waitForFunction((v) => {
      const e = document.querySelector("[data-home-desk-scene]")?.getSceneEvidence?.();
      return e?.avatarId === v && e?.walkPresence?.prepared && !document.querySelector("[data-home-world-controls]")?.hasAttribute("aria-busy");
    }, value);
  };
  try {
    await preparePage(page, "light");
    // Registered after preparePage's catch-all stub: Playwright runs the newest matching route first.
    if (moduleBytes)
      await page.route("**/assets/js/home-scene/walk-presence.mjs*", (route) => route.fulfill({ body: moduleBytes, contentType: "text/javascript" }));
    await page.route("**/livereload.js*", (route) => route.fulfill({ body: "", contentType: "text/javascript" }));
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await page.goto(base + "?scene-lab=1", { waitUntil: "domcontentloaded" });
    await page.locator('[data-home-desk-mode="3d"]').click();
    await page.waitForFunction(() => document.querySelector("[data-home-desk-scene]")?.dataset.sceneState === "ready", null, { timeout: 400000 });
    await page.waitForFunction(() => !document.querySelector("[data-home-world-controls]").hasAttribute("aria-busy"), null, { timeout: 400000 });
    // Record the actual primary draw camera and how many triangles the visible walking body submits.
    await scene.evaluate((element) => {
      const world = element.labScene.scene,
        original = world.onBeforeRender;
      world.onBeforeRender = function (renderer, w, camera, ...args) {
        original?.call(this, renderer, w, camera, ...args);
        const body = world.getObjectByName("walking-Sirui");
        if (!body?.visible) return;
        const e = camera.matrixWorld.elements;
        window.__primaryDraw = { forward: [-e[8], -e[9], -e[10]], position: camera.position.toArray() };
      };
    });
    await scene.locator("canvas").scrollIntoViewIfNeeded();
    await frame(() => page.locator("[data-world-fullscreen]").click());
    for (const avatar of avatars) {
      await page.locator("[data-world-lab] > summary").click();
      await chooseAvatar(avatar);
      await page.locator("[data-world-lab] > summary").click();
      if (!(await state()).walk?.active) {
        await frame(() => page.locator("[data-world-walk]").click());
        await page.waitForFunction(() => {
          const s = document.querySelector("[data-home-desk-scene]").getSceneEvidence();
          return s.walk?.ready && s.walkPresence?.active && s.walkPresence?.prepared;
        });
      }
      const at = (await state()).walk.position;
      await frame(async () => assert.equal(await scene.evaluate((e, at) => e.setLabWalk({ position: at, yaw: 0, pitch: -1.4 }), at), true));
      await page.waitForTimeout(600);
      const { s, draw } = await save(`${avatar}-down`);
      assert.equal(s.walkPresence.active, true);
      assert.equal(s.walkPresence.sourceHidden, true);
      assert.ok(draw.forward[1] < -0.98, "the actual primary draw camera looks down");
      if (overlay) assert.ok(s.walkPresence.primaryHeadExclusion.primitives > 0, `${avatar}: Head-owned primitives are excluded`);
    }
    if (!touch) {
      await scene.locator("canvas").focus();
      const d = (await state()).walk.distance;
      await page.keyboard.down("KeyW");
      await page.waitForTimeout(450);
      await page.keyboard.up("KeyW");
      await page.waitForFunction((distance) => document.querySelector("[data-home-desk-scene]").getSceneEvidence().walk.distance > distance, d, {
        timeout: 30000,
      });
      await page.waitForTimeout(400);
      await save("rick-and-morty-walked-down");
    }
    await frame(() => page.locator("[data-world-walk]").click());
    const returned = await state();
    assert.equal(returned.walk.active, false);
    assert.equal(returned.walkPresence.active, false);
    assert.equal(returned.walkPresence.sourceHidden, false);
    assert.deepEqual(errors, []);
    receipt.passed = true;
  } catch (error) {
    receipt.failure = error.stack;
    try {
      await page.screenshot({ path: path.join(out, `${id}-failure-${variant}.png`) });
    } catch {}
    throw error;
  } finally {
    await context.close();
  }
}

async function main() {
  await fs.mkdir(out, { recursive: true });
  const moduleBytes = overlay ? await fs.readFile(path.join(process.cwd(), "assets/js/home-scene/walk-presence.mjs")) : null;
  if (moduleBytes) report.overlaySha256 = crypto.createHash("sha256").update(moduleBytes).digest("hex");
  const browser = await chromium.launch({
    headless: true,
    args: process.platform === "win32" ? ["--use-angle=d3d11", "--ignore-gpu-blocklist"] : [],
  });
  try {
    await runViewport(browser, "desktop", { width: 1440, height: 1000 }, false, moduleBytes);
    await runViewport(browser, "mobile", { width: 390, height: 1000 }, true, moduleBytes);
    report.passed = true;
    console.log("HEAD_EXCLUSION_HOUSE_PASS", variant);
  } catch (error) {
    report.failure = error.stack;
    console.error(error);
    process.exitCode = 1;
  } finally {
    await fs.writeFile(path.join(out, `evidence-${variant}.json`), JSON.stringify(report, null, 2));
    await browser.close();
  }
}
main();
