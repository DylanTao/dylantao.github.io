import { BLOCKING, CLEARANCE, INSIDE, cameraTerrainHeight } from "./camera.mjs";

const limits = Object.freeze({ shots: 16, keys: 96, duration: 180, lens: [12, 90], sampleStep: 0.025, distance: 185 });
const mask = BLOCKING | CLEARANCE | INSIDE;
const asPoint = (value) => Array.isArray(value) && value.length === 3 && value.every((n) => Number.isFinite(n) && Math.abs(n) <= 210);
const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
const mix = (a, b, t) => a + (b - a) * t;
const between = (a, b, t) => (t === 0 ? a.slice() : t === 1 ? b.slice() : a.map((value, i) => mix(value, b[i], t)));
const distance = (a, b) => Math.hypot(...a.map((n, i) => n - b[i]));
const ease = (t) => t * t * (3 - 2 * t);

// An authored eye is absolute or a world-space landmark plus a small offset.
// Keys are joined by straight segments, so easing cannot overshoot through a
// wall. Whole-shot easing keeps moving through the intermediate knots.
function resolvePoint(point, landmarks) {
  if (asPoint(point)) return point.slice();
  const anchor = typeof point?.anchor === "string" && Object.hasOwn(landmarks, point.anchor) && landmarks[point.anchor];
  if (!asPoint(anchor)) return null;
  const offset = point.offset ?? [0, 0, 0];
  if (!asPoint(offset)) return null;
  const at = anchor.map((value, i) => value + offset[i]);
  return asPoint(at) ? at : null;
}

function normalize(shot, landmarks) {
  if (!(typeof shot?.id === "string" && shot.id && Number.isFinite(shot.duration) && shot.duration >= 1 && shot.duration <= 80)) return null;
  if (!Array.isArray(shot.keys) || !shot.keys.length || shot.keys.length > limits.keys) return null;
  const keys = shot.keys.map((key) => ({
    at: key?.at,
    eye: resolvePoint(key?.eye, landmarks),
    target: resolvePoint(key?.target, landmarks),
    fov: key?.fov ?? shot.fov,
  }));
  const minutes = Array.isArray(shot.minute) ? shot.minute : [shot.minute, shot.minute];
  if (minutes.length !== 2 || !minutes.every((minute) => Number.isFinite(minute) && minute >= 0 && minute < 1440)) return null;
  for (const [i, key] of keys.entries()) {
    if (
      !Number.isFinite(key.at) ||
      key.at < 0 ||
      key.at > 1 ||
      (i > 0 && key.at <= keys[i - 1].at) ||
      !key.eye ||
      !key.target ||
      distance(key.eye, key.target) < 0.35 ||
      !Number.isFinite(key.fov) ||
      key.fov < limits.lens[0] ||
      key.fov > limits.lens[1]
    )
      return null;
  }
  if (keys[0].at !== 0 || (keys.length > 1 && keys.at(-1).at !== 1)) return null;
  const length = keys.slice(1).reduce((sum, key, i) => sum + distance(key.eye, keys[i].eye), 0);
  if (length > limits.distance) return null;
  return { ...shot, keys, minutes };
}

export function sampleVisitorShot(shot, fraction, { still = false } = {}) {
  fraction = still ? 0.5 : clamp(fraction, 0, 1);
  const eased = ease(fraction);
  const right = shot.keys.findIndex((key) => key.at >= eased);
  const [a, b] = right < 0 ? [shot.keys.at(-1), shot.keys.at(-1)] : [shot.keys[Math.max(0, right - 1)], shot.keys[right]];
  const weight = a === b ? 0 : (eased - a.at) / (b.at - a.at);
  return {
    eye: between(a.eye, b.eye, weight),
    target: between(a.target, b.target, weight),
    fov: mix(a.fov, b.fov, weight),
    minute: Math.round(mix(...shot.minutes, fraction)),
    room: shot.room,
    activity: shot.activity,
    kind: shot.kind,
    shot: shot.id,
    caption: shot.caption,
    look: shot.look,
    lift: shot.lift ? eased : null,
  };
}

export function createVisitorClearance({ grid, regions = [], terrain, waterAt, seabedAt, blockers = () => [] }) {
  return (eye, kind, live = false) => {
    if (!grid?.ready || !asPoint(eye)) return "waiting-for-geometry";
    const [x, y, z] = eye;
    const local = regions.find((area) => area.contains(x, y, z)) ?? grid;
    if (!local.ready) return "waiting-for-geometry";
    if (local.contains(x, y, z)) {
      if (local.flagAt(x, y, z) & mask) return "camera-field";
    } else {
      const pad = terrain?.clearance ?? 0.32;
      const floor = cameraTerrainHeight(x, z, terrain);
      if (Number.isFinite(floor)) {
        if (y < floor + pad) return "terrain";
      } else {
        // The finite mainland chart can be left toward the open Pacific. An
        // eye beyond it over uncharted land is never admitted as empty air.
        const sea = waterAt?.(x, z);
        if (!terrain || z >= terrain.origin[1] || !sea || y < sea.y + pad) return "unverified-exterior";
      }
    }
    if (kind === "boat") {
      // Check the full small craft footprint and a 0.42 m draft. The surface
      // shader's ocean extends through dry land. The captured seabed disambiguates it.
      for (const [dx, dz] of [
        [0, 0],
        [-0.55, 0],
        [0.55, 0],
        [0, -0.55],
        [0, 0.55],
      ]) {
        const wave = waterAt?.(x + dx, z + dz);
        const bed = seabedAt?.(x + dx, z + dz);
        if (!wave || !bed || wave.y - bed.height < 0.42 || y - wave.y < 0.62) return "water-depth";
      }
    }
    if (live) {
      for (const box of blockers()) if (eye.every((value, i) => value >= box.min[i] - 0.17 && value <= box.max[i] + 0.17)) return "moving-obstacle";
    }
    return null;
  };
}

function segmentClear(from, to, kind, clearance, live) {
  const span = distance(from, to);
  if (span > limits.distance) return { reason: "segment-length", point: from };
  const count = Math.max(1, Math.ceil(span / limits.sampleStep));
  for (let i = 0; i <= count; i++) {
    const point = between(from, to, i / count);
    const reason = clearance(point, kind, live);
    if (reason) return { reason, point };
  }
  return null;
}

export function compileVisitorRail(shots, landmarks, clearance) {
  const admitted = [];
  const rejected = [];
  let duration = 0;
  const ids = new Set();
  for (const input of (Array.isArray(shots) ? shots : []).slice(0, limits.shots)) {
    const shot = normalize(input, landmarks ?? {});
    if (!shot || ids.has(shot.id) || duration + shot.duration > limits.duration) {
      rejected.push({ shot: input?.id ?? null, reason: "invalid-shot" });
      continue;
    }
    const check = shot.keys
      .map((key, index) => segmentClear(shot.keys[Math.max(0, index - 1)].eye, key.eye, shot.kind, clearance, false))
      .find(Boolean);
    if (check) {
      rejected.push({ shot: shot.id, ...check });
      continue;
    }
    ids.add(shot.id);
    admitted.push({ ...shot, start: duration, end: duration + shot.duration });
    duration += shot.duration;
  }
  return { shots: admitted, rejected, duration };
}

// A rail can pause at any time, including after a door enters the next segment.
// Cuts and user scrubs revalidate their destination. Normal playback also checks
// each segment traversed within the current shot, even on a stalled renderer.
export function createVisitorRailPlayer(program, clearance, { reduced = false } = {}) {
  let seconds = 0;
  let paused = reduced;
  let obstruction = null;
  let last = null;
  const shotAt = (time) => program.shots.find((shot) => time < shot.end) ?? program.shots.at(-1);
  function seek(time, { cut = true } = {}) {
    if (!Number.isFinite(time)) return false;
    const next = clamp(time, 0, program.duration);
    const shot = shotAt(next);
    if (!shot) return false;
    const fraction = (next - shot.start) / shot.duration;
    const pose = sampleVisitorShot(shot, fraction, { still: reduced });
    const waypoints =
      !cut && last?.shot === pose.shot
        ? [
            last.eye,
            ...shot.keys.filter((key) => key.at > ease((seconds - shot.start) / shot.duration) && key.at < ease(fraction)).map((key) => key.eye),
            pose.eye,
          ]
        : [pose.eye];
    obstruction = null;
    for (let i = 0; i < waypoints.length; i++) {
      obstruction = segmentClear(waypoints[Math.max(0, i - 1)], waypoints[i], pose.kind, clearance, true);
      if (obstruction) break;
    }
    if (obstruction) {
      paused = true;
      return false;
    }
    seconds = next;
    if (seconds === program.duration) paused = true;
    last = pose;
    return true;
  }
  seek(0);
  return {
    seek,
    skip(direction = 1) {
      const index = program.shots.indexOf(shotAt(seconds));
      const next = program.shots[index + (direction < 0 ? -1 : 1)];
      if (!next) return false;
      return seek(next.start);
    },
    pause(value = true) {
      paused = reduced || value;
      if (!paused && seconds === program.duration) seek(0);
    },
    reduce(value) {
      if (reduced === value) return;
      reduced = value;
      paused = true;
      seek(seconds);
    },
    tick(delta) {
      if (!paused && delta > 0) seek(seconds + Math.min(delta, 0.25), { cut: false });
      return last;
    },
    get pose() {
      return last;
    },
    get state() {
      const index = program.shots.indexOf(shotAt(seconds));
      return {
        seconds,
        duration: program.duration,
        paused,
        reduced,
        obstruction,
        shot: last?.shot ?? null,
        hasPrior: index > 0,
        hasNext: index < program.shots.length - 1,
      };
    },
  };
}

// This only reports composed, playing film states. The site's sound controller
// owns permission, synthesis and muting when the tab loses visibility.
export function createFilmScoreCue(emit) {
  let lastLook = null;
  let running = false;
  const cue = (action, look) => emit({ kind: "film", action, look });
  return {
    update(look, playing) {
      if (!playing) {
        if (running) cue("pause", look);
        running = false;
        return;
      }
      if (!running) cue("start", look);
      else if (lastLook !== look) cue("look", look);
      lastLook = look;
      running = true;
    },
    stop(look) {
      if (lastLook !== null) cue("stop", look);
      lastLook = null;
      running = false;
    },
  };
}
