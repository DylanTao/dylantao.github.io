import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import test from "node:test";

const require = createRequire(import.meta.url);
const { manifest, groupPattern, verifyInventory } = require("./visual/scene-groups.cjs");
const { assertSceneBackend, sceneBrowserUse } = require("../bin/visual_scene_environment.cjs");
const project = "desktop-1440";
const fixture = () => {
  const selections = Object.fromEntries(
    Object.entries(manifest.groups).map(([name, members]) => [name, members.map((member) => ({ ...member, project }))])
  );
  return { selections, registry: Object.values(selections).flat() };
};

test("scene selection rejects a newly registered case outside the reviewed roster", () => {
  const { registry, selections } = fixture();
  registry.push({ file: "desk-scene.spec.js", title: "New unassigned scene case", project });
  assert.throws(() => verifyInventory(registry, selections, project), /Scene registry mismatch/);
});

test("scene selection rejects a missing filtered case before browser execution", () => {
  const { registry, selections } = fixture();
  selections["scene-live"] = [];
  assert.throws(() => verifyInventory(registry, selections, project), /Scene group mismatch/);
});

test("scene selection rejects duplicate execution of a registered case", () => {
  const { registry, selections } = fixture();
  selections["scene-core-2"].push(selections["scene-core-2"][0]);
  assert.throws(() => verifyInventory(registry, selections, project), /Scene group mismatch/);
});

test("scene selection distinguishes file identity and literal title punctuation", () => {
  const member = manifest.groups["scene-exploration"][0];
  const pattern = groupPattern("scene-exploration");
  assert.equal(pattern.test(`${project} ${member.file} ${member.title}`), true);
  assert.equal(pattern.test(`${project} other.spec.js ${member.title}`), false);
  assert.equal(pattern.test(`${project} ${member.file} ${member.title} extra`), false);
  assert.throws(() => groupPattern("unreviewed-group"), /Unknown scene group/);
});

test("scene backend rejects a silent SwiftShader fallback", () => {
  assert.throws(() => assertSceneBackend({ webgl2: true, renderer: "ANGLE SwiftShader", maxSamples: 4, floatColorBuffer: true }), /qualified Mesa/);
});

test("scene backend rejects missing render target capabilities", () => {
  const backend = { webgl2: true, renderer: "ANGLE Mesa llvmpipe", maxSamples: 4, floatColorBuffer: true };
  assert.doesNotThrow(() => assertSceneBackend(backend));
  for (const capabilities of [{ webgl2: false }, { maxSamples: 0 }, { maxSamples: undefined }, { floatColorBuffer: false }]) {
    assert.throws(() => assertSceneBackend({ ...backend, ...capabilities }));
  }
});

test("scene backend preserves native configuration outside its qualified environment", () => {
  const native = { browserName: "chromium", launchOptions: { args: ["--use-angle=d3d11"] } };
  assert.equal(sceneBrowserUse(native, {}), native);
});

test("legacy Chromium uses the qualified renderer while preserving its WebKit mobile project", () => {
  const result = spawnSync(process.execPath, ["-e", "process.stdout.write(JSON.stringify(require('./test/visual/playwright.config.js').projects))"], {
    cwd: fileURLToPath(new URL("..", import.meta.url)),
    env: { ...process.env, VISUAL_SCENE_BACKEND: "llvmpipe", NO_WEBSERVER: "1", VISUAL_BASE_URL: "http://127.0.0.1:4101" },
    encoding: "utf8",
  });
  assert.equal(result.status, 0, result.stderr);
  const projects = JSON.parse(result.stdout),
    desktop = projects.find((project) => project.name === "desktop"),
    mobile = projects.find((project) => project.name === "mobile");
  assert.equal(projects.length, 2);
  assert.equal(desktop.use.browserName, "chromium");
  assert.equal(desktop.use.channel, "chromium");
  assert.ok(desktop.use.launchOptions.args.includes("--use-angle=gl"));
  assert.deepEqual(desktop.use.viewport, { width: 1366, height: 1800 });
  assert.equal(mobile.use.browserName, "webkit");
  assert.equal(mobile.use.launchOptions, undefined);
  assert.equal(mobile.use.isMobile, true);
});
