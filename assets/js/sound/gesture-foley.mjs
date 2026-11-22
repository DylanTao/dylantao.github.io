// A lens on a wooden rail, and a soft body against paper or glass. Resonances
// are frequencies in Hz and decay times in seconds. Render each short contact
// once per context; movement reuses one band-limited friction voice.
const materials = {
  latch: {
    modes: [
      [610, 0.62, 0.025],
      [1230, 0.22, 0.018],
      [1790, 0.08, 0.013],
    ],
    grain: 0.17,
    attack: 0.002,
  },
  detent: {
    modes: [
      [830, 0.55, 0.054],
      [2080, 0.21, 0.024],
      [350, 0.2, 0.035],
    ],
    grain: 0.12,
    attack: 0.003,
  },
  pet: {
    modes: [
      [255, 0.53, 0.057],
      [393, 0.29, 0.039],
      [626, 0.12, 0.032],
    ],
    grain: 0.09,
    attack: 0.011,
  },
  soft: {
    modes: [
      [153, 0.64, 0.048],
      [346, 0.27, 0.034],
    ],
    grain: 0.2,
    attack: 0.006,
  },
  hard: {
    modes: [
      [210, 0.48, 0.054],
      [529, 0.35, 0.036],
      [1030, 0.1, 0.019],
    ],
    grain: 0.14,
    attack: 0.004,
  },
};

const unit = (n) => Math.max(0, Math.min(1, n));

export function createGestureFoley({ context, dry }) {
  const samples = new Map(),
    active = new Set(),
    history = new Map(),
    counts = {};
  let friction = null,
    grain = null,
    variation = 0;

  function makeBuffer(seconds, waveform) {
    const rate = context.sampleRate,
      buffer = context.createBuffer(1, Math.ceil(rate * seconds), rate);
    const data = buffer.getChannelData(0);
    let seed = 0x713a91,
      previous = 0;
    for (let i = 0; i < data.length; i++) {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      previous += 0.28 * (seed / 2147483648 - 1 - previous);
      data[i] = waveform(i / rate, previous);
    }
    return buffer;
  }

  function sample(key) {
    if (samples.has(key)) return samples.get(key);
    const material = materials[key];
    const buffer = makeBuffer(0.35, (t, noise) => {
      const onset = 1 - Math.exp(-t / material.attack);
      let value = noise * material.grain * Math.exp(-t / 0.021);
      for (const [frequency, weight, decay] of material.modes) value += weight * Math.sin(2 * Math.PI * frequency * t) * Math.exp(-t / decay);
      return value * onset;
    });
    samples.set(key, buffer);
    return buffer;
  }

  function voice(buffer, pan) {
    const source = context.createBufferSource(),
      gain = context.createGain();
    const place = context.createStereoPanner?.();
    source.buffer = buffer;
    if (place) {
      place.pan.value = Math.max(-0.55, Math.min(0.55, pan));
      gain.connect(place).connect(dry);
    } else gain.connect(dry);
    const nodes = [source, gain];
    if (place) nodes.push(place);
    const v = { source, gain, nodes };
    active.add(v);
    source.onended = () => {
      if (friction === v) friction = null;
      active.delete(v);
      nodes.forEach((n) => n.disconnect());
    };
    return v;
  }

  function noise() {
    return (grain ??= makeBuffer(0.53, (t, n) => n * (0.78 + 0.22 * Math.sin(2 * Math.PI * 47 * t))));
  }

  function stopRubbing() {
    if (!friction) return;
    const { gain, source } = friction,
      now = context.currentTime;
    gain.gain.cancelScheduledValues(now);
    gain.gain.setTargetAtTime(0.00001, now, 0.012);
    source.stop(now + 0.065);
    friction = null;
  }

  function rub(kind, strength, pan) {
    const now = context.currentTime;
    if (!friction || friction.kind !== kind) {
      stopRubbing();
      if (active.size >= 6) return;
      friction = voice(noise(), pan);
      const filter = context.createBiquadFilter();
      filter.type = "bandpass";
      filter.Q.value = kind === "rail" ? 1.4 : 0.68;
      friction.source.connect(filter).connect(friction.gain);
      friction.nodes.push(filter);
      friction.kind = kind;
      friction.filter = filter;
      friction.source.loop = true;
      friction.gain.gain.value = 0.00001;
      friction.source.start(now);
    }
    const { source, gain, filter } = friction;
    filter.frequency.setTargetAtTime((kind === "rail" ? 730 : 400) + 950 * strength, now, 0.03);
    source.playbackRate.setTargetAtTime(0.78 + strength * 0.52, now, 0.025);
    gain.gain.cancelScheduledValues(now);
    gain.gain.setTargetAtTime(0.018 + strength * 0.12, now, 0.014);
    gain.gain.setTargetAtTime(0.00001, now + 0.043, 0.023);
    // Replacing a scheduled stop extends the same voice only while the hand moves.
    source.stop(now + 0.18);
  }

  function play(kind, strength = 0.5, position = 0, material = "soft") {
    if (kind === "rest") return stopRubbing();
    if (context.state !== "running" || !Number.isFinite(strength)) return;
    const now = context.currentTime,
      force = unit(strength);
    const interval = kind === "rail" || kind === "drag" ? 0.024 : kind === "land" ? 0.11 : 0.045;
    if (now - (history.get(kind) ?? -Infinity) < interval) return;
    history.set(kind, now);
    if (kind === "rail" || kind === "drag") {
      if (force > 0.012) rub(kind, force, position);
    } else if (kind === "throw") {
      stopRubbing();
      if (force < 0.14 || active.size >= 6) return;
      const { source, gain, nodes } = voice(noise(), position);
      const band = context.createBiquadFilter(),
        seconds = 0.09 + force * 0.13;
      nodes.push(band);
      band.type = "bandpass";
      band.Q.value = 0.85;
      band.frequency.setValueAtTime(520 + 730 * force, now);
      band.frequency.exponentialRampToValueAtTime(310, now + seconds);
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(0.08 + 0.25 * force, now + 0.023);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + seconds);
      source.connect(band).connect(gain);
      source.start(now);
      source.stop(now + seconds);
    } else {
      const key = kind === "land" ? (material === "hard" ? "hard" : "soft") : kind;
      if (!Object.hasOwn(materials, key) || active.size >= 6) return;
      const { source, gain } = voice(sample(key), position);
      variation = (variation + 1) % 3;
      source.playbackRate.value = [0.966, 1.016, 0.992][variation] * (kind === "detent" ? 1 + 0.21 * force : 1);
      gain.gain.value = kind === "land" ? 0.11 + force * 0.52 : kind === "pet" ? 0.27 : 0.245;
      source.connect(gain);
      source.start(now);
    }
    counts[kind] = (counts[kind] || 0) + 1;
  }

  function quiet() {
    friction = null;
    for (const { source, gain } of active) {
      gain.gain.cancelScheduledValues(context.currentTime);
      gain.gain.value = 0;
      source.stop();
    }
    history.clear();
  }
  return { play, quiet, evidence: () => ({ cues: { ...counts }, active: active.size }) };
}
