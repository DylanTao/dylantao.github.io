// A two-stage sun shadow. Most shadow casters are architecture, terrain and furniture that never move,
// yet three redraws every one of them into the 2048 px shadow map each frame: 309 of the study's 541
// draws, about 530 outside (docs/performance-notes.md). Static casters are drawn once into a cached
// map; each frame the cache is copied into the light's map and only the casters that move are drawn
// over it (Myers, "Shadows of Cold War: A Scalable Approach to Shadowing", GDC 2021; the same split as
// Unity HDRP's cached shadows and Unreal Engine's virtual shadow map page cache).
//
// The light's map stays byte-for-byte what a full redraw makes: blitFramebuffer copies the cached
// packed depth and the depth buffer exactly, and the moving casters then depth-test against the same
// depth they would have met (only an exact tie between a static and a moving surface could resolve
// the other way). No new shader program is involved.
//
// Which casters move is observed, not declared, so later animation needs no registration: a caster
// whose world matrix, geometry, position or index buffer version, draw range or material changes is
// drawn every frame until it has held still for `stillFrames` rendered frames (twice as long each
// time it starts moving again after joining the cache, up to `maxStillFrames`). Skinned, morphing,
// instanced and batched meshes, lines, points and any caster with its own depth material (the
// wind-swayed planting) always are. A caster joining or leaving the cached set, the light or its
// shadow camera moving (the coast view's shadow square follows the camera; the sun follows the
// clock), or a new shadow map redraws the cache. Until a caster has held still, it is drawn every
// frame, so composed stills (paused, reduced motion) are drawn exactly as before.
export function createShadowCache(renderer, light, { stillFrames = 30, maxStillFrames = 1800, enabled = true } = {}) {
  const shadowMap = renderer.shadowMap,
    gl = renderer.getContext(),
    render = shadowMap.render;
  const records = new WeakMap();
  const signature = new Float64Array(16).fill(NaN);
  const noClear = () => {};
  let cache = null,
    cacheFor = null,
    valid = false,
    liveIsCache = false,
    frame = 0,
    active = enabled && typeof gl.blitFramebuffer === "function",
    checked = false;
  let staticCasters = [],
    dynamicCasters = [];
  const stats = { frames: 0, cachedFrames: 0, rebuilds: 0, copies: 0, skippedCopies: 0, bypassFrames: 0 };

  // The same material objects at the same versions (a material's version moves on needsUpdate).
  function sameMaterial(record, material) {
    if (!Array.isArray(material)) return record.material === material && record.materialVersion === material?.version;
    if (!Array.isArray(record.material) || record.material.length !== material.length) return false;
    for (let i = 0; i < material.length; i++)
      if (record.material[i] !== material[i] || record.materialVersion[i] !== material[i]?.version) return false;
    return true;
  }
  function keepMaterial(record, material) {
    record.material = Array.isArray(material) ? [...material] : material;
    record.materialVersion = Array.isArray(material) ? material.map((m) => m?.version) : material?.version;
  }

  // One pass over what the shadow pass would visit (it skips invisible subtrees), sorting the casters
  // into static and moving. Returns whether the static set changed.
  function classify(scene) {
    frame++;
    let changed = false;
    const nextStatic = [],
      nextDynamic = [];
    const visit = (object) => {
      if (object.visible === false) return;
      if ((object.isMesh || object.isLine || object.isPoints) && object.castShadow) {
        const geometry = object.geometry,
          position = geometry?.attributes?.position,
          elements = object.matrixWorld.elements;
        let record = records.get(object);
        if (!record) {
          record = { matrix: Float64Array.from(elements), still: 0, required: stillFrames, isStatic: false, seen: 0 };
          records.set(object, record);
        }
        let moved = false;
        const matrix = record.matrix;
        for (let i = 0; i < 16; i++)
          if (matrix[i] !== elements[i]) {
            moved = true;
            matrix.set(elements);
            break;
          }
        if (
          record.geometry !== geometry ||
          record.position !== (position?.version ?? -1) ||
          record.index !== (geometry?.index?.version ?? -1) ||
          record.start !== geometry?.drawRange.start ||
          record.count !== geometry?.drawRange.count ||
          !sameMaterial(record, object.material)
        ) {
          moved = moved || record.geometry !== undefined;
          record.geometry = geometry;
          record.position = position?.version ?? -1;
          record.index = geometry?.index?.version ?? -1;
          record.start = geometry?.drawRange.start;
          record.count = geometry?.drawRange.count;
          keepMaterial(record, object.material);
        }
        record.still = moved ? 0 : record.still + 1;
        const intrinsic =
          !object.isMesh ||
          object.isSkinnedMesh ||
          object.isInstancedMesh ||
          object.isBatchedMesh ||
          object.morphTargetInfluences?.length > 0 ||
          object.customDepthMaterial !== undefined ||
          object.customDistanceMaterial !== undefined;
        const isStatic = !intrinsic && record.still >= record.required;
        if (isStatic !== record.isStatic) {
          // A caster that moves again after joining the cache (an animal that pauses, a curtain that
          // settles and stirs) must then hold still twice as long, so it stops redrawing the cache.
          if (record.isStatic) record.required = Math.min(record.required * 2, maxStillFrames);
          record.isStatic = isStatic;
          changed = true;
        }
        record.seen = frame;
        (isStatic ? nextStatic : nextDynamic).push(object);
      }
      const children = object.children;
      for (let i = 0; i < children.length; i++) visit(children[i]);
    };
    visit(scene);
    // A cached caster that is no longer drawn (hidden, removed, castShadow off) changes the set too.
    if (!changed)
      for (const object of staticCasters)
        if (records.get(object)?.seen !== frame) {
          changed = true;
          break;
        }
    staticCasters = nextStatic;
    dynamicCasters = nextDynamic;
    return changed;
  }

  function lightMoved() {
    light.shadow.updateMatrices(light);
    const elements = light.shadow.matrix.elements;
    let moved = false;
    for (let i = 0; i < 16; i++)
      if (signature[i] !== elements[i]) {
        signature[i] = elements[i];
        moved = true;
      }
    return moved;
  }

  const setCasting = (objects, value) => {
    for (const object of objects) object.castShadow = value;
  };

  function copy(source, target) {
    const previous = renderer.getRenderTarget(),
      face = renderer.getActiveCubeFace(),
      level = renderer.getActiveMipmapLevel(),
      properties = renderer.properties,
      state = renderer.state;
    // Binding each target once creates its framebuffer; render targets carry no scissor test.
    renderer.setRenderTarget(target);
    renderer.setRenderTarget(source);
    state.bindFramebuffer(gl.READ_FRAMEBUFFER, properties.get(source).__webglFramebuffer);
    state.bindFramebuffer(gl.DRAW_FRAMEBUFFER, properties.get(target).__webglFramebuffer);
    gl.blitFramebuffer(0, 0, source.width, source.height, 0, 0, target.width, target.height, gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT, gl.NEAREST);
    state.bindFramebuffer(gl.READ_FRAMEBUFFER, null);
    renderer.setRenderTarget(previous, face, level);
    stats.copies++;
  }

  shadowMap.render = function (lights, scene, camera) {
    if (shadowMap.enabled === false || (shadowMap.autoUpdate === false && shadowMap.needsUpdate === false) || !lights.includes(light))
      return render.call(this, lights, scene, camera);
    stats.frames++;
    const map = light.shadow.map;
    // The lab's frozen shadow (autoUpdate off), the first frame (no map yet) and VSM keep three's path.
    if (!active || !map || light.shadow.autoUpdate === false || this.type === 3) {
      stats.bypassFrames++;
      valid = liveIsCache = false;
      return render.call(this, lights, scene, camera);
    }
    const needsUpdate = shadowMap.needsUpdate;
    // Any other shadow-casting light draws as before.
    if (lights.length > 1) {
      render.call(
        this,
        lights.filter((other) => other !== light),
        scene,
        camera
      );
      shadowMap.needsUpdate = needsUpdate;
    }
    const staticChanged = classify(scene),
      lightChanged = lightMoved();
    if (!staticCasters.length) {
      stats.bypassFrames++;
      valid = liveIsCache = false;
      return render.call(this, [light], scene, camera);
    }
    if (!cache || cacheFor !== map || cache.width !== map.width || cache.height !== map.height) {
      cache?.dispose();
      cache = map.clone();
      cache.texture.name = "Static sun shadow cache";
      cacheFor = map;
      valid = false;
    }
    if (!valid || staticChanged || lightChanged) {
      setCasting(dynamicCasters, false);
      light.shadow.map = cache;
      try {
        render.call(this, [light], scene, camera);
      } finally {
        light.shadow.map = map;
        setCasting(dynamicCasters, true);
        shadowMap.needsUpdate = needsUpdate;
      }
      valid = true;
      liveIsCache = false;
      stats.rebuilds++;
    }
    if (!liveIsCache) copy(cache, map);
    else stats.skippedCopies++;
    if (!checked) {
      // One synchronous check on first use: a driver that rejects the depth blit keeps three's path.
      checked = true;
      if (gl.getError() !== gl.NO_ERROR) {
        active = valid = liveIsCache = false;
        return render.call(this, [light], scene, camera);
      }
    }
    if (dynamicCasters.length) {
      setCasting(staticCasters, false);
      const clear = renderer.clear;
      renderer.clear = noClear;
      try {
        render.call(this, [light], scene, camera);
      } finally {
        renderer.clear = clear;
        setCasting(staticCasters, true);
      }
      liveIsCache = false;
    } else {
      // Nothing moves: the light's map is the cache until something does.
      liveIsCache = true;
      shadowMap.needsUpdate = false;
    }
    stats.cachedFrames++;
    if (verifyRequest) {
      const resolve = verifyRequest;
      verifyRequest = null;
      resolve(compareWithFullRedraw(this, scene, camera));
    }
  };

  // Lab check, inside a frame (three's render state exists only there): redraw the whole shadow map
  // the old way into a scratch target and count the texels that differ from the composed map.
  let verifyRequest = null;
  function compareWithFullRedraw(pass, scene, camera) {
    const map = light.shadow.map,
      scratch = map.clone(),
      live = new Uint8Array(map.width * map.height * 4),
      full = new Uint8Array(live.length);
    renderer.readRenderTargetPixels(map, 0, 0, map.width, map.height, live);
    const needsUpdate = shadowMap.needsUpdate;
    light.shadow.map = scratch;
    try {
      render.call(pass, [light], scene, camera);
    } finally {
      light.shadow.map = map;
      shadowMap.needsUpdate = needsUpdate;
    }
    renderer.readRenderTargetPixels(scratch, 0, 0, map.width, map.height, full);
    scratch.dispose();
    let texels = 0;
    for (let i = 0; i < live.length; i += 4)
      if (live[i] !== full[i] || live[i + 1] !== full[i + 1] || live[i + 2] !== full[i + 2] || live[i + 3] !== full[i + 3]) texels++;
    return { texels, of: live.length / 4, staticCasters: staticCasters.length, dynamicCasters: dynamicCasters.length };
  }

  return {
    get enabled() {
      return active;
    },
    set enabled(value) {
      active = Boolean(value) && typeof gl.blitFramebuffer === "function";
      valid = liveIsCache = false;
    },
    evidence() {
      return { ...stats, enabled: active, staticCasters: staticCasters.length, dynamicCasters: dynamicCasters.length, stillFrames };
    },
    // Resolves after the next cached frame with the texels that differ from a full redraw of it.
    verify() {
      return new Promise((resolve) => (verifyRequest = resolve));
    },
    dispose() {
      if (shadowMap.render !== render) shadowMap.render = render;
      cache?.dispose();
      cache = null;
    },
  };
}
