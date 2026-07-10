const fs = require("node:fs");
const path = require("node:path");

const root = process.cwd();

const read = (relPath) => fs.readFileSync(path.join(root, relPath), "utf8");
const exists = (relPath) => fs.existsSync(path.join(root, relPath));
const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const failures = [];
const overrideManifestPath = ".al-folio-overrides.yml";
const hasOverrideManifest = exists(overrideManifestPath);

const packageJson = JSON.parse(read("package.json"));
const scripts = packageJson.scripts || {};
for (const forbiddenScript of ["build:css", "build:tailwind", "build:tailwind:watch"]) {
  if (Object.prototype.hasOwnProperty.call(scripts, forbiddenScript)) {
    failures.push(`Starter package.json must not define \`${forbiddenScript}\`; build ownership belongs to gem repos.`);
  }
}

const publicVisualOutputs = {
  "test:visual:site": "test-results/public-visual-site",
  "test:visual:scene": "test-results/public-visual-scene",
};
for (const [scriptName, outputPath] of Object.entries(publicVisualOutputs)) {
  if (!scripts[scriptName]?.includes(`--output=${outputPath}`)) {
    failures.push(`\`package.json\` script \`${scriptName}\` must preserve evidence in \`${outputPath}\`.`);
  }
}

const config = read("_config.yml");
if (!/^\s*theme:\s*al_folio_core\s*$/m.test(config)) {
  failures.push("`_config.yml` must keep `theme: al_folio_core` for thin-starter wiring.");
}
if (!/^\s*-\s*al_folio_core\s*$/m.test(config)) {
  failures.push("`_config.yml` plugins must include `al_folio_core`.");
}
if (!/^\s*-\s*al_folio_distill\s*$/m.test(config)) {
  failures.push("`_config.yml` plugins must include `al_folio_distill` (distill is plugin-owned).");
}
if (!/^\s*-\s*al_cookie\s*$/m.test(config)) {
  failures.push("`_config.yml` plugins must include `al_cookie` (cookie consent is plugin-owned).");
}
if (!/^\s*-\s*al_icons\s*$/m.test(config)) {
  failures.push("`_config.yml` plugins must include `al_icons` (icon runtime is plugin-owned).");
}
if (!/^\s*-\s*al_math\s*$/m.test(config)) {
  failures.push("`_config.yml` plugins must include `al_math` when math features are enabled.");
}

for (const libraryKey of ["fontawesome", "academicons", "scholar-icons"]) {
  if (!new RegExp(`^\\s{2}${escapeRegExp(libraryKey)}:\\s*$`, "m").test(config)) {
    failures.push(`\`_config.yml\` must define \`third_party_libraries.${libraryKey}\` for al_icons runtime wiring.`);
    continue;
  }
  if (!new RegExp(`^\\s{2}${escapeRegExp(libraryKey)}:[\\s\\S]*?^\\s{4}integrity:\\s*$[\\s\\S]*?^\\s{6}css:\\s*\"sha`, "m").test(config)) {
    failures.push(`\`_config.yml\` should define an SRI hash for \`third_party_libraries.${libraryKey}.integrity.css\`.`);
  }
}

for (const libraryKey of ["tikzjax", "tocbot"]) {
  if (!new RegExp(`^\\s{2}${escapeRegExp(libraryKey)}:\\s*$`, "m").test(config)) {
    failures.push(`\`_config.yml\` must define \`third_party_libraries.${libraryKey}\` for v1 runtime contracts.`);
  }
}

const gemfile = read("Gemfile");
if (!/gem 'al_math', '= 1\.0\.1'/.test(gemfile)) {
  failures.push("`Gemfile` should pin `al_math` to released version `1.0.1`.");
}
if (/gem 'al_math',\s*:git =>/.test(gemfile)) {
  failures.push("`Gemfile` must not use git-branch pin for `al_math`; use released gem version.");
}

const pluginOwnedLocalPaths = [
  "_includes",
  "_layouts",
  "_sass",
  "_scripts",
  "assets/tailwind",
  "tailwind.config.js",
  "assets/webfonts",
  "assets/fonts/academicons.woff",
  "assets/fonts/academicons.ttf",
  "assets/fonts/scholar-icons.woff",
  "assets/fonts/scholar-icons.ttf",
];
const presentPluginOwnedPaths = pluginOwnedLocalPaths.filter(exists);
if (presentPluginOwnedPaths.length > 0 && !hasOverrideManifest) {
  failures.push(
    `Customized forks with local plugin-owned overrides must commit \`${overrideManifestPath}\`; run \`bundle exec al-folio upgrade overrides accept --all\` after reviewing the overrides.`
  );
  for (const localPath of presentPluginOwnedPaths) {
    failures.push(
      `Starter must not own core component path \`${localPath}\`; move ownership to the corresponding gem or acknowledge the local override.`
    );
  }
}

if (hasOverrideManifest && !/^version:\s*1\s*$/m.test(read(overrideManifestPath))) {
  failures.push(`\`${overrideManifestPath}\` must declare override manifest \`version: 1\`.`);
}

for (const requiredPath of ["test/visual", "test/integration_plugin_toggles.sh", "test/integration_distill.sh"]) {
  if (!exists(requiredPath)) {
    failures.push(`Starter integration/visual contract missing required path: \`${requiredPath}\`.`);
  }
}

const visualWorkflow = read(".github/workflows/visual-regression.yml");
const publicVisualConfig = read("test/visual/public.config.js");
const legacyVisualConfig = read("test/visual/playwright.config.js");
const browserInstallCommand = visualWorkflow.match(/^\s*run:\s*npx playwright install --with-deps ([^\r\n]+)$/m);
if (!browserInstallCommand) {
  failures.push("Visual regression workflow must install the Playwright browsers used by its projects.");
} else {
  for (const requiredBrowser of ["chromium", "webkit"]) {
    if (!new RegExp(`\\b${requiredBrowser}\\b`).test(browserInstallCommand[1])) {
      failures.push(`Visual regression workflow must install Playwright ${requiredBrowser}.`);
    }
  }
}

if (!publicVisualConfig.includes("`public-visual-${suiteName}`")) {
  failures.push("Public visual config must isolate direct-run output by suite name.");
}

for (const browserName of ["chromium", "webkit"]) {
  if (!legacyVisualConfig.includes(`browserName: "${browserName}"`)) {
    failures.push(`Legacy interaction projects must exercise installed browser ${browserName}.`);
  }
}

if (!legacyVisualConfig.includes("workers: process.env.CI ? 1 : 2")) {
  failures.push("Mixed-engine legacy interactions must serialize CI workers for deterministic evidence.");
}

for (const outputPath of Object.values(publicVisualOutputs)) {
  if (!visualWorkflow.includes(outputPath)) {
    failures.push(`Visual regression workflow must upload \`${outputPath}\`.`);
  }
}

if (failures.length > 0) {
  console.error("Starter style contract check failed:");
  failures.forEach((message) => console.error(`- ${message}`));
  process.exit(1);
}

console.log("Starter style contract check passed.");
