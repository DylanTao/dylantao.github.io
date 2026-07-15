const path = require("path");
const publicConfig = require("./public.config");

module.exports = {
  ...publicConfig,
  testMatch: ["build-rhythm-story.spec.js"],
  workers: 1,
  reporter: "line",
  outputDir: path.resolve(__dirname, "../../test-results/build-rhythm-story"),
};
