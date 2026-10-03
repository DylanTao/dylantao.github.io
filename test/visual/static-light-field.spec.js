const { test, expect } = require("@playwright/test");
const fs = require("node:fs");
const { collectRuntimeErrors } = require("./helpers");
const { publicRouteUrl } = require("./public-routes");

test("static light field: native linear GPU diffuse matches traced cache without doubled hemisphere", async ({ page, browserName }, testInfo) => {
  test.skip(
    browserName !== "chromium" || testInfo.project.name !== "desktop-1440",
    "Small native desktop fixture; scene viewport acceptance is separate."
  );
  test.setTimeout(20000);
  const errors = collectRuntimeErrors(page),
    fixtureUrl = publicRouteUrl("/__static-light-field-gpu-fixture");
  await page.route(fixtureUrl, (route) =>
    route.fulfill({
      status: 200,
      contentType: "text/html",
      body: '<!doctype html><meta charset="utf-8"><link rel="icon" href="data:,"><title>Static light field GPU fixture</title><canvas id="fixture"></canvas>',
    })
  );
  await page.goto(fixtureUrl, { waitUntil: "domcontentloaded" });
  const result = await page.evaluate(
    async ({ threeUrl, fieldUrl }) => {
      const THREE = await import(threeUrl),
        { createStaticLightField } = await import(fieldUrl);
      const renderer = new THREE.WebGLRenderer({ canvas: document.getElementById("fixture"), alpha: false, antialias: false });
      renderer.setSize(32, 32, false);
      renderer.setPixelRatio(1);
      renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
      renderer.toneMapping = THREE.NoToneMapping;
      renderer.setClearColor(0x000000, 1);
      const target = new THREE.WebGLRenderTarget(32, 32, {
        type: THREE.UnsignedByteType,
        format: THREE.RGBAFormat,
        minFilter: THREE.NearestFilter,
        magFilter: THREE.NearestFilter,
      });
      target.texture.colorSpace = THREE.LinearSRGBColorSpace;
      const scene = new THREE.Scene(),
        camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 10);
      camera.position.set(0, 0, 3);
      camera.lookAt(0, 0, 0);
      const albedo = [0.18, 0.32, 0.48],
        hemi = new THREE.HemisphereLight(0xffffff, 0xffffff, 2);
      // Physical specularIntensity=0 sets F0 and F90 to zero in actual r164.
      // With metalness/clearcoat/sheen zero this is a pure Lambertian receiver.
      const material = new THREE.MeshPhysicalMaterial({
        color: new THREE.Color().fromArray(albedo),
        roughness: 1,
        metalness: 0,
        specularIntensity: 0,
        clearcoat: 0,
        sheen: 0,
        envMapIntensity: 0,
        toneMapped: false,
        dithering: false,
      });
      const geometry = new THREE.PlaneGeometry(2, 2),
        receiver = new THREE.Mesh(geometry, material);
      scene.add(receiver, hemi);
      const originalCompile = material.onBeforeCompile,
        originalCacheKey = material.customProgramCacheKey;
      const regions = [{ id: "fixture", min: [-0.8, -0.8, -0.8], max: [0.8, 0.8, 0.8] }],
        liveFields = [];
      let shellGeometry, shellMaterial;
      const render = () => {
        renderer.setRenderTarget(target);
        renderer.render(scene, camera);
        const pixels = new Uint8Array(8 * 8 * 4);
        renderer.readRenderTargetPixels(target, 12, 12, 8, 8, pixels);
        const rgb = [0, 0, 0];
        for (let i = 0; i < pixels.length; i += 4) for (let c = 0; c < 3; c++) rgb[c] += pixels[i + c] / (255 * 64);
        return rgb;
      };
      const light = (color) => ({ zenith: color, horizon: color, ground: color, practicalPowers: [] });
      try {
        const baseline = render(),
          field = createStaticLightField({ regions });
        liveFields.push(field);
        field.setLighting(light([0.5, 0.5, 0.5]));
        await field.bake({ yieldTask: () => Promise.resolve() });
        field.bindMaterial(material);
        const white = render(),
          whiteCPU = field.sample([0, 0, 0], [0, 0, 1]);
        hemi.intensity = 9;
        const extremeLegacyHemisphere = render();
        const raysBefore = field.evidence().trace.rays || 0;
        const nextRadiance = [0.2, 0.35, 0.7];
        field.setLighting(light(nextRadiance));
        const relit = render(),
          relitCPU = field.sample([0, 0, 0], [0, 0, 1]),
          addedRays = (field.evidence().trace.rays || 0) - raysBefore;
        field.dispose();
        const ownershipRestored = material.onBeforeCompile === originalCompile && material.customProgramCacheKey === originalCacheKey;
        hemi.intensity = 2;
        const restored = render();

        shellGeometry = new THREE.BoxGeometry(4, 4, 4);
        const index = shellGeometry.index;
        for (let i = 0; i < index.count; i += 3) {
          const a = index.getX(i);
          index.setX(i, index.getX(i + 2));
          index.setX(i + 2, a);
        }
        shellMaterial = new THREE.MeshStandardMaterial({ color: 0xffffff });
        // The closed shell is a transport root, not a camera occluder in this
        // isolated shader fixture. The receiver and native hemi remain visible.
        const shell = new THREE.Mesh(shellGeometry, shellMaterial),
          closedField = createStaticLightField({ regions });
        liveFields.push(closedField);
        closedField.addRoot(shell);
        closedField.setLighting(light([0.5, 0.5, 0.5]));
        await closedField.bake({ yieldTask: () => Promise.resolve() });
        closedField.bindMaterial(material);
        const closed = render(),
          closedCPU = closedField.sample([0, 0, 0], [0, 0, 1]),
          closedEvidence = closedField.evidence();
        closedField.dispose();
        const closedOwnershipRestored = material.onBeforeCompile === originalCompile && material.customProgramCacheKey === originalCacheKey,
          closedRestored = render();
        const gl = renderer.getContext(),
          debug = gl.getExtension("WEBGL_debug_renderer_info");
        return {
          revision: THREE.REVISION,
          backend: debug ? gl.getParameter(debug.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER),
          context: gl.getParameter(gl.VERSION),
          output: {
            toneMapping: renderer.toneMapping,
            colorSpace: renderer.outputColorSpace,
            targetColorSpace: target.texture.colorSpace,
            pixelType: "linear unsigned-byte RGBA, central8x8 mean",
          },
          albedo,
          nextRadiance,
          baseline,
          white,
          whiteCPU,
          extremeLegacyHemisphere,
          relit,
          relitCPU,
          addedRays,
          restored,
          ownershipRestored,
          closed,
          closedCPU,
          closedEvidence,
          closedRestored,
          closedOwnershipRestored,
          limits: [
            "Analytic synthetic receiver and box; no production-scene visual or frame-time assertion",
            "Opaque Lambertian fixture isolates indirect diffuse; transmission and PMREM specular are separate",
            "Unsigned-byte quantization tolerance2/255; no tone or sRGB encoding",
          ],
        };
      } finally {
        liveFields.forEach((field) => field.dispose());
        geometry.dispose();
        material.dispose();
        shellGeometry?.dispose();
        shellMaterial?.dispose();
        target.dispose();
        renderer.dispose();
      }
    },
    { threeUrl: publicRouteUrl("/assets/js/three.module.min.js"), fieldUrl: publicRouteUrl("/assets/js/home-scene/static-light-field.mjs") }
  );
  fs.writeFileSync(testInfo.outputPath("static-light-field-native-linear-gpu.json"), JSON.stringify(result, null, 2));
  await testInfo.attach("static-light-field-native-linear-gpu.json", { body: JSON.stringify(result, null, 2), contentType: "application/json" });
  const tolerance = 2 / 255;
  const closeRGB = (actual, expected) =>
    actual.forEach((v, c) => expect(Math.abs(v - expected[c]), `channel${c}: ${v} versus ${expected[c]}`).toBeLessThan(tolerance));
  expect(result.revision).toBe("164");
  expect(result.output.toneMapping).toBe(0);
  expect(result.output.colorSpace).toBe("srgb-linear");
  expect(result.output.targetColorSpace).toBe("srgb-linear");
  closeRGB(
    result.baseline,
    result.albedo.map((rho) => (rho * 2) / Math.PI)
  );
  closeRGB(
    result.white,
    result.albedo.map((rho) => rho * 0.5)
  );
  closeRGB(
    result.white,
    result.albedo.map((rho, c) => (rho * result.whiteCPU.irradiance[c]) / Math.PI)
  );
  closeRGB(result.extremeLegacyHemisphere, result.white);
  closeRGB(
    result.relit,
    result.albedo.map((rho, c) => rho * result.nextRadiance[c])
  );
  closeRGB(
    result.relit,
    result.albedo.map((rho, c) => (rho * result.relitCPU.irradiance[c]) / Math.PI)
  );
  expect(result.addedRays).toBe(0);
  expect(result.ownershipRestored).toBe(true);
  closeRGB(result.restored, result.baseline);
  expect(result.closedEvidence.ready).toBe(true);
  expect(result.closedEvidence.rejectedProbes).toBe(0);
  expect(result.closedCPU.irradiance.every((v) => v < 1e-10)).toBe(true);
  closeRGB(result.closed, [0, 0, 0]);
  expect(result.closedOwnershipRestored).toBe(true);
  closeRGB(result.closedRestored, result.baseline);
  expect(errors).toEqual([]);
});
