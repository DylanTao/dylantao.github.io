import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { pathToFileURL } from "node:url";
import { parseArgs } from "node:util";

const { values: options } = parseArgs({
  options: {
    repo: { type: "string", default: process.cwd() },
    lift: { type: "string", multiple: true },
    avatar: { type: "string", multiple: true },
    samples: { type: "string", default: "49" },
    phase: { type: "string", multiple: true },
    near: { type: "string", default: "0.29" },
    out: { type: "string" },
    help: { type: "boolean" },
  },
});
if (options.help) {
  process.stdout.write(
    "Run at the site checkout or give --repo PATH. Select one or more --avatar ID and --lift ID.\n" +
      "Use --samples COUNT for a complete held repetition, or repeat --phase NUMBER for specific witnesses.\n" +
      "Use --out FILE for the JSON receipt. Without --out, the receipt goes to stdout.\n" +
      "For a faster near-contact pass, use --near 0.13. Farther regions can be omitted from the results.\n"
  );
  process.exit(0);
}
const start = performance.now();
const root = path.resolve(options.repo);
const count = Number(options.samples);
if (!Number.isSafeInteger(count) || count < 2) throw new RangeError("--samples must be an integer of at least two");
const phases = (options.phase ?? Array.from({ length: count }, (_, i) => i / (count - 1))).map(Number);
if (phases.some((u) => !Number.isFinite(u) || u < 0 || u > 1)) throw new RangeError("--phase must be between zero and one");
const search = Number(options.near);
if (!Number.isFinite(search) || search < 0.02) throw new RangeError("--near must be at least 0.02 m");
const liftFilter = options.lift;
const avatarFilter = options.avatar;
const locate = (name) => path.join(root, name);
const src = (name) => import(pathToFileURL(locate(name)).href);
const sha = (name) => createHash("sha256").update(fs.readFileSync(name)).digest("hex");
const { loadNativeAvatar, THREE } = await src("test/helpers/coastal-native-avatar.mjs");
const rigFile = locate("assets/js/home-scene/lift-rig.mjs");
const { createLiftRig } = await import(pathToFileURL(rigFile).href);
const { sessionPose } = await src("assets/js/home-scene/gym-session.mjs");
const { LIFT_STATION, REP_SECONDS } = await src("assets/js/home-scene/training.mjs");
const manifest = JSON.parse(fs.readFileSync(locate("assets/models/home/manifest.json"), "utf8"));
const gym = manifest.equipment.gym;
const lifts = ["squat", "front-squat", "bench", "incline-bench", "close-grip-bench", "ohp"].filter(
  (name) => !liftFilter || liftFilter.includes(name)
);
const avatars = manifest.avatars.filter(({ id }) => !avatarFilter || avatarFilter.includes(id));
if (lifts.length === 0 || avatars.length === 0) throw new Error("The filter matched no supported lift or delivered avatar");
const SHAFT = 0.67,
  RADIUS = 0.0145,
  SEARCH = search;
const V = () => new THREE.Vector3();
const stats = {};

function classify(name, material, p, bones) {
  if (/hair|lens|glass|iris|eye/i.test(material) || /^Head|Eyes?|Jaw|Neck/i.test(name)) return "head";
  if (/^Hand|Thumb|Pinky|Index|Middle|Ring|Finger/i.test(name)) return name.endsWith("L") ? "handL" : "handR";
  if (/^Foot|Toe/i.test(name)) return "foot";
  if (/^Thigh|Shin|Knee/i.test(name)) return "leg";
  if (/tail/i.test(name + material)) return "tail";
  if (/^Forearm/.test(name)) {
    const side = name.at(-1);
    return p.distanceToSquared(bones["Hand" + side]) < 0.054 ** 2 ? "grip-wrist" : "forearm";
  }
  if (/^Arm/.test(name)) {
    const side = name.at(-1);
    return p.distanceToSquared(bones["Arm" + side]) < 0.13 ** 2 ? "shoulder" : "upper-arm";
  }
  if (!name && /brow|lash/i.test(material)) return "head";
  return "torso";
}
function sourceMeshes(actor) {
  const bones = {};
  const meshes = [];
  actor.traverse((node) => {
    if (node.isBone) bones[node.name.replaceAll(".", "")] = node;
    if (!node.isMesh || !node.visible || !node.geometry.attributes.position) return;
    const { position, skinIndex, skinWeight } = node.geometry.attributes;
    const names = node.skeleton?.bones.map((bone) => bone.name.replaceAll(".", ""));
    const regions = Array.from({ length: position.count }, (_, i) => {
      if (!names) return "";
      let index = 0;
      for (let k = 1; k < 4; k++) if (skinWeight.getComponent(i, k) > skinWeight.getComponent(i, index)) index = k;
      return names[skinIndex.getComponent(i, index)];
    });
    const material = node.material?.name || "";
    const index = node.geometry.index?.array || Uint32Array.from({ length: position.count }, (_, i) => i);
    meshes.push({ node, regions, material, index, positions: new Float64Array(position.count * 3), classes: new Array(position.count) });
  });
  return { bones, meshes };
}
function slot() {
  return { min: Infinity, maxPerPhase: -Infinity, phasesBelow2mm: 0, axisCrossingPhases: 0, witness: null };
}
function add(stats, key, value, proof) {
  const record = stats[key] || (stats[key] = slot());
  if (value < record.min) {
    record.min = value;
    record.witness = proof;
  }
  return record;
}
function phaseStats(stats, phase, countAxis = true) {
  for (const [part, { distance }] of Object.entries(phase)) {
    const record = stats[part];
    record.maxPerPhase = Math.max(record.maxPerPhase, distance);
    if (distance < -0.002) record.phasesBelow2mm++;
    if (countAxis && distance < -RADIUS + 1e-7) record.axisCrossingPhases++;
  }
}
function minimum(point) {
  return { distance: Math.hypot(point[1], point[2]), point, bary: point.slice(3) };
}
function edge(a, b) {
  const dy = b[1] - a[1],
    dz = b[2] - a[2];
  const f = Math.max(0, Math.min(1, -(a[1] * dy + a[2] * dz) / (dy * dy + dz * dz || 1)));
  return minimum(a.map((n, i) => n + (b[i] - n) * f));
}
function projectClip(vertices, border, semiplane) {
  const out = [];
  for (let i = 0; i < vertices.length; i++) {
    const a = vertices[i],
      b = vertices[(i + 1) % vertices.length];
    const aa = (a[0] - border) * semiplane >= 0,
      bb = (b[0] - border) * semiplane >= 0;
    if (aa) out.push(a);
    if (aa !== bb) {
      const f = (border - a[0]) / (b[0] - a[0]);
      out.push(a.map((n, k) => n + (b[k] - n) * f));
    }
  }
  return out;
}
function threeClosest(a, b, c) {
  const by = b[1] - a[1],
    bz = b[2] - a[2],
    cy = c[1] - a[1],
    cz = c[2] - a[2];
  const det = by * cz - bz * cy;
  if (Math.abs(det) > 1e-14) {
    const bWeight = (-a[1] * cz + a[2] * cy) / det,
      cWeight = (-by * a[2] + bz * a[1]) / det;
    if (bWeight >= 0 && cWeight >= 0 && bWeight + cWeight <= 1) {
      const p = a.map((n, i) => n + bWeight * (b[i] - n) + cWeight * (c[i] - n));
      return { distance: 0, point: p, bary: p.slice(3) };
    }
  }
  const ab = edge(a, b),
    bc = edge(b, c),
    ca = edge(c, a);
  return ab.distance <= bc.distance ? (ab.distance <= ca.distance ? ab : ca) : bc.distance <= ca.distance ? bc : ca;
}
function closest(a, b, c) {
  if (Math.max(Math.abs(a[0]), Math.abs(b[0]), Math.abs(c[0])) <= SHAFT) return threeClosest(a, b, c);
  const vertices = projectClip(projectClip([a, b, c], -SHAFT, 1), SHAFT, -1);
  let best = null;
  for (let i = 1; i < vertices.length - 1; i++) {
    const q = threeClosest(vertices[0], vertices[i], vertices[i + 1]);
    if (!best || q.distance < best.distance) best = q;
  }
  return best;
}
function publicArgs(name) {
  const station = LIFT_STATION[name],
    span = REP_SECONDS[name];
  const setup = { kind: "setup", lift: name, station, start: 0, end: 5 };
  const set = { kind: "set", lift: name, station, start: 5, end: 5 + span * 3, reps: 3, warmup: true, weight: 45 };
  const timeline = { segments: [setup, set] };
  return { span, phases: (u) => sessionPose({ timeline, state: { segment: set, index: 1, local: u * span } }, gym) };
}
function examine(source, center, axis, f, summary, details) {
  const upward = V().set(0, 1, 0).addScaledVector(axis, -axis.y).normalize();
  const normal = V().crossVectors(axis, upward).normalize();
  const p = V(),
    delta = V(),
    worldPoint = V();
  const bones = Object.fromEntries(Object.entries(source.bones).map(([name, item]) => [name, item.getWorldPosition(V())]));
  const frame = {},
    vertices = {};
  let maxX = 0;
  const witness = (node, material, triangle, region, distance, coords) => ({
    phase: f,
    material,
    node: node.name,
    triangle,
    region,
    gapMM: distance * 1000,
    world: worldPoint.copy(center).addScaledVector(axis, coords[0]).addScaledVector(upward, coords[1]).addScaledVector(normal, coords[2]).toArray(),
    along: coords[0],
  });
  for (const { node, regions, material, index, positions, classes } of source.meshes) {
    node.skeleton?.update();
    for (let i = 0; i < regions.length; i++) {
      node.getVertexPosition(i, p).applyMatrix4(node.matrixWorld);
      classes[i] = classify(regions[i], material, p, bones);
      delta.copy(p).sub(center);
      const k = i * 3,
        x = delta.dot(axis),
        y = delta.dot(upward),
        z = delta.dot(normal);
      positions[k] = x;
      positions[k + 1] = y;
      positions[k + 2] = z;
      maxX = Math.max(maxX, Math.abs(x));
      if (Math.abs(x) <= SHAFT) {
        const distance = Math.hypot(y, z) - RADIUS,
          part = classes[i];
        if (!vertices[part] || distance < vertices[part].distance) vertices[part] = { distance };
      }
    }
    for (let t = 0; t < index.length; t += 3) {
      const ai = index[t],
        bi = index[t + 1],
        ci = index[t + 2],
        a = ai * 3,
        b = bi * 3,
        c = ci * 3;
      const minX = Math.min(positions[a], positions[b], positions[c]),
        maxX = Math.max(positions[a], positions[b], positions[c]);
      if (minX > SHAFT || maxX < -SHAFT) continue;
      const ay = positions[a + 1],
        by = positions[b + 1],
        cy = positions[c + 1];
      const az = positions[a + 2],
        bz = positions[b + 2],
        cz = positions[c + 2];
      if (Math.min(ay, by, cy) > SEARCH || Math.max(ay, by, cy) < -SEARCH || Math.min(az, bz, cz) > SEARCH || Math.max(az, bz, cz) < -SEARCH)
        continue;
      const result = closest([positions[a], ay, az, 1, 0, 0], [positions[b], by, bz, 0, 1, 0], [positions[c], cy, cz, 0, 0, 1]);
      if (!result) continue;
      const type = [classes[ai], classes[bi], classes[ci]];
      const scores = {};
      for (let i = 0; i < 3; i++) scores[type[i]] = (scores[type[i]] || 0) + result.bary[i];
      const part = Object.entries(scores).reduce((best, next) => (next[1] > best[1] ? next : best))[0];
      const distance = result.distance - RADIUS;
      const keys = [part];
      if (/shirt|linen|cotton|trouser/i.test(material)) keys.push("cloth", "cloth/" + part);
      else if (/skin|flesh|complexion/i.test(material)) keys.push("skin", "skin/" + part);
      for (const key of keys) {
        if (frame[key] && frame[key].distance <= distance) continue;
        const stats = summary[key] || (summary[key] = slot());
        const proof = distance < stats.min ? witness(node, material, t / 3, part, distance, result.point) : null;
        add(summary, key, distance, proof);
        frame[key] = { distance };
      }
    }
  }
  phaseStats(summary, frame);
  for (const [key, value] of Object.entries(vertices)) add(details.vertices, key, value.distance, { phase: f });
  phaseStats(details.vertices, vertices, false);
  details.maxAcrossShaft = Math.max(details.maxAcrossShaft, maxX);
  return frame;
}
for (const { id } of avatars) {
  const { scene: actor, animations } = await loadNativeAvatar(id);
  const parent = new THREE.Group();
  parent.add(actor);
  const rig = createLiftRig(actor, id);
  const source = sourceMeshes(actor);
  const mixer = new THREE.AnimationMixer(actor);
  mixer.clipAction(animations.find((clip) => clip.name === "idle")).play();
  const log = (stats[id] = {});
  for (const name of lifts) {
    const run = publicArgs(name);
    rig.release();
    mixer.setTime(0);
    // Reuse a previous squat pose before the bench, as the maintained acceptance does.
    if (name.includes("bench")) {
      const warmup = publicArgs("squat").phases(0.42);
      actor.position.fromArray(warmup.position);
      actor.rotation.y = warmup.facing;
      parent.updateMatrixWorld(true);
      rig.apply(warmup.lift.name, warmup.lift.u, warmup.lift.ctx, warmup.lift.weight);
    }
    const out = (log[name] = { summary: {}, vertices: {}, maxAcrossShaft: 0, maxBarStep: 0, spans: {}, frames: 0 });
    let previous = null;
    for (let i = 0; i < phases.length; i++) {
      const u = Math.min(phases[i], 1 - 1e-10);
      const pose = run.phases(u);
      if (pose.lift?.name !== name || Math.abs(pose.lift.u - u) > 1e-7) throw new Error("Incorrect session phase " + [name, u, pose.lift?.u]);
      mixer.setTime(u * run.span);
      actor.position.fromArray(pose.position);
      actor.rotation.y = pose.facing;
      parent.updateMatrixWorld(true);
      const bar = rig.apply(name, pose.lift.u, pose.lift.ctx, pose.lift.weight);
      parent.updateMatrixWorld(true);
      const frame = examine(source, bar.center, bar.axis, u, out.summary, out);
      for (const [part, { distance }] of Object.entries(frame)) {
        const range = out.spans[part] || (out.spans[part] = []);
        range.push(Math.round(distance * 100000) / 100);
      }
      if (previous) out.maxBarStep = Math.max(out.maxBarStep, bar.center.distanceTo(previous));
      previous = bar.center;
      out.frames++;
      if (i === 0) out.station = { at: pose.position, facing: pose.facing, held: LIFT_STATION[name], ctx: pose.lift.ctx, seconds: run.span };
    }
    const mm = (part) => Math.round((out.summary[part]?.min ?? Infinity) * 10000) / 10;
    console.error(
      id,
      name,
      "head",
      mm("head"),
      "torso",
      mm("torso"),
      "shoulder",
      mm("shoulder"),
      "upper",
      mm("upper-arm"),
      "forearm",
      mm("forearm"),
      "wrist",
      mm("grip-wrist"),
      "hands",
      mm("handL"),
      mm("handR"),
      "shirt",
      mm("cloth")
    );
  }
  mixer.stopAllAction();
  mixer.uncacheRoot(actor);
}
const files = [
  "assets/js/home-scene/controller.mjs",
  "assets/js/home-scene/gym-session.mjs",
  "assets/js/home-scene/gym-props.mjs",
  "assets/js/home-scene/training.mjs",
  "assets/models/home/manifest.json",
  "assets/models/home/room-gym.glb",
  ...avatars.map(({ id }) => "assets/models/home/sirui-" + id + ".glb"),
];
const receipt = JSON.stringify(
  {
    method: {
      sampleCount: phases.length,
      phases,
      nearSearchM: search,
      elapsedSeconds: (performance.now() - start) / 1000,
      node: process.version,
      cases: lifts,
      shaft: { half: SHAFT, radius: RADIUS, sideCount: 14, analyticRadiusOverageMax: 0.00037 },
      sampling:
        "normal session work phase with delivered idle, rig and Draco skin; CPU exact triangle projection within finite shaft; retained grip geometry and mixed-weight joints, no transition or screenshot",
    },
    hashes: { ...Object.fromEntries(files.map((file) => [file, sha(locate(file))])), rig: sha(rigFile) },
    stats,
  },
  null,
  2
);
if (options.out) fs.writeFileSync(options.out, receipt + "\n");
else process.stdout.write(receipt + "\n");
