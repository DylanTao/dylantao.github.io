import test from "node:test";
import assert from "node:assert/strict";
import { createViewTilt, relativeTilt, screenGravity } from "../assets/js/footer-coast/view-tilt.mjs";

const near = (actual, expected, epsilon = 1e-9) => assert.ok(Math.abs(actual - expected) < epsilon, `${actual} ≈ ${expected}`);
const vectorNear = (actual, expected) => {
  for (const key of ["x", "y", "z"]) near(actual[key], expected[key]);
};
const flush = async () => {
  await Promise.resolve();
  await Promise.resolve();
};

class Target {
  listeners = new Map();
  attributes = new Map();
  textContent = "";
  addEventListener(type, listener) {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type).add(listener);
  }
  removeEventListener(type, listener) {
    this.listeners.get(type)?.delete(listener);
  }
  emit(type, data = {}) {
    for (const listener of this.listeners.get(type) || []) listener({ type, ...data });
  }
  setAttribute(key, value) {
    this.attributes.set(key, value);
  }
  count(type) {
    return this.listeners.get(type)?.size || 0;
  }
}

function fixture({ permission = "granted", request = true, secure = true, touch = true, orientation = true } = {}) {
  const scope = new Target(),
    doc = new Target(),
    button = new Target(),
    status = new Target(),
    samples = [],
    timers = new Map();
  let requests = 0,
    timerId = 0;
  scope.isSecureContext = secure;
  scope.navigator = { maxTouchPoints: touch ? 5 : 0 };
  scope.matchMedia = () => ({ matches: touch });
  scope.screen = { orientation: Object.assign(new Target(), { angle: 0 }) };
  scope.DeviceOrientationEvent = orientation ? class {} : undefined;
  if (orientation && request)
    scope.DeviceOrientationEvent.requestPermission = () => {
      requests++;
      return typeof permission === "function" ? permission() : Promise.resolve(permission);
    };
  scope.setTimeout = (callback) => {
    timers.set(++timerId, callback);
    return timerId;
  };
  scope.clearTimeout = (id) => timers.delete(id);
  doc.hidden = false;
  const controller = createViewTilt({ button, status, window: scope, document: doc, onChange: (value) => samples.push(value) });
  return {
    scope,
    doc,
    button,
    status,
    samples,
    timers,
    controller,
    requests: () => requests,
    last: () => samples.at(-1),
    sample: (beta = 45, gamma = 0) => scope.emit("deviceorientation", { beta, gamma }),
    timeout: () => {
      const due = [...timers.values()];
      timers.clear();
      for (const callback of due) callback();
    },
    enable: async () => {
      controller.setActive(true);
      button.emit("click");
      await flush();
    },
  };
}

test("gravity is normalized, screen relative, and independent of compass heading", () => {
  const portrait = screenGravity({ beta: 30, gamma: 20, alpha: 0 });
  near(Math.hypot(portrait.x, portrait.y, portrait.z), 1);
  vectorNear(portrait, screenGravity({ beta: 30, gamma: 20, alpha: 246 }));
  vectorNear(screenGravity({ beta: 30, gamma: 20 }, 90), { x: portrait.y, y: -portrait.x, z: portrait.z });
  vectorNear(screenGravity({ beta: 30, gamma: 20 }, -90), { x: -portrait.y, y: portrait.x, z: portrait.z });
  vectorNear(screenGravity({ beta: 30, gamma: 20 }, 450), screenGravity({ beta: 30, gamma: 20 }, 90));
  vectorNear(screenGravity({ beta: 30, gamma: 20 }, 180), { x: -portrait.x, y: -portrait.y, z: portrait.z });
});

test("missing, nonnumeric, or out-of-range sensor values never become movement", () => {
  for (const reading of [
    {},
    { beta: null, gamma: 0 },
    { beta: 0, gamma: null },
    { beta: NaN, gamma: 0 },
    { beta: 0, gamma: Infinity },
    { beta: "2", gamma: 0 },
    { beta: 181, gamma: 0 },
    { beta: 0, gamma: -91 },
  ])
    assert.equal(screenGravity(reading), null);
  assert.equal(screenGravity({ beta: 0, gamma: 0 }, NaN), null);
  assert.equal(relativeTilt(null, { x: 0, y: 0, z: 1 }), null);
  assert.equal(relativeTilt({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 1 }), null);
});

test("relative movement has a dead zone, reaches its bound at 18 degrees, and crosses Euler wrap gently", () => {
  const neutral = screenGravity({ beta: 45, gamma: 0 });
  assert.deepEqual(relativeTilt(neutral, neutral), { x: 0, y: 0 });
  near(relativeTilt(neutral, screenGravity({ beta: 45.6, gamma: 0 })).y, 0);
  near(relativeTilt(neutral, screenGravity({ beta: 63, gamma: 0 })).y, 1);
  near(relativeTilt(neutral, screenGravity({ beta: 27, gamma: 0 })).y, -1);
  const wrap = relativeTilt(screenGravity({ beta: 179, gamma: 0 }), screenGravity({ beta: -179, gamma: 0 }));
  assert.ok(Math.abs(wrap.y) < 0.1, "two degrees across the wrap is a small movement");
  for (const angle of [0, 90, 180, 270]) {
    const n = screenGravity({ beta: 0, gamma: 0 }, angle);
    const sample = relativeTilt(n, screenGravity({ beta: 60, gamma: 60 }, angle));
    assert.ok(Number.isFinite(sample.x) && Number.isFinite(sample.y));
    assert.ok(Math.abs(sample.x) <= 1 && Math.abs(sample.y) <= 1);
  }
  assert.ok(Number.isFinite(relativeTilt({ x: 1, y: 0, z: 0 }, { x: 1, y: 0.01, z: 0 }).y));
});

test("mount and visibility alone never ask permission; an explicit tap calibrates before moving", async () => {
  const f = fixture();
  assert.equal(f.requests(), 0);
  f.controller.setActive(true);
  assert.equal(f.requests(), 0);
  assert.equal(f.scope.count("deviceorientation"), 0);
  await f.enable();
  assert.equal(f.requests(), 1);
  assert.equal(f.scope.count("deviceorientation"), 1);
  assert.equal(f.button.attributes.get("aria-pressed"), "true");
  assert.equal(f.controller.evidence().state, "calibrating");
  f.sample(62, 14);
  assert.deepEqual(f.last(), { x: 0, y: 0 });
  assert.equal(f.timers.size, 0);
  assert.equal(f.controller.evidence().state, "on");
  f.sample(72, 26);
  assert.ok(Math.abs(f.last().x) + Math.abs(f.last().y) > 0.2);
  f.button.emit("click");
  assert.equal(f.scope.count("deviceorientation"), 0);
  assert.deepEqual(f.last(), { x: 0, y: 0 });
  assert.equal(f.button.attributes.get("aria-pressed"), "false");
  f.controller.dispose();
});

test("suspension cancels no-data timeouts and re-entry recalibrates without requesting again", async () => {
  const f = fixture();
  await f.enable();
  assert.equal(f.timers.size, 1);
  f.controller.setActive(false);
  assert.equal(f.timers.size, 0);
  assert.equal(f.scope.count("deviceorientation"), 0);
  assert.equal(f.controller.evidence().state, "suspended");
  f.timeout();
  f.controller.setActive(true);
  f.sample(80, -20);
  assert.deepEqual(f.last(), { x: 0, y: 0 });
  f.sample(68, -10);
  assert.ok(Math.abs(f.last().x) + Math.abs(f.last().y) > 0.1);
  f.doc.hidden = true;
  f.doc.emit("visibilitychange");
  assert.equal(f.scope.count("deviceorientation"), 0);
  assert.deepEqual(f.last(), { x: 0, y: 0 });
  f.doc.hidden = false;
  f.doc.emit("visibilitychange");
  f.sample(35, 10);
  assert.deepEqual(f.last(), { x: 0, y: 0 });
  assert.equal(f.requests(), 1);
  f.controller.dispose();
});

test("screen rotation and an explicit reset use a fresh neutral in portrait and landscape", async () => {
  const f = fixture();
  await f.enable();
  f.sample();
  f.sample(60, 20);
  assert.notDeepEqual(f.last(), { x: 0, y: 0 });
  f.scope.screen.orientation.angle = 90;
  f.scope.screen.orientation.emit("change");
  assert.deepEqual(f.last(), { x: 0, y: 0 });
  f.sample(20, 40);
  assert.deepEqual(f.last(), { x: 0, y: 0 });
  f.sample(30, 40);
  assert.ok(Math.abs(f.last().x) > Math.abs(f.last().y), "landscape pitch maps mainly to screen x");
  // A browser can deliver the sensor update before its screen-change event.
  f.scope.screen.orientation.angle = 0;
  f.sample(45, 0);
  assert.deepEqual(f.last(), { x: 0, y: 0 });
  f.sample(60, 0);
  f.controller.reset();
  f.sample(85, 30);
  assert.deepEqual(f.last(), { x: 0, y: 0 });
  f.controller.dispose();
});

test("unavailable, denied, and rejected sensor access leave a truthful disabled fallback", async () => {
  for (const options of [{ secure: false }, { orientation: false }, { touch: false }]) {
    const f = fixture(options);
    assert.equal(f.button.hidden, true);
    await f.enable();
    assert.equal(f.requests(), 0);
    assert.equal(f.controller.evidence().state, "unsupported");
    f.controller.dispose();
  }
  for (const permission of ["denied", () => Promise.reject(new Error("sensor blocked"))]) {
    const f = fixture({ permission });
    await f.enable();
    assert.equal(f.button.disabled, true);
    assert.equal(f.button.attributes.get("aria-pressed"), "false");
    assert.equal(f.scope.count("deviceorientation"), 0);
    assert.match(f.status.textContent, /not allowed|unavailable/);
    f.controller.dispose();
  }
  const f = fixture({ request: false });
  await f.enable();
  f.sample(null, null);
  f.timeout();
  assert.equal(f.controller.evidence().state, "unavailable");
  assert.equal(f.button.disabled, true);
  assert.equal(f.scope.count("deviceorientation"), 0);
  assert.deepEqual(f.last(), { x: 0, y: 0 });
  f.controller.dispose();
});

test("late permission resolution cannot revive a disposed controller", async () => {
  let resolve;
  const f = fixture({ permission: () => new Promise((done) => (resolve = done)) });
  f.controller.setActive(true);
  f.button.emit("click");
  assert.equal(f.controller.evidence().state, "permission");
  f.controller.dispose();
  resolve("granted");
  await flush();
  assert.equal(f.scope.count("deviceorientation"), 0);
  assert.equal(f.button.count("click"), 0);
  assert.equal(f.doc.count("visibilitychange"), 0);
  assert.equal(f.scope.screen.orientation.count("change"), 0);
  assert.equal(f.timers.size, 0);
  assert.equal(f.controller.evidence().state, "disposed");
});
