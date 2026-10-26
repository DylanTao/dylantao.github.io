// How Sirui eats and drinks at a setting (Sirui, 2026-10-24: "the coffee drinking and food eating
// thing is very robotic"). Pure functions of a plan and a time: no scene and no three.js, so the
// choreography is testable on its own and deterministic for previews, pause and composed stills.
//
// A meal is a plan of actions drawn from a seeded stream (date, meal, session): bites, cuts, sips,
// pauses, the swap from the main course to dessert, and a lingering finish. Each action is built
// from beats with anticipation and follow-through: the body leans before the hand arrives, the head
// comes forward to meet the fork, the hand settles a touch past its stop, chewing fades into a
// swallow. Durations and the order of actions vary by draw, so minutes of watching show no loop.
//
// Coordinates are the seated actor's local frame in metres: +x toward the HandR side (the diner's
// left as authored), +y up, +z forward. The runtime (dining.mjs) supplies `anchors` measured from
// the avatar each frame (the mouth) and `layout` measured from the room (the table surface, each
// item's home and the dish's bite points), and turns these poses into hand targets.
//
// A pose names, per hand, one of:
//   { mode: "hold", tip, dir, up }  a utensil whose working end is at `tip`, pointing along `dir`;
//   { mode: "vessel", base, tilt, toward }  a glass or cup standing at `base`, tipped by `tilt`
//                                   radians toward `toward` (the lips);
//   { mode: "rest", palm, dir }      the palm flat at `palm` (on the table), fingers along `dir`;
//   null                             leave the authored clip's arm as it is.
// `reach` (0-1) on any of them blends from the clip's own hand to the target.

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const clamp01 = (v) => clamp(v, 0, 1);
// Minimum-jerk easing: zero velocity and acceleration at both ends, the profile of a human reach.
export const smooth = (t) => {
  t = clamp01(t);
  return t * t * t * (t * (t * 6 - 15) + 10);
};
const easeOut = (t) => 1 - (1 - clamp01(t)) ** 3;
// Arrives, overshoots by `overshoot` of the travel and settles back: follow-through after a stop.
const settle = (t, overshoot = 0.06) => {
  t = clamp01(t);
  return smooth(t) + overshoot * Math.sin(Math.PI * smooth(t)) * Math.sin(Math.PI * t * 0.5);
};
const lerp = (a, b, t) => a + (b - a) * t;
export const vlerp = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
export const vadd = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
export const vsub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const vlen = (a) => Math.hypot(a[0], a[1], a[2]);
export const vnorm = (a) => {
  const l = vlen(a) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
};
// A quadratic Bezier lifted by `lift` at its middle: a path over the table, not through the food.
const arc = (a, b, lift, t) => {
  const mid = vadd(vlerp(a, b, 0.5), [0, lift, 0]);
  const u = 1 - t;
  return [0, 1, 2].map((i) => u * u * a[i] + 2 * u * t * mid[i] + t * t * b[i]);
};
const dirLerp = (a, b, t) => vnorm(vlerp(a, b, t));

// A small, well-distributed PRNG (mulberry32) and a string hash for its seed.
export function hashString(text) {
  let h = 2166136261 >>> 0;
  for (const c of String(text)) h = Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0;
  return h >>> 0;
}
export function random(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Beat lengths in seconds, [min, max]; each action draws its own within them.
export const BEATS = Object.freeze({
  reach: [0.62, 0.9],
  take: [0.3, 0.42],
  lift: [0.74, 0.96],
  mouth: [0.28, 0.38],
  withdraw: [0.46, 0.64],
  chew: [2.8, 4.6],
  swallow: [0.32, 0.44],
  cutReach: [0.55, 0.7],
  saw: [0.24, 0.31],
  sipReach: [0.72, 0.92],
  grasp: [0.18, 0.26],
  sipLift: [0.7, 0.88],
  drink: [1.1, 1.75],
  sipLower: [0.7, 0.86],
  release: [0.2, 0.3],
  sipReturn: [0.55, 0.72],
  pause: [2.6, 6.4],
  linger: [6.0, 12.0],
  swapReach: [0.65, 0.82],
  slide: [1.0, 1.35],
  pickUp: [0.72, 0.92],
  putDown: [0.5, 0.66],
});

// The meal's shape by its progress through the routine's window (0 at its first minute, 1 at the
// next activity): which course is on the table and how much of it is left when a visitor arrives.
export const COURSE_WINDOWS = Object.freeze({
  dinner: Object.freeze([
    ["settle", 0, 0.04],
    ["main", 0.04, 0.62],
    ["dessert", 0.62, 0.86],
    ["linger", 0.86, 1],
  ]),
  lunch: Object.freeze([
    ["settle", 0, 0.05],
    ["main", 0.05, 0.86],
    ["linger", 0.86, 1],
  ]),
  breakfast: Object.freeze([
    ["settle", 0, 0.02],
    ["main", 0.02, 0.8],
    ["linger", 0.8, 1],
  ]),
  evening: Object.freeze([["linger", 0, 1]]),
});

export function stageAt(meal, progress) {
  const windows = COURSE_WINDOWS[meal] || COURSE_WINDOWS.evening;
  const p = clamp01(Number.isFinite(progress) ? progress : 0);
  const [stage, from, to] = windows.find(([, a, b]) => p >= a && p < b) || windows[windows.length - 1];
  return { stage, within: to > from ? clamp01((p - from) / (to - from)) : 1 };
}

// The plan: a deterministic list of actions from the visitor's arrival.
//   meal: "breakfast" | "lunch" | "dinner" | "evening"
//   bites: { main, dessert } pieces on each plate, from the dish models
//   utensil / dessertUtensil: "fork" | "spoon" | "chopsticks"
//   knife: whether the main course is cut before some bites
//   vessel: what is drunk between bites ("glass", "cup", or null); `sameHand` puts the utensil
//     down to drink with the same hand (breakfast coffee), otherwise the other hand drinks
//   progress: the meal's progress at arrival (see COURSE_WINDOWS)
export function planMeal({
  meal = "dinner",
  seed = 1,
  progress = 0,
  bites = {},
  utensil = "fork",
  dessertUtensil = "spoon",
  knife = false,
  vessel = "glass",
  sameHand = false,
  prelude = 0,
  horizon = 1800,
  pauseScale = 1,
} = {}) {
  const draw = random(seed);
  const span = (beat) => lerp(BEATS[beat][0], BEATS[beat][1], draw());
  const mainCount = Math.max(0, Math.round(bites.main || 0));
  const dessertCount = meal === "dinner" ? Math.max(0, Math.round(bites.dessert || 0)) : 0;
  let { stage: course, within } = stageAt(meal, progress);
  const remaining = { main: 0, dessert: 0 };
  if (course === "settle") Object.assign(remaining, { main: mainCount, dessert: dessertCount });
  else if (course === "main") Object.assign(remaining, { main: Math.max(1, Math.round(mainCount * (1 - within))), dessert: dessertCount });
  else if (course === "dessert") remaining.dessert = Math.max(1, Math.round(dessertCount * (1 - within)));
  if (course === "main" && !remaining.main) course = remaining.dessert ? "dessert" : "linger";
  if (course === "dessert" && !remaining.dessert) course = "linger";
  const start = {
    main: Math.min(remaining.main, mainCount),
    dessert: Math.min(remaining.dessert, dessertCount),
    course,
    swapped: meal === "dinner" && dessertCount > 0 && (course === "dessert" || course === "linger"),
    // The utensil is in the hand at arrival unless the visitor arrives as he sits down.
    holding: course === "main" || course === "dessert",
  };
  const actions = [];
  let t = 0,
    sinceSip = Math.floor(draw() * 2),
    sincePause = Math.floor(draw() * 3);
  const push = (action) => {
    action.start = t;
    action.end = t + action.beats.reduce((sum, [, d]) => sum + d, 0);
    t = action.end;
    actions.push(action);
  };
  const sip = () => {
    if (!vessel) return;
    const beats = [];
    const eating = course === "main" || course === "dessert";
    if (sameHand && eating) beats.push(["putDown", span("putDown")]);
    // The knife hand lays its knife on the plate's rim before it takes the glass.
    const knifeHand = !sameHand && knife && course === "main";
    if (knifeHand) beats.push(["knifeDown", span("putDown")]);
    beats.push(
      ["reach", span("sipReach")],
      ["grasp", span("grasp")],
      ["lift", span("sipLift")],
      ["drink", span("drink")],
      ["lower", span("sipLower")],
      ["release", span("release")],
      ["return", span("sipReturn")]
    );
    if (sameHand && eating) beats.push(["pickUp", span("pickUp")]);
    if (knifeHand) beats.push(["knifeUp", span("pickUp")]);
    push({ type: "sip", vessel, sameHand, knifeHand, beats });
  };
  const pause = (long = false) => {
    const roll = draw();
    push({
      type: "pause",
      gaze: roll < 0.58 ? "sea" : roll < 0.82 ? "room" : "plate",
      beats: [["rest", (long ? span("linger") : span("pause")) * pauseScale]],
    });
  };
  // Breakfast's first minute: the fresh coffee stays in the hand while he looks out, sips, and
  // only then sets it on its saucer and takes up the fork.
  if (prelude > 0 && vessel) {
    const end = prelude - BEATS.putDown[1] - BEATS.release[1];
    while (t < end - 4) {
      const roll = draw();
      push({ type: "hold", gaze: roll < 0.7 ? "sea" : "room", beats: [["rest", Math.min(end - t - 3.6, 1.3 * span("pause"))]] });
      if (t < end - 3.6)
        push({
          type: "sipHeld",
          beats: [
            ["lift", span("sipLift")],
            ["drink", span("drink")],
            ["lower", span("sipLower")],
          ],
        });
    }
    push({
      type: "setCup",
      beats: [
        ["lower", Math.max(0.6, end - t)],
        ["release", span("release")],
        ["return", span("sipReturn")],
      ],
    });
  }
  while (t < horizon && actions.length < 4000) {
    if (course === "settle") {
      push({
        type: "pickup",
        beats: [
          ["reach", span("pickUp")],
          ["lift", span("take") + 0.2],
        ],
      });
      if (vessel && !sameHand) sip();
      course = remaining.main ? "main" : remaining.dessert ? "dessert" : "linger";
      continue;
    }
    if ((course === "main" && !remaining.main) || (course === "dessert" && !remaining.dessert)) {
      if (course === "main" && remaining.dessert) {
        pause();
        push({
          type: "swap",
          beats: [
            ["putDown", span("putDown")],
            ["reach", span("swapReach")],
            ["push", span("slide")],
            ["reach2", span("swapReach")],
            ["pull", span("slide")],
            ["pickUp", span("pickUp")],
          ],
        });
        course = "dessert";
        continue;
      }
      if (course !== "linger")
        push({
          type: "finish",
          beats: [
            ["putDown", span("putDown")],
            ["rest", span("pause")],
          ],
        });
      course = "linger";
    }
    if (course === "linger") {
      // The plate is finished: long looks at the sea and, now and then, a sip.
      pause(true);
      if (vessel && draw() < 0.7) sip();
      continue;
    }
    const plate = course;
    const cut = plate === "main" && knife && draw() < 0.72;
    const beats = [];
    if (cut) beats.push(["cutReach", span("cutReach")], ["saw", span("saw")], ["saw", span("saw")], ["saw", span("saw")]);
    beats.push(
      ["reach", span("reach")],
      ["take", span("take")],
      ["lift", span("lift")],
      ["mouth", span("mouth")],
      ["withdraw", span("withdraw")],
      ["chew", span("chew")],
      ["swallow", span("swallow")]
    );
    const total = plate === "main" ? mainCount : dessertCount;
    push({ type: "bite", plate, index: total - remaining[plate], utensil: plate === "main" ? utensil : dessertUtensil, cut, beats });
    remaining[plate]--;
    sinceSip++;
    sincePause++;
    if (vessel && sinceSip >= 2 + Math.floor(draw() * 3)) {
      sip();
      sinceSip = 0;
    } else if (sincePause >= 3 + Math.floor(draw() * 3)) {
      pause();
      sincePause = 0;
    }
  }
  return {
    meal,
    seed,
    start,
    actions,
    horizon: t,
    utensil,
    dessertUtensil,
    knife,
    vessel,
    sameHand,
    counts: { main: mainCount, dessert: dessertCount },
  };
}

export function findAction(plan, t) {
  const list = plan.actions;
  if (!list.length) return null;
  if (t >= list[list.length - 1].end) return list[list.length - 1];
  let lo = 0,
    hi = list.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (list[mid].end <= t) lo = mid + 1;
    else hi = mid;
  }
  return list[lo];
}

export function beatAt(action, t) {
  let at = action.start;
  for (let i = 0; i < action.beats.length; i++) {
    const [name, d] = action.beats[i];
    if (t < at + d || i === action.beats.length - 1) return { name, u: clamp01((t - at) / d), index: i, seconds: Math.max(0, t - at), duration: d };
    at += d;
  }
  return null;
}

const passed = (action, t, name) => {
  let at = action.start;
  for (const [beat, d] of action.beats) {
    if (beat === name) return t >= at;
    at += d;
  }
  return false;
};

// What is on each plate at time t: a piece leaves the plate as the utensil takes it.
export function remainingAt(plan, t) {
  const left = { main: plan.start.main, dessert: plan.start.dessert };
  let onUtensil = null,
    swapped = plan.start.swapped;
  for (const action of plan.actions) {
    if (action.start > t) break;
    if (action.type === "swap") {
      if (passed(action, t, "pull")) swapped = true;
      continue;
    }
    if (action.type !== "bite") continue;
    if (!passed(action, t, "take")) continue;
    left[action.plate] = Math.max(0, left[action.plate] - 1);
    const beat = t < action.end ? beatAt(action, t) : null;
    if (beat && (beat.name === "take" || beat.name === "lift" || (beat.name === "mouth" && beat.u < 0.55)))
      onUtensil = { plate: action.plate, index: action.index };
  }
  return { ...left, onUtensil, swapped };
}

// The liquid's level (0-1 of the vessel's working height): each "drink" beat draws a sip of what
// is left, so a long evening never empties the glass and nothing refills it in view.
export function levelAt(plan, t, { start = 0.8, perSip = 0.13, floor = 0.16 } = {}) {
  let level = start;
  for (const action of plan.actions) {
    if (action.start > t) break;
    if (action.type !== "sip" && action.type !== "sipHeld") continue;
    let at = action.start,
      drinkStart = 0,
      drinkLength = 1;
    for (const [beat, d] of action.beats) {
      if (beat === "drink") {
        drinkStart = at;
        drinkLength = d;
        break;
      }
      at += d;
    }
    level -= (level - floor) * perSip * smooth((t - drinkStart) / drinkLength);
  }
  return clamp(level, 0, 1);
}

// The table's near edge under x, from the layout's measured profile ([[x, z], ...] in the seat
// frame, sorted by x), or null where the setting has none.
export function edgeAt(edge, x) {
  if (!edge?.length) return null;
  if (x <= edge[0][0]) return edge[0][1];
  for (let i = 1; i < edge.length; i++)
    if (x <= edge[i][0]) {
      const [x0, z0] = edge[i - 1],
        [x1, z1] = edge[i];
      return z0 + ((z1 - z0) * (x - x0)) / Math.max(1e-6, x1 - x0);
    }
  return edge[edge.length - 1][1];
}
const REST_INSET = 0.13;
function onTable(layout, point) {
  const edge = edgeAt(layout.edge, point[0]);
  return edge == null ? point : [point[0], point[1], Math.max(point[2], edge + REST_INSET)];
}

// Where hands and items live, from the layout.
function homes(layout, plates) {
  const y = layout.surface;
  const course = (name) => plates[name] || layout.plate;
  // A plate's rim height: the dinner plate stands on the nook's own plate while that is there.
  const rimOf = (name) => (name === "main" ? (layout.charger || 0) + 0.022 : 0.018);
  return {
    y,
    at: (xz, lift = 0) => [xz[0], y + lift, xz[1]],
    // The utensil held low over the near rim, tines toward the food.
    utensilRest: (name) => [course(name)[0] + 0.075, y + 0.04, course(name)[1] - 0.075],
    utensilDir: vnorm([-0.34, -0.52, 0.78]),
    // The free hand flat on the table beside the plate, fingers toward its far side, and at least
    // 13 cm in from the table's near edge, so the wrist and forearm lie on the top, not over the edge.
    palmRest: (name) => onTable(layout, [course(name)[0] - 0.22, y, course(name)[1] - 0.1]),
    // The utensil hand at rest, on its own side, clear of the napkin and the cutlery on it.
    palmRestR: (name) => onTable(layout, [course(name)[0] + 0.21, y, course(name)[1] - 0.125]),
    palmDir: vnorm([0.28, 0, 1]),
    // The utensil laid with its handle on the plate's rim while the hand is busy, or done.
    utensilDown: (name) => [course(name)[0] + 0.07, y + rimOf(name) - 0.006, course(name)[1] + 0.02],
    utensilDownDir: vnorm([-0.45, -0.08, 0.89]),
    // The knife held ready at the plate's right, and laid on its rim.
    knifeHeld: (name) => [course(name)[0] - 0.1, y + 0.035, course(name)[1] - 0.045],
    knifeDown: (name) => [course(name)[0] - 0.06, y + rimOf(name) - 0.006, course(name)[1] + 0.025],
    knifeDownDir: vnorm([0.5, -0.06, 0.86]),
    // The dessert spoon waits across the top of the setting.
    dessertHome: [layout.plate[0] + 0.07, y + 0.006, layout.plate[1] + 0.165],
  };
}

// The pose at time t; every vector is actor-local and directions are unit vectors.
//   anchors: { mouth: [x,y,z] } measured from the avatar this frame
//   layout: { surface, plate, dessert, aside, glass, fork, knife: [x,z] each, rim (the vessel's
//     height to its lip), bites: { main: [[x,y,z] from the plate centre], dessert: [...] } }
export function mealPose(plan, t, anchors, layout) {
  const left = remainingAt(plan, t);
  const plates = {
    main: left.swapped ? layout.aside : layout.plate,
    dessert: left.swapped ? layout.plate : layout.dessert,
  };
  const h = homes(layout, plates);
  const action = findAction(plan, t);
  const course = action?.type === "bite" ? action.plate : left.swapped ? "dessert" : left.main || !plan.start.dessert ? "main" : "dessert";
  const finished = !left.main && !left.dessert && !left.onUtensil && !(action?.type === "bite" && t < action.end);
  const mouth = anchors.mouth;
  const lips = vadd(mouth, [0, -0.006, 0.016]);
  // Hand poses this meal moves between. A change of grip blends from the pose it leaves (`from`),
  // so a hand never snaps back to the authored clip on its way to the next thing.
  const hold = (tip, dir, up = [0, 1, 0]) => ({ mode: "hold", item: "utensil", tip, dir, up });
  const knifeAt = (tip, dir) => ({ mode: "hold", item: "knife", tip, dir, up: [0, 1, 0] });
  const restR = { mode: "rest", palm: h.palmRestR(course), dir: vnorm([-0.22, 0, 1]) };
  const restL = { mode: "rest", palm: h.palmRest(course), dir: h.palmDir };
  const utensilRest = hold(h.utensilRest(course), h.utensilDir);
  const utensilDown = hold(h.utensilDown(course), h.utensilDownDir);
  const knifeHeld = knifeAt(h.knifeHeld(course), vnorm([0.38, -0.5, 0.78]));
  const knifeLaid = knifeAt(h.knifeDown(course), h.knifeDownDir);
  const knifeCourse = plan.knife && course === "main";
  const pickedUp = plan.start.holding || plan.actions.some((a) => a.type === "pickup" && t >= a.end);
  let hands = {
    R: finished ? restR : pickedUp ? utensilRest : restR,
    L: knifeCourse && !finished && pickedUp ? knifeHeld : restL,
  };
  let utensil = finished
    ? { holder: "table", tip: h.utensilDown(course), dir: h.utensilDownDir }
    : pickedUp
      ? { holder: "R" }
      : { holder: "table", tip: h.at(layout.fork, (layout.forkLift || 0) + 0.006), dir: [0, 0, 1] };
  // The dessert's own utensil waits above the plate until the dessert comes in.
  const dessertOn = Boolean(plan.start.dessert || plan.counts?.dessert);
  let dessertUtensil = !dessertOn
    ? null
    : !left.swapped
      ? { holder: "table", tip: h.dessertHome, dir: [-1, 0, 0] }
      : finished
        ? { holder: "table", tip: h.utensilDown("dessert"), dir: h.utensilDownDir }
        : { holder: "R" };
  if (left.swapped) utensil = { holder: "table", tip: h.utensilDown("main"), dir: h.utensilDownDir };
  let knife = !plan.knife
    ? null
    : left.swapped || finished
      ? { holder: "table", tip: h.knifeDown("main"), dir: h.knifeDownDir }
      : pickedUp
        ? { holder: "L" }
        : { holder: "table", tip: h.at(layout.knife, 0.004), dir: [0, 0, 1] };
  let body = { lean: 0.06, headPitch: 0.1, headYaw: 0, chew: 0, mouthOpen: 0 };
  let phase = finished ? "lingering over the table" : "at the table";
  let glass = { holder: "table", level: levelAt(plan, t), tilt: 0, base: h.at(layout.glass || [-0.22, 0.72], layout.vesselLift || 0) };
  const out = () => ({
    phase,
    beat: b?.name || null,
    body,
    hands,
    plates,
    glass,
    utensil,
    dessertUtensil,
    knife,
    onUtensil: left.onUtensil,
    remaining: left,
    action: action?.type || null,
  });
  const b = action ? beatAt(action, t) : null;
  if (!action) return out();
  if (action.type === "bite") {
    phase = action.plate === "dessert" ? "dessert" : "eating";
    const bites = layout.bites?.[action.plate] || [];
    const local = bites[action.index] || bites[action.index % Math.max(1, bites.length)] || [0, 0.02, 0];
    const platePos = plates[action.plate] || layout.plate;
    const piece = [platePos[0] + local[0], layout.surface + local[1], platePos[1] + local[2]];
    const above = vadd(piece, [0.012, 0.075, -0.035]);
    const spoon = action.utensil === "spoon";
    const sticks = action.utensil === "chopsticks";
    // A fork comes in tines-down over the piece; a spoon keeps its bowl level; chopsticks pinch.
    const plateDir = spoon ? vnorm([-0.22, -0.4, 0.89]) : sticks ? vnorm([-0.3, -0.45, 0.84]) : vnorm([-0.2, -0.8, 0.56]);
    const tipLips = vadd(mouth, [0, -0.004, 0.01]);
    const mouthDir = vnorm([-0.32, 0.38, -0.87]);
    const nearLips = vadd(tipLips, [0.025, -0.055, 0.1]);
    const rest = h.utensilRest(action.plate);
    let tip = rest,
      dir = h.utensilDir;
    if (b.name === "cutReach" || b.name === "saw") {
      // The fork pins the piece; the knife saws beside it.
      const pin = vadd(piece, [0.022, 0.012, 0.004]);
      tip = b.name === "cutReach" ? arc(rest, pin, 0.02, smooth(b.u)) : pin;
      dir = b.name === "cutReach" ? dirLerp(h.utensilDir, plateDir, smooth(b.u)) : plateDir;
      const stroke = b.name === "saw" ? Math.sin(b.u * Math.PI * 2) * 0.028 : 0;
      const cut = vadd(piece, [-0.034, 0.012, stroke]);
      hands.L = knifeAt(
        b.name === "cutReach" ? arc(knifeHeld.tip, cut, 0.025, smooth(b.u)) : cut,
        b.name === "cutReach" ? dirLerp(knifeHeld.dir, vnorm([0.34, -0.62, 0.71]), smooth(b.u)) : vnorm([0.34, -0.62, 0.71])
      );
      body = { ...body, lean: lerp(0.08, 0.13, smooth(b.u)), headPitch: 0.22 };
      phase = "cutting";
    } else if (b.name === "reach") {
      tip = arc(rest, above, 0.03, smooth(b.u));
      dir = dirLerp(h.utensilDir, plateDir, smooth(b.u));
      if (action.cut) {
        // The knife comes back from the cut as the fork lifts away.
        const cutEnd = vadd(piece, [-0.034, 0.012, 0]);
        hands.L = knifeAt(arc(cutEnd, knifeHeld.tip, 0.02, smooth(b.u)), dirLerp(vnorm([0.34, -0.62, 0.71]), knifeHeld.dir, smooth(b.u)));
      }
      // Anticipation: the lean begins with the reach and peaks as the hand arrives.
      body = { ...body, lean: lerp(0.06, 0.14, smooth(b.u * 1.25)), headPitch: lerp(0.1, 0.25, smooth(b.u)) };
    } else if (b.name === "take") {
      // A small press into the food and back up: the contact that picks the piece up.
      tip = vadd(vlerp(above, piece, 0.78), [0, -0.012 * Math.sin(b.u * Math.PI), 0]);
      dir = plateDir;
      body = { ...body, lean: 0.14, headPitch: 0.26 };
    } else if (b.name === "lift") {
      const u = smooth(b.u);
      tip = arc(above, nearLips, 0.1, u);
      dir = dirLerp(plateDir, mouthDir, smooth(clamp01(b.u * 1.2 - 0.15)));
      // The head comes forward to meet the bite in the last third.
      const meet = smooth(clamp01((b.u - 0.55) / 0.45));
      body = { ...body, lean: lerp(0.14, 0.1, u) + 0.04 * meet, headPitch: lerp(0.26, 0.04, u) + 0.07 * meet, mouthOpen: meet };
    } else if (b.name === "mouth") {
      tip = vlerp(nearLips, tipLips, easeOut(b.u * 1.7));
      dir = mouthDir;
      body = { ...body, lean: 0.14, headPitch: 0.11, mouthOpen: 1 - smooth(clamp01((b.u - 0.5) / 0.5)) };
    } else if (b.name === "withdraw") {
      // Out and down to the rim, settling a touch past it and back.
      tip = vlerp(tipLips, rest, settle(b.u));
      dir = dirLerp(mouthDir, h.utensilDir, smooth(b.u));
      body = { ...body, lean: lerp(0.14, 0.07, smooth(b.u)), headPitch: lerp(0.11, 0.03, smooth(b.u)) };
    } else {
      // Chewing at about 1.6 Hz, fading as the bite softens; the gaze drifts and comes back.
      const chewing = b.name === "chew";
      body = {
        ...body,
        lean: 0.05,
        headPitch: chewing ? 0.03 : 0.03 - 0.05 * Math.sin(b.u * Math.PI),
        headYaw: (action.index % 3 === 1 ? 0.13 : action.index % 3 === 2 ? -0.09 : 0) * smooth(Math.min(1, b.u * 2)) * (chewing ? 1 : 1 - b.u),
        chew: chewing ? Math.sin(b.seconds * Math.PI * 2 * 1.6) * (1 - 0.55 * b.u) : 0,
      };
      phase = chewing ? "chewing" : "swallowing";
    }
    hands.R = hold(tip, dir, spoon ? [0, 1, 0] : vnorm([0, 0.45, 1]));
    if (action.plate === "dessert") dessertUtensil = { holder: "R" };
    else utensil = { holder: "R" };
  } else if (action.type === "sip") {
    phase = "sipping";
    const home = h.at(layout.glass || [-0.22, 0.72], layout.vesselLift || 0);
    const raised = vadd(lips, [-0.015, -(layout.rim || 0.1) - 0.05, 0.075]);
    const atLips = vadd(lips, [0, -(layout.rim || 0.1), 0.02]);
    const side = plan.sameHand ? "R" : "L";
    // What the drinking hand leaves and comes back to: the laid utensil or knife, or the table.
    const parked = plan.sameHand ? utensilDown : action.knifeHand ? knifeLaid : restL;
    let base = home,
      tilt = 0,
      holder = "table";
    if (b.name === "putDown" || b.name === "pickUp") {
      // The utensil goes to the plate's rim before the same hand takes the cup, and back after.
      const u = b.name === "putDown" ? smooth(b.u) : 1 - smooth(b.u);
      hands.R = hold(vlerp(h.utensilRest(course), h.utensilDown(course), u), dirLerp(h.utensilDir, h.utensilDownDir, u));
      if (course === "dessert") dessertUtensil = { holder: "R" };
      else utensil = { holder: "R" };
    } else if (b.name === "knifeDown" || b.name === "knifeUp") {
      const u = b.name === "knifeDown" ? smooth(b.u) : 1 - smooth(b.u);
      hands.L = knifeAt(vlerp(knifeHeld.tip, knifeLaid.tip, u), dirLerp(knifeHeld.dir, knifeLaid.dir, u));
      knife = { holder: "L" };
    } else {
      if (plan.sameHand) {
        const laid = { holder: "table", tip: h.utensilDown(course), dir: h.utensilDownDir };
        if (course === "dessert") dessertUtensil = laid;
        else utensil = laid;
      }
      if (action.knifeHand) knife = { holder: "table", tip: knifeLaid.tip, dir: knifeLaid.dir };
      let reach = 1;
      if (b.name === "reach") reach = smooth(b.u);
      else if (b.name === "lift") base = arc(home, raised, 0.04, smooth(b.u));
      else if (b.name === "drink") {
        base = vlerp(raised, atLips, smooth(Math.min(1, b.u * 2.2)));
        // Tipped further as the level falls, then eased back as the sip ends.
        tilt = lerp(0.3, 0.75 + 0.5 * (1 - glass.level), smooth(Math.min(1, b.u * 1.6))) * (1 - 0.35 * smooth(clamp01((b.u - 0.75) / 0.25)));
      } else if (b.name === "lower") {
        base = arc(atLips, home, 0.04, smooth(b.u));
        tilt = 0.5 * (1 - smooth(b.u));
      } else if (b.name === "return") reach = 1 - smooth(b.u);
      holder = ["grasp", "lift", "drink", "lower"].includes(b.name) || (b.name === "release" && b.u < 0.5) ? side : "table";
      // During the drink the rim rests on the lower lip and the vessel pivots there.
      const contact = b.name === "drink" ? smooth(Math.min(1, b.u * 2.5)) * (1 - smooth(clamp01((b.u - 0.86) / 0.14))) : 0;
      hands[side] = { mode: "vessel", item: plan.vessel, base, tilt, toward: lips, lip: lips, contact, reach, from: parked };
      body = {
        ...body,
        lean: b.name === "drink" ? 0.02 : 0.06,
        headPitch: b.name === "drink" ? lerp(0.05, -0.15, smooth(b.u)) : b.name === "lift" ? 0.07 : 0.1,
        mouthOpen: b.name === "drink" ? 0.22 : 0,
      };
    }
    glass = { holder, level: levelAt(plan, t), tilt, base };
  } else if (action.type === "hold" || action.type === "sipHeld" || action.type === "setCup") {
    // The breakfast coffee in the hand before the food: held at the chest, sipped, set down.
    const held = layout.cupHold ? [layout.cupHold[0], layout.surface + layout.cupHold[1], layout.cupHold[2]] : [0.07, layout.surface + 0.14, 0.27];
    const saucer = h.at(layout.glass || [-0.2, 0.62], layout.vesselLift || 0);
    const atLips = vadd(lips, [0, -(layout.rim || 0.1), 0.02]);
    let base = held,
      tilt = 0,
      holder = "R",
      reach = 1;
    if (action.type === "hold") {
      const look = smooth(Math.min(1, b.u * 3)) * (1 - smooth(clamp01((b.u - 0.8) / 0.2)));
      phase = "coffee by the ocean";
      body = { ...body, lean: lerp(0.04, -0.03, look), headPitch: lerp(0.06, -0.06, look), headYaw: (action.gaze === "sea" ? 0.22 : -0.28) * look };
      // The cup turns a little in the hand: warmth, not a held prop.
      base = vadd(held, [0.004 * Math.sin(b.seconds * 1.1), 0.003 * Math.sin(b.seconds * 0.7), 0]);
    } else if (action.type === "sipHeld") {
      phase = "sipping coffee";
      if (b.name === "lift") base = arc(held, atLips, 0.03, smooth(b.u));
      else if (b.name === "drink") {
        base = atLips;
        tilt = lerp(0.3, 0.8 + 0.4 * (1 - glass.level), smooth(Math.min(1, b.u * 1.6))) * (1 - 0.35 * smooth(clamp01((b.u - 0.75) / 0.25)));
        body = { ...body, headPitch: lerp(0.04, -0.14, smooth(b.u)), mouthOpen: 0.2 };
      } else {
        base = arc(atLips, held, 0.03, smooth(b.u));
        tilt = 0.45 * (1 - smooth(b.u));
      }
    } else {
      phase = "setting the cup down";
      if (b.name === "lower") base = arc(held, saucer, 0.03, smooth(b.u));
      else {
        base = saucer;
        holder = b.name === "release" && b.u < 0.5 ? "R" : "table";
        reach = b.name === "return" ? 1 - smooth(b.u) : 1;
      }
    }
    const contact = action.type === "sipHeld" && b.name === "drink" ? smooth(Math.min(1, b.u * 2.5)) * (1 - smooth(clamp01((b.u - 0.86) / 0.14))) : 0;
    hands.R = { mode: "vessel", item: plan.vessel, base, tilt, toward: lips, lip: lips, contact, reach, from: restR };
    utensil = { holder: "table", tip: h.at(layout.fork || [0.17, 0.5], (layout.forkLift || 0) + 0.006), dir: [0, 0, 1] };
    glass = { holder, level: levelAt(plan, t), tilt, base };
  } else if (action.type === "pause") {
    phase = action.gaze === "sea" ? "looking out at the sea" : "a pause";
    const look = smooth(Math.min(1, b.u * 3)) * (1 - smooth(clamp01((b.u - 0.82) / 0.18)));
    body = {
      ...body,
      lean: lerp(0.06, -0.03, look),
      headPitch: lerp(0.1, action.gaze === "plate" ? 0.2 : -0.07, look),
      headYaw: (action.gaze === "sea" ? 0.24 : action.gaze === "room" ? -0.32 : 0) * look,
    };
  } else if (action.type === "pickup") {
    phase = "taking up the cutlery";
    const forkHome = h.at(layout.fork || [0.17, 0.5], (layout.forkLift || 0) + 0.006);
    const knifeHome = h.at(layout.knife || [-0.17, 0.5], 0.004);
    if (b.name === "reach") {
      hands.R = { ...hold(forkHome, [0, 0, 1]), reach: smooth(b.u), from: restR };
      utensil = { holder: "table", tip: forkHome, dir: [0, 0, 1] };
      if (plan.knife) {
        hands.L = { ...knifeAt(knifeHome, [0, 0, 1]), reach: smooth(b.u), from: restL };
        knife = { holder: "table", tip: knifeHome, dir: [0, 0, 1] };
      }
    } else {
      hands.R = hold(arc(forkHome, h.utensilRest(course), 0.05, smooth(b.u)), dirLerp([0, 0, 1], h.utensilDir, smooth(b.u)));
      utensil = { holder: "R" };
      if (plan.knife) {
        hands.L = knifeAt(arc(knifeHome, knifeHeld.tip, 0.04, smooth(b.u)), dirLerp([0, 0, 1], knifeHeld.dir, smooth(b.u)));
        knife = { holder: "L" };
      }
    }
    body = { ...body, lean: 0.1, headPitch: 0.22 };
  } else if (action.type === "swap" || action.type === "finish") {
    phase = action.type === "swap" ? "dessert" : "lingering over the table";
    const rimOf = (xz, side = -1) => [xz[0] + 0.02, layout.surface + 0.02, xz[1] + side * 0.12];
    // A finish puts down whatever course was last eaten; a swap always ends the main.
    const last = action.type === "finish" && left.swapped ? "dessert" : "main";
    const down = hold(h.utensilDown(last), h.utensilDownDir);
    const knifeDown = knifeAt(h.knifeDown("main"), h.knifeDownDir);
    const setLast = (state) => {
      if (last === "dessert") dessertUtensil = state;
      else utensil = state;
    };
    if (b.name === "putDown") {
      // Fork and knife go down together on the finished plate.
      const u = smooth(b.u);
      hands.R = hold(vlerp(h.utensilRest(last), down.tip, u), dirLerp(h.utensilDir, down.dir, u));
      setLast({ holder: "R" });
      if (plan.knife && last === "main") {
        hands.L = knifeAt(vlerp(knifeHeld.tip, knifeDown.tip, u), dirLerp(knifeHeld.dir, knifeDown.dir, u));
        knife = { holder: "L" };
      }
    } else if (action.type === "finish") {
      setLast({ holder: "table", tip: down.tip, dir: down.dir });
      if (plan.knife && last === "main") knife = { holder: "table", tip: knifeDown.tip, dir: knifeDown.dir };
      hands.R = { ...restR, reach: smooth(b.u), from: down };
      hands.L = plan.knife && last === "main" ? { ...restL, reach: smooth(b.u), from: knifeDown } : restL;
    } else {
      // Push the finished plate to the far side and draw the dessert in, a hand on its rim.
      const at = (name) => (b.name === name ? smooth(b.u) : action.beats.findIndex(([n]) => n === name) < b.index ? 1 : 0);
      plates.main = vlerp([...layout.plate, 0], [...layout.aside, 0], at("push")).slice(0, 2);
      plates.dessert = vlerp([...layout.dessert, 0], [...layout.plate, 0], at("pull")).slice(0, 2);
      const shift = [plates.main[0] - layout.plate[0], 0, plates.main[1] - layout.plate[1]];
      utensil = { holder: "table", tip: vadd(down.tip, shift), dir: down.dir };
      if (plan.knife) {
        knife = { holder: "table", tip: vadd(knifeDown.tip, shift), dir: knifeDown.dir };
        hands.L = b.name === "reach" ? { ...restL, reach: smooth(b.u), from: knifeDown } : restL;
      }
      const onRim = (xz, side, dir) => ({ mode: "rest", palm: rimOf(xz, side), dir });
      if (b.name === "reach") hands.R = { ...onRim(layout.plate, -1, [0, 0, 1]), reach: smooth(b.u), from: down };
      else if (b.name === "push") hands.R = onRim(plates.main, -1, [0, 0, 1]);
      else if (b.name === "reach2")
        hands.R = { ...onRim(layout.dessert, 1, [0, 0, -1]), reach: smooth(b.u), from: onRim(layout.aside, -1, [0, 0, 1]) };
      else if (b.name === "pull") hands.R = onRim(plates.dessert, 1, [0, 0, -1]);
      else {
        // The dessert utensil taken up from above the plate.
        const u = smooth(b.u);
        const grab = hold(h.dessertHome, [-1, 0, 0]);
        hands.R =
          u < 0.5
            ? { ...grab, reach: u * 2, from: onRim(layout.plate, 1, [0, 0, -1]) }
            : hold(arc(h.dessertHome, h.utensilRest("dessert"), 0.03, (u - 0.5) * 2), dirLerp([-1, 0, 0], h.utensilDir, (u - 0.5) * 2));
        dessertUtensil = u < 0.5 ? { holder: "table", tip: h.dessertHome, dir: [-1, 0, 0] } : { holder: "R" };
      }
      body = { ...body, lean: 0.15, headPitch: 0.22 };
    }
  }
  return out();
}

// The evening drink: the glass rests in the hand on the thigh between sips (no table on the sofa).
//   layout: { knee: [x,y,z] the glass's resting base, rim }
export function eveningPose(plan, t, anchors, layout) {
  if (layout.whiskey) return whiskeyPose(plan, t, anchors, layout);
  const action = findAction(plan, t);
  const rest = layout.knee;
  const lip = vadd(anchors.mouth, [0, -0.006, 0.016]);
  const raised = vadd(lip, [-0.02, -(layout.rim || 0.1) - 0.06, 0.08]);
  const atLips = vadd(lip, [0, -(layout.rim || 0.1), 0.02]);
  let base = rest,
    tilt = 0,
    phase = "with a drink",
    body = { lean: -0.02, headPitch: 0, headYaw: 0, chew: 0, mouthOpen: 0 };
  const b = action ? beatAt(action, t) : null;
  if (action?.type === "sip" && b) {
    phase = "sipping";
    if (b.name === "lift") base = arc(rest, raised, 0.05, smooth(b.u));
    else if (b.name === "drink") {
      base = vlerp(raised, atLips, smooth(Math.min(1, b.u * 2.2)));
      tilt = lerp(0.3, 0.9, smooth(Math.min(1, b.u * 1.6))) * (1 - 0.35 * smooth(clamp01((b.u - 0.75) / 0.25)));
      body = { ...body, headPitch: lerp(0, -0.14, smooth(b.u)), mouthOpen: 0.2 };
    } else if (b.name === "lower") {
      base = arc(atLips, rest, 0.05, smooth(b.u));
      tilt = 0.45 * (1 - smooth(b.u));
    }
  } else if (action?.type === "pause" && b) {
    const look = smooth(Math.min(1, b.u * 3)) * (1 - smooth(clamp01((b.u - 0.82) / 0.18)));
    phase = "watching the Pacific";
    body = { ...body, headYaw: (action.gaze === "room" ? -0.25 : 0.18) * look, headPitch: -0.04 * look };
    // The glass turns a little in the hand while he looks out.
    tilt = 0.05 * Math.sin(b.seconds * 0.9) * look;
  }
  return {
    phase,
    beat: b?.name || null,
    body,
    hands: {
      R: {
        mode: "vessel",
        item: plan.vessel,
        base,
        tilt,
        toward: lip,
        lip,
        contact: b?.name === "drink" && action?.type === "sip" ? smooth(Math.min(1, b.u * 2.5)) * (1 - smooth(clamp01((b.u - 0.86) / 0.14))) : 0,
        reach: 1,
      },
      L: null,
    },
    glass: { holder: "R", level: levelAt(plan, t, { start: 0.78, perSip: 0.09, floor: 0.18 }), tilt, base },
  };
}

// A supported glass between sips: approach, grasp, lift, sip, lower, release, then
// let the hand return to the authored armrest pose. Other evening drinks retain
// their thigh-held setting above.
function whiskeyPose(plan, t, anchors, layout) {
  const action = findAction(plan, t),
    b = action ? beatAt(action, t) : null;
  const rest = layout.glassRest;
  const lip = vadd(anchors.mouth, [0, -0.006, 0.016]);
  const raised = vadd(lip, [-0.02, -(layout.rim || 0.1) - 0.06, 0.08]);
  const atLips = vadd(lip, [0, -(layout.rim || 0.1), 0.02]);
  let base = rest,
    tilt = 0,
    holder = "table",
    hand = null;
  let phase = "watching the Pacific",
    body = { lean: -0.02, headPitch: 0, headYaw: 0, chew: 0, mouthOpen: 0 };
  const grip = () => ({ mode: "vessel", item: plan.vessel, base, tilt, toward: lip, lip, contact: 0, reach: 1 });
  if (action?.type === "sip" && b) {
    phase = b.name === "drink" ? "sipping" : "taking a slow sip";
    if (b.name === "reach") hand = { ...grip(), reach: smooth(b.u), grasp: 0 };
    else if (b.name === "grasp") hand = { ...grip(), grasp: smooth(b.u) };
    else if (["lift", "drink", "lower"].includes(b.name)) {
      holder = "R";
      if (b.name === "lift") base = arc(rest, raised, 0.1, smooth(b.u));
      else if (b.name === "drink") {
        base = vlerp(raised, atLips, smooth(Math.min(1, b.u * 2.2)));
        tilt = lerp(0.3, 0.9, smooth(Math.min(1, b.u * 1.6))) * (1 - 0.35 * smooth(clamp01((b.u - 0.75) / 0.25)));
        body = { ...body, headPitch: lerp(0, -0.14, smooth(b.u)), mouthOpen: 0.2 };
      } else {
        base = arc(atLips, rest, 0.1, smooth(b.u));
        tilt = 0.45 * (1 - smooth(b.u));
      }
      hand = { ...grip(), base, tilt, contact: b.name === "drink" ? smooth(Math.min(1, b.u * 2.5)) * (1 - smooth(clamp01((b.u - 0.86) / 0.14))) : 0 };
    } else if (b.name === "release") hand = { ...grip(), grasp: 1 - smooth(b.u) };
    else if (b.name === "return") hand = { ...grip(), reach: 1 - smooth(b.u), grasp: 0 };
  } else if (action?.type === "pause" && b) {
    const look = smooth(Math.min(1, b.u * 3)) * (1 - smooth(clamp01((b.u - 0.82) / 0.18)));
    body = { ...body, headYaw: (action.gaze === "room" ? -0.25 : 0.18) * look, headPitch: -0.04 * look };
  }
  return {
    phase,
    beat: b?.name || null,
    body,
    hands: { R: hand, L: null },
    glass: { holder, level: levelAt(plan, t, { start: 0.78, perSip: 0.04, floor: 0.18 }), tilt, base },
  };
}

// The moment a composed still shows (reduced motion): the bite at the lips, or a sip when nothing
// is left on the plate. Taken from the plan, so it is the same on every redraw.
export function stillTime(plan) {
  const bite = plan.actions.find((a) => a.type === "bite");
  const sip = plan.actions.find((a) => a.type === "sip");
  const pick = bite || sip;
  if (!pick) return 0;
  const name = bite ? "mouth" : "drink";
  let at = pick.start;
  for (const [beat, d] of pick.beats) {
    if (beat === name) return at + d * (bite ? 0.3 : 0.55);
    at += d;
  }
  return pick.start;
}
