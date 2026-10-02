import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "../assets/js/three.module.min.js";
import { cameraAttentionTarget, createCharacterMotion, createCharacterPerformance } from "../assets/js/home-scene/character-performance.mjs";

test("the gaze acknowledges once, eyes lead the head, then returns to the routine", () => {
  const motion = createCharacterMotion(1);
  assert.equal(motion.notice(1, -0.5), true);
  assert.equal(motion.notice(-1, 1), false);
  const early = motion.advance(0.12);
  assert.ok(early.eye[0] > 0.05);
  assert.equal(early.head[0], 0);
  const hold = motion.advance(0.65);
  assert.equal(hold.phase, "acknowledge");
  assert.ok(hold.head[0] > 0.04);
  motion.advance(3);
  const back = motion.advance(2);
  assert.equal(back.phase, "routine");
  assert.ok(Math.abs(back.eye[0]) < 0.001);
  assert.ok(Math.abs(back.head[0]) < 0.001);
  assert.equal(motion.notice(-1, 1), false, "habituation avoids repeated staring");
});

test("pausing interrupts a glance and composes neutral lids; sleep remains closed", () => {
  const motion = createCharacterMotion(0);
  motion.notice(1, 1);
  motion.advance(0.5);
  const paused = motion.advance(60, { active: false });
  assert.deepEqual(paused.eye, [0, 0]);
  assert.deepEqual(paused.head, [0, 0, 0]);
  assert.deepEqual(paused.blink, [0, 0]);
  assert.equal(paused.seconds, 0.5, "hidden/paused time does not advance the performance");
  assert.deepEqual(motion.advance(0, { active: false, clip: "sleep" }).blink, [1, 1]);
  assert.equal(motion.advance(0.2).phase, "routine");
});

test("a complete blink closes and reopens both sides with bounded asymmetric timing", () => {
  const motion = createCharacterMotion(0);
  motion.advance(2.8);
  const closed = motion.advance(0.11);
  assert.deepEqual(closed.blink, [1, 1]);
  assert.deepEqual(motion.advance(0.3).blink, [0, 0]);
  for (let i = 0; i < 800; i++) {
    const pose = motion.advance(0.017);
    assert.ok(pose.blink.every((v) => Number.isFinite(v) && v >= 0 && v <= 1));
  }
});

test("strength, sleep, walking, coffee preparation and carrying suppress head and breathing offsets", () => {
  for (const clip of ["pullup", "dip", "workout", "coffee-prep", "carry", "walk", "sleep"]) {
    const motion = createCharacterMotion(4);
    motion.notice(1, 1);
    const pose = motion.advance(0.7, { clip });
    assert.deepEqual(pose.head, [0, 0, 0]);
    assert.equal(pose.breath, 0);
  }
});

test("the additive rig restores exactly, does not accumulate and leaves wrists unchanged", () => {
  const actor = new THREE.Group();
  const head = new THREE.Bone();
  head.name = "Head";
  const eye = new THREE.Bone();
  eye.name = "EyeL";
  head.add(eye);
  const hand = new THREE.Bone();
  hand.name = "HandR";
  hand.position.set(0.2, 0.9, -0.3);
  actor.add(head, hand);
  const lid = new THREE.Object3D();
  lid.morphTargetDictionary = { BlinkL: 0, BlinkR: 1 };
  lid.morphTargetInfluences = [0, 0];
  actor.add(lid);
  const startHead = head.quaternion.clone(),
    startPosition = head.position.clone(),
    startHand = hand.position.clone();
  const performance = createCharacterPerformance(actor, "ghibli");
  performance.notice(1, 0.5);
  for (let i = 0; i < 200; i++) {
    performance.restore();
    assert.ok(head.quaternion.equals(startHead));
    assert.ok(head.position.equals(startPosition));
    performance.update(0.017, { active: true, clip: "typing" });
    assert.ok(hand.position.equals(startHand));
  }
  performance.restore();
  performance.update(0, { active: false, clip: "typing" });
  assert.ok(head.quaternion.equals(startHead));
  assert.deepEqual(lid.morphTargetInfluences, [0, 0]);
  performance.dispose();
  assert.ok(head.position.equals(startPosition));
  assert.equal(performance.evidence().eyelidMeshes, 0);
});

test("exported +Z optics look right and up through yaw and pitch, rather than rolling", () => {
  const actor = new THREE.Group(),
    head = new THREE.Bone(),
    eye = new THREE.Bone();
  head.name = "Head";
  eye.name = "EyeL";
  actor.add(head);
  head.add(eye);
  const performance = createCharacterPerformance(actor, "ghibli");
  performance.notice(1, 1);
  performance.update(0.7, { active: true, clip: "typing" });
  actor.updateMatrixWorld(true);
  const opticalDirection = new THREE.Vector3(0, 0, 1).transformDirection(eye.matrixWorld);
  assert.ok(opticalDirection.x > 0.08, "horizontal invitation turns the optical forward direction right");
  assert.ok(opticalDirection.y > 0.04, "screen-up invitation lifts optical forward");
  performance.dispose();
});

test("actual room camera rays resolve in authored optics, including the reversed study invitation", () => {
  const camera = new THREE.PerspectiveCamera(38, 545 / 462, 0.05, 300);
  const origin = new THREE.Vector3(-0.27, 4.03, 3.38);
  const headRotation = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI);
  const target = new THREE.Vector3(-0.27, 3.64, 3.26);
  const yaw = 2.34,
    pitch = 0.25,
    radius = 3.6;
  camera.position.set(
    target.x + Math.sin(yaw) * Math.cos(pitch) * radius,
    target.y + Math.sin(pitch) * radius,
    target.z + Math.cos(yaw) * Math.cos(pitch) * radius
  );
  camera.lookAt(target);
  const study = cameraAttentionTarget(0.6, 0.32, camera, origin, headRotation);
  assert.ok(study.angles[0] < 0, "the study camera lies character-left even at this screen-right invitation");
  assert.ok(study.angles[1] > 0);
  assert.ok(study.angles.every((v, i) => Math.abs(v) <= [0.2, 0.12][i]));
  // The same screen point in a front-right camera requires the opposite turn.
  camera.position.set(origin.x - 0.6, origin.y + 0.3, origin.z - 4);
  camera.lookAt(origin);
  const lounge = cameraAttentionTarget(0.6, 0.32, camera, origin, headRotation);
  assert.ok(lounge.angles[0] > 0);
  camera.position.set(origin.x, origin.y, origin.z + 4);
  camera.lookAt(origin);
  assert.equal(cameraAttentionTarget(0.6, 0.32, camera, origin, headRotation), null, "a rear camera cannot elicit an over-the-shoulder stare");
  assert.equal(cameraAttentionTarget(NaN, 0, camera, origin, headRotation), null);
});

test("camera-aware attention follows the current authored head pose, restores it and has detached evidence", () => {
  const actor = new THREE.Group(),
    head = new THREE.Bone(),
    left = new THREE.Bone(),
    right = new THREE.Bone();
  head.name = "Head";
  left.name = "EyeL";
  right.name = "EyeR";
  left.position.set(-0.04, 0.1, 0.08);
  right.position.set(0.04, 0.1, 0.08);
  actor.add(head);
  head.add(left, right);
  actor.rotation.y = Math.PI;
  head.rotation.x = -0.1;
  const camera = new THREE.PerspectiveCamera(38, 1, 0.05, 300);
  camera.position.set(0.7, 0.8, -4);
  camera.lookAt(0, 0.1, 0);
  const baseline = head.quaternion.clone(),
    performance = createCharacterPerformance(actor, "ghibli");
  performance.update(0.01, { active: true, clip: "typing" });
  assert.equal(performance.notice(0.1, 0.1, camera), true);
  performance.restore();
  performance.update(0.7, { active: true, clip: "typing" });
  assert.ok(performance.evidence().eye[0] < 0, "a posed and rotated actor turns toward the actual visitor");
  const evidence = performance.evidence();
  evidence.attentionTarget.angles[0] = 999;
  assert.ok(performance.evidence().attentionTarget.angles[0] < 0);
  performance.restore();
  assert.ok(head.quaternion.equals(baseline));
  performance.update(0, { active: false, clip: "typing" });
  assert.equal(performance.evidence().attentionTarget, null);
  assert.equal(performance.notice(0, 0, camera), false);
  performance.dispose();
});

test("entering a protected contact pose cancels an existing head turn immediately", () => {
  for (const clip of ["pullup", "dip", "workout", "coffee-prep", "carry", "walk", "sleep"]) {
    const motion = createCharacterMotion(4);
    motion.notice(1, 1);
    assert.ok(motion.advance(0.7, { clip: "typing" }).head[0] > 0);
    const contact = motion.advance(0.001, { clip });
    assert.deepEqual(contact.eye, [0, 0]);
    assert.deepEqual(contact.head, [0, 0, 0]);
    assert.equal(contact.breath, 0);
    assert.equal(contact.phase, "routine");
    assert.equal(motion.advance(0.3, { clip: "typing" }).phase, "routine", "the interrupted glance cannot return after a contact pose");
  }
});

test("cup and fork clips retain the authored head contact while the eyes can acknowledge", () => {
  for (const clip of ["drink", "eat"]) {
    const motion = createCharacterMotion(3);
    motion.notice(1, 1);
    motion.advance(0.5, { clip: "typing" });
    const sip = motion.advance(0.15, { clip });
    assert.deepEqual(sip.head, [0, 0, 0]);
    assert.equal(sip.breath, 0);
    assert.equal(sip.phase, "acknowledge");
    assert.ok(sip.eye[0] > 0.15 && sip.eye[1] > 0.1, "eyes acknowledge without displacing the clip's mouth/cup path");
  }
});
