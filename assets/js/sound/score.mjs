// The site's sound as numbers: which notes the hour allows and what each interface event plays.
// There is no audio here. engine.mjs turns these notes into oscillators; node tests read this file,
// and so can anything that wants to know what the page would play without making a sound.
//
// The idea (Sirui, November 14, 2026: "music to go along with my website's different theme ... really
// adaptive and customized, like click, scroll, and where there would be delightful interaction
// moment"): the hour already picks the page's palette, so it also picks a key. Every scale here is
// pentatonic, where any two notes sit well together, so an interface played by a visitor's pointer
// cannot clash with itself or with the bed under it.

const A4 = 440;
export const midiToHz = (midi) => A4 * 2 ** ((midi - 69) / 12);

const MAJOR = [0, 2, 4, 7, 9],
  MINOR = [0, 3, 5, 7, 10];

// One key per theme mode (assets/js/theme.js). The day turns one note at a time: D major and G major
// share four of their five notes, E minor is G major's own five heard from another root, and A minor
// shares four with it. Morning to noon rises a register; the evening is the lowest and slowest.
//   root   the scale's first note, as a MIDI number: step 0 of the hour's ladder;
//   beat   seconds per beat: how slowly the bed breathes and how tight an arpeggio is;
//   lift   scale steps added to interface notes, so they ring above the bed.
export const HOURS = Object.freeze({
  morning: Object.freeze({ name: "D major", root: 62, scale: MAJOR, beat: 0.9, lift: 3 }),
  noon: Object.freeze({ name: "G major", root: 67, scale: MAJOR, beat: 0.75, lift: 0 }),
  afternoon: Object.freeze({ name: "E minor", root: 64, scale: MINOR, beat: 0.85, lift: 0 }),
  evening: Object.freeze({ name: "A minor", root: 57, scale: MINOR, beat: 1.1, lift: 3 }),
});
export const MODES = Object.freeze(Object.keys(HOURS));
export const hourOf = (mode) => HOURS[mode] || HOURS.noon;

// The scale as a ladder: step 0 is the root, step 5 the root an octave up, step -1 the note below it.
export function step(mode, index) {
  const { root, scale } = hourOf(mode),
    whole = Math.round(index),
    octave = Math.floor(whole / scale.length);
  return root + 12 * octave + scale[whole - octave * scale.length];
}
// The hour's five notes, as pitch classes (0 is C).
export const pitchClasses = (mode) => {
  const { root, scale } = hourOf(mode);
  return scale.map((interval) => (root + interval) % 12).sort((a, b) => a - b);
};

// Voices the engine knows how to play.
//   pluck  a short string: bright at the start, gone in half a second;
//   glass  a struck bar with a bell's overtone and a long tail;
//   wood   a knock: more thump than pitch;
//   pad    a slow breath, for the bed.
export const VOICES = Object.freeze(["pluck", "glass", "wood", "pad"]);

// `pan` places a note between the speakers: -1 is the left, 1 the right.
const note = (at, midi, length, level, voice, pan = 0) => ({ at, midi, length, level, voice, pan });
const clamp = (value) => Math.min(1, Math.max(0, value));
function wrap(index, span) {
  const i = Math.round(index) % span;
  return i < 0 ? i + span : i;
}

// What each interface event plays, as notes: { at, midi, length, level, voice, pan }, with `at` in
// seconds from the event. Levels are before the engine's master gain; the bed sits near 0.05.
export const EVENTS = Object.freeze({
  // A press on a link or a button: a knock an octave above the interface's register. Barely a pitch.
  tap: (mode) => [note(0, step(mode, hourOf(mode).lift + 5), 0.06, 0.22, "wood")],
  // Pointing at the nth item of a row (the navigation's links, left to right): the nth step, placed
  // between the speakers where the item is in its row of `of`.
  point: (mode, { index = 0, of = 5 } = {}) => {
    const place = of > 1 ? (wrap(index, of) / (of - 1) - 0.5) * 0.9 : 0;
    return [note(0, step(mode, hourOf(mode).lift + wrap(index, 8)), 0.45, 0.2, "pluck", place)];
  },
  // A switch: up two steps when it goes on, the same pair downward when it goes off.
  switch: (mode, { on = true } = {}) => {
    const low = step(mode, hourOf(mode).lift + 2),
      high = step(mode, hourOf(mode).lift + 4);
    return [note(0, on ? low : high, 0.5, 0.26, "glass"), note(0.085, on ? high : low, 0.7, 0.3, "glass")];
  },
  // Something opening (a card, a panel): three rising plucks that finish inside the layout spring
  // (site-motion.mjs SPRINGS.layout, 0.46 s).
  open: (mode) => {
    const gap = Math.min(0.11, hourOf(mode).beat / 8);
    return [0, 2, 4].map((offset, i) => note(i * gap, step(mode, hourOf(mode).lift + offset), 0.5, 0.2 + 0.03 * i, "pluck"));
  },
  // Closing: the top two of those, falling.
  close: (mode) => {
    const gap = Math.min(0.1, hourOf(mode).beat / 8);
    return [4, 2].map((offset, i) => note(i * gap, step(mode, hourOf(mode).lift + offset), 0.4, 0.2 - 0.03 * i, "pluck"));
  },
  // A section arriving while the page scrolls: one soft bar, a step higher for each section down.
  arrive: (mode, { index = 0 } = {}) => [note(0, step(mode, wrap(index, 6)), 1.4, 0.16, "glass")],
  // The hour changing: the new key's root, third step, fifth step and octave, strummed upward.
  hour: (mode) => [0, 2, 4, 5].map((offset, i) => note(i * 0.14, step(mode, offset), 2.2, 0.2, "glass")),
  // Something thrown coming to rest: a knock, louder the harder it lands (0 to 1).
  land: (mode, { force = 0.5 } = {}) => [note(0, step(mode, 0) - 12, 0.12, 0.25 + 0.35 * clamp(force), "wood")],
});

export function play(event, mode, detail) {
  const make = EVENTS[event];
  return make ? make(mode, detail) : [];
}

// The bed: a handful of loops, each one note with its own period, the way Brian Eno built "Music for
// Airports" (1978) from tape loops of unequal length. The periods share no common measure, so the
// loops drift against each other and the same bar does not come round again, while every note stays
// inside the hour's five. Periods are in beats, so a slower hour breathes more slowly.
//   step    the note, on the hour's ladder (step());
//   every   beats between its soundings;
//   first   beats before its first sounding;
//   hold    beats it sounds for;
//   level   its loudness before the master gain;
//   pan     where it sits between the speakers.
const BED = Object.freeze([
  Object.freeze({ step: -5, every: 23, first: 0, hold: 10, level: 0.07, pan: 0 }),
  Object.freeze({ step: -1, every: 29.5, first: 6, hold: 9, level: 0.05, pan: -0.4 }),
  Object.freeze({ step: 0, every: 19.25, first: 11, hold: 8, level: 0.055, pan: 0.35 }),
  Object.freeze({ step: 2, every: 31.75, first: 17, hold: 7, level: 0.045, pan: -0.2 }),
  Object.freeze({ step: 4, every: 26.5, first: 3.5, hold: 7, level: 0.04, pan: 0.5 }),
  Object.freeze({ step: 6, every: 37.25, first: 21, hold: 6, level: 0.03, pan: -0.55 }),
]);
export const bedLoops = () => BED;

// The bed's notes that begin in [from, to) seconds of bed time, in the hour's key and tempo.
export function bedNotes(mode, from, to) {
  const { beat } = hourOf(mode),
    notes = [];
  for (const loop of BED) {
    const period = loop.every * beat,
      first = loop.first * beat;
    for (let n = Math.max(0, Math.ceil((from - first) / period)); first + n * period < to; n++)
      notes.push(note(first + n * period, step(mode, loop.step), loop.hold * beat, loop.level, "pad", loop.pan));
  }
  return notes.sort((a, b) => a.at - b.at);
}
