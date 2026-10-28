// Read-only source-bound trial of the actual room-transfer blend and bed GLB.
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { createHash } from "node:crypto";
import { updateTailCorrective } from "../artwork/coastal-home/reviews/tail-socket-2026-10-28/runtime/tail-corrective.mjs";
import { createTailObstacleProbe, tailVertexIndices } from "../test/helpers/coastal-tail-contact.mjs";
import { articulationSource, loadArticulation } from "../artwork/coastal-home/reviews/tail-anatomy-2026-10-28/runtime/load-articulation.mjs";

const option = (name, fallback) => process.argv.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3) ?? fallback;
const runtime = path.resolve(option("runtime", process.cwd()));
const models = path.resolve(option("models", "assets/models/home"));
const house = path.resolve(option("house-models", "assets/models/home"));
const out = path.resolve(option("out", ".jekyll-cache/visual-qa/tail-finish-2026-10-28/transfer-probe.json"));
const early = option("early", "0") === "1";
const articulated = option("articulated", "0") === "1";
const articulationVersion = option("articulation-version", "23");
if (!["21", "22", "23"].includes(articulationVersion)) throw new Error("A retained articulation version is required");
const articulationURL = articulationSource(articulationVersion);
const { updateTailArticulation } = await loadArticulation(articulationVersion);
const rt = pathToFileURL(`${runtime}/`);
const { THREE, loadNativeModel } = await import(new URL("test/helpers/coastal-native-avatar.mjs", rt));
const { roomTransfer } = await import(new URL("assets/js/home-scene/room-journey.mjs", rt));
const { createPlantedFeet } = await import(new URL("assets/js/home-scene/planted-feet.mjs", rt));
const { fitSeatToSurface } = await import(new URL("assets/js/home-scene/seat-surface.mjs", rt));
const sha = (file) => createHash("sha256").update(fs.readFileSync(file)).digest("hex");
const contacts = JSON.parse(fs.readFileSync(path.join(models, "character-contacts.json"), "utf8"));
const manifest = JSON.parse(fs.readFileSync(path.join(models, "manifest.json"), "utf8"));
const room = manifest.rooms.find((entry) => entry.id === "sleep");
const native = await loadNativeModel("room-sleep.glb", pathToFileURL(`${house}/`));
native.scene.updateMatrixWorld(true);
const cloth = native.scene.getObjectByName("sleep_duvet_empty");
if (!cloth) throw new Error("Actual made cover is required");
const id = option("avatar", "lizard");
const data = contacts.avatars[id];
const file = path.join(models, `sirui-${id}.glb`);
const hash = sha(file);
if (hash !== data.lounge.sourceGlbSha256 || hash !== room.bedTransfer.footSourceGlbSha256[id]) throw new Error("Unbound trial geometry");
const model = await loadNativeModel(`sirui-${id}.glb`, pathToFileURL(`${models}/`));
const actor = model.scene,
  mixer = new THREE.AnimationMixer(actor);
const actions = new Map(model.animations.map((clip) => [clip.name, mixer.clipAction(clip)]));
const fit = fitSeatToSurface({ contact: data.lounge, seat: room.bedTransfer.seat.position, facing: room.bedTransfer.seat.facing, meshes: [cloth] });
const transfer = roomTransfer(room, "sleep", { seatedRoot: fit.position, avatarId: id });
const feet = createPlantedFeet(actor, data.lounge.legs);
const skin = [];
actor.traverse((mesh) => {
  if (mesh.isSkinnedMesh)
    skin.push({
      mesh,
      tail: tailVertexIndices(mesh).length === mesh.geometry.attributes.position.count,
      port: Boolean(mesh.userData.tailPortTrial),
      tailSet: new Set(tailVertexIndices(mesh)),
    });
});
const samples = [],
  point = new THREE.Vector3();
const collision = createTailObstacleProbe(THREE, native.scene);
const geometryOut = option("geometry-out", null);
let geometryExport;
if (geometryOut) {
  const tails = skin.filter((entry) => entry.tail);
  if (tails.length !== 1) throw new Error("One complete anatomical tail primitive is required for the geometry export");
  const tail = tails[0].mesh,
    parts = [],
    faces = { skin: [], shirt: [], shorts: [] };
  let bodyVertices = 0;
  for (const entry of skin) {
    if (entry.mesh === tail) continue;
    const mesh = entry.mesh,
      material = mesh.material.name.replace(/\.\d{3}$/, "").replaceAll("_", " ");
    const kind = material === "skin" ? "skin" : material === "Sirui shirt" ? "shirt" : material === "charcoal shorts" ? "shorts" : null;
    if (!kind) continue;
    const at = bodyVertices,
      count = mesh.geometry.attributes.position.count;
    bodyVertices += count;
    parts.push({ mesh, at, count, kind });
    for (let i = 0; i < mesh.geometry.index.count; i += 3) faces[kind].push([0, 1, 2].map((k) => at + mesh.geometry.index.getX(i + k)));
  }
  if (Object.values(faces).some((value) => !value.length)) throw new Error("Complete actual body and both clothing layers are required");
  const tailFaces = [];
  for (let i = 0; i < tail.geometry.index.count; i += 3) tailFaces.push([0, 1, 2].map((k) => tail.geometry.index.getX(i + k)));
  const directory = path.resolve(geometryOut);
  if (fs.existsSync(path.join(directory, "topology.json"))) throw new Error("Retained geometry exports are immutable");
  fs.mkdirSync(directory, { recursive: true });
  fs.writeFileSync(
    path.join(directory, "topology.json"),
    JSON.stringify({
      sourceGlbSha256: hash,
      tailVertices: tail.geometry.attributes.position.count,
      bodyVertices,
      bodyFaces: faces,
      tailFaces,
      parts: parts.map(({ mesh, ...part }) => ({ ...part, name: mesh.name })),
    })
  );
  geometryExport = { directory, tail, parts, bodyVertices };
}
let capturedFailure = null,
  worstFailure = null;
for (let i = 0; i <= 248; i++) {
  const seconds = (transfer.duration * i) / 248,
    pose = transfer.pose(seconds);
  mixer.stopAllAction();
  for (const [name, weight] of pose.blend
    ? [
        [pose.blend.from, 1 - pose.blend.weight],
        [pose.blend.to, pose.blend.weight],
      ]
    : [[pose.clip, 1]]) {
    const action = actions.get(name);
    action.reset().play().setEffectiveWeight(weight);
    action.time = 0;
  }
  mixer.update(0);
  actor.position.fromArray(pose.position);
  actor.rotation.y = pose.facing;
  actor.updateMatrixWorld(true);
  const solved = pose.feet ? feet.apply(pose.feet, pose.plantedWeight || 0) : [];
  let seated = pose.blend ? (pose.blend.to === "lounge" ? pose.blend.weight : 1 - pose.blend.weight) : pose.clip === "lounge" ? 1 : 0;
  if (early && pose.blend?.to === "lounge") seated = Math.min(1, seated * 4);
  const rollProgress = pose.blend?.from === "sleep" ? pose.blend.weight : pose.clip === "sleep" ? 0 : 1;
  const corrective = articulated
    ? updateTailArticulation(actor, { seatedWeight: seated, bedWeight: 1, bedProgress: rollProgress, bedFacing: room.facing })
    : updateTailCorrective(actor, { seatedWeight: seated });
  actor.updateMatrixWorld(true);
  const row = { seconds, phase: pose.phase, seatedWeight: seated, corrective, solved, hard: 0, tailHard: 0, portHard: 0, tailSoft: 0, witnesses: [] };
  const tailResult = collision.probeTail(actor);
  row.tailHard = tailResult.hard;
  row.tailSoft = tailResult.soft;
  row.witnesses = tailResult.witnesses;
  for (const item of skin) {
    if (item.tail || (i % 8 && i !== 248)) continue;
    for (let at = 0; at < item.mesh.geometry.attributes.position.count; at++) {
      if (item.tailSet.has(at)) continue;
      item.mesh.getVertexPosition(at, point).applyMatrix4(item.mesh.matrixWorld);
      for (const solid of collision.pointHits(point, { soft: false })) {
        row.hard++;
        if (item.port) row.portHard++;
      }
    }
  }
  row.hard += row.tailHard;
  if (geometryExport) {
    const { directory, tail, parts, bodyVertices } = geometryExport;
    const coordinates = new Float64Array((tail.geometry.attributes.position.count + bodyVertices) * 3);
    let offset = 0;
    for (const mesh of [tail, ...parts.map((part) => part.mesh)])
      for (let vertex = 0; vertex < mesh.geometry.attributes.position.count; vertex++) {
        mesh.getVertexPosition(vertex, point).applyMatrix4(mesh.matrixWorld);
        coordinates.set(point.toArray(), offset);
        offset += 3;
      }
    fs.writeFileSync(path.join(directory, `phase-${String(i).padStart(3, "0")}.bin`), Buffer.from(coordinates.buffer));
    row.bodyFrame = [];
    actor.traverse((bone) => {
      if (bone.isBone)
        row.bodyFrame.push({
          name: bone.name,
          position: bone.position.toArray(),
          quaternion: bone.quaternion.toArray(),
          scale: bone.scale.toArray(),
        });
    });
    row.actualPose = pose;
  }
  if (row.tailHard && (!capturedFailure || row.tailHard > (worstFailure?.tailResult.hard || 0))) {
    const bones = [];
    actor.traverse((node) => {
      if (node.isBone)
        bones.push({
          name: node.name,
          position: node.position.toArray(),
          quaternion: node.quaternion.toArray(),
          scale: node.scale.toArray(),
          worldMatrix: node.matrixWorld.toArray(),
        });
    });
    const captured = {
      seconds,
      pose,
      actor: { position: actor.position.toArray(), quaternion: actor.quaternion.toArray(), scale: actor.scale.toArray() },
      bones,
      tailResult,
    };
    capturedFailure ??= captured;
    worstFailure = captured;
  }
  samples.push(row);
}
const diagnosticSweeps = [];
for (const captured of articulated ? [] : [capturedFailure, worstFailure].filter(Boolean)) {
  actor.position.fromArray(captured.actor.position);
  actor.quaternion.fromArray(captured.actor.quaternion);
  actor.scale.fromArray(captured.actor.scale);
  const bones = new Map();
  actor.traverse((node) => {
    if (node.isBone) bones.set(node.name, node);
  });
  for (const data of captured.bones) {
    const bone = bones.get(data.name);
    bone.position.fromArray(data.position);
    bone.quaternion.fromArray(data.quaternion);
    bone.scale.fromArray(data.scale);
  }
  actor.updateMatrixWorld(true);
  const weights = [];
  for (const weight of [0, 0.125, 0.25, 0.375, 0.5, 0.625, 0.75, 0.875, 1]) {
    updateTailCorrective(actor, { seatedWeight: weight });
    weights.push({ weight, ...collision.probeTail(actor) });
  }
  diagnosticSweeps.push({ seconds: captured.seconds, bodyPose: captured.pose, weights });
}
const receipt = {
  scope:
    "Actual decoded v84 hard frame and made cover; all tail vertices and triangle centroids in249 authored transfer poses; every other skin/cloth vertex joins in32 poses. Closed-triangle parity; no attachment exclusion. Finite sampling, not continuous proof.",
  avatar: id,
  sourceGlbSha256: hash,
  contactsSha256: sha(path.join(models, "character-contacts.json")),
  manifestSha256: sha(path.join(models, "manifest.json")),
  roomSha256: sha(path.join(house, "room-sleep.glb")),
  runtimeLfSha256: Object.fromEntries(
    ["room-journey", "planted-feet", "seat-surface"].map((name) => [
      name,
      createHash("sha256")
        .update(fs.readFileSync(path.join(runtime, `assets/js/home-scene/${name}.mjs`), "utf8").replaceAll("\r\n", "\n"))
        .digest("hex"),
    ])
  ),
  earlyActivationTrial: early,
  articulatedTailTrial: articulated,
  articulationLfSha256: articulated
    ? createHash("sha256").update(fs.readFileSync(articulationURL, "utf8").replaceAll("\r\n", "\n")).digest("hex")
    : null,
  seatedRoot: fit.position,
  hardMeshes: collision.hardMeshes,
  triangleCounts: collision.triangleCounts,
  capturedFailure,
  worstFailure,
  maxHard: Math.max(...samples.map((row) => row.hard)),
  maxTailHard: Math.max(...samples.map((row) => row.tailHard)),
  maxPortHard: Math.max(...samples.map((row) => row.portHard)),
  maxTailSoft: Math.max(...samples.map((row) => row.tailSoft)),
  maxReachViolation: Math.max(0, ...samples.flatMap((row) => row.solved.map((value) => value.reachViolation))),
  diagnosticSweeps,
  probeLfSha256: createHash("sha256")
    .update(fs.readFileSync(new URL(import.meta.url), "utf8").replaceAll("\r\n", "\n"))
    .digest("hex"),
  helperLfSha256: createHash("sha256")
    .update(fs.readFileSync(new URL("../test/helpers/coastal-tail-contact.mjs", import.meta.url), "utf8").replaceAll("\r\n", "\n"))
    .digest("hex"),
  samples,
};
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, JSON.stringify(receipt, null, 2) + "\n");
console.log(
  JSON.stringify({
    out,
    maxHard: receipt.maxHard,
    maxTailHard: receipt.maxTailHard,
    maxPortHard: receipt.maxPortHard,
    maxTailSoft: receipt.maxTailSoft,
    maxReachViolation: receipt.maxReachViolation,
  })
);
