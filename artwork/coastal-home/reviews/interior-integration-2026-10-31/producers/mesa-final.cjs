const fs = require("node:fs"),
  path = require("node:path"),
  { spawn } = require("node:child_process");
const { startSceneEnvironment } = require("../../../bin/visual_scene_environment.cjs");
(async () => {
  const folder = path.resolve(".jekyll-cache/visual-qa/interior-integration-20261031/mesa-final");
  fs.mkdirSync(folder, { recursive: true });
  const owned = await startSceneEnvironment(folder);
  const preview = await require("../pc-camera-audit-20261029/loopback-proxy.cjs").startLoopbackPreview(4161);
  try {
    for (const [project, grep, files] of [
      ["desktop-1440", "public desktop turn|reduced-motion page fallback", ["desk-scene.spec.js", "loading-drawing.spec.js"]],
      ["mobile-390", "Walk mode on a touch screen", ["desk-scene.spec.js"]],
      ["tablet-768", "denied permission preserves", ["footer-coast.spec.js"]],
    ]) {
      const child = spawn(
        process.execPath,
        [
          "node_modules/@playwright/test/cli.js",
          "test",
          "--config",
          ".jekyll-cache/visual-qa/house-final-2026-10-28/qualified.config.cjs",
          "--workers",
          "1",
          "--grep",
          grep,
          ...files,
          "--project",
          project,
          "--reporter",
          "line",
          "--output",
          path.join(folder, project),
        ],
        { env: { ...owned.env, NO_WEBSERVER: "1", VISUAL_BASE_URL: preview.baseURL }, stdio: "inherit" }
      );
      const code = await new Promise((resolve, reject) => {
        child.on("error", reject);
        child.on("exit", resolve);
      });
      if (code) {
        process.exitCode = code;
        break;
      }
    }
  } finally {
    await preview.close();
    await owned.close();
  }
})().catch((e) => {
  process.stderr.write(e.stack + "\n");
  process.exitCode = 1;
});
