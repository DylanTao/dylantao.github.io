import * as THREE from "../three.module.min.js";

// The land past the modelled world (Sirui, 2026-10-19: "the seprate bewteen nearby and far away
// sceene can be better blended"). The house's coast ends: the mainland and the hinterland stop at
// their meshes, the camera's far plane cuts them at 300 to 430 m, and the haze used to dissolve
// everything past 180 m into a sky whose lower half was open sea in every direction, so the mesa
// ended in a flat sea-coloured wall with a hard line at the horizon.
//
// The far field is the same land at low resolution, ray-marched inside the sky dome behind
// everything the scene draws (atmosphere.mjs atmoBackground), so the land continues to the true
// horizon with parallax as the camera moves, the haze composite (haze.mjs) can dissolve the modelled
// land into it instead of into sea, and the reflections' capture sees it too. Two height sources:
//
// - Near, the modelled land itself: the mainland and the hinterland are drawn once from above into a
//   half-float target (2.2 m cells over 1.4 by 1.0 km), their top surface's height and kind, and
//   their planting's canopy height in a second target, so the far field matches what the scene
//   draws to the centimetre where the two overlap. Empty cells there are sea.
// - Far, a 320 x 320 map over 64 km generated on the CPU in short tasks, its cells growing with
//   distance (x = S u|u|): the hinterland's own regional surface (bin/coastal_hinterland.py
//   base_height, ported exactly) continued past its edges, with the coast continued north and south.
//
// Units are metres; x is north, z east (inland), y up, the sea at y = -7.35.

export const FAR_SEA_LEVEL = -7.35;
// The far map: S metres to each side of the house, N texels across.
export const FAR_MAP = Object.freeze({ extent: 32000, size: 320 });
// The near capture's rectangle (world x and z) and its texels, covering the hinterland and its sea.
export const FAR_NEAR = Object.freeze({ minX: -680, maxX: 740, minZ: -330, maxZ: 700, width: 640, height: 464 });
// The hinterland's extent (bin/coastal_hinterland.py EXTENT): past it the far map takes over.
const HINTERLAND = { minX: -660, maxX: 720, maxZ: 660 };

// ── The hinterland's regional surface, ported from bin/coastal_hinterland.py ──────────────────────
// Blender coordinates there: X north, Y west (toward the sea), Z up; here X = x and Y = -z.
const bell = (x, c, w) => Math.exp(-(((x - c) / w) ** 2));
const smooth = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
function hash(ix, iy, seed) {
  const v = Math.sin(ix * 127.1 + iy * 311.7 + seed * 74.7 + 13.1) * 43758.5453;
  return v - Math.floor(v);
}
function valueNoise(x, y, seed) {
  const ix = Math.floor(x),
    iy = Math.floor(y),
    fx = x - ix,
    fy = y - iy,
    ux = fx * fx * (3 - 2 * fx),
    uy = fy * fy * (3 - 2 * fy);
  const a = hash(ix, iy, seed),
    b = hash(ix + 1, iy, seed),
    c = hash(ix, iy + 1, seed),
    d = hash(ix + 1, iy + 1, seed);
  return (a * (1 - ux) + b * ux) * (1 - uy) + (c * (1 - ux) + d * ux) * uy;
}
const C61 = Math.cos(0.61),
  S61 = Math.sin(0.61);
export function fbm(x, y, octaves = 4, seed = 0) {
  let total = 0,
    amplitude = 0.5,
    norm = 0;
  for (let octave = 0; octave < octaves; octave++) {
    total += amplitude * valueNoise(x, y, seed + octave * 17);
    norm += amplitude;
    [x, y] = [(C61 * x - S61 * y) * 2.03 + 31.7, (S61 * x + C61 * y) * 2.03 - 11.3];
    amplitude *= 0.5;
  }
  return total / norm;
}
function mainlandDistance(X, Y) {
  const dx = Math.max(-36 - X, X - 76, 0),
    dy = Math.max(-32 - Y, 0);
  return Math.hypot(dx, dy);
}
// base_height(X, Y): the coastal mesa's terraces, the north mesa, the cove's backshore, the headland
// crown, the long hill inland and the drainage, exactly as the hinterland's mesh was built from it.
export function hinterlandBaseHeight(X, Y) {
  const inland = Math.max(0, 6 - Y);
  let h = 9.6 + 1.6 * (1 - Math.exp(-inland / 70)) + 0.006 * Math.max(0, inland - 90);
  const scarp1 = -205 + 26 * Math.sin(X / 140 + 0.6) + 10 * Math.sin(X / 47),
    scarp2 = -385 + 30 * Math.sin(X / 170 + 2.1) + 12 * Math.sin(X / 61);
  h += 6.5 * smooth(scarp1 + 14, scarp1 - 14, Y) + 7.5 * smooth(scarp2 + 16, scarp2 - 16, Y);
  const north = smooth(96, 215, X);
  h += 14.5 * north * (1 - 0.3 * smooth(-200, -520, Y));
  h -= 3.6 * bell(X, -80, 26) * bell(Y, -4, 40);
  h += 5.5 * bell(X, -126, 34) * bell(Y, 26, 26);
  h += 3 * bell(X, -332, 40) * bell(Y, 52, 40);
  const c = Math.cos((32 * Math.PI) / 180),
    s = Math.sin((32 * Math.PI) / 180),
    u = c * (X + 210) + s * (Y + 445),
    v = -s * (X + 210) + c * (Y + 445);
  h += 66 * Math.exp(-((u / 240) ** 2) - (v / 105) ** 2) * (0.85 + 0.3 * fbm(X / 60, Y / 60, 3, 4));
  h += 24 * Math.exp(-(((X + 20) / 160) ** 2) - ((Y + 570) / 80) ** 2);
  h += 1.8 * (fbm(X / 130, Y / 130, 4, 1) - 0.5);
  h += 0.5 * (fbm(X / 26, Y / 26, 3, 2) - 0.5);
  const rill = 1 - Math.abs(2 * fbm(X / 34, Y / 22, 3, 3) - 1);
  h -= 0.9 * rill ** 6 * smooth(40, 90, mainlandDistance(X, Y));
  h += 0.7 * (fbm(X / 7.5, Y / 7.5, 3, 31) - 0.5) * smooth(6, 20, mainlandDistance(X, Y));
  return h;
}

// ── The land past the hinterland ─────────────────────────────────────────────────────────────────
// How far a point lies outside the hinterland's extent (0 inside).
export function outsideHinterland(x, z) {
  const dx = Math.max(HINTERLAND.minX - x, x - HINTERLAND.maxX, 0),
    dz = Math.max(z - HINTERLAND.maxZ, 0);
  return Math.hypot(dx, dz);
}
// The cliff foot's z along the coast: the hinterland's own coast ends at z -11 (south, x -660) and
// -12.6 (north, x 720); past them the shore keeps its line, drifting west to the north as the
// Torrey Pines bluffs do and easing into a long bay to the south.
export function coastLine(x) {
  if (x >= 720) return -12.6 - 0.035 * (x - 720) - 260 * smooth(3000, 14000, x) - 0.12 * Math.max(0, x - 14000);
  if (x <= -660) return -11 - 0.02 * (-660 - x) - 140 * bell(x, -2300, 900) * smooth(-660, -1200, x) + 90 * smooth(-3000, -9000, x);
  return -11 - 1.6 * smooth(-660, 720, x);
}
// The regional surface's height (world y) at any point, sea included (below FAR_SEA_LEVEL).
export function regionalHeight(x, z) {
  const outside = outsideHinterland(x, z),
    w = smooth(0, 500, outside);
  let h = hinterlandBaseHeight(x, -z);
  if (w > 0) {
    // Inland the mesa keeps rising toward the higher terraces of University City, gently rolling.
    const inland = Math.max(0, z);
    h += w * (62 * smooth(600, 6500, inland) + 16 * (fbm(x / 1100, z / 1100, 3, 41) - 0.5) + 5 * (fbm(x / 260, z / 260, 3, 43) - 0.5));
  }
  // The shore: a cliff face rising from below the sea over 30 m inland of the coast line.
  const coast = z - coastLine(x);
  if (coast < 30)
    h = coast < 0 ? FAR_SEA_LEVEL - 4 - Math.min(-coast, 400) * 0.02 : FAR_SEA_LEVEL - 4 + (h - FAR_SEA_LEVEL + 4) * smooth(0, 30, coast);
  return h;
}
// Chaparral cover (0 bare soil and sand to 1 dense scrub) and bare rock, for the far map's shading.
export function regionalCover(x, z, h) {
  const scrub = smooth(0.38, 0.7, fbm(x / 140, z / 140, 3, 7)) * 0.75 + 0.25 * smooth(0.45, 0.75, fbm(x / 33, z / 33, 2, 9));
  const coast = z - coastLine(x),
    bluff = coast > 0 && coast < 45 ? 1 - smooth(10, 45, coast) : 0;
  return { scrub: h > FAR_SEA_LEVEL ? scrub * (1 - bluff) : 0, rock: bluff };
}

// The far map's texel centres in world space: x = S u |u| for u in (-1, 1).
export const farMapCoordinate = (i, size = FAR_MAP.size, extent = FAR_MAP.extent) => {
  const u = ((i + 0.5) / size) * 2 - 1;
  return extent * u * Math.abs(u);
};
// The far map as RGBA floats (height, scrub, lights, rock), row by row, yielding between batches of
// rows so the page stays responsive. `yieldTask` resolves when the next batch may run.
export async function buildFarMap({
  size = FAR_MAP.size,
  extent = FAR_MAP.extent,
  rowsPerTask = 20,
  yieldTask = null,
  shouldContinue = () => true,
} = {}) {
  const data = new Float32Array(size * size * 4),
    coordinates = Array.from({ length: size }, (_, i) => farMapCoordinate(i, size, extent));
  for (let row = 0; row < size; row++) {
    const z = coordinates[row];
    for (let column = 0; column < size; column++) {
      const x = coordinates[column],
        h = regionalHeight(x, z),
        cover = regionalCover(x, z, h),
        k = (row * size + column) * 4;
      data[k] = h;
      data[k + 1] = cover.scrub;
      data[k + 2] = 0;
      data[k + 3] = cover.rock;
    }
    if (yieldTask && row % rowsPerTask === rowsPerTask - 1) {
      await yieldTask();
      if (!shouldContinue()) return null;
    }
  }
  return data;
}

// ── GLSL ────────────────────────────────────────────────────────────────────────────────────────
// The march and the shading, shared by the dome, the haze composite and the stars (which hide
// behind far hills). atmosphere.mjs includes it behind ATMO_FAR_FIELD and binds the uniforms.
export const farFieldGLSL = `
uniform sampler2D farMap, farNear, farCanopy;
uniform vec4 farNearBounds, farParams;
uniform float farSteps;
// The far map's warped coordinates: u = sign(x) sqrt(|x| / S).
vec2 farMapUv(vec2 xz) {
  vec2 u = sign(xz) * sqrt(min(abs(xz) / farParams.x, vec2(1.0)));
  return u * 0.5 + 0.5;
}
float farHash(vec2 c) { return fract(sin(dot(c, vec2(127.1, 311.7))) * 43758.5453); }
vec2 farNearUv(vec2 xz) {
  return vec2((xz.x - farNearBounds.x) * farNearBounds.z, (farNearBounds.y - xz.y) * farNearBounds.w);
}
// Height of the ground (world y) under xz. Inside the capture
// a cell's alpha says whether anything was drawn there (filtered heights are divided by it, so the
// coast's edge keeps its height); an empty cell is the far map's land until the hinterland is in,
// and sea once it is (farParams.z: 0 no capture, 1 the mainland only, 2 the whole modelled land).
float farSurface(vec2 xz) {
  vec2 nuv = farNearUv(xz);
  if (farParams.z > 0.5 && all(greaterThan(nuv, vec2(0.0))) && all(lessThan(nuv, vec2(1.0)))) {
    vec4 near = textureLod(farNear, nuv, 0.0);
    float edge = min(min(nuv.x, 1.0 - nuv.x), min(nuv.y, 1.0 - nuv.y));
    float far = farParams.z < 1.5 || edge < 0.015 ? textureLod(farMap, farMapUv(xz), 0.0).r : 0.0;
    float ground = near.a > 0.5 ? near.r / near.a : farParams.z > 1.5 ? ${(FAR_SEA_LEVEL - 4).toFixed(2)} : far;
    // A heightfield cannot hold a crown over open ground, so planting only colours the land.
    return edge < 0.015 ? mix(far, ground, smoothstep(0.0, 0.015, edge)) : ground;
  }
  return textureLod(farMap, farMapUv(xz), 0.0).r;
}
// Distance along d from eye to the first land the ray meets (or -1), before tMax. Earth's curvature
// (with the usual 13 % of it undone by refraction) lowers the land with distance. A ray that starts
// inside the land (an eye in the cave, the reflections' capture point) first walks out of it.
float farMarch(vec3 eye, vec3 d, float tMax) {
  if (farParams.y < 0.5 || d.y > farParams.w) return -1.0;
  float drop = 0.87 / (2.0 * 6371000.0);
  float t = 2.0;
  int steps = int(farSteps);
  bool outside = eye.y > farSurface(eye.xz);
  float previous = t;
  for (int i = 0; i < steps; i++) {
    if (t > tMax) break;
    vec3 p = eye + d * t;
    float gap = p.y - drop * t * t - farSurface(p.xz);
    if (!outside) {
      if (gap > 0.5) outside = true;
      if (i > 40) return -1.0;
      previous = t;
      t += 3.0;
      continue;
    }
    if (gap < 0.0) {
      float a = previous, b = t;
      for (int k = 0; k < 6; k++) {
        float m = 0.5 * (a + b);
        vec3 q = eye + d * m;
        if (q.y - drop * m * m - farSurface(q.xz) < 0.0) b = m; else a = m;
      }
      return 0.5 * (a + b);
    }
    previous = t;
    // Big steps where the ray is high above the land, smaller near it (a slope bound of about 2), and
    // never under 3.5 % of the distance, so a ray grazing the mesa still reaches the hills behind it.
    t += max(0.6 + t * 0.035, min(gap * 0.5, 40.0 + t * 0.12));
  }
  return -1.0;
}
// The land's own light at a hit: albedo from the near capture's kind and planting or the far map's
// cover, lit by the sun, the moon and the sky as the scene's terrain is (Lambert).
vec3 farLandRadiance(vec3 eye, vec3 d, float t) {
  vec3 p = eye + d * t;
  float e = max(1.2, t * 0.0035);
  float hx = farSurface(p.xz + vec2(e, 0.0)) - farSurface(p.xz - vec2(e, 0.0));
  float hz = farSurface(p.xz + vec2(0.0, e)) - farSurface(p.xz - vec2(0.0, e));
  vec3 n = normalize(vec3(-hx, 2.0 * e, -hz));
  vec4 info = textureLod(farMap, farMapUv(p.xz), 0.0);
  float scrub = info.g, rock = info.a, sand = 0.0;
  vec2 nuv = farNearUv(p.xz);
  if (farParams.z > 0.5 && all(greaterThan(nuv, vec2(0.0))) && all(lessThan(nuv, vec2(1.0)))) {
    vec4 near = textureLod(farNear, nuv, 0.0);
    vec4 plant = textureLod(farCanopy, nuv, 0.0);
    float kind = near.a > 0.5 ? near.g / near.a : 0.0;
    sand = near.a > 0.5 && kind > 0.25 && kind < 0.75 ? 1.0 : 0.0;
    rock = near.a > 0.5 && kind > 0.75 ? 1.0 : 0.0;
    // Planting darkens the ground under it.
    scrub = clamp(plant.a, 0.0, 1.0) * 0.55;
  }
  // Chaparral and bare soil in patches a few metres across, faded out where a pixel spans them.
  vec2 cell = floor(p.xz / 7.0), f = fract(p.xz / 7.0);
  f = f * f * (3.0 - 2.0 * f);
  float speckle = mix(mix(farHash(cell), farHash(cell + vec2(1.0, 0.0)), f.x), mix(farHash(cell + vec2(0.0, 1.0)), farHash(cell + 1.0), f.x), f.y);
  scrub = clamp(scrub + (speckle - 0.5) * 0.7 * (1.0 - smoothstep(600.0, 2500.0, t)), 0.0, 1.0);
  float steep = 1.0 - smoothstep(0.55, 0.85, n.y);
  vec3 soil = vec3(0.40, 0.31, 0.21), chaparral = vec3(0.12, 0.14, 0.085), stone = vec3(0.56, 0.42, 0.29), beach = vec3(0.70, 0.60, 0.44);
  vec3 albedo = mix(soil, chaparral, scrub * (1.0 - steep));
  albedo = mix(albedo, stone, max(rock, steep * 0.8));
  albedo = mix(albedo, beach, sand);
  vec3 light = atmoSunLight * max(dot(n, atmoSun), 0.0) + atmoMoonLight * max(dot(n, atmoMoon), 0.0)
    + ATMO_PI * atmoAmbient * (0.62 + 0.38 * n.y);
  vec3 radiance = albedo / ATMO_PI * light;
  // The air beyond the coast's own haze layer: extinction of about 0.06 per km near the ground,
  // in-scattering the horizon sky's colour.
  float air = exp(-t * 0.00006 * exp(-max(p.y, 0.0) / 1200.0));
  return radiance * air + (1.0 - air) * atmoSkyRadiance(vec3(d.x, max(d.y, 0.01), d.z));
}
`;

// The capture's shader: the top surface's height and kind (0 soil, 0.5 sand, 1 rock), or the
// planting's canopy height and cover.
const captureVertex = `
varying float vHeight;
void main() {
  vec4 world = modelMatrix * vec4(position, 1.0);
  vHeight = world.y;
  gl_Position = projectionMatrix * viewMatrix * world;
}`;
const captureFragment = `
uniform float captureKind;
varying float vHeight;
void main() { gl_FragColor = vec4(vHeight, captureKind, 0.0, 1.0); }`;
// What moves or flies is left out (the gliders, the wind sock).
const AIRBORNE = /glider|windsock|sock|harness|sail|helmet/i;
const PLANT =
  /canopy|leaf|leaves|foliage|needle|frond|grass|flora|scrub|pine|palm|sage|shrub|agave|cactus|prickly|yucca|iceplant|daisy|oat|berry|bush|trunk|bark|branch/i;
const ROCK = /sandstone|bluff|stone|rock|badland/i;
const SAND = /beach sand|tideline|sand\b/i;

export function farFieldUniforms() {
  const placeholder = new THREE.DataTexture(new Float32Array([-100, 0, 0, 0]), 1, 1, THREE.RGBAFormat, THREE.FloatType);
  placeholder.needsUpdate = true;
  return {
    farMap: { value: placeholder },
    farNear: { value: placeholder },
    farCanopy: { value: placeholder },
    farNearBounds: {
      value: new THREE.Vector4(FAR_NEAR.minX, FAR_NEAR.maxZ, 1 / (FAR_NEAR.maxX - FAR_NEAR.minX), 1 / (FAR_NEAR.maxZ - FAR_NEAR.minZ)),
    },
    // extent, far map ready, near capture ready, the steepest ray that can meet land (d.y)
    farParams: { value: new THREE.Vector4(FAR_MAP.extent, 0, 0, 0.16) },
    farSteps: { value: 128 },
  };
}

// `uniforms` are atmosphere.mjs's (farFieldUniforms among them), shared with the dome, the haze
// composite and the stars.
export function createFarField(renderer, uniforms, { yieldTask = () => new Promise((resolve) => setTimeout(resolve, 0)) } = {}) {
  let disposed = false,
    farTexture = null,
    report = { far: "building", near: "waiting for the hinterland" };
  const started = performance.now();
  const ready = buildFarMap({ yieldTask, shouldContinue: () => !disposed }).then((data) => {
    if (!data || disposed) return;
    const halves = new Uint16Array(data.length);
    for (let i = 0; i < data.length; i++) halves[i] = THREE.DataUtils.toHalfFloat(data[i]);
    farTexture = new THREE.DataTexture(halves, FAR_MAP.size, FAR_MAP.size, THREE.RGBAFormat, THREE.HalfFloatType);
    farTexture.minFilter = farTexture.magFilter = THREE.LinearFilter;
    farTexture.wrapS = farTexture.wrapT = THREE.ClampToEdgeWrapping;
    farTexture.generateMipmaps = false;
    farTexture.needsUpdate = true;
    uniforms.farMap.value = farTexture;
    uniforms.farParams.value.y = 1;
    report.far = { ready: true, milliseconds: Math.round(performance.now() - started), size: FAR_MAP.size, extent: FAR_MAP.extent };
  });
  const targets = [0, 1].map(
    () =>
      new THREE.WebGLRenderTarget(FAR_NEAR.width, FAR_NEAR.height, {
        type: THREE.HalfFloatType,
        format: THREE.RGBAFormat,
        minFilter: THREE.LinearFilter,
        magFilter: THREE.LinearFilter,
        generateMipmaps: false,
        depthBuffer: true,
      })
  );
  const materials = [0, 0.5, 1].map(
    (kind) =>
      new THREE.ShaderMaterial({
        side: THREE.DoubleSide,
        uniforms: { captureKind: { value: kind } },
        vertexShader: captureVertex,
        fragmentShader: captureFragment,
      })
  );
  const plantMaterial = new THREE.ShaderMaterial({
    side: THREE.DoubleSide,
    uniforms: { captureKind: { value: 1 } },
    vertexShader: captureVertex,
    fragmentShader: captureFragment,
  });
  const top = 400,
    camera = new THREE.OrthographicCamera(
      -(FAR_NEAR.maxX - FAR_NEAR.minX) / 2,
      (FAR_NEAR.maxX - FAR_NEAR.minX) / 2,
      (FAR_NEAR.maxZ - FAR_NEAR.minZ) / 2,
      -(FAR_NEAR.maxZ - FAR_NEAR.minZ) / 2,
      1,
      top + 40
    );
  // Straight down with up = -Z: screen right is +x and screen up is -z, so v = (maxZ - z) / depth.
  camera.position.set((FAR_NEAR.minX + FAR_NEAR.maxX) / 2, top, (FAR_NEAR.minZ + FAR_NEAR.maxZ) / 2);
  camera.up.set(0, 0, -1);
  camera.lookAt(camera.position.x, 0, camera.position.z);
  camera.updateMatrixWorld(true);
  // Draw the land and its planting under `roots` from above (the mainland, the hinterland).
  // `complete` is true once the hinterland is among them: then an empty cell is sea.
  function captureNear(roots, complete = true) {
    if (disposed) return null;
    const ground = new THREE.Scene(),
      plants = new THREE.Scene();
    let meshes = 0;
    for (const root of roots.filter(Boolean)) {
      root.updateWorldMatrix(true, true);
      root.traverse((object) => {
        if (!object.isMesh || object.isSkinnedMesh || !object.geometry?.attributes?.position || object.userData.outline) return;
        const material = [object.material].flat()[0];
        if (!material || material.transparent || material.transmission > 0) return;
        const name = `${material.name || ""} ${object.name || ""}`;
        if (AIRBORNE.test(name) || object.userData.glider || object.parent?.userData?.glider) return;
        const kind = PLANT.test(name),
          proxy = object.isInstancedMesh
            ? new THREE.InstancedMesh(object.geometry, kind ? plantMaterial : materials[0], object.count)
            : new THREE.Mesh(object.geometry, kind ? plantMaterial : materials[ROCK.test(name) ? 2 : SAND.test(name) ? 1 : 0]);
        if (object.isInstancedMesh) proxy.instanceMatrix = object.instanceMatrix;
        proxy.matrixAutoUpdate = false;
        proxy.matrix.copy(object.matrixWorld);
        proxy.frustumCulled = false;
        (kind ? plants : ground).add(proxy);
        meshes++;
      });
    }
    if (!meshes) return null;
    const previousTarget = renderer.getRenderTarget(),
      previousClear = renderer.getClearColor(new THREE.Color()),
      previousAlpha = renderer.getClearAlpha(),
      previousAutoClear = renderer.autoClear,
      previousShadows = renderer.shadowMap.autoUpdate;
    try {
      renderer.shadowMap.autoUpdate = false;
      renderer.autoClear = true;
      // Cleared cells have alpha 0: nothing was drawn there.
      renderer.setClearColor(0x000000, 0);
      [ground, plants].forEach((scene, i) => {
        renderer.setRenderTarget(targets[i]);
        renderer.clear();
        renderer.render(scene, camera);
      });
    } finally {
      renderer.setRenderTarget(previousTarget);
      renderer.setClearColor(previousClear, previousAlpha);
      renderer.autoClear = previousAutoClear;
      renderer.shadowMap.autoUpdate = previousShadows;
    }
    uniforms.farNear.value = targets[0].texture;
    uniforms.farCanopy.value = targets[1].texture;
    uniforms.farParams.value.z = complete ? 2 : 1;
    report.near = {
      ready: true,
      complete,
      meshes,
      cells: [FAR_NEAR.width, FAR_NEAR.height],
      metres: +((FAR_NEAR.maxX - FAR_NEAR.minX) / FAR_NEAR.width).toFixed(2),
    };
    return report.near;
  }
  return {
    ready,
    captureNear,
    // The steepest ray that can still meet land, for the camera's height: rays above it skip the march.
    setEye(height) {
      uniforms.farParams.value.w = Math.min(0.6, Math.max(0.12, (250 - height) / 400));
    },
    evidence: () => ({
      method: "the modelled land drawn from above, and the hinterland's regional surface continued to 32 km, ray-marched inside the dome",
      ...report,
    }),
    dispose() {
      disposed = true;
      targets.forEach((t) => t.dispose());
      materials.forEach((m) => m.dispose());
      plantMaterial.dispose();
      farTexture?.dispose();
    },
  };
}
