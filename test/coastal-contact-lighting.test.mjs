import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as THREE from "../assets/js/three.module.min.js";
import {
  horizonIntegral,
  bounceVisibility,
  bilateralWeight,
  bindContactLighting,
  withoutContactLighting,
} from "../assets/js/home-scene/contact-occlusion.mjs";
import { createGpuTimer } from "../assets/js/home-scene/gpu-timer.mjs";
import { createLightInstallations } from "../assets/js/home-scene/light-installations.mjs";
import { createStaticLightField } from "../assets/js/home-scene/static-light-field.mjs";
import { createSkinDiffusion } from "../assets/js/home-scene/skin-diffusion.mjs";

const close = (a, b, epsilon = 1e-8) => assert.ok(Math.abs(a - b) < epsilon, `${a} differs from ${b}`);

test("horizon arcs match independent cosine-weighted quadrature for tilted visible hemispheres", () => {
  for (const gamma of [-1.2, -0.4, 0, 0.7, 1.3]) {
    const lower = Math.max(gamma - Math.PI / 2, -0.21),
      upper = Math.min(gamma + Math.PI / 2, 0.61),
      step = (upper - lower) / 20000;
    let integral = 0;
    for (let i = 0; i < 20000; i++) {
      const theta = lower + (i + 0.5) * step;
      integral += Math.max(0, Math.cos(theta - gamma)) * Math.abs(Math.sin(theta)) * step;
    }
    close(horizonIntegral(lower, upper, gamma, 0.83), integral * 0.83);
  }
});

test("a visible cone has sin-squared cosine-weighted visibility; adding occlusion never brightens it", () => {
  let previous = 0;
  for (let i = 0; i <= 100; i++) {
    const halfAngle = (i / 100) * (Math.PI / 2),
      visibility = horizonIntegral(-halfAngle, halfAngle, 0);
    close(visibility, Math.sin(halfAngle) ** 2);
    assert.ok(visibility >= previous);
    previous = visibility;
  }
  close(horizonIntegral(-Math.PI / 2, Math.PI / 2, 0), 1);
});

test("local bounce retains black-surface absorption and never creates more incident light than one", () => {
  for (let i = 0; i <= 100; i++) {
    const visibility = i / 100;
    close(bounceVisibility(visibility, 0), visibility);
    let previous = visibility;
    for (let j = 0; j <= 100; j++) {
      const bounce = bounceVisibility(visibility, j / 100);
      assert.ok(bounce >= visibility && bounce <= 1);
      assert.ok(bounce + 1e-12 >= previous, "raising albedo cannot reduce near-field bounce");
      previous = bounce;
    }
  }
  assert.ok(bounceVisibility(0.5, 0.8) > 0.75, "pale surfaces retain reflected diffuse light in corners");
  close(bounceVisibility(0, 0.9), 0);
  close(bounceVisibility(1, 0.9), 1);
});

test("bilateral reconstruction retains a coplanar neighbor and rejects a wall edge or another depth layer", () => {
  const coplanar = bilateralWeight(1, 0, 1),
    adjacentWall = bilateralWeight(1, 0, 0.1),
    differentLayer = bilateralWeight(1, 0.12, 1);
  assert.ok(coplanar > 0.7);
  assert.ok(adjacentWall < coplanar * 1e-12);
  assert.ok(differentLayer < coplanar * 1e-12);
  // Moving along the same inclined plane has zero plane distance, even with a
  // large camera-depth difference; a depth-only blur would discard that point.
  close(bilateralWeight(1, 0, 1), coplanar);
});

test("lighting binding preserves existing material hooks, cache identities and per-canvas uniforms", () => {
  const make = (kind) => ({
    isMeshStandardMaterial: true,
    onBeforeCompile(shader) {
      shader.fragmentShader = `${kind} detail\n${shader.fragmentShader}`;
      shader.uniforms.authored = { value: kind };
    },
    customProgramCacheKey: () => `authored-${kind}`,
  });
  const first = { contactEnabled: { value: true } },
    second = { contactEnabled: { value: false } },
    stone = bindContactLighting(make("stone"), first),
    water = bindContactLighting(make("water"), second);
  for (const [material, uniforms, kind] of [
    [stone, first, "stone"],
    [water, second, "water"],
  ]) {
    const shader = { fragmentShader: "#include <aomap_fragment>", uniforms: {} };
    material.onBeforeCompile(shader);
    assert.ok(shader.fragmentShader.includes(`${kind} detail`));
    assert.ok(shader.fragmentShader.includes("reflectedLight.indirectDiffuse*="));
    assert.equal(shader.uniforms.contactEnabled, uniforms.contactEnabled);
    assert.ok(material.customProgramCacheKey().startsWith(`authored-${kind}:`));
    const callback = material.onBeforeCompile;
    bindContactLighting(material, uniforms);
    assert.equal(material.onBeforeCompile, callback, "rebinding must not nest shader patches");
  }
  assert.notEqual(stone.customProgramCacheKey(), water.customProgramCacheKey());
});

test("wildlife contact binding remains singular after an avatar changes native receiver packs", () => {
  const config = JSON.parse(readFileSync(new URL("../assets/models/home/manifest.json", import.meta.url), "utf8"));
  const lights = createLightInstallations(config),
    field = createStaticLightField({ regions: [{ id: "test", min: [-1, 0, -1], max: [1, 2, 1] }], raysPerProbe: 16 }),
    skin = createSkinDiffusion(),
    contact = { contactTexture: { value: null }, contactResolution: { value: new THREE.Vector2(1, 1) }, contactEnabled: { value: true } },
    activeContact = { ...contact, contactEnabled: { value: false } },
    source = bindContactLighting(new THREE.MeshStandardMaterial({ name: "skin" }), contact);
  source.onBeforeCompile = ((compile) =>
    function (shader, renderer) {
      compile.call(this, shader, renderer);
      shader.uniforms.authored = { value: 7 };
    })(source.onBeforeCompile);
  lights.bindMaterial(source, "upper");
  field.bindMaterial(source);
  skin.bind(source);
  const moved = lights.bindMaterial(source, "bath-living");
  assert.notEqual(moved, source, "a real receiver change creates a cached material variant");
  field.bindMaterial(moved);
  skin.bind(moved);
  const cacheKey = moved.customProgramCacheKey();
  bindContactLighting(moved, activeContact);
  assert.equal(moved.customProgramCacheKey(), cacheKey, "inherited contact code retains its program identity");
  const callback = moved.onBeforeCompile;
  bindContactLighting(moved, activeContact);
  assert.equal(moved.onBeforeCompile, callback);
  for (let compilation = 0; compilation < 2; compilation++) {
    const shader = { vertexShader: THREE.ShaderLib.standard.vertexShader, fragmentShader: THREE.ShaderLib.standard.fragmentShader, uniforms: {} };
    moved.onBeforeCompile(shader, {});
    for (const declaration of [
      "uniform sampler2D contactTexture;",
      "uniform vec2 contactResolution;",
      "uniform bool contactEnabled;",
      "vec3 contactBounce(",
      "reflectedLight.indirectDiffuse*=contactBounce",
      "uniform vec3 installLineA[",
      "uniform float slfReady;",
      "uniform sampler2D skinDiffusionTexture;",
    ]) {
      assert.equal(shader.fragmentShader.split(declaration).length - 1, 1, declaration);
    }
    assert.equal(shader.uniforms.authored.value, 7);
    assert.equal(shader.uniforms.contactEnabled, activeContact.contactEnabled, "the active finish owns the contact buffer uniforms");
  }
  skin.dispose();
  field.dispose();
  lights.dispose();
  source.dispose();
});

test("auxiliary cameras suppress main-camera contact lighting and restore it after nested renders or exceptions", () => {
  const uniforms = { contactEnabled: { value: true } };
  const value = withoutContactLighting(uniforms, () => {
    assert.equal(uniforms.contactEnabled.value, false);
    withoutContactLighting(uniforms, () => assert.equal(uniforms.contactEnabled.value, false));
    assert.equal(uniforms.contactEnabled.value, false);
    return 7;
  });
  assert.equal(value, 7);
  assert.equal(uniforms.contactEnabled.value, true);
  assert.throws(
    () =>
      withoutContactLighting(uniforms, () => {
        throw new Error("reflection failed");
      }),
    /reflection failed/
  );
  assert.equal(uniforms.contactEnabled.value, true);
  uniforms.contactEnabled.value = false;
  withoutContactLighting(uniforms, () => {});
  assert.equal(uniforms.contactEnabled.value, false);
});

function timerContext() {
  const extension = { GPU_DISJOINT_EXT: 1, TIME_ELAPSED_EXT: 2 },
    queries = [],
    deleted = [];
  let disjoint = false,
    current = null,
    reads = 0;
  return {
    queries,
    deleted,
    get reads() {
      return reads;
    },
    get disjoint() {
      return disjoint;
    },
    set disjoint(value) {
      disjoint = value;
    },
    QUERY_RESULT_AVAILABLE: 3,
    QUERY_RESULT: 4,
    CURRENT_QUERY: 5,
    getExtension: () => extension,
    getParameter: () => disjoint,
    createQuery() {
      const q = { available: false, result: 3700000 };
      queries.push(q);
      return q;
    },
    deleteQuery: (q) => deleted.push(q),
    getQuery: () => current,
    beginQuery(type, q) {
      assert.equal(type, extension.TIME_ELAPSED_EXT);
      assert.equal(current, null);
      current = q;
    },
    endQuery() {
      current = null;
    },
    getQueryParameter(q, key) {
      if (key === 3) return q.available;
      assert.ok(q.available, "GPU results must never be read before completion");
      reads++;
      return q.result;
    },
  };
}

test("GPU telemetry polls completion, bounds pending work, and rejects disjoint timing results", () => {
  const gl = timerContext(),
    timer = createGpuTimer(gl, true);
  for (let i = 0; i < 64; i++) {
    timer.begin();
    timer.end();
  }
  assert.equal(gl.queries.length, 4, "unavailable results bound the queue instead of blocking");
  assert.equal(gl.reads, 0);
  gl.queries[0].available = true;
  timer.begin();
  timer.end();
  close(timer.evidence.medianMs, 3.7);
  assert.equal(timer.evidence.samples, 1);
  gl.disjoint = true;
  timer.begin();
  timer.end();
  assert.equal(timer.evidence.samples, 0);
  assert.equal(timer.evidence.medianMs, null);
  assert.equal(gl.deleted.length, gl.queries.length);
  timer.dispose();
});

test("public rendering and unsupported GPU telemetry perform no query operations", () => {
  const disabled = createGpuTimer({
    getExtension() {
      assert.fail("public pages must not request timer extension");
    },
  });
  disabled.begin();
  disabled.end();
  disabled.dispose();
  assert.equal(disabled.evidence.available, false);
  const unsupported = createGpuTimer({ getExtension: () => null }, true);
  unsupported.begin();
  unsupported.end();
  unsupported.dispose();
  assert.equal(unsupported.evidence.samples, 0);
});
