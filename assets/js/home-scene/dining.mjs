import * as THREE from "../three.module.min.js";
import { menuFor, courseFor, DRINKS } from "./dining-menu.mjs";
import { planMeal, mealPose, eveningPose, stillTime, hashString } from "./dining-motion.mjs";
import { COFFEE_TIMELINE, coffeeTableClock } from "./activities.mjs";
import { resolveRoutine } from "./routine.mjs";

// Meals and drinks at their settings (Sirui, 2026-10-24: "i don't even see food, you should prep
// differnt gormetn food and drink and deserts for differnt day and design better aniaiton").
//
// - dining-menu.mjs chooses today's dishes and drinks by Pacific date.
// - assets/models/home/table-setting/ holds the plated dishes, tableware and glassware
//   (bin/build_coastal_table_setting.py) at a default and a fine level; its index.json describes
//   the grips, the bite pieces, the vessels' inner profiles, each setting's layout and each
//   avatar's mouth.
// - dining-motion.mjs plans the meal and gives its pose at a time. This module applies it: a lean
//   and head turn after the authored clip, a two-bone arm solve to the utensil or glass, the pieces
//   leaving the plate, the liquid level, and the coffee bar's own cup at breakfast.
//
// Contract with the controller: pose() runs after the mixer and before characterPerformance, and
// never moves the actor or changes its clip; props() runs after the controller has placed the
// coffee cup. Paused, both hold. Reduced motion composes one still from the plan, the same on every
// redraw. While the visitor walks (first person) or Sirui travels, the cutlery and glass rest on
// the table. A setting is drawn only during its own activity and nothing loads before a meal needs
// it. Materials reuse the house's families (porcelain, nickel, linen, glass transparency), so the
// setting adds no shader programs; food carries its colour in vertices.

const TAU = Math.PI * 2;
const v3 = () => new THREE.Vector3();
const q4 = () => new THREE.Quaternion();
const MEALS = new Set(["breakfast", "lunch", "dinner", "lounge"]);
// The controller's primitive props replaced by modelled ones.
const PROVIDED = new Set(["fork", "coffee", "whiskey", "cocktail", "beer"]);
const UP = new THREE.Vector3(0, 1, 0);

const immersive = () => typeof document !== "undefined" && document.documentElement.classList.contains("is-world-immersive");

export function createDining({
  config,
  baseUrl,
  loadModel,
  prepare = (root) => root,
  requestFrame = () => {},
  roomRoot = () => null,
  fetchIndex = (url) => fetch(url).then((response) => (response.ok ? response.json() : null)),
} = {}) {
  let index = null,
    indexState = "idle",
    indexReady = Promise.resolve(null),
    disposed = false,
    setting = null,
    rig = null,
    last = null,
    barCup = null; // the coffee bar's cup, which the controller owns and props() places
  const models = new Map(); // file -> { state, source, promise }
  const raycaster = new THREE.Raycaster();
  const box = new THREE.Box3();

  function loadIndex() {
    if (indexState !== "idle") return indexReady;
    indexState = "loading";
    indexReady = Promise.resolve()
      .then(() => fetchIndex(new URL("table-setting/index.json", baseUrl).href))
      .then((data) => {
        index = data && data.version === 1 && data.dishes && data.tableware ? data : null;
        indexState = index ? "ready" : "failed";
        requestFrame();
        return index;
      })
      .catch(() => {
        indexState = "failed";
        return null;
      });
    return indexReady;
  }

  function model(file) {
    let entry = models.get(file);
    if (entry) return entry;
    entry = { state: "loading", source: null };
    models.set(file, entry);
    entry.promise = Promise.resolve()
      .then(() => loadModel(new URL(`table-setting/${file}`, baseUrl).href))
      .then((gltf) => {
        if (disposed || !gltf?.scene) throw new Error("released");
        // The house's surfaces carry RGBA vertex colour. Some setting exports carry RGB, which would
        // compile program variants of their own; these copies take an opaque alpha instead.
        gltf.scene.traverse((o) => {
          const color = o.isMesh && o.geometry.attributes.color;
          if (!color || color.itemSize !== 3) return;
          const rgba = new Float32Array(color.count * 4);
          for (let i = 0; i < color.count; i++) rgba.set([color.getX(i), color.getY(i), color.getZ(i), 1], i * 4);
          o.geometry.setAttribute("color", new THREE.BufferAttribute(rgba, 4));
        });
        entry.source = gltf.scene;
        entry.state = "ready";
        requestFrame();
        return entry;
      })
      .catch(() => {
        entry.state = "failed";
        return entry;
      });
    return entry;
  }

  // ── The seat and its table ─────────────────────────────────────────────────────────────────────
  function seatFrame(roomId) {
    const room = config?.rooms?.find((r) => r.id === roomId);
    if (!room) return null;
    const quaternion = new THREE.Quaternion().setFromAxisAngle(UP, room.facing || 0);
    const matrix = new THREE.Matrix4().compose(new THREE.Vector3(...room.actor), quaternion, new THREE.Vector3(1, 1, 1));
    return { room, matrix, quaternion, inverse: matrix.clone().invert() };
  }
  // The room's own surface under a seat-frame point (x, z), found by its triangles.
  function surfaceUnder(root, frame, x, z, expected) {
    if (!root) return null;
    raycaster.set(new THREE.Vector3(x, expected + 0.5, z).applyMatrix4(frame.matrix), new THREE.Vector3(0, -1, 0));
    raycaster.far = 1;
    const meshes = [];
    root.traverse((o) => o.isMesh && o.visible && !o.userData.diningProp && meshes.push(o));
    const hit = raycaster.intersectObjects(meshes, false)[0];
    return hit ? hit.point.applyMatrix4(frame.inverse).y : null;
  }

  // The table's near edge in the seat frame, found from its own top: for each x across the setting,
  // the nearest z (toward the diner) where the top is still under the point. Resting hands keep to
  // the top by it (dining-motion.mjs onTable).
  function tableEdge(root, frame, surface) {
    if (!root) return null;
    // Only the meshes over the setting's square metre take part.
    const region = new THREE.Box3(new THREE.Vector3(-0.6, surface - 0.1, -0.1), new THREE.Vector3(0.6, surface + 0.1, 1.4)).applyMatrix4(
      frame.matrix
    );
    const meshes = [];
    root.updateWorldMatrix(true, true);
    root.traverse((o) => {
      if (!o.isMesh || !o.visible || o.userData.diningProp) return;
      if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
      if (box.copy(o.geometry.boundingBox).applyMatrix4(o.matrixWorld).intersectsBox(region)) meshes.push(o);
    });
    const down = new THREE.Vector3(0, -1, 0);
    const isTop = (x, z) => {
      raycaster.set(new THREE.Vector3(x, surface + 0.3, z).applyMatrix4(frame.matrix), down);
      raycaster.far = 0.6;
      const hit = raycaster.intersectObjects(meshes, false)[0];
      return Boolean(hit) && Math.abs(hit.point.applyMatrix4(frame.inverse).y - surface) < 0.012;
    };
    const edge = [];
    for (let x = -0.42; x <= 0.421; x += 0.06) {
      // Start from a point on the open top (something may stand at the table's centre).
      let z = [0.8, 0.66, 0.52].find((start) => isTop(x, start));
      if (z === undefined) continue;
      while (z > 0.02 && isTop(x, z - 0.04)) z -= 0.04;
      for (let step = 0.02; step >= 0.005; step /= 2) if (isTop(x, z - step)) z -= step;
      edge.push([Math.round(x * 1000) / 1000, Math.round(z * 1000) / 1000]);
    }
    return edge.length >= 2 ? edge : null;
  }

  // ── A setting for an activity ──────────────────────────────────────────────────────────────────
  const settingKey = (routine) => (routine && MEALS.has(routine.id) ? `${routine.dateKey}|${routine.id}|${routine.prop || ""}` : null);

  function vesselFor(course) {
    if (course.meal === "evening") return course.drink?.glass || "rocks";
    if (course.meal === "breakfast") return "cup";
    return DRINKS[course.drink]?.glass || "tumbler";
  }
  function drinkFor(course) {
    return course.meal === "evening" ? course.drink?.id : course.meal === "breakfast" ? null : course.drink;
  }

  function filesFor(course, level) {
    const pick = (lods) => lods[Math.min(level, lods.length - 1)].file;
    const files = [pick(index.tableware.lods)];
    for (const dish of [course.dish, course.dessert]) if (dish && index.dishes[dish.id]) files.push(pick(index.dishes[dish.id].lods));
    return files;
  }

  function createSetting(routine) {
    const menu = menuFor(routine.dateKey, routine.prop);
    const course = courseFor(menu, routine.id);
    const frame = seatFrame(routine.room);
    const spec = index.settings?.[routine.room];
    if (!course || !frame || !spec) return null;
    return {
      key: settingKey(routine),
      activity: routine.id,
      meal: course.meal,
      menu,
      course,
      roomId: routine.room,
      frame,
      spec,
      layout: null,
      group: null,
      items: new Map(),
      level: 0,
      wantLevel: 0,
      ready: false,
      plan: null,
      afterPlan: null,
      latch: null,
      removed: {},
      liquids: [],
      bite: null,
      biteKey: null,
      owned: { geometries: new Set(), materials: new Set() },
    };
  }

  // Copies of the loaded models for this setting, prepared like the house's furniture.
  function assemble(s, level) {
    const root = roomRoot(s.roomId);
    if (!root) return false;
    const entries = filesFor(s.course, level).map((file) => model(file));
    if (entries.some((e) => e.state === "loading")) return false;
    if (entries.some((e) => e.state === "failed")) {
      if (level > 0) {
        s.wantLevel = s.level;
        return false;
      }
      s.failed = true;
      return false;
    }
    const previous = s.group;
    const group = new THREE.Group();
    group.name = `dining ${s.activity}`;
    root.add(group);
    root.updateWorldMatrix(true, false);
    new THREE.Matrix4().copy(root.matrixWorld).invert().multiply(s.frame.matrix).decompose(group.position, group.quaternion, group.scale);
    const items = new Map();
    const [tableware, ...dishes] = entries;
    const ware = tableware.source.clone(true);
    const found = [];
    ware.traverse((o) => o.userData.diningItem && found.push(o));
    for (const object of found) {
      object.removeFromParent();
      object.position.set(0, 0, 0);
      object.quaternion.identity();
      object.visible = false;
      group.add(object);
      items.set(object.userData.diningItem, object);
    }
    const courses = [s.course.dish, s.course.dessert].filter((d) => d && index.dishes[d.id]);
    dishes.forEach((entry, i) => {
      const id = courses[i].id;
      const copy = entry.source.clone(true);
      copy.name = `dish ${id}`;
      copy.traverse((o) => {
        if (!o.isMesh) return;
        // Eaten pieces collapse in this copy only.
        o.geometry = o.geometry.clone();
        s.owned.geometries.add(o.geometry);
        o.userData.basePositions = o.geometry.attributes.position.array.slice();
      });
      copy.visible = false;
      group.add(copy);
      items.set(`dish:${id}`, copy);
    });
    group.traverse((o) => {
      o.userData.dynamic = true;
      o.userData.diningProp = true;
    });
    prepare(group, s.roomId);
    group.traverse((o) => {
      if (!o.isMesh) return;
      for (const m of [o.material].flat()) m && s.owned.materials.add(m);
      for (const m of Object.values(o.userData.styleMaterials || {}).flat()) m && s.owned.materials.add(m);
    });
    tuneGlass(group);
    group.visible = false;
    const next = { group, items, liquids: [] };
    const layout = resolveLayout(s, root);
    buildLiquids(s, next, layout);
    // No scene-wide warmup here: run when a meal changed, it compiled much of the house again (82
    // more program links over a five-style, four-meal lab session than without it). The setting's
    // materials share the house's programs, so it simply joins the next frame.
    Promise.resolve().then(() => {
      // A setting replaced meanwhile (the activity changed) never shows: its copy leaves the room.
      if (disposed || setting !== s) return group.removeFromParent();
      if (s.group === group) return;
      if (previous) {
        s.bite?.forEach((m) => m.removeFromParent());
        s.bite = null;
        s.biteKey = null;
        previous.removeFromParent();
      }
      Object.assign(s, next, { layout, level, ready: true, removed: {} });
      group.visible = true;
      requestFrame();
    });
    s.pendingLevel = level;
    return true;
  }

  function tuneGlass(group) {
    group.traverse((o) => {
      if (!o.isMesh) return;
      for (const material of [o.material].flat()) {
        if (!/^table glass/.test(material?.name || "")) continue;
        material.transparent = true;
        // The lip is drawn a shade more opaque, so a glass keeps its outline at night.
        material.opacity = /rim/.test(material.name) ? 0.55 : 0.2;
        material.depthWrite = false;
        material.side = THREE.DoubleSide;
        o.renderOrder = 2;
        o.castShadow = false;
        Object.assign(o.userData, { fixedMaterial: true, noOcclusion: true, noContactOcclusion: true, noVolumeDepth: true });
      }
    });
  }

  // The layout in the seat's frame, fitted to the room: the table's height from its own triangles,
  // and while the nook still carries its own plate, the dish stacked on it as on a charger.
  function resolveLayout(s, root) {
    const spec = s.spec;
    if (spec.knee) return { ...spec, rim: index.tableware.items[vesselFor(s.course)]?.rim || 0.1 };
    const probe = spec.probe || spec.glass || [-0.22, 0.74];
    const measured = surfaceUnder(root, s.frame, probe[0], probe[1], spec.surface);
    const surface = Number.isFinite(measured) && Math.abs(measured - spec.surface) < 0.08 ? measured : spec.surface;
    let plate = spec.plate,
      charger = 0;
    if (spec.charger) {
      const top = surfaceUnder(root, s.frame, spec.charger.at[0], spec.charger.at[1], surface);
      // The nook's own plate is a flat 30 cm disc, 6 mm high at its centre.
      if (Number.isFinite(top) && top - surface > 0.003 && top - surface < 0.05) {
        plate = spec.charger.at;
        charger = top - surface;
      }
    }
    // Everything else keeps its place around the plate.
    const around = {};
    for (const [name, offset] of Object.entries(spec.around || {})) around[name] = [plate[0] + offset[0], plate[1] + offset[1]];
    const dish = s.course.dish && index.dishes[s.course.dish.id];
    const dessert = s.course.dessert && index.dishes[s.course.dessert.id];
    const vessel = vesselFor(s.course);
    const breakfast = s.meal === "breakfast";
    const cup = index.tableware.items.cup || {};
    return {
      ...spec,
      ...around,
      surface,
      plate,
      charger,
      edge: tableEdge(root, s.frame, surface),
      // The fork rests on the folded napkin.
      forkLift: around.napkin ? spec.napkinHeight || 0.009 : 0,
      // Breakfast drinks from the bar's cup on its saucer; the other meals from their glass.
      glass: breakfast ? around.saucer : around.glass,
      vesselLift: breakfast ? cup.saucerLift || 0.012 : 0,
      rim: index.tableware.items[vessel]?.rim || 0.1,
      bites: {
        main: (dish?.bites || []).map((p) => [p[0], p[1] + charger, p[2]]),
        dessert: (dessert?.bites || []).map((p) => [p[0], p[1], p[2]]),
      },
    };
  }

  // ── Liquids: a lathe of the vessel's inner profile, its surface kept level as the glass tips ───
  function buildLiquids(s, target, layout) {
    const vessel = vesselFor(s.course);
    const object = target.items.get(vessel);
    const spec = index.tableware.items[vessel];
    const drink = index.drinks?.[drinkFor(s.course)];
    if (!object || !spec?.profile || !drink) return;
    const segments = 28,
      rings = 5;
    const wall = segments * (rings + 1);
    const count = wall + segments + 1;
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 4); // RGBA, as the house's surfaces (one program)
    const body = new THREE.Color().setRGB(...drink.color, THREE.SRGBColorSpace);
    const top = new THREE.Color().setRGB(...(drink.top || drink.color), THREE.SRGBColorSpace);
    for (let i = 0; i < count; i++) colors.set(i < wall ? [body.r, body.g, body.b, 1] : [top.r, top.g, top.b, 1], i * 4);
    const indices = [];
    for (let j = 0; j < segments; j++)
      for (let k = 0; k < rings; k++) {
        const a = j * (rings + 1) + k,
          b = ((j + 1) % segments) * (rings + 1) + k;
        indices.push(a, a + 1, b, b, a + 1, b + 1);
      }
    for (let j = 0; j < segments; j++) indices.push(wall + segments, wall + ((j + 1) % segments), wall + j);
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute("color", new THREE.BufferAttribute(colors, 4));
    geometry.setIndex(indices);
    const material = new THREE.MeshStandardMaterial({
      name: "table liquid",
      color: 0xffffff,
      roughness: drink.roughness ?? 0.16,
      vertexColors: true,
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = `${drinkFor(s.course)} liquid`;
    Object.assign(mesh.userData, { dynamic: true, diningProp: true });
    object.add(mesh);
    prepare(mesh, s.roomId);
    mesh.castShadow = false;
    s.owned.geometries.add(geometry);
    s.owned.materials.add(material);
    for (const m of [mesh.material].flat()) s.owned.materials.add(m);
    const garnish = (drink.garnish || [])
      .map((name) => ({ name, object: target.items.get(name), spec: index.tableware.items[name] || {} }))
      .filter((g) => g.object);
    target.liquids.push({ mesh, spec, drink, segments, rings, key: "", garnish, fill: 0 });
  }

  const upLocal = v3(),
    tmpQ = q4();
  function radiusAt(profile, y) {
    if (y <= profile[0][0]) return profile[0][1];
    for (let i = 1; i < profile.length; i++)
      if (y <= profile[i][0]) {
        const [y0, r0] = profile[i - 1],
          [y1, r1] = profile[i];
        return r0 + ((r1 - r0) * (y - y0)) / Math.max(1e-6, y1 - y0);
      }
    return profile[profile.length - 1][1];
  }
  function updateLiquid(liquid, level) {
    const { mesh, spec, segments, rings } = liquid;
    const profile = spec.profile;
    const floor = profile[0][0],
      ceiling = profile[profile.length - 1][0];
    const fill = floor + (ceiling - floor) * (liquid.drink.fill ?? 0.85) * THREE.MathUtils.clamp(level, 0, 1);
    mesh.parent.updateWorldMatrix(true, false);
    upLocal.copy(UP).applyQuaternion(mesh.parent.getWorldQuaternion(tmpQ).invert()).normalize();
    const key = `${fill.toFixed(4)}|${upLocal.x.toFixed(3)}|${upLocal.z.toFixed(3)}`;
    liquid.fill = fill;
    if (key === liquid.key) return;
    liquid.key = key;
    const positions = mesh.geometry.attributes.position.array;
    const wall = segments * (rings + 1);
    const uy = Math.max(0.25, upLocal.y);
    for (let j = 0; j < segments; j++) {
      const angle = (j / segments) * TAU,
        ca = Math.cos(angle),
        sa = Math.sin(angle);
      // The level surface meets this column of the wall where dot(p - (0, fill, 0), up) = 0.
      let y = fill;
      for (let it = 0; it < 4; it++) y = fill - (radiusAt(profile, y) * (upLocal.x * ca + upLocal.z * sa)) / uy;
      y = THREE.MathUtils.clamp(y, floor + 0.0015, ceiling);
      for (let k = 0; k <= rings; k++) {
        const yy = floor + ((y - floor) * k) / rings;
        const r = Math.max(0, radiusAt(profile, yy) - 0.0007);
        positions.set([r * ca, yy, r * sa], (j * (rings + 1) + k) * 3);
      }
      const r = Math.max(0, radiusAt(profile, y) - 0.0007);
      positions.set([r * ca, y, r * sa], (wall + j) * 3);
    }
    positions.set([0, fill, 0], (wall + segments) * 3);
    mesh.geometry.attributes.position.needsUpdate = true;
    mesh.geometry.computeVertexNormals();
    mesh.geometry.computeBoundingSphere();
  }

  // ── The avatar rig ─────────────────────────────────────────────────────────────────────────────
  function rigFor(actor) {
    if (rig?.actor === actor) return rig;
    const bones = new Map();
    let avatarId = null;
    actor.traverse((o) => {
      if (o.isBone) bones.set(o.name.replaceAll(".", ""), o);
      if (o.userData?.avatar) avatarId = o.userData.avatar;
    });
    const limb = (side) => ({ upper: bones.get("Arm" + side), lower: bones.get("Forearm" + side), hand: bones.get("Hand" + side), side });
    const avatar = index.avatars?.[avatarId] || index.avatars?.default || { mouth: [0, 0.12, 0.16], palm: 0.03 };
    rig = {
      actor,
      avatarId,
      spine: bones.get("Spine"),
      hips: bones.get("Hips"),
      hipsBase: null,
      hipsApplied: null,
      head: bones.get("Head"),
      limbs: { R: limb("R"), L: limb("L") },
      avatar,
      base: new Map(),
      applied: new Map(),
    };
    // Articulated fingers (the Ghibli study's ten segments a hand) close round what they hold.
    for (const side of ["R", "L"])
      rig.limbs[side].fingers = ["0", "1", "2", "3", "thumb"]
        .map((digit) => [0, 1].map((segment) => bones.get(`HandFinger${digit}${segment}${side}`)).filter(Boolean))
        .filter((chain) => chain.length === 2);
    rig.touched = [
      rig.spine,
      rig.head,
      ...["R", "L"].flatMap((s) => [rig.limbs[s].upper, rig.limbs[s].lower, rig.limbs[s].hand, ...rig.limbs[s].fingers.flat()]),
    ].filter(Boolean);
    rig.broken = rig.touched.length < 8;
    return rig;
  }
  // The clip's pose is the base each application starts from. When nothing re-evaluated the clip
  // since our last application (reduced motion redraws), restore that base first, so a redraw
  // composes the identical still instead of leaning further.
  function beginApplication(r) {
    for (const bone of r.touched) {
      const applied = r.applied.get(bone);
      if (applied && applied.equals(bone.quaternion)) bone.quaternion.copy(r.base.get(bone));
      else r.base.set(bone, bone.quaternion.clone());
    }
    // The hips' position likewise (a seat lift moves it), so a redraw never lifts twice.
    if (r.hips) {
      if (r.hipsApplied && r.hipsApplied.equals(r.hips.position)) r.hips.position.copy(r.hipsBase);
      else r.hipsBase = r.hips.position.clone();
    }
    r.actor.updateMatrixWorld(true);
  }
  function endApplication(r) {
    for (const bone of r.touched) r.applied.set(bone, bone.quaternion.clone());
    if (r.hips) r.hipsApplied = r.hips.position.clone();
  }
  // Some styles sit lower in their clip than the nook's banquette cushion allows (the Lizard by
  // 1.2 cm, measured): the hips rise by the avatar's own nookLift there, the hands following by IK.
  function liftSeat(r, s) {
    const lift = r.avatar.nookLift;
    if (!lift || !r.hips?.parent || s.roomId !== "kitchen" || s.layout?.knee) return;
    r.hips.parent.updateWorldMatrix(true, false);
    r.hips.position.copy(r.hips.parent.worldToLocal(r.hips.getWorldPosition(v3()).addScaledVector(UP, lift)));
    r.actor.updateMatrixWorld(true);
  }

  const a = v3(),
    b = v3(),
    c = v3(),
    goal = v3(),
    direction = v3(),
    bendV = v3(),
    elbow = v3(),
    from = v3(),
    to = v3();
  const qa = q4(),
    qb = q4(),
    qc = q4();
  function setWorldRotation(bone, world) {
    bone.parent.getWorldQuaternion(qb).invert();
    bone.quaternion.copy(qb.multiply(world));
    bone.updateWorldMatrix(false, true);
  }
  function rotateAbout(bone, worldAxis, angle) {
    if (!angle || !bone) return;
    bone.updateWorldMatrix(true, false);
    bone.getWorldQuaternion(qa);
    qc.setFromAxisAngle(worldAxis, angle);
    setWorldRotation(bone, qc.multiply(qa));
  }
  function aim(bone, child, point) {
    bone.updateWorldMatrix(true, true);
    bone.getWorldPosition(b);
    child.getWorldPosition(from).sub(b).normalize();
    to.copy(point).sub(b).normalize();
    qc.setFromUnitVectors(from, to);
    bone.getWorldQuaternion(qa);
    setWorldRotation(bone, qc.multiply(qa));
  }
  // A two-bone solve with an elbow that hangs down, out and a little behind the reach.
  function solveLimb(limb, target, bend) {
    limb.upper.updateWorldMatrix(true, true);
    limb.upper.getWorldPosition(a);
    limb.lower.getWorldPosition(b);
    limb.hand.getWorldPosition(c);
    const l1 = a.distanceTo(b),
      l2 = b.distanceTo(c);
    direction.copy(target).sub(a);
    const distance = THREE.MathUtils.clamp(direction.length(), Math.abs(l1 - l2) + 1e-4, (l1 + l2) * 0.9995);
    direction.normalize();
    const along = (l1 * l1 - l2 * l2 + distance * distance) / (2 * distance);
    bendV.copy(bend).addScaledVector(direction, -bend.dot(direction));
    if (bendV.lengthSq() < 1e-8) bendV.set(0, -1, 0).addScaledVector(direction, direction.y);
    bendV.normalize();
    elbow
      .copy(a)
      .addScaledVector(direction, along)
      .addScaledVector(bendV, Math.sqrt(Math.max(0, l1 * l1 - along * along)));
    aim(limb.upper, limb.lower, elbow);
    goal.copy(a).addScaledVector(direction, distance);
    aim(limb.lower, limb.hand, goal);
  }

  // A hand's world orientation. Hand bones point +y to the fingertips with the thumb on -z; the
  // palm faces -x on HandR and +x on HandL.
  const hx = v3(),
    hy = v3(),
    hz = v3(),
    basis = new THREE.Matrix4();
  function handRotation(side, mode, pose, actorQ, out) {
    const palmSign = side === "R" ? -1 : 1;
    if (mode === "rest") {
      hy.fromArray(pose.dir).applyQuaternion(actorQ);
      hy.y = 0;
      hy.normalize();
      hx.set(0, -palmSign, 0); // palm down
      hz.crossVectors(hx, hy).normalize();
      hx.crossVectors(hy, hz).normalize();
    } else if (mode === "vessel") {
      hz.copy(pose.upWorld).negate(); // the thumb up the vessel's axis
      hx.copy(pose.toward).multiplyScalar(palmSign); // the palm faces the vessel
      hx.addScaledVector(hz, -hx.dot(hz)).normalize();
      hy.crossVectors(hz, hx).normalize();
    } else {
      // Fingers along the utensil; the back of the hand up while it points ahead, turning outward
      // as it comes back toward the face.
      hy.fromArray(pose.dir).applyQuaternion(actorQ).normalize();
      const ahead = Math.max(0, pose.dir[2]);
      hx.set((side === "R" ? 1 : -1) * (1 - ahead) * 0.9, ahead + 0.25, 0).applyQuaternion(actorQ);
      if (side === "L") hx.negate(); // HandL's back of the hand is its -x
      hx.addScaledVector(hy, -hx.dot(hy));
      if (hx.lengthSq() < 1e-6) hx.set(1, 0, 0).applyQuaternion(actorQ).addScaledVector(hy, -hy.x);
      hx.normalize();
      hz.crossVectors(hx, hy).normalize();
    }
    basis.makeBasis(hx, hy, hz);
    return out.setFromRotationMatrix(basis);
  }

  // Items in the hand, in hand-bone space. A utensil's frame has its working end at the origin and
  // +z pointing to it from the handle, +y up off its face; a vessel's has its base at the origin and
  // +y up its axis.
  const UTENSIL_ROTATION = {
    R: new THREE.Quaternion().setFromRotationMatrix(
      new THREE.Matrix4().makeBasis(new THREE.Vector3(0, 0, 1), new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 1, 0))
    ),
    L: new THREE.Quaternion().setFromRotationMatrix(
      new THREE.Matrix4().makeBasis(new THREE.Vector3(0, 0, -1), new THREE.Vector3(-1, 0, 0), new THREE.Vector3(0, 1, 0))
    ),
  };
  const VESSEL_ROTATION = new THREE.Quaternion().setFromRotationMatrix(
    new THREE.Matrix4().makeBasis(new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 0, -1), new THREE.Vector3(0, 1, 0))
  );
  function utensilInHand(side, item, palm) {
    const x = (side === "R" ? -1 : 1) * Math.max(0.006, palm * 0.35);
    return { tip: new THREE.Vector3(x, 0.072 + (item?.grip ?? 0.12), -0.004), rotation: UTENSIL_ROTATION[side] };
  }
  function vesselInHand(side, item, palm) {
    const x = (side === "R" ? -1 : 1) * ((item?.gripRadius ?? 0.035) + palm);
    // A cup turns its handle into the fingers.
    const yaw = item?.handle ? new THREE.Quaternion().setFromAxisAngle(UP, (side === "R" ? -1 : 1) * Math.PI * 0.5) : null;
    return {
      axisPoint: new THREE.Vector3(x, 0.066, 0),
      height: item?.gripHeight ?? 0.04,
      rotation: yaw ? VESSEL_ROTATION.clone().multiply(yaw) : VESSEL_ROTATION,
    };
  }

  // ── pose(): the body and hands after the clip ──────────────────────────────────────────────────
  const mouthW = v3(),
    rightW = v3(),
    upW = v3(),
    targetW = v3(),
    handQ = q4(),
    shoulder = v3();
  const actorInv = new THREE.Matrix4();
  function mouthLocal(r) {
    r.head.updateWorldMatrix(true, false);
    return mouthW.fromArray(r.avatar.mouth).applyMatrix4(r.head.matrixWorld).applyMatrix4(actorInv).toArray();
  }

  function activityWindow(routine) {
    const schedule = routine.weekend ? config.weekend : config.weekday;
    if (!Array.isArray(schedule)) return null;
    for (let i = 0; i < schedule.length; i++) {
      const [start, id] = schedule[i];
      const next = schedule[i + 1]?.[0] ?? 1440;
      if (id === routine.id && routine.minute >= start && routine.minute < next) return [start, next];
    }
    return null;
  }

  function latch(s, routine, seconds) {
    const fresh = !s.latch || s.latch.dateKey !== routine.dateKey;
    const restarted = s.latch && seconds + 0.5 < s.latch.lastSeconds;
    const moved =
      s.latch &&
      (routine.live
        ? Math.abs(routine.minute - s.latch.minute - Math.floor((seconds - s.latch.seconds) / 60)) > 1
        : routine.minute !== s.latch.minute);
    if (s.latch && !fresh && !restarted && !moved) {
      s.latch.lastSeconds = seconds;
      return;
    }
    const window = activityWindow(routine);
    // Breakfast always starts with a full plate: he has only just made the coffee.
    const progress = s.meal === "breakfast" || !window ? 0 : (routine.minute - window[0]) / Math.max(1, window[1] - window[0]);
    s.latch = { dateKey: routine.dateKey, minute: routine.minute, seconds, lastSeconds: seconds, progress };
    const dish = s.course.dish && index.dishes[s.course.dish.id];
    const dessert = s.course.dessert && index.dishes[s.course.dessert.id];
    const common = {
      seed: hashString(`${routine.dateKey}|${routine.id}|${routine.minute}`),
      bites: { main: dish?.bites?.length || 0, dessert: dessert?.bites?.length || 0 },
      utensil: s.course.dish?.utensil || "fork",
      dessertUtensil: s.course.dessert?.utensil || "spoon",
      knife: s.course.dish?.side === "knife",
    };
    if (s.meal === "evening") s.plan = planMeal({ ...common, meal: "evening", vessel: "glass" });
    else if (s.meal === "breakfast") {
      s.plan = planMeal({
        ...common,
        meal: "breakfast",
        progress: 0,
        vessel: "cup",
        sameHand: true,
        prelude: COFFEE_TIMELINE.food - COFFEE_TIMELINE.table,
      });
      // After the cup has gone back to the bar: the empty plate, the view, no cup.
      s.afterPlan = planMeal({ ...common, seed: common.seed + 1, meal: "breakfast", progress: 0.99, vessel: null });
    } else s.plan = planMeal({ ...common, meal: s.meal, progress, vessel: "glass" });
    s.removed = {};
  }

  // The plan and its time now, or null while breakfast waits for its coffee.
  function planNow(s, seconds, reduced) {
    if (s.meal !== "breakfast") return { plan: s.plan, t: reduced ? stillTime(s.plan) : Math.max(0, seconds - s.latch.seconds) };
    if (reduced) return { plan: s.plan, t: stillTime(s.plan) };
    const clock = coffeeTableClock(seconds);
    if (!clock.table) return null;
    if (clock.after) return { plan: s.afterPlan, t: clock.seconds, after: true };
    return { plan: s.plan, t: clock.seconds };
  }

  function pose({
    routine,
    actor,
    sequencePose = null,
    seconds = 0,
    moving = true,
    reduced = false,
    paused = false,
    walking = false,
    travel = false,
  } = {}) {
    if (disposed || !config) return null;
    const key = settingKey(routine);
    if (!key) {
      clear();
      return null;
    }
    if (indexState === "idle") loadIndex();
    if (!index) return null;
    if (setting?.key !== key) {
      clear();
      setting = createSetting(routine);
      if (!setting) return null;
    }
    const s = setting;
    if (s.failed) return null;
    // The fine level whenever the scene fills the screen (a 4K full-screen view reads every piece).
    if (index.tableware.lods.length > 1) s.wantLevel = immersive() ? 1 : 0;
    if ((!s.group && s.pendingLevel === undefined) || (s.wantLevel !== s.level && s.pendingLevel !== s.wantLevel)) assemble(s, s.wantLevel);
    if (!s.plan || !paused || reduced) latch(s, routine, seconds);
    const phase = (p) => (sequencePose ? null : p.phase);
    if (!actor || walking || travel || !s.ready) {
      last = { s, pose: null, rest: true };
      return null;
    }
    // Paused: the bones, props and phase hold exactly as they were.
    if (paused && !reduced && last?.s === s && last.pose) return { phase: phase(last.pose) };
    const r = rigFor(actor);
    if (r.broken) return null;
    const now = planNow(s, seconds, reduced);
    if (!now) {
      last = { s, pose: null, rest: true };
      return null;
    }
    beginApplication(r);
    liftSeat(r, s);
    actorInv.copy(actor.matrixWorld).invert();
    const evening = s.meal === "evening";
    const sample = (mouth) => (evening ? eveningPose(now.plan, now.t, { mouth }, s.layout) : mealPose(now.plan, now.t, { mouth }, s.layout));
    const first = sample(mouthLocal(r));
    applyBody(r, first.body);
    // The head moved: the lips the hand travels to move with it.
    const final = sample(mouthLocal(r));
    final.body = first.body;
    applyHands(r, s, final);
    endApplication(r);
    last = { s, pose: final, t: now.t, after: now.after, rest: false };
    return { phase: phase(final) };
  }

  function applyBody(r, body) {
    rightW.set(1, 0, 0).applyQuaternion(r.actor.quaternion);
    upW.set(0, 1, 0).applyQuaternion(r.actor.quaternion);
    // A lean from the waist; the head turns and pitches on top of it, chewing as a small nod.
    rotateAbout(r.spine, rightW, body.lean || 0);
    rotateAbout(r.head, upW, body.headYaw || 0);
    rotateAbout(r.head, rightW, (body.headPitch || 0) + (body.chew || 0) * 0.016);
    r.actor.updateMatrixWorld(true);
  }

  const BEND = { R: new THREE.Vector3(0.78, -0.56, -0.26), L: new THREE.Vector3(-0.78, -0.56, -0.26) };
  const bendW = v3();
  // Where the wrist goes and how the hand turns for one hand pose (see dining-motion.mjs).
  function targetFor(r, s, p, side, hand) {
    const palm = r.avatar.palm ?? 0.03;
    const toWorld = (arr) => new THREE.Vector3(...arr).applyMatrix4(r.actor.matrixWorld);
    const rotation = q4();
    if (hand.mode === "rest") {
      handRotation(side, "rest", hand, r.actor.quaternion, rotation);
      const palmPoint = new THREE.Vector3((side === "R" ? -1 : 1) * palm, 0.062, 0).applyQuaternion(rotation);
      const top = toWorld(hand.palm);
      const wrist = top.clone().sub(palmPoint);
      // The hand's own lowest point (its pad, thumb or knuckles) settles on the top, measured from
      // the avatar's skinned hand rather than assumed from a palm thickness.
      const lowest = lowestOfHand(r.limbs[side], rotation);
      if (lowest !== null) wrist.y = top.y + 0.002 - lowest;
      return { wrist, rotation };
    }
    if (hand.mode === "vessel") {
      const grip = vesselInHand(side, index.tableware.items[hand.item] || {}, palm);
      const base = toWorld(hand.base);
      const toLip = toWorld(hand.toward).sub(base);
      toLip.y = 0;
      if (toLip.lengthSq() < 1e-8) toLip.set(0, 0, 1).applyQuaternion(r.actor.quaternion);
      toLip.normalize();
      const tipAxis = v3().crossVectors(UP, toLip).normalize();
      const up = UP.clone().applyAxisAngle(tipAxis, hand.tilt || 0);
      if (hand.contact > 0 && hand.lip) {
        // The near edge of the rim stays on the lips while the vessel tips: base = lip - R(rim).
        const item = index.tableware.items[hand.item] || {};
        const rimRadius = item.rimRadius ?? item.profile?.[item.profile.length - 1]?.[1] ?? 0.035;
        const nearRim = UP.clone()
          .multiplyScalar(item.rim ?? 0.1)
          .addScaledVector(toLip, rimRadius)
          .applyAxisAngle(tipAxis, hand.tilt || 0);
        base.lerp(toWorld(hand.lip).sub(nearRim), hand.contact);
      }
      // The hand comes from the shoulder's side, its palm round the vessel.
      r.limbs[side].upper.getWorldPosition(shoulder);
      const toward = base.clone().sub(shoulder);
      toward.addScaledVector(up, -toward.dot(up)).normalize();
      handRotation(side, "vessel", { upWorld: up, toward }, r.actor.quaternion, rotation);
      const gripPoint = base.addScaledVector(up, grip.height);
      return { wrist: gripPoint.sub(grip.axisPoint.clone().applyQuaternion(rotation)), rotation };
    }
    const name = hand.item === "knife" ? "knife" : utensilName(s, p);
    const grip = utensilInHand(side, index.tableware.items[name] || index.tableware.items.fork, palm);
    handRotation(side, "hold", hand, r.actor.quaternion, rotation);
    return { wrist: toWorld(hand.tip).sub(grip.tip.clone().applyQuaternion(rotation)), rotation };
  }

  function applyHands(r, s, p) {
    for (const side of ["R", "L"]) {
      const hand = p.hands[side];
      const limb = r.limbs[side];
      if (!hand) continue;
      const reach = hand.reach ?? 1;
      limb.hand.updateWorldMatrix(true, false);
      bendW.copy(BEND[side]).applyQuaternion(r.actor.quaternion);
      // Blend from the pose this grip leaves, or from the authored clip at arrival.
      const clip = hand.from ? null : { wrist: limb.hand.getWorldPosition(v3()), rotation: limb.hand.getWorldQuaternion(q4()) };
      const place = () => {
        const goal = targetFor(r, s, p, side, hand);
        if (reach < 1) {
          const from = hand.from ? targetFor(r, s, p, side, hand.from) : { wrist: clip.wrist.clone(), rotation: clip.rotation.clone() };
          goal.wrist = from.wrist.lerp(goal.wrist, reach);
          goal.rotation = from.rotation.slerp(goal.rotation, reach);
        }
        targetW.copy(goal.wrist);
        solveLimb(limb, targetW, bendW);
        setWorldRotation(limb.hand, goal.rotation);
        limb.hand.updateWorldMatrix(true, false);
        hand.drift = limb.hand.getWorldPosition(v3()).distanceTo(targetW);
      };
      place();
      const rest = hand.mode === "rest";
      curlFingers(limb, side, rest ? 0.12 : hand.mode === "vessel" ? 0.95 : 1.15, reach, rest ? 0 : 0.45);
      // The first time a hand rests, its relaxed shape is measured, and it settles again on it.
      if (rest && limb.shape === undefined) {
        limb.shape = handShape(r, limb);
        if (limb.shape) place();
      }
    }
    r.actor.updateMatrixWorld(true);
  }

  // The hand and its fingers' skinned vertices in the hand bone's frame (world scale), as they are
  // now; lowestOfHand turns them by a hand rotation to find how far below the wrist they reach.
  function handShape(r, limb) {
    const owners = new Set([limb.hand, ...(limb.fingers || []).flat()]);
    limb.hand.updateWorldMatrix(true, true);
    const origin = limb.hand.getWorldPosition(v3());
    const inverse = limb.hand.getWorldQuaternion(q4()).invert();
    const points = [];
    const point = v3();
    r.actor.traverse((o) => {
      if (!o.isSkinnedMesh || o.userData.outline) return;
      const skin = o.geometry.attributes.skinIndex,
        weight = o.geometry.attributes.skinWeight;
      if (!skin || !weight) return;
      const bones = o.skeleton.bones;
      for (let i = 0; i < skin.count; i++) {
        let best = 0,
          bone = null;
        for (let k = 0; k < 4; k++) {
          const w = weight.getComponent(i, k);
          if (w > best) {
            best = w;
            bone = bones[skin.getComponent(i, k)];
          }
        }
        if (!owners.has(bone)) continue;
        o.getVertexPosition(i, point);
        point.applyMatrix4(o.matrixWorld).sub(origin).applyQuaternion(inverse);
        points.push(point.x, point.y, point.z);
      }
    });
    return points.length ? new Float32Array(points) : null;
  }
  const turn = new THREE.Matrix4();
  function lowestOfHand(limb, rotation) {
    const shape = limb.shape;
    if (!shape) return null;
    const e = turn.makeRotationFromQuaternion(rotation).elements;
    let lowest = Infinity;
    for (let i = 0; i < shape.length; i += 3) lowest = Math.min(lowest, e[1] * shape[i] + e[5] * shape[i + 1] + e[9] * shape[i + 2]);
    return lowest;
  }

  // Each segment turns toward the palm about the axis across the finger: a grip, not a pose.
  const fingerDir = v3(),
    palmNormal = v3(),
    curlAxis = v3(),
    joint = v3();
  function curlFingers(limb, side, amount, reach, thumbShare = 0.45) {
    if (!limb.fingers?.length) return;
    limb.hand.updateWorldMatrix(true, false);
    palmNormal
      .set(side === "R" ? -1 : 1, 0, 0)
      .applyQuaternion(limb.hand.getWorldQuaternion(qa))
      .normalize();
    for (const [index, chain] of limb.fingers.entries()) {
      const thumb = index === limb.fingers.length - 1;
      chain.forEach((bone, segment) => {
        bone.updateWorldMatrix(true, false);
        bone.getWorldPosition(joint);
        const child = chain[segment + 1];
        if (child) child.getWorldPosition(fingerDir).sub(joint);
        else fingerDir.set(0, 1, 0).applyQuaternion(bone.getWorldQuaternion(qb));
        fingerDir.normalize();
        curlAxis.crossVectors(fingerDir, palmNormal);
        if (curlAxis.lengthSq() < 1e-8) return;
        curlAxis.normalize();
        // A hand laid flat keeps its thumb beside the palm instead of curling it under.
        rotateAbout(bone, curlAxis, amount * (thumb ? thumbShare : segment ? 1.05 : 0.95) * reach);
      });
    }
  }

  function utensilName(s, p, course = p?.remaining?.swapped && s.course.dessert ? "dessert" : "main") {
    const info = course === "dessert" ? s.course.dessert : s.course.dish;
    const kind = info?.utensil || "fork";
    if (kind === "spoon") return course === "dessert" ? "dessert-spoon" : "spoon";
    return kind;
  }

  // ── props(): place the setting once the hands are final ────────────────────────────────────────
  const itemQ = q4(),
    itemP = v3(),
    m4 = new THREE.Matrix4(),
    m4b = new THREE.Matrix4(),
    s3 = new THREE.Vector3(1, 1, 1);
  function placeWorld(object, position, quaternion, group) {
    m4.compose(position, quaternion, s3);
    m4.premultiply(m4b.copy(group.matrixWorld).invert());
    m4.decompose(object.position, object.quaternion, object.scale);
  }
  // An item lying in the setting: its origin at `at` with +z along `dir` (seat frame).
  const lz = v3(),
    lx = v3(),
    ly = v3();
  function placeLocal(object, at, dir = [0, 0, 1]) {
    if (!object) return;
    lz.fromArray(dir).normalize();
    lx.crossVectors(UP, lz);
    if (lx.lengthSq() < 1e-8) lx.set(1, 0, 0);
    lx.normalize();
    ly.crossVectors(lz, lx).normalize();
    object.quaternion.setFromRotationMatrix(m4.makeBasis(lx, ly, lz));
    object.position.fromArray(at);
  }
  function handWorld(side) {
    const bone = rig?.limbs?.[side]?.hand;
    if (!bone) return null;
    bone.updateWorldMatrix(true, false);
    return { position: bone.getWorldPosition(v3()), quaternion: bone.getWorldQuaternion(q4()) };
  }

  function props({ cup = null } = {}) {
    barCup = cup;
    const s = setting;
    if (!s?.group || !s.ready || !s.layout) return;
    const p = last?.s === s && !last.rest ? last.pose : null;
    const L = s.layout;
    s.group.updateWorldMatrix(true, false);
    const shown = new Set();
    const show = (name) => {
      const object = s.items.get(name);
      if (object) shown.add(object);
      return object;
    };
    const palm = rig?.avatar?.palm ?? 0.03;
    const evening = s.meal === "evening";
    if (!evening) {
      // Plates and what is left on them.
      const plates = p?.plates || { main: s.plan?.start?.swapped ? L.aside : L.plate, dessert: s.plan?.start?.swapped ? L.plate : L.dessert };
      for (const [course, info] of [
        ["main", s.course.dish],
        ["dessert", s.course.dessert],
      ]) {
        if (!info || !index.dishes[info.id]) continue;
        const dish = show(`dish:${info.id}`);
        const at = plates[course] || L.plate;
        const onCharger = Math.abs(at[0] - L.plate[0]) < 1e-6 && Math.abs(at[1] - L.plate[1]) < 1e-6;
        dish.position.set(at[0], L.surface + (onCharger ? L.charger : 0), at[1]);
        dish.quaternion.identity();
        const total = index.dishes[info.id].bites.length;
        const left = p?.remaining ? p.remaining[course] : s.plan ? (last?.after ? 0 : s.plan.start[course]) : total;
        collapsePieces(s, course, dish, total, left);
      }
      if (L.napkin) placeLocal(show("napkin"), [L.napkin[0], L.surface, L.napkin[1]], L.napkinDir || [0, 0, 1]);
      // Cutlery: in a hand, or lying where the pose leaves it.
      const defaults = {
        utensil: { holder: "table", tip: [L.fork[0], L.surface + L.forkLift + 0.006, L.fork[1]], dir: [0, 0, 1] },
        dessertUtensil: s.course.dessert
          ? { holder: "table", tip: [L.plate[0] + 0.07, L.surface + 0.006, L.plate[1] + 0.165], dir: [-1, 0, 0] }
          : null,
        knife: s.course.dish?.side === "knife" ? { holder: "table", tip: [L.knife[0], L.surface + 0.004, L.knife[1]], dir: [0, 0, 1] } : null,
      };
      const carriers = {};
      const pieces = [
        ["utensil", utensilName(s, p, "main"), "R"],
        ["dessertUtensil", s.course.dessert ? utensilName(s, p, "dessert") : null, "R"],
        ["knife", s.course.dish?.side === "knife" ? "knife" : null, "L"],
      ];
      for (const [key, name, side] of pieces) {
        if (!name) continue;
        const object = show(name);
        if (!object) continue;
        const state = p?.[key] || defaults[key];
        const held = state?.holder === side && handWorld(side);
        if (held) {
          const grip = utensilInHand(side, index.tableware.items[name], palm);
          itemQ.copy(held.quaternion).multiply(grip.rotation);
          itemP.copy(grip.tip).applyQuaternion(held.quaternion).add(held.position);
          placeWorld(object, itemP, itemQ, s.group);
        } else {
          const lying = state?.tip ? state : defaults[key];
          placeLocal(object, lying.tip, lying.dir);
        }
        if (key === "utensil") carriers.main = [object, name];
        if (key === "dessertUtensil") carriers.dessert = [object, name];
      }
      placeBite(s, p, carriers);
    }
    const vessel = vesselFor(s.course);
    if (vessel === "cup") placeCoffee(s, p, cup, palm, show);
    else {
      const glass = show(vessel);
      if (glass) {
        const holder = p?.glass?.holder;
        const side = holder === "R" || holder === "L" ? holder : null;
        const held = side && handWorld(side);
        const spec = index.tableware.items[vessel] || {};
        if (held) {
          const grip = vesselInHand(side, spec, palm);
          itemQ.copy(held.quaternion).multiply(grip.rotation);
          itemP.copy(grip.axisPoint).applyQuaternion(held.quaternion).add(held.position);
          itemP.addScaledVector(v3().set(0, 1, 0).applyQuaternion(itemQ), -grip.height);
          placeWorld(glass, itemP, itemQ, s.group);
        } else if (evening) {
          const base = p?.glass?.base || L.knee;
          glass.position.fromArray(base);
          glass.quaternion.identity();
        } else {
          glass.position.set(L.glass[0], L.surface, L.glass[1]);
          glass.quaternion.identity();
        }
        for (const liquid of s.liquids) {
          updateLiquid(liquid, p?.glass?.level ?? 0.8);
          // Ice floats mostly under the surface; a citrus wheel stands slotted on the rim.
          const rimRadius = spec.profile?.[spec.profile.length - 1]?.[1] || 0.04;
          for (const g of liquid.garnish) {
            shown.add(g.object);
            if (g.object.parent !== glass) glass.add(g.object);
            const offset = g.spec.offset || [0, 0, 0];
            if (g.spec.stand) {
              g.object.rotation.set(Math.PI / 2, 0, 0);
              g.object.position.set(rimRadius - 0.004, spec.rim + offset[1], offset[2]);
            } else {
              g.object.rotation.set(0, g.spec.turn || 0, 0);
              g.object.position.set(offset[0], (g.spec.rim ? spec.rim : liquid.fill) + offset[1], offset[2]);
            }
          }
        }
      }
    }
    for (const object of s.items.values()) object.visible = shown.has(object);
  }

  // The coffee bar's own cup (already moved by the controller to the hand or the counter): at the
  // table it rides in the fingers by its handle, tips to the lips, and rests on the saucer.
  function placeCoffee(s, p, cup, palm, show) {
    const L = s.layout;
    const saucer = show("saucer");
    if (saucer) saucer.position.set(L.saucer[0], L.surface, L.saucer[1]);
    if (!cup) return;
    const crema = cup.children.find((o) => /crema/i.test(o.name));
    if (crema && crema.userData.restY === undefined) crema.userData.restY = crema.position.y;
    if (!p || last?.after) return; // making the coffee or taking it back: the controller places it
    const spec = index.tableware.items.cup || {};
    const holder = p.glass?.holder;
    cup.parent.updateWorldMatrix(true, false);
    if (holder === "R" || holder === "L") {
      const held = handWorld(holder);
      if (!held) return;
      const grip = vesselInHand(holder, spec, palm);
      itemQ.copy(held.quaternion).multiply(grip.rotation);
      itemP.copy(grip.axisPoint).applyQuaternion(held.quaternion).add(held.position);
      itemP.addScaledVector(v3().set(0, 1, 0).applyQuaternion(itemQ), (spec.originHeight || 0) - grip.height);
    } else {
      // On its saucer, the handle turned toward the hand that takes it.
      itemP.set(L.saucer[0], L.surface + (spec.saucerLift || 0.012) + (spec.originHeight || 0), L.saucer[1]).applyMatrix4(s.frame.matrix);
      itemQ.copy(s.frame.quaternion).multiply(qa.setFromAxisAngle(UP, -Math.PI * 0.5));
    }
    m4.compose(itemP, itemQ, s3).premultiply(m4b.copy(cup.parent.matrixWorld).invert());
    m4.decompose(cup.position, cup.quaternion, cup.scale);
    // The crema drops with each sip.
    if (crema) crema.position.y = crema.userData.restY - (spec.cremaDrop || 0.03) * THREE.MathUtils.clamp(1 - (p.glass?.level ?? 0.8) / 0.8, 0, 1);
  }

  // Eaten pieces collapse onto a point under the plate (their degenerate triangles draw nothing).
  // Each vertex's piece is its TEXCOORD_0.x: 0 for sauce and garnish that stay, 1.. in eating order.
  function collapsePieces(s, course, dish, total, left) {
    if (s.removed[course] === left) return;
    s.removed[course] = left;
    const eaten = total - left;
    dish.traverse((o) => {
      if (!o.isMesh || !o.userData.basePositions || !o.geometry.attributes.uv) return;
      const uv = o.geometry.attributes.uv,
        position = o.geometry.attributes.position,
        base = o.userData.basePositions;
      for (let i = 0; i < position.count; i++) {
        const piece = Math.round(uv.getX(i));
        if (piece > 0 && piece <= eaten) position.setXYZ(i, 0, -0.004, 0);
        else position.setXYZ(i, base[i * 3], base[i * 3 + 1], base[i * 3 + 2]);
      }
      position.needsUpdate = true;
    });
  }

  // The piece on its way to the mouth: a copy of that piece's own triangles at the utensil's tip.
  // The piece on its way to the mouth: a copy of that piece's own triangles at the working end
  // of the utensil eating its course (`carriers` maps course -> [object, utensil name]).
  function placeBite(s, p, carriers) {
    const on = p?.onUtensil || null;
    const key = on ? `${on.plate}:${on.index}` : null;
    if (s.biteKey !== key) {
      s.bite?.forEach((m) => {
        m.removeFromParent();
        m.geometry.dispose();
        s.owned.geometries.delete(m.geometry);
      });
      s.bite = on && carriers[on.plate] ? extractPiece(s, on.plate, on.index + 1) : null;
      s.biteKey = key;
      s.bite?.forEach((m) => carriers[on.plate][0].add(m));
    }
    if (!s.bite || !on) return;
    const offset = index.tableware.items[carriers[on.plate][1]]?.carry || [0, 0.006, -0.012];
    for (const m of s.bite) m.position.fromArray(offset);
  }
  function extractPiece(s, course, piece) {
    const info = course === "main" ? s.course.dish : s.course.dessert;
    const dish = info && s.items.get(`dish:${info.id}`);
    if (!dish) return null;
    // Gather the piece's triangles from each of the dish's materials, then frame them together.
    const parts = [];
    let sx = 0,
      sz = 0,
      count = 0,
      low = Infinity;
    dish.traverse((o) => {
      if (!o.isMesh || !o.userData.basePositions || !o.geometry.attributes.uv || !o.geometry.index) return;
      const uv = o.geometry.attributes.uv,
        base = o.userData.basePositions,
        normal = o.geometry.attributes.normal,
        color = o.geometry.attributes.color,
        src = o.geometry.index.array;
      const map = new Map(),
        positions = [],
        normals = [],
        colors = [],
        indices = [];
      for (let i = 0; i < src.length; i += 3) {
        if (Math.round(uv.getX(src[i])) !== piece) continue;
        for (const v of [src[i], src[i + 1], src[i + 2]]) {
          if (!map.has(v)) {
            map.set(v, positions.length / 3);
            positions.push(base[v * 3], base[v * 3 + 1], base[v * 3 + 2]);
            sx += base[v * 3];
            sz += base[v * 3 + 2];
            low = Math.min(low, base[v * 3 + 1]);
            count++;
            if (normal) normals.push(normal.getX(v), normal.getY(v), normal.getZ(v));
            if (color) for (let k = 0; k < color.itemSize; k++) colors.push(color.array[v * color.itemSize + k]);
          }
          indices.push(map.get(v));
        }
      }
      if (indices.length) parts.push({ o, positions, normals, colors, indices, color });
    });
    if (!parts.length) return null;
    const cx = sx / count,
      cz = sz / count;
    // A whole slice leaves the plate, but a fork carries a mouthful: at most 3.2 cm across.
    let extent = 0;
    for (const { positions } of parts)
      for (let i = 0; i < positions.length; i += 3)
        extent = Math.max(extent, Math.abs(positions[i] - cx) * 2, Math.abs(positions[i + 2] - cz) * 2, positions[i + 1] - low);
    const scale = Math.min(1, 0.032 / Math.max(extent, 1e-6));
    return parts.map(({ o, positions, normals, colors, indices, color }) => {
      for (let i = 0; i < positions.length; i += 3) {
        positions[i] = (positions[i] - cx) * scale;
        positions[i + 1] = (positions[i + 1] - low) * scale;
        positions[i + 2] = (positions[i + 2] - cz) * scale;
      }
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
      if (normals.length) geometry.setAttribute("normal", new THREE.Float32BufferAttribute(normals, 3));
      if (colors.length)
        geometry.setAttribute("color", new THREE.BufferAttribute(new color.array.constructor(colors), color.itemSize, color.normalized));
      geometry.setIndex(indices);
      const mesh = new THREE.Mesh(geometry, o.material);
      mesh.name = `bite ${piece}`;
      mesh.castShadow = false;
      Object.assign(mesh.userData, { dynamic: true, diningProp: true });
      s.owned.geometries.add(geometry);
      return mesh;
    });
  }

  function clear() {
    const s = setting;
    if (!s) return;
    s.group?.removeFromParent();
    for (const g of s.owned.geometries) g.dispose();
    for (const m of s.owned.materials) m.dispose();
    setting = null;
    last = null;
  }

  return {
    provides: (kind) => PROVIDED.has(kind) && indexState !== "failed",
    // A room's root is ready: start fetching the meal on its table now. This never holds up the
    // room (a frozen page clock or a slow model cannot stall the house); the setting joins the
    // view once its own programs are ready.
    attach(roomId, root) {
      if (disposed || !root || !["kitchen", "lounge"].includes(roomId)) return;
      loadIndex()
        .then((data) => {
          if (!data?.settings?.[roomId] || disposed) return null;
          const routine = resolveRoutine(config, new Date());
          if (!settingKey(routine) || routine.room !== roomId) return null;
          const course = courseFor(menuFor(routine.dateKey, routine.prop), routine.id);
          if (!course) return null;
          return Promise.all(filesFor(course, 0).map((file) => model(file).promise)).then(() => routine);
        })
        .then((routine) => {
          // The arrival's meal is laid (hidden) while the house loads, so the first view's program
          // warmup prepares it with everything else instead of the first frame compiling it.
          if (!routine || disposed || setting || !roomRoot(roomId)) return;
          setting = createSetting(routine);
          if (setting) assemble(setting, 0);
        });
    },
    pose,
    props,
    heldProp() {
      const s = setting;
      if (!s?.ready || !last?.pose || last.rest) return null;
      const p = last.pose;
      const name =
        s.meal === "evening" || p.glass?.holder === "R"
          ? vesselFor(s.course)
          : p.dessertUtensil?.holder === "R"
            ? utensilName(s, p, "dessert")
            : p.utensil?.holder === "R"
              ? utensilName(s, p, "main")
              : null;
      // At breakfast the hand holds the bar's own cup, not a copy from the setting.
      const object = name === "cup" ? barCup : name ? s.items.get(name) : null;
      if (!object?.visible) return null;
      let visible = true;
      for (let o = object; o; o = o.parent) if (!o.visible) visible = false;
      // Report where the hand holds it: a utensil's grip along its handle, a vessel's grip height.
      const spec = index.tableware.items[name] || {};
      const grip =
        name === "cup"
          ? new THREE.Vector3(0, (spec.gripHeight ?? 0.045) - (spec.originHeight ?? 0), 0)
          : spec.profile
            ? new THREE.Vector3(0, spec.gripHeight ?? 0.04, 0)
            : new THREE.Vector3(0, 0, -(spec.grip ?? 0.12));
      object.updateWorldMatrix(true, false);
      return {
        kind: name,
        position: grip.applyMatrix4(object.matrixWorld).toArray(),
        size: new THREE.Box3().setFromObject(object).getSize(v3()).toArray(),
        ancestorsVisible: visible,
        source: "dining",
      };
    },
    evidence() {
      const s = setting;
      const p = last?.s === s && !last?.rest ? last.pose : null;
      let draws = 0,
        triangles = 0;
      s?.group?.traverseVisible((o) => {
        if (!o.isMesh) return;
        draws++;
        triangles += (o.geometry.index ? o.geometry.index.count : o.geometry.attributes.position.count) / 3;
      });
      const contacts = {};
      if (p)
        for (const side of ["R", "L"])
          if (p.hands?.[side]?.drift != null) contacts[side] = { mode: p.hands[side].mode, wristDrift: p.hands[side].drift };
      return {
        index: indexState,
        key: s?.key || null,
        meal: s?.meal || null,
        menu: s
          ? {
              dish: s.course.dish?.id || null,
              dessert: s.course.dessert?.id || null,
              drink: drinkFor(s.course) || null,
              coffee: s.course.coffee?.id || null,
            }
          : null,
        labels: s
          ? {
              dish: s.course.dish?.label || null,
              dessert: s.course.dessert?.label || null,
              drink: s.meal === "evening" ? s.course.drink?.label : DRINKS[s.course.drink]?.label || null,
            }
          : null,
        ready: Boolean(s?.ready),
        level: s ? s.level : null,
        phase: p?.phase || null,
        beat: p?.beat || null,
        planSeconds: last?.t ?? null,
        remaining: p?.remaining ? { main: p.remaining.main, dessert: p.remaining.dessert, onUtensil: p.remaining.onUtensil } : null,
        glass: p?.glass ? { holder: p.glass.holder, level: p.glass.level, tilt: p.glass.tilt } : null,
        utensil: p?.utensil?.holder || null,
        layout: s?.layout ? { surface: s.layout.surface, plate: s.layout.plate, charger: s.layout.charger } : null,
        contacts,
        draws,
        triangles,
        models: [...models].map(([file, m]) => ({ file, state: m.state })),
      };
    },
    // Lab: world positions of the visible items' origins (a utensil's working end, a vessel's base).
    contactProbe() {
      const s = setting;
      if (!s?.group) return null;
      const items = {};
      for (const [name, object] of s.items) if (object.visible) items[name] = object.getWorldPosition(v3()).toArray();
      const surface = s.layout ? v3().set(0, s.layout.surface, 0).applyMatrix4(s.frame.matrix).y : null;
      return { items, surfaceWorld: surface, layout: s.layout, seat: s.frame.matrix.toArray() };
    },
    dispose() {
      disposed = true;
      clear();
      models.clear();
    },
  };
}
