const base = require("./public.config.js");
const { groupPattern } = require("./scene-groups.cjs");

module.exports = { ...base, grep: groupPattern(process.env.VISUAL_SCENE_GROUP) };
