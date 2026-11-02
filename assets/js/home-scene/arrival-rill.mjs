import * as THREE from "../three.module.min.js";

// The native channel and ballistic spill sheets carry the water's actual shape.
// These sub-centimetre travelling normals keep its surveyed level and clear
// walking lane fixed. This is prescribed flow, not a free-surface fluid solver.
export function createArrivalRill(root, descriptor, time) {
  if (!descriptor) return null;
  const origin = descriptor.origin,
    direction = descriptor.direction,
    speed = descriptor.speed;
  if (
    !Array.isArray(origin) ||
    origin.length !== 2 ||
    !origin.every(Number.isFinite) ||
    !Array.isArray(direction) ||
    direction.length !== 2 ||
    !direction.every(Number.isFinite) ||
    Math.abs(Math.hypot(...direction) - 1) > 1e-6 ||
    !Number.isFinite(speed) ||
    speed <= 0 ||
    !time
  )
    throw new TypeError("Arrival flow requires its surveyed basis and positive speed");
  const uniforms = {
      rillTime: time,
      rillOrigin: { value: new THREE.Vector2(...origin) },
      rillAxis: { value: new THREE.Vector2(...direction) },
      rillSpeed: { value: speed },
    },
    bound = [];
  root.traverse((mesh) => {
    if (!mesh.isMesh) return;
    for (const material of [mesh.material].flat()) {
      if (!/^arrival (flowing spring water|spring rill spill)$/.test(material?.name)) continue;
      if (!material.isMeshPhysicalMaterial) throw new TypeError("Arrival water must retain its native physical material");
      const falling = material.name === "arrival spring rill spill";
      mesh.castShadow = false;
      mesh.userData.fixedMaterial = mesh.userData.noContactOcclusion = mesh.userData.noVolumeDepth = true;
      mesh.userData.walk = "through";
      material.map = material.bumpMap = material.normalMap = material.roughnessMap = null;
      material.ior = 1.333;
      material.metalness = 0;
      material.color.setRGB(0.58, 0.78, 0.74);
      material.transmission = 0.88;
      material.thickness = falling ? 0.001 : 0.01;
      material.attenuationColor = new THREE.Color(0.55, 0.82, 0.76);
      material.attenuationDistance = 2;
      material.roughness = 0.075;
      material.side = THREE.DoubleSide;
      material.forceSinglePass = true;
      const before = material.onBeforeCompile,
        key = material.customProgramCacheKey();
      material.onBeforeCompile = (shader, renderer) => {
        before?.call(material, shader, renderer);
        Object.assign(shader.uniforms, uniforms);
        shader.vertexShader = "varying vec3 vRillWorld;\n" + shader.vertexShader;
        shader.vertexShader = shader.vertexShader.replace(
          "#include <begin_vertex>",
          "#include <begin_vertex>\nvRillWorld = (modelMatrix * vec4(position, 1.)).xyz;"
        );
        shader.fragmentShader =
          "varying vec3 vRillWorld;\nuniform float rillTime, rillSpeed;\nuniform vec2 rillOrigin, rillAxis;\n" + shader.fragmentShader;
        shader.fragmentShader = shader.fragmentShader.replace(
          "#include <normal_fragment_maps>",
          `#include <normal_fragment_maps>
          vec2 rillAcross = vec2(rillAxis.y, -rillAxis.x);
          float rillS = dot(vRillWorld.xz-rillOrigin, rillAxis);
          float rillT = dot(vRillWorld.xz-rillOrigin, rillAcross);
          vec3 rillUpView = normalize(mat3(viewMatrix)*vec3(0.,1.,0.));
          float rillFall = 1.-smoothstep(.42,.78,abs(dot(normal,rillUpView)));
          float rillAlong = mix(rillS, vRillWorld.y, rillFall);
          float rillPhase = rillAlong+rillTime*rillSpeed;
          float rillSlope = .063*cos(rillPhase*89.76+rillT*7.1)
                           +.028*cos(rillPhase*202.68-rillT*18.3);
          float rillCrossSlope = .023*cos(rillT*67.4+rillPhase*21.7);
          vec3 rillAlongView = normalize(mat3(viewMatrix)*vec3(rillAxis.x,0.,rillAxis.y));
          vec3 rillAcrossView = normalize(mat3(viewMatrix)*vec3(rillAcross.x,0.,rillAcross.y));
          vec3 rillTangent = normalize(mix(rillAlongView,rillUpView,rillFall));
          normal = normalize(normal-rillTangent*rillSlope-rillAcrossView*rillCrossSlope);`
        );
      };
      material.customProgramCacheKey = () => key + "/arrival-rill-v1";
      material.needsUpdate = true;
      bound.push({ mesh: mesh.name, material: material.name, falling });
    }
  });
  if (bound.length !== 2) throw new Error("Arrival channel and spill surfaces must both be delivered");
  return {
    evidence: () => ({
      meshes: bound.map((row) => ({ ...row })),
      origin: [...origin],
      direction: [...direction],
      speed,
      time: time.value,
      ior: 1.333,
      sourceWaterlineUnchanged: true,
      model: "Native shallow channel and gravity spill sheets with travelling sub-centimetre normals",
    }),
    dispose: () => (bound.length = 0),
  };
}
