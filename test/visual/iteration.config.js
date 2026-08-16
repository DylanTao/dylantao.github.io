const path = require("path");

process.env.NO_WEBSERVER = "1";
process.env.VISUAL_BASE_URL ||= "http://127.0.0.1:4101";
process.env.VISUAL_ROUTE_IDS ||= "home";

if (process.env.VISUAL_ROUTE_IDS.includes(",")) {
  throw new Error("test:visual:iterate accepts exactly one VISUAL_ROUTE_IDS value.");
}

const viewportValue = process.env.VISUAL_VIEWPORT || "1440x1000";
const viewportMatch = viewportValue.match(/^(\d{3,4})x(\d{3,4})$/);
if (!viewportMatch) {
  throw new Error(`VISUAL_VIEWPORT must look like 1440x1000; received "${viewportValue}".`);
}

const viewport = { width: Number(viewportMatch[1]), height: Number(viewportMatch[2]) };
const outputTag = (process.env.VISUAL_OUTPUT_TAG || "current").replace(/[^a-z0-9_-]+/gi, "-");

module.exports = {
  testDir: __dirname,
  testMatch: ["iteration.spec.js"],
  globalTimeout: 60000,
  timeout: 45000,
  expect: { timeout: 7000 },
  workers: 1,
  reporter: "line",
  preserveOutput: "always",
  outputDir: path.resolve(__dirname, "../..", ".jekyll-cache", "visual-qa", `iteration-${outputTag}`),
  use: {
    baseURL: process.env.VISUAL_BASE_URL,
    browserName: "chromium",
    deviceScaleFactor: 1,
    locale: "en-US",
    screenshot: "only-on-failure",
    timezoneId: "America/Los_Angeles",
    trace: "off",
    viewport,
  },
};
