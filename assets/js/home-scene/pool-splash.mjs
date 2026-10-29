import * as THREE from "../three.module.min.js";
import { sprayDrop, sprayPosition, crownSection } from "./pool-impact.mjs";

export function createPoolSplash(parent, bounds, { heightAt = () => 0 } = {}) {
  let crownCompiled = false;
  const capacity = 256,
    crownRows = 6,
    geometry = new THREE.SphereGeometry(1, 8, 6),
    material = new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      roughness: 0.05,
      metalness: 0,
      clearcoat: 0.8,
      transparent: true,
      opacity: 0.6,
      depthWrite: false,
    }),
    drops = new THREE.InstancedMesh(geometry, material, capacity),
    group = new THREE.Group(),
    matrix = new THREE.Matrix4(),
    direction = new THREE.Vector3(),
    up = new THREE.Vector3(0, 1, 0),
    rotation = new THREE.Quaternion(),
    scale = new THREE.Vector3(),
    dropColor = new THREE.Color(0xcce8ed),
    foamColor = new THREE.Color(0xe4f3ed),
    particles = [],
    crownGeometry = new THREE.BufferGeometry(),
    crownVertices = new Float32Array(65 * crownRows * 3),
    crownUV = new Float32Array(65 * crownRows * 2),
    crownAge = { value: 0 },
    crownMaterial = new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      roughness: 0.08,
      ior: 1.333,
      transmission: 0,
      thickness: 0.004,
      clearcoat: 0.4,
      transparent: true,
      opacity: 0.22,
      side: THREE.DoubleSide,
      depthWrite: false,
    }),
    crownMesh = new THREE.Mesh(crownGeometry, crownMaterial),
    indices = [];
  for (let i = 0; i < 64; i++)
    for (let row = 0; row < crownRows - 1; row++) {
      const a = i * crownRows + row,
        b = a + crownRows;
      indices.push(a, a + 1, b, a + 1, b + 1, b);
    }
  crownGeometry.setAttribute("position", new THREE.BufferAttribute(crownVertices, 3).setUsage(THREE.DynamicDrawUsage));
  for (let i = 0; i <= 64; i++) for (let row = 0; row < crownRows; row++) crownUV.set([i / 64, row / (crownRows - 1)], (i * crownRows + row) * 2);
  crownGeometry.setAttribute("uv", new THREE.BufferAttribute(crownUV, 2));
  crownGeometry.setIndex(indices);
  // Entrained sheets tear into ligaments as the rim stretches. This sparse, time-dependent
  // alpha model is illustrative; it leaves the physical material's coastal lighting intact.
  crownMaterial.onBeforeCompile = (shader) => {
    crownCompiled = true;
    shader.uniforms.splashAge = crownAge;
    shader.vertexShader = "varying vec2 vSplashUV;\n" + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace("#include <begin_vertex>", "#include <begin_vertex>\nvSplashUV = uv;");
    shader.fragmentShader =
      `varying vec2 vSplashUV;
      uniform float splashAge;
      float splashHash(vec2 p) { return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
      float splashNoise(vec2 p) {
        vec2 a=floor(p),f=fract(p);f=f*f*(3.-2.*f);
        return mix(mix(splashHash(a),splashHash(a+vec2(1.,0.)),f.x),
          mix(splashHash(a+vec2(0.,1.)),splashHash(a+1.),f.x),f.y);
      }\n` + shader.fragmentShader;
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <alphatest_fragment>",
      `
      float t=vSplashUV.y;
      float pores=splashNoise(vec2(vSplashUV.x*48.,t*12.-splashAge*2.));
      float sheet=mix(1.,smoothstep(.23,.48,pores-.27*t-.12*splashAge),smoothstep(.06,.4,t));
      diffuseColor.a *= sheet;
      if(diffuseColor.a<.012) discard;
      #include <alphatest_fragment>`
    );
  };
  crownMaterial.customProgramCacheKey = () => "visitor-torn-sheet-v1";
  // Later streamed room/planting models reapply the shared scene finish. These dynamic water
  // materials own their shaders, just like the native pool surface, and must retain them.
  drops.userData.fixedMaterial = crownMesh.userData.fixedMaterial = true;
  crownMesh.frustumCulled = false;
  crownMesh.visible = false;
  parent.updateWorldMatrix(true, false);
  group.matrix.copy(parent.matrixWorld).invert();
  group.matrixAutoUpdate = false;
  group.matrixWorldNeedsUpdate = true;
  group.name = "Visitor pool spray";
  group.userData.walk = "through";
  group.userData.noOcclusion = true;
  drops.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  drops.frustumCulled = false;
  drops.count = 0;
  group.add(drops);
  group.add(crownMesh);
  parent.add(group);
  let emitted = 0,
    seconds = 0,
    crown = null;
  function impact({ x, y, z, speed }) {
    const count = Math.min(144, Math.max(18, Math.round(speed * 9)));
    for (let i = 0; i < count; i++) {
      const drop = sprayDrop(speed, i, count),
        tx = drop.x + drop.vx * drop.lifetime,
        tz = drop.z + drop.vz * drop.lifetime;
      // Choose launch velocities that return inside the actual water footprint. This is a spray
      // proxy with ballistic gravity; it does not pretend to solve wall/sheet fluid collisions.
      const fit = Math.min(
        1,
        tx ? (tx > 0 ? bounds.max.x - x : x - bounds.min.x) / Math.abs(tx) : 1,
        tz ? (tz > 0 ? bounds.max.z - z : z - bounds.min.z) / Math.abs(tz) : 1
      );
      drop.vx *= Math.max(0, fit * 0.95);
      drop.vz *= Math.max(0, fit * 0.95);
      drop.x *= Math.max(0, fit * 0.95);
      drop.z *= Math.max(0, fit * 0.95);
      particles.push({ ...drop, originX: x, originY: y, originZ: z, born: seconds });
    }
    // Small, flat entrainment flecks share the spray's one instanced draw. They follow the
    // actual surface height, disperse briefly and shrink away; they are an appearance proxy.
    for (let i = 0; i < 64; i++) {
      const variation = ((i * 17 + 7) % 31) / 31;
      particles.push({
        foam: true,
        angle: i * 2.399963 + variation * 0.45,
        radius: 0.004 + variation * 0.012,
        startRadius: 0.05 + variation * 0.24,
        radial: 0.25 + variation * 0.25,
        lifetime: 1.1 + variation * 0.6,
        originX: x,
        originY: y,
        originZ: z,
        born: seconds,
      });
    }
    if (particles.length > capacity) particles.splice(0, particles.length - capacity);
    emitted += count;
    crown = { x, y, z, speed, born: seconds, life: crownSection(speed, 0, 0).lifetime };
    crown.reach = Math.max(...Array.from({ length: 64 }, (_, i) => crownSection(speed, (i * Math.PI) / 32, crown.life).rim));
    group.visible = true;
  }
  function advance(dt) {
    seconds += dt;
    let count = 0;
    for (let i = particles.length - 1; i >= 0; i--) {
      const drop = particles[i],
        age = seconds - drop.born;
      if (age >= drop.lifetime) {
        particles.splice(i, 1);
        continue;
      }
      if (drop.foam) {
        const radius = drop.startRadius + drop.radial * (1 - Math.exp(-age * 1.8)),
          x = Math.max(bounds.min.x + 0.01, Math.min(bounds.max.x - 0.01, drop.originX + radius * Math.cos(drop.angle))),
          z = Math.max(bounds.min.z + 0.01, Math.min(bounds.max.z - 0.01, drop.originZ + radius * Math.sin(drop.angle))),
          size = drop.radius * Math.sqrt(Math.sin((Math.PI * age) / drop.lifetime));
        matrix.makeScale(size, 0.0008, size);
        matrix.setPosition(x, drop.originY + heightAt(x, z) + 0.0025, z);
      } else {
        const [x, y, z] = sprayPosition(drop, age);
        direction.set(drop.vx, drop.vy - 9.80665 * age, drop.vz);
        const stretch = 1 + Math.min(4, direction.length() * 0.55),
          crossRadius = drop.radius / Math.sqrt(stretch);
        rotation.setFromUnitVectors(up, direction.normalize());
        matrix.makeRotationFromQuaternion(rotation);
        matrix.scale(scale.set(crossRadius, drop.radius * stretch, crossRadius));
        matrix.setPosition(drop.originX + x, drop.originY + y, drop.originZ + z);
      }
      drops.setColorAt(count, drop.foam ? foamColor : dropColor);
      drops.setMatrixAt(count++, matrix);
    }
    drops.count = count;
    drops.instanceMatrix.needsUpdate = true;
    if (drops.instanceColor) drops.instanceColor.needsUpdate = true;
    crownMesh.visible = Boolean(crown && seconds - crown.born < crown.life);
    if (crownMesh.visible) {
      const age = seconds - crown.born,
        fit = Math.max(
          0,
          Math.min(1, (Math.min(crown.x - bounds.min.x, bounds.max.x - crown.x, crown.z - bounds.min.z, bounds.max.z - crown.z) - 0.01) / crown.reach)
        );
      crownAge.value = age / crown.life;
      for (let i = 0; i <= 64; i++) {
        const angle = (i * Math.PI * 2) / 64,
          section = crownSection(crown.speed, angle, age),
          cos = Math.cos(angle),
          sin = Math.sin(angle);
        for (let row = 0; row < crownRows; row++) {
          const u = row / (crownRows - 1),
            radius = section.base + (section.rim - section.base) * u,
            x = crown.x + radius * cos * fit,
            z = crown.z + radius * sin * fit;
          crownVertices.set(
            [x, crown.y + heightAt(x, z) * (1 - u) + Math.max(0.003, section.height * Math.sin((u * Math.PI) / 2)), z],
            (i * crownRows + row) * 3
          );
        }
      }
      crownGeometry.attributes.position.needsUpdate = true;
      crownGeometry.computeVertexNormals();
    }
    group.visible = count > 0 || crownMesh.visible;
  }
  group.visible = false;
  return {
    impact,
    advance,
    get busy() {
      return particles.length > 0 || crownMesh.visible;
    },
    evidence: () => ({
      active: particles.length,
      emitted,
      capacity,
      crown: crownMesh.visible,
      materialsOwned: drops.material === material && crownMesh.material === crownMaterial,
      crownCompiled,
      gravity: 9.80665,
      method: "volume-preserving ballistic spray, patchy surface flecks and thin crown proxies; footprint-fitted launch velocities",
    }),
    dispose() {
      group.removeFromParent();
      geometry.dispose();
      material.dispose();
      crownGeometry.dispose();
      crownMaterial.dispose();
      drops.dispose();
    },
  };
}
