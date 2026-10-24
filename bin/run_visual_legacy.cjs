const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const { startSceneEnvironment } = require("./visual_scene_environment.cjs");

const root = path.resolve(__dirname, "..");
const cli = path.join(path.dirname(require.resolve("playwright/package.json")), "cli.js");
const folder = path.join(root, "test-results", `legacy-environment-${process.pid}`);

(async () => {
  fs.mkdirSync(folder, { recursive: true });
  const environment = await startSceneEnvironment(folder);
  try {
    const result = spawnSync(process.execPath, [cli, "test", "--config", "test/visual/playwright.config.js", ...process.argv.slice(2)], {
      cwd: root,
      env: environment.env,
      stdio: "inherit",
    });
    if (result.error) throw result.error;
    process.exitCode = result.status ?? 1;
  } finally {
    await environment.close();
  }
})().catch((error) => {
  process.stderr.write(String(error.stack || error) + "\n");
  process.exitCode = 1;
});
