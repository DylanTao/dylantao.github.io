import fs from "node:fs";

export function articulationSource(version) {
  if (!["21", "22", "23"].includes(String(version))) throw new Error("A retained articulation version is required");
  return new URL(`./tail-articulation-v${version}.mjs.raw`, import.meta.url);
}

// Node-only authoring/review loader. .raw keeps the original recipe bytes out
// of formatter rewrites. Resolve its one unchanged browser import explicitly.
export async function loadArticulation(version) {
  const file = articulationSource(version);
  const original = fs.readFileSync(file, "utf8");
  const specifier = '"../three.module.min.js"';
  if (original.split(specifier).length !== 2) throw new Error("The exact frozen import is required");
  const bound = original.replace(specifier, JSON.stringify(new URL("../three.module.min.js", file).href));
  return import(`data:text/javascript;base64,${Buffer.from(bound).toString("base64")}`);
}
