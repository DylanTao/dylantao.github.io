// Postures and gentle loops for the people on the footer coast.
// Pure math with no DOM or three.js, so node tests can sample every pose. Figures keep the
// miniature's art style (rods, a tapered torso, ellipsoid heads and hands); bench seats,
// paths, courts and boards come from the coastal manifest (bin/coastal_life.py).
// Coordinates are the browser's Y-up space. Each figure is built in its own frame
// (x = the figure's left, y = up, z = forward), then placed by a root and a yaw.
import { sampleCoastWave } from "./wave-motion.mjs";

const TAU = Math.PI * 2;
const clamp = (x, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, x));
const smooth = (x) => {
  const t = clamp(x);
  return t * t * (3 - 2 * t);
};
const mix = (a, b, t) => a + (b - a) * t;
const set = (o, x, y, z) => {
  o[0] = x;
  o[1] = y;
  o[2] = z;
  return o;
};
const copy = (o, a) => set(o, a[0], a[1], a[2]);
const length = (x, y, z) => Math.hypot(x, y, z);
// A deterministic hash in [0, 1) for per-figure variety without randomness.
const hash = (n) => {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
};

// Proportions follow the earlier Blender figures: about 0.685 units tall.
export const BODY = {
  hip: 0.319,
  hipWidth: 0.055,
  thigh: 0.135,
  shin: 0.145,
  ankle: 0.03,
  foot: 0.06,
  torso: 0.208,
  shoulder: 0.07,
  shoulderDrop: 0.035,
  upperArm: 0.12,
  forearm: 0.11,
};
const RADIUS = { thigh: 0.037, shin: 0.026, foot: 0.019, upperArm: 0.023, forearm: 0.02, torso: 0.084, hand: 0.022 };

// Linear-light colours (the same space as the Blender materials).
const SKIN = [
  [0.8, 0.55, 0.4],
  [0.68, 0.42, 0.27],
  [0.52, 0.31, 0.19],
  [0.36, 0.21, 0.13],
  [0.2, 0.11, 0.06],
];
const HAIR = {
  black: [0.025, 0.02, 0.018],
  brown: [0.13, 0.065, 0.03],
  blond: [0.62, 0.43, 0.18],
  grey: [0.46, 0.45, 0.43],
  auburn: [0.32, 0.09, 0.04],
};
const CLOTH = {
  white: [0.86, 0.84, 0.8],
  navy: [0.045, 0.07, 0.17],
  red: [0.56, 0.07, 0.05],
  teal: [0.05, 0.3, 0.32],
  yellow: [0.86, 0.6, 0.12],
  rose: [0.69, 0.4, 0.29],
  blue: [0.17, 0.43, 0.66],
  wetsuit: [0.028, 0.035, 0.04],
  khaki: [0.46, 0.38, 0.25],
  green: [0.16, 0.33, 0.16],
  orange: [0.87, 0.23, 0.05],
  grey: [0.33, 0.33, 0.34],
  denim: [0.1, 0.17, 0.32],
  black: [0.04, 0.04, 0.045],
  plum: [0.3, 0.1, 0.22],
  cream: [0.78, 0.7, 0.55],
};
const look = (skin, hair, top, bottom, shoes, options = {}) => ({
  skin: SKIN[skin],
  hair: HAIR[hair],
  top: CLOTH[top],
  bottom: CLOTH[bottom],
  shoes: shoes ? CLOTH[shoes] : SKIN[skin],
  ...options,
});
// Indexed by the manifest's `look`; sleeves cover the upper arm, trousers the shin.
export const LOOKS = [
  look(0, "brown", "white", "white", "white", { sleeves: true }),
  look(3, "black", "navy", "white", "white", { sleeves: true, cap: "white" }),
  look(1, "blond", "rose", "blue", null),
  look(2, "black", "blue", "khaki", null),
  look(0, "auburn", "teal", "khaki", "cream", { sleeves: true }),
  look(1, "brown", "cream", "denim", "black", { sleeves: true, trousers: true }),
  look(2, "grey", "red", "denim", "black", { sleeves: true, trousers: true, cap: "khaki" }),
  look(0, "blond", "orange", "denim", "black", { sleeves: true, trousers: true }),
  look(3, "black", "navy", "khaki", "black", { sleeves: true, trousers: true }),
  look(1, "auburn", "green", "denim", "black", { sleeves: true, trousers: true }),
  look(1, "black", "yellow", "black", "white"),
  look(1, "black", "wetsuit", "wetsuit", null, { sleeves: true, trousers: true }),
  look(0, "blond", "wetsuit", "wetsuit", null, { sleeves: true, trousers: true }),
  look(3, "black", "wetsuit", "wetsuit", null, { sleeves: true, trousers: true }),
  look(2, "black", "teal", "teal", null, { cap: "red" }),
  look(0, "brown", "teal", "teal", null),
  look(3, "grey", "khaki", "navy", "black", { sleeves: true, trousers: true }),
  look(1, "brown", "plum", "denim", "white", { sleeves: true, trousers: true }),
  look(4, "black", "white", "khaki", "black", { sleeves: true }),
  look(0, "auburn", "blue", "white", "cream"),
  look(2, "black", "orange", "denim", "white", { sleeves: true, trousers: true }),
  look(4, "black", "plum", "black", "black", { sleeves: true, trousers: true }),
];
const PROP = {
  racket: [0.06, 0.07, 0.09],
  strings: [0.62, 0.66, 0.6],
  tennisBall: [0.72, 0.88, 0.08],
  volleyball: [0.9, 0.86, 0.72],
  book: [0.62, 0.18, 0.1],
  laptop: [0.42, 0.44, 0.46],
  screen: [0.06, 0.09, 0.11],
  stick: [0.33, 0.2, 0.1],
  marshmallow: [0.95, 0.9, 0.8],
  foam: [0.88, 0.93, 0.85],
  dog: [0.62, 0.38, 0.14],
  dogDark: [0.2, 0.11, 0.05],
};

// ------------------------------------------------------------------ vector frames
// 3x3 rotation for a torso: yaw about Y, then pitch (forward lean) about X, then a roll
// toward the figure's left. Column vectors: right-handed, applied as m * v.
function euler(m, yaw, pitch, roll) {
  const cy = Math.cos(yaw),
    sy = Math.sin(yaw),
    cp = Math.cos(pitch),
    sp = Math.sin(pitch),
    cr = Math.cos(-roll),
    sr = Math.sin(-roll);
  // Ry * Rx * Rz
  m[0] = cy * cr + sy * sp * sr;
  m[1] = -cy * sr + sy * sp * cr;
  m[2] = sy * cp;
  m[3] = cp * sr;
  m[4] = cp * cr;
  m[5] = -sp;
  m[6] = -sy * cr + cy * sp * sr;
  m[7] = sy * sr + cy * sp * cr;
  m[8] = cy * cp;
  return m;
}
const product = new Array(9);
function multiply(o, a, b) {
  const r = product;
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) r[i * 3 + j] = a[i * 3] * b[j] + a[i * 3 + 1] * b[3 + j] + a[i * 3 + 2] * b[6 + j];
  for (let i = 0; i < 9; i++) o[i] = r[i];
  return o;
}
function apply(o, m, x, y, z, origin) {
  return set(
    o,
    m[0] * x + m[1] * y + m[2] * z + (origin ? origin[0] : 0),
    m[3] * x + m[4] * y + m[5] * z + (origin ? origin[1] : 0),
    m[6] * x + m[7] * y + m[8] * z + (origin ? origin[2] : 0)
  );
}

// Two-bone reach: places the middle joint for a limb from root to target, bending toward
// the pole. Targets beyond reach straighten the limb toward them.
const ikTmp = [0, 0, 0];
function reach(joint, end, root, target, l1, l2, pole) {
  let dx = target[0] - root[0],
    dy = target[1] - root[1],
    dz = target[2] - root[2];
  const raw = length(dx, dy, dz) || 1e-6;
  const d = clamp(raw, Math.abs(l1 - l2) + 1e-4, l1 + l2 - 1e-4);
  dx /= raw;
  dy /= raw;
  dz /= raw;
  const a = (l1 * l1 - l2 * l2 + d * d) / (2 * d);
  const h = Math.sqrt(Math.max(0, l1 * l1 - a * a));
  const along = pole[0] * dx + pole[1] * dy + pole[2] * dz;
  set(ikTmp, pole[0] - dx * along, pole[1] - dy * along, pole[2] - dz * along);
  const pl = length(ikTmp[0], ikTmp[1], ikTmp[2]);
  if (pl < 1e-6) set(ikTmp, 0, 0, 1);
  else set(ikTmp, ikTmp[0] / pl, ikTmp[1] / pl, ikTmp[2] / pl);
  set(joint, root[0] + dx * a + ikTmp[0] * h, root[1] + dy * a + ikTmp[1] * h, root[2] + dz * a + ikTmp[2] * h);
  set(end, root[0] + dx * d, root[1] + dy * d, root[2] + dz * d);
}

// ---------------------------------------------------------------------- the rig
function part(type, color) {
  return { type, a: [0, 0, 0], b: [0, 1, 0], r: 0.02, r2: 0.02, r3: 0.02, color, visible: true };
}
function createHuman(look) {
  const parts = {
    torso: part("torso", look.top),
    head: part("ball", look.skin),
    hair: part("ball", look.cap ? CLOTH[look.cap] : look.hair),
    thighL: part("rod", look.bottom),
    thighR: part("rod", look.bottom),
    shinL: part("rod", look.trousers ? look.bottom : look.skin),
    shinR: part("rod", look.trousers ? look.bottom : look.skin),
    footL: part("rod", look.shoes),
    footR: part("rod", look.shoes),
    upperL: part("rod", look.sleeves ? look.top : look.skin),
    upperR: part("rod", look.sleeves ? look.top : look.skin),
    foreL: part("rod", look.skin),
    foreR: part("rod", look.skin),
    handL: part("ball", look.skin),
    handR: part("ball", look.skin),
  };
  return {
    parts,
    list: Object.values(parts),
    look,
    // Joints, reused every frame.
    j: {
      neck: [0, 0, 0],
      head: [0, 0, 0],
      shoulderL: [0, 0, 0],
      shoulderR: [0, 0, 0],
      hipL: [0, 0, 0],
      hipR: [0, 0, 0],
      kneeL: [0, 0, 0],
      kneeR: [0, 0, 0],
      ankleL: [0, 0, 0],
      ankleR: [0, 0, 0],
      elbowL: [0, 0, 0],
      elbowR: [0, 0, 0],
      handL: [0, 0, 0],
      handR: [0, 0, 0],
    },
    torsoM: new Array(9),
    headM: new Array(9),
    spec: {
      pelvis: [0, BODY.hip, 0],
      yaw: 0,
      pitch: 0,
      roll: 0,
      headYaw: 0,
      headPitch: 0,
      footL: [BODY.hipWidth + 0.015, BODY.ankle, 0],
      footR: [-BODY.hipWidth - 0.015, BODY.ankle, 0],
      footYawL: 0,
      footYawR: 0,
      handL: [0.1, 0.27, 0.01],
      handR: [-0.1, 0.27, 0.01],
      kneePole: [0, 0, 1],
      elbowPoleL: [0.3, -0.2, -1],
      elbowPoleR: [-0.3, -0.2, -1],
    },
  };
}
// Neutral standing spec, rewritten in place before each pose.
function standing(spec) {
  set(spec.pelvis, 0, BODY.hip, 0);
  spec.yaw = spec.pitch = spec.roll = spec.headYaw = spec.headPitch = 0;
  set(spec.footL, BODY.hipWidth + 0.015, BODY.ankle, 0);
  set(spec.footR, -BODY.hipWidth - 0.015, BODY.ankle, 0);
  spec.footYawL = 0.12;
  spec.footYawR = -0.12;
  set(spec.handL, 0.1, 0.27, 0.01);
  set(spec.handR, -0.1, 0.27, 0.01);
  set(spec.kneePole, 0, 0, 1);
  set(spec.elbowPoleL, 0.3, -0.2, -1);
  set(spec.elbowPoleR, -0.3, -0.2, -1);
  return spec;
}

const tmpA = [0, 0, 0],
  tmpB = [0, 0, 0],
  headLocal = new Array(9);
// Resolve a spec into joints and primitive parts, all in the figure's own frame.
function solveHuman(h) {
  const { spec, j, parts, torsoM, headM } = h;
  euler(torsoM, spec.yaw, spec.pitch, spec.roll);
  multiply(headM, torsoM, euler(headLocal, spec.headYaw, spec.headPitch, 0));
  const p = spec.pelvis;
  apply(j.neck, torsoM, 0, BODY.torso, 0, p);
  apply(j.shoulderL, torsoM, BODY.shoulder, BODY.torso - BODY.shoulderDrop, 0, p);
  apply(j.shoulderR, torsoM, -BODY.shoulder, BODY.torso - BODY.shoulderDrop, 0, p);
  apply(j.head, headM, 0, 0.078, 0.012, j.neck);
  // Hips follow the pelvis yaw only, so a torso lean does not lift a foot.
  const cy = Math.cos(spec.yaw),
    sy = Math.sin(spec.yaw);
  set(j.hipL, p[0] + cy * BODY.hipWidth, p[1] - 0.012, p[2] - sy * BODY.hipWidth);
  set(j.hipR, p[0] - cy * BODY.hipWidth, p[1] - 0.012, p[2] + sy * BODY.hipWidth);
  reach(j.kneeL, j.ankleL, j.hipL, spec.footL, BODY.thigh, BODY.shin, spec.kneePole);
  reach(j.kneeR, j.ankleR, j.hipR, spec.footR, BODY.thigh, BODY.shin, spec.kneePole);
  reach(j.elbowL, j.handL, j.shoulderL, spec.handL, BODY.upperArm, BODY.forearm, spec.elbowPoleL);
  reach(j.elbowR, j.handR, j.shoulderR, spec.handR, BODY.upperArm, BODY.forearm, spec.elbowPoleR);

  // Torso: from just below the pelvis to the neck.
  apply(parts.torso.a, torsoM, 0, -0.02, 0, p);
  copy(parts.torso.b, j.neck);
  parts.torso.r = RADIUS.torso;
  // Head and a hair cap set slightly back and up.
  copy(parts.head.a, j.head);
  apply(parts.head.b, headM, 0, 1, 0);
  parts.head.r = 0.085;
  parts.head.r2 = 0.075;
  // Hair covers the crown and the back of the head and leaves the face clear.
  apply(parts.hair.a, headM, 0, h.look.cap ? 0.045 : 0.03, h.look.cap ? 0.004 : -0.026, j.head);
  copy(parts.hair.b, parts.head.b);
  parts.hair.r = h.look.cap ? 0.035 : 0.058;
  parts.hair.r2 = h.look.cap ? 0.082 : 0.079;
  limb(parts.thighL, j.hipL, j.kneeL, RADIUS.thigh);
  limb(parts.thighR, j.hipR, j.kneeR, RADIUS.thigh);
  limb(parts.shinL, j.kneeL, j.ankleL, RADIUS.shin);
  limb(parts.shinR, j.kneeR, j.ankleR, RADIUS.shin);
  foot(parts.footL, j.ankleL, spec.yaw + spec.footYawL);
  foot(parts.footR, j.ankleR, spec.yaw + spec.footYawR);
  limb(parts.upperL, j.shoulderL, j.elbowL, RADIUS.upperArm);
  limb(parts.upperR, j.shoulderR, j.elbowR, RADIUS.upperArm);
  limb(parts.foreL, j.elbowL, j.handL, RADIUS.forearm);
  limb(parts.foreR, j.elbowR, j.handR, RADIUS.forearm);
  ball(parts.handL, j.handL, RADIUS.hand);
  ball(parts.handR, j.handR, RADIUS.hand);
}
function limb(p, a, b, r) {
  copy(p.a, a);
  copy(p.b, b);
  p.r = r;
}
function ball(p, at, r, r2 = r) {
  copy(p.a, at);
  set(p.b, 0, 1, 0);
  p.r = r;
  p.r2 = r2;
}
function foot(p, ankle, yaw) {
  // The sole meets the ground under the ankle; the foot points along its yaw.
  set(p.a, ankle[0] - Math.sin(yaw) * 0.012, ankle[1] - BODY.ankle + RADIUS.foot, ankle[2] - Math.cos(yaw) * 0.012);
  set(p.b, p.a[0] + Math.sin(yaw) * BODY.foot, p.a[1], p.a[2] + Math.cos(yaw) * BODY.foot);
  p.r = RADIUS.foot;
}

// ------------------------------------------------------------------- gestures
// Breathing and slow, held glances: a figure looks somewhere for several seconds, then
// turns its head over about a second, never in a constant sweep.
function breathe(t, seed) {
  return Math.sin(t * (TAU / (3.6 + hash(seed) * 1.4)) + seed) * 0.012;
}
function glance(t, seed, angles, hold = 6.5) {
  const span = hold + hash(seed + 3) * 3;
  const k = Math.floor((t + seed * 1.7) / span);
  const u = (t + seed * 1.7) / span - k;
  const from = angles[Math.floor(hash(k + seed) * angles.length)];
  const to = angles[Math.floor(hash(k + 1 + seed) * angles.length)];
  return mix(from, to, smooth((u - 0.82) / 0.16));
}
function pulse(t, period, duty, offset = 0) {
  const u = (((t + offset) % period) + period) % period;
  return u < duty ? Math.sin((Math.PI * u) / duty) : 0;
}

// Walking and running: stance and swing per foot, counter-swinging arms, a small bob.
function gait(spec, phase, stride, weight, run = false) {
  const stance = run ? 0.38 : 0.6;
  const lift = (run ? 0.085 : 0.045) * weight;
  const sw = stride * stance * weight;
  for (const [foot, offset, side] of [
    [spec.footL, 0, 1],
    [spec.footR, 0.5, -1],
  ]) {
    const u = (((phase + offset) % 1) + 1) % 1;
    let z, y;
    if (u < stance) {
      z = sw * (0.5 - u / stance);
      y = 0;
    } else {
      const s = (u - stance) / (1 - stance);
      z = sw * (-0.5 + smooth(s));
      y = lift * Math.sin(Math.PI * s);
    }
    set(foot, side * (BODY.hipWidth + 0.01), BODY.ankle + y, z);
  }
  const zl = spec.footL[2],
    zr = spec.footR[2];
  const bob = (run ? 0.018 : 0.007) * weight;
  set(
    spec.pelvis,
    0.007 * Math.sin(TAU * phase) * weight,
    (run ? BODY.hip - 0.02 : BODY.hip) - bob + bob * Math.cos(2 * TAU * phase),
    run ? 0.03 * weight : 0
  );
  spec.yaw = 0.07 * Math.sin(TAU * phase) * weight;
  spec.pitch = (run ? 0.17 : 0.05) * weight;
  const armSwing = run ? 0.75 : 0.55;
  if (run) {
    set(spec.handL, 0.1, 0.36, 0.09 - armSwing * zl * 0.6);
    set(spec.handR, -0.1, 0.36, 0.09 - armSwing * zr * 0.6);
    set(spec.elbowPoleL, 0.2, -0.6, -1);
    set(spec.elbowPoleR, -0.2, -0.6, -1);
  } else {
    set(spec.handL, 0.105, 0.28, 0.015 - armSwing * zl);
    set(spec.handR, -0.105, 0.28, 0.015 - armSwing * zr);
  }
  set(spec.kneePole, 0, run ? 0.3 : 0, 1);
  spec.footYawL = 0.08;
  spec.footYawR = -0.08;
}

// ------------------------------------------------------------------- actions
// Seated postures share a frame whose origin is the seat top under the hips; `drop` is
// the height from the seat top down to the ground under the feet.
function seated(spec, drop, reachForward = 0.1) {
  standing(spec);
  set(spec.pelvis, 0, 0.035, -0.035);
  const ankle = -drop + BODY.ankle;
  set(spec.footL, BODY.hipWidth + 0.02, ankle, reachForward);
  set(spec.footR, -BODY.hipWidth - 0.02, ankle, reachForward);
  set(spec.kneePole, 0, 0.6, 1);
  set(spec.handL, 0.09, 0.08, 0.1);
  set(spec.handR, -0.09, 0.08, 0.1);
  set(spec.elbowPoleL, 0.4, -0.2, -0.6);
  set(spec.elbowPoleR, -0.4, -0.2, -0.6);
}

const SITTING = {
  rest(spec, t, seed) {
    // Hands on the seat beside the hips, watching the sea.
    set(spec.handL, 0.135, 0.005, -0.02);
    set(spec.handR, -0.135, 0.005, -0.02);
    spec.pitch = 0.03 + breathe(t, seed);
    spec.headYaw = glance(t, seed, [-0.35, 0.05, 0.4]);
    spec.headPitch = -0.05;
  },
  read(spec, t, seed, props) {
    // A book held open at the chest; a page turns now and then.
    spec.pitch = 0.16 + breathe(t, seed) * 0.5;
    spec.headPitch = 0.5;
    const turn = pulse(t, 9.5, 1.1, seed);
    set(spec.handL, 0.06, 0.21, 0.135);
    set(spec.handR, -0.06 + turn * 0.08, 0.215 + turn * 0.015, 0.14);
    if (props) {
      const book = props[0];
      book.type = "box";
      set(book.a, 0, 0.215, 0.15);
      set(book.b, 0, 0.93, -0.36);
      book.r = 0.11;
      book.r2 = 0.075;
      book.r3 = 0.012;
      book.visible = true;
    }
  },
  lean(spec, t, seed) {
    // Leaning back on both hands, face to the sky and the horizon.
    spec.pitch = -0.24 + breathe(t, seed);
    set(spec.handL, 0.12, 0.0, -0.17);
    set(spec.handR, -0.12, 0.0, -0.17);
    set(spec.elbowPoleL, 0.4, 0, 1);
    set(spec.elbowPoleR, -0.4, 0, 1);
    spec.headPitch = -0.25 + 0.08 * Math.sin(t * 0.21 + seed);
    spec.headYaw = glance(t, seed, [-0.3, 0.1, 0.35], 8);
    spec.footL[2] += 0.035;
    spec.footR[2] += 0.025;
  },
  elbows(spec, t, seed) {
    // Forearms on the knees, chin over clasped hands.
    spec.pitch = 0.52 + breathe(t, seed);
    set(spec.handL, 0.025, 0.2, 0.2);
    set(spec.handR, -0.025, 0.2, 0.2);
    set(spec.elbowPoleL, 0.6, -1, 0.2);
    set(spec.elbowPoleR, -0.6, -1, 0.2);
    spec.headPitch = -0.45;
    spec.headYaw = glance(t, seed, [-0.25, 0.2], 7.5);
  },
  laptop(spec, t, seed, props) {
    // Typing on a laptop resting on the thighs.
    spec.pitch = 0.12 + breathe(t, seed) * 0.5;
    spec.headPitch = 0.42;
    const typing = pulse(t, 5.2, 3.4, seed) > 0 ? Math.sin(t * 34) * 0.004 : 0;
    set(spec.handL, 0.045, 0.105 + typing, 0.135);
    set(spec.handR, -0.045, 0.105 - typing, 0.13);
    if (props) {
      const [base, screen] = props;
      base.type = screen.type = "box";
      set(base.a, 0, 0.085, 0.12);
      set(base.b, 0, 1, 0);
      base.r = 0.14;
      base.r2 = 0.1;
      base.r3 = 0.012;
      set(screen.a, 0, 0.137, 0.19);
      set(screen.b, 0, 0.38, -0.92);
      screen.r = 0.14;
      screen.r2 = 0.1;
      screen.r3 = 0.008;
      base.visible = screen.visible = true;
    }
  },
  warm(spec, t, seed) {
    // Palms to the flames; every few seconds the hands rub together.
    spec.pitch = 0.3 + breathe(t, seed);
    const rub = pulse(t, 7.5, 2.6, seed * 2.1);
    const r = rub * Math.sin(t * 17) * 0.02;
    set(spec.handL, 0.06 + r, 0.215, 0.235);
    set(spec.handR, -0.06 + r, 0.215, 0.235);
    set(spec.elbowPoleL, 0.5, -1, 0);
    set(spec.elbowPoleR, -0.5, -1, 0);
    spec.headPitch = 0.22;
    spec.headYaw = glance(t, seed, [0, 0, 0.55, -0.55], 5.5);
  },
  roast(spec, t, seed, props) {
    // Both hands on a long stick, a marshmallow turning over the flames.
    spec.pitch = 0.22 + breathe(t, seed);
    const dip = 0.5 + 0.5 * Math.sin(t * (TAU / 6.2) + seed);
    set(spec.handL, 0.02, 0.2, 0.17);
    set(spec.handR, -0.03, 0.18, 0.13);
    spec.headPitch = 0.3 + dip * 0.1;
    if (props) {
      const [stick, mallow] = props;
      stick.type = "rod";
      const sx = 0,
        sy = 0.19,
        sz = 0.15;
      const angle = -0.32 - dip * 0.08;
      set(stick.a, sx, sy, sz - 0.08);
      set(stick.b, sx + Math.sin(t * 0.7) * 0.01, sy + Math.sin(angle) * 0.56, sz + Math.cos(angle) * 0.56);
      stick.r = 0.0065;
      mallow.type = "ball";
      set(mallow.a, stick.b[0], stick.b[1] - 0.004, stick.b[2]);
      set(mallow.b, 0, 1, 0);
      mallow.r = mallow.r2 = 0.026;
      stick.visible = mallow.visible = true;
    }
  },
};

// ---------------------------------------------------------------------- paths
function preparePath(points) {
  const cumulative = [0];
  for (let i = 1; i < points.length; i++) {
    const [ax, ay, az] = points[i - 1],
      [bx, by, bz] = points[i];
    cumulative.push(cumulative[i - 1] + Math.hypot(bx - ax, by - ay, bz - az));
  }
  return { points, cumulative, length: cumulative.at(-1) };
}
function pointAt(o, path, distance) {
  const d = clamp(distance, 0, path.length);
  let i = 1;
  while (i < path.cumulative.length - 1 && path.cumulative[i] < d) i++;
  const a = path.points[i - 1],
    b = path.points[i];
  const span = path.cumulative[i] - path.cumulative[i - 1] || 1;
  const u = (d - path.cumulative[i - 1]) / span;
  return set(o, mix(a[0], b[0], u), mix(a[1], b[1], u), mix(a[2], b[2], u));
}
const pa = [0, 0, 0],
  pb = [0, 0, 0];
function headingAt(path, distance) {
  pointAt(pa, path, distance - 0.18);
  pointAt(pb, path, distance + 0.18);
  return Math.atan2(pb[0] - pa[0], pb[2] - pa[2]);
}
const wrapAngle = (a) => Math.atan2(Math.sin(a), Math.cos(a));

// Back-and-forth stroll with eased starts, a pause at each end to look out to sea, and a
// turn on the spot. Returns distance along the path, travelled distance, heading, and the
// fraction of walking speed (0 while paused).
const EASE = 0.7;
export function stroll(path, speed, pause, start, t) {
  const walk = path.length / speed + EASE;
  const cycle = 2 * (walk + pause);
  const tt = (((t + start * walk) % cycle) + cycle) % cycle;
  const lap = Math.floor((t + start * walk) / cycle);
  const profile = (tau) => {
    if (tau < EASE) return (speed * tau * tau) / (2 * EASE);
    if (tau > walk - EASE) return path.length - (speed * (walk - tau) ** 2) / (2 * EASE);
    return speed * (tau - EASE / 2);
  };
  const v = (tau) => clamp(Math.min(tau / EASE, (walk - tau) / EASE, 1));
  let along, travelled, heading, weight, turn;
  let direction = 1;
  if (tt < walk) {
    along = profile(tt);
    travelled = lap * 2 * path.length + along;
    heading = headingAt(path, along);
    weight = v(tt);
    turn = 0;
  } else if (tt < walk + pause) {
    along = path.length;
    travelled = lap * 2 * path.length + path.length;
    const out = headingAt(path, path.length),
      back = wrapAngle(out + Math.PI);
    turn = smooth((tt - walk - pause + 1.1) / 1.1);
    heading = out + wrapAngle(back - out) * turn;
    weight = 0;
  } else if (tt < 2 * walk + pause) {
    const tau = tt - walk - pause;
    along = path.length - profile(tau);
    travelled = lap * 2 * path.length + path.length + profile(tau);
    heading = wrapAngle(headingAt(path, along) + Math.PI);
    weight = v(tau);
    turn = 0;
    direction = -1;
  } else {
    along = 0;
    travelled = (lap + 1) * 2 * path.length;
    const out = wrapAngle(headingAt(path, 0) + Math.PI),
      back = headingAt(path, 0);
    turn = smooth((tt - 2 * walk - 2 * pause + 1.1) / 1.1);
    heading = out + wrapAngle(back - out) * turn;
    weight = 0;
  }
  const paused = tt >= walk && tt < walk + pause ? tt - walk : tt - 2 * walk - pause;
  return { along, travelled, heading, weight, direction, paused: weight === 0 ? paused : -1 };
}

// ---------------------------------------------------------------------- actors
const SUN = { x: 0.556, z: -0.667 }; // ground-plane shadow offset per unit height (scene sun)
function shadow(actor, x, y, z, size = 1) {
  const s = actor.shadows[actor.shadowCount++] || (actor.shadows[actor.shadowCount - 1] = { at: [0, 0, 0], size: 1, angle: 0 });
  set(s.at, x + SUN.x * 0.17 * size, y + 0.006, z + SUN.z * 0.17 * size);
  s.size = size;
  s.angle = Math.atan2(SUN.x, SUN.z);
}

// Place a local-frame point into the actor's frame (root + yaw).
function place(o, actor, p) {
  const c = Math.cos(actor.yaw),
    s = Math.sin(actor.yaw);
  return set(o, actor.root[0] + p[0] * c + p[2] * s, actor.root[1] + p[1], actor.root[2] - p[0] * s + p[2] * c);
}

function human(lookIndex) {
  return createHuman(LOOKS[lookIndex % LOOKS.length]);
}

// Each actor owns one or more figures, optional props, and the frame they live in.
function makeActor(figure, index) {
  const seed = index * 1.37 + 0.5;
  const actor = { figure, seed, kind: figure.kind, root: [0, 0, 0], yaw: 0, people: [], props: [], shadows: [], shadowCount: 0, visible: true };
  const add = (lookIndex) => {
    const h = human(lookIndex);
    h.root = [0, 0, 0];
    h.yaw = 0;
    actor.people.push(h);
    return h;
  };
  switch (figure.kind) {
    case "tennis": {
      add(0);
      add(1);
      actor.props = [
        part("rod", PROP.racket),
        part("ball", PROP.racket),
        part("rod", PROP.racket),
        part("ball", PROP.racket),
        part("ball", PROP.tennisBall),
      ];
      break;
    }
    case "volleyball":
      add(2);
      add(3);
      actor.props = [part("ball", PROP.volleyball)];
      break;
    case "fire":
      for (const seat of figure.seats) add(seat.look);
      actor.props = [part("rod", PROP.stick), part("ball", PROP.marshmallow)];
      break;
    case "walker":
      add(figure.look);
      if (figure.pair) add(21);
      actor.path = preparePath(figure.path);
      if (figure.dog) actor.dog = createDog();
      break;
    case "sitter":
      add(figure.look);
      actor.props =
        figure.action === "read" ? [part("box", PROP.book)] : figure.action === "laptop" ? [part("box", PROP.laptop), part("box", PROP.screen)] : [];
      break;
    case "surfer":
    case "swimmer":
    case "sunbather":
      add(figure.look);
      if (figure.kind === "swimmer") {
        actor.path = preparePath(figure.path);
        actor.props = [part("ball", PROP.foam), part("ball", PROP.foam)];
      }
      if (figure.kind === "sunbather") actor.props = [part("box", PROP.book)];
      break;
    default:
      break;
  }
  return actor;
}

export function createCast(figures = []) {
  return figures.map(makeActor);
}

// Horizontal extent an actor can occupy, for skipping people outside the camera's view.
// Surfers follow boards placed by the model, so they report no extent (always posed).
export function actorExtent(figure) {
  const xs = [];
  if (figure.path) xs.push(...figure.path.map((p) => p[0]));
  if (figure.at) xs.push(figure.at[0]);
  if (figure.center) xs.push(figure.center[0]);
  if (figure.court) xs.push(figure.court.center[0] - figure.court.length / 2 - 0.6, figure.court.center[0] + figure.court.length / 2 + 0.6);
  if (figure.seats) xs.push(...figure.seats.map((s) => s.at[0]));
  return xs.length ? [Math.min(...xs) - 0.8, Math.max(...xs) + 0.8] : null;
}

// Every part an actor draws, in pose order.
export function actorParts(actor) {
  const out = [];
  for (const h of actor.people) out.push(...h.list);
  out.push(...actor.props);
  if (actor.dog) out.push(...actor.dog.list);
  return out;
}

// Period used for visibility: night shows evening figures; a daytime preview of the evening
// theme falls back to noon.
export function isVisible(figure, period) {
  return figure.when.includes(period);
}

// ----------------------------------------------------------------- pose dispatch
// Pose every actor at time t. Local-frame parts are transformed to world space except for
// surfers, whose frame is their board (people.mjs applies the board's world matrix).
export function poseActor(actor, t) {
  actor.shadowCount = 0;
  const f = actor.figure;
  switch (f.kind) {
    case "tennis":
      return poseTennis(actor, t);
    case "volleyball":
      return poseVolleyball(actor, t);
    case "fire":
      return poseFire(actor, t);
    case "walker":
      return poseWalker(actor, t);
    case "sitter":
      return poseSitter(actor, t);
    case "surfer":
      return poseSurfer(actor, t);
    case "swimmer":
      return poseSwimmer(actor, t);
    case "sunbather":
      return poseSunbather(actor, t);
    default:
      return actor;
  }
}

// Transform a solved human from its own frame into world space.
const wp = [0, 0, 0];
function commit(h) {
  const c = Math.cos(h.yaw),
    s = Math.sin(h.yaw);
  const tf = (p) => set(p, h.root[0] + p[0] * c + p[2] * s, h.root[1] + p[1], h.root[2] - p[0] * s + p[2] * c);
  const td = (d) => set(d, d[0] * c + d[2] * s, d[1], -d[0] * s + d[2] * c);
  for (const p of h.list) {
    tf(p.a);
    if (p.type === "rod" || p.type === "torso") tf(p.b);
    else td(p.b);
  }
}
function commitProp(p, frame) {
  const c = Math.cos(frame.yaw),
    s = Math.sin(frame.yaw);
  set(wp, frame.root[0] + p.a[0] * c + p.a[2] * s, frame.root[1] + p.a[1], frame.root[2] - p.a[0] * s + p.a[2] * c);
  copy(p.a, wp);
  if (p.type === "rod" || p.type === "torso")
    set(p.b, frame.root[0] + p.b[0] * c + p.b[2] * s, frame.root[1] + p.b[1], frame.root[2] - p.b[0] * s + p.b[2] * c);
  else set(p.b, p.b[0] * c + p.b[2] * s, p.b[1], -p.b[0] * s + p.b[2] * c);
}

// ------------------------------------------------------------------- the rally
// Two players trade crosscourt shots: the ball bounces in the receiver's half, rackets meet
// it at contact, and the receiver shuffles to where the next ball will be.
const RALLY = { shot: 1.25, contactU: 1.95, height: 0.3, bounce: 0.7, apex: 0.46, rebound: 0.16 };
function rallyContact(k) {
  const side = k % 2 === 0 ? -1 : 1;
  return { side, u: side * RALLY.contactU, v: 0.5 * Math.sin(2.39996 * k + 0.7), forehand: true };
}
function strokeFor(k, contact) {
  // Right-handed: player A's right is +v, player B's right is -v.
  const right = contact.side < 0 ? contact.v : -contact.v;
  return right > -0.12;
}
// Contact point in the hitter's frame: forehands meet the ball out to the right and in
// front; backhands on the left.
const FOREHAND = [-0.34, RALLY.height, 0.2],
  BACKHAND = [0.29, RALLY.height, 0.22];
function hitterRoot(o, contact, forehand, court) {
  const local = forehand ? FOREHAND : BACKHAND;
  const yaw = contact.side < 0 ? Math.PI / 2 : -Math.PI / 2;
  const c = Math.cos(yaw),
    s = Math.sin(yaw);
  const du = local[0] * c + local[2] * s,
    dv = -local[0] * s + local[2] * c;
  return set(o, court.center[0] + contact.u - du, court.center[1], court.center[2] + contact.v - dv);
}
const rallyTmp = [0, 0, 0],
  rallyNext = [0, 0, 0];
function ballAt(o, court, t) {
  const k = Math.floor(t / RALLY.shot);
  const s = t / RALLY.shot - k;
  const a = rallyContact(k),
    b = rallyContact(k + 1);
  const u = mix(a.u, b.u, s),
    v = mix(a.v, b.v, s);
  let h;
  if (s < RALLY.bounce) {
    const q = s / RALLY.bounce;
    h = (1 - q) * RALLY.height + q * 0.028 + 4 * RALLY.apex * q * (1 - q);
  } else {
    const q = (s - RALLY.bounce) / (1 - RALLY.bounce);
    h = (1 - q) * 0.028 + q * RALLY.height + 4 * RALLY.rebound * q * (1 - q);
  }
  return set(o, court.center[0] + u, court.center[1] + h, court.center[2] + v);
}
// Rally clock: t = 0 shows the ball above the net and player A finishing a forehand.
const RALLY_START = 0.55 * RALLY.shot;
function swingHand(o, tau, forehand) {
  // Swing angle around the hitting shoulder; 0 points straight ahead, positive toward the
  // player's left. Forehands travel right-to-left, backhands left-to-right.
  const back = forehand ? -2.35 : 2.3,
    contact = forehand ? -0.93 : 0.81,
    finish = forehand ? 1.25 : -1.0,
    ready = forehand ? -0.35 : 0.35;
  let a, y;
  if (tau < -0.62) {
    a = ready;
    y = 0.32;
  } else if (tau < -0.14) {
    const q = smooth((tau + 0.62) / 0.48);
    a = mix(ready, back, q);
    y = mix(0.32, 0.4, q);
  } else if (tau <= 0) {
    // The forward swing passes exactly through the contact angle at tau = 0.
    const q = smooth((tau + 0.14) / 0.14);
    a = mix(back, contact, q);
    y = mix(0.4, RALLY.height, q);
  } else if (tau < 0.06) {
    a = mix(contact, finish, (tau / 0.06) * 0.35);
    y = mix(RALLY.height, 0.36, tau / 0.06);
  } else if (tau < 0.42) {
    const q = smooth((tau - 0.06) / 0.36);
    const start = mix(contact, finish, 0.35);
    a = mix(start, finish, q);
    y = mix(0.36, 0.5, q);
  } else {
    const q = smooth((tau - 0.42) / 0.5);
    a = mix(finish, ready, q);
    y = mix(0.5, 0.32, q);
  }
  // Racket head sits on the radius through the hand; contact puts it on the ball.
  const shoulder = forehand ? -BODY.shoulder : BODY.shoulder;
  const local = forehand ? FOREHAND : BACKHAND;
  const reachOut = Math.hypot(local[0] - shoulder, local[2]) - 0.15;
  set(o, shoulder + reachOut * Math.sin(a), y, reachOut * Math.cos(a));
  return a;
}
function poseTennis(actor, t) {
  const court = actor.figure.court;
  const rt = t + RALLY_START;
  const k = Math.floor(rt / RALLY.shot);
  actor.people.forEach((h, player) => {
    const side = player === 0 ? -1 : 1;
    // This player's previous and next contacts (they hit every other shot).
    const parity = player === 0 ? 0 : 1;
    const prev = k - ((((k - parity) % 2) + 2) % 2);
    const next = prev + 2;
    const prevC = rallyContact(prev),
      nextC = rallyContact(next);
    const prevF = strokeFor(prev, prevC),
      nextF = strokeFor(next, nextC);
    hitterRoot(rallyTmp, prevC, prevF, court);
    hitterRoot(rallyNext, nextC, nextF, court);
    const since = rt - prev * RALLY.shot;
    const until = next * RALLY.shot - rt;
    // Shuffle toward the next contact once the opponent has struck the ball.
    const move = smooth((since - RALLY.shot * 0.95) / (RALLY.shot * 0.85));
    set(h.root, mix(rallyTmp[0], rallyNext[0], move), court.center[1], mix(rallyTmp[2], rallyNext[2], move));
    h.yaw = side < 0 ? Math.PI / 2 : -Math.PI / 2;
    const spec = standing(h.spec);
    // Ready crouch, a split step as the opponent hits, and a quick shuffle.
    const opponentHit = Math.abs(rt - (prev + 1) * RALLY.shot);
    const split = opponentHit < 0.16 ? Math.sin((Math.PI * (0.16 - opponentHit)) / 0.32) * 0.022 : 0;
    const speed = Math.abs(rallyNext[2] - rallyTmp[2]) * (move > 0 && move < 1 ? 1 : 0);
    const shuffle = speed > 0.05 ? Math.abs(Math.sin(rt * 9 + player)) * 0.022 : 0;
    set(spec.pelvis, 0, BODY.hip - 0.022 + split, 0);
    set(spec.footL, 0.115, BODY.ankle + split + (Math.sin(rt * 9 + player) > 0 ? shuffle : 0), 0.01);
    set(spec.footR, -0.115, BODY.ankle + split + (Math.sin(rt * 9 + player) <= 0 ? shuffle : 0), -0.02);
    spec.footYawL = 0.35;
    spec.footYawR = -0.35;
    set(spec.kneePole, 0, 0.2, 1);
    // Swing relative to the nearer of this player's contacts.
    const tau = since < until ? since : -until;
    const forehand = since < until ? prevF : nextF;
    const hand = [0, 0, 0];
    const angle = swingHand(hand, tau, forehand);
    // Shoulders turn with the swing.
    spec.yaw = clamp(angle * 0.42, -0.85, 0.75);
    spec.pitch = 0.16;
    if (forehand) {
      copy(spec.handR, hand);
      set(spec.handL, 0.13 - spec.yaw * 0.05, 0.36, 0.14 + Math.max(0, -spec.yaw) * 0.08);
      set(spec.elbowPoleR, -0.6, -0.5, -0.4);
    } else {
      copy(spec.handR, hand);
      set(spec.handL, hand[0] + 0.03, hand[1] + 0.012, hand[2] - 0.03);
      set(spec.elbowPoleR, 0.2, -0.6, -0.6);
      set(spec.elbowPoleL, 0.6, -0.4, -0.4);
    }
    spec.headYaw = -spec.yaw * 0.8;
    spec.headPitch = 0.05;
    solveHuman(h);
    // Racket along the radius from the hitting shoulder through the hand.
    const handle = actor.props[player * 2],
      head = actor.props[player * 2 + 1];
    const shoulderX = forehand ? -BODY.shoulder : BODY.shoulder;
    let dx = h.j.handR[0] - shoulderX,
      dz = h.j.handR[2];
    const dl = Math.hypot(dx, dz) || 1;
    dx /= dl;
    dz /= dl;
    copy(handle.a, h.j.handR);
    set(handle.b, h.j.handR[0] + dx * 0.085, h.j.handR[1] + 0.008, h.j.handR[2] + dz * 0.085);
    handle.r = 0.007;
    handle.type = "rod";
    head.type = "ball";
    set(head.a, h.j.handR[0] + dx * 0.15, h.j.handR[1] + 0.012, h.j.handR[2] + dz * 0.15);
    set(head.b, -dz, 0.12, dx);
    head.r = 0.009;
    head.r2 = 0.05;
    commit(h);
    commitProp(handle, h);
    commitProp(head, h);
    shadow(actor, h.root[0], h.root[1], h.root[2]);
  });
  ballAt(actor.props[4].a, court, rt);
  set(actor.props[4].b, 0, 1, 0);
  actor.props[4].r = actor.props[4].r2 = 0.028;
  return actor;
}

// ---------------------------------------------------------------- beach volleyball
const PASS = { period: 1.8, contactU: 0.95, height: 0.26, apex: 1.1 };
function passContact(k) {
  const side = k % 2 === 0 ? -1 : 1;
  return { side, u: side * PASS.contactU, v: 0.22 * Math.sin(1.9 * k + 0.4) };
}
function poseVolleyball(actor, t) {
  const court = actor.figure.court;
  const rt = t + PASS.period * 0.5;
  const k = Math.floor(rt / PASS.period);
  const s = rt / PASS.period - k;
  const a = passContact(k),
    b = passContact(k + 1);
  const ball = actor.props[0];
  set(ball.a, court.center[0] + mix(a.u, b.u, s), court.center[1] + PASS.height + 4 * PASS.apex * s * (1 - s), court.center[2] + mix(a.v, b.v, s));
  set(ball.b, 0, 1, 0);
  ball.r = ball.r2 = 0.034;
  actor.people.forEach((h, player) => {
    const side = player === 0 ? -1 : 1;
    const parity = player === 0 ? 0 : 1;
    const prev = k - ((((k - parity) % 2) + 2) % 2);
    const next = prev + 2;
    const since = rt - prev * PASS.period,
      until = next * PASS.period - rt;
    const pv = passContact(prev).v,
      nv = passContact(next).v;
    const move = smooth((since - PASS.period) / (PASS.period * 0.7));
    set(h.root, court.center[0] + side * (PASS.contactU + 0.17), court.center[1], court.center[2] + mix(pv, nv, move));
    h.yaw = side < 0 ? Math.PI / 2 : -Math.PI / 2;
    const spec = standing(h.spec);
    const tau = since < until ? since : -until;
    // Knees load before the ball arrives and extend through the bump.
    const load = smooth((tau + 0.45) / 0.3) * (1 - smooth(tau / 0.12));
    const bump = clamp(1 - Math.abs(tau + 0.05) / 0.38);
    set(spec.pelvis, 0, BODY.hip - 0.03 - load * 0.03 + bump * 0.012, 0.01);
    set(spec.footL, 0.12, BODY.ankle, 0.04);
    set(spec.footR, -0.12, BODY.ankle, -0.03);
    spec.footYawL = 0.3;
    spec.footYawR = -0.3;
    set(spec.kneePole, 0, 0.2, 1);
    spec.pitch = 0.2 + load * 0.15;
    const hx = mix(0.085, 0.012, bump),
      hy = mix(0.31, 0.21, bump),
      hz = mix(0.13, 0.24, bump);
    set(spec.handL, hx, hy, hz);
    set(spec.handR, -hx, hy, hz);
    set(spec.elbowPoleL, 0.6, -0.6, 0);
    set(spec.elbowPoleR, -0.6, -0.6, 0);
    spec.headPitch = -0.2 - bump * 0.25;
    solveHuman(h);
    commit(h);
    shadow(actor, h.root[0], h.root[1], h.root[2]);
  });
  return actor;
}

// ------------------------------------------------------------------ the fire circle
function poseFire(actor, t) {
  const f = actor.figure;
  actor.people.forEach((h, i) => {
    const seat = f.seats[i];
    copy(h.root, seat.at);
    h.yaw = seat.yaw;
    const drop = seat.at[1] - f.center[1];
    seated(h.spec, drop, 0.11);
    const action = SITTING[seat.action] || SITTING.warm;
    action(h.spec, t, actor.seed + i * 2.3, seat.action === "roast" ? actor.props : null);
    solveHuman(h);
    commit(h);
    if (seat.action === "roast") for (const p of actor.props) commitProp(p, h);
    shadow(actor, h.root[0], f.center[1], h.root[2], 0.7);
  });
  return actor;
}

// ------------------------------------------------------------------- benches
function poseSitter(actor, t) {
  const f = actor.figure;
  const h = actor.people[0];
  copy(h.root, f.at);
  h.yaw = f.yaw;
  seated(h.spec, f.at[1] - f.feet);
  (SITTING[f.action] || SITTING.rest)(h.spec, t, actor.seed, actor.props.length ? actor.props : null);
  solveHuman(h);
  commit(h);
  for (const p of actor.props) commitProp(p, h);
  shadow(actor, h.root[0], f.feet, h.root[2], 0.75);
  return actor;
}

// ------------------------------------------------------------------- walkers
const walkPoint = [0, 0, 0];
function poseWalker(actor, t) {
  const f = actor.figure;
  const run = f.gait === "run";
  const state = stroll(actor.path, f.speed, f.pause, f.start ?? 0, t);
  pointAt(walkPoint, actor.path, state.along);
  const stride = run ? 0.56 : f.pair ? 0.34 : 0.38;
  const phase = state.travelled / stride;
  // A couple walks side by side, one half a step ahead so both read from the sea, holding
  // their inner hands. Each keeps the same side of the path through the turns.
  const heading = headingAt(actor.path, state.along);
  const nx = Math.cos(heading),
    nz = -Math.sin(heading);
  const towardSea = nz >= 0 ? 1 : -1;
  const travel = Math.sin(state.heading) * Math.sin(heading) + Math.cos(state.heading) * Math.cos(heading) >= 0 ? 1 : -1;
  actor.people.forEach((h, i) => {
    const lateral = f.pair ? (i === 0 ? 0.075 : -0.075) * towardSea : 0;
    const ahead = f.pair ? (i === 0 ? 0.075 : -0.075) * travel * (state.weight > 0 ? 1 : 0.6) : 0;
    set(h.root, walkPoint[0] + nx * lateral + Math.sin(heading) * ahead, walkPoint[1], walkPoint[2] + nz * lateral + Math.cos(heading) * ahead);
    h.yaw = state.heading;
    const spec = standing(h.spec);
    gait(spec, phase + i * 0.08, stride, state.weight, run);
    if (state.weight === 0) {
      // Paused: weight on one leg, looking out to sea before turning back.
      spec.pitch = 0.02;
      const toSea = wrapAngle(0 - state.heading);
      const look = clamp(toSea, -1.1, 1.1) * smooth((state.paused - 0.3) / 0.8) * (1 - smooth((state.paused - f.pause + 1.3) / 0.6));
      spec.headYaw = look * 0.8;
      spec.yaw = look * 0.25;
      spec.pelvis[0] = 0.012;
    } else {
      spec.headYaw = glance(t, actor.seed + i, [0, 0, 0.35], 7) * (run ? 0.3 : 1);
    }
  });
  if (f.pair) {
    // Inner hands meet halfway between the two walkers.
    const [a, b] = actor.people;
    for (const [h, other] of [
      [a, b],
      [b, a],
    ]) {
      const dx = other.root[0] - h.root[0],
        dz = other.root[2] - h.root[2];
      const c = Math.cos(h.yaw),
        s = Math.sin(h.yaw);
      const lx = dx * c - dz * s,
        lz = dx * s + dz * c;
      const hand = lx >= 0 ? h.spec.handL : h.spec.handR;
      set(hand, lx * 0.5, 0.275, lz * 0.5 + 0.02);
    }
  }
  for (const h of actor.people) {
    solveHuman(h);
    commit(h);
    shadow(actor, h.root[0], h.root[1], h.root[2]);
  }
  if (actor.dog) poseDog(actor, t, state);
  return actor;
}

// ----------------------------------------------------------------------- dog
function createDog() {
  const p = (type, color) => part(type, color);
  const parts = {
    body: p("ball", PROP.dog),
    chest: p("ball", PROP.dog),
    head: p("ball", PROP.dog),
    snout: p("ball", PROP.dog),
    nose: p("ball", PROP.dogDark),
    earL: p("ball", PROP.dogDark),
    earR: p("ball", PROP.dogDark),
    tail: p("rod", PROP.dog),
    legFL: p("rod", PROP.dog),
    legFR: p("rod", PROP.dog),
    legBL: p("rod", PROP.dog),
    legBR: p("rod", PROP.dog),
  };
  return { parts, list: Object.values(parts), root: [0, 0, 0], yaw: 0, last: null };
}
const dogTmp = [0, 0, 0],
  dogPrev = [0, 0, 0];
function dogPosition(o, actor, t) {
  const f = actor.figure;
  const s = stroll(actor.path, f.speed, f.pause, f.start ?? 0, t);
  // The dog trots a little ahead; while the walker pauses it circles round to the new front.
  let lead;
  if (s.weight > 0) lead = 0.32 * s.direction;
  else {
    const atEnd = s.along > actor.path.length / 2;
    const q = smooth((s.paused - 0.4) / Math.max(0.5, f.pause - 0.9));
    lead = atEnd ? mix(0.32, -0.32, q) : mix(-0.32, 0.32, q);
  }
  pointAt(o, actor.path, clamp(s.along + lead, 0, actor.path.length));
  // Landward of the walker (the beach runs along x, the sea lies toward +z), swinging
  // wider as it passes behind them to the new front.
  const passing = s.weight > 0 ? 0 : Math.sin(Math.PI * clamp(1 - Math.abs(lead) / 0.32));
  o[2] -= 0.2 + passing * 0.18;
  return o;
}
function poseDog(actor, t) {
  const dog = actor.dog;
  dogPosition(dogTmp, actor, t);
  dogPosition(dogPrev, actor, t - 0.12);
  const dx = dogTmp[0] - dogPrev[0],
    dz = dogTmp[2] - dogPrev[2];
  const speed = Math.hypot(dx, dz) / 0.12;
  if (speed > 0.02) dog.yaw = Math.atan2(dx, dz);
  else if (dog.last == null) dog.yaw = Math.atan2(1, 0);
  dog.last = dog.yaw;
  copy(dog.root, dogTmp);
  const gaitWeight = clamp(speed / 0.25);
  const phase = t * 2.6;
  const P = dog.parts;
  const bob = 0.008 * Math.abs(Math.sin(TAU * phase)) * gaitWeight;
  // Sniff while standing still: the head dips toward the sand.
  const sniff = gaitWeight < 0.2 ? smooth(Math.sin(t * 0.9 + actor.seed) * 0.5 + 0.5) : 0;
  const bodyY = 0.15 + bob;
  set(P.body.a, 0, bodyY, -0.02);
  set(P.body.b, 0, 0, 1);
  P.body.r = 0.12;
  P.body.r2 = 0.058;
  set(P.chest.a, 0, bodyY + 0.01, 0.07);
  set(P.chest.b, 0, 0.3, 1);
  P.chest.r = 0.06;
  P.chest.r2 = 0.062;
  const hy = bodyY + 0.07 - sniff * 0.12,
    hz = 0.15 + sniff * 0.03;
  set(P.head.a, 0, hy, hz);
  set(P.head.b, 0, 0.2, 1);
  P.head.r = 0.05;
  P.head.r2 = 0.045;
  set(P.snout.a, 0, hy - 0.012, hz + 0.05);
  set(P.snout.b, 0, -0.2 - sniff * 0.6, 1);
  P.snout.r = 0.038;
  P.snout.r2 = 0.024;
  set(P.nose.a, 0, hy - 0.01 - sniff * 0.02, hz + 0.088);
  set(P.nose.b, 0, 1, 0);
  P.nose.r = P.nose.r2 = 0.012;
  for (const [ear, s] of [
    [P.earL, 1],
    [P.earR, -1],
  ]) {
    set(ear.a, s * 0.036, hy + 0.02, hz - 0.012);
    set(ear.b, s * 0.4, -1, 0);
    ear.r = 0.032;
    ear.r2 = 0.016;
  }
  const wag = Math.sin(t * (gaitWeight > 0.2 ? 11 : 14)) * 0.5;
  set(P.tail.a, 0, bodyY + 0.03, -0.13);
  set(P.tail.b, Math.sin(wag) * 0.09, bodyY + 0.09, -0.13 - Math.cos(wag) * 0.06);
  P.tail.r = 0.013;
  // Trot: diagonal pairs swing together.
  for (const [leg, x, z, offset] of [
    [P.legFL, 0.035, 0.08, 0],
    [P.legBR, -0.035, -0.1, 0],
    [P.legFR, -0.035, 0.08, 0.5],
    [P.legBL, 0.035, -0.1, 0.5],
  ]) {
    const u = phase + offset;
    const swing = Math.sin(TAU * u) * 0.05 * gaitWeight;
    const lift = Math.max(0, Math.cos(TAU * u)) * 0.025 * gaitWeight;
    set(leg.a, x, bodyY - 0.02, z);
    set(leg.b, x, 0.006 + lift, z + swing);
    leg.r = 0.014;
  }
  // Place in the world.
  const c = Math.cos(dog.yaw),
    s = Math.sin(dog.yaw);
  const tf = (p) => set(p, dog.root[0] + p[0] * c + p[2] * s, dog.root[1] + p[1], dog.root[2] - p[0] * s + p[2] * c);
  const td = (d) => set(d, d[0] * c + d[2] * s, d[1], -d[0] * s + d[2] * c);
  for (const p of dog.list) {
    tf(p.a);
    if (p.type === "rod") tf(p.b);
    else td(p.b);
  }
  shadow(actor, dog.root[0], dog.root[1], dog.root[2], 0.6);
}

// -------------------------------------------------------------------- surfers
// Surfers live in their board's frame (x along the board, y up, z to the side); people.mjs
// multiplies these parts by the board's world matrix.
const BOARD_TOP = 0.043;
function poseSurfer(actor, t) {
  const h = actor.people[0];
  const stance = actor.figure.stance;
  const spec = standing(h.spec);
  set(h.root, 0, 0, 0);
  h.yaw = 0;
  const seed = actor.seed;
  if (stance === "ride") {
    // Side-on, knees bent, arms out for balance, looking toward the nose.
    const sway = Math.sin(t * 1.7 + seed) * 0.03;
    set(spec.pelvis, sway * 0.4, BOARD_TOP + 0.255 + Math.sin(t * 2.3 + seed) * 0.008, 0);
    set(spec.footL, 0.19, BOARD_TOP + BODY.ankle, 0.02);
    set(spec.footR, -0.19, BOARD_TOP + BODY.ankle, -0.01);
    spec.footYawL = 1.2;
    spec.footYawR = 1.35;
    set(spec.kneePole, 0, 0.3, 1);
    spec.yaw = 0.35;
    spec.pitch = 0.3;
    spec.roll = sway;
    set(spec.handL, 0.34, 0.43 + sway, 0.06);
    set(spec.handR, -0.31, 0.4 - sway, -0.04);
    set(spec.elbowPoleL, 0.2, -1, 0.2);
    set(spec.elbowPoleR, -0.2, -1, 0.2);
    spec.headYaw = 0.75;
    spec.headPitch = 0.05;
  } else if (stance === "wait") {
    // Sitting astride the board facing out to sea, legs in the water.
    h.yaw = Math.PI / 2;
    set(spec.pelvis, 0, BOARD_TOP + 0.03, -0.12);
    set(spec.footL, 0.15, -0.17, 0.02);
    set(spec.footR, -0.15, -0.17, 0.0);
    set(spec.kneePole, 0.4, 0, 1);
    spec.pitch = 0.04 + breathe(t, seed);
    spec.roll = Math.sin(t * 0.9 + seed) * 0.04;
    set(spec.handL, 0.06, BOARD_TOP + 0.02, 0.08);
    set(spec.handR, -0.06, BOARD_TOP + 0.02, 0.08);
    set(spec.elbowPoleL, 0.5, 0, -1);
    set(spec.elbowPoleR, -0.5, 0, -1);
    spec.headYaw = glance(t, seed, [-0.7, -0.2, 0.3, 0.8], 5);
    spec.headPitch = -0.08;
  } else {
    // Lying prone and paddling, head up.
    h.yaw = Math.PI / 2;
    const phase = t * 0.55;
    set(spec.pelvis, 0, BOARD_TOP + 0.05, -0.16);
    spec.pitch = 1.42;
    spec.headPitch = -1.15;
    set(spec.footL, 0.05, BOARD_TOP + 0.04, -0.47);
    set(spec.footR, -0.05, BOARD_TOP + 0.045, -0.46);
    set(spec.kneePole, 0, -1, 0);
    for (const [hand, s, offset] of [
      [spec.handL, 1, 0],
      [spec.handR, -1, 0.5],
    ]) {
      const u = (((phase + offset) % 1) + 1) % 1;
      if (u < 0.55) {
        const q = u / 0.55;
        set(hand, s * 0.15, -0.07 - Math.sin(Math.PI * q) * 0.03, mix(0.24, -0.06, q));
      } else {
        const q = (u - 0.55) / 0.45;
        set(hand, s * mix(0.15, 0.2, Math.sin(Math.PI * q)), -0.05 + Math.sin(Math.PI * q) * 0.13, mix(-0.06, 0.24, smooth(q)));
      }
    }
    set(spec.elbowPoleL, 1, 1, -0.3);
    set(spec.elbowPoleR, -1, 1, -0.3);
  }
  solveHuman(h);
  commit(h);
  return actor;
}

// -------------------------------------------------------------------- swimmer
function poseSwimmer(actor, t) {
  const f = actor.figure;
  const h = actor.people[0];
  const state = stroll(actor.path, f.speed, 2.4, 0.35, t);
  pointAt(h.root, actor.path, state.along);
  const wave = sampleCoastWave(h.root[0], h.root[2], t);
  h.root[1] = 0.04 + wave.height;
  h.yaw = state.heading;
  const spec = standing(h.spec);
  const phase = t * 0.62;
  const moving = state.weight > 0.05 ? 1 : 0;
  set(spec.pelvis, 0, -0.07, -0.22);
  spec.pitch = 1.38;
  const roll = Math.sin(TAU * phase) * 0.45 * moving;
  spec.roll = roll;
  // Breathe to one side every second stroke.
  const breath = moving ? Math.max(0, Math.sin(TAU * phase * 0.5)) ** 4 : 0;
  spec.headPitch = -1.25 + breath * 0.25;
  spec.headYaw = breath * 0.9;
  set(spec.footL, 0.05, -0.08 + Math.sin(t * 7) * 0.02 * moving, -0.6);
  set(spec.footR, -0.05, -0.08 - Math.sin(t * 7) * 0.02 * moving, -0.6);
  set(spec.kneePole, 0, -1, 0);
  for (const [hand, s, offset] of [
    [spec.handL, 1, 0],
    [spec.handR, -1, 0.5],
  ]) {
    const u = (((phase + offset) % 1) + 1) % 1;
    if (!moving) set(hand, s * 0.16, -0.03, 0.1);
    else if (u < 0.5) {
      const q = u / 0.5;
      set(hand, s * 0.1, -0.12 - Math.sin(Math.PI * q) * 0.04, mix(0.18, -0.2, q));
    } else {
      const q = (u - 0.5) / 0.5;
      set(hand, s * 0.16, -0.02 + Math.sin(Math.PI * q) * 0.14, mix(-0.2, 0.2, smooth(q)));
    }
  }
  set(spec.elbowPoleL, 1, 1, 0);
  set(spec.elbowPoleR, -1, 1, 0);
  solveHuman(h);
  commit(h);
  // Splashes at the hand entering the water and at the kicking feet.
  const [splash, kick] = actor.props;
  place(splash.a, h, spec.handL[2] > spec.handR[2] ? h.j.handL : h.j.handR);
  splash.a[1] = h.root[1] + 0.01;
  set(splash.b, 0, 1, 0);
  splash.r = 0.012 * moving;
  splash.r2 = 0.05 * moving;
  place(kick.a, h, [0, 0.01, -0.62]);
  set(kick.b, 0, 1, 0);
  kick.r = 0.01 * moving;
  kick.r2 = 0.045 * moving;
  splash.visible = kick.visible = moving > 0;
  return actor;
}

// ------------------------------------------------------------------ sunbather
function poseSunbather(actor, t) {
  const f = actor.figure;
  const h = actor.people[0];
  copy(h.root, f.at);
  h.yaw = f.yaw;
  const spec = standing(h.spec);
  // Lying on the towel propped on the elbows, reading; feet swing lazily.
  set(spec.pelvis, 0, 0.05, -0.1);
  spec.pitch = 1.33;
  spec.headPitch = -0.55 + Math.sin(t * 0.3 + actor.seed) * 0.05;
  const swing = (Math.sin(t * (TAU / 3.4) + actor.seed) * 0.5 + 0.5) * 0.12;
  set(spec.footL, 0.05, 0.04 + swing, -0.43 + swing * 0.5);
  set(spec.footR, -0.05, 0.04 + (0.12 - swing), -0.43 + (0.12 - swing) * 0.5);
  set(spec.kneePole, 0, -1, 0);
  set(spec.handL, 0.055, 0.035, 0.27);
  set(spec.handR, -0.055, 0.035, 0.27);
  set(spec.elbowPoleL, 0.4, -1, 0);
  set(spec.elbowPoleR, -0.4, -1, 0);
  solveHuman(h);
  commit(h);
  const book = actor.props[0];
  book.type = "box";
  set(book.a, 0, 0.03, 0.3);
  set(book.b, 0, 1, -0.4);
  book.r = 0.1;
  book.r2 = 0.07;
  book.r3 = 0.012;
  commitProp(book, h);
  return actor;
}
