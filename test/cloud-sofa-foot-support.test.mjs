import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { measureSofaFeet, supportFailures } from "../artwork/coastal-home/reviews/sofa-foot-support-2026-10-29/geometry-proof.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), ".."),
  models = process.env.COASTAL_MODELS_ROOT || path.join(root, "assets/models/home");

test("cloud sofa: both actual foot surfaces meet the delivered pouf across all five lounge and drink clips", async () => {
  const report = await measureSofaFeet(models);
  assert.equal(report.rows.length, 130);
  assert.equal(Object.keys(report.avatars).length, 5);
  assert.deepEqual(supportFailures(report), []);
});

test("cloud sofa: the retained old room fails the same actual foot-support measurement", async () => {
  const report = await measureSofaFeet(models, { beforeRoom: true });
  assert.equal(report.rows.length, 130);
  const failures = supportFailures(report);
  assert.ok(failures.some((failure) => failure.includes("floats over support")));
  assert.ok(failures.some((failure) => failure.includes("enters support")));
  assert.ok(failures.some((failure) => failure.includes("missed the actual knit pouf")));
});
