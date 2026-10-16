import * as THREE from "../three.module.min.js";
import { coastWind } from "./wind-field.mjs";
import { createFacadeCurtains, curtainSchedule } from "./curtain-cloth.mjs";
import { createCurtainMeshes, createSheerFabric } from "./sheer-fabric.mjs";

// The sheer curtains in the live scene (Sirui, 2026-10-16): the four panels of curtain-cloth.mjs in the
// coast's one wind (wind-field.mjs), drawn in sheer-fabric.mjs's material, on curtainSchedule's hours.
// The doorway panels billow in the jet through an open door, the panels over fixed glass sway in the
// indoor air, and the schedule draws them against a low western sun and at night. The controller
// creates the rig once the facade doors exist, steps it each frame and reads its evidence.
//
// Budget: a panel steps only while the scene moves and the panel is on screen and about 90 px tall or
// more (so within about 25 m); off screen it holds its pose. The cloth steps at 30 Hz, five substeps
// each, half the work of the solver's 60 Hz default: in the doorway breeze it strains 1-2 % more and its
// hem swings about a quarter less. At most two steps a frame, so it keeps real time down to 15 fps and
// runs a little slow below that instead of spending the frame catching up. Panels at rest in still air
// sleep, and positions upload only when they change. A paused or reduced-motion still composes the
// settled drape at once.
export function createCurtainRig({ scene, coast = coastWind, startTime = 0, reduced = false, plan = {}, bindMaterial = () => {} }) {
  const curtains = createFacadeCurtains({ startTime, fixedStep: 1 / 30, maxStepsPerUpdate: 2, profile: true, draft: { coast } });
  const group = new THREE.Group(),
    frustum = new THREE.Frustum(),
    matrix = new THREE.Matrix4(),
    sphere = new THREE.Sphere(),
    timings = [];
  group.name = "Facade curtains";
  let schedule = null,
    inView = false,
    stepping = false,
    doors = 0;

  // A changed target is drawn by the carriers on screen ("live"), applied as a straight drape at once
  // off screen (it relaxes once seen), or as the settled drape in a still ("compose").
  function apply({ routine, daylight, visit }, mode) {
    if (!routine) return;
    schedule = curtainSchedule({ activity: routine.id, room: routine.room, visit, daylight });
    for (const panel of curtains.cloth.panels) {
      const target = schedule.fractions[panel.id];
      if (target === undefined || target === curtains.cloth.targetOpenFraction(panel.id)) continue;
      const how = mode === "live" ? (curtains.cloth.isActive(panel.id) ? "animate" : "immediate") : mode;
      curtains.cloth.setOpenFraction(panel.id, target, { immediate: how === "immediate", compose: how === "compose" });
    }
  }

  // Marks each panel active when it is on screen and big enough for its motion to read.
  function markVisible(camera, canvasHeight) {
    if (!camera?.isPerspectiveCamera) return false;
    camera.updateMatrixWorld();
    frustum.setFromProjectionMatrix(matrix.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse));
    const pixels = canvasHeight / 2 / Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2);
    let any = false;
    for (const panel of curtains.cloth.panels) {
      const bound = panel.boundingSphere;
      sphere.center.set(bound.center[0], bound.center[1], bound.center[2]);
      sphere.radius = bound.radius;
      const seen = frustum.intersectsSphere(sphere) && (panel.fabricSize[1] / Math.max(0.1, camera.position.distanceTo(sphere.center))) * pixels > 90;
      curtains.cloth.setActive(panel.id, seen);
      any ||= seen;
    }
    return any;
  }

  // Straight drapes at the schedule's fractions, then reduced motion settles each once.
  apply(plan, "immediate");
  curtains.cloth.setReducedMotion(reduced);
  const fabric = createSheerFabric();
  bindMaterial(fabric.material);
  const meshes = createCurtainMeshes(curtains.cloth, fabric);
  let revision = curtains.cloth.revision;
  for (const mesh of meshes.meshes) group.add(mesh);
  scene.add(group);

  return {
    curtains,
    group,
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
      curtains.cloth.setReducedMotion(still);
      inView = markVisible(camera, canvasHeight);
      apply({ routine, daylight, visit }, moving ? "live" : "compose");
      stepping = moving && inView;
      if (stepping) curtains.cloth.update(Math.min(delta, 0.1), time);
      if (curtains.cloth.revision !== revision) {
        revision = curtains.cloth.revision;
        meshes.update();
      }
      if (stepping) {
        timings.push(performance.now() - started);
        if (timings.length > 120) timings.shift();
      }
    },
    evidence() {
      const sorted = [...timings].sort((a, b) => a - b);
      return {
        plan: schedule,
        inView,
        stepping,
        frameMilliseconds: {
          samples: sorted.length,
          median: sorted[Math.floor(sorted.length / 2)] ?? null,
          p95: sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))] ?? null,
        },
        revision: curtains.cloth.revision,
        cloth: curtains.cloth.evidence(),
        draft: curtains.draft.evidence(),
      };
    },
    dispose() {
      meshes.dispose();
      fabric.dispose();
      group.removeFromParent();
    },
  };
}
