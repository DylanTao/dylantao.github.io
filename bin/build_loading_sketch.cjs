// Trace the loading sketch's pen drawings from the 3D home's own authored views.
//
//   node bin/build_loading_sketch.cjs              capture the passes, then trace
//   node bin/build_loading_sketch.cjs --reuse      re-trace the cached passes
//   node bin/build_loading_sketch.cjs --check      re-trace the cached passes; fail if any drawing file would change
//
// It writes loading-sketch.json, an index with the plans, the dive points and the coast view's
// drawing, which every load draws, and one file per room in loading-sketch/, so a load fetches only
// the room the visitor arrives in.
//
// The sketch draws the coast view while the house and coast stream in, then the room the visitor
// will arrive in while the rooms, Sirui and the view's programs load (loading-sketch.mjs). So only
// those views are traced: "outside" and every room an activity can open in. For each, the running
// preview (VISUAL_BASE_URL, default Docker on 127.0.0.1:8080) renders three passes with characters,
// wildlife and glass hidden: object IDs, view-space normals and depth. Scene modules and models are
// served from this working tree, so a stale server never feeds the trace. Object outlines, depth
// silhouettes and sharp creases become one-pixel edges, linked into chains, simplified, ordered for
// drawing (the cliff and the house before furniture and plants, long lines before short, each layer
// walked as one hand would draw it) and packed as delta-encoded polylines. The capture uses the
// tablet layout, the widest scene aspect, so narrower canvases only crop the drawing.
const fs = require("node:fs");
const path = require("node:path");
const zlib = require("node:zlib");

const ROOT = path.resolve(__dirname, "..");
const BASE = (process.env.VISUAL_BASE_URL || "http://127.0.0.1:8080").replace(/\/$/, "");
const OUT = path.join(ROOT, "assets/models/home/loading-sketch.json");
const ROOM_DIR = path.join(ROOT, "assets/models/home/loading-sketch");
const CACHE = path.join(ROOT, ".jekyll-cache/visual-qa/loading-sketch");
const REUSE = process.argv.includes("--reuse") || process.argv.includes("--check");
const CHECK = process.argv.includes("--check");
const CAPTURE_ONLY = process.argv.includes("--capture-only");
const RANGE = { u: 1.65, v: 1 };
const MANIFEST = JSON.parse(fs.readFileSync(path.join(ROOT, "assets/models/home/manifest.json"), "utf8"));
const ROOMS = [
  ...new Set(
    Object.values(MANIFEST.activities).flatMap((activity) => [
      activity.room,
      ...(activity.whiskeyStation ? [MANIFEST.furniture.find((a) => a.id === activity.whiskeyStation)?.room].filter(Boolean) : []),
    ])
  ),
].sort();
const VIEWS = ["outside", ...ROOMS];
const LIVE = /pip|companion|wildlife|gull|rabbit|raccoon|seal|lion|sandpiper|neighbou?r|active-Sirui|sirui-/i;
const SEA = /ocean|pacific|sea\b|surf|wave|foam|swash|onsen.*water|water/i;
const TYPES = {
  ".mjs": "text/javascript; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".glb": "model/gltf-binary",
  ".json": "application/json",
};

function injectedController() {
  const source = fs
    .readFileSync(path.join(ROOT, "assets/js/home-scene/controller.mjs"), "utf8")
    .replace(/\r\n/g, "\n")
    .replace(
      "  scene.add(world);\n",
      "  scene.add(world);\n  window.__sketchScene = { scene, world, THREE, get camera() { return camera; }, get renderer() { return renderer; } };\n"
    );
  if (!source.includes("__sketchScene")) throw new Error("controller injection point not found");
  return source;
}

async function capture() {
  const { chromium } = require("playwright");
  const controller = injectedController();
  const browser = await chromium.launch({
    headless: true,
    args: process.platform === "win32" ? ["--use-angle=d3d11", "--ignore-gpu-blocklist"] : [],
  });
  const page = await browser.newPage({ viewport: { width: 768, height: 1024 }, deviceScaleFactor: 1, reducedMotion: "reduce" });
  page.setDefaultTimeout(180000);
  await page.route(/\/assets\/(js\/.+\.m?js|models\/home\/.+\.(glb|json))(\?.*)?$/, (route) => {
    const rel = decodeURIComponent(new URL(route.request().url()).pathname).replace(/^.*?(?=assets\/)/, "");
    if (rel === "assets/js/home-scene/controller.mjs") return route.fulfill({ contentType: TYPES[".mjs"], body: controller });
    const file = path.join(ROOT, rel);
    if (!fs.existsSync(file)) return route.continue();
    return route.fulfill({ contentType: TYPES[path.extname(rel)] || "application/octet-stream", body: fs.readFileSync(file) });
  });
  await page.route("**/livereload.js*", (route) => route.fulfill({ contentType: "application/javascript", body: "" }));
  await page.clock.install({ time: new Date("2026-10-02T13:20:00-07:00") });
  await page.goto(`${BASE}/?scene-lab=1`, { waitUntil: "domcontentloaded" });
  await page.locator('[data-home-desk-mode="3d"]').click();
  const scene = page.locator("[data-home-desk-scene]");
  await scene.scrollIntoViewIfNeeded();
  await page.waitForFunction(() => document.querySelector("[data-home-desk-scene]")?.dataset.sceneState === "ready");
  if (!(await page.evaluate(() => Boolean(window.__sketchScene)))) throw new Error("the injected controller did not load");
  const settle = async () => {
    for (let i = 0; i < 60; i++) {
      await page.clock.runFor(400);
      const e = await scene.evaluate((element) => element.getSceneEvidence());
      if (!e.framePending && e.roomCount === MANIFEST.rooms.length) break;
    }
    await page.clock.runFor(1500);
  };
  await settle();
  await page.locator("[data-world-lab]>summary").click();
  fs.mkdirSync(CACHE, { recursive: true });
  for (const view of VIEWS) {
    await page.locator(`[data-world-room="${view}"]`).first().click();
    await settle();
    const pass = await page.evaluate(
      ({ livePattern, rooms, outside }) => {
        const { scene, world, THREE, camera, renderer } = window.__sketchScene;
        // Where each room the sketch can move into sits in the coast view, in sketch units.
        const focus = {};
        if (outside)
          for (const id of rooms) {
            const root = world.getObjectByName(`room-${id}`);
            if (!root) continue;
            const centre = new THREE.Box3().setFromObject(root).getCenter(new THREE.Vector3()).project(camera);
            focus[id] = { u: +(centre.x * camera.aspect).toFixed(4), v: +(-centre.y).toFixed(4) };
          }
        const live = new RegExp(livePattern, "i");
        const canvas = renderer.domElement,
          width = canvas.width * 2,
          height = canvas.height * 2;
        const target = new THREE.WebGLRenderTarget(width, height);
        const materials = new Map(),
          hidden = [],
          inventory = [];
        const background = scene.background,
          fog = scene.fog,
          tone = renderer.toneMapping;
        let next = 0;
        const chain = (o) => {
          const names = [];
          for (let n = o; n && n !== scene; n = n.parent) if (n.name) names.push(n.name);
          return names;
        };
        // The model or group under the world that holds a mesh: the shell, the coast, a room or furniture.
        const rootOf = (o) => {
          let n = o;
          while (n.parent && n.parent !== world && n.parent !== scene) n = n.parent;
          return n.name || "";
        };
        const animated = (o) => {
          for (let n = o; n; n = n.parent) if (n.isSkinnedMesh || live.test(n.name || "")) return true;
          return false;
        };
        scene.traverse((o) => {
          if (!o.visible) return;
          // The onsen's shadow-only vault and the glass never draw colour on screen, so they are not traced.
          if (o.isMesh && !animated(o) && !o.userData.outline && !o.userData.shadowOnly && !o.userData.glazing) {
            materials.set(o, [o.material, ++next]);
            inventory.push({ id: next, names: chain(o), root: rootOf(o) });
          } else if (o.isMesh || o.isPoints || o.isLine || o.isSprite) hidden.push(o);
        });
        hidden.forEach((o) => (o.visible = false));
        scene.background = null;
        scene.fog = null;
        renderer.toneMapping = THREE.NoToneMapping;
        const read = () => {
          const pixels = new Uint8Array(width * height * 4);
          renderer.setRenderTarget(target);
          renderer.setClearColor(0x000000, 0);
          renderer.clear();
          renderer.render(scene, camera);
          renderer.readRenderTargetPixels(target, 0, 0, width, height, pixels);
          renderer.setRenderTarget(null);
          return pixels;
        };
        const side = (m) => [m].flat()[0]?.side ?? THREE.FrontSide;
        for (const [o, [m, n]] of materials)
          o.material = new THREE.MeshBasicMaterial({
            color: new THREE.Color().setRGB(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255, THREE.LinearSRGBColorSpace),
            side: side(m),
          });
        const ids = read();
        for (const [o, [m]] of materials) o.material = new THREE.MeshNormalMaterial({ side: side(m) });
        const normals = read();
        for (const [o, [m]] of materials) o.material = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, side: side(m) });
        const depth = read();
        for (const [o, [m]] of materials) o.material = m;
        hidden.forEach((o) => (o.visible = true));
        scene.background = background;
        scene.fog = fog;
        renderer.toneMapping = tone;
        target.dispose();
        // Pixels come bottom-up; flip rows so y runs down like the sketch.
        const flip = (pixels) => {
          const out = new Uint8Array(pixels.length),
            row = width * 4;
          for (let y = 0; y < height; y++) out.set(pixels.subarray((height - 1 - y) * row, (height - y) * row), y * row);
          let text = "";
          for (let i = 0; i < out.length; i += 0x8000) text += String.fromCharCode.apply(null, out.subarray(i, i + 0x8000));
          return btoa(text);
        };
        return {
          width,
          height,
          near: camera.near,
          far: camera.far,
          ids: flip(ids),
          normals: flip(normals),
          depth: flip(depth),
          inventory,
          focus,
          camera: { position: camera.position.toArray(), fov: camera.fov, aspect: camera.aspect },
        };
      },
      { livePattern: LIVE.source, rooms: ROOMS, outside: view === "outside" }
    );
    for (const name of ["ids", "normals", "depth"]) fs.writeFileSync(path.join(CACHE, `${view}-${name}.bin`), Buffer.from(pass[name], "base64"));
    const meta = {
      width: pass.width,
      height: pass.height,
      near: pass.near,
      far: pass.far,
      camera: pass.camera,
      focus: pass.focus,
      inventory: pass.inventory,
    };
    fs.writeFileSync(path.join(CACHE, `${view}.json`), JSON.stringify(meta));
    console.log("captured", view, pass.width, pass.height, pass.inventory.length, "meshes");
  }
  await browser.close();
}

// ------------------------------------------------------------------------------------------------
// Tracing

const GRID = 4096;
// The pen's plan: groups of layers in drawing order, each drawn only as far as the loading segment
// that brings it has finished, and only once every earlier group is complete. The coast view is
// drawn while the house, then the coast, then the rooms stream in; a room view while the rooms load
// and then while the view's programs compile, so its finest detail arrives last.
const PLAN = {
  outside: [
    ["house", ["shell", "stairs", "plants"]],
    ["coast", ["cliff", "sea"]],
    ["room", ["furniture", "detail"]],
  ],
  room: [
    ["room", ["shell", "stairs", "cliff", "sea", "furniture", "plants"]],
    ["view", ["detail"]],
  ],
};
const LAYERS = Object.fromEntries(Object.entries(PLAN).map(([kind, groups]) => [kind, groups.flatMap(([, layers]) => layers)]));
// Above this share of a room view, a room material is its architecture (walls, floors, ceilings).
const STRUCTURE_SHARE = 0.05;
const KIND = { crease: 0, silhouette: 1, material: 2, outline: 3 };

function classify(names, root) {
  const text = names.join(" ");
  if (root === "Pacific environment" || /sky|ocean|pacific|infinity_water|\bwater\b|onsen.*water/i.test(text)) return "sea";
  if (/agave|plant|flora|leaf|palm|fern|succulent|grass|meadow|moss|vine|hedge|shrub|tree|bougainvillea|lavender/i.test(text)) return "plants";
  if (/spiral|stair|ladder|\bstep/i.test(text)) return "stairs";
  if (/coast_|mainland|cliff|beach|bluff|\brock|boulder|headland/i.test(text)) return "cliff";
  if (/textile|linen|cloth|paper|book|cork|screen|device|laptop|cushion|throw|towel|rug|pellicle|cable|keyboard|boucle|sketch/i.test(text))
    return "detail";
  if (/^room-/.test(root) || !/^Scene$/.test(root)) return "furniture";
  return "shell";
}

function decodePass(view) {
  const meta = JSON.parse(fs.readFileSync(path.join(CACHE, `${view}.json`), "utf8"));
  const { width, height, near, far } = meta,
    size = width * height;
  const ids = fs.readFileSync(path.join(CACHE, `${view}-ids.bin`)),
    normals = fs.readFileSync(path.join(CACHE, `${view}-normals.bin`)),
    packed = fs.readFileSync(path.join(CACHE, `${view}-depth.bin`));
  const id = new Int32Array(size),
    normal = new Float32Array(size * 3),
    depth = new Float32Array(size);
  for (let i = 0; i < size; i++) {
    const q = i * 4;
    id[i] = (ids[q] << 16) | (ids[q + 1] << 8) | ids[q + 2];
    let nx = normals[q] / 127.5 - 1,
      ny = normals[q + 1] / 127.5 - 1,
      nz = normals[q + 2] / 127.5 - 1;
    const length = Math.hypot(nx, ny, nz) || 1;
    normal[i * 3] = nx / length;
    normal[i * 3 + 1] = ny / length;
    normal[i * 3 + 2] = nz / length;
    // three r164 RGBADepthPacking: the most significant byte is alpha.
    const d = packed[q + 3] / 256 + packed[q + 2] / 65536 + packed[q + 1] / 16777216 + packed[q] / 4294967296;
    depth[i] = id[i] ? (2 * near * far) / (far + near - (2 * d - 1) * (far - near)) : Infinity;
  }
  const area = new Map();
  for (let i = 0; i < size; i++) area.set(id[i], (area.get(id[i]) || 0) + 1);
  const categories = new Map([[0, "background"]]);
  for (const entry of meta.inventory) {
    let category = classify(entry.names, entry.root);
    // Rooms are merged by material, so their walls and floors arrive as "furniture": the largest
    // surfaces of a room view are its architecture.
    if (view !== "outside" && category === "furniture" && (area.get(entry.id) || 0) > STRUCTURE_SHARE * size) category = "shell";
    categories.set(entry.id, category);
  }
  return { width, height, id, normal, depth, categories, meta };
}

// One-pixel edges on the nearer side of every discontinuity: outlines where the visible object
// changes (strongest where depth also jumps), silhouettes where one surface passes behind itself,
// and creases where normals part by more than 40 degrees (60 on the cliff's bedding; never on the
// sea, whose waves would hatch every pixel).
function edgeMap(pass) {
  const { width, height, id, normal, depth, categories } = pass,
    size = width * height,
    kind = new Int8Array(size).fill(-1);
  const mark = (i, k) => {
    if (k > kind[i]) kind[i] = k;
  };
  const crease = (i) => (categories.get(id[i]) === "cliff" ? 0.5 : 0.766);
  for (let y = 1; y < height - 1; y++)
    for (let x = 1; x < width - 1; x++) {
      const a = y * width + x;
      for (const step of [1, width]) {
        const b = a + step;
        if (!id[a] && !id[b]) continue;
        if (id[a] !== id[b]) {
          if (!id[a] || !id[b]) {
            mark(id[a] ? a : b, KIND.outline);
            continue;
          }
          const near = depth[a] <= depth[b] ? a : b,
            gap = Math.abs(depth[a] - depth[b]) / Math.min(depth[a], depth[b]);
          mark(near, gap > 0.03 ? KIND.outline : KIND.material);
          continue;
        }
        const category = categories.get(id[a]);
        if (category === "sea") continue;
        // A gap far beyond the surface's own slope (measured on the far side) is a fold behind.
        const before = a - step,
          slope = Math.abs(depth[a] - depth[before]),
          gap = Math.abs(depth[a] - depth[b]);
        if (gap > 0.025 * Math.min(depth[a], depth[b]) && gap > 4 * slope + 0.002) {
          mark(depth[a] <= depth[b] ? a : b, KIND.silhouette);
          continue;
        }
        const dot = normal[a * 3] * normal[b * 3] + normal[a * 3 + 1] * normal[b * 3 + 1] + normal[a * 3 + 2] * normal[b * 3 + 2];
        if (dot < crease(a)) mark(a, KIND.crease);
      }
    }
  return kind;
}

// Zhang-Suen thinning of one category's edge pixels, so chains are one pixel wide.
function thin(mask, width, height) {
  let points = [];
  for (let i = 0; i < mask.length; i++) if (mask[i]) points.push(i);
  for (let changed = true; changed; ) {
    changed = false;
    for (const pass of [0, 1]) {
      const remove = [];
      for (const i of points) {
        const x = i % width,
          y = (i / width) | 0;
        if (x < 1 || y < 1 || x >= width - 1 || y >= height - 1) continue;
        const n = mask[i - width],
          ne = mask[i - width + 1],
          e = mask[i + 1],
          se = mask[i + width + 1],
          s = mask[i + width],
          sw = mask[i + width - 1],
          w = mask[i - 1],
          nw = mask[i - width - 1];
        const count = n + ne + e + se + s + sw + w + nw;
        if (count < 2 || count > 6) continue;
        const transitions = (!n && ne) + (!ne && e) + (!e && se) + (!se && s) + (!s && sw) + (!sw && w) + (!w && nw) + (!nw && n);
        if (transitions !== 1) continue;
        if (pass === 0 ? (n && e && s) || (e && s && w) : (n && e && w) || (n && s && w)) continue;
        remove.push(i);
      }
      for (const i of remove) mask[i] = 0;
      if (remove.length) {
        changed = true;
        points = points.filter((i) => mask[i]);
      }
    }
  }
  return mask;
}

const NEIGHBOURS = [
  [1, 0],
  [0, 1],
  [-1, 0],
  [0, -1],
  [1, 1],
  [-1, 1],
  [-1, -1],
  [1, -1],
];

// Chains of 8-connected pixels between endpoints and junctions, then closed loops.
function chains(mask, width, height) {
  const degree = new Uint8Array(width * height),
    used = new Uint8Array(width * height),
    out = [];
  const neighbours = (i) => {
    const x = i % width,
      y = (i / width) | 0,
      list = [];
    for (const [dx, dy] of NEIGHBOURS) {
      const nx = x + dx,
        ny = y + dy;
      if (nx >= 0 && ny >= 0 && nx < width && ny < height && mask[ny * width + nx]) list.push(ny * width + nx);
    }
    return list;
  };
  for (let i = 0; i < mask.length; i++) if (mask[i]) degree[i] = neighbours(i).length;
  const node = (i) => degree[i] !== 2;
  // From a node through one neighbour along plain pixels until the next node.
  const walk = (start, first) => {
    const line = [start, first];
    let previous = start,
      current = first;
    while (!node(current)) {
      used[current] = 1;
      const next = neighbours(current).find((n) => n !== previous && (node(n) || !used[n]));
      if (next === undefined) break;
      line.push(next);
      previous = current;
      current = next;
    }
    return line;
  };
  for (let i = 0; i < mask.length; i++) {
    if (!mask[i] || !node(i)) continue;
    for (const n of neighbours(i)) {
      if (node(n)) {
        if (n > i) out.push([i, n]);
      } else if (!used[n]) out.push(walk(i, n));
    }
  }
  // What is left are closed loops of plain pixels.
  for (let i = 0; i < mask.length; i++) {
    if (!mask[i] || used[i]) continue;
    used[i] = 1;
    const line = [i];
    let previous = i,
      current = neighbours(i)[0];
    while (current !== undefined && !used[current]) {
      used[current] = 1;
      line.push(current);
      const next = neighbours(current).find((n) => n !== previous && !used[n]);
      previous = current;
      current = next;
    }
    line.push(i);
    if (line.length > 2) out.push(line);
  }
  return out;
}

function simplify(points, epsilon) {
  if (points.length <= 2) return points;
  const keep = new Uint8Array(points.length);
  keep[0] = keep[points.length - 1] = 1;
  const stack = [[0, points.length - 1]];
  while (stack.length) {
    const [first, last] = stack.pop();
    const [ax, ay] = points[first],
      [bx, by] = points[last],
      dx = bx - ax,
      dy = by - ay,
      length = Math.hypot(dx, dy) || 1;
    let worst = 0,
      at = -1;
    for (let k = first + 1; k < last; k++) {
      const distance = Math.abs((points[k][0] - ax) * dy - (points[k][1] - ay) * dx) / length;
      if (distance > worst) [worst, at] = [distance, k];
    }
    if (worst > epsilon) {
      keep[at] = 1;
      stack.push([first, at], [at, last]);
    }
  }
  return points.filter((_, k) => keep[k]);
}

const lengthOf = (points) => points.reduce((sum, p, k) => (k ? sum + Math.hypot(p[0] - points[k - 1][0], p[1] - points[k - 1][1]) : 0), 0);

// One Chaikin pass: organic lines (the cliff's bedding, leaves, the shore) lose the pixel stairs
// of their trace, while the house keeps its corners.
function smooth(points) {
  if (points.length < 3) return points;
  const out = [points[0]];
  for (let k = 0; k < points.length - 1; k++) {
    const [ax, ay] = points[k],
      [bx, by] = points[k + 1];
    out.push([0.75 * ax + 0.25 * bx, 0.75 * ay + 0.25 * by], [0.25 * ax + 0.75 * bx, 0.25 * ay + 0.75 * by]);
  }
  out.push(points.at(-1));
  return out;
}
const ORGANIC = new Set(["cliff", "plants", "sea"]);

// Join chains that continue each other through a junction, so the pen draws whole lines.
function mergeChains(lines) {
  const end = (line, tail) => (tail ? line.points.at(-1) : line.points[0]),
    direction = (line, tail) => {
      const p = line.points,
        a = tail ? p.at(-1) : p[0],
        b = tail ? p[Math.max(0, p.length - 4)] : p[Math.min(p.length - 1, 3)];
      const length = Math.hypot(a[0] - b[0], a[1] - b[1]) || 1;
      return [(a[0] - b[0]) / length, (a[1] - b[1]) / length];
    };
  let merged = true;
  while (merged) {
    merged = false;
    const index = new Map();
    lines.forEach((line, k) => {
      for (const tail of [false, true]) {
        const [x, y] = end(line, tail),
          key = `${Math.round(x / 3)},${Math.round(y / 3)}`;
        if (!index.has(key)) index.set(key, []);
        index.get(key).push([k, tail]);
      }
    });
    const gone = new Set();
    for (const entries of index.values()) {
      if (entries.length < 2) continue;
      for (let i = 0; i < entries.length; i++)
        for (let j = i + 1; j < entries.length; j++) {
          const [a, at] = entries[i],
            [b, bt] = entries[j];
          if (a === b || gone.has(a) || gone.has(b) || lines[a].category !== lines[b].category) continue;
          const [ax, ay] = direction(lines[a], at),
            [bx, by] = direction(lines[b], bt);
          // Continuing lines leave the junction in opposite directions.
          if (ax * bx + ay * by > -0.87) continue;
          const first = at ? lines[a].points : [...lines[a].points].reverse(),
            second = bt ? [...lines[b].points].reverse() : lines[b].points;
          lines[a] = { ...lines[a], points: [...first, ...second.slice(1)], kind: Math.max(lines[a].kind, lines[b].kind) };
          gone.add(b);
          merged = true;
        }
    }
    lines = lines.filter((_, k) => !gone.has(k));
  }
  return lines;
}

// Long lines before short within each layer, each tier walked nearest-first like one hand drawing.
function orderLayer(lines, start) {
  const tiers = [lines.filter((l) => l.length >= 60), lines.filter((l) => l.length >= 18 && l.length < 60), lines.filter((l) => l.length < 18)];
  const out = [];
  let pen = start;
  for (const tier of tiers) {
    const left = new Set(tier.map((_, k) => k));
    while (left.size) {
      let best = -1,
        flip = false,
        nearest = Infinity;
      for (const k of left) {
        const p = tier[k].points,
          first = Math.hypot(p[0][0] - pen[0], p[0][1] - pen[1]),
          last = Math.hypot(p.at(-1)[0] - pen[0], p.at(-1)[1] - pen[1]);
        // A long line is worth a longer reach: prefer it slightly over a nearer scrap.
        const cost = Math.min(first, last) - 0.15 * tier[k].length;
        if (cost < nearest) [nearest, best, flip] = [cost, k, last < first];
      }
      const line = tier[best];
      if (flip) line.points.reverse();
      out.push(line);
      pen = line.points.at(-1);
      left.delete(best);
    }
  }
  return { lines: out, pen };
}

function varint(bytes, value) {
  while (value > 127) {
    bytes.push((value & 127) | 128);
    value >>>= 7;
  }
  bytes.push(value);
}
const zigzag = (n) => (n << 1) ^ (n >> 31);

function encode(lines) {
  const bytes = [];
  let points = 0;
  for (const line of lines) {
    const grid = [];
    for (const [u, v] of line.uv) {
      const p = [Math.round(((u + RANGE.u) / (2 * RANGE.u)) * (GRID - 1)), Math.round(((v + RANGE.v) / (2 * RANGE.v)) * (GRID - 1))];
      if (!grid.length || p[0] !== grid.at(-1)[0] || p[1] !== grid.at(-1)[1]) grid.push(p);
    }
    if (grid.length < 2) continue;
    bytes.push((line.layer << 4) | (line.weight << 2) | Math.min(3, line.kind));
    varint(bytes, grid.length);
    bytes.push(grid[0][0] & 255, grid[0][0] >> 8, grid[0][1] & 255, grid[0][1] >> 8);
    for (let k = 1; k < grid.length; k++) {
      varint(bytes, zigzag(grid[k][0] - grid[k - 1][0]));
      varint(bytes, zigzag(grid[k][1] - grid[k - 1][1]));
    }
    points += grid.length;
  }
  return { bytes: Buffer.from(bytes), points };
}

function traceView(view, budget) {
  const pass = decodePass(view),
    { width, height, id, categories } = pass,
    kinds = edgeMap(pass),
    layers = LAYERS[view === "outside" ? "outside" : "room"],
    cx = width / 2,
    cy = height / 2;
  let lines = [];
  for (const category of layers) {
    const mask = new Uint8Array(width * height);
    for (let i = 0; i < mask.length; i++) if (kinds[i] >= 0 && categories.get(id[i]) === category) mask[i] = 1;
    thin(mask, width, height);
    for (const pixels of chains(mask, width, height)) {
      const points = pixels.map((i) => [i % width, (i / width) | 0]);
      let kind = 0;
      for (const i of pixels) kind = Math.max(kind, kinds[i]);
      lines.push({ category, points, kind });
    }
  }
  lines = mergeChains(lines).map((line) => {
    const organic = ORGANIC.has(line.category),
      points = organic ? simplify(smooth(simplify(line.points, 0.9)), 0.45) : simplify(line.points, 0.9);
    return { ...line, points, length: lengthOf(points) };
  });
  const inside = (p) => Math.abs((p[0] - cx) / cy) <= RANGE.u && Math.abs((p[1] - cy) / cy) <= 0.99;
  lines = lines.filter((line) => line.length >= 5 && line.points.some(inside));
  // Fit the budget by dropping the shortest lines of the latest layers first.
  let total = lines.reduce((sum, l) => sum + l.points.length, 0);
  if (total > budget) {
    const ranked = [...lines].sort((a, b) => layers.indexOf(b.category) - layers.indexOf(a.category) || a.length - b.length);
    const drop = new Set();
    for (const line of ranked) {
      if (total <= budget) break;
      drop.add(line);
      total -= line.points.length;
    }
    lines = lines.filter((line) => !drop.has(line));
  }
  let pen = [0, 0];
  const ordered = [];
  layers.forEach((category, layer) => {
    const result = orderLayer(
      lines.filter((l) => l.category === category),
      pen
    );
    pen = result.pen;
    for (const line of result.lines) {
      // Weight: bold outlines of the structure, finer creases and detail.
      const structure = ["cliff", "shell", "stairs"].includes(category),
        weight = line.kind >= KIND.material ? (structure ? 3 : 2) : line.kind === KIND.silhouette ? 2 : category === "detail" ? 0 : 1;
      ordered.push({ ...line, layer, weight, uv: line.points.map(([x, y]) => [(x - cx) / cy, (y - cy) / cy]) });
    }
  });
  const encoded = encode(ordered);
  const counts = {};
  for (const line of ordered) counts[line.category] = (counts[line.category] || 0) + 1;
  return {
    ...encoded,
    count: ordered.length,
    ink: +ordered.reduce((sum, l) => sum + l.length / cy, 0).toFixed(2),
    counts,
    aspect: +(width / height).toFixed(3),
  };
}

// Every file the trace produces, by absolute path: the index with the coast view inline, and one
// file per room that the index names.
function sketchFiles() {
  const views = {},
    rooms = new Map(),
    report = {};
  for (const view of VIEWS) {
    const result = traceView(view, view === "outside" ? 26000 : 22000),
      strokes = result.bytes.toString("base64"),
      summary = { count: result.count, points: result.points, ink: result.ink };
    if (view === "outside") views[view] = { strokes, ...summary };
    else {
      const file = `loading-sketch/${view}.json`;
      views[view] = { file, ...summary };
      rooms.set(path.join(path.dirname(OUT), file), { view, strokes });
    }
    report[view] = { aspect: result.aspect, bytes: result.bytes.length, layers: result.counts };
    console.log(
      view,
      JSON.stringify({ strokes: result.count, points: result.points, bytes: result.bytes.length, ink: result.ink, layers: result.counts })
    );
  }
  const focus = JSON.parse(fs.readFileSync(path.join(CACHE, "outside.json"), "utf8")).focus || {};
  const plan = Object.fromEntries(
    Object.entries(PLAN).map(([kind, groups]) => [kind, groups.map(([segment, layers]) => `${segment}:${layers.join(",")}`).join(" ")])
  );
  const index = { version: 3, generator: "bin/build_loading_sketch.cjs", range: RANGE, grid: GRID, plan, views, focus, report };
  // Objects and strings only, indented as Prettier formats JSON, so every file passes the format check.
  const text = (value) => JSON.stringify(value, null, 2) + "\n";
  return new Map([[OUT, text(index)], ...[...rooms].map(([file, room]) => [file, text(room)])]);
}

function writeSketch({ check = false } = {}) {
  const files = sketchFiles(),
    stale = fs.existsSync(ROOM_DIR)
      ? fs
          .readdirSync(ROOM_DIR)
          .filter((name) => name.endsWith(".json"))
          .map((name) => path.join(ROOM_DIR, name))
          .filter((file) => !files.has(file))
      : [];
  if (check) {
    const changed = [...files].filter(([file, text]) => !fs.existsSync(file) || fs.readFileSync(file, "utf8").replace(/\r\n/g, "\n") !== text);
    const wrong = [...changed.map(([file]) => file), ...stale].map((file) => path.relative(ROOT, file));
    if (wrong.length) throw new Error(`${wrong.join(", ")}: not the trace of the cached passes; rerun bin/build_loading_sketch.cjs`);
    console.log("loading-sketch.json and its room drawings match the cached passes");
    return;
  }
  fs.mkdirSync(ROOM_DIR, { recursive: true });
  for (const file of stale) fs.rmSync(file);
  const gzipped = new Map();
  for (const [file, text] of files) {
    fs.writeFileSync(file, text);
    gzipped.set(file, zlib.gzipSync(text, { level: 9 }).length);
    console.log("wrote", path.relative(ROOT, file), Buffer.byteLength(text), "bytes,", gzipped.get(file), "gzipped");
  }
  const largest = Math.max(...[...gzipped].filter(([file]) => file !== OUT).map(([, size]) => size));
  console.log("a load fetches at most", gzipped.get(OUT) + largest, "gzipped bytes: the index and its largest room");
}

module.exports = { VIEWS, RANGE, CACHE, OUT, GRID, LAYERS, classify, simplify, encode, thin, chains, mergeChains, orderLayer, zigzag };

if (require.main === module)
  (async () => {
    if (!REUSE) await capture();
    if (CAPTURE_ONLY) return;
    writeSketch({ check: CHECK });
  })().catch((error) => {
    console.error(error);
    process.exit(1);
  });
