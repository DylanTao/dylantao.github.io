const path = require("node:path");
const root = path.resolve(__dirname, "../../../..");
const base = require(path.join(root, "test/visual/public.config.js"));

module.exports = {
  ...base,
  testDir: path.join(root, "test/visual"),
  webServer: undefined,
  workers: 1,
  use: { ...base.use, browserName: "webkit", launchOptions: {} },
  projects: [{ name: "mobile-390", use: { viewport: { width: 390, height: 1000 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true } }],
  outputDir: path.join(root, ".jekyll-cache/visual-qa/generative-coffee-2026-10-28/webkit-results"),
};
