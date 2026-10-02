import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { createPipMotion } from "../assets/js/companion/motion.mjs";

// Execute the actual studio controller with browser scheduling/event adapters.
// The counted portrait is a scheduling probe, not visual/model evidence.
const source = fs.readFileSync(new URL("../assets/js/companion/studio.mjs", import.meta.url), "utf8").replace(/^import .*;\r?\n/gm, "");

function fixture({ owner = "page", reduced = false, napping = false } = {}) {
  const callbacks = new Map();
  let nextFrame = 0,
    now = 1000,
    draws = 0;
  class Node extends EventTarget {
    dataset = {};
    hidden = false;
    textContent = "";
    setAttribute() {}
    getBoundingClientRect() {
      return { left: 0, top: 990, width: 400, height: 400 };
    }
  }
  const canvas = new Node(),
    status = new Node(),
    rest = new Node(),
    gestures = new Node(),
    studio = new Node(),
    document = new EventTarget(),
    window = new EventTarget(),
    media = new EventTarget();
  media.matches = reduced;
  studio.querySelector = (selector) => ({ canvas, "[data-pip-status]": status, "[data-pip-rest]": rest, ".pip-studio-gestures": gestures })[selector];
  document.querySelector = () => studio;
  document.hidden = false;
  const companion = { owner, napping, pointer: { at: 0 }, theme: "noon", motion: createPipMotion() };
  let intersection;
  const context = {
    document,
    window,
    companion,
    matchMedia: () => media,
    createPortrait: () => ({ draw: () => draws++, dispose() {} }),
    requestAnimationFrame: (callback) => {
      callbacks.set(++nextFrame, callback);
      return nextFrame;
    },
    cancelAnimationFrame: (id) => callbacks.delete(id),
    IntersectionObserver: class {
      constructor(callback) {
        intersection = callback;
      }
      observe() {}
      disconnect() {}
    },
    MutationObserver: class {
      observe() {}
      disconnect() {}
    },
    performance: { now: () => now },
    sessionStorage: { setItem() {} },
    Event,
  };
  vm.runInNewContext(source, context, { filename: "studio.mjs" });
  const run = (count = 1, seconds = 1 / 60) => {
    for (let i = 0; i < count && callbacks.size; i++) {
      const pending = [...callbacks.values()];
      callbacks.clear();
      now += seconds * 1000;
      pending.forEach((callback) => callback(now));
    }
  };
  const changeOwner = (value) => {
    companion.owner = value;
    window.dispatchEvent(new Event("pip:change"));
  };
  return {
    studio,
    document,
    window,
    companion,
    run,
    changeOwner,
    pending: () => callbacks.size,
    draws: () => draws,
    evidence: () => studio.getPipEvidence(),
    setReduced(value) {
      media.matches = value;
      media.dispatchEvent(new Event("change"));
    },
    setNap(value) {
      companion.napping = value;
      window.dispatchEvent(new Event("pip:nap"));
    },
    setVisible(value) {
      intersection([{ isIntersecting: value }]);
    },
    setHidden(value) {
      document.hidden = value;
      document.dispatchEvent(new Event("visibilitychange"));
    },
    lifecycle(type, persisted = true) {
      const event = new Event(type);
      event.persisted = persisted;
      window.dispatchEvent(event);
    },
  };
}

test("a visible unowned studio sleeps, then resumes the actual motor on ownership return", () => {
  const f = fixture();
  f.run(120);
  assert.equal(f.pending(), 0, "page ownership must not retain a studio animation loop");
  assert.equal(f.draws(), 0);
  assert.equal(f.evidence().time, 0);
  f.changeOwner("studio");
  f.run(20);
  assert.ok(f.draws() >= 20, "positive control: owning the studio must animate");
  assert.ok(f.evidence().time > 0);
  assert.equal(f.pending(), 1);
  const before = f.evidence().time;
  f.changeOwner("world");
  f.run(120);
  assert.equal(f.pending(), 0);
  assert.equal(f.evidence().time, before);
  f.changeOwner("studio");
  f.run(1, 60);
  assert.ok(f.evidence().time - before < 0.02, "ownership return cannot age the motor by absent wall time");
});

test("reduced motion and nap compose once, including across ownership changes", () => {
  const f = fixture({ reduced: true });
  f.run(120);
  assert.equal(f.pending(), 0);
  f.changeOwner("studio");
  f.run(120);
  assert.equal(f.draws(), 1);
  assert.equal(f.pending(), 0);
  assert.equal(f.evidence().time, 0);
  f.setReduced(false);
  f.run(3);
  assert.equal(f.pending(), 1);
  f.setNap(true);
  f.run(120);
  assert.equal(f.pending(), 0);
  const asleep = f.evidence().time;
  f.changeOwner("page");
  f.run(120);
  f.changeOwner("studio");
  f.run(120);
  assert.equal(f.pending(), 0);
  assert.equal(f.evidence().time, asleep);
  f.setNap(false);
  f.run(3);
  assert.equal(f.pending(), 1);
  assert.ok(f.evidence().time > asleep);
});

test("offscreen, hidden and persisted returns wake once without aging the motor", () => {
  const f = fixture({ owner: "studio" });
  f.run(3);
  f.setVisible(false);
  assert.equal(f.pending(), 0);
  const offscreen = f.evidence().time;
  f.setVisible(true);
  f.run(1, 60);
  assert.ok(f.evidence().time - offscreen < 0.02);
  f.setHidden(true);
  assert.equal(f.pending(), 0);
  const hidden = f.evidence().time;
  f.setHidden(false);
  f.run(1, 60);
  assert.ok(f.evidence().time - hidden < 0.02);
  f.lifecycle("pagehide");
  assert.equal(f.pending(), 0);
  const retained = f.evidence().time;
  f.lifecycle("pageshow");
  f.run(1, 60);
  assert.ok(f.evidence().time - retained < 0.02);
  f.lifecycle("pagehide", false);
  f.lifecycle("pageshow");
  f.changeOwner("page");
  f.changeOwner("studio");
  assert.equal(f.pending(), 0, "destroyed controllers cannot restart");
});
