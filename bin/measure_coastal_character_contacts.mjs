// Actual decoded seat-patch geometry; no renderer, nominal seat constant or scene mutation.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createHash } from "node:crypto";
import { loadNativeModel, THREE } from "../test/helpers/coastal-native-avatar.mjs";

export const PROXIMAL_HIP_TO_KNEE = 0.45;
export const SAMPLE_COUNT = 13;
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const STYLES = ["lizard", "south-park", "simpsons", "ghibli", "rick-and-morty"];
const sha256 = (value) => createHash("sha256").update(value).digest("hex");
const cleanBone = (name) => name.replaceAll(".", "");
const baseMaterial = (name) => name.replace(/\.\d{3}$/, "");

function neutralLegGeometry(actor) {
  const bones = new Map();
  actor.traverse((node) => {
    if (node.isBone) bones.set(cleanBone(node.name), node);
  });
  const sides = {};
  for (const side of ["L", "R"]) {
    const at = (name) => bones.get(name + side).getWorldPosition(new THREE.Vector3()),
      hip = at("Thigh"),
      knee = at("Shin"),
      ankle = at("Foot"),
      points = [];
    actor.traverse((mesh) => {
      if (!mesh.isSkinnedMesh) return;
      const indices = mesh.geometry.attributes.skinIndex,
        weights = mesh.geometry.attributes.skinWeight;
      for (let i = 0; i < indices.count; i++) {
        let best = 0;
        for (let k = 1; k < 4; k++) if (weights.getComponent(i, k) > weights.getComponent(i, best)) best = k;
        if (cleanBone(mesh.skeleton.bones[indices.getComponent(i, best)].name) !== "Foot" + side) continue;
        points.push(mesh.getVertexPosition(i, new THREE.Vector3()).applyMatrix4(mesh.matrixWorld));
      }
    });
    if (!points.length) throw new Error(`Foot${side} has no actual foot geometry`);
    const minY = Math.min(...points.map((point) => point.y)),
      soleWitnesses = points.filter((point) => point.y < minY + 0.001).map((point) => point.toArray()),
      soleCenter = [0, 1, 2].map(
        (axis) => (Math.min(...soleWitnesses.map((point) => point[axis])) + Math.max(...soleWitnesses.map((point) => point[axis]))) / 2
      );
    sides[side] = {
      hip: hip.toArray(),
      knee: knee.toArray(),
      ankle: ankle.toArray(),
      upperLength: hip.distanceTo(knee),
      lowerLength: knee.distanceTo(ankle),
      footMinY: minY,
      ankleToSoleY: ankle.y - minY,
      footQuaternion: bones
        .get("Foot" + side)
        .getWorldQuaternion(new THREE.Quaternion())
        .toArray(),
      soleCenterOffsetXYZ: soleCenter.map((value, axis) => value - ankle.getComponent(axis)),
      soleWitnesses,
    };
  }
  return {
    seconds: 0,
    scope: "Decoded authored lounge pose before any seat placement or leg IK; actual Foot-dominant skin/footwear vertices",
    sides,
  };
}

export async function measureSeatPatch(style, modelDirectory = path.join(root, "assets/models/home")) {
  const file = path.join(modelDirectory, `sirui-${style}.glb`),
    model = await loadNativeModel(path.basename(file), pathToFileURL(path.dirname(file) + path.sep)),
    actor = model.scene,
    clip = model.animations.find((animation) => animation.name === "lounge");
  if (!clip || !(clip.duration > 0)) throw new Error(`${style}: lounge clip missing`);
  actor.updateMatrixWorld(true);
  const patches = [];
  actor.traverse((mesh) => {
    if (!mesh.isSkinnedMesh || !["olive trousers", "charcoal shorts"].includes(baseMaterial(mesh.material.name))) return;
    const position = mesh.geometry.attributes.position,
      indices = mesh.geometry.attributes.skinIndex,
      weights = mesh.geometry.attributes.skinWeight,
      chosen = [];
    for (let i = 0; i < position.count; i++) {
      let best = 0;
      for (let k = 1; k < 4; k++) if (weights.getComponent(i, k) > weights.getComponent(i, best)) best = k;
      const joint = indices.getComponent(i, best),
        bone = mesh.skeleton.bones[joint],
        name = cleanBone(bone.name);
      let fraction = null;
      if (/^Thigh[LR]$/.test(name)) {
        const knee = bone.children.find((child) => cleanBone(child.name).startsWith("Shin"));
        if (!knee) throw new Error(`${style}: ${name} knee joint missing`);
        const kneeIndex = mesh.skeleton.bones.indexOf(knee),
          head = new THREE.Vector3().setFromMatrixPosition(mesh.skeleton.boneInverses[joint].clone().invert()),
          end = new THREE.Vector3().setFromMatrixPosition(mesh.skeleton.boneInverses[kneeIndex].clone().invert()),
          axis = end.sub(head),
          rest = new THREE.Vector3().fromBufferAttribute(position, i).applyMatrix4(mesh.bindMatrix);
        fraction = rest.sub(head).dot(axis) / axis.lengthSq();
        if (fraction > PROXIMAL_HIP_TO_KNEE) continue;
      } else if (name !== "Hips") continue;
      chosen.push({ vertex: i, mesh: mesh.name, bone: name, material: baseMaterial(mesh.material.name), hipToKneeFraction: fraction });
    }
    if (chosen.length) patches.push({ mesh, chosen });
  });
  if (!patches.length) throw new Error(`${style}: no anatomical seat patch`);
  const mixer = new THREE.AnimationMixer(actor),
    action = mixer.clipAction(clip),
    times = Array.from({ length: SAMPLE_COUNT }, (_, i) => (clip.duration * i) / (SAMPLE_COUNT - 1));
  action.setLoop(THREE.LoopOnce, 1);
  action.clampWhenFinished = true;
  action.play();
  const samples = [];
  let neutralLegs;
  for (const seconds of times) {
    action.reset().play();
    mixer.setTime(seconds);
    actor.updateMatrixWorld(true);
    if (seconds === 0) neutralLegs = neutralLegGeometry(actor);
    const points = [];
    for (const { mesh, chosen } of patches) {
      for (const spec of chosen) {
        const point = mesh.getVertexPosition(spec.vertex, new THREE.Vector3()).applyMatrix4(mesh.matrixWorld);
        points.push({ ...spec, point: point.toArray() });
      }
    }
    points.sort((a, b) => a.point[1] - b.point[1]);
    const minY = points[0].point[1];
    const boneMinY = Object.fromEntries(
      [...new Set(points.map((p) => p.bone))].map((bone) => [bone, Math.min(...points.filter((p) => p.bone === bone).map((p) => p.point[1]))])
    );
    samples.push({ seconds, minY, boneMinY, witnesses: points.filter((p) => p.point[1] <= minY + 0.002) });
  }
  const minYRange = [Math.min(...samples.map((s) => s.minY)), Math.max(...samples.map((s) => s.minY))],
    cloud = samples.flatMap((sample) => sample.witnesses),
    witnesses = [...new Map(cloud.map((p) => [p.point.map((n) => n.toFixed(5)).join(","), p])).values()],
    witnessBoundsXZ = [Math.min, Math.max].map((reduce) => [0, 2].map((axis) => reduce(...witnesses.map((p) => p.point[axis]))));
  mixer.stopAllAction();
  mixer.uncacheRoot(actor);
  return {
    sourceGlbSha256: sha256(fs.readFileSync(file)),
    clip: "lounge",
    decodedDurationSeconds: clip.duration,
    sampledSeconds: times,
    patchVertices: patches.reduce((sum, patch) => sum + patch.chosen.length, 0),
    selectedThighFractionRange: [Math.min, Math.max].map((reduce) =>
      reduce(
        ...patches
          .flatMap((patch) => patch.chosen)
          .filter((p) => p.hipToKneeFraction !== null)
          .map((p) => p.hipToKneeFraction)
      )
    ),
    minYRange,
    boneMinYRanges: Object.fromEntries(
      Object.keys(samples[0].boneMinY).map((bone) => [
        bone,
        [Math.min, Math.max].map((reduce) => reduce(...samples.map((sample) => sample.boneMinY[bone]))),
      ])
    ),
    seatOffsetY: minYRange[0],
    contactCenterXZ: [0, 1].map((axis) => (witnessBoundsXZ[0][axis] + witnessBoundsXZ[1][axis]) / 2),
    contactCenterMethod: "Midpoint of the complete lower-envelope witness XZ extents; not a vertex-density centroid or a seat-anchor assumption.",
    witnessBoundsXZ,
    witnesses,
    samples,
    neutralLegs,
  };
}

async function main() {
  const option = (name, fallback) => process.argv.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3) ?? fallback,
    modelDirectory = path.resolve(option("models", path.join(root, "assets/models/home"))),
    native = JSON.parse(fs.readFileSync(option("native", ".jekyll-cache/visual-qa/character-finish-2026-10-26/native-seat-contacts.json"), "utf8")),
    out = path.resolve(option("out", "assets/models/home/character-contacts.json")),
    raw = path.resolve(option("receipt", ".jekyll-cache/visual-qa/character-finish-2026-10-26/decoded-seat-contacts.json")),
    asset = {
      version: 1,
      units: "metres",
      frame: "Avatar GLTF scene at identity; +Y up, +Z forward. Witness XZ offsets are relative to the avatar root, not the seat anchor.",
      method:
        "Lower exterior of Hips and proximal-Thigh trouser/short vertices. Proximal is <=0.45 along the actual bind-pose hip-to-knee segment. Tail, distal thigh and knee are excluded. Each actual decoded lounge duration is sampled 13 times; no continuous guarantee.",
      compression: 0,
      placement:
        "rootY = actualSeatTopY - seatOffsetY. Any soft compression is a later explicit bounded choice. Use witness XZ offsets against the actual support polygon.",
      avatars: {},
    },
    receipt = { method: asset.method, avatars: {} };
  for (const style of STYLES) {
    const measured = await measureSeatPatch(style, modelDirectory),
      nativeEntry = native.avatars[style],
      error = Math.max(...measured.minYRange.map((v, i) => Math.abs(v - nativeEntry.minYRange[i])));
    if (error > 0.0005) throw new Error(`${style}: native/decoded seat offset differs by ${error}m`);
    const { samples, neutralLegs, ...summary } = measured,
      nativeWitnesses = [
        ...new Map(
          nativeEntry.samples.flatMap((sample) => sample.witnesses).map((p) => [p.point.map((n) => n.toFixed(5)).join(","), p.point])
        ).values(),
      ],
      decodedWitnesses = measured.witnesses.map((p) => p.point),
      distance = (a, b) => Math.hypot(...a.map((value, axis) => value - b[axis])),
      directed = (a, b) => Math.max(...a.map((point) => Math.min(...b.map((target) => distance(point, target))))),
      witnessError = Math.max(directed(nativeWitnesses, decodedWitnesses), directed(decodedWitnesses, nativeWitnesses));
    if (witnessError > 0.0005) throw new Error(`${style}: native/decoded witness geometry differs by ${witnessError}m`);
    asset.avatars[style] = {
      lounge: {
        ...summary,
        legs: Object.fromEntries(
          Object.entries(neutralLegs.sides).map(([side, leg]) => [
            side,
            {
              upperLength: leg.upperLength,
              lowerLength: leg.lowerLength,
              ankleToSoleY: leg.ankleToSoleY,
              footQuaternion: leg.footQuaternion,
              soleCenterOffsetXYZ: leg.soleCenterOffsetXYZ,
            },
          ])
        ),
        nativeSourceSha256: nativeEntry.sourceSha256,
        nativeSourceFile: nativeEntry.sourceFile,
        nativeSourceScene: nativeEntry.sourceScene,
        nativeSampling: {
          fps: nativeEntry.fps,
          stripFrames: nativeEntry.stripFrames,
          sampledFrames: nativeEntry.sampledFrames,
          secondsFromStripStart: nativeEntry.samples.map((sample) => sample.secondsFromStripStart),
        },
        nativeMinYRange: nativeEntry.minYRange,
        nativeDecodedMaxYError: error,
        nativeDecodedWitnessMaxDistance: witnessError,
      },
    };
    receipt.avatars[style] = measured;
    console.log(
      JSON.stringify({ style, seatOffsetY: measured.seatOffsetY, duration: measured.decodedDurationSeconds, nativeDecodedMaxYError: error })
    );
  }
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.mkdirSync(path.dirname(raw), { recursive: true });
  fs.writeFileSync(out, JSON.stringify(asset, null, 2) + "\n");
  fs.writeFileSync(raw, JSON.stringify(receipt, null, 2) + "\n");
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url))
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
