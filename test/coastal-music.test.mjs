import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { COASTAL_LOOKS, createCoastalMusic, validateCoastalRecording } from "../assets/js/sound/coastal-music.mjs";
import { visitorRailShots } from "../assets/js/home-scene/visitor-rail-shots.mjs";
import { createListeningRecord, HOUSE_SIDE_SECONDS, listeningPerspective } from "../assets/js/home-scene/listening-record.mjs";
import { RECORD_RPM } from "../assets/js/home-scene/record-motion.mjs";

const source = new URL("../assets/audio/coastal-score/", import.meta.url);
const metadata = JSON.parse(readFileSync(new URL("score.json", source), "utf8"));
const next = () => new Promise((resolve) => setImmediate(resolve));

test("the recorded cuts follow the house edit and include a five-second rest for training", () => {
  const config = JSON.parse(readFileSync(new URL("../assets/models/home/manifest.json", import.meta.url), "utf8"));
  const { shots } = visitorRailShots(config);
  assert.equal(metadata.film.title, "The Door Is Open");
  assert.deepEqual(
    shots.map(({ id, duration }) => [id, duration]),
    Object.entries(metadata.film.cuts).map(([id, cut]) => [id, cut.seconds])
  );
  assert.deepEqual(metadata.film.cuts.training, { seconds: 5, scored: false });
  for (const [shot, cut] of Object.entries(metadata.film.cuts)) {
    if (cut.scored) assert.ok(readFileSync(new URL("film/" + shot + ".mp3", source)).length > 10000);
  }
});

function fixture({ delay } = {}) {
  const requested = [];
  const started = [];
  const ended = [];
  const automation = {};
  const parameter = (name) => ({
    cancelScheduledValues() {},
    setValueAtTime() {},
    linearRampToValueAtTime() {},
    setTargetAtTime(value) {
      automation[name] = value;
    },
  });
  let wallTime = 3000;
  const api = {
    currentTime: 1,
    state: "running",
    decodeAudioData(file) {
      if (file.startsWith("film/")) return { file, duration: metadata.film.cuts[file.slice(5, -4)].seconds };
      return { file, duration: file === "responses.mp3" ? 17.36 : metadata.themes[file.slice(0, -4)].seconds };
    },
    createGain() {
      return {
        gain: parameter("gain"),
        connect(bus) {
          return bus;
        },
        disconnect() {},
      };
    },
    createBiquadFilter() {
      return { Q: { value: 0 }, frequency: parameter("cutoff"), connect: (bus) => bus };
    },
    createStereoPanner() {
      return { pan: parameter("pan"), connect: (bus) => bus };
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
  return { music, requested, started, ended, automation, api, time: (n) => (wallTime = n) };
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

test("the film enters at the cut clock, leaves training to the rower and returns the visitor's own record", async () => {
  const { music, started, requested, api } = fixture();
  music.select("realistic");
  await next();
  api.currentTime = 4;
  let frame = { shot: "coast-dawn", shotSeconds: 1.25, playing: true };
  const clock = () => frame;
  music.playFilm(clock);
  await next();
  assert.deepEqual(started.at(-1).args.slice(1), [1.25, 10.75]);
  assert.equal(started.at(-1).file, "film/coast-dawn.mp3");
  frame.shotSeconds = 2;
  music.playFilm(clock);
  await next();
  assert.equal(started.length, 2, "a redraw preserves the performance");
  frame.shotSeconds = 8;
  music.playFilm(clock, true);
  await next();
  assert.deepEqual(started.at(-1).args.slice(1), [8, 4]);
  frame = { shot: "training", shotSeconds: 1.5, playing: true };
  music.playFilm(clock);
  await next();
  assert.equal(music.evidence().filmVoice, null);
  assert.ok(!requested.some(({ file }) => file === "film/training.mp3"));
  frame = null;
  music.select("realistic");
  await next();
  assert.equal(started.at(-1).file, "realistic.mp3");
  assert.equal(started.at(-1).args[1], 3, "leaving the film resumes the visitor's original theme");
});

test("a late film download uses the current shot time and an abandoned take stays silent", async () => {
  const waiters = new Map();
  const { music, started } = fixture({ delay: (file) => new Promise((resolve) => waiters.set(file, resolve)) });
  let frame = { shot: "coast-dawn", shotSeconds: 0.01, playing: true };
  const clock = () => frame;
  music.playFilm(clock);
  await next();
  frame.shotSeconds = 2.5;
  waiters.get("film/coast-dawn.mp3")();
  await next();
  assert.equal(started.at(-1).args[1], 2.5);
  frame = { shot: "arrival", shotSeconds: 0, playing: true };
  music.playFilm(clock);
  await next();
  music.pause({ hard: true });
  waiters.get("film/arrival.mp3")();
  await next();
  assert.equal(started.length, 1);
});

test("the cabinet's groove follows the stylus, holds through a lift, and runs out with the amplifier off", () => {
  const pressing = createListeningRecord();
  const speed = (RECORD_RPM * 2 * Math.PI) / 60;
  const pose = (time, phase = "tracking") => ({ angle: time * speed, phase, playing: true });
  assert.equal(metadata.themes.watercolour.seconds, HOUSE_SIDE_SECONDS);
  pressing.choose();
  pressing.advance(pose(1, "lowering"));
  assert.equal(pressing.tracking, false);
  pressing.advance(pose(2));
  pressing.advance(pose(5.5));
  assert.equal(pressing.seconds, 3.5);
  pressing.lift();
  pressing.advance(pose(7));
  pressing.choose();
  pressing.advance(pose(10));
  assert.equal(pressing.seconds, 3.5);
  assert.equal(pressing.advance(pose(12 + HOUSE_SIDE_SECONDS)), true);
  assert.equal(pressing.tracking, false);
  assert.equal(pressing.advance(pose(13 + HOUSE_SIDE_SECONDS)), false);
  pressing.choose();
  pressing.advance(pose(20 + HOUSE_SIDE_SECONDS));
  assert.equal(pressing.seconds, 0);
});

test("the horns stay on the correct side of the listener and soften beyond the stone doorway", () => {
  const bounds = { min: [-2, 0, -3], max: [2, 3, 3] };
  const sourceAt = (x, z) => ({ x, z, length: () => Math.hypot(x, z) });
  const inside = listeningPerspective({ x: 0, y: 1.6, z: 2 }, sourceAt(1, -2), bounds);
  const turned = listeningPerspective({ x: 0, y: 1.6, z: 2 }, sourceAt(-1, -2), bounds);
  const outside = listeningPerspective({ x: 0, y: 1.6, z: 5.5 }, sourceAt(1, -6), bounds);
  assert.ok(inside.pan > 0 && turned.pan === -inside.pan);
  assert.ok(outside.gain < inside.gain / 4 && outside.cutoff < inside.cutoff / 2);
  assert.equal(listeningPerspective({ x: 0, y: 1.6, z: 12 }, sourceAt(0, -12), bounds), null);
});

test("the needle takes the room, follows the listener without starting over and releases the visitor's theme", async () => {
  const { music, automation, started, api } = fixture();
  let pose = { seconds: 3, gain: 0.52, cutoff: 11000, pan: -0.34 },
    lifts = 0;
  const clock = () => pose;
  const lift = () => lifts++;
  music.select("realistic");
  await next();
  api.currentTime = 5;
  music.playRecord(clock, lift);
  await next();
  assert.equal(started.at(-1).file, "watercolour.mp3");
  assert.deepEqual(started.at(-1).args.slice(1), [3, HOUSE_SIDE_SECONDS - 3]);
  pose = { seconds: 4, gain: 0.18, cutoff: 5000, pan: 0.4 };
  music.playRecord(clock, lift);
  assert.deepEqual(automation, { gain: 0.18, cutoff: 5000, pan: 0.4 });
  assert.equal(started.length, 2);
  await music.motif("realistic", "select");
  assert.equal(started.length, 2);
  started.at(-1).voice.onended();
  assert.equal(lifts, 1);
  music.select("realistic");
  await next();
  assert.equal(started.at(-1).args[1], 4);
});

test("needle lift cancels an unheard download and lowering it again uses the new groove position", async () => {
  let release;
  const { music, started, requested } = fixture({
    delay: () =>
      new Promise((r) => {
        release = r;
      }),
  });
  let seconds = 0;
  const clock = () => ({ seconds, cutoff: 9000, pan: 0.2, gain: 0.4 });
  music.playRecord(clock, () => {});
  await next();
  music.pause({ hard: true });
  assert.equal(requested.at(-1).signal.aborted, true);
  release();
  await next();
  assert.deepEqual(started, []);
  music.playRecord(clock, () => {});
  await next();
  seconds = 7.2;
  release();
  await next();
  assert.equal(started.at(-1).args[1], 7.2);
});
