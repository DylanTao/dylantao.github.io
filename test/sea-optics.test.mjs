import test from "node:test";
import assert from "node:assert/strict";
import {
  CAUSTIC_CEILING,
  CAUSTIC_RIPPLES,
  causticUniforms,
  CAUSTIC_FLOOR,
  LA_JOLLA_WATER,
  PURE_WATER_ABSORPTION,
  SEA_LEVEL,
  SUN_ANGULAR_RADIUS,
  SUN_SOLID_ANGLE,
  aboveSurface,
  airMass,
  causticGain,
  causticMean,
  fillSeabed,
  rayleighDepth,
  seaOpticsGLSL,
  seawaterIOPs,
  shallowReflectance,
  sunTint,
  sunTransmittance,
} from "../assets/js/home-scene/sea-optics.mjs";
import { RIPPLES } from "../assets/js/home-scene/ocean-spectrum.mjs";
import { SEA_LIGHTS_BEGIN } from "../assets/js/home-scene/environment.mjs";

const close = (actual, expected, tolerance, label = "") =>
  assert.ok(Math.abs(actual - expected) <= tolerance, `${label} ${actual} differs from ${expected} by more than ${tolerance}`);

test("seawater absorbs at least as much as pure water and scatters more toward the blue", () => {
  // Pope and Fry (1997) at 650, 550 and 450 nm, in 1/m.
  assert.deepEqual([...PURE_WATER_ABSORPTION], [0.34, 0.0565, 0.00922]);
  const { a, bb, kappa, u } = seawaterIOPs();
  for (let i = 0; i < 3; i++) {
    assert.ok(a[i] >= PURE_WATER_ABSORPTION[i], "every band absorbs at least pure water's share");
    close(kappa[i], a[i] + bb[i], 1e-12, "kappa");
    assert.ok(u[i] > 0 && u[i] < 0.2, "a clear coastal water: backscattering is a small share");
  }
  assert.ok(a[0] > a[1] && a[0] > a[2], "red is absorbed most, so shallow water over sand turns turquoise");
  assert.ok(bb[2] > bb[1] && bb[1] > bb[0], "backscattering rises toward the blue");
  assert.ok(u[2] > u[1] && u[1] > u[0], "deep water is bluest");
  // Clearer water (less chlorophyll and dissolved matter) absorbs less in the blue.
  const clear = seawaterIOPs({ ...LA_JOLLA_WATER, chlorophyll: 0.05, cdom440: 0.002 });
  assert.ok(clear.a[2] < a[2]);
});

test("the shallow-water reflectance runs from the bottom's albedo to the deep-water value", () => {
  const { u, kappa } = seawaterIOPs(),
    rho = 0.55;
  for (let i = 0; i < 3; i++) {
    const deep = (0.07 + 0.155 * u[i] ** 0.752) * u[i];
    // Lee et al. (1998) equation 21: at zero depth the bottom term is 0.31 rho; infinitely deep, r_rs^dp.
    close(shallowReflectance({ u: u[i], kappa: kappa[i], depth: 0, rho }), deep * (1 - 1.03) + 0.31 * rho, 1e-12, "surface");
    close(shallowReflectance({ u: u[i], kappa: kappa[i], depth: 500, rho }), deep, 1e-9, "deep");
    let previous = Infinity;
    for (const depth of [0, 0.25, 0.5, 1, 2, 4, 8, 16]) {
      const value = shallowReflectance({ u: u[i], kappa: kappa[i], depth, rho, cosSun: 0.8, cosView: 0.7 });
      assert.ok(value < previous, "a bright bottom fades with depth");
      previous = value;
    }
    // The bottom's light (shadow, caustics) scales the bottom term alone.
    const lit = shallowReflectance({ u: u[i], kappa: kappa[i], depth: 1, rho, light: 2 }),
      shaded = shallowReflectance({ u: u[i], kappa: kappa[i], depth: 1, rho, light: 0 }),
      open = shallowReflectance({ u: u[i], kappa: kappa[i], depth: 1, rho, light: 1 });
    close(lit - open, open - shaded, 1e-12, "linear in the bottom's light");
    // A grazing view sees less of the bottom through the longer path.
    assert.ok(shallowReflectance({ u: u[i], kappa: kappa[i], depth: 1, rho, cosView: 0.3 }) < open);
  }
  // Above the surface (Lee et al. 1999, equation 2).
  close(aboveSurface(0.01), (0.5 * 0.01) / (1 - 0.015), 1e-15);
  close(aboveSurface(1e-6), 0.5e-6, 1e-12);
});

test("over a sand bottom the water turns from sand to turquoise to deep blue-green with depth", () => {
  const { u, kappa } = seawaterIOPs(),
    sand = [0.62, 0.57, 0.47],
    colour = (depth) =>
      [0, 1, 2].map((i) => aboveSurface(shallowReflectance({ u: u[i], kappa: kappa[i], depth, rho: sand[i], cosSun: 0.85, cosView: 0.8 })));
  const surf = colour(0),
    metre = colour(1),
    deep = colour(40);
  assert.ok(surf[0] > surf[2], "at the waterline the sand's warm colour shows");
  assert.ok(metre[1] > metre[0] && metre[2] > metre[0], "a metre of water takes out the red: turquoise");
  assert.ok(deep[2] > deep[1] && deep[1] > deep[0], "open water is blue");
  assert.ok(deep[2] < metre[2], "and darker than the shallows");
});

test("caustic gain is exactly one on calm water and follows the paraxial lens of one ripple", () => {
  assert.equal(causticGain(3, 4, 1.2, 0).gain, 1, "no path, no focusing");
  const calm = causticGain(3, 4, 1.2, 2, { rippleGain: 0 });
  assert.equal(calm.raw, 1);
  assert.equal(calm.gain, 1);
  // For one plane wave the Hessian is -a k^2 sin(theta) d d^T, so det(I + l' H) = 1 + l' h_dd.
  const path = 0.8,
    lens = path * (1 - 1 / 1.333),
    sample = causticGain(1.3, -2.1, 0.7, path, { rippleGain: 1 }),
    [hxx, hzz, hxz] = sample.hessian;
  close(sample.det, (1 + lens * hxx) * (1 + lens * hzz) - lens * lens * hxz * hxz, 1e-12, "determinant");
  assert.ok(sample.raw > 0 && sample.raw <= CAUSTIC_CEILING && sample.raw <= 1 / CAUSTIC_FLOOR);
  // The sun's disc and the pixel blur the shortest ripples first, so a wide footprint flattens the gain.
  const blurred = causticGain(1.3, -2.1, 0.7, path, { rippleGain: 1, footprint: 0.5 });
  assert.ok(Math.abs(blurred.gain - 1) < 0.02);
});

test("normalised caustics keep the seabed's mean light near one at every depth", () => {
  // A fixed low-discrepancy set of points and times (golden-ratio sequence), so the test is deterministic.
  const phi = 0.6180339887498949;
  for (const path of [0.3, 0.8, 2, 4]) {
    let sum = 0;
    const n = 4000;
    for (let i = 0; i < n; i++) {
      const x = ((i * phi) % 1) * 40,
        z = ((i * phi * phi) % 1) * 40,
        t = ((i * 0.7548776662) % 1) * 60;
      sum += causticGain(x, z, t, path, { rippleGain: 1, footprint: 0.01 }).gain;
    }
    close(sum / n, 1, 0.22, `mean gain at ${path} m`);
  }
  // The rational fit's shape: one on calm water, a rise while the web sharpens, a fall once it folds.
  assert.equal(causticMean(0), 1);
  assert.ok(causticMean(1.3) > 2);
  assert.ok(causticMean(28) < 0.6);
});

test("the seabed fill keeps the captured coast and deepens the open sea away from it", () => {
  const width = 41,
    rows = 21,
    cell = 0.5,
    count = width * rows,
    heights = new Float32Array(count),
    hit = new Uint8Array(count);
  // A dry rock in the middle of a captured sandbar row, and nothing captured elsewhere.
  for (let i = 0; i < width; i++) {
    hit[10 * width + i] = 1;
    heights[10 * width + i] = SEA_LEVEL - 0.4;
  }
  hit[10 * width + 20] = 1;
  heights[10 * width + 20] = SEA_LEVEL + 0.3;
  const filled = fillSeabed({ width, rows, cell, heights, hit, slope: 0.1, curvature: 0.01, floor: SEA_LEVEL - 5 });
  assert.equal(filled.captured, width);
  assert.equal(filled.dry, 1);
  assert.equal(filled.level[10 * width + 5], heights[10 * width + 5], "captured cells keep their height");
  assert.equal(filled.level[10 * width + 20], heights[10 * width + 20]);
  assert.equal(filled.shore[10 * width + 20], 0, "the dry rock is the shoreline");
  close(filled.shore[10 * width + 23], 3 * cell, 1e-6, "distance along the row to the rock");
  // Five cells off the sandbar (2.5 m): the higher of the slope down from the sandbar and the slope down
  // from the dry rock, 0.7 m higher, along its chamfer path (5 diagonal and 10 straight cells), then the
  // steepening by the distance to the nearest captured cell.
  const off = 5 * width + 5,
    fromBar = SEA_LEVEL - 0.4 - 0.1 * 2.5,
    fromRock = SEA_LEVEL + 0.3 - 0.1 * (5 * Math.SQRT2 * cell + 10 * cell),
    expected = Math.max(fromBar, fromRock) - 0.01 * 2.5 * 2.5;
  close(filled.level[off], expected, 1e-5, "extension");
  close(filled.reach[off], 2.5, 1e-6, "reach");
  // Far from everything the seabed bottoms out at the floor.
  const far = fillSeabed({ width, rows, cell, heights, hit, slope: 2, curvature: 0.5, floor: SEA_LEVEL - 5 });
  close(far.level[0], SEA_LEVEL - 5, 1e-5, "floor");
  // Monotone: every non-captured cell lies at or below its captured neighbourhood.
  for (let k = 0; k < count; k++) if (!hit[k]) assert.ok(filled.level[k] <= SEA_LEVEL + 0.3);
});

test("the sea shader's optics chunk carries the reflectance model, the lens and the seabed lookup", () => {
  const glsl = seaOpticsGLSL();
  for (const name of ["seabedAt", "seaReflectance", "seaCaustics", "seabedAlbedo", "seaFresnel"]) assert.ok(glsl.includes(name), name);
  // The pixel stage's ripples (the seven longest) enter the lens through flat uniform arrays, looped with
  // a uniform bound so the Direct3D compiler cannot unroll them; caustics follow the same wind.
  assert.deepEqual(CAUSTIC_RIPPLES, RIPPLES.slice(0, 7));
  const { seaCausticWave, seaCausticShape, seaCausticCount } = causticUniforms();
  assert.equal(seaCausticCount.value, 7);
  assert.ok(seaCausticWave.value instanceof Float32Array && seaCausticShape.value instanceof Float32Array);
  CAUSTIC_RIPPLES.forEach((w, i) => {
    close(seaCausticWave.value[i * 4 + 2], w.k, 1e-3, "k");
    close(seaCausticShape.value[i * 4], w.amplitude * w.k * w.k, 1e-4, "curvature");
  });
  assert.ok(glsl.includes("for (int i = 0; i < seaCausticCount; i++)"));
  assert.ok(glsl.includes(".5 * rrs / (1. - 1.5 * rrs)"), "Lee et al. (1999) equation 2");
});

test("the setting sun's light crosses more air and loses its blue first", () => {
  // Kasten and Young (1989): about one air mass overhead and 38 at the horizon.
  close(airMass(90), 1, 5e-4, "zenith air mass");
  close(airMass(0), 37.92, 0.05, "horizon air mass");
  close(airMass(30), 1.995, 0.01, "air mass at 30 degrees");
  assert.equal(airMass(-3), airMass(-0.5), "the formula stops where the disc has set");
  // Hansen and Travis (1974): Rayleigh optical depth near 0.097 at 550 nm, steeply bluer.
  close(rayleighDepth(0.55), 0.0973, 5e-4, "Rayleigh depth at 550 nm");
  assert.ok(rayleighDepth(0.45) > 2 * rayleighDepth(0.55));
  let previous = sunTransmittance(60);
  for (const altitude of [30, 15, 8, 4, 2, 0.5, 0]) {
    const t = sunTransmittance(altitude);
    for (let k = 0; k < 3; k++) assert.ok(t[k] < previous[k], `band ${k} dims as the sun sinks to ${altitude}`);
    assert.ok(t[0] > t[1] && t[1] > t[2], "red outlasts green outlasts blue");
    previous = t;
  }
  assert.ok(SUN_SOLID_ANGLE > 6.9e-5 && SUN_SOLID_ANGLE < 7e-5);
  close(SUN_SOLID_ANGLE, Math.PI * SUN_ANGULAR_RADIUS ** 2, 1e-15);
});

test("the water's sun keeps the scene light's brightness and takes the low sun's hue", () => {
  const daytime = [1, 0.761, 0.434],
    luminance = (c) => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  assert.deepEqual(sunTint(40, daytime), [1, 1, 1]);
  assert.deepEqual(sunTint(65, daytime), [1, 1, 1], "unchanged above 40 degrees");
  let warmth = 0;
  for (const altitude of [30, 15, 8, 4, 2, 0.5, 0, -0.5]) {
    const tint = sunTint(altitude, daytime),
      lit = daytime.map((c, k) => c * tint[k]);
    close(luminance(lit), luminance(daytime), 1e-9, `luminance at ${altitude}`);
    const redOverBlue = tint[0] / tint[2];
    assert.ok(redOverBlue > warmth, `warmer at ${altitude} degrees`);
    warmth = redOverBlue;
  }
  // Golden at 8 degrees, deep orange-red with the disc on the horizon.
  const golden = sunTint(8, daytime),
    sunset = sunTint(0, daytime);
  assert.ok(golden[0] > 1.2 && golden[0] < 1.4 && golden[2] > 0.3 && golden[2] < 0.55);
  assert.ok(sunset[0] > 2.5 && sunset[1] < 0.4 && sunset[2] < 0.01);
  assert.deepEqual(sunTint(5, [0, 0, 0]), [1, 1, 1], "no light, no tint");
});

test("the sea keeps the sun's mirror lobe apart from the other lights' for its glitter", () => {
  const directional = SEA_LIGHTS_BEGIN.slice(SEA_LIGHTS_BEGIN.indexOf("#if ( NUM_DIR_LIGHTS > 0 ) && defined( RE_Direct )"));
  assert.ok(directional.includes("RE_Direct_SeaSun( directLight"), "the directional loop calls the sea's own sun term");
  // Point and spot lights keep three's RE_Direct.
  assert.equal(SEA_LIGHTS_BEGIN.split("RE_Direct( directLight").length - 1, 2);
});
