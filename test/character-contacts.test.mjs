import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { createHash } from "node:crypto";
import { measureSeatPatch, PROXIMAL_HIP_TO_KNEE, SAMPLE_COUNT, STYLES } from "../bin/measure_coastal_character_contacts.mjs";
import { fitSeatedRoot } from "../assets/js/home-scene/character-contacts.mjs";

const asset = JSON.parse(fs.readFileSync(new URL("../assets/models/home/character-contacts.json", import.meta.url), "utf8"));
const neutral = JSON.parse(
  fs.readFileSync(
    new URL("../artwork/coastal-home/reviews/character-finish-2026-10-26/seat-patch/decoded-neutral-legs.json", import.meta.url),
    "utf8"
  )
);

test("seat offsets follow the actual decoded proximal patch across each complete lounge clip", async () => {
  assert.deepEqual(Object.keys(asset.avatars), STYLES);
  assert.equal(asset.compression, 0, "measured geometry never folds in an assumed soft compression");
  for (const style of STYLES) {
    const actual = await measureSeatPatch(style),
      saved = asset.avatars[style].lounge;
    assert.equal(actual.sourceGlbSha256, saved.sourceGlbSha256, `${style}: contacts bind the actual delivered model`);
    assert.equal(
      createHash("sha256")
        .update(fs.readFileSync(new URL("../" + saved.nativeSourceFile, import.meta.url)))
        .digest("hex"),
      saved.nativeSourceSha256,
      `${style}: native witnesses bind the actual editable source`
    );
    assert.equal(actual.decodedDurationSeconds, saved.decodedDurationSeconds);
    assert.equal(actual.sampledSeconds.length, SAMPLE_COUNT);
    assert.equal(actual.sampledSeconds[0], 0);
    assert.equal(actual.sampledSeconds.at(-1), actual.decodedDurationSeconds);
    assert.ok(actual.selectedThighFractionRange[1] <= PROXIMAL_HIP_TO_KNEE);
    for (const sample of actual.samples) {
      assert.ok(Math.abs(sample.minY - saved.seatOffsetY) < 0.0005, `${style}: the observed patch stays at the measured seat level`);
      for (const witness of sample.witnesses) {
        assert.match(witness.material, /^(olive trousers|charcoal shorts)$/);
        assert.match(witness.bone, /^(Hips|Thigh[LR])$/);
        assert.ok(witness.hipToKneeFraction === null || witness.hipToKneeFraction <= PROXIMAL_HIP_TO_KNEE);
      }
    }
    assert.deepEqual(actual.contactCenterXZ, saved.contactCenterXZ, "the complete witness bounds govern XZ placement");
    assert.ok(saved.nativeDecodedMaxYError < 0.0005);
    assert.ok(saved.nativeDecodedWitnessMaxDistance < 0.0005);
    for (const side of ["L", "R"]) {
      const recorded = neutral.avatars[style].sides[side],
        decoded = actual.neutralLegs.sides[side];
      assert.deepEqual(decoded.hip, recorded.hip);
      assert.deepEqual(decoded.knee, recorded.knee);
      assert.deepEqual(decoded.ankle, recorded.ankle);
      assert.equal(decoded.upperLength, recorded.upperLength);
      assert.equal(decoded.lowerLength, recorded.lowerLength);
      assert.equal(saved.legs[side].upperLength, decoded.upperLength);
      assert.equal(saved.legs[side].lowerLength, decoded.lowerLength);
      assert.equal(saved.legs[side].ankleToSoleY, decoded.ankleToSoleY);
      assert.deepEqual(saved.legs[side].footQuaternion, decoded.footQuaternion);
      assert.deepEqual(saved.legs[side].soleCenterOffsetXYZ, decoded.soleCenterOffsetXYZ);
      assert.ok(Math.abs(Math.hypot(...decoded.footQuaternion) - 1) < 1e-7);
    }
    // A nominal offset can silently float or bury every rig. This control must remain visibly wrong.
    assert.ok(Math.abs(actual.seatOffsetY - 0.515) > 0.005, `${style}: the retired nominal constant is rejected by the real patch`);
  }
});

test("zero-compression placements use the measured witness offsets in the actual seat frame", () => {
  for (const style of STYLES) {
    const contact = asset.avatars[style].lounge,
      facing = -Math.PI / 2,
      seat = [1.7, 2.8, -4.2],
      rotate = ([x, z]) => [Math.cos(facing) * x + Math.sin(facing) * z, -Math.sin(facing) * x + Math.cos(facing) * z],
      root = fitSeatedRoot({ contact, seat, facing });
    assert.ok(contact.witnesses.length > 1);
    for (const witness of contact.witnesses) {
      const y = root[1] + witness.point[1];
      assert.ok(y >= seat[1] - 1e-9 && y <= seat[1] + 0.0020001);
    }
    const alignedCenter = rotate(contact.contactCenterXZ);
    assert.ok(Math.abs(root[0] + alignedCenter[0] - seat[0]) < 1e-12);
    assert.ok(Math.abs(root[2] + alignedCenter[1] - seat[2]) < 1e-12);
    assert.ok(Math.abs(fitSeatedRoot({ contact, seat, facing, compression: 0.001 })[1] - root[1] + 0.001) < 1e-12);
  }
  assert.throws(() => fitSeatedRoot({ contact: {}, seat: [0, 1, 0] }), TypeError);
  assert.throws(() => fitSeatedRoot({ contact: asset.avatars.lizard.lounge, seat: [0, 1, 0], compression: -1 }), TypeError);
});
