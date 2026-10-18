import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "../assets/js/three.module.min.js";
import { breathAt, createBreathingCover, BREATHS_PER_MINUTE, INHALE, SWELL } from "../assets/js/home-scene/bedding-breath.mjs";

test("a breath rises over 40 % of its period and falls over the rest, at a resting rate", () => {
  const period = 60 / BREATHS_PER_MINUTE;
  assert.equal(breathAt(0), 0);
  assert.ok(Math.abs(breathAt(INHALE * period) - 1) < 1e-9, "full at the end of the inhale");
  assert.ok(breathAt(period * 0.999) < 0.01, "breathed out by the end");
  assert.ok(Math.abs(breathAt(period * 3 + 1) - breathAt(1)) < 1e-9, "periodic");
  for (let t = 0; t < period; t += 0.05) assert.ok(breathAt(t) >= 0 && breathAt(t) <= 1);
  assert.ok(breathAt(-1) >= 0, "negative time stays in range");
});

test("the cover swells a few millimetres around the chest along its normals and rests again", () => {
  const geometry = new THREE.PlaneGeometry(2, 2, 40, 40).rotateX(-Math.PI / 2); // normals up
  const mesh = new THREE.Mesh(geometry);
  const rest = geometry.getAttribute("position").array.slice();
  const cover = createBreathingCover(mesh);
  const chest = new THREE.Vector3(0.3, 0, -0.2);
  assert.equal(cover.update(chest, 1), true);
  const y = geometry.getAttribute("position");
  let peak = 0,
    far = 0;
  for (let i = 0; i < y.count; i++) {
    const p = new THREE.Vector3().fromBufferAttribute(y, i);
    const d = Math.hypot(p.x - chest.x, p.z - chest.z);
    if (d < 0.03) peak = Math.max(peak, p.y);
    if (d > 0.9) far = Math.max(far, Math.abs(p.y));
  }
  assert.ok(Math.abs(peak - SWELL) < 0.0005, `peak swell ${peak}`);
  assert.ok(far < SWELL * 0.01, "the far cover barely moves");
  assert.equal(cover.update(chest, 1), false, "an unchanged breath does no work");
  cover.reset();
  assert.deepEqual(Array.from(y.array), Array.from(rest), "back to the rest drape");
});
