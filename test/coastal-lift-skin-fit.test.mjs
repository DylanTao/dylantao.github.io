import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { createLiftRig } from "../assets/js/home-scene/lift-rig.mjs";
import { gymLayout } from "../assets/js/home-scene/gym-session.mjs";
import { loadNativeAvatar, loadNativeModel, repo, THREE } from "./helpers/coastal-native-avatar.mjs";

const manifest = JSON.parse(fs.readFileSync(new URL("assets/models/home/manifest.json", repo)));
const gym = manifest.equipment.gym;
const radius = 0.0145;
const supported = 0.006;
const shaftOffset = 0.65;
const boneName = (bone) => bone.name.replaceAll(".", "");

// For each rendered skin, record the vertices' dominant anatomical regions once.
function skinSource(actor) {
  const skin = [];
  const bones = {};
  actor.traverse((node) => {
    if (node.isBone) bones[boneName(node)] = node;
    if (!node.isSkinnedMesh || !node.visible) return;
    const { position, skinIndex, skinWeight } = node.geometry.attributes;
    const names = node.skeleton.bones.map(boneName);
    const regions = Array.from({ length: position.count }, (_, i) => {
      let dominant = 0;
      for (let influence = 1; influence < 4; influence++) {
        if (skinWeight.getComponent(i, influence) > skinWeight.getComponent(i, dominant)) dominant = influence;
      }
      return names[skinIndex.getComponent(i, dominant)];
    });
    skin.push({ node, regions });
  });
  return { skin, bones };
}

function contacts({ skin, bones }, bar, pads, incline) {
  const p = new THREE.Vector3();
  const shift = new THREE.Vector3();
  const nearest = {};
  const shoulders = { L: bones.ArmL.getWorldPosition(new THREE.Vector3()), R: bones.ArmR.getWorldPosition(new THREE.Vector3()) };
  const wrists = { L: bones.HandL.getWorldPosition(new THREE.Vector3()), R: bones.HandR.getWorldPosition(new THREE.Vector3()) };
  const cosine = Math.cos(incline);
  const sine = Math.sin(incline);
  const [hx, hy, hz] = gym.bench.hinge;
  const record = (part, d) => (nearest[part] = Math.min(nearest[part] ?? Infinity, d));
  for (const { node, regions } of skin) {
    node.skeleton.update();
    for (let i = 0; i < regions.length; i++) {
      const name = regions[i];
      node.getVertexPosition(i, p).applyMatrix4(node.matrixWorld);
      shift.copy(p).sub(bar.center);
      const along = shift.dot(bar.axis);
      const gap = Math.sqrt(Math.max(0, shift.lengthSq() - along * along) + Math.max(0, Math.abs(along) - shaftOffset) ** 2) - radius;
      if (name === "Head") record("head", gap);
      if (name === "Spine" || name === "Hips" || name === "Root") record("torso", gap);
      if (name === "ArmL" || name === "ArmR") {
        const side = name.at(-1);
        const toShoulder = p.distanceToSquared(shoulders[side]);
        if (toShoulder < 0.145 ** 2) record("shoulder" + side, gap);
        if (toShoulder > 0.13 ** 2) record("upper arm", gap);
      }
      // Fingertips and wrist skin beside the palm can wrap the shaft. Keep the rest of the forearm clear.
      if (name.startsWith("Forearm") && p.distanceToSquared(wrists[name.at(-1)]) > 0.054 ** 2) record("forearm", gap);
      if (name.startsWith("Hand")) record(name.endsWith("L") ? "handL" : "handR", gap);
      if (name.startsWith("Foot") || name.startsWith("Toe")) record(name.endsWith("L") ? "footL" : "footR", p.y);
      if (!pads || Math.abs(p.z - hz) >= 0.128) continue;
      // Project into the rotated backrest's own axes. The seat stays fixed. Sample their flat
      // interiors, where the rounded upholstered edges do not affect the support plane.
      const x = hx + (p.x - hx) * cosine + (p.y - hy) * sine;
      const y = hy + (p.y - hy) * cosine - (p.x - hx) * sine;
      if (name === "Spine" && x > pads.back.min.x + 0.035 && x < pads.back.max.x - 0.035) record("backPad", y - pads.back.max.y);
      if ((name === "Hips" || name.startsWith("Thigh")) && p.x > pads.seat.min.x + 0.035 && p.x < pads.seat.max.x - 0.03)
        record("seatPad", p.y - pads.seat.max.y);
    }
  }
  return nearest;
}

test("the five delivered gym skins fit the rack and bench shafts, press and native cushions", async () => {
  const { scene: gymRoom } = await loadNativeModel("room-gym.glb");
  const meshBounds = (name) => new THREE.Box3().setFromObject(gymRoom.getObjectByName(name), true);
  const pads = { seat: meshBounds("gym_bench_seat"), back: meshBounds("gym_bench_backrest") };
  assert.ok(Math.abs(pads.back.max.y - gym.bench.hinge[1] - 0.05) < 0.001, "back pad height is bound to authored upholstery");
  assert.ok(Math.abs(pads.seat.max.y - pads.back.max.y) < 0.001, "fixed cushion shares the flat support plane");

  const { spots } = gymLayout(gym);
  const bench = {
    hooks: gym.bench.bar,
    hinge: gym.bench.hinge,
    lie: gym.bench.actor,
    inclineDegrees: gym.bench.inclineDegrees,
  };
  const phases = [0, 0.16, 0.24, 0.33, 0.42, 0.5, 0.65, 0.74, 0.85, 0.94];
  for (const { id } of manifest.avatars) {
    const { scene: actor, animations } = await loadNativeAvatar(id);
    const world = new THREE.Group();
    world.add(actor);
    const rig = createLiftRig(actor, id);
    const source = skinSource(actor);
    const mixer = new THREE.AnimationMixer(actor);
    mixer.clipAction(animations.find((clip) => clip.name === "idle")).play();
    for (const [lift, spot, ctx] of [
      ["squat", spots.rackSquat, { hooks: gym.rack.bar }],
      ["front-squat", spots.rackPress, { hooks: gym.rack.bar }],
      ["ohp", spots.rackPress, { hooks: gym.rack.bar }],
      ["bench", spots.benchMount, bench],
      ["incline-bench", spots.benchMount, bench],
      ["close-grip-bench", spots.benchMount, bench],
    ]) {
      rig.release();
      mixer.setTime(0);
      const onBench = lift.includes("bench");
      if (onBench) {
        actor.position.fromArray(spots.rackSquat.at);
        actor.rotation.y = spots.rackSquat.facing;
        world.updateMatrixWorld(true);
        rig.apply("squat", 0.42);
      }
      actor.position.fromArray(spot.at);
      actor.rotation.y = spot.facing;
      const incline = lift === "incline-bench" ? (bench.inclineDegrees * Math.PI) / 180 : 0;
      for (const phase of phases) {
        world.updateMatrixWorld(true);
        const result = rig.apply(lift, phase, ctx);
        const fit = contacts(source, result, onBench ? pads : null, incline);
        const at = id + " " + lift + " " + phase;
        const between = (key, min, max) => assert.ok(fit[key] >= min && fit[key] <= max, at + " " + key + " samples " + fit[key] + " m");
        assert.ok(fit.head > 0.001, at + " head clearance " + fit.head);
        assert.ok(fit.torso > -0.002, at + " torso clearance " + fit.torso);
        assert.ok(fit["upper arm"] > -0.002, at + " upper-arm clearance " + fit["upper arm"]);
        assert.ok(fit.forearm > -0.002, at + " forearm clearance " + fit.forearm);
        for (const side of ["L", "R"]) {
          between("hand" + side, -radius, 0.004);
          between("foot" + side, -0.006, 0.015);
        }
        if (onBench) {
          between("backPad", -0.002, supported);
          between("seatPad", -0.002, supported);
          assert.ok(fit.torso > 0.012, at + " lower chest clearance " + fit.torso);
        } else if (lift === "squat") {
          assert.ok(Math.min(fit.torso, fit.shoulderL, fit.shoulderR) < 0.021, at + " the bar stays across the upper back");
        } else if (lift === "front-squat") {
          for (const side of ["L", "R"]) between("shoulder" + side, -0.005, 0.022);
        }
      }
    }
    mixer.stopAllAction();
    mixer.uncacheRoot(actor);
  }
});
