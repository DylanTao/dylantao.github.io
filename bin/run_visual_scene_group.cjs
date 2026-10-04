const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const { manifest, groupPattern, registeredCases, verifyInventory } = require("../test/visual/scene-groups.cjs");
const { startSceneEnvironment } = require("./visual_scene_environment.cjs");

const root = path.resolve(__dirname, "..");
const cli = path.join(path.dirname(require.resolve("playwright/package.json")), "cli.js");
const projects = ["desktop-1440", "laptop-1280", "tablet-768", "mobile-390"];
const [group, ...options] = process.argv.slice(2);
groupPattern(group);
let project;
let verifyOnly = false;
const runOptions = [];
for (let index = 0; index < options.length; index++) {
  const option = options[index];
  if (option === "--verify-only") {
    verifyOnly = true;
    continue;
  }
  const match = option.match(/^--(project|workers|max-failures|reporter|output)(?:=(.*))?$/);
  if (!match) throw new Error(`Unsupported scene group option: ${option}`);
  const [, name, inline] = match;
  const value = inline ?? options[++index];
  if (!value || value.startsWith("--")) throw new Error(`Missing value for --${name}`);
  if (name === "project") project = value;
  else if (name === "workers") {
    if (value !== "1") throw new Error("Scene groups require one browser worker");
  } else runOptions.push(`--${name}`, value);
}
if (!projects.includes(project) && !(verifyOnly && project === "all")) throw new Error("Select one standard viewport with --project");

const folder = path.join(root, "test-results/scene-group-inventory", `${project}-${group}-${process.pid}`);
fs.mkdirSync(folder, { recursive: true });
const scope = project === "all" ? [] : ["--project", project];
function enumerate(name) {
  const config = name ? "test/visual/scene-groups.config.cjs" : "test/visual/public.config.js";
  const args = [
    cli,
    "test",
    "--config",
    config,
    ...scope,
    "--fully-parallel",
    "--workers=1",
    "--list",
    "--reporter=json",
    "--output",
    path.join(folder, name || "unfiltered", "output"),
    ...manifest.manifestOrder,
  ];
  // A caller's delivery reporter file must not swallow enumeration JSON.
  const env = { ...process.env, VISUAL_SCENE_GROUP: name || "" };
  delete env.PLAYWRIGHT_JSON_OUTPUT_FILE;
  delete env.PLAYWRIGHT_JSON_OUTPUT_NAME;
  const result = spawnSync(process.execPath, args, { cwd: root, env, encoding: "utf8", maxBuffer: 16 * 1024 * 1024 });
  fs.writeFileSync(path.join(folder, `${name || "unfiltered"}.json`), result.stdout || "");
  fs.writeFileSync(path.join(folder, `${name || "unfiltered"}.stderr.log`), result.stderr || "");
  if (result.error || result.status !== 0)
    throw result.error || new Error(`Playwright registration failed for ${name || "unfiltered"}: ${result.stderr}`);
  return registeredCases(JSON.parse(result.stdout));
}

const registry = enumerate();
const selections = Object.fromEntries(Object.keys(manifest.groups).map((name) => [name, enumerate(name)]));
const coverage = (project === "all" ? projects : [project]).map((name) => verifyInventory(registry, selections, name));
const receipt = {
  reviewedManifestHead: manifest.head,
  coverage,
  workerCount: 1,
  selection: "Exact file/title membership; actual Playwright registry",
  inventoryFolder: folder,
};
fs.writeFileSync(path.join(folder, "coverage.json"), JSON.stringify(receipt, null, 2) + "\n");
process.stdout.write(JSON.stringify(receipt) + "\n");
if (!verifyOnly) {
  (async () => {
    const environment = await startSceneEnvironment(folder);
    try {
      const result = spawnSync(
        process.execPath,
        [
          cli,
          "test",
          "--config",
          "test/visual/scene-groups.config.cjs",
          "--project",
          project,
          "--fully-parallel",
          "--workers=1",
          ...runOptions,
          ...manifest.manifestOrder,
        ],
        { cwd: root, env: { ...environment.env, VISUAL_SCENE_GROUP: group }, stdio: "inherit" }
      );
      if (result.error) throw result.error;
      process.exitCode = result.status ?? 1;
    } finally {
      await environment.close();
    }
  })().catch((error) => {
    process.stderr.write(String(error.stack || error) + "\n");
    process.exitCode = 1;
  });
}
