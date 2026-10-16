import test from "node:test";
import assert from "node:assert/strict";
import { ShaderLib } from "../assets/js/three.module.min.js";
import {
  COAST_GUSTS,
  COAST_GUST_BASE,
  COAST_SHELTER,
  SEA_BREEZE,
  WIND_CONE_FULL,
  coastGustAt,
  coastWind,
  coastWindGLSL,
  createCoastWind,
  livePacificMinute,
  seaBreeze,
  windGLSLFloat,
} from "../assets/js/home-scene/wind-field.mjs";
import {
  FLORA_SWAY,
  createPlantUniforms,
  floraSwayGLSL,
  floraSwayProfile,
  floraSwayPush,
  patchFloraSway,
  patchPlantShader,
  PLANT_BEND_LIMIT,
  sampleFloraSway,
  samplePlantDeflection,
} from "../assets/js/home-scene/plant-motion.mjs";
import {
  OCEAN_WAVES,
  OCEAN_WIND,
  bindOceanWind,
  oceanLocalWind,
  oceanRipplesGLSL,
  oceanWindState,
  oceanWindUniforms,
  rippleScale,
  sampleOcean,
  syncOceanWind,
  whitecapCoverage,
  windSeaScale,
} from "../assets/js/home-scene/ocean-spectrum.mjs";
import { createWindParticles } from "../assets/js/home-scene/wind-particles.mjs";
import { createSteamDensity } from "../assets/js/home-scene/steam-density.mjs";
import { createWindUniforms } from "../assets/js/home-scene/wind-field.mjs";

const close = (a, b, epsilon, message) => assert.ok(Math.abs(a - b) <= epsilon, message ?? `${a} differs from ${b} by more than ${epsilon}`);

// October means at Scripps Pier, La Jolla (NDBC LJPC1, 2023-2025): Pacific hour, mean speed m/s,
// direction of the mean vector (from, degrees) where that vector is well defined.
const SCRIPPS_OCTOBER = [
  [0, 1.34, 66],
  [3, 1.64, 86],
  [6, 1.52, 88],
  [11, 2.03, 292],
  [12, 2.17, 287],
  [13, 2.52, 292],
  [14, 2.72, 300],
  [15, 2.76, 305],
  [16, 2.67, 306],
  [17, 2.3, 307],
  [18, 2.0, 313],
  [19, 1.69, 319],
  [20, 1.63, 329],
];

test("the sea breeze is calm in the morning, onshore in the afternoon and lighter in the evening", () => {
  const at = (hour) => seaBreeze(hour * 60);
  // A lull while the land breeze turns into the sea breeze.
  assert.ok(Math.min(...[8.75, 9, 9.25].map((h) => at(h).speed)) < 0.8, "a calm morning");
  // The afternoon sea breeze blows onshore (+Z, inland) from the west-north-west.
  const afternoon = at(15);
  assert.ok(afternoon.speed > 2.5 && afternoon.speed < 3, `afternoon ${afternoon.speed} m/s`);
  assert.ok(afternoon.direction[1] > 0.75, "the afternoon breeze blows inland");
  assert.ok(afternoon.fromDegrees > 295 && afternoon.fromDegrees < 315, `from ${afternoon.fromDegrees}`);
  // Lighter in the evening, with a weak land breeze offshore overnight.
  assert.ok(at(21).speed < 0.6 * afternoon.speed);
  assert.ok(at(3).direction[1] < -0.9 && at(3).speed < 1.9, "the night land breeze blows out to sea");
  // It follows the station's October averages.
  for (const [hour, speed, from] of SCRIPPS_OCTOBER) {
    const b = at(hour);
    close(b.speed, speed, 0.25, `${hour}:00 speed ${b.speed} vs ${speed}`);
    assert.ok(Math.abs(((b.fromDegrees - from + 540) % 360) - 180) < 15, `${hour}:00 from ${b.fromDegrees} vs ${from}`);
  }
  // The authored knots are reproduced, and the cycle is periodic and smooth through midnight.
  for (const [minute, speed, from] of SEA_BREEZE) {
    const b = seaBreeze(minute);
    close(b.speed, speed, 1e-9);
    close(Math.cos((b.fromDegrees - from) * (Math.PI / 180)), 1, 1e-9);
  }
  const late = seaBreeze(1439.999),
    early = seaBreeze(0.001);
  close(late.toward[0], early.toward[0], 1e-4);
  close(late.toward[1], early.toward[1], 1e-4);
  let previous = seaBreeze(0);
  for (let m = 0.25; m <= 1440; m += 0.25) {
    const b = seaBreeze(m);
    assert.ok(Math.hypot(b.toward[0] - previous.toward[0], b.toward[1] - previous.toward[1]) < 0.01, `a jump at minute ${m}`);
    previous = b;
  }
  assert.deepEqual(seaBreeze(15 * 60 + 1440).toward, seaBreeze(15 * 60).toward);
});

test("the gust envelope averages one, is bounded and is the same for the same instant", () => {
  let sum = 0,
    squares = 0,
    count = 0,
    low = Infinity,
    high = -Infinity;
  for (let t = 0; t < 120000; t += 0.37) {
    const g = coastGustAt(t, (t * 3.1) % 400);
    sum += g;
    squares += g * g;
    count++;
    low = Math.min(low, g);
    high = Math.max(high, g);
  }
  const mean = sum / count,
    deviation = Math.sqrt(squares / count - mean * mean);
  close(mean, 1, 0.01, `mean envelope ${mean}`);
  // A gusty coastal breeze: turbulence intensity near 0.15; the station's 5 s gusts run 1.4 to 1.8 times
  // its 8 minute means.
  assert.ok(deviation > 0.1 && deviation < 0.22, `turbulence intensity ${deviation}`);
  close(low, COAST_GUST_BASE, 1e-9);
  assert.ok(high > 1.5 && high < 2.4, `peak ${high}`);
  let peaks = 0,
    windows = 0;
  for (let w = 0; w < 200; w++) {
    let peak = 0;
    for (let t = w * 600; t < (w + 1) * 600; t += 0.5) peak = Math.max(peak, coastGustAt(t, 41));
    peaks += peak;
    windows++;
  }
  assert.ok(peaks / windows > 1.4 && peaks / windows < 1.9, `ten-minute gust factor ${peaks / windows}`);
  assert.equal(coastGustAt(1234.5, -17), coastGustAt(1234.5, -17));
  const a = createCoastWind({ minute: 930, seconds: 50 }),
    b = createCoastWind({ minute: 930, seconds: 50 });
  for (const [x, z] of [
    [0, -40],
    [12, 14],
    [-30, 3],
  ])
    assert.equal(a.gust(x, z), b.gust(x, z));
});

test("a gust front travels downwind at the front speed, the mean wind's (Taylor)", () => {
  const wind = createCoastWind({ minute: 930 });
  const [dx, dz] = wind.state.direction,
    c = wind.state.frontSpeed;
  close(c, wind.state.meanSpeed, 1e-12, "fronts ride the mean flow");
  // Whatever passes a point arrives s metres downwind s / c seconds later, everywhere on the coast.
  for (const [x, z] of [
    [0, -60],
    [-14, -9],
    [20, 15],
  ])
    for (const s of [5, 20, 60]) for (let t = 0; t < 120; t += 7.3) close(wind.gust(x + dx * s, z + dz * s, t + s / c), wind.gust(x, z, t), 1e-12);
  // Measured: the lag that best aligns the envelope at two points 40 m apart along the wind.
  const step = 0.05,
    a = [],
    b = [];
  for (let t = 0; t < 900; t += step) {
    a.push(wind.gust(0, -40, t));
    b.push(wind.gust(40 * dx, -40 + 40 * dz, t));
  }
  let best = 0,
    bestLag = 0;
  for (let lag = 0; lag < 400; lag++) {
    let score = 0;
    for (let i = 0; i + lag < a.length; i++) score += (a[i] - 1) * (b[i + lag] - 1);
    if (score > best) {
      best = score;
      bestLag = lag;
    }
  }
  close(bestLag * step, 40 / c, step, `measured lag ${bestLag * step} s vs ${40 / c} s`);
  // A calm still carries its pattern downwind at the minimum front speed.
  assert.equal(createCoastWind({ minute: 9 * 60 }).state.frontSpeed, COAST_GUSTS.minFront);
});

// The GLSL envelope, evaluated with float32 rounding and exact uint arithmetic as WebGL2 does.
const f = Math.fround;
function lowbias32(x) {
  x >>>= 0;
  x ^= x >>> 16;
  x = Math.imul(x, 0x7feb352d);
  x ^= x >>> 15;
  x = Math.imul(x, 0x846ca68b);
  x ^= x >>> 16;
  return x >>> 0;
}
const glslUnit = (x) => f(f(lowbias32(x)) * f(2.3283064365386963e-10));
const glslSmooth = (e0, e1, x) => {
  const t = Math.min(1, Math.max(0, f(f(x - e0) / f(e1 - e0))));
  return f(f(t * t) * f(3 - f(2 * t)));
};
function glslGustAt(psi, xi) {
  const { cell, rise, decay, presence, amplitude, width } = COAST_GUSTS;
  psi = f(psi);
  xi = f(xi);
  const slot = Math.floor(f(psi / f(cell)));
  let sum = 0;
  for (let j = 0; j < 2; j++) {
    const n = slot - j,
      id = ((n + 65536) * 3) >>> 0,
      u = f(psi - f(f(n + f(0.8 * glslUnit(id + 2))) * f(cell)));
    const shape = f(f(glslSmooth(0, rise, u) * f(Math.exp(f(-Math.max(0, f(u - rise)) / f(decay))))) * f(1 - glslSmooth(0.9 * cell, 1.2 * cell, u)));
    const h = glslUnit(id + 1),
      strength = h >= f(presence) ? f(0.35 + f(0.65 * glslSmooth(presence, 1, h))) : 0,
      lateral = f(0.65 + f(0.35 * f(Math.cos(f(f(f((2 * Math.PI) / width) * xi) + f(f(2 * Math.PI) * glslUnit(id + 3)))))));
    sum = f(sum + f(f(strength * lateral) * shape));
  }
  return f(f(COAST_GUST_BASE) + f(f(amplitude) * sum));
}

test("the GPU's gust timeline is the CPU's: one GLSL source, exact hashes, float32 agreement", () => {
  // The hash in the shader is the same exact integer function the CPU uses.
  assert.ok(coastWindGLSL.includes("x ^= x >> 16u; x *= 0x7feb352du; x ^= x >> 15u; x *= 0x846ca68bu; x ^= x >> 16u;"));
  for (const value of [COAST_GUSTS.cell, COAST_GUSTS.rise, COAST_GUSTS.decay, COAST_GUSTS.presence, COAST_GUST_BASE])
    assert.ok(coastWindGLSL.includes(windGLSLFloat(value)), `literal ${value}`);
  let worst = 0;
  for (let i = 0; i < 4000; i++) {
    const psi = (i * 0.731) % 2400,
      xi = Math.sin(i * 1.7) * 120;
    worst = Math.max(worst, Math.abs(glslGustAt(psi, xi) - coastGustAt(psi, xi)));
  }
  assert.ok(worst < 2e-4, `float32 shader reference differs by ${worst}`);
});

test("ocean ripples, clifftop plants and room plants bind one wind and read one gust timeline", () => {
  // One GLSL source and one set of uniform objects for every consumer.
  assert.ok(oceanRipplesGLSL.includes(coastWindGLSL));
  assert.ok(floraSwayGLSL.includes(coastWindGLSL));
  const ocean = bindOceanWind({ uniforms: {} });
  assert.equal(ocean.uniforms.coastWindState, coastWind.uniforms.coastWindState);
  assert.equal(ocean.uniforms.coastWindClock, coastWind.uniforms.coastWindClock);
  assert.equal(oceanWindUniforms.coastWindState, coastWind.uniforms.coastWindState);
  const flora = patchFloraSway({ uniforms: {}, vertexShader: ShaderLib.standard.vertexShader }, FLORA_SWAY.grass);
  assert.equal(flora.uniforms.coastWindState, coastWind.uniforms.coastWindState);
  assert.equal(flora.uniforms.coastWindClock, coastWind.uniforms.coastWindClock);
  const room = patchPlantShader({ uniforms: {}, vertexShader: ShaderLib.standard.vertexShader }, createWindUniforms(), createPlantUniforms());
  assert.equal(room.uniforms.coastWindState, coastWind.uniforms.coastWindState);
  assert.ok(room.vertexShader.includes(coastWindGLSL));
  // Updating the shared wind moves the uniforms every shader reads.
  const before = coastWind.state.minute;
  coastWind.update({ seconds: 321.5, minute: 930 });
  assert.equal(coastWind.uniforms.coastWindClock.value, 321.5);
  close(coastWind.uniforms.coastWindState.value[2], coastWind.state.meanSpeed, 1e-6);
  coastWind.update({ seconds: 0, minute: before });

  // Numerically: the gust that roughens a patch of sea (0.4 s ripple lag) bends the grass on the same
  // spot (its 2/omega stem lag) at the same instant of the shared timeline, and reaches the bluff
  // 30 m downwind exactly 30 / c seconds later.
  const wind = createCoastWind({ minute: 945 });
  const [dx, dz] = wind.state.direction,
    c = wind.state.frontSpeed,
    U = wind.state.meanSpeed,
    grass = FLORA_SWAY.grass,
    stemLag = 1 / (Math.PI * grass.frequency),
    spot = [3, -6.8, -16],
    bluff = [spot[0] + 30 * dx, 5.5, spot[2] + 30 * dz];
  for (let t = 0; t < 200; t += 0.61) {
    const fromGrass = (floraSwayPush(spot, grass, { wind, seconds: t }) / grass.reach) ** (1 / 1.4) / U,
      fromSea = oceanLocalWind(spot[0], spot[2], wind, t - stemLag + OCEAN_WIND.rippleLag) / U;
    close(fromGrass, fromSea, 1e-9, `t ${t}: grass ${fromGrass} vs sea ${fromSea}`);
    close(floraSwayPush(bluff, grass, { wind, seconds: t + 30 / c }), floraSwayPush(spot, grass, { wind, seconds: t }), 1e-12);
  }
});

test("the wind sea turns and grows with the breeze while the swell and the steepness bound hold", () => {
  const bound = (scale) => OCEAN_WAVES.reduce((sum, w, i) => sum + w.choppiness * w.amplitude * scale[i] * w.k, 0);
  const authored = bound(OCEAN_WAVES.map(() => 1));
  for (let speed = 0; speed <= 14; speed += 0.5) {
    const state = oceanWindState(speed, 0.3);
    OCEAN_WAVES.forEach((w, i) => {
      assert.ok(state.scale[i] <= 1 && state.scale[i] >= (w.windSea ? OCEAN_WIND.residual : 1) - 1e-6);
      if (!w.windSea) assert.equal(state.scale[i], 1, "the swell keeps its height");
    });
    assert.ok(bound(state.scale) <= authored + 1e-12, "the wind never steepens the sea past its foldover bound");
  }
  // Glassy at dawn, choppy in the afternoon: the short wind sea grows by several times.
  const calm = oceanWindState(seaBreeze(9 * 60).speed, 0),
    breezy = oceanWindState(seaBreeze(15 * 60).speed, 0),
    chop = OCEAN_WAVES.findIndex((w) => w.wavelength < 2 && w.windSea);
  assert.ok(breezy.scale[chop] > 4 * calm.scale[chop], `${calm.scale[chop]} -> ${breezy.scale[chop]}`);
  assert.ok(
    windSeaScale(OCEAN_WAVES[3].k, 1) < windSeaScale(OCEAN_WAVES[3].k, 3) && windSeaScale(OCEAN_WAVES[3].k, 3) < windSeaScale(OCEAN_WAVES[3].k, 6)
  );
  // Ripple slopes and whitecaps follow the local wind (Cox-Munk, Monahan).
  assert.ok(rippleScale(0) >= OCEAN_WIND.rippleRange[0] && rippleScale(0) < 0.4);
  close(rippleScale(OCEAN_WIND.reference), 1, 1e-12);
  assert.ok(rippleScale(9) > 1.15);
  assert.equal(whitecapCoverage(1.5), OCEAN_WIND.whitecap[2] * OCEAN_WIND.whitecap[0] * 1.5 ** OCEAN_WIND.whitecap[1]);
  assert.ok(whitecapCoverage(9) > 10 * whitecapCoverage(4.5));
  // The turned field is still an exact Gerstner surface: tangents match finite differences and the
  // horizontal Jacobian keeps its bound.
  const wind = oceanWindState(4.2, -0.4),
    h = 1e-5;
  for (const [x, z, time] of [
    [0, 0, 0],
    [3.9, -7.2, 11.4],
    [-22, 14, 39.8],
  ]) {
    const center = sampleOcean(x, z, time, 0.02, wind);
    const point = (xx, zz) => {
      const d = sampleOcean(xx, zz, time, 0.02, wind).displacement;
      return [xx + d[0], d[1], zz + d[2]];
    };
    for (const [axis, ddx, ddz] of [
      ["tangentX", h, 0],
      ["tangentZ", 0, h],
    ]) {
      const plus = point(x + ddx, z + ddz),
        minus = point(x - ddx, z - ddz);
      center[axis].forEach((value, i) => close(value, (plus[i] - minus[i]) / (2 * h), 1e-6));
    }
    assert.ok(center.jacobian > (1 - bound(wind.scale)) ** 2);
  }
  // The wind sea follows the heading; the swell does not.
  const turned = oceanWindState(5, Math.PI / 2);
  const windSea = OCEAN_WAVES.findIndex((w) => w.windSea),
    swell = OCEAN_WAVES.findIndex((w) => !w.windSea);
  const sampleOne = (index, state) => {
    const only = { turn: state.turn, scale: OCEAN_WAVES.map((_, i) => (i === index ? 1 : 0)) };
    return sampleOcean(1, 2, 3, 0, only);
  };
  assert.notDeepEqual(sampleOne(windSea, turned).displacement, sampleOne(windSea, oceanWindState(5, 0)).displacement);
  // Syncing writes the shared uniforms from the coast's state.
  const synced = syncOceanWind(createCoastWind({ minute: 900 }).state);
  assert.equal(oceanWindUniforms.oceanWaveScale.value, synced.scale);
  close(oceanWindUniforms.oceanWindTurn.value[0], Math.cos(seaBreeze(900).yaw), 1e-6);
  void swell;
});

test("inside the house the breeze leaks through the glass front, five times more with the doors open", () => {
  const shut = createCoastWind({ minute: 930, doors: 0 }),
    open = createCoastWind({ minute: 930, doors: 1 });
  close(open.state.indoorLeak / shut.state.indoorLeak, COAST_SHELTER.open / COAST_SHELTER.closed, 1e-12);
  const speed = (wind) => {
    let sum = 0;
    const out = [0, 0, 0];
    for (let t = 0; t < 300; t += 0.5) sum += Math.hypot(...wind.sampleIndoor(-2, 1.4, -3, t, out));
    return sum / 600;
  };
  assert.ok(speed(open) > 3.5 * speed(shut), `${speed(open)} vs ${speed(shut)}`);
  assert.ok(speed(open) < 0.6, "a draft, not a gale");
  // The house feels each gust when the front meets the glass at the same x.
  const out = [0, 0, 0];
  for (let t = 10; t < 200; t += 13.7) {
    const g = open.gust(-2, COAST_SHELTER.glassZ, t),
      eddyFree = open.indoorDrift(-2, 0, 1, t);
    close(Math.hypot(eddyFree.mean[0], eddyFree.mean[2]), open.state.indoorLeak * open.state.meanSpeed * g, 1e-12);
    open.sampleIndoor(-2, 1.4, -3, t, out);
  }
  // The room plants take that share and their bends saturate softly.
  for (let t = 0; t < 120; t += 1.3) {
    const bend = samplePlantDeflection([-2.1, 1.2, -3], t, undefined, {
      coast: open,
      wind: {
        mean: [open.state.meanSpeed * open.state.direction[0], 0, open.state.meanSpeed * open.state.direction[1]],
        gust: COAST_SHELTER.eddy * open.state.meanSpeed,
      },
    });
    assert.ok(Math.hypot(...bend) < PLANT_BEND_LIMIT, `bend ${Math.hypot(...bend)}`);
  }
});

test("a wind cone points downwind and stands straight at fifteen knots", () => {
  const wind = createCoastWind({ minute: 930, seconds: 77 });
  const vane = wind.vane(-8, 12);
  const v = wind.sample(-8, 0, 12);
  close(Math.sin(vane.yaw), v[0] / Math.hypot(v[0], v[2]), 1e-12);
  close(Math.cos(vane.yaw), v[2] / Math.hypot(v[0], v[2]), 1e-12);
  close(vane.speed, Math.hypot(v[0], v[2]), 1e-12);
  close(vane.extension, Math.min(1, vane.speed / WIND_CONE_FULL), 1e-12);
  close(WIND_CONE_FULL, 7.716, 0.001);
  // The meteorological direction is where the air comes from: about the breeze's, give or take the veer.
  assert.ok(Math.abs(((vane.fromDegrees - wind.state.fromDegrees + 540) % 360) - 180) < 12);
  assert.equal(createCoastWind({ minute: 9 * 60 }).vane().extension < 0.2, true);
});

test("spray rides the coast's breeze, dust drifts in the house's air, and the steam leans with it", () => {
  const wind = createCoastWind({ minute: 930, doors: 1 }),
    emitters = new Float32Array(Array.from({ length: 60 }, (_, i) => [i % 10, -7.3, -20 - Math.floor(i / 10)]).flat());
  const spray = createWindParticles({ kind: "spray", emitters, wind: wind.outdoor, lifetime: 0.48, jitter: 0 }),
    still = createWindParticles({ kind: "spray", emitters, wind: { mean: [0, 0, 0], gust: 0, rate: 1 }, lifetime: 0.48, jitter: 0 });
  let downwind = 0;
  for (let k = 0; k < 20; k++) {
    spray.advance(1 / 60);
    still.advance(1 / 60);
    for (let i = 0; i < spray.positions.length; i += 3)
      downwind +=
        (spray.positions[i] - still.positions[i]) * wind.state.direction[0] +
        (spray.positions[i + 2] - still.positions[i + 2]) * wind.state.direction[1];
  }
  assert.ok(downwind > 0, "the onshore breeze blows the spray up the beach");
  // Same cadence rule as the field options: different frame partitions, same history.
  const a = createWindParticles({ kind: "dust", emitters: new Float32Array([0, 3, 3, 0.5, 3.5, 3]), wind: wind.indoor }),
    b = createWindParticles({ kind: "dust", emitters: new Float32Array([0, 3, 3, 0.5, 3.5, 3]), wind: wind.indoor });
  for (let i = 0; i < 120; i++) a.advance(1 / 60);
  for (let i = 0; i < 60; i++) b.advance(1 / 30);
  assert.deepEqual(a.snapshot(), b.snapshot());

  // The bath steam drifts with the indoor share of the afternoon breeze.
  const passive = { grid: [10, 10, 10], thermalRise: 0, baseRise: 0, sourceRate: 0, dissipation: 0, escape: 0, windScale: 1 };
  const drifting = createSteamDensity({ ...passive, wind: { mean: [0, 0, 0], gust: 0, rate: 1 } }),
    calm = createSteamDensity({ ...passive, wind: { mean: [0, 0, 0], gust: 0, rate: 1 } });
  for (const field of [drifting, calm]) {
    const { density } = field.state;
    density.fill(0);
    for (let i = 0; i < density.length; i++) if (i % 10 >= 3 && i % 10 <= 6) density[i] = 1;
  }
  const drift = wind.indoorDrift(3.2, 3, 1, 40);
  drifting.setWind({ mean: drift.mean.map((v) => v * 20), gust: 0 });
  assert.deepEqual(
    drifting.wind.mean,
    drift.mean.map((v) => v * 20)
  );
  for (let k = 0; k < 30; k++) {
    drifting.advance(1 / 30);
    calm.advance(1 / 30);
  }
  const shift = drifting.evidence().centroid.map((v, i) => v - calm.evidence().centroid[i]);
  assert.ok(shift[0] * drift.mean[0] + shift[2] * drift.mean[2] > 0, `steam drift ${shift}`);
  assert.throws(() => drifting.setWind({ mean: [Number.NaN, 0, 0] }), RangeError);
});

test("clifftop species bend with the breeze, gusts and their own sway, within their reach", () => {
  assert.equal(floraSwayProfile("dry coastal grass leaf"), FLORA_SWAY.grass);
  assert.equal(floraSwayProfile("wild oat grass leaf"), FLORA_SWAY.grass);
  assert.equal(floraSwayProfile("silver sage leaf"), FLORA_SWAY.sage);
  assert.equal(floraSwayProfile("torrey pine needle leaf"), FLORA_SWAY.pine);
  assert.equal(floraSwayProfile("lemonade berry leaf"), FLORA_SWAY.berry);
  assert.equal(floraSwayProfile("canary palm leaf"), FLORA_SWAY.palm);
  assert.equal(floraSwayProfile("santa barbara daisy leaf"), null);
  const morning = createCoastWind({ minute: 9 * 60 }),
    afternoon = createCoastWind({ minute: 15 * 60 });
  const lean = (wind, profile) => {
    let sum = 0;
    for (let t = 0; t < 120; t += 0.5) {
      const d = sampleFloraSway([4, 5.5, 12], profile, { wind, seconds: t });
      sum += d[0] * wind.state.direction[0] + d[2] * wind.state.direction[1];
      assert.ok(Math.hypot(d[0], d[2]) <= 0.35 * profile.height + 1e-12);
      assert.ok(d[1] <= 0, "a bending stem drops its tip");
    }
    return sum / 240;
  };
  for (const profile of Object.values(FLORA_SWAY)) {
    const calm = lean(morning, profile),
      breezy = lean(afternoon, profile);
    assert.ok(breezy > 4 * Math.abs(calm), `${calm} -> ${breezy}`);
    assert.ok(breezy > 0, "the afternoon lean is downwind, inland");
  }
  // The shader hook keeps its include markers and shares one bend between position and normal.
  const shader = patchFloraSway({ uniforms: {}, vertexShader: ShaderLib.standard.vertexShader }, FLORA_SWAY.sage);
  assert.match(shader.vertexShader, /void\s+main\s*\(\s*\)\s*\{\s*vec3 floraBend=/);
  assert.ok(shader.vertexShader.includes("objectNormal=floraSwayNormal(objectNormal,floraBend);"));
  assert.ok(shader.vertexShader.includes("transformed+=uv.x*uv.x*floraBend;"));
  const depth = patchFloraSway({ uniforms: {}, vertexShader: ShaderLib.depth.vertexShader }, FLORA_SWAY.sage);
  assert.ok(depth.vertexShader.includes("transformed+=uv.x*uv.x*floraBend;"), "shadows sway with the leaves");
  assert.equal(shader.uniforms.floraSway.value[1], Math.fround(2 * Math.PI * FLORA_SWAY.sage.frequency));
});

test("the live Pacific minute follows the clock to the second, across minutes, midnight and time zones", () => {
  // 2026-10-15 14:59:30 PDT = 21:59:30 UTC.
  const at = Date.UTC(2026, 9, 15, 21, 59, 30);
  close(livePacificMinute("America/Los_Angeles", at), 14 * 60 + 59.5, 1e-9);
  let previous = livePacificMinute("America/Los_Angeles", at);
  for (let ms = 250; ms <= 120000; ms += 250) {
    const minute = livePacificMinute("America/Los_Angeles", at + ms);
    close(minute - previous, 250 / 60000, 1e-9, `step at +${ms} ms`);
    previous = minute;
  }
  // Midnight wraps to the next day's minute 0; another zone is looked up afresh.
  close(livePacificMinute("America/Los_Angeles", Date.UTC(2026, 9, 16, 7, 0, 15)), 0.25, 1e-9);
  close(livePacificMinute("UTC", Date.UTC(2026, 9, 16, 7, 0, 15)), 7 * 60 + 0.25, 1e-9);
  close(livePacificMinute("America/Los_Angeles", Date.UTC(2026, 0, 15, 20, 0, 0)), 12 * 60, 1e-9, "standard time in winter");
});
