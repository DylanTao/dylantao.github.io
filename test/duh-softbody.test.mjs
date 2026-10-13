import test from "node:test";
import assert from "node:assert/strict";
import { createDuhSoftBody, polygonArea, resampleRadii } from "../assets/js/companion/duh-softbody.mjs";

const round = new Array(20).fill(1);
const square = Array.from({ length: 20 }, (_, i) => {
  const a = -Math.PI + (i * Math.PI * 2) / 20;
  return 0.91 / Math.pow(Math.pow(Math.cos(a), 4) + Math.pow(Math.sin(a), 4), 0.25);
});
const restArea = (radii, count = 32, radius = 28) => {
  const r = resampleRadii(radii, count);
  const points = r.map((value, i) => {
    const a = -Math.PI + (i * Math.PI * 2) / count;
    return [Math.cos(a) * radius * value, Math.sin(a) * radius * value];
  });
  return polygonArea(points);
};

test("volume stays within a few percent while shaken hard, held and squashed", () => {
  const body = createDuhSoftBody({ breathing: 0 });
  const reference = restArea(round);
  let worst = 0;
  for (let i = 0; i < 1200; i++) {
    const points = body.step(i % 15 ? 1 / 120 : 0.05, {
      ax: Math.sin(i * 0.7) * 16000,
      ay: Math.cos(i * 0.9) * 16000,
      held: i % 400 < 200,
      grounded: i % 400 >= 200,
      squash: i % 50 < 6 ? 0.3 : 0,
    });
    assert.ok(points.every((p) => p.every(Number.isFinite) && Math.hypot(...p) <= 44 + 1e-9));
    worst = Math.max(worst, Math.abs(polygonArea(points) / reference - 1));
  }
  // The canvas reach clamp trades a little volume for staying in frame under this extreme input.
  assert.ok(worst < 0.08, `area drifted by ${(worst * 100).toFixed(2)}%`);
});

test("everyday handling keeps volume within two percent", () => {
  const body = createDuhSoftBody({ breathing: 0 });
  const reference = restArea(round);
  let worst = 0;
  for (let i = 0; i < 600; i++) {
    const points = body.step(1 / 60, { ax: Math.sin(i / 9) * 8000, held: i < 300, grounded: i >= 300, squash: i % 120 < 4 ? 0.15 : 0 });
    worst = Math.max(worst, Math.abs(polygonArea(points) / reference - 1));
  }
  assert.ok(worst < 0.02, `area drifted by ${(worst * 100).toFixed(2)}%`);
});

test("an excited body settles back to rest and reports inactive", () => {
  const body = createDuhSoftBody({ breathing: 0 });
  for (let i = 0; i < 40; i++) body.step(1 / 120, { ax: 18000, held: true, grounded: false });
  body.pet(-Math.PI / 2, 600);
  assert.equal(body.active(), true);
  for (let i = 0; i < 1200; i++) body.step(1 / 120, { grounded: false });
  assert.ok(body.evidence().energy < 0.05, `energy ${body.evidence().energy}`);
  assert.equal(body.active(), false);
});

test("a contact half-plane is never crossed", () => {
  const body = createDuhSoftBody({ breathing: 0 });
  for (let i = 0; i < 600; i++) {
    const angle = Math.PI / 2 + Math.sin(i / 40) * 0.6;
    const points = body.step(1 / 120, { ay: 9000, squash: 0.25, contactAngle: angle, grounded: true });
    const nx = Math.cos(angle),
      ny = Math.sin(angle),
      offset = 28 * (1 - 0.25);
    for (const [x, y] of points) assert.ok(x * nx + y * ny <= offset + 1e-6);
  }
});

test("identical inputs give identical outlines", () => {
  const a = createDuhSoftBody(),
    b = createDuhSoftBody();
  for (let i = 0; i < 400; i++) {
    const input = { ax: Math.sin(i) * 9000, ay: Math.cos(i * 1.3) * 7000, squash: i % 37 < 3 ? 0.2 : 0, time: i / 120 };
    const pa = a.step(1 / 120, input),
      pb = b.step(1 / 120, input);
    assert.deepEqual(pa, pb);
  }
});

test("a new form becomes the rest shape: the body overshoots, then settles into it", () => {
  const body = createDuhSoftBody({ breathing: 0 });
  body.step(1 / 120, { grounded: false });
  body.setShape(square);
  const target = resampleRadii(square, 32).map((r, i) => {
    const a = -Math.PI + (i * Math.PI * 2) / 32;
    return [Math.cos(a) * 28 * r, Math.sin(a) * 28 * r];
  });
  // Corner particles (diagonals) travel outward; record how far they go past the square's corner.
  const corner = 4;
  let peak = 0;
  for (let i = 0; i < 1500; i++) {
    const points = body.step(1 / 120, { grounded: false });
    peak = Math.max(peak, Math.hypot(...points[corner]) - Math.hypot(...target[corner]));
  }
  const settled = body.points();
  const error = Math.max(...settled.map((p, i) => Math.hypot(p[0] - target[i][0], p[1] - target[i][1])));
  assert.ok(error < 0.8, `settled ${error.toFixed(3)} px from the square`);
  assert.ok(peak > 0.05, "the morph should overshoot a little before settling");
});

test("still mode composes the same settled pose at once, with no motion", () => {
  const body = createDuhSoftBody(),
    again = createDuhSoftBody();
  for (let i = 0; i < 30; i++) body.step(1 / 60, { ax: 20000 });
  const points = body.step(1 / 60, { still: true });
  assert.deepEqual(points, again.step(1 / 60, { still: true }));
  assert.equal(body.active(), false);
  // Pooled on its perch: flat at the contact plane and wider than tall.
  const xs = points.map((p) => p[0]),
    ys = points.map((p) => p[1]);
  assert.ok(Math.max(...ys) <= 28 * (1 - 0.16) + 1e-6);
  assert.ok(Math.max(...xs) - Math.min(...xs) > (Math.max(...ys) - Math.min(...ys)) * 1.05);
  // In the air (or held) it is the plain rest outline.
  const airborne = createDuhSoftBody().step(1 / 60, { still: true, grounded: false });
  const r = resampleRadii(round, 32);
  airborne.forEach(([x, y], i) => {
    const a = -Math.PI + (i * Math.PI * 2) / 32;
    assert.ok(Math.abs(x - Math.cos(a) * 28 * r[i]) < 1e-9);
    assert.ok(Math.abs(y - Math.sin(a) * 28 * r[i]) < 1e-9);
  });
});

test("a body pooled on its perch is at rest, so the page can idle", () => {
  const body = createDuhSoftBody();
  for (let i = 0; i < 900; i++) body.step(1 / 60, { grounded: true, time: i / 60 });
  assert.equal(body.active(), false);
  body.pet(-Math.PI / 2);
  body.step(1 / 60, { grounded: true });
  assert.equal(body.active(), true);
});
