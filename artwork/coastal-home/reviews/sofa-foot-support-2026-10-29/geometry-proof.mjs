// Actual decoded foot surfaces and room triangles, without a renderer or proxy floor.
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { createHash } from "node:crypto";
import { THREE, loadNativeModel } from "../../../../test/helpers/coastal-native-avatar.mjs";

const styles = ["lizard", "south-park", "simpsons", "ghibli", "rick-and-morty"];
const hash = (file) => createHash("sha256").update(fs.readFileSync(file)).digest("hex");

export async function measureSofaFeet(modelsRoot, { beforeRoom = false, phases = 13 } = {}) {
  const base = pathToFileURL(path.resolve(modelsRoot) + path.sep),
    config = JSON.parse(fs.readFileSync(new URL("manifest.json", base), "utf8")),
    lounge = config.rooms.find((room) => room.id === "lounge"),
    file = beforeRoom ? new URL("before-room-lounge.glb", import.meta.url) : new URL(lounge.file, base),
    room = await loadNativeModel(file.href),
    surfaces = [],
    ray = new THREE.Raycaster(),
    down = new THREE.Vector3(0, -1, 0),
    normal = new THREE.Vector3(),
    normalMatrix = new THREE.Matrix3();
  // Room GLBs already contain final world coordinates. The metadata offset is
  // used by props, and applying it again would invent a missing floor.
  room.scene.updateMatrixWorld(true);
  room.scene.traverse((mesh) => {
    if (!mesh.isMesh || /placeholder/i.test(mesh.name)) return;
    for (const material of [].concat(mesh.material)) material.side = THREE.DoubleSide;
    surfaces.push(mesh);
  });
  function support(point) {
    ray.set(point.clone().addScaledVector(down, -0.03), down);
    for (const hit of ray.intersectObjects(surfaces, false)) {
      normal.copy(hit.face.normal).applyNormalMatrix(normalMatrix.getNormalMatrix(hit.object.matrixWorld));
      if (normal.y > 0.5) return { mesh: hit.object.name, point: hit.point.toArray(), gapM: point.y - hit.point.y };
    }
    return null;
  }
  const report = {
    scope:
      "Thirteen finite phases of each actual lounge/drink clip for all five decoded skins. Lowest 2mm dominant-foot surface patches against real delivered room triangles. No claim of continuous whole-body or cloth contact.",
    room: { file: file.href, sha256: hash(file) },
    actorPosition: lounge.actor,
    avatars: {},
    rows: [],
  };
  for (const style of styles) {
    const avatarFile = new URL(`sirui-${style}.glb`, base),
      model = await loadNativeModel(avatarFile.href),
      actor = model.scene,
      mixer = new THREE.AnimationMixer(actor),
      feet = { L: [], R: [] };
    actor.position.fromArray(lounge.actor);
    actor.rotation.y = lounge.facing;
    actor.traverse((mesh) => {
      if (!mesh.isSkinnedMesh) return;
      const ids = mesh.geometry.attributes.skinIndex,
        weights = mesh.geometry.attributes.skinWeight;
      for (let vertex = 0; vertex < ids.count; vertex++)
        for (let k = 0; k < 4; k++) {
          const name = mesh.skeleton.bones[ids.getComponent(vertex, k)]?.name;
          if (/^Foot[LR]$/.test(name) && weights.getComponent(vertex, k) > 0.5) feet[name.at(-1)].push({ mesh, vertex });
        }
    });
    report.avatars[style] = {
      sha256: hash(avatarFile),
      footVertices: Object.fromEntries(Object.entries(feet).map(([side, points]) => [side, points.length])),
    };
    for (const name of ["lounge", "drink"]) {
      const clip = model.animations.find((clip) => clip.name === name);
      mixer.stopAllAction();
      const action = mixer.clipAction(clip).reset().play();
      for (let phase = 0; phase < phases; phase++) {
        const seconds = (clip.duration * phase) / (phases - 1);
        action.time = seconds;
        mixer.update(0);
        actor.updateMatrixWorld(true);
        actor.traverse((mesh) => {
          if (mesh.isSkinnedMesh) mesh.skeleton.update();
        });
        const row = { style, clip: name, seconds, feet: {} };
        for (const side of ["L", "R"]) {
          const points = feet[side].map(({ mesh, vertex }) => ({
              mesh: mesh.name,
              vertex,
              point: mesh.getVertexPosition(vertex, new THREE.Vector3()).applyMatrix4(mesh.matrixWorld),
            })),
            minimum = Math.min(...points.map(({ point }) => point.y)),
            patch = points.filter(({ point }) => point.y <= minimum + 0.002),
            samples = patch.map(({ mesh, vertex, point }) => ({ mesh, vertex, point: point.toArray(), support: support(point) })),
            gaps = samples.filter((sample) => sample.support).map((sample) => sample.support.gapM);
          row.feet[side] = {
            solePatchVertices: patch.length,
            missingSupport: samples.length - gaps.length,
            minimumGapM: Math.min(...gaps),
            maximumGapM: Math.max(...gaps),
            supportOwners: [...new Set(samples.map((sample) => sample.support?.mesh))],
            samples,
          };
        }
        report.rows.push(row);
      }
    }
  }
  return report;
}

export function supportFailures(report) {
  const failures = [];
  for (const row of report.rows)
    for (const [side, foot] of Object.entries(row.feet)) {
      const key = `${row.style}/${row.clip}/${row.seconds}/${side}`;
      if (foot.solePatchVertices < 12 || foot.missingSupport) failures.push(`${key}: incomplete actual sole support`);
      if (foot.minimumGapM < -0.0005) failures.push(`${key}: sole enters support by more than0.5mm`);
      if (foot.minimumGapM > 0.002 || foot.maximumGapM > 0.004) failures.push(`${key}: lowest2mm sole patch floats over support`);
      if (foot.supportOwners.some((name) => !/ochre_knit_textile/.test(name || ""))) failures.push(`${key}: feet missed the actual knit pouf`);
    }
  return failures;
}
