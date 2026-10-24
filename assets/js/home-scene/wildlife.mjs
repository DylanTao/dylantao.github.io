import * as THREE from "../three.module.min.js";
import { beachPoint, habitatPoint } from "./shore.mjs";
import { createModelLoader } from "./model-loader.mjs";
import { rabbitActing, pinnipedActing, sealShuffleOffset, swimmerActing } from "./wildlife-motion.mjs";
import {
  createHabitatRoute,
  plantedFoot,
  raccoonMotion,
  raccoonStride,
  shorebirdMotion,
  gullMotion,
  balconyGullActing,
} from "./wildlife-neighbor-motion.mjs";
import { pelicanMotion, cormorantMotion, seaSurface } from "./wildlife-seabird-motion.mjs";
import { solvePerchLanding, samplePerchActing, perchSurface, perchContactWeight } from "./wildlife-perch-contact.mjs";
import { OCEAN_WAVES, oceanWindState } from "./ocean-spectrum.mjs";
import { coastWind } from "./wind-field.mjs";

// Every animal is one skinned mesh (two primitives) driven by named bones. The acting modules
// return pure functions of active scene time; this module maps them onto bones and contacts.
const SPECIES = ["BrushRabbit", "CaliforniaSeaLion", "HarborSeal", "Raccoon", "WesternGull", "Sandpiper", "BrownPelican", "BrandtsCormorant"];
const down = new THREE.Vector3(0, -1, 0);
const LOOK_BONES = new Set(["Head", "Neck", "NeckBase", "NeckMid"]);

// Object3D.clone shares a skinned mesh's skeleton with its source; rebind each clone to its own
// cloned bones so every instance acts independently. An animal's two primitives share one
// skeleton (one bone texture), as they do in the loaded master.
function cloneSkinned(source) {
  const clone = source.clone(true);
  const from = [],
    to = [];
  source.traverse((object) => from.push(object));
  clone.traverse((object) => to.push(object));
  const map = new Map(from.map((object, index) => [object, to[index]]));
  const skeletons = new Map();
  from.forEach((object, index) => {
    if (!object.isSkinnedMesh) return;
    const mesh = to[index];
    let skeleton = skeletons.get(object.skeleton);
    if (!skeleton) {
      skeleton = new THREE.Skeleton(
        object.skeleton.bones.map((bone) => map.get(bone)),
        object.skeleton.boneInverses.map((matrix) => matrix.clone())
      );
      skeletons.set(object.skeleton, skeleton);
    }
    mesh.bind(skeleton, object.bindMatrix.clone());
    // Generous bind-pose bounds: bones move the body well within 1.6x its rest extent.
    if (!object.geometry.boundingSphere) object.geometry.computeBoundingSphere();
    mesh.boundingSphere = object.geometry.boundingSphere.clone();
    mesh.boundingSphere.radius *= 1.6;
  });
  return clone;
}

function rigOf(model) {
  const bones = {};
  model.traverse((object) => {
    if (!object.isBone) return;
    object.rotation.order = LOOK_BONES.has(object.name) ? "YXZ" : "XYZ";
    bones[object.name] = { object, rest: object.position.clone() };
  });
  return bones;
}
const turn = (bones, name, x = 0, y = 0, z = 0) => bones[name]?.object.rotation.set(x, y, z);
const shift = (bones, name, x = 0, y = 0, z = 0) => {
  const bone = bones[name];
  if (bone) bone.object.position.set(bone.rest.x + x, bone.rest.y + y, bone.rest.z + z);
};
const size = (bones, name, x = 1, y = x, z = x) => bones[name]?.object.scale.set(x, y, z);

export function createWildlife(parent, config) {
  const beach = config.beach,
    habitats = config.terrain.habitats;
  const root = new THREE.Group();
  root.name = "Coastal neighbours";
  parent.add(root);
  let disposed = false,
    modelsReady = false,
    lastTime = 0,
    lastPalette = null,
    perchData = null,
    updateMilliseconds = 0;
  const palette = { night: null, nightStart: -2e4, dayStart: -1e4 };
  const loadedResources = new Set();
  const skeletons = new Set();
  const inspectable = [];
  const bounds = new THREE.Box3();
  const animals = [];
  const make = (kind, id, name, scale = 1, extra = {}) => {
    const group = new THREE.Group();
    group.name = name;
    group.scale.setScalar(scale);
    root.add(group);
    const animal = { kind, id, name, group, bones: null, contacts: [], order: animals.length, seen: -Infinity, ...extra };
    animals.push(animal);
    return animal;
  };
  // Inspection order keeps the original seventeen first; the new populations follow.
  const rabbits = [1, 2].map((seed, i) => make("BrushRabbit", `rabbit-${i}`, "Brush rabbit", 1, { seed }));
  const seaLions = habitats.seaLion.path.map((point, i) =>
    make("CaliforniaSeaLion", `seaLion-${i}`, "California sea lion", 1, { point, index: i, yaw: 0.4 + i * 1.8 })
  );
  const seals = habitats.seal.path.map((point, i) => make("HarborSeal", `seal-${i}`, "Harbor seal", 1, { point, index: i, yaw: 0.4 + i * 1.8 }));
  const raccoon = make("Raccoon", "raccoon-0", "Raccoon");
  // coastal_section exports clifftop paths 25 mm above the retained soil.
  // The articulated master already accounts for its paw thickness.
  const raccoonRoute = createHabitatRoute(habitats.raccoon.path.map(([x, y, z]) => [x, y - 0.025, z]));
  const gulls = Array.from({ length: 4 }, (_, i) => make("WesternGull", `gull-${i}`, "Western gull", 1.55, { index: i }));
  const balcony = make("WesternGull", "balcony-gull-0", "Balcony gull", 1.1);
  const shorebirds = Array.from({ length: 3 }, (_, i) => make("Sandpiper", `sandpiper-${i}`, "Sandpiper", 1.35, { index: i }));
  // Two sea lions travel the swell offshore, west of and east of the house.
  const swimmers = [
    { from: -28, to: -3, z: -21.5 },
    { from: 4, to: 29, z: -23 },
  ].map((lane, i) => make("CaliforniaSeaLion", `swimmer-${i}`, "California sea lion", 1, { lane, index: i }));
  const pelicans = Array.from({ length: 5 }, (_, i) => make("BrownPelican", `pelican-${i}`, "Brown pelican", 1.25, { index: i }));
  const cormorants = Array.from({ length: 4 }, (_, i) =>
    make("BrandtsCormorant", `cormorant-${i}`, "Brandt's cormorant", 1.3, { index: i, yaw: Math.PI + [-0.3, 0.45, 0.2, -0.5][i] })
  );

  // A crown of white water where a pelican or a porpoising sea lion meets the sea.
  const splashGeometry = new THREE.LatheGeometry(
    [
      [0.02, 0],
      [0.2, 0.03],
      [0.32, 0.12],
      [0.36, 0.24],
      [0.3, 0.2],
      [0.18, 0.06],
      [0.02, 0.01],
    ].map(([x, y]) => new THREE.Vector2(x, y)),
    14
  );
  const splashMaterial = new THREE.MeshStandardMaterial({ color: 0xf2f6f5, roughness: 0.35, transparent: true, opacity: 0.85, depthWrite: false });
  // Each crown fades on its own, so each has its own copy of the shared material.
  const splashMaterials = [0, 1, 2].map(() => splashMaterial.clone());
  const splashes = splashMaterials.map((material) => {
    const mesh = new THREE.Mesh(splashGeometry, material);
    mesh.name = "Coastal splash";
    mesh.visible = false;
    mesh.userData.noOcclusion = true;
    root.add(mesh);
    return mesh;
  });

  function animalTarget(animal) {
    const { group, id, name } = animal;
    group.traverse((object) => {
      if (object.isMesh) object.userData.action = { type: "wildlife", id, name };
    });
    group.updateWorldMatrix(true, true);
    const inverse = group.matrixWorld.clone().invert(),
      localBounds = new THREE.Box3();
    group.traverse((object) => {
      if (!object.isMesh) return;
      if (!object.geometry.boundingBox) object.geometry.computeBoundingBox();
      const localMatrix = new THREE.Matrix4().multiplyMatrices(inverse, object.matrixWorld);
      localBounds.union(bounds.copy(object.geometry.boundingBox).applyMatrix4(localMatrix));
    });
    const sphere = localBounds.getBoundingSphere(new THREE.Sphere());
    // Conservative acting clearance is cached once, not all subtrees on every
    // focus-camera frame. Root motion and the selected head stay live.
    inspectable.push({
      group,
      id,
      name,
      center: sphere.center.clone(),
      radius: sphere.radius + 0.13,
      head: group.getObjectByName("Head"),
      eyes: [group.getObjectByName("EyeL"), group.getObjectByName("EyeR")].filter(Boolean),
      muzzle: group.getObjectByName("Muzzle"),
    });
  }
  function describeTarget({ group, id, name, center, radius, head, eyes, muzzle }) {
    group.updateWorldMatrix(true, true);
    const worldCenter = center.clone().applyMatrix4(group.matrixWorld),
      headPoint = new THREE.Vector3();
    if (head) head.getWorldPosition(headPoint);
    // Use the anatomical head relative to the body, rather than the floor/root
    // origin, to establish the actual animal's forward direction.
    const front = head
      ? headPoint.clone().sub(worldCenter).setY(0).normalize()
      : new THREE.Vector3(Math.sin(group.rotation.y), 0, Math.cos(group.rotation.y));
    const eyePoints = eyes.map((eye) => eye.getWorldPosition(new THREE.Vector3())),
      faceAnchors = eyePoints.map((point) => point.toArray());
    if (muzzle) faceAnchors.push(muzzle.getWorldPosition(new THREE.Vector3()).toArray());
    const eyeAnchor = eyePoints.length
      ? eyePoints
          .reduce((sum, point) => sum.add(point), new THREE.Vector3())
          .multiplyScalar(1 / eyePoints.length)
          .toArray()
      : null;
    return {
      id,
      name,
      root: group,
      worldCenter: worldCenter.toArray(),
      radius: radius * group.matrixWorld.getMaxScaleOnAxis(),
      headAnchor: head ? headPoint.toArray() : null,
      eyeAnchor,
      faceAnchors,
      faceAnchorSource: "named acting pivots",
      front: front.toArray(),
    };
  }
  function install(animal, master) {
    const model = cloneSkinned(master.scene);
    model.rotation.y = 0;
    animal.group.add(model);
    animal.model = model;
    animal.bones = rigOf(model);
    const own = new Set();
    // Drawn in the view, the sea mirror or the sun's shadow map: keep acting every frame.
    const shadowed = () => (animal.seen = frame);
    // An animal that skipped this frame's update but is drawn after all (the camera turned to it)
    // acts now, before the draw. The renderer has already culled it and updated its skeleton, so
    // its matrices and bone texture are refreshed for the frame's time too.
    const drawn = () => {
      if (animal.acted !== frame && animal.act) {
        animal.act(animal);
        animal.acted = frame;
        // updateMatrixWorld, not updateWorldMatrix: only it refreshes a skinned mesh's bind inverse.
        animal.group.updateMatrixWorld(true);
        own.forEach((skeleton) => skeleton.update());
        caughtUp++;
      }
      animal.seen = frame;
    };
    model.traverse((object) => {
      if (object.isSkinnedMesh) {
        skeletons.add(object.skeleton);
        own.add(object.skeleton);
      }
      if (object.isMesh) {
        object.castShadow = object.receiveShadow = true;
        object.onBeforeRender = drawn;
        object.onBeforeShadow = shadowed;
      }
    });
    animalTarget(animal);
  }
  function retain(master) {
    master.scene.traverse((o) => {
      if (o.geometry) loadedResources.add(o.geometry);
      for (const m of [o.material].flat().filter(Boolean)) loadedResources.add(m);
    });
    return master;
  }
  const { loader, decoder } = createModelLoader();
  const loadMaster = (name) =>
    loader.loadAsync(new URL(`../../models/home/${name}.glb`, import.meta.url).href).then((master) => {
      retain(master);
      if (disposed) {
        loadedResources.forEach((r) => r.dispose());
        loadedResources.clear();
      }
      return master;
    });
  Promise.all([
    ...SPECIES.map(loadMaster),
    fetch(new URL("../../models/home/wildlife-perch-support.json", import.meta.url)).then((response) => {
      if (!response.ok) throw new Error("The coastal perch supports could not load.");
      return response.json();
    }),
  ])
    .then((loaded) => {
      if (disposed) return;
      perchData = loaded.pop();
      const masters = Object.fromEntries(SPECIES.map((name, i) => [name, loaded[i]]));
      for (const animal of animals) install(animal, masters[animal.kind]);
      // Cormorants roost on the rock patches the perch-support export records at the cliff foot.
      const rocks = perchData.patches.filter((patch) => patch.kind === "rock");
      cormorants.forEach((bird, i) => (bird.patch = rocks[i % Math.max(1, rocks.length)] || null));
      modelsReady = true;
      update(lastTime, lastPalette, { force: true });
    })
    .catch(() => {})
    .finally(() => decoder.dispose());

  // ------------------------------------------------------------ shared limb helpers
  function groundOrientation(yaw, gradient) {
    const forward = new THREE.Vector3(Math.sin(yaw), gradient[0] * Math.sin(yaw) + gradient[1] * Math.cos(yaw), Math.cos(yaw)).normalize();
    const up = new THREE.Vector3(-gradient[0], 1, -gradient[1]).normalize();
    const right = up.clone().cross(forward).normalize();
    return new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(right, up, forward));
  }
  function plantedOrientation(group, foot, gait) {
    const ground = groundOrientation(gait.yaw, gait.gradient);
    foot.quaternion.copy(group.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(ground));
  }
  // Two-segment leg (raccoon) or single tarsus (sandpiper) reaching a world foot target from a hip
  // given in the animal's root space; segment lengths stretch at most slightly.
  function legToFoot(group, upper, lower, paw, worldPoint, fore, hip) {
    const localFoot = group.worldToLocal(new THREE.Vector3(...worldPoint));
    paw.object.position.copy(localFoot);
    if (!lower) {
      const vector = localFoot.clone().sub(upper.rest);
      upper.object.quaternion.setFromUnitVectors(down, vector.clone().normalize());
      upper.object.scale.set(1, vector.length() / 0.121, 1);
      return;
    }
    const target = localFoot.clone().add(new THREE.Vector3(0, 0.012, 0));
    upper.object.position.copy(hip);
    const vector = target.clone().sub(hip),
      distance = Math.max(0.001, vector.length()),
      direction = vector.clone().normalize();
    const a = 0.15,
      b = 0.143,
      stretch = Math.max(1, distance / (a + b - 0.001)),
      upperLength = a * stretch,
      lowerLength = b * stretch,
      reach = Math.min(upperLength + lowerLength - 0.001, distance);
    const along = (upperLength * upperLength - lowerLength * lowerLength + reach * reach) / (2 * reach),
      bend = Math.sqrt(Math.max(0, upperLength * upperLength - along * along));
    const pole = new THREE.Vector3(0, 0, fore ? 1 : -1).addScaledVector(direction, -direction.z * (fore ? 1 : -1)).normalize();
    const knee = hip.clone().addScaledVector(direction, along).addScaledVector(pole, bend);
    upper.object.quaternion.setFromUnitVectors(down, knee.clone().sub(hip).normalize());
    upper.object.scale.set(1, stretch, 1);
    lower.object.position.copy(knee);
    const lowerVector = target.sub(knee);
    lower.object.quaternion.setFromUnitVectors(down, lowerVector.clone().normalize());
    lower.object.scale.set(1, lowerVector.length() / b, 1);
  }
  // Wing pose shared by the birds: fold swings the wing back along the body, raise and beat
  // rotate it about the body axis, sweep flexes the wrist back, twist pitches the chord.
  function birdWings(bones, { fold = 0, raise = 0, beat = 0, lag = 0, sweep = 0, twist = 0, stretchL = 0, stretchR = 0, shrug = 0 } = {}) {
    for (const [label, side] of [
      ["L", -1],
      ["R", 1],
    ]) {
      const stretch = label === "L" ? stretchL : stretchR;
      const f = fold * (1 - stretch * 0.7);
      const open = 1 - f;
      turn(
        bones,
        `Wing${label}`,
        -twist - stretch * 0.3,
        side * (f * 1.42 + sweep * 0.45 + stretch * 0.3),
        side * ((raise + beat + shrug) * open - stretch * 0.55)
      );
      size(bones, `Wing${label}`, 1 - f * 0.3, 1, 1 - f * 0.35);
      turn(bones, `WingTip${label}`, 0, side * (f * 0.15 + sweep * 0.55 + stretch * 0.15), side * (lag * 0.3 * open - stretch * 0.2));
      size(bones, `WingTip${label}`, 1 - f * 0.32 - Math.max(0, sweep) * 0.06, 1, 1);
    }
  }
  function tuckLegs(bones, deploy) {
    const scale = Math.max(0.001, deploy);
    for (const label of ["L", "R"]) {
      size(bones, `Leg${label}`, scale);
      size(bones, `Foot${label}`, scale);
      turn(bones, `Leg${label}`, 0, 0, 0);
      turn(bones, `Foot${label}`, 0, 0, 0);
      const leg = bones[`Leg${label}`],
        foot = bones[`Foot${label}`];
      if (leg && foot) foot.object.position.lerpVectors(leg.rest, foot.rest, deploy);
      shift(bones, `Leg${label}`);
    }
  }

  // ------------------------------------------------------------ rabbits
  // The west scrub loop passes 14 cm from gull 0's clifftop perch. While a gull holds a perch
  // (weighted by its contact weight, so the berth widens as it lands), loop points within 1 m
  // are pushed outward by a smooth monotone map: d -> d + (1 - d)^2 / 2, about half a metre clear.
  const BERTH = 1;
  function giveWay(point, t) {
    const perches = config.terrain.perches;
    for (let i = 0; i < perches.length; i++) {
      const dx = point[0] - perches[i][0],
        dz = point[2] - perches[i][2],
        d = Math.hypot(dx, dz);
      if (d >= BERTH || d < 1e-6) continue;
      let weight = 0;
      for (const gull of gulls) if (gull.index % 3 === i) weight = Math.max(weight, perchContactWeight(t, gull.index));
      const push = (weight * (BERTH - d) ** 2) / (2 * BERTH);
      point[0] += (dx / d) * push;
      point[2] += (dz / d) * push;
    }
    return point;
  }
  function poseRabbit(animal, t) {
    const pose = rabbitActing(t, animal.seed),
      path = habitats[animal.seed === 1 ? "rabbitWest" : "rabbitEast"].path;
    const p = giveWay(habitatPoint(path, pose.progress), t),
      previous = giveWay(habitatPoint(path, pose.progress - 0.012), t),
      next = giveWay(habitatPoint(path, pose.progress + 0.012), t);
    const group = animal.group;
    group.position.set(p[0], p[1] + pose.lift, p[2]);
    group.rotation.order = "YXZ";
    group.rotation.y = Math.atan2(next[0] - previous[0], next[2] - previous[2]);
    group.rotation.x = -Math.atan2(next[1] - previous[1], Math.hypot(next[0] - previous[0], next[2] - previous[2]));
    group.userData.state = pose.state;
    animal.pose = pose;
    const bones = animal.bones;
    if (!bones) return;
    shift(bones, "BodyPose", 0, pose.bodyLift + (pose.breath - 1) * 0.4, 0);
    turn(bones, "Hips", pose.hipsPitch);
    turn(bones, "Chest", pose.chestPitch + (pose.breath - 1) * 0.6);
    turn(bones, "Head", pose.headPitch, pose.headYaw, pose.headRoll);
    turn(bones, "Muzzle", pose.chew * 0.09);
    shift(bones, "Muzzle", 0, pose.twitch * 0.0025, pose.twitch * 0.002);
    size(bones, "Muzzle", 1, 1 + pose.twitch * 0.05, 1);
    turn(bones, "EarL", pose.earLeft, 0, pose.earYawLeft);
    turn(bones, "EarR", pose.earRight, 0, pose.earYawRight);
    turn(bones, "Tail", pose.tail);
    for (const label of ["L", "R"]) size(bones, `Eye${label}`, 1, 1 - pose.blink * 0.88, 1);
    // Fore paws reach and plant ahead; while grooming they rise to wash the face in small circles.
    const raise = pose.pawRaise;
    for (const [label, side] of [
      ["L", -1],
      ["R", 1],
    ]) {
      const circle = pose.groomStroke * 0.012;
      shift(
        bones,
        `FrontPaw${label}`,
        -side * 0.035 * raise,
        pose.foreLift + raise * (0.15 + circle),
        pose.foreReach + raise * (0.06 + circle * 0.5)
      );
      turn(bones, `FrontPaw${label}`, -raise * 1.1);
      shift(bones, `HindPaw${label}`, 0, pose.hindLift, pose.hindReach);
      turn(bones, `HindPaw${label}`, pose.hindToe * 0.55 - pose.tuck * 0.25);
    }
  }

  // ------------------------------------------------------------ pinnipeds
  function posePinniped(animal, t, lion) {
    const pose = pinnipedActing(t, animal.index, lion);
    const group = animal.group;
    let point = animal.point;
    if (!lion) {
      // Shuffle down the beach toward the wash along the shore normal, and back.
      const metres = sealShuffleOffset(t, animal.index);
      if (metres > 0) {
        const rowWidth = beachPoint(point[0], 0, beach)[2] - beachPoint(point[0], 1, beach)[2];
        const fraction = (-point[2] - -beachPoint(point[0], 0, beach)[2]) / rowWidth + metres / rowWidth;
        point = beachPoint(point[0], fraction, beach);
        point[1] += 0.004;
      }
    }
    group.position.fromArray(point);
    group.rotation.y = animal.yaw + (lion ? 0 : pose.shuffle * Math.sin(Math.PI * 2 * pose.humpPhase) * 0.03);
    group.userData.state = pose.state;
    animal.pose = pose;
    const bones = animal.bones;
    if (!bones) return;
    const roll = pose.bodyRoll;
    // Rolling pivots near the body's centreline; lift it so the lower flank stays on the ground.
    shift(bones, "BodyPose", -Math.sin(roll) * (lion ? 0.16 : 0.12), pose.bodyLift + Math.abs(Math.sin(roll)) * (lion ? 0.12 : 0.1), 0);
    turn(bones, "BodyPose", 0, 0, roll);
    turn(bones, "Hips", pose.hipsPitch);
    turn(bones, "Chest", pose.chestPitch + pose.breath * 0.5);
    if (lion) {
      turn(bones, "Neck", pose.neckPitch, pose.neckFollow, 0);
      turn(bones, "Head", pose.headPitch, pose.headYaw - pose.neckFollow, pose.headRoll);
    } else turn(bones, "Head", pose.headPitch + pose.neckPitch * 0.6, pose.headYaw, pose.headRoll);
    turn(bones, "Jaw", pose.jaw);
    for (const label of ["L", "R"]) size(bones, `Eye${label}`, 1, 1 - pose.blink * 0.9, 1);
    for (const [label, side] of [
      ["L", -1],
      ["R", 1],
    ]) {
      const active = label === pose.flipperSide ? 1 : 0.15;
      // Front flippers stay flat as the chest bends; one lifts and waves to fan or while rolled.
      turn(bones, `FrontFlipper${label}`, -pose.chestPitch * (lion ? 0.85 : 0.4), 0, side * pose.flipper * active * (lion ? 1 : 0.8));
      turn(bones, `FrontFlipperTip${label}`, 0, 0, side * pose.flipperTip * active);
      turn(bones, `RearFlipper${label}`, pose.rearFlipper - pose.hipsPitch * 0.5, side * 0.04 * Math.sin(t * 0.8 + side), 0);
    }
  }

  function poseSwimmer(animal, t) {
    const pose = swimmerActing(t, animal.index, animal.lane, sea);
    const group = animal.group;
    group.position.fromArray(pose.position);
    group.rotation.order = "YXZ";
    group.rotation.set(0, pose.yaw, 0);
    group.userData.state = pose.state;
    animal.pose = pose;
    const splash = splashes[1 + animal.index];
    splash.visible = pose.entry > 0.02;
    if (splash.visible) {
      splash.position.set(pose.position[0], pose.surface - 0.02, pose.position[2]);
      splash.scale.set(0.8 + pose.entry, pose.entry * 1.4, 0.8 + pose.entry);
      splash.material.opacity = 0.8 * pose.entry;
    }
    const bones = animal.bones;
    if (!bones) return;
    // Porpoising: the whole body follows the leap's tangent and arches over its top; rafting on its
    // side with a fore flipper held up; a periscope look raises the head clear of the swell.
    turn(bones, "BodyPose", pose.pitch, 0, pose.roll);
    shift(bones, "BodyPose", 0, -0.2 + pose.periscope * 0.1, 0);
    turn(bones, "Chest", pose.spine - pose.periscope * 0.55);
    turn(bones, "Hips", -pose.spine * 0.8 + pose.periscope * 0.25);
    turn(bones, "Neck", -pose.periscope * 0.4 + pose.spine * 0.5, Math.sin(t * 0.7) * 0.2 * pose.periscope, 0);
    turn(bones, "Head", -pose.periscope * 0.25, Math.sin(t * 0.9 + 1) * 0.4 * pose.periscope, 0);
    turn(bones, "Jaw", 0);
    for (const label of ["L", "R"]) size(bones, `Eye${label}`, 1, 1 - pose.blink * 0.9, 1);
    for (const [label, side] of [
      ["L", -1],
      ["R", 1],
    ]) {
      const up = side > 0 === (animal.index % 2 === 1) ? pose.flipperRaise : 0;
      turn(bones, `FrontFlipper${label}`, 0, -side * pose.flipperTuck * 1.15, side * (up * 1.3 - pose.flipperTuck * 0.2));
      turn(bones, `FrontFlipperTip${label}`, 0, 0, side * (up * 0.4 + Math.sin(t * 2 + side) * 0.08));
      turn(bones, `RearFlipper${label}`, pose.spine * 0.6 + Math.sin(t * 5) * 0.12 * pose.flipperTuck, 0, 0);
    }
  }

  // ------------------------------------------------------------ raccoon
  function placeFoot(route, distance, span, lateral, phase, activity, lift, height, stride) {
    const gait = plantedFoot(distance, phase, stride);
    // Limb span follows the landing support plane. Advancing the span along
    // the closed centreline put hind paws in front at the loop's sharp turn.
    const at = route.sample(gait.anchorDistance < 0 ? 0 : gait.anchorDistance),
      point = at.position;
    const dx = Math.sin(at.yaw) * span + Math.cos(at.yaw) * lateral,
      dz = Math.cos(at.yaw) * span - Math.sin(at.yaw) * lateral;
    return {
      position: [point[0] + dx, point[1] + at.gradient[0] * dx + at.gradient[1] * dz + height + gait.lift * lift * activity, point[2] + dz],
      yaw: at.yaw,
      slope: at.slope,
      gradient: at.gradient,
      contact: gait.contact || activity === 0,
      lift: gait.lift * lift * activity,
    };
  }
  const legOffsets = new Map();
  function raccoonHip(bones, leg, fore) {
    // Shoulders and hips ride the chest and hip bones as the trunk rears, digs or curls.
    const body = bones[fore ? "Chest" : "Hips"];
    let offset = legOffsets.get(leg);
    if (!offset) {
      offset = bones[leg].rest.clone().sub(body.rest).sub(bones.BodyPose.rest);
      legOffsets.set(leg, offset);
    }
    return raccoon.group.worldToLocal(body.object.localToWorld(offset.clone()));
  }
  function poseRaccoon(t) {
    const length = raccoonRoute.length,
      stride = raccoonStride(length);
    const pose = raccoonMotion(t, palette.night === true, length, palette);
    const at = raccoonRoute.sample(pose.distance);
    raccoon.group.position.fromArray(at.position);
    raccoon.group.quaternion.copy(groundOrientation(at.yaw, at.gradient));
    raccoon.group.userData.state = pose.state;
    raccoon.pose = pose;
    raccoon.contacts = [];
    const bones = raccoon.bones;
    if (!bones) return;
    const curl = pose.curl;
    shift(bones, "BodyPose", 0, pose.bodyBob - curl * 0.17 + pose.breath * 0.3 * curl, 0);
    turn(bones, "BodyPose", 0, 0, pose.shakeRoll + curl * 0.22);
    turn(bones, "Chest", pose.chestPitch, curl * 0.45, 0);
    turn(bones, "Hips", pose.hipsPitch, pose.hipsYaw - curl * 0.4, 0);
    turn(bones, "Head", pose.headPitch, pose.headYaw, curl * 0.3);
    turn(bones, "Muzzle", pose.sniff * Math.sin(t * 40) * 0.04);
    turn(bones, "EarL", 0, 0, pose.earAnswer);
    turn(bones, "EarR", 0, 0, -pose.earAnswer * 0.6);
    // The tail swings against the hips with each segment lagging the last; asleep it wraps round.
    turn(bones, "Tail", pose.tailLift, pose.tailYaw, 0);
    turn(bones, "TailMid", pose.tailLift * 0.4, pose.tailYaw * 0.7 + pose.tailCurl * 0.6 + Math.sin(t * 0.45 - 1.1) * 0.05, 0);
    turn(bones, "TailTip", 0, pose.tailYaw * 0.5 + pose.tailCurl * 0.7 + Math.sin(t * 0.45 - 1.9) * 0.07, 0);
    for (const label of ["L", "R"]) size(bones, `Eye${label}`, 1, 1 - pose.blink * 0.9, 1);
    raccoon.group.updateWorldMatrix(true, true);
    for (const [label, side] of [
      ["L", -1],
      ["R", 1],
    ])
      for (const fore of [true, false]) {
        const gait = placeFoot(
          raccoonRoute,
          pose.distance,
          fore ? 0.24 : -0.21,
          side * (fore ? 0.15 : 0.17),
          // Lateral sequence walk: left hind, left fore, right hind, right fore.
          (side === 1 ? 0.5 : 0) + (fore ? 0.25 : 0),
          pose.activity,
          0.064,
          0.025,
          stride
        );
        const paw = `${fore ? "FrontPaw" : "HindPaw"}${label}`;
        // Asleep the paws tuck under the curled body; rearing or washing lifts the fore paws to the
        // chest; digging scrapes them back and forth along the heading.
        const tuck = curl * (fore ? 0.16 : -0.12);
        const raised = fore ? Math.max(pose.stand, pose.wash * 0.8) : 0;
        const forward = new THREE.Vector3(Math.sin(at.yaw), 0, Math.cos(at.yaw));
        const across = new THREE.Vector3(Math.cos(at.yaw), 0, -Math.sin(at.yaw));
        const position = new THREE.Vector3(...gait.position)
          .addScaledVector(forward, -tuck * 0.9 + (fore ? pose.dig * 0.05 * (side > 0 ? pose.pawScrub : -pose.pawScrub) : 0))
          .addScaledVector(across, -side * curl * 0.06);
        position.y += fore ? pose.dig * Math.max(0, side * pose.pawScrub) * 0.03 : 0;
        if (raised > 0) {
          const chest = bones.Chest.object.localToWorld(new THREE.Vector3(side * 0.06, -0.02 - pose.wash * 0.08, 0.16 + pose.wash * 0.04));
          chest.x += side * pose.pawScrub * 0.01 * pose.wash;
          position.lerp(chest, raised);
        }
        raccoon.contacts.push({ foot: paw, ...gait, position: position.toArray(), contact: gait.contact && raised < 0.2 });
      }
    settleRaccoonBody();
    for (const gait of raccoon.contacts) {
      const leg = gait.foot.replace("FrontPaw", "Foreleg").replace("HindPaw", "Hindleg"),
        fore = gait.foot.startsWith("Front");
      legToFoot(raccoon.group, bones[leg], bones[`Lower${leg}`], bones[gait.foot], gait.position, fore, raccoonHip(bones, leg, fore));
      plantedOrientation(raccoon.group, bones[gait.foot].object, gait);
    }
  }
  function settleRaccoonBody() {
    // Accommodate a planted paw at a steep turn with a small body crouch,
    // along the support normal. The root route and world foot anchors stay fixed.
    const bones = raccoon.bones,
      reach = (0.15 + 0.143 - 0.001) * 1.045;
    let accommodation = 0;
    for (const contact of raccoon.contacts) {
      if (!contact.contact) continue;
      const leg = contact.foot.replace("FrontPaw", "Foreleg").replace("HindPaw", "Hindleg");
      const hip = raccoonHip(bones, leg, contact.foot.startsWith("Front")),
        target = raccoon.group.worldToLocal(new THREE.Vector3(...contact.position));
      target.y += 0.012;
      const horizontal = (target.x - hip.x) ** 2 + (target.z - hip.z) ** 2;
      accommodation = Math.max(accommodation, hip.y - target.y - Math.sqrt(Math.max(0, reach ** 2 - horizontal)));
    }
    raccoon.group.userData.bodyAccommodation = Math.min(0.065, Math.max(0, accommodation));
    bones.BodyPose.object.position.y -= raccoon.group.userData.bodyAccommodation;
    raccoon.group.updateWorldMatrix(true, true);
  }

  // ------------------------------------------------------------ gulls
  function applyBirdSupport(bird, landing, weight) {
    const group = bird.group,
      bones = bird.bones;
    group.updateWorldMatrix(true, true);
    const quaternion = group.getWorldQuaternion(new THREE.Quaternion()),
      inverseQuaternion = quaternion.clone().invert();
    const acting = samplePerchActing(perchData, landing, group.getWorldPosition(new THREE.Vector3()), quaternion, weight);
    bird.contacts = [];
    for (const side of ["L", "R"]) {
      const pose = acting.feet[side],
        foot = bones[`Foot${side}`].object,
        leg = bones[`Leg${side}`].object;
      foot.position.copy(group.worldToLocal(pose.position.clone()));
      foot.quaternion.copy(inverseQuaternion.clone().multiply(pose.quaternion));
      leg.position.copy(group.worldToLocal(pose.hip.clone()));
      leg.quaternion.copy(inverseQuaternion.clone().multiply(pose.legQuaternion));
      // Native decoded tarsus length is preserved; its hidden hip articulates.
      leg.scale.set(1, 1, 1);
      foot.scale.set(1, 1, 1);
      bird.contacts.push({
        foot: `Foot${side}`,
        position: pose.position.toArray(),
        hipAccommodation: pose.hipAccommodation,
        surfaceLift: pose.surfaceLift,
        weight,
      });
    }
  }
  function gullBody(bones, pose) {
    shift(bones, "BodyPose", 0, -(pose.crouch || 0) * 0.025 + (pose.flap || 0) * (pose.downstroke ? 0.006 : -0.004), 0);
    turn(bones, "BodyPose", (pose.crouch || 0) * 0.16, 0, pose.shake || 0);
    turn(bones, "Neck", pose.neckPitch || 0, (pose.headYaw || 0) * 0.35, 0);
    turn(bones, "Head", pose.headPitch || 0, (pose.headYaw || 0) * 0.65, pose.headRoll || 0);
    turn(bones, "Jaw", pose.jaw || 0);
    turn(bones, "Tail", pose.tailPitch || 0, 0, pose.tailTwist || 0);
    size(bones, "Tail", 1 + (pose.tailFan || 0), 1, 1);
    for (const label of ["L", "R"]) size(bones, `Eye${label}`, 1, 1 - (pose.blink || 0) * 0.85, 1);
  }
  function poseGull(bird, t) {
    const index = bird.index;
    const point = perchData ? perchData.patches[index % 3].origin : config.terrain.perches[index % config.terrain.perches.length];
    const pose = gullMotion(t, index, point);
    bird.group.position.fromArray(pose.position);
    bird.group.rotation.order = "YXZ";
    bird.group.rotation.set(pose.pitch, pose.yaw, pose.bank);
    bird.group.userData.state = pose.state;
    bird.pose = pose;
    const bones = bird.bones;
    if (!bones) return;
    gullBody(bones, pose);
    birdWings(bones, {
      fold: pose.wingFold,
      raise: pose.wingRaise,
      beat: pose.wingBeat,
      lag: pose.wingTipLag,
      sweep: pose.wingSweep,
      twist: pose.wingTwist,
      stretchL: pose.wingStretchL,
      stretchR: pose.wingStretchR,
    });
    if (perchData && pose.contactWeight > 0 && pose.footDeploy > 0.05) {
      if (bird.landingCycle !== pose.landingCycle) {
        bird.landing = solvePerchLanding(perchData, index % 3, pose.landingYaw, bird.group.scale.x);
        bird.landingCycle = pose.landingCycle;
      }
      applyBirdSupport(bird, bird.landing, pose.contactWeight);
    } else {
      bird.contacts = [];
      tuckLegs(bones, pose.footDeploy);
    }
  }
  function poseBalcony(t) {
    const pose = balconyGullActing(t);
    balcony.group.position.fromArray(config.retreat?.galleryPerch || [4.2, 3.46, 1.31]);
    balcony.group.rotation.set(0, 0.4, 0);
    balcony.group.userData.state = pose.state === "perch" ? "perch" : pose.state;
    balcony.pose = pose;
    const bones = balcony.bones;
    if (!bones) return;
    gullBody(bones, pose);
    birdWings(bones, {
      fold: 1 - Math.min(0.65, pose.wingRaise * 0.9),
      raise: pose.wingRaise,
      stretchL: pose.wingStretchL,
      stretchR: pose.wingStretchR,
    });
    if (perchData) {
      balcony.landing ||= solvePerchLanding(perchData, 3, 0.4, balcony.group.scale.x);
      applyBirdSupport(balcony, balcony.landing, 1);
    }
  }

  // ------------------------------------------------------------ sandpipers
  function poseSandpiper(bird, t) {
    const pose = shorebirdMotion(t, bird.index, beach, sea);
    const group = bird.group;
    group.position.fromArray(pose.position);
    group.rotation.set(0, pose.yaw, 0);
    group.userData.state = pose.state;
    bird.pose = pose;
    bird.contacts = [];
    const bones = bird.bones;
    if (!bones) return;
    turn(bones, "BodyPose", pose.bodyPitch);
    turn(bones, "Neck", pose.headPitch * 0.4, pose.headYaw * 0.3, 0);
    turn(bones, "Head", pose.headPitch * 0.6, pose.headYaw * 0.7, 0);
    turn(bones, "Tail", pose.tail);
    for (const label of ["L", "R"]) size(bones, `Eye${label}`, 1, 1 - pose.blink * 0.85, 1);
    birdWings(bones, { fold: 1, raise: pose.activity * 0.05 });
    group.updateWorldMatrix(true, true);
    const scale = group.scale.x;
    for (const [label, side] of [
      ["L", -1],
      ["R", 1],
    ]) {
      // Feet plant at points along the bird's own swash path; quick strides at a sprint.
      const stride = 0.105 * scale;
      const gait = plantedFoot(pose.distance, side === -1 ? 0 : 0.5, stride);
      const anchor = pose.point(Math.max(0, gait.anchorDistance));
      const yaw = pose.yaw;
      const lateral = side * 0.043 * scale;
      const x = anchor[0] + Math.cos(yaw) * lateral,
        z = anchor[2] - Math.sin(yaw) * lateral;
      const support = beachPoint(x, (-z - -beachPoint(x, 0, beach)[2]) / (beachPoint(x, 0, beach)[2] - beachPoint(x, 1, beach)[2]), beach);
      const lift = gait.lift * 0.043 * pose.activity;
      const position = [x, support[1] + 0.009 * scale + lift, z];
      legToFoot(group, bones[`Leg${label}`], null, bones[`Foot${label}`], position);
      plantedOrientation(group, bones[`Foot${label}`].object, { yaw, gradient: [0, 0] });
      bird.contacts.push({ foot: `Foot${label}`, position, contact: gait.contact || pose.activity === 0, lift });
    }
  }

  // ------------------------------------------------------------ pelicans
  function posePelican(bird, t) {
    const pose = pelicanMotion(t, bird.index, sea);
    const group = bird.group;
    group.position.fromArray(pose.position);
    group.rotation.order = "YXZ";
    group.rotation.set(pose.pitch, pose.yaw, pose.bank);
    group.userData.state = pose.state;
    bird.pose = pose;
    if (bird.index === 4) {
      const splash = splashes[0];
      splash.visible = pose.splash > 0.02;
      if (splash.visible) {
        splash.position.set(pose.position[0], seaSurface(pose.position[0], pose.position[2], t, 2.4, sea) - 0.02, pose.position[2]);
        splash.scale.set(1 + (1 - pose.splash) * 1.6, pose.splash * 2.2, 1 + (1 - pose.splash) * 1.6);
        splash.material.opacity = 0.85 * pose.splash ** 1.5;
      }
    }
    const bones = bird.bones;
    if (!bones) return;
    // Flight carries the head back on the shoulders; afloat the neck rises in an S; swallowing
    // points the bill skyward to drain the pouch; diving stretches it ahead.
    const diving = pose.state === "dive" ? 1 : 0;
    turn(bones, "NeckBase", -pose.neck * 0.75 - pose.gulp * 1.05 + diving * 0.3, pose.headYaw * 0.3, 0);
    turn(bones, "NeckMid", pose.neck * 0.55 - pose.gulp * 0.35 - diving * 0.3, pose.headYaw * 0.3, 0);
    turn(bones, "Head", pose.neck * 0.4 - pose.gulp * 0.55 + diving * 0.1, pose.headYaw * 0.4 + pose.shake * Math.sin(t * 30) * 0.4, 0);
    turn(bones, "Jaw", pose.jaw);
    shift(bones, "BodyPose", 0, pose.flap * (pose.downstroke ? 0.01 : -0.006), 0);
    turn(bones, "BodyPose", 0, 0, pose.shake * Math.sin(t * 28) * 0.08);
    for (const label of ["L", "R"]) size(bones, `Eye${label}`, 1, 1 - pose.blink * 0.85, 1);
    birdWings(bones, { fold: pose.wingFold, raise: 0.06 - pose.wingFold * 0.03, beat: pose.wingBeat, lag: pose.wingTipLag, sweep: pose.wingSweep });
    turn(bones, "Tail", pose.patter * -0.3, 0, -pose.bank * 0.3);
    size(bones, "Tail", 1 + pose.patter * 0.4, 1, 1);
    // Feet tuck under the tail in flight and patter along the water at take-off.
    for (const [label, side] of [
      ["L", -1],
      ["R", 1],
    ]) {
      const patter = pose.patter * Math.max(0, Math.sin(t * 15 + (side > 0 ? Math.PI : 0)));
      turn(bones, `Leg${label}`, (pose.onWater ? 0 : 1.2 * (1 - pose.patter)) + patter * 0.5, 0, 0);
      size(bones, `Foot${label}`, pose.onWater ? 1 : 0.4 + pose.patter * 0.6);
    }
  }

  // ------------------------------------------------------------ cormorants
  function poseCormorant(bird, t) {
    const pose = cormorantMotion(t, bird.index);
    const group = bird.group;
    const patch = bird.patch;
    if (patch) group.position.fromArray(patch.origin);
    else group.position.set(-11.77 + bird.index, -6.05, -14.6);
    group.rotation.set(0, bird.yaw, 0);
    group.userData.state = pose.state;
    bird.pose = pose;
    bird.contacts = [];
    const bones = bird.bones;
    if (!bones) return;
    // Upright on the rock: the body pitches about the hip, the neck kinks back up to hold the head
    // level, and the drying wings open from that tilted frame into the heraldic spread.
    turn(bones, "BodyPose", pose.bodyPitch, 0, pose.shake);
    turn(bones, "NeckBase", -0.32 + pose.neckPitch, pose.headYaw * 0.25, 0);
    turn(bones, "NeckMid", 0.36 + pose.neckPitch * 0.5, pose.headYaw * 0.3, 0);
    turn(bones, "Head", 0.88 + pose.headPitch, pose.headYaw * 0.45, pose.preen * 0.2);
    turn(bones, "Jaw", pose.gape + pose.flutter);
    turn(bones, "Tail", 0.62, 0, 0);
    size(bones, "Tail", 1 + pose.tailFan, 1, 1);
    for (const label of ["L", "R"]) size(bones, `Eye${label}`, 1, 1 - pose.blink * 0.85, 1);
    const spread = pose.spread;
    for (const [label, side] of [
      ["L", -1],
      ["R", 1],
    ]) {
      const fold = 1 - spread;
      turn(bones, `Wing${label}`, -0.1 * spread, side * (fold * 1.45 + spread * 0.26), side * spread * (0.44 + pose.shrug + pose.fanBeat * 0.28));
      size(bones, `Wing${label}`, 1 - fold * 0.28, 1, 1 - fold * 0.34);
      turn(bones, `WingTip${label}`, 0, side * (fold * 0.15 + spread * 0.17), side * spread * (-0.62 + pose.fanBeat * 0.22));
      size(bones, `WingTip${label}`, 1 - fold * 0.32, 1, 1);
    }
    // Each foot meets the measured rock under it.
    if (patch) {
      group.updateWorldMatrix(true, true);
      for (const label of ["L", "R"]) {
        const foot = bones[`Foot${label}`];
        const world = group.localToWorld(foot.rest.clone());
        const support = perchSurface(patch, world.x, world.z);
        const lift = support ? (support.height - patch.origin[1]) / group.scale.x : 0;
        shift(bones, `Foot${label}`, 0, lift, 0);
        shift(bones, `Leg${label}`, 0, lift, 0);
        bird.contacts.push({
          foot: `Foot${label}`,
          position: group.localToWorld(bones[`Foot${label}`].object.position.clone()).toArray(),
          supported: Boolean(support),
        });
      }
    }
  }

  // ------------------------------------------------------------ update
  function trackPalette(t, name) {
    if (!name) return;
    const night = name === "evening";
    if (palette.night === null) {
      // The first known hour sets the scene as if it had always been so: no wake-up on load.
      palette.night = night;
      return;
    }
    if (night !== palette.night) {
      palette.night = night;
      if (night) palette.nightStart = t;
      else palette.dayStart = t;
    }
  }
  const clock = typeof performance === "object" ? () => performance.now() : () => 0;
  const breakdown = {};
  const timed = (name, fn) => {
    const started = clock();
    fn();
    breakdown[name] = (breakdown[name] ?? 0) * 0.9 + (clock() - started) * 0.1;
  };
  // Animals nobody drew last frame (off screen, or the camera is indoors) act on every twelfth
  // frame only, staggered, so their roots still travel back into view; drawn ones act every frame,
  // and a skipped one that is drawn anyway catches up just before its draw (install, above).
  let frame = 0,
    skipped = 0,
    caughtUp = 0;
  const due = (animal) => {
    if (!animal.bones || !animal.posed || animal.seen >= frame - 1 || (frame + animal.order) % 12 === 0) {
      animal.posed = Boolean(animal.bones);
      return true;
    }
    skipped++;
    return false;
  };
  const each = (list, pose) => {
    for (const animal of list) {
      animal.act = pose;
      if (due(animal)) {
        pose(animal);
        animal.acted = frame;
      }
    }
  };
  // Where animals meet the sea, for its wakes and rings (environment.mjs): each swimming sea lion's
  // position, heading and speed (from its last two poses), how much V wake it draws (less while it
  // is in the air), and the age of the ring its last re-entry threw; the diving pelican's splash ring.
  // Read from the poses, so it moves with the scene's clock and holds still with it.
  const waterMarks = [];
  function track(animal, x, z, t, entering) {
    const mark = (animal.waterMark ||= { x, z, t, vx: 0, vz: 0, entryAt: -Infinity, entering: false }),
      dt = t - mark.t;
    if (dt > 1e-4 && dt < 0.5) {
      mark.vx = (x - mark.x) / dt;
      mark.vz = (z - mark.z) / dt;
    } else if (dt !== 0) mark.vx = mark.vz = 0;
    if (entering && !mark.entering) mark.entryAt = t;
    Object.assign(mark, { x, z, t, entering });
    return mark;
  }
  function markWater(t) {
    waterMarks.length = 0;
    for (const swimmer of swimmers) {
      const pose = swimmer.pose;
      if (!pose) continue;
      const mark = track(swimmer, pose.position[0], pose.position[2], t, pose.entry > 0.02),
        speed = Math.hypot(mark.vx, mark.vz);
      waterMarks.push({
        x: mark.x,
        z: mark.z,
        dx: speed > 1e-3 ? mark.vx / speed : 1,
        dz: speed > 1e-3 ? mark.vz / speed : 0,
        speed,
        wake: pose.inAir ? 0.35 : 1,
        ring: Number.isFinite(mark.entryAt) ? 1 : 0,
        ringAge: Number.isFinite(mark.entryAt) ? t - mark.entryAt : 10,
      });
    }
    const diver = pelicans[4]?.pose;
    if (diver) {
      const mark = track(pelicans[4], diver.position[0], diver.position[2], t, diver.splash > 0.02);
      waterMarks.push({
        x: mark.x,
        z: mark.z,
        dx: 1,
        dz: 0,
        speed: 0,
        wake: 0,
        ring: Number.isFinite(mark.entryAt) ? 1.4 : 0,
        ringAge: Number.isFinite(mark.entryAt) ? t - mark.entryAt : 10,
      });
    }
  }
  // The sea the renderer draws this frame: the controller syncs the ocean's wind sea from the same
  // coast wind state, so swimmers, pelicans and the sandpipers' swash all read that one surface.
  const seaState = { turn: [1, 0], scale: new Float32Array(OCEAN_WAVES.length) };
  let sea = null;
  function update(t, paletteName = null, { force = false } = {}) {
    const started = clock();
    sea = oceanWindState(coastWind.state.meanSpeed, coastWind.state.yaw, seaState);
    frame++;
    skipped = 0;
    lastTime = t;
    if (paletteName) lastPalette = paletteName;
    trackPalette(t, paletteName);
    if (force) for (const animal of animals) animal.posed = false;
    timed("rabbits", () => each(rabbits, (rabbit) => poseRabbit(rabbit, t)));
    timed("pinnipeds", () => {
      each(seaLions, (lion) => posePinniped(lion, t, true));
      each(seals, (seal) => posePinniped(seal, t, false));
      each(swimmers, (swimmer) => poseSwimmer(swimmer, t));
    });
    timed("raccoon", () => each([raccoon], () => poseRaccoon(t)));
    timed("gulls", () => {
      each(gulls, (gull) => poseGull(gull, t));
      each([balcony], () => poseBalcony(t));
    });
    timed("sandpipers", () => each(shorebirds, (bird) => poseSandpiper(bird, t)));
    timed("pelicans", () => each(pelicans, (bird) => posePelican(bird, t)));
    timed("cormorants", () => each(cormorants, (bird) => poseCormorant(bird, t)));
    markWater(t);
    updateMilliseconds = updateMilliseconds * 0.9 + (clock() - started) * 0.1;
  }
  update(0);
  const summary = (list) =>
    list.map((animal) => ({
      id: animal.id,
      position: animal.group.position.toArray(),
      state: animal.group.userData.state,
      contacts: animal.contacts || [],
    }));
  return {
    update,
    waterMarks: () => waterMarks,
    targets: () => inspectable.map(describeTarget),
    target(id) {
      const record = inspectable.find((item) => item.id === id);
      return record ? describeTarget(record) : null;
    },
    pick(raycaster) {
      return (
        raycaster
          .intersectObjects(
            inspectable.map(({ group }) => group),
            true
          )
          .find((hit) => hit.object.visible && hit.object.userData.action?.type === "wildlife") || null
      );
    },
    evidence: () => ({
      rabbits: rabbits.length,
      raccoons: 1,
      gulls: gulls.length + 1,
      shorebirds: shorebirds.length,
      pelicans: pelicans.length,
      cormorants: cormorants.length,
      swimmingSeaLions: swimmers.length,
      modelsReady,
      seaLions: seaLions.length + swimmers.length,
      harborSeals: seals.length,
      drawPrimitives: (() => {
        let count = 0;
        root.traverse((object) => (count += object.isMesh && object.visible ? 1 : 0));
        return count;
      })(),
      updateMilliseconds,
      updateBreakdown: { ...breakdown },
      skippedLastUpdate: skipped,
      caughtUpAtDraw: caughtUp,
      palette: { ...palette },
      raccoon: {
        position: raccoon.group.position.toArray(),
        state: raccoon.group.userData.state,
        bodyAccommodation: raccoon.group.userData.bodyAccommodation || 0,
        contacts: raccoon.contacts,
      },
      birds: gulls.map((bird) => ({
        position: bird.group.position.toArray(),
        state: bird.group.userData.state,
        perched: bird.pose?.perchedState || null,
        velocity: bird.pose?.velocity,
        contacts: bird.contacts || [],
      })),
      balconyGullContacts: balcony.contacts || [],
      balconyGullState: balcony.group.userData.state,
      shorebirdContacts: shorebirds.map((bird) => ({
        position: bird.group.position.toArray(),
        state: bird.group.userData.state,
        edge: bird.pose?.edge?.(),
        contacts: bird.contacts,
      })),
      contacts: [...seaLions, ...seals].map((a) => ({
        habitat: a.kind === "HarborSeal" ? "seal" : "seaLion",
        position: a.group.position.toArray(),
        state: a.group.userData.state,
      })),
      swimmers: summary(swimmers),
      pelicanStates: summary(pelicans),
      cormorantStates: summary(cormorants),
      rabbitHabitats: rabbits.map((r) => ({
        position: r.group.position.toArray(),
        state: r.group.userData.state,
        airborne: r.pose.airborne,
        contact: r.pose.contact,
        lift: r.pose.lift,
        progress: r.pose.progress,
      })),
    }),
    dispose() {
      if (disposed) return;
      disposed = true;
      splashGeometry.dispose();
      splashMaterial.dispose();
      splashMaterials.forEach((material) => material.dispose());
      skeletons.forEach((skeleton) => skeleton.dispose());
      loadedResources.forEach((r) => r.dispose());
      loadedResources.clear();
      inspectable.length = 0;
      root.removeFromParent();
    },
  };
}
