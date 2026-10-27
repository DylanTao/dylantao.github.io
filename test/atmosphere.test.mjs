import test from "node:test";
import assert from "node:assert/strict";
import {
  ATMOSPHERE,
  DEG,
  SUNSET_ALTITUDE,
  adaptationGain,
  fogNoiseVolume,
  marineLayerAt,
  marineTop,
  moonPosition,
  opticalDepth,
  refraction,
  skyRadiance,
  transmittanceToTop,
  unrefract,
  weatherFor,
} from "../assets/js/home-scene/atmosphere-model.mjs";
import { apparentDirection, skyLighting, sunDisc, weatherOverride } from "../assets/js/home-scene/atmosphere.mjs";
import { coastalDaylight, LA_JOLLA } from "../assets/js/home-scene/daylight.mjs";

const luminance = (c) => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
const r0 = ATMOSPHERE.bottomRadius + 0.03;

test("a closed cloud deck removes the directional key while retaining finite diffuse daylight", () => {
  const sun = coastalDaylight("2026-10-26", 750).direction;
  const clear = skyLighting({ sun });
  let previous = clear.sunLuminance;
  for (const marine of [0.25, 0.5, 0.75, 1]) {
    const cloudy = skyLighting({ sun, marine });
    assert.ok(cloudy.sunLuminance < previous, "thicker clouds cannot strengthen the hard key");
    for (const color of [cloudy.zenith, cloudy.horizon, cloudy.irradiance, cloudy.ground])
      assert.ok(
        color.every((value) => Number.isFinite(value) && value >= 0),
        "cloudy daylight remains a nonnegative finite light field"
      );
    assert.ok(luminance(cloudy.irradiance) > 0, "obscuring the sun leaves diffuse sky illumination");
    previous = cloudy.sunLuminance;
  }
  const overcast = skyLighting({ sun, marine: 1 });
  assert.ok(overcast.sunLuminance < clear.sunLuminance * 0.001, "a closed deck cannot retain crisp high-contrast sunlight");
  assert.ok(luminance(overcast.ground) < luminance(clear.ground), "cloud-covered ground does not keep clear-sky sun bounce");
});

// An independent reference: NOAA's solar calculator spreadsheet (after Meeus, Astronomical
// Algorithms), Julian-century form, iterated once at the sunset it finds. The scene uses NOAA's other
// form, the fractional-year series in daylight.mjs; the two must agree on La Jolla's sunset.
function noaaSunset(dateKey, offsetHours) {
  const [y, m, d] = dateKey.split("-").map(Number);
  const rad = Math.PI / 180;
  const sunsetAt = (minute) => {
    const jd = Date.UTC(y, m - 1, d) / 86400000 + 2440587.5 + (minute - offsetHours * 60) / 1440,
      T = (jd - 2451545) / 36525,
      L0 = (((280.46646 + T * (36000.76983 + T * 0.0003032)) % 360) + 360) % 360,
      M = 357.52911 + T * (35999.05029 - 0.0001537 * T),
      e = 0.016708634 - T * (0.000042037 + 0.0000001267 * T),
      C =
        Math.sin(M * rad) * (1.914602 - T * (0.004817 + 0.000014 * T)) +
        Math.sin(2 * M * rad) * (0.019993 - 0.000101 * T) +
        Math.sin(3 * M * rad) * 0.000289,
      omega = 125.04 - 1934.136 * T,
      lambda = L0 + C - 0.00569 - 0.00478 * Math.sin(omega * rad),
      epsilon = 23 + (26 + (21.448 - T * (46.815 + T * (0.00059 - T * 0.001813))) / 60) / 60 + 0.00256 * Math.cos(omega * rad),
      declination = Math.asin(Math.sin(epsilon * rad) * Math.sin(lambda * rad)),
      yy = Math.tan((epsilon / 2) * rad) ** 2,
      equation =
        (4 / rad) *
        (yy * Math.sin(2 * L0 * rad) -
          2 * e * Math.sin(M * rad) +
          4 * e * yy * Math.sin(M * rad) * Math.cos(2 * L0 * rad) -
          0.5 * yy * yy * Math.sin(4 * L0 * rad) -
          1.25 * e * e * Math.sin(2 * M * rad)),
      latitude = LA_JOLLA.latitude * rad,
      hourAngle = Math.acos(Math.cos(90.833 * rad) / (Math.cos(latitude) * Math.cos(declination)) - Math.tan(latitude) * Math.tan(declination)) / rad,
      noon = 720 - 4 * LA_JOLLA.longitude - equation + offsetHours * 60;
    return noon + 4 * hourAngle;
  };
  return sunsetAt(sunsetAt(1080));
}

// The scene's sunset: the minute the drawn disc's top limb meets the sea horizon.
function sceneSunset(dateKey) {
  let previous = null;
  for (let minute = 900; minute < 1300; minute += 0.05) {
    const top = sunDisc(coastalDaylight(dateKey, minute).direction).topElevation;
    if (previous !== null && previous > 0 && top <= 0) return minute - (0.05 * top) / (top - previous);
    previous = top;
  }
  return NaN;
}

test("the drawn sun sets at NOAA's sunset minute for La Jolla through the year", () => {
  for (const dateKey of ["2026-03-20", "2026-06-21", "2026-10-18", "2026-12-21", "2027-02-14"]) {
    const offset = coastalDaylight(dateKey, 720).offset,
      reference = noaaSunset(dateKey, offset),
      scene = sceneSunset(dateKey);
    assert.ok(Math.abs(scene - reference) < 2, `${dateKey}: scene ${scene.toFixed(2)} vs NOAA ${reference.toFixed(2)} minutes`);
  }
  // October 18, 2026 sets at about 18:13 Pacific daylight time.
  assert.ok(Math.abs(sceneSunset("2026-10-18") - (18 * 60 + 13.5)) < 2);
});

test("the disc's top limb is on the horizon when the true centre is at NOAA's 90.833 degrees", () => {
  const top = (trueAltitude) => sunDisc([Math.cos(trueAltitude), Math.sin(trueAltitude), 0]).topElevation / DEG;
  assert.ok(Math.abs(top(SUNSET_ALTITUDE)) < 0.02, `top limb at ${top(SUNSET_ALTITUDE)} degrees`);
  // Refraction squashes the disc near the horizon and leaves it round high in the sky.
  const low = sunDisc([1, Math.sin(0.2 * DEG), 0]).squash,
    high = sunDisc([Math.cos(40 * DEG), Math.sin(40 * DEG), 0]).squash;
  assert.ok(low < 0.9 && low > 0.7, `horizon squash ${low}`);
  assert.ok(high > 0.995);
});

test("refraction matches the standard horizontal value and inverts", () => {
  // Bennett: about 34 arcminutes for an object on the apparent horizon (Meeus, chapter 16).
  const atHorizon = (0 - unrefract(0)) / DEG;
  assert.ok(Math.abs(atHorizon * 60 - 34.5) < 1, `${atHorizon * 60} arcminutes`);
  for (const h of [-0.5, 0, 1, 5, 20, 60]) {
    const trueAltitude = h * DEG,
      back = unrefract(trueAltitude + refraction(trueAltitude));
    assert.ok(Math.abs(back - trueAltitude) / DEG < 0.03, `${h} degrees round trip ${back / DEG}`);
  }
  const lifted = apparentDirection([1, 0, 0]);
  assert.ok(lifted[1] > Math.sin(0.4 * DEG) && lifted[1] < Math.sin(0.6 * DEG));
});

test("vertical optical depth is the exact integral of the density profiles", () => {
  const depth = opticalDepth(ATMOSPHERE.bottomRadius, 1, 100, 4000),
    H = ATMOSPHERE.rayleighScaleHeight,
    Hm = ATMOSPHERE.mieScaleHeight;
  for (let c = 0; c < 3; c++) {
    const exact =
      ATMOSPHERE.rayleighScattering[c] * H * (1 - Math.exp(-100 / H)) +
      (ATMOSPHERE.mieScattering[c] + ATMOSPHERE.mieAbsorption[c]) * Hm * (1 - Math.exp(-100 / Hm)) +
      ATMOSPHERE.ozoneAbsorption[c] * ATMOSPHERE.ozoneHalfWidth;
    assert.ok(Math.abs(depth[c] - exact) / exact < 0.002, `channel ${c}: ${depth[c]} vs ${exact}`);
  }
  // The coast's aerosol optical depth at 550 nm is the clear marine day's 0.045.
  const aod = (ATMOSPHERE.mieScattering[1] + ATMOSPHERE.mieAbsorption[1]) * Hm;
  assert.ok(Math.abs(aod - 0.045) < 0.001);
});

test("the sun dims and reddens monotonically as it sets, and is gone below the sea", () => {
  let previous = null;
  for (let elevation = 60; elevation >= 0.5; elevation -= 0.5) {
    const t = transmittanceToTop(r0, Math.sin(elevation * DEG));
    if (previous) {
      for (let c = 0; c < 3; c++) assert.ok(t[c] <= previous.t[c] + 1e-12, `channel ${c} rose at ${elevation}`);
      assert.ok(t[0] / t[2] >= previous.ratio - 1e-9, `reddening reversed at ${elevation}`);
    }
    previous = { t, ratio: t[0] / t[2] };
  }
  // Golden at 10 degrees (red over blue about 3), deep orange at 2 (about 50), none under the horizon.
  const ten = transmittanceToTop(r0, Math.sin(10 * DEG)),
    two = transmittanceToTop(r0, Math.sin(2 * DEG));
  assert.ok(ten[0] / ten[2] > 2.5 && ten[0] / ten[2] < 5);
  assert.ok(two[0] / two[2] > 20);
  assert.deepEqual(transmittanceToTop(r0, Math.sin(-1 * DEG)), [0, 0, 0]);
});

test("the scene's key light follows the sun from midday to dusk without a jump", () => {
  let previous = Infinity;
  for (let minute = 780; minute <= 1110; minute += 5) {
    const daylight = coastalDaylight("2026-10-18", minute),
      light = skyLighting({ sun: apparentDirection(daylight.direction) });
    assert.ok(light.sunLuminance <= previous * 1.02 + 1e-9, `the key brightened at ${minute}`);
    previous = light.sunLuminance;
  }
  // Calibrated to the authored midday key of about 2.5.
  const noon = skyLighting({ sun: apparentDirection(coastalDaylight("2026-10-18", 780).direction) });
  assert.ok(noon.sunLuminance > 2.1 && noon.sunLuminance < 2.9, `midday key ${noon.sunLuminance}`);
  // The midday sky is blue overhead and paler at the horizon.
  const zenith = skyRadiance([0, 1, 0], apparentDirection(coastalDaylight("2026-10-18", 780).direction)),
    horizon = skyRadiance([0, Math.sin(3 * DEG), -Math.cos(3 * DEG)], apparentDirection(coastalDaylight("2026-10-18", 780).direction));
  assert.ok(zenith[2] / zenith[0] > horizon[2] / horizon[0]);
});

test("twilight darkens monotonically and the eye's adaptation never inverts it", () => {
  let previousSky = Infinity,
    previousShown = Infinity,
    previousGain = 0;
  for (let elevation = 10; elevation >= -12; elevation -= 1) {
    const sun = [Math.cos(elevation * DEG) * -0.22, Math.sin(elevation * DEG), Math.cos(elevation * DEG) * -0.97],
      zenith = luminance(skyRadiance([0, 1, 0], sun)),
      gain = adaptationGain(elevation * DEG);
    assert.ok(zenith < previousSky, `zenith brightened at ${elevation}`);
    assert.ok(gain >= previousGain, `gain fell at ${elevation}`);
    assert.ok(zenith * gain < previousShown * 1.05, `adapted zenith brightened at ${elevation}`);
    previousSky = zenith;
    previousShown = zenith * gain;
    previousGain = gain;
  }
  assert.equal(adaptationGain(25 * DEG), 1);
});

test("the moon's phase matches published lunations", () => {
  // USNO: full moon 2024-01-25 17:54 UTC, new moon 2024-02-09 22:59 UTC.
  const full = moonPosition(Date.UTC(2024, 0, 25, 17, 54)),
    fresh = moonPosition(Date.UTC(2024, 1, 9, 22, 59));
  assert.ok(full.illumination > 0.98, `full moon at ${full.illumination}`);
  assert.ok(fresh.illumination < 0.02, `new moon at ${fresh.illumination}`);
  const quarter = moonPosition(Date.UTC(2024, 1, 2, 23, 18));
  assert.ok(Math.abs(quarter.illumination - 0.5) < 0.06, `last quarter at ${quarter.illumination}`);
  assert.ok(Math.abs(Math.hypot(...full.direction) - 1) < 1e-9);
});

test("the day's weather is deterministic and keeps midday clear", () => {
  for (const dateKey of ["2026-05-14", "2026-06-02", "2026-10-09", "2026-10-18", "2026-12-25"]) {
    const a = weatherFor(dateKey),
      b = weatherFor(dateKey);
    assert.deepEqual(a, b);
    assert.ok(a.marine === 0 || (a.marine >= 0.55 && a.marine <= 1));
    assert.ok(a.cirrus >= 0 && a.cirrus <= 1);
    assert.equal(marineLayerAt(a, 780), 0);
  }
  const marine = { ...weatherFor("2026-10-18"), ...weatherOverride("?weather=marine") };
  assert.ok(marineLayerAt(marine, 450) > 0.5);
  assert.ok(marineLayerAt(marine, 1170) > 0.3);
  assert.equal(weatherOverride("?weather=unknown"), null);
  assert.ok(marineTop(0) >= 2 && marineTop(1) <= 11.5);
});

test("the fog's noise volume is deterministic and periodic", () => {
  const size = 16,
    a = fogNoiseVolume(size),
    b = fogNoiseVolume(size);
  assert.deepEqual(a, b);
  let min = 255,
    max = 0,
    interior = 0,
    seam = 0;
  for (let z = 0; z < size; z++)
    for (let y = 0; y < size; y++) {
      const row = (z * size + y) * size;
      seam += Math.abs(a[row + size - 1] - a[row]);
      interior += Math.abs(a[row + size / 2] - a[row + size / 2 - 1]);
      for (let x = 0; x < size; x++) {
        min = Math.min(min, a[row + x]);
        max = Math.max(max, a[row + x]);
      }
    }
  assert.ok(max - min > 80, `range ${min}..${max}`);
  // The wrap from x = size - 1 back to 0 is as smooth as any step inside the volume.
  assert.ok(seam < interior * 1.6, `seam ${seam} vs interior ${interior}`);
});
