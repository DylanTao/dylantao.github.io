import * as THREE from "../three.module.min.js";
import { mergeGeometries } from "../vendor/three-r164/utils/BufferGeometryUtils.js";

function koiBody(colour, pattern) {
  const parts = [],
    pigment = new THREE.Color(colour),
    ivory = new THREE.Color(0xf3ede0),
    black = new THREE.Color(0x171d1a);
  const body = new THREE.SphereGeometry(1, 20, 10).scale(0.075, 0.055, 0.22).toNonIndexed();
  const p = body.getAttribute("position");
  for (let i = 0; i < p.count; i++) {
    const z = p.getZ(i),
      taper = z < -0.1 ? 0.35 + (0.65 * (z + 0.22)) / 0.12 : 1;
    p.setX(i, p.getX(i) * taper);
  }
  body.computeVertexNormals();
  const tint = (geometry, kind) => {
    geometry.deleteAttribute("uv");
    const points = geometry.getAttribute("position"),
      colours = new Float32Array(points.count * 3);
    for (let i = 0; i < points.count; i++) {
      const z = points.getZ(i),
        x = points.getX(i),
        patch = Math.sin(z * 27 + pattern * 1.7) + 0.7 * Math.cos(x * 90 + pattern);
      const colour = kind === "eye" ? black : pattern === 1 ? ivory : patch > 0.65 ? ivory : pigment;
      colours.set(colour.toArray(), i * 3);
    }
    geometry.setAttribute("color", new THREE.BufferAttribute(colours, 3));
    parts.push(geometry);
  };
  tint(body, "body");
  // Thin dorsal and paired pectoral/ventral fins; all share the body's one material and draw.
  const fin = new THREE.BufferGeometry();
  fin.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(
      [
        0, 0.04, -0.11, 0, 0.096, -0.075, 0, 0.055, 0.08, 0.045, -0.015, 0.08, 0.135, -0.026, -0.015, 0.052, -0.025, -0.03, -0.045, -0.015, 0.08,
        -0.052, -0.025, -0.03, -0.135, -0.026, -0.015, 0.025, -0.03, -0.09, 0.073, -0.065, -0.16, 0.02, -0.035, -0.17, -0.025, -0.03, -0.09, -0.02,
        -0.035, -0.17, -0.073, -0.065, -0.16,
      ],
      3
    )
  );
  fin.computeVertexNormals();
  tint(fin, "fin");
  for (const side of [-1, 1]) tint(new THREE.SphereGeometry(0.009, 8, 6).translate(side * 0.035, 0.022, 0.18).toNonIndexed(), "eye");
  const result = mergeGeometries(parts);
  parts.forEach((g) => g.dispose());
  return result;
}

// The carved garden is native Blender geometry. This adapter adds only prescribed koi swimming
// and centimetre-scale surface ripples, all evaluated from the home's shared active clock.
export function bindWaterGarden(root, clock) {
  const pond = root.getObjectByName("hinterland_garden_koi_water");
  const creek = root.getObjectByName("hinterland_garden_creek_water");
  if (!pond) return null;
  pond.updateWorldMatrix(true, false);
  const bounds = new THREE.Box3().setFromObject(pond),
    centre = bounds.getCenter(new THREE.Vector3());
  const radius = (bounds.max.x - bounds.min.x) * 0.5;
  const group = new THREE.Group();
  group.name = "Garden koi";
  // The glTF scene can carry its Blender-to-browser rotation. Parent runtime objects to the
  // identity world when available; inverse-transform their world positions otherwise.
  root.add(group);
  const pigments = [0xd96732, 0xf3ede0, 0xcd6332, 0xf0d8b4, 0x4d4a42],
    bodyGeometries = pigments.map(koiBody),
    tailGeometry = new THREE.ConeGeometry(0.08, 0.15, 3),
    materials = pigments.map((color) => new THREE.MeshStandardMaterial({ color, roughness: 0.48 })),
    bodyMaterial = new THREE.MeshStandardMaterial({ color: 0xffffff, vertexColors: true, roughness: 0.48, side: THREE.DoubleSide });
  const fish = materials.map((material, i) => {
    const node = new THREE.Group(),
      body = new THREE.Mesh(bodyGeometries[i], bodyMaterial),
      tail = new THREE.Mesh(tailGeometry, material);
    node.add(body);
    tail.rotation.x = Math.PI / 2;
    tail.position.z = -0.25;
    node.add(tail);
    group.add(node);
    node.name = `Garden koi ${i + 1}`;
    return { node, tail };
  });
  const world = new THREE.Vector3(),
    inverse = new THREE.Matrix4();
  let last = NaN;
  function pose() {
    const t = clock.value;
    if (last === t) return;
    last = t;
    root.updateWorldMatrix(true, false);
    inverse.copy(root.matrixWorld).invert();
    fish.forEach(({ node, tail }, i) => {
      const phase = t * (0.12 + i * 0.017) + i * 2.39996,
        r = radius * (0.33 + 0.075 * i),
        x = centre.x + r * Math.sin(phase),
        z = centre.z + r * 0.85 * Math.cos(phase),
        y = centre.y - 0.18 - 0.05 * Math.sin(phase * 0.7 + i);
      node.position.copy(world.set(x, y, z).applyMatrix4(inverse));
      // Compose world yaw, then remove the glTF root rotation.
      const orientation = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.atan2(Math.cos(phase), -0.85 * Math.sin(phase)));
      node.quaternion.copy(root.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(orientation));
      tail.rotation.z = 0.25 * Math.sin(t * 3.5 + i);
      node.rotation.x += 0.025 * Math.sin(t * 2 + i);
    });
  }
  for (const surface of [pond, creek].filter(Boolean)) {
    for (const material of [surface.material].flat()) {
      const previous = material.onBeforeCompile,
        key = material.customProgramCacheKey;
      material.transparent = true;
      material.opacity = 0.77;
      material.depthWrite = false;
      material.roughness = 0.13;
      material.metalness = 0;
      material.color.set(0x467b67);
      material.onBeforeCompile = function (shader, renderer) {
        previous.call(this, shader, renderer);
        shader.uniforms.gardenTime = clock;
        shader.vertexShader = shader.vertexShader
          .replace("#include <common>", "#include <common>\nvarying vec3 gardenWorld;")
          .replace("#include <project_vertex>", "gardenWorld=(modelMatrix*vec4(transformed,1.)).xyz;\n#include <project_vertex>");
        shader.fragmentShader = shader.fragmentShader
          .replace("#include <common>", "#include <common>\nuniform float gardenTime;varying vec3 gardenWorld;")
          .replace(
            "#include <normal_fragment_maps>",
            "#include <normal_fragment_maps>\nvec2 gp=gardenWorld.xz;vec2 gs=vec2(.018*cos(gp.x*8.+gp.y*3.-gardenTime*2.1),.021*cos(gp.y*7.-gp.x*2.-gardenTime*1.6));normal=normalize(mat3(viewMatrix)*vec3(-gs.x,1.,-gs.y));"
          );
      };
      material.customProgramCacheKey = function () {
        return key.call(this) + ":garden-water-v1";
      };
      material.needsUpdate = true;
    }
    const before = surface.onBeforeRender;
    surface.onBeforeRender = function (...args) {
      pose();
      before.call(this, ...args);
    };
  }
  pond.userData.waterGarden = {
    method: "carved recirculating creek and koi pond; prescribed swimming and surface normals",
    centre: centre.toArray(),
    radius,
    fish: fish.length,
    clock,
  };
  pose();
  return {
    pose,
    evidence: () => ({ ...pond.userData.waterGarden, seconds: clock.value, clock: undefined }),
    dispose() {
      bodyGeometries.forEach((g) => g.dispose());
      bodyMaterial.dispose();
      tailGeometry.dispose();
      materials.forEach((m) => m.dispose());
      group.removeFromParent();
    },
  };
}
