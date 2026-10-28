const { chromium } = require("playwright"),
  fs = require("node:fs/promises"),
  path = require("node:path"),
  crypto = require("node:crypto");
const { preparePage } = require(path.join(process.cwd(), "test/visual/helpers"));
const Q = path.join(process.cwd(), ".jekyll-cache/visual-qa/sweep-2026-10-28");
const sha = (b) => crypto.createHash("sha256").update(b).digest("hex");
const save = (n, d) => fs.writeFile(path.join(Q, n), JSON.stringify(d, null, 2) + "\n");
(async () => {
  const browser = await chromium.launch({ args: ["--use-angle=d3d11", "--ignore-gpu-blocklist"] });
  try {
    const results = [];
    for (const width of [1440, 390]) {
      const page = await browser.newPage({
          viewport: { width, height: 1000 },
          deviceScaleFactor: 1,
          isMobile: width < 600,
          hasTouch: width < 600,
          reducedMotion: "reduce",
        }),
        errors = [],
        responses = [],
        pending = [];
      page.on("pageerror", (e) => errors.push(e.message));
      page.on("response", (r) => {
        const h = r.headers();
        if (h["x-sweep-source"] === "frozen")
          pending.push(
            (async () => {
              let b;
              try {
                b = await r.body();
              } catch {
                b = Buffer.from(await (await fetch(r.url())).arrayBuffer());
              }
              responses.push({ url: r.url(), sha256: sha(b), sourceSha256: h["x-sweep-sha256"], matches: sha(b) === h["x-sweep-sha256"] });
            })()
          );
      });
      await preparePage(page, "light");
      await page.clock.setFixedTime(new Date("2026-10-26T14:00:00-07:00"));
      await page.goto("http://127.0.0.1:4118/al-folio/?scene-lab=1&quality=high&resolution=fixed", { waitUntil: "domcontentloaded" });
      await page.locator('[data-home-desk-mode="3d"]').click();
      const scene = page.locator("[data-home-desk-scene]"),
        ui = page.locator("[data-home-world-controls]");
      await scene.scrollIntoViewIfNeeded();
      await page.waitForFunction(() => document.querySelector("[data-home-desk-scene]")?.dataset.sceneState === "ready", null, { timeout: 180000 });
      await ui.locator("[data-world-fullscreen]").click();
      const read = () => scene.evaluate((e) => e.getSceneEvidence());
      const visit = async (id) => {
        const lab = ui.locator("[data-world-lab]");
        if (!(await lab.evaluate((e) => e.open))) await lab.locator("summary").first().click();
        await ui.locator(`[data-world-room="${id}"]`).click();
        if (await lab.evaluate((e) => e.open)) await lab.locator("summary").first().click();
        await page.waitForTimeout(500);
      };
      await visit("lounge");
      await page.waitForTimeout(1500);
      const first = await read();
      await scene
        .locator("canvas:not(.home-world-sketch)")
        .first()
        .screenshot({ path: path.join(Q, `living-blocked-${width}-reduced.png`) });
      // Ask for real rendered frames, without moving the target, camera, source or colliders.
      await scene.evaluate(async (e) => {
        for (let i = 0; i < 12; i++) {
          const before = e.getSceneEvidence().frames;
          e.labScene.requestFrame();
          for (let j = 0; j < 120; j++) {
            await new Promise(requestAnimationFrame);
            if (e.getSceneEvidence().frames > before) break;
          }
        }
      });
      const settled = await read();
      await visit("kitchen");
      const other = await read();
      await visit("lounge");
      const returned = await read();
      const blockers = await scene.evaluate(async (e) => {
        const T = await import("/al-folio/assets/js/three.module.min.js"),
          state = e.getSceneEvidence(),
          point = new T.Vector3(...state.target),
          rows = [];
        e.labScene.scene.updateMatrixWorld(true);
        e.labScene.scene.traverse((o) => {
          if (!o.isMesh || !o.geometry?.attributes.position) return;
          let visible = true;
          for (let p = o; p; p = p.parent) visible &&= p.visible;
          if (!visible) return;
          const box = new T.Box3().setFromObject(o);
          if (!box.containsPoint(point)) return;
          const g = o.geometry,
            p = g.attributes.position,
            index = g.index,
            count = index?.count || p.count,
            triangle = new T.Triangle(),
            closest = new T.Vector3(),
            tmp = new T.Vector3(),
            ray = new T.Ray(point.clone(), new T.Vector3(1, 0.247, 0.113).normalize()),
            hits = [];
          let best = Infinity,
            bestTri = null;
          for (let i = 0; i < count; i += 3) {
            const ids = [0, 1, 2].map((j) => (index ? index.getX(i + j) : i + j));
            triangle.a.fromBufferAttribute(p, ids[0]).applyMatrix4(o.matrixWorld);
            triangle.b.fromBufferAttribute(p, ids[1]).applyMatrix4(o.matrixWorld);
            triangle.c.fromBufferAttribute(p, ids[2]).applyMatrix4(o.matrixWorld);
            triangle.closestPointToPoint(point, tmp);
            const d = tmp.distanceTo(point);
            if (d < best) {
              best = d;
              closest.copy(tmp);
              bestTri = { triangle: i / 3, indices: ids, world: [triangle.a.toArray(), triangle.b.toArray(), triangle.c.toArray()] };
            }
            const hit = ray.intersectTriangle(triangle.a, triangle.b, triangle.c, false, tmp);
            if (hit && tmp.distanceTo(point) > 1e-6) hits.push(tmp.distanceTo(point));
          }
          hits.sort((a, b) => a - b);
          const unique = hits.filter((v, i) => !i || Math.abs(v - hits[i - 1]) > 1e-5);
          rows.push({
            name: o.name,
            path: (() => {
              const a = [];
              for (let n = o; n; n = n.parent) a.unshift(n.name || n.type);
              return a;
            })(),
            material: [o.material].flat().map((m) => m.name),
            bounds: [box.min.toArray(), box.max.toArray()],
            nearestDistance: best,
            nearestPoint: closest.toArray(),
            nearestTriangle: bestTri,
            rayIntersections: unique.length,
            oddParity: unique.length % 2 === 1,
            userData: o.userData,
          });
        });
        return {
          target: point.toArray(),
          targetVoxelFlags: e.labScene.collisionGrid()?.flagAt(...point.toArray()),
          camera: state.camera,
          cameraOrbit: state.cameraOrbit,
          cameraArm: state.cameraArm,
          candidates: rows.sort((a, b) => a.nearestDistance - b.nearestDistance),
        };
      });
      await page.emulateMedia({ reducedMotion: "no-preference" });
      await page.waitForTimeout(1800);
      const live = await read();
      await scene
        .locator("canvas:not(.home-world-sketch)")
        .first()
        .screenshot({ path: path.join(Q, `living-blocked-${width}-live.png`) });
      await Promise.all(pending);
      const result = { width, source: "Frozen v84/RT/cache50df family", first, settled, other, returned, live, blockers, responses, errors };
      await save(`living-blocker-${width}.json`, result);
      results.push({
        width,
        firstArm: first.cameraArm,
        settledArm: settled.cameraArm,
        returnArm: returned.cameraArm,
        liveArm: live.cameraArm,
        cache: first.loading.lightCache,
        blockers: blockers.candidates
          .slice(0, 8)
          .map((r) => ({ name: r.name, nearestDistance: r.nearestDistance, oddParity: r.oddParity, triangle: r.nearestTriangle.triangle })),
        errors,
      });
      await page.close();
    }
    await save("living-blocker-summary.json", results);
    console.log(JSON.stringify(results, null, 2));
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
