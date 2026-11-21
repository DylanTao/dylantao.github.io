"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");
const { execFileSync } = require("node:child_process");
const { createHash, randomUUID } = require("node:crypto");

const manifestPath = "assets/models/home/manifest.json";
const fieldPath = "assets/models/home/static-light-field.json";
const inventoryPath = "artwork/coastal-home/reviews/static-light-inputs.json";
const collectorPath = "assets/js/home-scene/static-light-field.mjs";
const files = [
  "assets/js/home.js",
  "assets/js/home-scene",
  "assets/js/three.module.min.js",
  "assets/js/vendor/three-r164",
  manifestPath,
  fieldPath,
  inventoryPath,
];
const sha = (data) => createHash("sha256").update(data).digest("hex");
const sorted = (value) =>
  Array.isArray(value)
    ? value.map(sorted)
    : value && typeof value === "object"
      ? Object.fromEntries(
          Object.keys(value)
            .sort()
            .map((k) => [k, sorted(value[k])])
        )
      : value;
const signedDigest = (name, bytes) => sha(/\.(glb|wasm)$/.test(name) ? bytes : bytes.toString("utf8").replace(/\r\n/g, "\n"));

function argumentsFrom(args, usage) {
  assert(args.length >= 3 && /^[a-f0-9]{40}$/.test(args[1]), usage);
  return { checkout: path.resolve(args[0]), revision: args[1], out: path.resolve(args[2]), tail: args.slice(3) };
}

async function loadRelease({ checkout, revision, out }) {
  const commit = execFileSync("git", ["rev-parse", revision + "^{commit}"], { cwd: checkout, encoding: "utf8" }).trim();
  assert.equal(commit, revision, "Requested full SHA must identify a commit.");
  const pinned = path.join(out, "pinned-" + revision);
  await fs.mkdir(pinned, { recursive: true });
  const tar = path.join(out, "release-" + randomUUID() + ".tar");
  try {
    execFileSync("git", ["archive", "--format=tar", "--output", tar, revision, ...files], { cwd: checkout });
    execFileSync("tar", ["-xf", tar, "-C", pinned], { cwd: out });
  } finally {
    await fs.unlink(tar).catch((error) => {
      if (error.code !== "ENOENT") throw error;
    });
  }
  const [manifestBytes, snapshotBytes, inventoryBytes] = await Promise.all(
    [manifestPath, fieldPath, inventoryPath].map((file) => fs.readFile(path.join(pinned, file)))
  );
  const manifest = JSON.parse(manifestBytes);
  const snapshot = JSON.parse(snapshotBytes);
  const { inputs, signature } = JSON.parse(inventoryBytes);
  const withoutCache = { ...manifest };
  delete withoutCache.staticLightFieldCache;
  assert.equal(sha(JSON.stringify(sorted(inputs))), signature, "Signed dependency inventory mismatch");
  assert.equal(sha(JSON.stringify(sorted(withoutCache))), inputs.manifestSha256, "Manifest does not match signed inventory");
  assert.equal(sha(snapshotBytes), manifest.staticLightFieldCache.sha256, "Snapshot bytes differ from the release descriptor");
  assert.equal(snapshot.signature, signature, "Snapshot source signature differs from the committed inventory");
  assert.equal(manifest.staticLightFieldCache.signature, signature, "Manifest signature differs from the committed inventory");
  return {
    checkout,
    revision,
    out,
    pinned,
    inputs,
    signature,
    manifest,
    withoutCache,
    snapshot,
    manifestHash: sha(manifestBytes),
    snapshotHash: sha(snapshotBytes),
    immutableBlob: (name) => execFileSync("git", ["show", revision + ":" + name], { cwd: checkout, maxBuffer: 1 << 26 }),
  };
}

module.exports = { argumentsFrom, loadRelease, manifestPath, collectorPath, sha, signedDigest };
