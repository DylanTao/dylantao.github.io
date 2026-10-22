import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  NIGHT_SKY_MAGNITUDE,
  airmass,
  applyMatrix3,
  bvTemperature,
  countVisibleStars,
  decodeStars,
  equatorialVector,
  glowFactor,
  greenwichMeanSiderealTime,
  horizonMatrix,
  limitingMagnitude,
  moonPhaseFactor,
  nightSkyLight,
  precessionMatrix,
  skyLuminance,
  skyMagnitude,
  starColor,
  starMatrix,
  zenithLimit,
} from "../assets/js/home-scene/stars.mjs";
import { moonPosition } from "../assets/js/home-scene/atmosphere-model.mjs";

const DEG = Math.PI / 180;
const stars = decodeStars();
const hms = (h, m, s) => (h + m / 60 + s / 3600) * 15;
const dms = (sign, d, m, s) => sign * (d + m / 60 + s / 3600);
const raDec = (v) => [(((Math.atan2(v[1], v[0]) / DEG) % 360) + 360) % 360, Math.asin(v[2]) / DEG];

test("sidereal time matches Meeus's worked examples", () => {
  // Astronomical Algorithms (2nd ed.), examples 12.a and 12.b: 1987 April 10 at 0h and 19:21 UT.
  assert.ok(Math.abs(greenwichMeanSiderealTime(Date.UTC(1987, 3, 10)) - hms(13, 10, 46.3668)) < 2e-5);
  assert.ok(Math.abs(greenwichMeanSiderealTime(Date.UTC(1987, 3, 10, 19, 21)) - hms(8, 34, 57.0896)) < 2e-5);
});

test("precession carries J2000 positions to the date (Meeus example 21.b)", () => {
  // Theta Persei, its proper motion already applied, precessed to 2028 November 13.19 TD.
  const utc = (2462088.69 - 2440587.5) * 86400000,
    [ra, dec] = raDec(applyMatrix3(precessionMatrix(utc), equatorialVector(hms(2, 44, 12.975), dms(1, 49, 13, 39.896))));
  assert.ok(Math.abs(ra - hms(2, 46, 11.331)) * 3600 < 0.5, `right ascension off by ${((ra - hms(2, 46, 11.331)) * 3600).toFixed(2)}"`);
  assert.ok(Math.abs(dec - dms(1, 49, 20, 54.54)) * 3600 < 0.5, `declination off by ${((dec - dms(1, 49, 20, 54.54)) * 3600).toFixed(2)}"`);
  // At J2000 itself the rotation is the identity.
  const identity = precessionMatrix(Date.UTC(2000, 0, 1, 12));
  identity.forEach((v, i) => assert.ok(Math.abs(v - (i % 4 === 0 ? 1 : 0)) < 1e-6));
});

test("the horizon frame reproduces Meeus's altitude and azimuth (example 13.b)", () => {
  // Venus from the US Naval Observatory, 1987 April 10 at 19:21 UT; Meeus's azimuth runs west from south.
  const local = (hms(8, 34, 56.853) - dms(1, 77, 3, 56)) * DEG,
    venus = applyMatrix3(horizonMatrix(local, dms(1, 38, 55, 17) * DEG), equatorialVector(hms(23, 9, 16.641), dms(-1, 6, 43, 11.61))),
    azimuth = (((Math.atan2(-venus[2], -venus[0]) / DEG) % 360) + 360) % 360,
    altitude = Math.asin(venus[1]) / DEG;
  assert.ok(Math.abs(azimuth - 68.0337) < 2e-4, `azimuth ${azimuth}`);
  assert.ok(Math.abs(altitude - 15.1249) < 2e-4, `altitude ${altitude}`);
});

test("the catalogue is the Bright Star Catalogue's naked-eye sky, brightest first", () => {
  assert.equal(stars.count, 3249);
  // Sirius leads, white (B-V 0.00); the stars run from bright to faint.
  assert.ok(Math.abs(stars.magnitude[0] + 1.46) < 0.02 && Math.abs(stars.colorIndex[0]) < 0.02);
  for (let i = 1; i < stars.count; i++) assert.ok(stars.magnitude[i] >= stars.magnitude[i - 1] - 1e-6);
  let brighterThan4 = 0,
    pole = 0;
  for (let i = 0; i < stars.count; i++) {
    if (stars.magnitude[i] <= 4) brighterThan4++;
    if (stars.direction[i * 3 + 2] > stars.direction[pole * 3 + 2]) pole = i;
  }
  assert.ok(brighterThan4 > 500 && brighterThan4 < 560, `${brighterThan4} stars to magnitude 4`);
  // Polaris: the star nearest the J2000 pole, 0.74 degrees from it, magnitude 2.0.
  assert.ok(Math.abs(stars.magnitude[pole] - 2.02) < 0.04);
  assert.ok(Math.abs(Math.acos(stars.direction[pole * 3 + 2]) / DEG - 0.737) < 0.01);
  // Eight bytes a star: 26 KB of data, about 27 KB as a gzipped module.
  assert.ok(fs.statSync(new URL("../assets/js/home-scene/star-catalogue.mjs", import.meta.url)).size < 40000);
});

test("over La Jolla, Polaris stands at the latitude in the north and the sky turns once a sidereal day", () => {
  const utc = Date.parse("2026-10-21T21:30:00-07:00"),
    polaris = applyMatrix3(starMatrix(utc), equatorialVector(hms(2, 31, 49.09), dms(1, 89, 15, 50.8)));
  assert.ok(Math.abs(Math.asin(polaris[1]) / DEG - 32.83) < 0.8, `Polaris at ${Math.asin(polaris[1]) / DEG}`);
  assert.ok(polaris[0] > 0.8 && Math.abs(polaris[2]) < 0.02);
  // One sidereal day later every star is back where it was (to the precession of a day).
  const vega = equatorialVector(hms(18, 36, 56.3), dms(1, 38, 47, 1)),
    a = applyMatrix3(starMatrix(utc), vega),
    b = applyMatrix3(starMatrix(utc + 86164090.5), vega);
  assert.ok(Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]) < 2e-5);
  // A pure function of the instant: the same minute gives the same sky.
  assert.deepEqual(starMatrix(utc), starMatrix(utc));
});

test("colour follows B-V through the blackbody locus", () => {
  // Ballesteros's formula: the Sun's B-V of 0.65 is about 5800 K, Vega's 0.00 about 10 000 K.
  assert.ok(Math.abs(bvTemperature(0.65) - 5800) < 120);
  assert.ok(Math.abs(bvTemperature(0) - 10100) < 300);
  const luminance = (c) => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  const vega = starColor(0),
    sun = starColor(0.65),
    antares = starColor(1.83);
  for (const c of [vega, sun, antares]) assert.ok(Math.abs(luminance(c) - 1) < 1e-6);
  assert.ok(vega[2] > vega[1] && vega[1] > vega[0], "Vega is blue-white");
  assert.ok(Math.max(...sun) / Math.min(...sun) < 1.25, "the Sun is nearly white on a D65 display");
  assert.ok(antares[0] > antares[1] && antares[1] > antares[2] && antares[0] / antares[2] > 3, "Antares is orange-red");
  // Never magenta: green sits between red and blue for every star in the catalogue.
  for (let i = 0; i < stars.count; i += 7) {
    const [r, g, b] = starColor(stars.colorIndex[i]);
    assert.ok(g <= Math.max(r, b) + 1e-6 && g >= Math.min(r, b) - 1e-6, `B-V ${stars.colorIndex[i]}`);
  }
});

test("the naked-eye limit follows the sky's brightness (Schaefer 1993)", () => {
  assert.ok(Math.abs(limitingMagnitude(22) - 6.6) < 0.1, "a pristine sky");
  assert.ok(Math.abs(limitingMagnitude(NIGHT_SKY_MAGNITUDE) - 5.1) < 0.1, "La Jolla's moonless sky");
  let previous = Infinity;
  for (let b = 22; b >= 10; b -= 0.5) {
    const limit = limitingMagnitude(b);
    assert.ok(limit < previous);
    previous = limit;
  }
  assert.ok(limitingMagnitude(12) < -1, "bright twilight hides every star");
  assert.ok(Math.abs(skyMagnitude(skyLuminance(19.4)) - 19.4) < 1e-9);
  // The glow is brightest toward the city in the south-east and least over the sea.
  const city = [-0.56 * Math.cos(5 * DEG), Math.sin(5 * DEG), 0.83 * Math.cos(5 * DEG)],
    sea = [0, Math.sin(5 * DEG), -Math.cos(5 * DEG)];
  assert.ok(glowFactor(city) > glowFactor(sea) * 1.4 && glowFactor([0, 1, 0]) === 1);
  // The moon: a full moon is ten times a quarter's light (Allen's phase law).
  assert.ok(Math.abs(moonPhaseFactor(1) - 1) < 1e-9 && moonPhaseFactor(0.5) < 0.12 && moonPhaseFactor(0.5) > 0.07);
  // Air mass is one overhead and about 38 on the horizon (Kasten and Young).
  assert.ok(Math.abs(airmass(90 * DEG) - 1) < 1e-3 && Math.abs(airmass(0) - 38) < 1);
});

test("a few hundred stars show on a moonless night, fewer under the moon", () => {
  const utc = Date.parse("2026-10-21T21:30:00-07:00"),
    matrix = starMatrix(utc),
    moon = moonPosition(utc);
  const dark = countVisibleStars(stars, matrix, nightSkyLight()),
    tonight = countVisibleStars(stars, matrix, nightSkyLight({ moonAltitude: moon.altitude, moonIllumination: moon.illumination })),
    full = countVisibleStars(stars, matrix, nightSkyLight({ moonAltitude: 60 * DEG, moonIllumination: 1 }));
  assert.ok(dark.visible > 250 && dark.visible < 600, `moonless ${dark.visible}`);
  assert.ok(full.visible > 50 && full.visible < 160, `full moon ${full.visible}`);
  assert.ok(tonight.visible < dark.visible && tonight.visible > full.visible, `tonight ${tonight.visible}`);
  assert.ok(Math.abs(zenithLimit(nightSkyLight()) - 5.07) < 0.05);
  // An overcast deck lets none through (the shader's visibility factor), and the counts never reach thousands.
  assert.ok(dark.visible < 1000);
});

test("the shader keeps the model's limit, glow and size", () => {
  const source = fs.readFileSync(new URL("../assets/js/home-scene/stars.mjs", import.meta.url), "utf8");
  assert.match(source, /7\.93 - 5\.0 \* starLog10\(pow\(10\.0, 4\.316 - b \/ 5\.0\) \+ 1\.0\)/);
  assert.match(source, /1\.0 \+ 2\.8 \* low \* low \* low \* \(0\.45 \+ 0\.55 \* city\)/);
  assert.match(source, /clamp\(1\.25 \* pow\(excess, 0\.14\), 1\.25, 2\.6\) \* starPixelRatio/);
  // Twinkling follows the scene's clock and is off until the scene moves.
  assert.match(source, /starTwinkle: \{ value: 0 \}/);
});
