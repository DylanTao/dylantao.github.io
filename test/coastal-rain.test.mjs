import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "../assets/js/three.module.min.js";
import { createCoastalRain, rainSegment, RAIN_FIELD } from "../assets/js/home-scene/coastal-rain.mjs";

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

test("the field is world-stable: moving its box keeps drops in place except those that wrap", () => {
  const time = 12.3,
    wind = [1.1, 0, -0.6];
  let kept = 0;
  for (let index = 0; index < RAIN_FIELD.maximum; index++) {
    const before = [...rainSegment(index, time, [4, 9, -6], wind)],
      after = [...rainSegment(index, time, [4.6, 9, -6.4], wind)];
    if (before.every((value, k) => Math.abs(value - after[k]) < 1e-4)) kept++;
  }
  // Moving the box 0.6 m and 0.4 m wraps about (0.6 + 0.4) / 30 of the drops; the rest stay put.
  assert.ok(kept / RAIN_FIELD.maximum > 0.94, `${kept} of ${RAIN_FIELD.maximum} drops kept their place`);
});

test("drops concentrate in the box ahead of the camera and never streak from its lens", () => {
  const scene = new THREE.Scene(),
    camera = new THREE.PerspectiveCamera(45, 16 / 9, 0.05, 2000);
  camera.position.set(0, 9, -8);
  camera.lookAt(0, 1.5, 8);
  camera.updateMatrixWorld();
  const rain = createCoastalRain({ scene });
  rain.update({ rain: 0.65, seconds: 3, camera, wind: [0.8, 0, 0.2] });
  const positions = rain.object.geometry.attributes.position.array,
    drops = rain.evidence().drops;
  let ahead = 0;
  for (let index = 0; index < drops; index++) {
    const [x, y, z] = positions.subarray(index * 6, index * 6 + 3),
      distance = Math.hypot(x - 0, y - 9, z + 8);
    if (distance < RAIN_FIELD.near) assert.equal(positions[index * 6 + 4], y, "a drop at the lens is held degenerate");
    if (z > camera.position.z) ahead++;
    assert.ok(Math.abs(x) <= RAIN_FIELD.extent / 2 + 1e-6 && Math.abs(z - (camera.position.z + RAIN_FIELD.ahead)) <= RAIN_FIELD.extent / 2 + 1e-6);
  }
  assert.ok(ahead / drops > 0.85, "most of the field lies in front of the camera");
  assert.equal(rain.evidence().fieldExtent, RAIN_FIELD.extent);
  rain.dispose();
});
