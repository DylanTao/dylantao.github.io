import * as THREE from "../three.module.min.js";
import { coastManifest, acquireCoast } from "./assets.mjs?v=coastal-place-20260929";
import { createFinish } from "../home-scene/realism.mjs";

const THEMES = {
  morning: { sky: 0xf5dfce, ground: 0x8b9290, sun: 0xffdfb4, key: 2.4, fill: 1.05, exposure: 1.0, water: 0x568f9d, night: 0.12 },
  noon: { sky: 0xddebf1, ground: 0x8d9480, sun: 0xfff4d5, key: 2.6, fill: 1.15, exposure: 1.0, water: 0x337e90, night: 0 },
  afternoon: { sky: 0xe4eddf, ground: 0x959378, sun: 0xffd09a, key: 2.3, fill: 1.0, exposure: 1.0, water: 0x4c9291, night: 0.18 },
  evening: { sky: 0x829bb4, ground: 0x3b4854, sun: 0xb4caff, key: 0.85, fill: 0.55, exposure: 0.85, water: 0x234b68, night: 1 },
};
const clamp = (x, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, x));

function reflectionStudio(renderer) {
  // A tiny generated light studio supplies broad, soft reflections in the glass.
  const room = new THREE.Scene();
  room.background = new THREE.Color(0xbcccd1);
  for (const [x, y, z, w, h, color] of [
    [-5, 4, 1, 5, 8, 0xfff0d9],
    [4, 2, -3, 4, 5, 0xe3f1ff],
    [0, -3, 0, 12, 5, 0x6b736c],
  ]) {
    const plane = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide }));
    plane.position.set(x, y, z);
    plane.lookAt(0, 0, 0);
    room.add(plane);
  }
  const generator = new THREE.PMREMGenerator(renderer);
  const target = generator.fromScene(room, 0.12, 0.1, 30);
  generator.dispose();
  room.traverse((o) => {
    o.geometry?.dispose();
    o.material?.dispose();
  });
  return target;
}

function makeWater(clock, color, miniature = false, profile = []) {
  const material = new THREE.MeshStandardMaterial({ color, roughness: 0.32, metalness: 0.18, transparent: true, depthWrite: false });
  // Terrain and surf share the authored shoreline. A stretched sine wave no
  // longer fits the village's recessed Cove and projecting sandstone headland.
  const number = (value) => Number(value).toFixed(6);
  const shore = `float coastShore(float x) {
    if (x >= -19. && x <= 19.) return 2.1-.7*sin(x*.23)-.25*sin(x*.68);
    ${profile
      .slice(1)
      .map((point, i) => {
        const previous = profile[i];
        return `if (x <= ${number(point[0])}) return -mix(${number(previous[1])},${number(point[1])},smoothstep(${number(previous[0])},${number(point[0])},x));`;
      })
      .join("\n")}
    return 2.;
  }`;
  material.onBeforeCompile = (shader) => {
    shader.uniforms.coastTime = clock;
    shader.vertexShader = `uniform float coastTime; varying vec3 coastPosition;
      float wave(vec2 p) { return sin(p.y*3.8-p.x*.28-coastTime*.8)*.023 + sin(p.x*2.7+p.y*1.2-coastTime*.6)*.013; }
      ${shader.vertexShader}`
      .replace(
        "#include <beginnormal_vertex>",
        `vec3 objectNormal = normalize(vec3((wave(position.xz-vec2(.03,0.))-wave(position.xz+vec2(.03,0.)))/.06,1.,(wave(position.xz-vec2(0.,.03))-wave(position.xz+vec2(0.,.03)))/.06));`
      )
      .replace("#include <begin_vertex>", `vec3 transformed=position; transformed.y+=wave(position.xz); coastPosition=transformed;`);
    shader.fragmentShader = `uniform float coastTime; varying vec3 coastPosition;\n${shore}\n${shader.fragmentShader}`.replace(
      "#include <color_fragment>",
      `#include <color_fragment>
        float shore = ${miniature ? "3.5-.017*coastPosition.x*coastPosition.x-.42*sin(coastPosition.x*.58)" : "coastShore(coastPosition.x)"};
        float depth = coastPosition.z-shore;
        float edge = ${miniature ? "1." : "smoothstep(0.,.12,depth)"};
        float swell = sin(depth*5.5-coastTime*.62+sin(coastPosition.x*.6)*.45);
        float breakup = smoothstep(-.45,.7,sin(coastPosition.x*1.9+coastTime*.08)+sin(coastPosition.x*5.2+depth));
        float foam = smoothstep(.83,1.,swell)*breakup*(1.-smoothstep(.2,2.5,depth))*.66;
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(.66,.80,.75), (1.-smoothstep(0.,2.3,depth))*.38);
        diffuseColor.rgb = mix(diffuseColor.rgb,vec3(.88,.93,.85),foam);
        diffuseColor.a *= edge;
        if(diffuseColor.a<.008) discard;`
    );
  };
  const geometry = new THREE.PlaneGeometry(190, 48, 190, 64).rotateX(-Math.PI / 2).translate(0, 0.04, 14);
  return new THREE.Mesh(geometry, material);
}

export async function mountCoast(host, { posterFrameHeight } = {}) {
  const miniature = host.hasAttribute("data-miniature");
  const canvas = host.querySelector("canvas");
  const surface = host.querySelector(".footer-coast__scene");
  const reduced = matchMedia("(prefers-reduced-motion: reduce)");
  // Use the same viewport breakpoint as <picture> and CSS. A classic scrollbar
  // can make the canvas narrower than the viewport near this boundary.
  const narrowViewport = matchMedia("(max-width: 599px)");
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: "low-power" });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
  renderer.setClearColor(0, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.shadowMap.autoUpdate = false;
  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-22.5, 22.5, 7, -7, 0.1, 150);
  const env = reflectionStudio(renderer);
  scene.environment = env.texture;
  const hemi = new THREE.HemisphereLight(0xddebf1, 0x8d9480, 2);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xfff0d0, 3.0);
  sun.position.set(-10, 18, 12);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 1024);
  Object.assign(sun.shadow.camera, { left: miniature ? -25 : -58, right: miniature ? 25 : 58, top: 28, bottom: -28, near: 0.1, far: 100 });
  sun.shadow.normalBias = 0.025;
  sun.shadow.bias = -0.00015;
  sun.shadow.radius = 3;
  scene.add(sun);
  scene.add(sun.target);
  const fill = new THREE.DirectionalLight(0xd3e7ec, 0.65);
  fill.position.set(12, 6, -10);
  scene.add(fill);
  const clock = { value: 0 };
  const finish = createFinish(renderer, scene, camera, { transparentOutput: true });
  let model, manifest;
  try {
    manifest = await coastManifest();
    model = await acquireCoast(miniature ? manifest.miniature.model : manifest.model);
  } catch (error) {
    renderer.dispose();
    env.dispose();
    finish.dispose();
    throw error;
  }
  scene.add(model.scene);
  const water = makeWater(clock, 0x337e90, miniature, manifest.coastProfile);
  water.userData.noOcclusion = true;
  if (!miniature) scene.add(water);
  const crowns = [],
    surfers = [],
    windows = [];
  let officeMaterial;
  model.scene.traverse((o) => {
    if (o.name === "Pacific") o.visible = false;
    if (miniature && o.name === "PacificSurface") {
      o.material = water.material;
      o.userData.noOcclusion = true;
    }
    if (!o.isMesh && o.name.startsWith("Crown")) crowns.push(o);
    if (!o.isMesh && /^Surfer\d/.test(o.name)) surfers.push({ object: o, position: o.position.clone() });
    if (o.isMesh) {
      o.castShadow = !/Window|pane|glazing|Pacific/.test(o.name);
      o.receiveShadow = true;
      const materials = Array.isArray(o.material) ? o.material : [o.material];
      for (const m of materials) {
        m.envMapIntensity = /glaz|glass/i.test(m.name) ? 0.65 : 0.22;
        if (m.name === "Village lamplight" && !windows.includes(m)) windows.push(m);
        if (m.name === "Third floor studio light") officeMaterial = m;
      }
    }
  });
  // Shader-driven light in the exact marked pane; no giant glowing facade.
  const officePosition = new THREE.Vector3().fromArray(miniature ? manifest.miniature.office : manifest.office);
  const officeGlow = new THREE.PointLight(0xffbd70, 0.6, 2.1, 2);
  officeGlow.position.copy(officePosition).add(new THREE.Vector3(0, 0, 0.12));
  scene.add(officeGlow);
  let visible = false,
    stopped = reduced.matches,
    lightOn = false,
    running = false,
    disposed = false,
    lost = false;
  let raf = 0,
    previous = 0,
    elapsed = 0,
    reveal = 1,
    targetReveal = 1,
    theme = THEMES.noon;
  let revealOnScroll = false;
  let pointerX = 0,
    currentX = 0,
    cameraWidth = 45,
    frameCount = 0;
  const target = new THREE.Vector3(0, 1.3, 0);
  const cameraBase = new THREE.Vector3(11, 23, 36);
  let drag = null;
  let orbitY = 0,
    orbitX = 0;
  const buildings = [];
  const buildingNames = /^(DIB|Geisel|Salk|BrocktonVilla|LaValencia|Casita|CliffVilla|Lifeguard|Tennis|BeachVolleyball)/;
  model.scene.traverse((o) => {
    if (!o.isMesh && buildingNames.test(o.name)) {
      const bounds = new THREE.Box3().setFromObject(o);
      buildings.push({
        object: o,
        base: o.position.clone(),
        floor: bounds.min.y,
        center: bounds.getCenter(new THREE.Vector3()).x,
        scale: o.scale.clone(),
      });
    }
  });
  buildings.sort((a, b) => a.center - b.center);
  function revealBuildings(value) {
    if (host.dataset.reveal === value.toFixed(3)) return;
    buildings.forEach((b, i) => {
      const p = miniature || reduced.matches ? 1 : clamp((value - (i / Math.max(1, buildings.length)) * 0.68) / 0.32);
      const eased = p * p * (3 - 2 * p);
      b.object.scale.y = b.scale.y * Math.max(0.001, eased);
      b.object.position.y = b.base.y + (1 - eased) * b.floor;
      b.object.visible = p > 0.001;
    });
    renderer.shadowMap.needsUpdate = true;
    host.dataset.reveal = value.toFixed(3);
  }

  function lights() {
    if (officeMaterial) {
      officeMaterial.color.set(lightOn ? 0xd8a05c : 0x55777e);
      officeMaterial.emissive.set(lightOn ? 0xffb956 : 0);
      officeMaterial.emissiveIntensity = lightOn ? 0.65 + theme.night * 0.7 : 0;
    }
    officeGlow.intensity = lightOn ? 0.55 + theme.night * 0.55 : 0;
    windows.forEach((m) => {
      m.emissiveIntensity = 0.1 + theme.night * 1.1;
    });
  }

  function syncTheme() {
    theme = THEMES[document.documentElement.dataset.themeMode] || (document.documentElement.dataset.theme === "dark" ? THEMES.evening : THEMES.noon);
    hemi.color.set(theme.sky);
    hemi.groundColor.set(theme.ground);
    hemi.intensity = theme.fill;
    sun.color.set(theme.sun);
    sun.intensity = theme.key;
    fill.intensity = 0.65 - theme.night * 0.45;
    renderer.toneMappingExposure = theme.exposure;
    water.material.color.set(theme.water);
    const selected = document.documentElement.dataset.themeMode || (document.documentElement.dataset.theme === "dark" ? "evening" : "noon");
    const lateNight = Math.floor(Date.now() / 86400000) % 5 < 2;
    lightOn = selected === "noon" || selected === "afternoon" || (selected === "evening" && lateNight);
    const night = theme.night > 0.8;
    model.scene.getObjectByName("EveningBonfire")?.traverse((o) => {
      o.visible = night;
    });
    model.scene.getObjectByName("ParkedBoards")?.traverse((o) => {
      o.visible = night;
    });
    surfers.forEach(({ object }) => (object.visible = !night && selected !== "morning"));
    host.dataset.theme = selected;
    host.dataset.office = String(lightOn);
    lights();
    draw();
  }

  function resize() {
    const { width, height } = surface.getBoundingClientRect();
    const narrow = narrowViewport.matches;
    surface.tabIndex = miniature || narrow ? 0 : -1;
    surface.setAttribute("aria-keyshortcuts", miniature ? "ArrowLeft ArrowRight ArrowUp ArrowDown Home" : narrow ? "ArrowLeft ArrowRight Home" : "");
    // Phone composition visits the studio, courts and surf at a readable scale.
    // A fixed width collapsed the vertical frustum on ultrawide screens and
    // cut off crowns and roofs. Keep at least 14.5 world units of skyline room;
    // wider viewports discover more coastline instead of magnifying it.
    // Authoring can capture extra sky/water around the same wide camera. That
    // overscan keeps the still filled when a tablet's frame is proportionally taller.
    cameraWidth = miniature ? 29 : narrow ? 21 : Math.max(40.5, (width / Math.max(posterFrameHeight || height, 1)) * 14.5);
    // The left campus sits higher in this oblique view. Shift the wide frame
    // upward without shrinking the buildings or adding empty coast at its ends.
    target.set(narrow ? 5.1 : 0, narrow ? 2 : 4.5, 0);
    cameraBase.set(target.x + (narrow ? 5 : 0), target.y + 16, 38);
    if (miniature) {
      target.fromArray(manifest.miniature.target);
      cameraBase.fromArray(manifest.miniature.camera);
    }
    const half = cameraWidth / 2;
    camera.left = -half;
    camera.right = half;
    camera.top = (half * height) / width;
    camera.bottom = -camera.top;
    const shadowWidth = miniature ? 25 : Math.min(58, Math.max(25, cameraWidth * 0.55));
    sun.shadow.camera.left = -shadowWidth;
    sun.shadow.camera.right = shadowWidth;
    sun.shadow.camera.updateProjectionMatrix();
    sun.position.x = -10;
    sun.target.position.x = 0;
    sun.target.updateMatrixWorld();
    renderer.shadowMap.needsUpdate = true;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height, false);
    finish.resize(width, height);
    renderer.shadowMap.needsUpdate = true;
    draw();
  }

  function draw() {
    if (disposed || lost) return;
    camera.position.copy(cameraBase);
    camera.position.x += currentX * 0.6;
    if (miniature) {
      const offset = camera.position.clone().sub(target);
      const spherical = new THREE.Spherical().setFromVector3(offset);
      spherical.theta += orbitX;
      spherical.phi += orbitY;
      camera.position.copy(target).add(new THREE.Vector3().setFromSpherical(spherical));
    }
    camera.lookAt(target);
    finish.render(camera, false);
    host.dataset.frames = String(++frameCount);
  }

  function progress() {
    // The poster already shows the complete place. Do not dismantle it as the
    // model arrives, even when loading finishes with only part of the coast in
    // view. Enable the reversible scroll reveal after the first complete arrival.
    const r = surface.getBoundingClientRect();
    const amount = clamp((innerHeight - r.top) / (r.height * 0.95));
    if (amount === 1) revealOnScroll = true;
    targetReveal = miniature || !revealOnScroll ? 1 : amount;
  }

  function frame(now) {
    if (!running) return;
    raf = requestAnimationFrame(frame);
    // This ambient footer needs at most 30 fps, independent of display refresh.
    if (now - previous < 32) return;
    // These are analytic poses, not a physics integration. Capping active time
    // makes the reveal and its reversal lag behind scrolling on slower GPUs.
    // syncRunning resets previous after suspension so hidden time is excluded.
    const dt = Math.max((now - previous) / 1000, 0);
    previous = now;
    elapsed += dt;
    clock.value = elapsed;
    progress();
    reveal += (targetReveal - reveal) * (1 - Math.exp(-dt * 4));
    revealBuildings(reveal);
    currentX += (pointerX - currentX) * (1 - Math.exp(-dt * 2.1));
    crowns.forEach((o, i) => {
      o.rotation.z = Math.sin(elapsed * 0.65 + i) * 0.008;
    });
    surfers.forEach(({ object, position }, i) => {
      object.position.x = position.x + Math.sin(elapsed * 0.17 + i) * 0.48;
      object.position.y = position.y + Math.sin(elapsed * 0.8 + i) * 0.025;
      object.rotation.z = Math.sin(elapsed * 0.4 + i) * 0.04;
    });
    draw();
  }

  function syncRunning() {
    running = visible && !document.hidden && !stopped && !reduced.matches && !disposed && !lost;
    cancelAnimationFrame(raf);
    host.dataset.running = String(running);
    if (running) {
      previous = performance.now();
      raf = requestAnimationFrame(frame);
    } else {
      if (stopped || reduced.matches) {
        reveal = targetReveal = 1;
        canvas.style.transform = "none";
      }
      if (visible) draw();
    }
    if (reduced.matches) {
      revealBuildings(1);
      if (visible) draw();
    }
  }
  const pan = (delta) => {
    if (!narrowViewport.matches) return;
    const [left, right] = manifest.panoramaBounds;
    target.x = clamp(target.x + delta, left + cameraWidth / 2, right - cameraWidth / 2);
    const inland = clamp((Math.abs(target.x - 5.1) - 14) / 14);
    const rise = target.x < 5.1 ? 2.5 : 1;
    target.y = 2 + rise * inland * inland * (3 - 2 * inland);
    cameraBase.x = target.x + 5;
    cameraBase.y = target.y + 16;
    // Keep the shadow coverage around the visited neighborhood while retaining
    // the same sun direction and the default view's preview alignment.
    sun.position.x = -10 + target.x - 5.1;
    sun.target.position.x = target.x - 5.1;
    sun.target.updateMatrixWorld();
    renderer.shadowMap.needsUpdate = true;
    draw();
  };
  const onDown = (event) => {
    if (miniature || narrowViewport.matches) drag = { x: event.clientX, y: event.clientY, id: event.pointerId };
  };
  const onPointer = (event) => {
    if (drag && drag.id === event.pointerId) {
      const dx = event.clientX - drag.x;
      if (miniature) {
        orbitX = clamp(orbitX - dx * 0.006, -Math.PI / 6, Math.PI / 6);
        orbitY = clamp(orbitY - (event.clientY - drag.y) * 0.003, -Math.PI / 18, Math.PI / 18);
        drag.x = event.clientX;
        drag.y = event.clientY;
        draw();
        return;
      }
      if (Math.abs(dx) > Math.abs(event.clientY - drag.y) * 1.2) {
        pan((-dx / surface.clientWidth) * cameraWidth);
        drag.x = event.clientX;
        drag.y = event.clientY;
      }
      return;
    }
    if (reduced.matches || stopped || event.pointerType === "touch") return;
    const r = surface.getBoundingClientRect();
    pointerX = clamp((event.clientX - r.left) / r.width) * 2 - 1;
  };
  const onLeave = () => {
    pointerX = 0;
    drag = null;
  };
  const onKey = (event) => {
    if (miniature && ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home"].includes(event.key)) {
      event.preventDefault();
      if (event.key === "Home") orbitX = orbitY = 0;
      else if (event.key === "ArrowLeft" || event.key === "ArrowRight")
        orbitX = clamp(orbitX + (event.key === "ArrowLeft" ? -0.08 : 0.08), -Math.PI / 6, Math.PI / 6);
      else orbitY = clamp(orbitY + (event.key === "ArrowUp" ? -0.04 : 0.04), -Math.PI / 18, Math.PI / 18);
      draw();
      return;
    }
    if (narrowViewport.matches && ["ArrowLeft", "ArrowRight", "Home"].includes(event.key)) {
      event.preventDefault();
      pan(event.key === "Home" ? 5.1 - target.x : event.key === "ArrowLeft" ? -3.5 : 3.5);
    }
  };
  const onMotion = () => {
    stopped = reduced.matches;
    syncRunning();
  };
  const observer = new IntersectionObserver(
    ([entry]) => {
      visible = entry.isIntersecting;
      syncRunning();
    },
    { threshold: 0.02 }
  );
  const resizer = new ResizeObserver(resize);
  const themeObserver = new MutationObserver(syncTheme);
  observer.observe(surface);
  resizer.observe(surface);
  themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme-mode", "data-theme"] });
  surface.addEventListener("pointermove", onPointer);
  surface.addEventListener("pointerdown", onDown);
  surface.addEventListener("pointerup", onLeave);
  surface.addEventListener("pointercancel", onLeave);
  surface.addEventListener("pointerleave", onLeave);
  surface.addEventListener("keydown", onKey);
  reduced.addEventListener("change", onMotion);
  document.addEventListener("visibilitychange", syncRunning);
  const contextLost = (event) => {
    event.preventDefault();
    lost = true;
    syncRunning();
    host.dataset.state = "fallback";
  };
  canvas.addEventListener("webglcontextlost", contextLost);
  const contextRestored = () => {
    lost = false;
    renderer.shadowMap.needsUpdate = true;
    syncRunning();
    draw();
    host.dataset.state = "ready";
  };
  canvas.addEventListener("webglcontextrestored", contextRestored);
  window.addEventListener("pagehide", (event) => {
    if (event.persisted) {
      running = false;
      cancelAnimationFrame(raf);
      return;
    }
    disposed = true;
    cancelAnimationFrame(raf);
    observer.disconnect();
    resizer.disconnect();
    themeObserver.disconnect();
    document.removeEventListener("visibilitychange", syncRunning);
    reduced.removeEventListener("change", onMotion);
    scene.traverse((o) => {
      if (!o.userData.sharedCoastGeometry) o.geometry?.dispose();
      const materials = Array.isArray(o.material) ? o.material : [o.material];
      materials.forEach((m) => m?.dispose());
    });
    env.dispose();
    model.release();
    water.geometry.dispose();
    water.material.dispose();
    finish.dispose();
    renderer.dispose();
  });
  window.addEventListener("pageshow", () => {
    if (!disposed) syncRunning();
  });
  revealBuildings(1);
  resize();
  syncTheme();
  renderer.shadowMap.needsUpdate = true;
  draw();
  host.dataset.state = "ready";
  function landmarkFrame(name) {
    const object = model.scene.getObjectByName(name);
    if (!object) return null;
    const projected = new THREE.Box2();
    const point = new THREE.Vector3();
    const screenPoint = new THREE.Vector2();
    object.updateWorldMatrix(true, true);
    // Project real vertices: a world-aligned box around a rotated, stepped
    // library includes empty upper corners well above its actual roof.
    object.traverse((mesh) => {
      const positions = mesh.geometry?.attributes.position;
      if (!positions) return;
      for (let i = 0; i < positions.count; i++) {
        point.fromBufferAttribute(positions, i).applyMatrix4(mesh.matrixWorld).project(camera);
        projected.expandByPoint(screenPoint.set((point.x + 1) / 2, (1 - point.y) / 2));
      }
    });
    return { left: projected.min.x, top: projected.min.y, right: projected.max.x, bottom: projected.max.y };
  }
  host.getCoastEvidence = ({ projectLandmarks = false } = {}) => ({
    miniature,
    frames: frameCount,
    reveal,
    targetReveal,
    office: lightOn,
    theme: host.dataset.theme,
    running,
    buildings: buildings.length,
    landmarks: buildings.map((b) => b.object.name),
    orbit: [orbitX, orbitY],
    resources: renderer.info.memory,
    framing: { width: cameraWidth, height: camera.top - camera.bottom, center: target.toArray() },
    landmarkFrames: projectLandmarks
      ? Object.fromEntries(["GeiselCoast", "SalkCoast", "BrocktonVilla", "LaValencia", "ChildrensPool"].map((name) => [name, landmarkFrame(name)]))
      : undefined,
  });
  syncRunning();
}
