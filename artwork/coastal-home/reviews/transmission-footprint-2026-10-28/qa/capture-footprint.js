(async () => {
  const THREE = await import("/al-folio/assets/js/three.module.min.js");
  const host = document.querySelector("[data-home-desk-scene]"),
    scene = host.labScene.scene;
  return await new Promise((resolve, reject) => {
    const old = scene.onAfterRender;
    scene.onAfterRender = function (renderer, world, camera) {
      old.call(this, renderer, world, camera);
      const target = renderer.getRenderTarget(),
        w = renderer.domElement.width,
        h = renderer.domElement.height;
      if (target?.width !== w || target?.height !== h) return;
      scene.onAfterRender = old;
      try {
        const list = renderer.renderLists.get(scene, 0).transmissive;
        const viewProjection = new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
        const result = [];
        for (const item of list) {
          const o = item.object,
            m = item.material,
            g = item.geometry;
          if (o.isSkinnedMesh) o.computeBoundingBox();
          else if (!g.boundingBox) g.computeBoundingBox();
          const local = o.isSkinnedMesh ? o.boundingBox : g.boundingBox;
          const box = local.clone().applyMatrix4(o.matrixWorld),
            expanded = box.clone();
          const e = o.matrixWorld.elements,
            scale = [Math.hypot(e[0], e[1], e[2]), Math.hypot(e[4], e[5], e[6]), Math.hypot(e[8], e[9], e[10])];
          const thickness = Math.abs(m.thickness || 0),
            rayRadius = scale.map((s) => s * thickness);
          const displacement = Math.abs(m.displacementScale || 0) + Math.abs(m.displacementBias || 0);
          if (m.displacementMap) rayRadius.forEach((v, i) => (rayRadius[i] += displacement * Math.hypot(e[i], e[4 + i], e[8 + i])));
          expanded.expandByVector(new THREE.Vector3(...rayRadius));
          const project = (b) => {
            const xs = [],
              ys = [],
              zs = [],
              ws = [];
            for (let x of [b.min.x, b.max.x])
              for (let y of [b.min.y, b.max.y])
                for (let z of [b.min.z, b.max.z]) {
                  const p = new THREE.Vector4(x, y, z, 1).applyMatrix4(viewProjection);
                  xs.push(((p.x / p.w) * 0.5 + 0.5) * w);
                  ys.push(((p.y / p.w) * 0.5 + 0.5) * h);
                  zs.push(p.z / p.w);
                  ws.push(p.w);
                }
            return {
              minimum: [Math.min(...xs), Math.min(...ys)],
              maximum: [Math.max(...xs), Math.max(...ys)],
              nearPlaneCrossing: Math.min(...ws) <= 0 || Math.min(...zs) < -1,
            };
          };
          const normal = g.attributes.normal;
          let normalConstant = !!normal;
          const n = normal ? [normal.getX(0), normal.getY(0), normal.getZ(0)] : null;
          if (normal)
            for (let i = 1; i < normal.count; i++)
              if (Math.abs(normal.getX(i) - n[0]) + Math.abs(normal.getY(i) - n[1]) + Math.abs(normal.getZ(i) - n[2]) > 1e-7) {
                normalConstant = false;
                break;
              }
          result.push({
            object: o.name,
            objectId: o.id,
            objectType: o.type,
            material: m.name,
            materialId: m.id,
            materialType: m.type,
            transmission: m.transmission,
            thickness: m.thickness,
            roughness: m.roughness,
            ior: m.ior,
            dispersion: m.dispersion,
            roughnessMap: !!m.roughnessMap,
            thicknessMap: !!m.thicknessMap,
            displacementMap: !!m.displacementMap,
            normalMap: !!m.normalMap,
            bumpMap: !!m.bumpMap,
            normalConstant,
            firstNormal: n,
            worldScale: scale,
            worldBounds: [box.min.toArray(), box.max.toArray()],
            refractionExitBounds: [expanded.min.toArray(), expanded.max.toArray()],
            thicknessDisplacementRadius: rayRadius,
            projectedGeometry: project(box),
            projectedExit: project(expanded),
            vertices: g.attributes.position.count,
            triangles: g.index ? g.index.count / 3 : g.attributes.position.count / 3,
            compileKey: m.customProgramCacheKey(),
            userData: m.userData,
            group: item.group,
            skinned: !!o.isSkinnedMesh,
            instanced: !!o.isInstancedMesh,
          });
        }
        window.roiReview = { THREE, renderer, scene, camera, items: list };
        const gl = renderer.getContext(),
          debug = gl.getExtension("WEBGL_debug_renderer_info");
        resolve({
          width: w,
          height: h,
          camera: host.getSceneEvidence().camera,
          projection: camera.projectionMatrix.toArray(),
          view: camera.matrixWorldInverse.toArray(),
          transmissiveObjects: result,
          state: host.getSceneEvidence(),
          backend: debug ? gl.getParameter(debug.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER),
          method:
            "Actual completed main render-list transmission entries. Geometry AABBs are expanded componentwise by the exact shader thickness/world-scale bound; projected without changing viewport. Effective roughness also has a geometric derivative term, so scalar material roughness is not claimed as an upper bound.",
        });
      } catch (e) {
        reject(e);
      }
    };
    host.labScene.requestFrame();
  });
})();
