import * as THREE from "../three.module.min.js";
import { createCurtainCloth, createFacadeDraft, facadeCurtainPanels, CURTAIN_HARDWARE } from "./curtain-cloth.mjs";
import { createCurtainHardware } from "./curtain-rig.mjs";
import { createCurtainMeshes, createSheerFabric } from "./sheer-fabric.mjs";

// Sleep privacy for the current bedroom window. The lower rectangular drapes
// leave the arch's upper crescent as a clerestory; this is not a blackout blind.
// Measure the delivered aperture rather than reusing the old facade's height,
// floor or eight-metre setback. The wardrobe and the bedside exit stay behind it.
export function bedroomCurtainLayout(triangles, floor) {
  if (!Number.isFinite(floor) || !Array.isArray(triangles) || !triangles.length)
    throw new TypeError("Bedroom curtains require the actual glazing triangles and floor");
  const points = triangles.flat();
  if (points.some((p) => !Array.isArray(p) || p.length !== 3 || !p.every(Number.isFinite))) throw new TypeError("Invalid bedroom glazing positions");
  const min = [0, 1, 2].map((axis) => Math.min(...points.map((p) => p[axis])));
  const max = [0, 1, 2].map((axis) => Math.max(...points.map((p) => p[axis])));
  if (max[2] - min[2] > 0.03 || max[0] - min[0] < 2 || min[1] < floor || min[1] > floor + 0.1)
    throw new RangeError("Bedroom glazing no longer has the surveyed vertical facade frame");
  const from = min[0] + 0.05;
  const to = max[0] - 0.05;
  const sections = Array.from({ length: 33 }, (_, n) => {
    const x = from + ((to - from) * n) / 32;
    const heights = [];
    for (const triangle of triangles)
      for (let j = 0; j < 3; j++) {
        const a = triangle[j];
        const b = triangle[(j + 1) % 3];
        if (Math.abs(b[0] - a[0]) < 1e-10 || x < Math.min(a[0], b[0]) || x > Math.max(a[0], b[0])) continue;
        heights.push(a[1] + ((x - a[0]) / (b[0] - a[0])) * (b[1] - a[1]));
      }
    if (!heights.length) throw new RangeError("Bedroom rail leaves the actual glazed aperture");
    return { x, bottom: Math.min(...heights), top: Math.max(...heights) };
  });
  const hardware = {
    ...CURTAIN_HARDWARE,
    rodY: Math.min(...sections.map((p) => p.top)) - 0.065,
    rodZ: max[2] + 0.17,
    bracketOverhang: 0.08,
  };
  const facade = {
    glassZ: max[2],
    hardwareZ: max[2] + 0.025,
    headFaceZ: max[2] + 0.008,
    doorHead: hardware.rodY + 0.07,
    headTop: hardware.rodY + 0.12,
    floorY: floor,
  };
  const tracks = [
    {
      id: "sleep",
      door: "sleep",
      rail: { from, to },
      panels: [
        { id: "sleep-south", stackX: from, closeToward: 1, keepOut: { min: from - 0.015 } },
        { id: "sleep-north", stackX: to, closeToward: -1, keepOut: { max: to + 0.015 } },
      ],
    },
  ];
  return { min, max, sections, hardware, facade, tracks, depthLimit: max[2] + 0.325 };
}

export const bedroomCurtainOpen = (routine) => (routine?.id === "sleep" ? 0 : 1);

function guardedWindowBays(scene, layout, floor) {
  const cap = [];
  scene.updateMatrixWorld(true);
  scene.traverse((mesh) => {
    if (!mesh.isMesh || !(mesh.userData.name || mesh.name).startsWith("core_tea_garden_bedroom_pocket_guard_cap__")) return;
    const positions = mesh.geometry.attributes.position;
    for (let n = 0; n < positions.count; n++) cap.push(new THREE.Vector3().fromBufferAttribute(positions, n).applyMatrix4(mesh.matrixWorld));
  });
  if (!cap.length) return null;
  // At the glazing end, only the two side returns reach the pane. Their
  // bronze caps are wider than the glass and set the actual cloth clearance.
  const near = Math.min(...cap.map((point) => point.z));
  const ends = cap.filter((point) => point.z < near + 0.07);
  const middle = (Math.min(...ends.map((p) => p.x)) + Math.max(...ends.map((p) => p.x))) / 2;
  const left = ends.filter((point) => point.x < middle).map((point) => point.x);
  const right = ends.filter((point) => point.x > middle).map((point) => point.x);
  const gap = 0.005;
  const from = layout.min[0] + 0.03;
  const to = layout.max[0] - 0.03;
  const widths = [
    [from, Math.min(...left) - gap],
    [Math.max(...left) + gap, Math.min(...right) - gap],
    [Math.max(...right) + gap, to],
  ];
  if (left.length < 3 || right.length < 3 || widths.some(([a, b]) => b - a < 0.15))
    throw new RangeError("Bedroom privacy shades need two distinct guard returns within the glazing");
  return widths.map(([from, to]) => {
    const sections = layout.sections.filter((section) => section.x >= from && section.x <= to);
    if (!sections.length) throw new RangeError("Bedroom shade rail leaves the measured glazing");
    return { from, to, hem: Math.max(floor + 0.02, Math.max(...sections.map((section) => section.bottom)) - 0.012) };
  });
}

function createPleatedShade(bay, top, z, fabric, index) {
  const folds = 36;
  const drop = top - bay.hem;
  const segment = (drop + 0.008) / folds;
  const corners = [
    [0, 0],
    [1, 0],
    [0, 1],
    [1, 0],
    [1, 1],
    [0, 1],
  ];
  const geometry = new THREE.BufferGeometry();
  const positions = new THREE.BufferAttribute(new Float32Array(folds * 18), 3).setUsage(THREE.DynamicDrawUsage);
  const tangent = new THREE.BufferAttribute(new Float32Array(folds * 18), 3);
  const uv = new THREE.BufferAttribute(new Float32Array(folds * 12), 2);
  for (let row = 0; row < folds; row++)
    for (const [n, [column, edge]] of corners.entries()) {
      const i = row * 6 + n;
      tangent.setXYZ(i, 1, 0, 0);
      uv.setXY(i, column * (bay.to - bay.from), (folds - row - edge) * segment);
    }
  geometry.setAttribute("position", positions);
  geometry.setAttribute("sheerTangent", tangent);
  geometry.setAttribute("uv", uv);
  const mesh = fabric.bindMesh(new THREE.Mesh(geometry));
  mesh.name = `curtain sleep-window-${index + 1}`;
  function setOpen(open) {
    const interval = THREE.MathUtils.lerp(drop, 0.13, open) / folds;
    // Shorten the projected drop, gathering the same length of linen into
    // an accordion. Each crease stays between its original vertical guides.
    const pleat = Math.sqrt(Math.max(0, segment ** 2 - interval ** 2));
    for (let row = 0; row < folds; row++)
      for (const [n, [column, edge]] of corners.entries()) {
        const line = row + edge;
        positions.setXYZ(row * 6 + n, column ? bay.to : bay.from, top - line * interval, z + (line % 2) * pleat);
      }
    positions.needsUpdate = true;
    geometry.computeVertexNormals();
    geometry.computeBoundingSphere();
  }
  return { mesh, setOpen };
}

function createGuardedBedroomShades({ scene, layout, bays, routine, bindMaterial }) {
  const fabric = createSheerFabric({
    name: "coastal sleep drape",
    coverage: "opaque",
    openness: 0,
    transmission: 0,
    color: 0xc6b7a4,
    sheenColor: 0xd8cdbc,
    slub: 0.09,
  });
  bindMaterial(fabric.material);
  const top = layout.hardware.rodY - 0.035;
  const z = layout.max[2] + 0.066;
  const shades = bays.map((bay, i) => createPleatedShade(bay, top, z, fabric, i));
  const rail = new THREE.Mesh(
    new THREE.BoxGeometry(layout.max[0] - layout.min[0] + 0.04, 0.046, 0.065),
    new THREE.MeshStandardMaterial({ name: "bedroom shade rail bronze", color: 0x514137, metalness: 0.7, roughness: 0.36 })
  );
  rail.position.set((layout.min[0] + layout.max[0]) / 2, top + 0.021, z - 0.022);
  rail.name = "Bedroom shade rail";
  rail.userData.noContactOcclusion = true;
  rail.castShadow = rail.receiveShadow = true;
  bindMaterial(rail.material);
  const group = new THREE.Group();
  group.name = "Bedroom privacy shades";
  group.add(rail, ...shades.map(({ mesh }) => mesh));
  scene.add(group);
  let target = bedroomCurtainOpen(routine);
  let open = target;
  let disposed = false;
  const draw = () => shades.forEach((shade) => shade.setOpen(open));
  draw();
  return {
    group,
    layout: { ...layout, bays },
    step({ delta, moving, reduced, routine: next }) {
      if (disposed) return;
      const wanted = bedroomCurtainOpen(next);
      const distance = wanted - open;
      const fraction =
        reduced || (!moving && wanted !== target) ? wanted : moving ? open + Math.sign(distance) * Math.min(Math.abs(distance), delta * 0.4) : open;
      target = wanted;
      if (fraction === open) return;
      open = fraction;
      draw();
    },
    evidence: () => ({
      target,
      open,
      coverage: "opaque linen shades with open upper clerestory",
      aperture: { min: layout.min, max: layout.max, railY: rail.position.y, railZ: z },
      hardware: { rails: 1, bays: bays.length },
      draws: shades.length + 1,
    }),
    dispose() {
      if (disposed) return;
      disposed = true;
      for (const shade of shades) shade.mesh.geometry.dispose();
      rail.geometry.dispose();
      rail.material.dispose();
      fabric.dispose();
      group.removeFromParent();
    },
  };
}

export function createBedroomCurtains({ scene, room, floor, coast, reduced = false, startTime = 0, routine, bindMaterial = () => {} }) {
  let glazing = null;
  room.updateMatrixWorld(true);
  room.traverse((mesh) => {
    if (mesh.isMesh && (mesh.userData.name || mesh.name) === "sleep_fin_window__facade low-iron glass") glazing = mesh;
  });
  if (!glazing) throw new Error("The current bedroom window is required for its privacy drapes");
  const attribute = glazing.geometry.attributes.position;
  const index = glazing.geometry.index;
  const triangles = [];
  for (let i = 0; i < (index?.count ?? attribute.count); i += 3)
    triangles.push(
      [0, 1, 2].map((k) =>
        new THREE.Vector3()
          .fromBufferAttribute(attribute, index ? index.getX(i + k) : i + k)
          .applyMatrix4(glazing.matrixWorld)
          .toArray()
      )
    );
  const layout = bedroomCurtainLayout(triangles, floor);
  const bays = guardedWindowBays(scene, layout, floor);
  if (bays) return createGuardedBedroomShades({ scene, layout, bays, routine, bindMaterial });
  const draft = createFacadeDraft({ coast, doors: [], glassZ: layout.max[2], glassDraft: -0.015 });
  const specs = facadeCurtainPanels({
    ...layout,
    openFraction: bedroomCurtainOpen(routine),
    rings: 8,
    flat: 2,
    rows: 21,
    fullness: 1.35,
  });
  for (const spec of specs) spec.planes.push({ normal: [0, 0, -1], offset: -layout.depthLimit });
  const cloth = createCurtainCloth({
    panels: specs,
    wind: draft.sample,
    reducedMotion: reduced,
    startTime,
    fixedStep: 1 / 30,
    substeps: 6,
    maxStepsPerUpdate: 2,
    drawSpeed: 0.32,
  });
  const fabric = createSheerFabric({
    name: "coastal sleep drape",
    coverage: "opaque",
    openness: 0,
    transmission: 0,
    color: 0xc6b7a4,
    sheenColor: 0xd8cdbc,
    slub: 0.09,
    fabricTop: specs[0].drop,
    tapeHeight: 0.08,
  });
  bindMaterial(fabric.material);
  const meshes = createCurtainMeshes(cloth, fabric, { refine: 3 });
  const hardware = createCurtainHardware(cloth, bindMaterial, layout.hardware, layout.tracks, layout.facade);
  const group = new THREE.Group();
  group.name = "Bedroom privacy drapes";
  group.add(...meshes.meshes, hardware.rods, hardware.rings);
  scene.add(group);
  const frustum = new THREE.Frustum();
  const matrix = new THREE.Matrix4();
  const bound = new Float64Array(10);
  const box = new THREE.Box3();
  const center = new THREE.Vector3();
  const revisions = new Float64Array(cloth.panels.length);
  let target = bedroomCurtainOpen(routine);
  let inView = false;
  let disposed = false;
  let ringRevision = NaN;
  function refresh() {
    for (let i = 0; i < revisions.length; i++) revisions[i] = cloth.island(i).state.revision;
    meshes.update(revisions);
    const rings = cloth.openFraction(0) + 2 * cloth.openFraction(1);
    if (rings !== ringRevision) {
      ringRevision = rings;
      hardware.update();
    }
  }
  return {
    group,
    cloth,
    layout,
    step({ delta, moving, reduced: still, time, routine: next, camera, canvasHeight }) {
      if (disposed) return;
      cloth.setReducedMotion(still);
      inView = false;
      if (camera?.isPerspectiveCamera) {
        camera.updateMatrixWorld();
        frustum.setFromProjectionMatrix(matrix.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse));
        const pixels = canvasHeight / 2 / Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2);
        for (let i = 0; i < cloth.panels.length; i++) {
          const panel = cloth.panels[i];
          cloth.island(i).bounds(bound, 0.04);
          box.min.set(bound[4], bound[5], bound[6]);
          box.max.set(bound[7], bound[8], bound[9]);
          const distance = camera.position.distanceTo(box.getCenter(center));
          const visible = frustum.intersectsBox(box) && (panel.fabricSize[1] * pixels) / Math.max(0.1, distance) > 90;
          cloth.setActive(panel.id, visible);
          inView ||= visible;
        }
      }
      const wanted = bedroomCurtainOpen(next);
      if (wanted !== target) {
        target = wanted;
        for (const panel of cloth.panels) cloth.setOpenFraction(panel.id, target, { compose: !moving || still || !inView });
      }
      if (cloth.pending && !(moving && inView)) cloth.settlePending(1);
      if (moving && inView) cloth.update(Math.min(delta, 0.1), time);
      refresh();
    },
    evidence() {
      return {
        target,
        inView,
        coverage: "opaque privacy drapes with open upper clerestory",
        aperture: { min: layout.min, max: layout.max, railY: layout.hardware.rodY, railZ: layout.hardware.rodZ },
        cloth: cloth.evidence(),
        hardware: hardware.evidence(),
        draws: meshes.meshes.length + 2,
      };
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      meshes.dispose();
      fabric.dispose();
      hardware.dispose();
      group.removeFromParent();
    },
  };
}
