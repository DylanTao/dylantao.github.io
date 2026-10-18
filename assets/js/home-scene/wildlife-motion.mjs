// Authored animal acting, sampled from active scene time. No frame integration
// means a pause, slow renderer, or reduced-motion still cannot accumulate drift.
// Behaviour comes in jittered epochs of varied segments. Each epoch opens and closes in a
// settled neutral pose, and its posture channels are springs driven by keyed targets
// (wildlife-acting.mjs), so every change overshoots and settles without integration.
import {
  activeTime,
  clamp01,
  epochAt,
  glanceKeys,
  hash,
  noise,
  planCache,
  pulse,
  segmentAt,
  smooth,
  sprung,
  window01,
  wrap,
} from "./wildlife-acting.mjs";
import { sampleOcean } from "./ocean-spectrum.mjs";

const TAU = Math.PI * 2;
const quintic = (f) => f ** 3 * (10 + f * (-15 + 6 * f));
export const blinkAt = (t, seed, period = 7) => {
  const k = Math.floor(t / period),
    at = k * period + hash(seed, k, 41) * (period - 0.4);
  return pulse((t - at) / 0.2);
};
function channels(names, start, values = {}) {
  const keys = {};
  for (const name of names) keys[name] = [[start, values[name] ?? 0]];
  keys.set = (time, targets) => {
    for (const [name, value] of Object.entries(targets)) keys[name].push([time, value]);
  };
  return keys;
}
const sortKeys = (keys) => {
  for (const list of Object.values(keys)) if (Array.isArray(list)) list.sort((a, b) => a[0] - b[0]);
};

// ---------------------------------------------------------------- brush rabbits

export const RABBIT_EPOCH = 40;
export const RABBIT_LOOP = 3.33; // metres; both clifftop loops are 3.3 m around their scrub
const RABBIT_STEP = 0.43; // loop fraction per epoch
const SIT = { chest: -0.08, hips: 0, lift: 0.004, head: -0.04, earL: 0, earR: 0, spreadL: 0.06, spreadR: -0.06, paws: 0, tail: 0, yaw: 0, pitch: 0 };
const RABBIT_POSTURE = {
  sit: SIT,
  hop: { chest: 0, hips: 0, lift: 0, head: 0, earL: -0.12, earR: -0.12, spreadL: 0.02, spreadR: -0.02, paws: 0, tail: 0 },
  bolt: { chest: 0.05, hips: 0.05, lift: -0.01, head: -0.06, earL: -0.55, earR: -0.55, spreadL: -0.05, spreadR: 0.05, paws: 0, tail: 0.85 },
  graze: { chest: 0.3, hips: 0.04, lift: -0.012, head: 0.5, earL: -0.3, earR: -0.3, spreadL: 0.18, spreadR: -0.18, paws: 0, tail: 0 },
  groom: { chest: -0.5, hips: -0.1, lift: -0.02, head: 0.32, earL: -0.6, earR: -0.6, spreadL: 0.12, spreadR: -0.12, paws: 1, tail: 0 },
  freeze: { chest: -0.16, hips: -0.04, lift: 0.012, head: -0.14, earL: 0.16, earR: 0.16, spreadL: -0.04, spreadR: 0.04, paws: 0, tail: 0.25 },
};
const rabbitProgress = (seed, n) => n * RABBIT_STEP + (hash(seed, n, 91) - 0.5) * 0.08 + seed * 0.2;
const rabbitPlans = new Map();

function rabbitEpoch(k, seed, start, end) {
  const h = (n, m = 0) => hash(seed * 7919 + 13, k, n * 31 + m);
  const p0 = rabbitProgress(seed, k),
    p1 = rabbitProgress(seed, k + 1);
  const bolt = h(1) < 0.34;
  const casual = bolt ? 1 + Math.floor(h(2) * 2) : 4 + Math.floor(h(2) * 3);
  const bounds = bolt ? 4 + Math.floor(h(3) * 2) : 0;
  const segments = [],
    hops = [];
  let t = start;
  const push = (kind, duration) => {
    segments.push({ kind, start: t, end: t + duration });
    t += duration;
  };
  const bout = (count, kind) => {
    const duration = kind === "bolt" ? 0.34 + h(9) * 0.04 : 0.6 + h(8) * 0.08;
    const first = t;
    for (let i = 0; i < count; i++) {
      hops.push({ kind, start: t, end: t + duration, share: (kind === "bolt" ? 1.7 : 1) * (0.88 + h(20 + hops.length) * 0.24) });
      t += duration;
    }
    segments.push({ kind, start: first, end: t });
  };
  push("sit", 0.8 + h(4) * 1.4);
  const firstBout = bolt ? casual : Math.ceil(casual / 2);
  bout(firstBout, "hop");
  push("graze", 5 + h(5) * 5);
  if (h(6) < 0.45) push("groom", 3.6 + h(7) * 1.6);
  if (bolt) {
    push("freeze", 1.6 + h(10) * 1.6);
    bout(bounds, "bolt");
    push("freeze", 1.2 + h(11) * 1.4);
  } else bout(casual - firstBout, "hop");
  const remaining = end - t - 4;
  if (remaining > 4) push("graze", remaining * (0.6 + h(12) * 0.25));
  push("sit", Math.max(0.1, end - t));
  if (t > end + 1e-9 || segments.at(-1).end - segments.at(-1).start < 4) {
    // Compress everything before the closing sit so the epoch always settles for 4 s.
    const closing = segments.pop();
    const budget = end - 4 - start,
      used = closing.start - start,
      scale = Math.min(1, budget / used);
    for (const item of [...segments, ...hops]) {
      item.start = start + (item.start - start) * scale;
      item.end = start + (item.end - start) * scale;
    }
    segments.push({ kind: "sit", start: segments.at(-1).end, end });
  }
  segments.at(-1).end = end;
  const total = hops.reduce((sum, hop) => sum + hop.share, 0);
  let travelled = p0;
  for (const hop of hops) {
    hop.p0 = travelled;
    travelled += (hop.share / total) * (p1 - p0);
    hop.p1 = travelled;
  }
  const keys = channels(Object.keys(SIT), start, SIT);
  segments.forEach((segment, i) => {
    const s = segment.start,
      e = segment.end,
      posture = RABBIT_POSTURE[segment.kind];
    const { yaw, pitch, ...rest } = posture;
    keys.set(s, rest);
    const closing = i === segments.length - 1;
    if (segment.kind === "sit" && e - s > 1.2)
      glanceKeys(keys, s, closing ? e - 3.2 : e, seed * 101 + k * 7 + i, { yaw: 0.55, pitch: 0.12, hold: [0.6, 1.8] });
    if (segment.kind === "graze") {
      let scan = s + 1.4 + h(30 + i) * 2;
      for (let n = 0; scan < e - 1.6; n++) {
        const length = 0.9 + h(40 + i, n) * 0.8,
          back = scan + length;
        keys.set(scan, { head: -0.08, chest: 0.12, yaw: (h(50 + i, n) - 0.5) * 0.7, earL: 0.08 });
        keys.set(scan + 0.12, { earR: 0.08 });
        keys.set(back, { head: posture.head, chest: posture.chest, yaw: 0, earL: posture.earL });
        keys.set(back + 0.1, { earR: posture.earR });
        scan = back + 2.2 + h(60 + i, n) * 3.5;
      }
    }
    if ((segment.kind === "sit" || segment.kind === "graze") && e - s > 2) {
      // A single ear swivels toward a sound and back.
      for (let n = 0, at = s + 0.7 + h(70 + i) * 2; at < (closing ? e - 3.5 : e - 0.9); n++, at += 2.4 + h(71 + i, n) * 3) {
        const left = h(72 + i, n) < 0.5,
          name = left ? "spreadL" : "spreadR",
          sign = left ? 1 : -1;
        keys.set(at, { [name]: sign * (0.35 + h(73 + i, n) * 0.25) });
        keys.set(at + 0.7 + h(74 + i, n) * 0.6, { [name]: posture[name] });
      }
    }
  });
  sortKeys(keys);
  return { start, end, segments, hops, keys, p0, p1 };
}

function hopMotion(hop, t) {
  const bolt = hop.kind === "bolt";
  const lift0 = bolt ? 0.1 : 0.18,
    land0 = bolt ? 0.85 : 0.76;
  const u = clamp01((t - hop.start) / (hop.end - hop.start));
  const f = clamp01((u - lift0) / (land0 - lift0));
  const airborne = u > lift0 + 1e-10 && u < land0 - 1e-10;
  const travel = (x) => quintic(clamp01(x));
  const distance = (hop.p1 - hop.p0) * RABBIT_LOOP;
  const height = bolt ? 0.05 + distance * 0.1 : 0.04 + distance * 0.26;
  // Fore paws reach ahead and plant at the landing spot just before the body arrives; hind paws
  // stay on the take-off spot through the push, then swing through to land under the body.
  const ahead = (travel(1) - travel(f)) * distance;
  const behind = -travel(f) * distance;
  const gather = u <= lift0 ? pulse(u / lift0) : 0;
  const land = u >= land0 ? pulse((u - land0) / (1 - land0)) : 0;
  const rise = f < 0.5 ? Math.sin(Math.PI * (f / 0.5)) : 0;
  const reach = f > 0.5 ? Math.sin((Math.PI * (f - 0.5)) / 0.5) : 0;
  return {
    u,
    f,
    airborne,
    progress: hop.p0 + (hop.p1 - hop.p0) * travel(f),
    lift: airborne ? Math.sin(Math.PI * f) ** 2 * height : 0,
    compression: gather + land * 0.6,
    chest: gather * 0.1 - rise * 0.2 + reach * 0.16 + land * 0.24,
    hips: -rise * 0.16 + reach * 0.22 + land * 0.12,
    foreReach: f < 0.82 ? ahead * smooth((f - 0.08) / 0.74) : ahead,
    foreLift: f > 0 && f < 0.82 ? Math.sin((Math.PI * f) / 0.82) * (bolt ? 0.03 : 0.045) : 0,
    hindReach: f < 0.14 ? behind : behind * (1 - smooth((f - 0.14) / 0.86)),
    hindLift: f > 0.14 && f < 1 ? Math.sin((Math.PI * (f - 0.14)) / 0.86) * (bolt ? 0.035 : 0.05) : 0,
    hindToe: f < 0.3 ? Math.sin(Math.PI * clamp01((u - lift0 * 0.5) / (lift0 * 0.5 + 0.3 * (land0 - lift0)))) : 0,
    ears: -Math.sin(Math.PI * f) * (bolt ? 0.25 : 0.32) + land * 0.18,
    tail: Math.sin(Math.PI * f) * (bolt ? 0.2 : 0.35),
  };
}

// The plan in effect at a time, in the caller's time (the per-seed offset removed), for tests
// and evidence that need hop, segment and epoch boundaries.
export function rabbitSchedule(time, seed = 1) {
  const shift = seed * 7,
    t = activeTime(time) + shift;
  if (!rabbitPlans.has(seed))
    rabbitPlans.set(
      seed,
      planCache((k, start, end) => rabbitEpoch(k, seed, start, end))
    );
  const epoch = epochAt(t, RABBIT_EPOCH, 0.18, seed * 17 + 5);
  const plan = rabbitPlans.get(seed)(epoch.k, epoch.start, epoch.end);
  const move = (item) => ({ ...item, start: item.start - shift, end: item.end - shift });
  return {
    k: epoch.k,
    start: epoch.start - shift,
    end: epoch.end - shift,
    segments: plan.segments.map(move),
    hops: plan.hops.map(move),
    p0: plan.p0,
    p1: plan.p1,
  };
}

export function rabbitActing(time, seed = 1) {
  const t = activeTime(time) + seed * 7;
  if (!rabbitPlans.has(seed))
    rabbitPlans.set(
      seed,
      planCache((k, start, end) => rabbitEpoch(k, seed, start, end))
    );
  const epoch = epochAt(t, RABBIT_EPOCH, 0.18, seed * 17 + 5);
  const plan = rabbitPlans.get(seed)(epoch.k, epoch.start, epoch.end);
  const { segment } = segmentAt(plan.segments, t);
  const hop = segment.kind === "hop" || segment.kind === "bolt" ? plan.hops.find((item) => t >= item.start && t < item.end) : null;
  const motion = hop ? hopMotion(hop, t) : null;
  let progress = plan.p0;
  for (const item of plan.hops) if (t >= item.end) progress = item.p1;
  if (motion) progress = motion.progress;
  const keys = plan.keys,
    local = t - segment.start;
  const grazing = segment.kind === "graze" ? window01(t, segment.start, segment.end, 0.5) : 0;
  const freezing = segment.kind === "freeze" ? window01(t, segment.start, segment.end, 0.15, 0.3) : 0;
  const grooming = segment.kind === "groom" ? window01(t, segment.start, segment.end, 0.5) : 0;
  const head = sprung(keys.head, t, 2.6, 0.62);
  const headLag = sprung(keys.head, t, 4.5, 0.7) - sprung(keys.head, t, 1.6, 0.5);
  const yaw = sprung(keys.yaw, t, 3.2, 0.72);
  const yawLag = sprung(keys.yaw, t, 5, 0.7) - sprung(keys.yaw, t, 1.8, 0.45);
  const chew = grazing * (Math.sin(t * TAU * 4.6) * 0.5 + 0.5) * (1 - 0.6 * pulse(wrap(t * 0.8 + seed, 1)));
  const twitch = (0.25 + freezing * 0.75) * Math.max(0, Math.sin(t * TAU * (2.2 + freezing * 6.5))) ** 4;
  const groomStroke = grooming * Math.sin(local * TAU * 2.2);
  const hopEars = motion ? motion.ears : 0;
  return {
    epoch: epoch.k,
    state: hop ? hop.kind : segment.kind,
    progress,
    phase: motion ? motion.u : 0,
    airborne: motion ? motion.airborne : false,
    contact: motion ? !motion.airborne : true,
    lift: motion ? motion.lift : 0,
    compression: motion ? motion.compression : 0,
    chestPitch: sprung(keys.chest, t, 2.2, 0.6) + (motion ? motion.chest : 0),
    hipsPitch: sprung(keys.hips, t, 2, 0.6) + (motion ? motion.hips : 0),
    bodyLift: sprung(keys.lift, t, 2, 0.65) - (motion ? motion.compression * 0.03 : 0),
    headPitch: head + groomStroke * 0.14 + chew * 0.03 - (motion ? motion.chest * 0.7 : 0),
    headYaw: yaw + noise(t * 0.7, seed * 3) * 0.02,
    headRoll: -yawLag * 0.3,
    earLeft: sprung(keys.earL, t, 2.4, 0.38) - headLag * 1.1 + hopEars,
    earRight: sprung(keys.earR, t, 2.2, 0.36) - headLag * 1.1 + hopEars,
    earYawLeft: sprung(keys.spreadL, t, 3, 0.45) + yawLag * 0.5,
    earYawRight: sprung(keys.spreadR, t, 3, 0.45) + yawLag * 0.5,
    chew,
    twitch,
    breath: 1 + Math.sin(t * TAU * (1.05 + freezing * 1.4)) * (0.011 + freezing * 0.006),
    tail: sprung(keys.tail, t, 3.5, 0.35) + (motion ? motion.tail : 0) + twitch * 0.05,
    pawRaise: sprung(keys.paws, t, 2.4, 0.7),
    groomStroke,
    foreReach: motion ? motion.foreReach : 0,
    foreLift: motion ? motion.foreLift : 0,
    hindReach: motion ? motion.hindReach : 0,
    hindLift: motion ? motion.hindLift : 0,
    hindToe: motion ? motion.hindToe : 0,
    tuck: motion && motion.airborne ? Math.sin(Math.PI * motion.f) : 0,
    blink: blinkAt(t, seed * 5 + 1, 9),
  };
}

// ---------------------------------------------------------------- pinnipeds on land

export const PINNIPED_EPOCH = { lion: 52, seal: 60 };
const PINNIPED_CHANNELS = ["yaw", "pitch", "roll", "neck", "chest", "hips", "side", "flipper", "rear", "jaw", "eyes"];
const pinnipedPlans = new Map();

function pinnipedEpoch(k, index, lion, start, end) {
  const seed = (lion ? 300 : 500) + index * 37;
  const h = (n, m = 0) => hash(seed, k, n * 29 + m);
  const segments = [];
  let t = start;
  const push = (kind, duration) => {
    segments.push({ kind, start: t, end: t + duration });
    t += duration;
  };
  const menu = lion
    ? ["look", "bark", "skypoint", "flipper", "yawn", "lie", "roll", "scratch", "look"]
    : ["look", "banana", "scratch", "yawn", "roll", "shuffle", "look", "banana"];
  push("rest", 2 + h(1) * 5);
  for (let n = 0; t < end - 12; n++) {
    let kind = menu[Math.floor(h(10, n) * menu.length)];
    if (lion && n === 0 && (index % 2 === 0 || h(11) < 0.55)) kind = "bark";
    if (!lion && n === 0 && index === 0 && h(11) < 0.6) kind = "shuffle";
    const duration = {
      look: 4 + h(12, n) * 4,
      bark: 2.6 + h(13, n) * 3,
      skypoint: 4 + h(14, n) * 3,
      flipper: 4 + h(15, n) * 3,
      yawn: 3.2,
      lie: 10 + h(16, n) * 8,
      roll: 8 + h(17, n) * 5,
      scratch: 3 + h(18, n) * 2,
      banana: 9 + h(19, n) * 8,
      shuffle: 13 + h(20, n) * 4,
    }[kind];
    push(kind, Math.min(duration, end - 6 - t));
    push("rest", Math.min(2 + h(21, n) * 6, Math.max(0, end - t)));
  }
  if (t < end) push("rest", end - t);
  segments.at(-1).end = end;
  const keys = channels(PINNIPED_CHANNELS, start);
  const side = index % 2 ? -1 : 1;
  segments.forEach((segment, i) => {
    const s = segment.start,
      e = segment.end,
      kind = segment.kind,
      back = Math.max(s + 0.6, e - 0.9);
    const neutral = Object.fromEntries(PINNIPED_CHANNELS.map((name) => [name, 0]));
    keys.set(s, neutral);
    if (kind === "rest" && e - s > 5 && i < segments.length - 1) {
      // A slow look toward the sea or a neighbour, then back.
      const at = s + 1 + h(30 + i) * (e - s - 4);
      keys.set(at, { yaw: (h(31 + i) - 0.5) * 0.7, pitch: (h(32 + i) - 0.5) * 0.12 });
      keys.set(at + 1.5 + h(33 + i) * 1.5, { yaw: 0, pitch: 0 });
    }
    if (kind === "look")
      glanceKeys(keys, s, back, seed + k * 7 + i, { yaw: lion ? 0.6 : 0.5, pitch: 0.12, hold: [0.7, 1.9], basePitch: lion ? -0.05 : -0.12 });
    if (kind === "look" && !lion) keys.set(s, { chest: -0.14 });
    // Barking: the neck stretches up and the head tips back; each bark then throws it higher.
    if (kind === "bark") keys.set(s, { neck: -0.45, pitch: -0.4, yaw: (h(34 + i) - 0.5) * 0.5 });
    if (kind === "skypoint") keys.set(s + 0.3, { pitch: -0.8, neck: -0.32, eyes: 0.85 });
    if (kind === "flipper") keys.set(s, { flipper: 0.62, side, yaw: side * -0.25 });
    if (kind === "yawn") keys.set(s, { pitch: -0.25, eyes: 0.9 });
    if (kind === "lie") keys.set(s, lion ? { chest: 0.38, neck: 0.55, pitch: 0.28, eyes: 0.6 } : { pitch: 0.12, eyes: 0.7 });
    if (kind === "roll") {
      keys.set(s, { roll: side * 0.5, flipper: 0.75, side, pitch: 0.08, yaw: side * 0.3 });
      keys.set(s + 1.2, { eyes: 0.5 });
    }
    if (kind === "scratch") keys.set(s, { yaw: side * 0.45, roll: side * 0.12, rear: 0.3, pitch: 0.15 });
    if (kind === "banana") keys.set(s + 0.2, { chest: -0.3, pitch: -0.32, hips: 0.32, rear: 0.38 });
    if (kind !== "rest") keys.set(back, neutral);
  });
  sortKeys(keys);
  return { start, end, segments, keys, seed };
}

// Bark rhythm: pulses at about 2.3 Hz with an irregular count and the odd skipped beat.
function barkPulse(local, seed) {
  const rate = 2.1 + hash(seed, 77) * 0.5;
  const n = Math.floor(local * rate),
    u = local * rate - n;
  return (hash(seed, n, 79) < 0.2 ? 0 : 1) * Math.sin(Math.PI * clamp01(u / 0.55)) ** 2;
}

function pinnipedState(time, index, lion) {
  const t = activeTime(time) + index * 11.7 + (lion ? 3 : 8);
  const key = `${lion ? "lion" : "seal"}-${index}`;
  if (!pinnipedPlans.has(key))
    pinnipedPlans.set(
      key,
      planCache((k, start, end) => pinnipedEpoch(k, index, lion, start, end))
    );
  const epoch = epochAt(t, lion ? PINNIPED_EPOCH.lion : PINNIPED_EPOCH.seal, 0.15, (lion ? 61 : 67) + index);
  return { t, epoch, plan: pinnipedPlans.get(key)(epoch.k, epoch.start, epoch.end) };
}

export function pinnipedSchedule(time, index, lion) {
  const { t, epoch, plan } = pinnipedState(time, index, lion);
  const shift = t - activeTime(time);
  return {
    k: epoch.k,
    start: epoch.start - shift,
    end: epoch.end - shift,
    segments: plan.segments.map((item) => ({ ...item, start: item.start - shift, end: item.end - shift })),
  };
}

export function pinnipedActing(time, index, lion) {
  const { t, epoch, plan } = pinnipedState(time, index, lion);
  const { segment } = segmentAt(plan.segments, t);
  const keys = plan.keys,
    local = t - segment.start;
  const live = (kind, rise = 0.5, fall = 0.7) => (segment.kind === kind ? window01(t, segment.start, segment.end, rise, fall) : 0);
  const bark = live("bark", 0.4, 0.9) * barkPulse(local, plan.seed + epoch.k);
  const yawn = segment.kind === "yawn" ? Math.sin(Math.PI * clamp01((local - 0.4) / (segment.end - segment.start - 1.1))) ** 0.8 : 0;
  const flipping = live("flipper", 0.8, 1) + live("roll", 1.2, 1.4);
  const scratching = live("scratch", 0.4);
  const shuffle = live("shuffle", 0.5, 0.8);
  const humpPhase = shuffle ? wrap(local / 1.1, 1) : 0;
  const hump = shuffle * Math.sin(Math.PI * humpPhase) ** 2;
  const yaw = sprung(keys.yaw, t, 2.4, 0.66);
  const pitch = sprung(keys.pitch, t, 1.8, 0.6);
  const pitchLag = sprung(keys.pitch, t, 3.5, 0.7) - sprung(keys.pitch, t, 1.2, 0.5);
  return {
    state: segment.kind,
    epoch: epoch.k,
    headYaw: yaw + noise(t * 0.3, plan.seed) * 0.06 + scratching * 0.12 * Math.sin(local * 3),
    headPitch: pitch - bark * 0.22 + noise(t * 0.23, plan.seed + 1) * 0.035,
    headRoll: sprung(keys.roll, t, 1.6, 0.6) * -0.4 + scratching * 0.3 * Math.sin(local * 4.5),
    neckPitch: sprung(keys.neck, t, 1.6, 0.6) - bark * 0.14 + pitchLag * 0.3,
    neckFollow: yaw * 0.35,
    chestPitch: sprung(keys.chest, t, 1.4, 0.65) - bark * 0.06 - hump * 0.12,
    hipsPitch: sprung(keys.hips, t, 1.4, 0.65) + shuffle * Math.sin(TAU * humpPhase) * 0.12,
    bodyRoll: sprung(keys.roll, t, 1.1, 0.7),
    bodyLift: hump * 0.035,
    jaw: Math.max(bark * 0.58, yawn * 0.62),
    breath: Math.sin(t * TAU * (lion ? 0.27 : 0.22)) * (lion ? 0.012 : 0.01) * (1 + bark),
    flipper: sprung(keys.flipper, t, 1.6, 0.55) + flipping * 0.22 * Math.sin(local * 1.7),
    flipperTip: flipping * 0.3 * Math.sin(local * 1.7 - 0.7) + scratching * 0.3 * Math.sin(local * 9),
    flipperSide: sprung(keys.side, t, 2, 0.9) < 0 ? "R" : "L",
    rearFlipper: sprung(keys.rear, t, 1.8, 0.5) + scratching * 0.25 * Math.sin(local * 8) + noise(t * 0.4, plan.seed + 2) * 0.05 + hump * 0.15,
    shuffle,
    humpPhase,
    blink: Math.max(blinkAt(t, plan.seed, lion ? 6.5 : 5.5), sprung(keys.eyes, t, 2, 0.8) * (0.85 + 0.15 * Math.sin(t * 0.6))),
  };
}

// Harbor seals haul out and shuffle toward the wash and back along their shore-normal line,
// by whole humps: progress advances only while the chest pushes (metres toward the sea).
export function sealShuffleOffset(time, index) {
  const { t, plan } = pinnipedState(time, index, false);
  const shuffle = plan.segments.find((segment) => segment.kind === "shuffle" && t >= segment.start && t < segment.end);
  if (!shuffle) return 0;
  const local = t - shuffle.start,
    span = shuffle.end - shuffle.start;
  const humps = Math.max(2, Math.floor((span - 1.5) / 2.2));
  const half = humps * 1.1;
  const step = (x) => {
    const n = Math.floor(x / 1.1),
      u = x / 1.1 - n;
    return (Math.min(n, humps) + (n < humps ? smooth((u - 0.35) / 0.55) : 0)) / humps;
  };
  const out = local < half ? step(local) : local < span - half ? 1 : 1 - step(local - (span - half));
  return clamp01(out) * 1.6;
}

// ---------------------------------------------------------------- swimming sea lions

// Porpoising runs along an offshore lane, then rafting on the swell with a flipper raised,
// a periscope look, and a slow turn before the run back.
export const SWIM_PERIOD = 46;
// Runs are fast (about 2.3 m/s, peaking near 4), so each leap clears the swell at about 30 degrees.
const SWIM_RUN = 11;
// `sea` is the coast's oceanWindState, so the swimmers ride the sea the renderer draws.
export function swimmerActing(time, index, lane, sea = null) {
  const raw = activeTime(time),
    t = raw + index * 21;
  const k = Math.floor(t / SWIM_PERIOD),
    cycle = t - k * SWIM_PERIOD;
  const direction = k % 2 === 0 ? 1 : -1;
  const startX = direction > 0 ? lane.from : lane.to;
  const span = lane.to - lane.from;
  const run = clamp01(cycle / SWIM_RUN);
  const x = startX + direction * span * smooth(run);
  const speed = (span * 30 * run * run * (1 - run) * (1 - run)) / SWIM_RUN; // derivative of the quintic
  const porpoising = smooth(cycle / 1.5) * (1 - smooth((cycle - SWIM_RUN + 2) / 2));
  const leapPeriod = 1.55;
  const leap = Math.floor(cycle / leapPeriod),
    u = (cycle - leap * leapPeriod) / leapPeriod;
  const air = u < 0.58,
    a = air ? u / 0.58 : (u - 0.58) / 0.42;
  const height = 0.35 + hash(index, leap + k * 40, 5) * 0.25;
  const arc = air ? Math.sin(Math.PI * a) * height : -Math.sin(Math.PI * a) * 0.42;
  const climb = air
    ? (Math.cos(Math.PI * a) * height * Math.PI) / (0.58 * leapPeriod)
    : (-Math.cos(Math.PI * a) * 0.42 * Math.PI) / (0.42 * leapPeriod);
  const z = lane.z + noise(t * 0.05, index + 9) * 1.5;
  const surface = sampleOcean(x, z + 28, raw, 1.1, sea).displacement[1] - 7.35;
  const rafting = 1 - porpoising;
  const rest = Math.max(0, cycle - SWIM_RUN);
  const turn = smooth((cycle - (SWIM_PERIOD - 6)) / 5);
  // Rafting poses ease in after the run and out through the turn, so each cycle joins the next.
  const settled = smooth(rest / 2) * (1 - turn);
  const periscope = rafting * settled * clamp01((Math.sin(rest * 0.4 + index) - 0.55) * 3);
  return {
    state: porpoising > 0.5 ? "porpoise" : periscope > 0.5 ? "periscope" : "raft",
    position: [x, surface + porpoising * arc - rafting * 0.12 + periscope * 0.32, z],
    yaw: (direction > 0 ? Math.PI / 2 : -Math.PI / 2) + Math.PI * turn,
    pitch: porpoising * -Math.atan2(climb, Math.max(0.6, speed)) * 0.85 - periscope * 0.9,
    roll: rafting * (index % 2 ? 0.9 : -0.9) * (1 - periscope) * (1 - turn * (1 - turn) * 2),
    spine: porpoising * (air ? -Math.sin(Math.PI * a) * 0.2 : 0.1),
    flipperTuck: porpoising,
    flipperRaise: rafting * settled * (1 - periscope) * (0.75 + 0.25 * Math.sin(rest * 0.9)),
    periscope,
    surface,
    inAir: porpoising > 0.5 && air,
    entry: porpoising > 0.5 && air ? pulse((a - 0.86) / 0.14) : 0,
    blink: blinkAt(t, index + 50, 4),
  };
}
