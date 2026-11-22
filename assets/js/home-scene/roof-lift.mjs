import * as THREE from "../three.module.min.js";

export const ROOF_LIFT = Object.freeze({ seconds: 0.4, height: 0.5, stagger: 0.19 });
const curve = (value) => value * value * (3 - 2 * value);
const clamp = (value) => Math.max(0, Math.min(1, value));

export function roofLiftPose(progress, distance) {
  const delay = ROOF_LIFT.stagger * distance;
  const local = clamp((progress - delay) / (1 - ROOF_LIFT.stagger));
  return {
    lift: ROOF_LIFT.height * curve(local),
    opacity: 1 - curve(clamp((local - 0.1) / 0.84)),
    onSeat: local === 0,
    gone: local >= 0.94,
  };
}

// The render copies use the released geometry. Walk, probes and the section
// contact mask keep the original roof at its native transform.
export function createRoofLift(scene) {
  const render = new THREE.Group();
  render.name = "Moving section roof";
  render.visible = false;
  scene.add(render);
  const bounds = new THREE.Box3();
  const centre = new THREE.Vector3();
  const progress = [null, null];
  const goals = [0, 0];
  let roofs = [],
    planting = [],
    independent = [],
    entries = [],
    active = 0,
    maxHeight = 0;

  function clear() {
    render.clear();
    for (const entry of entries) for (const material of entry.materials.values()) material.dispose();
  }

  function build(next, supports) {
    clear();
    roofs = next.slice();
    planting = supports.slice();
    independent = [];
    const owners = new Map(
      roofs.map((root) => [root, { root, scope: root.userData.cutawayOverviewOnly ? 1 : 0, plants: [], materials: new Map(), replicas: new Map() }])
    );
    for (const { plant, support } of planting) {
      let owner = support;
      while (owner && !owners.has(owner)) owner = owner.parent;
      if (owner) owners.get(owner).plants.push(plant);
      else independent.push({ plant, support });
    }
    for (const entry of owners.values()) entry.z = bounds.setFromObject(entry.root).getCenter(centre).z;
    entries = [...owners.values()];
    const first = Math.max(...entries.map((entry) => entry.z));
    const last = Math.min(...entries.map((entry) => entry.z));
    for (const entry of entries) entry.distance = first > last ? (first - entry.z) / (first - last) : 0;
  }

  function makeMaterial(entry, source) {
    if (!source) return source;
    if (entry.materials.has(source)) return entry.materials.get(source);
    const copy = source.clone();
    copy.name = source.name;
    copy.onBeforeCompile = source.onBeforeCompile;
    copy.customProgramCacheKey = source.customProgramCacheKey.bind(source);
    copy.transparent = true;
    copy.depthWrite = false;
    copy.forceSinglePass = true;
    entry.materials.set(source, copy);
    return copy;
  }

  function show(entry, member, pose) {
    member.updateWorldMatrix(true, true);
    // The parent roof controls its full native subtree. Preserve the visibility
    // of children controlled by an authored material or render style.
    const display = (source) => {
      if (source !== member && !source.visible) return;
      if (source.isMesh) {
        let replica = entry.replicas.get(source);
        if (!replica) {
          replica = new THREE.Mesh(source.geometry, source.material);
          replica.matrixAutoUpdate = false;
          replica.userData = { noOcclusion: true, noContactOcclusion: true, noVolumeDepth: true };
          replica.frustumCulled = source.frustumCulled;
          replica.renderOrder = source.renderOrder;
          entry.replicas.set(source, replica);
          render.add(replica);
        }
        const material = source.material;
        replica.geometry = source.geometry;
        replica.material = Array.isArray(material) ? material.map((m) => makeMaterial(entry, m)) : makeMaterial(entry, material);
        replica.matrix.copy(source.matrixWorld);
        replica.matrix.elements[13] += pose.lift;
        replica.matrixWorldNeedsUpdate = true;
        replica.visible = true;
      }
      for (const child of source.children) display(child);
    };
    display(member);
  }

  function paint() {
    active = 0;
    maxHeight = 0;
    render.visible = progress.some((value) => value > 0 && value < 1);
    for (const entry of entries) {
      const pose = roofLiftPose(progress[entry.scope], entry.distance);
      for (const replica of entry.replicas.values()) replica.visible = false;
      entry.root.visible = pose.onSeat;
      for (const plant of entry.plants) plant.visible = pose.onSeat;
      if (pose.onSeat || pose.gone) continue;
      active++;
      maxHeight = Math.max(maxHeight, pose.lift);
      show(entry, entry.root, pose);
      for (const plant of entry.plants) show(entry, plant, pose);
      for (const [source, copy] of entry.materials) copy.opacity = source.opacity * pose.opacity;
    }
  }

  return {
    sync(next, supports, open, { dt = 0, instant = false, overview = open } = {}) {
      if (
        next.length !== roofs.length ||
        next.some((roof, i) => roof !== roofs[i]) ||
        supports.length !== planting.length ||
        supports.some((support, i) => support !== planting[i])
      )
        build(next, supports);
      goals[0] = open ? 1 : 0;
      goals[1] = open && overview ? 1 : 0;
      const advance = Math.min(0.16, Math.max(0, dt)) / ROOF_LIFT.seconds;
      for (const [scope, goal] of goals.entries()) {
        if (progress[scope] === null || instant) progress[scope] = goal;
        else if (progress[scope] !== goal) progress[scope] = clamp(progress[scope] + (goal ? 1 : -1) * advance);
      }
      paint();
      for (const { plant, support } of independent) plant.visible = support.visible;
    },
    get sectionPieces() {
      return entries.filter((entry) => roofLiftPose(progress[entry.scope], entry.distance).gone).map((entry) => entry.root);
    },
    get sectionOpen() {
      return entries.some((entry) => progress[entry.scope] > 0);
    },
    get busy() {
      return progress.some((value, scope) => value !== null && value !== goals[scope]);
    },
    settle() {
      if (progress[0] === null) return;
      for (const [scope, goal] of goals.entries()) progress[scope] = goal;
      paint();
    },
    evidence() {
      return {
        progress: progress[0],
        overviewProgress: progress[1],
        moving: active,
        height: maxHeight,
        copies: render.children.length,
        pieces: entries.length,
      };
    },
    dispose() {
      clear();
      render.removeFromParent();
    },
  };
}
