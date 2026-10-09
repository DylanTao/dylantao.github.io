import test from "node:test";
import assert from "node:assert/strict";
import { chooseDuhPerch } from "../assets/js/companion/duh-viewport.mjs";
import { createDuhMotion, DUH_LIMITS, sweepDuhContact } from "../assets/js/companion/duh-motion.mjs";

function settle(m, seconds = 6) {
  for (let i = 0; i < seconds * 120; i++) m.step(1 / 120);
}
test("interrupted drag clears capture intent and cannot become a throw", () => {
  const m = createDuhMotion();
  m.grab(300, 300, 0);
  m.drag(800, 200, 30);
  m.cancel();
  m.release(40);
  assert.equal(m.state.state, "REST");
  assert.equal(m.evidence().roughThrows, 0);
  assert.equal(m.evidence().held, false);
});
test("regrabbing flight interrupts it; a stale release carries no sampled momentum", () => {
  const m = createDuhMotion();
  m.toss(1000, -600);
  settle(m, 0.2);
  m.grab(m.state.x, m.state.y, 0);
  m.drag(600, 300, 20);
  m.release(300);
  assert.equal(m.state.vx, 0);
  assert.equal(m.state.vy, 0);
});
test("repeated clicks giggle once without contributing to roughness", () => {
  const m = createDuhMotion();
  m.pet();
  m.pet();
  m.pet();
  assert.equal(m.state.mood, "giggle");
  for (let i = 0; i < 100; i++) m.pet();
  settle(m);
  assert.equal(m.state.state, "REST");
  assert.equal(m.evidence().roughThrows, 0);
});
test("throws are capped and fixed-step contacts remain bounded after a long frame", () => {
  const m = createDuhMotion(390, 800);
  m.toss(50000, -30000);
  assert.ok(Math.hypot(m.state.vx, m.state.vy) <= DUH_LIMITS.speed + 0.01);
  for (let i = 0; i < 1200; i++) {
    m.step(i % 10 ? 1 / 120 : 1);
    assert.ok(Number.isFinite(m.state.x + m.state.y));
    assert.ok(m.state.x >= 36 && m.state.x <= 354);
  }
  assert.equal(m.state.state, "REST");
});
test("only three intentional energetic throws arm retreat, recall is immediate", () => {
  const m = createDuhMotion();
  for (let i = 0; i < 3; i++) {
    m.toss(1000, -200);
    settle(m, 0.2);
  }
  assert.equal(m.evidence().retreatPending, true);
  settle(m, 5);
  assert.equal(m.state.state, "RETREAT");
  m.reset();
  assert.equal(m.state.state, "REST");
  assert.equal(m.evidence().retreatPending, false);
});
test("retreat returns automatically; reduced motion, resize and reset stop flight", () => {
  const m = createDuhMotion();
  for (let i = 0; i < 3; i++) m.toss(1000, 0);
  settle(m, 15);
  assert.equal(m.state.state, "REST");
  m.toss(1000, 0, true);
  assert.equal(m.state.state, "REST");
  m.toss(500, 200);
  m.resize(320, 500);
  assert.equal(m.state.state, "REST");
  assert.ok(m.state.x <= 284);
  m.reset();
  assert.equal(m.state.squash, 0);
});

test("swept contacts catch a thin paragraph and ignore a release already inside it", () => {
  const target = { rect: { left: 250, right: 700, top: 300, bottom: 318 }, reading: true };
  const hit = sweepDuhContact(200, 309, 140, 0, [target]);
  assert.equal(hit.target, target);
  assert.equal(hit.nx, -1);
  assert.ok(hit.t > 0 && hit.t < 0.3);
  assert.equal(sweepDuhContact(400, 309, 140, 0, [target]), null);
  const m = createDuhMotion(1000, 800);
  m.reset(215, 309);
  m.setSurfaces([target]);
  m.toss(1400, 0);
  const contacts = m.step(0.05);
  assert.ok(contacts.some((c) => c.target === target && c.speed > 1000));
  assert.ok(m.state.vx < 0);
  settle(m, 6);
  assert.equal(m.state.state, "REST");
});

test("grip acceleration reflects shaking intensity and cancellation clears it", () => {
  const mild = createDuhMotion(),
    strong = createDuhMotion();
  for (const m of [mild, strong]) {
    m.reset(500, 400);
    m.grab(500, 400, 0);
  }
  mild.drag(502, 400, 25);
  strong.drag(535, 400, 25);
  assert.ok(Math.abs(strong.state.ax) > Math.abs(mild.state.ax) * 2);
  strong.drag(460, 400, 50);
  assert.ok(strong.state.ax < 0);
  strong.cancel();
  assert.equal(strong.state.ax, 0);
});

test("automatic retreat return retains the departure position", () => {
  const m = createDuhMotion();
  for (let i = 0; i < 3; i++) m.toss(1000, 0);
  while (m.state.state !== "RETREAT") m.step(1 / 120);
  const { x, y } = m.state;
  settle(m, 9);
  assert.equal(m.state.state, "REST");
  assert.equal(m.state.x, x);
  assert.equal(m.state.y, y);
});

test("visual viewport changes preserve capture and coordinates until explicit movement", () => {
  const m = createDuhMotion(390, 844);
  m.reset(210, 650);
  m.grab(210, 650, 0);
  m.setViewport({ width: 390, height: 640, left: 0, top: 20, bottom: 24 });
  assert.equal(m.evidence().held, true);
  assert.equal(m.state.y, 650);
  assert.deepEqual(m.bounds(), { left: 36, right: 354, top: 120, bottom: 594 });
  m.drag(210, 520, 25);
  m.drag(180, 480, 50);
  assert.equal(m.state.y, 480);
  m.release(60);
  assert.equal(m.state.state, "AIRBORNE");
  assert.ok(Math.hypot(m.state.vx, m.state.vy) <= 1170.001);
  m.cancel();
  m.setViewport({ width: 300, height: 600, left: 35, top: 70 });
  assert.equal(m.state.y, 480);
  assert.equal(m.bounds().left, 71);
  assert.equal(m.bounds().bottom, 628);
});

test("phone placement discovers a narrow real gap missed by the inherited row grid", () => {
  const obstacles = [
    { left: 0, right: 390, top: 0, bottom: 356 },
    { left: 0, right: 390, top: 484, bottom: 844 },
  ];
  const view = { left: 0, top: 0, width: 390, height: 844, bottom: 0 };
  const p = chooseDuhPerch(view, { left: 36, right: 354, top: 100, bottom: 802 }, { x: 333, y: 655 }, obstacles);
  assert.ok(p && p.y > 406 && p.y < 434);
  const shifted = obstacles.map((r) => ({ left: r.left + 20, right: r.right + 20, top: r.top + 60, bottom: r.bottom + 60 }));
  const q = chooseDuhPerch({ ...view, left: 20, top: 60 }, { left: 56, right: 374, top: 160, bottom: 862 }, { x: 353, y: 715 }, shifted);
  assert.equal(q.x, p.x + 20);
  assert.equal(q.y, p.y + 60);
});
