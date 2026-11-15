#!/usr/bin/env node
// Renders the site's sound without a speaker: each interface event in each hour's key, and a stretch
// of each hour's bed, to a WAV file, a spectrogram and a row of measurements.
//
//   node bin/render_site_sound.cjs [outDir] [--bed=90] [--only=open,switch-on] [--modes=noon,evening,day]
//
// Besides each sound it writes "day": the four hours in turn, about 22 seconds each, each hour's bed with
// a visitor's gestures over it (the key announced, a row of links pointed at, a card opened, a switch,
// two sections arriving, the card closed, a thrown row landing).
//
// The engine (assets/js/sound/engine.mjs) runs in a headless browser's OfflineAudioContext, served
// from the working tree, so no preview is needed. Whoever cannot listen can still look: a spectrogram
// shows pitch, overtones, attack, tail and the room; report.json gives the peak and RMS level, the
// strongest pitch against the note the score asked for, and how long the sound takes to die away.
// The WAV files are for ears.
const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require("playwright");
const { PNG } = require("pngjs");

const root = path.resolve(__dirname, "..");
const args = process.argv.slice(2);
const outDir = path.resolve(args.find((a) => !a.startsWith("--")) || path.join(root, ".jekyll-cache/sound"));
const option = Object.fromEntries(
  args
    .filter((a) => a.startsWith("--"))
    .map((a) => {
      const [key, value = "1"] = a.slice(2).split("=");
      return [key, value];
    })
);
const bedSeconds = Number(option.bed ?? 90);
const types = { ".mjs": "text/javascript; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".html": "text/html; charset=utf-8" };

function wav(channels, sampleRate) {
  const frames = channels[0].length,
    data = Buffer.alloc(44 + frames * channels.length * 2);
  data.write("RIFF", 0);
  data.writeUInt32LE(36 + frames * channels.length * 2, 4);
  data.write("WAVEfmt ", 8);
  data.writeUInt32LE(16, 16);
  data.writeUInt16LE(1, 20);
  data.writeUInt16LE(channels.length, 22);
  data.writeUInt32LE(sampleRate, 24);
  data.writeUInt32LE(sampleRate * channels.length * 2, 28);
  data.writeUInt16LE(channels.length * 2, 32);
  data.writeUInt16LE(16, 34);
  data.write("data", 36);
  data.writeUInt32LE(frames * channels.length * 2, 40);
  for (let i = 0; i < frames; i++)
    for (let c = 0; c < channels.length; c++)
      data.writeInt16LE(Math.round(Math.max(-1, Math.min(1, channels[c][i])) * 32767), 44 + (i * channels.length + c) * 2);
  return data;
}

// In-place radix-2 FFT of a real frame; returns magnitudes of the lower half.
function magnitudes(frame) {
  const n = frame.length,
    re = Float64Array.from(frame),
    im = new Float64Array(n);
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) [re[i], re[j]] = [re[j], re[i]];
  }
  for (let size = 2; size <= n; size <<= 1) {
    const angle = (-2 * Math.PI) / size;
    for (let start = 0; start < n; start += size)
      for (let k = 0; k < size / 2; k++) {
        const c = Math.cos(angle * k),
          s = Math.sin(angle * k),
          a = start + k,
          b = a + size / 2,
          tr = re[b] * c - im[b] * s,
          ti = re[b] * s + im[b] * c;
        re[b] = re[a] - tr;
        im[b] = im[a] - ti;
        re[a] += tr;
        im[a] += ti;
      }
  }
  const out = new Float64Array(n / 2);
  for (let i = 0; i < n / 2; i++) out[i] = Math.hypot(re[i], im[i]) / (n / 4);
  return out;
}

// A spectrogram on a logarithmic pitch axis from 55 Hz to 7 kHz: one octave is the same height
// everywhere, so a note and its overtones read as they would on a stave. Brightness is level over
// 72 dB; faint grid lines mark the octaves of A.
function spectrogram(samples, sampleRate, { width = 900, height = 360, size = 4096 } = {}) {
  const hop = Math.max(64, Math.floor((samples.length - size) / width)),
    window = Float64Array.from({ length: size }, (_, i) => 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (size - 1))),
    low = 55,
    high = 7040,
    png = new PNG({ width, height });
  const frame = new Float64Array(size);
  for (let x = 0; x < width; x++) {
    const start = x * hop;
    for (let i = 0; i < size; i++) frame[i] = (samples[start + i] || 0) * window[i];
    const bins = magnitudes(frame);
    for (let y = 0; y < height; y++) {
      const hz = low * (high / low) ** (1 - y / (height - 1)),
        bin = (hz * size) / sampleRate,
        i = Math.min(bins.length - 2, Math.floor(bin)),
        value = bins[i] + (bins[i + 1] - bins[i]) * (bin - i),
        level = Math.max(0, Math.min(1, (20 * Math.log10(value + 1e-9) + 78) / 72)),
        o = (y * width + x) * 4;
      // Black through deep blue and orange to pale yellow.
      png.data[o] = Math.round(255 * Math.min(1, level * 1.6));
      png.data[o + 1] = Math.round(255 * Math.max(0, level * 1.5 - 0.45));
      png.data[o + 2] = Math.round(255 * (level < 0.4 ? level * 1.4 : Math.max(0, 0.56 - (level - 0.4)) + Math.max(0, level - 0.8) * 3));
      png.data[o + 3] = 255;
    }
  }
  for (let hz = 110; hz < high; hz *= 2) {
    const y = Math.round((1 - Math.log(hz / low) / Math.log(high / low)) * (height - 1));
    for (let x = 0; x < width; x += 3) {
      const o = (y * width + x) * 4;
      png.data[o] = png.data[o + 1] = png.data[o + 2] = Math.max(png.data[o], 70);
    }
  }
  return PNG.sync.write(png);
}

function measure(channels, sampleRate, expectedHz) {
  const mono = Float32Array.from(channels[0], (v, i) => (v + channels[1][i]) / 2);
  let peak = 0,
    square = 0,
    sum = 0;
  for (const channel of channels)
    for (const v of channel) {
      peak = Math.max(peak, Math.abs(v));
      square += v * v;
      sum += v;
    }
  const count = channels.length * mono.length,
    db = (value) => +(20 * Math.log10(Math.max(value, 1e-9))).toFixed(1);
  // The loudest tenth of a second, and when the sound last exceeds a thousandth of its peak.
  const block = Math.floor(sampleRate / 10);
  let loudest = 0,
    lastAudible = 0;
  for (let start = 0; start + block <= mono.length; start += block) {
    let s = 0;
    for (let i = start; i < start + block; i++) s += mono[i] * mono[i];
    loudest = Math.max(loudest, Math.sqrt(s / block));
  }
  for (let i = mono.length - 1; i >= 0; i--)
    if (Math.abs(mono[i]) > peak * 0.001) {
      lastAudible = i / sampleRate;
      break;
    }
  // The strongest pitch in the first 0.4 s after the loudest block, from a long transform.
  const size = 16384,
    frame = new Float64Array(size);
  for (let i = 0; i < size; i++) frame[i] = (mono[i] || 0) * (0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (size - 1)));
  const bins = magnitudes(frame);
  let best = 1;
  for (let i = Math.ceil((60 * size) / sampleRate); i < bins.length; i++) if (bins[i] > bins[best]) best = i;
  // Parabolic refinement of the peak bin.
  const [a, b, c] = [bins[best - 1] || 0, bins[best], bins[best + 1] || 0],
    shift = a - 2 * b + c ? (0.5 * (a - c)) / (a - 2 * b + c) : 0,
    strongestHz = ((best + shift) * sampleRate) / size;
  return {
    peakDb: db(peak),
    rmsDb: db(Math.sqrt(square / count)),
    loudestTenthDb: db(loudest),
    dc: +(sum / count).toFixed(6),
    seconds: +(mono.length / sampleRate).toFixed(2),
    audibleFor: +lastAudible.toFixed(2),
    strongestHz: +strongestHz.toFixed(1),
    expectedHz: expectedHz ? +expectedHz.toFixed(1) : null,
    cents: expectedHz ? Math.round(1200 * Math.log2(strongestHz / expectedHz)) : null,
  };
}

(async () => {
  fs.mkdirSync(outDir, { recursive: true });
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.route("http://sound.test/**", async (route) => {
      const url = new URL(route.request().url());
      if (url.pathname === "/") return route.fulfill({ status: 200, contentType: types[".html"], body: "<!doctype html><title>sound</title>" });
      const file = path.join(root, decodeURIComponent(url.pathname));
      if (!file.startsWith(root) || !fs.existsSync(file)) return route.fulfill({ status: 404, body: "" });
      return route.fulfill({ status: 200, contentType: types[path.extname(file)] || "application/octet-stream", body: fs.readFileSync(file) });
    });
    await page.goto("http://sound.test/");
    const plan = await page.evaluate(async (bedSeconds) => {
      const score = await import("/assets/js/sound/score.mjs");
      const items = [];
      const variants = {
        tap: [{}],
        point: [{ index: 0 }, { index: 4 }],
        switch: [{ on: true }, { on: false }],
        open: [{}],
        close: [{}],
        arrive: [{ index: 0 }, { index: 3 }],
        hour: [{}],
        land: [{ force: 0.2 }, { force: 1 }],
      };
      for (const mode of score.MODES) {
        for (const [event, details] of Object.entries(variants))
          for (const detail of details) {
            const suffix = Object.entries(detail)
              .map(([key, value]) => `${key}${value === true ? "-on" : value === false ? "-off" : `-${value}`}`)
              .join("");
            const notes = score.play(event, mode, detail);
            items.push({ name: `${mode}-${event}${suffix ? `-${suffix}` : ""}`, mode, event, notes, expectedHz: score.midiToHz(notes[0].midi) });
          }
        items.push({ name: `${mode}-bed`, mode, event: "bed", notes: score.bedNotes(mode, 0, bedSeconds), seconds: bedSeconds, expectedHz: null });
      }
      // A day on the site in a minute and a half: each hour's bed with a visitor's gestures over it, so
      // one file says how the hours differ and how the interface sits in each key.
      const span = 22,
        day = [];
      score.MODES.forEach((mode, hour) => {
        const add = (at, notes) => {
          for (const note of notes) day.push({ ...note, at: note.at + hour * span + at });
        };
        add(0, score.bedNotes(mode, 0, span - 5));
        add(1.5, score.play("hour", mode));
        for (let index = 0; index < 5; index++) add(6 + index * 0.2, score.play("point", mode, { index }));
        add(9, score.play("tap", mode));
        add(9.15, score.play("open", mode));
        add(12.5, score.play("switch", mode, { on: true }));
        add(15, score.play("arrive", mode, { index: 1 }));
        add(16.4, score.play("arrive", mode, { index: 2 }));
        add(18.5, score.play("close", mode));
        add(20, score.play("land", mode, { force: 0.6 }));
      });
      items.push({ name: "day", mode: "day", event: "day", notes: day, seconds: score.MODES.length * span + 6, expectedHz: null });
      return items;
    }, bedSeconds);
    const only = option.only ? String(option.only).split(",") : null,
      modes = option.modes ? String(option.modes).split(",") : null;
    const report = [];
    for (const item of plan) {
      if (modes && !modes.includes(item.mode)) continue;
      if (only && !only.some((name) => item.name.includes(name))) continue;
      const rendered = await page.evaluate(async ({ notes, seconds }) => {
        const { render } = await import("/assets/js/sound/engine.mjs");
        const { sampleRate, channels } = await render(notes, { seconds });
        const pack = (data) => {
          const bytes = new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
          let text = "";
          for (let i = 0; i < bytes.length; i += 0x8000) text += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
          return btoa(text);
        };
        return { sampleRate, channels: channels.map(pack) };
      }, item);
      const channels = rendered.channels.map((text) => {
        const bytes = Buffer.from(text, "base64");
        return new Float32Array(bytes.buffer, bytes.byteOffset, bytes.byteLength / 4);
      });
      fs.writeFileSync(path.join(outDir, `${item.name}.wav`), wav(channels, rendered.sampleRate));
      const mono = Float32Array.from(channels[0], (v, i) => (v + channels[1][i]) / 2);
      fs.writeFileSync(path.join(outDir, `${item.name}.png`), spectrogram(mono, rendered.sampleRate));
      report.push({ name: item.name, notes: item.notes.length, ...measure(channels, rendered.sampleRate, item.expectedHz) });
    }
    fs.writeFileSync(
      path.join(outDir, "report.json"),
      `${JSON.stringify({ rendered: new Date().toISOString(), errors, sounds: report }, null, 2)}\n`
    );
    for (const row of report)
      console.log(
        `${row.name.padEnd(28)} peak ${String(row.peakDb).padStart(6)} dB  rms ${String(row.rmsDb).padStart(6)} dB  ${String(row.audibleFor).padStart(5)} s  ${
          row.expectedHz ? `${row.strongestHz} Hz (${row.cents >= 0 ? "+" : ""}${row.cents} cents)` : `${row.strongestHz} Hz`
        }`
      );
    if (errors.length) {
      console.error(errors.join("\n"));
      process.exitCode = 1;
    }
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
