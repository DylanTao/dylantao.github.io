import * as THREE from "../three.module.min.js";
import { beachPoint, habitatPoint } from "./shore.mjs";
import { createModelLoader } from "./model-loader.mjs";
import { rabbitActing, pinnipedActing } from "./wildlife-motion.mjs";

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
    inspectable.push({ group, id, name, center: sphere.center.clone(), radius: sphere.radius + 0.13, head: group.getObjectByName("Head") });
  }
  function describeTarget({ group, id, name, center, radius, head }) {
    group.updateWorldMatrix(true, false);
    const worldCenter = center.clone().applyMatrix4(group.matrixWorld),
      headPoint = new THREE.Vector3(),
      origin = new THREE.Vector3();
    if (head) head.getWorldPosition(headPoint);
    group.getWorldPosition(origin);
    const front = head
      ? headPoint.clone().sub(origin).setY(0).normalize()
      : new THREE.Vector3(Math.sin(group.rotation.y), 0, Math.cos(group.rotation.y));
    return {
      id,
      name,
      root: group,
      worldCenter: worldCenter.toArray(),
      radius: radius * group.matrixWorld.getMaxScaleOnAxis(),
      headAnchor: head ? headPoint.toArray() : null,
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
  Promise.all([loadMaster("BrushRabbit"), loadMaster("CaliforniaSeaLion"), loadMaster("HarborSeal")])
    .then(([rabbitMaster, lionMaster, sealMaster]) => {
      if (disposed) return;
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
  ellipsoid(raccoon, "gray", [0, 0.26, 0], [0.26, 0.27, 0.41]);
  ellipsoid(raccoon, "gray", [0, 0.47, 0.29], [0.23, 0.22, 0.22]);
  for (const side of [-1, 1]) {
    ellipsoid(raccoon, "cream", [side * 0.1, 0.49, 0.47], [0.12, 0.105, 0.035]);
    ellipsoid(raccoon, "ink", [side * 0.1, 0.49, 0.493], [0.107, 0.059, 0.025]);
    ellipsoid(raccoon, "ink", [side * 0.12, 0.64, 0.24], [0.086, 0.098, 0.052]);
    ellipsoid(raccoon, "cream", [side * 0.115, 0.5, 0.518], [0.022, 0.022, 0.012]);
    for (const z of [-0.23, 0.24]) ellipsoid(raccoon, "ink", [side * 0.18, 0.065, z], [0.071, 0.075, 0.11]);
  }
  ellipsoid(raccoon, "cream", [0, 0.38, 0.49], [0.12, 0.085, 0.12]);
  ellipsoid(raccoon, "ink", [0, 0.41, 0.58], [0.045, 0.029, 0.03]);
  const tail = new THREE.Group();
  tail.position.set(0, 0.28, -0.35);
  tail.rotation.x = -0.4;
  raccoon.add(tail);
  for (let i = 0; i < 7; i++) ellipsoid(tail, i % 2 ? "gray" : "ink", [0, -0.035 * i, -0.08 * i], [0.095 - i * 0.004, 0.085, 0.07]);
  function bird(name, material, scale) {
    const g = new THREE.Group();
    g.name = name;
    root.add(g);
    g.scale.setScalar(scale);
    ellipsoid(g, material, [0, 0.14, 0], [0.1, 0.125, 0.25]);
    ellipsoid(g, material, [0, 0.27, 0.2], [0.102, 0.103, 0.112]);
    ellipsoid(g, "beak", [0, 0.26, 0.34], [0.036, 0.03, 0.1]);
    for (const side of [-1, 1]) ellipsoid(g, "ink", [side * 0.086, 0.287, 0.246], [0.019, 0.019, 0.016]);
    const wings = [-1, 1].map((side) => {
      const pivot = new THREE.Group();
      pivot.position.set(side * 0.067, 0.19, 0);
      g.add(pivot);
      ellipsoid(pivot, material, [side * 0.24, 0, -0.04], [0.31, 0.027, 0.14], wingGeo);
      ellipsoid(pivot, "ink", [side * 0.48, -0.006, -0.073], [0.105, 0.022, 0.098], wingGeo);
      return pivot;
    });
    const feet = [-1, 1].map((side) => ellipsoid(g, "beak", [side * 0.055, 0.05, 0.05], [0.021, 0.06, 0.045]));
    return { group: g, wings, feet };
  }
  const gulls = Array.from({ length: 4 }, () => bird("Pacific gull", "cream", 1.55));
  const perch = bird("Balcony visitor", "cream", 1.1);
  const shorebirds = Array.from({ length: 3 }, () => bird("Sandpiper", "brown", 1.35));
  const scratch = new THREE.Vector3();
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
    const rc = t % 48,
      walking = rc < (palette === "evening" ? 18 : 5);
    const ru = (Math.floor(t / 48) + Math.min(1, rc / (palette === "evening" ? 18 : 5))) * 0.25;
    const rp = habitatPoint(habitats.raccoon.path, ru);
    raccoon.position.set(...rp);
    raccoon.userData.state = walking ? "walk" : rc < 26 ? "look" : rc < 33 ? "groom" : "rest";
    if (walking) {
      const next = habitatPoint(habitats.raccoon.path, ru + 0.001);
      raccoon.rotation.y = Math.atan2(next[0] - rp[0], next[2] - rp[2]);
    }
    tail.rotation.y = Math.sin(t * 0.6) * 0.1;
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
    gulls.forEach((b, i) => {
      const a = t * (0.06 + i * 0.008) + i * 1.5;
      b.group.position.set(Math.cos(a) * (12 + i * 1.8), 8 + i * 0.85 + Math.sin(a * 2) * 0.3, -26 - Math.sin(a) * (5 + i));
      scratch.set(-Math.sin(a) * (7 + i * 1.8), 0, -Math.cos(a) * (3 + i));
      b.group.rotation.y = Math.atan2(scratch.x, scratch.z);
      const bc = (t + i * 19) % 90,
        perched = bc >= 68 && bc <= 86;
      const blend = bc < 48 ? 0 : bc < 68 ? (bc - 48) / 20 : bc < 86 ? 1 : 1 - (bc - 86) / 4;
      const perchPoint = new THREE.Vector3().fromArray(config.terrain.perches[i % config.terrain.perches.length]);
      b.group.position.lerp(perchPoint, blend * blend * (3 - 2 * blend));
      if (perched) {
        b.group.userData.state = "perch";
      } else b.group.userData.state = (t + i) % 12 < 3 ? "flap" : "glide";
      b.wings.forEach((w, j) => {
        w.rotation.y = perched ? (j ? 1 : -1) * 1.28 : 0;
        w.rotation.z = (j ? 1 : -1) * (0.12 + (!perched && (t + i) % 12 < 3 ? Math.sin(t * 2.8 + i) * 0.32 : 0));
      });
      b.feet.forEach((f) => (f.visible = blend > 0.85));
    });
    perch.group.position.set(4.2, 3.46, 1.31);
    perch.group.rotation.y = 0.4 + Math.sin(t * 0.25) * 0.35;
    perch.wings.forEach((w, j) => w.rotation.set(0, (j ? 1 : -1) * 1.28, (j ? -1 : 1) * 0.2));
    shorebirds.forEach((b, i) => {
      const cycle = (t + i * 4) % 24,
        walking = cycle < 5;
      const phase = Math.floor((t + i * 4) / 24) + Math.min(1, cycle / 5);
      const x = -6 + i * 4.1 + Math.sin(phase) * 1.3,
        p = beachPoint(x, 0.38, beach);
      b.group.position.set(...p);
      b.group.userData.state = walking ? "walk" : cycle < 11 ? "look" : cycle < 16 ? "groom" : "rest";
      if (walking) b.group.rotation.y = Math.cos(phase) > 0 ? Math.PI * 0.5 : -Math.PI * 0.5;
      b.wings.forEach((w, j) => w.rotation.set(0, (j ? 1 : -1) * 1.28, (j ? -1 : 1) * 0.2));
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
