import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import vm from "node:vm";

const source = fs.readFileSync(new URL("../assets/js/home.js", import.meta.url), "utf8").replace(/\r\n/g, "\n");
const start = source.indexOf("  const createDeskCornerSceneController = ");
const end = source.indexOf("\n  const portrait = ", start);
assert.ok(start >= 0 && end > start, "exercise the real lazy scene controller");
const importExpression = 'import(new URL("home-scene/controller.mjs", homeScriptBase).href)';
assert.equal(source.slice(start, end).split(importExpression).length, 2, "adapt only the platform module loader");
const factorySource = source.slice(start, end).replace(importExpression, "loadModule()");
const settle = () => new Promise(setImmediate);

function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}

// Adapt DOM, module delivery and the heavyweight controller at their platform
// boundaries. No WebGL, renderer, browser, fake RAF or readiness timing is used.
function probe() {
  const requests = [];
  const instances = [];
  const events = [];
  const listeners = new Map();
  const window = { addEventListener: (type, listener) => listeners.set(type, listener) };
  const attributes = new Map([["aria-hidden", "true"]]);
  const classes = new Set();
  const status = { textContent: "Opening the little home." };
  const view = { disabled: false };
  const ui = {
    hidden: true,
    inert: true,
    querySelector: (selector) => ({ "[data-world-status]": status, "[data-world-view]": view })[selector],
  };
  const container = {
    dataset: {},
    closest: () => ({ querySelector: () => ui }),
    classList: {
      toggle(name, enabled) {
        if (enabled) classes.add(name);
        else classes.delete(name);
      },
    },
    setAttribute: (name, value) => attributes.set(name, value),
    removeAttribute: (name) => attributes.delete(name),
    dispatchEvent: (event) => events.push(event.type),
  };
  const create = vm.runInNewContext(`${factorySource}\ncreateDeskCornerSceneController;`, {
    window,
    loadModule() {
      const request = deferred();
      requests.push(request);
      return request.promise;
    },
    CustomEvent: class {
      constructor(type) {
        this.type = type;
      }
    },
  });
  const records = [{ id: "record" }],
    artifacts = [{ id: "paper" }];
  const scene = create(container, records, artifacts);
  const module = {
    createCoastalHome(actualContainer, actualRecords, actualArtifacts) {
      assert.equal(actualContainer, container);
      assert.equal(actualRecords, records);
      assert.equal(actualArtifacts, artifacts);
      const calls = [];
      const instance = Object.fromEntries(
        [
          "setCallbacks",
          "setActiveRecord",
          "setSpinning",
          "setDroppedRecords",
          "setVisible",
          "setTimePreview",
          "returnToNow",
          "resetView",
          "dispose",
        ].map((name) => [name, (...args) => calls.push({ name, args })])
      );
      instances.push({ instance, calls });
      return instance;
    },
  };
  return { scene, container, status, view, ui, attributes, classes, requests, instances, events, module, window, listeners };
}

test("sun-arc previews survive loading and committed changes retain the Now recovery", async () => {
  const p = probe();
  p.window.siteTime = { preview: 1230 };
  p.scene.setVisible(true);
  p.requests[0].resolve(p.module);
  await settle();
  const calls = p.instances[0].calls;
  assert.deepEqual(Array.from(calls.find((call) => call.name === "setTimePreview").args), [1230]);
  const changeTime = p.listeners.get("siteTimeChange");
  const before = calls.length;
  changeTime({ detail: { preview: 600, committed: false } });
  assert.equal(calls.length, before);
  changeTime({ detail: { preview: 600, committed: true } });
  assert.equal(calls.at(-1).name, "setTimePreview");
  assert.equal(calls.at(-1).args[0], 600);
  changeTime({ detail: { preview: null, committed: true } });
  assert.equal(calls.at(-1).name, "returnToNow");
  p.scene.dispose();
  changeTime({ detail: { preview: 900, committed: true } });
  assert.equal(calls.at(-1).name, "dispose");
});

test("2D and state updates do not request scene code", () => {
  const p = probe();
  p.scene.preload();
  p.scene.setActiveRecord(3);
  p.scene.setSpinning(true);
  p.scene.setDroppedRecords([0]);
  p.scene.setVisible(false);
  assert.equal(p.requests.length, 0);
  assert.equal(p.instances.length, 0);
});

test("module loading immediately exposes truthful, non-animated feedback and keeps ready controls disabled", () => {
  const p = probe();
  p.scene.setVisible(true);
  assert.equal(p.requests.length, 1);
  assert.equal(p.container.dataset.sceneState, "loading");
  assert.equal(p.container.dataset.loadingStage, "modules");
  assert.equal(p.attributes.get("aria-busy"), "true");
  assert.equal(p.attributes.get("aria-hidden"), "false");
  assert.ok(p.classes.has("is-visible"));
  assert.equal(p.ui.hidden, false);
  assert.equal(p.ui.inert, false);
  assert.equal(p.status.textContent, "Opening the 3D scene.");
  assert.equal(p.view.disabled, true);
  assert.equal(p.instances.length, 0);
});

test("returning to 2D before module delivery does not create a hidden world", async () => {
  const p = probe();
  p.scene.setVisible(true);
  p.scene.setVisible(false);
  assert.equal(p.ui.hidden, true);
  assert.equal(p.ui.inert, true);
  assert.equal(p.attributes.has("aria-busy"), false);
  p.requests[0].resolve(p.module);
  await settle();
  assert.equal(p.instances.length, 0);
  assert.deepEqual(p.events, []);
  p.scene.setVisible(true);
  p.requests[1].resolve(p.module);
  await settle();
  assert.equal(p.instances.length, 1);
});

test("rapid 3D/2D/3D entry shares the pending import and replays latest album state", async () => {
  const p = probe();
  const callbacks = { selectRecord() {} };
  p.scene.setVisible(true);
  p.scene.setVisible(false);
  p.scene.setActiveRecord(2);
  p.scene.setSpinning(true);
  p.scene.setDroppedRecords([0, 1]);
  p.scene.setCallbacks(callbacks);
  p.scene.setVisible(true);
  assert.equal(p.requests.length, 1);
  p.requests[0].resolve(p.module);
  await settle();
  assert.equal(p.instances.length, 1);
  const calls = p.instances[0].calls;
  assert.equal(calls.find((call) => call.name === "setCallbacks").args[0], callbacks);
  assert.equal(calls.find((call) => call.name === "setActiveRecord").args[0], 2);
  assert.equal(calls.find((call) => call.name === "setSpinning").args[0], true);
  assert.deepEqual(Array.from(calls.find((call) => call.name === "setDroppedRecords").args[0]), [0, 1]);
  assert.ok(calls.some((call) => call.name === "setVisible" && call.args[0] === true));
});

test("disposal during module loading prevents a late controller from reviving", async () => {
  const p = probe();
  p.scene.setVisible(true);
  p.scene.dispose();
  assert.equal(p.ui.hidden, true);
  assert.equal(p.attributes.has("aria-busy"), false);
  p.requests[0].resolve(p.module);
  await settle();
  assert.equal(p.instances.length, 0);
  assert.deepEqual(p.events, []);
});

test("late success from a disposed request cannot replace the fresh retry", async () => {
  const p = probe();
  p.scene.setVisible(true);
  p.scene.dispose();
  p.scene.setVisible(true);
  assert.equal(p.requests.length, 2);
  p.requests[1].resolve(p.module);
  await settle();
  const current = p.instances[0];
  p.requests[0].resolve(p.module);
  await settle();
  assert.equal(p.instances.length, 1);
  p.scene.resetView();
  assert.equal(current.calls.at(-1).name, "resetView");
  assert.deepEqual(p.events, []);
});

test("late failure from a disposed request cannot fail the fresh retry", async () => {
  const p = probe();
  p.scene.setVisible(true);
  p.scene.dispose();
  p.scene.setVisible(true);
  p.requests[0].reject(new Error("old code request failed"));
  await settle();
  assert.deepEqual(p.events, []);
  assert.equal(p.container.dataset.loadingStage, "modules");
  p.requests[1].resolve(p.module);
  await settle();
  assert.equal(p.instances.length, 1);
});

test("a cancelled hidden request does not emit a visible failure and can retry", async () => {
  const p = probe();
  p.scene.setVisible(true);
  p.scene.setVisible(false);
  p.requests[0].reject(new Error("cancelled code request failed"));
  await settle();
  assert.deepEqual(p.events, []);
  p.scene.setVisible(true);
  p.requests[1].resolve(p.module);
  await settle();
  assert.equal(p.instances.length, 1);
});

test("a current module failure clears busy state, emits recovery once and allows retry", async () => {
  const p = probe();
  p.scene.setVisible(true);
  p.requests[0].reject(new Error("code unavailable"));
  await settle();
  assert.deepEqual(p.events, ["home-scene-unavailable"]);
  assert.equal(p.container.dataset.sceneState, "failed");
  assert.equal(p.container.dataset.loadingStage, "failed");
  assert.equal(p.attributes.has("aria-busy"), false);
  assert.equal(p.status.textContent, "3D couldn’t load. The 2D desk is ready.");
  p.scene.setVisible(false);
  p.scene.dispose();
  p.scene.setVisible(true);
  p.requests[1].resolve(p.module);
  await settle();
  assert.equal(p.instances.length, 1);
});

test("a constructor failure follows the same recovery path without retaining a controller", async () => {
  const p = probe();
  p.scene.setVisible(true);
  p.requests[0].resolve({
    createCoastalHome() {
      throw new Error("scene setup unavailable");
    },
  });
  await settle();
  assert.deepEqual(p.events, ["home-scene-unavailable"]);
  p.scene.dispose();
  p.scene.setVisible(true);
  p.requests[1].resolve(p.module);
  await settle();
  assert.equal(p.instances.length, 1);
});

test("ready controller reuse preserves readiness and disposal retains shared album state", async () => {
  const p = probe();
  p.scene.setActiveRecord(4);
  p.scene.setSpinning(true);
  p.scene.setDroppedRecords([1]);
  p.scene.setVisible(true);
  p.requests[0].resolve(p.module);
  await settle();
  p.container.dataset.sceneState = "ready";
  p.container.dataset.loadingStage = "ready";
  p.attributes.delete("aria-busy");
  p.status.textContent = "Working in the study.";
  p.view.disabled = false;
  p.scene.setVisible(false);
  p.scene.setVisible(true);
  await settle();
  assert.equal(p.requests.length, 1);
  assert.equal(p.instances.length, 1);
  assert.equal(p.container.dataset.sceneState, "ready");
  assert.equal(p.status.textContent, "Working in the study.");
  assert.equal(p.view.disabled, false);
  p.scene.dispose();
  assert.equal(p.instances[0].calls.filter((call) => call.name === "dispose").length, 1);
  p.scene.setVisible(true);
  p.requests[1].resolve(p.module);
  await settle();
  const calls = p.instances[1].calls;
  assert.equal(calls.find((call) => call.name === "setActiveRecord").args[0], 4);
  assert.equal(calls.find((call) => call.name === "setSpinning").args[0], true);
  assert.deepEqual(Array.from(calls.find((call) => call.name === "setDroppedRecords").args[0]), [1]);
});
