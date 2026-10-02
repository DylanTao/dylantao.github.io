import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "../assets/js/three.module.min.js";
import {
  SKIN_DIFFUSION_DEFAULTS,
  radialDensity,
  radialCDF,
  clampedCosineRing,
  diffuseResponse,
  buildDiffusionTable,
  sampleDiffusionTable,
  estimateMeanCurvature,
} from "../assets/js/home-scene/skin-diffusion-profile.mjs";
import { createSkinDiffusion, patchSkinDiffusionShader } from "../assets/js/home-scene/skin-diffusion.mjs";
import { bindContactLighting } from "../assets/js/home-scene/contact-occlusion.mjs";

const close = (a, b, epsilon = 1e-8) => assert.ok(Math.abs(a - b) < epsilon, `${a} differs from ${b} by ${Math.abs(a - b)}`);
const table = buildDiffusionTable();
const makeShader = () => ({ fragmentShader: THREE.ShaderLib.standard.fragmentShader, uniforms: {} });
const makeSkin = () => new THREE.MeshStandardMaterial({ name: "skin" });

test("normalized diffusion radial mass, CDF and mean distance match independent quadrature", () => {
  const count = 80000,
    step = 60 / count;
  let mass = 0,
    mean = 0;
  for (let i = 0; i < count; i++) {
    const t = (i + 0.5) * step,
      density = radialDensity(t);
    mass += density * step;
    mean += t * density * step;
  }
  close(mass, 1, 2e-8);
  close(mean, 2.5, 2e-7);
  for (const t of [0.01, 0.2, 1, 3, 12]) {
    let sum = 0;
    for (let i = 0; i < 10000; i++) sum += radialDensity(((i + 0.5) * t) / 10000) * (t / 10000);
    close(radialCDF(t), sum, 2e-8);
  }
  assert.ok(1 - radialCDF(SKIN_DIFFUSION_DEFAULTS.tail) < 0.000035);
});

test("analytic spherical ring agrees with direct azimuth quadrature on lit, grazing and backlit rings", () => {
  for (const mu of [-1, -0.8, -0.2, 0, 0.4, 1]) {
    for (const theta of [0, 0.07, 0.9, Math.PI / 2, 2.8, Math.PI]) {
      let actual = 0;
      for (let i = 0; i < 12000; i++) {
        const phi = ((i + 0.5) * Math.PI * 2) / 12000;
        actual += Math.max(0, mu * Math.cos(theta) + Math.sqrt(1 - mu * mu) * Math.sin(theta) * Math.cos(phi)) / 12000;
      }
      close(clampedCosineRing(mu, theta), actual, 1e-8);
    }
  }
});

test("preintegration recovers the flat Lambert limit and remains bounded without extra energy", () => {
  for (let x = 0; x <= 400; x++) {
    const mu = x / 200 - 1;
    close(diffuseResponse(mu, 0, 0.0032), Math.max(0, mu));
    for (const response of sampleDiffusionTable(table, mu, 0)) close(response, Math.max(0, mu));
  }
  for (let y = 0; y < table.config.height; y++) {
    const integrals = [0, 0, 0];
    for (let x = 0; x < table.config.width; x++) {
      const endpoint = x === 0 || x === table.config.width - 1 ? 0.5 : 1;
      for (let c = 0; c < 3; c++) {
        const value = table.data[(y * table.config.width + x) * 4 + c];
        assert.ok(Number.isFinite(value) && value >= 0 && value <= 1);
        integrals[c] += (endpoint * value * 2) / (table.config.width - 1);
      }
    }
    // Isotropic convolution preserves the integral over incident directions.
    // The clamped cosine's integral over mu in [-1,1] is exactly 1/2.
    for (const integral of integrals) close(integral, 0.5, 0.00006);
  }
  const terminator = sampleDiffusionTable(table, 0, 12),
    facing = sampleDiffusionTable(table, 1, 12);
  assert.ok(terminator[0] > terminator[1] && terminator[1] > terminator[2], "red diffuses farther at the terminator");
  assert.ok(facing[0] < facing[1] && facing[1] < facing[2] && facing[2] < 1, "the redistributed light is taken from the lit lobe");
});

test("finite LUT interpolation agrees with a denser independently requested radial quadrature", () => {
  for (const curvature of [0.7, 4.9, 12.2, 28.7, 79.3, 155.8]) {
    for (const mu of [-0.7, -0.23, -0.012, 0, 0.003, 0.091, 0.43, 0.98]) {
      const sampled = sampleDiffusionTable(table, mu, curvature);
      for (let c = 0; c < 3; c++) {
        const reference = diffuseResponse(mu, curvature, table.config.distances[c], { radialSamples: 256 });
        close(sampled[c], reference, 0.0015);
      }
    }
  }
});

test("metric curvature recovers planes, spheres, cylinders and a skew parameter basis", () => {
  const px = [0.013, 0, 0],
    py = [0.009, 0.021, 0];
  close(estimateMeanCurvature(px, py, [0, 0, 0], [0, 0, 0]), 0);
  for (const radius of [0.012, 0.08, 0.4, 10]) {
    const nx = px.map((v) => v / radius),
      ny = py.map((v) => v / radius);
    close(estimateMeanCurvature(px, py, nx, ny), 1 / radius);
    close(
      estimateMeanCurvature(
        px.map((v) => v * 10),
        py.map((v) => v * 10),
        nx,
        ny
      ),
      1 / (radius * 10)
    );
    close(
      estimateMeanCurvature(
        px,
        py,
        nx.map((v) => -v),
        ny.map((v) => -v)
      ),
      0
    );
  }
  close(estimateMeanCurvature([0.01, 0, 0], [0, 0.02, 0], [0.1, 0, 0], [0, 0, 0]), 5);
  close(estimateMeanCurvature([1, 0, 0], [2, 0, 0], [10, 0, 0], [20, 0, 0]), 0);
  close(estimateMeanCurvature([1, 0, 0], [1, 1e-5, 0], [100, 0, 0], [100, 0.001, 0]), 0);
  close(estimateMeanCurvature([NaN, 0, 0], py, px, py), 0);
  close(estimateMeanCurvature([1, 0, 0], [0, 1, 0], [1000, 0, 0], [0, 1000, 0]), 160);
});

test("shader changes only direct diffuse and computes curvature outside the light loop", () => {
  const pipeline = createSkinDiffusion(),
    skin = makeSkin(),
    originalPhysical = THREE.ShaderChunk.lights_physical_pars_fragment,
    originalFragment = THREE.ShaderLib.standard.fragmentShader,
    shader = makeShader();
  pipeline.bind(skin);
  skin.onBeforeCompile(shader);
  assert.equal(THREE.ShaderChunk.lights_physical_pars_fragment, originalPhysical, "shared chunks must remain untouched");
  assert.equal(THREE.ShaderLib.standard.fragmentShader, originalFragment);
  assert.ok(shader.fragmentShader.includes("reflectedLight.directSpecular += irradiance * BRDF_GGX"));
  assert.ok(shader.fragmentShader.includes("reflectedLight.directDiffuse += coastalSkinResponse"));
  assert.ok(shader.fragmentShader.includes("texture2D(skinDiffusionTexture,uv).rgb"));
  assert.ok(shader.fragmentShader.includes("directLight.color * BRDF_Lambert( material.diffuseColor )"));
  assert.ok(
    shader.fragmentShader.indexOf("coastalSkinCurvature=coastalMeanCurvature") < shader.fragmentShader.indexOf("#include <lights_fragment_begin>")
  );
  assert.equal((shader.fragmentShader.match(/coastalSkinCurvature=coastalMeanCurvature/g) ?? []).length, 1);
  const areaBegin = originalPhysical.indexOf("void RE_Direct_RectArea_Physical"),
    areaFunction = originalPhysical.slice(areaBegin, originalPhysical.indexOf("void RE_Direct_Physical", areaBegin));
  assert.ok(shader.fragmentShader.includes(areaFunction), "area-light diffuse/specular paths retain Three's implementation verbatim");
  assert.ok(shader.fragmentShader.includes("#include <aomap_fragment>"));
  assert.ok(shader.fragmentShader.includes("#include <emissivemap_fragment>"));
  pipeline.dispose();
});

test("binding composes with contact in either order, preserving authored hooks and program identities", () => {
  for (const contactFirst of [true, false]) {
    const pipeline = createSkinDiffusion(),
      material = makeSkin(),
      contact = { contactEnabled: { value: true } };
    material.onBeforeCompile = (shader) => {
      shader.uniforms.original = { value: 42 };
      shader.fragmentShader = `// Authored detail\n${shader.fragmentShader}`;
    };
    material.customProgramCacheKey = () => "authored-skin";
    if (contactFirst) bindContactLighting(material, contact);
    const handle = pipeline.bind(material),
      callback = material.onBeforeCompile;
    assert.equal(pipeline.bind(material), handle);
    assert.equal(material.onBeforeCompile, callback, "rebinding must not nest hooks");
    if (!contactFirst) bindContactLighting(material, contact);
    const shader = makeShader();
    material.onBeforeCompile(shader);
    assert.equal(shader.uniforms.original.value, 42);
    assert.equal(shader.uniforms.contactEnabled, contact.contactEnabled);
    assert.equal(shader.uniforms.skinDiffusionTexture, pipeline.uniforms.skinDiffusionTexture);
    assert.ok(shader.fragmentShader.includes("// Authored detail"));
    assert.ok(shader.fragmentShader.includes("reflectedLight.indirectDiffuse*="));
    assert.ok(shader.fragmentShader.includes("coastalSkinResponse"));
    assert.ok(material.customProgramCacheKey().startsWith("authored-skin:"));
    assert.ok(material.customProgramCacheKey().includes("coastal-indirect-contact-v1"));
    assert.ok(material.customProgramCacheKey().includes("coastal-normalized-skin-v1"));
    assert.deepEqual(handle.evidence, { compiled: true, compatible: true, enabled: true });
    pipeline.dispose();
  }
});

test("hair/glasses/ordinary cloth stay unbound; bare torso has an independent wardrobe enable uniform", () => {
  const pipeline = createSkinDiffusion(),
    skin = makeSkin(),
    skinHandle = pipeline.bind(skin);
  for (const name of ["hair", "glasses", "Sirui shirt", "skin-like stone"]) {
    const material = new THREE.MeshStandardMaterial({ name }),
      callback = material.onBeforeCompile;
    assert.equal(pipeline.bind(material), null);
    assert.equal(material.onBeforeCompile, callback);
  }
  const torso = new THREE.MeshStandardMaterial({ name: "Sirui shirt", color: 0x111111, roughness: 0.9 }),
    torsoHandle = pipeline.bind(torso, { surface: true, enabled: false }),
    skinShader = makeShader(),
    torsoShader = makeShader();
  skin.onBeforeCompile(skinShader);
  torso.onBeforeCompile(torsoShader);
  assert.equal(skinShader.uniforms.skinDiffusionTexture, torsoShader.uniforms.skinDiffusionTexture);
  assert.notEqual(skinShader.uniforms.skinDiffusionMaterialEnabled, torsoShader.uniforms.skinDiffusionMaterialEnabled);
  assert.equal(torsoHandle.enabled, false);
  torsoHandle.setEnabled(true);
  assert.equal(torsoShader.uniforms.skinDiffusionMaterialEnabled.value, true);
  assert.equal(skinHandle.enabled, true);
  torsoHandle.setEnabled(false);
  assert.equal(skinHandle.enabled, true);
  assert.equal(torso.color.getHex(), 0x111111);
  assert.equal(torso.roughness, 0.9);
  pipeline.dispose();
});

test("incompatible shader anchors fail closed rather than partially replacing a material", () => {
  const shader = { fragmentShader: "custom authored fragment", uniforms: { original: { value: 1 } } },
    original = shader.fragmentShader;
  assert.equal(patchSkinDiffusionShader(shader, {}, { value: true }), false);
  assert.equal(shader.fragmentShader, original);
  assert.deepEqual(Object.keys(shader.uniforms), ["original"]);
  const pipeline = createSkinDiffusion(),
    material = makeSkin(),
    handle = pipeline.bind(material);
  material.onBeforeCompile(shader);
  assert.deepEqual(handle.evidence, { compiled: true, compatible: false, enabled: true });
  assert.equal(pipeline.evidence.incompatibleMaterials, 1);
  pipeline.dispose();
});

test("texture storage is linear, bounded and accurate; no render target or pass is allocated", () => {
  for (const storage of ["half-float", "unorm8"]) {
    const pipeline = createSkinDiffusion({ storage }),
      texture = pipeline.uniforms.skinDiffusionTexture.value;
    assert.equal(texture.minFilter, THREE.LinearFilter);
    assert.equal(texture.magFilter, THREE.LinearFilter);
    assert.equal(texture.colorSpace, THREE.NoColorSpace);
    assert.equal(texture.generateMipmaps, false);
    assert.equal(texture.wrapS, THREE.ClampToEdgeWrapping);
    assert.equal(pipeline.evidence.extraPasses, 0);
    assert.equal(pipeline.evidence.extraRenderTargets, 0);
    assert.equal(pipeline.evidence.textureBytes, 257 * 49 * 4 * (storage === "half-float" ? 2 : 1));
    let error = 0;
    for (let i = 0; i < table.data.length; i++) {
      const value = storage === "half-float" ? THREE.DataUtils.fromHalfFloat(texture.image.data[i]) : texture.image.data[i] / 255;
      error = Math.max(error, Math.abs(value - table.data[i]));
    }
    assert.ok(error < (storage === "half-float" ? 0.0005 : 0.00197));
    pipeline.dispose();
  }
});

test("separate finishes never share texture state, and idempotent disposal disables all borrowers", () => {
  const first = createSkinDiffusion(),
    second = createSkinDiffusion(),
    material = makeSkin(),
    handle = first.bind(material),
    texture = first.uniforms.skinDiffusionTexture.value;
  let disposals = 0;
  texture.addEventListener("dispose", () => disposals++);
  assert.notEqual(first.uniforms.skinDiffusionTexture.value, second.uniforms.skinDiffusionTexture.value);
  assert.throws(() => second.bind(material), /two finish pipelines/);
  first.setEnabled(false);
  assert.equal(second.uniforms.skinDiffusionEnabled.value, true);
  first.setStrength(0.3);
  assert.equal(second.uniforms.skinDiffusionStrength.value, 0.7);
  first.dispose();
  first.dispose();
  handle.setEnabled(true);
  first.setEnabled(true);
  assert.equal(disposals, 1);
  assert.equal(handle.enabled, false);
  assert.equal(first.uniforms.skinDiffusionEnabled.value, false);
  assert.equal(first.evidence.disposed, true);
  assert.throws(() => first.bind(makeSkin()), /disposed/);
  assert.throws(() => second.setStrength(NaN), /between zero and one/);
  second.dispose();
});

test("released or disposed avatar materials stop borrowing and leave live evidence without nesting hooks", () => {
  const pipeline = createSkinDiffusion(),
    material = makeSkin(),
    handle = pipeline.bind(material),
    originalCallback = material.onBeforeCompile;
  assert.equal(pipeline.evidence.boundMaterials, 1);
  assert.equal(pipeline.evidence.totalBindings, 1);
  handle.release();
  handle.setEnabled(true);
  assert.equal(handle.enabled, false);
  assert.equal(pipeline.evidence.boundMaterials, 0);
  assert.equal(pipeline.evidence.activeMaterials, 0);
  assert.equal(pipeline.bind(material), handle);
  assert.equal(material.onBeforeCompile, originalCallback);
  assert.equal(pipeline.evidence.totalBindings, 1);
  assert.equal(pipeline.evidence.boundMaterials, 1);
  const contact = { contactEnabled: { value: true } };
  bindContactLighting(material, contact);
  const combinedCallback = material.onBeforeCompile;
  material.dispose();
  assert.equal(handle.enabled, false);
  assert.equal(pipeline.evidence.boundMaterials, 0);
  assert.equal(material.onBeforeCompile, combinedCallback, "release cannot destroy a later contact wrapper");
  pipeline.dispose();
});

test("invalid authored distances, sizes, curvature or blend weights are rejected", () => {
  for (const options of [
    { distances: [1, 2] },
    { distances: [0, 0.001, 0.002] },
    { distances: [NaN, 0.001, 0.002] },
    { width: 0 },
    { height: 1.5 },
    { radialSamples: 300 },
    { maxCurvature: 0 },
    { tail: Infinity },
    { strength: -1 },
    { strength: 1.01 },
    { distances: [1e308, 0.001, 0.002] },
  ]) {
    assert.throws(() => buildDiffusionTable(options), RangeError);
  }
  assert.throws(() => createSkinDiffusion({ storage: "float" }), RangeError);
  assert.throws(() => diffuseResponse(NaN, 10, 0.001), RangeError);
  assert.throws(() => diffuseResponse(0, 10, 0.001, { radialSamples: 0 }), RangeError);
});
