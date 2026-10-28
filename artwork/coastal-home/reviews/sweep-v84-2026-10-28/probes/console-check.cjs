const { chromium } = require("playwright"),
  fs = require("node:fs/promises"),
  path = require("node:path");
const { preparePage, collectRuntimeErrors } = require(path.join(process.cwd(), "test/visual/helpers"));
const Q = path.join(process.cwd(), ".jekyll-cache/visual-qa/sweep-2026-10-28");
(async () => {
  const b = await chromium.launch({ args: ["--use-angle=d3d11", "--ignore-gpu-blocklist"] });
  try {
    const p = await b.newPage({ viewport: { width: 1440, height: 1000 }, reducedMotion: "reduce" });
    const errors = collectRuntimeErrors(p),
      rawConsole = [];
    p.on("console", (m) => {
      if (["error", "warning"].includes(m.type())) rawConsole.push({ type: m.type(), text: m.text() });
    });
    await preparePage(p, "light");
    await p.clock.setFixedTime(new Date("2026-10-26T14:00:00-07:00"));
    await p.goto("http://127.0.0.1:4118/al-folio/?scene-lab=1&quality=high&resolution=fixed");
    await p.locator('[data-home-desk-mode="3d"]').click();
    const scene = p.locator("[data-home-desk-scene]"),
      ui = p.locator("[data-home-world-controls]");
    await scene.scrollIntoViewIfNeeded();
    await p.waitForFunction(() => document.querySelector("[data-home-desk-scene]")?.dataset.sceneState === "ready", null, { timeout: 180000 });
    await ui.locator("[data-world-fullscreen]").click();
    await ui.locator("[data-world-lab] > summary").click();
    await ui.locator('[data-world-room="lounge"]').click();
    await ui.locator("[data-world-lab] > summary").click();
    await p.waitForTimeout(500);
    const records = [];
    for (const id of ["lounge", "library-upper", "onsen"]) {
      await ui.locator("[data-world-lab] > summary").click();
      await ui.locator('[data-world-room="' + id + '"]').click();
      await ui.locator("[data-world-lab] > summary").click();
      await p.waitForTimeout(450);
      const a = await scene.evaluate((e) => e.getSceneEvidence());
      records.push({ room: a.currentRoom, ready: a.ready, arm: a.cameraArm, cache: a.loading.lightCache, lightField: a.simulation.lightField.ready });
    }
    const result = {
      scope:
        "Representative complete frozen family at desktop: normal collector filters only its documented external-stub errors; raw error/warning console is retained separately.",
      records,
      errors,
      rawConsole,
    };
    await fs.writeFile(path.join(Q, "console-check.json"), JSON.stringify(result, null, 2) + "\n");
    console.log(JSON.stringify(result, null, 2));
  } finally {
    await b.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
