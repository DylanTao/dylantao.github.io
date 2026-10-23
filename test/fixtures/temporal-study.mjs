import * as THREE from "./../three.module.min.js";
import { EffectComposer } from "./../vendor/three-r164/postprocessing/EffectComposer.js";
import { RenderPass } from "./../vendor/three-r164/postprocessing/RenderPass.js";
import { OutputPass } from "./../vendor/three-r164/postprocessing/OutputPass.js";
import { Pass, FullScreenQuad } from "./../vendor/three-r164/postprocessing/Pass.js";
import { createTemporalAA } from "./temporal-aa.mjs";
import { createFinish } from "./realism.mjs";
import { stillPhotoJitter } from "./still-photo.mjs";

// Served by the test as assets/js/home-scene/temporal-study-fixture.mjs. Each reference averages
// spatial samples of ONE current pose. No reference integrates the moving sequence in time.
export async function runTemporalStudy({ size = 128, frames = 24, referenceSamples = 16 } = {}) {
  const renderer = new THREE.WebGLRenderer({ antialias: false, preserveDrawingBuffer: true });
  renderer.setSize(size, size);
  renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
  renderer.toneMapping = THREE.NoToneMapping;
  const scene = new THREE.Scene(),
    camera = new THREE.PerspectiveCamera(45, 1, 0.1, 20);
  scene.background = new THREE.Color(0.85, 0.85, 0.85);
  camera.position.z = 4;
  const bars = new THREE.Group();
  scene.add(bars);
  for (let i = 0; i < 13; i++) {
    const bar = new THREE.Mesh(new THREE.PlaneGeometry(0.009 + (i % 3) * 0.003, 3.8), new THREE.MeshBasicMaterial({ color: 0x080808 }));
    bar.position.x = (i - 6) * 0.23;
    bar.rotation.z = 0.28 + (i % 2) * 0.16;
    bars.add(bar);
  }
  function composer() {
    const target = new THREE.WebGLRenderTarget(size, size, { type: THREE.HalfFloatType, samples: 4 });
    const result = new EffectComposer(renderer, target);
    result.addPass(new RenderPass(scene, camera));
    return result;
  }
  const temporal = createTemporalAA(renderer, scene),
    aa = composer(),
    baseline = composer();
  aa.addPass(temporal.pass);
  aa.addPass(new OutputPass());
  baseline.addPass(new OutputPass());
  temporal.resize(size, size);
  const gl = renderer.getContext(),
    buffer = new Uint8Array(size * size * 4);
  const read = () => {
    gl.readPixels(0, 0, size, size, gl.RGBA, gl.UNSIGNED_BYTE, buffer);
    return new Uint8Array(buffer);
  };
  const mse = (a, b, predicate = () => true) => {
    let sum = 0,
      n = 0;
    for (let i = 0; i < a.length; i += 4)
      if (predicate(i)) {
        for (let c = 0; c < 3; c++) {
          sum += (a[i + c] / 255 - b[i + c] / 255) ** 2;
          n++;
        }
      }
    return sum / Math.max(1, n);
  };
  const reference = () => {
    const projection = camera.projectionMatrix.clone(),
      total = new Float32Array(size * size * 4);
    try {
      for (const [x, y] of stillPhotoJitter(referenceSamples)) {
        camera.projectionMatrix.copy(projection);
        camera.projectionMatrix.elements[8] += (x * 2) / size;
        camera.projectionMatrix.elements[9] += (y * 2) / size;
        camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
        baseline.render();
        const data = read();
        for (let i = 0; i < data.length; i++) total[i] += data[i] / referenceSamples;
      }
    } finally {
      camera.projectionMatrix.copy(projection);
      camera.projectionMatrixInverse.copy(projection).invert();
    }
    return total;
  };
  const measurements = [],
    submit = [];
  let finalImage, baselineImage, referenceImage;
  let previousErrors = null,
    baselineDelta = 0,
    temporalDelta = 0;
  for (let frame = 0; frame < frames; frame++) {
    bars.position.x = frame * 0.003;
    camera.position.x = frame * 0.001;
    camera.lookAt(camera.position.x, 0, 0);
    camera.updateMatrixWorld();
    const started = performance.now();
    temporal.begin(camera, "moving");
    aa.render();
    temporal.end();
    gl.finish();
    submit.push(performance.now() - started);
    const filtered = read();
    if (frame === frames - 1) finalImage = renderer.domElement.toDataURL();
    baseline.render();
    const raw = read();
    if (frame === frames - 1) baselineImage = renderer.domElement.toDataURL();
    if (frame >= frames - 8) {
      const truth = reference(),
        edge = (i) => truth[i] > 5 && truth[i] < 210;
      const errors = { raw: [], filtered: [] };
      for (let i = 0; i < raw.length; i += 4) {
        errors.raw.push((raw[i] - truth[i]) / 255);
        errors.filtered.push((filtered[i] - truth[i]) / 255);
      }
      if (previousErrors)
        for (let i = 0; i < errors.raw.length; i++) {
          baselineDelta += (errors.raw[i] - previousErrors.raw[i]) ** 2;
          temporalDelta += (errors.filtered[i] - previousErrors.filtered[i]) ** 2;
        }
      previousErrors = errors;
      if (frame === frames - 1) {
        const canvas = document.createElement("canvas");
        canvas.width = canvas.height = size;
        const data = new Uint8ClampedArray(truth.length);
        for (let y = 0; y < size; y++)
          for (let x = 0; x < size; x++) for (let c = 0; c < 4; c++) data[(y * size + x) * 4 + c] = truth[((size - 1 - y) * size + x) * 4 + c];
        canvas.getContext("2d").putImageData(new ImageData(data, size, size), 0, 0);
        referenceImage = canvas.toDataURL();
      }
      measurements.push({
        frame,
        baselineMSE: mse(raw, truth),
        temporalMSE: mse(filtered, truth),
        baselineEdgeMSE: mse(raw, truth, edge),
        temporalEdgeMSE: mse(filtered, truth, edge),
      });
    }
  }
  // A real foreground surface hides then reveals the high-frequency background. Its green
  // history lies inside the current neighborhood RGB box, so clipping alone cannot pass this.
  const cover = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 1.3), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.1, 0.8, 0.1) }));
  cover.position.set(-0.5, 0, 0.8);
  scene.add(cover);
  camera.position.set(0, 0, 4);
  camera.lookAt(0, 0, 0);
  camera.updateMatrixWorld();
  bars.position.x = 0;
  temporal.reset("disocclusion setup");
  for (let i = 0; i < 8; i++) {
    temporal.begin(camera, "reveal");
    aa.render();
    temporal.end();
  }
  cover.position.x = 1.1;
  temporal.begin(camera, "reveal");
  baseline.render();
  const current = read();
  aa.render();
  temporal.end();
  const exposed = read();
  const region = (i) => {
    const x = (i / 4) % size,
      y = Math.floor(i / 4 / size);
    return x > size * 0.32 && x < size * 0.43 && y > size * 0.38 && y < size * 0.62;
  };
  const disocclusionMSE = mse(exposed, current, region);
  scene.remove(cover);
  cover.geometry.dispose();
  cover.material.dispose();
  const reactivePlane = new THREE.Mesh(
    new THREE.PlaneGeometry(1.1, 1.3),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(0.8, 0.15, 0.65), transparent: true, opacity: 0.5 })
  );
  reactivePlane.position.set(-0.5, 0, 0.8);
  scene.add(reactivePlane);
  temporal.begin(camera, "reveal");
  baseline.render();
  const reactiveCurrent = read();
  aa.render();
  temporal.end();
  const reactiveMSE = mse(read(), reactiveCurrent, region);
  scene.remove(reactivePlane);
  reactivePlane.geometry.dispose();
  reactivePlane.material.dispose();

  // Actual skin and CPU vertex history, independent of rigid object movement.
  bars.visible = false;
  const geometry = new THREE.PlaneGeometry(1.5, 1.5),
    bone = new THREE.Bone(),
    skeleton = new THREE.Skeleton([bone]);
  geometry.setAttribute("skinIndex", new THREE.Uint16BufferAttribute(new Uint16Array(geometry.attributes.position.count * 4), 4));
  const weights = new Float32Array(geometry.attributes.position.count * 4);
  for (let i = 0; i < weights.length; i += 4) weights[i] = 1;
  geometry.setAttribute("skinWeight", new THREE.Float32BufferAttribute(weights, 4));
  const skin = new THREE.SkinnedMesh(geometry, new THREE.MeshBasicMaterial({ color: 0x113366 }));
  skin.add(bone);
  skin.bind(skeleton);
  scene.add(skin);
  temporal.reset("skin setup");
  let skinExpected, skinMotion, cpuExpected, cpuMotion, cameraExpected, cameraMotion;
  function velocitySample(move, kind) {
    temporal.begin(camera, kind);
    aa.render();
    const before = camera.projectionMatrix.clone();
    temporal.end();
    move();
    camera.updateMatrixWorld();
    temporal.begin(camera, kind);
    const now = camera.projectionMatrix.clone();
    aa.render();
    temporal.end();
    const measured = temporal.sampleMotion(Math.floor(size / 2), Math.floor(size / 2));
    return { measured, before, now };
  }
  const sk = velocitySample(() => {
    bone.position.x = 0.1;
  }, "skin");
  skinMotion = sk.measured;
  skinExpected = ((sk.now.elements[0] * 0.1) / 4 - sk.now.elements[8] + sk.before.elements[8]) * 0.5;
  scene.remove(skin);
  skeleton.dispose();
  skin.material.dispose();
  geometry.dispose();
  const cpuGeometry = new THREE.PlaneGeometry(1.5, 1.5),
    cpu = new THREE.Mesh(cpuGeometry, new THREE.MeshBasicMaterial({ color: 0x663311 }));
  scene.add(cpu);
  const cp = velocitySample(() => {
    const p = cpuGeometry.attributes.position;
    for (let i = 0; i < p.count; i++) p.setX(i, p.getX(i) + 0.1);
    p.needsUpdate = true;
  }, "cpu");
  cpuMotion = cp.measured;
  cpuExpected = ((cp.now.elements[0] * 0.1) / 4 - cp.now.elements[8] + cp.before.elements[8]) * 0.5;
  const ca = velocitySample(() => {
    camera.position.x = 0.1;
    camera.lookAt(0.1, 0, 0);
  }, "camera");
  cameraMotion = ca.measured;
  cameraExpected = ((-ca.now.elements[0] * 0.1) / 4 - ca.now.elements[8] + ca.before.elements[8]) * 0.5;
  const retiredGeometryReleased = !geometry.hasAttribute("temporalPreviousPosition"),
    retainedGeometryBytes = temporal.evidence.geometryHistoryBytes,
    expectedGeometryBytes = cpuGeometry.attributes.position.count * 3 * 4;
  const unsupported = new THREE.Sprite(new THREE.SpriteMaterial());
  scene.add(unsupported);
  const beforeUnsupported = camera.projectionMatrix.toArray();
  temporal.begin(camera, "unsupported");
  const unsupportedCoverage = temporal.evidence,
    unsupportedProjectionRestored = beforeUnsupported.every((v, i) => v === camera.projectionMatrix.elements[i]);
  temporal.end();
  scene.remove(unsupported);
  unsupported.material.dispose();
  const projection = camera.projectionMatrix.toArray(),
    inverse = camera.projectionMatrixInverse.toArray();
  temporal.begin(camera, "failure");
  temporal.end(false);
  const restored =
    projection.every((v, i) => v === camera.projectionMatrix.elements[i]) &&
    inverse.every((v, i) => v === camera.projectionMatrixInverse.elements[i]);
  const stats = temporal.evidence;
  temporal.resize(2000, 2000);
  temporal.begin(camera, "large");
  const overBudget = temporal.evidence;
  temporal.end();
  temporal.dispose();
  const attributesRestored = !cpuGeometry.hasAttribute("temporalPreviousPosition");
  const sorted = submit.slice(4).sort((a, b) => a - b),
    median = sorted[Math.floor(sorted.length / 2)];
  scene.traverse((o) => {
    o.geometry?.dispose();
    [o.material]
      .flat()
      .filter(Boolean)
      .forEach((m) => m.dispose());
  });
  aa.passes.forEach((p) => p.dispose());
  baseline.passes.forEach((p) => p.dispose());
  aa.dispose();
  baseline.dispose();
  // Exercise the actual finish pipeline, including a depth-consuming haze-position pass.
  // TAA must replace beauty color without swapping away the current beauty depth.
  const depthScene = new THREE.Scene(),
    depthCamera = new THREE.PerspectiveCamera(45, 1, 1, 10),
    plane = new THREE.Mesh(new THREE.PlaneGeometry(4, 4), new THREE.MeshBasicMaterial({ color: 0x778899 })),
    depthPass = new Pass(),
    depthUniform = { value: null },
    depthMaterial = new THREE.ShaderMaterial({
      uniforms: { image: depthUniform },
      vertexShader: "varying vec2 vUv; void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}",
      fragmentShader: "varying vec2 vUv; uniform sampler2D image; void main(){gl_FragColor=vec4(vec3(texture2D(image,vUv).r),1.);}",
      depthWrite: false,
      depthTest: false,
    }),
    depthQuad = new FullScreenQuad(depthMaterial);
  depthCamera.position.z = 3;
  depthCamera.updateMatrixWorld();
  depthScene.add(plane);
  depthPass.render = (activeRenderer, writeBuffer, readBuffer) => {
    depthUniform.value = readBuffer.depthTexture;
    activeRenderer.setRenderTarget(writeBuffer);
    depthQuad.render(activeRenderer);
  };
  const probeHaze = {
      pass: depthPass,
      programWarmup: [],
      prepare() {},
      restore() {},
      evidence() {
        return {};
      },
      dispose() {},
    },
    depthFinish = createFinish(renderer, depthScene, depthCamera, {
      temporalFactory: createTemporalAA,
      haze: probeHaze,
    });
  depthFinish.resize(size, size);
  depthFinish.render(depthCamera, true, "depth");
  depthFinish.render(depthCamera, true, "depth");
  const downstreamDepth = read()[(Math.floor(size / 2) * size + Math.floor(size / 2)) * 4] / 255,
    expectedDownstreamDepth = new THREE.Vector3().project(depthCamera).z * 0.5 + 0.5;
  const depthProjection = depthCamera.projectionMatrix.toArray(),
    depthInverse = depthCamera.projectionMatrixInverse.toArray();
  let failuresCaught = 0;
  probeHaze.prepare = () => {
    throw new Error("deliberate prepare failure");
  };
  try {
    depthFinish.render(depthCamera, true, "depth");
  } catch (error) {
    if (error.message === "deliberate prepare failure") failuresCaught++;
    else throw error;
  }
  probeHaze.prepare = () => {};
  probeHaze.restore = () => {
    throw new Error("deliberate restore failure");
  };
  try {
    depthFinish.render(depthCamera, true, "depth");
  } catch (error) {
    if (error.message === "deliberate restore failure") failuresCaught++;
    else throw error;
  }
  const finishFailureRestored =
    failuresCaught === 2 &&
    depthProjection.every((v, i) => v === depthCamera.projectionMatrix.elements[i]) &&
    depthInverse.every((v, i) => v === depthCamera.projectionMatrixInverse.elements[i]);
  depthFinish.dispose();
  depthMaterial.dispose();
  depthQuad.dispose();
  plane.geometry.dispose();
  plane.material.dispose();
  renderer.dispose();
  const average = (key) => measurements.reduce((s, m) => s + m[key], 0) / measurements.length;
  return {
    measurements,
    baselineMSE: average("baselineMSE"),
    temporalMSE: average("temporalMSE"),
    baselineEdgeMSE: average("baselineEdgeMSE"),
    temporalEdgeMSE: average("temporalEdgeMSE"),
    baselineErrorDelta: baselineDelta,
    temporalErrorDelta: temporalDelta,
    disocclusionMSE,
    reactiveMSE,
    skinMotion,
    skinExpected,
    cpuMotion,
    cpuExpected,
    cameraMotion,
    cameraExpected,
    downstreamDepth,
    expectedDownstreamDepth,
    finishFailureRestored,
    retiredGeometryReleased,
    retainedGeometryBytes,
    expectedGeometryBytes,
    unsupportedCoverage,
    unsupportedProjectionRestored,
    restored,
    attributesRestored,
    overBudget,
    stats,
    medianSubmitMilliseconds: median,
    referenceSamples,
    reference: "independent spatial supersampling of each current moving pose",
    finalImage,
    baselineImage,
    referenceImage,
  };
}
