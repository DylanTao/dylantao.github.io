import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "../assets/js/three.module.min.js";
import { createCoastalRain, rainSegment } from "../assets/js/home-scene/coastal-rain.mjs";

test("rain holds at the same active time independent of frame cadence", () => {
  const at = (time) => [...rainSegment(38, time, [1, 3, -5], [1.2, 0, -0.8])];
  const expected = at(40);
  for (let time = 0; time < 40; time += 0.017) at(time);
  assert.deepEqual(at(40), expected);
  assert.deepEqual(at(40), at(47));
  assert.notDeepEqual(at(40), at(40.1));
});

test("terrain and covered volumes stop actual rain segments including lifted cutaway roofs", () => {
  for (let index = 0; index < 512; index++) {
    const shelter = [{ min: [-100, -8, -100], max: [100, 12, 100] }];
    const segment = rainSegment(index, 3, [0, 0, 0], [0, 0, 0], 1, shelter);
    assert.ok(segment[1] >= 12.025 - 0.00001 && segment[4] >= 12.025 - 0.00001);
    const terrain = rainSegment(index, 3, [0, 0, 0], [0, 0, 0], 20);
    assert.ok(terrain[1] >= 20.025 - 0.00001 && terrain[4] >= 20.025 - 0.00001);
    assert.ok([...segment].every(Number.isFinite));
  }
});

test("dry weather adds no draw; compact rain is bounded and retains its paused field", () => {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera();
  const rain = createCoastalRain({ scene, compact: true });
  assert.equal(scene.children.length, 1);
  rain.update({ rain: 0, camera });
  assert.equal(rain.object.visible, false);
  assert.equal(rain.object.geometry.drawRange.count, 0);
  rain.update({ rain: 8, seconds: 5, camera });
  assert.equal(rain.evidence().drops, 256);
  const before = [...rain.object.geometry.attributes.position.array];
  rain.update({ rain: 8, seconds: 5, camera });
  assert.deepEqual([...rain.object.geometry.attributes.position.array], before);
  assert.equal(rain.object.castShadow, false);
  assert.equal(rain.object.material.depthWrite, false);
  rain.update({ rain: NaN, camera });
  assert.equal(rain.object.visible, false);
  rain.dispose();
  assert.equal(scene.children.length, 0);
});
