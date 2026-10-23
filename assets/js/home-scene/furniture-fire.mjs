import * as THREE from "../three.module.min.js";

// A small bounded combustion sculpture inside the suspended bowl. One draw, no particles or
// texture fetches. The active clock freezes on pause/offscreen; reduced motion composes a still.
export function createFurnitureFire(parent) {
  const positions = [],
    uv = [],
    phases = [];
  const count = 7,
    rings = 9,
    sides = 10;
  const vertex = (flame, ring, side) => {
    const t = ring / rings,
      a = (side / sides) * Math.PI * 2;
    const phase = flame * 2.399963;
    const center = flame ? 0.11 : 0;
    const height = 0.2 + 0.1 * (0.5 + 0.5 * Math.sin(phase * 3));
    const radius = (0.026 + 0.009 * Math.cos(phase)) * Math.pow(1 - t, 0.65);
    positions.push(Math.cos(phase) * center + Math.cos(a) * radius, 0.825 + t * height, Math.sin(phase) * center + Math.sin(a) * radius);
    uv.push(t, a);
    phases.push(phase);
  };
  for (let f = 0; f < count; f++)
    for (let r = 0; r < rings; r++)
      for (let s = 0; s < sides; s++)
        for (const [rr, ss] of [
          [r, s],
          [r + 1, s],
          [r, s + 1],
          [r, s + 1],
          [r + 1, s],
          [r + 1, s + 1],
        ])
          vertex(f, rr, ss);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  geometry.setAttribute("flamePhase", new THREE.Float32BufferAttribute(phases, 1));
  const material = new THREE.ShaderMaterial({
    uniforms: { time: { value: 0 } },
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    vertexShader: `attribute float flamePhase; uniform float time; varying vec2 vUv;
      void main(){ vUv=uv; vec3 p=position; float h=uv.x;
        p.x+=h*h*.025*sin(time*2.9+flamePhase+h*5.);
        p.z+=h*h*.018*cos(time*2.3+flamePhase+h*4.);
        p.y+=h*.023*sin(time*3.7+flamePhase);
        gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.); }`,
    fragmentShader: `varying vec2 vUv; void main(){ float h=vUv.x;
      vec3 c=mix(vec3(1.,.63,.13),vec3(1.,.12,.008),h);
      float alpha=(1.-smoothstep(.55,1.,h))*.30;
      gl_FragColor=vec4(c*1.8,alpha); }`,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = "living fireplace fire";
  Object.assign(mesh.userData, { dynamic: true, fixedMaterial: true, noOcclusion: true, noContactOcclusion: true, noVolumeDepth: true });
  mesh.renderOrder = 1;
  parent.add(mesh);
  let clock = 0;
  return {
    update(seconds, { reduced = false } = {}) {
      clock = reduced ? 0 : seconds;
      material.uniforms.time.value = clock;
    },
    evidence: () => ({ clock, triangles: positions.length / 9, still: clock === 0 }),
    dispose() {
      mesh.removeFromParent();
      geometry.dispose();
      material.dispose();
    },
  };
}
