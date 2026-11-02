import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "../assets/js/three.module.min.js";
import { createRainContactTracker } from "../assets/js/home-scene/rain-contact.mjs";
import { rainDrop, rainFall, rainDiameter, RAIN_FIELD } from "../assets/js/home-scene/rain-trajectories.mjs";
import { rainSegment } from "../assets/js/home-scene/coastal-rain.mjs";
import { createRenderedWaterSampler } from "../assets/js/home-scene/rain-water-sampler.mjs";
import { sampleOcean, oceanWindState } from "../assets/js/home-scene/ocean-spectrum.mjs";

const drop = (y, copy = [0, 0, 0]) => ({ point: [1, y, 3], copy, diameter: 0.001 });
test("first-contact tracking rejects initialization, pause, wraps, slow frames, solid and duplicate hits", () => {
  const events = [],
    tracker = createRainContactTracker({ maximum: 1, surfaceAt: () => ({ y: 0, kind: "water", id: "fixture" }), impact: (e) => events.push(e) });
  tracker.update(0, drop(2), 0);
  tracker.update(0, drop(1), 0.1);
  tracker.update(0, drop(0), 0.2);
  tracker.update(0, drop(-0.5), 0.25);
  tracker.update(0, drop(-0.5), 0.25);
  assert.equal(events.length, 1);
  assert.equal(events[0].seconds, 0.2);
  assert.deepEqual(events[0].position, [1, 0, 3]);
  assert.ok(Math.abs(events[0].relativeSpeed - 10) < 1e-10);
  assert.equal(tracker.landed(0), true);
  tracker.update(0, drop(-1, [0, 1, 0]), 0.3);
  assert.equal(tracker.landed(0), false);
  tracker.update(0, drop(-2, [0, 1, 0]), 1);
  assert.equal(events.length, 1);
  assert.equal(tracker.evidence().wraps, 1);
  const solid = createRainContactTracker({
    maximum: 1,
    surfaceAt: () => ({ y: 1, kind: "solid", id: "roof" }),
    impact: () => assert.fail("Roof must not emit a water event"),
  });
  solid.update(0, drop(2), 0);
  solid.update(0, drop(0), 0.2);
  assert.equal(solid.evidence().solid, 1);
  assert.throws(() => tracker.update(0, { point: [], copy: [] }, 1), RangeError);
  assert.throws(() => createRainContactTracker({ maxStep: 0.5, surfaceAt: () => null }), RangeError);
});

test("streaks and contact tips share the same varied-size trajectory and short exposure", () => {
  const sizes = new Set(),
    center = [1, 3, -5],
    wind = [1.1, 0, -0.6];
  for (let i = 0; i < RAIN_FIELD.maximum; i++) {
    const d = rainDrop(i, 2.5, center, wind),
      segment = rainSegment(i, 2.5, center, wind, -100);
    sizes.add(rainDiameter(i));
    assert.ok(d.diameter >= 0.00075 && d.diameter <= 0.002);
    assert.ok(rainFall(i) > 3 && rainFall(i) < 7);
    assert.ok(d.length / rainFall(i) >= 0.018 && d.length / rainFall(i) <= 0.034);
    for (let k = 0; k < 3; k++) assert.ok(Math.abs(segment[k + 3] - d.point[k]) < 2e-6);
  }
  assert.equal(sizes.size, 1024);
  assert.throws(() => rainFall(1024), RangeError);
});

test("an explicit surface upper bound skips air queries without losing the first hit", () => {
  const run = (bounded) => {
    const events = [],
      tracker = createRainContactTracker({ maximum: 1, surfaceAt: () => ({ kind: "water", id: "plane", y: 0 }), impact: (e) => events.push(e) });
    for (let i = 0; i <= 100; i++) tracker.update(0, { ...drop(2 - i * 0.04), upper: bounded ? 0 : Infinity }, i * 0.01);
    return { events, evidence: tracker.evidence() };
  };
  const slow = run(false),
    fast = run(true);
  assert.deepEqual(fast.events, slow.events);
  assert.equal(fast.events.length, 1);
  assert.ok(fast.evidence.aboveSurface > 40);
  assert.ok(fast.evidence.queries < slow.evidence.queries / 2);
});

test("contact times agree across frame rates on the rendered-grid model and an independent triangle raycast", () => {
  const geometry = new THREE.PlaneGeometry(400, 400, 160, 160);
  geometry.rotateX(-Math.PI / 2);
  const positions = geometry.getAttribute("position");
  for (let i = 0; i < positions.count; i++)
    for (const axis of ["X", "Z"]) {
      const v = positions["get" + axis](i) / 200;
      positions["set" + axis](i, Math.sign(v) * v * v * 200);
    }
  const origin = [0, -7.35, -28],
    wind = [1.1, 0, -0.6],
    seaWind = oceanWindState(3, 0.2),
    sampler = createRenderedWaterSampler(geometry, origin, sampleOcean),
    results = [];
  for (const hz of [30, 60, 120, 240]) {
    const events = [];
    for (let index = 0; index < 4; index++) {
      const own = [],
        bounded = [];
      const surfaceAt = (x, z, t, bottom, top) => {
        if (bottom > -6.8 || top < -7.9) return { kind: "solid", id: "deep-test-seabed", y: -14 };
        const hit = sampler.sample(x, z, t, seaWind);
        assert.ok(hit);
        return { ...hit, kind: "water", id: "pacific" };
      };
      const tracker = createRainContactTracker({
        maximum: 4,
        surfaceAt,
        impact: (e) => own.push(e),
      });
      const fast = createRainContactTracker({ maximum: 4, surfaceAt, impact: (e) => bounded.push(e) });
      for (let tick = 0; tick <= Math.ceil((hz * 28) / rainFall(index)); tick++) {
        const d = rainDrop(index, tick / hz, [0, -0.35, -43], wind);
        tracker.update(index, d, tick / hz);
        d.upper = -6.8;
        fast.update(index, d, tick / hz);
      }
      assert.equal(own.length, 1);
      assert.deepEqual(bounded, own);
      assert.ok(fast.evidence().queries < tracker.evidence().queries);
      events.push(own[0]);
    }
    results.push(events);
  }
  for (const events of results) for (let i = 0; i < 4; i++) assert.ok(Math.abs(events[i].seconds - results.at(-1)[i].seconds) < 0.001);
  for (const event of results.at(-1)) {
    // Independent Three triangle raycaster over a displaced Float32 mesh; no inverse/Newton lookup.
    const drawn = geometry.clone(),
      values = drawn.getAttribute("position");
    for (let i = 0; i < values.count; i++) {
      const p = sampler.vertex(i, event.seconds, seaWind);
      values.setXYZ(i, ...p);
    }
    drawn.computeBoundingSphere();
    const mesh = new THREE.Mesh(drawn, new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }));
    mesh.updateMatrixWorld(true);
    const ray = new THREE.Raycaster(new THREE.Vector3(event.position[0], 0, event.position[2]), new THREE.Vector3(0, -1, 0));
    const hits = ray.intersectObject(mesh, false);
    assert.equal(hits.length, 1);
    assert.equal(hits[0].faceIndex, event.triangle);
    assert.ok(Math.abs(hits[0].point.y - event.position[1]) < 2e-6);
    drawn.dispose();
    mesh.material.dispose();
  }
  assert.equal(sampler.sample(1000, 1000, 1, seaWind), null);
  geometry.dispose();
});
