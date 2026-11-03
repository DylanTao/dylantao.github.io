import * as THREE from "../three.module.min.js";
import { supportHeight } from "./shore.mjs";

// Constrain the authored walking pose to the actual floor and stair treads.
// The mixer still supplies the gait; this short two-bone solve prevents a
// climbing foot from passing through a riser or hovering above its support.
export function createFootContacts(actor, terrain, options) {
  const measured = measuredFootContacts(actor, terrain, options);
  if (measured) return measured;
  const legs = ["L", "R"]
    .map((side) => {
      const named = (prefix) => {
        let result;
        actor.traverse((o) => {
          if (o.isBone && o.name.replaceAll(".", "") === prefix + side) result = o;
        });
        return result;
      };
      return { hip: named("Thigh"), knee: named("Shin"), foot: named("Foot") };
    })
    .filter((leg) => leg.hip && leg.knee && leg.foot);
  const p = new THREE.Vector3(),
    q = new THREE.Vector3(),
    r = new THREE.Vector3(),
    goal = new THREE.Vector3();
  const direction = new THREE.Vector3(),
    bend = new THREE.Vector3(),
    kneeGoal = new THREE.Vector3();
  const rotation = new THREE.Quaternion(),
    parentRotation = new THREE.Quaternion();
  const a = new THREE.Vector3(),
    b = new THREE.Vector3(),
    forward = new THREE.Vector3();

  function aim(bone, child, target) {
    bone.getWorldPosition(a);
    child.getWorldPosition(b);
    b.sub(a).normalize();
    a.copy(target).sub(bone.getWorldPosition(new THREE.Vector3())).normalize();
    rotation.setFromUnitVectors(b, a);
    rotation.multiply(bone.getWorldQuaternion(new THREE.Quaternion()));
    bone.parent.getWorldQuaternion(parentRotation).invert();
    bone.quaternion.copy(parentRotation.multiply(rotation));
    actor.updateMatrixWorld(true);
  }

  return (onStairs) => {
    actor.updateMatrixWorld(true);
    forward.set(0, 0, 1).applyQuaternion(actor.quaternion);
    for (const leg of legs) {
      leg.hip.getWorldPosition(p);
      leg.knee.getWorldPosition(q);
      leg.foot.getWorldPosition(r);
      const floor = supportHeight(r.x, r.z, terrain, actor.position.y, onStairs);
      goal.copy(r);
      const behind = r.clone().sub(p).dot(forward) < 0;
      goal.y = behind ? floor + 0.075 : Math.max(r.y, floor + 0.075);
      const l1 = p.distanceTo(q),
        l2 = q.distanceTo(r);
      direction.copy(goal).sub(p);
      const distance = Math.min(direction.length(), l1 + l2 - 0.0001);
      direction.normalize();
      goal.copy(p).addScaledVector(direction, distance);
      const along = (l1 * l1 - l2 * l2 + distance * distance) / (2 * distance);
      const height = Math.sqrt(Math.max(0, l1 * l1 - along * along));
      bend.copy(forward).addScaledVector(direction, -forward.dot(direction)).normalize();
      kneeGoal.copy(p).addScaledVector(direction, along).addScaledVector(bend, height);
      aim(leg.hip, leg.knee, kneeGoal);
      aim(leg.knee, leg.foot, goal);
    }
  };
}

// The coffee route opts into this delivered-sole profile. The original solver
// above remains the exact fallback for every existing caller and invalid input.
// Cache bind-space foot vertices once; updates touch only those vertices and
// their actual influencing bones, rather than scanning the complete avatar.
function measuredFootContacts(actor, terrain, options) {
  if (
    !options ||
    typeof options !== "object" ||
    Array.isArray(options) ||
    Object.keys(options).some((key) => key !== "profile" && key !== "clearance") ||
    options.profile !== "measured-sole" ||
    !Number.isFinite(options.clearance) ||
    options.clearance < 0 ||
    options.clearance > 0.008 ||
    !Array.isArray(terrain?.supportSurfaces)
  )
    return null;
  const named = new Map();
  actor.traverse((bone) => {
    if (bone.isBone) named.set(bone.name.replaceAll(".", ""), bone);
  });
  const legs = ["L", "R"].map((side) => ({
    side,
    hip: named.get("Thigh" + side),
    knee: named.get("Shin" + side),
    foot: named.get("Foot" + side),
    points: [],
  }));
  if (legs.some((leg) => !leg.hip || !leg.knee || !leg.foot)) return null;
  let invalid = false;
  const meshes = new Map(),
    influences = new Map();
  actor.updateMatrixWorld(true);
  actor.traverse((mesh) => {
    if (!mesh.isSkinnedMesh) return;
    const { position, skinIndex, skinWeight } = mesh.geometry.attributes;
    if (!position || !skinIndex || !skinWeight) {
      invalid = true;
      return;
    }
    for (let i = 0; i < position.count; i++) {
      const weights = [],
        feet = new Set();
      for (let k = 0; k < 4; k++) {
        const weight = skinWeight.getComponent(i, k),
          index = skinIndex.getComponent(i, k),
          bone = mesh.skeleton.bones[index];
        if (!Number.isFinite(weight) || weight < 0 || !Number.isInteger(index) || !bone) {
          invalid = true;
          return;
        }
        if (!weight) continue;
        weights.push({ bone, inverse: mesh.skeleton.boneInverses[index], weight });
        for (const leg of legs) if (bone === leg.foot) feet.add(leg);
      }
      if (!feet.size) continue;
      // A changing foot morph would invalidate a static bind-space profile.
      // None of the delivered shoes have one; unsupported input uses fallback.
      if (mesh.geometry.morphAttributes.position?.length) {
        invalid = true;
        return;
      }
      const bind = new THREE.Vector3().fromBufferAttribute(position, i).applyMatrix4(mesh.bindMatrix);
      if (![bind.x, bind.y, bind.z].every(Number.isFinite)) {
        invalid = true;
        return;
      }
      let meshPlan = meshes.get(mesh);
      if (!meshPlan) {
        meshPlan = { mesh, post: new THREE.Matrix4() };
        meshes.set(mesh, meshPlan);
      }
      const point = {
        mesh: meshPlan,
        bind,
        weights: weights.map((entry) => {
          let byInverse = influences.get(entry.bone);
          if (!byInverse) {
            byInverse = new Map();
            influences.set(entry.bone, byInverse);
          }
          let transform = byInverse.get(entry.inverse);
          if (!transform) {
            transform = { bone: entry.bone, inverse: entry.inverse, matrix: new THREE.Matrix4() };
            byInverse.set(entry.inverse, transform);
          }
          return { transform, weight: entry.weight };
        }),
      };
      for (const leg of feet) leg.points.push(point);
    }
  });
  if (invalid || legs.some((leg) => !leg.points.length)) return null;
  const transforms = [...influences.values()].flatMap((map) => [...map.values()]);
  const saved = new Map(),
    p = new THREE.Vector3(),
    q = new THREE.Vector3(),
    r = new THREE.Vector3();
  const direction = new THREE.Vector3(),
    oldDirection = new THREE.Vector3(),
    bend = new THREE.Vector3(),
    goal = new THREE.Vector3();
  const kneeGoal = new THREE.Vector3(),
    a = new THREE.Vector3(),
    b = new THREE.Vector3(),
    point = new THREE.Vector3(),
    term = new THREE.Vector3();
  const rotation = new THREE.Quaternion(),
    parentRotation = new THREE.Quaternion(),
    footRotation = new THREE.Quaternion();
  const ringPlans = new WeakMap(),
    seatSettings = new WeakMap();
  let latest = { profile: "measured-sole", vertices: legs.map((leg) => leg.points.length), clearance: options.clearance, active: false };
  const inside = (x, z, polygon) => {
    let hit = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const a = polygon[i],
        b = polygon[j];
      if (a[1] > z !== b[1] > z && x < ((b[0] - a[0]) * (z - a[1])) / (b[1] - a[1]) + a[0]) hit = !hit;
    }
    return hit;
  };
  const supports = terrain.supportSurfaces;
  if (
    supports.some(
      (s) =>
        !s ||
        typeof s !== "object" ||
        Array.isArray(s) ||
        typeof s.id !== "string" ||
        !Number.isFinite(s.height) ||
        !Array.isArray(s.polygon) ||
        s.polygon.length < 3 ||
        s.polygon.some((p) => !Array.isArray(p) || p.length !== 2 || !p.every(Number.isFinite))
    )
  )
    return null;
  const stairPatches = supports.filter((s) => s.id.startsWith("breakfast-tread-") || s.id === "breakfast-top-landing"),
    levels = [...new Set(stairPatches.map((s) => s.height))].sort((a, b) => a - b),
    rises = levels.slice(1).map((h, i) => h - levels[i]),
    rise = rises.length && Math.min(...rises),
    clearancePatches =
      rise >= 0.1 && rise <= 0.22 && rises.every((h) => Math.abs(h - rise) < 1e-8)
        ? stairPatches.map((patch) => ({
            ...patch,
            lo: [Math.min(...patch.polygon.map((p) => p[0])) - 0.200000000001, Math.min(...patch.polygon.map((p) => p[1])) - 0.200000000001],
            hi: [Math.max(...patch.polygon.map((p) => p[0])) + 0.200000000001, Math.max(...patch.polygon.map((p) => p[1])) + 0.200000000001],
          }))
        : [],
    stairBounds = clearancePatches.length
      ? {
          lo: [Math.min(...clearancePatches.map((p) => p.lo[0])), Math.min(...clearancePatches.map((p) => p.lo[1]))],
          hi: [Math.max(...clearancePatches.map((p) => p.hi[0])), Math.max(...clearancePatches.map((p) => p.hi[1]))],
        }
      : null;
  function stairEnvelope(x, z) {
    if (!stairBounds || x < stairBounds.lo[0] || x > stairBounds.hi[0] || z < stairBounds.lo[1] || z > stairBounds.hi[1]) return -Infinity;
    let height = -Infinity;
    for (const patch of clearancePatches) {
      if (x < patch.lo[0] || x > patch.hi[0] || z < patch.lo[1] || z > patch.hi[1]) continue;
      let distance = 0;
      if (!inside(x, z, patch.polygon)) {
        distance = Infinity;
        for (let i = 0; i < patch.polygon.length; i++) {
          const a = patch.polygon[i],
            b = patch.polygon[(i + 1) % patch.polygon.length],
            dx = b[0] - a[0],
            dz = b[1] - a[1],
            length = dx * dx + dz * dz,
            t = length ? Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / length)) : 0;
          distance = Math.min(distance, Math.hypot(x - a[0] - t * dx, z - a[1] - t * dz));
        }
      }
      if (distance >= 0.2) continue;
      const t = distance / 0.2;
      height = Math.max(height, patch.height - rise * t * t * (3 - 2 * t));
    }
    return height;
  }
  const floorCoverPlans = new WeakMap();
  let activeFloorCover = null;
  function floorCoverFor(root) {
    if (
      root?.isObject3D !== true ||
      typeof root.updateWorldMatrix !== "function" ||
      typeof root.traverse !== "function" ||
      !root.matrixWorld?.isMatrix4
    )
      return null;
    root.updateWorldMatrix(true, true);
    const cached = floorCoverPlans.get(root);
    if (
      cached &&
      cached.stamps.every(
        (s) =>
          s.mesh.geometry === s.geometry &&
          s.geometry.attributes.position === s.position &&
          s.geometry.index === s.index &&
          s.position.version === s.positionVersion &&
          s.index?.version === s.indexVersion &&
          s.mesh.matrixWorld.elements.every((v, i) => v === s.matrix[i])
      )
    )
      return cached;
    const grid = new Map(),
      triangles = [],
      stamps = [],
      owners = new Set(),
      cell = 0.1;
    let invalid = false;
    root.traverse((mesh) => {
      if (invalid || !mesh.isMesh || mesh.isSkinnedMesh) return;
      let owner = null;
      for (let node = mesh; node && node !== root.parent; node = node.parent) {
        for (const label of [node.userData?.name, node.name]) {
          if (label === "kitchen__linen") owner = "kitchen__linen";
          if (label === "kitchen__oatmeal wool textile" || label === "kitchen__oatmeal_wool_textile") owner = "kitchen__oatmeal wool textile";
        }
        if (owner) break;
      }
      if (!owner) return;
      const geometry = mesh.geometry,
        position = geometry?.attributes?.position,
        index = geometry?.index;
      if (!position || position.itemSize !== 3) return;
      const stamp = {
        mesh,
        geometry,
        position,
        index,
        positionVersion: position.version,
        indexVersion: index?.version,
        matrix: mesh.matrixWorld.toArray(),
      };
      stamps.push(stamp);
      for (let i = 0; i < (index?.count ?? position.count); i += 3) {
        const ps = [0, 1, 2].map((k) =>
          new THREE.Vector3().fromBufferAttribute(position, index ? index.getX(i + k) : i + k).applyMatrix4(mesh.matrixWorld)
        );
        if (ps.some((p) => !p.toArray().every(Number.isFinite))) {
          invalid = true;
          return;
        }
        const normal = new THREE.Triangle(...ps).getNormal(new THREE.Vector3());
        if (normal.y <= 0.5 || Math.min(...ps.map((p) => p.y)) < -0.02 || Math.max(...ps.map((p) => p.y)) > 0.04) continue;
        if (ps.some((p) => p.x < -4 || p.x > -0.1 || p.z < 9.3 || p.z > 12.8) || triangles.length >= 512) {
          invalid = true;
          return;
        }
        const [a, b, c] = ps,
          den = (b.z - c.z) * (a.x - c.x) + (c.x - b.x) * (a.z - c.z);
        if (!Number.isFinite(den) || den === 0) continue;
        const record = { a, b, c, den, owner, mesh: mesh.name, face: i / 3 };
        triangles.push(record);
        owners.add(owner);
        for (let x = Math.floor(Math.min(...ps.map((p) => p.x)) / cell); x <= Math.floor(Math.max(...ps.map((p) => p.x)) / cell); x++)
          for (let z = Math.floor(Math.min(...ps.map((p) => p.z)) / cell); z <= Math.floor(Math.max(...ps.map((p) => p.z)) / cell); z++) {
            const key = x + ":" + z,
              list = grid.get(key) || [];
            list.push(record);
            grid.set(key, list);
          }
      }
    });
    if (invalid || owners.size !== 2 || !triangles.length) {
      floorCoverPlans.delete(root);
      return null;
    }
    const result = { grid, cell, triangles: triangles.length, stamps, owners: [...owners].sort() };
    floorCoverPlans.set(root, result);
    return result;
  }
  function coveredFloor(x, z, best) {
    if (!activeFloorCover) return best;
    for (const t of activeFloorCover.grid.get(Math.floor(x / activeFloorCover.cell) + ":" + Math.floor(z / activeFloorCover.cell)) || []) {
      const u = ((t.b.z - t.c.z) * (x - t.c.x) + (t.c.x - t.b.x) * (z - t.c.z)) / t.den,
        v = ((t.c.z - t.a.z) * (x - t.c.x) + (t.a.x - t.c.x) * (z - t.c.z)) / t.den,
        h = 1 - u - v;
      if (Math.min(u, v, h) < 0) continue;
      const height = u * t.a.y + v * t.b.y + h * t.c.y;
      if (height > actor.position.y + 0.255 || (best && height <= best.height)) continue;
      best = { id: t.owner, height };
    }
    return best;
  }
  function surfaceAt(x, z, stairs) {
    let best = null,
      tread = null;
    for (const support of supports) {
      if (!inside(x, z, support.polygon)) continue;
      // A shoe may project into the old, broad upper-floor polygon before
      // the body reaches the first riser. That floor is not a one-metre step.
      // Only the nearby physical level can support this coffee gait; an
      // uncovered projection remains explicitly unsupported in the evidence.
      const isTread = support.id.startsWith("tread-") || support.id.startsWith("breakfast-tread-");
      if (!isTread && support.height > actor.position.y + 0.255) continue;
      if ((stairs || support.id.startsWith("breakfast-tread-")) && isTread && !tread) tread = support;
      if (!isTread && (!best || Math.abs(support.height - actor.position.y) < Math.abs(best.height - actor.position.y))) best = support;
    }
    return tread || coveredFloor(x, z, best);
  }
  function readPoint(entry) {
    point.set(0, 0, 0);
    for (const { transform, weight } of entry.weights) point.addScaledVector(term.copy(entry.bind).applyMatrix4(transform.matrix), weight);
    return point.applyMatrix4(entry.mesh.post);
  }
  function updateTransforms() {
    for (const transform of transforms) transform.matrix.multiplyMatrices(transform.bone.matrixWorld, transform.inverse);
    for (const { mesh, post } of meshes.values()) post.multiplyMatrices(mesh.matrixWorld, mesh.bindMatrixInverse);
  }
  function correction(leg, stairs) {
    updateTransforms();
    let lift = 0,
      unsupported = 0,
      minimum = Infinity,
      anticipatoryLift = 0;
    for (const entry of leg.points) {
      const v = readPoint(entry),
        support = surfaceAt(v.x, v.z, stairs);
      // This is a swing-clearance envelope over the real named tread patches,
      // not an extra support plane. It starts the lift before a riser reaches
      // the shoe and releases it smoothly after an edge in either direction.
      const envelope = stairEnvelope(v.x, v.z),
        anticipation = Math.max(0, envelope + options.clearance - v.y);
      anticipatoryLift = Math.max(anticipatoryLift, anticipation);
      lift = Math.max(lift, anticipation);
      if (!support) {
        unsupported++;
        continue;
      }
      const gap = v.y - support.height;
      minimum = Math.min(minimum, gap);
      lift = Math.max(lift, options.clearance - gap);
    }
    return { lift, unsupported, minimum, anticipatoryLift };
  }
  function aim(bone, child, target) {
    bone.getWorldPosition(a);
    child.getWorldPosition(b);
    b.sub(a).normalize();
    a.copy(target).sub(bone.getWorldPosition(point)).normalize();
    rotation.setFromUnitVectors(b, a).multiply(bone.getWorldQuaternion(parentRotation));
    bone.parent.getWorldQuaternion(parentRotation).invert();
    bone.quaternion.copy(parentRotation.multiply(rotation));
    actor.updateMatrixWorld(true);
  }
  function fit(leg, lift, worldPole) {
    leg.hip.getWorldPosition(p);
    leg.knee.getWorldPosition(q);
    leg.foot.getWorldPosition(r);
    leg.foot.getWorldQuaternion(footRotation);
    const l1 = p.distanceTo(q),
      l2 = q.distanceTo(r);
    if (typeof lift === "number") {
      goal.copy(r);
      goal.y += lift;
    } else goal.copy(lift);
    direction.copy(goal).sub(p);
    const distance = Math.min(direction.length(), l1 + l2 - 1e-7);
    if (!(distance > 1e-7 && l1 > 1e-7 && l2 > 1e-7)) return false;
    direction.normalize();
    goal.copy(p).addScaledVector(direction, distance);
    const along = (l1 * l1 - l2 * l2 + distance * distance) / (2 * distance);
    const height = Math.sqrt(Math.max(0, l1 * l1 - along * along));
    oldDirection.copy(r).sub(p).normalize();
    if (worldPole) bend.copy(worldPole).addScaledVector(direction, -worldPole.dot(direction)).normalize();
    else {
      bend.copy(q).sub(p).addScaledVector(oldDirection, -q.clone().sub(p).dot(oldDirection));
      if (bend.lengthSq() < 1e-16) bend.set(0, 0, 1).applyQuaternion(actor.quaternion).addScaledVector(oldDirection, -bend.dot(oldDirection));
      rotation.setFromUnitVectors(oldDirection, direction);
      bend.applyQuaternion(rotation).normalize();
    }
    kneeGoal.copy(p).addScaledVector(direction, along).addScaledVector(bend, height);
    aim(leg.hip, leg.knee, kneeGoal);
    aim(leg.knee, leg.foot, goal);
    leg.foot.parent.getWorldQuaternion(parentRotation).invert();
    leg.foot.quaternion.copy(parentRotation.multiply(footRotation)).normalize();
    actor.updateMatrixWorld(true);
    return true;
  }
  const apply = (stairs, floorCoverRoot) => {
    activeFloorCover = floorCoverFor(floorCoverRoot);
    if (!saved.size) for (const leg of legs) for (const bone of [leg.hip, leg.knee, leg.foot]) saved.set(bone, bone.quaternion.clone());
    actor.updateMatrixWorld(true);
    const rows = [];
    for (const leg of legs) {
      const before = correction(leg, stairs);
      let current = before,
        iterations = 0;
      // Collision-only lift preserves the authored airborne/swing trajectory.
      while (current.lift > 1e-8 && iterations < 4 && fit(leg, current.lift)) {
        iterations++;
        current = correction(leg, stairs);
      }
      rows.push({
        side: leg.side,
        before: before.minimum,
        after: current.minimum,
        residual: current.lift,
        unsupported: current.unsupported,
        iterations,
        anticipatoryLift: before.anticipatoryLift,
      });
    }
    latest = {
      profile: "measured-sole",
      vertices: legs.map((leg) => leg.points.length),
      clearance: options.clearance,
      active: true,
      legs: rows,
      ...(activeFloorCover ? { floorCover: { triangles: activeFloorCover.triangles, owners: activeFloorCover.owners } } : {}),
    };
    activeFloorCover = null;
  };
  apply.restore = () => {
    if (!saved.size) return;
    for (const [bone, quaternion] of saved) bone.quaternion.copy(quaternion);
    saved.clear();
    actor.updateMatrixWorld(true);
    latest = { ...latest, active: false, seated: null, transfer: null };
  };
  function settingsFor(value) {
    if (!value || typeof value !== "object" || Array.isArray(value)) return null;
    if (seatSettings.has(value)) return seatSettings.get(value);
    const point3 = (p) => Array.isArray(p) && p.length === 3 && p.every(Number.isFinite);
    const record = (p) =>
      p && typeof p === "object" && !Array.isArray(p) && Object.keys(p).length === 2 && ["L", "R"].every((side) => Object.hasOwn(p, side));
    let accepted = null;
    if (
      Object.keys(value).length === 2 &&
      record(value.offsetWorld) &&
      record(value.kneePoleWorld) &&
      legs.every(({ side }) => {
        const offset = value.offsetWorld[side],
          pole = value.kneePoleWorld[side];
        return (
          point3(offset) &&
          offset[1] === 0 &&
          Math.hypot(...offset) <= 0.15 &&
          offset[2] >= 0 &&
          offset[2] <= 0.1 &&
          (side === "L" ? offset[0] >= 0 && offset[0] <= 0.1 : offset[0] <= 0 && offset[0] >= -0.1) &&
          point3(pole) &&
          Math.abs(Math.hypot(...pole) - 1) <= 1e-4 &&
          pole[1] <= 0 &&
          pole[1] >= -0.5 &&
          pole[2] <= -0.5 &&
          (side === "L" ? pole[0] >= 0 && pole[0] <= 0.7 : pole[0] <= 0 && pole[0] >= -0.7)
        );
      })
    )
      accepted = {
        offsets: Object.fromEntries(legs.map(({ side }) => [side, new THREE.Vector3(...value.offsetWorld[side])])),
        poles: Object.fromEntries(legs.map(({ side }) => [side, new THREE.Vector3(...value.kneePoleWorld[side]).normalize()])),
      };
    seatSettings.set(value, accepted);
    return accepted;
  }
  function ringFor(root) {
    if (!root?.isObject3D) return null;
    if (ringPlans.has(root)) return ringPlans.get(root);
    root.updateWorldMatrix(true, true);
    const cell = 0.05,
      grid = new Map(),
      triangles = [];
    root.traverse((mesh) => {
      if (!mesh.isMesh || mesh.isSkinnedMesh) return;
      let name = null;
      for (let node = mesh; node && node !== root.parent; node = node.parent) {
        const label = node.userData?.name || node.name;
        if (["kitchen__polished nickel", "kitchen__polished_nickel"].includes(label)) {
          name = label;
          break;
        }
      }
      if (!name) return;
      const position = mesh.geometry.attributes.position,
        index = mesh.geometry.index;
      if (!position) return;
      for (let i = 0; i < (index?.count ?? position.count); i += 3) {
        const ps = [0, 1, 2].map((k) =>
            new THREE.Vector3().fromBufferAttribute(position, index ? index.getX(i + k) : i + k).applyMatrix4(mesh.matrixWorld)
          ),
          triangle = new THREE.Triangle(...ps),
          normal = triangle.getNormal(new THREE.Vector3());
        if (
          normal.y <= 0.5 ||
          Math.max(...ps.map((p) => p.y)) > actor.position.y + 0.45 ||
          Math.min(...ps.map((p) => p.y)) < actor.position.y - 0.1 ||
          ps.some((p) => Math.abs(p.x - actor.position.x) > 1.5 || Math.abs(p.z - actor.position.z) > 1.5)
        )
          continue;
        const [a, b, c] = ps,
          den = (b.z - c.z) * (a.x - c.x) + (c.x - b.x) * (a.z - c.z);
        if (!den) continue;
        const record = { a, b, c, den, mesh: mesh.name, face: i / 3 };
        triangles.push(record);
        for (let x = Math.floor(Math.min(...ps.map((p) => p.x)) / cell); x <= Math.floor(Math.max(...ps.map((p) => p.x)) / cell); x++)
          for (let z = Math.floor(Math.min(...ps.map((p) => p.z)) / cell); z <= Math.floor(Math.max(...ps.map((p) => p.z)) / cell); z++) {
            const key = x + ":" + z,
              list = grid.get(key) || [];
            list.push(record);
            grid.set(key, list);
          }
      }
    });
    const result = triangles.length ? { cell, grid, triangles: triangles.length } : null;
    if (result) ringPlans.set(root, result);
    return result;
  }
  function seatedGap(leg, ring, offset) {
    updateTransforms();
    let minimum = Infinity,
      unsupported = 0,
      witness = null;
    for (const entry of leg.points) {
      const v = readPoint(entry);
      if (offset) v.add(offset);
      const floor = surfaceAt(v.x, v.z, false);
      let support = floor ? { height: floor.height, owner: floor.id } : null;
      for (const t of ring.grid.get(Math.floor(v.x / ring.cell) + ":" + Math.floor(v.z / ring.cell)) || []) {
        const u = ((t.b.z - t.c.z) * (v.x - t.c.x) + (t.c.x - t.b.x) * (v.z - t.c.z)) / t.den,
          w = ((t.c.z - t.a.z) * (v.x - t.c.x) + (t.a.x - t.c.x) * (v.z - t.c.z)) / t.den,
          h = 1 - u - w;
        if (Math.min(u, w, h) < -1e-12) continue;
        const height = u * t.a.y + w * t.b.y + h * t.c.y;
        if (!support || height > support.height) support = { height, owner: t.mesh, face: t.face };
      }
      if (!support) {
        unsupported++;
        continue;
      }
      const gap = v.y - support.height;
      if (gap < minimum) {
        minimum = gap;
        witness = { point: v.toArray(), ...support, gap };
      }
    }
    return { minimum, unsupported, witness };
  }
  apply.plant = (root, metadata, weight = 1) => {
    if (!Number.isFinite(weight) || weight <= 0 || weight > 1) return false;
    const settings = settingsFor(metadata),
      ring = settings && ringFor(root);
    if (!settings || !ring) return false;
    if (!saved.size) for (const leg of legs) for (const bone of [leg.hip, leg.knee, leg.foot]) saved.set(bone, bone.quaternion.clone());
    actor.updateMatrixWorld(true);
    const rows = [];
    for (const leg of legs) {
      const offset = settings.offsets[leg.side].clone().multiplyScalar(weight),
        before = seatedGap(leg, ring, offset);
      if (!Number.isFinite(before.minimum)) continue;
      const desired = before.minimum + (options.clearance - before.minimum) * weight,
        target = leg.foot.getWorldPosition(new THREE.Vector3()).add(offset);
      target.y += desired - before.minimum;
      leg.hip.getWorldPosition(p);
      leg.knee.getWorldPosition(q);
      leg.foot.getWorldPosition(r);
      oldDirection.copy(r).sub(p).normalize();
      direction.copy(target).sub(p).normalize();
      const base = q.clone().sub(p).addScaledVector(oldDirection, -q.clone().sub(p).dot(oldDirection));
      if (base.lengthSq() < 1e-16) base.set(0, 0, 1).applyQuaternion(actor.quaternion).addScaledVector(oldDirection, -base.dot(oldDirection));
      base.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(oldDirection, direction)).normalize();
      const wanted = settings.poles[leg.side].clone().addScaledVector(direction, -settings.poles[leg.side].dot(direction)).normalize(),
        pole = base.clone().applyQuaternion(new THREE.Quaternion().slerp(new THREE.Quaternion().setFromUnitVectors(base, wanted), weight));
      let after = before,
        iterations = 0;
      for (; iterations < 4; iterations++) {
        if (!fit(leg, target, pole)) break;
        after = seatedGap(leg, ring);
        if (Math.abs(after.minimum - desired) <= 1e-8) break;
        target.y += desired - after.minimum;
      }
      rows.push({
        side: leg.side,
        before: before.minimum,
        after: after.minimum,
        desired,
        unsupported: after.unsupported,
        witness: after.witness,
        iterations: iterations + 1,
      });
    }
    latest = { ...latest, active: true, seated: { weight, ringTriangles: ring.triangles, legs: rows } };
    return true;
  };
  // An authored, model-bound seated transfer supplies actual ankle frames.
  // This uses the same fixed-length leg solve and reversible six-bone layer;
  // it never moves the actor or replaces the world's support/physics.
  apply.transfer = (frames, poles) => {
    const point3 = (p) => Array.isArray(p) && p.length === 3 && p.every(Number.isFinite);
    if (
      !frames ||
      !poles ||
      typeof frames !== "object" ||
      typeof poles !== "object" ||
      Array.isArray(frames) ||
      Array.isArray(poles) ||
      Object.keys(frames).length !== 2 ||
      Object.keys(poles).length !== 2 ||
      legs.some(({ side }) => {
        const f = frames[side],
          pole = poles[side];
        return (
          !f ||
          typeof f !== "object" ||
          Array.isArray(f) ||
          Object.keys(f).length !== 2 ||
          !point3(f.position) ||
          Math.hypot(...f.position.map((v, i) => v - actor.position.getComponent(i))) > 1.65 ||
          !Array.isArray(f.quaternion) ||
          f.quaternion.length !== 4 ||
          !f.quaternion.every(Number.isFinite) ||
          Math.abs(Math.hypot(...f.quaternion) - 1) > 1e-4 ||
          !point3(pole) ||
          Math.hypot(...pole) < 0.15 ||
          Math.hypot(...pole) > 1.001
        );
      })
    )
      return false;
    if (!saved.size) for (const leg of legs) for (const bone of [leg.hip, leg.knee, leg.foot]) saved.set(bone, bone.quaternion.clone());
    actor.updateMatrixWorld(true);
    const rows = [];
    for (const leg of legs) {
      const target = new THREE.Vector3(...frames[leg.side].position),
        wanted = new THREE.Quaternion(...frames[leg.side].quaternion).normalize(),
        pole = new THREE.Vector3(...poles[leg.side]).normalize();
      leg.hip.getWorldPosition(p);
      leg.knee.getWorldPosition(q);
      leg.foot.getWorldPosition(r);
      const reach = p.distanceTo(q) + q.distanceTo(r),
        asked = p.distanceTo(target);
      if (!fit(leg, target, pole)) continue;
      leg.foot.parent.getWorldQuaternion(parentRotation).invert();
      leg.foot.quaternion.copy(parentRotation.multiply(wanted)).normalize();
      actor.updateMatrixWorld(true);
      rows.push({
        side: leg.side,
        target: target.toArray(),
        actual: leg.foot.getWorldPosition(point).toArray(),
        drift: point.distanceTo(target),
        reachViolation: Math.max(0, asked - reach + 1e-7),
        orientationError: 1 - Math.abs(leg.foot.getWorldQuaternion(rotation).normalize().dot(wanted)),
      });
    }
    latest = { ...latest, active: true, transfer: { legs: rows } };
    return rows.length === 2;
  };
  apply.evidence = () => latest;
  return apply;
}
