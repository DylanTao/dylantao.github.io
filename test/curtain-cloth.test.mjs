import test from "node:test";
import assert from "node:assert/strict";
import { performance } from "node:perf_hooks";
import { ShaderLib, ShaderChunk } from "../assets/js/three.module.min.js";
import { DEFAULT_WIND, sampleWind } from "../assets/js/home-scene/wind-field.mjs";
import {
  CURTAIN_FACADE,
  CURTAIN_TRACKS,
  createCurtainCloth,
  createFacadeCurtains,
  createFacadeDraft,
  facadeCurtainPanels,
} from "../assets/js/home-scene/curtain-cloth.mjs";
import {
  SHEER_FABRIC_NAME,
  createSheerFabric,
  patchSheerShader,
  patchSheerShadowShader,
  weaveOpenness,
  weaveYarnRatios,
} from "../assets/js/home-scene/sheer-fabric.mjs";

const STEP = 1 / 60;
const run = (cloth, seconds, dt = STEP) => {
  for (let k = 0, n = Math.round(seconds / dt); k < n; k++) cloth.update(dt);
};
// Strong, gusty air blowing into the room: up to about 3.6 m/s, with crosswind and lift.
const gusty =
  (scale = 1) =>
  (x, y, z, t, out) => {
    const g = 0.5 + 0.5 * Math.sin(1.7 * t) * Math.sin(0.43 * t + 0.4 * x);
    out[0] = 0.6 * scale * Math.sin(0.9 * t + y);
    out[1] = 0.2 * scale * Math.sin(2.3 * t + x);
    out[2] = scale * (1.2 + 2.4 * g);
    return out;
  };
const facade = (overrides = {}) => {
  const panels = facadeCurtainPanels();
  panels[0].openFraction = 0.5;
  panels[3].openFraction = 1;
  return createCurtainCloth({ panels, ...overrides });
};
const everyPosition = (cloth, fn) => {
  for (const panel of cloth.panels) for (let i = 0; i < panel.count; i++) fn(panel, i, panel.positions);
};

test("structural constraint error stays small in still air and bounded in strong gusts", () => {
  const still = facade();
  run(still, 3);
  assert.ok(still.evidence().maxConstraintError < 0.01, `still-air strain ${still.evidence().maxConstraintError}`);

  // The facade's own doorway draft, both doors open: the realistic case.
  const sim = createFacadeCurtains({ seed: 5 });
  sim.draft.setDoorOpen("kitchen", 1);
  sim.draft.setDoorOpen("lounge", 1);
  sim.cloth.setOpenFraction("kitchen-south", 0.5, { immediate: true });
  let realistic = 0;
  for (let f = 0; f < 600; f++) {
    sim.update(STEP);
    if (f % 10 === 0) realistic = Math.max(realistic, sim.cloth.evidence().maxConstraintError);
  }
  assert.ok(realistic < 0.12, `doorway-draft strain ${realistic}`);

  const gale = facade({ wind: gusty(1.5) });
  let worst = 0;
  for (let f = 0; f < 480; f++) {
    gale.update(STEP);
    if (f % 15 === 0) worst = Math.max(worst, gale.evidence().maxConstraintError);
  }
  assert.ok(worst < 0.3, `gale strain ${worst}`);
});

test("nothing explodes in strong gusty wind, and the energy decays once it stops", () => {
  const cloth = facade({ wind: gusty(2) });
  let peak = 0;
  for (let f = 0; f < 360; f++) {
    cloth.update(STEP);
    if (f % 10 === 0) peak = Math.max(peak, cloth.evidence().energy);
  }
  everyPosition(cloth, (panel, i, p) => {
    assert.ok(Number.isFinite(p[3 * i]) && Number.isFinite(p[3 * i + 1]) && Number.isFinite(p[3 * i + 2]));
    // No particle strays farther from its stack-end ring than the panel's diagonal.
    const reach = Math.hypot(p[3 * i] - panel.origin[0], p[3 * i + 1] - panel.origin[1], p[3 * i + 2] - panel.origin[2]);
    assert.ok(reach < Math.hypot(panel.fabricSize[0], panel.fabricSize[1]) + 0.05, `${panel.id} reach ${reach}`);
  });
  // Lifting about 2 kg of fabric by its own height bounds the energy a gale can store.
  assert.ok(peak > 0.5 && peak < 60, `peak energy ${peak}`);
  cloth.setWind(null);
  const atRelease = cloth.evidence().energy;
  run(cloth, 8);
  const after = cloth.evidence();
  assert.ok(after.energy < 0.05 * atRelease, `energy ${after.energy} after release from ${atRelease}`);
  assert.ok(after.kineticEnergy < 0.01, `kinetic energy ${after.kineticEnergy}`);
});

test("carrier rings stay on the rail while panels open and close", () => {
  const cloth = facade();
  const check = () => {
    for (const panel of cloth.panels) {
      const { positions: p, origin: o, axis: a, room, pleat, columns, closedWidth } = panel;
      let previous = -Infinity;
      for (let c = 0; c < columns; c++) {
        const x = p[3 * c] - o[0],
          z = p[3 * c + 2] - o[2],
          along = x * a[0] + z * a[2],
          across = x * room[0] + z * room[2];
        assert.ok(Math.abs(p[3 * c + 1] - o[1]) < 1e-12, `${panel.id} heading left the rail height`);
        if (c % pleat === 0) {
          assert.ok(Math.abs(across) < 1e-9, `${panel.id} ring ${c / pleat} is ${across} m off the rail`);
          assert.ok(along > previous - 1e-12 && along > -1e-9 && along < closedWidth + 1e-9, `${panel.id} ring order`);
          previous = along;
        } else assert.ok(Math.abs(across) <= (pleat * panel.fabricSize[0]) / (columns - 1) / 2 + 1e-9, `${panel.id} fold too deep`);
      }
    }
  };
  check();
  for (const panel of cloth.panels) cloth.setOpenFraction(panel.id, 1 - cloth.openFraction(panel.id));
  for (let f = 0; f < 240; f++) {
    cloth.update(STEP);
    if (f % 6 === 0) check();
  }
});

test("openFraction gathers the panel toward its stack end and spreads it again", () => {
  const cloth = facade();
  const id = "kitchen-north",
    view = cloth.panel(id);
  const width = () => cloth.evidence().panels.find((p) => p.id === id).gatheredWidth;
  assert.ok(Math.abs(width() - view.closedWidth) < 1e-9);
  cloth.setOpenFraction(id, 1);
  let previous = width();
  for (let f = 0; f < 300; f++) {
    cloth.update(STEP);
    const now = width();
    assert.ok(now <= previous + 1e-12, "gathering never reverses");
    // The lead carrier is drawn by hand: no faster than drawSpeed (0.45 m/s).
    assert.ok(previous - now <= 0.45 * STEP + 1e-9, `lead carrier moved ${(previous - now) / STEP} m/s`);
    previous = now;
  }
  assert.ok(Math.abs(width() - view.stackWidth) < 1e-9, `stack ${width()} vs ${view.stackWidth}`);
  cloth.setOpenFraction(id, 0.5);
  run(cloth, 4);
  assert.ok(Math.abs(width() - (0.5 * view.closedWidth + 0.5 * view.stackWidth)) < 1e-6);
  cloth.setOpenFraction(id, 0, { immediate: true });
  assert.ok(Math.abs(width() - view.closedWidth) < 1e-9);
});

test("the same seed and the same frame deltas give the same cloth, bit for bit", () => {
  const deltas = [STEP, 1 / 30, 1 / 144, 0.05, STEP, 1 / 90, 0.2, STEP];
  const make = (seed) => createFacadeCurtains({ seed, draft: { seed: 3 } });
  const a = make(9),
    b = make(9),
    c = make(10);
  for (const sim of [a, b, c]) {
    sim.draft.setDoorOpen("kitchen", 1);
    sim.cloth.setOpenFraction("kitchen-south", 0.4);
    for (let k = 0; k < 120; k++) sim.update(deltas[k % deltas.length]);
  }
  let differs = false;
  a.cloth.panels.forEach((panel, i) => {
    const other = b.cloth.panels[i].positions,
      third = c.cloth.panels[i].positions;
    for (let k = 0; k < panel.positions.length; k++) {
      assert.ok(Object.is(panel.positions[k], other[k]), `${panel.id}[${k}] differs between identical runs`);
      if (panel.positions[k] !== third[k]) differs = true;
    }
  });
  assert.ok(differs, "a different seed perturbs the drape");
  // Frame partitioning: one 1/30 s frame is two 1/60 s steps.
  const coarse = facade({ wind: gusty(1) }),
    fine = facade({ wind: gusty(1) });
  for (let k = 0; k < 60; k++) {
    coarse.update(1 / 30);
    fine.update(STEP);
    fine.update(STEP);
  }
  coarse.panels.forEach((panel, i) => assert.deepEqual(Array.from(panel.positions), Array.from(fine.panels[i].positions)));
});

test("panels fall asleep in still air, hold still, and wake for a gust", () => {
  const cloth = facade();
  run(cloth, 14);
  const e = cloth.evidence();
  assert.ok(e.sleeping, `asleep: ${e.panels.map((p) => p.sleeping)}`);
  const frozen = cloth.panels.map((panel) => Float64Array.from(panel.positions));
  run(cloth, 1);
  cloth.panels.forEach((panel, i) => assert.deepEqual(Array.from(panel.positions), Array.from(frozen[i])));
  cloth.setWind(gusty(1));
  run(cloth, 0.1);
  assert.ok(!cloth.evidence().sleeping);
  assert.ok(cloth.panels.some((panel, i) => panel.positions.some((v, k) => v !== frozen[i][k])));

  // At night the doors close: the draft drops under the sleep threshold and the solver stops.
  const night = createFacadeCurtains({ seed: 2 });
  run(night, 14);
  assert.ok(night.cloth.evidence().sleeping);
  night.draft.setDoorOpen("kitchen", 1);
  run(night, 0.5);
  const rows = night.cloth.evidence().panels;
  assert.ok(!rows.find((p) => p.id === "kitchen-south").sleeping, "the doorway panel wakes");
  assert.ok(rows.find((p) => p.id === "lounge-north").sleeping, "a panel by shut glass sleeps on");
});

test("reduced motion returns a settled, static drape", () => {
  const cloth = facade({ reducedMotion: true, wind: gusty(2) });
  const still = cloth.panels.map((panel) => Float64Array.from(panel.positions));
  run(cloth, 2);
  cloth.panels.forEach((panel, i) => assert.deepEqual(Array.from(panel.positions), Array.from(still[i])));
  const e = cloth.evidence();
  assert.equal(e.kineticEnergy, 0);
  assert.ok(e.maxConstraintError < 0.01);
  assert.ok(e.reducedMotion && e.sleeping);
  // Each panel hangs plumb from its rail, hem just above the floor.
  for (const panel of cloth.panels) {
    const hem = 3 * (panel.count - panel.columns);
    assert.ok(Math.abs(panel.positions[hem + 1] - (panel.origin[1] - panel.fabricSize[1])) < 0.02);
  }
  // Drawing a panel jumps straight to its settled stack.
  cloth.setOpenFraction("kitchen-north", 1);
  const row = cloth.evidence().panels.find((p) => p.id === "kitchen-north");
  assert.ok(Math.abs(row.gatheredWidth - cloth.panel("kitchen-north").stackWidth) < 1e-9 && row.openFraction === 1);
  cloth.setReducedMotion(false);
  run(cloth, 0.5);
  assert.ok(
    cloth.panels.some((panel, i) => panel.positions.some((v, k) => v !== still[i][k])),
    "motion resumes"
  );
});

test("a frame allocates no arrays: no typed arrays, no Array constructions, one reused sampler output", () => {
  const sim = createFacadeCurtains({ seed: 4 });
  sim.draft.setDoorOpen("kitchen", 1);
  const outputs = sim.cloth.panels.map((panel) => ["position", "normal", "tangent"].map(() => new Float32Array(3 * panel.count)));
  run(sim.cloth, 0.5);
  const allocationsBefore = sim.cloth.evidence().allocations;
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
    for (let f = 0; f < 180; f++) {
      sim.update(STEP);
      for (let k = 0; k < outputs.length; k++) sim.cloth.writePanel(k, ...outputs[k]);
    }
  } finally {
    Object.assign(globalThis, originals);
  }
  assert.equal(constructed, 0);
  assert.equal(sim.cloth.evidence().allocations, allocationsBefore);

  // The plain per-point sampler always receives the same output array to fill.
  const seen = new Set();
  const cloth = facade({ wind: (x, y, z, t, out) => (seen.add(out), gusty(1)(x, y, z, t, out)) });
  run(cloth, 0.5);
  assert.equal(seen.size, 1);
});

test("the facade draft blows hard through an open door and barely along closed glass", () => {
  const draft = createFacadeDraft({ seed: 1 });
  const speed = (x) => {
    let sum = 0;
    const out = [0, 0, 0];
    for (let t = 0; t < 60; t += 0.1) sum += Math.hypot(...draft.sample(x, 1.5, -4.05, t, out));
    return sum / 600;
  };
  draft.setDoorOpen("kitchen", 1);
  const doorway = speed(-2.0),
    glass = speed(-0.55);
  assert.ok(doorway > 0.6 && doorway < 2.5, `doorway ${doorway} m/s`);
  assert.ok(doorway > 6 * glass, `doorway ${doorway} vs glass ${glass}`);
  draft.setDoor("kitchen", -1.0); // half slid: only the gap by the post blows
  assert.ok(speed(-1.2) > 4 * speed(-2.6));
  draft.setDoorOpen("kitchen", 0);
  assert.ok(speed(-2.0) < 2 * glass + 0.02, "a shut door leaves only the weak draft");

  // With the doors shut and no boundary layer, the draft is exactly the shared field, scaled.
  const field = createFacadeDraft({ roomLeak: 0.25, glassDraft: 0 });
  const out = [0, 0, 0],
    reference = [0, 0, 0];
  for (const [p, t] of [
    [[-2, 1, -4], 3.1],
    [[3.2, 2.7, -4.2], 47],
  ]) {
    field.sample(...p, t, out);
    sampleWind(p, t, reference, DEFAULT_WIND);
    for (let a = 0; a < 3; a++) assert.ok(Math.abs(out[a] - 0.25 * reference[a]) < 1e-12);
  }
  // The batched typed-array path agrees with the plain one.
  const points = Float64Array.of(-2.2, 1.1, -4.0, 2.5, 2.9, -4.1),
    batch = new Float64Array(6);
  draft.setDoorOpen("kitchen", 1);
  draft.sampleBatch(points, 2, Float64Array.of(12.5), batch);
  for (let i = 0; i < 2; i++) {
    draft.sample(points[3 * i], points[3 * i + 1], points[3 * i + 2], 12.5, out);
    for (let a = 0; a < 3; a++) assert.ok(Math.abs(out[a] - batch[3 * i + a]) < 1e-12);
  }
});

test("the proposed tracks clear the authored furniture, the door hardware, the floor and the head", () => {
  for (const track of CURTAIN_TRACKS) {
    const door = CURTAIN_FACADE.doors.find((d) => d.id === track.door);
    assert.ok(track.rail.from < door.opening[1] && track.rail.to > door.opening[0], `${track.id} rail spans its doorway`);
    assert.ok(track.rail.z > CURTAIN_FACADE.doorFaceZ && track.rail.y < CURTAIN_FACADE.doorHead);
  }
  for (const open of [0, 1]) {
    const panels = facadeCurtainPanels({ openFraction: open });
    const cloth = createCurtainCloth({ panels, reducedMotion: true });
    everyPosition(cloth, (panel, i, p) => {
      const x = p[3 * i],
        y = p[3 * i + 1],
        z = p[3 * i + 2];
      assert.ok(z > CURTAIN_FACADE.hardwareZ + 0.02, `${panel.id} reaches the door pulls (z ${z})`);
      assert.ok(y > CURTAIN_FACADE.floorY && y < CURTAIN_FACADE.doorHead, `${panel.id} height ${y}`);
      // The kitchen counter ends at x -2.75 and the lounge olive starts at x 3.5 (authored GLBs).
      assert.ok(x > -2.75 && x < 3.5, `${panel.id} x ${x}`);
    });
  }
});

test("written normals face the room and tangents run along the weft", () => {
  const cloth = facade();
  run(cloth, 1);
  for (const panel of cloth.panels) {
    const position = new Float32Array(3 * panel.count),
      normal = new Float32Array(3 * panel.count),
      tangent = new Float32Array(3 * panel.count);
    cloth.writePanel(panel.id, position, normal, tangent);
    let facing = 0;
    for (let i = 0; i < panel.count; i++) {
      const n = normal.subarray(3 * i, 3 * i + 3),
        t = tangent.subarray(3 * i, 3 * i + 3);
      assert.ok(Math.abs(Math.hypot(...n) - 1) < 1e-5 && Math.abs(Math.hypot(...t) - 1) < 1e-5);
      assert.ok(Math.abs(n[0] * t[0] + n[1] * t[1] + n[2] * t[2]) < 1e-5);
      facing += n[0] * panel.room[0] + n[2] * panel.room[2];
    }
    // A closed panel faces the room squarely; a gathered stack's loops face mostly sideways.
    const closed = cloth.openFraction(panel.id) < 0.6;
    assert.ok(facing / panel.count > (closed ? 0.4 : 0.1), `${panel.id} normals face the room (${facing / panel.count})`);
    // Index winding agrees with the normals: the first triangle's geometric normal faces the room.
    const [a, b, c] = panel.index,
      e1 = [0, 1, 2].map((k) => position[3 * b + k] - position[3 * a + k]),
      e2 = [0, 1, 2].map((k) => position[3 * c + k] - position[3 * a + k]),
      n = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]];
    assert.ok(n[0] * normal[3 * a] + n[1] * normal[3 * a + 1] + n[2] * normal[3 * a + 2] > 0, `${panel.id} winding`);
  }
});

test("four facade panels step within the frame budget", (t) => {
  const sim = createFacadeCurtains({ seed: 3 });
  sim.draft.setDoorOpen("kitchen", 1);
  sim.draft.setDoorOpen("lounge", 1);
  run(sim.cloth, 1);
  let best = Infinity;
  for (let trial = 0; trial < 12; trial++) {
    const started = performance.now();
    for (let f = 0; f < 15; f++) sim.update(STEP);
    best = Math.min(best, (performance.now() - started) / 15);
  }
  t.diagnostic(`best of 12 trials: ${best.toFixed(3)} ms per 60 Hz frame for ${sim.cloth.evidence().particles} particles`);
  // The design budget is about 1.5 ms on a desktop (1.2 ms measured alone on the development machine).
  // node --test runs files in parallel, so this guard only catches pathological regressions.
  assert.ok(best < 15, `${best} ms per frame`);
});

test("weave openness is the cover factor head-on and closes toward grazing angles", () => {
  const ratios = weaveYarnRatios(0.36);
  const n = [0, 0, 1],
    tangent = [1, 0, 0];
  assert.ok(Math.abs(weaveOpenness(n, n, tangent, ratios) - 0.36) < 1e-3);
  let previous = 1;
  for (let degrees = 0; degrees <= 80; degrees += 5) {
    const a = (degrees * Math.PI) / 180;
    const across = weaveOpenness([Math.sin(a), 0, Math.cos(a)], n, tangent, ratios),
      along = weaveOpenness([0, Math.sin(a), Math.cos(a)], n, tangent, ratios);
    assert.ok(across <= previous + 1e-12 && Math.abs(across - along) < 1e-9);
    previous = across;
  }
  assert.equal(weaveOpenness([Math.sin(1.2), 0, Math.cos(1.2)], n, tangent, ratios), 0, "the gaps close before grazing");
  const [warp, weft] = weaveYarnRatios(0.3, 1.5);
  assert.ok(Math.abs((1 - warp) * (1 - weft) - 0.3) < 1e-6 && Math.abs(warp / weft - 1.5) < 1e-6);
});

test("the sheer patches keep the scene's include markers and route clear of name-based finishing", () => {
  assert.ok(
    !/leaf|linen|textile|cotton|woven|wood|oak|ash|walnut|water|turquoise|hair|skin|stone|sand|plaster|foliage|glass/i.test(SHEER_FABRIC_NAME)
  );
  const fabric = createSheerFabric();
  const shader = { vertexShader: ShaderLib.physical.vertexShader, fragmentShader: ShaderLib.physical.fragmentShader, uniforms: {} };
  patchSheerShader(shader, fabric.uniforms);
  for (const marker of ["#include <common>", "#include <project_vertex>"]) assert.ok(shader.vertexShader.includes(marker));
  for (const marker of ["#include <common>", "#include <lights_fragment_end>", "#include <aomap_fragment>", "#include <opaque_fragment>"])
    assert.ok(shader.fragmentShader.includes(marker), marker);
  assert.ok(shader.fragmentShader.includes("#define RE_Direct RE_Direct_Sheer"));
  // The r164 shadow chunk was found and its normal offset now points toward each light.
  assert.ok(ShaderChunk.shadowmap_vertex.includes("shadowWorldNormal * directionalLightShadows[ i ].shadowNormalBias"));
  assert.ok(shader.vertexShader.includes("sheerTowardLight( shadowWorldNormal, - vec3( directionalShadowMatrix[ i ]"));
  assert.ok(!shader.vertexShader.includes("#include <shadowmap_vertex>"));
  assert.equal(shader.uniforms.sheerYarn, fabric.uniforms.sheerYarn);
  // A later binder (static light field, contact lighting) still finds and wraps its markers.
  shader.fragmentShader = shader.fragmentShader.replace("#include <lights_fragment_end>", "irradiance = vec3(0.0);\n#include <lights_fragment_end>");
  assert.ok(shader.fragmentShader.indexOf("irradiance = vec3(0.0);") > shader.fragmentShader.indexOf("vec3 sheerBehind"));

  for (const [source, distance] of [
    [ShaderLib.depth, false],
    [ShaderLib.distanceRGBA, true],
  ]) {
    const shadow = { vertexShader: source.vertexShader, fragmentShader: source.fragmentShader, uniforms: {} };
    patchSheerShadowShader(shadow, fabric.uniforms, distance);
    assert.ok(shadow.fragmentShader.includes("sheerBayer( gl_FragCoord.xy ) < sheerPass("));
    assert.ok(shadow.fragmentShader.includes(distance ? "referencePosition - vSheerPoint" : "isOrthographic"));
  }
  const mesh = { userData: {} };
  fabric.bindMesh(mesh);
  assert.equal(mesh.material, fabric.material);
  assert.equal(mesh.customDepthMaterial, fabric.depthMaterial);
  assert.equal(mesh.customDistanceMaterial, fabric.distanceMaterial);
  assert.ok(mesh.castShadow && mesh.receiveShadow && mesh.userData.fixedMaterial && mesh.userData.noContactOcclusion && mesh.userData.noOcclusion);
  assert.ok(fabric.material.alphaToCoverage && !fabric.material.transparent);
  assert.notEqual(fabric.material.customProgramCacheKey(), fabric.depthMaterial.customProgramCacheKey());
});
