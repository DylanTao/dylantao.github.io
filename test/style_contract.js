const fs = require("node:fs");
const path = require("node:path");

const root = process.cwd();

const read = (relPath) => fs.readFileSync(path.join(root, relPath), "utf8");
const exists = (relPath) => fs.existsSync(path.join(root, relPath));
const walk = (relPath) =>
  fs.readdirSync(path.join(root, relPath), { withFileTypes: true }).flatMap((entry) => {
    const child = path.join(relPath, entry.name);
    return entry.isDirectory() ? walk(child) : [child];
  });
const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const { isExpectedExternalStubIntegrityError } = require("./visual/helpers");

const failures = [];
const overrideManifestPath = ".al-folio-overrides.yml";
const hasOverrideManifest = exists(overrideManifestPath);

const emptyStubSriMetadata = "sha256-MVopmdyC2tYTiJ8wlktf0uh0v4NgT+vNdyVFepi7Q0c=";
const linuxEmptyStubMessages = [
  `Cannot load stylesheet https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@7.2.0/css/all.min.css. Failed integrity metadata check. Content length: (no content), Expected content length: 0, Expected metadata: ${emptyStubSriMetadata}`,
  `Cannot load script https://cdn.jsdelivr.net/npm/masonry-layout@4.2.2/dist/masonry.pkgd.min.js. Failed integrity metadata check. Content length: (no content), Expected content length: 0, Expected metadata: ${emptyStubSriMetadata}`,
];
for (const message of linuxEmptyStubMessages) {
  if (!isExpectedExternalStubIntegrityError(message)) {
    failures.push("Visual error collection must recognize exact Linux WebKit SRI diagnostics for deterministic empty jsDelivr stubs.");
  }
}

for (const message of [
  `Cannot load stylesheet http://127.0.0.1:4000/assets/main.css. Failed integrity metadata check. Content length: (no content), Expected content length: 0, Expected metadata: ${emptyStubSriMetadata}`,
  `Cannot load stylesheet https://cdn.jsdelivr.net/npm/example.css. Failed integrity metadata check. Content length: 10, Expected content length: 0, Expected metadata: ${emptyStubSriMetadata}`,
  `Cannot load stylesheet https://example.com/npm/example.css. Failed integrity metadata check. Content length: (no content), Expected content length: 0, Expected metadata: ${emptyStubSriMetadata}`,
  "Failed to load resource: net::ERR_NETWORK_ACCESS_DENIED",
]) {
  if (isExpectedExternalStubIntegrityError(message)) {
    failures.push("Visual error collection must keep local, nonempty, non-jsDelivr, and generic network failures actionable.");
  }
}

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

if (!config.includes("family=Inter:wght@400;500;600;700&")) {
  failures.push("The site must request exactly the supported Inter narrative weights: 400, 500, 600, and 700.");
}
if (/family=Inter:wght@[^&]*(?:800|900)/.test(config)) {
  failures.push("The site must not load unsupported Inter 800 or 900 weights.");
}

const themes = read("_sass/_themes.scss");
for (const role of ["display", "heading", "reading", "compact"]) {
  if (!new RegExp(`--type-${role}:`).test(themes)) {
    failures.push(`The narrative type system must define \`--type-${role}\`.`);
  }
}
const legacyTypeAliases = {
  label: "compact",
  meta: "compact",
  body: "reading",
  prose: "reading",
  lede: "reading",
  "card-title": "heading",
  "section-title": "heading",
  "page-title": "display",
  "case-title": "display",
};
for (const [legacy, role] of Object.entries(legacyTypeAliases)) {
  if (!new RegExp(`--type-${legacy}:\\s*var\\(--type-${role}\\);`).test(themes)) {
    failures.push(`Legacy type token \`--type-${legacy}\` must remain an alias of \`--type-${role}\` during this release.`);
  }
}

const siteScssFiles = walk("_sass").filter((relPath) => relPath.endsWith(".scss") && !relPath.split(path.sep).includes("font-awesome"));
const allowedInterWeights = new Set(["400", "500", "600", "700"]);
let legacyRawFontSizeDeclarations = 0;
for (const relPath of siteScssFiles) {
  const source = read(relPath);
  for (const match of source.matchAll(/font-weight:\s*([0-9]{3})/g)) {
    if (!allowedInterWeights.has(match[1])) {
      failures.push(`${relPath} uses unsupported numeric font weight ${match[1]}; use 400, 500, 600, or 700.`);
    }
  }
  for (const match of source.matchAll(/font-size:\s*([^;]+);/g)) {
    const value = match[1].trim();
    if (!value.includes("var(--type-") && !["0", "inherit"].includes(value)) {
      legacyRawFontSizeDeclarations += 1;
    }
  }
}
if (legacyRawFontSizeDeclarations > 333) {
  failures.push(
    `Narrative styles added arbitrary font sizes (${legacyRawFontSizeDeclarations} raw declarations; legacy ceiling 333). Use a computed type role instead.`
  );
}
const realignmentFontSizes = Array.from(read("_sass/_realignment.scss").matchAll(/font-size:\s*([^;]+);/g), (match) => match[1].trim());
if (realignmentFontSizes.some((value) => !value.startsWith("var(--type-"))) {
  failures.push("The sitewide realignment layer must use computed type-role variables for every font size.");
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
