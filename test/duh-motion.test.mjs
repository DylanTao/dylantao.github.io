import test from "node:test";
import assert from "node:assert/strict";
import { createDuhMotion, DUH_LIMITS } from "../assets/js/companion/duh-motion.mjs";

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
