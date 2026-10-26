import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { loadNativeAvatar, THREE } from "./helpers/coastal-native-avatar.mjs";
import { nativeGeometry } from "./helpers/coastal-native-geometry.mjs";
import { createDining } from "../assets/js/home-scene/dining.mjs";
import { resolveRoutine, routineRoom } from "../assets/js/home-scene/routine.mjs";
import { eveningPose, planMeal } from "../assets/js/home-scene/dining-motion.mjs";
import { menuFor } from "../assets/js/home-scene/dining-menu.mjs";

const config = JSON.parse(fs.readFileSync(new URL("../assets/models/home/manifest.json", import.meta.url), "utf8"));
const index = JSON.parse(fs.readFileSync(new URL("../assets/models/home/table-setting/index.json", import.meta.url), "utf8"));
const fits = JSON.parse(
  fs.readFileSync(new URL("../artwork/coastal-home/reviews/whiskey-2026-10-26/seating-whiskey-loveseat-lounge.json", import.meta.url), "utf8")
);
const days = Array.from({ length: 28 }, (_, i) => `2026-10-${String(i + 1).padStart(2, "0")}`);
const when = (day, time = "22:00") => new Date(`${day}T${time}:00-07:00`);
const whiskeyDay = days.find((day) => resolveRoutine(config, when(day)).prop === "whiskey");
const routine = resolveRoutine(config, when(whiskeyDay));
const whiskeyVariants = [
  ...new Map(
    days.flatMap((day) => {
      const at = resolveRoutine(config, when(day));
      return at.prop === "whiskey" ? [[menuFor(at.dateKey, at.prop).evening.glass, at]] : [];
    })
  ).entries(),
];
const tick = () => new Promise(setImmediate);

test("only whiskey lounge slots use the furniture station; the authored schedules and public visit stay intact", () => {
  const library = config.rooms.find((r) => r.id === "library");
  for (const day of days) {
    const at = resolveRoutine(config, when(day));
    assert.equal(at.id, "lounge");
    if (at.prop === "whiskey") {
      assert.equal(at.room, "library");
      assert.equal(at.station, "study-whiskey-lounge");
      assert.equal(at.clip, "lounge");
      const seated = routineRoom(config, at);
      assert.deepEqual(seated.actor, config.furniture.find((a) => a.id === at.station).position);
      assert.notDeepEqual(seated.actor, library.actor);
    } else {
      assert.equal(at.room, "lounge");
      assert.equal(at.station, undefined);
    }
  }
  const weekday = days.find((day) => !resolveRoutine(config, when(day)).weekend && resolveRoutine(config, when(day)).prop === "whiskey");
  assert.equal(resolveRoutine(config, when(weekday, "20:10")).id, "soak");
  assert.equal(resolveRoutine(config, when(weekday, "21:00")).id, "dinner");
  assert.equal(resolveRoutine(config, when(weekday, "23:00")).id, "coding");
  assert.deepEqual(config.rooms.find((r) => r.id === "library").actor, library.actor);
});

test("the whiskey choreography supports the glass between full reach/grasp/sip/release beats", () => {
  const plan = planMeal({ meal: "evening", seed: 7, vessel: "rocks", pauseScale: 3 });
  const layout = { whiskey: true, glassRest: [0.76, 0.578, 0.08], rim: 0.088 };
  const anchors = { mouth: [0.28, 1.3, 0.14] };
  const sip = plan.actions.find((a) => a.type === "sip");
  let at = sip.start;
  for (const [beat, duration] of sip.beats) {
    const pose = eveningPose(plan, at + duration * 0.5, anchors, layout);
    assert.equal(pose.glass.holder, ["lift", "drink", "lower"].includes(beat) ? "R" : "table", beat);
    if (pose.glass.holder === "table") assert.deepEqual(pose.glass.base, layout.glassRest);
    if (beat === "drink") assert.ok(pose.hands.R.contact > 0.8 && pose.glass.tilt > 0.3);
    at += duration;
  }
  const rest = plan.actions.find((a) => a.type === "pause");
  const pose = eveningPose(plan, rest.start + 1, anchors, layout);
  assert.equal(pose.hands.R, null);
  assert.equal(pose.glass.holder, "table");
  assert.ok(rest.end - rest.start >= 18, "a whiskey evening leaves long, varied pauses");
});

async function nativeRoom() {
  const root = await nativeGeometry("room-library.glb");
  for (const anchor of config.furniture.filter((a) => a.room === "library" && a.id.startsWith("study-whiskey"))) {
    root.traverse((o) => {
      if (o.userData.furniturePlaceholder === anchor.id) o.visible = false;
    });
    const model = await nativeGeometry(`furniture/${anchor.item}-lod0.glb`);
    const group = new THREE.Group();
    group.userData.furnitureAnchor = anchor.id;
    group.position.fromArray(anchor.position);
    group.rotation.y = anchor.yaw;
    group.add(model);
    root.add(group);
  }
  root.updateMatrixWorld(true);
  return root;
}

test("all five delivered rigs meet the measured ottoman and glass without wrist stretch, and recover from pause and travel", async () => {
  const room = await nativeRoom();
  const models = new Map();
  const loadModel = async (url) => {
    const file = "table-setting/" + url.split("/").at(-1);
    if (!models.has(file)) models.set(file, nativeGeometry(file));
    return { scene: await models.get(file) };
  };
  assert.deepEqual(whiskeyVariants.map(([vessel]) => vessel).sort(), ["highball", "rocks"]);
  for (const [vessel, routine] of whiskeyVariants)
    for (const avatar of config.avatars) {
      const gltf = await loadNativeAvatar(avatar.id);
      const actor = gltf.scene;
      const mixer = new THREE.AnimationMixer(actor);
      mixer.clipAction(gltf.animations.find((c) => c.name === "lounge")).play();
      actor.position.fromArray(routineRoom(config, routine).actor);
      actor.rotation.y = routineRoom(config, routine).facing;
      mixer.setTime(1.5);
      actor.updateMatrixWorld(true);
      const dining = createDining({
        config,
        baseUrl: "https://fixture.test/assets/models/home/manifest.json",
        loadModel,
        roomRoot: () => room,
        fetchIndex: async () => index,
      });
      for (let i = 0; i < 30 && !dining.evidence().ready; i++) {
        dining.pose({ routine, actor, seconds: 0 });
        await tick();
      }
      assert.ok(dining.evidence().ready, avatar.id);
      const expectedFit = fits.avatars[avatar.id].shift;
      assert.deepEqual(index.settings[routine.station].seatFits[avatar.id], [expectedFit[0], expectedFit[2], -expectedFit[1]]);
      let tableFrames = 0,
        heldFrames = 0;
      for (let t = 0; t < 100; t += 0.25) {
        mixer.setTime(1.5);
        dining.pose({ routine, actor, seconds: t });
        dining.props();
        const evidence = dining.evidence();
        for (const foot of Object.values(evidence.feet)) {
          assert.ok(foot.drift < 0.001, `${avatar.id} ankle drift ${foot.drift}`);
          assert.ok(foot.kneeRise > 0.02, `${avatar.id} knee bends above the reach`);
          assert.ok(Math.abs(foot.ankle[1] - foot.support - 0.075) < 0.001);
        }
        for (const contact of Object.values(evidence.contacts))
          assert.ok(contact.wristDrift < 0.003, `${avatar.id} wrist drift ${contact.wristDrift} at ${t}`);
        if (evidence.glass.holder === "table") {
          tableFrames++;
          assert.equal(dining.heldProp(), null);
          assert.ok(Math.abs(dining.contactProbe().items[vessel][1] - 0.578) < 0.003, "the glass base is on the real tabletop");
        } else heldFrames++;
      }
      assert.ok(tableFrames > 20 && heldFrames > 5, `${avatar.id} actually sets the glass down and takes it up`);
      const snapshot = () => {
        const bones = [];
        actor.traverse((o) => {
          if (o.isBone) bones.push([...o.position.toArray(), ...o.quaternion.toArray()]);
        });
        return bones;
      };
      const paused = snapshot();
      for (let i = 0; i < 10; i++) dining.pose({ routine, actor, seconds: 100 + i, paused: true });
      assert.deepEqual(snapshot(), paused, `${avatar.id} paused redraw is exact`);
      dining.pose({ routine, actor, seconds: 101, walking: true });
      dining.props();
      assert.equal(dining.heldProp(), null, "Walk leaves the glass on its support");
      dining.pose({ routine, actor, seconds: 101 });
      assert.ok(Object.values(dining.evidence().feet).every((f) => f.drift < 0.001));
      dining.pose({ routine: { id: "work" }, actor, seconds: 102 });
      assert.equal(dining.evidence().ready, false);
      dining.dispose();
    }
});
