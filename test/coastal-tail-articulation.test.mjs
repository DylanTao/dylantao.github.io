import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { createHash } from "node:crypto";
import { THREE, loadNativeModel } from "./helpers/coastal-native-avatar.mjs";
import { createTailObstacleProbe } from "./helpers/coastal-tail-contact.mjs";
import { probeTailAgainstBody, assertTailBodyClearance } from "./helpers/coastal-tail-body.mjs";

const review = new URL("../artwork/coastal-home/reviews/tail-anatomy-2026-10-28/", import.meta.url);
const sha = (file) =>
  createHash("sha256")
    .update(fs.readFileSync(new URL(file, review)))
    .digest("hex");
const lfSha = (file) =>
  createHash("sha256")
    .update(fs.readFileSync(new URL(file, review), "utf8").replaceAll("\r\n", "\n"))
    .digest("hex");

function restore(actor, fixture, pose) {
  actor.position.fromArray(pose.actorPosition);
  actor.rotation.y = pose.facing;
  for (let i = 0; i < fixture.boneNames.length; i++) {
    const bone = actor.getObjectByName(fixture.boneNames[i]),
      values = pose.bones[i];
    assert.ok(bone?.isBone, `captured actual bone ${fixture.boneNames[i]}`);
    bone.position.fromArray(values, 0);
    bone.quaternion.fromArray(values, 3);
    bone.scale.fromArray(values, 7);
  }
  actor.updateMatrixWorld(true);
}

for (const version of [22, 23])
  test(`rejected v${version} replays all249 source-bound whole-tail furniture phases and its actual cloth/body failure`, async (t) => {
    const fixture = JSON.parse(fs.readFileSync(new URL(`v${version}-poses.json`, review), "utf8"));
    assert.equal(sha("rejected-lizard.glb"), fixture.sourceGlbSha256);
    assert.equal(sha(fixture.bedFile), fixture.bedSha256);
    assert.equal(lfSha(fixture.helperFile), fixture.articulationLfSha256, "original frozen recipe bytes bind the captured poses");
    assert.equal(fixture.frames.length, 249);
    const model = await loadNativeModel("rejected-lizard.glb", review),
      bed = await loadNativeModel(fixture.bedFile, review);
    const collision = createTailObstacleProbe(THREE, bed.scene),
      actor = model.scene;
    assert.deepEqual(collision.triangleCounts, fixture.triangleCounts);
    let hard = 0,
      soft = 0;
    for (const frame of fixture.frames) {
      restore(actor, fixture, frame);
      const result = collision.probeTail(actor);
      assert.equal(result.vertices, 1872, "every connected pelvic/tail vertex participates");
      assert.equal(result.triangleCentroids, 3740);
      hard = Math.max(hard, result.hard);
      soft = Math.max(soft, result.soft);
    }
    const retained = JSON.parse(fs.readFileSync(new URL(`v${version}-summary.json`, review), "utf8"));
    assert.equal(hard, retained.maxTailHard);
    assert.equal(soft, retained.maxTailSoft);
    assert.equal(retained.bodyRows.length, 249, "independent complete triangle/body/cloth proof retains every phase");
    assert.equal(Object.keys(retained.phaseGeometryHashes).length, 249);
    const phase = version === 22 ? 64 : 248;
    restore(actor, fixture, fixture.frames[phase]);
    const body = probeTailAgainstBody(THREE, actor, { verifyWitnesses: true });
    assert.equal(body.vertices, 1872);
    assert.equal(body.triangleCentroids, 3740);
    assert.ok(body.shorts > 0, "the actual deformed clothing failure must be detected");
    if (version === 22) assert.ok(body.skin > 0, "the failed world-space guide crosses actual hand/forearm skin");
    assert.throws(() => assertTailBodyClearance(body), /actual skin|actual shirt|actual shorts/);
    t.diagnostic(
      JSON.stringify({
        phases: 249,
        vertices: 1872,
        centroids: 3740,
        hard,
        soft,
        bodyFailurePhase: phase,
        skin: body.skin,
        shirt: body.shirt,
        shorts: body.shorts,
      })
    );
  });
