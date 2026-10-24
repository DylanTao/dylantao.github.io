import * as THREE from "../three.module.min.js";
import { coastWind } from "./wind-field.mjs";
import { CURTAIN_FACADE, CURTAIN_HARDWARE, CURTAIN_TRACKS, createFacadeCurtains, curtainSchedule } from "./curtain-cloth.mjs";
import { createCurtainMeshes, createSheerFabric } from "./sheer-fabric.mjs";
import { createLaundryRig } from "./laundry-rig.mjs";
import { localSceneOffset, localSceneWind } from "./local-scene-frame.mjs";

// The linen curtains in the live scene (Sirui, 2026-10-16; rebuilt 2026-10-18): the four panels of
// curtain-cloth.mjs in the coast's one wind (wind-field.mjs), drawn in sheer-fabric.mjs's linen, hung
// from rings on two bronze rods with return brackets and finials, on curtainSchedule's hours. The
// doorway panels billow in the jet through an open door, the panels over fixed glass sway in the
// indoor air. The schedule parks them at the sides overnight and softens only the low-sun edges. The controller
// creates the rig once the facade doors exist, steps it each frame and reads its evidence.
//
// Budget: a panel steps only while the scene moves and the panel is on screen and about 90 px tall or
// more (so within about 25 m), judged from where its cloth is now; off screen it holds its pose. The
// cloth steps at 30 Hz, six substeps each, at most two steps a frame, so it keeps real time down to
// 15 fps and runs a little slow below that instead of spending the frame catching up. Panels at rest in
// still air sleep, and positions upload only for panels that moved. The starting drapes settle on
// background tasks while the page loads; a paused or reduced-motion still composes the settled drape
// at once. The linen blends in the transparent pass, drawn before the glass when the camera is outside
// and after it inside, so the glass's faint reflection lies over the curtain only when it should.
//
// Hardware: the rods, brackets and finials are one static mesh; the 24 rings and their clips are one
// instanced mesh whose matrices change only while a panel is drawn or gathered. Two draws in all.
export function createCurtainRig({
  scene,
  coast = coastWind,
  startTime = 0,
  reduced = false,
  plan = {},
  bindMaterial = () => {},
  coverage = null,
  laundry: withLaundry = true,
  offset = [0, 0, 0],
}) {
  const translation = new THREE.Vector3(...localSceneOffset(offset));
  // The panels start settled at the schedule's fractions (and composed under reduced motion), once.
  const initial = plan.routine
    ? curtainSchedule({ activity: plan.routine.id, room: plan.routine.room, visit: plan.visit, daylight: plan.daylight })
    : null;
  const curtains = createFacadeCurtains({
    startTime,
    fixedStep: 1 / 30,
    substeps: 6,
    maxStepsPerUpdate: 2,
    profile: true,
    reducedMotion: reduced,
    panels: { openFractions: initial?.fractions ?? {} },
    draft: { coast: localSceneWind(coast, translation.toArray()) },
  });
  const cloth = curtains.cloth;
  const group = new THREE.Group(),
    frustum = new THREE.Frustum(),
    matrix = new THREE.Matrix4(),
    sphere = new THREE.Sphere(),
    box = new THREE.Box3(),
    bound = new Float64Array(10),
    timings = [],
    solveTimings = [],
    drawTimings = [];
  group.name = "Facade curtains";
  group.position.copy(translation);
  let schedule = null,
    inView = false,
    stepping = false,
    doors = 0,
    outsideOrder = null;

  // A changed target is drawn by the rings on screen ("live"), settled for a second off screen, or
  // composed as the settled drape in a still ("compose").
  function apply({ routine, daylight, visit }, mode) {
    if (!routine) return;
    schedule = curtainSchedule({ activity: routine.id, room: routine.room, visit, daylight });
    for (const panel of cloth.panels) {
      const target = schedule.fractions[panel.id];
      if (target === undefined || target === cloth.targetOpenFraction(panel.id)) continue;
      const how = mode === "live" ? (cloth.isActive(panel.id) ? "animate" : "immediate") : mode;
      cloth.setOpenFraction(panel.id, target, { immediate: how === "immediate", compose: how === "compose" });
    }
  }

  // Marks each panel active when it is on screen and big enough for its motion to read.
  function markVisible(camera, canvasHeight) {
    if (!camera?.isPerspectiveCamera) return false;
    camera.updateMatrixWorld();
    frustum.setFromProjectionMatrix(matrix.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse));
    const pixels = canvasHeight / 2 / Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2);
    let any = false;
    for (let k = 0; k < cloth.panels.length; k++) {
      const panel = cloth.panels[k];
      // The panel's own box from where its cloth is now, padded for a frame's billow: a tall, thin panel's
      // sphere would hold a camera standing in front of it and step cloth behind that camera. The mesh is
      // culled against the sphere around the same box.
      cloth.island(k).bounds(bound, 0.15);
      sphere.center.set(bound[0], bound[1], bound[2]);
      sphere.radius = bound[3];
      // Buffer geometry bounds stay local for Three's normal frustum culling.
      meshes.meshes[k].geometry.boundingSphere.copy(sphere);
      sphere.center.add(translation);
      box.min.set(bound[4], bound[5], bound[6]).add(translation);
      box.max.set(bound[7], bound[8], bound[9]).add(translation);
      const seen = frustum.intersectsBox(box) && (panel.fabricSize[1] / Math.max(0.1, camera.position.distanceTo(sphere.center))) * pixels > 90;
      cloth.setActive(panel.id, seen);
      any ||= seen;
    }
    return any;
  }

  // Any target the construction did not cover (none, normally) is applied as a settled drape.
  apply(plan, "immediate");
  const coverageMode =
    coverage ?? (typeof location !== "undefined" && new URLSearchParams(location.search).get("sheer") === "coverage" ? "coverage" : "blend");
  const fabric = createSheerFabric({ coverage: coverageMode, tapeHeight: 0.08, fabricTop: cloth.panels[0].fabricSize[1] });
  bindMaterial(fabric.material);
  const meshes = createCurtainMeshes(cloth, fabric);
  for (const mesh of meshes.meshes) group.add(mesh);
  const hardware = createCurtainHardware(cloth, bindMaterial);
  group.add(hardware.rods, hardware.rings);
  scene.add(group);
  // The facade's other cloth: the laundry on the terrace outside it (laundry-rig.mjs).
  const laundry = withLaundry ? createLaundryRig({ scene, coast, reduced, bindMaterial, offset }) : null;
  // The starting drapes settle on background tasks while the page loads (one panel, then the laundry, a
  // task each of a few tens of milliseconds), so no frame has to; a frame that comes first settles what
  // is left, one a frame. scheduler.postTask keeps working under a paused page clock.
  let disposed = false;
  const later = (fn) =>
    typeof globalThis.scheduler?.postTask === "function" ? globalThis.scheduler.postTask(fn, { priority: "background" }) : setTimeout(fn, 0);
  const settleInBackground = () => {
    if (disposed) return;
    if (cloth.pending) cloth.settlePending(1);
    else if (laundry?.pending) laundry.settleNow();
    else return;
    meshes.update(readRevisions());
    later(settleInBackground);
  };
  later(settleInBackground);
  const revisions = new Float64Array(cloth.panels.length);
  const readRevisions = () => {
    for (let k = 0; k < cloth.panels.length; k++) revisions[k] = cloth.island(k).state.revision;
    return revisions;
  };
  let ringsRevision = -1;

  // The linen and the glass are both blended; draw the one nearer the camera last.
  function orderAgainstGlass(camera) {
    if (!camera) return;
    const outside = camera.position.z - translation.z < CURTAIN_FACADE.glassZ;
    if (outside === outsideOrder) return;
    outsideOrder = outside;
    for (const mesh of meshes.meshes) mesh.renderOrder = outside ? 1 : 3;
  }

  return {
    curtains,
    group,
    hardware,
    // The facade doors' mean open fraction at the last step, for the coast wind's indoor share.
    get doorOpenFraction() {
      return doors;
    },
    // `doors` are the controller's facade doors ({ id, offset, slideX }); `time` the scene's clock.
    step({ delta, moving, reduced: still, time, doors: facadeDoors = [], daylight, routine, visit, camera, canvasHeight }) {
      const started = performance.now();
      let open = 0;
      for (const door of facadeDoors) {
        curtains.draft.setDoor(door.id, door.offset);
        open += door.slideX ? Math.abs(door.offset / door.slideX) : 0;
      }
      doors = facadeDoors.length ? open / facadeDoors.length : 0;
      curtains.draft.setGlassDraft(daylight?.sunlight > 0 ? 0.05 : -0.04);
      cloth.setReducedMotion(still);
      inView = markVisible(camera, canvasHeight);
      // Panels waiting for their starting drape settle one a frame, those on screen first (a stepping
      // frame's update does it itself).
      if (cloth.pending && !(moving && inView)) cloth.settlePending(1);
      orderAgainstGlass(camera);
      apply({ routine, daylight, visit }, moving ? "live" : "compose");
      stepping = moving && inView;
      const solving = performance.now();
      if (stepping) cloth.update(Math.min(delta, 0.1), time);
      const drawing = performance.now();
      meshes.update(readRevisions());
      // The rings move only while a panel is drawn or gathered.
      let fractions = 0;
      for (let k = 0; k < cloth.panels.length; k++) fractions += (k + 1) * cloth.openFraction(k);
      if (fractions !== ringsRevision) {
        ringsRevision = fractions;
        hardware.update();
      }
      if (stepping) {
        const done = performance.now();
        timings.push(done - started);
        solveTimings.push(drawing - solving);
        drawTimings.push(done - drawing);
        if (timings.length > 120) {
          timings.shift();
          solveTimings.shift();
          drawTimings.shift();
        }
      }
      // The laundry composes its starting drape once the panels have theirs, so no frame does both.
      laundry?.step({ delta, moving, reduced: still, time, daylight, routine, camera, canvasHeight, settle: cloth.pending === 0 });
    },
    laundry,
    evidence() {
      const sorted = [...timings].sort((a, b) => a - b),
        median = (list) => [...list].sort((a, b) => a - b)[Math.floor(list.length / 2)] ?? null;
      return {
        plan: schedule,
        offset: translation.toArray(),
        inView,
        stepping,
        // Starting drapes still to settle (panels, then the laundry); zero once the page has loaded.
        pendingDrapes: cloth.pending + (laundry?.pending ? 1 : 0),
        coverage: fabric.blend ? "blend" : "coverage",
        frameMilliseconds: {
          samples: sorted.length,
          median: sorted[Math.floor(sorted.length / 2)] ?? null,
          p95: sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))] ?? null,
          // The solver's steps and the refined meshes' writing, medians over the same frames.
          solve: median(solveTimings),
          draw: median(drawTimings),
        },
        revision: cloth.revision,
        hardware: hardware.evidence(),
        draws: meshes.meshes.length + 2,
        cloth: cloth.evidence(),
        draft: curtains.draft.evidence(),
        laundry: laundry?.evidence() ?? null,
      };
    },
    dispose() {
      disposed = true;
      laundry?.dispose();
      meshes.dispose();
      fabric.dispose();
      hardware.dispose();
      group.removeFromParent();
    },
  };
}

// The rods (with return brackets to the door head and finials) and the rings with their clips.
export function createCurtainHardware(cloth, bindMaterial = () => {}, hardware = CURTAIN_HARDWARE, tracks = CURTAIN_TRACKS, facade = CURTAIN_FACADE) {
  const bronze = new THREE.MeshStandardMaterial({ name: "curtain rod bronze", color: 0x3a3029, metalness: 0.82, roughness: 0.36 });
  bindMaterial(bronze);
  const parts = [];
  const place = (geometry, position, rotation = null) => {
    if (rotation) geometry.applyMatrix4(new THREE.Matrix4().makeRotationFromEuler(rotation));
    geometry.translate(...position);
    parts.push(geometry);
  };
  for (const track of tracks) {
    const from = Math.min(track.rail.from, track.rail.to),
      to = Math.max(track.rail.from, track.rail.to),
      rodFrom = from - hardware.finialOverhang,
      rodTo = to + hardware.finialOverhang;
    // The rod.
    place(
      new THREE.CylinderGeometry(hardware.rodRadius, hardware.rodRadius, rodTo - rodFrom, 16, 1),
      [(rodFrom + rodTo) / 2, hardware.rodY, hardware.rodZ],
      new THREE.Euler(0, 0, Math.PI / 2)
    );
    // Finials: a turned ball on a short collar at each end.
    for (const [x, side] of [
      [rodFrom, -1],
      [rodTo, 1],
    ]) {
      place(
        new THREE.CylinderGeometry(hardware.rodRadius * 1.25, hardware.rodRadius * 1.25, 0.012, 16, 1),
        [x + side * 0.006, hardware.rodY, hardware.rodZ],
        new THREE.Euler(0, 0, Math.PI / 2)
      );
      place(new THREE.SphereGeometry(0.021, 16, 10), [x + side * 0.03, hardware.rodY, hardware.rodZ]);
    }
    // Return brackets just outside the end rings: a cup under the rod, an arm back to the door head's
    // room face, and a plate on it.
    for (const x of [from - hardware.bracketOverhang, to + hardware.bracketOverhang]) {
      const armLength = hardware.rodZ - facade.headFaceZ;
      place(new THREE.BoxGeometry(0.012, 0.016, armLength), [x, hardware.rodY + 0.004, (hardware.rodZ + facade.headFaceZ) / 2]);
      place(
        new THREE.CylinderGeometry(hardware.rodRadius + 0.004, hardware.rodRadius + 0.004, 0.016, 16, 1, true, Math.PI / 2, Math.PI),
        [x, hardware.rodY, hardware.rodZ],
        new THREE.Euler(0, 0, Math.PI / 2)
      );
      place(new THREE.BoxGeometry(0.04, 0.07, 0.008), [x, hardware.rodY + 0.004, facade.headFaceZ + 0.004]);
    }
  }
  const rods = new THREE.Mesh(mergeGeometries(parts), bronze);
  rods.name = "curtain rods";
  rods.castShadow = rods.receiveShadow = true;
  rods.userData.noContactOcclusion = true;
  rods.matrixAutoUpdate = false;
  for (const geometry of parts) geometry.dispose();

  // A ring (in the plane across the rod) with the clip hanging from its lowest point to the fabric.
  const ring = new THREE.TorusGeometry(hardware.ringRadius, hardware.ringTube, 6, 18);
  ring.rotateY(Math.PI / 2);
  const clipLength = hardware.clipDrop - (hardware.ringRadius - hardware.ringTube - hardware.rodRadius) - hardware.ringRadius;
  const clip = new THREE.BoxGeometry(0.004, clipLength + 0.004, 0.009);
  clip.translate(0, -hardware.ringRadius - clipLength / 2, 0);
  const jaw = new THREE.BoxGeometry(0.016, 0.012, 0.006);
  jaw.translate(0, -hardware.ringRadius - clipLength, 0);
  const ringGeometry = mergeGeometries([ring, clip, jaw]);
  ring.dispose();
  clip.dispose();
  jaw.dispose();
  const count = cloth.panels.reduce((sum, panel) => sum + panel.rings, 0);
  const rings = new THREE.InstancedMesh(ringGeometry, bronze, count);
  rings.name = "curtain rings";
  rings.castShadow = rings.receiveShadow = true;
  rings.userData.noContactOcclusion = true;
  // Culled against a sphere around both rods.
  {
    const xs = tracks.flatMap((track) => [track.rail.from, track.rail.to]),
      x0 = Math.min(...xs) - hardware.finialOverhang,
      x1 = Math.max(...xs) + hardware.finialOverhang;
    rings.boundingSphere = new THREE.Sphere(new THREE.Vector3((x0 + x1) / 2, hardware.rodY, hardware.rodZ), (x1 - x0) / 2 + 0.1);
  }
  const centres = new Float64Array(3 * Math.max(...cloth.panels.map((panel) => panel.rings)));
  const m = new THREE.Matrix4();
  function update() {
    let k = 0;
    for (const panel of cloth.panels) {
      cloth.writeRings(panel.id, centres);
      for (let r = 0; r < panel.rings; r++, k++) {
        m.makeTranslation(centres[3 * r], centres[3 * r + 1], centres[3 * r + 2]);
        rings.setMatrixAt(k, m);
      }
    }
    rings.instanceMatrix.needsUpdate = true;
  }
  update();
  return {
    rods,
    rings,
    update,
    evidence: () => ({ rods: tracks.length, rings: count, material: bronze.name }),
    dispose() {
      rods.geometry.dispose();
      ringGeometry.dispose();
      bronze.dispose();
    },
  };
}

// Non-indexed merge of position and normal attributes (the hardware's only attributes).
function mergeGeometries(list) {
  let total = 0;
  const flat = list.map((g) => {
    const geometry = g.index ? g.toNonIndexed() : g;
    total += geometry.attributes.position.count;
    return geometry;
  });
  const position = new Float32Array(3 * total),
    normal = new Float32Array(3 * total);
  let offset = 0;
  for (const geometry of flat) {
    position.set(geometry.attributes.position.array, 3 * offset);
    normal.set(geometry.attributes.normal.array, 3 * offset);
    offset += geometry.attributes.position.count;
    if (geometry !== list[flat.indexOf(geometry)]) geometry.dispose();
  }
  const merged = new THREE.BufferGeometry();
  merged.setAttribute("position", new THREE.BufferAttribute(position, 3));
  merged.setAttribute("normal", new THREE.BufferAttribute(normal, 3));
  merged.computeBoundingSphere();
  return merged;
}
