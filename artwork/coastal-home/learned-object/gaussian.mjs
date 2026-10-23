// Original bounded Gaussian decoder: fixed color, axis-aligned learned world covariance.
import * as THREE from "../../../assets/js/three.module.min.js";
const base = window.objectFieldCapture;
const manifest = await fetch("gaussians.json").then((r) => r.json());
const binary = await fetch("gaussians.f32").then((r) => r.arrayBuffer());
const hash = [...new Uint8Array(await crypto.subtle.digest("SHA-256", binary))].map((v) => v.toString(16).padStart(2, "0")).join("");
if (hash !== manifest.sha256) throw new Error("Learned Gaussian digest mismatch.");
const values = new Float32Array(binary),
  count = manifest.count;
const geometry = new THREE.InstancedBufferGeometry();
geometry.setAttribute("position", new THREE.Float32BufferAttribute([-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, -1, 0, 1, 1, 0, -1, 1, 0], 3));
const attributes = {
  center: new Float32Array(count * 2),
  extent: new Float32Array(count * 2),
  conic: new Float32Array(count * 3),
  rgba: new Float32Array(count * 4),
};
for (const [name, array] of Object.entries(attributes))
  geometry.setAttribute(name, new THREE.InstancedBufferAttribute(array, name === "conic" ? 3 : name === "rgba" ? 4 : 2));
geometry.instanceCount = count;
const material = new THREE.RawShaderMaterial({
  transparent: true,
  premultipliedAlpha: true,
  depthTest: false,
  depthWrite: false,
  uniforms: { size: { value: new THREE.Vector2(256, 256) } },
  vertexShader: `precision highp float;
attribute vec3 position;attribute vec2 center,extent;attribute vec3 conic;attribute vec4 rgba;
uniform vec2 size;varying vec2 delta;varying vec3 quadratic;varying vec4 tint;
void main(){delta=position.xy*extent;quadratic=conic;tint=rgba;gl_Position=vec4((center+delta)/size*2.-1.,0.,1.);}`,
  fragmentShader: `precision highp float;
varying vec2 delta;varying vec3 quadratic;varying vec4 tint;
void main(){float d=quadratic.x*delta.x*delta.x+2.*quadratic.y*delta.x*delta.y+quadratic.z*delta.y*delta.y;if(d>36.)discard;float a=min(.98,tint.a*exp(-.5*max(0.,d)));gl_FragColor=vec4(tint.rgb*a,a);}`,
});
const field = new THREE.Mesh(geometry, material);
field.frustumCulled = false;
field.visible = false;
base.scene.add(field);
const supportsFloatBlend = !!base.threeRenderer.getContext().getExtension("EXT_float_blend");
const target = new THREE.WebGLRenderTarget(256, 256, {
  type: supportsFloatBlend ? THREE.FloatType : THREE.HalfFloatType,
  depthBuffer: false,
  stencilBuffer: false,
});
const displayScene = new THREE.Scene(),
  displayCamera = new THREE.Camera();
const displayMaterial = new THREE.RawShaderMaterial({
  depthTest: false,
  depthWrite: false,
  uniforms: { image: { value: target.texture } },
  vertexShader: `precision highp float;attribute vec3 position;varying vec2 uv;void main(){uv=position.xy*.5+.5;gl_Position=vec4(position.xy,0.,1.);}`,
  fragmentShader: `precision highp float;uniform sampler2D image;varying vec2 uv;void main(){gl_FragColor=texture2D(image,uv);}`,
});
const displayGeometry = new THREE.PlaneGeometry(2, 2);
displayScene.add(new THREE.Mesh(displayGeometry, displayMaterial));
let mode = "mesh",
  yaw = 30,
  pitch = 10,
  size = 256,
  disposed = false;
function project() {
  const m = base.camera.matrixWorldInverse.elements,
    r = [
      [m[0], m[4], m[8]],
      [m[1], m[5], m[9]],
      [m[2], m[6], m[10]],
    ],
    t = [m[12], m[13], m[14]],
    f = size / (2 * Math.tan((35 * Math.PI) / 360));
  const projected = [];
  for (let i = 0; i < count; i++) {
    const b = i * 10,
      p = [values[b], values[b + 1], values[b + 2]],
      s = [values[b + 3], values[b + 4], values[b + 5]];
    const cp = r.map((row, k) => row.reduce((v, c, j) => v + c * p[j], t[k])),
      z = Math.max(0.05, -cp[2]);
    const j = [
      [f / z, 0, (f * cp[0]) / z ** 2],
      [0, f / z, (f * cp[1]) / z ** 2],
    ];
    const jr = j.map((row) => [0, 1, 2].map((k) => row.reduce((v, c, l) => v + c * r[l][k], 0)));
    const c00 = jr[0].reduce((v, c, k) => v + c * c * s[k] ** 2, 0.3),
      c11 = jr[1].reduce((v, c, k) => v + c * c * s[k] ** 2, 0.3),
      c01 = jr[0].reduce((v, c, k) => v + c * jr[1][k] * s[k] ** 2, 0),
      det = Math.max(1e-6, c00 * c11 - c01 * c01);
    projected.push({
      index: i,
      z,
      center: [(f * cp[0]) / z + size * 0.5, (f * cp[1]) / z + size * 0.5],
      extent: [6 * Math.sqrt(c00), 6 * Math.sqrt(c11)],
      conic: [c11 / det, -c01 / det, c00 / det],
    });
  }
  projected.sort((a, b) => b.z - a.z);
  for (let k = 0; k < count; k++) {
    const p = projected[k],
      b = p.index * 10;
    attributes.center.set(p.center, k * 2);
    attributes.extent.set(p.extent, k * 2);
    attributes.conic.set(p.conic, k * 3);
    attributes.rgba.set(values.subarray(b + 6, b + 10), k * 4);
  }
  for (const name of Object.keys(attributes)) geometry.attributes[name].needsUpdate = true;
  material.uniforms.size.value.set(size, size);
}
function draw() {
  if (disposed) return;
  const renderer = base.threeRenderer;
  renderer.info.autoReset = false;
  renderer.info.reset();
  base.model.visible = mode === "mesh";
  field.visible = mode === "gaussian";
  if (mode === "mesh") {
    renderer.render(base.scene, base.camera);
    return;
  }
  renderer.setRenderTarget(target);
  renderer.setClearColor(new THREE.Color(232 / 255, 228 / 255, 220 / 255), 1);
  renderer.render(base.scene, base.camera);
  renderer.setRenderTarget(null);
  renderer.setClearColor(0xe8e4dc, 1);
  renderer.render(displayScene, displayCamera);
}
function setView(y, p, s = 256) {
  yaw = y;
  pitch = p;
  size = s;
  if (base.threeRenderer.domElement.width !== size) {
    base.threeRenderer.setSize(size, size);
    target.setSize(size, size);
  }
  const angle = (yaw * Math.PI) / 180,
    elevation = (pitch * Math.PI) / 180,
    radius = 4.4;
  base.camera.position.set(
    Math.sin(angle) * Math.cos(elevation) * radius,
    Math.sin(elevation) * radius,
    Math.cos(angle) * Math.cos(elevation) * radius
  );
  base.camera.lookAt(0, 0, 0);
  base.camera.updateMatrixWorld(true);
  if (mode === "gaussian") project();
  draw();
}
function setMode(value) {
  mode = value;
  if (mode === "gaussian") project();
  draw();
  document.querySelector("#mode").textContent = mode === "mesh" ? "Show trained Gaussians" : "Show original mesh";
}
function readPixels() {
  draw();
  const gl = base.threeRenderer.getContext(),
    p = new Uint8Array(size * size * 4);
  gl.readPixels(0, 0, size, size, gl.RGBA, gl.UNSIGNED_BYTE, p);
  return p;
}
const gl = base.threeRenderer.getContext(),
  timer = gl.getExtension("EXT_disjoint_timer_query_webgl2");
let viewIndex = 0;
document.querySelector("#mode").addEventListener("click", () => setMode(mode === "mesh" ? "gaussian" : "mesh"));
document.querySelector("#rotate").addEventListener("click", () => {
  viewIndex = (viewIndex + 1) % 6;
  setView(30 + viewIndex * 60, 10, 256);
});
window.objectFieldLab = {
  setView,
  setMode,
  draw,
  pixels: readPixels,
  evidence: () => ({
    renderer: base.renderer(),
    weightsHash: hash,
    weightsBytes: binary.byteLength,
    count,
    framebufferBytes: size * size * 4 * (supportsFloatBlend ? 4 : 2),
    accumulation: supportsFloatBlend ? "RGBA32F" : "RGBA16F",
    gpuTimer: !!timer,
    contextLost: gl.isContextLost(),
    glError: gl.getError(),
    calls: base.threeRenderer.info.render.calls,
    triangles: base.threeRenderer.info.render.triangles,
  }),
  reprojection: () => {
    const values = [];
    for (let i = 0; i < 64; i++) {
      const t = performance.now();
      project();
      values.push(performance.now() - t);
    }
    return values;
  },
  benchmark: async (n = 12) => {
    const rows = [];
    for (const candidate of ["mesh", "gaussian", "gaussian", "mesh"]) {
      setMode(candidate);
      for (let i = 0; i < 8; i++) draw();
      for (let i = 0; i < n; i++) {
        const q = timer ? gl.createQuery() : null;
        if (q) gl.beginQuery(timer.TIME_ELAPSED_EXT, q);
        const t = performance.now();
        draw();
        gl.finish();
        const submissionAndFinishMs = performance.now() - t;
        if (q) gl.endQuery(timer.TIME_ELAPSED_EXT);
        let gpuMs = null,
          disjoint = false,
          timedOut = false;
        if (q) {
          const deadline = Date.now() + 3000;
          while (!gl.getQueryParameter(q, gl.QUERY_RESULT_AVAILABLE) && Date.now() < deadline) await new Promise(requestAnimationFrame);
          disjoint = gl.getParameter(timer.GPU_DISJOINT_EXT);
          timedOut = !gl.getQueryParameter(q, gl.QUERY_RESULT_AVAILABLE);
          if (!disjoint && !timedOut) gpuMs = gl.getQueryParameter(q, gl.QUERY_RESULT) / 1e6;
          gl.deleteQuery(q);
        }
        rows.push({ mode: candidate, submissionAndFinishMs, gpuMs, disjoint, timedOut });
        await new Promise(requestAnimationFrame);
      }
    }
    return rows;
  },
  dispose: () => {
    const before = { ...base.threeRenderer.info.memory };
    disposed = true;
    base.scene.remove(field);
    geometry.dispose();
    material.dispose();
    target.dispose();
    displayGeometry.dispose();
    displayMaterial.dispose();
    draw();
    return { disposed, before, after: { ...base.threeRenderer.info.memory }, removed: !base.scene.children.includes(field) };
  },
};
setView(30, 10, 256);
document.querySelector("#status").textContent =
  `${count} learned Gaussians, ${binary.byteLength.toLocaleString()} trained bytes. Fixed light; 64 � 64 training views.`;
