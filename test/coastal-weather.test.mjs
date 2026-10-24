import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { weatherFor, weatherAt, rainAt, forecastHourAt, weatherDateHash, WEATHER_PROVENANCE } from "../assets/js/home-scene/coastal-weather.mjs";
import { COASTAL_WEATHER_DATA as DATA } from "../assets/js/home-scene/weather-data.mjs";

test("weather is deterministic, bounded and uses no browser network or active clock", () => {
  const source = readFileSync(new URL("../assets/js/home-scene/coastal-weather.mjs", import.meta.url), "utf8");
  assert.doesNotMatch(source, /\b(?:fetch|setInterval|setTimeout|requestAnimationFrame)\s*\(|Date\.now\(|Math\.random\(/);
  for (const day of ["2000-02-29", "2026-10-24", "2027-01-08", "2099-12-31", "2100-03-01"]) {
    assert.deepEqual(weatherFor(day), weatherFor(day));
    for (const minute of [0, 360, 720, 1080, 1439]) {
      const weather = weatherAt(day, minute);
      assert.ok(weather.rain >= 0 && weather.rain <= 0.65);
      assert.ok(weather.cloudCover >= 0 && weather.cloudCover <= 1);
      assert.ok(weather.marine >= 0 && weather.marine <= 1);
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
  const tomorrow = new Date(Date.parse(`${lastDate}T00:00:00Z`) + 86400000).toISOString().slice(0, 10);
  assert.equal(weatherAt(tomorrow, 720).source, "seasonal-simulation");
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

test("the precomputed simulation is mostly dry and rain clusters in the wet season", () => {
  let winterWet = 0,
    summerWet = 0,
    wetDays = 0,
    days = 0,
    transitions = 0,
    previousWet = false;
  for (let stamp = Date.parse("2000-01-01T00:00:00Z"); stamp < Date.parse("2100-01-01T00:00:00Z"); stamp += 86400000) {
    const key = new Date(stamp).toISOString().slice(0, 10),
      month = Number(key.slice(5, 7)),
      weather = weatherFor(key),
      wet = weather.rainWindows.length > 0;
    const expected = weatherDateHash(key, 317) < DATA.transition[month - 1][Number(previousWet)];
    assert.equal(wet, expected, `Python precompute / JavaScript sampling mismatch on ${key}`);
    wetDays += Number(wet);
    if (wet && [11, 12, 1, 2, 3].includes(month)) winterWet++;
    if (wet && [6, 7, 8].includes(month)) summerWet++;
    if (wet && previousWet) transitions++;
    previousWet = wet;
    days++;
  }
  assert.equal(days, 36525);
  assert.equal(wetDays, 3880);
  assert.ok(wetDays / days < 0.15);
  assert.ok(winterWet > summerWet * 8);
  assert.ok(transitions / wetDays > 0.25, "wet spells must persist more than independent daily draws");
});

test("provenance and forecast interpretation preserve the distinction from observation", () => {
  assert.equal(WEATHER_PROVENANCE.station, "USW00023188");
  assert.deepEqual(WEATHER_PROVENANCE.fitYears, [1991, 2025]);
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
