// Actual decoded Foot-dominant vertices in the authored lounge pose. This is
// a neutral-foot placement control, not a claim about the final IK skin pose.
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { pathToFileURL, fileURLToPath } from "node:url";
import { loadNativeModel, THREE } from "../test/helpers/coastal-native-avatar.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = Object.fromEntries(
  process.argv
    .slice(2)
    .filter((value) => value.startsWith("--"))
    .map((value) => value.slice(2).split("="))
);
const models = path.resolve(root, args.models || "assets/models/home");
const output = path.resolve(root, args.out || ".jekyll-cache/visual-qa/finish-house-2026-10-26/decoded-bed-feet.json");
const avatars = {};
for (const style of ["lizard", "south-park", "simpsons", "ghibli", "rick-and-morty"]) {
  const file = path.join(models, `sirui-${style}.glb`);
  const model = await loadNativeModel(path.basename(file), pathToFileURL(`${models}/`));
  const actor = model.scene;
  const clip = model.animations.find((clip) => clip.name === "lounge");
  if (!clip) throw new Error(`${style}: no lounge clip`);
  const mixer = new THREE.AnimationMixer(actor);
  mixer.clipAction(clip).play();
  mixer.setTime(0);
  actor.updateMatrixWorld(true);
  const sides = {};
  for (const side of ["L", "R"]) {
    const points = [];
    actor.traverse((mesh) => {
      if (!mesh.isSkinnedMesh) return;
      const indices = mesh.geometry.attributes.skinIndex,
        weights = mesh.geometry.attributes.skinWeight;
      for (let i = 0; i < indices.count; i++) {
        let best = 0;
        for (let k = 1; k < 4; k++) if (weights.getComponent(i, k) > weights.getComponent(i, best)) best = k;
        if (mesh.skeleton.bones[indices.getComponent(i, best)].name.replaceAll(".", "") !== `Foot${side}`) continue;
        points.push(mesh.getVertexPosition(i, new THREE.Vector3()).applyMatrix4(mesh.matrixWorld).toArray());
      }
    });
    if (!points.length) throw new Error(`${style} ${side}: no actual foot vertices`);
    const floor = Math.min(...points.map((point) => point[1]));
    const sole = points.filter((point) => point[1] <= floor + 0.001);
    const center = [0, floor, 0];
    for (const axis of [0, 2]) center[axis] = (Math.min(...sole.map((point) => point[axis])) + Math.max(...sole.map((point) => point[axis]))) / 2;
    sides[side] = { points, sole, center };
  }
  avatars[style] = { sourceGlbSha256: createHash("sha256").update(fs.readFileSync(file)).digest("hex"), sides };
}
fs.mkdirSync(path.dirname(output), { recursive: true });
fs.writeFileSync(
  output,
  `${JSON.stringify({ scope: "Decoded authored lounge0 Foot-dominant geometry, before native floor placement; final two-leg-IK skin remains a separate runtime gate", avatars })}\n`
);
console.log(JSON.stringify({ output, avatars: Object.keys(avatars) }));
