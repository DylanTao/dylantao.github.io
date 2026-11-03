#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath, pathToFileURL } from "node:url";
import { THREE, loadNativeModel } from "../test/helpers/coastal-native-avatar.mjs";
import { configureStaticModelIndices } from "../assets/js/home-scene/static-triangle-index.mjs";
import { createMeasuredCoffeeChair } from "../assets/js/home-scene/coffee-chair.mjs";

const sha = (bytes) => crypto.createHash("sha256").update(bytes).digest("hex");
const raw = (array) => Buffer.from(array.buffer, array.byteOffset, array.byteLength);
const requireCondition = (ok, message) => {
  if (!ok) throw new Error(message);
};
const matrixEqual = (a, b) => Array.isArray(b) && a.length === b.length && a.every((v, i) => v === b[i]);
const names = (geometry) => Object.keys(geometry.attributes).sort();

function typedHash(mesh, faces) {
  const chunks = [];
  for (const face of faces)
    for (let k = 0; k < 3; k++) {
      const id = mesh.geometry.index.getX(face * 3 + k);
      for (const name of names(mesh.geometry)) {
        const a = mesh.geometry.attributes[name],
          width = a.itemSize * a.array.BYTES_PER_ELEMENT;
        chunks.push(Buffer.from(a.array.buffer, a.array.byteOffset + id * width, width));
      }
    }
  return sha(Buffer.concat(chunks));
}
function schema(a) {
  return {
    type: a.array.constructor.name,
    normalized: a.normalized,
    itemSize: a.itemSize,
    count: a.count,
    gpuType: a.gpuType,
    usage: a.usage,
    wholeSHA256: sha(raw(a.array)),
  };
}
function indexSchema(a) {
  const { type, normalized, gpuType, usage, wholeSHA256 } = schema(a);
  return { type, normalized, gpuType, usage, wholeSHA256 };
}
function rawOwner(gltf, mesh) {
  for (let node = mesh; node; node = node.parent) {
    const id = gltf.parser.associations.get(node)?.nodes;
    if (id !== undefined) return gltf.parser.json.nodes[id].name;
  }
  return null;
}
function faceWorld(mesh, face) {
  return [0, 1, 2].map((k) =>
    new THREE.Vector3()
      .fromBufferAttribute(mesh.geometry.attributes.position, mesh.geometry.index.getX(face * 3 + k))
      .applyMatrix4(mesh.matrixWorld)
      .toArray()
      .map((v) => (v === 0 ? 0 : v))
  );
}
function geometricHash(mesh, faces) {
  const triangles = faces
    .map((face) => {
      const points = faceWorld(mesh, face);
      requireCondition(points.flat().every(Number.isFinite), "nonfinite source geometry");
      // Cyclic rotation preserves orientation. Sorting retains every occurrence,
      // including coincident/zero-area charts; reversed winding is different.
      return [0, 1, 2].map((k) => JSON.stringify([...points.slice(k), ...points.slice(0, k)])).sort()[0];
    })
    .sort();
  return sha(Buffer.from(JSON.stringify(triangles)));
}
function components(mesh) {
  const g = mesh.geometry,
    a = g.attributes.position,
    canonical = new Map(),
    ids = [],
    uf = [];
  const find = (i) => {
    while (uf[i] !== i) {
      uf[i] = uf[uf[i]];
      i = uf[i];
    }
    return i;
  };
  for (let i = 0; i < a.count; i++) {
    const point = new THREE.Vector3().fromBufferAttribute(a, i).applyMatrix4(mesh.matrixWorld),
      key = JSON.stringify(point.toArray().map((v) => (v === 0 ? 0 : v)));
    if (!canonical.has(key)) {
      canonical.set(key, uf.length);
      uf.push(uf.length);
    }
    ids.push(canonical.get(key));
  }
  const faceIds = [];
  for (let f = 0; f < g.index.count / 3; f++) {
    const v = [0, 1, 2].map((k) => ids[g.index.getX(f * 3 + k)]);
    for (const k of [1, 2]) uf[find(v[k])] = find(v[0]);
    faceIds.push({ f, vertex: v[0] });
  }
  const groups = new Map();
  for (const { f, vertex } of faceIds) {
    const id = find(vertex);
    if (!groups.has(id)) groups.set(id, []);
    groups.get(id).push(f);
  }
  return [...groups.values()].map((faces, island) => ({ faces, island, geometricSHA256: geometricHash(mesh, faces) }));
}
function ranges(faces) {
  const out = [];
  for (const face of faces) {
    if (out.length && out.at(-1)[1] + 1 === face) out.at(-1)[1] = face;
    else out.push([face, face]);
  }
  return out;
}

// This emits candidates, not an admission decision. All geometry matching is
// exact; a new codec displacement must be separately qualified, not hidden in
// a producer tolerance or a manually edited fingerprint.
export function candidateDefinition(reference, candidate, roster) {
  requireCondition(Array.isArray(roster?.configured) && roster.configured.length === 14, "exact approved 14-part roster required");
  reference.scene.updateWorldMatrix(true, true);
  candidate.scene.updateWorldMatrix(true, true);
  const current = [];
  candidate.scene.traverse((mesh) => {
    if (!mesh.isMesh) return;
    requireCondition(mesh.geometry.index?.count % 3 === 0, "indexed native triangles required");
    const owner = rawOwner(candidate, mesh);
    if (roster.configured.some((r) => r.rawOwner === owner)) current.push({ mesh, owner, components: components(mesh) });
  });
  const sources = [],
    sourceMap = new Map(),
    parts = [],
    configured = [],
    correspondence = [],
    used = new Set();
  for (let i = 0; i < roster.configured.length; i++) {
    const row = roster.configured[i],
      matches = [];
    reference.scene.traverse((o) => {
      if (o.name === row.meshName) matches.push(o);
    });
    requireCondition(matches.length === 1, "ambiguous/missing approved reference mesh " + row.meshName);
    const original = matches[0],
      g = original.geometry;
    requireCondition(
      original.material?.name === row.material &&
        rawOwner(reference, original) === row.rawOwner &&
        matrixEqual(original.matrixWorld.toArray(), row.worldMatrix) &&
        matrixEqual(original.matrix.toArray(), row.localMatrix),
      "reference frame/material mismatch"
    );
    for (const [name, expected] of Object.entries(row.attributes))
      requireCondition(
        g.attributes[name] &&
          schema(g.attributes[name]).wholeSHA256 === expected.wholeSHA256 &&
          g.attributes[name].array.constructor.name === expected.type &&
          g.attributes[name].normalized === expected.normalized &&
          g.attributes[name].itemSize === expected.itemSize,
        "reference attribute mismatch " + name
      );
    requireCondition(
      sha(raw(g.index.array)) === row.index.wholeSHA256 &&
        row.faces.length === row.triangles &&
        row.triangles > 0 &&
        new Set(row.faces).size === row.faces.length &&
        row.faces.every((f) => Number.isInteger(f) && f >= 0 && f * 3 < g.index.count) &&
        typedHash(original, row.faces) === row.typedOrientedTriangleSHA256,
      "approved reference typed/triangle mismatch"
    );
    const geometrySHA = geometricHash(original, row.faces),
      found = [];
    for (const c of current)
      if (c.owner === row.rawOwner && c.mesh.material?.name === row.material)
        for (const part of c.components)
          if (part.faces.length === row.triangles && part.geometricSHA256 === geometrySHA) found.push({ ...part, mesh: c.mesh });
    requireCondition(found.length === 1, "geometry changed, missing or ambiguous part " + i + " " + row.rawOwner);
    const match = found[0],
      matchKey = match.mesh.uuid + ":" + match.island;
    requireCondition(!used.has(matchKey), "part identity reused");
    used.add(matchKey);
    const mesh = match.mesh,
      geometry = mesh.geometry,
      attributes = Object.fromEntries(Object.entries(geometry.attributes).map(([n, a]) => [n, schema(a)]));
    if (!sourceMap.has(mesh)) {
      sourceMap.set(mesh, "source-" + sources.length);
      sources.push({
        id: sourceMap.get(mesh),
        meshName: mesh.name,
        materialName: mesh.material.name,
        localMatrix: mesh.matrix.toArray(),
        worldMatrix: mesh.matrixWorld.toArray(),
        attributes,
        index: indexSchema(geometry.index),
      });
    }
    const hash = typedHash(mesh, match.faces),
      whole = match.faces.length * 3 === geometry.index.count;
    parts.push({
      id: "part-" + i,
      source: sourceMap.get(mesh),
      faceRanges: ranges(match.faces),
      triangles: match.faces.length,
      whole,
      typedOrientedTriangleSHA256: hash,
    });
    configured.push({
      ...row,
      meshName: mesh.name,
      parentName: mesh.parent.name,
      actualIsland: match.island,
      faces: match.faces,
      sourceVertices: [...new Set(match.faces.flatMap((f) => [0, 1, 2].map((k) => geometry.index.getX(f * 3 + k))))].sort((a, b) => a - b),
      attributes,
      index: indexSchema(geometry.index),
      localMatrix: mesh.matrix.toArray(),
      worldMatrix: mesh.matrixWorld.toArray(),
      standalone: whole,
      typedOrientedTriangleSHA256: hash,
    });
    correspondence.push({
      part: i,
      rawOwner: row.rawOwner,
      triangles: match.faces.length,
      exactOrientedWorldPositionSHA256: geometrySHA,
      referenceTypedSHA256: row.typedOrientedTriangleSHA256,
      candidateTypedSHA256: hash,
      typedFieldsChanged: hash !== row.typedOrientedTriangleSHA256,
      materialRoleSame: true,
    });
  }
  requireCondition(parts.reduce((n, p) => n + p.triangles, 0) === 680, "exact 680-triangle source contract required");
  return { definition: { maxOffset: 0.4, sources, parts }, census: { configured }, correspondence };
}

export function replaceNativeDefinition(template, definition) {
  const marker = "const NATIVE = ",
    at = template.indexOf(marker);
  requireCondition(at >= 0 && template.lastIndexOf(marker) === at, "unique NATIVE block required");
  const start = at + marker.length;
  requireCondition(template[start] === "{", "NATIVE object literal required");
  let depth = 0,
    quote = null,
    escaped = false,
    end = -1;
  for (let i = start; i < template.length; i++) {
    const c = template[i];
    if (quote) {
      if (escaped) escaped = false;
      else if (c === "\\") escaped = true;
      else if (c === quote) quote = null;
      continue;
    }
    if (c === '"' || c === "'") {
      quote = c;
      continue;
    }
    requireCondition(c !== "`" && !(c === "/" && ["/", "*"].includes(template[i + 1])), "NATIVE must contain data only");
    if (c === "{") depth++;
    if (c === "}" && --depth === 0) {
      end = i + 1;
      break;
    }
  }
  requireCondition(end > start && !quote, "unterminated NATIVE block");
  const prefix = template.slice(0, start),
    suffix = template.slice(end);
  return { source: prefix + JSON.stringify(definition, null, 2) + suffix, unchangedCodeSHA256: sha(Buffer.from(prefix + suffix)) };
}
export function safeOutputDirectory(repo, output) {
  const qa = path.resolve(repo, ".jekyll-cache/visual-qa"),
    out = path.resolve(output),
    relative = path.relative(qa, out);
  requireCondition(relative && !relative.startsWith("..") && !path.isAbsolute(relative), "output must be a fresh private visual-QA directory");
  requireCondition(fs.existsSync(path.dirname(out)), "output parent must already exist");
  const actualQa = fs.realpathSync(qa),
    actualParent = fs.realpathSync(path.dirname(out)),
    rel = path.relative(actualQa, actualParent);
  requireCondition(!rel.startsWith("..") && !path.isAbsolute(rel), "output parent escapes visual QA through a link");
  requireCondition(!fs.existsSync(out), "output already exists; preserved without overwrite");
  return out;
}
export function embeddedModel(body) {
  requireCondition(
    body.length >= 20 &&
      body.readUInt32LE(0) === 0x46546c67 &&
      body.readUInt32LE(4) === 2 &&
      body.readUInt32LE(8) === body.length &&
      body.readUInt32LE(16) === 0x4e4f534a,
    "complete GLB2 with JSON first required"
  );
  const size = body.readUInt32LE(12);
  requireCondition(size <= body.length - 20, "invalid GLB JSON length");
  const doc = JSON.parse(body.subarray(20, 20 + size).toString("utf8"));
  requireCondition(
    (doc.buffers || []).every((b) => b.uri === undefined) && (doc.images || []).every((i) => i.uri === undefined),
    "producer requires embedded GLB bufferViews; external/data URI assets are not loaded or omitted"
  );
  return doc;
}
function input(file, expected) {
  requireCondition(/^[0-9a-f]{64}$/.test(expected || ""), "explicit input SHA256 required");
  const body = fs.readFileSync(file);
  requireCondition(sha(body) === expected, "input hash mismatch " + file);
  return { path: path.resolve(file), sha256: expected, bytes: body.length, body };
}
export async function main(argv = process.argv.slice(2)) {
  const allowed = new Set(["reference", "reference-sha", "candidate", "candidate-sha", "roster", "roster-sha", "module", "module-sha", "out"]),
    args = {};
  requireCondition(argv.length % 2 === 0, "explicit flag/value pairs required");
  for (let i = 0; i < argv.length; i += 2) {
    const key = argv[i].replace(/^--/, "");
    requireCondition(argv[i].startsWith("--") && allowed.has(key) && !Object.hasOwn(args, key), "unknown/duplicate flag");
    args[key] = argv[i + 1];
  }
  requireCondition(
    [...allowed].every((k) => typeof args[k] === "string" && args[k]),
    "all SHA-bound input roles and output are required"
  );
  const repo = fileURLToPath(new URL("../", import.meta.url)),
    reference = input(args.reference, args["reference-sha"]),
    candidate = input(args.candidate, args["candidate-sha"]),
    roster = input(args.roster, args["roster-sha"]),
    template = input(args.module, args["module-sha"]),
    out = safeOutputDirectory(repo, args.out);
  embeddedModel(reference.body);
  embeddedModel(candidate.body);
  const owningModuleSHA = sha(fs.readFileSync(path.join(repo, "assets/js/home-scene/coffee-chair.mjs")));
  requireCondition(owningModuleSHA === template.sha256, "module template must match the owning runtime implementation");
  fs.mkdirSync(out);
  const roles = {
    reference: (({ body, ...r }) => r)(reference),
    candidate: (({ body, ...r }) => r)(candidate),
    approvedRoster: (({ body, ...r }) => r)(roster),
    moduleTemplate: (({ body, ...r }) => r)(template),
  };
  try {
    // Immutable private byte copies make the maintained loader consume exactly
    // the verified inputs; no canonical model/master/cache is written.
    fs.writeFileSync(path.join(out, "reference.glb"), reference.body, { flag: "wx" });
    fs.writeFileSync(path.join(out, "candidate.glb"), candidate.body, { flag: "wx" });
    fs.writeFileSync(path.join(out, "approved-roster.json"), roster.body, { flag: "wx" });
    fs.writeFileSync(path.join(out, "reference-module.mjs"), template.body, { flag: "wx" });
    const base = pathToFileURL(out + path.sep),
      original = await loadNativeModel("reference.glb", base),
      next = await loadNativeModel("candidate.glb", base);
    requireCondition(
      sha(fs.readFileSync(path.join(out, "reference.glb"))) === reference.sha256 &&
        sha(fs.readFileSync(path.join(out, "candidate.glb"))) === candidate.sha256,
      "private input copy changed"
    );
    configureStaticModelIndices(original.scene, "realistic");
    configureStaticModelIndices(next.scene, "realistic");
    const result = candidateDefinition(original, next, JSON.parse(roster.body));
    const trial = await createMeasuredCoffeeChair(next.scene, result.definition);
    requireCondition(trial?.available, "runtime cannot represent the generated definition");
    trial.dispose();
    const replacement = replaceNativeDefinition(template.body.toString("utf8"), result.definition);
    fs.writeFileSync(path.join(out, "census.json"), JSON.stringify(result.census, null, 2) + "\n", { flag: "wx" });
    fs.writeFileSync(path.join(out, "definition.json"), JSON.stringify(result.definition, null, 2) + "\n", { flag: "wx" });
    fs.writeFileSync(path.join(out, "coffee-chair.candidate.mjs"), replacement.source, { flag: "wx" });
    const receipt = {
      version: 1,
      status: "candidate-not-admitted",
      atUTC: new Date().toISOString(),
      producerSHA256: sha(fs.readFileSync(fileURLToPath(import.meta.url))),
      roles,
      owningChairModuleSHA256: owningModuleSHA,
      owningIndexModuleSHA256: sha(fs.readFileSync(path.join(repo, "assets/js/home-scene/static-triangle-index.mjs"))),
      owningReaderSHA256: sha(fs.readFileSync(path.join(repo, "test/helpers/coastal-native-avatar.mjs"))),
      ...result,
      unchangedCodeSHA256: replacement.unchangedCodeSHA256,
      candidateModuleSHA256: sha(Buffer.from(replacement.source)),
      next: "Coordinator must qualify final source/decoded body/contact/material/appearance/GPU/lifecycle and official cache before copying this produced module candidate. Exact geometry correspondence alone does not admit changed AO/color/material response. No auto promotion/push.",
    };
    fs.writeFileSync(path.join(out, "RECEIPT.json"), JSON.stringify(receipt, null, 2) + "\n", { flag: "wx" });
    process.stdout.write(
      JSON.stringify({
        status: receipt.status,
        output: out,
        parts: result.definition.parts.length,
        triangles: 680,
        candidateModuleSHA256: receipt.candidateModuleSHA256,
      }) + "\n"
    );
    return receipt;
  } catch (error) {
    fs.writeFileSync(
      path.join(out, "FAILURE.json"),
      JSON.stringify(
        {
          status: "failed-not-admitted",
          atUTC: new Date().toISOString(),
          roles,
          error: String(error.stack || error),
          preservedPrivateInputs: true,
          noCanonicalWrites: true,
        },
        null,
        2
      ) + "\n",
      { flag: "wx" }
    );
    throw error;
  }
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url))
  main().catch((error) => {
    process.stderr.write(String(error.stack || error) + "\n");
    process.exitCode = 1;
  });
