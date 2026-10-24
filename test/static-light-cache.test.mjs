import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import cacheInputs from "../bin/coastal_static_light_inputs.cjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
test("published indirect-light cache binds to current scene geometry, manifest and collector sources", async () => {
  const { inputs, signature } = await cacheInputs.coastalLightInputs(root),
    manifest = JSON.parse(await fs.readFile(path.join(root, "assets/models/home/manifest.json"), "utf8")),
    descriptor = manifest.staticLightFieldCache;
  assert.ok(descriptor, "regenerate the static field with node bin/bake_coastal_static_light.cjs");
  assert.equal(descriptor.url, "static-light-field.json");
  assert.equal(descriptor.signature, signature, "scene inputs changed; regenerate the static transport cache");
  const body = await fs.readFile(path.join(root, "assets/models/home", descriptor.url)),
    snapshot = JSON.parse(body);
  assert.equal(cacheInputs.digest(body), descriptor.sha256, "cache bytes do not match their manifest digest");
  assert.equal(snapshot.signature, signature);
  assert.deepEqual(snapshot.inputs, inputs);
  assert.equal(snapshot.version, 1);
  assert.ok(body.byteLength <= 800000, "cache exceeds its 800 KB JSON budget");
  assert.ok(snapshot.statistics.triangles > 1000, "cache must come from the actual home, not an empty fixture");
});
