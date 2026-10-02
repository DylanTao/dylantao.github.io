import test from "node:test";
import assert from "node:assert/strict";
import { resolveWristTargets } from "../assets/js/home-scene/grip-targets.mjs";

const offsets = {
  pullup: [
    [-0.05, -0.055, 0],
    [0.05, -0.055, 0],
  ],
  dip: [
    [0.055, 0.058, 0],
    [-0.055, 0.058, 0],
  ],
};
const near = (actual, expected) =>
  actual.forEach((point, side) => point.forEach((value, axis) => assert.ok(Math.abs(value - expected[side][axis]) < 1e-12)));

test("unarticulated avatars and other clips preserve the original equipment targets", () => {
  const contacts = [null, [1, 2, 3]];
  assert.equal(resolveWristTargets(contacts, "pullup", undefined, 0), contacts);
  for (const clip of ["coffee-prep", "walk", "drink", "type", "soak", "workout"])
    assert.equal(resolveWristTargets(contacts, clip, offsets, 0), contacts);
  assert.equal(resolveWristTargets(null, "pullup", offsets, 0), null);
});

test("actor turns rotate lateral grip offsets without changing vertical clearance", () => {
  const contacts = [
    [1, 2, 3],
    [2, 2, 3],
  ];
  near(resolveWristTargets(contacts, "pullup", offsets, Math.PI / 2), [
    [1, 1.945, 3.05],
    [2, 1.945, 2.95],
  ]);
  near(resolveWristTargets(contacts, "dip", offsets, Math.PI), [
    [0.945, 2.058, 3],
    [2.055, 2.058, 3],
  ]);
});

test("resolving wrists never mutates shared anchors or invents a missing hand", () => {
  const right = Object.freeze([2, 2, 3]);
  const contacts = Object.freeze([null, right]);
  const resolved = resolveWristTargets(contacts, "pullup", offsets, 0);
  assert.equal(resolved[0], null);
  assert.deepEqual(right, [2, 2, 3]);
  assert.notEqual(resolved[1], right);
  near([resolved[1]], [[2.05, 1.945, 3]]);
});
