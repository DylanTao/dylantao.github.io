import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { createHash } from "node:crypto";
const { design, densityField, paintField } = createRequire(import.meta.url)("../assets/js/home-coffee-stain.js");
const hash = (array) =>
  createHash("sha256")
    .update(Buffer.from(array.buffer, array.byteOffset, array.byteLength))
    .digest("hex");
const finish = (job) => {
  while (!job.step()) {}
  return job;
};

test("one seed replays actual1024px pigment; other visits change the same-placement contact and drop geometry", () => {
  const outputs = [];
  for (const seed of ["52", "7", "31", "103", "52"]) {
    const plan = design(seed, 1024),
      job = densityField(plan);
    let previous = 0;
    while (!job.step()) {
      assert.ok(job.stats.rows - previous <= 24);
      previous = job.stats.rows;
    }
    const paint = finish(paintField(plan, job.field, "light"));
    let center = 0,
      clear = 0,
      marked = 0;
    for (let y = 0; y < plan.size; y++)
      for (let x = 0; x < plan.size; x++) {
        const alpha = paint.pixels[(y * plan.size + x) * 4 + 3];
        if (Math.hypot(x - plan.size / 2, y - plan.size / 2) < plan.size * 0.22) {
          center++;
          if (alpha < 8) clear++;
        }
        if (alpha >= 8) {
          marked++;
          assert.ok(x > plan.size * 0.03 && x < plan.size * 0.97 && y > plan.size * 0.03 && y < plan.size * 0.97);
        }
      }
    assert.ok(clear / center > 0.98, "the paper remains genuinely transparent through the centre");
    assert.ok(marked > 15000, "a coherent ring is present rather than isolated specks");
    outputs.push({ rgba: hash(paint.pixels), density: hash(job.field), drops: JSON.stringify(plan.drops) });
  }
  assert.deepEqual(outputs[0], outputs[4]);
  for (const key of ["rgba", "density", "drops"])
    assert.equal(new Set(outputs.slice(0, 4).map((entry) => entry[key])).size, 4, `${key}: real variation before any CSS rotation or placement`);
});

test("theme changes preserve the pigment field and a distinct wash settles into localized edge concentration", () => {
  const plan = design("52", 1024),
    job = finish(densityField(plan, { wet: true }));
  const original = hash(job.field),
    light = finish(paintField(plan, job.field, "light")),
    dark = finish(paintField(plan, job.field, "dark"));
  assert.equal(hash(job.field), original, "palette work never changes deposit topology");
  assert.notEqual(hash(light.pixels), hash(dark.pixels));
  let washDominant = 0,
    edgeDominant = 0;
  for (let i = 0; i < job.field.length; i++) {
    assert.ok(Number.isFinite(job.field[i]) && job.field[i] >= 0);
    if (job.washField[i] > job.field[i] * 1.3 && job.washField[i] > 0.05) washDominant++;
    if (job.field[i] > job.washField[i] * 1.5 && job.field[i] > 0.1) edgeDominant++;
    assert.equal(light.pixels[i * 4 + 3] === 0, dark.pixels[i * 4 + 3] === 0);
  }
  assert.ok(washDominant > 1000 && edgeDominant > 1000, "deposition changes the distribution of pigment, not a whole-ring transform/fade");
});

test("higher DPR geometry has a bounded1536px allocation and unsupported sizes fail closed", () => {
  const plan = design("hi-dpr", 1536),
    job = finish(densityField(plan, { wet: true })),
    paint = finish(paintField(plan, job.field, "light"));
  assert.equal(job.field.byteLength + job.washField.byteLength + paint.pixels.byteLength, 1536 * 1536 * 12);
  assert.throws(() => design("oversized", 2048), /bounded/);
  assert.throws(() => design("undersampled", 512), /bounded/);
});

test("the complete seed45 satellite stays inside the existing extreme placement corners", () => {
  const plan = design("45", 1024),
    job = finish(densityField(plan)),
    paint = finish(paintField(plan, job.field, "light"));
  let maximum = -Infinity;
  for (let y = 0; y < 1024; y++)
    for (let x = 0; x < 1024; x++)
      if (paint.pixels[(y * 1024 + x) * 4 + 3] >= 8) {
        const dx = (x + 0.5) / 1024 - 0.5,
          dy = (y + 0.5) / 1024 - 0.5;
        for (const degrees of [-24, 0, 24]) {
          const angle = (degrees * Math.PI) / 180;
          maximum = Math.max(maximum, 0.5 + 1.06 * (Math.cos(angle) * dx - Math.sin(angle) * dy));
        }
      }
  // Existing214px footprint,6.4px right inset and7.2px maximum x translation:
  // 1.0009 retains the existing1px clipping tolerance.
  assert.ok(maximum <= 1.0009, `complete actual pigment exceeds the unchanged placement gate:${maximum}`);
});
