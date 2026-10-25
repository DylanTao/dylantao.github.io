import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import {
  weatherFor,
  weatherAt,
  rainAt,
  forecastHourAt,
  modelChance,
  weatherDateHash,
  WEATHER_PROVENANCE,
} from "../assets/js/home-scene/coastal-weather.mjs";
import { COASTAL_WEATHER_DATA as DATA } from "../assets/js/home-scene/weather-data.mjs";

const receipt = JSON.parse(readFileSync(new URL("../artwork/coastal-home/weather-2026-10-24/build-receipt.json", import.meta.url), "utf8"));
const dayKey = (stamp) => new Date(stamp).toISOString().slice(0, 10);

test("weather is deterministic, bounded and uses no browser network or active clock", () => {
  const source = readFileSync(new URL("../assets/js/home-scene/coastal-weather.mjs", import.meta.url), "utf8");
  assert.doesNotMatch(source, /\b(?:fetch|setInterval|setTimeout|requestAnimationFrame)\s*\(|Date\.now\(|Math\.random\(/);
  for (const day of ["2000-01-01", "2000-02-29", "2026-10-24", "2027-01-08", "2099-12-31", "2100-03-01"]) {
    assert.deepEqual(weatherFor(day), weatherFor(day));
    for (const minute of [0, 360, 720, 1080, 1439]) {
      const weather = weatherAt(day, minute);
      assert.ok(weather.rain >= 0 && weather.rain <= 0.65);
      assert.ok(weather.cloudCover >= 0 && weather.cloudCover <= 1);
      assert.ok(weather.marine >= 0 && weather.marine <= 1);
      assert.ok(weather.rainChance >= 0 && weather.rainChance <= 1);
    }
  }
  for (const bad of ["2026-02-30", "2026-13-01", "garbage", null]) assert.throws(() => weatherFor(bad), RangeError);
});

test("the NWS snapshot is forecast only inside an actual published hourly interval", () => {
  const dates = Object.keys(DATA.forecast.days);
  const first = DATA.forecast.days[dates[0]][0];
  const lastDate = dates.at(-1),
    last = DATA.forecast.days[lastDate].at(-1);
  assert.equal(weatherAt(dates[0], first[0]).source, "nws-forecast");
  assert.equal(weatherAt(dates[0], first[0], { utcMilliseconds: first[5] * 1000 - 1 }).source, "seasonal-simulation");
  assert.equal(weatherAt(lastDate, last[1] - 0.01).source, "nws-forecast");
  const expired = weatherAt(lastDate, last[1]);
  assert.equal(expired.source, "seasonal-simulation");
  assert.equal(expired.forecastIssued, null);
  assert.equal(expired.forecastValidThrough, null);
  assert.equal(weatherAt(dayKey(Date.parse(`${lastDate}T00:00:00Z`) + 86400000), 720).source, "seasonal-simulation");
  // The receipt describes exactly the snapshot the scene ships.
  assert.equal(receipt.forecast.issued, DATA.forecast.issued);
  assert.equal(receipt.forecast.validFrom, DATA.forecast.validFrom);
  assert.equal(receipt.forecast.validThrough, DATA.forecast.validThrough);
  assert.equal(
    receipt.forecast.hours,
    Object.values(DATA.forecast.days).reduce((sum, rows) => sum + rows.length, 0)
  );
});

test("Pacific forecast lookup distinguishes both occurrences of the autumn hour", () => {
  const rows = [
    [60, 120, 0.1, 0, 0, Date.parse("2026-11-01T01:00:00-07:00") / 1000],
    [60, 120, 0.9, 0.5, 0.4, Date.parse("2026-11-01T01:00:00-08:00") / 1000],
  ];
  assert.equal(forecastHourAt(rows, 90)[2], 0.1);
  assert.equal(forecastHourAt(rows, 90, { utcMilliseconds: Date.parse("2026-11-01T01:30:00-07:00") })[2], 0.1);
  assert.equal(forecastHourAt(rows, 90, { utcMilliseconds: Date.parse("2026-11-01T01:30:00-08:00") })[2], 0.9);
  assert.equal(forecastHourAt(rows, 90, { utcMilliseconds: Date.parse("2026-11-01T03:30:00-08:00") }), undefined);
});

test("rain envelopes are smooth, bounded, deterministic and zero outside their interval", () => {
  const weather = { rainWindows: [[600, 840, 0.6]] };
  for (const minute of [0, 599, 600, 840, 1439, NaN]) assert.equal(rainAt(weather, minute), 0);
  assert.ok(rainAt(weather, 601) > 0 && rainAt(weather, 601) < rainAt(weather, 607));
  assert.equal(rainAt(weather, 720), 0.6);
  assert.ok(Math.abs(rainAt(weather, 600.01) - rainAt(weather, 600)) < 1e-5);
  assert.equal(rainAt({ rainOverride: 2 }, 720), 1);
  assert.equal(rainAt({ rainOverride: -2 }, 720), 0);
});

test("the browser re-derives every precomputed wet day from the published model", () => {
  let wetDays = 0,
    days = 0,
    winterWet = 0,
    summerWet = 0,
    repeats = 0,
    previousWet = false,
    nearTies = 0;
  for (let stamp = Date.parse("2000-01-01T00:00:00Z"); stamp < Date.parse("2100-01-01T00:00:00Z"); stamp += 86400000) {
    const key = dayKey(stamp),
      month = Number(key.slice(5, 7)),
      weather = weatherFor(key),
      wet = weather.rainWindows.length > 0,
      chance = modelChance(key),
      draw = weatherDateHash(key, 317);
    // Python and V8 may differ in a libm last bit; only an exact tie could flip a day.
    if (Math.abs(draw - chance) < 1e-12) nearTies++;
    else assert.equal(wet, draw < chance, `Python precompute / JavaScript model mismatch on ${key}`);
    assert.equal(weather.rainChance, chance);
    wetDays += Number(wet);
    if (wet && [11, 12, 1, 2, 3].includes(month)) winterWet++;
    if (wet && [6, 7, 8].includes(month)) summerWet++;
    if (wet && previousWet) repeats++;
    previousWet = wet;
    days++;
  }
  assert.equal(nearTies, 0);
  assert.equal(days, receipt.precomputedSequence.days);
  assert.equal(wetDays, receipt.precomputedSequence.wetDays);
  assert.ok(wetDays / days < 0.15, "mostly sun");
  assert.ok(winterWet > summerWet * 8, "rain belongs to the cool season");
  assert.ok(repeats / wetDays > 0.25, "wet spells persist more than independent daily draws");
});

test("wet-day amounts come from each month's midpoint quantiles", () => {
  assert.equal(DATA.amountQuantilesMm.length, 12);
  for (const table of DATA.amountQuantilesMm) {
    assert.equal(table.length, 20);
    assert.ok(table[0] >= DATA.wetThresholdMm);
    for (let i = 1; i < table.length; i++) assert.ok(table[i] >= table[i - 1]);
  }
  for (const key of ["2005-01-17", "2023-02-24", "2041-12-02"]) {
    const weather = weatherFor(key);
    if (weather.rainAmountMm) assert.ok(DATA.amountQuantilesMm[Number(key.slice(5, 7)) - 1].includes(weather.rainAmountMm));
  }
});

test("provenance and forecast interpretation preserve the distinction from observation", () => {
  assert.equal(WEATHER_PROVENANCE.station, "USW00023188");
  assert.deepEqual(WEATHER_PROVENANCE.fitYears, [1991, 2025]);
  assert.equal(WEATHER_PROVENANCE.model, receipt.model.id);
  assert.deepEqual(DATA.model.features, Object.keys(receipt.model.productionCoefficients));
  assert.deepEqual(DATA.model.coefficients, Object.values(receipt.model.productionCoefficients));
  assert.ok(Date.parse(WEATHER_PROVENANCE.forecastValidThrough) > Date.parse(WEATHER_PROVENANCE.forecastIssued));
  for (const [dateKey, rows] of Object.entries(DATA.forecast.days)) {
    for (const row of rows) {
      const minute = (row[0] + row[1]) / 2,
        weather = weatherAt(dateKey, minute, { utcMilliseconds: (row[5] + (row[1] - row[0]) * 30) * 1000 });
      assert.equal(weather.source, "nws-forecast");
      assert.equal(weather.marine, 0);
      assert.equal(weather.rainAmountMm, null);
      assert.equal(weather.cloudCover, row[2]);
      assert.equal(weather.rainChance, row[3]);
      assert.ok(Math.abs(weather.rain - row[4]) < 1e-10);
    }
  }
});

// Scene specs pin past Pacific instants. A daily forecast refresh never reaches them, but a model
// change re-draws the seasonal days: keep every pinned 3D-home state dry so CI stays deterministic.
// Only spec blocks that open the coastal home count; the record player alone never samples weather.
const OPENS_HOME = /data-home-desk-mode="3d"|data-home-desk-scene|getSceneEvidence|openHome\(|openClockedHome\(/;
test("every instant pinned by a 3D-home spec stays dry and outside the rolling forecast", () => {
  const folder = new URL("./visual/", import.meta.url),
    pacific = new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Los_Angeles",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }),
    instants = new Set();
  for (const file of readdirSync(folder).filter((name) => name.endsWith(".spec.js")))
    for (const block of readFileSync(new URL(file, folder), "utf8").split(/\n(?=test(?:\.describe)?\()/))
      if (OPENS_HOME.test(block))
        for (const match of block.matchAll(/"(20\d\d-\d\d-\d\dT\d\d:\d\d(?::\d\d(?:\.\d+)?)?(?:Z|[+-]\d\d:\d\d))"/g)) instants.add(match[1]);
  assert.ok(instants.size > 15, "the 3D-home specs' pinned instants were found");
  for (const instant of instants) {
    const utc = Date.parse(instant),
      parts = Object.fromEntries(pacific.formatToParts(new Date(utc)).map(({ type, value }) => [type, value])),
      dateKey = `${parts.year}-${parts.month}-${parts.day}`,
      minute = Number(parts.hour) * 60 + Number(parts.minute),
      weather = weatherAt(dateKey, minute, { utcMilliseconds: utc });
    assert.equal(weather.source, "seasonal-simulation", `${instant} is inside the rolling NWS window; pin scene tests to a past instant`);
    assert.ok(weather.rain <= 0.005, `${instant} now rains in the seasonal model; pin that scene test with ?weather=clear or move it`);
  }
});
