import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
const { sourceRecord } = createRequire(import.meta.url)("../bin/verify_coastal_routes.cjs");
const sha = (bytes) => createHash("sha256").update(bytes).digest("hex");

test("served minified modules require current source, recipe, lockfile and exact compiled bytes", async (t) => {
  const parent = path.resolve(os.tmpdir()),
    root = await fs.mkdtemp(path.join(parent, "coastal-module-test-"));
  assert.equal(path.dirname(root), parent);
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const source = path.join(root, "source"),
    compiledRoot = path.join(root, "built"),
    relative = "assets/js/home-scene/fixture.mjs";
  for (const directory of [path.dirname(path.join(source, relative)), path.dirname(path.join(compiledRoot, relative)), path.join(source, "_plugins")])
    await fs.mkdir(directory, { recursive: true });
  const raw = "export const verboseName = 1;\n",
    output = Buffer.from("export const verboseName=1;");
  await fs.writeFile(path.join(source, relative), raw);
  await fs.writeFile(path.join(source, "_plugins/site_module_assets.rb"), "recipe\n");
  await fs.writeFile(path.join(source, "Gemfile.lock"), "lock\n");
  await fs.writeFile(path.join(compiledRoot, relative), output);
  const receipt = {
    schema: "sirui-site-module-build-v1",
    pipeline: { pluginSha256: sha("recipe\n"), lockSha256: sha("lock\n"), compiler: "fixture", compilerKey: "fixture" },
    modules: { [relative]: { sourceSha256: sha(raw), outputSha256: sha(output), bytes: output.length } },
  };
  await fs.writeFile(path.join(compiledRoot, "assets/js/module-build.json"), JSON.stringify(receipt));
  assert.equal((await sourceRecord(source, relative, output, { compiledRoot })).match, "source-bound module build");
  assert.equal((await sourceRecord(source, relative, Buffer.from(raw))).match, "exact");
  assert.equal((await sourceRecord(source, relative, output, { compiledRoot: undefined })).match, "MISMATCH");
  await fs.writeFile(path.join(source, relative), raw.replace("1", "2"));
  assert.equal((await sourceRecord(source, relative, output, { compiledRoot })).match, "MISMATCH");
  await fs.writeFile(path.join(source, relative), raw);
  await fs.writeFile(path.join(source, "_plugins/site_module_assets.rb"), "new recipe\n");
  assert.equal((await sourceRecord(source, relative, output, { compiledRoot })).match, "MISMATCH");
  await fs.writeFile(path.join(source, "_plugins/site_module_assets.rb"), "recipe\n");
  await fs.writeFile(path.join(source, "Gemfile.lock"), "new lock\n");
  assert.equal((await sourceRecord(source, relative, output, { compiledRoot })).match, "MISMATCH");
  await fs.writeFile(path.join(source, "Gemfile.lock"), "lock\n");
  await fs.writeFile(path.join(compiledRoot, relative), "corrupt");
  assert.equal((await sourceRecord(source, relative, output, { compiledRoot })).match, "MISMATCH");
  await assert.rejects(() => sourceRecord(source, "../escape.mjs", output, { compiledRoot }), /escapes root/);
});
