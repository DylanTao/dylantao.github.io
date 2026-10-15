import * as THREE from "../three.module.min.js";
import { mergeGeometries } from "../vendor/three-r164/utils/BufferGeometryUtils.js";

// Light installations that switch with the time of day (Sirui, 2026-10-14). Each fixture is an
// emitter shaded analytically in every material, bounded by a box so it cannot light rooms
// through walls, and driven by a schedule:
//   festoon  bulbs strung around the terrace, from dusk to half past eleven;
//   fire     the fire bowl by the terrace bench, flickering through the evening;
//   soffit   a concealed strip under the gallery edge washing the living floor's back wall;
//   steps    low lights beside the stair, a dim guide all night;
//   pool     a light in the onsen's wall that makes the water glow, brightest during the soak.
// Line emitters use the exact irradiance of a uniformly emitting segment on a Lambertian
// surface, clipped to the surface's upper hemisphere: E = I |d| (2/D) [n0((2A+B)/|L1| - B/|L0|) -
// n1((B+2C)/|L1| - 2C/|L0|)], with L(t) = L0 + t d, A = d.d, B = 2 L0.d, C = L0.L0,
// D = 4AC - B^2, n0 = N.L0 and n1 = N.d (a closed form of the integral of N.L / |L|^3 along t).
// Points are isotropic or cone-limited. No installation casts shadows or adds a baked bounce.

export const MAX_LINES = 10;
export const MAX_POINTS = 4;
const WARM = new THREE.Color(1, 0.7, 0.42);
const FIRE = new THREE.Color(1, 0.46, 0.16);
const POOL = new THREE.Color(0.42, 0.86, 0.9);

const smooth = (edge0, edge1, x) => {
  const t = THREE.MathUtils.clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
};
// 1 between start and end (minutes after midnight, wrapping past midnight), fading in over the
// window's first `fade` minutes and out over its last.
export function windowLevel(minute, start, end, fade = 15) {
  const span = (end - start + 1440) % 1440;
  const into = (minute - start + 1440) % 1440;
  if (into > span) return 0;
  return Math.max(0, Math.min(1, into / fade, (span - into) / fade));
}

// How dark it is outside (0 by day, 1 at night) and inside the cave, which dims sooner.
export function darkness(daylight) {
  return { outside: smooth(0.32, 0.08, daylight), inside: smooth(0.55, 0.15, daylight) };
}

export const SCHEDULES = {
  festoon: ({ minute, dark }) => dark.outside * windowLevel(minute, 16 * 60, 23 * 60 + 30, 20),
  fire: ({ minute, dark }) => dark.outside * windowLevel(minute, 19 * 60 + 30, 22 * 60 + 45, 12),
  soffit: ({ minute, dark, activity }) =>
    dark.inside * Math.max(windowLevel(minute, 17 * 60 + 30, 23 * 60 + 30, 25), activity === "coding" ? 0.35 : 0),
  steps: ({ dark }) => 0.45 * dark.outside,
  pool: ({ minute, dark, activity }) => (activity === "soak" ? 1 : 0.4 * dark.outside * windowLevel(minute, 19 * 60, 23 * 60, 20)),
};

// The same closed form in JavaScript (THREE.Vector3 arguments), mirrored line for line by the
// shader below; the tests check it against brute-force integration.
export function lineIrradiance(p, n, a, b) {
  let l0 = a.clone().sub(p),
    l1 = b.clone().sub(p);
  const d0 = n.dot(l0),
    d1 = n.dot(l1);
  if (d0 <= 0 && d1 <= 0) return 0;
  if (d0 < 0) l0 = l0.clone().lerp(l1, d0 / (d0 - d1));
  else if (d1 < 0) l1 = l0.clone().lerp(l1, d0 / (d0 - d1));
  const d = l1.clone().sub(l0);
  const A = d.dot(d),
    B = 2 * l0.dot(d),
    C = l0.dot(l0);
  const D = Math.max(4 * A * C - B * B, 1e-7);
  const q0 = Math.sqrt(Math.max(C, 1e-6)),
    q1 = Math.sqrt(Math.max(A + B + C, 1e-6));
  const n0 = Math.max(n.dot(l0), 0),
    n1 = n.dot(d);
  const f = (2 / D) * (n0 * ((2 * A + B) / q1 - B / q0) - n1 * ((B + 2 * C) / q1 - (2 * C) / q0));
  return Math.max(f, 0) * Math.sqrt(A);
}

const LINE_GLSL = /* glsl */ `
float installationLine(vec3 p, vec3 n, vec3 a, vec3 b) {
  vec3 l0 = a - p, l1 = b - p;
  float d0 = dot(n, l0), d1 = dot(n, l1);
  if (d0 <= 0.0 && d1 <= 0.0) return 0.0;
  if (d0 < 0.0) l0 = mix(l0, l1, d0 / (d0 - d1));
  else if (d1 < 0.0) l1 = mix(l0, l1, d0 / (d0 - d1));
  vec3 d = l1 - l0;
  float A = dot(d, d), B = 2.0 * dot(l0, d), C = dot(l0, l0);
  float D = max(4.0 * A * C - B * B, 1e-7);
  float q0 = sqrt(max(C, 1e-6)), q1 = sqrt(max(A + B + C, 1e-6));
  float n0 = max(dot(n, l0), 0.0), n1 = dot(n, d);
  float f = (2.0 / D) * (n0 * ((2.0 * A + B) / q1 - B / q0) - n1 * ((B + 2.0 * C) / q1 - 2.0 * C / q0));
  return max(f, 0.0) * sqrt(A);
}
bool installationInside(vec3 p, vec3 lo, vec3 hi) {
  return all(greaterThanEqual(p, lo)) && all(lessThanEqual(p, hi));
}
vec3 installationIrradiance(vec3 p, vec3 n) {
  vec3 sum = vec3(0.0);
  for (int i = 0; i < ${MAX_LINES}; i++) {
    if (installLineColor[i].r + installLineColor[i].g + installLineColor[i].b <= 0.0) continue;
    if (!installationInside(p, installLineMin[i], installLineMax[i])) continue;
    sum += installLineColor[i] * installationLine(p, n, installLineA[i], installLineB[i]);
  }
  for (int i = 0; i < ${MAX_POINTS}; i++) {
    if (installPointColor[i].r + installPointColor[i].g + installPointColor[i].b <= 0.0) continue;
    if (!installationInside(p, installPointMin[i], installPointMax[i])) continue;
    vec3 l = installPointPosition[i] - p;
    float r2 = max(dot(l, l), 1e-4);
    vec3 dir = l * inversesqrt(r2);
    float cone = installPointCone[i].w > 0.0 ? smoothstep(installPointCone[i].w, 1.0, dot(-dir, installPointCone[i].xyz)) : 1.0;
    sum += installPointColor[i] * max(dot(n, dir), 0.0) * cone / r2;
  }
  return sum;
}`;

export function createLightInstallations(config, { bind = (m) => m } = {}) {
  const uniforms = {
    installLineA: { value: Array.from({ length: MAX_LINES }, () => new THREE.Vector3()) },
    installLineB: { value: Array.from({ length: MAX_LINES }, () => new THREE.Vector3()) },
    installLineColor: { value: Array.from({ length: MAX_LINES }, () => new THREE.Vector3()) },
    installLineMin: { value: Array.from({ length: MAX_LINES }, () => new THREE.Vector3()) },
    installLineMax: { value: Array.from({ length: MAX_LINES }, () => new THREE.Vector3()) },
    installPointPosition: { value: Array.from({ length: MAX_POINTS }, () => new THREE.Vector3()) },
    installPointColor: { value: Array.from({ length: MAX_POINTS }, () => new THREE.Vector3()) },
    installPointCone: { value: Array.from({ length: MAX_POINTS }, () => new THREE.Vector4()) },
    installPointMin: { value: Array.from({ length: MAX_POINTS }, () => new THREE.Vector3()) },
    installPointMax: { value: Array.from({ length: MAX_POINTS }, () => new THREE.Vector3()) },
    installActive: { value: 0 },
  };
  const terrace = config.terrace;
  const box = (min, max) => ({ min: new THREE.Vector3(...min), max: new THREE.Vector3(...max) });
  // Emitter geometry (three.js axes: x, up, -Blender y). Intensities are per metre for lines.
  const lines = [];
  const points = [];
  if (terrace?.festoon) {
    const region = box([-5.6, -0.12, -7.9], [5.6, 3.6, -2.2]);
    const anchors = terrace.festoon.points.map((p) => new THREE.Vector3(...p));
    for (let i = 0; i + 1 < anchors.length; i++) {
      const a = anchors[i],
        b = anchors[i + 1];
      const sag = (terrace.festoon.sag * a.distanceTo(b)) / 3;
      // Two chords per swag, through the swag's lowest point, at the bulbs' height under the cable.
      const middle = a
        .clone()
        .lerp(b, 0.5)
        .add(new THREE.Vector3(0, -sag - 0.085, 0));
      const drop = new THREE.Vector3(0, -0.085, 0);
      lines.push({ id: "festoon", a: a.clone().add(drop), b: middle, intensity: 0.42, color: WARM, region });
      lines.push({ id: "festoon", a: middle, b: b.clone().add(drop), intensity: 0.42, color: WARM, region });
    }
  }
  // Under the gallery's front edge, the full width of the living floor.
  lines.push({
    id: "soffit",
    a: new THREE.Vector3(-4.45, 2.3, 1.42),
    b: new THREE.Vector3(4.45, 2.3, 1.42),
    intensity: 0.55,
    color: WARM,
    region: box([-5.25, -0.1, -1.2], [5.25, 2.34, 5.6]),
  });
  // Beside the stair, a hand's width above the treads, from the foot to the landing.
  const stairs = config.navigation?.stairs || [];
  if (stairs.length > 2) {
    const foot = new THREE.Vector3(...stairs[1]),
      top = new THREE.Vector3(...stairs[stairs.length - 3]);
    lines.push({
      id: "steps",
      a: foot.clone().add(new THREE.Vector3(0, 0.28, 0.62)),
      b: top.clone().add(new THREE.Vector3(0, 0.28, 0.62)),
      intensity: 0.28,
      color: WARM,
      region: box([-2.6, -0.1, 3.7], [2.6, 3.4, 5.7]),
    });
  }
  if (terrace?.fire) {
    points.push({
      id: "fire",
      position: new THREE.Vector3(terrace.fire[0], terrace.fire[1] + 0.2, terrace.fire[2]),
      intensity: 2.2,
      color: FIRE,
      cone: null,
      region: box([-5.6, -0.12, -7.9], [5.6, 3.6, -2.2]),
    });
  }
  points.push({
    id: "pool",
    position: new THREE.Vector3(3.17, 2.75, 3.18),
    intensity: 1.4,
    color: POOL,
    cone: null,
    region: box([1.9, 2.0, 1.2], [5.6, 5.0, 5.6]),
  });

  // Fixtures the installations need beyond the shell: the soffit's diffuser and the step lights.
  const root = new THREE.Group();
  root.name = "Light installations";
  const glow = (color) =>
    bind(new THREE.MeshStandardMaterial({ name: "installation diffuser", color: 0x111111, roughness: 0.6, emissive: color, emissiveIntensity: 0 }));
  const soffitMaterial = glow(WARM),
    stepMaterial = glow(WARM),
    poolMaterial = glow(POOL);
  const strip = new THREE.BoxGeometry(8.9, 0.012, 0.03);
  strip.translate(0, 2.338, 1.42);
  const soffitMesh = new THREE.Mesh(strip, soffitMaterial);
  soffitMesh.name = "Gallery soffit light";
  const steps = [];
  const stepLine = lines.find((l) => l.id === "steps");
  if (stepLine) {
    for (let k = 0; k <= 5; k++) {
      const marker = new THREE.BoxGeometry(0.08, 0.035, 0.01);
      const at = stepLine.a.clone().lerp(stepLine.b, k / 5);
      marker.translate(at.x, at.y, at.z + 0.2);
      steps.push(marker);
    }
  }
  const stepMesh = steps.length ? new THREE.Mesh(mergeGeometries(steps), stepMaterial) : null;
  steps.forEach((g) => g.dispose());
  if (stepMesh) stepMesh.name = "Stair step lights";
  const lens = new THREE.CircleGeometry(0.07, 24);
  const poolMesh = new THREE.Mesh(lens, poolMaterial);
  poolMesh.name = "Onsen pool light";
  for (const mesh of [soffitMesh, stepMesh, poolMesh].filter(Boolean)) {
    mesh.userData.staticLightFixture = true;
    mesh.castShadow = false;
    root.add(mesh);
  }

  // Shell materials that glow with their installation.
  const glowing = { festoon: [], fire: [] };
  function bindModel(model) {
    model.traverse((o) => {
      if (!o.isMesh) return;
      for (const m of [o.material].flat()) {
        if (m.name === "festoon bulb glass" && !glowing.festoon.includes(m)) glowing.festoon.push(m);
        if (m.name === "fire bowl embers" && !glowing.fire.includes(m)) glowing.fire.push(m);
      }
    });
  }

  let pool = null;
  function setPool(center, radius, surfaceY, depth) {
    // The lamp sits in the pool wall on the far side from the onsen camera, a third of the way down.
    pool = { center, radius, surfaceY, depth };
    const lamp = points.find((p) => p.id === "pool");
    lamp.position.set(center[0] + radius * 0.92, surfaceY - Math.max(0.12, depth * 0.35), center[1]);
    poolMesh.position.copy(lamp.position);
    poolMesh.lookAt(center[0], lamp.position.y, center[1]);
  }

  const levels = Object.fromEntries(Object.keys(SCHEDULES).map((id) => [id, 0]));
  let flicker = 1;
  function apply() {
    lines.forEach((line, i) => {
      uniforms.installLineA.value[i].copy(line.a);
      uniforms.installLineB.value[i].copy(line.b);
      uniforms.installLineMin.value[i].copy(line.region.min);
      uniforms.installLineMax.value[i].copy(line.region.max);
      uniforms.installLineColor.value[i].set(line.color.r, line.color.g, line.color.b).multiplyScalar(line.intensity * levels[line.id]);
    });
    points.forEach((point, i) => {
      const level = levels[point.id] * (point.id === "fire" ? flicker : 1);
      uniforms.installPointPosition.value[i].copy(point.position);
      uniforms.installPointMin.value[i].copy(point.region.min);
      uniforms.installPointMax.value[i].copy(point.region.max);
      uniforms.installPointCone.value[i].set(0, -1, 0, 0);
      uniforms.installPointColor.value[i].set(point.color.r, point.color.g, point.color.b).multiplyScalar(point.intensity * level);
    });
    soffitMaterial.emissiveIntensity = 2.4 * levels.soffit;
    stepMaterial.emissiveIntensity = 3 * levels.steps;
    poolMaterial.emissiveIntensity = 4 * levels.pool;
    // By day every installation is off and the shader term is skipped outright.
    uniforms.installActive.value = Object.values(levels).some((level) => level > 0) ? 1 : 0;
    for (const m of glowing.festoon) {
      m.emissive?.copy(WARM);
      m.emissiveIntensity = 5 * levels.festoon;
    }
    for (const m of glowing.fire) {
      m.emissive?.copy(FIRE);
      m.emissiveIntensity = 3.2 * levels.fire * flicker;
    }
  }

  const bindings = new WeakSet();
  return {
    root,
    uniforms,
    lines,
    points,
    bindModel,
    setPool,
    // minute after midnight, daylight 0..1, the routine's activity id.
    update({ minute, daylight, activity }) {
      const dark = darkness(daylight);
      for (const [id, schedule] of Object.entries(SCHEDULES)) levels[id] = THREE.MathUtils.clamp(schedule({ minute, dark, activity }), 0, 1);
      apply();
      return levels;
    },
    // Two incommensurate sines and a faster ripple: a fire never repeats on a visible period.
    tick(seconds, moving) {
      if (!levels.fire) return false;
      const next = moving ? 0.86 + 0.08 * Math.sin(seconds * 7.3) + 0.05 * Math.sin(seconds * 13.1 + 1.7) + 0.03 * Math.sin(seconds * 31.7) : 1;
      if (Math.abs(next - flicker) < 1e-4) return false;
      flicker = next;
      apply();
      return true;
    },
    // Irradiance an installation adds at a point, for the steam's ambient light.
    irradianceAt(point) {
      const total = new THREE.Color();
      for (const p of points) {
        const level = levels[p.id] * (p.id === "fire" ? flicker : 1);
        if (!level || !new THREE.Box3(p.region.min, p.region.max).containsPoint(point)) continue;
        const r2 = Math.max(0.04, p.position.distanceToSquared(point));
        total.add(p.color.clone().multiplyScalar((p.intensity * level) / r2));
      }
      return total;
    },
    bindMaterial(material) {
      if (!material?.isMeshStandardMaterial || bindings.has(material)) return;
      const compile = material.onBeforeCompile,
        cache = material.customProgramCacheKey;
      material.onBeforeCompile = function (shader, renderer) {
        compile.call(this, shader, renderer);
        Object.assign(shader.uniforms, uniforms);
        shader.vertexShader = shader.vertexShader
          .replace("#include <common>", "#include <common>\nvarying vec3 installWorldPosition;")
          .replace("#include <project_vertex>", "installWorldPosition=(modelMatrix*vec4(transformed,1.0)).xyz;\n#include <project_vertex>");
        shader.fragmentShader = shader.fragmentShader
          .replace(
            "#include <common>",
            `#include <common>
varying vec3 installWorldPosition;
uniform vec3 installLineA[${MAX_LINES}];
uniform vec3 installLineB[${MAX_LINES}];
uniform vec3 installLineColor[${MAX_LINES}];
uniform vec3 installLineMin[${MAX_LINES}];
uniform vec3 installLineMax[${MAX_LINES}];
uniform vec3 installPointPosition[${MAX_POINTS}];
uniform vec3 installPointColor[${MAX_POINTS}];
uniform vec4 installPointCone[${MAX_POINTS}];
uniform vec3 installPointMin[${MAX_POINTS}];
uniform vec3 installPointMax[${MAX_POINTS}];
uniform float installActive;
${LINE_GLSL}`
          )
          .replace(
            "#include <aomap_fragment>",
            "if(installActive>0.5)reflectedLight.directDiffuse+=installationIrradiance(installWorldPosition,inverseTransformDirection(normal,viewMatrix))*BRDF_Lambert(material.diffuseColor);\n#include <aomap_fragment>"
          );
      };
      material.customProgramCacheKey = function () {
        return `${cache.call(this)}|light-installations-v1`;
      };
      material.needsUpdate = true;
      bindings.add(material);
    },
    get levels() {
      return { ...levels };
    },
    evidence() {
      return {
        levels: { ...levels },
        lines: lines.length,
        points: points.length,
        festoonMaterials: glowing.festoon.length,
        fireMaterials: glowing.fire.length,
        pool: pool ? points.find((p) => p.id === "pool").position.toArray() : null,
      };
    },
    dispose() {
      root.traverse((o) => o.geometry?.dispose());
      soffitMaterial.dispose();
      stepMaterial.dispose();
      poolMaterial.dispose();
      root.removeFromParent();
    },
  };
}
