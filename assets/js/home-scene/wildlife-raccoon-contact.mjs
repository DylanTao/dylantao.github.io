import * as THREE from "../three.module.min.js";
import { createSkinContactSampler } from "./wildlife-resting-contact.mjs?v=contact-20261101";

// A tucked forearm folds out beside the curled chest before settling upward.
// Interpolate within the hip/foot circle, so no segment length or paw changes.
export function raccoonCurledLegPole(direction, original, side, curl) {
  if (curl === 0) return original;
  const outward = new THREE.Vector3(side, 0, 0).addScaledVector(direction, -direction.x * side),
    upper = new THREE.Vector3(side * 0.35, 1, 0);
  upper.addScaledVector(direction, -upper.dot(direction));
  if (upper.lengthSq() < 1e-12) upper.copy(outward);
  upper.normalize();
  if (outward.lengthSq() < 1e-12) outward.copy(upper);
  outward.normalize();
  const between = (a, b, t) => {
    const rotation = new THREE.Quaternion().setFromUnitVectors(a, b);
    return a.clone().applyQuaternion(new THREE.Quaternion().slerp(rotation, t)).normalize();
  };
  return between(between(original, outward, curl), between(outward, upper, curl), curl);
}

// The curled trunk rides BodyPose; the four independent paw anchors and their
// two-segment legs are fitted afterwards. A torso correction must never move
// the root route or lift a planted paw together with the body.
export function createRaccoonBodyContact({ model, group, body, ground }) {
  const sampler = createSkinContactSampler(model),
    belongs = (bone) => {
      for (let ancestor = bone; ancestor; ancestor = ancestor.parent) {
        if (/^Tail/.test(ancestor.name)) return false;
        if (ancestor === body) return true;
      }
      return false;
    },
    points = sampler.points
      .filter((p) => p.channels.every((c) => c.weight < 1e-4 || belongs(p.mesh.skeleton.bones[c.index])))
      .map((sample) => ({ sample, world: new THREE.Vector3() })),
    lookup = new Map(),
    faces = [];
  for (const p of points) {
    if (!lookup.has(p.sample.mesh)) lookup.set(p.sample.mesh, new Map());
    lookup.get(p.sample.mesh).set(p.sample.index, p);
  }
  for (const [mesh, entries] of lookup) {
    const indices = mesh.geometry.index,
      count = indices?.count ?? mesh.geometry.attributes.position.count;
    for (let i = 0; i < count; i += 3) {
      const records = [0, 1, 2].map((k) => entries.get(indices ? indices.getX(i + k) : i + k));
      if (records.every(Boolean)) faces.push({ mesh: mesh.name, triangle: i / 3, points: records.map((p) => p.world) });
    }
  }
  const saved = new THREE.Vector3(),
    worldPosition = new THREE.Vector3(),
    clearance = 0.00065;
  function refresh() {
    group.updateMatrixWorld(true);
    sampler.refresh();
  }
  function measure() {
    refresh();
    let minimum = null,
      missing = 0,
      visible = true;
    for (const p of points) {
      sampler.position(p.sample, p.world);
      const hit = ground.sample(p.world.x, p.world.z, p.world.y + 0.5);
      if (!hit) {
        missing++;
        continue;
      }
      visible &&= hit.visible;
      const gap = p.world.y - hit.height;
      if (!minimum || gap < minimum.gap)
        minimum = { gap, mesh: p.sample.mesh.name, vertex: p.sample.index, supportMesh: hit.mesh, triangle: hit.triangle };
    }
    const surface = ground.minimumSurfaceGap(faces, minimum?.gap ?? Infinity);
    if (surface.minimum) {
      minimum = surface.minimum;
      visible &&= minimum.visible;
    }
    const { minimum: feature, ...surfaceQueries } = surface;
    return { minimum, missing, visible, surfaceQueries };
  }
  return {
    update(pose) {
      const scope = "curled torso and head; paw anchors, leg IK and tail contact are separate";
      if (pose.curl === 0) return { evaluated: false, supportResolved: null, scope, lift: 0, reason: null };
      saved.copy(body.position);
      const before = measure();
      let reason =
          !before.minimum || before.missing ? "incomplete curled-body footprint" : !before.visible ? "curled-body support is not visible" : null,
        lift = 0,
        after = before;
      if (!reason) {
        const needed = clearance - before.minimum.gap,
          band = 0.0005;
        // This C1 upper envelope of max(0, needed) remains conservative and
        // releases the last fraction of a millimetre without a wake-up corner.
        lift = needed <= -band ? 0 : needed >= band ? needed : (needed + band) ** 2 / (4 * band);
        if (lift > 0.08) reason = "curled-body correction exceeds its measured-pose bound";
        else if (lift > 0) {
          body.getWorldPosition(worldPosition);
          worldPosition.y += lift;
          body.position.copy(body.parent.worldToLocal(worldPosition));
          after = measure();
          if (!after.minimum || after.missing || !after.visible || after.minimum.gap < clearance - 1e-7)
            reason = "curled-body support remains unresolved";
        }
      }
      if (reason) {
        body.position.copy(saved);
        refresh();
        lift = 0;
        after = before;
      }
      const witness = after.minimum;
      return {
        evaluated: true,
        supportResolved: !reason,
        scope,
        fullSkinCoverage: null,
        lift,
        beforeGap: before.minimum?.gap ?? null,
        gap: witness?.gap ?? null,
        samples: points.length,
        faces: faces.length,
        missing: after.missing,
        supportVisible: after.visible,
        reason,
        surfaceQueries: after.surfaceQueries,
        witness: witness
          ? {
              mesh: witness.mesh,
              vertex: witness.vertex ?? null,
              skinTriangle: witness.skinTriangle ?? null,
              supportMesh: witness.supportMesh,
              triangle: witness.triangle,
            }
          : null,
      };
    },
  };
}
