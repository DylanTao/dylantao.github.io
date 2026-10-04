const path = require("node:path");
const base = require("./public.config.js");
const { groupPattern } = require("./scene-groups.cjs");
const { sceneBrowserUse } = require("../../bin/visual_scene_environment.cjs");

module.exports = {
  ...base,
  grep: groupPattern(process.env.VISUAL_SCENE_GROUP),
  use: sceneBrowserUse(base.use),
  // Workers reload this configuration without the CLI's spec arguments. The
  // named scene stream must keep raw evidence in its uploaded scene folder.
  outputDir: path.resolve(__dirname, "../../test-results/public-visual-scene"),
};
