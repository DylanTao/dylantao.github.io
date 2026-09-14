import * as THREE from "../three.module.min.js";
import { createModelLoader } from "./model-loader.mjs";
import { createArtDirection } from "./materials.mjs";
import { createPacific } from "./environment.mjs";
import { createFinish, physicalTime } from "./realism.mjs";
import { createExplorationState, resolveRoutine, formatMinute, chooseArrivalAvatar } from "./routine.mjs";

import { createFootContacts } from "./locomotion.mjs";
import { roomRoute, sampleRoute } from "./navigation.mjs";
import { createWorldCompanion } from "./companion.mjs";
import { companion, pipProjectUrl } from "../companion/bridge.mjs";

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

export function createCoastalHome(container, records, artifacts) {
  const stage = container.closest("[data-home-artifact-stage]");
  const ui = stage.querySelector("[data-home-world-controls]");
  const status = ui.querySelector("[data-world-status]");
  const clockLabel = ui.querySelector("[data-world-clock]");
  const explore = createExplorationState();
  const { loader, decoder } = createModelLoader();
  const art = createArtDirection();
  const scene = new THREE.Scene();
  const world = new THREE.Group();
  scene.add(world);
  const perspective = new THREE.PerspectiveCamera(38, 1, 0.05, 300);
  const orthographic = new THREE.OrthographicCamera(-3, 3, 3, -3, 0.05, 300);
  let camera = orthographic,
    aspect = 1,
    pacific,
    finish;
  const target = new THREE.Vector3(0, 0.7, 0),
    desiredTarget = target.clone();
  let yaw = 0.36,
    pitch = 0.75,
    radius = 8.0,
    desiredRadius = radius;
  let cameraYaw = yaw,
    cameraPitch = pitch;
  let config,
    renderer,
    initPromise,
    disposed = false,
    visible = false,
    inViewport = true;
  let frame = 0,
    lastFrame = 0,
    elapsed = 0,
    frames = 0,
    clockTimer = 0;
  // The other directions are deferred experiments, never a remembered public default.
  let style = "realistic";
  const labEnabled = new URLSearchParams(location.search).get("scene-lab") === "1";
  let avatarId,
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
    travel = null,
    footContacts,
    worldCompanion,
    actorGoal = null;
  let pointer = null,
    followClock = true,
    selectedProp,
    propHand,
    vinyl,
    tonearm,
    water,
    portraitMaterial;
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
  const modelRequests = new Set();
  let reduced = reducedQuery.matches;
  const hemi = new THREE.HemisphereLight(0xe5ecff, 0xb28d57, 2.8);
  const sun = new THREE.DirectionalLight(0xffe0aa, 3.2);
  sun.position.set(-4, 9, 5);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -10, right: 10, top: 10, bottom: -10, near: 0.1, far: 65 });
  sun.shadow.bias = -0.00005;
  sun.shadow.normalBias = 0.07;
  sun.shadow.radius = 3;
  const lamp = new THREE.PointLight(0xffbf6b, 4, 6);
  lamp.position.set(-0.95, 4.2, 2.7);
  scene.add(hemi, sun, lamp);
  const practicals = [
    [-4.13, 3.47, 2.47],
    [-3.3, 1.95, -0.04],
    [2.14, 1.1, -1.58],
  ].map((position) => {
    const light = new THREE.PointLight(0xffc286, 1, 4.8, 2);
    light.position.set(...position);
    scene.add(light);
    return light;
  });

  function listen(targetObject, event, fn, options) {
    targetObject.addEventListener(event, fn, options);
    cleanup.push(() => targetObject.removeEventListener(event, fn, options));
  }

  function own(resource) {
    resources.add(resource);
    return resource;
  }

  async function loadModel(url) {
    const abort = new AbortController();
    modelRequests.add(abort);
    try {
      const response = await fetch(url, { signal: abort.signal });
      if (!response.ok) throw new Error(`Model unavailable: ${response.status}`);
      return await loader.parseAsync(await response.arrayBuffer(), new URL(".", url).href);
    } finally {
      modelRequests.delete(abort);
    }
  }

  function material(color, extra = {}) {
    return own(new THREE.MeshStandardMaterial({ color, roughness: 0.72, ...extra }));
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
    const tex = new THREE.TextureLoader().load(url, requestFrame, undefined, () => {
      /* Keep the colored surface if an optional picture fails. */
    });
    tex.colorSpace = THREE.SRGBColorSpace;
    textureCache.set(url, tex);
    return own(tex);
  }

  function roomPoint(id, point) {
    const offset = config.rooms.find((r) => r.id === id)?.offset || [0, 0, 0];
    return point.map((v, i) => v + offset[i]);
  }

  function makeDeskObjects() {
    const previousObjects = new Set(world.children);
    const cream = material(0xf4ecd8),
      ink = material(0x252c29);
    mesh(new THREE.BoxGeometry(0.68, 0.07, 0.43), material(0x71512b), [0.84, 0.91, -2.18]);
    vinyl = mesh(new THREE.CylinderGeometry(0.19, 0.19, 0.017, 48), ink, [0.83, 0.956, -2.17], { type: "spin" });
    const label = new THREE.Mesh(own(new THREE.CircleGeometry(0.063, 32)), material(0xc8834b));
    label.rotation.x = -Math.PI / 2;
    label.position.y = 0.011;
    vinyl.add(label);
    tonearm = mesh(new THREE.BoxGeometry(0.025, 0.025, 0.27), material(0xc9b587, { metalness: 0.6 }), [1.07, 0.99, -2.15]);
    for (let i = 0; i < records.length; i++) {
      const face = material(0xffffff, { map: imageTexture(records[i].cover) });
      const sleeve = mesh(new THREE.BoxGeometry(0.34, 0.35, 0.025), [cream, cream, cream, cream, face, cream], [-1.22, 1.68, -2.14 + i * 0.36], {
        type: "record",
        index: i,
      });
      sleeve.rotation.y = Math.PI / 2 + 0.08;
      sleeve.userData.home = { position: sleeve.position.clone(), rotation: sleeve.rotation.clone(), scale: sleeve.scale.clone() };
      sleeves.push(sleeve);
    }
    artifacts.forEach((a, index) => {
      const face = material(0xffffff, { map: labelTexture(a.title, a.label) });
      const paper = mesh(new THREE.BoxGeometry(0.29, 0.4, 0.009), [cream, cream, cream, cream, face, cream], [-0.72 + index * 0.35, 0.884, -2.16], {
        type: "artifact",
        index,
      });
      paper.rotation.set(-Math.PI / 2, 0, index * 0.11 - 0.1);
      paper.userData.home = { position: paper.position.clone(), rotation: paper.rotation.clone(), scale: paper.scale.clone() };
      paperItems.push(paper);
    });
    const glass = mesh(
      new THREE.PlaneGeometry(2.45, 2.3),
      material(0xbee0dc, { transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false }),
      [0, 1.3, -3.13],
      { type: "window" }
    );
    glass.castShadow = false;
    glass.userData.noOcclusion = true;
    // Move all interactive desk objects with the upper study, including their
    // stored return positions. Album identity stays independent of room layout.
    world.children
      .filter((o) => !previousObjects.has(o))
      .forEach((o) => {
        o.position.fromArray(roomPoint("study", o.position.toArray()));
        if (o.userData.home) o.userData.home.position.copy(o.position);
      });
    // One informal capybara print for the home, independent of its inhabitant.
    mesh(new THREE.BoxGeometry(0.88, 0.88, 0.035), material(0xb68b59), [-3.15, 1.38, 0.215]);
    mesh(new THREE.BoxGeometry(0.82, 0.82, 0.039), cream, [-3.15, 1.38, 0.209]);
    portraitMaterial = material(0xffffff, { roughness: 0.9, map: imageTexture(new URL(config.wallArt.file, manifestUrl).href) });
    const portrait = mesh(new THREE.PlaneGeometry(0.73, 0.73), portraitMaterial, [-3.15, 1.38, 0.186]);
    portrait.rotation.y = Math.PI;
    portrait.name = "Capybara beach party print";
    portrait.userData.fixedMaterial = true;
    updateRecords();
  }

  function prepareModel(root) {
    root.traverse((o) => {
      if (o.isMesh) {
        o.castShadow = o.receiveShadow = true;
      }
      if (o.userData.renderStyle) o.visible = o.userData.renderStyle === style;
    });
    art.apply(root, style);
    return root;
  }

  async function loadRoom(id) {
    if (rooms.has(id)) return rooms.get(id);
    if (pendingRooms.has(id)) return pendingRooms.get(id);
    const entry = config.rooms.find((r) => r.id === id);
    if (!entry) return null;
    const pending = loadModel(new URL(entry.file, manifestUrl).href)
      .then((gltf) => {
        if (disposed) {
          release(gltf.scene);
          return null;
        }
        const root = prepareModel(gltf.scene);
        root.name = `room-${id}`;
        world.add(root);
        rooms.set(id, root);
        root.traverse((o) => {
          if (o.isMesh && o.name.startsWith("onsen_water")) {
            water = o;
            water.userData.restY = water.position.y;
          }
        });
        requestFrame();
        return root;
      })
      .finally(() => pendingRooms.delete(id));
    pendingRooms.set(id, pending);
    return pending;
  }

  function release(root) {
    art.forget(root);
    root.traverse((o) => {
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
    root.removeFromParent();
  }

  async function setAvatar(id) {
    if (!config) return;
    const entry = config.avatars.find((a) => a.id === id) || config.avatars[0];
    const ticket = ++avatarTicket;
    ui.setAttribute("aria-busy", "true");
    try {
      const gltf = await loadModel(new URL(entry.file, manifestUrl).href);
      if (disposed || ticket !== avatarTicket) {
        release(gltf.scene);
        return;
      }
      if (actor) {
        mixer.stopAllAction();
        mixer.uncacheRoot(actor);
        release(actor);
      }
      actor = prepareModel(gltf.scene);
      actor.name = "active-Sirui";
      footContacts = createFootContacts(actor, config.terrain);
      world.add(actor);
      mixer = new THREE.AnimationMixer(actor);
      actions = new Map(gltf.animations.map((clip) => [clip.name, mixer.clipAction(clip)]));
      currentAction = null;
      selectedProp = null;
      avatarId = entry.id;
      container.dataset.avatar = avatarId;
      remember("sirui-scene-avatar", avatarId);
      ui.querySelector("[data-world-avatar]").value = avatarId;
      updateRoutine(true);
    } catch (error) {
      status.textContent = "This character couldn’t load. Try another.";
      ui.querySelector("[data-world-avatar]").value = avatarId;
      if (!actor) throw error;
    } finally {
      if (ticket === avatarTicket) ui.removeAttribute("aria-busy");
    }
  }

  function playClip(name) {
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
      else next.crossFadeFrom(currentAction, 0.35, false);
    }
    currentAction = next;
    container.dataset.animation = name;
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

  function updateLight() {
    if (!routine) return;
    const evening = routine.palette === "evening";
    hemi.color.set(evening ? 0x97b2dc : 0xffead1);
    hemi.groundColor.set(evening ? 0x473426 : 0x8b7659);
    hemi.intensity = style === "realistic" ? (evening ? 0.65 : 0.62) : 1.5;
    sun.color.set(style === "illustrated" ? (evening ? 0xc7a1ef : 0xffc773) : evening ? 0xb6c4f1 : 0xffe2b0);
    sun.intensity = evening ? 1.05 : style === "realistic" ? 2.05 : 2.5;
    // Light enters the carved Pacific opening; a lamp warms the occupied desk.
    sun.position.set(routine.palette === "afternoon" ? -24 : 20, evening ? 16 : 22, -12);
    lamp.intensity = evening ? 5.5 : 0.9;
    practicals.forEach((light) => (light.intensity = evening ? 2.7 : 0.7));
    pacific?.setPalette(routine.palette);
    pacific?.setActivity(routine.id);
    container.dataset.scenePalette = routine.palette;
  }

  function wardrobe() {
    if (!actor) return;
    let skin;
    actor.traverse((o) => {
      if (o.isMesh && !o.userData.outline) skin ||= [o.userData.baseMaterial || o.material].flat().find((m) => m.name === "skin");
    });
    if (!skin) return;
    actor.traverse((o) => {
      if (!o.isMesh || o.userData.outline) return;
      const base = [o.userData.baseMaterial || o.material].flat();
      [o.material].flat().forEach((m) => {
        if (m.name !== "Sirui shirt") return;
        m.color.copy(routine?.id === "soak" ? skin.color : base.find((b) => b.name === "Sirui shirt").color);
        if (m.isMeshStandardMaterial) m.roughness = routine?.id === "soak" ? 0.48 : 0.9;
      });
    });
  }

  function updateRoutine(force = false) {
    if (!config) return;
    const next = resolveRoutine(config, new Date(), explore.preview);
    const changed = !routine || routine.id !== next.id || routine.prop !== next.prop || routine.clip !== next.clip;
    routine = next;
    clockLabel.textContent = `${routine.live ? "" : "Preview · "}${formatMinute(routine.minute)} · San Diego`;
    ui.querySelector("[data-world-now]").setAttribute("aria-pressed", String(explore.following && followClock));
    status.textContent = routine.label;
    container.dataset.activity = routine.id;
    container.dataset.clockMode = routine.live ? "now" : "preview";
    ui.querySelector("[data-world-time]").value = routine.minute;
    ui.querySelector("[data-world-activity]").value = routine.id;
    updateLight();
    wardrobe();
    if ((changed || force) && actor) {
      const room = config.rooms.find((r) => r.id === routine.room);
      const goal = new THREE.Vector3(...room.actor);
      loadRoom(room.id).catch(() => {
        status.textContent = "Room detail unavailable. You can still explore.";
      });
      if (actorGoal && !force && actor.position.distanceTo(goal) > 0.5 && !reduced && !paused && visible && inViewport) {
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
    if (reduced || paused) mixer?.update(0);
    requestFrame();
  }

  function updateRecords() {
    container.dataset.activeDeskRecord = String(currentRecord);
    container.dataset.recordSpinning = String(spinning);
    container.dataset.droppedRecords = dropped.join(",");
    sleeves.forEach((s, i) => {
      s.visible = !dropped.includes(i);
    });
    if (tonearm) tonearm.rotation.y = spinning ? -0.6 : 0.12;
    floorCards.forEach((o) => {
      const p = picks.indexOf(o);
      if (p >= 0) picks.splice(p, 1);
      release(o);
    });
    floorCards.length = 0;
    dropped.forEach((index, i) => {
      const face = material(0xffffff, { map: imageTexture(records[index].cover) });
      const card = mesh(
        new THREE.BoxGeometry(0.36, 0.43, 0.012),
        [material(0xece1c7), face, face, face, face, face],
        roomPoint("study", [-0.82 + i * 0.42, 0.024 + i * 0.002, -0.2 + (i % 2) * 0.09]),
        { type: "source", index }
      );
      card.rotation.set(-Math.PI / 2, 0, (i - 1.5) * 0.14);
      floorCards.push(card);
    });
    requestFrame();
  }

  function clearFocus() {
    if (focused?.userData.home) {
      const home = focused.userData.home;
      focused.position.copy(home.position);
      focused.rotation.copy(home.rotation);
      focused.scale.copy(home.scale);
    }
    focused = null;
    container.removeAttribute("data-focused-desk-object");
    container.dataset.deskView = currentRoom === "outside" ? "outside" : "room";
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
    o.position.fromArray(roomPoint("study", [0.05, 1.45, -0.7]));
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
    if (manual) {
      explore.explore();
      followClock = false;
    }
    currentRoom = id;
    const shadowExtent = id === "outside" ? 36 : 10;
    Object.assign(sun.shadow.camera, { left: -shadowExtent, right: shadowExtent, top: shadowExtent, bottom: -shadowExtent, far: 160 });
    sun.shadow.normalBias = id === "outside" ? 0.12 : 0.04;
    sun.shadow.camera.updateProjectionMatrix();
    sun.shadow.needsUpdate = true;
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
      loadRoom(id).catch(() => {});
    }
    if (reduced) {
      target.copy(desiredTarget);
      radius = desiredRadius;
    }
    ui.querySelectorAll("[data-world-room]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.worldRoom === id)));
    requestFrame();
  }

  function setStyle(next) {
    if (!["architectural", "realistic", "illustrated"].includes(next)) return;
    if (!labEnabled && next !== "realistic") return;
    style = next;
    remember("sirui-scene-style", style);
    camera = style === "realistic" ? perspective : orthographic;
    if (renderer) renderer.toneMappingExposure = style === "realistic" ? 1.05 : 1.18;
    world.traverse((o) => {
      if (o.userData.renderStyle) o.visible = o.userData.renderStyle === style;
    });
    art.apply(world, style);
    pacific?.setStyle(style);
    updateLight();
    wardrobe();
    container.dataset.renderStyle = style;
    ui.querySelectorAll("[data-world-style]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.worldStyle === style)));
    requestFrame();
  }

  const ray = new THREE.Raycaster();
  function pick(event) {
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
    return bot && (!hit || bot.distance < hit.distance) ? bot.object : hit?.object;
  }

  function activate(o) {
    const a = o?.userData.action;
    if (!a) return;
    if (a.type === "pip") location.assign(pipProjectUrl);
    else if (a.type === "record" || a.type === "artifact") focusObject(o);
    else if (a.type === "spin") callbacks.toggleSpin?.();
    else if (a.type === "window") setRoom("outside");
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
      if (b.dataset.worldStyle) setStyle(b.dataset.worldStyle);
      if (b.dataset.worldRoom) setRoom(b.dataset.worldRoom);
      if (b.dataset.worldZoom) {
        explore.explore();
        followClock = false;
        desiredRadius = clamp(desiredRadius + (b.dataset.worldZoom === "in" ? -0.6 : 0.6), 3.7, 32);
        requestFrame();
      }
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
        if (paused && travel) {
          actor.position.copy(travel.goal);
          actor.rotation.y = travel.facing;
          travel = null;
          playClip(routine.clip);
          propFor(routine.prop);
        }
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
    canvas.setAttribute(
      "aria-label",
      "Sirui’s coastal home. Drag or use arrow keys to look around, plus and minus to zoom, D to discover a record, Escape to return inside."
    );
    listen(canvas, "pointerdown", (e) => {
      if (e.button !== 0) return;
      if (e.pointerType === "touch") {
        touches.set(e.pointerId, [e.clientX, e.clientY]);
        if (touches.size === 2) {
          const [a, b] = [...touches.values()];
          pinch = { distance: Math.hypot(a[0] - b[0], a[1] - b[1]), radius: desiredRadius };
          pointer = null;
          canvas.setPointerCapture(e.pointerId);
          return;
        }
      }
      pointer = { id: e.pointerId, x: e.clientX, y: e.clientY, lastX: e.clientX, lastY: e.clientY, object: pick(e), moved: 0 };
      canvas.setPointerCapture(e.pointerId);
      explore.explore();
      followClock = false;
    });
    listen(canvas, "pointermove", (e) => {
      if (touches.has(e.pointerId)) touches.set(e.pointerId, [e.clientX, e.clientY]);
      if (pinch && touches.size === 2) {
        const [a, b] = [...touches.values()];
        desiredRadius = clamp((pinch.radius * pinch.distance) / Math.max(15, Math.hypot(a[0] - b[0], a[1] - b[1])), 3.7, 32);
        requestFrame();
        return;
      }
      if (!pointer) {
        canvas.style.cursor = pick(e) ? "pointer" : "grab";
        return;
      }
      pointer.moved = Math.hypot(e.clientX - pointer.x, e.clientY - pointer.y);
      if (pointer.moved > 5) {
        yaw -= (e.clientX - pointer.lastX) * 0.008;
        pitch = clamp(pitch + (e.clientY - pointer.lastY) * 0.006, 0.2, 1.25);
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
      if (pointer.moved < 6) activate(pointer.object);
      else if (pointer.moved > 70 && pointer.object?.userData.action.type === "record") dropRecord(pointer.object.userData.action.index);
      pointer = null;
    });
    listen(canvas, "pointercancel", () => {
      pointer = null;
      pinch = null;
      touches.clear();
    });
    listen(
      canvas,
      "wheel",
      (e) => {
        if (document.activeElement !== canvas && !pointer) return;
        e.preventDefault();
        explore.explore();
        followClock = false;
        if (focused) clearFocus();
        desiredRadius = clamp(desiredRadius + e.deltaY * 0.007, 3.7, 32);
        requestFrame();
      },
      { passive: false }
    );
    listen(canvas, "keydown", (e) => {
      const keys = {
        ArrowLeft: () => (yaw += 0.18),
        ArrowRight: () => (yaw -= 0.18),
        ArrowUp: () => (pitch = clamp(pitch + 0.1, 0.2, 1.25)),
        ArrowDown: () => (pitch = clamp(pitch - 0.1, 0.2, 1.25)),
        "+": () => (desiredRadius = Math.max(3.7, desiredRadius - 0.5)),
        "=": () => (desiredRadius = Math.max(3.7, desiredRadius - 0.5)),
        "-": () => (desiredRadius = Math.min(32, desiredRadius + 0.5)),
        Escape: () => setRoom("study"),
        Enter: () => focused && activate(focused),
        d: () => {
          if (dropped.length === records.length) records.forEach((_, i) => callbacks.dropRecord?.(i));
          else dropRecord(records.findIndex((_, i) => !dropped.includes(i)));
        },
      };
      keys.D = keys.d;
      if (keys[e.key]) {
        e.preventDefault();
        explore.explore();
        followClock = false;
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
        updateRoutine(true);
        requestFrame();
      }
    });
    listen(window, "pagehide", () => {
      visible = false;
      cancelFrame();
      modelRequests.forEach((request) => request.abort());
    });
    listen(window, "pageshow", (event) => {
      if (event.persisted && stage.dataset.deskMode === "3d") {
        visible = true;
        resize();
        updateRoutine(true);
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
    renderer.setSize(rect.width, rect.height, false);
    aspect = rect.width / rect.height;
    perspective.aspect = aspect;
    perspective.updateProjectionMatrix();
    finish?.resize(rect.width, rect.height);
    requestFrame();
  }

  function cancelFrame() {
    if (frame) cancelAnimationFrame(frame);
    frame = 0;
    lastFrame = 0;
  }
  function requestFrame() {
    if (!frame && renderer && visible && inViewport && !document.hidden && !disposed) frame = requestAnimationFrame(render);
  }

  function render(now) {
    frame = 0;
    if (!visible || !inViewport || disposed || document.hidden) return;
    // Routes, clips, and water are sampled in time; capping their clock makes
    // every journey run in slow motion on a software renderer. Pause, reduced
    // motion, and visibility recovery reset lastFrame before animation resumes.
    const delta = lastFrame ? Math.max((now - lastFrame) / 1000, 0) : 1 / 60;
    const frameDelta = Math.min(delta, 1);
    lastFrame = now;
    const moving = !reduced && !paused;
    if (moving) elapsed += delta;
    physicalTime.value = elapsed;
    // Camera settling follows elapsed time, including on software renderers.
    // Pausing leaves a composed still instead of an unfinished camera journey.
    const cameraEase = reduced || paused ? 1 : 1 - Math.exp(-frameDelta * 9);
    const orbitEase = reduced || paused ? 1 : 1 - Math.exp(-frameDelta * 15);
    target.lerp(desiredTarget, cameraEase);
    radius = THREE.MathUtils.lerp(radius, desiredRadius, cameraEase);
    const yawDelta = Math.atan2(Math.sin(yaw - cameraYaw), Math.cos(yaw - cameraYaw));
    cameraYaw += yawDelta * orbitEase;
    cameraPitch = THREE.MathUtils.lerp(cameraPitch, pitch, orbitEase);
    camera.position.set(
      target.x + Math.sin(cameraYaw) * Math.cos(cameraPitch) * radius,
      target.y + Math.sin(cameraPitch) * radius,
      target.z + Math.cos(cameraYaw) * Math.cos(cameraPitch) * radius
    );
    if (camera.isOrthographicCamera) {
      const half = radius * Math.tan((38 * Math.PI) / 360);
      camera.left = -half * aspect;
      camera.right = half * aspect;
      camera.top = half;
      camera.bottom = -half;
      camera.updateProjectionMatrix();
    }
    camera.lookAt(target);
    world.traverse((o) => {
      if (o.userData.caveRoof)
        o.visible =
          currentRoom === "outside" ||
          (currentRoom !== "overview" &&
            camera.position.y < 4.9 &&
            camera.position.z < 4.8 &&
            camera.position.z > -4.7 &&
            Math.abs(camera.position.x) < 4.4);
    });
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
      }
    }
    if (vinyl && spinning && moving) vinyl.rotation.y += delta * 0.75;
    if (water && moving) water.position.y = water.userData.restY + Math.sin(elapsed * 0.7) * 0.006;
    if (moving) pacific?.update(elapsed);
    companion.paused = paused;
    worldCompanion?.update(Math.min(delta, 0.25), elapsed, camera, currentRoom, moving);
    orientProp();
    renderer.info.reset();
    pacific?.reflect(camera, style === "realistic" && currentRoom === "outside");
    if (style === "realistic" && finish) finish.render(camera, currentRoom === "outside");
    else renderer.render(scene, camera);
    frames++;
    if (
      moving ||
      target.distanceTo(desiredTarget) > 0.003 ||
      Math.abs(radius - desiredRadius) > 0.003 ||
      Math.abs(yawDelta * (1 - orbitEase)) > 0.003 ||
      Math.abs(cameraPitch - pitch) > 0.003
    )
      requestFrame();
  }

  function fail(message) {
    cancelFrame();
    container.dataset.sceneState = "failed";
    status.textContent = message;
    container.dispatchEvent(new CustomEvent("home-scene-unavailable", { bubbles: true }));
  }

  async function initialize() {
    if (initPromise) return initPromise;
    initPromise = (async () => {
      container.dataset.sceneState = "loading";
      const response = await fetch(manifestUrl);
      if (!response.ok) throw new Error("Scene manifest unavailable");
      config = await response.json();
      if (disposed) return;
      renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: "low-power" });
      renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.18;
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      renderer.info.autoReset = false;
      finish = createFinish(renderer, scene, perspective);
      container.append(renderer.domElement);
      const shell = await loadModel(new URL(config.shell, manifestUrl).href);
      if (disposed) {
        release(shell.scene);
        return;
      }
      world.add(prepareModel(shell.scene));
      pacific = createPacific(scene, renderer, config);
      const coast = await loadModel(new URL(config.coast, manifestUrl).href);
      if (disposed) {
        release(coast.scene);
        return;
      }
      world.add(prepareModel(coast.scene));
      worldCompanion = await createWorldCompanion(scene, config, container, loader).catch(() => null);
      if (disposed) {
        worldCompanion?.dispose();
        return;
      }
      cleanup.push(() => worldCompanion?.dispose());
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
      bindControls();
      const resizeObserver = new ResizeObserver(resize);
      resizeObserver.observe(container);
      cleanup.push(() => resizeObserver.disconnect());
      const viewportObserver = new IntersectionObserver((entries) => {
        inViewport = entries[0].isIntersecting;
        if (inViewport) {
          lastFrame = 0;
          updateRoutine(true);
          requestFrame();
        } else cancelFrame();
      });
      viewportObserver.observe(container);
      cleanup.push(() => viewportObserver.disconnect());
      updateRoutine();
      await Promise.all([loadRoom(routine.room), setAvatar(avatarId)]);
      if (disposed) return;
      setStyle(style);
      resize();
      container.dataset.sceneState = "ready";
      clockTimer = window.setInterval(() => {
        if (visible && !document.hidden) updateRoutine();
      }, 30000);
      // Nonoccupied rooms stream after the meaningful first frame, sharing the shell.
      setTimeout(() => {
        if (!disposed && visible) config.rooms.forEach((r) => loadRoom(r.id).catch(() => {}));
      }, 1800);
      requestFrame();
    })().catch((error) => {
      fail("3D couldn’t load. The 2D desk is ready.");
      throw error;
    });
    return initPromise;
  }

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
    palette: routine?.palette,
    clockMode: routine?.live ? "now" : "preview",
    following: explore.following && followClock,
    animation: container.dataset.animation,
    animations: actions ? [...actions.keys()] : [],
    roomCount: rooms.size,
    actorCount: actor ? 1 : 0,
    frames,
    drawCalls: renderer?.info.render.calls,
    triangles: renderer?.info.render.triangles,
    resources: renderer ? { ...renderer.info.memory } : {},
    projection: camera.isOrthographicCamera ? "orthographic" : "perspective",
    coastDetail: style,
    companion: worldCompanion?.evidence(),
    ecology: pacific?.evidence(),
    rendering: finish?.evidence,
    backdropImages: 0,
    camera: camera.position.toArray(),
    target: target.toArray(),
    currentRecord,
    spinning,
    dropped: [...dropped],
    focused: container.dataset.focusedDeskObject || null,
    canvasWidth: renderer?.domElement.width,
    canvasHeight: renderer?.domElement.height,
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
      if (value) {
        try {
          await initialize();
          resize();
          updateRoutine(true);
          requestFrame();
        } catch {
          /* The 2D recovery event handles this. */
        }
      } else cancelFrame();
    },
    setActiveRecord(index) {
      currentRecord = index;
      if (renderer) updateRecords();
    },
    setSpinning(value) {
      spinning = value;
      if (tonearm) tonearm.rotation.y = spinning ? -0.6 : 0.12;
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
      cleanup.forEach((fn) => fn());
      modelRequests.forEach((request) => request.abort());
      mixer?.stopAllAction();
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
