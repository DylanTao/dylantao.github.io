import * as THREE from "../three.module.min.js";

// Disabled until its owner supplies the measured version-2 request and a
// separately fingerprinted chair. This layer owns no clock, chair graph,
// collision field, cup, fingers, or routine selection.
const avatars = ["lizard", "south-park", "simpsons", "ghibli", "rick-and-morty"];
const plans = new WeakSet();
const record = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
const keys = (value, allowed) =>
  record(value) && Object.keys(value).length === allowed.length && Object.keys(value).every((key) => allowed.includes(key));
const point = (value) => Array.isArray(value) && value.length === 3 && value.every(Number.isFinite);
const quaternion = (value) =>
  Array.isArray(value) && value.length === 4 && value.every(Number.isFinite) && Math.abs(Math.hypot(...value) - 1) <= 1e-6;
const ease = (value) => {
  const x = Math.max(0, Math.min(1, value));
  return x * x * (3 - 2 * x);
};
const named = (actor, name) => {
  const found = [];
  actor.traverse((bone) => {
    if (bone.isBone && bone.name.replaceAll(".", "") === name) found.push(bone);
  });
  return found.length === 1 ? found[0] : null;
};
const frame = (value) => keys(value, ["position", "quaternion"]) && point(value.position) && quaternion(value.quaternion);
const freeze = (value) => {
  for (const child of Object.values(value)) if (child !== null && typeof child === "object") freeze(child);
  return Object.freeze(value);
};

export function coffeeChairPullPlan(request, avatarId) {
  const value = request?.version === 2 && request.chairPull;
  if (
    !avatars.includes(avatarId) ||
    !keys(value, ["version", "id", "fits"]) ||
    value.version !== 1 ||
    value.id !== "pavilion-chair-pull-v1" ||
    !keys(value.fits, avatars)
  )
    return null;
  for (const id of avatars) {
    const fit = value.fits[id];
    if (
      !keys(fit, ["baseRoot", "feet", "anchor"]) ||
      !point(fit.baseRoot) ||
      fit.baseRoot[0] !== 5.95 ||
      fit.baseRoot[1] < -0.04 ||
      fit.baseRoot[1] > 0.01 ||
      fit.baseRoot[2] !== -0.6 ||
      !keys(fit.feet, ["L", "R"]) ||
      !keys(fit.anchor, ["mesh", "vertex"]) ||
      typeof fit.anchor.mesh !== "string" ||
      !fit.anchor.mesh.length ||
      fit.anchor.mesh.length > 128 ||
      !Number.isInteger(fit.anchor.vertex) ||
      fit.anchor.vertex < 0 ||
      fit.anchor.vertex > 2000000
    )
      return null;
    for (const [side, x] of [
      ["L", 6.06],
      ["R", 5.84],
    ]) {
      const foot = fit.feet[side];
      if (
        !frame(foot) ||
        Math.abs(foot.position[0] - x) > 0.03 ||
        foot.position[1] < 0.03 ||
        foot.position[1] > 0.13 ||
        Math.abs(foot.position[2] + 0.6) > 0.0001
      )
        return null;
    }
  }
  const plan = freeze(structuredClone(value.fits[avatarId]));
  plans.add(plan);
  return plan;
}

export function coffeeChairPullFrame(plan, seconds) {
  if (!plans.has(plan) || !Number.isFinite(seconds) || seconds < 0 || seconds > 3.2) return null;
  const offset = 0.4 * ease((seconds - 0.6) / 2);
  const weight = ease(seconds / 0.6) * (1 - ease((seconds - 2.6) / 0.6));
  const feet = Object.fromEntries(
    ["L", "R"].map((side) => {
      const start = side === "R" ? 0.65 : 1.55;
      const v = Math.max(0, Math.min(1, (seconds - start) / 0.8));
      const position = [...plan.feet[side].position];
      position[2] += 0.4 * v * v * (3 - 2 * v);
      position[1] += 0.05 * Math.sin(Math.PI * v) ** 2;
      return [side, { position, quaternion: [...plan.feet[side].quaternion] }];
    })
  );
  return {
    seconds,
    chairOffset: offset,
    contactWeight: weight,
    position: [5.95, plan.baseRoot[1] - 0.024 * weight, -0.6 + offset],
    facing: Math.PI,
    feet,
    knees: {
      L: new THREE.Vector3(0.18, -0.05, -1).normalize().toArray(),
      R: new THREE.Vector3(-0.18, -0.05, -1).normalize().toArray(),
    },
  };
}

function closedRail(mesh, isCurrent) {
  const current = () => {
    try {
      return typeof isCurrent === "function" && isCurrent() === true;
    } catch {
      return false;
    }
  };
  if (!mesh?.isMesh || mesh.isSkinnedMesh || !current()) return null;
  const geometry = mesh.geometry,
    position = geometry?.attributes?.position,
    index = geometry?.index;
  if (
    !position ||
    !index ||
    position.itemSize !== 3 ||
    position.normalized ||
    !position.count ||
    !["Float32Array", "Float64Array"].includes(position.array?.constructor.name) ||
    !["Uint16Array", "Uint32Array"].includes(index.array?.constructor.name) ||
    index.count < 12 ||
    index.count % 3 ||
    index.count > 768 ||
    Object.keys(geometry.morphAttributes).length
  )
    return null;
  mesh.updateWorldMatrix(true, false);
  const matrix = mesh.matrixWorld.clone(),
    positions = position.array.slice(),
    indices = index.array.slice();
  const vertices = [],
    canonical = new Map(),
    ids = [],
    edges = new Map(),
    faces = [];
  for (let i = 0; i < position.count; i++) {
    const p = new THREE.Vector3().fromBufferAttribute(position, i).applyMatrix4(matrix);
    if (!p.toArray().every(Number.isFinite)) return null;
    const key = p.toArray().join(",");
    if (!canonical.has(key)) {
      canonical.set(key, vertices.length);
      vertices.push(p);
    }
    ids.push(canonical.get(key));
  }
  let volume = 0;
  for (let i = 0; i < index.count; i += 3) {
    const v = [0, 1, 2].map((k) => ids[index.getX(i + k)]);
    if (v.some((id) => id === undefined)) return null;
    const triangle = new THREE.Triangle(...v.map((id) => vertices[id]));
    if (!(triangle.getArea() > 0)) return null;
    volume += triangle.a.dot(new THREE.Vector3().crossVectors(triangle.b, triangle.c)) / 6;
    for (let k = 0; k < 3; k++) {
      const a = v[k],
        b = v[(k + 1) % 3],
        key = [Math.min(a, b), Math.max(a, b)].join(",");
      const rows = edges.get(key) || [];
      rows.push([a, b]);
      edges.set(key, rows);
    }
    faces.push({ id: i / 3, triangle, box: new THREE.Box3().setFromPoints([triangle.a, triangle.b, triangle.c]) });
  }
  if (!(volume > 0) || [...edges.values()].some((rows) => rows.length !== 2 || rows[0][0] !== rows[1][1] || rows[0][1] !== rows[1][0])) return null;
  const originalBox = new THREE.Box3().setFromPoints(vertices),
    box = originalBox.clone(),
    moving = faces.map((f) => ({ ...f, triangle: f.triangle.clone(), box: f.box.clone() }));
  if (
    originalBox.min.distanceTo(new THREE.Vector3(6.34499979019165, 0.6449999809265137, -0.9750000238418579)) > 0.001 ||
    originalBox.max.distanceTo(new THREE.Vector3(6.440006732940674, 0.8949999809265137, -0.9050036668777466)) > 0.001
  )
    return null;
  const directions = [
    [1, 0.317, 0.131],
    [0.193, 1, 0.413],
    [0.271, 0.157, 1],
  ].map((p) => new THREE.Vector3(...p).normalize());
  const ray = new THREE.Ray(),
    hit = new THREE.Vector3(),
    translation = new THREE.Vector3();
  const contains = (point) => {
    const p = point.clone().sub(translation);
    if (!originalBox.containsPoint(p)) return false;
    let votes = 0;
    for (const direction of directions) {
      ray.set(p, direction);
      const distances = [];
      for (const face of faces)
        if (ray.intersectTriangle(face.triangle.a, face.triangle.b, face.triangle.c, false, hit)) distances.push(p.distanceTo(hit));
      distances.sort((a, b) => a - b);
      let count = 0,
        last = -1;
      for (const distance of distances)
        if (distance - last > 1e-5) {
          last = distance;
          count++;
        }
      votes += count % 2;
    }
    return votes >= 2;
  };
  return {
    box,
    faces: moving,
    contains,
    update(offset) {
      if (
        !current() ||
        mesh.geometry !== geometry ||
        geometry.attributes.position !== position ||
        geometry.index !== index ||
        position.array.length !== positions.length ||
        index.array.length !== indices.length ||
        !position.array.every((v, i) => v === positions[i]) ||
        !index.array.every((v, i) => v === indices[i])
      )
        return false;
      mesh.updateWorldMatrix(true, false);
      for (let i = 0; i < 16; i++) if (![12, 13, 14].includes(i) && mesh.matrixWorld.elements[i] !== matrix.elements[i]) return false;
      translation.setFromMatrixPosition(mesh.matrixWorld).sub(new THREE.Vector3().setFromMatrixPosition(matrix));
      if (translation.x !== 0 || translation.y !== 0 || Math.abs(translation.z - offset) > 1e-12) return false;
      box.copy(originalBox).translate(translation);
      for (let i = 0; i < moving.length; i++) {
        for (const side of ["a", "b", "c"]) moving[i].triangle[side].copy(faces[i].triangle[side]).add(translation);
        moving[i].box.copy(faces[i].box).translate(translation);
      }
      return true;
    },
  };
}

function handDistance(points, rail) {
  let best = Infinity,
    witness = null,
    triangleTests = 0;
  for (const row of points) {
    const p = row.p;
    if (best >= 0 && rail.box.distanceToPoint(p) > best + 1e-10) continue;
    if (best < 0 && !rail.box.containsPoint(p)) continue;
    const inside = rail.box.containsPoint(p) && rail.contains(p);
    if (best < 0 && !inside) continue;
    let distance = Infinity,
      nearest = null,
      face = null;
    for (const f of rail.faces) {
      if (f.box.distanceToPoint(p) > distance + 1e-10) continue;
      triangleTests++;
      const at = f.triangle.closestPointToPoint(p, new THREE.Vector3()),
        d = at.distanceTo(p);
      if (d < distance) {
        distance = d;
        nearest = at;
        face = f.id;
      }
    }
    const signed = inside ? -distance : distance;
    if (signed < best) {
      best = signed;
      witness = { mesh: row.mesh, vertex: row.vertex, p: p.toArray(), face, near: nearest.toArray(), inside, distanceM: distance };
    }
  }
  return Number.isFinite(best) && witness
    ? { minimumSignedM: best, witness, verticesInput: points.length, railFaces: rail.faces.length, triangleTests }
    : null;
}

function endpoint(upper, lower, hand, readPoint, target) {
  upper.updateWorldMatrix(true, true);
  const a = upper.getWorldPosition(new THREE.Vector3()),
    b = lower.getWorldPosition(new THREE.Vector3()),
    end = readPoint();
  const l1 = a.distanceTo(b),
    l2 = b.distanceTo(end),
    direction = target.clone().sub(a),
    asked = direction.length();
  const minimum = Math.abs(l1 - l2),
    maximum = l1 + l2,
    wrist = hand.quaternion.clone();
  if (!Number.isFinite(asked) || asked <= minimum + 1e-7 || asked >= maximum - 1e-7) return null;
  direction.normalize();
  const along = (l1 * l1 - l2 * l2 + asked * asked) / (2 * asked),
    pole = b.clone().sub(a);
  pole.addScaledVector(direction, -pole.dot(direction));
  if (pole.lengthSq() < 1e-16) return null;
  const elbow = a
    .clone()
    .addScaledVector(direction, along)
    .addScaledVector(pole.normalize(), Math.sqrt(Math.max(0, l1 * l1 - along * along)));
  const aim = (bone, read, wanted) => {
    const pivot = bone.getWorldPosition(new THREE.Vector3()),
      from = read().sub(pivot).normalize(),
      to = wanted.clone().sub(pivot).normalize();
    const delta = new THREE.Quaternion().setFromUnitVectors(from, to),
      parent = bone.parent.getWorldQuaternion(new THREE.Quaternion()).normalize();
    bone.quaternion.premultiply(parent.clone().invert().multiply(delta).multiply(parent)).normalize();
    bone.updateWorldMatrix(false, true);
  };
  aim(upper, () => lower.getWorldPosition(new THREE.Vector3()), elbow);
  aim(lower, readPoint, target);
  const error = readPoint().distanceTo(target);
  return error <= 1e-6 && hand.quaternion.equals(wrist) ? { pass: true, error, localWristPreserved: true } : null;
}

export function createCoffeeChairMotion({ actor, avatarId, request, feet, rail: binding } = {}) {
  const plan = coffeeChairPullPlan(request, avatarId);
  if (
    !plan ||
    !actor?.isObject3D ||
    typeof feet?.transfer !== "function" ||
    typeof feet?.restore !== "function" ||
    typeof feet?.evidence !== "function"
  )
    return null;
  const upper = named(actor, "ArmL"),
    lower = named(actor, "ForearmL"),
    hand = named(actor, "HandL");
  const legs = ["L", "R"].map((side) => ({
    side,
    hip: named(actor, "Thigh" + side),
    knee: named(actor, "Shin" + side),
    foot: named(actor, "Foot" + side),
  }));
  if (!upper || !lower || !hand || legs.some((leg) => !leg.hip || !leg.knee || !leg.foot)) return null;
  const rail = closedRail(binding?.mesh, binding?.isCurrent);
  if (!rail) return null;
  const points = [];
  actor.traverse((mesh) => {
    if (!mesh.isSkinnedMesh) return;
    const a = mesh.geometry.attributes;
    for (let id = 0; id < a.position.count; id++) {
      const influences = [];
      for (let k = 0; k < 4; k++)
        if (a.skinWeight.array[id * 4 + k] > 1e-9)
          influences.push({ bone: mesh.skeleton.bones[a.skinIndex.array[id * 4 + k]], weight: a.skinWeight.array[id * 4 + k] });
      if (influences.length !== 1 || influences[0].bone !== hand || influences[0].weight !== 1) continue;
      const bind = new THREE.Vector3().fromBufferAttribute(a.position, id).applyMatrix4(mesh.bindMatrix),
        boneIndex = a.skinIndex.getX(id),
        inverse = mesh.skeleton.boneInverses[boneIndex];
      points.push({
        mesh: mesh.name,
        vertex: id,
        read: () =>
          bind
            .clone()
            .applyMatrix4(new THREE.Matrix4().multiplyMatrices(hand.matrixWorld, inverse))
            .applyMatrix4(mesh.bindMatrixInverse)
            .applyMatrix4(mesh.matrixWorld),
      });
    }
  });
  const anchors = points.filter((p) => p.mesh === plan.anchor.mesh && p.vertex === plan.anchor.vertex);
  if (!points.length || anchors.length !== 1) return null;
  const anchor = anchors[0];
  let current = null,
    saved = null,
    left = null,
    correctionX = 0,
    previousTime = null,
    disposed = false,
    failure = null;
  const restoreLeft = () => {
    if (!left) return;
    for (const [bone, q] of left) bone.quaternion.copy(q);
    left = null;
  };
  const restore = () => {
    restoreLeft();
    if (saved) {
      feet.restore();
      actor.position.copy(saved.position);
      actor.rotation.copy(saved.rotation);
      saved = null;
      actor.updateWorldMatrix(true, true);
    }
    current = null;
  };
  const reject = (reason) => {
    restore();
    failure = reason;
    return null;
  };
  return {
    sample: (seconds) => (disposed ? null : coffeeChairPullFrame(plan, seconds)),
    restore,
    prepare(seconds, { paused = false } = {}) {
      if (disposed || failure) return null;
      if (paused) return current;
      if (current || (previousTime !== null && seconds < previousTime)) return reject("restore or reset required before a new source pose");
      const pose = coffeeChairPullFrame(plan, seconds);
      if (!pose || !rail.update(pose.chairOffset)) return reject("invalid time or changed delivered chair");
      saved = { position: actor.position.clone(), rotation: actor.rotation.clone() };
      actor.position.fromArray(pose.position);
      actor.rotation.set(0, pose.facing, 0);
      actor.updateWorldMatrix(true, true);
      const constraints = [];
      for (const { side, hip, knee, foot } of legs) {
        const a = hip.getWorldPosition(new THREE.Vector3()),
          b = knee.getWorldPosition(new THREE.Vector3()),
          c = foot.getWorldPosition(new THREE.Vector3()),
          target = new THREE.Vector3(...pose.feet[side].position);
        const sourceReach = a.distanceTo(b) + b.distanceTo(c),
          reach = sourceReach - 0.002,
          horizontal2 = (a.x - target.x) ** 2 + (a.z - target.z) ** 2;
        if (horizontal2 >= reach * reach) return reject("unreachable horizontal leg target");
        const deficit = a.y - target.y - Math.sqrt(reach * reach - horizontal2),
          band = 0.004;
        const drop = deficit <= -band ? 0 : deficit >= band ? deficit : (deficit + band) ** 2 / (4 * band);
        constraints.push({
          side,
          sourceHip: a.toArray(),
          target: target.toArray(),
          sourceReachM: sourceReach,
          kneeSlackM: 0.002,
          deficitM: deficit,
          dropM: drop,
        });
      }
      const drop = Math.max(...constraints.map((c) => c.dropM));
      if (!Number.isFinite(drop) || drop > 0.06) return reject("measured knee drop exceeds its bound");
      pose.position[1] -= drop;
      actor.position.fromArray(pose.position);
      actor.updateWorldMatrix(true, true);
      if (!feet.transfer(pose.feet, pose.knees)) return reject("foot transfer rejected");
      const actual = feet.evidence().transfer?.legs;
      if (
        actual?.length !== 2 ||
        new Set(actual.map((leg) => leg.side)).size !== 2 ||
        actual.some(
          (leg) =>
            !["L", "R"].includes(leg.side) ||
            !Number.isFinite(leg.drift) ||
            !Number.isFinite(leg.reachViolation) ||
            !Number.isFinite(leg.orientationError) ||
            leg.drift < 0 ||
            leg.reachViolation < 0 ||
            leg.orientationError < -1e-12 ||
            leg.drift > 1e-6 ||
            leg.reachViolation > 1e-6 ||
            leg.orientationError > 1e-12
        )
      )
        return reject("actual foot endpoint exceeds its bound");
      for (const { side, foot } of legs) {
        const actualPosition = foot.getWorldPosition(new THREE.Vector3());
        const rotation = foot.getWorldQuaternion(new THREE.Quaternion()).normalize();
        if (
          actualPosition.distanceTo(new THREE.Vector3(...pose.feet[side].position)) > 1e-6 ||
          1 - Math.abs(rotation.dot(new THREE.Quaternion(...pose.feet[side].quaternion).normalize())) > 1e-12
        )
          return reject("delivered foot frame disagrees with solver evidence");
      }
      current = { ...pose, kneeDrop: drop, kneeConstraints: constraints, actualLegs: structuredClone(actual), contact: null };
      previousTime = seconds;
      failure = null;
      return current;
    },
    contact({ paused = false } = {}) {
      if (disposed || failure || !current) return null;
      if (paused || current.contact) return current.contact;
      if (!rail.update(current.chairOffset)) return reject("delivered chair changed during contact");
      const weight = current.contactWeight;
      if (weight === 0) return (current.contact = { pass: true, weight: 0, nativeLeftPreserved: true });
      left = [upper, lower, hand].map((bone) => [bone, bone.quaternion.clone()]);
      const resetLeft = () => {
        for (const [bone, q] of left) bone.quaternion.copy(q);
        actor.updateWorldMatrix(true, true);
      };
      const readHand = () => points.map((p) => ({ mesh: p.mesh, vertex: p.vertex, p: p.read() }));
      const nativePoint = anchor.read(),
        target = new THREE.Vector3(6.34399979019165, 0.87, -0.94 + current.chairOffset),
        goal = nativePoint.clone().lerp(target, weight),
        initialX = goal.x;
      resetLeft();
      if (!endpoint(upper, lower, hand, anchor.read, goal)) return reject("nominal actual Hand-local point unreachable");
      const initial = handDistance(readHand(), rail);
      if (!initial) return reject("missing finite rail distance");
      const wanted = Math.max(0.001, initial.minimumSignedM) * (1 - weight ** 8) + 0.001 * weight ** 8;
      goal.x += correctionX;
      let fit = null,
        distance = null,
        error = Infinity;
      const iterations = [];
      for (let i = 0; i < 8; i++) {
        resetLeft();
        fit = endpoint(upper, lower, hand, anchor.read, goal);
        if (!fit) return reject("bounded actual endpoint solve failed");
        distance = handDistance(readHand(), rail);
        if (!distance) return reject("missing complete finite hand/rail distance");
        error = wanted - distance.minimumSignedM;
        iterations.push({ iteration: i, goalX: goal.x, actualDistanceM: distance.minimumSignedM, distanceTarget: wanted, error });
        if (Math.abs(error) <= 1e-6) break;
        const before = iterations.at(-2),
          derivative = before ? (error - before.error) / (goal.x - before.goalX) : 1;
        const step = Number.isFinite(derivative) && derivative > 0.1 && derivative < 10 ? error / derivative : error;
        goal.x -= Math.max(-0.03, Math.min(0.03, step));
        if (Math.abs(goal.x - initialX) > 0.1) return reject("actual Hand-local endpoint leaves bounded envelope");
      }
      if (!fit || Math.abs(error) > 1e-6) return reject("finite rail distance residual exceeds its bound");
      correctionX = goal.x - initialX;
      return (current.contact = {
        ...fit,
        weight,
        nativePoint: nativePoint.toArray(),
        target: target.toArray(),
        goal: goal.toArray(),
        actual: anchor.read().toArray(),
        distance,
        distanceTarget: wanted,
        distanceError: error,
        iterations,
      });
    },
    reset() {
      restore();
      correctionX = 0;
      previousTime = null;
      failure = null;
    },
    evidence: () => ({
      available: !disposed && !failure,
      failure,
      cachedHandVertices: points.length,
      railTriangles: rail.faces.length,
      frame: current,
    }),
    dispose() {
      restore();
      correctionX = 0;
      previousTime = null;
      disposed = true;
    },
  };
}
