import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { prefersStill, shouldPlay } from "../assets/js/preview-motion.mjs";

const base = { autoplay: true, userChoice: null, visibleShare: 1, pageHidden: false };

test("an animated preview plays by itself only while a quarter of it is on screen", () => {
  assert.equal(shouldPlay(base), true);
  assert.equal(shouldPlay({ ...base, visibleShare: 0.25 }), true);
  assert.equal(shouldPlay({ ...base, visibleShare: 0.2 }), false);
  assert.equal(shouldPlay({ ...base, visibleShare: 0 }), false);
});

test("a hidden tab pauses it, whatever the visitor chose", () => {
  assert.equal(shouldPlay({ ...base, pageHidden: true }), false);
  assert.equal(shouldPlay({ ...base, userChoice: "playing", pageHidden: true }), false);
});

test("a pause the visitor chose sticks, and a press of play overrides a still preference", () => {
  assert.equal(shouldPlay({ ...base, userChoice: "paused" }), false);
  assert.equal(shouldPlay({ ...base, autoplay: false }), false);
  assert.equal(shouldPlay({ ...base, autoplay: false, userChoice: "playing" }), true);
  assert.equal(shouldPlay({ ...base, autoplay: false, userChoice: "playing", visibleShare: 0.1 }), false);
});

test("reduced motion, Save-Data and automation keep the poster", () => {
  assert.equal(prefersStill(), false);
  assert.equal(prefersStill({ reducedMotion: true }), true);
  assert.equal(prefersStill({ saveData: true }), true);
  assert.equal(prefersStill({ automated: true }), true);
});

test("the bibliography layout renders the poster, a hidden muted video and a no-script GIF link", () => {
  const layout = readFileSync(new URL("../_layouts/bib.liquid", import.meta.url), "utf8");
  for (const fragment of ["data-preview-motion", "muted", "loop", "playsinline", 'preload="none"', "hidden", "<noscript>", "preview-motion.mjs"]) {
    assert.ok(layout.includes(fragment), fragment);
  }
  assert.ok(!layout.includes("Play the animation"), "the play-on-request link is gone");
});
