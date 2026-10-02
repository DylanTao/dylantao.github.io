import test from "node:test";
import assert from "node:assert/strict";
import { chromium, webkit } from "@playwright/test";

// Opt-in native GPU proof. Run only on the coordinator's owned preview/GPU:
// COASTAL_BASE_URL=http://127.0.0.1:8080 node --test test/coastal-transport-rendering.test.mjs
// COASTAL_BROWSER=webkit selects the second engine. A skipped run is not proof.
const baseURL = process.env.COASTAL_BASE_URL?.replace(/\/$/, "");
let browser;
if (baseURL) {
  test.before(async () => {
    const engine = process.env.COASTAL_BROWSER === "webkit" ? webkit : chromium;
    browser = await engine.launch(
      engine === chromium && process.platform === "win32" ? { args: ["--use-angle=d3d11", "--ignore-gpu-blocklist"] } : {}
    );
  });
  test.after(async () => browser?.close());
}

async function fixturePage() {
  const page = await browser.newPage({ viewport: { width: 360, height: 300 } }),
    errors = [],
    fixtureURL = `${baseURL}/__coastal_transport_test__`;
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  // Adopt the preview origin for module imports without loading homepage
  // scripts, native assets or another WebGL scene. This route is test-local.
  await page.route(fixtureURL, (route) => route.fulfill({ status: 200, contentType: "text/html", body: "<!doctype html>" }));
  await page.goto(fixtureURL, { waitUntil: "domcontentloaded" });
  await page.setContent('<!doctype html><meta charset="utf-8"><title>Native transport fixture</title><body></body>');
  await page.evaluate(async (origin) => {
    const THREE = await import(`${origin}/assets/js/three.module.min.js`);
    window.transportThree = THREE;
    window.transportRenderer = (size) => {
      const renderer = new THREE.WebGLRenderer({ antialias: false, alpha: false });
      renderer.setPixelRatio(1);
      renderer.setSize(size, size);
      renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
      renderer.toneMapping = THREE.NoToneMapping;
      renderer.setClearColor(0, 1);
      renderer.debug.onShaderError = (gl, program, vertex, fragment) => {
        throw new Error(`Native shader failed: ${gl.getProgramInfoLog(program)}\n${gl.getShaderInfoLog(vertex)}\n${gl.getShaderInfoLog(fragment)}`);
      };
      if (!renderer.capabilities.isWebGL2) throw new Error("The production transport fixture requires the room's WebGL2 capability.");
      document.body.append(renderer.domElement);
      return renderer;
    };
    window.transportTarget = (width, height = width) => {
      const target = new THREE.WebGLRenderTarget(width, height, { type: THREE.UnsignedByteType, format: THREE.RGBAFormat });
      target.texture.colorSpace = THREE.LinearSRGBColorSpace;
      return target;
    };
    window.transportRead = (renderer, target, scene, camera) => {
      renderer.setRenderTarget(target);
      renderer.render(scene, camera);
      const pixels = new Uint8Array(target.width * target.height * 4);
      renderer.readRenderTargetPixels(target, 0, 0, target.width, target.height, pixels);
      const error = renderer.getContext().getError();
      if (error !== renderer.getContext().NO_ERROR) throw new Error(`Native WebGL error ${error}`);
      return pixels;
    };
  }, baseURL);
  return { page, errors };
}

test("native curl-field GLSL matches metric CPU wind samples after RGBA8 quantization", { skip: !baseURL, timeout: 45000 }, async (t) => {
  const { page, errors } = await fixturePage();
  try {
    const result = await page.evaluate(async (origin) => {
      const THREE = window.transportThree,
        wind = await import(`${origin}/assets/js/home-scene/wind-field.mjs`),
        points = [
          [0, 0, 0],
          [-0.7, 0, 1.3],
          [5.1, 3.4, -0.6],
          [-2.7, 0.2, 8.1],
          [100.25, -0.4, -80.7],
        ],
        times = [0, 1.37, 13.2, 37.5],
        renderer = window.transportRenderer(8),
        target = window.transportTarget(points.length, 1),
        scene = new THREE.Scene(),
        camera = new THREE.Camera(),
        uniforms = {
          ...wind.createWindUniforms(),
          samplePoints: { value: points.map((p) => new THREE.Vector3(...p)) },
          speedBound: { value: wind.WIND_SPEED_BOUND },
        },
        material = new THREE.ShaderMaterial({
          uniforms,
          vertexShader: "varying vec2 sampleUV; void main(){sampleUV=uv;gl_Position=vec4(position.xy,0.,1.);}",
          fragmentShader: `
            varying vec2 sampleUV;
            uniform vec3 samplePoints[${points.length}];
            uniform float speedBound;
            ${wind.windFieldGLSL}
            void main() {
              vec3 point=vec3(0.);
              for(int i=0;i<${points.length};i++) if(floor(sampleUV.x*${points.length.toFixed(1)})==float(i)) point=samplePoints[i];
              gl_FragColor=vec4(.5+.5*coastalWind(point)/speedBound,1.);
            }`,
        }),
        geometry = new THREE.PlaneGeometry(2, 2),
        mesh = new THREE.Mesh(geometry, material);
      mesh.frustumCulled = false;
      scene.add(mesh);
      let maximumError = 0;
      const samples = [];
      try {
        for (const time of times) {
          wind.updateWindUniforms(uniforms, time);
          material.uniformsNeedUpdate = true;
          const pixels = window.transportRead(renderer, target, scene, camera);
          for (let i = 0; i < points.length; i++) {
            const expected = wind.sampleWind(points[i], time),
              actual = [0, 1, 2].map((c) => ((pixels[i * 4 + c] / 255) * 2 - 1) * wind.WIND_SPEED_BOUND),
              error = Math.max(...actual.map((v, c) => Math.abs(v - expected[c])));
            maximumError = Math.max(maximumError, error);
            samples.push({ point: points[i], time, error });
          }
        }
        return { maximumError, quantizationStep: (2 * wind.WIND_SPEED_BOUND) / 255, samples, calls: renderer.info.render.calls };
      } finally {
        material.dispose();
        geometry.dispose();
        target.dispose();
        renderer.dispose();
      }
    }, baseURL);
    assert.equal(result.samples.length, 20);
    assert.ok(result.calls > 0, "the field must actually draw, not only compile a source string");
    assert.ok(result.maximumError <= result.quantizationStep * 0.75 + 0.0002, JSON.stringify(result));
    assert.deepEqual(errors, []);
    t.diagnostic(`20 native wind samples: max ${result.maximumError.toFixed(6)} m/s; RGBA8 step ${result.quantizationStep.toFixed(6)} m/s`);
  } finally {
    await page.close();
  }
});

test(
  "native skin diffuse transport changes a curved terminator without night glow or white-field gain",
  { skip: !baseURL, timeout: 60000 },
  async (t) => {
    const { page, errors } = await fixturePage();
    try {
      const result = await page.evaluate(async (origin) => {
        const THREE = window.transportThree,
          { createSkinDiffusion } = await import(`${origin}/assets/js/home-scene/skin-diffusion.mjs`),
          size = 128,
          extent = 0.095,
          radius = 0.08,
          renderer = window.transportRenderer(size),
          target = window.transportTarget(size),
          scene = new THREE.Scene(),
          camera = new THREE.OrthographicCamera(-extent, extent, extent, -extent, 0.01, 2),
          geometry = new THREE.SphereGeometry(radius, 96, 64),
          material = new THREE.MeshPhysicalMaterial({ name: "skin", color: 0xffffff, roughness: 0.75, metalness: 0, specularIntensity: 0 }),
          pipeline = createSkinDiffusion(),
          handle = pipeline.bind(material),
          mesh = new THREE.Mesh(geometry, material),
          key = new THREE.DirectionalLight(0xffffff, Math.PI * 0.6),
          ambient = new THREE.AmbientLight(0xffffff, 0);
        camera.position.set(0, 0, 0.5);
        camera.lookAt(0, 0, 0);
        key.position.set(1, 0, 0.12);
        scene.add(mesh, key, ambient);
        const read = () => window.transportRead(renderer, target, scene, camera);
        const compare = (a, b) => {
          let maximum = 0,
            changed = 0;
          for (let i = 0; i < a.length; i += 4) {
            const delta = Math.max(...[0, 1, 2].map((c) => Math.abs(a[i + c] - b[i + c])));
            maximum = Math.max(maximum, delta);
            if (delta > 0) changed++;
          }
          return { maximum, changed };
        };
        try {
          pipeline.setEnabled(false);
          const plain = read();
          pipeline.setEnabled(true);
          const diffused = read();
          handle.setEnabled(false);
          const localOff = read();
          handle.setEnabled(true);
          let grazingPixels = 0,
            grazingChanged = 0,
            nonblack = 0,
            maximumChannel = 0;
          const grazingDelta = [0, 0, 0];
          for (let y = 0; y < size; y++) {
            for (let x = 0; x < size; x++) {
              const index = (y * size + x) * 4,
                px = ((x + 0.5) / size) * 2 * extent - extent,
                py = ((y + 0.5) / size) * 2 * extent - extent,
                disk = (px * px + py * py) / (radius * radius);
              maximumChannel = Math.max(maximumChannel, ...diffused.subarray(index, index + 3));
              if (diffused[index] + diffused[index + 1] + diffused[index + 2] > 0) nonblack++;
              if (disk > 0.96) continue;
              const mu = (px / radius + 0.12 * Math.sqrt(1 - disk)) / Math.hypot(1, 0.12);
              if (Math.abs(mu) > 0.1) continue;
              grazingPixels++;
              if (Math.max(...[0, 1, 2].map((c) => Math.abs(diffused[index + c] - plain[index + c]))) >= 2) grazingChanged++;
              for (let c = 0; c < 3; c++) grazingDelta[c] += diffused[index + c] - plain[index + c];
            }
          }
          key.intensity = 0;
          const nightOn = read();
          pipeline.setEnabled(false);
          const nightOff = read();
          let nightMaximum = 0;
          for (let i = 0; i < nightOn.length; i += 4) nightMaximum = Math.max(nightMaximum, ...nightOn.subarray(i, i + 3));

          // A constant white ambient field is untouched, since only punctual
          // direct diffuse is replaced; it is not blurred into total beauty.
          ambient.intensity = Math.PI * 0.3;
          const ambientOff = read();
          pipeline.setEnabled(true);
          const ambientOn = read();
          ambient.intensity = 0;

          // Paired Fibonacci directions approximate a constant white incident
          // direct field. This finite quadrature is not a ground-truth BSSRDF.
          scene.remove(key);
          const fieldLights = [],
            directionCount = 32,
            golden = Math.PI * (3 - Math.sqrt(5));
          for (let i = 0; i < directionCount / 2; i++) {
            const z = (i + 0.5) / (directionCount / 2),
              ring = Math.sqrt(1 - z * z),
              azimuth = i * golden,
              direction = [ring * Math.cos(azimuth), ring * Math.sin(azimuth), z];
            for (const sign of [-1, 1]) {
              const light = new THREE.DirectionalLight(0xffffff, (Math.PI * 2.4) / directionCount);
              light.position.fromArray(direction.map((v) => v * sign));
              fieldLights.push(light);
              scene.add(light);
            }
          }
          pipeline.setEnabled(false);
          const whiteOff = read();
          pipeline.setEnabled(true);
          const whiteOn = read();
          let fieldPixels = 0,
            fieldMaximum = 0;
          const fieldMeanDelta = [0, 0, 0];
          for (let y = 0; y < size; y++) {
            for (let x = 0; x < size; x++) {
              const px = ((x + 0.5) / size) * 2 * extent - extent,
                py = ((y + 0.5) / size) * 2 * extent - extent;
              if ((px * px + py * py) / (radius * radius) > 0.9) continue;
              const index = (y * size + x) * 4;
              fieldPixels++;
              for (let c = 0; c < 3; c++) {
                fieldMeanDelta[c] += (whiteOn[index + c] - whiteOff[index + c]) / 255;
                fieldMaximum = Math.max(fieldMaximum, whiteOn[index + c] / 255);
              }
            }
          }
          for (const light of fieldLights) scene.remove(light);
          return {
            diffuseChange: compare(plain, diffused),
            localDisabled: compare(plain, localOff),
            grazingPixels,
            grazingChanged,
            grazingDelta,
            nonblack,
            maximumChannel,
            nightMaximum,
            nightDifference: compare(nightOff, nightOn),
            ambientDifference: compare(ambientOff, ambientOn),
            fieldMeanDelta: fieldMeanDelta.map((v) => v / fieldPixels),
            fieldMaximum,
            fieldPixels,
            compatible: handle.evidence.compatible,
            specularIntensity: material.specularIntensity,
          };
        } finally {
          pipeline.dispose();
          material.dispose();
          geometry.dispose();
          target.dispose();
          renderer.dispose();
        }
      }, baseURL);
      assert.equal(result.compatible, true);
      assert.equal(result.specularIntensity, 0);
      assert.ok(result.nonblack > 1000, "actual lit curved geometry must be visible");
      assert.ok(result.diffuseChange.maximum >= 2 && result.grazingChanged >= 20, JSON.stringify(result));
      assert.ok(result.grazingDelta[0] > result.grazingDelta[1] + 5, "the longer red profile must redistribute more light at the terminator");
      assert.equal(result.localDisabled.maximum, 0, "per-material disable must recover the same Lambert render");
      assert.ok(result.maximumChannel <= 155, "unit-mass diffuse response cannot exceed the white directional input's 0.6 bound plus quantization");
      assert.equal(result.nightMaximum, 0, "zero incident light must produce no scattering glow");
      assert.equal(result.nightDifference.maximum, 0);
      assert.equal(result.ambientDifference.maximum, 0, "constant ambient beauty must remain pixel-identical");
      assert.ok(result.fieldPixels > 1000);
      assert.ok(
        result.fieldMeanDelta.every((v) => Math.abs(v) < 0.015),
        "finite uniform-white direct quadrature cannot gain broad diffuse energy"
      );
      assert.ok(result.fieldMaximum < 0.7, "finite white-field response remains bounded around its expected 0.6 radiance");
      assert.deepEqual(errors, []);
      t.diagnostic(JSON.stringify(result));
    } finally {
      await page.close();
    }
  }
);

test(
  "rooted plant shaders compile in native beauty, normal, directional-depth and point-distance draws",
  { skip: !baseURL, timeout: 45000 },
  async (t) => {
    const { page, errors } = await fixturePage();
    try {
      const result = await page.evaluate(async (origin) => {
        const THREE = window.transportThree,
          wind = await import(`${origin}/assets/js/home-scene/wind-field.mjs`),
          plants = await import(`${origin}/assets/js/home-scene/plant-motion.mjs`),
          renderer = window.transportRenderer(64),
          target = window.transportTarget(64),
          scene = new THREE.Scene(),
          camera = new THREE.OrthographicCamera(-0.12, 0.12, 0.12, -0.12, 0.01, 3),
          geometry = new THREE.PlaneGeometry(0.12, 0.18, 4, 6),
          attributes = plants.buildPlantAttributes(geometry.attributes.position.array, geometry.index.array, { resolveRoot: () => [0, -0.09, 0] }),
          windUniforms = wind.createWindUniforms(),
          plantUniforms = plants.createPlantUniforms(),
          compiled = new Set(),
          standard = new THREE.MeshStandardMaterial({ color: 0x77a35d, roughness: 0.8, side: THREE.DoubleSide }),
          normal = new THREE.MeshNormalMaterial({ side: THREE.DoubleSide }),
          depth = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, side: THREE.DoubleSide }),
          distance = new THREE.MeshDistanceMaterial({ side: THREE.DoubleSide }),
          mesh = new THREE.Mesh(geometry, standard),
          sun = new THREE.DirectionalLight(0xffffff, 2),
          point = new THREE.PointLight(0xffffff, 1.5, 3);
        geometry.setAttribute("coastalPlantRoot", new THREE.BufferAttribute(attributes.root, 3));
        geometry.setAttribute("coastalPlantWeight", new THREE.BufferAttribute(attributes.weight, 1));
        geometry.setAttribute("coastalPlantGradient", new THREE.BufferAttribute(attributes.gradient, 3));
        geometry.computeBoundingSphere();
        geometry.boundingSphere.radius += 0.02;
        for (const [kind, material] of [
          ["standard", standard],
          ["normal", normal],
          ["depth", depth],
          ["distance", distance],
        ]) {
          material.onBeforeCompile = (shader) => {
            plants.patchPlantShader(shader, windUniforms, plantUniforms);
            compiled.add(kind);
          };
          material.customProgramCacheKey = () => `native-plant-${kind}`;
        }
        mesh.customDepthMaterial = depth;
        mesh.customDistanceMaterial = distance;
        mesh.castShadow = true;
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        camera.position.set(0, 0, 0.6);
        camera.lookAt(0, 0, 0);
        sun.position.set(0.3, 0.4, 0.8);
        point.position.set(0.2, 0.2, 0.5);
        for (const light of [sun, point]) {
          light.castShadow = true;
          light.shadow.mapSize.set(32, 32);
          light.shadow.camera.near = 0.03;
          light.shadow.camera.far = 3;
        }
        sun.shadow.camera.left = sun.shadow.camera.bottom = -0.25;
        sun.shadow.camera.right = sun.shadow.camera.top = 0.25;
        scene.add(mesh, sun, point);
        try {
          const beauty = window.transportRead(renderer, target, scene, camera),
            repeat = window.transportRead(renderer, target, scene, camera);
          renderer.shadowMap.enabled = false;
          scene.overrideMaterial = normal;
          const normals = window.transportRead(renderer, target, scene, camera);
          let nonblackBeauty = 0,
            nonblackNormal = 0,
            repeatMaximum = 0;
          for (let i = 0; i < beauty.length; i += 4) {
            if (beauty[i] + beauty[i + 1] + beauty[i + 2] > 0) nonblackBeauty++;
            if (normals[i] + normals[i + 1] + normals[i + 2] > 0) nonblackNormal++;
            for (let c = 0; c < 3; c++) repeatMaximum = Math.max(repeatMaximum, Math.abs(beauty[i + c] - repeat[i + c]));
          }
          return {
            compiled: [...compiled].sort(),
            enabledAttachments: attributes.evidence.enabled,
            nonblackBeauty,
            nonblackNormal,
            repeatMaximum,
            directionalShadow: Boolean(sun.shadow.map),
            pointShadow: Boolean(point.shadow.map),
            calls: renderer.info.render.calls,
          };
        } finally {
          for (const material of [standard, normal, depth, distance]) material.dispose();
          for (const light of [sun, point]) light.shadow.dispose();
          geometry.dispose();
          target.dispose();
          renderer.dispose();
        }
      }, baseURL);
      assert.deepEqual(result.compiled, ["depth", "distance", "normal", "standard"]);
      assert.equal(result.enabledAttachments, 1, "the fixture must exercise an enabled rooted leaf, not a skipped component");
      assert.equal(result.directionalShadow, true);
      assert.equal(result.pointShadow, true);
      assert.ok(result.nonblackBeauty > 100 && result.nonblackNormal > 100, JSON.stringify(result));
      assert.equal(result.repeatMaximum, 0, "an unchanged active clock must compose identical plant geometry and normals");
      assert.ok(result.calls > 0);
      assert.deepEqual(errors, []);
      t.diagnostic(JSON.stringify(result));
    } finally {
      await page.close();
    }
  }
);
