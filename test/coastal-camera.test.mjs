import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { envelopeFor, constrainOrbit, keepCameraClear, cameraTerrainHeight } from "../assets/js/home-scene/camera.mjs";
import { activityPose } from "../assets/js/home-scene/activities.mjs";
const c = JSON.parse(fs.readFileSync(new URL("../assets/models/home/manifest.json", import.meta.url)));
test("exterior retains a full orbit, interior input extremes stay in authored arcs", () => {
  for (const id of ["outside", "overview", ...c.rooms.map((r) => r.id)]) {
    const envelope = envelopeFor(c, id);
    assert.ok(envelope);
    for (const yaw of [-100, -Math.PI, 0, Math.PI, 100])
      for (const pitch of [-10, 0, 10])
        for (const radius of [-1, 1, 100]) {
          const v = constrainOrbit({ yaw, pitch, radius }, envelope);
          assert.ok(v.pitch >= envelope.pitch[0] && v.pitch <= envelope.pitch[1]);
          assert.ok(v.radius >= envelope.radius[0] && v.radius <= envelope.radius[1]);
          if (id === "outside") assert.equal(v.yaw, yaw);
          else assert.ok(v.yaw >= envelope.yaw[0] && v.yaw <= envelope.yaw[1]);
        }
  }
});
test("a rear exterior near plane is lifted out of the actual mainland surface", () => {
  const p = { x: 0, y: 0, z: 15 };
  keepCameraClear(p, c, "outside");
  assert.ok(p.y >= cameraTerrainHeight(0, 15, c.cameraCollision) + c.cameraCollision.clearance - 0.000001);
});
test("coffee and strength sequences have approaches, rests and equipment contacts", () => {
  const phases = new Set();
  for (const [name, id] of [
    ["coffee", "kitchen"],
    ["strength", "gym"],
  ]) {
    const room = c.rooms.find((r) => r.id === id);
    for (let t = 0; t < 100; t += 0.25) {
      const p = activityPose(name, t, c.equipment, room);
      assert.ok(p.position.every(Number.isFinite));
      phases.add(p.phase);
    }
  }
  for (const phase of [
    "grind",
    "brew",
    "pick up",
    "carry",
    "set down",
    "return cup",
    "pull-ups",
    "dips",
    "rest",
    "pick up weight",
    "return weight",
    "dumbbell set",
  ])
    assert.ok(phases.has(phase));
});
