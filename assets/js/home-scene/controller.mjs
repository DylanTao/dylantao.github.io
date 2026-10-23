import * as THREE from "../three.module.min.js";
import { createModelLoader } from "./model-loader.mjs";
import { createArtDirection } from "./materials.mjs";
import { createPacific } from "./environment.mjs";
import { createFinish, physicalTime, surfaceLook } from "./realism.mjs";
import { readLook } from "./look.mjs";
import { createExplorationState, resolveRoutine, formatMinute, chooseArrivalAvatar, pacificClock } from "./routine.mjs";

import { createFootContacts } from "./locomotion.mjs";
import { createResolutionGovernor, detailFor } from "./resolution.mjs";
import { setMirrorSize } from "./reflection.mjs";
import { createShadowCache } from "./shadow-cache.mjs";
import { sortOpaqueByProgram } from "./draw-order.mjs";
import {
  envelopeFor,
  wildlifeEnvelope,
  constrainOrbit,
  keepCameraClear,
  cameraTerrainHeight,
  cameraArm,
  hardArm,
  steerOrbit,
  cushion,
  farView,
  outsideClearance,
  portraitFov,
  tripodLook,
  ORBIT_DIRECTION,
  BLOCKING,
  INSIDE,
} from "./camera.mjs";
import { createCameraField } from "./camera-field.mjs";
import { activityPose, createHandContacts } from "./activities.mjs";
import { createLiftRig } from "./lift-rig.mjs";
import { createDynamicCover, breathAt } from "./bedding-breath.mjs";
import { createGymProps } from "./gym-props.mjs";
import { sessionPose } from "./gym-session.mjs";
import { sessionState, trainingAt } from "./training.mjs";
import { resolveWristTargets } from "./grip-targets.mjs";
import { roomRoute, sampleRoute } from "./navigation.mjs";
import { createWorldCompanion } from "./companion.mjs";
import { companion, pipProjectUrl } from "../companion/bridge.mjs";
import { createRecordMotion } from "./record-motion.mjs";
import { createCameraMotion, createInertia } from "./camera-motion.mjs";
import { coastalDaylight, LA_JOLLA } from "./daylight.mjs";
import { createLoadingSketch } from "./loading-sketch.mjs";
import { createLightWell } from "./light-well.mjs";
import { bindContactLighting, withoutContactLighting } from "./contact-occlusion.mjs";
import { createCharacterPerformance } from "./character-performance.mjs";
import { createOcclusionRegion } from "./occlusion-region.mjs";
import { createSkinDiffusion } from "./skin-diffusion.mjs";
import { createOnsenWater } from "./onsen-water.mjs";
import { measurePoolGeometry } from "./pool-geometry.mjs";
import { createPoolStroke } from "./pool-stroke.mjs";
import { createCoastalWind } from "./coastal-wind.mjs";
import { coastWind, livePacificMinute } from "./wind-field.mjs";
import { syncOceanWind } from "./ocean-spectrum.mjs";
import { createCurtainRig } from "./curtain-rig.mjs";
import { createWarmPracticals } from "./warm-practicals.mjs";
import { createSteamDensity } from "./steam-density.mjs";
import { createSteamVolume } from "./steam-volume.mjs";
import { createStaticLightField } from "./static-light-field.mjs";
import { prepareFramePrograms } from "./program-warmup.mjs";
import { createGlazing, glaze, GLASS_NAME } from "./glazing.mjs";
import { createWorldFullscreen } from "./world-fullscreen.mjs";
import { createWalkMode } from "./walk-controls.mjs";
import { createLightInstallations } from "./light-installations.mjs";
import { createFurniture } from "./furniture.mjs";
import { createAtmosphere } from "./atmosphere.mjs";
import { createHaze } from "./haze.mjs";
import { createInfinityPool } from "./infinity-pool.mjs";

const manifestUrl = new URL("../../models/home/manifest.json", import.meta.url);
const clamp = THREE.MathUtils.clamp;
const stored = (key, fallback) => {
  try {
    return sessionStorage.getItem(key) || fallback;
  } catch {
    return fallback;
  }
};
const remember = (key, value) => {
  try {
    sessionStorage.setItem(key, value);
  } catch {
    /* Private browsing may disable storage. */
  }
};

// Look-lab tone curves (look.mjs). Exposure factors keep each curve's mean frame brightness close to
// ACES, so a comparison shows tone and color rather than a brighter or darker picture.
const TONE_MAPPING = { aces: THREE.ACESFilmicToneMapping, agx: THREE.AgXToneMapping, neutral: THREE.NeutralToneMapping };
const TONE_EXPOSURE = { aces: 1, agx: 1.08, neutral: 1.24 };
const CANVAS_LABEL =
  "Sirui’s coastal home. Drag or use arrow keys to look around; Shift-drag, right-drag or Shift+arrows move the view; plus and minus or Page Up and Page Down zoom, and zooming out past a room shows the whole house, then the coast. Home recentres the view. In the whole house, click a room or press 1 to 6 to visit it. N visits a coastal neighbour, D discovers a record, Escape returns inside. F opens full screen; Escape leaves it. In full screen, V walks: W A S D or the arrow keys move, Shift runs, Page Up and Page Down look up and down, and dragging or a click to capture the mouse looks around; V again returns to orbiting.";

export function createCoastalHome(container, records, artifacts) {
  const stage = container.closest("[data-home-artifact-stage]");
  const ui = stage.querySelector("[data-home-world-controls]");
  const status = ui.querySelector("[data-world-status]");
  const clockLabel = ui.querySelector("[data-world-clock]");
  const explore = createExplorationState();
  const recordMotion = createRecordMotion();
  const cameraMotion = createCameraMotion();
  // A released drag coasts (orbit in radians, pan in metres); see camera-motion.mjs.
  const inertia = createInertia();
  const { loader, decoder } = createModelLoader();
  const art = createArtDirection();
  let lookStorage = null;
  try {
    lookStorage = window.sessionStorage;
  } catch {
    /* Storage can be blocked; the URL flags still apply. */
  }
  const look = readLook(location.search, lookStorage);
  const scene = new THREE.Scene();
  const world = new THREE.Group();
  scene.add(world);
  const perspective = new THREE.PerspectiveCamera(38, 1, 0.05, 300);
  const orthographic = new THREE.OrthographicCamera(-3, 3, 3, -3, 0.05, 300);
  let camera = orthographic,
    aspect = 1,
    pacific,
    finish,
    skinDiffusion,
    onsenWater,
    coastalWind,
    warmPracticals,
    lightInstallations,
    steamVolume,
    staticLightField,
    atmosphere,
    daylight;
  const lightBakeAbort = new AbortController();
  let lightBakeStarted = false,
    lightBakeError = null;
  const target = new THREE.Vector3(0, 0.7, 0),
    desiredTarget = target.clone();
  let yaw = 0.36,
    pitch = 0.75,
    radius = 8.0,
    desiredRadius = radius,
    desiredFov = perspective.fov;
  let cameraYaw = yaw,
    cameraPitch = pitch;
  // The spring arm's current length (it shortens at once and lengthens smoothly), the look point
  // above the target while the coast camera is lifted over the cliff, and the clip planes.
  let armShown = null,
    armWanted = null,
    armDeficit = 0,
    outsideLift = 0;
  const aim = new THREE.Vector3();
  let config,
    renderer,
    initPromise,
    disposed = false,
    visible = false,
    inViewport = true;
  // Sirui's furniture at the house's anchors, by level of detail (furniture.mjs).
  let furniture = null;
  // The drawing buffer's pixel budget and adaptive density (resolution.mjs) and the cached static sun
  // shadow (shadow-cache.mjs).
  let resolution = null,
    shadowCache = null;
  // Walking in full screen (walk-controls.mjs), and the house model its collision field is sized to.
  let walkMode = null,
    shellRoot = null;
  let frame = 0,
    lastFrame = 0,
    elapsed = 0,
    frames = 0,
    clockTimer = 0;
  let compositionReady = false,
    startupStart = 0,
    firstFrameMilliseconds = null,
    backgroundTimer = 0;
  const startupStages = [],
    modelTimings = [];
  // Realistic is the only active treatment, including the authoring lab.
  const style = "realistic";
  const labEnabled = new URLSearchParams(location.search).get("scene-lab") === "1";
  let avatarId,
    activeGripOffsets,
    actor,
    mixer,
    actions,
    currentAction,
    avatarTicket = 0;
  let routine,
    currentRoom = "study",
    currentRecord = 0,
    spinning = false,
    paused = false;
  let dropped = [],
    callbacks = {},
    focused = null,
    animalFocus = null,
    travel = null,
    footContacts,
    handContacts,
    poolStroke,
    characterPerformance,
    sequenceStart = 0,
    sequencePose = null,
    coffeeCup = null,
    liftRig = null,
    liftActive = false,
    gymProps = null,
    sessionClock = { second: -1, minute: 0 },
    labSession = null,
    worldCompanion,
    actorGoal = null;
  let pointer = null,
    followClock = true,
    selectedProp,
    propHand,
    vinyl,
    vinylLabel,
    displayedVinylRecord = -1,
    pendingVinylRecord = null,
    vinylTransfer = null,
    tonearm,
    water,
    portraitMaterial;
  let poolOccupied = false,
    infinityPool = null;
  let steamReady = false,
    steamSetupMilliseconds = 0;
  const touches = new Map();
  let pinch;
  const rooms = new Map(),
    pendingRooms = new Map(),
    picks = [],
    sleeves = [],
    paperItems = [],
    floorCards = [];
  const resources = new Set(),
    textureCache = new Map(),
    cleanup = [],
    reducedQuery = matchMedia("(prefers-reduced-motion: reduce)");
  const frameTimings = [];
  const quantile = (key, fraction) => {
    const values = frameTimings.map((sample) => sample[key]).sort((a, b) => a - b);
    return values[Math.min(values.length - 1, Math.floor(values.length * fraction))] || 0;
  };
  const modelRequests = new Set();
  // Full screen (world-fullscreen.mjs): the stage fills the screen with a way back to the page, and
  // the drawing buffer and the detail that follows it switch to the full-screen profile (resize).
  const fullscreen = createWorldFullscreen({ stage, scene: container, ui, onChange: fullscreenChanged });
  cleanup.push(() => fullscreen.dispose());
  let reduced = reducedQuery.matches;
  const hemi = new THREE.HemisphereLight(0xe5ecff, 0xb28d57, 2.8);
  const sun = new THREE.DirectionalLight(0xffe0aa, 3.2);
  sun.position.set(-4, 9, 5);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -10, right: 10, top: 10, bottom: -10, near: 0.1, far: 65 });
  sun.shadow.bias = -0.00005;
  sun.shadow.normalBias = 0.018;
  sun.shadow.radius = 3;
  scene.add(hemi, sun, sun.target);
  // The sun's shadow map follows the view. Rooms and the whole house keep a tight 20 m square on
  // the house; on the coast the square is centred on what the camera looks at and sized to the
  // zoom (12 m half-width close up, 36 m at the authored 48 m view, 120 m at the 160 m far view,
  // where one 12 cm shadow texel is about one screen pixel), so walking along the cliff keeps fine
  // shadows under every tree and rock. The centre is snapped to whole shadow texels along the
  // light's axes, so moving the camera never makes shadow edges crawl.
  const shadowCentre = new THREE.Vector3(),
    shadowSnapped = new THREE.Vector3(),
    sunDirection = new THREE.Vector3(-4, 9, 5).normalize(),
    shadowAxes = [new THREE.Vector3(), new THREE.Vector3()];
  let shadowExtent = 10;
  function fitSunShadow(force = false) {
    const outside = currentRoom === "outside";
    const extent = outside ? clamp(Math.round(radius * 0.75), 12, 120) : 10;
    const centre = outside ? target : shadowCentre.set(0, 0, 0);
    const direction = sunDirection;
    const right = shadowAxes[0].set(0, 1, 0).cross(direction).normalize(),
      up = shadowAxes[1].copy(direction).cross(right);
    const texel = (2 * extent) / sun.shadow.mapSize.x;
    const snap = (v) => Math.round(v / texel) * texel;
    const snapped = shadowSnapped
      .set(0, 0, 0)
      .addScaledVector(right, snap(centre.dot(right)))
      .addScaledVector(up, snap(centre.dot(up)))
      .addScaledVector(direction, centre.dot(direction));
    const reach = extent * 2.5 + 40;
    sun.target.position.copy(snapped);
    sun.position.copy(snapped).addScaledVector(direction, reach);
    if (force || extent !== shadowExtent) {
      shadowExtent = extent;
      Object.assign(sun.shadow.camera, { left: -extent, right: extent, top: extent, bottom: -extent, near: 0.1, far: reach * 2 });
      // Biases scale with the texel: two and a half texels of normal offset on the coast.
      sun.shadow.normalBias = outside ? texel * 2.5 + 0.03 : 0.04;
      sun.shadow.bias = -0.004 / (reach * 2);
      sun.shadow.camera.updateProjectionMatrix();
    }
    sun.target.updateMatrixWorld();
    sun.shadow.needsUpdate = true;
  }

  function listen(targetObject, event, fn, options) {
    targetObject.addEventListener(event, fn, options);
    cleanup.push(() => targetObject.removeEventListener(event, fn, options));
  }

  function own(resource) {
    resources.add(resource);
    return resource;
  }

  // Shader programs compile on the GPU driver's worker threads (KHR_parallel_shader_compile)
  // while the page stays responsive. Drawing a material first and asking for its program log
  // instead blocked the main thread for 0.3-1.8 s per program: 13 s before the first composed
  // view and another 6 s when the remaining rooms streamed in (docs/evidence/coastal-startup-2026-10-04).
  let programProbe = null,
    programQueue = Promise.resolve();
  function compilePrograms(onProgress) {
    programQueue = programQueue
      .then(async () => {
        if (!renderer || disposed) return;
        // The beauty pass draws into a linear, untoned half-float target; programs are keyed by
        // that output state, so they are prepared while an equivalent target is bound.
        programProbe ||= own(new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType }));
        await prepareFramePrograms(renderer, scene, camera, { target: programProbe, ...finish?.programWarmup, onProgress });
      })
      .catch(() => {});
    return programQueue;
  }

  // The loading sketch follows the work: the cliff once the house is in, the cut-away house once
  // the coast is, then the occupied room while its programs compile.
  let loadingSketch = null;
  function loadingStage(stage, message) {
    startupStages.push({ stage, milliseconds: performance.now() - startupStart });
    container.dataset.loadingStage = stage;
    status.textContent = message;
    ui.querySelector("[data-world-view]").disabled = stage !== "ready";
    const drawing = { coast: "outside", room: "overview", "first-frame": routine?.room }[stage];
    if (drawing) loadingSketch?.stage(drawing);
  }

  // An honest loading bar: one segment per piece of first-view work, each filled only by what has
  // happened (a model's streamed bytes, then its parse; the view's programs as the driver finishes
  // them), so it never runs ahead of the work and never moves backward.
  const progressBar = ui.querySelector("[data-world-progress]");
  const progressFill = { house: 0, coast: 0, room: 0, sirui: 0, view: 0 };
  function progress(step, fill) {
    if (!progressBar || !(step in progressFill) || !(fill > progressFill[step])) return;
    progressFill[step] = Math.min(1, fill);
    progressBar.querySelector(`[data-progress-step="${step}"]`)?.style.setProperty("--fill", progressFill[step].toFixed(3));
    const steps = Object.values(progressFill);
    progressBar.setAttribute("aria-valuenow", String(Math.round((100 * steps.reduce((sum, value) => sum + value, 0)) / steps.length)));
    // Every segment full but the first frame not yet drawn: the bar breathes with the sketch.
    progressBar.classList.toggle(
      "is-settling",
      steps.every((value) => value >= 1)
    );
  }

  // GitHub Pages gzips models, so Content-Length counts compressed bytes while the stream yields
  // decompressed ones; the fraction is held short of complete until the last byte arrives.
  async function readWithProgress(response, report) {
    const length = Number(response.headers.get("content-length")) || 0;
    if (!response.body || !length) return response.arrayBuffer();
    const reader = response.body.getReader(),
      chunks = [];
    let received = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      received += value.byteLength;
      report(Math.min(0.97, received / length));
    }
    const bytes = new Uint8Array(received);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return bytes.buffer;
  }

  async function loadModel(url, step = null) {
    const abort = new AbortController();
    const timing = { asset: new URL(url).pathname.split("/").pop(), startMilliseconds: performance.now() - startupStart };
    modelTimings.push(timing);
    modelRequests.add(abort);
    try {
      const response = await fetch(url, { signal: abort.signal });
      if (!response.ok) throw new Error(`Model unavailable: ${response.status}`);
      timing.headersMilliseconds = performance.now() - startupStart;
      // Downloading is most of a model's share of the bar; parsing (Draco decoding) is the rest.
      const bytes = step ? await readWithProgress(response, (fraction) => progress(step, 0.85 * fraction)) : await response.arrayBuffer();
      timing.bytes = bytes.byteLength;
      timing.downloadedMilliseconds = performance.now() - startupStart;
      if (step) progress(step, 0.85);
      const model = await loader.parseAsync(bytes, new URL(".", url).href);
      timing.parsedMilliseconds = performance.now() - startupStart;
      if (step) progress(step, 1);
      return model;
    } finally {
      modelRequests.delete(abort);
    }
  }

  function material(color, extra = {}) {
    const result = own(bindContactLighting(new THREE.MeshStandardMaterial({ color, roughness: 0.72, ...extra }), finish?.contactLighting));
    staticLightField?.bindMaterial(result);
    lightInstallations?.bindMaterial(result);
    return result;
  }

  function mesh(geometry, mat, position, action) {
    const object = new THREE.Mesh(own(geometry), mat);
    object.position.set(...position);
    object.castShadow = object.receiveShadow = true;
    if (action) {
      object.userData.action = action;
      picks.push(object);
    }
    object.userData.fixedMaterial = true;
    world.add(object);
    return object;
  }

  function labelTexture(title, subtitle, color = "#283735") {
    const c = document.createElement("canvas");
    c.width = 640;
    c.height = 800;
    const ctx = c.getContext("2d");
    ctx.fillStyle = "#fffdf5";
    ctx.fillRect(0, 0, 640, 800);
    ctx.fillStyle = "#b7613e";
    ctx.font = "22px sans-serif";
    ctx.fillText(subtitle.toUpperCase(), 52, 78);
    ctx.fillStyle = color;
    ctx.font = "600 44px Inter, sans-serif";
    let y = 152,
      line = "";
    for (const word of title.split(" ")) {
      if (ctx.measureText(line + word).width > 535 && line) {
        ctx.fillText(line, 52, y);
        y += 54;
        line = "";
      }
      line += word + " ";
    }
    ctx.fillText(line, 52, y);
    ctx.strokeStyle = "#c1c6ba";
    ctx.lineWidth = 2;
    for (let i = 0; i < 7; i++) {
      ctx.beginPath();
      ctx.moveTo(52, 440 + i * 34);
      ctx.lineTo(520 - (i % 3) * 45, 440 + i * 34);
      ctx.stroke();
    }
    ctx.strokeStyle = "#719380";
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.arc(150, 354, 38, 0, 6.28);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(200, 354);
    ctx.lineTo(340, 354);
    ctx.lineTo(319, 338);
    ctx.moveTo(340, 354);
    ctx.lineTo(319, 372);
    ctx.stroke();
    ctx.strokeRect(382, 318, 105, 72);
    const tex = own(new THREE.CanvasTexture(c));
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  function imageTexture(url) {
    if (textureCache.has(url)) return textureCache.get(url);
    const tex = new THREE.TextureLoader().load(
      url,
      () => {
        tex.userData.ready = true;
        requestFrame();
      },
      undefined,
      () => {
        tex.userData.failed = true;
        requestFrame();
      }
    );
    tex.colorSpace = THREE.SRGBColorSpace;
    textureCache.set(url, tex);
    return own(tex);
  }

  function roomPoint(id, point) {
    const offset = config.rooms.find((r) => r.id === id)?.offset || [0, 0, 0];
    return point.map((v, i) => v + offset[i]);
  }

  // Where the desk's interactive props stand. The manifest can place them (rooms[study].desk, world
  // coordinates); the code below works in the study's offset frame, so its points are taken back
  // into that frame, and every prop falls back to the original desk's layout.
  function deskLayout() {
    const study = config.rooms.find((r) => r.id === "study");
    const offset = study?.offset || [0, 0, 0];
    const desk = study?.desk || {};
    const local = (point, fallback) => (point ? point.map((v, i) => v - offset[i]) : fallback);
    return { desk, local };
  }

  function makeDeskObjects() {
    const previousObjects = new Set(world.children);
    const cream = material(0xf4ecd8),
      ink = material(0x252c29);
    const { desk, local } = deskLayout();
    const deck = local(desk.turntable, [0.84, 0.91, -2.18]);
    const near = (base, d) => base.map((v, i) => v + d[i]);
    mesh(new THREE.BoxGeometry(0.68, 0.07, 0.43), material(0x71512b), deck);
    vinyl = mesh(new THREE.CylinderGeometry(0.19, 0.19, 0.017, 48), ink, near(deck, [-0.01, 0.046, 0.01]), { type: "spin" });
    vinylLabel = new THREE.Mesh(own(new THREE.CircleGeometry(0.063, 32)), material(0xffffff));
    vinylLabel.rotation.x = -Math.PI / 2;
    vinylLabel.position.y = 0.011;
    vinylLabel.userData.fixedMaterial = true;
    vinyl.add(vinylLabel);
    pendingVinylRecord = currentRecord;
    if (spinning && !reduced) recordMotion.cue(true);
    tonearm = new THREE.Group();
    tonearm.name = "Pivoted study tonearm";
    tonearm.position.set(...near(deck, [0.2, 0.076, -0.11]));
    const armMetal = material(0xa7b2b5, { metalness: 1, roughness: 0.28 });
    const addArm = (geometry, mat, position) => {
      const part = new THREE.Mesh(own(geometry), mat);
      part.position.set(...position);
      part.castShadow = part.receiveShadow = true;
      part.userData.fixedMaterial = true;
      tonearm.add(part);
      return part;
    };
    addArm(new THREE.CylinderGeometry(0.017, 0.02, 0.025, 16), armMetal, [0, 0, 0]);
    const armPath = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0.01, 0),
      new THREE.Vector3(-0.016, 0.01, 0.09),
      new THREE.Vector3(-0.075, 0.01, 0.18),
      new THREE.Vector3(-0.105, 0.01, 0.23),
    ]);
    addArm(new THREE.TubeGeometry(armPath, 18, 0.005, 8, false), armMetal, [0, 0, 0]);
    addArm(new THREE.CylinderGeometry(0.016, 0.016, 0.025, 12), armMetal, [0.004, 0.01, -0.025]);
    addArm(new THREE.BoxGeometry(0.022, 0.012, 0.028), ink, [-0.105, 0.002, 0.23]);
    addArm(new THREE.ConeGeometry(0.004, 0.018, 8), armMetal, [-0.105, -0.012, 0.23]).rotation.z = Math.PI;
    world.add(tonearm);
    for (let i = 0; i < records.length; i++) {
      const face = material(0xffffff, { map: imageTexture(records[i].cover) });
      const at = local(desk.records?.[i], [-1.22, 1.68, -2.14 + i * 0.36]);
      const sleeve = mesh(new THREE.BoxGeometry(0.34, 0.35, 0.025), [cream, cream, cream, cream, face, cream], at, {
        type: "record",
        index: i,
      });
      sleeve.rotation.y = desk.recordYaw ?? Math.PI / 2 + 0.08;
      sleeve.userData.home = { position: sleeve.position.clone(), rotation: sleeve.rotation.clone(), scale: sleeve.scale.clone() };
      sleeves.push(sleeve);
    }
    artifacts.forEach((a, index) => {
      const face = material(0xffffff, { map: labelTexture(a.title, a.label) });
      const at = local(desk.papers?.[index], [-0.72 + index * 0.35, 0.884, -2.16]);
      const paper = mesh(new THREE.BoxGeometry(0.29, 0.4, 0.009), [cream, cream, cream, cream, face, cream], at, {
        type: "artifact",
        index,
      });
      paper.rotation.set(-Math.PI / 2, 0, index * 0.11 - 0.1 + (desk.paperYaw || 0));
      paper.userData.home = { position: paper.position.clone(), rotation: paper.rotation.clone(), scale: paper.scale.clone() };
      paperItems.push(paper);
    });
    const glass = mesh(
      new THREE.PlaneGeometry(2.45, 2.3),
      material(0xbee0dc, { transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false }),
      local(desk.window, [0, 1.3, -3.13]),
      { type: "window" }
    );
    glass.rotation.y = desk.windowYaw || 0;
    glass.castShadow = false;
    glass.userData.noOcclusion = true;
    // Move all interactive desk objects with the upper study, including their
    // stored return positions. Album identity stays independent of room layout.
    world.children
      .filter((o) => !previousObjects.has(o))
      .forEach((o) => {
        o.position.fromArray(roomPoint("study", o.position.toArray()));
        if (o === tonearm) o.userData.restY = o.position.y;
        if (o.userData.home) o.userData.home.position.copy(o.position);
      });
    // One informal capybara print for the home, independent of its inhabitant, on the wall the
    // manifest's wallArt names (position on the wall, front facing [sin(yaw), 0, cos(yaw)]).
    const wallArt = new THREE.Group();
    wallArt.position.fromArray(config.wallArt.position ?? [-3.15, 1.38, 0.2325]);
    wallArt.rotation.y = config.wallArt.yaw ?? Math.PI;
    world.add(wallArt);
    wallArt.add(mesh(new THREE.BoxGeometry(0.88, 0.88, 0.035), material(0xb68b59), [0, 0, 0.0175]));
    wallArt.add(mesh(new THREE.BoxGeometry(0.82, 0.82, 0.039), cream, [0, 0, 0.0235]));
    portraitMaterial = material(0xffffff, { roughness: 0.9, map: imageTexture(new URL(config.wallArt.file, manifestUrl).href) });
    const portrait = mesh(new THREE.PlaneGeometry(0.73, 0.73), portraitMaterial, [0, 0, 0.0465]);
    wallArt.add(portrait);
    portrait.name = "Capybara beach party print";
    portrait.userData.fixedMaterial = true;
    updateRecords();
  }

  // The bed keeps a made duvet until someone lies down in it, then shows the pillow and duvet
  // fitted to that avatar (bin/refresh_coastal_bedding.py). Only the made bed is static light.
  const beddings = [];
  // The onsen's vault stays in the sun's shadow map while the cutaway lifts it, so the bath is lit
  // through its light well (light-well.mjs). ?onsen-light=open restores the open cutaway sun there.
  const shadowOnly = own(new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false })),
    openOnsen = new URLSearchParams(location.search).get("onsen-light") === "open";
  let lightWell = null;
  // The glass front and terrace balustrade (glazing.mjs), and the two sliding doors, which stand
  // open in their rock jambs while the house is up by day and close at dusk.
  const glazing = own(createGlazing()),
    facadeDoors = [];
  let doorsPlaced = false;
  function syncFacadeDoors() {
    if (!routine || !daylight) return;
    const open = daylight.daylight > 0.3 && routine.id !== "sleep";
    for (const door of facadeDoors) door.target = open ? door.slideX : 0;
  }
  function stepFacadeDoors(delta, moving) {
    for (const door of facadeDoors) {
      if (!doorsPlaced || !moving) door.offset = door.target;
      // A heavy lift-and-slide panel: about two seconds from closed to stacked, no overshoot.
      else door.offset += (door.target - door.offset) * (1 - Math.exp(-delta * 2.4));
      if (Math.abs(door.target - door.offset) < 0.0005) door.offset = door.target;
      door.object.position.x = door.restX + door.offset;
    }
    doorsPlaced = facadeDoors.length > 0 && Boolean(routine && daylight);
  }

  // One wind for the coast (wind-field.mjs): the scene's active clock drives its gust fronts, the
  // Pacific minute its sea-breeze cycle, and the doors how much of it the house lets in. It moves with
  // the scene and holds still with it; an explicit change of time or motion recomposes it. The facade
  // curtains (curtain-rig.mjs) hang in it.
  let windCompose = true,
    curtainRig = null;
  function stepWind(moving) {
    if (!moving && !windCompose) return;
    windCompose = false;
    const minute = routine && !routine.live ? routine.minute : livePacificMinute(config?.timeZone);
    coastWind.update({ seconds: elapsed, minute, doors: curtainRig?.doorOpenFraction ?? 0 });
    syncOceanWind(coastWind.state);
  }
  const covers = new Map();
  function syncBedding() {
    const sleeper = container.dataset.animation === "sleep" && beddings.some((o) => o.userData.bedding === avatarId) ? avatarId : "empty";
    for (const object of beddings) object.visible = object.userData.bedding === sleeper;
  }
  // The visible sleeper's cover rises and falls around the chest; any other cover rests.
  function breatheBedding(moving, delta) {
    const chest = new THREE.Vector3();
    let found = false;
    for (const object of beddings) {
      if (object.userData.bedding === "empty") continue;
      object.traverse((mesh) => {
        if (!mesh.isMesh) return;
        if (!object.visible || !actor || reduced) return covers.get(mesh)?.reset();
        if (!moving) return;
        if (!covers.has(mesh)) covers.set(mesh, createDynamicCover(mesh));
        const cover = covers.get(mesh);
        if (!cover) return;
        if (!found) {
          // Between the spine joint and the shoulders: where a lying chest lifts the cover.
          const spine = new THREE.Vector3(),
            left = new THREE.Vector3(),
            right = new THREE.Vector3();
          actor.traverse((o) => {
            if (!o.isBone) return;
            const name = o.name.replaceAll(".", "");
            if (name === "Spine") o.getWorldPosition(spine);
            if (name === "ArmL") o.getWorldPosition(left);
            if (name === "ArmR") o.getWorldPosition(right);
          });
          chest.copy(left).add(right).multiplyScalar(0.5).lerp(spine, 0.4);
          found = true;
        }
        cover.update(mesh.worldToLocal(chest.clone()), breathAt(elapsed), delta);
      });
    }
  }

  function prepareModel(root, { outdoor = false } = {}) {
    root.traverse((o) => {
      if (o.isMesh) {
        o.castShadow = o.receiveShadow = true;
      }
      if (o.userData.renderStyle) o.visible = o.userData.renderStyle === style;
      if (o.userData.shadowOnly && o.isMesh) {
        o.visible = !openOnsen;
        o.material = shadowOnly;
        o.receiveShadow = false;
        o.frustumCulled = false;
        o.userData.fixedMaterial = o.userData.noOcclusion = o.userData.noContactOcclusion = o.userData.noVolumeDepth = true;
      }
      if (o.userData.bedding) {
        beddings.push(o);
        if (o.userData.bedding !== "empty") o.userData.dynamic = true;
      }
      if (o.isMesh && [o.material].flat().some((m) => m?.name === GLASS_NAME)) glaze(o, glazing);
      if (o.userData.facadeDoor) {
        facadeDoors.push({ object: o, id: o.userData.facadeDoor, slideX: o.userData.slideX, restX: o.position.x, offset: 0, target: 0 });
        o.traverse((part) => (part.userData.dynamic = true));
      }
    });
    syncBedding();
    syncFacadeDoors();
    art.apply(root, style);
    coastalWind?.bind(root);
    lightInstallations?.bindModel(root);
    root.traverse((o) => {
      if (!o.isMesh || o.userData.outline) return;
      for (const m of [o.material].flat()) {
        if (m === glazing) continue;
        staticLightField?.bindMaterial(m);
        // Outdoor-only models skip the indoor terms: no skin, light well or lamp ever reaches them,
        // and the smaller programs compile sooner.
        if (outdoor) continue;
        const handle = skinDiffusion?.bind(m, m.name === "Sirui shirt" ? { surface: true, enabled: false } : {});
        if (handle) m.userData.skinDiffusion = handle;
        lightWell?.bindMaterial(m);
        lightInstallations?.bindMaterial(m);
      }
    });
    return root;
  }

  async function loadRoom(id, step = null) {
    if (rooms.has(id)) return rooms.get(id);
    if (pendingRooms.has(id)) return pendingRooms.get(id);
    const entry = config.rooms.find((r) => r.id === id);
    if (!entry) return null;
    const furnished = furniture?.load(id);
    const pending = loadModel(new URL(entry.file, manifestUrl).href, step)
      .then(async (gltf) => {
        if (disposed) {
          release(gltf.scene);
          return null;
        }
        const root = prepareModel(gltf.scene);
        root.name = `room-${id}`;
        world.add(root);
        root.traverse((o) => {
          if (o.isMesh && o.name.startsWith("onsen_water")) {
            water = o;
            water.updateWorldMatrix(true, false);
            const pool = measurePoolGeometry(water, root),
              tint = [water.material].flat()[0];
            // The light reaching the stone crosses the same turquoise water the view does.
            onsenWater = createOnsenWater({
              ...pool,
              absorption: tint?.attenuationColor
                ? tint.attenuationColor.toArray().map((c) => -Math.log(Math.max(c, 1e-3)) / tint.attenuationDistance)
                : undefined,
            });
            // The basin's stone takes the hand's ripples as caustics (onsen-water.mjs).
            root.traverse((stone) => {
              if (stone.isMesh) for (const m of [stone.material].flat()) if (/warm cut stone/i.test(m?.name || "")) onsenWater.bindCausticReceiver(m);
            });
            prepareSteam(pool);
            const geometry = onsenWater.surfaceGeometry().applyMatrix4(water.matrixWorld.clone().invert());
            water.geometry.dispose();
            water.geometry = geometry;
            water.geometry.boundingSphere.radius += 0.035;
            for (const m of [water.material].flat()) {
              m.thickness = pool.depth;
              onsenWater.bindMaterial(m, water);
            }
            water.customDepthMaterial = own(new THREE.MeshDepthMaterial({ depthPacking: THREE.BasicDepthPacking, side: THREE.DoubleSide }));
            water.customDepthMaterial.colorWrite = false;
            onsenWater.bindMaterial(water.customDepthMaterial, water);
            // A transmissive interface must not cast an opaque shadow across
            // the bath floor or become an opaque normal-depth AO occluder.
            // Refractive caustics and transmitted shadow transport are omitted.
            water.castShadow = false;
            water.userData.noContactOcclusion = true;
          }
        });
        // The room's furniture joins it before its programs compile.
        await furniture?.attach(id, root, furnished);
        if (disposed) return null;
        // The arrival room compiles with the first composed view. Rooms streamed afterwards stay
        // hidden until their programs are ready, so the visible view keeps drawing meanwhile.
        if (firstFrameMilliseconds !== null) {
          root.visible = false;
          await compilePrograms();
          if (disposed) return null;
          root.visible = true;
        }
        rooms.set(id, root);
        cameraField?.addRoot(root);
        requestFrame();
        prepareStaticLight();
        return root;
      })
      .finally(() => pendingRooms.delete(id));
    pendingRooms.set(id, pending);
    return pending;
  }

  // The clifftop planting (bin/refresh_coastal_flora.py) is only seen from the coast, so it loads the
  // first time the visitor goes outside and appears once its programs are ready.
  let floraRequested = false;
  async function loadFlora() {
    if (floraRequested || !config.flora) return;
    floraRequested = true;
    try {
      const gltf = await loadModel(new URL(config.flora, manifestUrl).href);
      if (disposed) return release(gltf.scene);
      const root = prepareModel(gltf.scene, { outdoor: true });
      root.name = "clifftop-flora";
      // Foliage moves in the breeze, so it stays out of the static light field.
      root.traverse((o) => (o.userData.dynamic = true));
      root.visible = false;
      world.add(root);
      await compilePrograms();
      if (disposed) return;
      root.visible = true;
      requestFrame();
    } catch {
      // The coast still reads without its planting.
    }
  }

  // ── Hinterland (bin/build_coastal_hinterland.py) ──────────────────────────────────────────────
  // The land beyond the mainland's walls (the mesa and its canyons, both coasts, the lookout and
  // the gliderport) streams the first time the visitor goes outside or zooms out to the whole
  // house, and appears once its programs are ready, like the planting above. hinterland.mjs poses
  // the gliders from the scene clock, turns the gliderport's wind sock in the coast wind and extends
  // the camera's terrain grid over the new land.
  let hinterlandRequested = false,
    coastRoot = null;
  async function loadHinterland() {
    if (hinterlandRequested || !config.hinterland) return;
    hinterlandRequested = true;
    try {
      const [gltf, { bindHinterland }] = await Promise.all([
        loadModel(new URL(config.hinterland.file, manifestUrl).href),
        import("./hinterland.mjs"),
      ]);
      if (disposed) return release(gltf.scene);
      const root = prepareModel(gltf.scene, { outdoor: true });
      root.name = "coastal-hinterland";
      // Distant ground, planting and gliders stay out of the static light field.
      root.traverse((o) => (o.userData.dynamic = true));
      bindHinterland(root, config, physicalTime);
      root.visible = false;
      world.add(root);
      await compilePrograms();
      if (disposed) return;
      root.visible = true;
      // The coves beyond the mainland join the seabed under the sea once the GPU has read them.
      pacific?.quietSand(root);
      pacific?.captureSeabedAsync([coastRoot, root], () => requestFrame());
      requestFrame();
    } catch {
      // The house and its coast still read without the land around them.
    }
  }
  // ── end hinterland ─────────────────────────────────────────────────────────────────────────────

  function release(root) {
    art.forget(root);
    const skeletons = new Set();
    root.traverse((o) => {
      if (o.isSkinnedMesh && o.skeleton) skeletons.add(o.skeleton);
      if (!o.isMesh || o.userData.outline) return;
      o.geometry.dispose();
      resources.delete(o.geometry);
      const materials = [o.userData.baseMaterial || o.material, ...Object.values(o.userData.styleMaterials || {})].flat();
      new Set(materials).forEach((m) => {
        m.dispose();
        resources.delete(m);
      });
      o.userData.inkOutline?.material.dispose();
    });
    skeletons.forEach((skeleton) => skeleton.dispose());
    root.removeFromParent();
  }

  async function setAvatar(id, step = null) {
    if (!config) return;
    const entry = config.avatars.find((a) => a.id === id) || config.avatars[0];
    const ticket = ++avatarTicket;
    ui.setAttribute("aria-busy", "true");
    try {
      const gltf = await loadModel(new URL(entry.file, manifestUrl).href, step);
      if (disposed || ticket !== avatarTicket) {
        release(gltf.scene);
        return;
      }
      if (actor) {
        poolStroke?.reset();
        characterPerformance?.dispose();
        mixer.stopAllAction();
        mixer.uncacheRoot(actor);
        release(actor);
      }
      actor = prepareModel(gltf.scene);
      actor.name = "active-Sirui";
      activeGripOffsets = entry.gripWristOffsets;
      footContacts = createFootContacts(actor, config.terrain);
      handContacts = createHandContacts(actor);
      liftRig = createLiftRig(actor);
      liftActive = false;
      poolStroke = createPoolStroke(actor);
      characterPerformance = createCharacterPerformance(actor, entry.id);
      world.add(actor);
      mixer = new THREE.AnimationMixer(actor);
      actions = new Map(gltf.animations.map((clip) => [clip.name, mixer.clipAction(clip)]));
      currentAction = null;
      selectedProp = null;
      avatarId = entry.id;
      container.dataset.avatar = avatarId;
      syncBedding();
      remember("sirui-scene-avatar", avatarId);
      ui.querySelector("[data-world-avatar]").value = avatarId;
      updateRoutine(true);
    } catch (error) {
      if (disposed) return;
      status.textContent = "This character couldn’t load. Try another.";
      ui.querySelector("[data-world-avatar]").value = avatarId;
      if (!actor) throw error;
    } finally {
      if (ticket === avatarTicket) ui.removeAttribute("aria-busy");
    }
  }

  function playClip(name) {
    characterPerformance?.restore();
    const next = actions?.get(name) || actions?.get("idle");
    if (!next || next === currentAction) return;
    next
      .reset()
      .setEffectiveWeight(1)
      .setEffectiveTimeScale(name === "walk" ? 3.6 : 1)
      .play();
    if (reduced || paused) {
      const stillTimes = { typing: 1, reading: 1.5, eat: 1.7, drink: 1.8, workout: 1.3, soak: 1, lounge: 1.5, sleep: 1 };
      next.time = stillTimes[name] || 0;
    }
    if (currentAction) {
      if (reduced || paused) currentAction.stop();
      else next.crossFadeFrom(currentAction, /pullup|dip/.test(name) || /pullup|dip/.test(container.dataset.animation) ? 1.2 : 0.45, false);
    }
    currentAction = next;
    container.dataset.animation = name;
    syncBedding();
  }

  function propFor(kind) {
    propHand = null;
    if (selectedProp) {
      release(selectedProp);
      selectedProp = null;
    }
    container.dataset.prop = kind || "none";
    if (!kind || !actor) return;
    let hand;
    actor.traverse((o) => {
      if (o.isBone && o.name === "HandR") hand = o;
    });
    if (!hand)
      actor.traverse((o) => {
        if (o.isBone && /Hand[._]?R$/.test(o.name)) hand = o;
      });
    if (!hand) return;
    const group = new THREE.Group();
    const put = (g, m, p = [0, 0, 0]) => {
      const o = new THREE.Mesh(g, m);
      o.position.set(...p);
      group.add(o);
      return o;
    };
    if (kind === "dumbbell") {
      put(new THREE.CylinderGeometry(0.018, 0.018, 0.25, 12), material(0x82877e)).rotation.z = Math.PI / 2;
      [-0.11, 0.11].forEach((x) => {
        put(new THREE.CylinderGeometry(0.078, 0.078, 0.055, 18), material(0x333a38), [x, 0, 0]).rotation.z = Math.PI / 2;
      });
    } else if (kind === "book") {
      const cover = material(0x7b955d),
        pages = material(0xfff1d5);
      for (const side of [-1, 1]) {
        const half = put(new THREE.BoxGeometry(0.15, 0.018, 0.23), cover, [-0.14 + side * 0.075, 0, 0]);
        half.rotation.z = side * 0.12;
        const paper = put(new THREE.BoxGeometry(0.14, 0.018, 0.215), pages, [-0.14 + side * 0.075, 0.012, 0]);
        paper.rotation.z = side * 0.12;
      }
    } else if (kind === "fork") {
      put(new THREE.BoxGeometry(0.012, 0.14, 0.012), material(0xbdc1b2));
      put(new THREE.SphereGeometry(0.031, 12, 8), material(0xc4893c), [0, 0.075, 0]);
    } else if (kind === "cocktail") {
      const glass = material(0xf2eee0, { transparent: true, opacity: 0.55, roughness: 0.12 });
      put(new THREE.CylinderGeometry(0.06, 0.012, 0.07, 24), glass, [0, 0.07, 0]);
      put(new THREE.CylinderGeometry(0.047, 0.01, 0.047, 24), material(0xd79543), [0, 0.062, 0]);
      put(new THREE.CylinderGeometry(0.007, 0.007, 0.07, 12), glass, [0, 0, 0]);
      put(new THREE.CylinderGeometry(0.038, 0.038, 0.008, 20), glass, [0, -0.04, 0]);
      const peel = put(new THREE.TorusGeometry(0.027, 0.006, 6, 12, Math.PI), material(0xedb746), [0.043, 0.11, 0]);
      peel.rotation.y = Math.PI / 2;
    } else {
      const coffee = kind === "coffee";
      const height = kind === "beer" ? 0.18 : coffee ? 0.14 : 0.12;
      put(
        new THREE.CylinderGeometry(coffee ? 0.072 : 0.06, coffee ? 0.063 : 0.05, height, 24),
        material(coffee ? 0xf1e8cb : 0xcda56a, { transparent: !coffee, opacity: coffee ? 1 : 0.68 })
      );
      put(new THREE.CylinderGeometry(coffee ? 0.062 : 0.05, coffee ? 0.062 : 0.05, 0.008, 24), material(coffee ? 0x4b2c1f : 0xba7627), [
        0,
        height / 2,
        0,
      ]);
      if (kind === "beer") put(new THREE.CylinderGeometry(0.046, 0.046, 0.026, 24), material(0xf4e6bc), [0, height / 2 - 0.009, 0]);
      if (kind === "whiskey") {
        const ice = material(0xe0eff1, { transparent: true, opacity: 0.64, roughness: 0.1 });
        put(new THREE.BoxGeometry(0.027, 0.026, 0.026), ice, [-0.016, 0.057, 0.009]).rotation.y = 0.6;
        put(new THREE.BoxGeometry(0.025, 0.025, 0.025), ice, [0.016, 0.06, -0.009]);
      }
      if (coffee) {
        const handle = put(new THREE.TorusGeometry(0.039, 0.01, 8, 16), material(0xf1e8cb), [0.075, 0, 0]);
        handle.rotation.y = Math.PI / 2;
      }
    }
    group.position.set(0, 0.035, -0.025);
    hand.add(group);
    selectedProp = group;
    propHand = hand;
    group.userData.kind = kind;
    art.apply(group, style);
    container.dataset.prop = kind;
  }

  const propRotation = new THREE.Quaternion(),
    propWorldRotation = new THREE.Quaternion(),
    propOffset = new THREE.Vector3(),
    vertical = new THREE.Vector3(0, 1, 0);
  function orientProp() {
    if (!selectedProp || !propHand || selectedProp.userData.kind === "dumbbell") return;
    // A wrist bone's Y axis points down the hand. Keep a carried cup upright,
    // then tip it toward the mouth near the top of the authored sipping arc.
    const nearMouth = Math.max(0, Math.min(1, (currentAction?.time || 0) / 4));
    const sip = routine?.clip === "drink" ? (1 - Math.cos(nearMouth * Math.PI * 2)) * 0.2 : 0;
    propWorldRotation.setFromEuler(new THREE.Euler(selectedProp.userData.kind === "book" ? 0.5 : -sip, actor.rotation.y, 0, "YXZ"));
    propHand.getWorldQuaternion(propRotation).invert();
    // The stylized closed hand is wider than a human grip. Seat the object
    // beyond the fingers so its cup/book surface is not buried in the fist.
    propOffset
      .set(0, selectedProp.userData.kind === "book" ? 0 : -0.025, 0.07)
      .applyAxisAngle(vertical, actor.rotation.y)
      .applyQuaternion(propRotation);
    selectedProp.position.set(0, 0.035, -0.025).add(propOffset);
    selectedProp.quaternion.copy(propRotation.multiply(propWorldRotation));
  }

  // The key light follows the sky (atmosphere.mjs): the sun through the coast's air, gold and dim
  // when low, or once its light is gone the moon at its true place and phase.
  const keyColor = new THREE.Color();
  function updateLight() {
    if (!routine) return;
    daylight = coastalDaylight(routine.dateKey, routine.minute);
    const evening = daylight.daylight < 0.15;
    // A live clock lets the stars turn with the page clock between minutes (stars.mjs).
    pacific?.setPalette(routine.palette, { ...daylight, live: Boolean(routine.live) });
    const sky = style === "realistic" ? pacific?.sky?.() : null;
    if (sky) {
      const moonKey = sky.light.moonLuminance > sky.light.sunLuminance,
        color = moonKey ? sky.light.moonColor : sky.light.sunColor,
        luminance = 0.2126 * color[0] + 0.7152 * color[1] + 0.0722 * color[2],
        direction = moonKey ? sky.moonDirection : sky.sun;
      keyColor.fromArray(color.map((v) => v / Math.max(luminance, 1e-6)));
      sun.color.copy(keyColor);
      sun.intensity = luminance;
      // A grazing key would skim the shadow map; a sun under 1.7 degrees casts from there.
      sunDirection.set(direction[0], Math.max(direction[1], 0.03), direction[2]).normalize();
      // Before the probe field is baked, the hemisphere light carries the sky's irradiance.
      const colors = pacific.lightColors();
      hemi.color.fromArray(colors.zenith.map((v, k) => (v + colors.horizon[k]) * 0.5 * Math.PI));
      hemi.groundColor.fromArray(colors.ground.map((v) => v * Math.PI));
      hemi.intensity = 1;
    } else {
      hemi.color.set(evening ? 0x97b2dc : 0xffead1);
      hemi.groundColor.set(evening ? 0x473426 : 0x8b7659);
      hemi.intensity = style === "realistic" ? (evening ? 0.65 : 0.62) : 1.5;
      sun.color.set(style === "illustrated" ? (evening ? 0xc7a1ef : 0xffc773) : evening ? 0xb6c4f1 : 0xffe2b0);
      sun.intensity = style === "realistic" ? 0.18 + daylight.sunlight * 2.35 : evening ? 1.05 : 2.5;
      sunDirection.fromArray(daylight.keyDirection).normalize();
    }
    fitSunShadow(true);
    warmPracticals?.update(daylight.daylight, { ...routine, schedule: routine.weekend ? config.weekend : config.weekday });
    lightInstallations?.update({ minute: routine.minute, daylight: daylight.daylight, activity: routine.id });
    syncFacadeDoors();
    if (staticLightField && pacific) {
      const colors = pacific.lightColors();
      staticLightField.setLighting({
        zenith: colors.zenith,
        horizon: colors.horizon,
        ground: sky ? colors.ground : hemi.groundColor.clone().multiplyScalar(hemi.intensity).toArray(),
        practicalPowers: warmPracticals.lights.map((light) => light.intensity),
      });
    }
    if (steamVolume) {
      const ambient = new THREE.Color()
          .fromArray(pacific.lightColors().horizon)
          .multiplyScalar(0.6)
          .add(hemi.color.clone().multiplyScalar(hemi.intensity * 0.15))
          .add(hemi.groundColor.clone().multiplyScalar(hemi.intensity * 0.05)),
        midpoint = new THREE.Vector3(onsenWater.uniforms.poolCenter.value.x, onsenWater.surfaceY + 0.18, onsenWater.uniforms.poolCenter.value.y);
      for (const light of warmPracticals.lights) {
        const distance = Math.max(0.2, light.position.distanceTo(midpoint)),
          falloff = Math.max(0, 1 - (distance / light.distance) ** 4) ** 2;
        ambient.add(light.color.clone().multiplyScalar((light.intensity * falloff * 0.35) / (distance * distance * 4 * Math.PI)));
      }
      // The pool light glows up through the vapour it sits under.
      if (lightInstallations) ambient.add(lightInstallations.irradianceAt(midpoint).multiplyScalar(0.35 / (4 * Math.PI)));
      steamVolume.setLighting({
        ambient: ambient.toArray(),
        directional: sun.color.clone().multiplyScalar(sun.intensity).toArray(),
        direction: sunDirection.toArray(),
      });
    }
    if (lightWell && pacific) {
      const sky = pacific.lightColors();
      lightWell.setSun(
        daylight.keyDirection,
        sun.color
          .clone()
          .multiplyScalar(daylight.sunlight > 0 ? sun.intensity : 0)
          .toArray(),
        sky.zenith.map((value, k) => (value + sky.horizon[k]) / 2)
      );
    }
    container.dataset.scenePalette = routine.palette;
  }

  function prepareSteam(pool) {
    const start = performance.now(),
      padding = pool.radius + 0.1,
      field = createSteamDensity({
        grid: [18, 18, 18],
        center: pool.center,
        radius: pool.radius,
        surfaceY: pool.surfaceY,
        bounds: {
          min: [pool.center[0] - padding, pool.surfaceY, pool.center[1] - padding],
          max: [pool.center[0] + padding, pool.surfaceY + 0.72, pool.center[1] + padding],
        },
      });
    steamVolume = createSteamVolume(field, { extinction: 0.7 });
    steamVolume.object.visible = false;
    scene.add(steamVolume.object);
    // The camera looks into the steam, never from inside it.
    cameraField?.addSolid(
      [pool.center[0] - padding, pool.surfaceY - 0.05, pool.center[1] - padding],
      [pool.center[0] + padding, pool.surfaceY + 0.72, pool.center[1] + padding]
    );
    if (lightWell) steamVolume.setWell(config.lightWell);
    lightWell?.setPool(pool.center, pool.radius, pool.surfaceY);
    lightInstallations?.setPool(pool.center, pool.radius, pool.surfaceY, pool.depth);
    // The steam and the light well's dust beam share one opaque-depth capture.
    finish.setVolume({
      object: {
        get visible() {
          return steamVolume.object.visible || Boolean(lightWell?.object.visible);
        },
      },
      setDepth(opaque, transmission, camera) {
        steamVolume.setDepth(opaque, transmission, camera);
        lightWell?.setDepth(opaque, camera);
      },
    });
    // Prepare a mature static composition one short task at a time. This
    // setup never increments the visitor's animation clock or owns a RAF.
    field.prewarmAsync(6, { yieldTask: () => new Promise((resolve) => setTimeout(resolve, 0)), shouldContinue: () => !disposed }).then((complete) => {
      if (!complete || disposed) return;
      steamReady = true;
      steamSetupMilliseconds = performance.now() - start;
      steamVolume.sync();
      updateLight();
      requestFrame();
    });
  }

  function prepareStaticLight() {
    if (!staticLightField || lightBakeStarted || rooms.size !== config.rooms.length || disposed) return;
    lightBakeStarted = true;
    staticLightField.addRoot(world, { id: "coastal-house" });
    staticLightField.addRoot(warmPracticals.root, { id: "warm-fixtures" });
    staticLightField
      .bake({ signal: lightBakeAbort.signal, yieldTask: () => new Promise((resolve) => setTimeout(resolve, 0)) })
      .then(() => {
        if (disposed) return;
        updateLight();
        requestFrame();
      })
      .catch((error) => {
        if (disposed || error.name === "AbortError") return;
        // Retain native indirect light when the bounded component cannot bake.
        lightBakeError = error.message;
        requestFrame();
      });
  }

  function wardrobe() {
    if (!actor) return;
    actor.traverse((o) => {
      if (!o.isMesh || o.userData.outline) return;
      const base = [o.userData.baseMaterial || o.material].flat();
      [o.material].flat().forEach((m) => {
        if (m.name !== "Sirui shirt") return;
        // Keep the existing garment opaque in the bath. Privacy cannot depend
        // on animated steam or the particular viewing angle.
        if (routine?.id === "soak") m.color.set(0x5d8078);
        else m.color.copy(base.find((b) => b.name === "Sirui shirt").color);
        if (m.isMeshStandardMaterial) m.roughness = routine?.id === "soak" ? 0.96 : 0.9;
        m.userData.skinDiffusion?.setEnabled(false);
      });
    });
  }

  function garmentEvidence() {
    const materials = [];
    actor?.traverse((o) => {
      if (!o.isMesh || o.userData.outline) return;
      for (const m of [o.material].flat())
        if (m.name === "Sirui shirt")
          materials.push({
            color: m.color.getHex(),
            opacity: m.opacity,
            transparent: m.transparent,
            roughness: m.roughness,
            skinDiffusion: m.userData.skinDiffusion?.enabled || false,
          });
    });
    return { kind: routine?.id === "soak" ? "opaque spa textile" : "authored shirt", materials };
  }

  function resumeRoutine() {
    // Preserve an unchanged performance or journey. A new clock activity
    // composes on return instead of rerouting from an obsolete destination.
    updateRoutine(false, true);
  }

  // Where today's training session stands. The live clock reads the real second (the minute is
  // refreshed once a second); a preview runs on from the chosen minute while the scene animates.
  function trainingSession() {
    const t = routine?.training;
    if (!t?.plan) return null;
    let seconds;
    if (labSession) seconds = labSession.seconds + (elapsed - labSession.start);
    else if (routine.live) {
      const now = Date.now(),
        second = Math.floor(now / 1000);
      if (second !== sessionClock.second) sessionClock = { second, minute: pacificClock(new Date(now), config.timeZone).minute };
      seconds = (sessionClock.minute - t.window[0]) * 60 + (second % 60) + (now % 1000) / 1000;
    } else seconds = (t.minute - t.window[0]) * 60 + (elapsed - sequenceStart);
    return { ...t, state: sessionState(t.timeline, seconds) };
  }
  // What the whiteboard shows: the session as it stands, or today's plan (or a rest day).
  function boardInfo() {
    if (!config?.training || !routine) return null;
    if (routine.training?.plan) return trainingSession();
    return trainingAt(config.training, routine.dateKey, routine.minute);
  }

  function updateRoutine(force = false, composeOnChange = false) {
    if (!config) return;
    const next = resolveRoutine(config, new Date(), explore.preview);
    // Scrubbing the preview clock within a session restarts it from the chosen minute.
    if (routine && next.sequence === "session" && !next.live && routine.minute !== next.minute) sequenceStart = elapsed;
    if (gymProps && config.training) queueMicrotask(() => gymProps?.drawBoard(boardInfo()));
    const changed = !routine || routine.id !== next.id || routine.prop !== next.prop || routine.clip !== next.clip;
    const compose = force || (composeOnChange && changed);
    // A deliberate change of time, activity or motion recomposes the wind, even in a still.
    if (force || changed || routine?.live !== next.live) windCompose = true;
    routine = next;
    clockLabel.textContent = `${routine.live ? "" : "Preview · "}${formatMinute(routine.minute)} · La Jolla`;
    ui.querySelector("[data-world-now]").setAttribute("aria-pressed", String(explore.following && followClock));
    if (container.dataset.sceneState === "ready") status.textContent = routine.label;
    container.dataset.activity = routine.id;
    container.dataset.clockMode = routine.live ? "now" : "preview";
    ui.querySelector("[data-world-time]").value = routine.minute;
    ui.querySelector("[data-world-activity]").value = routine.id;
    updateLight();
    wardrobe();
    if ((changed || force) && actor) {
      poolStroke?.reset();
      sequenceStart = elapsed;
      sequencePose = null;
      const room = config.rooms.find((r) => r.id === routine.room);
      const goal = new THREE.Vector3(...room.actor);
      loadRoom(room.id).catch(() => {
        if (!disposed) status.textContent = "Room detail unavailable. You can still explore.";
      });
      if (actorGoal && !compose && actor.position.distanceTo(goal) > 0.5 && !reduced && !paused && visible && inViewport) {
        const priorRoom = config.rooms.find((r) => actorGoal && new THREE.Vector3(...r.actor).distanceTo(actorGoal) < 0.1);
        const route = roomRoute(config, priorRoom, room, actor.position.toArray());
        travel = {
          route,
          // Start between rendered frames without counting time before this
          // routine changed as part of the new walk.
          start: elapsed + (lastFrame ? Math.max(0, (performance.now() - lastFrame) / 1000) : 0),
          duration: Math.max(2.5, route.length / 1.5),
          goal,
          facing: room.facing,
        };
        propFor(null);
        playClip("walk");
      } else {
        travel = null;
        actor.position.copy(goal);
        actor.rotation.y = room.facing;
        playClip(routine.clip);
        propFor(routine.prop);
      }
      actorGoal = goal;
      if (explore.following && followClock) setRoom(room.id, false);
    }
    // An unchanged clip evaluation would erase the paused wrist correction.
    if ((reduced || paused) && (changed || force)) mixer?.update(0);
    requestFrame();
  }

  function updateRecords() {
    container.dataset.activeDeskRecord = String(currentRecord);
    container.dataset.recordSpinning = String(spinning);
    container.dataset.droppedRecords = dropped.join(",");
    sleeves.forEach((s, i) => {
      s.visible = !dropped.includes(i);
    });
    floorCards.forEach((o) => {
      const p = picks.indexOf(o);
      if (p >= 0) picks.splice(p, 1);
      release(o);
    });
    floorCards.length = 0;
    dropped.forEach((index, i) => {
      const face = material(0xffffff, { map: imageTexture(records[index].cover) });
      const drop = deskLayout().desk.drop;
      const card = mesh(
        new THREE.BoxGeometry(0.36, 0.43, 0.012),
        [material(0xece1c7), face, face, face, face, face],
        drop
          ? drop.origin.map((v, k) => v + i * drop.step[k] + (i % 2) * (drop.alternate?.[k] || 0))
          : roomPoint("study", [-0.82 + i * 0.42, 0.024 + i * 0.002, -0.2 + (i % 2) * 0.09]),
        { type: "source", index }
      );
      card.rotation.set(-Math.PI / 2, 0, (i - 1.5) * 0.14);
      floorCards.push(card);
    });
    requestFrame();
  }

  function transferVinylRecord(pose) {
    if (pendingVinylRecord === null || !vinylLabel) return;
    if (spinning && !reduced && pose.lift <= 0.44) return;
    const next = pendingVinylRecord,
      texture = imageTexture(records[next].src);
    if (!texture.userData.ready && !texture.userData.failed) return;
    if (texture.userData.ready) {
      vinylLabel.material.map = texture;
      vinylLabel.material.needsUpdate = true;
      displayedVinylRecord = next;
      vinylTransfer = { ...pose, index: next };
    }
    pendingVinylRecord = null;
    recordMotion.completeCue();
  }

  function clearFocus() {
    if (focused?.userData.home) {
      const home = focused.userData.home;
      focused.position.copy(home.position);
      focused.rotation.copy(home.rotation);
      focused.scale.copy(home.scale);
    }
    focused = null;
    animalFocus = null;
    container.removeAttribute("data-focused-desk-object");
    container.removeAttribute("data-coastal-neighbour");
    container.dataset.deskView = currentRoom === "outside" ? "outside" : "room";
    renderer?.domElement.setAttribute("aria-label", CANVAS_LABEL);
  }

  function inspectNeighbour(id) {
    const neighbour = pacific?.neighbours().find((item) => item.id === id);
    if (!neighbour) return;
    if (animalFocus?.id === id) {
      setRoom("outside");
      return;
    }
    if (currentRoom !== "outside") setRoom("outside");
    clearFocus();
    inertia.stop();
    animalFocus = neighbour;
    explore.explore();
    followClock = false;
    desiredTarget.fromArray(neighbour.worldCenter);
    desiredRadius = Math.max(2.6, neighbour.radius * 3.6);
    const front = neighbour.front || [0, 0, -1];
    yaw = Math.atan2(front[0], front[2]) + 0.4;
    pitch = neighbour.id.startsWith("rabbit-") ? 0.46 : 0.2;
    {
      // Choose a readable initial angle through the actual coast. This runs
      // only on selection; orbiting and tracking never raycast the whole coast.
      const selectionStarted = performance.now();
      // Streamed wildlife and P materials arrive outside the house finish
      // binding. Bind their authored shaders before a close contact view;
      // the binder leaves already-bound house materials unchanged.
      scene.traverse((object) => {
        if (!object.isMesh || object.userData.noContactOcclusion) return;
        for (const material of [object.material].flat()) {
          if (!material) continue;
          bindContactLighting(material, finish?.contactLighting);
          staticLightField?.bindMaterial(material);
        }
      });
      // A burst of selections can precede the first exterior frame. Score
      // against the final cutaway now, not the preceding inside roof state.
      syncCutaway();
      scene.updateMatrixWorld(true);
      const occluders = [];
      // Wildlife and P are sibling scene roots, outside the house group.
      // They must remain legitimate occluders of another selected animal.
      scene.traverse((object) => {
        if (!object.isMesh || object.userData.noOcclusion) return;
        let parent = object;
        while (parent) {
          if (!parent.visible || parent === neighbour.root) return;
          parent = parent.parent;
        }
        const materials = Array.isArray(object.material) ? object.material : [object.material];
        if (materials.some((mat) => mat && (!mat.transparent || mat.opacity > 0.9))) occluders.push(object);
      });
      const visibilityRay = new THREE.Raycaster(),
        origin = new THREE.Vector3(),
        direction = new THREE.Vector3(),
        head = new THREE.Vector3(...(neighbour.eyeAnchor || neighbour.headAnchor || neighbour.worldCenter));
      if (!neighbour.eyeAnchor) head.y += neighbour.radius * 0.12;
      const samples = (neighbour.faceAnchors?.length ? neighbour.faceAnchors : [head.toArray()]).map((point) => new THREE.Vector3(...point));
      samples.push(desiredTarget.clone());
      const facing = Math.atan2(front[0], front[2]);
      let best = -Infinity,
        rays = 0,
        selectedVisibility = null;
      const elevations = neighbour.id.startsWith("rabbit-") ? [0.46, 0.72] : [0.2, 0.4];
      // Include the actual frontal gap. Side-only candidates missed a narrow
      // clear opening in the authored scrub even after a full orbit found it.
      const candidates = [],
        arrivalBounds = new THREE.Box3();
      samples.forEach((point) => arrivalBounds.expandByPoint(point));
      // The balcony bird faces inland. Its front semicircle lies above the
      // cliff or behind the house; retain Pacific-side and rear arrivals too.
      for (const offset of [0, 0.4, -0.4, 0.85, -0.85, 1.25, -1.25, 1.7, -1.7, 2.3, -2.3, Math.PI]) {
        for (const elevation of elevations) {
          const angle = facing + offset;
          const position = new THREE.Vector3(
            desiredTarget.x + Math.sin(angle) * Math.cos(elevation) * desiredRadius,
            desiredTarget.y + Math.sin(elevation) * desiredRadius,
            desiredTarget.z + Math.cos(angle) * Math.cos(elevation) * desiredRadius
          );
          keepCameraClear(position, config, neighbour.id === "balcony-gull-0" ? "study" : "outside");
          candidates.push({ offset, elevation, angle, position });
          arrivalBounds.expandByPoint(position);
        }
      }
      const region = createOcclusionRegion(occluders, arrivalBounds.expandByScalar(0.05));
      try {
        for (const { offset, elevation, angle, position } of candidates) {
          origin.copy(position);
          // A clear camera lifted onto the cliff can make the animal tiny.
          // Prefer a nearby side angle over that distant overhead composition.
          let score =
            -Math.abs(offset) * 0.02 -
            Math.abs(elevation - elevations[0]) * 0.01 -
            Math.max(0, origin.distanceTo(desiredTarget) / desiredRadius - 1) * 2;
          let visibleFaceSamples = 0,
            visibleBody = false;
          samples.forEach((point, i) => {
            direction.copy(point).sub(origin);
            visibilityRay.far = Math.max(0.01, direction.length() - 0.05);
            visibilityRay.set(origin, direction.normalize());
            rays++;
            if (!visibilityRay.intersectObjects(region.objects, false).length) {
              score += i < samples.length - 1 ? 3 / (samples.length - 1) : 1;
              if (i < samples.length - 1) visibleFaceSamples++;
              else visibleBody = true;
            }
          });
          if (score > best) {
            best = score;
            yaw = angle;
            pitch = elevation;
            selectedVisibility = { visibleFaceSamples, faceSamples: samples.length - 1, visibleBody };
          }
          // Prefer the first readable nearby arrival over marginal scoring
          // differences. Repeated full-coast traversals otherwise stall input.
          if (visibleFaceSamples === samples.length - 1 && visibleBody && origin.distanceTo(desiredTarget) <= desiredRadius * 1.12) break;
        }
      } finally {
        region.dispose();
      }
      animalFocus.arrival = { ...selectedVisibility, rays, ...region.evidence, milliseconds: performance.now() - selectionStarted };
    }
    container.dataset.coastalNeighbour = neighbour.id;
    renderer.domElement.setAttribute(
      "aria-label",
      `${neighbour.name}. Drag or use arrow keys to look around, plus and minus to zoom, N for the next coastal neighbour, Enter for the coastline, Escape to return inside.`
    );
    requestFrame();
  }

  function nextNeighbour() {
    const neighbours = pacific?.neighbours() || [];
    if (!neighbours.length) return;
    const index = neighbours.findIndex((item) => item.id === animalFocus?.id);
    inspectNeighbour(neighbours[(index + 1) % neighbours.length].id);
  }

  // Visitors can lean in closer than the authored framings (Sirui, 2026-10-14): the zoom-in limit is
  // about half the authored one, never nearer than 1.6 m in a room, 7 m for the house or 10 m outside.
  const nearerEnvelopes = new WeakMap();
  // The authoring lab (?scene-lab=1) can place the camera anywhere for close inspection.
  let labFreeCamera = false;
  // The gym camera works like a tripod in the corner (camera.mjs tripodLook): from each arrival
  // until the visitor orbits, pans or zooms, it keeps the authored position and turns to the station
  // Sirui is working at, because the lifts span more of the room than one fixed frame holds.
  let stationLook = false;
  const lookBones = { actor: null, bones: [] },
    lookBox = new THREE.Box3(),
    lookPoint = new THREE.Vector3();
  function followStation() {
    if (currentRoom !== "gym" || labFreeCamera || animalFocus || travel || !actor || routine?.sequence !== "session" || !sequencePose) return;
    if (lookBones.actor !== actor) {
      lookBones.actor = actor;
      lookBones.bones = [];
      actor.traverse((o) => o.isBone && /^(Head|HandL|HandR|FootL|FootR)$/.test(o.name) && lookBones.bones.push(o));
    }
    if (!lookBones.bones.length) return;
    lookBox.makeEmpty();
    for (const bone of lookBones.bones) lookBox.expandByPoint(bone.getWorldPosition(lookPoint));
    lookBox.getCenter(lookPoint);
    const room = config.rooms.find((r) => r.id === "gym");
    if (!room?.camera) return;
    const look = constrainOrbit(tripodLook({ target: room.target, ...room.camera }, lookPoint.toArray()), cameraEnvelope());
    desiredTarget.copy(lookPoint);
    // Unwrapped next to the current yaw, so the turn takes the short way round.
    yaw += Math.atan2(Math.sin(look.yaw - yaw), Math.cos(look.yaw - yaw));
    pitch = look.pitch;
    desiredRadius = look.radius;
  }
  const labSettings = { reflection: true };
  // A room's authored envelope frames its arrival. Once the collision field is ready the orbit
  // opens (October 15): free yaw, pitch from slightly below eye level to nearly overhead, and
  // half as far again as the authored framing, with walls, screens, furniture and rock ending
  // the orbit instead of a hand-set arc. Every room gets this, including ones added later; a room
  // can bound it with camera.explore ({ yaw, pitch, radius }).
  const exploringEnvelopes = new WeakMap();
  function cameraEnvelope() {
    if (labFreeCamera) return null;
    if (animalFocus) return wildlifeEnvelope(animalFocus.radius);
    const authored = envelopeFor(config, currentRoom);
    if (!authored) return authored;
    let envelope = nearerEnvelopes.get(authored);
    if (!envelope) {
      const [scale, floor] = currentRoom === "outside" ? [0.5, 10] : currentRoom === "overview" ? [0.7, 7] : [0.55, 1.6];
      const near = Math.min(authored.radius[0], Math.max(floor, authored.radius[0] * scale));
      envelope = { ...authored, radius: [near, authored.radius[1]] };
      nearerEnvelopes.set(authored, envelope);
    }
    if (currentRoom === "outside" || currentRoom === "overview" || !cameraField?.ready) return envelope;
    let open = exploringEnvelopes.get(envelope);
    if (!open) {
      const camera = config.rooms.find((r) => r.id === currentRoom)?.camera || {},
        bound = camera.explore || {};
      open = {
        ...envelope,
        yaw: bound.yaw || null,
        pitch: [Math.min(envelope.pitch[0], bound.pitch?.[0] ?? -0.12), Math.max(envelope.pitch[1], bound.pitch?.[1] ?? 1.25)],
        radius: [envelope.radius[0], Math.max(envelope.radius[1], bound.radius?.[1] ?? (camera.radius || envelope.radius[1]) * 1.5)],
      };
      exploringEnvelopes.set(envelope, open);
    }
    return open;
  }

  // The spring arm runs in rooms (the visible path to the target, against the collision field and
  // then the terrain) and the whole house (only somewhere in open air to stand: its target sits
  // behind interior partitions the view is meant to look across). Outside, the camera rides over
  // the terrain instead (a terrace target hidden by the cliff would otherwise pull it into the
  // terrace). The collision field itself is built by camera-field.mjs as the models load.
  let cameraField = null;
  const armActive = () => !labFreeCamera && !animalFocus && currentRoom !== "outside" && Boolean(config) && !walkMode?.active;
  const armReady = () => (currentRoom === "overview" ? Boolean(config?.cameraCollision) : Boolean(cameraField?.ready));
  const targetPoint = [0, 0, 0];
  function armFor(at, orbitYaw, orbitPitch, length) {
    return cameraArm(cameraField?.grid, config.cameraCollision, at, orbitYaw, orbitPitch, length, {
      footprint: cameraField?.footprint,
      stand: currentRoom === "overview",
    });
  }
  // The shortest arm a visitor can steer into: a view pressed closer than this to its target
  // (behind a screen, against the back wall, wedged behind the kitchen island) stops the orbit
  // instead. It scales with the requested distance, so a wide view never collapses to a close-up.
  function minimumArm() {
    const near = cameraEnvelope()?.radius?.[0] ?? 1.6;
    const floor = currentRoom === "overview" ? near * 0.75 : Math.max(1.15, near * 0.6);
    return Math.min(desiredRadius * 0.95, Math.max(floor, desiredRadius * 0.4));
  }
  const cameraDistance = () => (armShown === null ? radius : Math.min(radius, armShown));

  // Orbit input from drags, keys and coasting. Envelope edges cushion a drag; collision steering
  // keeps the requested view on the visible side of walls, slabs, screens and rock. Returns which
  // axes stopped, so coasting halts against them.
  function orbitBy(dYaw, dPitch, { cushioned = true } = {}) {
    stationLook = false;
    const envelope = cameraEnvelope();
    const fromYaw = yaw,
      fromPitch = pitch;
    let nextYaw = cushioned && envelope?.yaw ? cushion(yaw, dYaw, envelope.yaw) : yaw + dYaw,
      nextPitch = cushioned && envelope?.pitch ? cushion(pitch, dPitch, envelope.pitch) : pitch + dPitch;
    if (envelope) {
      const constrained = constrainOrbit({ yaw: nextYaw, pitch: nextPitch, radius: desiredRadius }, envelope);
      // Keep an unwrapped exterior yaw (the full orbit accumulates turns).
      nextYaw = envelope.yaw ? constrained.yaw : nextYaw;
      nextPitch = constrained.pitch;
    }
    let blocked = false;
    if (armActive() && armReady() && (nextYaw !== fromYaw || nextPitch !== fromPitch)) {
      desiredTarget.toArray(targetPoint);
      const steered = steerOrbit(
        (y, p) => armFor(targetPoint, y, p, desiredRadius),
        { yaw: fromYaw, pitch: fromPitch },
        { yaw: nextYaw, pitch: nextPitch },
        minimumArm()
      );
      nextYaw = steered.yaw;
      nextPitch = steered.pitch;
      blocked = steered.blocked;
    }
    yaw = nextYaw;
    pitch = nextPitch;
    const appliedYaw = yaw - fromYaw,
      appliedPitch = pitch - fromPitch;
    return {
      yaw: appliedYaw,
      pitch: appliedPitch,
      stoppedYaw: Boolean(dYaw) && Math.abs(appliedYaw) < Math.abs(dYaw) * 0.5,
      stoppedPitch: Boolean(dPitch) && Math.abs(appliedPitch) < Math.abs(dPitch) * 0.5,
      blocked,
    };
  }

  // Semantic zoom (Sirui, 2026-10-14): zooming out past a room's widest view opens the whole house,
  // and past that the coast; zooming in walks back, into the room under the pointer. A view changes
  // only when the visitor keeps zooming after reaching its limit, so one hard flick still stops at
  // the edge, and a 0.7 s lull forgets a partial push. Where a wall or the cliff stops the spring
  // arm short of the envelope, that is the room's widest view.
  let zoomPush = 0,
    zoomPushAt = 0;
  function zoomBy(factor, event = null) {
    if (!(factor > 0) || factor === 1) return;
    stationLook = false;
    explore.explore();
    followClock = false;
    inertia.stop();
    if (focused) clearFocus();
    const [near, envelopeFar] = cameraEnvelope()?.radius || [0, Infinity];
    let far = envelopeFar;
    if (armActive() && armReady() && Number.isFinite(envelopeFar)) {
      desiredTarget.toArray(targetPoint);
      far = Math.max(near, Math.min(envelopeFar, armFor(targetPoint, yaw, pitch, envelopeFar)));
      // Zooming in starts from where the arm holds the camera, not from an unreachable request.
      if (factor < 1) desiredRadius = Math.min(desiredRadius, far);
    }
    const now = performance.now();
    if (now - zoomPushAt > 700) zoomPush = 0;
    const atLimit = factor > 1 ? desiredRadius >= far * 0.985 : desiredRadius <= near * 1.015;
    if (!atLimit) {
      zoomPush = 0;
      desiredRadius *= factor;
      // A request past the arm's reach would only be a dead zone before zooming back in.
      if (factor > 1) desiredRadius = Math.min(desiredRadius, far);
    } else {
      zoomPush += Math.log(factor);
      zoomPushAt = now;
      const next = Math.abs(zoomPush) > 0.32 ? (factor > 1 ? outerView() : innerView(event)) : null;
      if (next) {
        zoomPush = 0;
        setRoom(next);
      }
    }
    requestFrame();
  }
  const outerView = () => (animalFocus || currentRoom === "overview" ? "outside" : currentRoom === "outside" ? null : "overview");
  const innerView = (event) =>
    currentRoom === "outside" && !animalFocus ? "overview" : currentRoom === "overview" ? roomAt(event) || routine?.room || "study" : null;

  // The room under the pointer in the whole-house view, from each streamed room's bounds.
  const roomBounds = new WeakMap(),
    roomHit = new THREE.Vector3();
  function roomAt(event) {
    if (!event || !renderer) return null;
    const rect = renderer.domElement.getBoundingClientRect();
    ray.setFromCamera(
      new THREE.Vector2(((event.clientX - rect.left) / rect.width) * 2 - 1, 1 - ((event.clientY - rect.top) / rect.height) * 2),
      camera
    );
    let best = null,
      nearest = Infinity;
    for (const [id, root] of rooms) {
      if (!root) continue;
      let box = roomBounds.get(root);
      if (!box) roomBounds.set(root, (box = new THREE.Box3().setFromObject(root)));
      if (!ray.ray.intersectBox(box, roomHit)) continue;
      const distance = roomHit.distanceTo(ray.ray.origin);
      if (distance < nearest) {
        nearest = distance;
        best = id;
      }
    }
    return best;
  }

  // Moving the viewpoint (Shift-, right- or middle-drag, two fingers, Shift+arrows) slides the target
  // over the floor within the view's reach (an optional camera.pan in the manifest; otherwise 1.8 m
  // in a room once its collision field is ready, 1 m before, 8 m across the house, and on the coast
  // 26 m or 45% of the zoom, whichever is larger), so the house never drifts out of frame. Inside,
  // the target stops at furniture and walls; outside it rides up the clifftop instead of sinking
  // into it.
  function panReach() {
    if (animalFocus || !config) return 0;
    const view = config.views[currentRoom] || config.rooms.find((r) => r.id === currentRoom)?.camera;
    const authored = view?.pan ?? (currentRoom === "outside" ? 26 : currentRoom === "overview" ? 8 : cameraField?.ready ? 1.8 : 1);
    return currentRoom === "outside" ? Math.max(authored, desiredRadius * 0.45) : authored;
  }
  const panOrigin = new THREE.Vector3(),
    panFrom = new THREE.Vector3(),
    panDirection = [0, 0, 0];
  function panWorld(dx, dz) {
    const reach = panReach();
    if (!reach || !config) return { x: 0, z: 0, stopped: true };
    panFrom.copy(desiredTarget);
    desiredTarget.x += dx;
    desiredTarget.z += dz;
    const view = config.views[currentRoom] || config.rooms.find((r) => r.id === currentRoom);
    if (view?.target) {
      panOrigin.fromArray(view.target);
      const ox = desiredTarget.x - panOrigin.x,
        oz = desiredTarget.z - panOrigin.z,
        distance = Math.hypot(ox, oz);
      if (distance > reach) {
        desiredTarget.x = panOrigin.x + (ox / distance) * reach;
        desiredTarget.z = panOrigin.z + (oz / distance) * reach;
      }
      if (currentRoom === "outside") {
        const ground = cameraTerrainHeight(desiredTarget.x, desiredTarget.z, config.cameraCollision);
        desiredTarget.y = Math.max(view.target[1], ground + 1.2);
      }
    }
    let stopped = false;
    if (armActive() && currentRoom !== "overview" && cameraField?.ready) {
      const length = panFrom.distanceTo(desiredTarget);
      if (length > 1e-6) {
        desiredTarget.clone().sub(panFrom).divideScalar(length).toArray(panDirection);
        const step = new THREE.Vector3(...panDirection);
        // The target may pass close to furniture but not into it. One that already sits inside a
        // solid (the onsen's steam around the bather) slides freely until it leaves.
        let allowed = length;
        if (!(cameraField.grid.flagAt(panFrom.x, panFrom.y, panFrom.z) & (BLOCKING | INSIDE))) {
          const hit = cameraField.grid.march(panFrom.toArray(), panDirection, length + 0.1, BLOCKING | INSIDE);
          if (hit.blocked) {
            allowed = Math.max(0, Math.min(length, hit.distance - 0.1));
            stopped = true;
          }
        }
        // The orbit around the moved target must stay open: a pan that would press the camera
        // against a wall shortens instead.
        const minArm = minimumArm(),
          armFrom = armFor(panFrom.toArray(), yaw, pitch, desiredRadius),
          open = (distance) => {
            const at = panFrom.clone().addScaledVector(step, distance).toArray();
            const arm = armFor(at, yaw, pitch, desiredRadius);
            return arm >= minArm || arm >= armFrom - 0.001;
          };
        if (allowed > 0 && !open(allowed)) {
          let lo = 0,
            hi = allowed;
          for (let i = 0; i < 5; i++) {
            const mid = (lo + hi) / 2;
            if (open(mid)) lo = mid;
            else hi = mid;
          }
          allowed = lo;
          stopped = true;
        }
        desiredTarget.copy(panFrom).addScaledVector(step, allowed);
      }
    }
    const moved = { x: desiredTarget.x - panFrom.x, z: desiredTarget.z - panFrom.z };
    return { ...moved, stopped: stopped || Math.hypot(moved.x, moved.z) < Math.hypot(dx, dz) * 0.5 };
  }
  function panBy(dx, dy) {
    if (!panReach() || !renderer || !config) return { x: 0, z: 0, stopped: true };
    stationLook = false;
    explore.explore();
    followClock = false;
    if (focused) clearFocus();
    const height = renderer.domElement.getBoundingClientRect().height || 1;
    const perPixel = (2 * Math.tan(THREE.MathUtils.degToRad(perspective.fov) / 2) * cameraDistance()) / height,
      along = dy / Math.max(0.35, Math.sin(cameraPitch));
    const moved = panWorld(
      (-dx * Math.cos(cameraYaw) - along * Math.sin(cameraYaw)) * perPixel,
      (dx * Math.sin(cameraYaw) - along * Math.cos(cameraYaw)) * perPixel
    );
    requestFrame();
    return moved;
  }

  // A quiet, transient line over the scene: how to zoom, or the room under the pointer.
  const hint = document.createElement("p");
  hint.className = "home-world-hint";
  hint.setAttribute("aria-hidden", "true");
  let hintTimer = 0,
    zoomHints = 0;
  function showHint(text, milliseconds = 0) {
    clearTimeout(hintTimer);
    if (!text) {
      hint.dataset.visible = "false";
      return;
    }
    if (!hint.isConnected) container.append(hint);
    hint.textContent = text;
    hint.dataset.visible = "true";
    if (milliseconds) hintTimer = setTimeout(() => (hint.dataset.visible = "false"), milliseconds);
  }
  const zoomHint = /Mac|iPhone|iPad/.test(navigator.platform) ? "Hold ⌘ and scroll to zoom" : "Hold Ctrl and scroll to zoom";

  function syncCutaway() {
    world.traverse((object) => {
      if (object.userData.caveRoof) object.visible = currentRoom === "outside";
    });
  }

  function focusObject(o) {
    if (!o || !o.visible) return;
    if (focused === o) {
      const action = o.userData.action;
      clearFocus();
      if (action.type === "record") callbacks.playRecord?.(action.index);
      else if (action.type === "artifact") callbacks.openArtifact?.(artifacts[action.index].url);
      requestFrame();
      return;
    }
    clearFocus();
    setRoom("study");
    focused = o;
    o.position.fromArray(deskLayout().desk.focus || roomPoint("study", [0.05, 1.45, -0.7]));
    o.scale.setScalar(2.4);
    o.quaternion.copy(camera.quaternion);
    container.dataset.deskView = "object";
    container.dataset.focusedDeskObject = `${o.userData.action.type}-${o.userData.action.index}`;
    requestFrame();
  }

  function dropRecord(index) {
    clearFocus();
    if (!dropped.includes(index)) dropped = [...dropped, index];
    callbacks.dropRecord?.(index);
    updateRecords();
    setRoom("study");
  }

  function setRoom(id, manual = true) {
    if (!config) return;
    // A room visit, Now or the routine taking the camera ends a walk where the visitor stood.
    if (walkMode?.active) walkMode.exit({ restore: false });
    labFreeCamera = false;
    stationLook = id === "gym";
    inertia.stop();
    if (manual) {
      explore.explore();
      followClock = false;
    }
    currentRoom = id;
    desiredFov = 38;
    fitSunShadow(true);
    if (id === "outside" && compositionReady) loadFlora();
    if ((id === "outside" || id === "overview") && compositionReady) loadHinterland();
    clearFocus();
    container.dataset.room = id;
    container.dataset.deskView = id === "outside" ? "outside" : "room";
    ui.querySelector("[data-world-view]").innerHTML =
      id === "outside" ? 'Back inside <span aria-hidden="true">↙</span>' : 'Look around <span aria-hidden="true">↗</span>';
    if (id === "overview" || id === "outside") {
      const view = config.views[id];
      desiredTarget.fromArray(view.target);
      desiredRadius = view.radius;
      yaw = view.yaw;
      pitch = view.pitch;
      config.rooms.forEach((r) => {
        loadRoom(r.id).catch(() => {});
      });
    } else {
      const room = config.rooms.find((r) => r.id === id);
      if (!room) return;
      desiredTarget.fromArray(room.target);
      desiredRadius = room.camera?.radius || 4.4;
      yaw = room.camera?.yaw ?? 0.65;
      pitch = room.camera?.pitch ?? 0.24;
      desiredFov = room.camera?.fov ?? 38;
      loadRoom(id).catch(() => {});
    }
    if (reduced) {
      target.copy(desiredTarget);
      radius = desiredRadius;
    }
    ui.querySelectorAll("[data-world-room]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.worldRoom === id)));
    requestFrame();
  }

  function setStyle() {
    camera = style === "realistic" ? perspective : orthographic;
    if (renderer) renderer.toneMappingExposure = (style === "realistic" ? 1.05 : 1.18) * TONE_EXPOSURE[look.tone];
    world.traverse((o) => {
      if (o.userData.renderStyle) o.visible = o.userData.renderStyle === style;
    });
    art.apply(world, style);
    pacific?.setStyle(style);
    updateLight();
    wardrobe();
    container.dataset.renderStyle = style;
    requestFrame();
  }

  const ray = new THREE.Raycaster();
  function pick(event, selecting = false) {
    const rect = renderer.domElement.getBoundingClientRect();
    ray.setFromCamera(
      new THREE.Vector2(((event.clientX - rect.left) / rect.width) * 2 - 1, 1 - ((event.clientY - rect.top) / rect.height) * 2),
      camera
    );
    const hits = ray.intersectObjects(
      picks.filter((o) => o.visible && o.parent),
      false
    );
    // The invisible ocean hotspot is a fallback, not a pane that can steal
    // clicks from the papers or album sleeves seen through its projected area.
    const hit = hits.find((entry) => entry.object.userData.action?.type !== "window") || hits[0];
    const bot = worldCompanion?.pick(ray);
    const animal = currentRoom === "outside" ? pacific?.pick(ray) : null;
    const interactive = [hit, bot, animal].filter(Boolean).sort((a, b) => a.distance - b.distance);
    const first = interactive.find((entry) => entry.object.userData.action?.type !== "window") || interactive[0];
    if (selecting && first === animal) {
      // Reject clicks through opaque scenery; hover keeps the cheaper pick path.
      const blocker = ray.intersectObject(world, true).find((entry) => {
        if (entry.distance >= animal.distance - 0.015 || entry.object.userData.action) return false;
        let node = entry.object;
        while (node) {
          if (!node.visible) return false;
          node = node.parent;
        }
        const materials = Array.isArray(entry.object.material) ? entry.object.material : [entry.object.material];
        return materials.some((mat) => mat && (!mat.transparent || mat.opacity > 0.9));
      });
      if (blocker) return null;
    }
    return first?.object;
  }

  function activate(o) {
    const a = o?.userData.action;
    if (!a) return;
    if (a.type === "pip") location.assign(pipProjectUrl);
    else if (a.type === "record" || a.type === "artifact") focusObject(o);
    else if (a.type === "spin") callbacks.toggleSpin?.();
    else if (a.type === "window") setRoom("outside");
    else if (a.type === "wildlife") inspectNeighbour(a.id);
    else if (a.type === "source" && records[a.index].source) window.open(records[a.index].source, "_blank", "noopener,noreferrer");
  }

  function bindControls() {
    const motionButton = ui.querySelector("[data-world-pause]");
    function syncMotionPreference() {
      motionButton.disabled = reduced;
      const label = reduced ? "Motion reduced by system preference" : paused ? "Resume motion" : "Pause motion";
      motionButton.setAttribute("aria-label", label);
      motionButton.title = label;
      motionButton.querySelector("i").className = `fa-solid fa-${paused ? "play" : "pause"}`;
    }
    syncMotionPreference();
    listen(ui, "click", (event) => {
      const b = event.target.closest("button");
      if (!b) return;
      if (b.dataset.worldRoom) setRoom(b.dataset.worldRoom);
      // The same semantic zoom as the wheel and plus/minus keys, so touch visitors reach the house
      // and the far coast too.
      if (b.dataset.worldZoom) zoomBy(b.dataset.worldZoom === "in" ? 1 / 1.25 : 1.25);
      if (b.hasAttribute("data-world-now")) {
        explore.now();
        followClock = true;
        updateRoutine(true);
      }
      if (b.hasAttribute("data-world-view")) {
        if (currentRoom === "outside") {
          explore.now();
          followClock = true;
          updateRoutine(true);
        } else {
          setRoom("outside");
        }
      }
      if (b.hasAttribute("data-world-pause")) {
        paused = !paused;
        lastFrame = 0;
        b.setAttribute("aria-pressed", String(paused));
        syncMotionPreference();
        requestFrame();
      }
      if (b.dataset.worldRecord != null) focusObject(sleeves[Number(b.dataset.worldRecord)]);
      if (b.dataset.worldPaper != null) focusObject(paperItems[Number(b.dataset.worldPaper)]);
      if (b.hasAttribute("data-world-drop"))
        dropRecord(
          focused?.userData.action.type === "record"
            ? focused.userData.action.index
            : dropped.length < records.length
              ? records.findIndex((_, i) => !dropped.includes(i))
              : currentRecord
        );
    });
    listen(ui.querySelector("[data-world-avatar]"), "change", (e) => setAvatar(e.target.value).catch(() => {}));
    listen(ui.querySelector("[data-world-time]"), "input", (e) => {
      explore.setTime(Number(e.target.value));
      followClock = false;
      updateRoutine(true);
    });
    listen(ui.querySelector("[data-world-activity]"), "change", (e) => {
      const id = e.target.value;
      explore.setActivity(id, config.activities[id].minute);
      followClock = false;
      updateRoutine(true);
      setRoom(config.activities[id].room);
    });
    const canvas = renderer.domElement;
    canvas.className = "home-desk-corner-canvas";
    canvas.tabIndex = 0;
    canvas.setAttribute("aria-label", CANVAS_LABEL);
    // Right-drag moves the viewpoint, so the canvas keeps its own context menu out of the way.
    listen(canvas, "contextmenu", (e) => e.preventDefault());
    listen(canvas, "pointerdown", (e) => {
      if (e.button > 2) return;
      // Catching a coasting view holds it where it is.
      inertia.stop();
      inertia.clearTrack();
      if (e.pointerType === "touch") {
        touches.set(e.pointerId, [e.clientX, e.clientY]);
        if (touches.size === 2) {
          const [a, b] = [...touches.values()];
          pinch = { distance: Math.hypot(a[0] - b[0], a[1] - b[1]), x: (a[0] + b[0]) / 2, y: (a[1] + b[1]) / 2 };
          pointer = null;
          canvas.setPointerCapture(e.pointerId);
          return;
        }
      }
      // Shift- or right-drag (or the middle button) moves the viewpoint; plain drag orbits.
      const pan = e.button === 1 || e.button === 2 || (e.button === 0 && e.shiftKey);
      pointer = {
        id: e.pointerId,
        x: e.clientX,
        y: e.clientY,
        lastX: e.clientX,
        lastY: e.clientY,
        object: pan ? null : pick(e, true),
        moved: 0,
        pan,
      };
      canvas.setPointerCapture(e.pointerId);
      explore.explore();
      followClock = false;
    });
    listen(canvas, "pointermove", (e) => {
      if (!pointer && !reduced && !paused && e.pointerType !== "touch") {
        const rect = canvas.getBoundingClientRect();
        characterPerformance?.notice(((e.clientX - rect.left) / rect.width) * 2 - 1, 1 - ((e.clientY - rect.top) / rect.height) * 2, camera);
      }
      if (touches.has(e.pointerId)) touches.set(e.pointerId, [e.clientX, e.clientY]);
      if (pinch && touches.size === 2) {
        // Two fingers pinch to zoom and slide together to move the viewpoint.
        const [a, b] = [...touches.values()],
          distance = Math.max(15, Math.hypot(a[0] - b[0], a[1] - b[1])),
          x = (a[0] + b[0]) / 2,
          y = (a[1] + b[1]) / 2;
        zoomBy(pinch.distance / distance);
        panBy(x - pinch.x, y - pinch.y);
        Object.assign(pinch, { distance, x, y });
        return;
      }
      if (!pointer) {
        const object = pick(e),
          room = !object && currentRoom === "overview" ? roomAt(e) : null;
        canvas.style.cursor = object || room ? "pointer" : "grab";
        if (currentRoom === "overview") showHint(room ? `${config.rooms.find((r) => r.id === room)?.label || room} · click to visit` : null);
        return;
      }
      pointer.moved = Math.hypot(e.clientX - pointer.x, e.clientY - pointer.y);
      if (pointer.moved > 5) {
        // What the drag actually moved (after cushions and collision steering) feeds the release
        // velocity, so a drag pressed against a wall never flings into it.
        if (pointer.pan) {
          const moved = panBy(e.clientX - pointer.lastX, e.clientY - pointer.lastY);
          inertia.track(e.timeStamp / 1000, { x: moved.x, z: moved.z });
        } else {
          const moved = orbitBy(-(e.clientX - pointer.lastX) * 0.008, (e.clientY - pointer.lastY) * 0.006);
          inertia.track(e.timeStamp / 1000, { yaw: moved.yaw, pitch: moved.pitch });
        }
      }
      pointer.lastX = e.clientX;
      pointer.lastY = e.clientY;
      requestFrame();
    });
    listen(canvas, "pointerup", (e) => {
      touches.delete(e.pointerId);
      if (pinch) {
        if (touches.size === 0) pinch = null;
        return;
      }
      if (!pointer || pointer.id !== e.pointerId) return;
      // A flick coasts to rest; reduced motion and pause keep a drag exact.
      if (pointer.moved > 5 && !reduced && !paused && inertia.release(e.timeStamp / 1000, { yaw: 7, pitch: 3, x: 40, z: 40 })) requestFrame();
      if (pointer.moved < 6 && !pointer.pan) {
        // In the whole-house view, a click on a room visits it.
        const room = !pointer.object && currentRoom === "overview" ? roomAt(e) : null;
        if (room) {
          showHint(null);
          setRoom(room);
        } else activate(pointer.object);
      } else if (pointer.moved > 70 && pointer.object?.userData.action.type === "record") dropRecord(pointer.object.userData.action.index);
      pointer = null;
    });
    listen(canvas, "pointerleave", () => {
      if (currentRoom === "overview" && !pointer) showHint(null);
    });
    listen(canvas, "pointercancel", () => {
      pointer = null;
      pinch = null;
      touches.clear();
      inertia.clearTrack();
    });
    listen(
      canvas,
      "wheel",
      (e) => {
        // A trackpad pinch arrives as Ctrl+wheel; Ctrl/⌘+scroll zooms without focusing the scene.
        // Plain scrolling stays with the page until the scene is focused, with a brief reminder.
        const pinching = e.ctrlKey || e.metaKey;
        if (!pinching && document.activeElement !== canvas && !pointer) {
          if (zoomHints < 3 && hint.dataset.visible !== "true") {
            zoomHints++;
            showHint(zoomHint, 1800);
          }
          return;
        }
        e.preventDefault();
        const lines = e.deltaMode === 1 ? 32 : e.deltaMode === 2 ? 320 : 1;
        // A pinch reports small steps; a mouse notch (also with Ctrl) is about 100.
        const pinchStep = pinching && Math.abs(e.deltaY * lines) < 40;
        zoomBy(Math.exp(e.deltaY * lines * (pinchStep ? 0.01 : 0.0016)), e);
      },
      { passive: false }
    );
    listen(canvas, "keydown", (e) => {
      if (e.ctrlKey || e.metaKey || e.altKey || e.isComposing) return;
      // Shift+arrows move the viewpoint; in the whole house, 1 to 6 visit the rooms in order.
      if (e.shiftKey && e.key.startsWith("Arrow")) {
        e.preventDefault();
        inertia.stop();
        const step = { ArrowLeft: [60, 0], ArrowRight: [-60, 0], ArrowUp: [0, 60], ArrowDown: [0, -60] }[e.key];
        if (step) panBy(...step);
        return;
      }
      if (currentRoom === "overview" && /^[1-9]$/.test(e.key) && config.rooms[Number(e.key) - 1]) {
        e.preventDefault();
        setRoom(config.rooms[Number(e.key) - 1].id);
        return;
      }
      // Arrow keys turn in exact steps (three left and three right return to the same view); they
      // still stop short of a wall instead of passing behind it.
      const keys = {
        ArrowLeft: () => orbitBy(0.18, 0, { cushioned: false }),
        ArrowRight: () => orbitBy(-0.18, 0, { cushioned: false }),
        ArrowUp: () => orbitBy(0, 0.1, { cushioned: false }),
        ArrowDown: () => orbitBy(0, -0.1, { cushioned: false }),
        "+": () => zoomBy(1 / 1.16),
        "=": () => zoomBy(1 / 1.16),
        "-": () => zoomBy(1.16),
        PageUp: () => zoomBy(1 / 1.16),
        PageDown: () => zoomBy(1.16),
        // Recentre the current view on its authored framing (a lost visitor's way back).
        Home: () => {
          if (animalFocus) {
            const id = animalFocus.id;
            animalFocus = null;
            inspectNeighbour(id);
          } else setRoom(currentRoom);
        },
        Escape: () => setRoom("study"),
        Enter: () => (animalFocus ? setRoom("outside") : focused && activate(focused)),
        n: nextNeighbour,
        d: () => {
          if (dropped.length === records.length) records.forEach((_, i) => callbacks.dropRecord?.(i));
          else dropRecord(records.findIndex((_, i) => !dropped.includes(i)));
        },
      };
      keys.D = keys.d;
      keys.N = keys.n;
      if (keys[e.key]) {
        e.preventDefault();
        explore.explore();
        followClock = false;
        inertia.stop();
        keys[e.key]();
        requestFrame();
      }
    });
    listen(canvas, "webglcontextlost", (e) => {
      e.preventDefault();
      fail("3D paused. Switch to 3D again to retry.");
    });
    listen(document, "visibilitychange", () => {
      if (document.hidden) cancelFrame();
      else {
        lastFrame = 0;
        resumeRoutine();
        requestFrame();
      }
    });
    listen(window, "pagehide", (event) => {
      visible = false;
      cancelFrame();
      // A cached document retains its controller and pending first-room load.
      // Aborting that load would turn a normal return into the 2D failure path.
      if (!event.persisted) modelRequests.forEach((request) => request.abort());
    });
    listen(window, "pageshow", (event) => {
      if (event.persisted && stage.dataset.deskMode === "3d") {
        visible = true;
        resize();
        resumeRoutine();
        requestFrame();
      }
    });
    listen(reducedQuery, "change", (e) => {
      reduced = e.matches;
      lastFrame = 0;
      syncMotionPreference();
      updateRoutine(true);
    });
  }

  function resize() {
    if (!renderer) return;
    const rect = container.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    // The page embed keeps a 2.1 MP budget; full screen draws up to a 4K screen's native 8.3 MP and,
    // when large, adapts to frame time (resolution.mjs). The renderer keeps the pixel ratio the
    // composer was built with, so the one size handed to both moves them together.
    const size = resolution?.size(rect.width, rect.height) ?? rect;
    renderer.setSize(size.width, size.height, false);
    aspect = rect.width / rect.height;
    perspective.aspect = aspect;
    perspective.updateProjectionMatrix();
    applyDetail();
    finish?.resize(size.width, size.height);
    requestFrame();
  }

  // Detail that follows the drawing buffer (resolution.mjs detailFor): multisampling and the contact
  // pass's size (realism.mjs), the sun's shadow map, the sea mirror (reflection.mjs) and texture
  // filtering. The page embed's values never change; full screen raises them and leaving restores
  // them. ?msaa=0|2|4 pins the samples and ?fullscreen-detail=embed keeps the embed's profile and
  // detail in full screen, for comparisons.
  const detailFlags = new URLSearchParams(location.search);
  const pinnedSamples = ["0", "2", "4"].includes(detailFlags.get("msaa")) ? Number(detailFlags.get("msaa")) : null;
  const embedDetailOnly = detailFlags.get("fullscreen-detail") === "embed";
  let detail = null;
  function fullscreenChanged(mode) {
    const profile = mode && !embedDetailOnly ? "fullscreen" : "embed";
    if (resolution?.setProfile(profile)) resize();
    // The walk's collision field is built as full screen opens; leaving full screen ends a walk.
    if (mode) walkMode?.prepare();
    else walkMode?.exit();
  }

  // Walk mode's hooks (walk-controls.mjs). Starting a walk opts out of the clock's camera, like any
  // exploration; the walker's room drives what the orbit's room would (the cutaway, the bath's
  // steam and water, the sun's shadow square, the coast's reflections and planting).
  function enterWalk() {
    explore.explore();
    followClock = false;
    inertia.stop();
    stationLook = false;
    labFreeCamera = false;
    pointer = pinch = null;
    touches.clear();
    if (focused || animalFocus) clearFocus();
    showHint(null);
  }
  function walkRoomChanged(id) {
    if (!id || id === currentRoom) return;
    currentRoom = id;
    container.dataset.room = id;
    container.dataset.deskView = id === "outside" ? "outside" : "room";
    fitSunShadow(true);
    if (id === "outside" && compositionReady) {
      loadFlora();
      loadHinterland();
    }
    ui.querySelector("[data-world-view]").innerHTML =
      id === "outside" ? 'Back inside <span aria-hidden="true">↙</span>' : 'Look around <span aria-hidden="true">↗</span>';
    ui.querySelectorAll("[data-world-room]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.worldRoom === id)));
    requestFrame();
  }
  // The orbit resumes from the walker's own view: its target a little ahead of the eyes and the
  // camera at the eyes, so the springs carry it from there to the room's framing.
  function leaveWalk({ eye, yaw: lookYaw, pitch: lookPitch, room }, { restore = true } = {}) {
    const lead = 1.2,
      ahead = [Math.sin(lookYaw) * Math.cos(lookPitch), Math.sin(lookPitch), Math.cos(lookYaw) * Math.cos(lookPitch)];
    target.set(eye[0] + ahead[0] * lead, eye[1] + ahead[1] * lead, eye[2] + ahead[2] * lead);
    desiredTarget.copy(target);
    radius = desiredRadius = lead;
    cameraYaw = yaw = lookYaw + Math.PI;
    cameraPitch = pitch = -lookPitch;
    armShown = armWanted = null;
    armDeficit = 0;
    cameraMotion.stop();
    if (!restore || !config) return;
    setRoom(room === "outside" || config.rooms.some((r) => r.id === room) ? room : routine?.room || "study");
  }
  function applyDetail() {
    const canvas = renderer.domElement,
      large = resolution?.profile === "fullscreen";
    const next = detailFor({
      width: canvas.width,
      height: canvas.height,
      fullscreen: large,
      maxTextureSize: renderer.capabilities.maxTextureSize,
      maxSamples: renderer.capabilities.maxSamples,
    });
    if (pinnedSamples !== null) next.samples = Math.min(pinnedSamples, renderer.capabilities.maxSamples);
    next.anisotropy = large ? Math.min(8, renderer.capabilities.getMaxAnisotropy()) : 1;
    finish?.setDetail({ samples: next.samples, contactLongSide: next.contactLongSide });
    if (sun.shadow.mapSize.x !== next.shadowMapSize) {
      // three allocates the light's map again on its next shadow pass; the shadow cache follows the
      // new map (shadow-cache.mjs), and the texel snapping and biases follow the new texel.
      sun.shadow.mapSize.set(next.shadowMapSize, next.shadowMapSize);
      sun.shadow.map?.dispose();
      sun.shadow.map = null;
      fitSunShadow(true);
    }
    setMirrorSize(...next.reflection);
    if (next.anisotropy !== detail?.anisotropy) {
      // Only the image textures (album sleeves, labels, the print, the gym board) have maps; the
      // floors, walls and terrain are shaded procedurally in realism.mjs.
      world.traverse((object) => {
        if (!object.isMesh) return;
        for (const material of [object.material].flat()) {
          const map = material?.map;
          if (!map || map.isRenderTargetTexture) continue;
          map.userData.baseAnisotropy ??= map.anisotropy;
          const wanted = large ? Math.max(next.anisotropy, map.userData.baseAnisotropy) : map.userData.baseAnisotropy;
          if (map.anisotropy !== wanted) {
            map.anisotropy = wanted;
            map.needsUpdate = true;
          }
        }
      });
    }
    detail = next;
  }

  function cancelFrame() {
    cameraMotion.stop();
    inertia.stop();
    characterPerformance?.restore();
    characterPerformance?.update(0, { active: false, clip: container.dataset.animation });
    if (frame) cancelAnimationFrame(frame);
    frame = 0;
    lastFrame = 0;
  }
  function requestFrame() {
    // Resizing, routine changes and streamed models can request a frame during
    // initialization. Compiling an incomplete house blocks room/avatar decode
    // and then compiles again when they arrive. Draw the composed view first.
    if (!compositionReady) return;
    if (config) {
      const envelope = cameraEnvelope(),
        orbit = constrainOrbit({ yaw, pitch, radius: desiredRadius }, envelope);
      yaw = orbit.yaw;
      pitch = orbit.pitch;
      // Retain the visitor's zoom request while a narrow room angle dollies
      // inward. Returning to the open angle then restores that requested zoom.
      desiredRadius = envelope?.clearance ? clamp(desiredRadius, ...envelope.radius) : orbit.radius;
    }
    if (!frame && renderer && visible && inViewport && !document.hidden && !disposed) frame = requestAnimationFrame(render);
  }

  function render(now) {
    frame = 0;
    if (!visible || !inViewport || disposed || document.hidden) return;
    const submitStart = performance.now(),
      consecutive = lastFrame > 0;
    // Routes, clips, and water are sampled in time; capping their clock makes
    // every journey run in slow motion on a software renderer. Pause, reduced
    // motion, and visibility recovery reset lastFrame before animation resumes.
    const delta = lastFrame ? Math.max((now - lastFrame) / 1000, 0) : 1 / 60;
    const frameDelta = Math.min(delta, 1);
    lastFrame = now;
    const moving = !reduced && !paused;
    if (moving) elapsed += delta;
    physicalTime.value = elapsed;
    stepWind(moving);
    coastalWind?.update(elapsed, { reduced, coast: coastWind });
    // Camera settling follows elapsed time, including on software renderers.
    // Pausing leaves a composed still instead of an unfinished camera journey.
    const stillCamera = reduced || paused;
    if (animalFocus) {
      const current = pacific.neighbour(animalFocus.id);
      if (current) desiredTarget.fromArray(current.worldCenter);
    }
    // A released flick coasts, through the same envelope cushions, collision steering and pan
    // bounds as the drag that started it; an axis that meets a limit stops.
    if (inertia.active) {
      if (stillCamera || pointer || pinch) inertia.stop();
      else {
        const moved = inertia.step(frameDelta);
        if (moved.yaw || moved.pitch) {
          const result = orbitBy(moved.yaw || 0, moved.pitch || 0);
          if (result.stoppedYaw) inertia.stop("yaw");
          if (result.stoppedPitch) inertia.stop("pitch");
        }
        if (moved.x || moved.z) {
          const result = panWorld(moved.x || 0, moved.z || 0);
          if (result.stopped) {
            inertia.stop("x");
            inertia.stop("z");
          }
        }
        const orbit = constrainOrbit({ yaw, pitch, radius: desiredRadius }, cameraEnvelope());
        yaw = orbit.yaw;
        pitch = orbit.pitch;
      }
    }
    if (stationLook) followStation();
    for (const axis of ["x", "y", "z"]) target[axis] = cameraMotion.step(axis, target[axis], desiredTarget[axis], frameDelta, stillCamera);
    radius = cameraMotion.step("radius", radius, desiredRadius, frameDelta, stillCamera);
    // A portrait screen in full screen keeps the authored horizontal coverage; page embeds keep the lens.
    const fov = cameraMotion.step("fov", perspective.fov, fullscreen.mode ? portraitFov(desiredFov, aspect) : desiredFov, frameDelta, stillCamera);
    // A composed still reaches the exact lens, including a residual smaller
    // than the live camera's projection-update threshold.
    if (fov !== perspective.fov && (reduced || paused || Math.abs(fov - perspective.fov) > 0.00001)) {
      perspective.fov = fov;
      perspective.updateProjectionMatrix();
    }
    const yawDelta = Math.atan2(Math.sin(yaw - cameraYaw), Math.cos(yaw - cameraYaw));
    cameraYaw = cameraMotion.step("yaw", cameraYaw, cameraYaw + yawDelta, frameDelta, stillCamera, 20);
    cameraPitch = cameraMotion.step("pitch", cameraPitch, pitch, frameDelta, stillCamera, 20);
    const safeOrbit = constrainOrbit({ yaw: cameraYaw, pitch: cameraPitch, radius }, cameraEnvelope());
    if (safeOrbit.yaw !== cameraYaw) cameraMotion.stop("yaw");
    if (safeOrbit.pitch !== cameraPitch) cameraMotion.stop("pitch");
    if (safeOrbit.radius !== radius) cameraMotion.stop("radius");
    cameraYaw = safeOrbit.yaw;
    cameraPitch = safeOrbit.pitch;
    radius = safeOrbit.radius;
    // The spring arm keeps the camera on the target's side of walls, slabs, screens, furniture and
    // rock. It shortens quickly and lengthens gently, and never passes the hard limit, so the near
    // plane stays out of every blocking surface even mid-motion.
    if (armActive()) {
      target.toArray(targetPoint);
      armWanted = armFor(targetPoint, cameraYaw, cameraPitch, radius);
      const hard = hardArm(
        cameraField?.grid,
        config.cameraCollision,
        targetPoint,
        cameraYaw,
        cameraPitch,
        radius,
        cameraField?.footprint,
        currentRoom === "overview"
      );
      // Smooth the shortfall against the orbit radius, not the length itself, so an unobstructed
      // zoom is exactly as quick as before.
      const wanted = radius - armWanted;
      if (armShown === null || stillCamera) {
        armDeficit = wanted;
        cameraMotion.stop("arm");
      } else armDeficit = cameraMotion.step("arm", armDeficit, wanted, frameDelta, false, wanted > armDeficit ? 24 : 9);
      armShown = Math.max(0, Math.min(radius - Math.max(0, armDeficit), hard));
    } else {
      armDeficit = 0;
      armShown = armWanted = null;
      cameraMotion.stop("arm");
    }
    const distance = cameraDistance(),
      direction = ORBIT_DIRECTION(cameraYaw, cameraPitch);
    camera.position.set(target.x + direction[0] * distance, target.y + direction[1] * distance, target.z + direction[2] * distance);
    aim.copy(target);
    let groundClearance = Infinity;
    if (currentRoom === "outside" && !animalFocus && !labFreeCamera) {
      // Over the cliff the camera rides the terrain with more clearance the farther it is, and
      // looks along its orbit rather than down into the sandstone that hides the terrace.
      const ground = cameraTerrainHeight(camera.position.x, camera.position.z, config.cameraCollision);
      outsideLift = Math.max(0, ground + outsideClearance(radius, config.cameraCollision?.clearance) - camera.position.y);
      camera.position.y += outsideLift;
      aim.y += outsideLift * 0.85;
      groundClearance = camera.position.y - ground;
    } else outsideLift = 0;
    // The gallery rail is inside the carved home. A mainland height field
    // would lift its inspection camera onto the cliff and into the sandstone.
    keepCameraClear(camera.position, config, animalFocus?.id === "balcony-gull-0" ? "study" : currentRoom, {
      walls: !(armActive() && cameraField?.ready),
    });
    // Walking puts the camera at the visitor's eyes (walk-controls.mjs). The orbit above keeps
    // settling unseen, so leaving the walk resumes from wherever its springs are.
    const walking = Boolean(walkMode?.active);
    if (walking) {
      walkMode.frame(frameDelta);
      groundClearance = Infinity;
    }
    // Far coast views: haze, clip planes and the sky dome follow the zoom (camera.mjs farView).
    const far = farView(!walking && currentRoom === "outside" && !animalFocus ? radius : 0, groundClearance);
    if (perspective.near !== far.near || perspective.far !== far.far) {
      perspective.near = far.near;
      perspective.far = far.far;
      perspective.updateProjectionMatrix();
    }
    if (scene.fog) {
      scene.fog.near = far.fogNear;
      scene.fog.far = far.fogFar;
    }
    pacific?.followCamera?.(camera.position, far.far * 0.85);
    if (camera.isOrthographicCamera) {
      const half = radius * Math.tan((38 * Math.PI) / 360);
      camera.left = -half * aspect;
      camera.right = half * aspect;
      camera.top = half;
      camera.bottom = -half;
      camera.updateProjectionMatrix();
    }
    if (!walking) camera.lookAt(aim);
    syncCutaway();
    poolStroke?.restore();
    characterPerformance?.restore();
    if (liftActive && moving) {
      liftRig?.release();
      liftActive = false;
    }
    if (moving && mixer) {
      if (style === "illustrated") {
        const step = Math.floor(elapsed * 12) / 12;
        const previous = mixer.userDataStep ?? step;
        mixer.update(Math.max(0, step - previous));
        mixer.userDataStep = step;
      } else {
        mixer.update(delta);
        mixer.userDataStep = undefined;
      }
    }
    if (travel && moving) {
      const t = clamp((elapsed - travel.start) / travel.duration, 0, 1);
      const sample = sampleRoute(travel.route, t);
      actor.position.fromArray(sample.position);
      actor.rotation.y +=
        Math.atan2(Math.sin(sample.facing - actor.rotation.y), Math.cos(sample.facing - actor.rotation.y)) * Math.min(1, delta * 12);
      footContacts?.(sample.onStairs);
      if (t === 1) {
        actor.position.copy(travel.goal);
        actor.rotation.y = travel.facing;
        travel = null;
        playClip(routine.clip);
        propFor(routine.prop);
        sequenceStart = elapsed;
      }
    }
    let liftThisFrame = false;
    // The gym's bars, dumbbells and board exist whenever its room is loaded.
    if (!gymProps && config?.equipment?.gym && rooms.get("gym")) {
      gymProps = createGymProps({ room: rooms.get("gym"), world, gym: config.equipment.gym, training: config.training, material });
      gymProps.drawBoard(boardInfo());
    }
    if (actor && !travel && routine?.sequence === "session" && routine.training?.plan && config.equipment?.gym) {
      const info = trainingSession();
      if (info?.state) {
        // Paused, the last pose holds; a reduced-motion still shows the start of the current lift.
        // Paused, the frame freezes as it was (the pose, the turn in progress, the props); a
        // reduced-motion still, or a pose composed while paused, faces exactly and sets the props.
        const compose = moving || reduced || !sequencePose?.bars;
        if (compose) sequencePose = sessionPose(info, config.equipment.gym);
        const pose = sequencePose;
        playClip(pose.clip);
        actor.position.fromArray(pose.position);
        const turn = Math.atan2(Math.sin(pose.facing - actor.rotation.y), Math.cos(pose.facing - actor.rotation.y));
        if (moving) actor.rotation.y += turn * (1 - Math.exp(-delta * 8));
        else if (compose) actor.rotation.y += turn;
        actor.updateMatrixWorld(true);
        let rig = null;
        // Paused, the bones already hold this pose; solving again would only add rounding noise.
        if (pose.lift && liftRig) {
          if (compose) rig = liftRig.apply(pose.lift.name, reduced ? 0 : pose.lift.u, pose.lift.ctx, pose.lift.weight);
          liftActive = liftThisFrame = true;
        }
        if (propFor && selectedProp) propFor(null);
        if (compose) gymProps?.update(pose, rig, frameDelta, moving);
        gymProps?.drawBoard(info);
        container.dataset.activityPhase = pose.phase;
      }
    } else if (actor && !travel && routine?.sequence && moving) {
      const room = config.rooms.find((r) => r.id === routine.room);
      sequencePose = activityPose(routine.sequence, elapsed - sequenceStart, config.equipment, room);
      if (sequencePose) {
        const pose = sequencePose;
        playClip(pose.clip);
        actor.position.fromArray(pose.position);
        actor.rotation.y +=
          Math.atan2(Math.sin(pose.facing - actor.rotation.y), Math.cos(pose.facing - actor.rotation.y)) * (1 - Math.exp(-delta * 8));
        if ((selectedProp?.userData.kind || null) !== (pose.prop || null)) propFor(pose.prop || null);
        let contacts = pose.hands;
        if (pose.cup && !contacts && pose.clip === "walk") {
          const grip = new THREE.Vector3(0.16, 0.91, 0.3).applyQuaternion(actor.quaternion).add(actor.position);
          contacts = [null, grip.toArray()];
        }
        handContacts?.solve(resolveWristTargets(contacts, pose.clip, activeGripOffsets, actor.rotation.y), pose.contactBlend ?? 1);
        container.dataset.activityPhase = pose.phase;
      }
    } else if (!paused || reduced || !actor || travel || !routine?.sequence) sequencePose = null;
    if (liftActive && !liftThisFrame) {
      liftRig?.release();
      liftActive = false;
      if (!moving) mixer?.update(0);
    }
    if (gymProps && routine?.sequence !== "session") gymProps.update(null, null, frameDelta, moving);
    if (container.dataset.animation === "sleep" || covers.size) breatheBedding(moving, delta);
    characterPerformance?.update(delta, { active: moving && !travel, clip: liftThisFrame ? "workout" : container.dataset.animation });
    const holdActivityProps = paused && !reduced && Boolean(sequencePose);
    let cupCreated = false;
    // Move the authored cup itself; there is never a second coffee cup in a hand.
    if (!coffeeCup && config?.equipment?.coffee) {
      const pieces = [];
      world.traverse((o) => {
        if (o.userData.activityProp === "coffee-cup") pieces.push(o);
      });
      if (pieces.length) {
        coffeeCup = new THREE.Group();
        cupCreated = true;
        coffeeCup.position.fromArray(config.equipment.coffee.cup);
        world.add(coffeeCup);
        world.updateMatrixWorld(true);
        pieces.forEach((o) => coffeeCup.attach(o));
      }
    }
    if (coffeeCup && (!holdActivityProps || cupCreated)) {
      const cupTarget = new THREE.Vector3(...config.equipment.coffee.cup);
      if (sequencePose?.cup) {
        actor.updateMatrixWorld(true);
        actor.traverse((o) => {
          if (o.isBone && o.name.replaceAll(".", "") === "HandR") o.getWorldPosition(cupTarget);
        });
      }
      if (moving) coffeeCup.position.lerp(cupTarget, 1 - Math.exp(-frameDelta * 16));
      else coffeeCup.position.copy(cupTarget);
    }
    if (vinyl) {
      if (moving) recordMotion.advance(delta);
      else if (reduced) recordMotion.compose();
      const pose = recordMotion.evidence();
      transferVinylRecord(pose);
      vinyl.rotation.y = pose.angle;
      if (tonearm) {
        tonearm.rotation.y = pose.yaw;
        tonearm.position.y = tonearm.userData.restY + (pose.lift - 0.1) * 0.06;
      }
    }
    if (onsenWater) {
      // The room can finish loading before the parallel avatar request.
      const occupied = Boolean(actor) && routine?.id === "soak" && !travel;
      // Explicit arrivals may compose a still frame; unchanged paused/hiding
      // frames never advance the solver or add another impulse.
      if (occupied !== poolOccupied) {
        onsenWater.setBather(occupied ? { x: actor.position.x, z: actor.position.z, radius: 0.17 } : null);
        poolOccupied = occupied;
        poolStroke?.reset();
      }
      const contacts = occupied
        ? poolStroke?.update(delta, {
            active: moving,
            surfaceY: onsenWater.uniforms.poolSolidElevation.value + onsenWater.surfaceY,
            depth: onsenWater.depth,
            elapsed,
          }) || []
        : [];
      // Like the steam below, the ripples evolve only where they can be seen: the bath's own room
      // and the cutaway overview. From the coast the pool is a few pixels, and its solver was about
      // a tenth of the outside frame (2.7 of 30 ms on the test laptop's integrated GPU).
      if (moving && (currentRoom === "onsen" || currentRoom === "overview")) {
        onsenWater.advance(delta, { contacts });
      }
    }
    if (moving) pacific?.update(elapsed, delta);
    infinityPool?.update(elapsed, { paused: !moving });
    if (currentRoom === "outside") fitSunShadow();
    stepFacadeDoors(frameDelta, moving);
    curtainRig?.step({
      delta,
      moving,
      reduced,
      time: elapsed,
      doors: facadeDoors,
      daylight,
      routine,
      visit: currentRoom,
      camera,
      canvasHeight: renderer.domElement.height,
    });
    lightInstallations?.tick(elapsed, moving);
    furniture?.update({ camera, bufferHeight: renderer.domElement.height, fullscreen: fullscreen.mode });
    if (steamVolume) {
      // The small volume is a close bath detail. Do not capture two complete
      // coast depth buffers or evolve hidden steam in distant exterior views.
      steamVolume.object.visible = steamReady && currentRoom === "onsen";
      if (lightWell) {
        lightWell.object.visible = currentRoom === "onsen" && lightWell.open > 0 && daylight?.sunlight > 0;
        if (moving && lightWell.object.visible) lightWell.uniforms.wellTime.value = elapsed;
      }
      if (moving && steamVolume.object.visible) {
        // The vapour drifts in the house's air: the coast's breeze through the glass front, sheltered
        // by the alcove's cedar screens.
        const pool = onsenWater.uniforms.poolCenter.value;
        steamVolume.field.setWind(coastWind.indoorDrift(pool.x, pool.y, 0.5));
        steamVolume.field.advance(delta, { fieldTime: elapsed });
      }
      steamVolume.sync();
    }
    companion.paused = paused;
    worldCompanion?.update(Math.min(delta, 0.25), elapsed, camera, currentRoom, moving);
    orientProp();
    // The marine fog drifts with the coast's breeze on the scene's clock (haze.mjs).
    finish?.haze?.advance(elapsed, coastWind.state);
    renderer.info.reset();
    withoutContactLighting(finish?.contactLighting, () =>
      pacific?.reflect(camera, style === "realistic" && currentRoom === "outside" && labSettings.reflection)
    );
    if (style === "realistic" && finish) finish.render(camera, currentRoom === "outside" && !animalFocus);
    else renderer.render(scene, camera);
    if (moving && consecutive) {
      const submit = performance.now() - submitStart;
      frameTimings.push({ interval: delta * 1000, submit });
      if (frameTimings.length > 120) frameTimings.shift();
      if (resolution?.observe(delta * 1000, submit)) resize();
    }
    frames++;
    if (firstFrameMilliseconds === null) {
      firstFrameMilliseconds = performance.now() - startupStart;
      container.dataset.sceneState = "ready";
      container.removeAttribute("aria-busy");
      if (progressBar) progressBar.hidden = true;
      loadingStage("ready", routine.label);
      // Traced now, in the task that drew the frame, before its drawing buffer is released. The
      // sketch must never stop the render loop, so a failure only removes it.
      try {
        loadingSketch?.finish(renderer.domElement);
      } catch {
        loadingSketch?.dispose();
      }
      loadingSketch = null;
      // Stream detail only after the occupied room/avatar have actually drawn.
      backgroundTimer = setTimeout(() => {
        if (!disposed && visible) config.rooms.forEach((r) => loadRoom(r.id).catch(() => {}));
      }, 1800);
    }
    const settledRadius = constrainOrbit({ yaw, pitch, radius: desiredRadius }, cameraEnvelope()).radius;
    if (
      moving ||
      inertia.active ||
      walkMode?.busy ||
      (armWanted !== null && Math.abs(armDeficit - (radius - armWanted)) > 0.003) ||
      target.distanceTo(desiredTarget) > 0.003 ||
      Math.abs(radius - settledRadius) > 0.003 ||
      Math.abs(Math.atan2(Math.sin(yaw - cameraYaw), Math.cos(yaw - cameraYaw))) > 0.003 ||
      Math.abs(cameraPitch - pitch) > 0.003
    )
      requestFrame();
  }

  function fail(message) {
    cancelFrame();
    compositionReady = false;
    container.dataset.sceneState = "failed";
    container.dataset.loadingStage = "failed";
    loadingSketch?.dispose();
    loadingSketch = null;
    if (progressBar) progressBar.hidden = true;
    container.removeAttribute("aria-busy");
    status.textContent = message;
    container.dispatchEvent(new CustomEvent("home-scene-unavailable", { bubbles: true }));
  }

  async function initialize() {
    if (initPromise) return initPromise;
    initPromise = (async () => {
      startupStart = performance.now();
      container.dataset.sceneState = "loading";
      container.setAttribute("aria-busy", "true");
      // A pen sketch fills the empty scene until the first frame replaces it. Automation keeps the
      // plain loading state unless the URL asks for the live layer, as the cinematic layer does.
      if (!navigator.webdriver || new URLSearchParams(location.search).get("cinematic") === "live") {
        loadingSketch = createLoadingSketch(container, { reduced });
        cleanup.push(() => loadingSketch?.dispose());
      }
      loadingStage("home", "Opening the little home.");
      const response = await fetch(manifestUrl);
      if (!response.ok) throw new Error("Scene manifest unavailable");
      config = await response.json();
      furniture = createFurniture({
        config,
        baseUrl: manifestUrl,
        loadModel,
        loader,
        prepare: (root) => prepareModel(root),
        compile: () => compilePrograms(),
        requestFrame: () => requestFrame(),
        roomRoot: (id) => rooms.get(id),
        anisotropy: () => detail?.anisotropy ?? 1,
        override: detailFlags.get("furniture-detail"),
      });
      cleanup.push(() => furniture?.dispose());
      if (disposed) return;
      // The coast's wind starts at this Pacific minute, so the spray and dust prewarm in today's breeze.
      coastWind.update({ seconds: elapsed, minute: livePacificMinute(config.timeZone) });
      syncOceanWind(coastWind.state);
      cameraField = createCameraField({ config, world, onReady: () => requestFrame() });
      cleanup.push(() => cameraField?.dispose());
      // The composer multisamples its own target and finishes with one full-screen triangle, so a
      // multisampled canvas would only add a resolve without changing a pixel.
      renderer = new THREE.WebGLRenderer({ alpha: true, antialias: false, powerPreference: "low-power" });
      renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = TONE_MAPPING[look.tone];
      renderer.toneMappingExposure = 1.18 * TONE_EXPOSURE[look.tone];
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      renderer.info.autoReset = false;
      // Comparison flags: ?resolution=fixed keeps the pixel budget without the adaptive density;
      // ?shadow-cache=0 and ?draw-order=material restore three's own behaviour.
      const flags = new URLSearchParams(location.search);
      resolution = createResolutionGovernor({ basePixelRatio: renderer.getPixelRatio(), enabled: flags.get("resolution") !== "fixed" });
      // Full screen opened while the scene was still loading.
      if (fullscreen.mode && !embedDetailOnly) resolution.setProfile("fullscreen");
      shadowCache = createShadowCache(renderer, sun, { enabled: flags.get("shadow-cache") !== "0" });
      if (flags.get("draw-order") !== "material") sortOpaqueByProgram(renderer);
      cleanup.push(() => shadowCache?.dispose());
      surfaceLook.sheen = look.sheen;
      const bloom = look.bloom ? await import("../vendor/three-r164/postprocessing/UnrealBloomPass.js") : null;
      if (disposed) return;
      // The sky, the sun and the coast's air (atmosphere.mjs, haze.mjs): the dome and the haze pass
      // share one set of tables. ?haze=0 keeps three's linear fog for comparison.
      atmosphere = createAtmosphere(renderer);
      cleanup.push(() => atmosphere?.dispose());
      finish = createFinish(renderer, scene, perspective, {
        profileGPU: labEnabled,
        // 1.6 sits above sunlit walls (no bloom at midday) and below the lamps and sconces.
        bloom: bloom && { Pass: bloom.UnrealBloomPass, strength: 0.28, radius: 0.42, threshold: 1.6 },
        // ?light-air=0 keeps the haze analytic (no march for shafts, marine fog or sunbeams).
        haze: flags.get("haze") === "0" ? null : createHaze(atmosphere, scene, sun, { volume: flags.get("light-air") !== "0" }),
      });
      skinDiffusion = createSkinDiffusion();
      coastalWind = createCoastalWind();
      warmPracticals = createWarmPracticals(scene, (m) => bindContactLighting(m, finish.contactLighting));
      staticLightField = createStaticLightField({
        practicalSources: warmPracticals.sources,
        acceptMesh(mesh) {
          if (mesh.geometry?.attributes.coastalPlantWeight) return false;
          for (let parent = mesh; parent; parent = parent.parent) {
            if (parent === actor || parent.userData.activityProp || parent.userData.action) return false;
          }
          return true;
        },
      });
      warmPracticals.root.traverse((mesh) => {
        if (mesh.isMesh) for (const material of [mesh.material].flat()) staticLightField.bindMaterial(material);
      });
      // Scheduled light installations (light-installations.mjs) light every material they can reach,
      // so, like the light well, they exist before the first model is prepared.
      lightInstallations = createLightInstallations(config, { bind: (m) => bindContactLighting(m, finish.contactLighting) });
      scene.add(lightInstallations.root);
      for (const mesh of [...warmPracticals.root.children, ...lightInstallations.root.children])
        if (mesh.isMesh) for (const material of [mesh.material].flat()) lightInstallations.bindMaterial(material);
      cleanup.push(() => lightInstallations?.dispose());
      art.setContactLighting(finish.contactLighting);
      // The light well over the onsen (light-well.mjs) binds every material it might light, so it
      // exists before the first model is prepared.
      if (config.lightWell && !openOnsen) {
        lightWell = createLightWell(config.lightWell, { region: { min: [1.9, 0, 1.2], max: [5.3, 0, 5.6] } });
        scene.add(lightWell.object);
        cleanup.push(() => lightWell?.dispose());
      }
      container.append(renderer.domElement);
      loadingSketch?.cover(renderer.domElement);
      const shell = await loadModel(new URL(config.shell, manifestUrl).href, "house");
      if (disposed) {
        release(shell.scene);
        return;
      }
      world.add(prepareModel(shell.scene));
      shellRoot = shell.scene;
      cameraField?.addRoot(shell.scene);
      loadingStage("coast", "Opening the coast.");
      pacific = createPacific(scene, renderer, config, { atmosphere });
      infinityPool = createInfinityPool(shellRoot, { waterSky: () => pacific?.waterSky() });
      cleanup.push(() => infinityPool?.dispose());
      pacific.bindLamps(lightInstallations, warmPracticals);
      const coast = await loadModel(new URL(config.coast, manifestUrl).href, "coast");
      if (disposed) {
        release(coast.scene);
        return;
      }
      world.add(prepareModel(coast.scene, { outdoor: true }));
      cameraField?.addRoot(coast.scene);
      // The sea reads its seabed from the coast's own sand and rock (bathymetry.mjs). The beach slopes
      // under the water within a shadow texel of it, so the sand casts no sun shadow (it shaded the
      // shallows lying on it); rock, animals and the cliff still do.
      coastRoot = coast.scene;
      pacific.captureSeabed([coastRoot]);
      pacific.quietSand(coastRoot);
      worldCompanion = await createWorldCompanion(scene, config, container, loader).catch(() => null);
      if (disposed) {
        worldCompanion?.dispose();
        return;
      }
      cleanup.push(() => worldCompanion?.dispose());
      scene.traverse((mesh) => {
        if (mesh.isMesh && !mesh.userData.outline) for (const material of [mesh.material].flat()) staticLightField.bindMaterial(material);
      });
      listen(window, "pip:change", requestFrame);
      makeDeskObjects();
      const lab = ui.querySelector("[data-world-lab]");
      lab.hidden = !labEnabled;
      lab.inert = !labEnabled;
      avatarId = chooseArrivalAvatar(
        config.avatars.map((a) => a.id),
        stored("sirui-scene-avatar", "")
      );
      const roomSelect = ui.querySelector("[data-world-room-list]");
      roomSelect.replaceChildren();
      for (const room of config.rooms) {
        const button = document.createElement("button");
        button.type = "button";
        button.dataset.worldRoom = room.id;
        button.textContent = room.label;
        button.setAttribute("aria-pressed", "false");
        roomSelect.append(button);
      }
      const avatars = ui.querySelector("[data-world-avatar]");
      avatars.replaceChildren();
      config.avatars.forEach((a) => avatars.add(new Option(a.label, a.id)));
      const activitySelect = ui.querySelector("[data-world-activity]");
      activitySelect.replaceChildren();
      Object.entries(config.activities).forEach(([id, a]) => activitySelect.add(new Option(a.label, id)));
      const items = ui.querySelector("[data-world-desk-items]");
      items.replaceChildren();
      records.forEach((r, i) => {
        const b = document.createElement("button");
        b.type = "button";
        b.dataset.worldRecord = i;
        b.textContent = r.title;
        items.append(b);
      });
      artifacts.forEach((a, i) => {
        const b = document.createElement("button");
        b.type = "button";
        b.dataset.worldPaper = i;
        b.textContent = a.title;
        items.append(b);
      });
      walkMode = createWalkMode({
        camera: perspective,
        canvas: renderer.domElement,
        stage,
        container,
        world,
        getConfig: () => config,
        houseRoots: () => [shellRoot, ...rooms.values()],
        getActor: () => actor,
        doors: () => facadeDoors.map((door) => door.object),
        view: () => ({ room: currentRoom, routineRoom: routine?.room, camera: camera.position.toArray() }),
        isFullscreen: () => Boolean(fullscreen.mode),
        isReady: () => compositionReady,
        isReduced: () => reduced || paused,
        hint: showHint,
        requestFrame,
        onEnter: enterWalk,
        onRoom: walkRoomChanged,
        onExit: leaveWalk,
      });
      cleanup.push(() => walkMode?.dispose());
      bindControls();
      const resizeObserver = new ResizeObserver(resize);
      resizeObserver.observe(container);
      cleanup.push(() => resizeObserver.disconnect());
      const viewportObserver = new IntersectionObserver((entries) => {
        inViewport = entries[0].isIntersecting;
        if (inViewport) {
          lastFrame = 0;
          resumeRoutine();
          requestFrame();
        } else cancelFrame();
      });
      viewportObserver.observe(container);
      cleanup.push(() => viewportObserver.disconnect());
      updateRoutine();
      // The curtains join the scene before the first view's programs compile (program-warmup.mjs).
      if (facadeDoors.length)
        curtainRig = createCurtainRig({
          scene,
          startTime: elapsed,
          reduced,
          plan: { routine, daylight, visit: currentRoom },
          bindMaterial: (m) => (staticLightField?.bindMaterial(m), lightInstallations?.bindMaterial(m)),
        });
      loadingStage("room", "Bringing the room into view.");
      await Promise.all([loadRoom(routine.room, "room"), setAvatar(avatarId, "sirui")]);
      if (disposed) return;
      progress("room", 1);
      progress("sirui", 1);
      loadingStage("first-frame", "Preparing the view.");
      setStyle();
      resize();
      await compilePrograms((fraction) => progress("view", fraction));
      if (disposed) return;
      progress("view", 1);
      compositionReady = true;
      clockTimer = window.setInterval(() => {
        if (visible && !document.hidden) updateRoutine();
      }, 30000);
      requestFrame();
    })().catch((error) => {
      if (disposed) return;
      fail("3D couldn’t load. The 2D desk is ready.");
      throw error;
    });
    return initPromise;
  }

  if (labEnabled)
    container.labScene = { scene, sun, settings: labSettings, requestFrame: () => requestFrame(), collisionGrid: () => cameraField?.grid };
  if (labEnabled) {
    container.labScene.captureInkStudy = async (surfaceInk = true) => {
      const { captureInkStudy } = await import("./ink-study.mjs");
      return captureInkStudy({ world, camera, sun, surfaceInk });
    };
    container.labScene.captureStillPhoto = async (samples = 8) => {
      const { captureStillPhoto } = await import("./still-photo.mjs");
      return captureStillPhoto({
        renderer,
        camera,
        samples,
        isFrozen: () => Boolean((paused || reduced) && routine && !routine.live),
        stateKey: () => JSON.stringify([elapsed, currentRoom, avatarId, camera.position.toArray(), camera.quaternion.toArray(), camera.fov]),
        renderFrame: () => {
          withoutContactLighting(finish?.contactLighting, () =>
            pacific?.reflect(camera, style === "realistic" && currentRoom === "outside" && labSettings.reflection)
          );
          if (style === "realistic" && finish) finish.render(camera, currentRoom === "outside" && !animalFocus);
          else renderer.render(scene, camera);
        },
      });
    };
    const output = ui.querySelector("[data-world-study-output]");
    const status = ui.querySelector("[data-world-study-status]");
    for (const [selector, capture] of [
      [
        "[data-world-photo]",
        async () => {
          const { canvas, evidence } = await container.labScene.captureStillPhoto();
          return [{ image: canvas.toDataURL("image/png"), label: "8-sample still photo", evidence }];
        },
      ],
      [
        "[data-world-ink]",
        async () => [
          { ...(await container.labScene.captureInkStudy(false)), label: "Screen-space ink · static geometry" },
          { ...(await container.labScene.captureInkStudy(true)), label: "Surface ink · static geometry" },
        ],
      ],
    ]) {
      const button = ui.querySelector(selector);
      if (!button || !output || !status) continue;
      listen(button, "click", async () => {
        button.disabled = true;
        status.textContent = "Preparing the study…";
        try {
          const results = await capture();
          if (disposed) return;
          output.replaceChildren();
          for (const result of results) {
            const figure = document.createElement("figure"),
              image = document.createElement("img"),
              caption = document.createElement("figcaption");
            image.src = result.image;
            image.alt = result.label;
            image.style.width = "100%";
            caption.textContent = result.label;
            figure.append(image, caption);
            output.append(figure);
          }
          container.labScene.lastStudy = results.map((result) => result.evidence);
          status.textContent = "Study ready. The active home keeps its Realistic treatment.";
        } catch (error) {
          status.textContent = error.message;
        } finally {
          button.disabled = false;
          requestFrame();
        }
      });
    }
  }
  // Lab only: compare the next frame's cached sun shadow with a full redraw of it (shadow-cache.mjs).
  if (labEnabled)
    container.labScene.verifyShadowCache = () => {
      const result = shadowCache?.verify() ?? null;
      requestFrame();
      return result;
    };
  // Lab only: stand the walker somewhere ({ position: [x, foot, z], yaw, pitch }); false if no room there.
  if (labEnabled) container.setLabWalk = (pose) => walkMode?.labPlace(pose) ?? false;
  // Lab only: run today's training session from a chosen second (null returns to the clock).
  if (labEnabled)
    container.setLabSessionSeconds = (seconds) => {
      labSession = seconds == null ? null : { seconds, start: elapsed };
      sequencePose = null;
      requestFrame();
    };
  if (labEnabled)
    container.setLabCamera = ({ target: at, yaw: y, pitch: p, radius: r, free = true }) => {
      labFreeCamera = free;
      desiredTarget.fromArray(at);
      yaw = y;
      pitch = p;
      desiredRadius = r;
      explore.explore();
      followClock = false;
      requestFrame();
    };
  container.getSceneEvidence = () => ({
    ready: container.dataset.sceneState === "ready",
    style,
    avatarId,
    portrait: world.getObjectByName("Capybara beach party print")?.material.map?.image?.src || null,
    currentRoom,
    activity: routine?.id,
    activityFloor: config?.rooms.find((r) => r.id === routine?.room)?.floor,
    activityOffset: config?.rooms.find((r) => r.id === routine?.room)?.offset,
    traveling: Boolean(travel),
    navigation: travel
      ? { progress: clamp((elapsed - travel.start) / travel.duration, 0, 1), duration: travel.duration, position: actor.position.toArray() }
      : null,
    animationSeconds: elapsed,
    fullscreen: fullscreen.mode,
    palette: routine?.palette,
    daylight: daylight ? { ...daylight, location: LA_JOLLA } : null,
    clockMode: routine?.live ? "now" : "preview",
    following: explore.following && followClock,
    animation: container.dataset.animation,
    activityPhase: sequencePose?.phase || null,
    cupOwner: sequencePose?.cup ? "hand" : "counter",
    weightOwner: gymProps?.evidence().weightOwner || (sequencePose?.weight ? "hand" : "rack"),
    cupPosition: coffeeCup?.position.toArray() || null,
    weightPosition: gymProps?.evidence().weightPosition || null,
    gym: gymProps
      ? { ...gymProps.evidence(), lift: sequencePose?.lift?.name || null, segment: sequencePose?.segment || null, rep: sequencePose?.rep || null }
      : null,
    liftHead: liftRig ? { min: liftRig.dims.head.min.toArray(), max: liftRig.dims.head.max.toArray() } : null,
    actorFacing: actor ? actor.rotation.y : null,
    gripDrift: handContacts?.evidence() || [],
    gripTargetMode: activeGripOffsets?.[sequencePose?.clip] ? "anatomical-wrist" : "equipment-anchor",
    characterPerformance: characterPerformance?.evidence(),
    garment: garmentEvidence(),
    animations: actions ? [...actions.keys()] : [],
    roomCount: rooms.size,
    actorCount: actor ? 1 : 0,
    frames,
    loading: {
      stages: startupStages.map((stage) => ({ ...stage })),
      firstFrameMilliseconds,
      models: modelTimings.map((timing) => ({ ...timing })),
      progress: { ...progressFill },
    },
    frameTiming: {
      samples: frameTimings.length,
      scope: "Consecutive moving frames, including intervals >=500ms; reset after visibility/pause changes.",
      medianFrameMs: quantile("interval", 0.5),
      p95FrameMs: quantile("interval", 0.95),
      maximumFrameMs: quantile("interval", 1),
      medianSubmitMs: quantile("submit", 0.5),
      p95SubmitMs: quantile("submit", 0.95),
      maximumSubmitMs: quantile("submit", 1),
    },
    framePending: Boolean(frame),
    drawCalls: renderer?.info.render.calls,
    triangles: renderer?.info.render.triangles,
    resources: renderer ? { ...renderer.info.memory } : {},
    projection: camera.isOrthographicCamera ? "orthographic" : "perspective",
    coastDetail: style,
    look: { ...look },
    companion: worldCompanion?.evidence(),
    ecology: pacific?.evidence(),
    rendering: finish?.evidence,
    simulation: {
      infinityPool: infinityPool?.evidence(),
      skin: skinDiffusion?.evidence,
      onsen: onsenWater
        ? {
            ...onsenWater.evidence(),
            stroke: poolStroke?.evidence(),
            optics: {
              ior: water.material.ior,
              transmission: water.material.transmission,
              thicknessMeters: water.material.thickness,
              attenuationDistanceMeters: water.material.attenuationDistance,
              method: "Three r164 screen-space refracted background / Beer-Lambert attenuation",
              extraBackgroundPass: true,
              opaqueShadow: water.castShadow,
              normalDepthOccluder: !water.userData.noContactOcclusion,
            },
          }
        : null,
      wind: coastalWind ? { ...coastalWind.evidence(), coast: coastWind.evidence() } : null,
      curtains: curtainRig?.evidence() ?? null,
      practicals: warmPracticals?.evidence(),
      installations: lightInstallations?.evidence(),
      facade: {
        doors: facadeDoors.map((d) => ({ id: d.id, open: d.target !== 0, offset: d.offset, slideX: d.slideX })),
        glazedMeshes: (() => {
          let count = 0;
          world.traverse((o) => (count += o.userData.glazing ? 1 : 0));
          return count;
        })(),
      },
      lightField: staticLightField ? { ...staticLightField.evidence(), error: lightBakeError } : null,
      steam: steamVolume
        ? { ready: steamReady, setupMilliseconds: steamSetupMilliseconds, visible: steamVolume.object.visible, ...steamVolume.evidence() }
        : null,
    },
    backdropImages: 0,
    camera: camera.position.toArray(),
    cameraOrbit: { yaw: cameraYaw, pitch: cameraPitch, radius },
    cameraVelocity: cameraMotion.evidence(),
    cameraFov: perspective.fov,
    cameraEnvelope: config ? cameraEnvelope() : null,
    // Navigation (camera.mjs): the spring arm's length against the orbit radius, the collision
    // field it reads, the outside terrain lift, coasting velocities, and the far-view planes.
    cameraArm: {
      active: config ? armActive() : false,
      distance: armShown,
      wanted: armWanted,
      limited: armShown !== null && armShown < radius - 0.01,
      minimum: config && armActive() ? minimumArm() : null,
      lift: outsideLift,
    },
    cameraCollision: cameraField?.evidence() ?? null,
    cameraInertia: inertia.evidence(),
    cameraClip: { near: perspective.near, far: perspective.far, fogNear: scene.fog?.near ?? null, fogFar: scene.fog?.far ?? null },
    panReach: config ? panReach() : null,
    target: target.toArray(),
    currentRecord,
    spinning,
    recordMechanics: recordMotion.evidence(),
    displayedVinylRecord,
    vinylCuePending: pendingVinylRecord !== null,
    vinylTransfer,
    dropped: [...dropped],
    focused: container.dataset.focusedDeskObject || null,
    inspection: animalFocus ? { id: animalFocus.id, name: animalFocus.name, radius: animalFocus.radius, arrival: animalFocus.arrival } : null,
    neighbours: (pacific?.neighbours() || []).map(({ id, name, worldCenter, radius, faceAnchorSource }) => {
      const projected = new THREE.Vector3(...worldCenter).project(camera);
      return {
        id,
        name,
        worldCenter,
        radius,
        faceAnchorSource,
        projected: { x: (projected.x + 1) / 2, y: (1 - projected.y) / 2, depth: projected.z },
      };
    }),
    canvasWidth: renderer?.domElement.width,
    canvasHeight: renderer?.domElement.height,
    resolution: resolution?.evidence() ?? null,
    detail: detail ? { ...detail, shadowMap: sun.shadow.mapSize.x } : null,
    walk: walkMode?.evidence() ?? null,
    shadowCache: shadowCache?.evidence() ?? null,
    furniture: furniture?.evidence() ?? null,
    prop: selectedProp
      ? {
          kind: selectedProp.userData.kind,
          position: selectedProp.getWorldPosition(new THREE.Vector3()).toArray(),
          size: new THREE.Box3().setFromObject(selectedProp).getSize(new THREE.Vector3()).toArray(),
          ancestorsVisible: (() => {
            let o = selectedProp;
            while (o) {
              if (!o.visible) return false;
              o = o.parent;
            }
            return true;
          })(),
        }
      : null,
    targets: picks
      .filter((o) => o.visible && o.parent)
      .map((o) => {
        const point = o.getWorldPosition(new THREE.Vector3()).project(camera);
        return { ...o.userData.action, x: (point.x + 1) / 2, y: (1 - point.y) / 2 };
      }),
    joints: actor
      ? Object.fromEntries(
          (() => {
            const a = [];
            actor.traverse((o) => {
              if (o.isBone && /Root|Hips|Hand|Foot|Head/.test(o.name)) a.push([o.name, o.getWorldPosition(new THREE.Vector3()).toArray()]);
            });
            return a;
          })()
        )
      : {},
  });

  return {
    preload() {
      /* Scene assets are requested only after choosing 3D. */
    },
    async setVisible(value) {
      visible = value;
      if (!value) companion.paused = false;
      container.classList.toggle("is-visible", value);
      container.setAttribute("aria-hidden", String(!value));
      ui.hidden = !value;
      ui.inert = !value;
      if (!value) fullscreen.exit();
      if (value) {
        try {
          await initialize();
          if (disposed) return;
          resize();
          resumeRoutine();
          requestFrame();
        } catch {
          /* The 2D recovery event handles this. */
        }
      } else cancelFrame();
    },
    setActiveRecord(index) {
      if (currentRecord !== index) {
        if (spinning && !reduced) recordMotion.cue(true);
        pendingVinylRecord = index;
      }
      currentRecord = index;
      if (renderer) updateRecords();
    },
    setSpinning(value) {
      spinning = value;
      recordMotion.setPlaying(value);
      if (value && pendingVinylRecord !== null && !reduced) recordMotion.cue(true);
      if (reduced) recordMotion.compose();
      container.dataset.recordSpinning = String(value);
      requestFrame();
    },
    setDroppedRecords(indices) {
      dropped = [...indices];
      if (renderer) updateRecords();
    },
    setCallbacks(value) {
      callbacks = value;
    },
    resetView() {
      clearFocus();
      setRoom("study");
    },
    setStyle,
    setAvatar,
    setRoom,
    setTimePreview(minute) {
      explore.setTime(minute);
      followClock = false;
      updateRoutine(true);
    },
    returnToNow() {
      explore.now();
      followClock = true;
      updateRoutine(true);
    },
    dispose() {
      disposed = true;
      avatarTicket++;
      cancelFrame();
      clearInterval(clockTimer);
      clearTimeout(backgroundTimer);
      cleanup.forEach((fn) => fn());
      modelRequests.forEach((request) => request.abort());
      lightBakeAbort.abort();
      staticLightField?.dispose();
      mixer?.stopAllAction();
      characterPerformance?.dispose();
      onsenWater?.dispose();
      warmPracticals?.dispose();
      steamVolume?.dispose();
      skinDiffusion?.dispose();
      coastalWind?.dispose();
      curtainRig?.dispose();
      [...world.children].forEach(release);
      resources.forEach((r) => r.dispose());
      art.dispose();
      pacific?.dispose();
      finish?.dispose();
      decoder.dispose();
      renderer?.dispose();
      renderer?.domElement.remove();
      delete container.getSceneEvidence;
    },
  };
}
