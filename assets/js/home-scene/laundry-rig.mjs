import * as THREE from "../three.module.min.js";
import { LAUNDRY_LINE, createLaundryLine, createTerraceDraft, laundryOut } from "./laundry-line.mjs";
import { createSheerFabric } from "./sheer-fabric.mjs";
import { localSceneOffset, localSceneWind } from "./local-scene-frame.mjs";
import { frameFromScene, framePoint, windInFrame } from "./laundry-frame.mjs";

// The laundry on the terrace in the live scene (Sirui, 2026-10-18): laundry-line.mjs's line, towels
// and shirt, drawn in sheer-fabric.mjs's linen (opaque here: a towel lets light through its yarn, not
// through gaps), with wooden pegs and a cotton line. It steps while the laundry, where it hangs now, is
// on screen and at least about 40 px tall, at 30 Hz with six substeps; it sleeps in still air, holds
// still under Pause and composes a settled drape under reduced motion. It hangs out while the house is
// open and is taken in at dusk.
//
// Draws: one mesh per item (their shared position buffer uploads once a frame), each culled by the
// sphere around its own cloth, one for the line and one instanced mesh for the pegs: six in all, plus
// their shadows. Dense linen casts an ordinary shadow, which the shadow cache keeps while it sleeps.
export function createLaundryRig({ scene, coast, reduced = false, bindMaterial = () => {}, offset = [0, 0, 0] }) {
  const frame = frameFromScene(scene, localSceneOffset(offset));
  const translation = new THREE.Vector3(...frame.translation);
  const draft = frame.native
    ? windInFrame(createTerraceDraft({ coast }), frame)
    : createTerraceDraft({ coast: localSceneWind(coast, translation.toArray()) });
  const laundry = createLaundryLine({ wind: draft, rail: frame.rail, floorY: frame.floorY, postBaseY: frame.postBaseY, postTopY: frame.postTopY });
  const { island, model, pieces, line } = laundry;
  const N = island.count;
  const group = new THREE.Group();
  group.name = "Terrace laundry";
  group.position.copy(translation);
  group.rotation.y = frame.yaw;
  group.updateMatrix();
  const frameMatrix = group.matrix.clone();
  const position = new THREE.BufferAttribute(new Float32Array(3 * N), 3).setUsage(THREE.DynamicDrawUsage),
    normal = new THREE.BufferAttribute(new Float32Array(3 * N), 3).setUsage(THREE.DynamicDrawUsage),
    tangent = new THREE.BufferAttribute(new Float32Array(3 * N), 3).setUsage(THREE.DynamicDrawUsage),
    uv = new THREE.BufferAttribute(model.uv, 2);
  // Bounds: the line between the posts and everything that hangs below it, lifted by the wind.
  const centre = new THREE.Vector3((line.start[0] + line.end[0]) / 2, LAUNDRY_LINE.height - 0.5, (line.start[1] + line.end[1]) / 2),
    radius = line.length / 2 + 1.2;
  const fabrics = [];
  const meshes = pieces.map((group) => {
    const item = group.item;
    const fabric = createSheerFabric({
      name: `terrace ${item.kind === "shirt" ? "shirt" : "towel"} linen`,
      coverage: "opaque",
      color: item.color,
      openness: item.kind === "shirt" ? 0.05 : 0.025,
      transmission: item.kind === "shirt" ? 0.5 : 0.32,
      transmissionColor: 0xfff4e6,
      sheenColor: item.kind === "shirt" ? 0xe8e4dc : 0xb8ad9c,
      sheenRoughness: 0.6,
      roughness: 0.88,
      slub: item.kind === "shirt" ? 0.1 : 0.2,
      hemHeight: item.kind === "shirt" ? 0.03 : 0.025,
      stripe: item.stripe ?? null,
    });
    bindMaterial(fabric.material);
    fabrics.push(fabric);
    const wanted = new Set(group.pieces);
    const indices = [],
      members = new Set();
    for (let t = 0; t < island.triPiece.length; t++)
      if (wanted.has(island.triPiece[t]))
        for (let q = 0; q < 3; q++) {
          indices.push(island.triangles[3 * t + q]);
          members.add(island.triangles[3 * t + q]);
        }
    // The item's own particles, for a bounding sphere refreshed at each upload.
    group.particles = Uint32Array.from(members);
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", position);
    geometry.setAttribute("normal", normal);
    geometry.setAttribute("sheerTangent", tangent);
    geometry.setAttribute("uv", uv);
    geometry.setIndex(new THREE.BufferAttribute(N < 65536 ? Uint16Array.from(indices) : Uint32Array.from(indices), 1));
    geometry.boundingSphere = new THREE.Sphere(centre.clone(), radius);
    const mesh = new THREE.Mesh(geometry, fabric.material);
    mesh.name = `laundry ${item.id}`;
    mesh.matrixAutoUpdate = false;
    fabric.bindMesh(mesh);
    group.mesh = mesh;
    return mesh;
  });

  // The line: a thin tube through its nodes, rebuilt in place from the solver each frame.
  const SIDES = 5,
    nodes = line.particles.length,
    linePosition = new THREE.BufferAttribute(new Float32Array(3 * SIDES * nodes), 3).setUsage(THREE.DynamicDrawUsage),
    lineNormal = new THREE.BufferAttribute(new Float32Array(3 * SIDES * nodes), 3).setUsage(THREE.DynamicDrawUsage),
    lineIndex = [];
  for (let k = 0; k < nodes - 1; k++)
    for (let s = 0; s < SIDES; s++) {
      const a = k * SIDES + s,
        b = k * SIDES + ((s + 1) % SIDES),
        c = a + SIDES,
        d = b + SIDES;
      lineIndex.push(a, c, b, b, c, d);
    }
  const lineGeometry = new THREE.BufferGeometry();
  lineGeometry.setAttribute("position", linePosition);
  lineGeometry.setAttribute("normal", lineNormal);
  lineGeometry.setIndex(lineIndex);
  lineGeometry.boundingSphere = new THREE.Sphere(centre.clone(), radius);
  const cotton = new THREE.MeshStandardMaterial({ name: "terrace line cotton", color: 0xe9e4d8, roughness: 0.9 });
  bindMaterial(cotton);
  const lineMesh = new THREE.Mesh(lineGeometry, cotton);
  lineMesh.name = "laundry line";
  lineMesh.castShadow = lineMesh.receiveShadow = true;
  lineMesh.matrixAutoUpdate = false;
  lineMesh.userData.noContactOcclusion = true;

  // Pegs: two wooden prongs and a steel spring, gripping the line and the cloth's top edge.
  const prong = new THREE.BoxGeometry(0.0075, 0.072, 0.0055);
  const halves = [prong.clone().translate(0, -0.012, 0.0034), prong.clone().translate(0, -0.012, -0.0034)];
  const spring = new THREE.TorusGeometry(0.0045, 0.0012, 4, 8).translate(0, -0.006, 0);
  const pegGeometry = mergeGeometries([...halves, spring]);
  prong.dispose();
  for (const g of halves) g.dispose();
  spring.dispose();
  const beech = new THREE.MeshStandardMaterial({ name: "terrace peg beech", color: 0xc9a97c, roughness: 0.7 });
  bindMaterial(beech);
  const pegs = new THREE.InstancedMesh(pegGeometry, beech, laundry.pegs.length);
  pegs.name = "laundry pegs";
  pegs.castShadow = pegs.receiveShadow = true;
  // Culled against the line's own sphere, refreshed with it.
  pegs.boundingSphere = new THREE.Sphere(centre.clone(), radius);
  pegs.userData.noContactOcclusion = true;

  for (const mesh of meshes) group.add(mesh);
  group.add(lineMesh, pegs);
  scene.add(group);

  const frustum = new THREE.Frustum(),
    matrix = new THREE.Matrix4(),
    sphere = new THREE.Sphere(centre.clone(), radius),
    box = new THREE.Box3(),
    extent = new Float64Array(10),
    m = new THREE.Matrix4(),
    q = new THREE.Quaternion(),
    v = new THREE.Vector3(),
    up = new THREE.Vector3(),
    forward = new THREE.Vector3(),
    side = new THREE.Vector3(),
    one = new THREE.Vector3(1, 1, 1),
    timings = [];
  let revision = -1,
    out = true,
    inView = false,
    stepping = false,
    steps = 0,
    accumulator = 0,
    timeBase = 0,
    alpha = 1,
    composed = false;
  const fixedStep = island.fixedStep;

  function upload() {
    island.writePositions(position.array, island.state.sleeping ? 1 : alpha);
    island.writeFrame(position.array, normal.array, tangent.array);
    position.needsUpdate = normal.needsUpdate = tangent.needsUpdate = true;
    // Each item's bound from its particles, so a camera beside the line culls what is behind it.
    for (const group of pieces) bound(group.particles, group.mesh.geometry.boundingSphere, 0.02);
    bound(line.particles, lineGeometry.boundingSphere, 0.04);
    pegs.boundingSphere.copy(lineGeometry.boundingSphere);
    pegs.boundingSphere.radius += 0.05;
    // The line's tube: a ring of SIDES vertices around each node, in the plane across the line.
    const p = position.array,
      ring = 0.0022;
    for (let k = 0; k < nodes; k++) {
      const i = line.particles[k],
        prev = line.particles[Math.max(0, k - 1)],
        next = line.particles[Math.min(nodes - 1, k + 1)];
      forward.set(p[3 * next] - p[3 * prev], p[3 * next + 1] - p[3 * prev + 1], p[3 * next + 2] - p[3 * prev + 2]).normalize();
      side.set(0, 1, 0).cross(forward).normalize();
      up.copy(forward).cross(side).normalize();
      for (let s = 0; s < SIDES; s++) {
        const a = (s / SIDES) * Math.PI * 2,
          nx = Math.cos(a) * side.x + Math.sin(a) * up.x,
          ny = Math.cos(a) * side.y + Math.sin(a) * up.y,
          nz = Math.cos(a) * side.z + Math.sin(a) * up.z,
          o = 3 * (k * SIDES + s);
        linePosition.array[o] = p[3 * i] + ring * nx;
        linePosition.array[o + 1] = p[3 * i + 1] + ring * ny;
        linePosition.array[o + 2] = p[3 * i + 2] + ring * nz;
        lineNormal.array[o] = nx;
        lineNormal.array[o + 1] = ny;
        lineNormal.array[o + 2] = nz;
      }
    }
    linePosition.needsUpdate = lineNormal.needsUpdate = true;
    // Each peg stands upright across the line at its node, its prongs either side of the line.
    laundry.pegs.forEach((peg, k) => {
      const i = peg.particle,
        nk = line.particles.indexOf(i),
        a = line.particles[Math.max(0, nk - 1)],
        b = line.particles[Math.min(nodes - 1, nk + 1)];
      forward.set(p[3 * b] - p[3 * a], p[3 * b + 1] - p[3 * a + 1], p[3 * b + 2] - p[3 * a + 2]).normalize();
      up.set(0, 1, 0).addScaledVector(forward, -forward.y).normalize();
      side.copy(forward).cross(up);
      m.makeBasis(forward, up, side);
      q.setFromRotationMatrix(m);
      v.set(p[3 * i], p[3 * i + 1], p[3 * i + 2]);
      pegs.setMatrixAt(k, m.compose(v, q, one));
    });
    pegs.instanceMatrix.needsUpdate = true;
  }

  // The sphere around the axis-aligned box of `particles` (positions in the shared buffer), padded.
  function bound(particles, target, pad) {
    const p = position.array;
    let x0 = Infinity,
      y0 = Infinity,
      z0 = Infinity,
      x1 = -Infinity,
      y1 = -Infinity,
      z1 = -Infinity;
    for (let k = 0; k < particles.length; k++) {
      const i3 = 3 * particles[k],
        x = p[i3],
        y = p[i3 + 1],
        z = p[i3 + 2];
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
      if (z < z0) z0 = z;
      if (z > z1) z1 = z;
    }
    target.center.set((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
    target.radius = 0.5 * Math.hypot(x1 - x0, y1 - y0, z1 - z0) + pad;
  }

  function markVisible(camera, canvasHeight) {
    if (!camera?.isPerspectiveCamera || !out) return false;
    camera.updateMatrixWorld();
    frustum.setFromProjectionMatrix(matrix.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse));
    // Where each item is now, padded for a frame's flap: the laundry steps while any item's box is on
    // screen (a camera standing beside the line sits inside the whole line's sphere).
    let any = false;
    for (const group of pieces) {
      island.bounds(extent, 0.15, group.particles);
      box.min.set(extent[4], extent[5], extent[6]);
      box.max.set(extent[7], extent[8], extent[9]);
      box.applyMatrix4(frameMatrix);
      if (frustum.intersectsBox(box)) {
        any = true;
        break;
      }
    }
    if (!any) return false;
    island.bounds(extent, 0.15);
    sphere.center.set(extent[0], extent[1], extent[2]).applyMatrix4(frameMatrix);
    sphere.radius = extent[3];
    const pixels = canvasHeight / 2 / Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2);
    return frustum.intersectsSphere(sphere) && (0.8 / Math.max(0.1, camera.position.distanceTo(sphere.center))) * pixels > 40;
  }

  function settle() {
    island.settle(1.5);
    composed = true;
    alpha = 1;
  }

  // Settled before it is first seen (not here, which would lengthen the page's loading task): on a
  // background task while the page loads (`settleNow`), or on its first frame, so the first view shows
  // laundry hanging, not falling.
  let pending = true;
  upload();
  revision = island.state.revision;
  function settleNow(still = reduced) {
    if (!pending) return false;
    pending = false;
    settle();
    if (!still) island.wake();
    upload();
    revision = island.state.revision;
    return true;
  }

  return {
    group,
    laundry,
    settleNow,
    get pending() {
      return pending;
    },
    step({ delta, moving, reduced: still, time, daylight, routine, camera, canvasHeight, settle: mayCompose = true }) {
      const started = performance.now();
      if (pending && (mayCompose || still)) settleNow(still);
      const shown = laundryOut({ routine, daylight });
      if (shown !== out) {
        out = shown;
        group.visible = out;
        // Hung out again: start from a settled drape.
        if (out) {
          settle();
          if (!still) island.wake();
        }
      }
      inView = markVisible(camera, canvasHeight);
      stepping = moving && !still && inView && !pending;
      if (still && !composed) settle();
      if (stepping) {
        composed = false;
        accumulator += Math.min(delta, 0.1);
        let due = 0;
        for (let backlog = accumulator; backlog >= fixedStep && due < 2; backlog -= fixedStep) due++;
        if (due && Number.isFinite(time)) timeBase = time - (steps + due - 1) * fixedStep;
        let taken = 0;
        while (accumulator >= fixedStep && taken < 2) {
          island.step(timeBase + steps * fixedStep);
          steps++;
          taken++;
          accumulator -= fixedStep;
        }
        if (accumulator >= fixedStep) accumulator = fixedStep * 0.999;
        alpha = accumulator / fixedStep;
      }
      if (out && (island.state.revision !== revision || (stepping && !island.state.sleeping))) {
        revision = island.state.revision;
        upload();
      }
      if (stepping) {
        timings.push(performance.now() - started);
        if (timings.length > 120) timings.shift();
      }
    },
    evidence() {
      const sorted = [...timings].sort((a, b) => a - b),
        energy = island.energies();
      return {
        out,
        offset: translation.toArray(),
        frame: { native: frame.native, node: frame.node, yaw: frame.yaw, translation: frame.translation, rail: frame.rail, floorY: frame.floorY },
        anchorsWorld: [line.start, line.end].map((p) => framePoint(frame, [p[0], LAUNDRY_LINE.height, p[1]])),
        inView,
        stepping,
        sleeping: island.state.sleeping,
        steps,
        items: laundry.items.map((item) => item.id),
        particles: island.count,
        constraints: island.counts,
        pegs: laundry.pegs.length,
        windMetersPerSecond: island.state.windMax,
        exposure: draft.exposure,
        maxStretch: island.strain(null, true),
        kineticEnergy: energy.kinetic,
        bendingEnergy: energy.bend,
        draws: meshes.length + 2,
        frameMilliseconds: {
          samples: sorted.length,
          median: sorted[Math.floor(sorted.length / 2)] ?? null,
          p95: sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))] ?? null,
        },
      };
    },
    dispose() {
      for (const mesh of meshes) mesh.geometry.dispose();
      for (const fabric of fabrics) fabric.dispose();
      lineGeometry.dispose();
      pegGeometry.dispose();
      cotton.dispose();
      beech.dispose();
      group.removeFromParent();
    },
  };
}

function mergeGeometries(list) {
  let total = 0;
  const flat = list.map((g) => (g.index ? g.toNonIndexed() : g));
  for (const g of flat) total += g.attributes.position.count;
  const position = new Float32Array(3 * total),
    normal = new Float32Array(3 * total);
  let offset = 0;
  flat.forEach((g, k) => {
    position.set(g.attributes.position.array, 3 * offset);
    normal.set(g.attributes.normal.array, 3 * offset);
    offset += g.attributes.position.count;
    if (g !== list[k]) g.dispose();
  });
  const merged = new THREE.BufferGeometry();
  merged.setAttribute("position", new THREE.BufferAttribute(position, 3));
  merged.setAttribute("normal", new THREE.BufferAttribute(normal, 3));
  merged.computeBoundingSphere();
  return merged;
}
