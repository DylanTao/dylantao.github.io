import * as THREE from "../three.module.min.js";
import { coastManifest, acquireCoast } from "./assets.mjs?v=coastal-life-20261018";
import { createFinish } from "../home-scene/realism.mjs";
import { createCameraMotion } from "../home-scene/camera-motion.mjs";
import { sampleCoastWave } from "./wave-motion.mjs";
import { createPeople } from "./people.mjs?v=coast-water-20261018";
import { createCoastWater } from "./water.mjs?v=coast-water-20261018";

// People keep a composed still pose under reduced motion and under automation, as the
// cinematic layer does; `?cinematic=live` lets a browser test watch them move.
const automated = Boolean(navigator.webdriver) && !/[?&]cinematic=live(?:&|$)/.test(location.search);

// Sea: `water` tints the Connect miniature's sea; in the footer `deep` is the open water's own color,
// `shallow` the light scattered over the sandy shelf,
// `mirror` the sky the surface reflects; `caustic`, `reflect` (the mirrored coast), `glow` (its lights)
// and `foam` set their strengths (water.mjs).
const THEMES = {
  morning: {
    sky: 0xf5dfce,
    ground: 0x8b9290,
    sun: 0xffdfb4,
    key: 2.4,
    fill: 1.05,
    exposure: 1.0,
    water: 0x568f9d,
    deep: 0x4c8496,
    shallow: 0x5fbfc4,
    mirror: 0xa9bcc6,
    caustic: 0.6,
    reflect: 0.22,
    glow: 0.5,
    foam: 0.9,
    night: 0.12,
  },
  noon: {
    sky: 0xddebf1,
    ground: 0x8d9480,
    sun: 0xfff4d5,
    key: 2.6,
    fill: 1.15,
    exposure: 1.0,
    water: 0x337e90,
    deep: 0x22688a,
    shallow: 0x3fc4cc,
    mirror: 0x8fbdd6,
    caustic: 1,
    reflect: 0.2,
    glow: 0.4,
    foam: 1,
    night: 0,
  },
  afternoon: {
    sky: 0xe4eddf,
    ground: 0x959378,
    sun: 0xffd09a,
    key: 2.3,
    fill: 1.0,
    exposure: 1.0,
    water: 0x4c9291,
    deep: 0x438a8a,
    shallow: 0x56c4b8,
    mirror: 0xa7bfc4,
    caustic: 0.8,
    reflect: 0.24,
    glow: 0.5,
    foam: 0.95,
    night: 0.18,
  },
  evening: {
    sky: 0x829bb4,
    ground: 0x3b4854,
    sun: 0xb4caff,
    key: 0.85,
    fill: 0.55,
    exposure: 0.85,
    water: 0x234b68,
    deep: 0x1f4462,
    shallow: 0x245a6e,
    mirror: 0x24364c,
    caustic: 0,
    reflect: 0.26,
    glow: 1,
    foam: 0.55,
    night: 1,
  },
};
const COLORS = ["sky", "ground", "sun", "water", "deep", "shallow", "mirror"];
// Page backgrounds (_sass/_themes.scss), for the haze when the page's CSS is absent (poster renders).
const PAGE = { morning: 0xfffaf7, noon: 0xfffefa, afternoon: 0xfbfaf7, evening: 0x111c22 };
const clamp = (x, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, x));

// An hour chosen on the theme panel's sun arc (sun-arc.mjs) blends the four authored looks by the
// minute, each anchored where that theme stands on the arc, so the coast's light moves with the
// slider instead of jumping at theme boundaries.
const LOOK_ANCHORS = [
  ["morning", 480],
  ["noon", 750],
  ["afternoon", 1020],
  ["evening", 1320],
  ["morning", 1920],
];
const mixColor = (a, b, t) => new THREE.Color(a).lerp(new THREE.Color(b), t).getHex();
function themeAtMinute(minute) {
  const m = ((minute % 1440) + 1440) % 1440;
  const at = m < LOOK_ANCHORS[0][1] ? m + 1440 : m;
  let i = 0;
  while (i < LOOK_ANCHORS.length - 2 && at >= LOOK_ANCHORS[i + 1][1]) i++;
  const [fromName, from] = LOOK_ANCHORS[i],
    [toName, to] = LOOK_ANCHORS[i + 1];
  const t = clamp((at - from) / (to - from)),
    a = THEMES[fromName],
    b = THEMES[toName];
  const blended = {};
  for (const key of Object.keys(a)) blended[key] = COLORS.includes(key) ? mixColor(a[key], b[key], t) : a[key] + (b[key] - a[key]) * t;
  return blended;
}

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

// Evening lamps along Scripps Pier: slim dark posts by day; at night warm bulbs whose reflections
// streak the sea. Two instanced meshes, placed from the pier's own bounds.
function createPierLamps(model) {
  const pier = model.getObjectByName("ScrippsPier");
  if (!pier) return null;
  model.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(pier);
  // [deck edge x, outward side, z]: posts alternate sides; each lamp hangs from an arm over the water,
  // so its reflection falls beside the deck instead of beneath it.
  const spots = [
    [box.max.x, 1, box.min.z + 1.5],
    [box.min.x, -1, box.min.z + 3.7],
    [box.max.x, 1, box.min.z + 5.9],
  ];
  const height = 0.52,
    reach = 0.3,
    top = box.max.y;
  // Posts and arms share one instanced unit box; bulbs are a second instanced mesh.
  const bars = new THREE.InstancedMesh(
    new THREE.BoxGeometry(1, 1, 1),
    new THREE.MeshStandardMaterial({ color: 0x2b3033, roughness: 0.6, metalness: 0.4, envMapIntensity: 0.22 }),
    spots.length * 2
  );
  const bulbs = new THREE.InstancedMesh(
    new THREE.IcosahedronGeometry(0.05, 1),
    new THREE.MeshStandardMaterial({ color: 0xe9e2d2, emissive: 0xffc27a, emissiveIntensity: 0, roughness: 0.4, envMapIntensity: 0.22 }),
    spots.length
  );
  const matrix = new THREE.Matrix4(),
    scale = new THREE.Matrix4();
  const lights = spots.map(([x, side, z], i) => {
    bars.setMatrixAt(i * 2, matrix.makeTranslation(x, top + height / 2, z).multiply(scale.makeScale(0.034, height, 0.034)));
    bars.setMatrixAt(
      i * 2 + 1,
      matrix.makeTranslation(x + (side * reach) / 2, top + height, z).multiply(scale.makeScale(reach + 0.02, 0.026, 0.026))
    );
    const light = { x: x + side * reach, y: top + height - 0.06, z };
    bulbs.setMatrixAt(i, matrix.makeTranslation(light.x, light.y, light.z));
    return light;
  });
  bars.name = "PierLampPosts";
  bulbs.name = "PierLampBulbs";
  bars.castShadow = true;
  bars.receiveShadow = true;
  bulbs.userData.noOcclusion = true;
  return {
    objects: [bars, bulbs],
    lights,
    // 0 by day, 1 at night; the bulbs glow and their glitter paths appear.
    set(on) {
      bulbs.material.emissiveIntensity = on * 2.6;
      bulbs.material.color.set(on > 0.5 ? 0xffe2b0 : 0xe9e2d2);
    },
  };
}

export async function mountCoast(host, { posterFrameHeight } = {}) {
  const miniature = host.hasAttribute("data-miniature");
  const canvas = host.querySelector("canvas");
  const surface = host.querySelector(".footer-coast__scene");
  const reduced = matchMedia("(prefers-reduced-motion: reduce)");
  // Use the same viewport breakpoint as <picture> and CSS. A classic scrollbar
  // can make the canvas narrower than the viewport near this boundary.
  const narrowViewport = matchMedia("(max-width: 599px)");
  // The finish multisamples its own target and ends with one full-screen triangle (realism.mjs),
  // so the canvas itself does not need multisampling.
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: false, powerPreference: "low-power" });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
  renderer.setClearColor(0, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.shadowMap.autoUpdate = false;
  const scene = new THREE.Scene();
  // Haze toward the skyline: the farthest hills soften into the page behind the canvas, while the
  // sea and the coast stay clear. The Connect miniature keeps its own crisp air.
  if (!miniature) scene.fog = new THREE.Fog(0xfffefa, 44, 71);
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
  const water = createCoastWater(renderer, { clock, miniature, profile: manifest.coastProfile });
  const lamps = miniature ? null : createPierLamps(model.scene);
  let lampsOn = 0;
  if (!miniature) scene.add(water.mesh);
  if (lamps) scene.add(...lamps.objects);
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
    if (!o.isMesh && /^Surfer\d/.test(o.name)) surfers.push({ object: o, position: o.position.clone(), rotation: o.rotation.clone() });
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
  if (!miniature) {
    // Boards and their spray sit on the sea, which takes no shadows; keeping them out of the shadow
    // map also lets the sea's mirror leave them out without losing a shadow.
    model.scene.getObjectByName("Surf")?.traverse((o) => {
      o.castShadow = false;
    });
    water.exclude(surfers.map(({ object }) => object));
  }
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
  let revealOnScroll = false,
    mounted = false;
  let pointerX = 0,
    currentX = 0,
    cameraWidth = 45,
    frameCount = 0;
  const target = new THREE.Vector3(0, 1.3, 0);
  const bufferSize = new THREE.Vector2();
  const cameraBase = new THREE.Vector3(11, 23, 36);
  const motion = createCameraMotion();
  const orbitOffset = new THREE.Vector3();
  const orbitSphere = new THREE.Spherical();
  let renderedOrbitX = 0,
    renderedOrbitY = 0;
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
  // People belong to the composition's props (bin/coastal_life.py); players appear only once
  // their court has fully risen. The compact atlas keeps its baked figures unless its
  // manifest entry lists people of its own.
  const figures = (miniature ? manifest.miniature?.figures : manifest.figures) || [];
  const stances = Object.fromEntries(figures.filter((f) => f.parent).map((f) => [f.parent, f.stance]));
  const people = figures.length
    ? createPeople(scene, model.scene, figures, {
        hostVisible: (name) => {
          const b = buildings.find((item) => item.object.name === name);
          return !b || (b.object.visible && (b.progress ?? 1) > 0.999);
        },
      })
    : null;
  water.exclude(people?.objects || []);
  const peopleLive = () => !reduced.matches && !stopped && !automated;
  // Wake sources for the sea: the riding and paddling boards (nose along their local +x) and the swimmer.
  function movers() {
    const list = [];
    for (const { object } of surfers) {
      const power = { ride: 0.95, paddle: 0.6 }[stances[object.name]] || 0;
      if (!object.visible || !power) continue;
      const yaw = object.rotation.y;
      list.push({ x: object.position.x, z: object.position.z, heading: [Math.cos(yaw), -Math.sin(yaw)], power });
    }
    return list.concat(people?.movers?.() || []);
  }
  // Lights the sea glitters under: the evening fire (flickering with its light) and the pier lamps.
  function seaLights() {
    const list = [];
    const fire = people?.fire?.();
    if (fire) list.push({ x: fire.x, y: fire.y + 0.25, z: fire.z, power: 0.95 * fire.light, spread: 0.24 });
    if (lamps && lampsOn > 0.01) for (const lamp of lamps.lights) list.push({ ...lamp, power: 0.34 * lampsOn, spread: 0.11 });
    return list;
  }
  function revealBuildings(value) {
    if (host.dataset.reveal === value.toFixed(3)) return;
    buildings.forEach((b, i) => {
      const p = miniature || reduced.matches ? 1 : clamp((value - (i / Math.max(1, buildings.length)) * 0.68) / 0.32);
      const eased = p * p * (3 - 2 * p);
      b.object.scale.y = b.scale.y * Math.max(0.001, eased);
      b.object.position.y = b.base.y + (1 - eased) * b.floor;
      b.object.visible = p > 0.001;
      b.progress = p;
    });
    renderer.shadowMap.needsUpdate = true;
    water.invalidate();
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
    const preview = window.siteTime?.preview;
    theme =
      preview != null
        ? themeAtMinute(preview)
        : THEMES[document.documentElement.dataset.themeMode] || (document.documentElement.dataset.theme === "dark" ? THEMES.evening : THEMES.noon);
    hemi.color.set(theme.sky);
    hemi.groundColor.set(theme.ground);
    hemi.intensity = theme.fill;
    sun.color.set(theme.sun);
    sun.intensity = theme.key;
    fill.intensity = 0.65 - theme.night * 0.45;
    renderer.toneMappingExposure = theme.exposure;
    if (scene.fog) {
      // The page color behind the transparent canvas, lifted so the output pass's tone mapping lands near it.
      const page = getComputedStyle(document.documentElement).getPropertyValue("--global-bg-color").trim();
      const selectedPage =
        PAGE[document.documentElement.dataset.themeMode] ?? (document.documentElement.dataset.theme === "dark" ? PAGE.evening : PAGE.noon);
      scene.fog.color.set(/^#[0-9a-f]{6}$/i.test(page) ? page : selectedPage);
      scene.fog.color.multiplyScalar(1 + 1.4 * scene.fog.color.getHSL({}).l);
    }
    water.setTheme(theme);
    lampsOn = clamp((theme.night - 0.35) / 0.45);
    lamps?.set(lampsOn);
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
    // Who is out: night brings the fire circle; a daytime preview of the evening theme
    // shows the afternoon crowd.
    people?.setPeriod(night ? "evening" : selected === "evening" ? "afternoon" : selected, night);
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
    if (scene.fog) {
      // Measured along the view from the camera: clear to just past the coast, then the hills behind.
      const reach = cameraBase.distanceTo(target);
      scene.fog.near = reach + 3;
      scene.fog.far = reach + 30;
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

  const placeMarker = host.querySelector(".coast-place-marker");
  const placeCorners = new Map();
  if (placeMarker) {
    model.scene.updateMatrixWorld(true);
    ["DIB", "Geisel", "Salk", "ScrippsPier"].forEach((name) => {
      const object = model.scene.getObjectByName(name);
      if (!object) return;
      const bounds = new THREE.Box3().setFromObject(object);
      const corners = [];
      for (const x of [bounds.min.x, bounds.max.x]) {
        for (const y of [bounds.min.y, bounds.max.y]) {
          for (const z of [bounds.min.z, bounds.max.z]) corners.push(new THREE.Vector3(x, y, z));
        }
      }
      placeCorners.set(name, corners);
    });
  }
  const markerPoint = new THREE.Vector3();
  function updatePlaceMarker() {
    if (!placeMarker) return;
    const corners = placeCorners.get(host.dataset.selectedPlace);
    placeMarker.hidden = !corners || lost;
    if (!corners || lost) return;
    let left = 1,
      top = 1,
      right = 0,
      bottom = 0;
    corners.forEach((corner) => {
      markerPoint.copy(corner).project(camera);
      const x = (markerPoint.x + 1) / 2;
      const y = (1 - markerPoint.y) / 2;
      left = Math.min(left, x);
      top = Math.min(top, y);
      right = Math.max(right, x);
      bottom = Math.max(bottom, y);
    });
    placeMarker.style.left = `${clamp(left) * 100}%`;
    placeMarker.style.top = `${clamp(top) * 100}%`;
    placeMarker.style.width = `${(clamp(right) - clamp(left)) * 100}%`;
    placeMarker.style.height = `${(clamp(bottom) - clamp(top)) * 100}%`;
  }

  function draw() {
    if (disposed || lost) return;
    camera.position.copy(cameraBase);
    camera.position.x += currentX * 0.6;
    if (miniature) {
      if (stopped || reduced.matches) {
        renderedOrbitX = orbitX;
        renderedOrbitY = orbitY;
        motion.stop("orbitX");
        motion.stop("orbitY");
      }
      orbitOffset.copy(camera.position).sub(target);
      orbitSphere.setFromVector3(orbitOffset);
      orbitSphere.theta += renderedOrbitX;
      orbitSphere.phi += renderedOrbitY;
      camera.position.copy(target).add(orbitOffset.setFromSpherical(orbitSphere));
    }
    camera.lookAt(target);
    // Every frame poses the people against the current boards, courts and theme; a still
    // frame holds the composed pose the posters show. People outside the camera's
    // horizontal span are skipped, not posed.
    const halfWidth = (camera.right - camera.left) / 2 + 2;
    people?.update(peopleLive() ? elapsed : 0, { viewX: [camera.position.x - halfWidth, camera.position.x + halfWidth] });
    // The sea follows the camera and redraws its mirror only when the coast or the view changed.
    water.setMovers(movers());
    water.setLights(seaLights(), camera);
    if (mounted) water.update(scene, camera, { size: renderer.getDrawingBufferSize(bufferSize), live: running });
    finish.render(camera, false);
    updatePlaceMarker();
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
    reveal = clamp(motion.step("reveal", reveal, targetReveal, dt, false, 8));
    if (reveal === 0 || reveal === 1) motion.stop("reveal");
    revealBuildings(reveal);
    currentX = motion.step("parallax", currentX, pointerX, dt, false, 5);
    renderedOrbitX = clamp(motion.step("orbitX", renderedOrbitX, orbitX, dt, false, drag ? 28 : 16), -Math.PI / 6, Math.PI / 6);
    renderedOrbitY = clamp(motion.step("orbitY", renderedOrbitY, orbitY, dt, false, drag ? 28 : 16), -Math.PI / 18, Math.PI / 18);
    crowns.forEach((o, i) => {
      o.rotation.z = Math.sin(elapsed * 0.65 + i) * 0.008;
    });
    surfers.forEach(({ object, position, rotation }, i) => {
      // A rider glides along the swell; a surfer waiting nose-out barely drifts; a paddler
      // loops slowly seaward and back, turning with the board.
      const stance = stances[object.name];
      let x = position.x,
        z = position.z,
        yaw = rotation.y;
      if (stance === "wait") x += Math.sin(elapsed * 0.11 + i) * 0.05;
      else if (stance === "paddle") {
        const a = peopleLive() ? elapsed * 0.09 : 0;
        x += Math.sin(a) * 0.9;
        z += (1 - Math.cos(a)) * 0.25;
        yaw += Math.atan2(-Math.sin(a) * 0.25, Math.cos(a) * 0.9);
      } else x += Math.sin(elapsed * 0.17 + i) * 0.48;
      object.position.x = x;
      object.position.z = z;
      const wave = sampleCoastWave(x, z, elapsed);
      object.position.y = position.y + wave.height;
      object.rotation.set(rotation.x + Math.atan(wave.dz), yaw, rotation.z - Math.atan(wave.dx));
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
      motion.stop();
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
    water.invalidate();
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
  window.addEventListener("siteTimeChange", syncTheme);
  surface.addEventListener("pointermove", onPointer);
  surface.addEventListener("pointerdown", onDown);
  surface.addEventListener("pointerup", onLeave);
  surface.addEventListener("pointercancel", onLeave);
  surface.addEventListener("pointerleave", onLeave);
  surface.addEventListener("keydown", onKey);
  host.addEventListener("coast:place", draw);
  reduced.addEventListener("change", onMotion);
  document.addEventListener("visibilitychange", syncRunning);
  const contextLost = (event) => {
    event.preventDefault();
    lost = true;
    syncRunning();
    host.dataset.state = "fallback";
    if (placeMarker) placeMarker.hidden = true;
  };
  canvas.addEventListener("webglcontextlost", contextLost);
  const contextRestored = () => {
    lost = false;
    renderer.shadowMap.needsUpdate = true;
    water.invalidate();
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
    window.removeEventListener("siteTimeChange", syncTheme);
    host.removeEventListener("coast:place", draw);
    document.removeEventListener("visibilitychange", syncRunning);
    reduced.removeEventListener("change", onMotion);
    people?.dispose();
    scene.traverse((o) => {
      if (!o.userData.sharedCoastGeometry) o.geometry?.dispose();
      const materials = Array.isArray(o.material) ? o.material : [o.material];
      materials.forEach((m) => m?.dispose());
    });
    env.dispose();
    model.release();
    water.dispose();
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
  // The setup frames above never reach the screen (the canvas shows once ready), so the sea's
  // mirror is first drawn for this one.
  mounted = true;
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
    selectedPlace: host.dataset.selectedPlace || null,
    frames: frameCount,
    reveal,
    targetReveal,
    office: lightOn,
    theme: host.dataset.theme,
    running,
    buildings: buildings.length,
    landmarks: buildings.map((b) => b.object.name),
    orbit: [orbitX, orbitY],
    renderedOrbit: [renderedOrbitX, renderedOrbitY],
    motion: motion.evidence(),
    elapsed,
    people: people ? { live: peopleLive(), ...people.evidence() } : null,
    water: water.evidence(),
    resources: renderer.info.memory,
    framing: { width: cameraWidth, height: camera.top - camera.bottom, center: target.toArray() },
    landmarkFrames: projectLandmarks
      ? Object.fromEntries(["GeiselCoast", "SalkCoast", "BrocktonVilla", "LaValencia", "ChildrensPool"].map((name) => [name, landmarkFrame(name)]))
      : undefined,
  });
  syncRunning();
}
