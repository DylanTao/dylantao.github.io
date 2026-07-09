const path = require("path");
const { devices } = require("@playwright/test");
const { getPublicBaseURL } = require("./public-routes");

const repoRoot = path.resolve(__dirname, "../..");
const baseURL = getPublicBaseURL();

const webServer = process.env.NO_WEBSERVER
  ? undefined
  : {
      command: "bundle exec jekyll serve --host 127.0.0.1 --port 4000 --baseurl /al-folio --trace --no-watch",
      cwd: repoRoot,
      url: `${baseURL.replace(/\/$/, "")}/`,
      reuseExistingServer: !process.env.CI,
      stdout: "pipe",
      stderr: "pipe",
      timeout: 600000,
    };

module.exports = {
  testDir: __dirname,
  testMatch: ["sitewide.spec.js", "desk-scene.spec.js"],
  timeout: 300000,
  expect: {
    timeout: 15000,
  },
  forbidOnly: Boolean(process.env.CI),
  preserveOutput: "always",
  workers: 2,
  reporter: process.env.CI ? [["line"], ["html", { open: "never" }]] : "line",
  outputDir: path.join(repoRoot, "test-results", "public-visual"),
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
