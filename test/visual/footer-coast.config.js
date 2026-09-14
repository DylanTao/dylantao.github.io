const config = require("./public.config");
module.exports = {
  ...config,
  testMatch: ["footer-coast.spec.js"],
  workers: 1,
  timeout: 60000,
  use: { ...config.use, trace: "off" },
};
