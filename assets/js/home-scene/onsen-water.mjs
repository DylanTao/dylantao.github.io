import * as THREE from "../three.module.min.js";
import { createHeightfieldWater } from "./heightfield-water.mjs";

// Nearest-filter float storage plus manual bilinear interpolation requires no
// float-linear filtering extension. RGB = elevation and world X/Z derivatives;
// A = wet-cell weight. Renormalization extends the surface through solid cells
// for rendering; the numerical fluxes still stop at the solid face.
export const poolSamplingGLSL = `
uniform highp sampler2D poolHeightfield;
uniform vec2 poolGrid, poolCenter, poolSize;
uniform float poolSolidElevation;
vec3 samplePool(vec2 point) {
  vec2 p=clamp((point-poolCenter)/poolSize+.5,vec2(0.),vec2(1.))*poolGrid-.5;
  vec2 base=floor(p), f=fract(p);
  vec2 lo=clamp(base,vec2(0.),poolGrid-1.);
  vec2 hi=clamp(base+1.,vec2(0.),poolGrid-1.);
  vec4 a=texture2D(poolHeightfield,(lo+.5)/poolGrid);
  vec4 b=texture2D(poolHeightfield,(vec2(hi.x,lo.y)+.5)/poolGrid);
  vec4 c=texture2D(poolHeightfield,(vec2(lo.x,hi.y)+.5)/poolGrid);
  vec4 d=texture2D(poolHeightfield,(hi+.5)/poolGrid);
  vec4 weights=vec4((1.-f.x)*(1.-f.y),f.x*(1.-f.y),(1.-f.x)*f.y,f.x*f.y)*vec4(a.a,b.a,c.a,d.a);
  float weight=dot(weights,vec4(1.));
  if(weight<.00001) return vec3(poolSolidElevation,0.,0.);
  return (a.rgb*weights.x+b.rgb*weights.y+c.rgb*weights.z+d.rgb*weights.w)/weight;
}
`;

export function createOnsenWater({
  center = [3.02, -1.82],
  surfaceY = 3.0075,
  radius = 0.86,
  depth = 0.24,
  bottomY = null,
  depthSource = "illustrative parameter",
  ...solverOptions
} = {}) {
  if (!Array.isArray(center) || center.length !== 2 || ![...center, surfaceY, radius].every(Number.isFinite))
    throw new RangeError("finite world-space pool geometry required");
  const solver = createHeightfieldWater({ ...solverOptions, width: radius * 2, length: radius * 2, radius, depth }),
    data = solver.writeSurface(),
    texture = new THREE.DataTexture(data, solver.grid.nx, solver.grid.nz, THREE.RGBAFormat, THREE.FloatType),
    uniforms = {
      poolHeightfield: { value: texture },
      poolGrid: { value: new THREE.Vector2(solver.grid.nx, solver.grid.nz) },
      poolCenter: { value: new THREE.Vector2(...center) },
      poolSize: { value: new THREE.Vector2(radius * 2, radius * 2) },
      poolSolidElevation: { value: 0 },
      poolLocalUp: { value: new THREE.Vector3(0, 1, 0) },
    },
    bindings = new Map();
  texture.minFilter = texture.magFilter = THREE.NearestFilter;
  texture.generateMipmaps = false;
  texture.colorSpace = THREE.NoColorSpace;
  texture.needsUpdate = true;
  let disposed = false,
    bather = null,
    uploads = 1;
  function upload() {
    solver.writeSurface(data);
    texture.needsUpdate = true;
    uploads++;
  }

  function bindMaterial(material, mesh = null) {
    if (disposed) throw new Error("pool adapter is disposed");
    if (bindings.has(material)) return;
    const compile = material.onBeforeCompile,
      cache = material.customProgramCacheKey;
    if (mesh) {
      mesh.updateWorldMatrix(true, false);
      const inverse = new THREE.Matrix4().copy(mesh.matrixWorld).invert(),
        e = inverse.elements;
      // Keep scale, unlike transformDirection(), so a meter stays a meter.
      uniforms.poolLocalUp.value.set(e[4], e[5], e[6]);
    }
    material.onBeforeCompile = function (shader, renderer) {
      compile.call(this, shader, renderer);
      Object.assign(shader.uniforms, uniforms);
      shader.vertexShader = `uniform vec3 poolLocalUp; varying vec2 simulatedPoolXZ;\n${poolSamplingGLSL}\n` + shader.vertexShader;
      shader.vertexShader = shader.vertexShader.replace(
        "#include <begin_vertex>",
        `#include <begin_vertex>
        simulatedPoolXZ=(modelMatrix*vec4(transformed,1.)).xz;
        transformed+=poolLocalUp*samplePool(simulatedPoolXZ).x;`
      );
      // Replace the site's existing authored sinusoidal pool normal before
      // applying the derivative of the simulated field. Contact lighting stays.
      shader.fragmentShader = shader.fragmentShader.replace(
        /vec2 ripple = poolPoint\.xz \* 15\.0;[\s\S]*?normal = normalize\(mat3\(viewMatrix\)\*vec3\(a\*\.075,1\.0,b\*\.075\)\);/,
        ""
      );
      shader.fragmentShader = `varying vec2 simulatedPoolXZ;\n${poolSamplingGLSL}\n` + shader.fragmentShader;
      shader.fragmentShader = shader.fragmentShader.replace(
        "#include <normal_fragment_maps>",
        `#include <normal_fragment_maps>
        vec3 poolSample=samplePool(simulatedPoolXZ);
        normal=normalize(mat3(viewMatrix)*vec3(-poolSample.y,1.,-poolSample.z));`
      );
    };
    material.customProgramCacheKey = function () {
      return `${cache.call(this)}:coastal-heightfield-v1`;
    };
    bindings.set(material, { compile, cache });
    material.needsUpdate = true;
  }

  function surfaceGeometry({ rings = 20, segments = 96 } = {}) {
    if (!Number.isInteger(rings) || !Number.isInteger(segments) || rings < 2 || rings > 64 || segments < 16 || segments > 128)
      throw new RangeError("bounded pool tessellation required");
    const positions = [center[0], surfaceY, center[1]],
      normals = [0, 1, 0],
      uv = [0.5, 0.5],
      indices = [];
    for (let r = 1; r <= rings; r++)
      for (let i = 0; i < segments; i++) {
        const theta = (i * Math.PI * 2) / segments,
          x = (Math.cos(theta) * radius * r) / rings,
          z = (Math.sin(theta) * radius * r) / rings;
        positions.push(center[0] + x, surfaceY, center[1] + z);
        normals.push(0, 1, 0);
        uv.push(x / (radius * 2) + 0.5, z / (radius * 2) + 0.5);
        const b = 1 + (r - 1) * segments + i,
          next = 1 + (r - 1) * segments + ((i + 1) % segments);
        if (r === 1) indices.push(0, next, b);
        else {
          const a = b - segments,
            aNext = next - segments;
          indices.push(a, aNext, b, b, aNext, next);
        }
      }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute("normal", new THREE.Float32BufferAttribute(normals, 3));
    geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
    geometry.setIndex(indices);
    geometry.computeBoundingSphere();
    return geometry;
  }

  function setBather(body) {
    if (disposed) return false;
    if (
      body &&
      (![body.x, body.z, body.radius ?? 0.17].every(Number.isFinite) ||
        Math.hypot(body.x - center[0], body.z - center[1]) + (body.radius ?? 0.17) > radius)
    )
      throw new RangeError("bather obstacle must fit inside the pool");
    const local = body ? { x: body.x - center[0], z: body.z - center[1], radius: body.radius ?? 0.17 } : null;
    // Ignore sub-cell breathing/IK noise; it must not remesh the basin each RAF.
    if (
      (!local && !bather) ||
      (local &&
        bather &&
        Math.hypot(local.x - bather.x, local.z - bather.z) < Math.min(solver.grid.dx, solver.grid.dz) / 2 &&
        local.radius === bather.radius)
    )
      return false;
    bather = local;
    const changed = solver.setObstacle(local);
    if (changed) {
      const state = solver.evidence();
      uniforms.poolSolidElevation.value = state.volume / (state.wetCells * solver.grid.dx * solver.grid.dz) - depth;
      upload();
    }
    return changed;
  }

  return {
    solver,
    surfaceY,
    depth,
    texture,
    uniforms,
    bindMaterial,
    surfaceGeometry,
    setBather,
    advance(delta, { contacts = [] } = {}) {
      if (disposed) return false;
      const localContacts = contacts.map((contact) => ({ ...contact, x: contact.x - center[0], z: contact.z - center[1] }));
      const changed = solver.advance(delta, { contacts: localContacts });
      if (changed) upload();
      return changed;
    },
    disturb({ x = center[0], z = center[1], ...options } = {}) {
      if (disposed) return;
      solver.disturb({ ...options, x: x - center[0], z: z - center[1] });
      upload();
    },
    evidence() {
      return {
        ...solver.evidence(),
        center: [...center],
        surfaceY,
        radius,
        depth,
        bottomY,
        depthSource,
        uploads,
        textureBytes: data.byteLength,
        disposed,
      };
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      for (const [material, previous] of bindings) {
        material.onBeforeCompile = previous.compile;
        material.customProgramCacheKey = previous.cache;
        material.needsUpdate = true;
      }
      bindings.clear();
      texture.dispose();
    },
  };
}
