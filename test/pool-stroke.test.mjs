import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import * as THREE from "../assets/js/three.module.min.js";
import { createPoolStroke, samplePoolStroke } from "../assets/js/home-scene/pool-stroke.mjs";
import { createHeightfieldWater } from "../assets/js/home-scene/heightfield-water.mjs";

const manifest = JSON.parse(fs.readFileSync(new URL("../assets/models/home/manifest.json", import.meta.url))),
  room = manifest.rooms.find((r) => r.id === "onsen");

// Decode only actual GLB hierarchy/animation accessors. No geometry, Draco,
// browser or raster is needed to sample exported anatomical wrist trajectories.
function nativeRig(file, clipName = "soak") {
  const bytes = fs.readFileSync(new URL("../assets/models/home/" + file, import.meta.url)),
    jsonLength = bytes.readUInt32LE(12),
    doc = JSON.parse(bytes.subarray(20, 20 + jsonLength).toString()),
    bin = bytes.subarray(28 + jsonLength),
    clip = doc.animations.find((a) => a.name === clipName);
  function accessor(index) {
    const a = doc.accessors[index],
      view = doc.bufferViews[a.bufferView],
      size = { SCALAR: 1, VEC3: 3, VEC4: 4 }[a.type],
      values = [];
    assert.equal(a.componentType, 5126);
    assert.ok(size);
    for (let i = 0; i < a.count; i++)
      for (let k = 0; k < size; k++)
        values.push(bin.readFloatLE((view.byteOffset || 0) + (a.byteOffset || 0) + i * (view.byteStride || size * 4) + k * 4));
    return { values, size };
  }
  const nodes = doc.nodes.map((node) => {
    const bone = new THREE.Bone();
    bone.name = node.name || "";
    if (node.matrix) new THREE.Matrix4().fromArray(node.matrix).decompose(bone.position, bone.quaternion, bone.scale);
    else {
      if (node.translation) bone.position.fromArray(node.translation);
      if (node.rotation) bone.quaternion.fromArray(node.rotation);
      if (node.scale) bone.scale.fromArray(node.scale);
    }
    return bone;
  });
  doc.nodes.forEach((node, i) => node.children?.forEach((child) => nodes[i].add(nodes[child])));
  const actor = new THREE.Group();
  doc.scenes[doc.scene || 0].nodes.forEach((i) => actor.add(nodes[i]));
  actor.position.fromArray(room.actor);
  actor.rotation.y = room.facing;
  const samplers = clip.samplers.map((s) => ({ ...s, times: accessor(s.input).values, output: accessor(s.output) })),
    duration = Math.max(...samplers.map((s) => s.times.at(-1)));
  function pose(seconds) {
    const time = seconds % duration;
    for (const channel of clip.channels) {
      const s = samplers[channel.sampler],
        size = s.output.size,
        values = s.output.values;
      let i = 0;
      while (i < s.times.length - 1 && s.times[i + 1] <= time) i++;
      const j = Math.min(i + 1, s.times.length - 1),
        alpha = s.interpolation === "STEP" || i === j ? 0 : (time - s.times[i]) / (s.times[j] - s.times[i]),
        lo = values.slice(i * size, (i + 1) * size),
        hi = values.slice(j * size, (j + 1) * size),
        bone = nodes[channel.target.node];
      if (channel.target.path === "rotation") bone.quaternion.fromArray(lo).slerp(new THREE.Quaternion().fromArray(hi), alpha);
      else bone[channel.target.path === "translation" ? "position" : "scale"].fromArray(lo.map((v, k) => v * (1 - alpha) + hi[k] * alpha));
    }
    actor.updateMatrixWorld(true);
  }
  pose(0);
  return { actor, pose, duration, hand: (side) => nodes[doc.nodes.findIndex((n) => n.name === "Hand." + side)] };
}
const world = (bone) => bone.getWorldPosition(new THREE.Vector3()).toArray();
const close = (a, b, epsilon = 1e-10) => assert.ok(Math.abs(a - b) < epsilon, `${a} differs from ${b}`);
const frame = (rig, stroke, seconds, delta = 1 / 60, active = true) => {
  stroke.restore();
  rig.pose(seconds);
  return stroke.update(delta, { active, elapsed: seconds, surfaceY: 3.0128 });
};

test("all five native soak clips have stationary wrists before added motion", () => {
  for (const avatar of manifest.avatars) {
    const rig = nativeRig(avatar.file),
      initial = [world(rig.hand("L")), world(rig.hand("R"))];
    for (let i = 0; i <= 120; i++) {
      rig.pose((i * rig.duration) / 121);
      for (const [index, side] of ["L", "R"].entries()) assert.deepEqual(world(rig.hand(side)), initial[index]);
    }
  }
});

test("native single-hand skim reaches its measured surface, preserves opposite hand and rests exactly", (t) => {
  for (const avatar of manifest.avatars) {
    const rig = nativeRig(avatar.file),
      stroke = createPoolStroke(rig.actor),
      restRight = world(rig.hand("R")),
      restLeft = world(rig.hand("L"));
    assert.deepEqual(frame(rig, stroke, 0), []);
    let count = 0,
      peak = 0,
      leftRange = 0;
    const start = stroke.evidence().restPalm;
    for (let i = 1; i <= 600; i++) {
      const contacts = frame(rig, stroke, i / 60),
        evidence = stroke.evidence();
      assert.deepEqual(world(rig.hand("R")), restRight, avatar.id);
      assert.ok(evidence.wristError < 1e-5, `${avatar.id} anatomical target reachable`);
      leftRange = Math.max(leftRange, Math.hypot(evidence.palm[0] - start[0], evidence.palm[2] - start[2]));
      for (const c of contacts) {
        count++;
        peak = Math.max(peak, Math.hypot(c.vx, c.vz));
        close(c.x, evidence.palm[0]);
        close(c.z, evidence.palm[2]);
        assert.ok(c.submergence > 0 && c.submergence < 0.2);
        if (evidence.phase === "skim" || evidence.phase === "return") close(c.y, 3.0128 - 0.008, 1e-5);
      }
    }
    assert.ok(count > 250, avatar.id);
    assert.ok(peak > 0.12 && peak < 0.14, avatar.id);
    close(leftRange, 0.18, 1e-5);
    assert.deepEqual(world(rig.hand("L")), restLeft);
    assert.equal(stroke.evidence().phase, "rest");
    t.diagnostic(JSON.stringify({ avatar: avatar.id, samples: 600, measuredContacts: count, maximumSpeed: peak, horizontalSweep: leftRange }));
    stroke.reset();
    assert.deepEqual(world(rig.hand("L")), restLeft);
  }
});

test("hold after restore, reset, stalled input and resumed samples cannot inject placement kicks", () => {
  const rig = nativeRig("sirui-ghibli.glb"),
    stroke = createPoolStroke(rig.actor);
  frame(rig, stroke, 0);
  for (let i = 1; i <= 240; i++) frame(rig, stroke, i / 60);
  const before = world(rig.hand("L")),
    seconds = stroke.evidence().seconds;
  for (let i = 0; i < 3; i++) {
    stroke.restore();
    assert.deepEqual(stroke.update(0, { active: false, elapsed: 4, surfaceY: 3.0128 }), []);
    before.forEach((v, axis) => close(world(rig.hand("L"))[axis], v, 1e-12));
  }
  assert.equal(stroke.evidence().seconds, seconds);
  assert.deepEqual(frame(rig, stroke, 4 + 1 / 60), []);
  assert.ok(frame(rig, stroke, 4 + 2 / 60).length === 1);
  assert.deepEqual(frame(rig, stroke, 8, 4), []);
  stroke.reset();
  rig.pose(0);
  assert.deepEqual(stroke.update(1 / 60, { active: true, elapsed: 500, surfaceY: 3.0128 }), []);
  assert.equal(stroke.evidence().seconds, 0);
  assert.equal(stroke.evidence().phase, "rest");
  assert.throws(() => stroke.update(-1, { surfaceY: 3 }), RangeError);
  assert.throws(() => stroke.update(NaN, { surfaceY: 3 }), RangeError);
  assert.throws(() => stroke.update(0, { surfaceY: Infinity }), RangeError);
});

test("native walk-to-soak blend settles its anchor before skimming, with no below-floor forcing", () => {
  for (const avatar of manifest.avatars) {
    const rig = nativeRig(avatar.file),
      walk = nativeRig(avatar.file, "walk"),
      stroke = createPoolStroke(rig.actor),
      incoming = new Map();
    walk.pose(3.31);
    walk.actor.traverse((bone) =>
      incoming.set(bone.name, { position: bone.position.clone(), quaternion: bone.quaternion.clone(), scale: bone.scale.clone() })
    );
    for (let i = 0; i <= 300; i++) {
      const seconds = i / 60;
      stroke.restore();
      rig.pose(seconds);
      if (seconds < 0.45)
        rig.actor.traverse((bone) => {
          const from = incoming.get(bone.name),
            weight = 1 - seconds / 0.45;
          bone.position.lerp(from.position, weight);
          bone.quaternion.slerp(from.quaternion, weight);
          bone.scale.lerp(from.scale, weight);
        });
      const contacts = stroke.update(i ? 1 / 60 : 0, { active: true, elapsed: seconds, surfaceY: 3.0128, depth: 0.127487 });
      if (seconds < 1.2) assert.deepEqual(contacts, [], avatar.id);
      for (const contact of contacts) assert.ok(contact.y >= 3.0128 - 0.127487, avatar.id);
    }
    close(stroke.evidence().palm[1], 3.0128 - 0.008, 1e-5);
    assert.ok(stroke.evidence().maximumSpeed < 0.14, avatar.id);
    stroke.reset();
    rig.actor.position.y -= 0.4;
    for (let i = 0; i <= 300; i++) {
      stroke.restore();
      rig.pose(i / 60);
      assert.deepEqual(stroke.update(i ? 1 / 60 : 0, { active: true, elapsed: i / 60, surfaceY: 3.0128, depth: 0.127487 }), []);
    }
  }
});

const contact = { x: 0.22, z: -0.2, vx: -0.13, vz: 0, submergence: 0.026, spread: 0.1 };
test("submerged face drag creates a directional wake, preserves mass and keeps blocked faces zero", () => {
  const water = createHeightfieldWater({ depth: 0.12747, obstacle: { x: 0, z: -0.1, radius: 0.17 } }),
    volume = water.evidence().volume;
  water.advance(1 / 60, { contacts: [contact] });
  assert.ok(water.state.u.reduce((s, v) => s + v, 0) < 0, "initial momentum follows the actual hand direction");
  for (let i = 1; i < 120; i++) water.advance(1 / 60, { contacts: [contact] });
  const forced = water.evidence();
  close(forced.volume, volume, 1e-12);
  assert.ok(forced.coupling.velocityChange > 0);
  assert.ok(forced.coupling.coupledFaces > 0 && forced.coupling.couplingSteps > 0);
  assert.ok(forced.energy > 1e-5);
  assert.equal(forced.boundarySpeed, 0);
  assert.ok(forced.maximumDepth - forced.minimumDepth > 0.001);
  assert.ok(forced.finite && forced.minimumDepth > 0);
  for (let i = 0; i < 600; i++) water.advance(1 / 60);
  assert.ok(water.evidence().energy < forced.energy * 0.02);
  assert.equal(water.evidence().coupling.contactCount, 0);
});

test("drag shares fixed CFL ticks across render partitions and adds no recovery queue", () => {
  const runs = [30, 60, 144].map((hz) => {
    const water = createHeightfieldWater({ depth: 0.12747 });
    for (let i = 0; i < hz * 2; i++) water.advance(1 / hz, { contacts: [contact] });
    return water;
  });
  for (const water of runs.slice(1)) {
    assert.deepEqual(water.state.h, runs[0].state.h);
    assert.deepEqual(water.state.u, runs[0].state.u);
    assert.deepEqual(water.state.v, runs[0].state.v);
  }
  const before = runs[0].evidence(),
    heights = runs[0].state.h.slice();
  runs[0].advance(0, { contacts: [contact] });
  assert.deepEqual(runs[0].evidence(), before);
  assert.deepEqual(runs[0].state.h, heights);
  runs[0].advance(4, { contacts: [] });
  close(runs[0].evidence().droppedTime, 3.75);
  assert.ok(runs[0].evidence().retainedTime < 1 / 120);
  for (const bad of [
    { ...contact, vx: NaN },
    { ...contact, vx: 1 },
    { ...contact, spread: 0.01 },
    { ...contact, submergence: -1 },
  ])
    assert.throws(() => runs[0].advance(1 / 60, { contacts: [bad] }), RangeError);
  assert.throws(() => runs[0].advance(-1, { contacts: [contact] }), RangeError);
  assert.throws(() => runs[0].advance(NaN, { contacts: [contact] }), RangeError);
});

test("dry and stationary contacts never manufacture fluid energy", () => {
  for (const c of [
    { ...contact, submergence: 0 },
    { ...contact, vx: 0, vz: 0 },
  ]) {
    const water = createHeightfieldWater({ depth: 0.12747 });
    for (let i = 0; i < 60; i++) water.advance(1 / 60, { contacts: [c] });
    assert.ok(water.state.u.every((v) => v === 0));
    assert.ok(water.state.v.every((v) => v === 0));
    assert.ok(water.state.h.every((h, i) => h === (water.state.wet[i] ? 0.12747 : 0)));
  }
  assert.deepEqual(samplePoolStroke(0), samplePoolStroke(10));
});

test("actual animated palm wakes converge across ordinary render cadences", (t) => {
  const runs = [30, 60, 144].map((hz) => {
    const rig = nativeRig("sirui-ghibli.glb"),
      stroke = createPoolStroke(rig.actor),
      water = createHeightfieldWater({ depth: 0.12747, obstacle: { x: 0, z: -0.1, radius: 0.17 } });
    frame(rig, stroke, 0, 1 / hz);
    for (let i = 1; i <= hz * 7; i++) {
      const contacts = frame(rig, stroke, i / hz, 1 / hz).map((c) => ({ ...c, x: c.x - 3.17, z: c.z - 3.18 }));
      water.advance(1 / hz, { contacts });
    }
    return { hz, water, palm: stroke.evidence().palm };
  });
  const reference = runs.at(-1);
  for (const { hz, water, palm } of runs) {
    palm.forEach((v, i) => close(v, reference.palm[i], 1e-12));
    const e = water.evidence(),
      rms = Math.sqrt(water.state.h.reduce((sum, h, i) => sum + (h - reference.water.state.h[i]) ** 2, 0) / water.state.h.length);
    assert.ok(rms < 0.0001, `${hz} Hz wake differs by ${rms} m RMS`);
    assert.ok(Math.abs(e.relativeMassError) < 1e-11 && e.boundarySpeed === 0);
    assert.ok(e.finite && e.minimumDepth > 0);
    assert.ok(e.maximumDepth - e.minimumDepth > 0.0005);
    t.diagnostic(JSON.stringify({ hz, surfaceRange: e.maximumDepth - e.minimumDepth, rmsVersus144: rms, massError: e.relativeMassError }));
  }
});
