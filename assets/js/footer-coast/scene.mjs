import * as THREE from "../three.module.min.js";
import { createModelLoader } from "../home-scene/model-loader.mjs";
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

function makeWater(clock, color) {
  const material = new THREE.MeshStandardMaterial({ color, roughness: 0.32, metalness: 0.18, transparent: true, depthWrite: false });
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
    shader.fragmentShader = `uniform float coastTime; varying vec3 coastPosition;\n${shader.fragmentShader}`.replace(
      "#include <color_fragment>",
      `#include <color_fragment>
        float shore = 2.1-.7*sin(coastPosition.x*.23)-.25*sin(coastPosition.x*.68);
        float depth = coastPosition.z-shore;
        float edge = smoothstep(0.,.12,depth)*(1.-smoothstep(5.0,7.0,depth))*(1.-smoothstep(18.6,21.,abs(coastPosition.x)));
        float swell = sin(depth*5.5-coastTime*.62+sin(coastPosition.x*.6)*.45);
        float breakup = smoothstep(-.45,.7,sin(coastPosition.x*1.9+coastTime*.08)+sin(coastPosition.x*5.2+depth));
        float foam = smoothstep(.83,1.,swell)*breakup*(1.-smoothstep(.2,2.5,depth))*.66;
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(.66,.80,.75), (1.-smoothstep(0.,2.3,depth))*.38);
        diffuseColor.rgb = mix(diffuseColor.rgb,vec3(.88,.93,.85),foam);
        diffuseColor.a *= edge;
        if(diffuseColor.a<.008) discard;`
    );
  };
  const geometry = new THREE.PlaneGeometry(42, 15, 170, 64).rotateX(-Math.PI / 2).translate(0, 0.04, 3.5);
  return new THREE.Mesh(geometry, material);
}

export async function mountCoast(host) {
  const canvas = host.querySelector("canvas");
  const surface = host.querySelector(".footer-coast__scene");
  const pause = host.querySelector(".footer-coast__pause");
  const lightButton = host.querySelector(".footer-coast__light");
  const reduced = matchMedia("(prefers-reduced-motion: reduce)");
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
  Object.assign(sun.shadow.camera, { left: -25, right: 25, top: 12, bottom: -12, near: 1, far: 70 });
  sun.shadow.normalBias = 0.025;
  sun.shadow.bias = -0.00015;
  sun.shadow.radius = 3;
  scene.add(sun);
  const fill = new THREE.DirectionalLight(0xd3e7ec, 0.65);
  fill.position.set(12, 6, -10);
  scene.add(fill);
  const clock = { value: 0 };
  const water = makeWater(clock, 0x337e90);
  water.userData.noOcclusion = true;
  const finish = createFinish(renderer, scene, camera, { transparentOutput: true });
  const { loader, decoder } = createModelLoader();
  let model, manifest;
  try {
    const manifestResponse = await fetch(new URL("../../models/la-jolla/manifest.json", import.meta.url));
    if (!manifestResponse.ok) throw new Error("The coastal miniature is unavailable.");
    manifest = await manifestResponse.json();
    model = await loader.loadAsync(new URL(`../../models/la-jolla/${manifest.model}`, import.meta.url).href);
  } catch (error) {
    decoder.dispose();
    renderer.dispose();
    env.dispose();
    finish.dispose();
    throw error;
  }
  decoder.dispose();
  scene.add(model.scene, water);
  const crowns = [],
    surfers = [],
    windows = [];
  let officeMaterial;
  model.scene.traverse((o) => {
    if (o.name === "Pacific") o.visible = false;
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
  const officePosition = new THREE.Vector3().fromArray(manifest.office);
  const officeGlow = new THREE.PointLight(0xffbd70, 0.6, 2.1, 2);
  officeGlow.position.copy(officePosition).add(new THREE.Vector3(0, 0, 0.12));
  scene.add(officeGlow);
  let visible = false,
    stopped = reduced.matches,
    lightOn = true,
    running = false,
    disposed = false,
    lost = false;
  let raf = 0,
    previous = 0,
    elapsed = 0,
    reveal = 0,
    targetReveal = 0,
    theme = THEMES.noon;
  let pointerX = 0,
    currentX = 0,
    cameraWidth = 45,
    frameCount = 0;
  const target = new THREE.Vector3(0, 1.3, 0);
  const cameraBase = new THREE.Vector3(11, 23, 36);
  let drag = null;

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
    lights();
    draw();
  }

  function resize() {
    const { width, height } = surface.getBoundingClientRect();
    const narrow = width < 600;
    surface.tabIndex = narrow ? 0 : -1;
    surface.setAttribute("aria-keyshortcuts", narrow ? "ArrowLeft ArrowRight" : "");
    // Phone composition visits the studio, courts and surf at a readable scale.
    cameraWidth = narrow ? 21 : 45;
    target.set(narrow ? 5.1 : 0, 2, 0);
    cameraBase.set(target.x + 5, 18, 38);
    const half = cameraWidth / 2;
    camera.left = -half;
    camera.right = half;
    camera.top = (half * height) / width;
    camera.bottom = -camera.top;
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
    camera.lookAt(target);
    finish.render(camera, false);
    host.dataset.frames = String(++frameCount);
  }

  function progress() {
    const r = surface.getBoundingClientRect();
    targetReveal = Math.max(targetReveal, clamp((innerHeight - r.top) / Math.min(r.height * 0.75, innerHeight * 0.5)));
  }

  function frame(now) {
    if (!running) return;
    raf = requestAnimationFrame(frame);
    // This ambient footer needs at most 30 fps, independent of display refresh.
    if (now - previous < 32) return;
    const dt = Math.min((now - previous) / 1000, 0.06);
    previous = now;
    elapsed += dt;
    clock.value = elapsed;
    progress();
    reveal += (targetReveal - reveal) * Math.min(1, dt * 4);
    if (reveal < 0.999) {
      canvas.style.transform = `translateY(${(1 - reveal) * 22}px)`;
      if (officeMaterial && lightOn) officeMaterial.emissiveIntensity = (0.65 + theme.night * 0.7) * reveal;
    } else canvas.style.transform = "none";
    currentX += (pointerX - currentX) * Math.min(1, dt * 2.1);
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
    pause.setAttribute("aria-pressed", String(stopped || reduced.matches));
    pause.setAttribute("aria-label", stopped || reduced.matches ? "Play coastal scene" : "Pause coastal scene");
    host.querySelector("[data-coast-pause-icon]").textContent = stopped || reduced.matches ? "▷" : "Ⅱ";
    pause.disabled = reduced.matches;
  }
  const onPause = () => {
    stopped = !stopped;
    syncRunning();
  };
  const onLight = () => {
    lightOn = !lightOn;
    lightButton.setAttribute("aria-pressed", String(lightOn));
    host.querySelector("[data-coast-light-label]").textContent = lightOn ? "Studio light on" : "Studio light off";
    lights();
    if (surface.clientWidth < 600) {
      target.x = 5.1;
      cameraBase.x = target.x + 5;
    }
    draw();
  };
  const pan = (delta) => {
    if (surface.clientWidth >= 600) return;
    target.x = clamp(target.x + delta, -10.5, 10.5);
    cameraBase.x = target.x + 5;
    draw();
  };
  const onDown = (event) => {
    if (surface.clientWidth < 600) drag = { x: event.clientX, y: event.clientY, id: event.pointerId };
  };
  const onPointer = (event) => {
    if (drag && drag.id === event.pointerId) {
      const dx = event.clientX - drag.x;
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
    if (surface.clientWidth < 600 && ["ArrowLeft", "ArrowRight"].includes(event.key)) {
      event.preventDefault();
      pan(event.key === "ArrowLeft" ? -3.5 : 3.5);
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
  pause.addEventListener("click", onPause);
  lightButton.addEventListener("click", onLight);
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
    host.querySelector(".footer-coast__actions").hidden = true;
  };
  canvas.addEventListener("webglcontextlost", contextLost);
  const contextRestored = () => {
    lost = false;
    renderer.shadowMap.needsUpdate = true;
    host.dataset.state = "ready";
    host.querySelector(".footer-coast__actions").hidden = false;
    syncRunning();
    draw();
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
      o.geometry?.dispose();
      const materials = Array.isArray(o.material) ? o.material : [o.material];
      materials.forEach((m) => m?.dispose());
    });
    env.dispose();
    finish.dispose();
    renderer.dispose();
  });
  window.addEventListener("pageshow", () => {
    if (!disposed) syncRunning();
  });
  resize();
  syncTheme();
  renderer.shadowMap.needsUpdate = true;
  draw();
  host.dataset.state = "ready";
  host.querySelector(".footer-coast__actions").hidden = false;
  syncRunning();
}
