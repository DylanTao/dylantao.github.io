const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { createHash } = require("node:crypto");
const { chromium } = require("playwright");
const repo = path.resolve(__dirname, "..");
const requested = Object.fromEntries(
  process.argv.slice(2).map((arg) => {
    const at = arg.indexOf("=");
    if (!arg.startsWith("--") || at < 3) throw Error("Use --url=URL --out=DIR [--models=DIR] [--modules=DIR] [--eye=standing]");
    return [arg.slice(2, at), arg.slice(at + 1)];
  })
);
if (!requested.url || !requested.out) throw Error("Supply --url and --out.");
const root = new URL(requested.url);
root.searchParams.set("scene-lab", "1");
root.searchParams.set("weather", "clear");
root.searchParams.set("surf", "1");
const digest = (bytes) => createHash("sha256").update(bytes).digest("hex");
const settings = JSON.parse(fs.readFileSync(path.join(repo, "docs/sea/shore-study/preset.json"), "utf8")).capture;
const shotName = requested.eye || "standing";
const shot = settings[shotName];
if (!shot) throw Error("Unknown shore eye " + shotName);
const out = path.resolve(requested.out);
const models = requested.models && path.resolve(requested.models);
const modules = requested.modules && path.resolve(requested.modules);
const toWorld = ([x, y, z]) => [x, z, -y];
const eye = toWorld(shot.originNative),
  dir = toWorld(shot.directionNative);
const radius = 8,
  target = eye.map((p, i) => p + dir[i] * radius);
const view = { target, yaw: Math.atan2(-dir[0], -dir[2]), pitch: Math.asin(-dir[1]), radius, fov: shot.verticalFov, free: true };
const host = "[data-home-desk-scene]";
const add = (array, lo, hi, step) => {
  for (let x = lo; x < hi - 1e-8; x += step) array.push(+x.toFixed(5));
};
let xs = [],
  zs = [];
add(xs, -198, -28, 4.8);
add(xs, -28, -17, 1.1);
add(xs, -17, 34, 0.22);
add(xs, 34, 74, 0.78);
add(xs, 74, 200, 3.75);
xs.push(200);
add(zs, -220, -84, 4.1);
add(zs, -84, -38, 1.05);
add(zs, -38, -9.9, 0.21);
add(zs, -9.9, -5, 0.57);
zs.push(-5);

async function main() {
  fs.mkdirSync(out, { recursive: true });
  const served = {},
    errors = [],
    sources = [];
  const browser = await chromium.launch({ headless: true, args: ["--use-angle=d3d11", "--ignore-gpu-blocklist"] });
  try {
    const [width, height] = settings.viewport;
    const page = await browser.newPage({
      viewport: { width, height },
      deviceScaleFactor: 1,
      reducedMotion: "reduce",
      timezoneId: "America/Los_Angeles",
    });
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("console", (message) => {
      if (message.type() === "error" && /webgl|shader|three/i.test(message.text())) errors.push(message.text());
    });
    await page.route(/https:\/\/(?:plausible\.io|www\.google-analytics\.com|www\.googletagmanager\.com)\//, (r) =>
      r.fulfill({ status: 200, body: "" })
    );
    await page.route("**/livereload.js*", (r) => r.fulfill({ status: 200, contentType: "text/javascript", body: "" }));
    await page.route(/\/assets\/(?:js\/.+\.m?js|models\/home\/.+\.(?:glb|json))(?:\?.*)?$/, (route) => {
      const url = new URL(route.request().url());
      if (url.origin !== root.origin) return route.continue();
      const rel = url.pathname.replace(/^.*?(?=assets\/)/, "");
      const model = models && rel.startsWith("assets/models/home/") && path.join(models, rel.slice("assets/models/home/".length));
      const module = modules && rel.startsWith("assets/js/") && path.join(modules, rel.slice("assets/js/".length));
      const file = [model, module].find((candidate) => candidate && fs.existsSync(candidate));
      if (!file) return route.continue();
      const bytes = fs.readFileSync(file);
      if (!served[rel]) served[rel] = { sha256: digest(bytes), source: model === file ? "models override" : "modules override", count: 0 };
      served[rel].count++;
      return route.fulfill({
        status: 200,
        body: bytes,
        contentType: rel.endsWith(".glb") ? "model/gltf-binary" : rel.endsWith(".json") ? "application/json" : "text/javascript",
      });
    });
    await page.addInitScript((date) => {
      const Native = Date,
        time = Native.parse(date);
      globalThis.Date = new Proxy(Native, {
        construct: (fn, args) => Reflect.construct(fn, args.length ? args : [time]),
        apply: () => new Native(time).toString(),
        get: (fn, name) => (name === "now" ? () => time : Reflect.get(fn, name)),
      });
    }, settings.date);
    async function act(selector) {
      const button = page.locator(selector).first();
      await button.waitFor({ state: "visible", timeout: 25000 });
      await button.evaluate((el) => el.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "instant" }));
      const point = await button.evaluate((el) => {
        const r = el.getBoundingClientRect();
        return [r.left + r.width * 0.5, r.top + r.height * 0.5];
      });
      await page.mouse.click(...point);
    }
    page.on("response", (response) => {
      const url = new URL(response.url());
      if (url.origin !== root.origin || !response.ok() || !/^.*?\/assets\/(?:js\/.+\.m?js|models\/home\/.+\.(?:glb|json))$/.test(url.pathname))
        return;
      const relative = url.pathname.replace(/^.*?(?=assets\/)/, "");
      sources.push(
        response
          .body()
          .then((bytes) => {
            if (!served[relative]) served[relative] = { sha256: digest(bytes), source: "served site", count: 1 };
          })
          .catch(() => {})
      );
    });
    await page.goto(root.href, { waitUntil: "domcontentloaded" });
    await act('[data-home-desk-mode="3d"]');
    await page.waitForFunction((h) => document.querySelector(h).dataset.sceneState === "ready", host, { timeout: 120000 });
    await act("[data-world-fullscreen]");
    await act("[data-world-places] > summary");
    await act('[data-world-destination="outside"]');
    await page.waitForFunction(
      (h) => {
        const el = document.querySelector(h),
          source = el.labScene?.surfEvidence(-10.3, -18.6);
        return source?.enabled && !!source.seabed;
      },
      host,
      { timeout: 55000 }
    );
    const scene = page.locator(host);
    await scene.evaluate((el, view) => {
      el.labScene.stepResolution(1);
      el.setLabCamera(view);
    }, view);
    await page
      .waitForFunction(
        ({ host, eye }) => {
          const p = document.querySelector(host).getSceneEvidence()?.camera;
          return p && Math.hypot(...p.map((v, i) => v - eye[i])) < 0.005;
        },
        { host, eye },
        { timeout: 25000 }
      )
      .catch(async (error) => {
        console.log(
          "Camera mismatch",
          await scene.evaluate((el) => {
            const { camera, target, view, currentRoom } = el.getSceneEvidence();
            return { camera, target, view, currentRoom };
          })
        );
        throw error;
      });
    console.log("Exact camera reached", eye);
    const frozen = await scene.evaluate((el, time) => el.labScene.captureSurfTime(time), settings.waterStudySeconds);
    assert.equal(frozen, true, "frozen visible surf clock");
    await page.waitForTimeout(500);
    const probe = await scene.evaluate((el) => {
      const e = el.getSceneEvidence(),
        remote = el.labScene.sun;
      const worldPosition = remote.position.clone();
      remote.getWorldPosition(worldPosition);
      const target = remote.target.position.clone();
      remote.target.getWorldPosition(target);
      const canvas = Array.from(el.querySelectorAll("canvas")).sort((a, b) => b.width * b.height - a.width * a.height)[0];
      const gl = canvas.getContext("webgl2");
      const info = gl?.getExtension("WEBGL_debug_renderer_info");
      const field = el.labScene.surfEvidence(-10.3, -18.6);
      return {
        camera: e.camera,
        target: e.target,
        fov: e.cameraFov ?? null,
        contextAttributes: gl?.getContextAttributes(),
        samples: gl?.getParameter(gl.SAMPLES),
        clockLabel: el.querySelector("[data-world-clock]")?.textContent?.trim() ?? null,
        projection: e.projection,
        field,
        drawingBuffer: [canvas.width, canvas.height],
        canvas: [canvas.clientWidth, canvas.clientHeight],
        backend: info ? gl.getParameter(info.UNMASKED_RENDERER_WEBGL) : gl?.getParameter(gl.RENDERER),
        sun: { towardWorld: worldPosition.sub(target).normalize().toArray(), linearColor: remote.color.toArray(), intensity: remote.intensity },
        lighting: e.lighting,
        weather: e.weather,
        quality: e.quality,
      };
    });
    assert.ok(probe.field.enabled && Math.abs(probe.field.seconds - settings.waterStudySeconds) < 0.061, "actual T2 atlas is at the matched clock");
    assert.equal(probe.projection, "perspective");
    const data = await scene.evaluate(async (el) => {
      const canvas = Array.from(el.querySelectorAll("canvas")).sort((a, b) => b.width * b.height - a.width * a.height)[0];
      return await new Promise((resolve) => {
        el.labScene.requestFrame();
        requestAnimationFrame(() => resolve(canvas.toDataURL("image/png")));
      });
    });
    fs.writeFileSync(path.join(out, "webgl-raw.png"), Buffer.from(data.split(",")[1], "base64"));
    await page.screenshot({ path: path.join(out, "webgl-visitor.png"), timeout: 30000 });
    console.log("Real WebGL frame saved", JSON.stringify(probe));
    const staticMatch = await scene.evaluate(async (el) => {
      const animalRoot = el.labScene.scene.getObjectByName("Coastal neighbours");
      if (!animalRoot) throw new Error("Expected the browser-only species group");
      const original = animalRoot.position.toArray();
      animalRoot.position.x -= 1000;
      animalRoot.position.z += 1200;
      animalRoot.updateMatrixWorld(true);
      const canvas = Array.from(el.querySelectorAll("canvas")).sort((a, b) => b.width * b.height - a.width * a.height)[0];
      const bytes = await new Promise((resolve) => {
        el.labScene.requestFrame();
        requestAnimationFrame(() => resolve(canvas.toDataURL("image/png")));
      });
      return {
        bytes,
        parked: { name: animalRoot.name, original, offCamera: animalRoot.position.toArray(), count: animalRoot.children.length },
        field: el.labScene.surfEvidence(-10.3, -18.6),
      };
    });
    const matched = Buffer.from(staticMatch.bytes.split(",")[1], "base64");
    fs.writeFileSync(path.join(out, "webgl-matched.png"), matched);
    delete staticMatch.bytes;
    assert.deepEqual(staticMatch.field, probe.field, "parked fauna keeps the hydrostatic sample unchanged");
    const grid = await scene.evaluate(
      (el, { xs, zs }) => {
        const out = new Float32Array(xs.length * zs.length * 5);
        let i = 0,
          count = 0,
          maxFoam = 0,
          wet = 0;
        for (const y of zs)
          for (const x of xs) {
            const row = el.labScene.surfEvidence(x, y),
              wave = row.physical,
              solver = row.sample,
              bed = row.seabed;
            out[i++] = wave?.y ?? NaN;
            out[i++] = solver?.foam ?? 0;
            out[i++] = solver?.moisture ?? 0;
            out[i++] = bed?.height ?? wave?.floor ?? NaN;
            out[i++] = solver?.depth ?? NaN;
            count += Number(!!wave);
            maxFoam = Math.max(maxFoam, solver?.foam ?? 0);
            wet += Number((solver?.moisture ?? 0) > 0.01);
          }
        const bytes = new Uint8Array(out.buffer);
        let text = "";
        for (let start = 0; start < bytes.length; start += 16384) text += String.fromCharCode(...bytes.subarray(start, start + 16384));
        return { bytes: btoa(text), physicalCount: count, maxFoam, wetSamples: wet, instance: el.labScene.surfEvidence(-10.3, -18.6) };
      },
      { host, xs, zs }
    );
    const bytes = Buffer.from(grid.bytes, "base64");
    delete grid.bytes;
    assert.equal(bytes.length, xs.length * zs.length * 20);
    await Promise.all(sources);
    assert.deepEqual(errors, []);
    fs.writeFileSync(path.join(out, "water-grid.f32"), bytes);
    fs.writeFileSync(
      path.join(out, "webgl-receipt.json"),
      JSON.stringify(
        {
          shot: shotName,
          config: settings,
          viewRequested: { eye, dir, target, ...view },
          browser: probe,
          staticMatch,
          grid: { xs, zs, channels: ["worldSurfaceY", "T2Foam", "T2Moisture", "worldBedY", "T2Depth"], sha256: digest(bytes), ...grid },
          served,
          errors,
        },
        null,
        2
      ) + "\n"
    );
    console.log("Exact live wave grid sampled", xs.length, zs.length, grid);
  } finally {
    await browser.close();
  }
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
