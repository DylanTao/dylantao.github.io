// Actual pinned GLTF/Draco readback of a finished five-avatar export.
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import { THREE, loadNativeModel } from "../test/helpers/coastal-native-avatar.mjs";

const styles = ["lizard", "south-park", "simpsons", "ghibli", "rick-and-morty"];
const option = (name, fallback) => process.argv.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3) ?? fallback;
const sha = (bytes) => createHash("sha256").update(bytes).digest("hex");
const requireCondition = (condition, message) => {
  if (!condition) throw Error(message);
};
const bonesOf = (scene) => {
  const bones = new Map();
  scene.traverse((object) => {
    if (object.isBone) bones.set(object.name, object);
  });
  return bones;
};
const skinParts = (scene) => {
  const parts = [];
  scene.traverse((object) => {
    if (object.isSkinnedMesh && object.material.name === "skin") {
      const a = object.geometry.attributes;
      parts.push({
        vertices: a.position.count,
        positionSha256: sha(Buffer.from(a.position.array.buffer, a.position.array.byteOffset, a.position.array.byteLength)),
        normalSha256: sha(Buffer.from(a.normal.array.buffer, a.normal.array.byteOffset, a.normal.array.byteLength)),
        weightsSha256: sha(Buffer.from(a.skinWeight.array.buffer, a.skinWeight.array.byteOffset, a.skinWeight.array.byteLength)),
        skinIndexSha256: sha(Buffer.from(a.skinIndex.array.buffer, a.skinIndex.array.byteOffset, a.skinIndex.array.byteLength)),
        binding: object.skeleton.bones.map((bone) => bone.name),
      });
    }
  });
  return parts;
};

export async function verifyCharacterFinish({ models, baseline = path.resolve("assets/models/home") }) {
  const report = {
    method:
      "Pinned local GLTF/Draco decoding, actual rest skin attributes and seven explicit times per complete clip; not a continuous contact guarantee.",
    avatars: {},
  };
  for (const style of styles) {
    const file = `sirui-${style}.glb`,
      old = await loadNativeModel(file, pathToFileURL(baseline + path.sep)),
      next = await loadNativeModel(file, pathToFileURL(models + path.sep));
    const oldNames = old.animations.map((clip) => clip.name),
      nextNames = next.animations.map((clip) => clip.name);
    requireCondition(JSON.stringify(oldNames) === JSON.stringify(nextNames) && oldNames.length === 14, `${style}: fourteen clip identities changed`);
    requireCondition(
      JSON.stringify(skinParts(old.scene)) === JSON.stringify(skinParts(next.scene)),
      `${style}: decoded original skin attributes changed`
    );
    const oldBones = bonesOf(old.scene),
      nextBones = bonesOf(next.scene);
    requireCondition(JSON.stringify([...oldBones.keys()]) === JSON.stringify([...nextBones.keys()]), `${style}: rest skeleton names/order changed`);
    let maximumUnchangedBoneMatrixError = 0,
      maximumUnchangedTailError = 0;
    const clips = [];
    for (let i = 0; i < old.animations.length; i++) {
      const a = old.animations[i],
        b = next.animations[i];
      requireCondition(Math.abs(a.duration - b.duration) < 1e-6, `${style}/${a.name}: clip duration changed`);
      const mixers = [new THREE.AnimationMixer(old.scene), new THREE.AnimationMixer(next.scene)];
      for (const [mixer, clip] of [
        [mixers[0], a],
        [mixers[1], b],
      ]) {
        const action = mixer.clipAction(clip);
        action.setLoop(THREE.LoopOnce, 0);
        action.clampWhenFinished = true;
        action.play();
      }
      const times = Array.from({ length: 7 }, (_, j) => (a.duration * j) / 6);
      for (const time of times) {
        mixers.forEach((mixer) => mixer.setTime(time));
        old.scene.updateMatrixWorld(true);
        next.scene.updateMatrixWorld(true);
        for (const [name, bone] of oldBones) {
          const tail = /^Tail/.test(name);
          const actual = nextBones.get(name).matrixWorld.elements,
            error = Math.max(...bone.matrixWorld.elements.map((value, index) => Math.abs(value - actual[index])));
          maximumUnchangedBoneMatrixError = Math.max(maximumUnchangedBoneMatrixError, error);
          if (tail) maximumUnchangedTailError = Math.max(maximumUnchangedTailError, error);
          requireCondition(error < 2e-5, `${style}/${a.name}/${name}@${time}: retained bone differs by ${error}`);
        }
      }
      mixers.forEach((mixer) => mixer.stopAllAction());
      clips.push({ name: a.name, duration: a.duration, sampledSeconds: times });
    }
    const blinks = [];
    next.scene.traverse((object) => {
      if (object.morphTargetDictionary?.BlinkL !== undefined) blinks.push(Object.keys(object.morphTargetDictionary));
    });
    requireCondition(blinks.length === 1 && blinks[0].includes("BlinkR"), `${style}: Blink shapes changed`);
    report.avatars[style] = {
      baselineSha256: sha(fs.readFileSync(path.join(baseline, file))),
      sourceGlbSha256: sha(fs.readFileSync(path.join(models, file))),
      bytes: fs.statSync(path.join(models, file)).size,
      skinParts: skinParts(next.scene),
      boneCount: nextBones.size,
      maximumUnchangedBoneMatrixError,
      maximumUnchangedTailError,
      blinks,
      clips,
    };
    console.log("DECODED-CHARACTER-AUDIT", style, maximumUnchangedBoneMatrixError, maximumUnchangedTailError);
  }
  return report;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const models = path.resolve(option("models", "assets/models/home")),
    out = path.resolve(option("out", ".jekyll-cache/visual-qa/character-finish-2026-10-26/decoded-finish-audit.json")),
    report = await verifyCharacterFinish({ models, baseline: path.resolve(option("baseline", "assets/models/home")) });
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, JSON.stringify(report, null, 2) + "\n");
}
