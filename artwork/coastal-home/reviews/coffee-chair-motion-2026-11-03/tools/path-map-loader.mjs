import { createRequire } from "node:module";
const { mapPath, recordResolution } = createRequire(import.meta.url)("./path-map.cjs");

export async function resolve(specifier, context, nextResolve) {
  let result = await nextResolve(mapPath(specifier), context);
  const mapped = mapPath(result.url);
  if (mapped !== result.url) result = await nextResolve(mapped, context);
  recordResolution(specifier, result.url);
  return result;
}
