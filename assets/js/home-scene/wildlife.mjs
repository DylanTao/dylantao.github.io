import * as THREE from "../three.module.min.js";
import { beachPoint, habitatPoint } from "./shore.mjs";
import { createModelLoader } from "./model-loader.mjs";
import { rabbitActing, pinnipedActing } from "./wildlife-motion.mjs";
import { createHabitatRoute, plantedFoot, raccoonMotion, shorebirdMotion, gullMotion } from "./wildlife-neighbor-motion.mjs";
import { solvePerchLanding, samplePerchActing, perchContactWeight } from "./wildlife-perch-contact.mjs";

export function createWildlife(parent, config) {
  const beach = config.beach,
    habitats = config.terrain.habitats;
  const root = new THREE.Group();
  root.name = "Coastal neighbours";
  parent.add(root);
  const sphere = new THREE.SphereGeometry(1, 12, 8),
    wingGeo = new THREE.SphereGeometry(1, 12, 6);
  const materials = {
    cream: new THREE.MeshStandardMaterial({ color: 0xe6e6d5, roughness: 0.95 }),
    gray: new THREE.MeshStandardMaterial({ color: 0x877f71, roughness: 1 }),
    ink: new THREE.MeshStandardMaterial({ color: 0x252d2c, roughness: 0.9 }),
    pink: new THREE.MeshStandardMaterial({ color: 0xc8a4a0, roughness: 1 }),
    beak: new THREE.MeshStandardMaterial({ color: 0xd9a65b, roughness: 0.8 }),
    brown: new THREE.MeshStandardMaterial({ color: 0x796655, roughness: 1 }),
  };
  const ellipsoid = (parent, material, position, scale, geometry = sphere) => {
    const m = new THREE.Mesh(geometry, materials[material]);
    m.position.set(...position);
    m.scale.set(...scale);
    m.castShadow = m.receiveShadow = true;
    parent.add(m);
    return m;
  };
  function rabbit(x, seed) {
    const group = new THREE.Group();
    group.name = "Brush rabbit";
    root.add(group);
    ellipsoid(group, "gray", [0, 0.23, 0], [0.23, 0.25, 0.35]);
    ellipsoid(group, "gray", [0, 0.41, 0.22], [0.2, 0.2, 0.19]);
    ellipsoid(group, "cream", [0, 0.4, 0.365], [0.095, 0.07, 0.052]);
    const ears = [];
    for (const side of [-1, 1]) {
      const ear = new THREE.Group();
      ear.position.set(side * 0.105, 0.55, 0.17);
      group.add(ear);
      ellipsoid(ear, "gray", [0, 0.15, 0], [0.058, 0.22, 0.065]);
      ellipsoid(ear, "pink", [0, 0.16, 0.052], [0.025, 0.14, 0.012]);
      ears.push(ear);
      ellipsoid(group, "ink", [side * 0.145, 0.45, 0.335], [0.028, 0.031, 0.025]);
      ellipsoid(group, "gray", [side * 0.16, 0.065, 0.17], [0.11, 0.068, 0.2]);
    }
    ellipsoid(group, "cream", [0, 0.21, -0.34], [0.1, 0.105, 0.1]);
    ellipsoid(group, "pink", [0, 0.43, 0.413], [0.025, 0.018, 0.018]);
    return { group, ears, x, seed };
  }
  const rabbits = [rabbit(-3.2, 1), rabbit(12.3, 2)];
  let disposed = false,
    modelsReady = false,
    lastTime = 0,
    lastPalette = "afternoon";
  const loadedResources = new Set();
  const inspectable = [];
  const bounds = new THREE.Box3();
  function animalTarget(group, id, name) {
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
    // Conservative acting clearance is cached once, not all eight subtrees on
    // every focus-camera frame. Root motion and the selected head stay live.
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
    group.updateWorldMatrix(true, false);
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
  function actingParts(model) {
    const parts = {};
    for (const name of [
      "Head",
      "BodyPose",
      "EarL",
      "EarR",
      "EyeL",
      "EyeR",
      "ForelegL",
      "ForelegR",
      "HindlegL",
      "HindlegR",
      "FrontPawL",
      "FrontPawR",
      "HindPawL",
      "HindPawR",
      "FrontFlipperL",
      "FrontFlipperR",
      "RearFlipperL",
      "RearFlipperR",
      "Tail",
      "LowerForelegL",
      "LowerForelegR",
      "LowerHindlegL",
      "LowerHindlegR",
      "WingL",
      "WingR",
      "WingTipL",
      "WingTipR",
      "LegL",
      "LegR",
      "FootL",
      "FootR",
    ]) {
      const object = model.getObjectByName(name);
      if (object) parts[name] = { object, position: object.position.clone(), rotation: object.rotation.clone() };
    }
    return parts;
  }
  function retain(master) {
    master.scene.traverse((o) => {
      if (o.geometry) loadedResources.add(o.geometry);
      for (const m of [o.material].flat().filter(Boolean)) loadedResources.add(m);
    });
    return master;
  }
  const marine = [];
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
    loadMaster("BrushRabbit"),
    loadMaster("CaliforniaSeaLion"),
    loadMaster("HarborSeal"),
    loadMaster("Raccoon"),
    loadMaster("WesternGull"),
    loadMaster("Sandpiper"),
    fetch(new URL("../../models/home/wildlife-perch-support.json", import.meta.url)).then((response) => {
      if (!response.ok) throw new Error("The coastal perch supports could not load.");
      return response.json();
    }),
  ])
    .then(([rabbitMaster, lionMaster, sealMaster, raccoonMaster, gullMaster, shorebirdMaster, supportData]) => {
      if (disposed) return;
      perchData = supportData;
      for (const [i, rabbit] of rabbits.entries()) {
        rabbit.group.clear();
        const model = rabbitMaster.scene.clone(true);
        // Blender -Y becomes GLB +Z. A former half-turn made rabbits face
        // backwards while traversing their +Z-forward authored hop heading.
        model.rotation.y = 0;
        rabbit.group.add(model);
        rabbit.head = model.getObjectByName("Head");
        rabbit.ears = [];
        rabbit.parts = actingParts(model);
        animalTarget(rabbit.group, `rabbit-${i}`, "Brush rabbit");
      }
      for (const [master, key] of [
        [lionMaster, "seaLion"],
        [sealMaster, "seal"],
      ]) {
        habitats[key].path.forEach((p, i) => {
          const model = master.scene.clone(true);
          model.name = key + " " + i;
          model.position.fromArray(p);
          model.rotation.y = 0.4 + i * 1.8;
          root.add(model);
          marine.push({ model, head: model.getObjectByName("Head"), parts: actingParts(model), point: p, key, index: i });
          animalTarget(model, `${key}-${i}`, key === "seaLion" ? "California sea lion" : "Harbor seal");
        });
      }
      installNeighbor(raccoon, raccoonMaster, "raccoon-0", "Raccoon");
      gulls.forEach((bird, index) => installNeighbor(bird.group, gullMaster, `gull-${index}`, "Western gull", bird));
      installNeighbor(perch.group, gullMaster, "balcony-gull-0", "Balcony gull", perch);
      shorebirds.forEach((bird, index) => installNeighbor(bird.group, shorebirdMaster, `sandpiper-${index}`, "Sandpiper", bird));
      root.traverse((o) => {
        if (o.isMesh) {
          o.castShadow = o.receiveShadow = true;
        }
      });
      modelsReady = true;
      update(lastTime, lastPalette);
    })
    .catch(() => {})
    .finally(() => decoder.dispose());
  const raccoon = new THREE.Group();
  raccoon.name = "Curious raccoon";
  root.add(raccoon);
  // coastal_section exports clifftop paths 25 mm above the retained soil.
  // The articulated master already accounts for its paw thickness.
  const raccoonRoute = createHabitatRoute(habitats.raccoon.path.map(([x, y, z]) => [x, y - 0.025, z]));
  const birdGroup = (name, scale) => {
    const group = new THREE.Group();
    group.name = name;
    group.scale.setScalar(scale);
    root.add(group);
    return { group, parts: null };
  };
  const gulls = Array.from({ length: 4 }, () => birdGroup("Pacific gull", 1.55));
  const perch = birdGroup("Balcony visitor", 1.1);
  let perchData = null;
  const shorebirds = Array.from({ length: 3 }, () => birdGroup("Sandpiper", 1.35));
  const shoreRoutes = shorebirds.map((bird, index) => {
    const x = -6 + index * 4.1;
    return createHabitatRoute([beachPoint(x, 0.38, beach), beachPoint(x + 1.3, 0.38, beach), beachPoint(x - 1.3, 0.38, beach)]);
  });
  function installNeighbor(group, master, id, name, bird) {
    group.clear();
    const model = master.scene.clone(true);
    group.add(model);
    const parts = actingParts(model);
    if (bird) bird.parts = parts;
    else raccoon.parts = parts;
    animalTarget(group, id, name);
  }
  const down = new THREE.Vector3(0, -1, 0);
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
  function legToFoot(group, upper, lower, paw, worldPoint, fore) {
    const localFoot = group.worldToLocal(new THREE.Vector3(...worldPoint));
    paw.object.position.copy(localFoot);
    if (!lower) {
      const vector = localFoot.clone().sub(upper.position);
      upper.object.quaternion.setFromUnitVectors(down, vector.clone().normalize());
      upper.object.scale.y = vector.length() / 0.121;
      return;
    }
    const hip = upper.position.clone(),
      target = localFoot.clone().add(new THREE.Vector3(0, 0.012, 0));
    hip.y -= group.userData.bodyAccommodation || 0;
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
    upper.object.scale.y = stretch;
    lower.object.position.copy(knee);
    const lowerVector = target.sub(knee);
    lower.object.quaternion.setFromUnitVectors(down, lowerVector.clone().normalize());
    lower.object.scale.y = lowerVector.length() / b;
  }
  function placeFoot(group, route, distance, span, lateral, phase, activity, lift, height) {
    const gait = plantedFoot(distance, phase, group === raccoon ? 0.16 : 0.105);
    // Limb span follows the landing support plane. Advancing the span along
    // the closed centreline put hind paws in front at the loop's sharp turn.
    const at = route.sample(group === raccoon && gait.anchorDistance < 0 ? 0 : gait.anchorDistance),
      point = at.position;
    const dx = Math.sin(at.yaw) * span + Math.cos(at.yaw) * lateral,
      dz = Math.cos(at.yaw) * span - Math.sin(at.yaw) * lateral;
    const position = [point[0] + dx, point[1] + at.gradient[0] * dx + at.gradient[1] * dz + height + gait.lift * lift * activity, point[2] + dz];
    if (group !== raccoon) {
      const support = beachPoint(position[0], 0.38, beach);
      position[1] = support[1] + height + gait.lift * lift * activity;
      position[2] = support[2] - Math.sin(at.yaw) * lateral;
    }
    return {
      position,
      yaw: at.yaw,
      slope: group === raccoon ? at.slope : 0,
      gradient: group === raccoon ? at.gradient : [0, 0],
      contact: gait.contact || activity === 0,
      lift: gait.lift * lift * activity,
    };
  }
  function settleRaccoonBody() {
    // Accommodate a planted paw at a steep turn with a small body crouch,
    // along the support normal. The root route and world foot anchors stay fixed.
    const reach = (0.15 + 0.143 - 0.001) * 1.045;
    let accommodation = 0;
    for (const contact of raccoon.contacts) {
      const leg = contact.foot.replace("FrontPaw", "Foreleg").replace("HindPaw", "Hindleg");
      const hip = raccoon.parts[leg].position,
        target = raccoon.worldToLocal(new THREE.Vector3(...contact.position));
      target.y += 0.012;
      const horizontal = (target.x - hip.x) ** 2 + (target.z - hip.z) ** 2;
      accommodation = Math.max(accommodation, hip.y - target.y - Math.sqrt(Math.max(0, reach ** 2 - horizontal)));
    }
    raccoon.userData.bodyAccommodation = Math.min(0.065, accommodation);
    raccoon.parts.BodyPose.object.position.y = raccoon.parts.BodyPose.position.y - raccoon.userData.bodyAccommodation;
    raccoon.updateWorldMatrix(true, true);
  }
  function birdWings(bird, fold, beat, footDeploy = 1) {
    if (!bird.parts) return;
    for (const [label, side] of [
      ["L", -1],
      ["R", 1],
    ]) {
      bird.parts[`Wing${label}`].object.rotation.set(0, side * fold * 1.42, side * (0.07 + beat) * (1 - fold));
      bird.parts[`Wing${label}`].object.scale.set(1 - fold * 0.3, 1, 1 - fold * 0.35);
      bird.parts[`WingTip${label}`].object.scale.x = 1 - fold * 0.32;
      bird.parts[`WingTip${label}`].object.rotation.set(0, side * fold * 0.15, side * beat * 0.22 * (1 - fold));
      for (const key of [`Leg${label}`, `Foot${label}`]) bird.parts[key].object.visible = footDeploy > 0.05;
    }
  }
  function applyBirdSupport(bird, landing, weight) {
    const group = bird.group;
    group.updateWorldMatrix(true, true);
    const quaternion = group.getWorldQuaternion(new THREE.Quaternion()),
      inverseQuaternion = quaternion.clone().invert();
    const acting = samplePerchActing(perchData, landing, group.getWorldPosition(new THREE.Vector3()), quaternion, weight);
    bird.contacts = [];
    for (const side of ["L", "R"]) {
      const pose = acting.feet[side],
        foot = bird.parts[`Foot${side}`].object,
        leg = bird.parts[`Leg${side}`].object;
      foot.position.copy(group.worldToLocal(pose.position.clone()));
      foot.quaternion.copy(inverseQuaternion.clone().multiply(pose.quaternion));
      leg.position.copy(group.worldToLocal(pose.hip.clone()));
      leg.quaternion.copy(inverseQuaternion.clone().multiply(pose.legQuaternion));
      // Native decoded tarsus length is preserved; its hidden hip articulates.
      leg.scale.set(1, 1, 1);
      bird.contacts.push({
        foot: `Foot${side}`,
        position: pose.position.toArray(),
        hipAccommodation: pose.hipAccommodation,
        surfaceLift: pose.surfaceLift,
        weight,
      });
    }
  }
  function update(t, palette = "afternoon") {
    lastTime = t;
    lastPalette = palette;
    for (const r of rabbits) {
      const pose = rabbitActing(t, r.seed),
        path = habitats[r.seed === 1 ? "rabbitWest" : "rabbitEast"].path;
      const p = habitatPoint(path, pose.progress),
        previous = habitatPoint(path, pose.progress - 0.012),
        next = habitatPoint(path, pose.progress + 0.012);
      r.group.position.set(p[0], p[1] + pose.lift, p[2]);
      r.group.userData.state = pose.state;
      r.group.rotation.order = "YXZ";
      r.group.rotation.y = Math.atan2(next[0] - previous[0], next[2] - previous[2]);
      r.group.rotation.x = -Math.atan2(next[1] - previous[1], Math.hypot(next[0] - previous[0], next[2] - previous[2]));
      r.pose = pose;
      if (r.head) {
        r.head.rotation.x = pose.headPitch;
        r.head.rotation.y = pose.headYaw;
      }
      if (r.parts) {
        const body = r.parts.BodyPose;
        if (body) {
          body.object.scale.y = 1 - pose.compression * 0.075;
          body.object.rotation.x = pose.bodyPitch;
        }
        for (const [name, amount] of [
          ["EarL", pose.earLeft],
          ["EarR", pose.earRight],
        ]) {
          const part = r.parts[name];
          if (part) part.object.rotation.z = part.rotation.z + amount;
        }
        for (const label of ["L", "R"]) {
          for (const [name, angle] of [
            [`Foreleg${label}`, -pose.tuck * 0.62],
            [`Hindleg${label}`, pose.tuck * 0.45],
          ]) {
            const part = r.parts[name];
            if (part) part.object.rotation.x = part.rotation.x + angle;
          }
          for (const [name, lift, angle] of [
            [`FrontPaw${label}`, 0.058, -0.7],
            [`HindPaw${label}`, 0.037, 0.42],
          ]) {
            const part = r.parts[name];
            if (part) {
              part.object.position.y = part.position.y + pose.tuck * lift;
              part.object.rotation.x = part.rotation.x + pose.tuck * angle;
            }
          }
        }
      } else r.ears.forEach((ear, i) => (ear.rotation.z = (i ? 1 : -1) * 0.12 + (i ? pose.earRight : pose.earLeft)));
    }
    const raccoonPose = raccoonMotion(t, palette === "evening", raccoonRoute.length),
      raccoonPoint = raccoonRoute.sample(raccoonPose.distance);
    raccoon.position.fromArray(raccoonPoint.position);
    raccoon.rotation.order = "YXZ";
    raccoon.quaternion.copy(groundOrientation(raccoonPoint.yaw, raccoonPoint.gradient));
    raccoon.userData.state = raccoonPose.state;
    raccoon.updateWorldMatrix(true, true);
    raccoon.contacts = [];
    if (raccoon.parts) {
      raccoon.parts.Head.object.rotation.set(raccoonPose.headPitch, raccoonPose.headYaw, 0);
      raccoon.parts.Tail.object.rotation.y = raccoonPose.tailYaw;
      raccoon.parts.EarL.object.rotation.z = raccoonPose.earAnswer;
      raccoon.parts.EarR.object.rotation.z = -raccoonPose.earAnswer * 0.6;
      for (const [label, side] of [
        ["L", -1],
        ["R", 1],
      ])
        for (const fore of [true, false]) {
          const gait = placeFoot(
            raccoon,
            raccoonRoute,
            raccoonPose.distance,
            fore ? 0.24 : -0.21,
            side * (fore ? 0.15 : 0.17),
            (side === 1 ? 0.5 : 0) + (fore ? 0 : 0.25),
            raccoonPose.activity,
            0.064,
            0.025
          );
          const paw = `${fore ? "FrontPaw" : "HindPaw"}${label}`;
          raccoon.contacts.push({ foot: paw, ...gait });
        }
      settleRaccoonBody();
      for (const gait of raccoon.contacts) {
        const leg = gait.foot.replace("FrontPaw", "Foreleg").replace("HindPaw", "Hindleg"),
          fore = gait.foot.startsWith("Front");
        legToFoot(raccoon, raccoon.parts[leg], raccoon.parts[`Lower${leg}`], raccoon.parts[gait.foot], gait.position, fore);
        plantedOrientation(raccoon, raccoon.parts[gait.foot].object, gait);
      }
    }
    marine.forEach((a) => {
      const pose = pinnipedActing(t, a.index, a.key === "seaLion");
      a.model.position.fromArray(a.point);
      a.model.userData.state = pose.state;
      if (a.head) {
        a.head.rotation.x = pose.headPitch;
        a.head.rotation.y = pose.headYaw;
      }
      if (a.parts.BodyPose) {
        a.parts.BodyPose.object.scale.y = 1 + pose.breath;
        a.parts.BodyPose.object.rotation.y = pose.neckFollow;
      }
      for (const name of ["EyeL", "EyeR"]) if (a.parts[name]) a.parts[name].object.scale.y = 1 - pose.blink * 0.9;
      for (const name of ["FrontFlipperL", "FrontFlipperR"])
        if (a.parts[name]) a.parts[name].object.rotation.x = a.parts[name].rotation.x + pose.flipper;
    });
    gulls.forEach((bird, index) => {
      const point = perchData ? perchData.patches[index % 3].origin : config.terrain.perches[index % config.terrain.perches.length];
      const pose = gullMotion(t, index, point);
      bird.group.position.fromArray(pose.position);
      bird.group.rotation.order = "YXZ";
      bird.group.rotation.set(pose.pitch, pose.yaw, pose.bank);
      bird.group.userData.state = pose.state;
      bird.pose = pose;
      birdWings(bird, pose.wingFold, pose.wingBeat, pose.footDeploy);
      if (bird.parts) {
        if (perchData && pose.footDeploy > 0.05) {
          const cycle = Math.floor((Math.max(0, t) + index * 19) / 90);
          if (bird.landingCycle !== cycle) {
            bird.landing = solvePerchLanding(perchData, index % 3, gullMotion(cycle * 90 - index * 19 + 72, index, point).yaw, bird.group.scale.x);
            bird.landingCycle = cycle;
          }
          applyBirdSupport(bird, bird.landing, perchContactWeight(t, index));
        } else bird.contacts = [];
        bird.parts.Head.object.rotation.set(-pose.pitch * 0.35, pose.headYaw, 0);
        for (const label of ["L", "R"]) bird.parts[`Eye${label}`].object.scale.y = 1 - pose.blink * 0.85;
      }
    });
    perch.group.position.set(4.2, 3.46, 1.31);
    perch.group.rotation.y = 0.4;
    perch.group.userData.state = "perch";
    birdWings(perch, 1, 0);
    if (perch.parts) {
      if (perchData) {
        perch.landing ||= solvePerchLanding(perchData, 3, 0.4, perch.group.scale.x);
        applyBirdSupport(perch, perch.landing, 1);
      }
      perch.parts.Head.object.rotation.y = Math.sin(t * 0.25) * 0.18;
    }
    shorebirds.forEach((bird, index) => {
      const pose = shorebirdMotion(t, index),
        route = shoreRoutes[index];
      bird.group.position.fromArray(beachPoint(pose.x, 0.38, beach));
      bird.group.rotation.y = pose.yaw;
      bird.group.userData.state = pose.state;
      bird.group.updateWorldMatrix(true, true);
      bird.contacts = [];
      birdWings(bird, 1, 0);
      if (bird.parts) {
        bird.parts.Head.object.rotation.set(pose.headPitch, pose.headYaw, 0);
        for (const [label, side] of [
          ["L", -1],
          ["R", 1],
        ]) {
          const gait = placeFoot(bird.group, route, pose.distance, 0, side * 0.043 * 1.35, side === -1 ? 0 : 0.5, pose.activity, 0.043, 0.009 * 1.35);
          legToFoot(bird.group, bird.parts[`Leg${label}`], null, bird.parts[`Foot${label}`], gait.position);
          plantedOrientation(bird.group, bird.parts[`Foot${label}`].object, gait);
          bird.contacts.push({ foot: `Foot${label}`, ...gait });
        }
      }
    });
  }
  update(0);
  return {
    update,
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
      modelsReady,
      seaLions: marine.filter((a) => a.key === "seaLion").length,
      harborSeals: marine.filter((a) => a.key === "seal").length,
      raccoon: {
        position: raccoon.position.toArray(),
        state: raccoon.userData.state,
        bodyAccommodation: raccoon.userData.bodyAccommodation || 0,
        contacts: raccoon.contacts,
      },
      birds: gulls.map((bird) => ({
        position: bird.group.position.toArray(),
        state: bird.group.userData.state,
        velocity: bird.pose.velocity,
        contacts: bird.contacts || [],
      })),
      balconyGullContacts: perch.contacts || [],
      shorebirdContacts: shorebirds.map((bird) => ({
        position: bird.group.position.toArray(),
        state: bird.group.userData.state,
        contacts: bird.contacts,
      })),
      contacts: marine.map((a) => ({ habitat: a.key, position: a.model.position.toArray(), state: a.model.userData.state })),
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
      sphere.dispose();
      wingGeo.dispose();
      Object.values(materials).forEach((m) => m.dispose());
      loadedResources.forEach((r) => r.dispose());
      loadedResources.clear();
      inspectable.length = 0;
      root.removeFromParent();
    },
  };
}
