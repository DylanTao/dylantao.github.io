// The site's sound, played. score.mjs says which notes; this turns them into oscillators.
//
// Nothing here runs until a visitor asks for sound: createSound() makes no audio context, and start()
// makes one inside the gesture that asked. Notes are synthesized and scene Foley uses a short recording. Both go
// through one limiter, and stops when the tab is hidden. The voices take any BaseAudioContext, so the
// same code renders offline for the level checks (render()) and for looking at a spectrogram.
import { bedNotes, midiToHz, play as scoreOf } from "./score.mjs";
import { createFoley } from "./foley.mjs";

// The master chain's numbers. `gain` puts a switch's peak near -16 dBFS, a pointed-at link near -25
// and the bed's average near -38; the limiter's threshold is where a pile of gestures stops getting
// louder.
export const MASTER = Object.freeze({ gain: 0.3, threshold: -16, knee: 8, ratio: 12, attack: 0.004, release: 0.22 });
// The room every voice is sent to: seconds of tail, and how much of each voice goes there.
export const ROOM = Object.freeze({ seconds: 2.6, send: Object.freeze({ pluck: 0.22, glass: 0.3, wood: 0.1, pad: 0.45 }) });

// A small deterministic noise source (mulberry32), so the room and the knocks render the same twice.
function noise(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 2147483648 - 1;
  };
}

// The room: noise that dies away exponentially and darkens as it goes, the classic cheap impulse.
function roomImpulse(context) {
  const rate = context.sampleRate,
    length = Math.floor(rate * ROOM.seconds),
    buffer = context.createBuffer(2, length, rate);
  for (let channel = 0; channel < 2; channel++) {
    const data = buffer.getChannelData(channel),
      random = noise(0x5eed + channel * 977);
    let smooth = 0;
    for (let i = 0; i < length; i++) {
      const t = i / length,
        // One-pole lowpass whose corner falls as the tail decays.
        k = 0.55 - 0.45 * t;
      smooth += k * (random() - smooth);
      data[i] = smooth * Math.exp(-6.2 * t) * (i < 64 ? i / 64 : 1);
    }
  }
  return buffer;
}

function clickBuffer(context) {
  const length = Math.floor(context.sampleRate * 0.03),
    buffer = context.createBuffer(1, length, context.sampleRate),
    data = buffer.getChannelData(0),
    random = noise(0xc11c);
  for (let i = 0; i < length; i++) data[i] = random() * Math.exp((-7 * i) / length);
  return buffer;
}

// voices -> dry -> limiter -> master -> out, and voices -> send -> room -> limiter.
export function buildGraph(context, destination = context.destination) {
  const limiter = context.createDynamicsCompressor();
  limiter.threshold.value = MASTER.threshold;
  limiter.knee.value = MASTER.knee;
  limiter.ratio.value = MASTER.ratio;
  limiter.attack.value = MASTER.attack;
  limiter.release.value = MASTER.release;
  const master = context.createGain();
  master.gain.value = MASTER.gain;
  limiter.connect(master).connect(destination);
  const dry = context.createGain(),
    room = context.createConvolver(),
    wet = context.createGain();
  room.buffer = roomImpulse(context);
  wet.gain.value = 0.9;
  dry.connect(limiter);
  room.connect(wet).connect(limiter);
  return { context, dry, room, master, click: clickBuffer(context) };
}

// An envelope that rises in `attack` seconds and dies away exponentially by `end`.
function strike(param, at, level, attack, end) {
  param.setValueAtTime(0.0001, at);
  param.exponentialRampToValueAtTime(Math.max(level, 0.0002), at + attack);
  param.exponentialRampToValueAtTime(0.0001, end);
}

// A voice's way out: placed between the speakers (`pan`, -1 left to 1 right), dry and to the room.
function output(graph, voice, pan = 0) {
  const { context } = graph,
    out = context.createGain(),
    send = context.createGain();
  send.gain.value = ROOM.send[voice] ?? 0.2;
  let placed = out;
  if (pan && context.createStereoPanner) {
    placed = context.createStereoPanner();
    placed.pan.value = Math.max(-1, Math.min(1, pan));
    out.connect(placed);
  }
  placed.connect(graph.dry);
  placed.connect(send).connect(graph.room);
  return { out };
}

const VOICE = {
  // A short string: a triangle with its octave, through a filter that closes as it rings.
  pluck(graph, { hz, at, length, level, pan }) {
    const { context } = graph,
      end = at + length,
      { out } = output(graph, "pluck", pan),
      envelope = context.createGain(),
      filter = context.createBiquadFilter();
    filter.type = "lowpass";
    filter.Q.value = 0.7;
    filter.frequency.setValueAtTime(Math.min(hz * 7, 9000), at);
    filter.frequency.exponentialRampToValueAtTime(Math.max(hz * 1.4, 200), at + Math.min(0.28, length));
    strike(envelope.gain, at, level, 0.004, end);
    filter.connect(envelope).connect(out);
    for (const [type, ratio, share] of [
      ["triangle", 1, 1],
      ["sine", 2, 0.28],
    ]) {
      const oscillator = context.createOscillator(),
        part = context.createGain();
      oscillator.type = type;
      oscillator.frequency.value = hz * ratio;
      part.gain.value = share;
      oscillator.connect(part).connect(filter);
      oscillator.start(at);
      oscillator.stop(end + 0.02);
    }
  },
  // A struck bar: a sine whose pitch is shaken by a faster sine for the first instant (the strike's
  // brightness), with one inharmonic overtone that dies sooner than the note.
  glass(graph, { hz, at, length, level, pan }) {
    const { context } = graph,
      end = at + length,
      { out } = output(graph, "glass", pan),
      envelope = context.createGain(),
      carrier = context.createOscillator(),
      shaker = context.createOscillator(),
      depth = context.createGain();
    carrier.type = "sine";
    carrier.frequency.value = hz;
    shaker.type = "sine";
    shaker.frequency.value = hz * 3.5;
    depth.gain.setValueAtTime(hz * 0.9, at);
    depth.gain.exponentialRampToValueAtTime(hz * 0.02, at + Math.min(0.35, length * 0.6));
    shaker.connect(depth).connect(carrier.frequency);
    strike(envelope.gain, at, level, 0.003, end);
    carrier.connect(envelope).connect(out);
    const overtone = context.createOscillator(),
      ring = context.createGain();
    overtone.type = "sine";
    overtone.frequency.value = hz * 2.76;
    strike(ring.gain, at, level * 0.22, 0.002, at + Math.min(length, 0.5));
    overtone.connect(ring).connect(out);
    for (const oscillator of [carrier, shaker, overtone]) {
      oscillator.start(at);
      oscillator.stop(end + 0.02);
    }
  },
  // A knock: a sine that drops onto its note in a few hundredths of a second, with a grain of noise.
  wood(graph, { hz, at, length, level, pan }) {
    const { context } = graph,
      end = at + Math.max(length, 0.05),
      { out } = output(graph, "wood", pan),
      envelope = context.createGain(),
      body = context.createOscillator();
    body.type = "sine";
    body.frequency.setValueAtTime(hz * 1.7, at);
    body.frequency.exponentialRampToValueAtTime(hz, at + 0.03);
    strike(envelope.gain, at, level, 0.002, end);
    body.connect(envelope).connect(out);
    body.start(at);
    body.stop(end + 0.02);
    const grain = context.createBufferSource(),
      band = context.createBiquadFilter(),
      amount = context.createGain();
    grain.buffer = graph.click;
    band.type = "bandpass";
    band.frequency.value = Math.min(hz * 3, 5000);
    band.Q.value = 1.2;
    amount.gain.value = level * 0.5;
    grain.connect(band).connect(amount).connect(out);
    grain.start(at);
  },
  // A slow breath: three triangles a few cents apart, unequal so their beating never cancels, with
  // a sine an octave down under the higher notes only (below about 150 Hz it would be rumble). The
  // note swells for a third of its length and leaves over the last half, and its filter opens and
  // closes with it.
  pad(graph, { hz, at, length, level, pan }) {
    const { context } = graph,
      end = at + length,
      { out } = output(graph, "pad", pan),
      envelope = context.createGain(),
      filter = context.createBiquadFilter(),
      closed = Math.min(Math.max(hz * 1.6, 320), 1100),
      open = Math.min(Math.max(hz * 3.2, 600), 2000);
    filter.type = "lowpass";
    filter.Q.value = 0.5;
    filter.frequency.setValueAtTime(closed, at);
    filter.frequency.linearRampToValueAtTime(open, at + length * 0.4);
    filter.frequency.linearRampToValueAtTime(closed, end);
    envelope.gain.setValueAtTime(0.0001, at);
    envelope.gain.linearRampToValueAtTime(level, at + length * 0.33);
    envelope.gain.setValueAtTime(level, at + length * 0.5);
    envelope.gain.linearRampToValueAtTime(0.0001, end);
    filter.connect(envelope).connect(out);
    const under = Math.min(1, Math.max(0, (hz - 150) / 150));
    for (const [type, ratio, cents, share] of [
      ["triangle", 1, 0, 0.5],
      ["triangle", 1, -6, 0.26],
      ["triangle", 1, 7, 0.26],
      ["sine", 0.5, 0, 0.3 * under],
    ]) {
      if (!share) continue;
      const oscillator = context.createOscillator(),
        part = context.createGain();
      oscillator.type = type;
      oscillator.frequency.value = hz * ratio;
      oscillator.detune.value = cents;
      part.gain.value = share;
      oscillator.connect(part).connect(filter);
      oscillator.start(at);
      oscillator.stop(end + 0.05);
    }
  },
};

// Schedule score notes on a graph, `start` seconds into its context's time.
export function schedule(graph, notes, start = graph.context.currentTime) {
  for (const { at, midi, length, level, voice, pan } of notes) VOICE[voice]?.(graph, { hz: midiToHz(midi), at: start + at, length, level, pan });
  return notes.length;
}

// Render to samples without a speaker, for measuring and for looking at. `notes` are score notes;
// returns { sampleRate, channels: [Float32Array, Float32Array] }.
export async function render(notes, { seconds, sampleRate = 44100, OfflineContext = globalThis.OfflineAudioContext } = {}) {
  const last = notes.reduce((end, n) => Math.max(end, n.at + n.length), 0),
    length = Math.ceil((seconds ?? last + ROOM.seconds) * sampleRate),
    context = new OfflineContext(2, length, sampleRate);
  schedule(buildGraph(context), notes, 0.02);
  const buffer = await context.startRendering();
  return { sampleRate, channels: [buffer.getChannelData(0), buffer.getChannelData(1)] };
}

// The page's instrument. `mode` returns the hour's theme mode when a note is asked for.
export function createSound({
  mode = () => "noon",
  audioContext = null,
  AudioContextClass = globalThis.AudioContext || globalThis.webkitAudioContext,
} = {}) {
  let graph = null,
    foley = null,
    on = false,
    volume = 1,
    bed = null,
    played = 0,
    intent = 0;
  // The bed is scheduled a few seconds ahead, on the context's own clock, so a suspended tab simply
  // stops where it is and carries on from there.
  function startBed() {
    if (bed || !graph) return;
    const origin = graph.context.currentTime + 0.3;
    bed = { origin, until: 0, timer: 0 };
    const fill = () => {
      if (!bed || !graph) return;
      const now = graph.context.currentTime - bed.origin,
        to = now + 4;
      if (to > bed.until) {
        played += schedule(graph, bedNotes(mode(), bed.until, to), bed.origin);
        bed.until = to;
      }
      bed.timer = setTimeout(fill, 1000);
    };
    fill();
  }
  function stopBed() {
    if (!bed) return;
    clearTimeout(bed.timer);
    bed = null;
  }
  return {
    get on() {
      return on;
    },
    get graph() {
      return graph;
    },
    setVolume(value) {
      volume = Math.min(1, Math.max(0, value));
      if (graph) graph.master.gain.setTargetAtTime(MASTER.gain * volume ** 1.5, graph.context.currentTime, 0.018);
    },
    // Call inside the click or key press that asked for sound: browsers allow audio only then.
    async start({ withBed = true } = {}) {
      const request = ++intent;
      if (!audioContext && !AudioContextClass) return false;
      if (!graph) {
        graph = buildGraph(audioContext ?? new AudioContextClass({ latencyHint: "interactive" }));
        graph.master.gain.value = MASTER.gain * volume ** 1.5;
      }
      if (graph.context.state !== "running") await graph.context.resume();
      if (request !== intent || graph.context.state !== "running") return false;
      on = true;
      if (withBed) startBed();
      return true;
    },
    // Off: the bed stops being written and what is sounding fades with the context suspended.
    async stop() {
      intent++;
      on = false;
      stopBed();
      foley?.quiet();
      if (graph && graph.context.state === "running") await graph.context.suspend();
    },
    // A hidden tab makes no sound; a shown one picks up where it stopped.
    async hidden(isHidden) {
      if (!graph || !on) return;
      if (isHidden) {
        foley?.quiet();
        await graph.context.suspend();
      } else await graph.context.resume();
    },
    setBed(enabled) {
      if (enabled && on) startBed();
      else stopBed();
    },
    // Play an interface event (score.mjs EVENTS) in the hour's key. Silent while off.
    play(event, detail) {
      if (!on || !graph || graph.context.state !== "running") return 0;
      const count = schedule(graph, scoreOf(event, mode(), detail));
      played += count;
      return count;
    },
    foley(name, strength) {
      if (name === "quiet") return foley?.quiet();
      if (!on || !graph || graph.context.state !== "running") return 0;
      foley ||= createFoley(graph);
      return name === "prepare" ? foley.prepare() : foley.play(name, strength);
    },
    evidence() {
      return { on, context: graph ? graph.context.state : null, bed: Boolean(bed), played, mode: mode(), foley: foley?.evidence() ?? null };
    },
  };
}
