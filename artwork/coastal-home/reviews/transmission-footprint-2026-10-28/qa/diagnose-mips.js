(async () => {
  const { THREE, renderer, scene, camera, items } = window.roiReview;
  const width = renderer.domElement.width,
    height = renderer.domElement.height;
  const maxMip = Math.floor(Math.log2(Math.max(width, height)));
  const originals = [],
    masks = new Map(),
    clones = new Map();
  const previousTarget = renderer.getRenderTarget(),
    background = scene.background;
  const color = renderer.getClearColor(new THREE.Color()).clone(),
    alpha = renderer.getClearAlpha();
  const shadowUpdate = renderer.shadowMap.autoUpdate,
    shadowNeeds = renderer.shadowMap.needsUpdate;
  const rt = new THREE.WebGLRenderTarget(width, height, {
    type: THREE.HalfFloatType,
    format: THREE.RGBAFormat,
    samples: 4,
    depthBuffer: true,
    generateMipmaps: false,
  });
  const observed = [];
  function clone(original) {
    if (clones.has(original)) return clones.get(original);
    const m = original.clone(),
      compile = original.onBeforeCompile,
      key = original.customProgramCacheKey();
    m.colorWrite = true;
    m.onBeforeCompile = function (shader, r) {
      compile.call(this, shader, r);
      const marker = "#include <opaque_fragment>";
      if (shader.fragmentShader.split(marker).length !== 2) throw Error("Diagnostic output marker changed: " + original.name);
      shader.fragmentShader = shader.fragmentShader.replace(
        marker,
        `
        float diagnosticLod=log2(${width.toFixed(1)})*material.roughness*clamp(material.ior*2.0-2.0,0.0,1.0);
        // Only the valid fractional interval mixing the last 1x1 mip is flagged.
        // Stay away from both integer endpoints and unsupported out-of-chain LODs.
        float globalMip=step(${(maxMip - 0.75).toFixed(2)},diagnosticLod)*(1.0-step(${(maxMip - 0.05).toFixed(2)},diagnosticLod));
        if(diffuseColor.a<=0.0||material.transmission<=0.0)discard;
        gl_FragColor=vec4(globalMip,material.roughness,diagnosticLod/16.0,1.0);
        return;
      `
      );
    };
    m.customProgramCacheKey = () => key + ":roi-mip-diagnostic-v1";
    clones.set(original, m);
    observed.push({
      name: original.name,
      roughness: original.roughness,
      ior: original.ior,
      transmission: original.transmission,
      thickness: original.thickness,
    });
    return m;
  }
  try {
    scene.traverse((o) => {
      if (!o.material) return;
      originals.push([o, o.material]);
      for (const m of [o.material].flat())
        if (!masks.has(m)) {
          masks.set(m, m.colorWrite);
          m.colorWrite = false;
        }
      if ([o.material].flat().some((m) => m.transmission > 0))
        o.material = Array.isArray(o.material) ? o.material.map((m) => (m.transmission > 0 ? clone(m) : m)) : clone(o.material);
    });
    scene.background = null;
    renderer.setClearColor(0, 0);
    renderer.shadowMap.autoUpdate = false;
    renderer.shadowMap.needsUpdate = false;
    renderer.setRenderTarget(rt);
    renderer.clear();
    const gl = renderer.getContext(),
      actualSamples = gl.getParameter(gl.SAMPLES);
    renderer.render(scene, camera);
    const pixels = new Uint16Array(width * height * 4);
    renderer.readRenderTargetPixels(rt, 0, 0, width, height, pixels);
    let flagged = 0,
      covered = 0,
      maxRoughness = 0,
      maxLod = 0;
    const witnesses = [];
    for (let i = 0; i < width * height; i++) {
      const flag = THREE.DataUtils.fromHalfFloat(pixels[i * 4]);
      if (pixels[i * 4 + 3]) {
        covered++;
        maxRoughness = Math.max(maxRoughness, THREE.DataUtils.fromHalfFloat(pixels[i * 4 + 1]));
        maxLod = Math.max(maxLod, THREE.DataUtils.fromHalfFloat(pixels[i * 4 + 2]) * 16);
      }
      if (flag > 0) {
        flagged++;
        if (witnesses.length < 32)
          witnesses.push({
            x: i % width,
            y: Math.floor(i / width),
            resolvedFlag: flag,
            roughness: THREE.DataUtils.fromHalfFloat(pixels[i * 4 + 1]),
            lod: THREE.DataUtils.fromHalfFloat(pixels[i * 4 + 2]) * 16,
          });
      }
    }
    return {
      width,
      height,
      requestedSamples: 4,
      actualSamples,
      maxMip,
      flagLodInterval: [maxMip - 0.75, maxMip - 0.05],
      flaggedPixels: flagged,
      coveredPixels: covered,
      maximumResolvedRoughness: maxRoughness,
      maximumResolvedLod: maxLod,
      witnesses,
      materials: observed,
      method:
        "A separate half-float 4xMSAA data render keeps actual geometry, vertex/normal and roughness shader paths and opaque depth occlusion. Non-transmissive objects write depth but no color. A positive red coverage proves a visible transmissive fragment mixes the valid final 1x1 global mip; it is not an optimization or a displayed candidate. Resolved roughness/LOD values are averages at MSAA edges, not strict maxima.",
      glError: gl.getError(),
    };
  } finally {
    for (const [o, m] of originals) o.material = m;
    for (const [m, value] of masks) m.colorWrite = value;
    scene.background = background;
    renderer.setClearColor(color, alpha);
    renderer.setRenderTarget(previousTarget);
    renderer.shadowMap.autoUpdate = shadowUpdate;
    renderer.shadowMap.needsUpdate = shadowNeeds;
    rt.dispose();
    for (const m of clones.values()) m.dispose();
    document.querySelector("[data-home-desk-scene]").labScene.requestFrame();
  }
})();
