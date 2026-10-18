import * as THREE from "../three.module.min.js";
import { physicalTime } from "./realism.mjs";

// Paragliders and a hang glider soaring the ridge lift along the north bluffs, after the Torrey
// Pines Gliderport. bin/build_coastal_hinterland.py models the wings in hinterland.glb and writes
// each one's closed route, ground speed and starting phase to the manifest (`hinterland.gliders`).
// A pose is a pure function of the scene clock (realism.mjs physicalTime): pausing, a hidden page
// and reduced motion hold every glider exactly where it is, and there is no frame loop of its own.
// Wings are modelled facing +Z with +Y up; a coordinated turn banks by atan(v^2 kappa / g).

const GRAVITY = 9.81;
const MAX_BANK = THREE.MathUtils.degToRad(32);

// A closed centripetal Catmull-Rom curve through the route's points, tabulated by arc length.
export function createRoute(points, { speed = 8, phase = 0, samples = 48 } = {}) {
  if (!Array.isArray(points) || points.length < 4) throw new Error("A glider route needs at least four points.");
  const p = points.map((q) => new THREE.Vector3(...q));
  const curve = new THREE.CatmullRomCurve3(p, true, "centripetal");
  const dense = curve.getSpacedPoints(p.length * samples);
  dense.pop(); // getSpacedPoints repeats the first point at the end of a closed curve
  const lengths = new Float64Array(dense.length + 1);
  for (let i = 0; i < dense.length; i++) lengths[i + 1] = lengths[i] + dense[i].distanceTo(dense[(i + 1) % dense.length]);
  return { points: dense, lengths, length: lengths[dense.length], speed, phase };
}

function pointAt(route, distance, out) {
  const { points, lengths, length } = route;
  const s = ((distance % length) + length) % length;
  let lo = 0,
    hi = points.length;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (lengths[mid] <= s) lo = mid;
    else hi = mid;
  }
  const a = points[lo],
    b = points[(lo + 1) % points.length];
  const span = lengths[lo + 1] - lengths[lo];
  return out.copy(a).lerp(b, span > 0 ? (s - lengths[lo]) / span : 0);
}

const ahead = new THREE.Vector3(),
  behind = new THREE.Vector3(),
  forward = new THREE.Vector3(),
  right = new THREE.Vector3(),
  up = new THREE.Vector3(),
  left = new THREE.Vector3(),
  bankedUp = new THREE.Vector3(),
  bankedRight = new THREE.Vector3(),
  basis = new THREE.Matrix4(),
  worldUp = new THREE.Vector3(0, 1, 0);

// Position, orientation and bank of a glider `seconds` into the scene clock.
export function gliderPose(route, seconds, out = { position: new THREE.Vector3(), quaternion: new THREE.Quaternion(), bank: 0 }) {
  const distance = route.phase * route.length + route.speed * seconds;
  pointAt(route, distance, out.position);
  // Heading change over 12 m of track gives the curvature the bank follows.
  const step = 6;
  pointAt(route, distance + step, ahead);
  pointAt(route, distance - step, behind);
  forward.subVectors(ahead, behind).normalize();
  const h1 = Math.atan2(out.position.x - behind.x, out.position.z - behind.z),
    h2 = Math.atan2(ahead.x - out.position.x, ahead.z - out.position.z);
  const turn = Math.atan2(Math.sin(h2 - h1), Math.cos(h2 - h1));
  const curvature = turn / step;
  // Heading here is atan2(x, z), so a left turn (toward the glider's +X wing) increases it and
  // gives a positive bank, which lowers the left wing and tilts the lift toward the turn's centre.
  out.bank = THREE.MathUtils.clamp(Math.atan((route.speed * route.speed * curvature) / GRAVITY), -MAX_BANK, MAX_BANK);
  right.crossVectors(forward, worldUp).normalize();
  up.crossVectors(right, forward).normalize();
  const c = Math.cos(out.bank),
    s = Math.sin(out.bank);
  bankedUp.copy(up).multiplyScalar(c).addScaledVector(right, -s);
  bankedRight.copy(right).multiplyScalar(c).addScaledVector(up, s);
  left.copy(bankedRight).negate();
  basis.makeBasis(left, bankedUp, forward);
  out.quaternion.setFromRotationMatrix(basis);
  return out;
}

// Attach each manifest route to its node in the loaded hinterland. A glider poses itself when it
// is drawn, once per scene-clock value, so off-screen and hidden gliders cost nothing. `clock`
// is any { value } in seconds; the scene's own is realism.mjs physicalTime.
export function bindGliders(root, entries = [], clock = physicalTime) {
  const gliders = [];
  for (const entry of entries || []) {
    const node = root.getObjectByName(entry.node);
    if (!node) continue;
    const route = createRoute(entry.route, { speed: entry.speed, phase: entry.phase });
    const pose = { position: new THREE.Vector3(), quaternion: new THREE.Quaternion(), bank: 0 };
    const glider = { node, route, pose, kind: entry.kind, posedAt: NaN };
    const state = (node.userData.glider = { kind: entry.kind, position: [0, 0, 0], bank: 0, seconds: NaN });
    const place = () => {
      const seconds = clock.value;
      if (seconds === glider.posedAt) return;
      glider.posedAt = seconds;
      gliderPose(route, seconds, pose);
      node.position.copy(pose.position);
      node.quaternion.copy(pose.quaternion);
      node.updateMatrixWorld(true);
      pose.position.toArray(state.position);
      state.bank = pose.bank;
      state.seconds = seconds;
    };
    node.traverse((part) => {
      if (!part.isMesh) return;
      // A wing in flight is a small moving silhouette: no cast shadow, contact-occlusion or culling
      // against a stale bounding sphere.
      part.castShadow = false;
      part.frustumCulled = false;
      Object.assign(part.userData, { noOcclusion: true, noContactOcclusion: true, noVolumeDepth: true });
      part.onBeforeRender = place;
    });
    place();
    gliders.push(glider);
  }
  return {
    gliders,
    evidence: () => gliders.map((g) => ({ kind: g.kind, position: g.pose.position.toArray(), bank: g.pose.bank, length: g.route.length })),
  };
}
