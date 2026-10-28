(() => {
  const { THREE, renderer, scene, camera, items } = window.roiReview;
  const vp = new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse),
    width = renderer.domElement.width,
    height = renderer.domElement.height;
  const rows = [];
  for (const item of items) {
    const o = item.object,
      m = item.material,
      g = item.geometry,
      n = g.attributes.normal,
      p = g.attributes.position,
      ix = g.index;
    const normalMatrix = new THREE.Matrix3().getNormalMatrix(new THREE.Matrix4().multiplyMatrices(camera.matrixWorldInverse, o.matrixWorld));
    let maximum = 0,
      worst = null,
      fallBack = null;
    const ns = [];
    for (let i = 0; i < n.count; i++) ns.push(new THREE.Vector3().fromBufferAttribute(n, i).applyMatrix3(normalMatrix).normalize());
    const constant = ns.every((v) => v.distanceTo(ns[0]) < 1e-7);
    if (!constant) {
      const modelClip = new THREE.Matrix4().multiplyMatrices(vp, o.matrixWorld),
        v = [];
      for (let i = 0; i < p.count; i++) {
        const a = new THREE.Vector4(p.getX(i), p.getY(i), p.getZ(i), 1).applyMatrix4(modelClip);
        v.push({ x: ((a.x / a.w) * 0.5 + 0.5) * width, y: ((a.y / a.w) * 0.5 + 0.5) * height, w: a.w, z: a.z / a.w });
      }
      for (let t = 0; t < (ix ? ix.count : p.count); t += 3) {
        const ids = [0, 1, 2].map((i) => (ix ? ix.getX(t + i) : t + i)),
          a = ids.map((i) => v[i]),
          q = ids.map((i) => ns[i].clone().multiplyScalar(1 / v[i].w));
        if (a.some((p) => p.w <= 0 || p.z < -1)) {
          fallBack = "near-plane";
          break;
        }
        const dx1 = a[1].x - a[0].x,
          dy1 = a[1].y - a[0].y,
          dx2 = a[2].x - a[0].x,
          dy2 = a[2].y - a[0].y,
          D = dx1 * dy2 - dx2 * dy1;
        if (Math.abs(D) < 1e-10) continue;
        const q1 = q[1].clone().sub(q[0]),
          q2 = q[2].clone().sub(q[0]);
        const A = q1
            .clone()
            .multiplyScalar(dy2)
            .addScaledVector(q2, -dy1)
            .multiplyScalar(1 / D),
          B = q2
            .clone()
            .multiplyScalar(dx1)
            .addScaledVector(q1, -dx2)
            .multiplyScalar(1 / D);
        const ref = q[0].clone().add(q[1]).add(q[2]).normalize();
        const low = Math.min(...q.map((v) => v.dot(ref))) - 2 * (Math.abs(A.dot(ref)) + Math.abs(B.dot(ref)));
        let crossA = 0,
          crossB = 0;
        for (const v of q)
          for (const x of [-2, 2])
            for (const y of [-2, 2]) {
              const u = v.clone().addScaledVector(A, x).addScaledVector(B, y);
              crossA = Math.max(crossA, u.clone().cross(A).length());
              crossB = Math.max(crossB, u.clone().cross(B).length());
            }
        const bound = low > 0 ? Math.max(crossA, crossB) / (low * low) : Infinity;
        if (bound > maximum) {
          maximum = bound;
          worst = { triangle: t / 3, ids, projected: a, lowerNormalMagnitude: low, dxNorm: A.length(), dyNorm: B.length(), bound };
        }
      }
    }
    const maxGeometry = Math.min(1, maximum * 1.01 + 0.002),
      roughUpper = Math.min(1, Math.max(m.roughness, 0.0525) + maxGeometry),
      iorUpper = m.ior + (m.ior - 1) * 0.025 * (m.dispersion || 0),
      lod = Math.log2(width) * roughUpper * Math.min(1, Math.max(0, iorUpper * 2 - 2));
    rows.push({
      object: o.name,
      material: m.name,
      normalConstant: constant,
      geometryDerivativeUpper: Number.isFinite(maximum) ? maximum : "unbounded",
      roundingMargin: "1% plus0.002; numerical/near-plane fallback is full capture",
      effectiveRoughnessUpper: fallBack ? 1 : roughUpper,
      lodUpper: fallBack ? Math.log2(width) : lod,
      fallBack,
      worst,
    });
  }
  const result = {
    width,
    height,
    rows,
    method:
      "For each projected triangle, perspective-correct normalized normals equal normalize(sum barycentric*n_i/w_i). This numerator is affine in screen x/y. Bound |d(normalize Q)/dx| by max|Q cross A|/min|Q|^2 over the triangle expanded2pixels for helper lanes; likewise y. All triangles are included, including hidden/back-facing triangles. This is a conservative analytic envelope, not the sampled visible maximum.",
  };
  window.roiNormalBounds = result;
  return result;
})();
