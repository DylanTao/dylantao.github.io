import * as THREE from "../three.module.min.js";
import { groundFootQuaternion } from "./wildlife-ground-contact.mjs?v=contact-cpu-20261101";
import { pinnipedBlendWeight, pinnipedFlipperActivation } from "./wildlife-motion.mjs?v=contact-cpu-20261101";

// Only the delivered ringed-tail skin belongs to this contact problem. Its
// trunk and planted paws already have their own independent support solution.
export function createRestingTailFit({ model, group, tail, ground }) {
  const samples = [];
  model.traverse((mesh) => {
    if (!mesh.isSkinnedMesh) return;
    const skin = mesh.geometry.attributes.skinIndex,
      weights = mesh.geometry.attributes.skinWeight;
    for (let i = 0; i < skin.count; i++) {
      let ownership = 0;
      for (let k = 0; k < 4; k++) if (/^Tail/.test(mesh.skeleton.bones[skin.getComponent(i, k)].name)) ownership += weights.getComponent(i, k);
      if (ownership > 1e-4) samples.push({ mesh, index: i });
    }
  });
  const point = new THREE.Vector3(),
    up = new THREE.Vector3(0, 1, 0),
    original = new THREE.Quaternion();
  function measure() {
    group.updateMatrixWorld(true);
    let minimum = null,
      missing = 0,
      visible = true;
    for (const sample of samples) {
      sample.mesh.getVertexPosition(sample.index, point).applyMatrix4(sample.mesh.matrixWorld);
      const support = ground.sample(point.x, point.z, point.y + 0.5);
      if (!support) {
        missing++;
        continue;
      }
      visible &&= support.visible;
      const gap = point.y - support.height;
      if (!minimum || gap < minimum.gap)
        minimum = { gap, point: point.clone(), mesh: sample.mesh.name, vertex: sample.index, supportMesh: support.mesh, triangle: support.triangle };
    }
    return { minimum, missing, visible };
  }
  return {
    update() {
      // The owning acting function restores the authored tail pose each frame.
      original.copy(tail.quaternion);
      const first = measure();
      let current = first,
        iterations = 0,
        reason = null;
      if (!samples.length || first.missing || !first.minimum) reason = "incomplete tail support";
      while (!reason && current.minimum.gap < 0.0006 && iterations < 12) {
        const pivot = tail.getWorldPosition(new THREE.Vector3()),
          radius = current.minimum.point.clone().sub(pivot),
          horizontal = Math.hypot(radius.x, radius.z);
        if (horizontal < 0.03) {
          reason = "contact is too near the tail pivot";
          break;
        }
        // Lift the offending part of the curled tail toward the local ground,
        // about its real hip attachment. A fixed model-x rotation poorly fits
        // a tail that has already curled sideways around the sleeping body.
        const axis = radius.cross(up).normalize(),
          angle = Math.min(0.22, Math.atan2(0.00065 - current.minimum.gap, horizontal) * 1.03),
          parent = tail.parent.getWorldQuaternion(new THREE.Quaternion()),
          correction = parent.clone().invert().multiply(new THREE.Quaternion().setFromAxisAngle(axis, angle)).multiply(parent);
        tail.quaternion.premultiply(correction);
        iterations++;
        if (original.angleTo(tail.quaternion) > 0.65) {
          reason = "tail rotation exceeds the bounded joint fit";
          break;
        }
        current = measure();
        if (current.missing || !current.minimum) reason = "incomplete rotated tail support";
      }
      if (!reason && current.minimum.gap < 0.0006) reason = "tail contact did not converge";
      const attemptedGap = current.minimum?.gap ?? null;
      if (reason) {
        tail.quaternion.copy(original);
        group.updateMatrixWorld(true);
        current = first;
      }
      const witness = current.minimum;
      return {
        supported: !reason,
        reason,
        samples: samples.length,
        missing: current.missing,
        supportVisible: current.visible,
        beforeGap: first.minimum?.gap ?? null,
        gap: witness?.gap ?? null,
        attemptedGap,
        rotation: !reason && iterations ? original.angleTo(tail.quaternion) : 0,
        iterations,
        witness: witness ? { mesh: witness.mesh, vertex: witness.vertex, supportMesh: witness.supportMesh, triangle: witness.triangle } : null,
      };
    },
  };
}

function partitionContactPoints(samples) {
  const box = new THREE.Box3().setFromPoints(samples.map((p) => p.base)),
    node = { samples, box };
  if (samples.length <= 128) return node;
  const size = box.getSize(new THREE.Vector3()),
    axis = size.x >= size.y && size.x >= size.z ? "x" : size.y >= size.z ? "y" : "z",
    ordered = samples.toSorted((a, b) => a.base[axis] - b.base[axis]),
    middle = Math.floor(ordered.length / 2);
  node.children = [partitionContactPoints(ordered.slice(0, middle)), partitionContactPoints(ordered.slice(middle))];
  return node;
}

function contactBoxBounds(box, matrix, result) {
  const corners = (result.contactCorners ||= Array.from({ length: 8 }, () => new THREE.Vector3()));
  for (let i = 0; i < 8; i++)
    corners[i].set(i & 1 ? box.max.x : box.min.x, i & 2 ? box.max.y : box.min.y, i & 4 ? box.max.z : box.min.z).applyMatrix4(matrix);
  return result.setFromPoints(corners).expandByScalar(1e-8);
}

function createPaddleState(samples, groups, faces) {
  const localPoints = samples.map((sample) => ({ sample, point: new THREE.Vector3(), world: new THREE.Vector3() })),
    bySample = new Map(localPoints.map((p) => [p.sample, p])),
    localGroups = groups.map((feature) => {
      const points = feature.samples.map((sample) => bySample.get(sample));
      return { points, coordinates: points.map((p) => p.point), box: new THREE.Box3(), worldBox: new THREE.Box3() };
    }),
    localFaces = faces.map((face, order) => {
      const records = face.samples.map((sample) => bySample.get(sample)),
        centre = new THREE.Vector3();
      for (const record of records) centre.add(record.sample.base);
      return { mesh: face.mesh, triangle: face.triangle, order, records, points: records.map((p) => p.world), centre: centre.multiplyScalar(1 / 3) };
    });
  const build = (faces) => {
    const node = { faceCount: faces.length, box: new THREE.Box3(), worldBox: new THREE.Box3() };
    if (faces.length <= 12) {
      node.faces = faces;
      return node;
    }
    const box = new THREE.Box3().setFromPoints(faces.map((f) => f.centre)),
      size = box.getSize(new THREE.Vector3()),
      axis = size.x >= size.y && size.x >= size.z ? "x" : size.y >= size.z ? "y" : "z",
      ordered = faces.toSorted((a, b) => a.centre[axis] - b.centre[axis]),
      middle = Math.floor(ordered.length / 2);
    node.children = [build(ordered.slice(0, middle)), build(ordered.slice(middle))];
    return node;
  };
  return { localPoints, localGroups, localFaces, faceTree: build(localFaces) };
}

function refitPaddleTree(node) {
  if (node.children) {
    node.children.forEach(refitPaddleTree);
    node.box.copy(node.children[0].box).union(node.children[1].box);
  } else {
    node.box.makeEmpty();
    for (const face of node.faces) for (const p of face.records) node.box.expandByPoint(p.point);
  }
}

// Cache the exact Float64 joint products once per pose instead of rebuilding
// bone-world * inverse-bind for every skin vertex. The operation order for each
// point is the same as Three's getVertexPosition; no skin samples are removed.
export function createSkinContactSampler(model) {
  const points = [],
    skeletons = new Map(),
    blended = new THREE.Matrix4(),
    transform = new THREE.Matrix4();
  model.updateMatrixWorld(true);
  model.traverse((mesh) => {
    if (!mesh.isSkinnedMesh) return;
    if (!skeletons.has(mesh.skeleton))
      skeletons.set(
        mesh.skeleton,
        mesh.skeleton.bones.map(() => new THREE.Matrix4())
      );
    const p = mesh.geometry.attributes.position,
      indices = mesh.geometry.attributes.skinIndex,
      weights = mesh.geometry.attributes.skinWeight;
    for (let i = 0; i < p.count; i++)
      points.push({
        mesh,
        index: i,
        matrices: skeletons.get(mesh.skeleton),
        base: new THREE.Vector3().fromBufferAttribute(p, i).applyMatrix4(mesh.bindMatrix),
        channels: Array.from({ length: 4 }, (_, k) => ({
          index: indices.getComponent(i, k),
          weight: weights.getComponent(i, k),
          name: mesh.skeleton.bones[indices.getComponent(i, k)].name,
        })),
      });
  });
  return {
    points,
    groups(samples) {
      const meshes = new Map();
      for (const point of samples) {
        if (!meshes.has(point.mesh)) meshes.set(point.mesh, new Map());
        const key = point.channels
            .filter((c) => c.weight !== 0)
            .map((c) => `${c.index}:${c.weight}`)
            .join(","),
          features = meshes.get(point.mesh);
        if (!features.has(key)) features.set(key, []);
        features.get(key).push(point);
      }
      const groups = [];
      for (const [mesh, features] of meshes)
        for (const samples of features.values()) {
          const append = (node) => {
            if (node.children) node.children.forEach(append);
            else groups.push({ mesh, channels: samples[0].channels, samples: node.samples, box: node.box });
          };
          append(partitionContactPoints(samples));
        }
      return groups;
    },
    bounds(feature, result) {
      if (feature.mesh.geometry.morphAttributes.position?.length) return null;
      const e = blended.elements;
      e.fill(0);
      for (const channel of feature.channels)
        if (channel.weight !== 0) {
          const m = skeletons.get(feature.mesh.skeleton)[channel.index].elements;
          for (let i = 0; i < 16; i++) e[i] += m[i] * channel.weight;
        }
      // The skin accumulator is a Vector3: applying its inverse bind starts
      // with w=1, even when native Float32 weights sum slightly away from one.
      e[3] = e[7] = e[11] = 0;
      e[15] = 1;
      transform.multiplyMatrices(feature.mesh.bindMatrixInverse, blended).premultiply(feature.mesh.matrixWorld);
      return contactBoxBounds(feature.box, transform, result);
    },
    refresh() {
      for (const [skeleton, matrices] of skeletons)
        for (let i = 0; i < matrices.length; i++) matrices[i].multiplyMatrices(skeleton.bones[i].matrixWorld, skeleton.boneInverses[i]);
    },
    position(point, result) {
      const { mesh } = point;
      if (mesh.geometry.morphAttributes.position?.length) return mesh.getVertexPosition(point.index, result).applyMatrix4(mesh.matrixWorld);
      result.set(0, 0, 0);
      const matrices = point.matrices,
        x = point.base.x,
        y = point.base.y,
        z = point.base.z;
      for (const channel of point.channels)
        if (channel.weight !== 0) {
          const e = matrices[channel.index].elements,
            w = 1 / (e[3] * x + e[7] * y + e[11] * z + e[15]);
          // Preserve Three's exact scalar operation order, including its
          // homogeneous divide, without a temporary Vector3 method chain.
          result.x += (e[0] * x + e[4] * y + e[8] * z + e[12]) * w * channel.weight;
          result.y += (e[1] * x + e[5] * y + e[9] * z + e[13]) * w * channel.weight;
          result.z += (e[2] * x + e[6] * y + e[10] * z + e[14]) * w * channel.weight;
        }
      return result.applyMatrix4(mesh.bindMatrixInverse).applyMatrix4(mesh.matrixWorld);
    },
  };
}

// `supported` is the legacy alias for resolved bounded contact constraints.
// It is not complete delivered-skin projection coverage or a 3D collision audit.
// Missing contact queries remain explicit; the independent geometry audit owns
// whole-skin coverage and separation, including vertical faces and mesh seams.
export function createPinnipedContactFit({ model, group, bones, ground }) {
  const sampler = createSkinContactSampler(model),
    body = [],
    anchors = [],
    primary = new Map();
  const names = ["FrontFlipperL", "FrontFlipperR", "RearFlipperL", "RearFlipperR"];
  const flippers = Object.fromEntries(names.map((name) => [name, []]));
  const point = new THREE.Vector3(),
    inverse = group.matrixWorld.clone().invert();
  sampler.refresh();
  for (const sample of sampler.points) {
    const owners = new Set(sample.channels.filter((c) => c.weight > 1e-4 && /Flipper/.test(c.name)).map((c) => c.name.replace("Tip", "")));
    if (!owners.size) {
      body.push(sample);
      anchors.push(sample);
    }
    for (const name of owners) {
      if (!flippers[name]) continue;
      flippers[name].push(sample);
      const local = sampler.position(sample, point).clone().applyMatrix4(bones[name].object.matrixWorld.clone().invert());
      if (Math.hypot(local.x, local.z) < 0.05) anchors.push(sample);
    }
    if (sample.channels.reduce((sum, c) => sum + (/^(Hips|Chest)$/.test(c.name) ? c.weight : 0), 0) >= 0.5) {
      const p = sampler.position(sample, point).clone().applyMatrix4(inverse);
      primary.set(`${Math.round(p.x / 0.04)},${Math.round(p.z / 0.04)}`, p);
    }
  }
  const sampleLookup = new Map(),
    flipperMembership = Object.fromEntries(names.map((name) => [name, new Set(flippers[name])])),
    flipperFaces = Object.fromEntries(names.map((name) => [name, []])),
    skinFaces = [];
  for (const sample of sampler.points) {
    if (!sampleLookup.has(sample.mesh)) sampleLookup.set(sample.mesh, new Map());
    sampleLookup.get(sample.mesh).set(sample.index, sample);
  }
  for (const [mesh, lookup] of sampleLookup) {
    const indices = mesh.geometry.index,
      count = indices?.count ?? mesh.geometry.attributes.position.count;
    for (let i = 0; i < count; i += 3) {
      const samples = [0, 1, 2].map((k) => lookup.get(indices ? indices.getX(i + k) : i + k));
      skinFaces.push({ mesh: mesh.name, triangle: i / 3, samples });
      for (const name of names)
        if (samples.every((s) => flipperMembership[name].has(s))) flipperFaces[name].push({ mesh: mesh.name, triangle: i / 3, samples });
    }
  }
  const primaryPoints = [...primary.values()],
    up = new THREE.Vector3(0, 1, 0),
    bodyGroups = sampler.groups(body),
    anchorGroups = sampler.groups(anchors),
    flipperGroups = Object.fromEntries(names.map((name) => [name, sampler.groups(flippers[name])])),
    paddleStates = Object.fromEntries(names.map((name) => [name, createPaddleState(flippers[name], flipperGroups[name], flipperFaces[name])])),
    gravitySkin = createPaddleState(sampler.points, [], skinFaces),
    identity = new THREE.Matrix4(),
    order = new Map(sampler.points.map((p, index) => [p, index]));
  let cachedPlan = null;
  function measure(samples, groups) {
    let minimum = null,
      missing = 0,
      visible = true;
    const candidateFor = (feature) => {
      const box = sampler.bounds(feature, (feature.worldBox ||= new THREE.Box3())),
        rectangle = box && { minX: box.min.x, maxX: box.max.x, minZ: box.min.z, maxZ: box.max.z },
        bound = box && ground.maximumHeightInBounds?.({ ...rectangle, corners: box.contactCorners }, false),
        lower = box && bound ? Math.max(box.min.y - bound.height, bound.gap ?? -Infinity) : -Infinity;
      return {
        feature,
        rectangle,
        lower,
        eligible: lower >= -0.5,
      };
    };
    const candidates = groups.map(candidateFor).sort((a, b) => a.lower - b.lower);
    for (const candidate of candidates) {
      // Coverage and visibility prove that every skipped point has eligible
      // support. Its conservative gap also proves it cannot change the minimum.
      if (minimum && candidate.eligible && candidate.lower > minimum.gap) {
        const support = ground.maximumHeightInBounds(candidate.rectangle);
        if (support.covered && support.visible) continue;
      }
      for (const sample of candidate.feature.samples) {
        sampler.position(sample, point);
        const hit = ground.sample(point.x, point.z, point.y + 0.5, (sample.groundQuery ||= {}));
        if (!hit) {
          missing++;
          continue;
        }
        visible &&= hit.visible;
        const gap = point.y - hit.height;
        if (!minimum || gap < minimum.gap || (gap === minimum.gap && order.get(sample) < minimum.order))
          minimum = {
            gap,
            point: point.clone(),
            order: order.get(sample),
            mesh: sample.mesh.name,
            vertex: sample.index,
            supportMesh: hit.mesh,
            triangle: hit.triangle,
          };
      }
    }
    return { minimum, missing, visible, samples: samples.length };
  }
  function refresh() {
    group.updateMatrixWorld(true);
    sampler.refresh();
  }
  function plan(yaw) {
    const p = group.position,
      key = `${p.x},${p.y},${p.z},${yaw}`;
    if (cachedPlan?.key === key) return cachedPlan;
    const centre = ground.sample(p.x, p.z, p.y + 0.6),
      right = new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw)),
      forward = new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw));
    const radii = [0.18, 0.28],
      hits = [];
    for (const [axis, radius] of [
      [right, radii[0]],
      [forward, radii[1]],
    ])
      for (const sign of [-1, 1]) hits.push(ground.sample(p.x + axis.x * radius * sign, p.z + axis.z * radius * sign, p.y + 0.6));
    if (!centre || hits.some((h) => !h)) return { key, supported: false, reason: "incomplete bearing footprint" };
    const normal = up
      .clone()
      .addScaledVector(right, -(hits[1].height - hits[0].height) / (2 * radii[0]))
      .addScaledVector(forward, -(hits[3].height - hits[2].height) / (2 * radii[1]))
      .normalize();
    let relief = -Infinity,
      supported = 0,
      witness = null;
    for (const local of primaryPoints) {
      point.copy(local).applyMatrix4(group.matrixWorld);
      const hit = ground.sample(point.x, point.z, p.y + 0.6);
      if (!hit) continue;
      supported++;
      const plane = centre.height - (normal.x * (point.x - p.x) + normal.z * (point.z - p.z)) / normal.y,
        residual = hit.height - plane;
      if (residual > relief) {
        relief = residual;
        witness = { mesh: hit.mesh, triangle: hit.triangle, point: [point.x, hit.height, point.z] };
      }
    }
    const reason =
      normal.y < Math.cos(0.35)
        ? "bearing slope exceeds the bounded pose"
        : relief > 0.12
          ? "rest torso crosses a raised rock shoulder"
          : supported < primaryPoints.length * 0.95
            ? "incomplete torso footprint"
            : null;
    cachedPlan = { key, supported: !reason, reason, normal, relief, samples: primaryPoints.length, supportedSamples: supported, witness };
    return cachedPlan;
  }
  return {
    update(pose, yaw) {
      refresh();
      const bearing = plan(yaw);
      const summary = {
        supported: bearing.supported,
        reason: bearing.reason,
        relief: bearing.relief ?? null,
        samples: bearing.samples || 0,
        supportedSamples: bearing.supportedSamples || 0,
        witness: bearing.witness || null,
      };
      if (!bearing.supported) return { supported: false, reason: bearing.reason, bearing: summary, flippers: [], rootCorrection: 0 };
      const originalEuler = group.rotation.clone(),
        originalY = group.position.y;
      group.quaternion.copy(groundFootQuaternion(yaw, bearing.normal));
      refresh();
      const initial = measure(anchors, anchorGroups);
      if (!initial.minimum || initial.missing > anchors.length * 0.05) {
        group.rotation.copy(originalEuler);
        refresh();
        return { supported: false, reason: "incomplete body support", bearing: summary, flippers: [], rootCorrection: 0 };
      }
      const correction = Math.max(0, 0.0008 + pose.bodyLift - initial.minimum.gap);
      if (correction > 0.15) {
        group.rotation.copy(originalEuler);
        refresh();
        return {
          supported: false,
          reason: "body correction exceeds the bounded pose",
          bearing: summary,
          flippers: [],
          rootCorrection: 0,
          attemptedRootCorrection: correction,
        };
      }
      group.position.y += correction;
      refresh();
      const contacts = [];
      for (const name of names) {
        const bone = bones[name].object,
          samples = flippers[name],
          pivot = bone.getWorldPosition(new THREE.Vector3()),
          original = bone.quaternion.clone(),
          inverseBone = bone.matrixWorld.clone().invert(),
          parent = bone.parent.getWorldQuaternion(new THREE.Quaternion());
        // Every vertex in a paddle is owned solely by this joint or its tip.
        // Rotating their common parent moves the entire already-posed paddle
        // rigidly, so inner iterations need no repeated skinning or shape loss.
        const { localPoints, localGroups, localFaces, faceTree } = paddleStates[name];
        for (const p of localPoints) sampler.position(p.sample, p.point).applyMatrix4(inverseBone);
        for (const feature of localGroups) feature.box.setFromPoints(feature.coordinates);
        refitPaddleTree(faceTree);
        const hierarchy = { root: faceTree, bounds: (node) => contactBoxBounds(node.box, bone.matrixWorld, node.worldBox) };
        const centre = new THREE.Vector3();
        for (const p of localPoints) centre.add(p.point);
        centre
          .divideScalar(localPoints.length || 1)
          .applyMatrix4(bone.matrixWorld)
          .sub(pivot);
        const hingeReach = Math.hypot(centre.x, centre.z),
          hingeAxis = centre.setY(0).cross(up).normalize();
        function paddle(onlyLift) {
          // Only this paddle's base and descendants moved. Root, mesh bind
          // matrices and other limbs are unchanged within its rigid solve.
          bone.updateWorldMatrix(true, true);
          for (const p of localPoints) p.world.copy(p.point).applyMatrix4(bone.matrixWorld);
          let minimum = null,
            missing = 0,
            visible = true;
          const candidateFor = (feature) => {
            const box = contactBoxBounds(feature.box, bone.matrixWorld, (feature.worldBox ||= new THREE.Box3())),
              rectangle = { minX: box.min.x, maxX: box.max.x, minZ: box.min.z, maxZ: box.max.z },
              bound = ground.maximumHeightInBounds?.({ ...rectangle, corners: box.contactCorners }, false),
              lower = bound ? Math.max(box.min.y - bound.height, bound.gap ?? -Infinity) : -Infinity;
            return {
              feature,
              rectangle,
              lower,
              eligible: lower >= -0.5,
            };
          };
          const candidates = localGroups.map(candidateFor).sort((a, b) => a.lower - b.lower);
          for (const candidate of candidates) {
            if (minimum && candidate.eligible && candidate.lower > minimum.gap) {
              const support = ground.maximumHeightInBounds(candidate.rectangle);
              if (support.covered && support.visible) continue;
            }
            for (const p of candidate.feature.points) {
              point.copy(p.world);
              const hit = ground.sample(point.x, point.z, point.y + 0.5);
              if (!hit) {
                missing++;
                continue;
              }
              visible &&= hit.visible;
              const gap = point.y - hit.height;
              if (!minimum || gap < minimum.gap || (gap === minimum.gap && order.get(p.sample) < minimum.order))
                minimum = {
                  gap,
                  point: point.clone(),
                  order: order.get(p.sample),
                  mesh: p.sample.mesh.name,
                  vertex: p.sample.index,
                  supportMesh: hit.mesh,
                  triangle: hit.triangle,
                  normal: hit.normal,
                };
            }
          }
          const surface = ground.minimumSurfaceGap?.(localFaces, Math.min(minimum?.gap ?? Infinity, onlyLift ? 0.00065 : Infinity), hierarchy);
          if (surface?.minimum) {
            minimum = surface.minimum;
            visible &&= minimum.visible;
          }
          const { minimum: surfaceMinimum, ...surfaceQueries } = surface || {};
          return { minimum, missing, visible, surfaceQueries };
        }
        function farthestPoint() {
          let farthest = null;
          for (const p of localPoints) {
            point.copy(p.world);
            const horizontal = Math.hypot(point.x - pivot.x, point.z - pivot.z);
            if (!farthest || horizontal > farthest.distance) farthest = { radius: point.clone().sub(pivot), distance: horizontal };
          }
          return farthest;
        }
        function solve(onlyLift) {
          let current = paddle(onlyLift),
            iterations = 0,
            reason = null,
            angleSoFar = 0,
            blocked = null,
            clear = null;
          const collisionRequired = onlyLift && current.minimum?.gap < 0.00065 - 1e-8;
          while (iterations < 16) {
            if (!current.minimum || current.missing > samples.length * 0.05) {
              reason = "incomplete paddle support";
              break;
            }
            const error = 0.00065 - current.minimum.gap;
            if (onlyLift && !collisionRequired ? error <= 1e-8 : Math.abs(error) < 1e-8) break;
            if (collisionRequired) {
              if (error > 0) blocked = { angle: angleSoFar, gap: current.minimum.gap };
              else clear = { angle: angleSoFar, gap: current.minimum.gap };
            }
            if (hingeReach < 0.02) {
              reason = "insufficient measured paddle reach";
              break;
            }
            let radius = current.minimum.point.clone().sub(pivot),
              horizontal = Math.hypot(radius.x, radius.z);
            if (error < 0 && horizontal < 0.02) {
              const farthest = farthestPoint();
              radius = farthest.radius;
              horizontal = farthest.distance;
            }
            if (horizontal < 0.02) {
              reason = "contact is too near the attached pivot";
              break;
            }
            const axis = hingeAxis,
              velocity = new THREE.Vector3().crossVectors(axis, radius),
              derivative = current.minimum.normal ? current.minimum.normal.dot(velocity) / current.minimum.normal.y : horizontal,
              newton = Math.max(-0.14, Math.min(0.14, Math.atan2(error, Math.max(0.02, derivative))));
            let angle = newton;
            if (blocked && clear) {
              if (blocked.angle >= clear.angle) {
                reason = "collision hinge bracket is not ordered";
                break;
              }
              // Refine the first collision-free pose instead of retaining a
              // variable Newton overshoot. Already-clear raised fins never
              // enter this bracket and retain their authored acting.
              const fraction = Math.max(0.01, Math.min(0.99, (0.00065 - blocked.gap) / (clear.gap - blocked.gap)));
              angle = blocked.angle + (clear.angle - blocked.angle) * fraction - angleSoFar;
            }
            const previous = bone.quaternion.clone();
            bone.quaternion.premultiply(parent.clone().invert().multiply(new THREE.Quaternion().setFromAxisAngle(axis, angle)).multiply(parent));
            if (original.angleTo(bone.quaternion) > 0.75) {
              bone.quaternion.copy(previous);
              reason = "paddle correction exceeds the joint bound";
              break;
            }
            angleSoFar += angle;
            iterations++;
            current = paddle(onlyLift);
          }
          if (
            !reason &&
            current.minimum &&
            (onlyLift && !collisionRequired ? current.minimum.gap < 0.00065 - 1e-8 : Math.abs(current.minimum.gap - 0.00065) > 1e-8)
          )
            reason = "paddle contact did not converge";
          return { ...current, iterations, reason };
        }
        const side = name.endsWith("L") ? "L" : "R",
          active = pinnipedFlipperActivation(pose, side);
        const gesture = Math.max(Math.abs(pose.flipper * active), Math.abs(pose.flipperTip * active) * 0.6),
          // A rolling animal's upper shoulder rises with its authored torso.
          // Keep that paddle free, rather than forcing it down to the beach.
          rollRelease = pinnipedBlendWeight(Math.max(0, Math.sin(pose.bodyRoll) * Math.sign(bone.position.x)) / Math.sin(0.3)),
          contactWeight = name.startsWith("Rear") ? 0 : (1 - pinnipedBlendWeight((gesture - 0.04) / 0.2)) * (1 - rollRelease);
        let result = solve(contactWeight === 0);
        if (contactWeight > 0 && contactWeight < 1) {
          const fitted = bone.quaternion.clone();
          bone.quaternion.copy(original).slerp(fitted, contactWeight);
          result = solve(true);
        }
        const final = result,
          minimum = final.minimum;
        contacts.push({
          name,
          contactWeight,
          hingeReach,
          hingeAxis: hingeAxis.toArray(),
          rollRelease: name.startsWith("Rear") ? 0 : rollRelease,
          planted: contactWeight === 1,
          supported: !!minimum && minimum.gap >= -0.002 && (contactWeight < 1 || minimum.gap <= 0.002) && final.missing <= samples.length * 0.05,
          reason: result.reason,
          samples: samples.length,
          missing: final.missing,
          projectionComplete: final.missing === 0,
          surfaceQueries: final.surfaceQueries,
          supportVisible: final.visible,
          gap: minimum?.gap ?? null,
          rotation: original.angleTo(bone.quaternion),
          witness: minimum
            ? {
                mesh: minimum.mesh,
                vertex: minimum.vertex,
                skinTriangle: minimum.skinTriangle ?? null,
                kind: minimum.kind || "skin vertex",
                derivativeKind: minimum.derivativeKind || "skin vertex",
                supportMesh: minimum.supportMesh,
                triangle: minimum.triangle,
              }
            : null,
        });
      }
      refresh();
      let finalBody = measure(body, bodyGroups);
      const gravity = {
        targetGap: 0.00065 + pose.bodyLift,
        lowering: 0,
        beforeGap: Math.min(finalBody.minimum?.gap ?? Infinity, ...contacts.map((c) => c.gap ?? Infinity)),
        reason: null,
        witness: null,
        surfaceQueries: null,
      };
      // When the gesture releases both shoulders, gravity transfers the weight
      // to the actual lowest skin/terrain feature. The authored roll's old
      // centreline lift otherwise leaves the entire body hanging above rock.
      // A shuffle's intentional hump lift remains part of its target clearance.
      if (contacts.filter((c) => c.name.startsWith("Front")).every((c) => c.contactWeight < 1) && gravity.beforeGap > gravity.targetGap) {
        const { localPoints, localFaces, faceTree } = gravitySkin;
        let lowest = Infinity,
          sum = 0;
        // A conservative soft minimum of every delivered skin point rounds
        // the transfer between neighbouring body contacts. The exact finite
        // faces below still guard rock creases between those points. Bound the
        // elastic clearance to 1.2 mm above the unchanged 0.65 mm target.
        const compliance = 0.0006;
        for (const p of localPoints) {
          p.world.copy(sampler.position(p.sample, p.point));
          const hit = ground.sample(p.world.x, p.world.z, p.world.y + 0.5, (p.sample.groundQuery ||= {}));
          if (!hit) continue;
          const gap = p.world.y - hit.height;
          if (gap < lowest) {
            sum = sum * Math.exp((gap - lowest) / compliance) + 1;
            lowest = gap;
          } else sum += Math.exp((lowest - gap) / compliance);
        }
        refitPaddleTree(faceTree);
        const hierarchy = { root: faceTree, bounds: (node) => contactBoxBounds(node.box, identity, node.worldBox) },
          surface = ground.minimumSurfaceGap?.(localFaces, gravity.beforeGap, hierarchy),
          feature = surface?.minimum;
        if (feature) gravity.beforeGap = Math.min(gravity.beforeGap, feature.gap);
        const { minimum, ...queries } = surface || {};
        gravity.surfaceQueries = queries;
        gravity.witness = feature
          ? { mesh: feature.mesh, vertex: null, skinTriangle: feature.skinTriangle, supportMesh: feature.supportMesh, triangle: feature.triangle }
          : finalBody.minimum?.gap === gravity.beforeGap
            ? {
                mesh: finalBody.minimum.mesh,
                vertex: finalBody.minimum.vertex,
                supportMesh: finalBody.minimum.supportMesh,
                triangle: finalBody.minimum.triangle,
              }
            : contacts.find((c) => c.gap === gravity.beforeGap)?.witness || null;
        gravity.softSupportGap = lowest - compliance * Math.log(sum);
        const safeGap = Math.min(gravity.beforeGap, Math.max(gravity.softSupportGap, gravity.beforeGap - 0.0012)),
          excess = Math.max(0, safeGap - gravity.targetGap),
          lowering = excess * pinnipedBlendWeight(excess / 0.00025);
        if (lowering > 0.15) gravity.reason = "gravity seating exceeds the bounded pose";
        else if (!finalBody.visible || contacts.some((c) => !c.supportVisible) || feature?.visible === false)
          gravity.reason = "gravity seating support is not visible";
        else {
          gravity.lowering = lowering;
          group.position.y -= lowering;
          for (const contact of contacts) {
            if (contact.gap !== null) contact.gap -= lowering;
            contact.surfaceQueries.verticalTranslation = -lowering;
          }
          refresh();
          finalBody = measure(body, bodyGroups);
        }
      }
      gravity.afterGap = gravity.beforeGap - gravity.lowering;
      gravity.afterMappedGap = Math.min(finalBody.minimum?.gap ?? Infinity, ...contacts.map((c) => c.gap ?? Infinity));
      const good = !!finalBody.minimum && finalBody.minimum.gap >= -0.002 && contacts.every((c) => c.supported) && !gravity.reason,
        planted = contacts.filter((c) => c.planted);
      return {
        supported: good,
        contactFitResolved: good,
        supportScope: "bounded contact constraints; not whole-skin coverage",
        fullSkinProjectionCoverage: null,
        contactQueryCoverage: {
          scope: "exact body samples and rigid-paddle queries within native weight precision",
          samples: body.length + contacts.reduce((n, c) => n + c.samples, 0),
          missing: finalBody.missing + contacts.reduce((n, c) => n + c.missing, 0),
          maximumMissingFraction: 0.05,
        },
        plantedContactQueryCoverage: {
          limbs: planted.length,
          samples: planted.reduce((n, c) => n + c.samples, 0),
          missing: planted.reduce((n, c) => n + c.missing, 0),
        },
        reason: good ? null : "body or paddle contact remains unresolved",
        bearing: summary,
        rootCorrection: group.position.y - originalY,
        bodyLiftCorrection: correction,
        gravitySeating: gravity,
        bodyGap: finalBody.minimum?.gap ?? null,
        bodySamples: body.length,
        bodyMissing: finalBody.missing,
        bodySupportVisible: finalBody.visible,
        flippers: contacts,
      };
    },
  };
}
