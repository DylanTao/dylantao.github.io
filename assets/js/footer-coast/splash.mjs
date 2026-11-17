// Something falls into the coast's sea: the drops it throws and the body that floats afterwards.
// The rings and the foam are the sea's own (water.mjs coastSplashes); this module keeps the
// impacts' clock for them. The physics is in splash-physics.mjs.
//
// It exists for the orange on the Page not found page (orange-roll.mjs), which rolls off the page
// above, falls and lands here. Until something falls in, nothing here draws or runs.
import * as THREE from "../three.module.min.js";
import { SPLASH, floatLevel, splashDrops, stepDrop, stepFloater } from "./splash-physics.mjs?v=coast-splash-20261116";
import { WATER_LEVEL } from "./water-optics.mjs?v=coast-streaks-20261115";
import { sampleCoastWave } from "./wave-motion.mjs";

const DROPS = (SPLASH.crown + SPLASH.jet) * SPLASH.impacts;

export function createSplash() {
  // Drops: points sized in the coast's units, lit by the hour (setLight).
  const positions = new Float32Array(DROPS * 3),
    sizes = new Float32Array(DROPS);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3).setUsage(THREE.DynamicDrawUsage));
  geometry.setAttribute("dropSize", new THREE.BufferAttribute(sizes, 1).setUsage(THREE.DynamicDrawUsage));
  geometry.setDrawRange(0, 0);
  const uniforms = { splashScale: { value: 30 }, splashLight: { value: new THREE.Color(1, 1, 1) } };
  const material = new THREE.ShaderMaterial({
    name: "Splash drops",
    uniforms,
    vertexShader: `attribute float dropSize; uniform float splashScale;
      void main() {
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.);
        gl_PointSize = max(dropSize * splashScale, 1.5);
      }`,
    fragmentShader: `uniform vec3 splashLight;
      void main() {
        vec2 c = gl_PointCoord - .5;
        float d = dot(c, c);
        if (d > .25) discard;
        gl_FragColor = vec4(splashLight, 1. - smoothstep(.1, .25, d));
      }`,
    transparent: true,
    depthWrite: false,
  });
  const points = new THREE.Points(geometry, material);
  points.name = "SplashDrops";
  points.frustumCulled = false;
  // After the sea, which is drawn with the other see-through things and would otherwise cover them.
  points.renderOrder = 6;
  points.visible = false;
  points.userData.noOcclusion = true;

  // The body: an orange, with the stub of its stem and one leaf. It takes the scene's own light.
  const radius = SPLASH.radius;
  const body = new THREE.Mesh(
    new THREE.SphereGeometry(radius, 28, 18),
    new THREE.MeshStandardMaterial({ name: "Orange rind", color: 0xf07a22, roughness: 0.58, metalness: 0 })
  );
  const leaf = new THREE.Mesh(
    new THREE.SphereGeometry(radius, 12, 8),
    new THREE.MeshStandardMaterial({ name: "Orange leaf", color: 0x3f8f4c, roughness: 0.7, metalness: 0 })
  );
  leaf.scale.set(0.5, 0.07, 0.24);
  leaf.position.set(radius * 0.42, radius * 1.02, 0);
  leaf.rotation.z = 0.5;
  const stem = new THREE.Mesh(
    new THREE.CylinderGeometry(radius * 0.05, radius * 0.07, radius * 0.22, 6),
    new THREE.MeshStandardMaterial({ name: "Orange stem", color: 0x6b4a2a, roughness: 0.9, metalness: 0 })
  );
  stem.position.set(0, radius * 1.04, 0);
  const orange = new THREE.Group();
  orange.name = "FloatingOrange";
  orange.add(body, leaf, stem);
  orange.visible = false;
  orange.traverse((o) => {
    o.castShadow = o.receiveShadow = false;
  });

  const level = floatLevel();
  const impacts = [],
    drops = [],
    floater = { x: 0, z: 0, y: level, vy: 0, spin: 0, turned: 0, lean: 0, active: false },
    axis = new THREE.Vector3(0, 0, 1);
  let count = 0,
    live = 0,
    now = 0;

  return {
    objects: [points, orange],
    // The view direction the body's spin turns about (it rolled in the plane of the screen), and how
    // many device pixels a unit of the coast spans.
    setView(toward, pixelsPerUnit) {
      axis.copy(toward).normalize();
      uniforms.splashScale.value = pixelsPerUnit;
    },
    // The hour's light on white water (linear).
    setLight(color) {
      uniforms.splashLight.value.copy(color);
    },
    // Something lands at (x, z) on the sea, falling at `speed` units a second and turning at `spin`
    // radians a second.
    impact({ x, z, speed = 8, spin = 0 }) {
      const entry = THREE.MathUtils.clamp(speed, ...SPLASH.entrySpeed);
      count++;
      impacts.push({ x, z, at: now, strength: THREE.MathUtils.mapLinear(entry, SPLASH.entrySpeed[0], SPLASH.entrySpeed[1], 0.7, 1.15) });
      while (impacts.length > SPLASH.impacts) impacts.shift();
      for (const drop of splashDrops({ x, z, speed: entry, seed: count * 7919 + 17 })) drops.push({ ...drop, from: now + drop.at, flying: false });
      while (drops.length > DROPS) drops.shift();
      Object.assign(floater, { x, z, y: radius, vy: -entry, spin, turned: 0, lean: 0, active: true });
      orange.visible = points.visible = true;
      return entry;
    },
    // One frame on: `seconds` is the coast's own clock, which also times the sea's waves.
    update(dt, seconds) {
      now = seconds;
      for (let i = impacts.length - 1; i >= 0; i--) if (now - impacts[i].at > SPLASH.life) impacts.splice(i, 1);
      live = 0;
      for (let i = drops.length - 1; i >= 0; i--) {
        const drop = drops[i];
        if (now < drop.from) continue;
        drop.flying = true;
        for (let left = dt; left > 1e-9; left -= 1 / 120) stepDrop(drop, Math.min(left, 1 / 120));
        if (drop.y < 0 && drop.vy < 0) drops.splice(i, 1);
      }
      for (const drop of drops) {
        if (!drop.flying) continue;
        positions.set([drop.x, WATER_LEVEL + drop.y, drop.z], live * 3);
        sizes[live++] = drop.size * 2;
      }
      geometry.setDrawRange(0, live);
      geometry.attributes.position.needsUpdate = geometry.attributes.dropSize.needsUpdate = true;
      points.visible = live > 0;
      if (!floater.active) return;
      // The body rides the sea's own waves; under water its spin dies away, and afloat it rocks with
      // the surface's slope.
      const wave = sampleCoastWave(floater.x, floater.z, seconds);
      stepFloater(floater, dt, { surface: wave.height });
      const wet = floater.y < radius ? 1 : 0;
      floater.spin *= Math.exp(-dt * (wet ? 2.4 : 0));
      floater.turned += floater.spin * dt;
      floater.lean += (Math.atan(wave.dx) * 1.5 - floater.lean) * Math.min(1, dt * 3);
      orange.position.set(floater.x, WATER_LEVEL + floater.y, floater.z);
      // `axis` points at the viewer, so a turn to the right on the screen is a negative turn about it.
      orange.quaternion.setFromAxisAngle(axis, floater.lean - floater.turned);
    },
    // For the sea's shader: [{ x, z, age, strength }].
    rings() {
      return impacts.map(({ x, z, at, strength }) => ({ x, z, age: now - at, strength }));
    },
    evidence() {
      return {
        impacts: count,
        rings: impacts.length,
        drops: live,
        waiting: drops.length - live,
        floater: floater.active
          ? {
              x: floater.x,
              z: floater.z,
              height: floater.y,
              speed: floater.vy,
              level,
              settled: Math.abs(floater.y - level) < radius * 0.12 && Math.abs(floater.vy) < 0.15,
              visible: orange.visible,
            }
          : null,
      };
    },
    dispose() {
      geometry.dispose();
      material.dispose();
      for (const part of [body, leaf, stem]) {
        part.geometry.dispose();
        part.material.dispose();
      }
    },
  };
}
