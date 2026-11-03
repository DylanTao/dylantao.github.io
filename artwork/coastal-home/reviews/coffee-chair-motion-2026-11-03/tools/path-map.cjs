// Invocation-only relocation of the retained QA helpers' original absolute
// paths. No source text, model byte, clock or mathematical operation changes.
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const Module = require("node:module");
const { fileURLToPath, pathToFileURL } = require("node:url");
const read = fs.readFileSync;
const append = fs.appendFileSync;
const original = process.env.COFFEE_REPLAY_ORIGINAL_ROOT;
const target = process.env.COFFEE_REPLAY_ROOT;
const log = process.env.COFFEE_REPLAY_MAP_LOG;
if (!original || !target || !log) throw Error("Explicit private replay roots and mapping log are required");
const normal = (value) =>
  String(value)
    .replaceAll("\\", "/")
    .replace(/^\/([a-z]:\/)/i, "$1")
    .replace(/\/$/, "");
const from = normal(original),
  into = normal(target);
const within = (value, root) => value.toLowerCase() === root.toLowerCase() || value.toLowerCase().startsWith(root.toLowerCase() + "/");
const emit = (value) => append(log, JSON.stringify(value) + "\n");

function describe(value) {
  if (value instanceof URL) return value.protocol === "file:" ? fileURLToPath(value) : null;
  if (typeof value !== "string") return null;
  return value.startsWith("file:") ? fileURLToPath(new URL(value)) : value;
}

function mapPath(value) {
  const raw = describe(value);
  if (raw === null) return value;
  const clean = normal(raw);
  if (within(clean, into) || !within(clean, from)) return value;
  const relative = clean.slice(from.length).replace(/^\//, "");
  if (relative.split("/").includes("..")) throw Error("Replay source mapping escaped its declared prefix");
  const mapped = path.join(target, ...relative.split("/"));
  emit({ kind: "prefix", original: String(value), actual: mapped });
  return value instanceof URL ? pathToFileURL(mapped) : value.startsWith("file:") ? pathToFileURL(mapped).href : mapped;
}

function fileReceipt(kind, requested, actual, body) {
  const name = describe(actual);
  if (name === null || !within(normal(name), into)) return;
  const bytes = Buffer.isBuffer(body) ? body : Buffer.from(body, "utf8");
  emit({ kind, requested: String(requested), actual: name, bytes: bytes.length, sha256: crypto.createHash("sha256").update(bytes).digest("hex") });
}

fs.readFileSync = function (filename, ...args) {
  const mapped = mapPath(filename),
    body = read.call(this, mapped, ...args);
  fileReceipt("read", filename, mapped, body);
  return body;
};
const resolve = Module._resolveFilename;
Module._resolveFilename = function (request, ...args) {
  const mapped = mapPath(request),
    result = resolve.call(this, mapped, ...args);
  if (typeof result === "string" && within(normal(result), into)) fileReceipt("require", request, result, read(result));
  return result;
};
Module.syncBuiltinESMExports();

function recordResolution(specifier, url) {
  if (!url.startsWith("file:")) return;
  const filename = fileURLToPath(url);
  if (!within(normal(filename), into)) throw Error("An application module escaped the private replay fixture: " + url);
  fileReceipt("esm", specifier, filename, read(filename));
}

module.exports = { mapPath, recordResolution };
