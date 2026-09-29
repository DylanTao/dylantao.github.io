import { createModelLoader } from "../home-scene/model-loader.mjs";

// One manifest and decoder per page; repeated miniature viewers share geometry.
// Instance materials remain independent because their lighting can differ.
let manifest, decoder, loader;
const models = new Map();
// Version the shared dependencies and binaries with the renderer release so a
// repeat visitor cannot combine a new poster with an old cached coastal model.
function assetUrl(file) {
  const url = new URL("../../models/la-jolla/" + file, import.meta.url);
  url.search = new URL(import.meta.url).search;
  return url;
}
export function coastManifest() {
  return (manifest ||= fetch(assetUrl("manifest.json")).then((response) => {
    if (!response.ok) throw new Error("The coastal miniature is unavailable.");
    return response.json();
  }));
}
export async function acquireCoast(file) {
  if (!loader) ({ loader, decoder } = createModelLoader());
  let entry = models.get(file);
  if (!entry) {
    entry = { refs: 0, promise: loader.loadAsync(assetUrl(file).href) };
    models.set(file, entry);
  }
  entry.refs++;
  let original;
  try {
    original = await entry.promise;
  } catch (error) {
    if (--entry.refs === 0) models.delete(file);
    if (!models.size) {
      decoder?.dispose();
      loader = decoder = null;
    }
    throw error;
  }
  const scene = original.scene.clone(true),
    materials = new Map();
  scene.traverse((o) => {
    if (!o.material) return;
    const clone = (m) => {
      if (!materials.has(m)) materials.set(m, m.clone());
      return materials.get(m);
    };
    o.material = Array.isArray(o.material) ? o.material.map(clone) : clone(o.material);
    if (o.geometry) o.userData.sharedCoastGeometry = true;
  });
  let released = false;
  return {
    scene,
    release() {
      if (released) return;
      released = true;
      materials.forEach((m) => m.dispose());
      if (--entry.refs === 0) {
        const geometries = new Set(),
          materials = new Set();
        original.scene.traverse((o) => {
          if (o.geometry) geometries.add(o.geometry);
          for (const m of [o.material].flat().filter(Boolean)) materials.add(m);
        });
        geometries.forEach((g) => g.dispose());
        materials.forEach((m) => m.dispose());
        models.delete(file);
      }
      if (!models.size) {
        decoder.dispose();
        loader = decoder = null;
      }
    },
  };
}
