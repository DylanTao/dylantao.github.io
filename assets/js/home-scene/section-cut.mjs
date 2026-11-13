import * as THREE from "../three.module.min.js";

// Orbiting the house lifts its roof so the rooms can be seen (controller.mjs syncCutaway). The roof
// pieces are closed solids cut from the cliff, and lifting them leaves their seats showing: flat
// ledges and tall walls of rock that were never meant to be surfaces. An architect's section tells
// the eye which material was sliced by filling it with one tone, the poché, and hatching it.
//
// The cut faces are found exactly, per pixel, without touching the models: wherever the far side of
// a lifted solid lies on the surface the frame shows, that surface was in contact with the roof.
// The lifted solids are drawn once, back faces only, against the frame's own depth; the haze pass
// (haze.mjs) then prints the tone. One draw call, one byte target, and nothing at all while the
// roof is on.

export const SECTION_DEFAULTS = Object.freeze({
  tolerance: 0.035, // metres between a solid's far side and the visible surface that still count as contact
  distanceSlope: 0.002, // extra tolerance per metre of distance, for depth-buffer and mesh quantization
  tone: [0.34, 0.3, 0.27], // what the lit rock is multiplied by, for the part that keeps its shadows
  strength: 0.92,
  // Poché is one tone, not a lit surface. This much of the cut ignores the sun's shadows and takes
  // the flat colour below, lit only by the open sky and sun of the hour. Matched frames on
  // November 13 chose a muted umber: darker than the rock, lighter than a black fill, so the
  // rooms are the brightest thing in the section.
  flatten: 0.9,
  flat: [0.072, 0.06, 0.052],
  // The hatch: lines this many metres apart, this share of the spacing wide, this much lighter
  // than the tone they cross. Without it the cut rock is a large flat shape, and from above it is
  // most of the picture.
  hatch: [0.42, 0.1, 0.5],
});

// The hatch as the shader draws it, for tests and for anyone tuning it: how much of a line covers
// a point, given the pixel's footprint in spacings (`width`, the shader's fwidth).
export function hatchLine(world, [period, share], width) {
  const t = (world[0] + world[1] + world[2]) / period,
    fromLine = Math.abs(((((t - 0.5) % 1) + 1) % 1) - 0.5),
    smooth = (a, b, x) => {
      const u = Math.min(1, Math.max(0, (x - a) / (b - a)));
      return u * u * (3 - 2 * u);
    };
  return (1 - smooth(share * 0.5, share * 0.5 + width, fromLine)) * (1 - smooth(0.18, 0.4, width));
}

// Every triangle of the given meshes in world space, as one flat position array. Quantized or
// indexed attributes are read through three's accessors, so a compressed export needs no special case.
export function worldTriangles(meshes) {
  let count = 0;
  for (const mesh of meshes) count += mesh.geometry.index ? mesh.geometry.index.count : mesh.geometry.attributes.position.count;
  const positions = new Float32Array(count * 3),
    point = new THREE.Vector3();
  let offset = 0;
  for (const mesh of meshes) {
    const { index, attributes } = mesh.geometry,
      total = index ? index.count : attributes.position.count;
    mesh.updateWorldMatrix(true, false);
    for (let i = 0; i < total; i++) {
      point.fromBufferAttribute(attributes.position, index ? index.getX(i) : i).applyMatrix4(mesh.matrixWorld);
      positions[offset++] = point.x;
      positions[offset++] = point.y;
      positions[offset++] = point.z;
    }
  }
  return positions;
}

const vertexShader = /* glsl */ `
varying float vViewDepth;
void main() {
  vec4 view = modelViewMatrix * vec4(position, 1.0);
  vViewDepth = -view.z;
  gl_Position = projectionMatrix * view;
}`;

const fragmentShader = /* glsl */ `
uniform sampler2D tDepth;
uniform vec2 sectionResolution;
uniform vec3 sectionClip;      // near, far, 1 perspective / 0 orthographic
uniform vec2 sectionTolerance; // metres, metres per metre
varying float vViewDepth;
void main() {
  float depth = texture2D(tDepth, gl_FragCoord.xy / sectionResolution).x;
  float shown = sectionClip.z > 0.5
    ? sectionClip.x * sectionClip.y / max(sectionClip.y - depth * (sectionClip.y - sectionClip.x), 1e-5)
    : mix(sectionClip.x, sectionClip.y, depth);
  if (abs(shown - vViewDepth) > sectionTolerance.x + sectionTolerance.y * vViewDepth) discard;
  gl_FragColor = vec4(1.0);
}`;

// For the haze composite: the mask is black and the strength zero whenever the roof is on.
export const sectionGLSL = /* glsl */ `
uniform sampler2D tSection;
uniform vec4 sectionTone;
uniform vec4 sectionFlat;
uniform vec3 sectionHatch; // period in metres, line share of the period, strength
// A drawn section hatches what it cut. The lines are the planes x + y + z = constant, so they
// cross every level or upright face at 45 degrees and stay fixed to the rock as the view turns.
// Where they would fall closer than a few pixels they fade out instead of shimmering.
float sectionHatchLine(vec3 world) {
  float t = (world.x + world.y + world.z) / sectionHatch.x;
  float width = fwidth(t);
  float line = 1.0 - smoothstep(sectionHatch.y * 0.5, sectionHatch.y * 0.5 + width, abs(fract(t - 0.5) - 0.5));
  return line * (1.0 - smoothstep(0.18, 0.4, width));
}
// daylight: the radiance a white, level, unshadowed surface would send back at this hour.
vec3 sectionCut(vec3 colour, vec2 uv, vec3 daylight, vec3 world) {
  float mask = texture2D(tSection, uv).r * sectionTone.a;
  if (mask <= 0.0) return colour;
  vec3 cut = mix(colour * sectionTone.rgb, sectionFlat.rgb * daylight, sectionFlat.a);
  cut *= 1.0 + sectionHatch.z * sectionHatchLine(world);
  return mix(colour, cut, mask);
}`;

export function createSectionCut({ settings = {} } = {}) {
  const dials = { ...SECTION_DEFAULTS, ...settings };
  const scene = new THREE.Scene();
  const uniforms = {
    tDepth: { value: null },
    sectionResolution: { value: new THREE.Vector2(1, 1) },
    sectionClip: { value: new THREE.Vector3(0.05, 300, 1) },
    sectionTolerance: { value: new THREE.Vector2(dials.tolerance, dials.distanceSlope) },
  };
  const material = new THREE.ShaderMaterial({
    name: "Section cut faces",
    uniforms,
    vertexShader,
    fragmentShader,
    side: THREE.BackSide,
    depthTest: false,
    depthWrite: false,
    toneMapped: false,
  });
  const target = new THREE.WebGLRenderTarget(1, 1, { depthBuffer: false });
  target.texture.name = "Section cut mask";
  const none = new THREE.DataTexture(new Uint8Array([0, 0, 0, 0]), 1, 1);
  none.needsUpdate = true;
  const clear = new THREE.Color();
  let solids = null,
    sources = [],
    open = false,
    triangles = 0,
    draws = 0;

  function rebuild(roofs) {
    sources = roofs.slice();
    if (solids) {
      scene.remove(solids);
      solids.geometry.dispose();
      solids = null;
    }
    const meshes = [];
    for (const roof of roofs)
      roof.traverse((object) => {
        if (object.isMesh && object.geometry?.attributes.position) meshes.push(object);
      });
    triangles = 0;
    if (!meshes.length) return;
    const positions = worldTriangles(meshes),
      geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    triangles = positions.length / 9;
    solids = new THREE.Mesh(geometry, material);
    solids.matrixAutoUpdate = false;
    solids.frustumCulled = false;
    scene.add(solids);
  }

  return {
    dials,
    none,
    get open() {
      return open && Boolean(solids);
    },
    // Called with the roof pieces and whether the view has lifted them. The solids are rebuilt
    // only when the set of pieces changes (a model arriving), never per frame.
    sync(roofs, lifted) {
      if (roofs.length !== sources.length || roofs.some((roof, i) => roof !== sources[i])) rebuild(roofs);
      open = Boolean(lifted);
    },
    // Draws the mask for this frame and returns it, or null when there is nothing to mark.
    render(renderer, depthTexture, camera) {
      if (!this.open || !depthTexture?.image) return null;
      const width = depthTexture.image.width,
        height = depthTexture.image.height;
      if (target.width !== width || target.height !== height) target.setSize(width, height);
      uniforms.tDepth.value = depthTexture;
      uniforms.sectionResolution.value.set(width, height);
      uniforms.sectionClip.value.set(camera.near, camera.far, camera.isPerspectiveCamera ? 1 : 0);
      uniforms.sectionTolerance.value.set(dials.tolerance, dials.distanceSlope);
      const previous = renderer.getRenderTarget(),
        autoClear = renderer.autoClear,
        alpha = renderer.getClearAlpha();
      renderer.getClearColor(clear);
      try {
        renderer.setRenderTarget(target);
        renderer.setClearColor(0x000000, 0);
        renderer.autoClear = true;
        renderer.render(scene, camera);
        draws++;
      } finally {
        renderer.setClearColor(clear, alpha);
        renderer.autoClear = autoClear;
        renderer.setRenderTarget(previous);
      }
      return target.texture;
    },
    evidence() {
      return { open: this.open, pieces: sources.length, triangles, draws, drawCalls: solids ? 1 : 0, dials: { ...dials } };
    },
    dispose() {
      solids?.geometry.dispose();
      material.dispose();
      target.dispose();
      none.dispose();
    },
  };
}
