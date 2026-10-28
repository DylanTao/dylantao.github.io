const path = require("node:path");
const base = require("./public.config");
module.exports = {
  ...base,
  testMatch: ["architecture-finish.spec.js"],
  workers: 1,
  use: { ...base.use, actionTimeout: 30000 },
  outputDir: path.resolve(__dirname, "../../.jekyll-cache/visual-qa/finish-house-2026-10-26/playwright"),
};
