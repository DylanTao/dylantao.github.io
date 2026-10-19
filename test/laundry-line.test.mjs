import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "../assets/js/three.module.min.js";
import { coastalDaylight } from "../assets/js/home-scene/daylight.mjs";
import { createCoastWind } from "../assets/js/home-scene/wind-field.mjs";
import {
  LAUNDRY_ITEMS,
  LAUNDRY_LINE,
  LAUNDRY_POSTS,
  createLaundryLine,
  createTerraceDraft,
  laundryOut,
  parapetPath,
} from "../assets/js/home-scene/laundry-line.mjs";
import { createLaundryRig } from "../assets/js/home-scene/laundry-rig.mjs";

const DAY = "2026-10-16";
function breeze(minute) {
  const coast = createCoastWind({ minute, doors: 1 });
  const laundry = createLaundryLine({ wind: createTerraceDraft({ coast }) });
  return { coast, laundry, island: laundry.island };
}
function runFor(sim, seconds, minute, t0 = 0) {
  let t = t0;
  for (let k = 0; k < Math.round(seconds * 30); k++) {
    t += 1 / 30;
    sim.coast.update({ seconds: t, minute });
    sim.island.step(t);
  }
  return t;
}
// Mean horizontal offset of an item's particles from the line's vertical plane, toward the house.
function lean(sim, id) {
  const { island, model, line } = sim.laundry;
  const item = sim.laundry.pieces.find((p) => p.id === id),
    pieces = new Set(item.pieces);
  let sum = 0,
    n = 0;
  for (let i = 0; i < island.count; i++) {
    if (!pieces.has(model.piece[i])) continue;
    const dx = island.positions[3 * i] - line.start[0],
      dz = island.positions[3 * i + 2] - line.start[1];
    sum += dx * line.inward[0] + dz * line.inward[1];
    n++;
  }
  return sum / n;
}

test("the line runs between the first two festoon posts on the parapet, and everything hangs from it", () => {
  const { laundry, island } = breeze(15 * 60);
  const { line } = laundry;
  assert.ok(Math.hypot(line.start[0] - LAUNDRY_POSTS[0][0], line.start[1] - LAUNDRY_POSTS[0][1]) < 0.05);
  assert.ok(Math.hypot(line.end[0] - LAUNDRY_POSTS[1][0], line.end[1] - LAUNDRY_POSTS[1][1]) < 0.05);
  // The posts stand on the parapet's centre line (bin/coastal_facade.py), within a few centimetres.
  const rail = parapetPath(LAUNDRY_POSTS[0][0] - 0.01, LAUNDRY_POSTS[1][0] + 0.01, 64);
  for (const post of LAUNDRY_POSTS) {
    const nearest = Math.min(...rail.map(([x, z]) => Math.hypot(x - post[0], z - post[1])));
    assert.ok(nearest < 0.04, `post ${post} is ${nearest} m from the parapet line`);
  }
  // The line inward normal points toward the house (+z, landward).
  assert.ok(line.inward[1] > 0.9);
  assert.equal(laundry.pegs.length, 2 + 2 + 3 + 2, "two pegs at the corners of the indigo towel, two at the shirt's shoulders, three and two");
  assert.deepEqual(
    laundry.pieces.map((p) => p.id),
    LAUNDRY_ITEMS.map((item) => item.id)
  );
  // Every cloth particle hangs at or below the line's tie height before the wind arrives.
  for (let i = 0; i < island.count; i++) assert.ok(island.positions[3 * i + 1] <= LAUNDRY_LINE.height + 1e-9);
});

test("in the afternoon sea breeze the laundry lifts toward the house; in the 09:00 lull it hangs nearly still", () => {
  const afternoon = breeze(15 * 60 + 30);
  runFor(afternoon, 12, 930);
  const lull = breeze(9 * 60);
  runFor(lull, 12, 540);
  for (const id of ["towel-indigo", "towel-natural", "towel-terracotta"]) {
    const windy = lean(afternoon, id),
      calm = lean(lull, id);
    assert.ok(windy > 0.05, `${id} leans ${windy} m toward the house in the sea breeze`);
    assert.ok(Math.abs(calm) < 0.5 * windy, `${id} leans ${calm} m in the lull vs ${windy} m`);
  }
  assert.ok(afternoon.island.state.windMax > lull.island.state.windMax);
});

test("the cloth never passes through the posts, the cap rail or the balustrade, and the line keeps its length", () => {
  // A hard gust, twice the afternoon breeze, blowing out to sea against the rail.
  const coast = createCoastWind({ minute: 15 * 60, doors: 1 });
  const draft = createTerraceDraft({ coast, exposure: 1.4 });
  const laundry = createLaundryLine({
    wind: (x, y, z, t, out) => {
      draft.sample(x, y, z, t, out);
      out[2] = -Math.abs(out[2]) - 1.5;
      return out;
    },
  });
  const { island, line } = laundry;
  const rail = parapetPath();
  let closestRail = Infinity,
    closestPost = Infinity,
    longest = 0;
  const restLength = (() => {
    let total = 0;
    const p = island.positions;
    for (let k = 1; k < line.particles.length; k++) {
      const a = 3 * line.particles[k - 1],
        b = 3 * line.particles[k];
      total += Math.hypot(p[b] - p[a], p[b + 1] - p[a + 1], p[b + 2] - p[a + 2]);
    }
    return total;
  })();
  for (let k = 0; k < 30 * 10; k++) {
    island.step(k / 30);
    if (k % 5) continue;
    const p = island.positions;
    for (let i = 0; i < island.count; i++) {
      if (island.isKinematic(i)) continue;
      const x = p[3 * i],
        y = p[3 * i + 1],
        z = p[3 * i + 2];
      for (const post of LAUNDRY_POSTS) if (y > 0.5 && y < 2.4) closestPost = Math.min(closestPost, Math.hypot(x - post[0], z - post[1]));
      if (Math.abs(y - 1.1) < 0.005)
        for (let s = 0; s < rail.length - 1; s++) {
          const [ax, az] = rail[s],
            [bx, bz] = rail[s + 1],
            ux = bx - ax,
            uz = bz - az,
            t = Math.max(0, Math.min(1, ((x - ax) * ux + (z - az) * uz) / (ux * ux + uz * uz)));
          closestRail = Math.min(closestRail, Math.hypot(x - ax - t * ux, z - az - t * uz));
        }
    }
    let length = 0;
    for (let q = 1; q < line.particles.length; q++) {
      const a = 3 * line.particles[q - 1],
        b = 3 * line.particles[q];
      length += Math.hypot(p[b] - p[a], p[b + 1] - p[a + 1], p[b + 2] - p[a + 2]);
    }
    longest = Math.max(longest, length);
  }
  assert.ok(closestPost >= LAUNDRY_LINE.postRadius - 1e-6, `cloth within ${closestPost} m of a post's axis`);
  if (Number.isFinite(closestRail)) assert.ok(closestRail >= 0.021 - 1e-6, `cloth within ${closestRail} m of the cap rail's axis`);
  assert.ok(longest < restLength * 1.03, `the line stretched to ${longest} m from ${restLength} m`);
});

test("the shirt's front and back stay apart and its sleeves hang from the armholes", () => {
  const sim = breeze(15 * 60 + 30);
  runFor(sim, 8, 930);
  const { island, model } = sim.laundry;
  for (let i = 0; i < 3 * island.count; i++) assert.ok(Number.isFinite(island.positions[i]));
  const shirt = sim.laundry.pieces.find((p) => p.id === "shirt");
  assert.equal(shirt.pieces.length, 6, "front, back and two halves of each sleeve");
  // The separations hold the layers at least 1 cm apart (16 mm asked, one pass per substep).
  const sep = model.separations;
  let closest = Infinity;
  for (const [i, j] of sep) {
    const p = island.positions;
    closest = Math.min(closest, Math.hypot(p[3 * j] - p[3 * i], p[3 * j + 1] - p[3 * i + 1], p[3 * j + 2] - p[3 * i + 2]));
  }
  assert.ok(sep.length > 100 && closest > 0.008, `${sep.length} separations, closest ${closest} m`);
  assert.ok(island.strain(null, true) < 0.2, `stretch ${island.strain(null, true)}`);
});

test("the laundry is out while the house is open, and in at night and while Sirui sleeps", () => {
  const routine = (id) => ({ id });
  assert.equal(laundryOut({ routine: routine("reading"), daylight: coastalDaylight(DAY, 13 * 60) }), true);
  assert.equal(laundryOut({ routine: routine("dinner"), daylight: coastalDaylight(DAY, 21 * 60) }), false);
  assert.equal(laundryOut({ routine: routine("sleep"), daylight: coastalDaylight(DAY, 10 * 60) }), false);
  assert.equal(laundryOut({}), false);
});

test("the same wind and steps give the same laundry, bit for bit; a step allocates nothing", () => {
  const a = breeze(15 * 60 + 30),
    b = breeze(15 * 60 + 30);
  runFor(a, 3, 930);
  runFor(b, 3, 930);
  assert.deepEqual(Array.from(a.island.positions), Array.from(b.island.positions));
  const names = ["Array", "Float64Array", "Float32Array", "Int32Array", "Uint32Array", "Uint16Array", "Uint8Array"];
  const originals = Object.fromEntries(names.map((name) => [name, globalThis[name]]));
  let constructed = 0;
  for (const name of names)
    globalThis[name] = new Proxy(originals[name], {
      construct(target, args, newTarget) {
        constructed++;
        return Reflect.construct(target, args, newTarget);
      },
      apply(target, self, args) {
        constructed++;
        return Reflect.apply(target, self, args);
      },
    });
  try {
    runFor(a, 2, 930, 3);
  } finally {
    Object.assign(globalThis, originals);
  }
  assert.equal(constructed, 0);
});

test("the rig draws six meshes, steps only on screen, holds still when paused and composes under reduced motion", () => {
  const scene = new THREE.Scene(),
    coast = createCoastWind({ minute: 15 * 60 + 30, doors: 1 }),
    bound = [];
  const rig = createLaundryRig({ scene, coast, bindMaterial: (m) => bound.push(m) });
  assert.equal(rig.group.children.length, 6, "three towels, the shirt, the line and the pegs");
  assert.equal(bound.length, 6);
  const routine = { id: "reading" },
    daylight = coastalDaylight(DAY, 15 * 60 + 30);
  const camera = new THREE.PerspectiveCamera(40, 545 / 461, 0.05, 300);
  camera.position.set(-0.7, 1.6, -5.3);
  camera.lookAt(-1.0, 1.5, -7.25);
  let t = 0;
  const frame = (moving, overrides = {}) =>
    rig.step({ delta: 1 / 60, moving, reduced: false, time: (t += 1 / 60), daylight, routine, camera, canvasHeight: 461, ...overrides });
  const cloth = rig.group.children.filter((m) => m.isMesh && !m.isInstancedMesh && m.name !== "laundry line");
  assert.equal(cloth.length, 4);
  // Dense linen casts an ordinary shadow: no custom depth material, so the shadow cache sees each
  // upload as a moved caster and keeps the shadow once the laundry sleeps.
  assert.ok(cloth.every((m) => m.castShadow && m.customDepthMaterial === undefined));
  const version = cloth[0].geometry.attributes.position.version;
  for (let k = 0; k < 120; k++) frame(true);
  const live = rig.evidence();
  assert.ok(live.out && live.inView && live.stepping && live.steps > 50, JSON.stringify(live));
  assert.ok(cloth[0].geometry.attributes.position.version > version, "each step uploads the moved cloth");
  // Each item is bounded by its own particles, so a camera beside the line culls what is behind it.
  for (const m of cloth) assert.ok(m.geometry.boundingSphere.radius < 1.1, `${m.name} bound ${m.geometry.boundingSphere.radius} m`);
  // Paused: nothing steps and nothing moves.
  const pose = Array.from(rig.laundry.island.positions),
    steps = live.steps;
  for (let k = 0; k < 60; k++) frame(false);
  assert.equal(rig.evidence().steps, steps);
  assert.deepEqual(Array.from(rig.laundry.island.positions), pose);
  // Reduced motion: a settled, sleeping drape.
  frame(false, { reduced: true });
  assert.ok(rig.laundry.island.state.sleeping && rig.laundry.island.energies().kinetic === 0);
  // From inside the house, looking inland: no stepping.
  camera.position.set(0, 1.6, 0);
  camera.lookAt(0, 1.6, 5);
  frame(true);
  assert.ok(!rig.evidence().stepping);
  // Night: taken in.
  frame(true, { daylight: coastalDaylight(DAY, 21 * 60), routine: { id: "dinner" } });
  assert.equal(rig.group.visible, false);
  rig.dispose();
  assert.equal(scene.getObjectByName("Terrace laundry"), undefined);
});
