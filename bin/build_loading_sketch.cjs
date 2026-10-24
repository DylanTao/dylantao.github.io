// Trace the loading sketch's drawings from the 3D home's own authored views.
//
// Renders each view's object-ID and surface-normal passes in the running preview (Docker on
// 127.0.0.1:8080, or VISUAL_BASE_URL), turns object outlines and sharp creases into short pen
// strokes, and writes assets/models/home/loading-sketch.json for loading-sketch.mjs. The capture
// uses the tablet layout, the widest scene aspect, so narrower canvases only crop the drawing.
// Characters, Pip and the wildlife are left out: the live first frame supplies whoever is home.
//
//   node bin/build_loading_sketch.cjs            (capture, then trace)
//   node bin/build_loading_sketch.cjs --reuse    (re-trace the cached passes)
const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require("playwright");

const ROOT = path.resolve(__dirname, "..");
const BASE = process.env.VISUAL_BASE_URL || "http://127.0.0.1:8080";
const OUT = path.join(ROOT, "assets/models/home/loading-sketch.json");
const CACHE = path.join(ROOT, ".jekyll-cache/visual-qa/loading-sketch");
const REUSE = process.argv.includes("--reuse");
const RANGE = { u: 1.65, v: 1 };
const STROKES = 1400;
const MANIFEST = JSON.parse(fs.readFileSync(path.join(ROOT, "assets/models/home/manifest.json"), "utf8"));
const VIEWS = ["outside", "overview", ...MANIFEST.rooms.map((room) => room.id)];
const LIVE = /pip|companion|wildlife|gull|rabbit|raccoon|seal|lion|sandpiper|neighbou?r/i;
const SEA = /ocean|pacific|sea\b|surf|wave|foam|swash|onsen.*water|water/i;

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Pen strokes from an object-ID pass and a normal pass. Outlines carry the drawing, weighted by
// how much of the frame each object fills, so a wall or the cliff reads before a cup or a leaf;
// creases count where normals part by more than about 57 degrees (never on the sea, whose waves
// would hatch every pixel). Each weight is scaled by the structure tensor's coherence, which
// favours long, straight runs over clutter, and stronger lines get denser strokes.
function strokesFrom({ width, height, ids, normals, sea }, limit, seed) {
  const random = mulberry32(seed);
  const size = width * height,
    idAt = new Int32Array(size),
    area = new Map();
  for (let i = 0; i < size; i++) {
    idAt[i] = (ids[i * 4] << 16) | (ids[i * 4 + 1] << 8) | ids[i * 4 + 2];
    area.set(idAt[i], (area.get(idAt[i]) || 0) + 1);
  }
  // Small objects are clutter; the creases inside very large ones (the cliff's bedding, broad
  // floors) are texture rather than form, so both are drawn lightly.
  const clutter = size * 0.004,
    presence = (id) => (id === 0 ? 1 : Math.min(1, Math.sqrt(area.get(id) / clutter))),
    creaseScale = (id) => (area.get(id) > size * 0.15 ? 0.3 : 1);
  const normal = (i) => [normals[i * 4] / 127.5 - 1, normals[i * 4 + 1] / 127.5 - 1, normals[i * 4 + 2] / 127.5 - 1];
  const edge = new Float32Array(size);
  for (let y = 1; y < height - 1; y++)
    for (let x = 1; x < width - 1; x++) {
      const i = y * width + x,
        here = idAt[i];
      let strength = 0;
      for (const j of [i + 1, i + width]) {
        const there = idAt[j];
        if (there !== here) {
          const outline = here && there ? 0.9 * Math.min(presence(here), presence(there)) : Math.max(presence(here), presence(there));
          strength = Math.max(strength, outline);
          continue;
        }
        if (!here || sea.has(here)) continue;
        const [ax, ay, az] = normal(i),
          [bx, by, bz] = normal(j);
        const dot = (ax * bx + ay * by + az * bz) / Math.max(1e-6, Math.hypot(ax, ay, az) * Math.hypot(bx, by, bz));
        if (dot < 0.55) strength = Math.max(strength, 0.45 * presence(here) * creaseScale(here) * Math.min(1, (0.55 - dot) * 3));
      }
      edge[i] = strength;
    }
  // Box blur by running sums, separable.
  const blur = (source, radius) => {
    const out = new Float32Array(size),
      tmp = new Float32Array(size),
      span = 2 * radius + 1;
    for (let y = 0; y < height; y++) {
      let sum = 0;
      for (let x = -radius; x <= radius; x++) sum += source[y * width + Math.min(width - 1, Math.max(0, x))];
      for (let x = 0; x < width; x++) {
        tmp[y * width + x] = sum / span;
        sum += source[y * width + Math.min(width - 1, x + radius + 1)] - source[y * width + Math.max(0, x - radius)];
      }
    }
    for (let x = 0; x < width; x++) {
      let sum = 0;
      for (let y = -radius; y <= radius; y++) sum += tmp[Math.min(height - 1, Math.max(0, y)) * width + x];
      for (let y = 0; y < height; y++) {
        out[y * width + x] = sum / span;
        sum += tmp[Math.min(height - 1, y + radius + 1) * width + x] - tmp[Math.max(0, y - radius) * width + x];
      }
    }
    return out;
  };
  // Structure tensor of the softened edge map over a 9 x 9 window.
  const soft = blur(edge, 1),
    jxx = new Float32Array(size),
    jxy = new Float32Array(size),
    jyy = new Float32Array(size);
  for (let y = 1; y < height - 1; y++)
    for (let x = 1; x < width - 1; x++) {
      const i = y * width + x,
        gx = soft[i + 1] - soft[i - 1],
        gy = soft[i + width] - soft[i - width];
      jxx[i] = gx * gx;
      jxy[i] = gx * gy;
      jyy[i] = gy * gy;
    }
  const sxx = blur(jxx, 4),
    sxy = blur(jxy, 4),
    syy = blur(jyy, 4);
  const cx = width / 2,
    cy = height / 2,
    candidates = [];
  for (let y = 2; y < height - 2; y++)
    for (let x = 2; x < width - 2; x++) {
      const i = y * width + x;
      if (edge[i] < 0.08) continue;
      const u = (x - cx) / cy,
        v = (y - cy) / cy;
      if (Math.abs(u) > RANGE.u || Math.abs(v) > 0.98) continue;
      const trace = sxx[i] + syy[i],
        spread = Math.sqrt((sxx[i] - syy[i]) ** 2 + 4 * sxy[i] ** 2),
        coherence = trace > 1e-9 ? (spread / trace) ** 2 : 0,
        weight = edge[i] * (0.25 + 0.75 * coherence);
      if (weight < 0.06) continue;
      // The stroke runs along the line, perpendicular to the dominant gradient.
      const across = 0.5 * Math.atan2(2 * sxy[i], sxx[i] - syy[i]);
      candidates.push([Math.pow(random(), 1 / (weight * weight)), x, y, across + Math.PI / 2, weight]);
    }
  candidates.sort((a, b) => b[0] - a[0]);
  let base = Math.max(2, Math.sqrt(candidates.length / limit) * 1.6),
    out = [];
  for (let attempt = 0; attempt < 8; attempt++) {
    const cell = base * 1.6,
      columns = Math.ceil(width / cell) + 1,
      grid = new Map();
    out = [];
    for (const [, x, y, angle, weight] of candidates) {
      if (out.length >= limit) break;
      const spacing = base * (1.6 - 0.8 * weight),
        gx = Math.floor(x / cell),
        gy = Math.floor(y / cell);
      let clear = true;
      for (let oy = -1; oy <= 1 && clear; oy++)
        for (let ox = -1; ox <= 1 && clear; ox++)
          for (const [nx, ny] of grid.get((gy + oy) * columns + gx + ox) || [])
            if ((nx - x) ** 2 + (ny - y) ** 2 < spacing * spacing) {
              clear = false;
              break;
            }
      if (!clear) continue;
      const key = gy * columns + gx;
      if (!grid.has(key)) grid.set(key, []);
      grid.get(key).push([x, y]);
      out.push([(x - cx) / cy, (y - cy) / cy, ((angle % Math.PI) + Math.PI) % Math.PI]);
    }
    if (out.length >= limit * 0.97) break;
    base *= 0.85;
  }
  // A seeded shuffle, so any prefix of the list is an even subsample for smaller canvases.
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  const bytes = Buffer.alloc(out.length * 3);
  out.forEach(([u, v, a], n) => {
    bytes[n * 3] = Math.round(((u + RANGE.u) / (2 * RANGE.u)) * 255);
    bytes[n * 3 + 1] = Math.round(((v + RANGE.v) / (2 * RANGE.v)) * 255);
    bytes[n * 3 + 2] = Math.min(255, Math.floor((a / Math.PI) * 256));
  });
  return { bytes, count: out.length, edgePixels: candidates.length };
}

async function capture() {
  const source = fs
    .readFileSync(path.join(ROOT, "assets/js/home-scene/controller.mjs"), "utf8")
    .replace(/\r\n/g, "\n")
    .replace(
      "  scene.add(world);\n",
      "  scene.add(world);\n  window.__sketchScene = { scene, THREE, get camera() { return camera; }, get renderer() { return renderer; } };\n"
    );
  if (!source.includes("__sketchScene")) throw new Error("controller injection point not found");
  const browser = await chromium.launch({
    headless: true,
    args: process.platform === "win32" ? ["--use-angle=d3d11", "--ignore-gpu-blocklist"] : [],
  });
  const page = await browser.newPage({ viewport: { width: 768, height: 1024 }, deviceScaleFactor: 1, reducedMotion: "reduce" });
  page.setDefaultTimeout(90000);
  await page.route("**/home-scene/controller.mjs", (route) => route.fulfill({ contentType: "text/javascript", body: source }));
  await page.route("**/livereload.js*", (route) => route.fulfill({ contentType: "application/javascript", body: "" }));
  await page.clock.install({ time: new Date("2026-10-02T13:20:00-07:00") });
  await page.goto(`${BASE}/?scene-lab=1`, { waitUntil: "domcontentloaded" });
  await page.locator('[data-home-desk-mode="3d"]').click();
  const scene = page.locator("[data-home-desk-scene]");
  await scene.scrollIntoViewIfNeeded();
  await page.waitForFunction(() => document.querySelector("[data-home-desk-scene]")?.dataset.sceneState === "ready");
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
      ({ livePattern, seaPattern }) => {
        const { scene, THREE, camera, renderer } = window.__sketchScene;
        const live = new RegExp(livePattern, "i"),
          sea = new RegExp(seaPattern, "i");
        const canvas = renderer.domElement,
          width = canvas.width * 2,
          height = canvas.height * 2;
        const target = new THREE.WebGLRenderTarget(width, height);
        const materials = new Map(),
          hidden = [],
          seaIds = [];
        const background = scene.background,
          fog = scene.fog,
          tone = renderer.toneMapping;
        let next = 0;
        const named = (o) => {
          for (let n = o; n; n = n.parent) if (n.name) return n.name;
          return "";
        };
        const animated = (o) => {
          for (let n = o; n; n = n.parent) if (n.isSkinnedMesh || live.test(n.name || "")) return true;
          return false;
        };
        scene.traverse((o) => {
          if (!o.visible) return;
          // The onsen's shadow-only vault and the glass never draw colour on screen, so they are not traced.
          if (o.isMesh && !animated(o) && !o.userData.outline && !o.userData.shadowOnly && !o.userData.glazing)
            materials.set(o, [o.material, ++next]);
          else if (o.isMesh || o.isPoints || o.isLine || o.isSprite) hidden.push(o);
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
        for (const [o, [m, n]] of materials) {
          o.material = new THREE.MeshBasicMaterial({
            color: new THREE.Color().setRGB(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255, THREE.LinearSRGBColorSpace),
            side: side(m),
          });
          if (sea.test(named(o))) seaIds.push(n);
        }
        const ids = read();
        for (const [o, [m]] of materials) o.material = new THREE.MeshNormalMaterial({ side: side(m) });
        const normals = read();
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
        return { width, height, ids: flip(ids), normals: flip(normals), sea: seaIds, meshes: materials.size };
      },
      { livePattern: LIVE.source, seaPattern: SEA.source }
    );
    fs.writeFileSync(path.join(CACHE, `${view}-ids.bin`), Buffer.from(pass.ids, "base64"));
    fs.writeFileSync(path.join(CACHE, `${view}-normals.bin`), Buffer.from(pass.normals, "base64"));
    fs.writeFileSync(
      path.join(CACHE, `${view}.json`),
      JSON.stringify({ width: pass.width, height: pass.height, sea: pass.sea, meshes: pass.meshes })
    );
    console.log("captured", view, pass.width, pass.height, pass.meshes, "meshes");
  }
  await browser.close();
}

(async () => {
  if (!REUSE) await capture();
  const views = {},
    report = {};
  for (const view of VIEWS) {
    const pass = JSON.parse(fs.readFileSync(path.join(CACHE, `${view}.json`), "utf8"));
    pass.ids = fs.readFileSync(path.join(CACHE, `${view}-ids.bin`));
    pass.normals = fs.readFileSync(path.join(CACHE, `${view}-normals.bin`));
    const result = strokesFrom({ ...pass, sea: new Set(pass.sea) }, STROKES, 20261014 + VIEWS.indexOf(view));
    views[view] = result.bytes.toString("base64");
    report[view] = { strokes: result.count, edgePixels: result.edgePixels, meshes: pass.meshes, aspect: +(pass.width / pass.height).toFixed(3) };
    console.log(view, JSON.stringify(report[view]));
  }
  // Indented as Prettier formats JSON, so the generated file passes the repository's format check.
  fs.writeFileSync(OUT, JSON.stringify({ version: 1, generator: "bin/build_loading_sketch.cjs", range: RANGE, views, report }, null, 2) + "\n");
  console.log("wrote", path.relative(ROOT, OUT), fs.statSync(OUT).size, "bytes");
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
