// Original house recordings. Audio stays on the site's existing dry bus.
export const COASTAL_LOOKS = Object.freeze(["realistic", "paint", "watercolour", "print", "toon"]);
const MOTIFS = ["select", "arrival", "threshold"];
const DIRECTORY = new URL("../../audio/coastal-score/", import.meta.url);
const MANIFEST = "score.json";
const RESPONSES = "responses.mp3";
const THEME_LEVEL = 0.46;
const MOTIF_LEVEL = 0.32;
const FADE = 0.72;
const REPEAT_GAP = 95000;
const MOTIF_GAP = 850;
const MOTIF_EXPIRY = 650;

export function validateCoastalRecording(data) {
  if (data?.version !== 1) return null;
  for (const look of COASTAL_LOOKS) {
    const theme = data.themes?.[look];
    if (!theme?.title || !Number.isFinite(theme.seconds) || theme.seconds < 2 || theme.seconds > 180) return null;
    for (const motif of MOTIFS) {
      const range = data.cues?.[look]?.[motif];
      if (!Array.isArray(range) || range.length !== 2 || !range.every(Number.isFinite) || range[0] < 0 || range[1] <= 0 || range[1] > 3) return null;
    }
  }
  return data;
}

async function loadAsset(file, signal) {
  const response = await fetch(new URL(file, DIRECTORY), { signal });
  if (!response.ok) return null;
  return file === MANIFEST ? response.json() : response.arrayBuffer();
}

const isTheme = (file) => file !== MANIFEST && file !== RESPONSES;
const clamp = (n) => Math.max(0, Math.min(1, n));
// Interpolate squared weight so two established tracks keep a steady combined level.
const weight = (a, b, u) => Math.sqrt((1 - u) * a * a + u * b * b);

export function createCoastalMusic({ context, dry }, { load = loadAsset, now = () => performance.now(), repeatGap = REPEAT_GAP } = {}) {
  const cache = new Map();
  const downloads = new Map();
  const lastPlayed = new Map();
  const motifTotals = {};
  let selection = null;
  let playing = false;
  let current = null;
  let tail = null;
  let motifVoice = null;
  let cueGeneration = 0;
  let lastMotif = -Infinity;

  function getAsset(file) {
    if (cache.has(file)) {
      const item = cache.get(file);
      cache.delete(file);
      cache.set(file, item);
      return Promise.resolve(item);
    }
    if (downloads.has(file)) return downloads.get(file).promise;
    const aborter = new AbortController();
    const job = {
      aborter,
      promise: Promise.resolve()
        .then(() => load(file, aborter.signal))
        .then((data) => {
          if (!data || aborter.signal.aborted) return null;
          return file === MANIFEST ? validateCoastalRecording(data) : context.decodeAudioData(data);
        })
        .then((data) => {
          if (!data || aborter.signal.aborted) return null;
          cache.set(file, data);
          const fullThemes = [...cache.keys()].filter(isTheme);
          if (fullThemes.length > 2) cache.delete(fullThemes[0]);
          return data;
        })
        .catch(() => null)
        .finally(() => {
          if (downloads.get(file) === job) downloads.delete(file);
        }),
    };
    downloads.set(file, job);
    return job.promise;
  }

  function cancelDownloads(keep) {
    for (const [file, job] of downloads) {
      if (keep(file)) continue;
      downloads.delete(file);
      job.aborter.abort();
    }
  }

  function disconnect(voice) {
    voice.source.onended = null;
    voice.source.disconnect();
    voice.node.disconnect();
  }

  function kill(voice) {
    if (!voice) return;
    voice.node.gain.cancelScheduledValues(context.currentTime);
    voice.node.gain.setValueAtTime(0, context.currentTime);
    voice.source.stop();
    disconnect(voice);
  }

  function fade(voice, to, seconds) {
    const at = context.currentTime;
    const { from, level, start, end } = voice.envelope;
    const prior = weight(from, level, end > start ? clamp((at - start) / (end - start)) : 1);
    const gain = voice.node.gain;
    gain.cancelScheduledValues(at);
    gain.setValueAtTime(prior, at);
    for (let i = 1; i <= 12; i++) {
      const u = i / 12;
      gain.linearRampToValueAtTime(weight(prior, to, u), at + seconds * u);
    }
    voice.envelope = { from: prior, level: to, start: at, end: at + seconds };
  }

  function createVoice(buffer, offset, level, length = null) {
    const source = context.createBufferSource();
    const node = context.createGain();
    const start = context.currentTime;
    source.buffer = buffer;
    node.gain.setValueAtTime(level, start);
    source.connect(node).connect(dry);
    if (length === null) source.start(start, offset);
    else source.start(start, offset, length);
    return { source, node, start, offset, envelope: { from: level, level, start, end: start } };
  }

  function retire(seconds) {
    kill(tail);
    tail = current;
    current = null;
    if (!tail) return;
    const previous = tail;
    fade(previous, 0, seconds);
    previous.source.onended = () => {
      if (tail === previous) tail = null;
      disconnect(previous);
    };
    previous.source.stop(context.currentTime + seconds + 0.01);
  }

  function attempt() {
    const target = selection;
    if (!target || !playing || context.state !== "running" || current?.session === target || target.request || target.ended || target.failed) return;
    if (!target.started && now() - (lastPlayed.get(target.look) ?? -Infinity) < repeatGap) {
      if (current) retire(FADE);
      return;
    }
    const token = {};
    target.request = token;
    getAsset(MANIFEST)
      .then((metadata) => (metadata && target.request === token && playing ? getAsset(target.look + ".mp3") : null))
      .then((buffer) => {
        if (target.request !== token || selection !== target) return;
        target.request = null;
        if (!playing || context.state !== "running") return;
        if (!buffer) {
          target.failed = true;
          if (current) retire(FADE);
          return;
        }
        if (target.offset >= buffer.duration - 0.04) {
          target.ended = true;
          return;
        }
        if (current) retire(FADE);
        const voice = createVoice(buffer, target.offset, 0);
        voice.session = target;
        current = voice;
        fade(voice, THEME_LEVEL, FADE);
        if (!target.started) lastPlayed.set(target.look, now());
        target.started = true;
        voice.source.onended = () => {
          if (current === voice) {
            target.ended = true;
            current = null;
          }
          disconnect(voice);
        };
      });
  }

  function pause({ hard = false } = {}) {
    playing = false;
    cueGeneration++;
    if (selection) selection.request = null;
    cancelDownloads((file) => !hard && !isTheme(file));
    if (current?.session === selection) selection.offset = current.offset + context.currentTime - current.start;
    if (hard || context.state !== "running") {
      kill(tail);
      kill(current);
      tail = current = null;
    } else if (current) retire(0.23);
    kill(motifVoice);
    motifVoice = null;
  }

  return {
    select(look) {
      if (!COASTAL_LOOKS.includes(look)) return;
      if (selection?.look !== look) {
        if (selection) selection.request = null;
        selection = { look, offset: 0, request: null, started: false, ended: false, failed: false };
        cancelDownloads((file) => !isTheme(file) || file === look + ".mp3");
      }
      playing = true;
      attempt();
    },
    pause,
    clear(options) {
      pause(options);
      selection = null;
    },
    prepareMotifs() {
      const ticket = cueGeneration;
      return getAsset(MANIFEST).then((metadata) => (metadata && ticket === cueGeneration ? getAsset(RESPONSES) : null));
    },
    motif(look, action) {
      if (!playing || !COASTAL_LOOKS.includes(look) || !MOTIFS.includes(action) || now() - lastMotif < MOTIF_GAP) return;
      const age = now(),
        ticket = ++cueGeneration;
      return Promise.all([getAsset(MANIFEST), getAsset(RESPONSES)]).then(([metadata, buffer]) => {
        if (!playing || ticket !== cueGeneration || now() - age > MOTIF_EXPIRY || context.state !== "running" || now() - lastMotif < MOTIF_GAP)
          return;
        const range = metadata?.cues[look][action];
        if (!range || !buffer || range[0] + range[1] > buffer.duration + 0.001) return;
        kill(motifVoice);
        const voice = createVoice(buffer, range[0], MOTIF_LEVEL, range[1]);
        motifVoice = voice;
        lastMotif = now();
        motifTotals[action] = (motifTotals[action] || 0) + 1;
        voice.source.onended = () => {
          if (motifVoice === voice) motifVoice = null;
          disconnect(voice);
        };
      });
    },
    evidence() {
      return {
        selected: selection?.look ?? null,
        theme: current?.session.look ?? null,
        fading: tail?.session.look ?? null,
        cues: { ...motifTotals },
        pending: [...downloads.keys()],
        cached: [...cache.keys()],
      };
    },
  };
}
