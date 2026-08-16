const path = require("path");

if (!process.env.VISUAL_ROUTE_IDS?.trim()) {
  throw new Error("Set VISUAL_ROUTE_IDS to one or more comma-separated route ids before running test:visual:checkpoint.");
}

process.env.NO_WEBSERVER = "1";
process.env.VISUAL_BASE_URL ||= "http://127.0.0.1:4101";
process.env.VISUAL_THEMES ||= "light,dark";

const publicConfig = require("./public.config");

module.exports = {
  ...publicConfig,
  testMatch: ["sitewide.spec.js"],
  workers: 1,
  reporter: "line",
  outputDir: path.resolve(__dirname, "../..", ".jekyll-cache", "visual-qa", "checkpoint"),
  webServer: undefined,
};
