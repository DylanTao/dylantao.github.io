import * as THREE from "../three.module.min.js";
import { GLASS_NAME } from "./glazing.mjs";
import { DETAIL, chooseLevel, planDetail, projectedPixels, reachFor } from "./detail-levels.mjs";

// Sirui's furniture in the coastal home (Sirui, 2026-10-19), built in its own Blender source
// (bin/build_coastal_furniture.py) and placed at anchors the house's build writes.
//
// The furniture interface, shared with the house's build:
// - assets/models/home/furniture/index.json lists each item's levels of detail (the first is the
//   default; finer levels name `near` and load lazily), its bounds in item space (origin at the
//   floor-contact centre, front +z), and for seats its seat height.
// - The manifest's `furniture` lists anchors { id, item, room, position, yaw }: the item stands at
//   `position` (world metres) turned by `yaw` about +y, as an actor's facing turns an avatar.
// - Each anchor's room keeps a simple placeholder carrying the extra furniturePlaceholder = the
//   anchor's id; it is hidden once the item is drawn.
// Whatever is missing on either side is skipped silently, so either build can land first.
//
// Each item is loaded once and shared by its anchors (the six dining chairs draw one geometry and
// one set of materials six times); it is parented to its anchor's room, so cutaways and visibility
// follow the room. Placed pieces stay out of the static light bake (userData.dynamic), so the bake
// is the same whichever arrives first. detail-levels.mjs decides which level each anchor draws.

const LOD_SUFFIX = / \(lod\d+\)$/;
// A material's name without its level's suffix ("eames leather (lod1)" -> "eames leather").
export const furnitureMaterialName = (name = "") => name.replace(LOD_SUFFIX, "");
// How long a room's own load waits for its furniture's default levels before drawing without them.
export const ATTACH_WAIT = 3000;

// The pieces carry their textures inside the GLB as WebP. GLTFLoader reads an embedded image through
// a blob: URL, which the site's Content-Security-Policy (img-src and connect-src without blob:)
// refuses; decoding the bytes directly with createImageBitmap involves no URL at all. Registered on
// the scene's loader, this changes nothing for images that live at their own URLs.
export function embeddedImages(parser) {
  const original = parser.loadImageSource.bind(parser);
  parser.loadImageSource = function (sourceIndex, loader) {
    const source = parser.json.images?.[sourceIndex];
    if (source?.bufferView === undefined || typeof createImageBitmap !== "function") return original(sourceIndex, loader);
    if (parser.sourceCache[sourceIndex] !== undefined) return parser.sourceCache[sourceIndex].then((texture) => texture.clone());
    const promise = parser
      .getDependency("bufferView", source.bufferView)
      .then((view) => createImageBitmap(new Blob([view], { type: source.mimeType }), { premultiplyAlpha: "none", colorSpaceConversion: "none" }))
      .then((bitmap) => {
        const texture = new THREE.Texture(bitmap);
        texture.needsUpdate = true;
        texture.userData.mimeType = source.mimeType;
        return texture;
      });
    parser.sourceCache[sourceIndex] = promise;
    return promise;
  };
  return { name: "COASTAL_embedded_images" };
}

const validAnchor = (a) =>
  a && typeof a.id === "string" && typeof a.item === "string" && typeof a.room === "string" && Array.isArray(a.position) && a.position.length === 3 && a.position.every(Number.isFinite);

export function createFurniture({
  config,
  baseUrl,
  loadModel,
  loader = null,
  prepare = (root) => root,
  compile = () => Promise.resolve(),
  requestFrame = () => {},
  roomRoot = () => null,
  anisotropy = () => 1,
  fetchIndex = (url) => fetch(url).then((response) => (response.ok ? response.json() : null)),
  now = () => performance.now(),
  // Comparison flag (?furniture-detail=default|fine): hold every anchor at its default level, or
  // draw the finest level of whatever is in view.
  override = null,
}) {
  const anchors = (Array.isArray(config?.furniture) ? config.furniture : []).filter(validAnchor);
  if (anchors.length) loader?.register(embeddedImages);
  let index = null,
    disposed = false,
    downloaded = 0,
    compiling = null;
  const indexReady = anchors.length
    ? Promise.resolve()
        .then(() => fetchIndex(new URL("furniture/index.json", baseUrl).href))
        .then((data) => {
          index = data && data.version === 1 && data.items ? data : null;
          return index;
        })
        .catch(() => null)
    : Promise.resolve(null);
  const models = new Map(); // `${item}#${level}` -> { key, item, level, bytes, state, source, resources, lastWanted }
  const placed = new Map(); // anchor id -> placement
  const roots = new Map(); // room id -> root the room's load handed over
  const pendingShow = new Set();
  const listeners = new Set();

  const levelsOf = (item) => index?.items?.[item]?.lods || [];

  function tune(root) {
    const wanted = anisotropy();
    root.traverse((o) => {
      o.userData.dynamic = true;
      if (!o.isMesh) return;
      for (const material of [o.material].flat()) {
        if (!material) continue;
        // Cut-out weaves (the Aeron's pellicle) resolve to a soft see-through at a distance with the
        // beauty pass's multisampling instead of a hard, shimmering edge.
        if (material.alphaTest > 0) material.alphaToCoverage = true;
        for (const map of [material.map, material.normalMap, material.roughnessMap]) {
          if (!map || map.isRenderTargetTexture) continue;
          map.userData.baseAnisotropy ??= map.anisotropy;
          const next = Math.max(wanted, map.userData.baseAnisotropy);
          if (map.anisotropy !== next) {
            map.anisotropy = next;
            map.needsUpdate = true;
          }
        }
      }
    });
  }

  function collect(root) {
    const geometries = new Set(),
      materials = new Set(),
      textures = new Set();
    root.traverse((o) => {
      if (!o.isMesh) return;
      geometries.add(o.geometry);
      const all = [o.material, o.userData.baseMaterial, ...Object.values(o.userData.styleMaterials || {})].flat();
      for (const material of all) {
        // The house's shared glazing is not ours to dispose.
        if (!material || material.name === GLASS_NAME || material.userData?.shared) continue;
        materials.add(material);
        for (const value of Object.values(material)) if (value?.isTexture && !value.isRenderTargetTexture) textures.add(value);
      }
    });
    return { geometries, materials, textures };
  }

  function model(item, level) {
    const key = `${item}#${level}`;
    let entry = models.get(key);
    if (entry) return entry;
    const lod = levelsOf(item)[level];
    entry = { key, item, level, bytes: lod?.bytes || 0, state: "loading", source: null, resources: null, lastWanted: now() };
    models.set(key, entry);
    entry.promise = (lod?.file ? loadModel(new URL(`furniture/${lod.file}`, baseUrl).href) : Promise.reject(new Error("no file")))
      .then((gltf) => {
        const root = gltf?.scene;
        if (!root) throw new Error("empty model");
        if (disposed || entry.state === "released") {
          disposeResources(collect(root));
          return null;
        }
        root.traverse((o) => (o.userData.furnitureItem = item));
        prepare(root);
        tune(root);
        entry.source = root;
        entry.resources = collect(root);
        entry.state = "ready";
        downloaded += entry.bytes;
        requestFrame();
        return root;
      })
      .catch(() => {
        if (entry.state !== "released") entry.state = "failed";
        return null;
      });
    return entry;
  }

  function disposeResources(resources) {
    if (!resources) return;
    resources.geometries.forEach((g) => g.dispose());
    resources.materials.forEach((m) => m.dispose());
    resources.textures.forEach((t) => t.dispose());
  }

  // A copy of a prepared model that shares its geometry and materials.
  function instance(source) {
    const copy = (o) => {
      const out = o.isMesh ? new THREE.Mesh(o.geometry, o.material) : new THREE.Group();
      if (o.isMesh) {
        out.castShadow = o.castShadow;
        out.receiveShadow = o.receiveShadow;
        out.frustumCulled = o.frustumCulled;
        out.renderOrder = o.renderOrder;
        out.customDepthMaterial = o.customDepthMaterial;
        out.customDistanceMaterial = o.customDistanceMaterial;
      }
      out.name = o.name;
      out.position.copy(o.position);
      out.quaternion.copy(o.quaternion);
      out.scale.copy(o.scale);
      out.visible = o.visible;
      out.userData = { ...o.userData };
      delete out.userData.baseMaterial;
      delete out.userData.styleMaterials;
      for (const child of o.children) out.add(copy(child));
      return out;
    };
    return copy(source);
  }

  function placeholders(root, id) {
    const found = [];
    root.traverse((o) => {
      if (o.userData.furniturePlaceholder === id) found.push(o);
    });
    return found;
  }

  // Put an anchor's group into its room (once both the room and the index are known).
  function placement(anchor) {
    if (placed.has(anchor.id)) return placed.get(anchor.id);
    const item = index?.items?.[anchor.item];
    const root = roots.get(anchor.room) || roomRoot(anchor.room);
    if (!item || !root) return null;
    const group = new THREE.Group();
    group.name = `furniture ${anchor.id}`;
    group.userData.dynamic = true;
    group.userData.furnitureAnchor = anchor.id;
    root.updateWorldMatrix(true, false);
    group.position.copy(root.worldToLocal(new THREE.Vector3(...anchor.position)));
    group.rotation.y = Number.isFinite(anchor.yaw) ? anchor.yaw : 0;
    root.add(group);
    const lo = new THREE.Vector3(...(item.bounds?.min || [-0.5, 0, -0.5])),
      hi = new THREE.Vector3(...(item.bounds?.max || [0.5, 1, 0.5]));
    const entry = {
      anchor,
      item: anchor.item,
      room: anchor.room,
      root,
      group,
      center: lo.clone().add(hi).multiplyScalar(0.5),
      radius: Math.max(0.05, lo.distanceTo(hi) / 2),
      instances: new Map(),
      shown: -1,
      wanted: 0,
      hidden: placeholders(root, anchor.id),
      placeholderHidden: false,
      culled: false,
    };
    placed.set(anchor.id, entry);
    return entry;
  }

  // Add a ready level's copy to an anchor. Visible at once before the first composed frame (its
  // programs compile with that frame); afterwards it waits, hidden, for its programs.
  function addInstance(entry, level, immediate) {
    if (entry.instances.has(level)) return entry.instances.get(level);
    const source = models.get(`${entry.item}#${level}`)?.source;
    if (!source) return null;
    const object = instance(source);
    object.name = `${entry.anchor.id} lod${level}`;
    object.visible = false;
    object.userData.furnitureLevel = level;
    object.userData.ready = immediate;
    entry.group.add(object);
    entry.instances.set(level, object);
    if (!immediate) pendingShow.add(object);
    return object;
  }

  function show(entry, level) {
    if (entry.shown === level) return false;
    for (const [lvl, object] of entry.instances) object.visible = lvl === level;
    entry.shown = level;
    if (!entry.placeholderHidden) {
      for (const o of entry.hidden) o.visible = false;
      entry.placeholderHidden = true;
    }
    for (const listener of listeners) listener(entry);
    return true;
  }

  // Programs for hidden copies: one compile at a time, covering every copy waiting when it starts.
  function compilePending() {
    if (compiling || !pendingShow.size || disposed) return;
    const batch = [...pendingShow];
    pendingShow.clear();
    compiling = Promise.resolve(compile())
      .catch(() => {})
      .then(() => {
        compiling = null;
        if (disposed) return;
        for (const object of batch) object.userData.ready = true;
        requestFrame();
        compilePending();
      });
  }

  function releaseModel(key) {
    const entry = models.get(key);
    if (!entry) return;
    for (const p of placed.values()) {
      const object = p.instances.get(entry.level);
      if (!object || p.item !== entry.item) continue;
      if (p.shown === entry.level) show(p, 0);
      object.removeFromParent();
      pendingShow.delete(object);
      p.instances.delete(entry.level);
    }
    if (entry.state === "loading") entry.state = "released";
    disposeResources(entry.resources);
    models.delete(key);
  }

  // The best level an anchor can draw now: the wanted one if ready, else the nearest ready below it.
  function drawable(entry, wanted) {
    for (let level = wanted; level >= 0; level--) {
      const object = entry.instances.get(level);
      if (object?.userData.ready) return level;
    }
    return entry.shown;
  }

  const frustum = new THREE.Frustum(),
    matrix = new THREE.Matrix4(),
    sphere = new THREE.Sphere(),
    tanHalf = Math.tan((38 * Math.PI) / 360);

  return {
    get index() {
      return index;
    },
    indexReady,
    anchors,
    // Start fetching the default levels of a room's furniture; resolves when they are parsed.
    load(roomId) {
      return indexReady.then((data) => {
        if (!data || disposed) return [];
        const list = anchors.filter((a) => a.room === roomId && data.items[a.item]);
        return Promise.all(list.map((a) => model(a.item, 0).promise));
      });
    },
    // A room's root is ready: place its furniture (waiting a little for the default levels, so the
    // first composed frame of a room already has its pieces) before its programs compile.
    async attach(roomId, root, pending, wait = ATTACH_WAIT) {
      if (disposed || !root) return;
      roots.set(roomId, root);
      if (pending) {
        let timer;
        await Promise.race([pending, new Promise((resolve) => (timer = setTimeout(resolve, wait)))]);
        clearTimeout(timer);
      }
      if (disposed || !index) return;
      for (const anchor of anchors) {
        if (anchor.room !== roomId) continue;
        const entry = placement(anchor);
        if (!entry || models.get(`${anchor.item}#0`)?.state !== "ready") continue;
        addInstance(entry, 0, true);
        show(entry, 0);
      }
    },
    // Each frame, before drawing: which level each anchor draws, what to fetch and what to release.
    update({ camera, bufferHeight = DETAIL.referenceHeight, fullscreen = false } = {}) {
      if (!index || disposed || !camera) return false;
      const time = now();
      camera.updateMatrixWorld();
      frustum.setFromProjectionMatrix(matrix.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse));
      const requests = [];
      let changed = false;
      for (const anchor of anchors) {
        const entry = placement(anchor);
        if (!entry) continue;
        const base = model(anchor.item, 0);
        if (base.state === "ready" && !entry.instances.has(0)) addInstance(entry, 0, false);
        entry.group.updateWorldMatrix(true, false);
        sphere.center.copy(entry.center).applyMatrix4(entry.group.matrixWorld);
        sphere.radius = entry.radius;
        let distance = Math.max(0.05, camera.position.distanceTo(sphere.center) - entry.radius * 0.35);
        let pixels;
        if (camera.isOrthographicCamera) {
          pixels = (entry.radius / ((camera.top - camera.bottom) / (2 * camera.zoom))) * (bufferHeight / 2);
          distance = (entry.radius * bufferHeight) / (2 * Math.max(pixels, 1e-6) * tanHalf);
        } else pixels = projectedPixels(entry.radius, distance, camera.fov, bufferHeight);
        const inView = frustum.intersectsSphere(sphere);
        const culled = pixels < DETAIL.cullPixels;
        if (culled !== entry.culled) {
          entry.culled = culled;
          entry.group.visible = !culled;
          changed = true;
        }
        const levels = levelsOf(anchor.item);
        entry.wanted =
          override === "default"
            ? 0
            : override === "fine"
              ? inView && !culled
                ? levels.length - 1
                : 0
              : chooseLevel(levels, Math.max(entry.shown, 0), { distance, bufferHeight, fullscreen, inView: inView && !culled });
        for (let level = 1; level <= entry.wanted; level++) {
          const reach = reachFor(levels[level], { bufferHeight, fullscreen }) || 1;
          requests.push({ key: `${anchor.item}#${level}`, bytes: levels[level].bytes || 0, priority: distance / reach });
          const fine = models.get(`${anchor.item}#${level}`);
          if (fine) fine.lastWanted = time;
          if (fine?.state === "ready" && !entry.instances.has(level)) addInstance(entry, level, false);
        }
        const target = drawable(entry, entry.wanted);
        if (target >= 0 && show(entry, target)) changed = true;
      }
      const resident = {};
      for (const entry of models.values())
        if (entry.level > 0 && entry.state !== "failed") resident[entry.key] = { bytes: entry.bytes, lastWanted: entry.lastWanted, loading: entry.state === "loading" };
      const plan = planDetail(requests, resident, { budget: fullscreen ? DETAIL.budget.fullscreen : DETAIL.budget.embed, now: time });
      for (const key of plan.release) {
        releaseModel(key);
        changed = true;
      }
      for (const key of plan.fetch) {
        const [item, level] = key.split("#");
        model(item, Number(level));
      }
      compilePending();
      return changed;
    },
    // Called with a placement whenever an anchor changes what it draws (fire.mjs, the pot filler).
    onShow(listener) {
      listeners.add(listener);
      for (const entry of placed.values()) if (entry.shown >= 0) listener(entry);
      return () => listeners.delete(listener);
    },
    placements: () => [...placed.values()],
    evidence() {
      const fine = [...models.values()].filter((m) => m.level > 0 && m.state === "ready");
      return {
        index: Boolean(index),
        anchors: anchors.length,
        placed: [...placed.values()].map((p) => ({
          id: p.anchor.id,
          item: p.item,
          room: p.room,
          shown: p.shown,
          wanted: p.wanted,
          culled: p.culled,
          placeholders: p.hidden.length,
          placeholderHidden: p.placeholderHidden,
        })),
        models: [...models.values()].map((m) => ({ key: m.key, state: m.state, bytes: m.bytes })),
        downloadedBytes: downloaded,
        fineBytes: fine.reduce((sum, m) => sum + m.bytes, 0),
      };
    },
    dispose() {
      disposed = true;
      for (const p of placed.values()) {
        p.group.removeFromParent();
        if (p.placeholderHidden) for (const o of p.hidden) o.visible = true;
      }
      placed.clear();
      for (const entry of models.values()) {
        if (entry.state === "loading") entry.state = "released";
        disposeResources(entry.resources);
      }
      models.clear();
      listeners.clear();
      pendingShow.clear();
    },
  };
}
