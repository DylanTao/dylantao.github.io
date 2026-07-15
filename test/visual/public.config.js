const path = require("path");
const { devices } = require("@playwright/test");
const { getPublicBaseURL, getVisualPort, usesExternalVisualServer } = require("./public-routes");

const repoRoot = path.resolve(__dirname, "../..");
const baseURL = getPublicBaseURL();
const visualPort = getVisualPort();
const suiteName = process.argv.some((argument) => argument.includes("desk-scene.spec.js"))
  ? "scene"
  : process.argv.some((argument) => argument.includes("sitewide.spec.js"))
    ? "site"
    : "combined";

const webServer = usesExternalVisualServer()
  ? undefined
  : {
      command: `bundle exec jekyll serve --host 127.0.0.1 --port ${visualPort} --baseurl /al-folio --trace --no-watch`,
      cwd: repoRoot,
      url: `${baseURL.replace(/\/$/, "")}/`,
      reuseExistingServer: process.env.VISUAL_REUSE_SERVER === "1",
      stdout: "pipe",
      stderr: "pipe",
      timeout: 600000,
    };

module.exports = {
  testDir: __dirname,
  testMatch: ["sitewide.spec.js", "paper-constellation.spec.js", "desk-scene.spec.js"],
  timeout: 300000,
  expect: {
    timeout: 15000,
  },
  forbidOnly: Boolean(process.env.CI),
  preserveOutput: "always",
  // GitHub's Linux Chromium runner intermittently rejects screenshots under
  // concurrent capture. package.json also separates site and WebGL runs so
  // each stream receives a fresh browser process.
  workers: process.env.CI ? 1 : 2,
  reporter: process.env.CI
    ? [["line"], ["html", { open: "never", outputFolder: path.join(repoRoot, "playwright-report", `public-${suiteName}`) }]]
    : "line",
  outputDir: path.join(repoRoot, "test-results", `public-visual-${suiteName}`),
  use: {
    baseURL,
    browserName: "chromium",
    deviceScaleFactor: 1,
    locale: "en-US",
    timezoneId: "America/Los_Angeles",
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  webServer,
  projects: [
    {
      name: "desktop-1440",
      use: { viewport: { width: 1440, height: 1000 } },
    },
    {
      name: "laptop-1280",
      use: { viewport: { width: 1280, height: 800 } },
    },
    {
      name: "tablet-768",
      use: { viewport: { width: 768, height: 1024 } },
    },
    {
      name: "mobile-390",
      use: {
        ...devices["Pixel 5"],
        deviceScaleFactor: 1,
        viewport: { width: 390, height: 1000 },
      },
    },
  ],
};
