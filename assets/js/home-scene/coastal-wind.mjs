import * as THREE from "../three.module.min.js";
import { COAST_SHELTER, DEFAULT_WIND, coastWind, windPhases } from "./wind-field.mjs";
import {
  PLANT_BEND_LIMIT,
  createPlantUniforms,
  updatePlantUniforms,
  buildPlantAttributes,
  createPlantAttachmentIndex,
  patchPlantShader,
} from "./plant-motion.mjs";

// One field and one active clock for the room. Attachment inference happens
// once on actual authored stem vertices, in world meters before TRS conversion.
// Given the coast's wind (wind-field.mjs createCoastWind / coastWind), the plants take its breeze,
// gust fronts and indoor share each frame: the room's olives feel the air the glass front lets in
// (more with the doors open), and the terrace olive outside feels the sheltered breeze directly.
export function createCoastalWind({ coast: coastSource = coastWind } = {}) {
  const uniforms = {
      coastalWindMean: { value: new THREE.Vector3(...DEFAULT_WIND.mean) },
      coastalWindGust: { value: DEFAULT_WIND.gust },
      coastalWindPhase: { value: windPhases(0) },
    },
    plants = createPlantUniforms(),
    entries = [],
    scratch = new THREE.Vector3();
  let seconds = 0;

  function positionsInWorld(mesh) {
    const position = mesh.geometry.getAttribute("position"),
      data = new Float32Array(position.count * 3);
    for (let i = 0; i < position.count; i++) {
      scratch
        .fromBufferAttribute(position, i)
        .applyMatrix4(mesh.matrixWorld)
        .toArray(data, i * 3);
    }
    return data;
  }

  function patch(material) {
    const compile = material.onBeforeCompile,
      cache = material.customProgramCacheKey();
    material.onBeforeCompile = function (shader, renderer) {
      compile.call(this, shader, renderer);
      patchPlantShader(shader, uniforms, plants, coastSource.uniforms);
    };
    material.customProgramCacheKey = () => `${cache}:coastal-rooted-wind-v1`;
    material.needsUpdate = true;
  }

  function bind(root) {
    root.updateWorldMatrix(true, true);
    const leaves = [],
      wood = [];
    root.traverse((mesh) => {
      if (!mesh.isMesh || mesh.isSkinnedMesh || mesh.userData.outline) return;
      const materials = [mesh.material].flat();
      // Stems: the room plants' honey ash and the terrace olive's bark twigs.
      if (materials.some((m) => /honey ash|olive bark/i.test(m.name))) wood.push(positionsInWorld(mesh));
      if (materials.some((m) => /olive leaf/i.test(m.name))) leaves.push(mesh);
    });
    if (!leaves.length) return;
    const supports = new Float32Array(wood.reduce((sum, array) => sum + array.length, 0));
    let offset = 0;
    for (const array of wood) {
      supports.set(array, offset);
      offset += array.length;
    }
    const attachmentIndex = createPlantAttachmentIndex(supports, 0.025);
    for (const mesh of leaves) {
      const started = performance.now(),
        geometry = mesh.geometry,
        attributes = buildPlantAttributes(positionsInWorld(mesh), geometry.index?.array, { attachmentIndex }),
        inverse = mesh.matrixWorld.clone().invert(),
        covector = new THREE.Matrix3().setFromMatrix4(mesh.matrixWorld).transpose();
      // x_local=M^-1 x_world, but the weight gradient is a covector M^T g.
      for (let i = 0; i < attributes.weight.length; i++) {
        scratch
          .fromArray(attributes.root, i * 3)
          .applyMatrix4(inverse)
          .toArray(attributes.root, i * 3);
        scratch
          .fromArray(attributes.gradient, i * 3)
          .applyMatrix3(covector)
          .toArray(attributes.gradient, i * 3);
      }
      geometry.setAttribute("coastalPlantRoot", new THREE.BufferAttribute(attributes.root, 3));
      geometry.setAttribute("coastalPlantWeight", new THREE.BufferAttribute(attributes.weight, 1));
      geometry.setAttribute("coastalPlantGradient", new THREE.BufferAttribute(attributes.gradient, 3));
      geometry.computeBoundingSphere();
      const scale = new THREE.Vector3().setFromMatrixScale(mesh.matrixWorld);
      geometry.boundingSphere.radius += 0.02 / Math.min(scale.x, scale.y, scale.z);
      for (const material of [mesh.material].flat()) patch(material);
      mesh.customDepthMaterial = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking });
      mesh.customDistanceMaterial = new THREE.MeshDistanceMaterial();
      patch(mesh.customDepthMaterial);
      patch(mesh.customDistanceMaterial);
      entries.push({
        mesh,
        evidence: { name: mesh.name, ...attributes.evidence, buildMilliseconds: performance.now() - started },
      });
    }
  }

  let coastState = null;
  return {
    bind,
    update(time, { reduced = false, coast = null } = {}) {
      seconds = time;
      windPhases(time, DEFAULT_WIND.rate, uniforms.coastalWindPhase.value);
      updatePlantUniforms(plants, time, { reduced });
      if (!coast) return;
      // The shader multiplies the outdoor breeze by each root's share and gust envelope.
      const { meanSpeed, direction, indoorLeak } = (coastState = coast.state);
      uniforms.coastalWindMean.value.set(meanSpeed * direction[0], 0, meanSpeed * direction[1]);
      uniforms.coastalWindGust.value = COAST_SHELTER.eddy * meanSpeed;
      const exposure = plants.coastalPlantExposure.value;
      exposure[0] = COAST_SHELTER.glassZ;
      exposure[1] = indoorLeak;
      exposure[2] = COAST_SHELTER.terrace;
      exposure[3] = 1;
    },
    evidence: () => ({
      method: coastState
        ? "coast breeze and gust fronts, indoor share through the glass front / six-mode curl eddies / critically damped rooted bends"
        : "six-mode curl-potential wind / critically damped rooted bends",
      seconds,
      enabled: Boolean(plants.coastalPlantEnabled.value),
      meanMetersPerSecond: uniforms.coastalWindMean.value.toArray(),
      gustBoundMetersPerSecond: uniforms.coastalWindGust.value,
      indoorShare: plants.coastalPlantExposure.value[1],
      terraceShare: plants.coastalPlantExposure.value[2],
      followsCoast: plants.coastalPlantExposure.value[3] > 0,
      complianceSeconds: plants.coastalPlantCompliance.value,
      beautyAndShadowMatched: true,
      contactNormalApproximation: coastState
        ? `static leaves in the contact pass; bends saturate softly toward ${PLANT_BEND_LIMIT * 1000} mm`
        : "static leaves; displacement bounded below 12 mm",
      plants: entries.map((entry) => entry.evidence),
    }),
    dispose() {
      for (const { mesh } of entries) {
        mesh.customDepthMaterial.dispose();
        mesh.customDistanceMaterial.dispose();
      }
      entries.length = 0;
    },
  };
}
