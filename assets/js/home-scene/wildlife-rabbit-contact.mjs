import * as THREE from "../three.module.min.js";
import { smooth } from "./wildlife-acting.mjs";
import { footSole, fitFootSole, groundFootQuaternion } from "./wildlife-ground-contact.mjs?v=contact-regions-20261101";

export const RABBIT_PAWS = ["FrontPawL", "FrontPawR", "HindPawL", "HindPawR"];

// Retain the delivered lower-envelope points used by the other grounded paws.
// Qualification checks every rigid toe vertex as the authored paws roll.
export function rabbitSoles(model, bones) {
  return Object.fromEntries(RABBIT_PAWS.map((name) => [name, footSole(model, bones[name].object)]));
}

// Ground support fades during the first/last part of the authored flight.
// The root path, phase, lift and central airborne pose stay unchanged. A hard
// airborne boolean here would pop the 2 cm fit off at the instant of takeoff.
export function rabbitSupportWeight(pose) {
  if (pose.state !== "hop" && pose.state !== "bolt") return 1;
  const takeoff = pose.state === "bolt" ? 0.1 : 0.18,
    landing = pose.state === "bolt" ? 0.85 : 0.76;
  const f = Math.max(0, Math.min(1, (pose.phase - takeoff) / (landing - takeoff)));
  return 1 - smooth(f / 0.18) + smooth((f - 0.82) / 0.18);
}

function bodyEnvelopeSamples(model, group) {
  model.updateMatrixWorld(true);
  const cells = new Map(),
    inverse = group.matrixWorld.clone().invert(),
    point = new THREE.Vector3();
  model.traverse((mesh) => {
    if (!mesh.isSkinnedMesh) return;
    const skin = mesh.geometry.attributes.skinIndex,
      weights = mesh.geometry.attributes.skinWeight;
    for (let i = 0; i < skin.count; i++) {
      let dominant = 0;
      for (let k = 1; k < 4; k++) if (weights.getComponent(i, k) > weights.getComponent(i, dominant)) dominant = k;
      const owner = mesh.skeleton.bones[skin.getComponent(i, dominant)].name;
      if (/Paw|leg|Leg/.test(owner)) continue;
      mesh.getVertexPosition(i, point).applyMatrix4(mesh.matrixWorld).applyMatrix4(inverse);
      const p = point.toArray();
      for (let axis = 0; axis < 3; axis++) {
        const key = owner + ":" + axis + ":" + Math.round(p[(axis + 1) % 3] / 0.04) + "," + Math.round(p[(axis + 2) % 3] / 0.04);
        const c = cells.get(key) || { min: Infinity, max: -Infinity };
        if (p[axis] < c.min) {
          c.min = p[axis];
          c.low = { mesh, index: i };
        }
        if (p[axis] > c.max) {
          c.max = p[axis];
          c.high = { mesh, index: i };
        }
        cells.set(key, c);
      }
    }
  });
  return [...new Map([...cells.values()].flatMap((c) => [c.low, c.high]).map((p) => [p.mesh.uuid + ":" + p.index, p])).values()];
}

export function createRabbitContactFit({ model, group, bones, soles, ground }) {
  const bodySamples = bodyEnvelopeSamples(model, group);
  const changed = ["BodyPose", ...RABBIT_PAWS, "ForelegL", "ForelegR", "HindlegL", "HindlegR"];
  const rest = new Map(
    changed.map((name) => [
      name,
      { position: bones[name].object.position.clone(), quaternion: bones[name].object.quaternion.clone(), scale: bones[name].object.scale.clone() },
    ])
  );
  const unit = new THREE.Quaternion(),
    up = new THREE.Vector3(0, 1, 0);
  function reset() {
    for (const name of changed) {
      const bone = bones[name].object,
        original = rest.get(name);
      bone.position.copy(original.position);
      bone.quaternion.copy(original.quaternion);
      bone.scale.copy(original.scale);
      bone.matrixAutoUpdate = true;
    }
  }
  function update(pose) {
    const weight = rabbitSupportWeight(pose);
    if (weight < 1e-8 || !ground.evidence().ready) return [];
    group.updateMatrixWorld(true);
    const rootQ = group.getWorldQuaternion(new THREE.Quaternion()),
      inverseRootQ = rootQ.clone().invert(),
      yaw = Math.atan2(new THREE.Vector3(0, 0, 1).applyQuaternion(rootQ).x, new THREE.Vector3(0, 0, 1).applyQuaternion(rootQ).z);
    const contacts = [];
    for (const name of RABBIT_PAWS) {
      const paw = bones[name].object,
        fore = name.startsWith("Front"),
        raised = fore ? Math.max(0, Math.min(1, pose.pawRaise)) : 0,
        amount = weight * (1 - smooth(raised)),
        legName = name.replace("FrontPaw", "Foreleg").replace("HindPaw", "Hindleg"),
        leg = bones[legName].object;
      const raw = paw.getWorldPosition(new THREE.Vector3()),
        rawQ = paw.getWorldQuaternion(new THREE.Quaternion()),
        hip = leg.getWorldPosition(new THREE.Vector3()),
        legQ = leg.getWorldQuaternion(new THREE.Quaternion()),
        legWorld = leg.matrixWorld.clone();
      const intentionalLift = fore ? pose.foreLift + raised * (0.15 + pose.groomStroke * 0.012) : pose.hindLift;
      const lift = new THREE.Vector3(0, intentionalLift, 0).applyQuaternion(rootQ).add(new THREE.Vector3(0, pose.lift, 0)),
        reference = raw.clone().sub(lift),
        surface = ground.sample(reference.x, reference.z, reference.y + 0.5);
      if (!surface || amount < 1e-8) {
        contacts.push({ foot: name, contact: false, weight: amount, supported: 0, reason: surface ? "intentional raised paw" : "missing support" });
        continue;
      }
      const orientation = groundFootQuaternion(yaw, surface.normal).multiply(inverseRootQ).multiply(rawQ);
      const fitted = fitFootSole(ground, soles[name], reference, orientation);
      if (fitted.supported !== soles[name].length || Math.abs(fitted.correction) > 0.12) {
        contacts.push({
          foot: name,
          contact: false,
          weight: amount,
          supported: fitted.supported,
          samples: soles[name].length,
          reason: "incomplete or distant support",
        });
        continue;
      }
      fitted.position.y += 0.0006;
      const target = raw.clone().lerp(fitted.position.add(lift), amount),
        blendedOrientation = rawQ.clone().slerp(orientation, amount),
        clear = fitFootSole(ground, soles[name], target, blendedOrientation, true);
      contacts.push({
        foot: name,
        legName,
        raw,
        rawQ,
        hip,
        legQ,
        legWorld,
        amount,
        surface,
        orientation,
        target: clear.position,
        correction: fitted.correction,
        clearanceLift: clear.correction,
        contact: !pose.airborne && raised < 1e-4 && intentionalLift < 1e-5,
        supported: fitted.supported,
        samples: soles[name].length,
        supportVisible: fitted.visible,
        supportMesh: surface.mesh,
        intentionalLift,
        weight: amount,
      });
    }
    const valid = contacts.filter((c) => c.target);
    if (!valid.length) return contacts;
    // A small body accommodation avoids extending every leg by the original
    // path's clearance. Actual support normals supply cross-slope alignment;
    // the authored hips/chest/head acting remains relative to this body.
    const normal = new THREE.Vector3();
    let total = 0,
      correction = 0;
    for (const c of valid) {
      normal.addScaledVector(c.surface.normal, c.amount);
      total += c.amount;
      correction += c.correction * c.amount;
    }
    normal.normalize();
    const delta = new THREE.Quaternion().setFromUnitVectors(up.clone().applyQuaternion(rootQ), normal);
    if (unit.angleTo(delta) > 0.35) delta.slerp(unit, 1 - 0.35 / unit.angleTo(delta));
    const body = bones.BodyPose.object,
      bodyQ = body.getWorldQuaternion(new THREE.Quaternion()),
      parentQ = body.parent.getWorldQuaternion(new THREE.Quaternion());
    body.quaternion.copy(parentQ.invert().multiply(unit.clone().slerp(delta, weight).multiply(bodyQ)));
    const accommodation = Math.max(-0.015, Math.min(0.015, correction / total)) * weight;
    const bodyPosition = body.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(0, accommodation, 0));
    body.position.copy(body.parent.worldToLocal(bodyPosition));
    group.updateMatrixWorld(true);
    // A toe-only fit can sink the hips during a compressed landing. The small
    // retained envelope samples come from actual skin indices; qualification
    // independently checks every delivered body vertex, not this sample set.
    for (const mesh of new Set(bodySamples.map((p) => p.mesh))) mesh.skeleton.update();
    let bodyGap = Infinity;
    const samplePoint = new THREE.Vector3();
    for (const p of bodySamples) {
      p.mesh.getVertexPosition(p.index, samplePoint).applyMatrix4(p.mesh.matrixWorld);
      const hit = ground.sample(samplePoint.x, samplePoint.z, samplePoint.y + 0.5);
      if (hit) bodyGap = Math.min(bodyGap, samplePoint.y - hit.height);
    }
    // The sample reduction is qualified against every delivered skin vertex;
    // its retained-terrain witness needs a 1.6 mm contact margin. A new terrain
    // export still requires its own full-skin/anchor survey.
    const bodyRaise = Math.min(0.08, Math.max(0, -bodyGap + 0.0016));
    if (bodyRaise > 0) {
      const at = body.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(0, bodyRaise, 0));
      body.position.copy(body.parent.worldToLocal(at));
      group.updateMatrixWorld(true);
    }
    for (const c of valid) {
      const paw = bones[c.foot].object,
        leg = bones[c.legName].object,
        hip = leg.getWorldPosition(new THREE.Vector3()),
        oldDirection = c.raw.clone().sub(c.hip),
        newDirection = c.target.clone().sub(hip),
        ratio = newDirection.length() / Math.max(1e-5, oldDirection.length());
      const axis = oldDirection.normalize(),
        d = ratio - 1,
        x = axis.x,
        y = axis.y,
        z = axis.z;
      // Map the original native leg socket to the fitted paw, stretching only
      // along its measured attachment axis. Uniform scaling would fatten it.
      // Keep this affine bone matrix intact; decomposing it to TRS loses the
      // cross-axis terms, and reset() restores ordinary authored matrices.
      const stretch = new THREE.Matrix4().set(
        1 + d * x * x,
        d * x * y,
        d * x * z,
        0,
        d * y * x,
        1 + d * y * y,
        d * y * z,
        0,
        d * z * x,
        d * z * y,
        1 + d * z * z,
        0,
        0,
        0,
        0,
        1
      );
      const rotate = new THREE.Matrix4().makeRotationFromQuaternion(new THREE.Quaternion().setFromUnitVectors(axis, newDirection.normalize()));
      const mapped = new THREE.Matrix4()
        .makeTranslation(...hip.toArray())
        .multiply(rotate)
        .multiply(stretch)
        .multiply(new THREE.Matrix4().makeTranslation(...c.hip.clone().negate().toArray()))
        .multiply(c.legWorld);
      leg.matrix.copy(leg.parent.matrixWorld.clone().invert().multiply(mapped));
      leg.matrixAutoUpdate = false;
      paw.position.copy(paw.parent.worldToLocal(c.target.clone()));
      paw.quaternion.copy(paw.parent.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(c.rawQ.clone().slerp(c.orientation, c.amount)));
      c.position = c.target.toArray();
      c.orientation = paw.getWorldQuaternion(new THREE.Quaternion()).toArray();
      c.legStretch = ratio;
      c.bodyAccommodation = accommodation;
      c.bodyClearanceRaise = bodyRaise;
      c.bodyEnvelopeSamples = bodySamples.length;
      for (const key of ["raw", "rawQ", "hip", "legQ", "legWorld", "target", "surface", "amount"]) delete c[key];
    }
    group.updateMatrixWorld(true);
    return contacts;
  }
  return { reset, update };
}
