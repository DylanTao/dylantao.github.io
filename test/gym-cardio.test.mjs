import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createCardioStations, swingStep } from "../assets/js/home-scene/gym-cardio.mjs";
import { createLiftRig } from "../assets/js/home-scene/lift-rig.mjs";
import { loadNativeAvatar, loadNativeModel, repo, THREE } from "./helpers/coastal-native-avatar.mjs";

const config = JSON.parse(readFileSync(new URL("assets/models/home/manifest.json", repo)));
const ids = Object.entries(config.activities)
  .filter(([, activity]) => activity.sequence === "cardio")
  .map(([id]) => id);
const moving = { moving: true, reduced: false };
const still = { moving: false, reduced: true };

test("a bag's free response is independent of the display frame interval", () => {
  let sampled = [0, 0.31];
  for (let i = 0; i < 60; i++) sampled = swingStep(...sampled, 1 / 60, 2.76, 0.82);
  const exact = swingStep(0, 0.31, 1, 2.76, 0.82);
  assert.ok(sampled.every((n, i) => Math.abs(n - exact[i]) < 1e-12));
});

test("the native stations stay on the wrists and ankles of all five delivered figures", async () => {
  assert.equal(ids.length, 5);
  const room = (await loadNativeModel("room-gym.glb")).scene;
  const stations = createCardioStations(room);
  for (const avatar of config.avatars) {
    const actor = (await loadNativeAvatar(avatar.id)).scene;
    room.add(actor);
    const rig = createLiftRig(actor);
    for (const id of ids) {
      let response = 0;
      for (let f = 0; f < 96; f++) {
        // Includes both sides of each exercise and the bike's out-of-saddle burst.
        const seconds = (id === "riding" ? 17 : 0) + f / 24;
        const pose = stations.update(id, seconds, 1 / 24, { ...moving, avatar: avatar.id });
        actor.position.copy(pose.origin);
        actor.rotation.y = pose.facing;
        actor.updateMatrixWorld(true);
        const contacts = rig.applyStation(pose);
        stations.observeContact(contacts);
        for (const [name, errors] of Object.entries(contacts)) {
          // The high pear meets the ends of the drawn fingers; the shortest
          // fingertips reach it with the wrist about 28 mm behind the palm target.
          const tolerance = id === "speed-bag" && name === "hands" ? 0.035 : 0.025;
          assert.ok(Math.max(...errors) < tolerance, `${avatar.label} ${id} ${name} at ${seconds}s: ${errors}`);
        }
        const state = stations.evidence();
        response = Math.max(
          response,
          Math.abs({ bagwork: state.heavyAngle, "double-end": state.doubleTravel, "speed-bag": state.speedAngle }[id] || 0)
        );
      }
      if (["bagwork", "double-end", "speed-bag"].includes(id)) assert.ok(response > 0.012, `${avatar.label} ${id} responds to contact`);
      stations.update(null, 0, 0, still);
    }
    room.remove(actor);
  }
});

test("a rotor coasts on departure, a paused flywheel holds and a reduced-motion bag stays still", async () => {
  const room = (await loadNativeModel("room-gym.glb")).scene,
    stations = createCardioStations(room);
  for (let i = 0; i < 15; i++) stations.update("riding", i / 30, 1 / 30, moving);
  const speed = stations.evidence().wheelSpeed;
  const wheel = room.getObjectByName("gym_cardio_bike_flywheel");
  const angle = wheel.rotation.x;
  stations.update("riding", 14 / 30, 1, { moving: false, reduced: false });
  assert.equal(wheel.rotation.x, angle);
  stations.update(null, 1, 0.2, moving);
  assert.ok(stations.evidence().wheelSpeed > 0 && stations.evidence().wheelSpeed < speed);
  for (const t of [0.35, 3, 8]) {
    stations.update("bagwork", t, 1 / 30, still);
    assert.equal(stations.evidence().heavyAngle, 0);
    assert.equal(stations.evidence().wheelSpeed, 0);
  }
  assert.equal(createCardioStations(new THREE.Group()), null);
});

test("a slow frame can sound a loaded rowing drive once, while a missed drive stays quiet", async () => {
  const room = (await loadNativeModel("room-gym.glb")).scene;
  const hits = [];
  const stations = createCardioStations(room, { onContact: (name) => hits.push(name) });
  const grip = { hands: [0.012, 0.015] };
  for (const [seconds, dt] of [
    [0, 0],
    [0.52, 0.52],
    [0.74, 0.22],
    [2.42, 1.68],
    [3.54, 1.12],
  ]) {
    stations.update("rowing", seconds, dt, moving);
    stations.observeContact(grip);
  }
  assert.deepEqual(hits, ["rower"]);
  stations.update("rowing", 4.98, 1.44, moving);
  stations.update("rowing", 5.38, 0.4, moving);
  stations.observeContact({ hands: [0.1, 0.015] });
  assert.deepEqual(hits, ["rower"], "a missed wrist never makes a chain contact");
});
