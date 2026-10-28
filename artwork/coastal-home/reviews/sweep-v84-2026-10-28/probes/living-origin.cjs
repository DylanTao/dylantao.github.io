const { chromium } = require("playwright"),
  fs = require("node:fs/promises"),
  path = require("node:path");
const { preparePage } = require(path.join(process.cwd(), "test/visual/helpers"));
const Q = path.join(process.cwd(), ".jekyll-cache/visual-qa/sweep-2026-10-28");
(async () => {
  const b = await chromium.launch({ args: ["--use-angle=d3d11", "--ignore-gpu-blocklist"] });
  try {
    const p = await b.newPage({ viewport: { width: 1440, height: 1000 }, reducedMotion: "reduce" });
    await preparePage(p, "light");
    await p.clock.setFixedTime(new Date("2026-10-26T14:00:00-07:00"));
    await p.goto("http://127.0.0.1:4118/al-folio/?scene-lab=1&quality=high&resolution=fixed");
    await p.locator('[data-home-desk-mode="3d"]').click();
    const scene = p.locator("[data-home-desk-scene]"),
      ui = p.locator("[data-home-world-controls]");
    await scene.scrollIntoViewIfNeeded();
    await p.waitForFunction(() => document.querySelector("[data-home-desk-scene]")?.dataset.sceneState === "ready", null, { timeout: 180000 });
    await ui.locator("[data-world-fullscreen]").click();
    await ui.locator("[data-world-lab] > summary").click();
    await ui.locator('[data-world-room="lounge"]').click();
    await ui.locator("[data-world-lab] > summary").click();
    await p.waitForTimeout(500);
    const config = JSON.parse(await fs.readFile(path.join(Q, "frozen/assets/models/home/manifest.json"), "utf8"));
    const result = await scene.evaluate(async (e, config) => {
      const T = await import("/al-folio/assets/js/three.module.min.js"),
        C = await import("/al-folio/assets/js/home-scene/camera.mjs"),
        F = await import("/al-folio/assets/js/home-scene/camera-field.mjs");
      const s = e.getSceneEvidence(),
        room = config.rooms.find((r) => r.id === "lounge"),
        g = e.labScene.collisionGrid(),
        d = C.ORBIT_DIRECTION(s.cameraOrbit.yaw, s.cameraOrbit.pitch),
        target = s.target,
        radius = s.cameraOrbit.radius;
      const add = (a, v) => a.map((x, i) => x + v[i]),
        eye = (a) => [a[0], a[1] + 1.6, a[2]];
      const points = [
        { name: "look-target", point: target },
        { name: "actual-camera", point: s.camera },
        {
          name: "authored-camera",
          point: add(
            target,
            d.map((v) => v * radius)
          ),
        },
      ];
      for (const k of ["actor", "walkActor"]) if (Array.isArray(room[k])) points.push({ name: k + "-headroom", point: eye(room[k]) });
      for (const [i, a] of (room.exitPath || []).entries()) points.push({ name: "egress-" + i + "-headroom", point: eye(a) });
      const rayFlags = [];
      for (let t = 0; t <= radius + 0.001; t += 0.06) {
        const at = add(
          target,
          d.map((v) => v * t)
        );
        rayFlags.push({ t, point: at, flags: g.flagAt(...at) });
      }
      // An independent plane-event traversal covers every crossed cell, including
      // arbitrarily short corner grazes that uniform point samples could miss.
      const cuts = [0, radius];
      for (let axis = 0; axis < 3; axis++) {
        if (Math.abs(d[axis]) < 1e-12) continue;
        for (let j = 0; j <= g.size[axis]; j++) {
          const plane = g.bounds.min[axis] + j * g.cell,
            t = (plane - target[axis]) / d[axis];
          if (t > 0 && t < radius) cuts.push(t);
        }
      }
      cuts.sort((a, b) => a - b);
      const uniqueCuts = cuts.filter((v, i) => !i || Math.abs(v - cuts[i - 1]) > 1e-10),
        cellIntervals = [];
      for (let i = 0; i < uniqueCuts.length - 1; i++) {
        const a = uniqueCuts[i],
          b = uniqueCuts[i + 1],
          point = add(
            target,
            d.map((v) => (v * (a + b)) / 2)
          );
        cellIntervals.push({
          entry: a,
          exit: b,
          point,
          flags: g.flagAt(...point),
          cell: point.map((v, k) => Math.floor((v - g.bounds.min[k]) / g.cell)),
        });
      }
      e.labScene.scene.updateMatrixWorld(true);
      const meshes = [];
      e.labScene.scene.traverse((o) => {
        if (o.isMesh && F.collidable(o, e.labScene.scene)) meshes.push(o);
      });
      const ray = new T.Ray(new T.Vector3(...target), new T.Vector3(...d)),
        rayHits = [];
      for (const o of meshes) {
        const box = new T.Box3().setFromObject(o),
          v = new T.Vector3();
        if (!box.containsPoint(ray.origin) && (!ray.intersectBox(box, v) || v.distanceTo(ray.origin) > radius)) continue;
        const a = o.geometry.attributes.position,
          idx = o.geometry.index,
          count = idx?.count || a.count,
          tri = new T.Triangle();
        let best = Infinity,
          hitRecord = null;
        for (let i = 0; i < count; i += 3) {
          const ids = [0, 1, 2].map((j) => (idx ? idx.getX(i + j) : i + j));
          tri.a.fromBufferAttribute(a, ids[0]).applyMatrix4(o.matrixWorld);
          tri.b.fromBufferAttribute(a, ids[1]).applyMatrix4(o.matrixWorld);
          tri.c.fromBufferAttribute(a, ids[2]).applyMatrix4(o.matrixWorld);
          if (ray.intersectTriangle(tri.a, tri.b, tri.c, false, v)) {
            const distance = v.distanceTo(ray.origin);
            if (distance > 1e-6 && distance < best) {
              best = distance;
              hitRecord = { triangle: i / 3, indices: ids, point: v.toArray(), world: [tri.a.toArray(), tri.b.toArray(), tri.c.toArray()] };
            }
          }
        }
        if (best <= radius)
          rayHits.push({
            name: o.name,
            visible: o.visible,
            nearestRayDistance: best,
            triangle: hitRecord,
            bounds: [box.min.toArray(), box.max.toArray()],
            flags: Object.fromEntries(Object.entries(o.userData).filter(([k, v]) => ["string", "number", "boolean"].includes(typeof v))),
          });
      }

      const blockedCell = [129, 75, 98],
        cellMin = blockedCell.map((v, i) => g.bounds.min[i] + v * g.cell),
        cellMax = cellMin.map((v) => v + g.cell),
        cellBox = new T.Box3(new T.Vector3(...cellMin), new T.Vector3(...cellMax)),
        contributors = [];
      for (const o of meshes) {
        const box = new T.Box3().setFromObject(o);
        if (!cellBox.intersectsBox(box)) continue;
        const a = o.geometry.attributes.position,
          idx = o.geometry.index,
          n = idx?.count || a.count,
          tri = new T.Triangle(),
          records = [];
        const prepared = g.prepareGeometry({
          position: (i, out) => {
            out[0] = a.getX(i);
            out[1] = a.getY(i);
            out[2] = a.getZ(i);
          },
          count: a.count,
          index: idx ? idx.array.slice(0, idx.count) : null,
          matrix: [...o.matrixWorld.elements],
        });
        for (let i = 0; i < n; i += 3) {
          const ids = [0, 1, 2].map((j) => (idx ? idx.getX(i + j) : i + j));
          tri.a.fromBufferAttribute(a, ids[0]).applyMatrix4(o.matrixWorld);
          tri.b.fromBufferAttribute(a, ids[1]).applyMatrix4(o.matrixWorld);
          tri.c.fromBufferAttribute(a, ids[2]).applyMatrix4(o.matrixWorld);
          if (!cellBox.intersectsTriangle(tri)) continue;
          const vertices = [tri.a.toArray(), tri.b.toArray(), tri.c.toArray()],
            longest = Math.max(tri.a.distanceTo(tri.b), tri.a.distanceTo(tri.c), tri.b.distanceTo(tri.c)),
            samples = [];
          // All intersecting triangles here are shorter than the production leaf=.96m;
          // this reproduces the exact production barycentric cell-marking rule.
          if (longest > g.cell * 8) throw new Error("Contributor requires recursive sample reproduction");
          const subdivisions = Math.max(1, Math.ceil((longest / g.cell) * 2));
          for (let u = 0; u <= subdivisions; u++)
            for (let v = 0; v <= subdivisions - u; v++) {
              const weights = [1 - u / subdivisions - v / subdivisions, u / subdivisions, v / subdivisions],
                point = [0, 1, 2].map((k) => vertices.reduce((sum, p, j) => sum + p[k] * weights[j], 0)),
                at = point.map((p, k) => Math.floor((p - g.bounds.min[k]) / g.cell));
              if (at.every((x, k) => x === blockedCell[k])) samples.push(point);
            }
          records.push({
            triangle: i / 3,
            indices: ids,
            world: vertices,
            detail: prepared.detail?.[i / 3] === 1,
            subdivisions,
            markedCellSamples: samples,
          });
        }
        if (records.length)
          contributors.push({
            name: o.name,
            visible: o.visible,
            properties: Object.fromEntries(Object.entries(o.userData).filter(([k, v]) => ["string", "number", "boolean"].includes(typeof v))),
            bounds: [box.min.toArray(), box.max.toArray()],
            triangles: records,
          });
      }
      const pool = s.simulation.onsen,
        padding = pool.radius + 0.1,
        steam = {
          min: [pool.center[0] - padding, pool.surfaceY - 0.05, pool.center[1] - padding],
          max: [pool.center[0] + padding, pool.surfaceY + 0.72, pool.center[1] + padding],
        };
      const origin = {
        blockedCell,
        bounds: [cellMin, cellMax],
        contributors,
        explicitSolids: [
          {
            source: "controller.mjs prepareSteam(pool) addSolid",
            ...steam,
            overlapsBlockedCell: cellBox.intersectsBox(new T.Box3(new T.Vector3(...steam.min), new T.Vector3(...steam.max))),
          },
        ],
      };
      return {
        origin,
        target,
        orbit: s.cameraOrbit,
        arm: s.cameraArm,
        bitMeaning: { BLOCKING: C.BLOCKING, CLEARANCE: C.CLEARANCE, INSIDE: C.INSIDE },
        field: g.evidence(),
        gridBounds: g.bounds,
        gridSize: g.size,
        points: points.map((r) => ({ ...r, flags: g.flagAt(...r.point) })),
        direction: d,
        rayFlags,
        exactCellIntervals: cellIntervals,
        marchRestricted: g.march(target, d, radius),
        marchHard: g.march(target, d, radius, C.BLOCKING | C.INSIDE),
        pureFieldSoftArm: C.cameraArm(g, null, target, s.cameraOrbit.yaw, s.cameraOrbit.pitch, radius),
        pureFieldHardArm: C.hardArm(g, null, target, s.cameraOrbit.yaw, s.cameraOrbit.pitch, radius),
        rayHits: rayHits.sort((a, b) => a.nearestRayDistance - b.nearestRayDistance),
        collidableCount: meshes.length,
        cache: s.loading.lightCache,
      };
    }, config);
    await fs.writeFile(path.join(Q, "living-cell-origin.json"), JSON.stringify(result, null, 2) + "\n");
    console.log(JSON.stringify({ origin: result.origin, march: result.marchRestricted }, null, 2));
  } finally {
    await b.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
