const fs = require("node:fs/promises");
const path = require("node:path");
const { createHash } = require("node:crypto");
const digest = (value) => createHash("sha256").update(value).digest("hex");
function sorted(value) {
  if (Array.isArray(value)) return value.map(sorted);
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, sorted(value[key])])
    );
  return value;
}
const encode = (value) => JSON.stringify(sorted(value));
async function coastalLightInputs(root) {
  const manifest = JSON.parse(await fs.readFile(path.join(root, "assets/models/home/manifest.json"), "utf8"));
  delete manifest.staticLightFieldCache;
  const files = [
    "_plugins/site_module_assets.rb",
    "Gemfile.lock",
    "assets/js/home-scene/static-light-field.mjs",
    "assets/js/home-scene/light-trace-core.mjs",
    "assets/js/home-scene/controller.mjs",
    "assets/js/home-scene/materials.mjs",
    "assets/js/home-scene/realism.mjs",
    "assets/js/home-scene/warm-practicals.mjs",
    "assets/js/home-scene/light-installations.mjs",
    "assets/js/home-scene/furniture.mjs",
    "assets/js/home-scene/coastal-wind.mjs",
    "assets/js/home-scene/model-loader.mjs",
    "assets/js/three.module.min.js",
  ];
  async function loaderFiles(directory) {
    for (const entry of await fs.readdir(path.join(root, directory), { withFileTypes: true })) {
      const filename = `${directory}/${entry.name}`;
      if (entry.isDirectory()) await loaderFiles(filename);
      else if (/\.(js|wasm)$/.test(entry.name)) files.push(filename);
    }
  }
  await loaderFiles("assets/js/vendor/three-r164");
  for (const directory of ["assets/models/home", "assets/models/home/furniture"])
    for (const name of await fs.readdir(path.join(root, directory)))
      if (name.endsWith(".glb") || (directory.endsWith("/furniture") && name === "index.json")) files.push(`${directory}/${name}`);
  const dependencies = {};
  for (const file of files.sort()) {
    const content = await fs.readFile(path.join(root, file));
    // Git's Windows CRLF checkout must bind to the same source as Linux CI.
    dependencies[file] = digest(/\.(glb|wasm)$/.test(file) ? content : content.toString("utf8").replace(/\r\n/g, "\n"));
  }
  const inputs = { version: 1, manifestSha256: digest(encode(manifest)), dependencies };
  return { manifest, inputs, signature: digest(encode(inputs)) };
}
module.exports = { coastalLightInputs, digest };
