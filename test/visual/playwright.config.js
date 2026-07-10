const path = require("path");
const { devices } = require("@playwright/test");
const { getPublicBaseURL, getVisualPort, usesExternalVisualServer } = require("./public-routes");

const repoRoot = path.resolve(__dirname, "../..");
const baseURL = getPublicBaseURL();
const visualPort = getVisualPort();

const webServer = usesExternalVisualServer()
  ? undefined
  : {
      command: `bundle exec jekyll serve --host 127.0.0.1 --port ${visualPort} --baseurl /al-folio --quiet`,
      cwd: repoRoot,
      url: `${baseURL}/`,
      reuseExistingServer: process.env.VISUAL_REUSE_SERVER === "1",
      timeout: 300000,
    };

module.exports = {
  testDir: __dirname,
  testMatch: ["parity.spec.js", "interactions.spec.js", "distill.spec.js"],
  outputDir: path.join(repoRoot, "test-results", "legacy-visual"),
  timeout: 120000,
  expect: {
    timeout: 10000,
    toHaveScreenshot: {
      animations: "disabled",
      fullPage: true,
      maxDiffPixelRatio: 0.02,
    },
  },
  use: {
    baseURL,
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  webServer,
  projects: [
    {
      name: "desktop",
      use: {
        viewport: { width: 1366, height: 1800 },
      },
    },
    {
      name: "mobile",
      use: {
        ...devices["iPhone 12"],
      },
    },
  ],
};
