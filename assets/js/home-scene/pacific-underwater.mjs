import * as THREE from "../three.module.min.js";
import { DIVE } from "./pacific-diving.mjs";
import { SEA_LEVEL } from "./sea-optics.mjs";
import { bindOceanWind, oceanFieldGLSL } from "./ocean-spectrum.mjs";

// Original procedural geometry. Habitat notes and source credits are in docs/sea/underwater-runtime.md.
const TAU = 2 * Math.PI;
const mix = (a, b, t) => a + (b - a) * t;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const sand = new THREE.Color(0x938975);
const stone = new THREE.Color(0x535549);
const brown = new THREE.Color(0x47492a);
const olive = new THREE.Color(0x898548);
const green = new THREE.Color(0x485631);

function rng(seed) {
  return () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) | 0;
    return (seed >>> 0) / 4294967296;
  };
}

// Match the captured cell centres. Avoid half-metre steps in the swimming floor and mesh.
export function continuousDiveBed(sample, x, z) {
  const sx = Math.floor(x * 2 - 0.5) * 0.5 + 0.25,
    sz = Math.floor(z * 2 - 0.5) * 0.5 + 0.25,
    u = (x - sx) * 2,
    v = (z - sz) * 2;
  const a = sample(sx, sz);
  if (!a) return null;
  const b = sample(sx + 0.5, sz),
    c = sample(sx, sz + 0.5),
    d = sample(sx + 0.5, sz + 0.5);
  const at = (key) => mix(mix(a[key], b[key], u), mix(c[key], d[key], u), v);
  return { height: at("height"), rock: at("rock"), reach: at("reach") };
}

function meshData() {
  const position = [],
    color = [],
    motion = [],
    indices = [];
  return {
    position,
    indices,
    add(x, y, z, tint, motionHeight = 0, phase = 0) {
      const index = position.length / 3;
      position.push(x, y, z);
      color.push(tint.r, tint.g, tint.b);
      motion.push(motionHeight, phase);
      return index;
    },
    quad(a, b, c, d) {
      indices.push(a, c, b, b, c, d);
    },
    geometry() {
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute("position", new THREE.Float32BufferAttribute(position, 3));
      geometry.setAttribute("color", new THREE.Float32BufferAttribute(color, 3));
      geometry.setAttribute("diveMotion", new THREE.Float32BufferAttribute(motion, 2));
      geometry.setIndex(indices);
      geometry.computeVertexNormals();
      return geometry;
    },
  };
}

function makeBed(bedAt, excluded, compact, anchors) {
  const data = meshData();
  const size = compact ? 1 : 0.5;
  const minX = DIVE.bounds.minX - 10,
    maxX = DIVE.bounds.maxX + 10,
    minZ = DIVE.bounds.minZ - 11,
    maxZ = DIVE.bounds.maxZ;
  const rows = [],
    shade = new THREE.Color();
  for (let z = minZ; z <= maxZ; z += size) {
    const row = [];
    for (let x = minX; x <= maxX; x += size) {
      const bed = bedAt(x, z);
      if (!bed || bed.height > SEA_LEVEL + 0.08 || excluded(x, z)) {
        row.push(null);
        continue;
      }
      const irregular = 0.9 + Math.sin(x * 3.72 + z * 5.1) * 0.07 + Math.cos(x * 1.78 - z * 3.45) * 0.06;
      shade
        .copy(sand)
        .lerp(stone, clamp(bed.rock, 0, 1))
        .multiplyScalar(irregular);
      row.push(data.add(x, bed.height - 0.045, z, shade));
    }
    rows.push(row);
  }
  for (let j = 1; j < rows.length; j++)
    for (let i = 1; i < rows[j].length; i++) {
      const a = rows[j - 1][i - 1],
        b = rows[j - 1][i],
        c = rows[j][i - 1],
        d = rows[j][i];
      if ([a, b, c, d].every((v) => v !== null)) data.quad(a, b, c, d);
    }
  // Small hard pockets and surface stones carry the holdfasts. They sit on the
  // projected bed in the authored section of reef and share its material.
  const rocks = rng(98757);
  for (const { x, y, z } of anchors) {
    const start = data.position.length / 3;
    const sx = mix(0.24, 0.52, rocks()),
      sz = mix(0.14, 0.37, rocks());
    for (let j = 0; j <= 2; j++) {
      const ring = [1, 0.82, 0.22][j];
      for (let i = 0; i < 7; i++) {
        const a = (i * TAU) / 7,
          r = ring * mix(0.82, 1.18, rocks());
        data.add(x + Math.cos(a) * sx * r, y - 0.018 + j * 0.06 + rocks() * 0.014, z + Math.sin(a) * sz * r, stone);
        if (j) data.quad(start + (j - 1) * 7 + i, start + (j - 1) * 7 + ((i + 1) % 7), start + j * 7 + i, start + j * 7 + ((i + 1) % 7));
      }
    }
    const center = data.add(x, y + 0.112, z, stone);
    for (let i = 0; i < 7; i++) data.indices.push(center, start + 14 + ((i + 1) % 7), start + 14 + i);
  }
  return data.geometry();
}

// Four small stands at opposing ends of the cove. Seeded ribbons rise from the
// rendered seabed. Sparse nearshore plants favour real captured rock; the deeper
// holdfasts stand in the visitor coast's extrapolated reef habitat.
function holdfasts(bedAt, excluded, compact) {
  const random = rng(81418);
  const anchors = [];
  const patches = [
    [-12.5, -36.4, 4.5, 4.5],
    [-3.4, -41.9, 4.7, 3.7],
    [12.3, -41.6, 4.6, 3.7],
    [20, -37.3, 4.5, 3.6],
  ];
  for (const [cx, cz, rx, rz] of patches) {
    const candidates = [];
    for (let i = 0; i < 48; i++) {
      const a = random() * TAU,
        r = Math.sqrt(random()),
        x = cx + Math.cos(a) * r * rx,
        z = cz + Math.sin(a) * r * rz,
        bed = bedAt(x, z);
      const depth = bed ? SEA_LEVEL - bed.height : 0;
      if (depth < 1.5 || depth > 7.5 || excluded(x, z)) continue;
      candidates.push({
        x,
        z,
        y: bed.height - 0.055,
        depth,
        score: random() + 1.25 * bed.rock,
        sampledRock: bed.rock > 0.25,
      });
    }
    candidates.sort((a, b) => b.score - a.score);
    let added = 0;
    for (const a of candidates) {
      if (anchors.some((b) => Math.hypot(a.x - b.x, a.z - b.z) < 0.96)) continue;
      anchors.push(a);
      if (++added >= (compact ? 8 : 12)) break;
    }
  }
  return anchors;
}

function kelpGeometry(anchors, compact) {
  const data = meshData(),
    random = rng(3227),
    tint = new THREE.Color();
  for (const { x, y, z, depth } of anchors) {
    const height = Math.min(6.0, depth - mix(0.34, 0.58, random()));
    const phase = random() * TAU,
      heading = random() * TAU,
      lean = mix(0.12, 0.4, random()),
      across = [Math.cos(heading), Math.sin(heading)];
    const stalk = [];
    for (let i = 0; i <= 10; i++) {
      const q = i / 10,
        w = mix(0.028, 0.009, q),
        curve = Math.sin(q * 1.8) * lean,
        ax = x + across[0] * curve,
        az = z + across[1] * curve;
      const vertex = data.position.length / 3;
      for (let s = 0; s < 5; s++) {
        const a = (s * TAU) / 5;
        data.add(ax + Math.cos(a) * w, y + q * height, az + Math.sin(a) * w, brown, q * height, phase);
      }
      if (i) for (let s = 0; s < 5; s++) data.quad(stalk[i - 1] + s, stalk[i - 1] + ((s + 1) % 5), vertex + s, vertex + ((s + 1) % 5));
      stalk.push(vertex);
    }
    const blades = compact ? 13 : 21;
    for (let i = 0; i < blades; i++) {
      const q = 0.22 + 0.77 * (i / (blades - 1)) ** 0.7;
      const a = heading + i * 2.39996,
        length = mix(0.37, 1.0, random()) * (0.75 + q * 0.4),
        width = mix(0.044, 0.105, random()),
        dx = Math.cos(a),
        dz = Math.sin(a),
        curve = Math.sin(q * 1.8) * lean;
      const bx = x + across[0] * curve,
        bz = z + across[1] * curve,
        by = y + q * height;
      let previous = null;
      for (let s = 0; s <= 5; s++) {
        const t = s / 5,
          w = width * (0.05 + 0.95 * Math.sin(Math.PI * t) ** 0.7) * (1 + 0.22 * Math.sin(t * 12 + i)),
          terminal = Math.min(depth - 0.29, q * height + Math.sin(t * 2.9) * 0.27 - t * t * 0.21);
        const ring = [];
        for (const edge of [-1, 0, 1]) {
          tint
            .copy(green)
            .lerp(olive, 0.19 + q * 0.33 + (edge === 0 ? 0.31 : 0.02))
            .multiplyScalar(0.76 + 0.24 * Math.sin(phase + i * 1.16 + t * 7.4) ** 2);
          ring.push(
            data.add(
              bx + dx * t * length - dz * w * edge,
              by + terminal - q * height + Math.sin(t * 7 + i) * w * edge,
              bz + dz * t * length + dx * w * edge,
              tint,
              q * height + 0.1 * t,
              phase
            )
          );
        }
        if (previous) {
          data.quad(previous[0], previous[1], ring[0], ring[1]);
          data.quad(previous[1], previous[2], ring[1], ring[2]);
        }
        previous = ring;
      }
    }
  }
  return data.geometry();
}

function fishGeometry(garibaldi) {
  const data = meshData(),
    dark = new THREE.Color(garibaldi ? 0xa94115 : 0x4a6a65),
    light = new THREE.Color(garibaldi ? 0xf3963d : 0x9eada0),
    fin = new THREE.Color(garibaldi ? 0xb54f18 : 0x61786e),
    eye = new THREE.Color(0x222420),
    shade = new THREE.Color();
  const rings = [
    [-0.195, 0.014, 0.013],
    [-0.108, 0.072, 0.035],
    [-0.016, 0.09, 0.047],
    [0.082, 0.071, 0.045],
    [0.143, 0.039, 0.033],
    [0.167, 0.013, 0.019],
    [0.175, 0.006, 0.012],
  ];
  for (let i = 0; i < rings.length; i++) {
    const [x, height, width] = rings[i];
    for (let s = 0; s < 10; s++) {
      const a = (s * TAU) / 10,
        v = Math.sin(a);
      shade.copy(dark).lerp(light, (1 - v) * 0.34 + 0.26);
      data.add(x, v * height, Math.cos(a) * width, shade, Math.max(0, -x), 0);
      if (i) data.quad((i - 1) * 10 + s, (i - 1) * 10 + ((s + 1) % 10), i * 10 + s, i * 10 + ((s + 1) % 10));
    }
  }
  function triangle(points, tint) {
    const vertices = points.map(([x, y, z]) => data.add(x, y, z, tint, Math.max(0, -x), 0));
    data.indices.push(...vertices);
  }
  triangle(
    [
      [-0.17, 0.018, 0],
      [-0.283, 0.062, 0],
      [-0.17, -0.018, 0],
    ],
    fin
  );
  triangle(
    [
      [-0.17, -0.018, 0],
      [-0.283, -0.057, 0],
      [-0.246, 0.002, 0],
    ],
    fin
  );
  triangle(
    [
      [-0.118, 0.059, 0],
      [-0.041, 0.116, 0],
      [0.065, 0.073, 0],
    ],
    fin
  );
  triangle(
    [
      [-0.166, -0.018, 0],
      [-0.076, -0.105, 0],
      [0.021, -0.081, 0],
    ],
    fin
  );
  for (const side of [-1, 1]) {
    triangle(
      [
        [0.05, 0.01, side * 0.041],
        [-0.075, -0.044, side * 0.068],
        [-0.036, -0.014, side * 0.083],
      ],
      fin
    );
    const center = data.add(0.109, 0.022, 0.042 * side, eye);
    for (let i = 0; i < 8; i++) {
      const a = (i * TAU) / 8,
        b = ((i + 1) * TAU) / 8;
      data.indices.push(
        center,
        data.add(0.109 + Math.cos(a) * 0.008, 0.022 + Math.sin(a) * 0.009, 0.0405 * side, eye),
        data.add(0.109 + Math.cos(b) * 0.008, 0.022 + Math.sin(b) * 0.009, 0.0405 * side, eye)
      );
    }
  }
  return data.geometry();
}

function bedMaterial(time, sun) {
  const mat = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.96,
    metalness: 0,
    envMapIntensity: 0.24,
  });
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.diveTime = time;
    shader.uniforms.diveSun = sun;
    shader.vertexShader = "varying vec3 diveBedWorld;\n" + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace("#include <begin_vertex>", "#include <begin_vertex>\ndiveBedWorld=position;");
    shader.fragmentShader = "uniform float diveTime,diveSun; varying vec3 diveBedWorld;\n" + shader.fragmentShader;
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <opaque_fragment>",
      `
      vec2 r=diveBedWorld.xz;
      float u=sin(r.x*5.1+r.y*2.25+.48*sin(r.y*3.+diveTime*1.08)+diveTime*.77);
      float v=sin(r.y*5.7-r.x*1.91+.39*cos(r.x*4.2-diveTime*.85)-diveTime*.9);
      float net=exp(-6.1*abs(u+v*.8))*(.74+.26*cos(r.x*2.-r.y*4.6));
      vec2 grainCell=floor(r*62.);
      float sandGrain=fract(sin(dot(grainCell,vec2(54.51,70.23)))*43758.5453);
      float fine=(1.-smoothstep(.013,.033,length(fwidth(r))))*(sandGrain-.5);
      float depth=max(0.,-7.35-diveBedWorld.y);
      float shadow=.62+.38*smoothstep(-.18,.65,sin(r.x*.47+r.y*.68)*cos(r.y*.24-r.x*.78));
      float gain=diveSun*exp(-depth*.24)*shadow;
      outgoingLight=outgoingLight*(vec3(.36,.63,.58)*(shadow+.15))+diffuseColor.rgb*vec3(.052,.108,.092);
      outgoingLight*=1.+fine*.22;
      outgoingLight+=vec3(.24,.48,.35)*net*gain*.18;
      #include <opaque_fragment>
      `
    );
  };
  mat.customProgramCacheKey = () => "pacific-dive-bed";
  return mat;
}

function growthMaterial(time, sun, fish = false) {
  const mat = new THREE.MeshBasicMaterial({
    vertexColors: true,
    side: THREE.DoubleSide,
  });
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.diveTime = time;
    shader.uniforms.diveSun = sun;
    shader.vertexShader = "uniform float diveTime; attribute vec2 diveMotion; varying float diveLight;\n" + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace(
      "#include <begin_vertex>",
      `
      #include <begin_vertex>
      float h=diveMotion.x, p=diveMotion.y;
      ${fish ? "transformed.z+=sin(diveTime*7.0+h*11.0)*h*.34;" : "transformed.x+=sin(diveTime*.95+p+h*.65)*h*.064; transformed.z+=cos(diveTime*.63+p+h*.8)*h*.059;"}
      vec4 world=vec4(transformed,1.);
      #ifdef USE_INSTANCING
        world=instanceMatrix*world;
      #endif
      diveLight=exp(-max(0.,-7.35-(modelMatrix*world).y)*.29);
      `
    );
    shader.fragmentShader = "uniform float diveSun; varying float diveLight;\n" + shader.fragmentShader;
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <color_fragment>",
      `#include <color_fragment>
      diffuseColor.rgb*=mix(vec3(.29,.45,.40),vec3(.93,.99,.84),diveLight*(.27+.73*diveSun));`
    );
  };
  mat.customProgramCacheKey = () => (fish ? "pacific-dive-fish" : "pacific-dive-kelp");
  return mat;
}

function makeShafts(anchors, light, time, compact) {
  const data = meshData(),
    random = rng(119),
    tint = new THREE.Color(1, 1, 1);
  const stride = compact ? 5 : 4;
  for (let i = 1; i < anchors.length; i += stride) {
    const a = anchors[i],
      x = a.x + mix(-0.9, 0.9, random()),
      z = a.z + mix(-0.7, 0.7, random()),
      height = Math.min(a.depth - 0.25, 5.4);
    const start = data.position.length / 3;
    for (let j = 0; j < 7; j++) {
      const phi = (TAU * j) / 6;
      data.add(x + Math.cos(phi) * 0.21, SEA_LEVEL - 0.24, z + Math.sin(phi) * 0.21, tint, 0, i);
      data.add(x + Math.cos(phi) * 0.77, SEA_LEVEL - 0.24 - height, z + Math.sin(phi) * 0.77, tint, height, i);
      if (j) data.quad(start + j * 2 - 2, start + j * 2, start + j * 2 - 1, start + j * 2 + 1);
    }
  }
  const material = new THREE.ShaderMaterial({
    side: THREE.DoubleSide,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: {
      diveDirection: light.direction,
      diveSun: light.power,
      diveTime: time,
    },
    vertexShader: `
      attribute vec2 diveMotion; uniform vec3 diveDirection; uniform float diveTime;
      varying vec3 shaftNormal; varying vec3 shaftEye; varying vec2 shaft;
      void main(){
        shaft=diveMotion;
        vec3 p=position;
        p.xz-=diveDirection.xz*shaft.x*.45;
        p.x+=sin(diveTime*.72+shaft.y)*(.08+shaft.x*.04);
        shaftEye=cameraPosition-p;
        shaftNormal=normalize(normal);
        gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);
      }
    `,
    fragmentShader: `
      varying vec3 shaftNormal; varying vec3 shaftEye; varying vec2 shaft;
      uniform float diveSun; uniform float diveTime;
      void main(){
        float d=length(shaftEye);
        float veil=smoothstep(.05,.83,abs(dot(normalize(shaftEye),shaftNormal)));
        float fade=smoothstep(.1,.62,shaft.x)*exp(-shaft.x*.55-d*.22)*smoothstep(.25,1.1,d);
        float shimmering=.79+.21*sin(diveTime*1.7+shaft.y*2.1);
        gl_FragColor=vec4(.36,.64,.49,veil*fade*diveSun*shimmering*.135);
      }
    `,
  });
  return new THREE.Mesh(data.geometry(), material);
}

function makeDrift(time, compact) {
  const count = compact ? 64 : 136,
    random = rng(11992),
    positions = new Float32Array(count * 3),
    geometry = new THREE.BufferGeometry(),
    material = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      uniforms: { diveTime: time, diveSurface: { value: SEA_LEVEL } },
      vertexShader: `
        uniform float diveTime,diveSurface;
        varying float fleck;
        void main(){
          vec3 world=position+vec3(sin(diveTime*.17+position.z*.8),sin(diveTime*.12+position.x*.21)*.3,cos(diveTime*.13+position.x*.71))*.17;
          vec3 offset=mod(world-cameraPosition+6.,12.)-6.;
          vec3 p=cameraPosition+offset;
          vec4 view=viewMatrix*vec4(p,1.);
          float d=length(offset);
          fleck=(1.-smoothstep(3.2,5.6,d))*smoothstep(.45,1.05,d)*smoothstep(.06,.35,diveSurface-p.y);
          gl_Position=projectionMatrix*view;
          gl_PointSize=clamp(4./max(1.,-view.z),1.,3.);
        }
      `,
      fragmentShader: `
        varying float fleck;
        void main(){ gl_FragColor=vec4(.50,.57,.47,(1.-smoothstep(.05,.48,length(gl_PointCoord-.5)))*fleck*.30); }
      `,
    });
  for (let i = 0; i < count; i++) {
    positions[i * 3] = mix(-5.6, 5.6, random());
    positions[i * 3 + 1] = mix(-3.1, 2.9, random());
    positions[i * 3 + 2] = mix(-5.6, 5.6, random());
  }
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  return new THREE.Points(geometry, material);
}

export function createPacificUnderwater(root, { bedAt, excluded, compact = false }) {
  const habitat = new THREE.Group();
  habitat.name = "Pacific reef, below the surface";
  habitat.visible = false;
  habitat.userData.walk = "through";
  root.add(habitat);
  const time = { value: 0 };
  const light = {
    power: { value: 0 },
    direction: { value: new THREE.Vector3(0, 1, 0) },
  };
  const color = new THREE.Color(0x345f58),
    twilight = new THREE.Color(0x0a2028),
    midday = new THREE.Color(0x345f58);
  const transform = new THREE.Object3D(),
    orient = new THREE.Quaternion();
  let plants = [],
    fish = null,
    school = null,
    drift,
    dirty = true,
    depth = 0,
    floor = null,
    surface = null,
    lastClock = null,
    visibility = 0;
  function retire() {
    for (const object of [...habitat.children]) {
      object.geometry.dispose();
      object.material.dispose();
      habitat.remove(object);
    }
  }
  function add(object) {
    object.userData.walk = "through";
    object.userData.noContactOcclusion = true;
    object.castShadow = false;
    habitat.add(object);
    return object;
  }
  function breed() {
    retire();
    plants = holdfasts(bedAt, excluded, compact);
    const bed = add(new THREE.Mesh(makeBed(bedAt, excluded, compact, plants), bedMaterial(time, light.power)));
    bed.receiveShadow = true;
    if (plants.length) {
      add(new THREE.Mesh(kelpGeometry(plants, compact), growthMaterial(time, light.power)));
      add(makeShafts(plants, light, time, compact)).renderOrder = 2;
    }
    const random = rng(87633);
    function stock(orange, count) {
      const mesh = add(new THREE.InstancedMesh(fishGeometry(orange), growthMaterial(time, light.power, true), count));
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      mesh.frustumCulled = false;
      const pool = plants.filter(({ depth }) => depth > 2);
      const closeReef = [
        [-4.8, -41],
        [-1.7, -40.9],
        [14.8, -42.6],
        [13.8, -40.8],
      ];
      const tracks = Array.from({ length: count }, (_, i) => {
        const a = pool[Math.floor((i * pool.length) / count)];
        const [x, z] = (orange && closeReef[i]) || [a?.x ?? -4, a?.z ?? -40];
        return {
          x,
          z,
          phase: random() * TAU,
          radius: mix(0.45, 1.32, random()),
          depth: mix(0.82, 1.78, random()),
          size: orange ? mix(0.82, 1.18, random()) : mix(0.43, 0.59, random()),
        };
      });
      return { mesh, tracks, orange };
    }
    fish = stock(true, compact ? 6 : 10);
    school = stock(false, compact ? 12 : 21);
    drift = add(makeDrift(time, compact));
    drift.frustumCulled = false;
    dirty = false;
    lastClock = null;
  }
  function swim(stock, seconds) {
    const { mesh, tracks, orange } = stock;
    for (let i = 0; i < tracks.length; i++) {
      const a = tracks[i],
        t = seconds * (orange ? 0.38 : 0.5) + (orange ? a.phase : i * 0.115),
        x = (orange ? a.x : -4.1 + Math.sin(seconds * 0.19) * 1.9) + Math.cos(t) * a.radius,
        z = (orange ? a.z : -41.3 + Math.sin(seconds * 0.16) * 1.4) + Math.sin(t) * a.radius * 0.83;
      const bed = bedAt(x, z);
      const show = bed && !excluded(x, z) && bed.height < SEA_LEVEL - 1.02;
      const y = show ? Math.max(bed.height + 0.23, SEA_LEVEL - a.depth + Math.sin(t * 1.4 + a.phase) * 0.13) : SEA_LEVEL - 18;
      orient.setFromAxisAngle(THREE.Object3D.DEFAULT_UP, Math.atan2(-Math.cos(t) * 0.83, -Math.sin(t)));
      transform.position.set(x, y, z);
      transform.quaternion.copy(orient);
      transform.scale.setScalar(show ? a.size : 0.001);
      transform.updateMatrix();
      mesh.setMatrixAt(i, transform.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
  }
  return {
    color,
    refreshBed() {
      dirty = true;
    },
    view(column, { seconds, sunDirection, daylight = 0.8, season = 0.5 }) {
      const wet = Boolean(column?.submerged);
      habitat.visible = wet;
      depth = column?.depth ?? 0;
      floor = column?.floor ?? null;
      surface = column?.surface ?? null;
      if (!wet) return false;
      if (dirty) breed();
      if (sunDirection) light.direction.value.copy(sunDirection);
      light.power.value = clamp(daylight * (0.46 + light.direction.value.y * 0.72), 0.035, 1);
      time.value = seconds;
      if (seconds !== lastClock) {
        swim(fish, seconds);
        swim(school, seconds);
        lastClock = seconds;
      }
      drift.material.uniforms.diveSurface.value = surface;
      visibility = mix(7.5, 11.8, season) * mix(0.78, 1, daylight);
      color.copy(twilight).lerp(midday, (0.35 + 0.65 * daylight) * Math.exp(-Math.max(0, depth) * 0.135));
      return true;
    },
    visibility: () => visibility,
    evidence: () => ({
      submerged: habitat.visible,
      depth,
      floor,
      surface,
      visibility,
      compact,
      kelp: plants.length,
      sampledRock: plants.filter(({ sampledRock }) => sampledRock).length,
      garibaldi: fish?.tracks.length ?? 0,
      silverFish: school?.tracks.length ?? 0,
      draws: habitat.visible ? habitat.children.length : 0,
      seconds: lastClock,
    }),
    dispose() {
      retire();
      habitat.removeFromParent();
    },
  };
}

// The same displaced triangles face the swimmer from below. Keeping the
// underside in its own small program leaves the surface look and its warmup
// intact. Snell's window transmits a sky approximation through the water.
export function createDiveSurface({ time, surfaceUniforms, surfaceShader, seaLight, origin, tint }) {
  const material = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    uniforms: {
      pacificTime: time,
      diveTint: { value: tint },
      diveOpenSwell: { value: 1 },
      diveLight: seaLight.seaSunColor,
      diveSun: seaLight.seaSunDirection,
      ...surfaceUniforms,
    },
    vertexShader: `
      uniform float pacificTime, diveOpenSwell;
      varying vec3 divePoint;
      ${oceanFieldGLSL}
      ${surfaceShader}
      void main(){
        vec3 displacement, tx, tz; float variance;
        oceanField(position.xz,pacificTime,1.1,displacement,tx,tz,variance);
        displacement*=diveOpenSwell;
        ${surfaceShader ? "float wave; vec4 swash=coastalSurfAt((modelMatrix*vec4(position,1.)).xz,wave); displacement=mix(displacement,vec3(0.,swash.r,0.),wave);" : ""}
        divePoint=(modelMatrix*vec4(position+displacement,1.)).xyz;
        gl_Position=projectionMatrix*viewMatrix*vec4(divePoint,1.);
      }
    `,
    fragmentShader: `
      uniform float pacificTime;
      uniform vec3 diveTint,diveLight,diveSun;
      varying vec3 divePoint;
      ${surfaceShader}
      void main(){
        ${surfaceShader ? "if (coastalPool(divePoint.xz)) discard; float wave; vec4 swash=coastalSurfAt(divePoint.xz,wave); if(wave>.995 && swash.g<.008) discard;" : ""}
        vec3 ray=normalize(divePoint-cameraPosition);
        vec3 waveNormal=normalize(cross(dFdx(divePoint),dFdy(divePoint)));
        waveNormal*=waveNormal.y<0.?-1.:1.;
        vec2 s=divePoint.xz;
        waveNormal=normalize(waveNormal+vec3(.085*sin(s.x*5.1+s.y*6.8-pacificTime*1.4),0.,.068*cos(s.y*7.-s.x*3.+pacificTime*1.2)));
        float cosine=clamp(dot(ray,waveNormal),0.,1.);
        float window=smoothstep(.63,.73,cosine);
        vec3 airRay=refract(ray,-waveNormal,1.333);
        vec3 sky=mix(vec3(.39,.47,.44),vec3(.28,.43,.60),clamp(airRay.y,0.,1.));
        float lightEnergy=clamp(length(diveLight)*.22,.018,1.);
        float glimmer=exp(-abs(dot(ray,normalize(diveSun))-.97)*45.)*.28*lightEnergy;
        float mottling=.83+.17*sin(s.x*2.6+cos(s.y*3.2+pacificTime*.7))*sin(s.y*4.3+pacificTime*.9);
        vec3 overhead=mix(diveTint*(1.1+.56*mottling),sky*lightEnergy,window*.77)+glimmer*window;
        gl_FragColor=vec4(mix(overhead,diveTint,1.-exp(-length(divePoint-cameraPosition)*.094)),1.);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
  });
  bindOceanWind(material, origin);
  return material;
}
