import { COASTAL_WEATHER_DATA as DATA } from "./weather-data.mjs";

// The small NWS snapshot is a forecast only inside its published hourly intervals. Beyond those
// intervals this is scene weather drawn from a calibrated statistical model of the San Diego gauge:
// seasonal wet-day chances, multiday spells and storm-size persistence, plus the retained May Gray /
// June Gloom art direction. It simulates plausible days; it does not predict the real house's weather.
const MARINE_CHANCE = [0.18, 0.2, 0.28, 0.42, 0.62, 0.7, 0.52, 0.4, 0.32, 0.26, 0.18, 0.16];
const CIRRUS_CHANCE = [0.42, 0.42, 0.38, 0.3, 0.2, 0.14, 0.16, 0.2, 0.26, 0.36, 0.42, 0.44];
const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
const DAY = 86400000;
const FIRST_DAY = Date.parse(`${DATA.sequence.start}T00:00:00Z`);
const LAST_DAY = Date.parse(`${DATA.sequence.end}T00:00:00Z`);
const MODEL = DATA.model;
const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const smooth = (a, b, x) => {
  const t = clamp((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};

export function weatherDateHash(text, salt) {
  let h = 2166136261 ^ salt;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  h ^= h >>> 15;
  h = Math.imul(h, 2246822519);
  h ^= h >>> 13;
  return (h >>> 0) / 4294967296;
}

function dateInfo(dateKey) {
  const stamp = typeof dateKey === "string" && /^\d{4}-\d{2}-\d{2}$/.test(dateKey) ? Date.parse(`${dateKey}T00:00:00Z`) : NaN;
  if (!Number.isFinite(stamp) || new Date(stamp).toISOString().slice(0, 10) !== dateKey)
    throw new RangeError("Weather needs a valid Pacific YYYY-MM-DD date key.");
  return { stamp, month: Number(dateKey.slice(5, 7)) - 1 };
}

const inSequence = (stamp) => stamp >= FIRST_DAY && stamp <= LAST_DAY;
// The precomputed 2000-2099 wet/dry bits; days before the sequence count as dry, as in the builder.
const sequenceWet = (day) => day >= 0 && Boolean((ALPHABET.indexOf(DATA.sequence.wetBits[Math.floor(day / 6)]) >> (day % 6)) & 1);

function syntheticWet(dateKey, stamp, month) {
  if (!inSequence(stamp)) return weatherDateHash(dateKey, 317) < DATA.monthlyChance[month];
  return sequenceWet(Math.round((stamp - FIRST_DAY) / DAY));
}

// A wet day's gauge total: one of the month's midpoint quantiles, chosen by the date.
function drawnAmount(dateKey, month) {
  const table = DATA.amountQuantilesMm[month];
  return table[Math.min(table.length - 1, Math.floor(weatherDateHash(dateKey, 319) * table.length))];
}

// The model's chance of a wet day, given the simulated days before it: the same logistic equation,
// feature order and arithmetic order as bin/build_coastal_weather.py, which precomputed the bits.
export function modelChance(dateKey) {
  const { stamp, month } = dateInfo(dateKey);
  if (!inSequence(stamp)) return DATA.monthlyChance[month];
  const day = Math.round((stamp - FIRST_DAY) / DAY),
    previous = new Date(stamp - DAY).toISOString().slice(0, 10),
    w1 = sequenceWet(day - 1) ? 1 : 0,
    phase = (2 * Math.PI * ((stamp - Date.UTC(Number(dateKey.slice(0, 4)), 0, 1)) / DAY)) / 365.25;
  let since = MODEL.dryDayCap;
  for (let k = 1; k < MODEL.dryDayCap; k++)
    if (sequenceWet(day - k)) {
      since = k;
      break;
    }
  const values = {
    1: 1,
    w1,
    w2: sequenceWet(day - 2) ? 1 : 0,
    a1: w1 ? Math.log1p(drawnAmount(previous, Number(previous.slice(5, 7)) - 1)) : 0,
    dsl: Math.log(since),
  };
  for (const k of [1, 2, 3]) {
    values[`s${k}`] = Math.sin(k * phase);
    values[`c${k}`] = Math.cos(k * phase);
  }
  let eta = 0;
  MODEL.features.forEach((name, i) => {
    let value = 1;
    for (const part of name.split("*")) value *= values[part];
    eta += MODEL.coefficients[i] * value;
  });
  return 1 / (1 + Math.exp(-eta));
}

function forecastWindows(rows) {
  const windows = [];
  for (const [start, end, , , intensity] of rows || []) {
    if (!intensity) continue;
    const last = windows.at(-1);
    if (last && last[1] === start) {
      const duration = last[1] - last[0];
      last[2] = (last[2] * duration + intensity * (end - start)) / (duration + end - start);
      last[1] = end;
    } else windows.push([start, end, intensity]);
  }
  return windows;
}

export function weatherFor(dateKey) {
  const { stamp, month } = dateInfo(dateKey),
    wet = syntheticWet(dateKey, stamp, month),
    marine = weatherDateHash(dateKey, 17) < MARINE_CHANCE[month] ? 0.55 + 0.45 * weatherDateHash(dateKey, 5) : 0,
    cirrus = weatherDateHash(dateKey, 91) < CIRRUS_CHANCE[month] ? 0.35 + 0.65 * weatherDateHash(dateKey, 23) : 0.08 * weatherDateHash(dateKey, 29),
    amount = wet ? drawnAmount(dateKey, month) : 0,
    duration = clamp(90 + amount * 32, 120, 480),
    start = 30 + weatherDateHash(dateKey, 323) * (1380 - duration);
  return {
    marine,
    eveningMarine: marine > 0 && weatherDateHash(dateKey, 41) < 0.45,
    cirrus,
    seed: weatherDateHash(dateKey, 7),
    source: "seasonal-simulation",
    dateKey,
    cloudCover: 0,
    rainChance: modelChance(dateKey),
    rainAmountMm: amount,
    // Durations, within-day timing and display intensity are authored; daily gauge totals do not
    // provide them. The interval envelope reaches zero before midnight and never advances itself.
    rainWindows: wet ? [[start, start + duration, clamp(0.12 + amount / 36, 0.12, 0.65)]] : [],
    forecastIssued: null,
    forecastValidThrough: null,
  };
}

// Smooth and bounded; no timers, RNG, network, Date.now or active-time advancement. Root rendering
// freezes its supplied scene clock under Pause, hidden views and reduced motion.
export function rainAt(weather, minute) {
  if (!Number.isFinite(minute)) return 0;
  if (Number.isFinite(weather.rainOverride)) return clamp(weather.rainOverride);
  let intensity = 0;
  for (const [start, end, amplitude] of weather.rainWindows || []) {
    const shoulder = Math.min(15, (end - start) / 4);
    intensity = Math.max(intensity, amplitude * smooth(start, start + shoulder, minute) * (1 - smooth(end - shoulder, end, minute)));
  }
  return clamp(intensity);
}

export function forecastHourAt(rows, minute, { utcMilliseconds } = {}) {
  return rows?.find(([start, end, , , , epoch]) =>
    Number.isFinite(utcMilliseconds)
      ? utcMilliseconds >= epoch * 1000 && utcMilliseconds < (epoch + (end - start) * 60) * 1000
      : minute >= start && minute < end
  );
}

export function weatherAt(dateKey, minute, { utcMilliseconds } = {}) {
  const weather = weatherFor(dateKey),
    boundedMinute = Number.isFinite(minute) ? clamp(minute, 0, 1440) : 720,
    rows = DATA.forecast.days[dateKey],
    // The UTC argument distinguishes the repeated Pacific hour at the autumn DST transition.
    // Date/minute-only authored previews deterministically select its first occurrence.
    row = forecastHourAt(rows, boundedMinute, { utcMilliseconds });
  if (row) {
    // NWS's textual sky condition supports a generic cloud fraction, not a measured cloud height
    // or marine inversion. Do not turn a cloudy forecast into a bank of invented low coastal fog.
    weather.marine = 0;
    weather.eveningMarine = false;
    weather.cloudCover = row[2];
    weather.cirrus = Math.min(0.45, row[2] * 0.5);
    weather.rainChance = row[3];
    weather.rainAmountMm = null;
    weather.rainWindows = forecastWindows(rows);
    weather.source = "nws-forecast";
    weather.forecastIssued = DATA.forecast.issued;
    weather.forecastValidThrough = DATA.forecast.validThrough;
    weather.forecastHourUtc = row[5];
  } else {
    // Keep the original morning/evening marine-layer schedule separate from generic rain cloud.
    const morning = 1 - smooth(600, 690, boundedMinute) + smooth(1380, 1439, boundedMinute) * 0.6,
      evening = weather.eveningMarine ? smooth(1110, 1200, boundedMinute) : 0,
      marineNow = clamp(Math.max(morning, evening)) * weather.marine;
    weather.cloudCover = Math.max(marineNow * 0.8, 0.9 * smooth(0, 0.12, rainAt(weather, boundedMinute)));
  }
  weather.rain = rainAt(weather, boundedMinute);
  return weather;
}

export const WEATHER_PROVENANCE = Object.freeze({
  station: DATA.station,
  fitYears: Object.freeze([...DATA.fitYears]),
  model: MODEL.id,
  wetThresholdMm: DATA.wetThresholdMm,
  forecastSource: DATA.forecast.source,
  forecastIssued: DATA.forecast.issued,
  forecastValidFrom: DATA.forecast.validFrom,
  forecastValidThrough: DATA.forecast.validThrough,
  simulationRange: Object.freeze([DATA.sequence.start, DATA.sequence.end]),
});
