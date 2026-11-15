import test from "node:test";
import assert from "node:assert/strict";
import { EVENTS, HOURS, MODES, VOICES, bedLoops, bedNotes, hourOf, midiToHz, pitchClasses, play, step } from "../assets/js/sound/score.mjs";

const details = [{}, { index: 0 }, { index: 3 }, { index: 7 }, { index: -2 }, { on: true }, { on: false }, { force: 0 }, { force: 1 }];

test("the ladder climbs the hour's five notes, octave over octave", () => {
  assert.ok(Math.abs(midiToHz(69) - 440) < 1e-9 && Math.abs(midiToHz(57) - 220) < 1e-9);
  for (const mode of MODES) {
    const { root } = hourOf(mode);
    assert.equal(step(mode, 0), root);
    assert.equal(step(mode, 5), root + 12);
    assert.equal(step(mode, -5), root - 12);
    for (let i = -12; i < 12; i++) {
      assert.ok(step(mode, i + 1) > step(mode, i), `${mode} step ${i}`);
      assert.ok(pitchClasses(mode).includes(((step(mode, i) % 12) + 12) % 12));
    }
  }
  assert.deepEqual(hourOf("midnight"), HOURS.noon, "an unknown mode plays noon's key");
});

test("the day turns one note at a time", () => {
  const shared = (a, b) => pitchClasses(a).filter((pitch) => pitchClasses(b).includes(pitch)).length;
  assert.equal(shared("morning", "noon"), 4);
  assert.equal(shared("noon", "afternoon"), 5, "the afternoon is noon's five notes from another root");
  assert.notEqual(hourOf("noon").root % 12, hourOf("afternoon").root % 12);
  assert.equal(shared("afternoon", "evening"), 4);
  // The evening is the lowest and the slowest; noon the highest and the quickest.
  for (const mode of MODES) {
    assert.ok(hourOf("evening").root <= hourOf(mode).root && hourOf("evening").beat >= hourOf(mode).beat);
    assert.ok(hourOf("noon").root >= hourOf(mode).root && hourOf("noon").beat <= hourOf(mode).beat);
  }
});

test("every interface note belongs to the hour's key, in a register small speakers carry", () => {
  for (const mode of MODES)
    for (const [name, make] of Object.entries(EVENTS))
      for (const detail of details) {
        const notes = make(mode, detail);
        assert.ok(notes.length >= 1 && notes.length <= 4, `${name}: a gesture, not a tune`);
        for (const { at, midi, length, level, voice } of notes) {
          assert.ok(pitchClasses(mode).includes(((midi % 12) + 12) % 12), `${mode} ${name} plays ${midi}`);
          assert.ok(VOICES.includes(voice));
          assert.ok(at >= 0 && at < 0.6 && length > 0 && length <= 2.5);
          assert.ok(level > 0 && level <= 0.6, `${name} level ${level}`);
          const hz = midiToHz(midi);
          // A knock may sit low; everything pitched stays between about 190 Hz and 1.4 kHz.
          if (voice !== "wood") assert.ok(hz > 190 && hz < 1400, `${mode} ${name}: ${hz.toFixed(0)} Hz`);
        }
      }
  assert.deepEqual(play("no such event", "noon"), []);
});

test("gestures sound like what they do", () => {
  for (const mode of MODES) {
    // A row of links reads left to right as a rising scale.
    const row = [0, 1, 2, 3, 4].map((index) => play("point", mode, { index })[0].midi);
    for (let i = 1; i < row.length; i++) assert.ok(row[i] > row[i - 1]);
    // On rises, off falls, over the same two notes.
    const on = play("switch", mode, { on: true }).map((n) => n.midi),
      off = play("switch", mode, { on: false }).map((n) => n.midi);
    assert.ok(on[1] > on[0] && off[1] < off[0]);
    assert.deepEqual([...on].sort(), [...off].sort());
    // Opening climbs and is over before the card has settled; closing falls.
    const open = play("open", mode),
      close = play("close", mode);
    assert.ok(open.every((n, i) => i === 0 || (n.midi > open[i - 1].midi && n.at > open[i - 1].at)));
    assert.ok(open.at(-1).at <= 0.3);
    assert.ok(close[1].midi < close[0].midi);
    // A harder landing knocks louder, on the same note.
    const soft = play("land", mode, { force: 0 })[0],
      hard = play("land", mode, { force: 1 })[0];
    assert.ok(hard.level > soft.level && hard.midi === soft.midi);
    // Sections further down the page arrive higher.
    assert.ok(play("arrive", mode, { index: 3 })[0].midi > play("arrive", mode, { index: 0 })[0].midi);
  }
});

test("the bed keeps to the key, never piles up, never goes quiet for long, and does not repeat", () => {
  for (const mode of MODES) {
    const { beat } = hourOf(mode),
      minutes = 30,
      notes = bedNotes(mode, 0, minutes * 60);
    assert.deepEqual(bedNotes(mode, 0, minutes * 60), notes, "the same hour plays the same bed");
    for (const { midi, level, voice, length } of notes) {
      assert.ok(pitchClasses(mode).includes(midi % 12));
      assert.equal(voice, "pad");
      assert.ok(level <= 0.12 && length >= 4 * beat);
      const hz = midiToHz(midi);
      assert.ok(hz > 95 && hz < 900, `${mode} bed at ${hz.toFixed(0)} Hz`);
    }
    // Sounding voices, second by second, once the bed has begun.
    let most = 0,
      quiet = 0,
      longestQuiet = 0;
    for (let t = 12 * beat; t < minutes * 60; t++) {
      const sounding = notes.filter((n) => n.at <= t && t < n.at + n.length).length;
      most = Math.max(most, sounding);
      quiet = sounding ? 0 : quiet + 1;
      longestQuiet = Math.max(longestQuiet, quiet);
    }
    assert.ok(most <= 5, `${mode}: ${most} voices at once`);
    // The pads' tails and the room carry these rests; twelve beats is the longest breath.
    assert.ok(longestQuiet <= 12 * beat, `${mode}: ${longestQuiet} s of silence`);
    // A window's notes come back in two pieces: the same split as asking for the whole.
    assert.deepEqual([...bedNotes(mode, 0, 200), ...bedNotes(mode, 200, 400)], bedNotes(mode, 0, 400));
    // No minute repeats another: the loops share no common measure.
    const minute = (m) =>
      bedNotes(mode, m * 60, (m + 1) * 60)
        .map((n) => `${n.midi}@${(n.at - m * 60).toFixed(1)}`)
        .join(" ");
    const seen = new Set();
    for (let m = 1; m < minutes; m++) {
      assert.ok(!seen.has(minute(m)), `${mode}: minute ${m} repeats`);
      seen.add(minute(m));
    }
  }
  // Each loop sounds for less than its period, and no two loops share a period.
  const periods = bedLoops().map((loop) => loop.every);
  assert.equal(new Set(periods).size, periods.length);
  for (const loop of bedLoops()) assert.ok(loop.hold < loop.every);
});
