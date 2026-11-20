import { CONTACT_CLIPS } from "./foley-clips.mjs";

const SAMPLE = new URL("../../audio/coastal-foley/contacts.wav", import.meta.url);
const MIX = {
  stone: [0.18, 0.18],
  oak: [0.19, 0.18],
  sand: [0.2, 0.18],
  grass: [0.17, 0.18],
  foliage: [0.135, 0.44],
  wade: [0.18, 0.3],
  swim: [0.16, 0.32],
  splash: [0.23, 0.26],
  rower: [0.14, 0.4],
  bike: [0.12, 0.2],
  bagwork: [0.2, 0.25],
  "double-end": [0.18, 0.24],
  "speed-bag": [0.16, 0.23],
};

const MAX_VOICES = 4;

export function createFoley(graph, load = () => fetch(SAMPLE).then((response) => (response.ok ? response.arrayBuffer() : null))) {
  const { context, dry } = graph;
  const voices = new Set();
  const last = new Map();
  const played = Object.create(null);
  let loading = null,
    buffer = null,
    total = 0,
    globalTime = -Infinity;

  function prepare() {
    return (loading ||= Promise.resolve()
      .then(load)
      .then((data) => (data ? context.decodeAudioData(data) : null))
      .then((audio) => (buffer = audio))
      .catch(() => null));
  }

  function play(name, strength) {
    if (!Object.hasOwn(MIX, name) || !Number.isFinite(strength) || strength <= 0) return 0;
    if (!buffer) {
      prepare();
      return 0;
    }
    if (context.state !== "running" || voices.size >= MAX_VOICES) return 0;
    const now = context.currentTime;
    const [level, interval] = MIX[name];
    if (now - globalTime < 0.068 || now - (last.get(name) ?? -Infinity) < interval) return 0;
    const variants = CONTACT_CLIPS[name];
    const [offset, duration] = variants[(played[name] || 0) % variants.length];
    const source = context.createBufferSource();
    const gain = context.createGain();
    source.buffer = buffer;
    gain.gain.value = level * (0.32 + 0.68 * Math.min(1, strength));
    source.connect(gain).connect(dry);
    const voice = { source, gain };
    source.onended = () => {
      voices.delete(voice);
      source.disconnect();
      gain.disconnect();
    };
    voices.add(voice);
    source.start(now, offset, duration);
    globalTime = now;
    last.set(name, now);
    played[name] = (played[name] || 0) + 1;
    total++;
    return 1;
  }

  function quiet() {
    for (const { source, gain } of voices) {
      gain.gain.value = 0;
      source.stop();
    }
    voices.clear();
    last.clear();
    globalTime = -Infinity;
  }

  return { prepare, play, quiet, evidence: () => ({ loaded: Boolean(buffer), played: total, active: voices.size, cues: { ...played } }) };
}
