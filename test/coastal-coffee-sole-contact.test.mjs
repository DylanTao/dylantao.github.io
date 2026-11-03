import test from "node:test";
import assert from "node:assert/strict";
import { createFootContacts } from "../assets/js/home-scene/locomotion.mjs";
import { THREE, loadNativeAvatar } from "./helpers/coastal-native-avatar.mjs";
import { nativeGeometry } from "./helpers/coastal-native-geometry.mjs";
import fs from "node:fs";
import crypto from "node:crypto";

test("the missing/invalid optional API preserves the immutable original solver on all five delivered rigs", async () => {
  const source = fs.readFileSync(new URL("../assets/js/home-scene/locomotion.mjs", import.meta.url), "utf8");
  const dispatch =
    "export function createFootContacts(actor, terrain, options) {\n  const measured = measuredFootContacts(actor, terrain, options);\n  if (measured) return measured;";
  assert.ok(source.includes(dispatch));
  const original =
    source
      .split("// The coffee route opts into this delivered-sole profile.")[0]
      .replace(dispatch, "export function createFootContacts(actor, terrain) {")
      .trimEnd() + "\n";
  assert.equal(crypto.createHash("sha256").update(original).digest("hex"), "4653d3ae89f81e4c1276e695673d7dd5c597b3210bbc2e86da26cd5ac1415883");
  // Only the two import specifiers change so the immutable predecessor can run
  // independently from a data URL; its entire function body is hash guarded.
  const executable = original
    .replace('"../three.module.min.js"', JSON.stringify(new URL("../assets/js/three.module.min.js", import.meta.url).href))
    .replace('"./shore.mjs"', JSON.stringify(new URL("../assets/js/home-scene/shore.mjs", import.meta.url).href));
  const legacy = (await import("data:text/javascript;base64," + Buffer.from(executable).toString("base64"))).createFootContacts;
  const invalid = [
    undefined,
    null,
    {},
    [],
    { profile: "unknown", clearance: 0.0035 },
    { profile: "measured-sole", clearance: NaN },
    { profile: "measured-sole", clearance: -0.001 },
    { profile: "measured-sole", clearance: 0.02 },
    { profile: "measured-sole", clearance: 0.0035, extra: true },
  ];
  const frame = (actor) => {
    actor.updateMatrixWorld(true);
    return [...bones(actor)].map(([name, bone]) => [
      name,
      bone.position.toArray(),
      bone.quaternion.toArray(),
      bone.scale.toArray(),
      bone.matrixWorld.toArray(),
    ]);
  };
  for (const id of ids) {
    const { scene: actor, animations } = await loadNativeAvatar(id),
      mixer = new THREE.AnimationMixer(actor);
    mixer.clipAction(animations.find((clip) => clip.name === "walk")).play();
    for (const seconds of [0, 0.4, 1.2, 1.8])
      for (const onStairs of [false, true]) {
        mixer.setTime(seconds);
        actor.position.set(0.3, -0.02, 0.4);
        actor.rotation.set(0, 0.37, 0);
        actor.updateMatrixWorld(true);
        const terrain = floor(0.01),
          initial = locals(actor),
          root = actor.matrixWorld.toArray();
        const restore = () => {
          for (const [bone, value] of initial) {
            bone.position.fromArray(value.p);
            bone.quaternion.fromArray(value.q);
            bone.scale.fromArray(value.s);
          }
          actor.updateMatrixWorld(true);
        };
        legacy(actor, terrain)(onStairs);
        const expected = frame(actor);
        for (const options of invalid) {
          restore();
          const contacts = createFootContacts(actor, terrain, options);
          assert.equal(contacts.transfer, undefined);
          assert.equal(contacts.evidence, undefined);
          contacts(onStairs);
          assert.deepEqual(frame(actor), expected, `${id}:${seconds}:${onStairs}:${JSON.stringify(options)}`);
          assert.deepEqual(actor.matrixWorld.toArray(), root);
        }
        restore();
      }
  }
});

const ids = ["lizard", "south-park", "simpsons", "ghibli", "rick-and-morty"];
const floor = (height) => ({
  supportSurfaces: [
    {
      id: "owning-flat-floor",
      height,
      polygon: [
        [-20, -20],
        [20, -20],
        [20, 20],
        [-20, 20],
      ],
    },
  ],
});
function bones(actor) {
  const result = new Map();
  actor.traverse((bone) => {
    if (bone.isBone) result.set(bone.name.replaceAll(".", ""), bone);
  });
  return result;
}
function locals(actor) {
  return new Map(
    [...bones(actor).values()].map((bone) => [bone, { p: bone.position.toArray(), q: bone.quaternion.toArray(), s: bone.scale.toArray() }])
  );
}
function minimumSoles(actor) {
  const result = { L: Infinity, R: Infinity };
  actor.updateMatrixWorld(true);
  actor.traverse((mesh) => {
    if (!mesh.isSkinnedMesh) return;
    const { position, skinIndex, skinWeight } = mesh.geometry.attributes;
    for (let i = 0; i < position.count; i++) {
      const sides = new Set();
      for (let k = 0; k < 4; k++)
        if (skinWeight.getComponent(i, k) > 0) {
          const name = mesh.skeleton.bones[skinIndex.getComponent(i, k)].name.replaceAll(".", "");
          for (const side of ["L", "R"]) if (name === "Foot" + side) sides.add(side);
        }
      if (!sides.size) continue;
      const p = mesh.getVertexPosition(i, new THREE.Vector3()).applyMatrix4(mesh.matrixWorld);
      for (const side of sides) result[side] = Math.min(result[side], p.y);
    }
  });
  return result;
}

test("the optional coffee sole profile clears the measured stone and wood tops while keeping actual foot orientation", async () => {
  let corrected = 0;
  for (const id of ids) {
    const { scene: actor, animations } = await loadNativeAvatar(id),
      mixer = new THREE.AnimationMixer(actor);
    const named = bones(actor),
      height = id === "lizard" ? 0.0001596212387084961 : 0.002499999478459358;
    const contacts = createFootContacts(actor, floor(height), { profile: "measured-sole", clearance: 0.0035 });
    assert.equal(contacts.evidence().profile, "measured-sole", id);
    assert.ok(
      contacts.evidence().vertices.every((n) => n > 0 && n < 10000),
      id
    );
    mixer.clipAction(animations.find((clip) => clip.name === "walk")).play();
    for (let frame = 0; frame < 120; frame += 4) {
      contacts.restore();
      mixer.update(4 / 60);
      actor.rotation.y = 0.17 + frame * 0.003;
      actor.updateMatrixWorld(true);
      const original = locals(actor),
        root = actor.matrixWorld.toArray(),
        before = minimumSoles(actor);
      const orientations = ["L", "R"].map((side) =>
        named
          .get("Foot" + side)
          .getWorldQuaternion(new THREE.Quaternion())
          .normalize()
      );
      contacts(false);
      const after = minimumSoles(actor);
      for (const [i, side] of ["L", "R"].entries()) {
        assert.ok(after[side] >= height + 0.0035 - 2e-7, `${id}:${frame}:${side}:${after[side]}`);
        const current = named
          .get("Foot" + side)
          .getWorldQuaternion(new THREE.Quaternion())
          .normalize();
        assert.ok(1 - Math.abs(current.dot(orientations[i])) < 1e-12, `${id}:foot orientation`);
        if (before[side] < height) corrected++;
      }
      assert.deepEqual(actor.matrixWorld.toArray(), root);
      for (const [bone, value] of original) {
        assert.deepEqual(bone.position.toArray(), value.p);
        assert.deepEqual(bone.scale.toArray(), value.s);
        if (!/^(Thigh|Shin|Foot)[LR]$/.test(bone.name.replaceAll(".", ""))) assert.deepEqual(bone.quaternion.toArray(), value.q);
      }
      contacts.restore();
      for (const [bone, value] of original) assert.deepEqual(bone.quaternion.toArray(), value.q, `${id}:restore`);
    }
  }
  assert.ok(corrected > 20, "actual delivered gait must exercise the retained penetration control");
});

test("missing, malformed and unsupported profile inputs preserve legacy results exactly", async () => {
  const malformed = [
    null,
    {},
    [],
    { profile: "unknown", clearance: 0.0035 },
    { profile: "measured-sole", clearance: NaN },
    { profile: "measured-sole", clearance: -1 },
    { profile: "measured-sole", clearance: 0.1 },
    { profile: "measured-sole", clearance: 0.0035, unknown: true },
  ];
  for (const options of malformed) {
    const { scene: actor, animations } = await loadNativeAvatar("lizard"),
      mixer = new THREE.AnimationMixer(actor);
    mixer.clipAction(animations.find((clip) => clip.name === "walk")).play();
    mixer.update(1.3);
    actor.updateMatrixWorld(true);
    const before = locals(actor),
      expected = createFootContacts(actor, floor(0));
    expected(false);
    const result = locals(actor);
    for (const [bone, value] of before) bone.quaternion.fromArray(value.q);
    actor.updateMatrixWorld(true);
    createFootContacts(actor, floor(0), options)(false);
    for (const [bone, value] of result) assert.deepEqual(bone.quaternion.toArray(), value.q);
  }
});

test("the measured layer restores constant tracks and never lowers an authored airborne foot", async () => {
  const { scene: actor, animations } = await loadNativeAvatar("lizard"),
    mixer = new THREE.AnimationMixer(actor);
  mixer.clipAction(animations.find((clip) => clip.name === "walk")).play();
  mixer.update(1.2);
  actor.position.y = 0.5;
  actor.updateMatrixWorld(true);
  const before = locals(actor),
    contacts = createFootContacts(actor, floor(0), { profile: "measured-sole", clearance: 0.0035 });
  const initial = minimumSoles(actor);
  for (let i = 0; i < 20; i++) {
    contacts(false);
    assert.deepEqual(minimumSoles(actor), initial);
    for (const [bone, value] of before) assert.deepEqual(bone.quaternion.toArray(), value.q);
    contacts.restore();
    mixer.update(0);
  }
  const q = JSON.stringify([...locals(actor)].map(([bone, value]) => [bone.name, value]));
  // Holding Pause means no restore/apply/mixer call: reading is side-effect free.
  contacts.evidence();
  contacts.evidence();
  assert.equal(JSON.stringify([...locals(actor)].map(([bone, value]) => [bone.name, value])), q);
});

test("each shoe fits its own tread and updates use the cached delivered profile", async () => {
  const { scene: actor, animations } = await loadNativeAvatar("lizard"),
    mixer = new THREE.AnimationMixer(actor);
  mixer.clipAction(animations.find((clip) => clip.name === "walk")).play();
  mixer.update(1.3);
  actor.updateMatrixWorld(true);
  const terrain = {
    supportSurfaces: [
      {
        id: "left-floor",
        height: 0,
        polygon: [
          [-20, -20],
          [0, -20],
          [0, 20],
          [-20, 20],
        ],
      },
      {
        id: "right-tread",
        height: 0.17,
        polygon: [
          [0, -20],
          [20, -20],
          [20, 20],
          [0, 20],
        ],
      },
    ],
  };
  const contacts = createFootContacts(actor, terrain, { profile: "measured-sole", clearance: 0.0035 });
  const sourceTraverse = actor.traverse,
    getters = [];
  actor.traverse((mesh) => {
    if (!mesh.isSkinnedMesh) return;
    for (const attribute of [mesh.geometry.attributes.position, mesh.geometry.attributes.skinIndex, mesh.geometry.attributes.skinWeight]) {
      getters.push([attribute, attribute.getComponent]);
      attribute.getComponent = () => {
        throw Error("profile bindings were read again during update");
      };
    }
  });
  actor.traverse = () => {
    throw Error("full avatar traversal during sole update");
  };
  try {
    contacts(true);
    assert.ok(contacts.evidence().legs.every((row) => row.residual < 2e-7));
  } finally {
    actor.traverse = sourceTraverse;
    for (const [attribute, method] of getters) attribute.getComponent = method;
  }
  const sole = minimumSoles(actor);
  const named = bones(actor);
  for (const side of ["L", "R"]) {
    const height = named.get("Foot" + side).getWorldPosition(new THREE.Vector3()).x > 0 ? 0.17 : 0;
    assert.ok(sole[side] >= height + 0.0035 - 2e-7);
  }
  contacts.restore();
});

const seatedFeet = () => ({
  offsetWorld: { L: [0.06, 0, 0.06], R: [-0.06, 0, 0.06] },
  kneePoleWorld: Object.fromEntries(["L", "R"].map((side) => [side, new THREE.Vector3(side === "L" ? 0.5 : -0.5, -0.2, -1).normalize().toArray()])),
});

test("seated coffee soles bind the actual delivered nickel ring and restore their owned pose", async () => {
  const config = JSON.parse(fs.readFileSync(new URL("../assets/models/home/manifest.json", import.meta.url))),
    room = config.rooms.find((r) => r.id === "kitchen");
  const kitchen = await nativeGeometry("room-kitchen.glb");
  for (const id of ids) {
    const { scene: actor, animations } = await loadNativeAvatar(id),
      mixer = new THREE.AnimationMixer(actor);
    actor.position.fromArray(config.equipment.coffee.seat);
    actor.rotation.y = room.facing;
    mixer.clipAction(animations.find((c) => c.name === "drink")).play();
    mixer.setTime(1.7);
    actor.updateMatrixWorld(true);
    const contacts = createFootContacts(actor, config.terrain, { profile: "measured-sole", clearance: 0.0035 }),
      original = locals(actor),
      named = bones(actor),
      rotations = ["L", "R"].map((side) =>
        named
          .get("Foot" + side)
          .getWorldQuaternion(new THREE.Quaternion())
          .normalize()
      );
    assert.equal(contacts.plant(kitchen, seatedFeet(), 1), true, id);
    const evidence = contacts.evidence().seated;
    assert.ok(evidence.ringTriangles > 100, "native finite ring triangles must be present");
    assert.equal(evidence.legs.length, 2);
    for (const [i, leg] of evidence.legs.entries()) {
      assert.ok(Math.abs(leg.after - 0.0035) < 2e-7, `${id}:${leg.side}:${leg.after}`);
      assert.match(leg.witness.owner, /nickel/);
      assert.ok(
        1 -
          Math.abs(
            named
              .get("Foot" + leg.side)
              .getWorldQuaternion(new THREE.Quaternion())
              .normalize()
              .dot(rotations[i])
          ) <
          1e-12
      );
    }
    for (const [bone, value] of original) {
      assert.deepEqual(bone.position.toArray(), value.p);
      assert.deepEqual(bone.scale.toArray(), value.s);
      if (!/^(Thigh|Shin|Foot)[LR]$/.test(bone.name.replaceAll(".", ""))) assert.deepEqual(bone.quaternion.toArray(), value.q);
    }
    contacts.restore();
    for (const [bone, value] of original) assert.deepEqual(bone.quaternion.toArray(), value.q);
    const traversal = kitchen.traverse;
    kitchen.traverse = () => {
      throw Error("actual ring geometry was scanned again per frame");
    };
    try {
      assert.equal(contacts.plant(kitchen, seatedFeet(), 1), true);
    } finally {
      kitchen.traverse = traversal;
      contacts.restore();
    }
  }
});

test("invalid or unavailable seated contacts leave the actual authored bones unchanged", async () => {
  const { scene: actor } = await loadNativeAvatar("lizard"),
    contacts = createFootContacts(actor, floor(0), { profile: "measured-sole", clearance: 0.0035 }),
    before = locals(actor);
  const invalid = [
    null,
    {},
    [],
    { ...seatedFeet(), extra: true },
    { ...seatedFeet(), offsetWorld: { L: [0.2, 0, 0.06], R: [-0.06, 0, 0.06] } },
    { ...seatedFeet(), offsetWorld: { L: [0.06, 0.01, 0.06], R: [-0.06, 0, 0.06] } },
    { ...seatedFeet(), kneePoleWorld: { L: [0, 0, 0], R: [0, 0, -1] } },
  ];
  for (const metadata of invalid) {
    assert.equal(contacts.plant(new THREE.Group(), metadata, 1), false);
    for (const [bone, value] of before) assert.deepEqual(bone.quaternion.toArray(), value.q);
  }
  assert.equal(contacts.plant(null, seatedFeet(), 1), false);
  for (const weight of [-1, NaN, 1.1, 0]) assert.equal(contacts.plant(new THREE.Group(), seatedFeet(), weight), false);
});

test("an actual lower breakfast tread wins over the retained broad upper-floor metadata", async () => {
  const { scene: actor, animations } = await loadNativeAvatar("lizard"),
    mixer = new THREE.AnimationMixer(actor);
  mixer.clipAction(animations.find((c) => c.name === "walk")).play();
  mixer.update(1.3);
  actor.position.y = -0.17;
  actor.updateMatrixWorld(true);
  const terrain = floor(0);
  terrain.supportSurfaces.push({
    id: "breakfast-tread-1",
    height: -0.17,
    polygon: [
      [-20, -20],
      [20, -20],
      [20, 20],
      [-20, 20],
    ],
  });
  const contacts = createFootContacts(actor, terrain, { profile: "measured-sole", clearance: 0.0035 });
  contacts(true);
  for (const value of Object.values(minimumSoles(actor))) {
    assert.ok(value >= -0.1665 - 2e-7);
    assert.ok(value < -0.1, "shoe must not be planted on a ghost upper floor");
  }
});

test("a lower-floor approach never plants a projecting shoe on the broad upper floor", async () => {
  const { scene: actor, animations } = await loadNativeAvatar("lizard"),
    mixer = new THREE.AnimationMixer(actor);
  mixer.clipAction(animations.find((c) => c.name === "walk")).play();
  mixer.update(1.3);
  actor.position.y = -1.02;
  actor.updateMatrixWorld(true);
  const terrain = floor(0),
    before = locals(actor),
    minimum = minimumSoles(actor);
  const contacts = createFootContacts(actor, terrain, { profile: "measured-sole", clearance: 0.0035 });
  contacts(false);
  assert.deepEqual(minimumSoles(actor), minimum, "uncovered lower-level shoe stays airborne rather than snapping up one metre");
  assert.ok(contacts.evidence().legs.every((row) => row.unsupported > 0 && row.iterations === 0));
  for (const [bone, value] of before) assert.deepEqual(bone.quaternion.toArray(), value.q);
});

test("actual breakfast tread clearance lifts continuously before the shoe reaches a riser", async (t) => {
  const run = async (prefix) => {
    const { scene: actor, animations } = await loadNativeAvatar("lizard"),
      mixer = new THREE.AnimationMixer(actor),
      walk = mixer.clipAction(animations.find((c) => c.name === "walk"));
    walk.play().setEffectiveTimeScale(1.2);
    const terrain = {
      supportSurfaces: [
        {
          id: "lower-floor",
          height: -1.02,
          polygon: [
            [-20, -20],
            [20, -20],
            [20, 20],
            [-20, 20],
          ],
        },
        {
          id: prefix + "5",
          height: -0.85,
          polygon: [
            [-4.83, -2],
            [-4.55, -2],
            [-4.55, 2],
            [-4.83, 2],
          ],
        },
        {
          id: prefix === "breakfast-tread-" ? "breakfast-top-landing" : "upper-landing",
          height: -0.68,
          polygon: [
            [-4.55, -2],
            [20, -2],
            [20, 2],
            [-4.55, 2],
          ],
        },
      ],
    };
    const fit = createFootContacts(actor, terrain, { profile: "measured-sole", clearance: 0.0035 }),
      named = bones(actor);
    let prior = null,
      maxStep = 0;
    for (let frame = 0; frame <= 90; frame++) {
      fit.restore();
      mixer.update(1 / 60);
      actor.position.set(-5.25 + frame / 120, -1.02, 0);
      actor.rotation.y = Math.PI / 2;
      actor.updateMatrixWorld(true);
      const before = ["L", "R"].map((side) =>
        named
          .get("Foot" + side)
          .getWorldQuaternion(new THREE.Quaternion())
          .normalize()
      );
      fit(actor.position.x >= -4.83);
      const positions = ["L", "R"].map((side) => named.get("Foot" + side).getWorldPosition(new THREE.Vector3()));
      if (prior) maxStep = Math.max(maxStep, ...positions.map((p, i) => p.distanceTo(prior[i])));
      prior = positions;
      for (const [i, side] of ["L", "R"].entries())
        assert.ok(
          1 -
            Math.abs(
              before[i].dot(
                named
                  .get("Foot" + side)
                  .getWorldQuaternion(new THREE.Quaternion())
                  .normalize()
              )
            ) <
            1e-12
        );
    }
    return maxStep;
  };
  const control = await run("tread-"),
    candidate = await run("breakfast-tread-");
  t.diagnostic(
    JSON.stringify({
      actualDeliveredLizardMaxFootStepM: { control, candidate },
      hz: 60,
      scope: "functional tread fixture, not GPU or phone performance",
    })
  );
  assert.ok(control > 0.1, "the retained real-riser discontinuity must be exercised");
  assert.ok(candidate < 0.06, `continuous clearance step ${candidate}; control ${control}`);
});

function floorCovers() {
  const root = new THREE.Group();
  for (const [name, height, size] of [
    ["kitchen__linen", 0.02, [2.8, 0.004, 2.6]],
    ["kitchen__oatmeal_wool_textile", 0.012, [2.4, 0.004, 2.2]],
  ]) {
    const group = new THREE.Group();
    group.name = name;
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size));
    mesh.position.set(-2, height - 0.002, 11);
    group.add(mesh);
    root.add(group);
  }
  root.updateMatrixWorld(true);
  return root;
}

test("coffee soles use actual bounded floor-cover triangles, retain the world foot frame and restore the authored pose", async () => {
  for (const id of ids) {
    const { scene: actor, animations } = await loadNativeAvatar(id),
      mixer = new THREE.AnimationMixer(actor),
      root = floorCovers();
    mixer.clipAction(animations.find((c) => c.name === "walk")).play();
    mixer.update(0.7);
    actor.position.set(-2, 0, 11);
    actor.updateMatrixWorld(true);
    const before = locals(actor),
      rootMatrix = actor.matrixWorld.toArray(),
      named = bones(actor),
      orientations = ["L", "R"].map((s) =>
        named
          .get("Foot" + s)
          .getWorldQuaternion(new THREE.Quaternion())
          .normalize()
      ),
      contacts = createFootContacts(actor, floor(0), { profile: "measured-sole", clearance: 0.0035 });
    contacts(false, root);
    assert.equal(contacts.evidence().floorCover.triangles, 4);
    const sole = minimumSoles(actor);
    for (const [i, side] of ["L", "R"].entries()) {
      assert.ok(sole[side] >= 0.0235 - 2e-7, `${id}:${side}:${sole[side]}`);
      assert.ok(
        1 -
          Math.abs(
            named
              .get("Foot" + side)
              .getWorldQuaternion(new THREE.Quaternion())
              .normalize()
              .dot(orientations[i])
          ) <
          1e-12
      );
    }
    assert.deepEqual(actor.matrixWorld.toArray(), rootMatrix);
    contacts.restore();
    for (const [bone, value] of before) assert.deepEqual(bone.quaternion.toArray(), value.q);
  }
});

test("missing, incomplete or malformed floor-cover roots keep exact existing measured-sole output", async () => {
  const { scene: actor, animations } = await loadNativeAvatar("lizard"),
    mixer = new THREE.AnimationMixer(actor);
  mixer.clipAction(animations.find((c) => c.name === "walk")).play();
  mixer.update(0.7);
  actor.position.set(-2, 0, 11);
  actor.updateMatrixWorld(true);
  const contacts = createFootContacts(actor, floor(0), { profile: "measured-sole", clearance: 0.0035 });
  contacts(false);
  const expected = locals(actor);
  contacts.restore();
  const incomplete = floorCovers();
  incomplete.remove(incomplete.children[1]);
  const high = floorCovers();
  high.position.y = 1;
  for (const root of [undefined, null, {}, [], false, { isObject3D: true }, incomplete, high]) {
    contacts(false, root);
    for (const [bone, value] of expected) assert.deepEqual(bone.quaternion.toArray(), value.q);
    assert.equal(contacts.evidence().floorCover, undefined);
    contacts.restore();
  }
});

test("floor-cover support caches delivered triangles and refits only on an actual transform or versioned geometry change", async () => {
  const { scene: actor, animations } = await loadNativeAvatar("lizard"),
    mixer = new THREE.AnimationMixer(actor);
  mixer.clipAction(animations.find((c) => c.name === "walk")).play();
  mixer.update(0.7);
  actor.position.set(-2, 0, 11);
  actor.updateMatrixWorld(true);
  const contacts = createFootContacts(actor, floor(0), { profile: "measured-sole", clearance: 0.0035 }),
    root = floorCovers();
  contacts(false, root);
  const before = minimumSoles(actor);
  contacts.restore();
  const traverse = root.traverse;
  root.traverse = () => {
    throw Error("unchanged floor geometry was traversed again");
  };
  contacts(false, root);
  assert.deepEqual(minimumSoles(actor), before);
  contacts.restore();
  root.traverse = traverse;
  root.position.y = 0.005;
  contacts(false, root);
  const moved = minimumSoles(actor);
  assert.ok(moved.L >= 0.0285 - 2e-7 && moved.R >= 0.0285 - 2e-7);
  contacts.restore();
  const a = root.children[0].children[0].geometry.attributes.position;
  for (let i = 0; i < a.count; i++) a.setY(i, a.getY(i) + 0.002);
  a.needsUpdate = true;
  contacts(false, root);
  const changed = minimumSoles(actor);
  assert.ok(changed.L >= 0.0305 - 2e-7 && changed.R >= 0.0305 - 2e-7);
});
