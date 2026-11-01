const fs = require("node:fs"),
  path = require("node:path"),
  { spawnSync } = require("node:child_process");
const { startSceneEnvironment } = require("/work/bin/visual_scene_environment.cjs");
(async () => {
  const folder = "/work/.jekyll-cache/visual-qa/gym-pad-timing-20261101/docker-qualified";
  fs.mkdirSync(folder, { recursive: true });
  const e = await startSceneEnvironment(folder);
  try {
    const result = spawnSync(
      process.execPath,
      [
        "node_modules/@playwright/test/cli.js",
        "test",
        "--config",
        ".jekyll-cache/visual-qa/house-final-2026-10-28/qualified.config.cjs",
        "test/visual/desk-scene.spec.js",
        "--grep",
        "the training dialog releases held walk input",
        "--project",
        "desktop-1440",
        "--workers",
        "1",
        "--reporter",
        "list",
        "--output",
        folder + "/results",
      ],
      { env: e.env, stdio: "inherit" }
    );
    if (result.error) throw result.error;
    process.exitCode = result.status ?? 1;
  } finally {
    await e.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
