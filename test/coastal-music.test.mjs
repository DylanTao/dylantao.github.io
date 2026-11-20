import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { COASTAL_LOOKS, createCoastalMusic, validateCoastalRecording } from "../assets/js/sound/coastal-music.mjs";

const source = new URL("../assets/audio/coastal-score/", import.meta.url);
const metadata = JSON.parse(readFileSync(new URL("score.json", source), "utf8"));
const next = () => new Promise((resolve) => setImmediate(resolve));

function fixture({ delay } = {}) {
  const requested = [];
  const started = [];
  const ended = [];
  let wallTime = 3000;
  const api = {
    currentTime: 1,
    state: "running",
    decodeAudioData(file) {
      return { file, duration: file === "responses.mp3" ? 17.36 : metadata.themes[file.slice(0, -4)].seconds };
    },
    createGain() {
      return {
        gain: {
          cancelScheduledValues() {},
          setValueAtTime() {},
          linearRampToValueAtTime() {},
        },
        connect(bus) {
          return bus;
        },
        disconnect() {},
      };
    },
    createBufferSource() {
      return {
        connect(gain) {
          return gain;
        },
        disconnect() {},
        start(...args) {
          started.push({ file: this.buffer.file, args, voice: this });
        },
        stop(...args) {
          ended.push({ file: this.buffer.file, args });
        },
      };
    },
  };
  const music = createCoastalMusic(
    { context: api, dry: {} },
    {
      now: () => wallTime,
      load: async (file, signal) => {
        requested.push({ file, signal });
        if (file === "score.json") return metadata;
        if (delay) await delay(file);
        return file;
      },
    }
  );
  return { music, requested, started, ended, api, time: (n) => (wallTime = n) };
}

test("the five published recording names and all fifteen cue ranges match the authored score", () => {
  assert.equal(validateCoastalRecording(metadata), metadata);
  assert.deepEqual(new Set(Object.keys(metadata.themes)), new Set(COASTAL_LOOKS));
  const cueRanges = COASTAL_LOOKS.flatMap((look) =>
    Object.entries(metadata.cues[look]).map(([cue, range]) => ({ look, cue, start: range[0], end: range[0] + range[1] }))
  ).sort((a, b) => a.start - b.start);
  assert.equal(cueRanges.length, 15);
  assert.ok(cueRanges.every((item, i) => i === 0 || item.start > cueRanges[i - 1].end));
  for (const file of [...COASTAL_LOOKS, "responses"]) {
    const bytes = readFileSync(new URL(file + ".mp3", source));
    assert.ok(bytes.length > 20000, file + " has a nonempty recording");
    assert.ok(bytes.toString("ascii", 0, 3) === "ID3" || (bytes[0] === 255 && (bytes[1] & 224) === 224), file + " is an MP3");
  }
  const changed = structuredClone(metadata);
  changed.cues.realistic.select = [-0.2, 1];
  assert.equal(validateCoastalRecording(changed), null);
});

test("styles load only when selected and a fast look change leaves at most two weighted voices", async () => {
  const { music, requested, started, ended } = fixture();
  await next();
  assert.deepEqual(requested, []);
  await music.prepareMotifs();
  assert.deepEqual(
    requested.map((item) => item.file),
    ["score.json", "responses.mp3"]
  );
  music.select("realistic");
  music.select("realistic");
  await next();
  assert.deepEqual(
    started.map((item) => item.file),
    ["realistic.mp3"]
  );
  music.select("watercolour");
  await next();
  assert.deepEqual([music.evidence().theme, music.evidence().fading], ["watercolour", "realistic"]);
  music.select("paint");
  await next();
  assert.deepEqual([music.evidence().theme, music.evidence().fading], ["paint", "watercolour"]);
  assert.ok(
    ended.some((item) => item.file === "realistic.mp3" && item.args.length === 0),
    "a third choice releases the older tail immediately"
  );
  assert.ok(!requested.some((item) => /print\.mp3|toon\.mp3/.test(item.file)), "unchosen recordings remain lazy");
  music.clear({ hard: true });
  assert.deepEqual([music.evidence().theme, music.evidence().fading], [null, null]);
});

test("superseded fetches and muted decodes cannot play late or duplicate", async () => {
  const waiters = new Map();
  const { music, requested, started } = fixture({ delay: (file) => new Promise((resolve) => waiters.set(file, resolve)) });
  music.select("paint");
  await next();
  assert.equal(requested.filter(({ file }) => file === "paint.mp3").length, 1);
  music.select("realistic");
  music.select("realistic");
  await next();
  assert.equal(requested.find(({ file }) => file === "paint.mp3").signal.aborted, true);
  assert.equal(requested.filter(({ file }) => file === "realistic.mp3").length, 1);
  waiters.get("paint.mp3")();
  await next();
  assert.deepEqual(started, []);
  music.pause({ hard: true });
  assert.equal(requested.find(({ file }) => file === "realistic.mp3").signal.aborted, true);
  waiters.get("realistic.mp3")();
  await next();
  assert.deepEqual(started, []);
});

test("pausing retains one playhead, completion stays silent and a new selection honors the long repeat gap", async () => {
  const { music, started, api, time } = fixture();
  music.select("realistic");
  await next();
  api.currentTime = 3.25;
  music.pause({ hard: true });
  assert.equal(music.evidence().theme, null);
  music.select("realistic");
  await next();
  assert.equal(started[1].args[1], 2.25, "resume uses the one existing playhead");
  started[1].voice.onended();
  music.select("realistic");
  await next();
  assert.equal(started.length, 2);
  music.clear({ hard: true });
  time(45000);
  music.select("realistic");
  await next();
  assert.equal(started.length, 2);
  music.clear({ hard: true });
  time(99100);
  music.select("realistic");
  await next();
  assert.equal(started[2].args[1], 0, "a later intentional visit starts once from the beginning");
});

test("all motif choices use the authored offset and duration with a shared throttle", async () => {
  const { music, started, time } = fixture();
  await music.prepareMotifs();
  music.select("realistic");
  await next();
  let wall = 4500;
  for (const look of COASTAL_LOOKS) {
    for (const cue of ["select", "arrival", "threshold"]) {
      time((wall += 900));
      await music.motif(look, cue);
      assert.equal(started.at(-1).file, "responses.mp3");
      assert.deepEqual(started.at(-1).args.slice(1), metadata.cues[look][cue]);
      const before = started.length;
      await music.motif(look, cue);
      assert.equal(started.length, before);
    }
  }
  assert.deepEqual(music.evidence().cues, { select: 5, arrival: 5, threshold: 5 });
  music.clear({ hard: true });
  time(wall + 3000);
  await music.motif("paint", "arrival");
  assert.equal(music.evidence().cues.arrival, 5);
});
