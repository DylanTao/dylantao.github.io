import test from "node:test";
import assert from "node:assert/strict";
import { createDuhBody, deformDuhContour } from "../assets/js/companion/duh-body.mjs";

test("inertial shell responds proportionally and settles after shaking", () => {
  const mild = createDuhBody(),
    strong = createDuhBody();
  for (let i = 0; i < 30; i++) {
    mild.step(1 / 120, { ax: 500, held: true });
    strong.step(1 / 120, { ax: 15000, held: true });
  }
  assert.ok(Math.abs(strong.evidence().x) > Math.abs(mild.evidence().x) * 4);
  for (let i = 0; i < 900; i++) strong.step(1 / 120);
  assert.ok(Math.abs(strong.evidence().x) < 0.001);
  assert.ok(Math.abs(strong.evidence().y) < 0.001);
  assert.equal(strong.active(), false);
  strong.step(0.05, { ax: 16000, held: true });
  const quiet = strong.step(0.01, { still: true });
  assert.equal(quiet.x, 0);
  assert.equal(quiet.y, 0);
});

test("shell preserves area, stays bounded and pools under gravity", () => {
  const radii = Array(20).fill(1),
    dents = Array(20).fill(0),
    b = createDuhBody();
  const area = (points) =>
    Math.abs(
      points.reduce((sum, p, i) => {
        const q = points[(i + 1) % points.length];
        return sum + p[0] * q[1] - q[0] * p[1];
      }, 0)
    ) / 2;
  const target = (20 * 28 * 28 * Math.sin((2 * Math.PI) / 20)) / 2;
  for (let i = 0; i < 1200; i++) {
    const shell = b.step(i % 15 ? 1 / 120 : 0.1, { ax: Math.sin(i) * 16000, ay: Math.cos(i) * 16000, vx: 1600, held: true });
    const points = deformDuhContour(radii, dents, shell, 0.24);
    assert.ok(points.every((p) => p.every(Number.isFinite) && Math.hypot(...p) < 48));
    assert.ok(Math.abs(area(points) / target - 1) < 0.001);
  }
  for (let i = 0; i < 900; i++) b.step(1 / 120);
  const points = deformDuhContour(radii, dents, b.evidence());
  const width = Math.max(...points.map((p) => p[0])) - Math.min(...points.map((p) => p[0]));
  const height = Math.max(...points.map((p) => p[1])) - Math.min(...points.map((p) => p[1]));
  assert.ok(width > height * 1.15);
});
