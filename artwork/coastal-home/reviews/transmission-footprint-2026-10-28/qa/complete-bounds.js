(() => {
  const { THREE, renderer, camera, items } = window.roiReview;
  const { width, height, rows: normalBounds } = window.roiNormalBounds;
  const vp = new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
  const whole = [0, 0, width, height];
  const rect = (b) => {
    const points = [];
    for (const x of [b.min.x, b.max.x])
      for (const y of [b.min.y, b.max.y])
        for (const z of [b.min.z, b.max.z]) {
          const v = new THREE.Vector4(x, y, z, 1).applyMatrix4(vp);
          if (v.w <= 0 || v.z / v.w < -1) return null;
          points.push([((v.x / v.w) * 0.5 + 0.5) * width, ((v.y / v.w) * 0.5 + 0.5) * height]);
        }
    return [
      Math.min(...points.map((p) => p[0])),
      Math.min(...points.map((p) => p[1])),
      Math.max(...points.map((p) => p[0])),
      Math.max(...points.map((p) => p[1])),
    ];
  };
  const union = (rs) =>
    rs.reduce((a, b) => [Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.max(a[2], b[2]), Math.max(a[3], b[3])], [width, height, 0, 0]);
  const clamp = (r) => [
    Math.max(0, Math.floor(r[0])),
    Math.max(0, Math.floor(r[1])),
    Math.min(width, Math.ceil(r[2])),
    Math.min(height, Math.ceil(r[3])),
  ];
  const rows = [];
  for (const item of items) {
    const o = item.object,
      m = item.material,
      g = item.geometry,
      norm = normalBounds.find((r) => r.object === o.name);
    if (!g.boundingBox) g.computeBoundingBox();
    const b = g.boundingBox.clone().applyMatrix4(o.matrixWorld),
      base = rect(b);
    let displacement = {
      worldAxis: [0, 0, 0],
      range: [0, 0],
      source: "No vertex displacement in the inspected water-garden/infinity/standard hopper path.",
    };
    const uniforms = renderer.properties.get(m).uniforms;
    if (uniforms?.poolHeightfield) {
      const data = uniforms.poolHeightfield.value.image.data;
      const solid = uniforms.poolSolidElevation.value;
      let lo = solid,
        hi = solid,
        wet = 0;
      for (let i = 0; i < data.length; i += 4)
        if (data[i + 3] > 0) {
          wet++;
          lo = Math.min(lo, data[i]);
          hi = Math.max(hi, data[i]);
        }
      if (!Number.isFinite(lo + hi)) throw Error("Invalid displaced-water texture");
      const axis = uniforms.poolLocalUp.value.clone().applyMatrix3(new THREE.Matrix3().setFromMatrix4(o.matrixWorld));
      // Wet-renormalized bilinear interpolation is a convex combination of the
      // current wet heights, or uses the recorded solid elevation fallback.
      lo -= 1e-6;
      hi += 1e-6;
      for (const key of ["x", "y", "z"]) {
        b.min[key] += Math.min(axis[key] * lo, axis[key] * hi);
        b.max[key] += Math.max(axis[key] * lo, axis[key] * hi);
      }
      displacement = {
        worldAxis: axis.toArray(),
        range: [lo, hi],
        wetCells: wet,
        solidElevation: solid,
        textureSize: [uniforms.poolHeightfield.value.image.width, uniforms.poolHeightfield.value.image.height],
        source:
          "Actual current float texture, all wet texels plus solid-elevation fallback; positive normalized bilinear weights. One micrometre numerical margin. Recompute every capture; not an all-time amplitude claim.",
      };
    }
    const displaced = rect(b),
      e = o.matrixWorld.elements;
    const scale = new THREE.Vector3(Math.hypot(e[0], e[1], e[2]), Math.hypot(e[4], e[5], e[6]), Math.hypot(e[8], e[9], e[10]));
    const extension = scale.clone().multiplyScalar(m.thickness || 0);
    b.min.sub(extension);
    b.max.add(extension);
    const refracted = rect(b);
    let reason = null,
      mip = null,
      padding = null,
      footprint;
    if (!refracted) reason = "Near-plane crossing";
    else if (norm.geometryDerivativeUpper === "unbounded" || norm.fallBack)
      reason = "Curved hopper helper-lane normal envelope cannot certify finite subglobal support";
    else {
      mip = Math.ceil(norm.lodUpper);
      const mw = Math.max(1, Math.floor(width / 2 ** mip)),
        mh = Math.max(1, Math.floor(height / 2 ** mip));
      // Broad envelope for bicubic's four bilinear taps at each level, plus
      // the base pixels contributing to the generated parent mip and roundoff.
      padding = [(3 * width) / mw + 4, (3 * height) / mh + 4];
      footprint = clamp([refracted[0] - padding[0], refracted[1] - padding[1], refracted[2] + padding[0], refracted[3] + padding[1]]);
    }
    if (reason) footprint = whole;
    rows.push({
      object: o.name,
      material: m.name,
      thickness: m.thickness || 0,
      modelColumnLengths: scale.toArray(),
      baseRectangle: base,
      displacement,
      displacedRectangle: displaced,
      thicknessExtension: extension.toArray(),
      refractedRectangle: refracted,
      roughnessEnvelope: norm.effectiveRoughnessUpper,
      lodEnvelope: norm.lodUpper,
      upperMip: mip,
      bicubicAndMipPadding: padding,
      samplingRectangle: footprint,
      fallbackReason: reason,
    });
  }
  const before = clamp(union(rows.map((r) => r.refractedRectangle || whole))),
    water = clamp(union(rows.filter((r) => r.object !== "kitchen__coffee_hopper_glass").map((r) => r.samplingRectangle))),
    final = clamp(union(rows.map((r) => r.samplingRectangle)));
  const area = (r) => ((r[2] - r[0]) * (r[3] - r[1])) / (width * height);
  return {
    width,
    height,
    rows,
    preFilterRectangle: before,
    preFilterFraction: area(before),
    waterOnlyRectangle: water,
    waterOnlyFraction: area(water),
    finalRectangle: final,
    finalFraction: area(final),
    admission: "Rejected before a renderer prototype: no certified cropped support for the unchanged hopper shader.",
    method:
      "World AABB includes actual onsen GPU displacement. Expand every component by thickness times the corresponding model-column length: refracted ray is normalized before this scale. Project eight corners, fail closed at the near plane. Apply a broad bicubic/generated-mip envelope for finite analytic normal bounds; unknown support is the full frame. No scissor or beauty change is applied.",
  };
})();
