// Original dependency-free WebGL2 decoder. It uses the exported trained weights.
const canvas = document.querySelector("canvas");
const status = document.querySelector("#status");
const gl = canvas.getContext("webgl2", { alpha: false, antialias: false, preserveDrawingBuffer: true });
if (!gl) throw new Error("This local field study needs WebGL2.");
const [manifest, binary, image] = await Promise.all([
  fetch("field.json").then((r) => r.json()),
  fetch("field.i16").then((r) => r.arrayBuffer()),
  new Promise((resolve, reject) => {
    const i = new Image();
    i.onload = () => resolve(i);
    i.onerror = reject;
    i.src = "../coastal-print.webp";
  }),
]);
const digest = [...new Uint8Array(await crypto.subtle.digest("SHA-256", binary))].map((v) => v.toString(16).padStart(2, "0")).join("");
if (digest !== manifest.weights_sha256) throw new Error("Trained weights failed their source digest.");
const quantized = new Int16Array(binary);
const blocks = Object.fromEntries(
  manifest.blocks.map((b) => [b.name, { ...b, values: Float32Array.from(quantized.subarray(b.offset, b.offset + b.count), (v) => v * b.scale) }])
);
const vertex = `#version 300 es
void main() { vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2)); gl_Position = vec4(p * 2. - 1., 0., 1.); }`;
const fragment = `#version 300 es
precision highp float;
uniform vec2 resolution, center;
uniform float zoom;
uniform int mode;
uniform sampler2D original, grid0, grid1, grid2;
uniform vec4 weight0[96], weight1[144], weight2[24];
uniform vec4 bias0[6], bias1[6], bias2;
out vec4 color;
vec4 feature(sampler2D t, vec2 uv) {
  vec2 p = clamp(uv,0.,1.) * vec2(textureSize(t,0)-1);
  ivec2 lo = ivec2(floor(p)), hi = min(lo+1,textureSize(t,0)-1);
  vec2 f = fract(p);
  return mix(mix(texelFetch(t,lo,0),texelFetch(t,ivec2(hi.x,lo.y),0),f.x),mix(texelFetch(t,ivec2(lo.x,hi.y),0),texelFetch(t,hi,0),f.x),f.y);
}
float component(vec4 v, int i) { return v[i]; }
void main() {
  vec2 uv = (vec2(gl_FragCoord.x/resolution.x,1.-gl_FragCoord.y/resolution.y)-.5)/zoom+center;
  vec3 bg = vec3(.96,.94,.9);
  if (any(lessThan(uv,vec2(0.))) || any(greaterThan(uv,vec2(1.)))) { color = vec4(bg,1.); return; }
  vec4 c;
  if (mode==0) {
    vec2 st = (uv*vec2(textureSize(original,0)-1)+.5)/vec2(textureSize(original,0));
    vec4 source = texture(original,st); c = vec4(source.rgb*source.a,source.a);
  } else {
    vec4 f0=feature(grid0,uv), f1=feature(grid1,uv), f2=feature(grid2,uv);
    vec4 input0=vec4(uv*2.-1.,f0.xy), input1=vec4(f0.zw,f1.xy), input2=vec4(f1.zw,f2.xy), input3=vec4(f2.zw,0.,0.);
    float a[24], b[24];
    for(int i=0;i<24;i++) a[i]=max(0.,component(bias0[i/4],i%4)+dot(weight0[i*4],input0)+dot(weight0[i*4+1],input1)+dot(weight0[i*4+2],input2)+dot(weight0[i*4+3],input3));
    for(int i=0;i<24;i++) { float s=component(bias1[i/4],i%4); for(int j=0;j<6;j++) s+=dot(weight1[i*6+j],vec4(a[j*4],a[j*4+1],a[j*4+2],a[j*4+3])); b[i]=max(0.,s); }
    for(int i=0;i<4;i++) { float s=bias2[i]; for(int j=0;j<6;j++) s+=dot(weight2[i*6+j],vec4(b[j*4],b[j*4+1],b[j*4+2],b[j*4+3])); c[i]=1./(1.+exp(-s)); }
  }
  color=vec4(clamp(c.rgb+bg*(1.-c.a),0.,1.),1.);
}`;
function shader(type, code) {
  const s = gl.createShader(type);
  gl.shaderSource(s, code);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
  return s;
}
const program = gl.createProgram();
const vs = shader(gl.VERTEX_SHADER, vertex),
  fs = shader(gl.FRAGMENT_SHADER, fragment);
gl.attachShader(program, vs);
gl.attachShader(program, fs);
gl.linkProgram(program);
if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program));
gl.deleteShader(vs);
gl.deleteShader(fs);
gl.useProgram(program);
const textures = [];
function texture(unit, name, width, height, pixels, float = false) {
  const t = gl.createTexture();
  textures.push(t);
  gl.activeTexture(gl.TEXTURE0 + unit);
  gl.bindTexture(gl.TEXTURE_2D, t);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, float ? gl.NEAREST : gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, float ? gl.NEAREST : gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  if (float) gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, width, height, 0, gl.RGBA, gl.FLOAT, pixels);
  else gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
  gl.uniform1i(gl.getUniformLocation(program, name), unit);
}
texture(0, "original", image.width, image.height, image);
for (let i = 0; i < 3; i++) {
  const b = blocks[`grid${i}`];
  texture(i + 1, `grid${i}`, b.shape[1], b.shape[0], b.values, true);
}
for (let i = 0; i < 3; i++) {
  const b = blocks[`weight${i}`],
    cols = b.shape[1],
    stride = Math.ceil(cols / 4) * 4;
  const packed = new Float32Array(b.shape[0] * stride);
  for (let row = 0; row < b.shape[0]; row++) packed.set(b.values.subarray(row * cols, (row + 1) * cols), row * stride);
  gl.uniform4fv(gl.getUniformLocation(program, `weight${i}[0]`), packed);
  gl.uniform4fv(gl.getUniformLocation(program, i === 2 ? "bias2" : `bias${i}[0]`), blocks[`bias${i}`].values);
}
let mode = 0,
  center = [0.5, 0.5],
  zoom = 1,
  disposed = false;
function draw() {
  if (disposed) return;
  gl.viewport(0, 0, canvas.width, canvas.height);
  gl.uniform2f(gl.getUniformLocation(program, "resolution"), canvas.width, canvas.height);
  gl.uniform2fv(gl.getUniformLocation(program, "center"), center);
  gl.uniform1f(gl.getUniformLocation(program, "zoom"), zoom);
  gl.uniform1i(gl.getUniformLocation(program, "mode"), mode);
  gl.drawArrays(gl.TRIANGLES, 0, 3);
}
function setView(name) {
  const v = { whole: [0.5, 0.5, 1], cliff: [0.34, 0.54, 3], agave: [0.76, 0.63, 4] }[name];
  if (!v) throw new Error("Unknown study view");
  center = v.slice(0, 2);
  zoom = v[2];
  draw();
}
function setMode(value) {
  mode = value === "field" ? 1 : 0;
  document.querySelector("#mode").value = mode ? "field" : "image";
  draw();
}
document.querySelector("#mode").addEventListener("change", (e) => setMode(e.target.value));
document.querySelector("#view").addEventListener("change", (e) => setView(e.target.value));
document.querySelector("#reset").addEventListener("click", () => {
  document.querySelector("#view").value = "whole";
  setView("whole");
});
let previous = null;
canvas.addEventListener("pointerdown", (e) => {
  previous = [e.clientX, e.clientY];
  canvas.setPointerCapture(e.pointerId);
});
canvas.addEventListener("pointermove", (e) => {
  if (!previous) return;
  const r = canvas.getBoundingClientRect();
  center[0] -= (e.clientX - previous[0]) / r.width / zoom;
  center[1] -= (e.clientY - previous[1]) / r.height / zoom;
  previous = [e.clientX, e.clientY];
  draw();
});
for (const event of ["pointerup", "pointercancel", "lostpointercapture"])
  canvas.addEventListener(event, () => {
    previous = null;
  });
canvas.addEventListener(
  "wheel",
  (e) => {
    e.preventDefault();
    zoom = Math.min(12, Math.max(0.75, zoom * Math.exp(-e.deltaY * 0.001)));
    draw();
  },
  { passive: false }
);
canvas.addEventListener("keydown", (e) => {
  let handled = true;
  if (e.key === "ArrowLeft") center[0] -= 0.04 / zoom;
  else if (e.key === "ArrowRight") center[0] += 0.04 / zoom;
  else if (e.key === "ArrowUp") center[1] -= 0.04 / zoom;
  else if (e.key === "ArrowDown") center[1] += 0.04 / zoom;
  else if (e.key === "+" || e.key === "=") zoom = Math.min(12, zoom * 1.2);
  else if (e.key === "-") zoom = Math.max(0.75, zoom / 1.2);
  else handled = false;
  if (handled) {
    e.preventDefault();
    draw();
  }
});
const debug = gl.getExtension("WEBGL_debug_renderer_info");
const timer = gl.getExtension("EXT_disjoint_timer_query_webgl2");
window.printFieldStudy = {
  manifest,
  setMode,
  setView,
  draw,
  state: () => ({ mode, center: [...center], zoom, disposed, resolution: [canvas.width, canvas.height] }),
  evidence: () => ({
    renderer: debug ? gl.getParameter(debug.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER),
    weightsSha256: digest,
    weightsBytes: binary.byteLength,
    sourceSize: [image.width, image.height],
    maxFragmentUniformVectors: gl.getParameter(gl.MAX_FRAGMENT_UNIFORM_VECTORS),
    gpuTimer: !!timer,
    contextLost: gl.isContextLost(),
    glError: gl.getError(),
  }),
  pixels: () => {
    draw();
    const data = new Uint8Array(canvas.width * canvas.height * 4);
    gl.readPixels(0, 0, canvas.width, canvas.height, gl.RGBA, gl.UNSIGNED_BYTE, data);
    return data;
  },
  benchmark: async (iterations = 16) => {
    const rows = [];
    const start = { mode, center: [...center], zoom };
    for (const candidate of [0, 1, 1, 0]) {
      mode = candidate;
      for (let i = 0; i < 8; i++) draw();
      gl.finish();
      for (let i = 0; i < iterations; i++) {
        const query = timer ? gl.createQuery() : null;
        if (query) gl.beginQuery(timer.TIME_ELAPSED_EXT, query);
        const t = performance.now();
        draw();
        gl.finish();
        const submissionAndFinishMs = performance.now() - t;
        if (query) gl.endQuery(timer.TIME_ELAPSED_EXT);
        let gpuMs = null,
          disjoint = false,
          timedOut = false;
        if (query) {
          const limit = Date.now() + 3000;
          while (!gl.getQueryParameter(query, gl.QUERY_RESULT_AVAILABLE) && Date.now() < limit) await new Promise(requestAnimationFrame);
          disjoint = gl.getParameter(timer.GPU_DISJOINT_EXT);
          timedOut = !gl.getQueryParameter(query, gl.QUERY_RESULT_AVAILABLE);
          if (!disjoint && !timedOut) gpuMs = gl.getQueryParameter(query, gl.QUERY_RESULT) / 1e6;
          gl.deleteQuery(query);
        }
        rows.push({ mode: candidate ? "field" : "image", submissionAndFinishMs, gpuMs, disjoint, timedOut });
        await new Promise(requestAnimationFrame);
      }
    }
    ({ mode, center, zoom } = start);
    draw();
    return rows;
  },
  dispose: () => {
    disposed = true;
    for (const t of textures) gl.deleteTexture(t);
    gl.useProgram(null);
    gl.deleteProgram(program);
    return { texturesReleased: textures.every((t) => !gl.isTexture(t)), programReleased: !gl.isProgram(program) };
  },
};
draw();
if (gl.getError() !== gl.NO_ERROR) throw new Error("WebGL study setup error.");
status.textContent = `Ready. ${binary.byteLength.toLocaleString()} trained weight bytes; image ${image.width} × ${image.height}.`;
