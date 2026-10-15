// node --test test/light-lab.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  KIND,
  counters,
  createRenderer,
  createScene,
  downsampleLuminance,
  fresnel,
  luminance,
  luminanceRmse,
  refract,
  toneMapToRGBA,
  traceRay,
  waterHeightAt,
  waterNormalAt,
} from "../assets/js/light-lab/core.mjs";

const IOR = 1.33;

function lcg(seed) {
  let s = seed >>> 0;
  return () => (s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296;
}

function meanLuminance(img) {
  let m = 0;
  for (let i = 0; i < img.length; i += 3) m += luminance(img[i], img[i + 1], img[i + 2]);
  return m / (img.length / 3);
}

function render(options, samples) {
  const r = createRenderer({ width: 32, height: 24, ...options });
  r.runSamples(samples);
  return { image: r.image(), stats: r.stats() };
}

function relDiff(a, b) {
  return Math.abs(a - b) / Math.abs(b);
}

test("(a) Fresnel: ((n-1)/(n+1))^2 at normal incidence, 1 at grazing, 1 beyond the critical angle", () => {
  const f0 = ((IOR - 1) / (IOR + 1)) ** 2;
  assert.ok(Math.abs(fresnel(1, 1 / IOR) - f0) < 1e-12);
  assert.ok(Math.abs(fresnel(1, IOR) - f0) < 1e-12);
  assert.ok(fresnel(1e-7, 1 / IOR) > 0.9999);
  let previous = 0;
  for (let deg = 0; deg <= 89; deg++) {
    const f = fresnel(Math.cos((deg * Math.PI) / 180), 1 / IOR);
    assert.ok(f >= previous - 1e-15, `reflectance should not drop at ${deg} degrees`);
    previous = f;
  }
  const critical = Math.asin(1 / IOR);
  assert.equal(fresnel(Math.cos(critical + 0.01), IOR), 1);
  assert.ok(fresnel(Math.cos(critical - 0.01), IOR) < 1);
});

test("(b) refraction obeys Snell's law; total internal reflection past the critical angle", () => {
  const rand = lcg(7);
  for (let k = 0; k < 2000; k++) {
    const n = (() => {
      const v = [rand() - 0.5, 1, rand() - 0.5];
      const l = Math.hypot(...v);
      return v.map((x) => x / l);
    })();
    // A direction arriving against n at a random angle.
    const theta = rand() * 1.5;
    const t1 = [1, 0, 0];
    const b = [n[1] * t1[2] - n[2] * t1[1], n[2] * t1[0] - n[0] * t1[2], n[0] * t1[1] - n[1] * t1[0]];
    const bl = Math.hypot(...b);
    const tangent = b.map((x) => x / bl);
    const d = [0, 1, 2].map((i) => -Math.cos(theta) * n[i] + Math.sin(theta) * tangent[i]);
    for (const [n1, n2] of [
      [1, IOR],
      [IOR, 1],
    ]) {
      const t = refract(d, n, n1 / n2);
      const sinI = Math.sin(theta);
      if (n1 * sinI > n2) {
        assert.equal(t, null, "expected total internal reflection");
        continue;
      }
      assert.ok(t, "expected a transmitted ray");
      assert.ok(Math.abs(Math.hypot(...t) - 1) < 1e-12, "unit length");
      const cosT = -(t[0] * n[0] + t[1] * n[1] + t[2] * n[2]);
      assert.ok(cosT > 0, "transmitted ray continues through the surface");
      const sinT = Math.sqrt(Math.max(0, 1 - cosT * cosT));
      assert.ok(Math.abs(n1 * sinI - n2 * sinT) < 1e-10, "n1 sin i = n2 sin t");
      // Coplanar with d and n.
      const cr = [d[1] * n[2] - d[2] * n[1], d[2] * n[0] - d[0] * n[2], d[0] * n[1] - d[1] * n[0]];
      assert.ok(Math.abs(cr[0] * t[0] + cr[1] * t[1] + cr[2] * t[2]) < 1e-10, "coplanar");
    }
  }
  const critical = Math.asin(1 / IOR);
  const below = [Math.sin(critical - 1e-3), -Math.cos(critical - 1e-3), 0];
  const above = [Math.sin(critical + 1e-3), -Math.cos(critical + 1e-3), 0];
  assert.ok(refract(below, [0, 1, 0], IOR));
  assert.equal(refract(above, [0, 1, 0], IOR), null);
});

test("(c) analytic water normal matches finite differences of h", () => {
  const scene = createScene();
  const rand = lcg(11);
  const [cx, cz] = scene.pool;
  const [rx, rz] = scene.ripple;
  const points = [
    [rx, rz],
    [rx + 1e-7, rz],
  ];
  for (let k = 0; k < 3000; k++) {
    const r = Math.sqrt(rand()) * 0.999;
    const a = rand() * 2 * Math.PI;
    points.push([cx + r * Math.cos(a), cz + r * Math.sin(a)]);
  }
  const e = 1e-6;
  let worst = 0;
  for (const [x, z] of points) {
    const hx = (waterHeightAt(scene, x + e, z) - waterHeightAt(scene, x - e, z)) / (2 * e);
    const hz = (waterHeightAt(scene, x, z + e) - waterHeightAt(scene, x, z - e)) / (2 * e);
    const l = Math.hypot(hx, 1, hz);
    const fd = [-hx / l, 1 / l, -hz / l];
    const n = waterNormalAt(scene, x, z);
    worst = Math.max(worst, Math.hypot(n[0] - fd[0], n[1] - fd[1], n[2] - fd[2]));
  }
  assert.ok(worst < 1e-6, `largest normal difference ${worst}`);
});

test("(d) water intersection never misses the surface and never hits outside the pool", () => {
  const scene = createScene();
  const rand = lcg(23);
  const [cx, cz, R] = scene.pool;
  const leaks0 = counters().leaks;
  let checkedAbove = 0;
  let checkedBelow = 0;
  for (let k = 0; k < 20000; k++) {
    const r = R * 0.995 * Math.sqrt(rand());
    const a = rand() * 2 * Math.PI;
    const px = cx + r * Math.cos(a);
    const pz = cz + r * Math.sin(a);
    const p = [px, waterHeightAt(scene, px, pz), pz];
    // From the air: an origin up to 3 m away along a direction at least 8 degrees above horizontal.
    {
      const el = 0.14 + rand() * 1.42;
      const az = rand() * 2 * Math.PI;
      const u = [Math.cos(el) * Math.cos(az), Math.sin(el), Math.cos(el) * Math.sin(az)];
      const dist = 0.05 + rand() * 3;
      const o = [p[0] + u[0] * dist, p[1] + u[1] * dist, p[2] + u[2] * dist];
      const inGrotto = o[0] > -2 && o[0] < 2 && o[2] > -1.6 && o[2] < 1.6 && o[1] < 2.6;
      // Where the segment passes the floor plane it must be inside the opening (or start below it).
      const tFloor = o[1] > 0 ? o[1] / (o[1] - p[1]) : 0;
      const fx = o[0] + (p[0] - o[0]) * tFloor;
      const fz = o[2] + (p[2] - o[2]) * tFloor;
      const throughOpening = (fx - cx) ** 2 + (fz - cz) ** 2 < R * R * 0.999;
      const insidePool = o[1] > 0 || (o[0] - cx) ** 2 + (o[2] - cz) ** 2 < R * R * 0.999;
      if (inGrotto && throughOpening && insidePool && o[1] > waterHeightAt(scene, o[0], o[2]) + 1e-4) {
        const d = [-u[0], -u[1], -u[2]];
        const hit = traceRay(scene, o, d, false);
        assert.equal(hit.kind, KIND.WATER, `ray from above missed the water at sample ${k}`);
        assert.ok(hit.t <= dist + 1e-7, `hit beyond the target point (${hit.t} > ${dist})`);
        const q = hit.point;
        assert.ok((q[0] - cx) ** 2 + (q[2] - cz) ** 2 <= R * R + 1e-12, "hit outside the pool radius");
        assert.ok(Math.abs(q[1] - waterHeightAt(scene, q[0], q[2])) < 1e-8, "hit is not on the surface");
        checkedAbove++;
      }
    }
    // From the water: an origin below the surface aimed up at p.
    {
      const el = 0.1 + rand() * 1.46;
      const az = rand() * 2 * Math.PI;
      const u = [Math.cos(el) * Math.cos(az), -Math.sin(el), Math.cos(el) * Math.sin(az)];
      const dist = 0.02 + rand() * 1.5;
      const o = [p[0] + u[0] * dist, p[1] + u[1] * dist, p[2] + u[2] * dist];
      const inside = (o[0] - cx) ** 2 + (o[2] - cz) ** 2 < R * R * 0.999 && o[1] > scene.pool[3] + 1e-4;
      if (inside && o[1] < waterHeightAt(scene, o[0], o[2]) - 1e-4) {
        const d = [-u[0], -u[1], -u[2]];
        const hit = traceRay(scene, o, d, true);
        assert.equal(hit.kind, KIND.WATER, `ray from below missed the water at sample ${k}`);
        assert.ok(hit.t <= dist + 1e-7, `hit beyond the target point (${hit.t} > ${dist})`);
        const q = hit.point;
        assert.ok((q[0] - cx) ** 2 + (q[2] - cz) ** 2 <= R * R + 1e-12, "hit outside the pool radius");
        checkedBelow++;
      }
    }
  }
  assert.ok(checkedAbove > 5000 && checkedBelow > 5000, `too few checks: ${checkedAbove}, ${checkedBelow}`);
  // Arbitrary rays through the grotto: water hits always lie inside the pool.
  for (let k = 0; k < 20000; k++) {
    const o = [-1.9 + 3.8 * rand(), 0.01 + 2.5 * rand(), -1.5 + 3 * rand()];
    const z = 2 * rand() - 1;
    const a = 2 * Math.PI * rand();
    const s = Math.sqrt(1 - z * z);
    const hit = traceRay(scene, o, [s * Math.cos(a), z, s * Math.sin(a)], false);
    if (hit.kind === KIND.WATER) {
      const q = hit.point;
      assert.ok((q[0] - cx) ** 2 + (q[2] - cz) ** 2 <= R * R + 1e-12, "water hit outside the pool");
    }
  }
  assert.equal(counters().leaks, leaks0, "a ray started on the wrong side of the water surface");
});

test("(d') rays leaving the surface do not re-hit it at their own origin", () => {
  const scene = createScene();
  const rand = lcg(31);
  const [cx, cz, R] = scene.pool;
  let tested = 0;
  for (let k = 0; k < 4000; k++) {
    const r = R * 0.9 * Math.sqrt(rand());
    const a = rand() * 2 * Math.PI;
    const o = [cx + r * Math.cos(a), 1 + rand(), cz + r * Math.sin(a)];
    const d = [0.4 * (rand() - 0.5), -1, 0.4 * (rand() - 0.5)];
    const l = Math.hypot(...d);
    const hit = traceRay(
      scene,
      o,
      d.map((x) => x / l),
      false
    );
    if (hit.kind !== KIND.WATER) continue;
    const n = hit.normal;
    const dn = d.map((x) => x / l);
    const cosI = -(dn[0] * n[0] + dn[1] * n[1] + dn[2] * n[2]);
    const p = hit.point;
    const t = refract(dn, n, 1 / IOR);
    const below = traceRay(scene, [p[0] - 5e-6 * n[0], p[1] - 5e-6 * n[1], p[2] - 5e-6 * n[2]], t, true);
    assert.ok(!(below.kind === KIND.WATER && below.t < 1e-3), "refracted ray re-hit the surface at once");
    // A refracted ray heads down, away from the surface: it must reach the pool floor or wall.
    assert.equal(below.kind, KIND.DIFFUSE, "refracted ray reported a water hit on its way down");
    if (cosI > 0.3) {
      const refl = dn.map((x, i) => x + 2 * cosI * n[i]);
      const above = traceRay(scene, [p[0] + 5e-6 * n[0], p[1] + 5e-6 * n[1], p[2] + 5e-6 * n[2]], refl, false);
      assert.ok(!(above.kind === KIND.WATER && above.t < 1e-4), "reflected ray re-hit the surface at once");
      if (above.kind === KIND.WATER) {
        const q = above.point;
        assert.ok(Math.abs(q[1] - waterHeightAt(scene, q[0], q[2])) < 1e-8, "reflected ray reported a hit off the surface");
      }
    }
    tested++;
  }
  assert.ok(tested > 3000);
});

test("(d'') every water hit lies on the surface, from any start point and direction", () => {
  const scene = createScene();
  const rand = lcg(47);
  const [cx, cz, R] = scene.pool;
  const leaks0 = counters().leaks;
  let hits = 0;
  for (let k = 0; k < 40000; k++) {
    const r = R * 0.98 * Math.sqrt(rand());
    const a = rand() * 2 * Math.PI;
    const x = cx + r * Math.cos(a);
    const z = cz + r * Math.sin(a);
    const h = waterHeightAt(scene, x, z);
    // Start points in the water and in the air, many of them inside the ripple slab.
    const inWater = rand() < 0.5;
    const y = inWater ? h - 1e-5 - rand() * (rand() < 0.5 ? 0.02 : 0.6) : h + 1e-5 + rand() * (rand() < 0.5 ? 0.02 : 0.04);
    if (y <= scene.pool[3] || y >= 0) continue;
    const zz = 2 * rand() - 1;
    const b = 2 * Math.PI * rand();
    const s = Math.sqrt(1 - zz * zz);
    const hit = traceRay(scene, [x, y, z], [s * Math.cos(b), zz, s * Math.sin(b)], inWater);
    if (hit.kind === KIND.WATER) {
      const q = hit.point;
      assert.ok(Math.abs(q[1] - waterHeightAt(scene, q[0], q[2])) < 1e-8, `hit ${q[1] - waterHeightAt(scene, q[0], q[2])} m off the surface`);
      hits++;
    }
  }
  assert.ok(hits > 5000, `only ${hits} water hits`);
  assert.equal(counters().leaks, leaks0, "a ray started on the wrong side of the water surface");
});

function blockMeans(img, w, h, bw, bh) {
  return downsampleLuminance(img, w, h, bw, bh);
}

test("(e) white furnace: closed grey box with water converges to Le / (1 - albedo) with PT and PSSMLT", (t) => {
  const furnace = { albedo: 0.5, emission: 1 };
  const expected = 2 * (1 - 0.5 ** 63);
  for (const method of ["pt", "mlt"]) {
    const { image, stats } = render({ method, seed: 3, furnace, maxDepth: 64, chains: 64, bootstrapSamples: 20000 }, 150000);
    assert.equal(stats.leaks, 0);
    const mean = meanLuminance(image);
    t.diagnostic(`${method}: furnace mean ${mean.toFixed(5)} (expected ${expected.toFixed(5)})`);
    assert.ok(relDiff(mean, expected) < 0.01, `${method} furnace mean ${mean}, expected ${expected}`);
    for (const b of blockMeans(image, 32, 24, 4, 3)) assert.ok(relDiff(b, expected) < 0.05, `${method} block ${b}`);
  }
});

test("(f) real scene, sky light: PT and PSSMLT agree on mean luminance and on 4x3 block means", (t) => {
  const opts = { lights: "sky", chains: 64 };
  const pt = render({ ...opts, method: "pt", seed: 5 }, 300000);
  const mlt = render({ ...opts, method: "mlt", seed: 5 }, 300000);
  const a = meanLuminance(pt.image);
  const b = meanLuminance(mlt.image);
  t.diagnostic(`mean luminance PT ${a.toPrecision(5)}, PSSMLT ${b.toPrecision(5)} (${(100 * relDiff(b, a)).toFixed(2)} %)`);
  assert.ok(relDiff(b, a) < 0.05, `mean luminance PT ${a} vs PSSMLT ${b}`);
  const ba = blockMeans(pt.image, 32, 24, 4, 3);
  const bb = blockMeans(mlt.image, 32, 24, 4, 3);
  t.diagnostic(`largest block difference ${(100 * Math.max(...ba.map((v, i) => relDiff(bb[i], v)))).toFixed(1)} %`);
  for (let i = 0; i < ba.length; i++) assert.ok(relDiff(bb[i], ba[i]) < 0.2, `block ${i}: PT ${ba[i]} vs PSSMLT ${bb[i]}`);
});

test("(f') real scene, wide sun only: PT and PSSMLT agree through the refractive caustic paths", (t) => {
  const opts = { lights: "sun", sunRadiusDegrees: 20, chains: 64 };
  const a = meanLuminance(render({ ...opts, method: "pt", seed: 9 }, 900000).image);
  const b = meanLuminance(render({ ...opts, method: "mlt", seed: 9 }, 700000).image);
  t.diagnostic(`mean luminance PT ${a.toPrecision(5)}, PSSMLT ${b.toPrecision(5)} (${(100 * relDiff(b, a)).toFixed(2)} %)`);
  assert.ok(relDiff(b, a) < 0.15, `mean luminance PT ${a} vs PSSMLT ${b}`);
});

test("(f'') NEE + MIS, NEE alone, BSDF sampling alone and PSSMLT agree where the sun lights a dry surface", (t) => {
  const opts = { water: false, lights: "sun", sunRadiusDegrees: 40 };
  const mis = meanLuminance(render({ ...opts, strategy: "mis", seed: 2 }, 1000000).image);
  const nee = meanLuminance(render({ ...opts, strategy: "nee", seed: 4 }, 1000000).image);
  const bsdf = meanLuminance(render({ ...opts, strategy: "bsdf", seed: 6 }, 1500000).image);
  const mlt = meanLuminance(render({ ...opts, method: "mlt", chains: 64, seed: 8 }, 400000).image);
  t.diagnostic(`MIS ${mis.toPrecision(5)}, NEE ${nee.toPrecision(5)}, BSDF ${bsdf.toPrecision(5)}, PSSMLT ${mlt.toPrecision(5)}`);
  assert.ok(relDiff(nee, mis) < 0.03, `NEE ${nee} vs MIS ${mis}`);
  assert.ok(relDiff(bsdf, mis) < 0.04, `BSDF ${bsdf} vs MIS ${mis}`);
  assert.ok(relDiff(mlt, mis) < 0.06, `PSSMLT ${mlt} vs MIS ${mis}`);
});

test("(f''') light tracing equals PT on the paths it covers (used to build the reference)", (t) => {
  const dry = { water: false, lights: "sun", sunRadiusDegrees: 4 };
  const lt = meanLuminance(render({ ...dry, method: "lt", seed: 1 }, 400000).image);
  const pt = meanLuminance(render({ ...dry, method: "pt", seed: 1 }, 1000000).image);
  t.diagnostic(`dry pool, 4 degree sun: LT ${lt.toPrecision(5)}, PT ${pt.toPrecision(5)}`);
  assert.ok(relDiff(lt, pt) < 0.03, `dry pool: LT ${lt} vs PT ${pt}`);
  const sky = { lights: "sky" };
  const ltSky = meanLuminance(render({ ...sky, method: "lt", seed: 2 }, 400000).image);
  const ptSky = meanLuminance(render({ ...sky, method: "pt", firstHit: "diffuse", seed: 2 }, 600000).image);
  t.diagnostic(`sky only: LT ${ltSky.toPrecision(5)}, PT (diffuse first hit) ${ptSky.toPrecision(5)}`);
  assert.ok(relDiff(ltSky, ptSky) < 0.03, `sky: LT ${ltSky} vs PT(diffuse first hit) ${ptSky}`);
});

test("(g) determinism: the same seed gives identical images, a different seed does not", () => {
  for (const method of ["pt", "mlt", "lt"]) {
    const opts = { method, chains: 16, bootstrapSamples: 5000 };
    const a = render({ ...opts, seed: 42 }, 30000).image;
    const b = render({ ...opts, seed: 42 }, 30000).image;
    const c = render({ ...opts, seed: 43 }, 30000).image;
    assert.deepEqual(a, b, `${method}: same seed, different image`);
    assert.notDeepEqual(a, c, `${method}: different seeds, same image`);
  }
});

test("helpers: tone map range and RMSE against a self-made reference", () => {
  const { image } = render({ method: "pt", seed: 1, lights: "sky" }, 20000);
  const grid = downsampleLuminance(image, 32, 24, 8, 6);
  const ref = { width: 8, height: 6, luminance: Array.from(grid) };
  assert.ok(luminanceRmse(image, 32, 24, ref).rmse < 1e-12);
  const rgba = toneMapToRGBA(image, 32, 24, 14);
  assert.equal(rgba.length, 32 * 24 * 4);
  assert.ok(rgba.every((v, i) => i % 4 !== 3 || v === 255));
});
