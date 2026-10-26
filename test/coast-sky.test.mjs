import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import {
  DARK_ALTITUDE,
  pacificOffset,
  solarPosition,
  sunEvents,
  sunState,
  themeDay,
  themeModeAt,
  usPacificOffset,
} from "../assets/js/la-jolla-sun.mjs";
import { ANCHORS, DAY_KEY, LOOKS, anchorLook, creditHalo, keyDirection, lookAt, sunOnScreen } from "../assets/js/footer-coast/sky-look.mjs";
import * as THREE from "../assets/js/three.module.min.js";
import { sceneColor, skyWeight } from "../assets/js/footer-coast/sky.mjs";
import { minuteToPoint, modeForMinute, modeMinute, pointToMinute, GEOMETRY } from "../assets/js/sun-arc-math.mjs";

const clock = (minute) => `${Math.floor(minute / 60)}:${String(Math.floor(minute % 60)).padStart(2, "0")}`;
const dates = (from, to) => {
  const out = [];
  for (let t = Date.UTC(...from); t < Date.UTC(...to); t += 86400000) out.push(new Date(t).toISOString().slice(0, 10));
  return out;
};

test("La Jolla's sun rises and sets when the almanacs say", () => {
  // sunrise-sunset.org for 32.83 N, 117.27 W on 2026-09-28: sunrise 6:40:13, sunset 18:39:00 (PDT).
  const september = sunEvents("2026-09-28");
  assert.ok(Math.abs(september.sunrise - (6 * 60 + 40.2)) < 1, `sunrise ${clock(september.sunrise)}`);
  assert.ok(Math.abs(september.sunset - (18 * 60 + 39)) < 1, `sunset ${clock(september.sunset)}`);
  // The solstices on the coast: a summer sunset near 8 pm daylight time, a winter one before 4:50 pm standard time.
  const june = sunEvents("2026-06-21"),
    december = sunEvents("2026-12-21");
  assert.ok(Math.abs(june.sunset - (20 * 60 + 1)) < 4, `June sunset ${clock(june.sunset)}`);
  assert.ok(Math.abs(december.sunset - (16 * 60 + 47)) < 4, `December sunset ${clock(december.sunset)}`);
  assert.ok(Math.abs(june.sunrise - (5 * 60 + 42)) < 4, `June sunrise ${clock(june.sunrise)}`);
  assert.ok(Math.abs(december.sunrise - (6 * 60 + 48)) < 4, `December sunrise ${clock(december.sunrise)}`);
  // Each event sits at its altitude; the sun peaks at solar noon.
  for (const day of [september, june, december]) {
    assert.ok(Math.abs(solarPosition(day.dateKey, day.sunset).altitude + 0.833) < 1e-6);
    assert.ok(Math.abs(solarPosition(day.dateKey, day.darkStarts).altitude - DARK_ALTITUDE) < 1e-6);
    assert.ok(day.sunset < day.darkStarts && day.darkStarts < day.civilDusk && day.goldenStart < day.sunset);
    for (const offset of [-5, 5]) assert.ok(solarPosition(day.dateKey, day.solarNoon + offset).altitude < day.noonAltitude);
  }
});

test("the Pacific offset follows the US daylight-saving rule with or without Intl's names", () => {
  for (const key of dates([2025, 0, 1], [2031, 0, 1])) assert.equal(usPacificOffset(key), pacificOffset(key), key);
  assert.equal(pacificOffset("2026-03-07"), -8);
  assert.equal(pacificOffset("2026-03-08"), -7);
  assert.equal(pacificOffset("2026-11-01"), -8);
});

test("theme.js turns the theme on the same sun as la-jolla-sun.mjs", () => {
  const source = readFileSync(new URL("../assets/js/theme.js", import.meta.url), "utf8");
  const block = source.slice(source.indexOf("// la-jolla-sun:begin"), source.indexOf("// la-jolla-sun:end"));
  assert.ok(block.length > 500, "theme.js keeps its marked copy");
  const context = vm.createContext({ Intl, Date, Math, Map, Number });
  vm.runInContext(`${block}\nglobalThis.laJollaThemeDay = laJollaThemeDay;`, context);
  for (const key of dates([2026, 0, 1], [2028, 0, 1])) {
    const [year, month, day] = key.split("-").map(Number);
    const copy = context.laJollaThemeDay(new Date(year, month - 1, day, 12));
    const original = themeDay(key);
    for (const name of Object.keys(original)) assert.equal(copy[name], original[name], `${key} ${name}`);
  }
  // The head's mode for a minute is the module's.
  const mode = source.slice(source.indexOf("let determineDefaultThemeMode"), source.indexOf("let readSessionThemeSetting"));
  vm.runInContext(`${mode}\nglobalThis.determineDefaultThemeMode = determineDefaultThemeMode;`, context);
  const events = sunEvents("2026-10-19");
  for (let minute = 0; minute < 1440; minute += 1) {
    const date = new Date(2026, 9, 19, Math.floor(minute / 60), minute % 60);
    assert.equal(context.determineDefaultThemeMode(date), themeModeAt(minute, events), `minute ${minute}`);
  }
});

test("the theme turns evening when the sun is three degrees down and noon brackets solar noon", () => {
  for (const key of ["2026-06-21", "2026-10-19", "2026-12-21"]) {
    const events = sunEvents(key);
    const day = themeDay(key);
    assert.equal(themeModeAt(Math.floor(day.end) - 1, events), "afternoon");
    assert.equal(themeModeAt(Math.ceil(day.end), events), "evening");
    assert.equal(themeModeAt(Math.ceil(day.start), events), "morning");
    assert.equal(themeModeAt(Math.round(day.noon), events), "noon");
    // Dusk comes 10 to 20 minutes after sunset on the coast.
    assert.ok(day.end - events.sunset > 9 && day.end - events.sunset < 21, `${key} dusk ${day.end - events.sunset}`);
  }
});

test("the sun arc keeps La Jolla's day: dusk on the horizon, solar noon at the crown", () => {
  for (const key of ["2026-03-08", "2026-06-21", "2026-10-19", "2026-11-01", "2026-12-21"]) {
    const day = themeDay(key),
      events = sunEvents(key);
    for (let minute = 0; minute < 1440; minute += 1) {
      assert.equal(modeForMinute(minute, day), themeModeAt(minute, events), `${key} ${minute}`);
      const point = minuteToPoint(minute, GEOMETRY, day);
      assert.equal(pointToMinute(point.x, point.y, GEOMETRY, day), minute, `${key} ${minute} round trip`);
    }
    const crown = minuteToPoint(day.noon, GEOMETRY, day);
    assert.ok(Math.abs(crown.x - GEOMETRY.cx) < 0.5 && Math.abs(crown.y - (GEOMETRY.cy - GEOMETRY.day)) < 0.01, `${key} crown`);
    const dusk = minuteToPoint(day.end, GEOMETRY, day);
    assert.ok(Math.abs(dusk.y - GEOMETRY.cy) < 1, `${key} dusk meets the horizon`);
    for (const mode of ["morning", "noon", "afternoon", "evening"])
      assert.equal(modeForMinute(modeMinute(mode, day), day), mode, `${key} ${mode} stop`);
  }
});

test("the four theme anchors keep the looks the site always had", () => {
  for (const [mode, look] of Object.entries(ANCHORS)) {
    const anchor = anchorLook(mode);
    assert.deepEqual(anchor, { ...LOOKS[look] });
    // No reflected sky gradient and full studio light: the stills stay valid.
    assert.equal(anchor.mirrorFar, anchor.mirror);
    assert.equal(anchor.env, 1);
    assert.equal(anchor.fog, 0);
  }
  // The rim light of the earlier hourly blend: 0.65 at noon, less by 0.45 per unit of night.
  for (const mode of ["morning", "noon", "afternoon"]) assert.ok(Math.abs(LOOKS[mode].rim - (0.65 - LOOKS[mode].night * 0.45)) < 0.001, mode);
});

test("the coast's light moves continuously through the day and returns to the anchors", () => {
  for (const key of ["2026-06-21", "2026-10-19", "2026-12-21"]) {
    let previous = null;
    for (let minute = 0; minute <= 1440; minute += 1) {
      const look = lookAt(sunState(key, minute));
      if (previous) {
        for (const [name, value] of Object.entries(look)) {
          if (name.endsWith("Color") || typeof value !== "number" || value > 255) continue;
          assert.ok(Math.abs(value - previous[name]) < 0.25, `${key} ${clock(minute)} ${name} ${previous[name]} -> ${value}`);
        }
      }
      previous = look;
    }
    // Deep night and high noon are the anchors themselves.
    const events = sunEvents(key);
    assert.deepEqual(lookAt(sunState(key, 0)), anchorLook("evening"));
    const noon = lookAt(sunState(key, events.solarNoon));
    for (const name of ["key", "fill", "exposure"]) assert.ok(Math.abs(noon[name] - LOOKS.noon[name]) < 1e-9, `${key} noon ${name}`);
    // By day the page is the sky; a chosen theme's anchor shows none.
    assert.equal(skyWeight(sunState(key, events.solarNoon)), 0);
  }
});

test("the setting sun stays behind the viewer, the rising sun comes up over the hills, and the key light stays a unit vector", () => {
  const events = sunEvents("2026-10-19");
  // Looking at the land from the bay, no setting sun's disk ever shows; the rising one does.
  for (const key of ["2026-06-21", "2026-10-19", "2026-12-21"]) {
    const day = sunEvents(key);
    for (let minute = Math.ceil(day.solarNoon); minute < 1440; minute += 5)
      assert.equal(sunOnScreen(sunState(key, minute)).visible, false, `${key} ${minute}`);
    assert.equal(sunOnScreen(sunState(key, day.sunrise + 10)).visible, true, key);
  }
  let previous = null;
  for (let minute = 0; minute < 1440; minute += 1) {
    const direction = keyDirection(sunState("2026-10-19", minute));
    assert.ok(Math.abs(Math.hypot(...direction) - 1) < 1e-9);
    if (previous) assert.ok(direction.reduce((sum, v, i) => sum + v * previous[i], 0) > 0.99, `key light jumps at ${clock(minute)}`);
    previous = direction;
  }
  assert.deepEqual(keyDirection(sunState("2026-10-19", events.solarNoon)), DAY_KEY);
  // The setting sun lights the coast from the viewer's side and, in October, from the right; the
  // rising sun lights it from behind the hills.
  const evening = keyDirection(sunState("2026-10-19", events.sunset - 5));
  assert.ok(evening[2] > 0.8 && evening[0] > 0.3, `evening key ${evening}`);
  assert.ok(keyDirection(sunState("2026-10-19", events.sunrise + 5))[2] < -0.8);
});

test("the credit's halo follows the hour: faint at noon, warm at sunset, moonlit at night", () => {
  const alpha = (rgba) => Number(rgba.match(/[\d.]+\)$/)[0].slice(0, -1));
  const noon = creditHalo(LOOKS.noon, true),
    sunset = creditHalo(LOOKS.sunset, true),
    night = creditHalo(LOOKS.night, false);
  assert.equal(alpha(noon.glow), 0);
  assert.ok(alpha(sunset.glow) > 0.3 && alpha(sunset.inner) > alpha(noon.inner));
  assert.match(sunset.glow, /^rgba\(255, 1[5-9]\d, \d+, /);
  assert.ok(alpha(night.inner) >= 0.8);
  // Night's glow is cool: more blue than red.
  const [r, , b] = night.glow.match(/\d+/g).map(Number);
  assert.ok(b > r);
});

test("sky colors are authored as displayed: the inverse tone curve round-trips through ACES", () => {
  // three r164's ACES filmic curve, as the output pass applies it.
  const aces = (c, exposure) => {
    const v = c.map((x) => (x * exposure) / 0.6);
    const input = [
      [0.59719, 0.35458, 0.04823],
      [0.076, 0.90834, 0.01566],
      [0.0284, 0.13383, 0.83777],
    ];
    const output = [
      [1.60475, -0.53108, -0.07367],
      [-0.10208, 1.10813, -0.00605],
      [-0.00327, -0.07276, 1.07602],
    ];
    const mul = (m, x) => m.map((row) => row[0] * x[0] + row[1] * x[1] + row[2] * x[2]);
    const fit = mul(input, v).map((x) => (x * (x + 0.0245786) - 0.000090537) / (x * (0.983729 * x + 0.432951) + 0.238081));
    return mul(output, fit).map((x) => Math.min(Math.max(x, 0), 1));
  };
  for (const hex of [0xffbc5a, 0xf49478, 0x9c80c0, 0x76698e, 0x1d2648]) {
    for (const exposure of [0.86, 1]) {
      const display = new THREE.Color(hex);
      const scene = sceneColor(display, exposure);
      const back = aces([scene.r, scene.g, scene.b], exposure);
      [display.r, display.g, display.b].forEach((value, i) =>
        assert.ok(Math.abs(back[i] - value) < 0.004, `${hex.toString(16)} ${exposure} channel ${i}`)
      );
    }
  }
});
