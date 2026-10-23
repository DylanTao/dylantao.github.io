// Sirui's strength training as the 3D home performs it (Sirui, 2026-10-15), from his own logs:
// nSuns 5/3/1 LP on a six-day upper/lower split, alternating a Squat template and a Deadlift
// template cycle by cycle; pyramid sets that load up to a top single and back down; supersets of
// opposite muscle groups between sets; pull-ups and other accessories beyond the template; four to
// six sessions a week, taken off whenever the body asks for rest; one to two hours before the gym
// closes (8 pm on workdays, 4 pm on weekends). The data lives in the manifest's `training` block
// (bin/refresh_coastal_gym.py writes the gym, the program is authored by hand). This file is pure:
// dates in, plans and timelines out, so the routine, the animation and the whiteboard agree.

const DAY_MS = 86400000;
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export const LIFT_LABELS = {
  bench: "Bench",
  ohp: "Overhead press",
  squat: "Squat",
  deadlift: "Deadlift",
  "sumo-deadlift": "Sumo deadlift",
  "front-squat": "Front squat",
  "incline-bench": "Incline bench",
  "close-grip-bench": "Close-grip bench",
  pullup: "Pull-ups",
  curl: "Curls",
  "pan-raise": "Pan wrist raises",
  dip: "Dips",
};

// Which bar a lift uses: the rack (squats and presses), the bench uprights, or the platform.
export const LIFT_STATION = {
  bench: "bench",
  "incline-bench": "bench",
  "close-grip-bench": "bench",
  ohp: "rack",
  squat: "rack",
  "front-squat": "rack",
  deadlift: "platform",
  "sumo-deadlift": "platform",
};

// Seconds per repetition: a controlled lowering, a brief pause, a faster drive. Curls alternate,
// so theirs is one arm's repetition.
export const REP_SECONDS = {
  squat: 3.8,
  "front-squat": 3.6,
  deadlift: 4.4,
  "sumo-deadlift": 4.2,
  bench: 3.4,
  "incline-bench": 3.4,
  "close-grip-bench": 3.2,
  ohp: 3.2,
  pullup: 2.8,
  dip: 2.6,
  curl: 1.6,
  "pan-raise": 3.2,
};

// Getting into and out of each lift. Back squats back under the bar and step into the cage;
// presses and front squats duck under it into the cage first; bench presses sit astride the bench
// and lie back; deadlifts only step up to the bar.
export const SETUP_SECONDS = {
  squat: 8,
  "front-squat": 10,
  ohp: 10,
  bench: 10,
  "incline-bench": 10,
  "close-grip-bench": 10,
  deadlift: 5,
  "sumo-deadlift": 5,
};
export const RERACK_SECONDS = {
  squat: 5,
  "front-squat": 7,
  ohp: 7,
  bench: 6,
  "incline-bench": 6,
  "close-grip-bench": 6,
  deadlift: 3,
  "sumo-deadlift": 3,
};
// A jump to the pull-up bar and the drop from it; stepping between the dip bars and out; taking the
// dumbbells off the rack and putting them back.
export const SUPERSET_OVERHEAD = { pullup: 1.8, dip: 2.8, curl: 6.5, "pan-raise": 8 };
export const SUPERSET_REPS = { pullup: 6, dip: 10, curl: 10, "pan-raise": 8 };

export function roundWeight(weight, step = 5) {
  return Math.max(45, Math.round(weight / step) * step);
}

// The gym's two plate sets (Sirui's gym): coloured pound bumpers on the deadlift platform, 55 lb red
// to 10 lb gray, and black plates on the rack and the bench, 45 lb down to 2.5 lb.
export const BUMPERS = [55, 45, 35, 25, 10];
export const IRON = [45, 35, 25, 10, 5, 2.5];

// The plates per side for a total on a 45 lb bar at a station, heaviest first, each with its set:
// bumpers on the platform (black change plates make up the rest), black plates elsewhere.
export function plateLoad(weight, station = "rack") {
  let side = Math.max(0, (weight - 45) / 2);
  const out = [];
  const take = (sizes, kind) => {
    for (const lb of sizes)
      while (side >= lb - 1e-6) {
        out.push({ lb, kind });
        side -= lb;
      }
  };
  if (station === "platform") take(BUMPERS, "bumper");
  take(IRON, "iron");
  return out;
}

// Plates per side for a total on a 45 lb bar, heaviest first (the black set).
export function platesFor(weight) {
  let side = Math.max(0, (weight - 45) / 2);
  const out = [];
  for (const plate of [45, 35, 25, 10, 5, 2.5]) {
    while (side >= plate - 1e-6) {
      out.push(plate);
      side -= plate;
    }
  }
  return out;
}

const parseKey = (key) => {
  const [y, m, d] = key.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
};
const keyOf = (ms) => new Date(ms).toISOString().slice(0, 10);
const weekdayOf = (key) => new Date(parseKey(key)).getUTCDay();

function hash(text) {
  let h = 2166136261;
  for (const c of text) h = Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0;
  return h >>> 0;
}

// Monday of the date's week.
function mondayOf(key) {
  const day = weekdayOf(key);
  return keyOf(parseKey(key) - ((day + 6) % 7) * DAY_MS);
}

// Rest days for a week: Sunday always, then zero to two of Monday to Saturday, never back to back,
// chosen reproducibly from the week, so the week holds four to six sessions. A day the program's
// anchor names as a training day stays one.
export function restDays(mondayKey, training) {
  const h = hash(mondayKey + (training.seed || ""));
  const sessions = 4 + (h % 3);
  const rests = new Set([0]);
  const candidates = [2, 3, 4, 5, 1, 6];
  let k = (h >>> 3) % candidates.length;
  while (rests.size < 1 + (6 - sessions)) {
    const day = candidates[k % candidates.length];
    k += 1 + ((h >>> 7) % 2);
    if (rests.has(day) || rests.has(day - 1) || rests.has(day + 1)) {
      if (k > 40) break;
      continue;
    }
    rests.add(day);
  }
  return rests;
}

export function isTrainingDay(key, training) {
  if (key === training.anchor.date) return true;
  return !restDays(mondayOf(key), training).has(weekdayOf(key));
}

// The program position on a date: the template and its day (0-5), counted forward from the anchor
// (the last logged state), one template day per session, cycles alternating templates. Dates before
// the anchor read the anchor itself; the board says which day its numbers are from.
export function programDay(key, training) {
  const { anchor } = training;
  let template = anchor.template,
    day = anchor.day,
    cycle = anchor.cycle;
  if (key <= anchor.date) return { template, day, cycle, training: key === anchor.date || isTrainingDay(key, training), key };
  for (let ms = parseKey(anchor.date) + DAY_MS; ms <= parseKey(key); ms += DAY_MS) {
    const k = keyOf(ms),
      previous = keyOf(ms - DAY_MS);
    if (isTrainingDay(previous, training)) {
      day += 1;
      if (day >= training.templates[template].days.length) {
        day = 0;
        cycle += 1;
        template = template === "squat" ? "deadlift" : "squat";
      }
    }
    if (k === key) return { template, day, cycle, training: isTrainingDay(k, training), key };
  }
  return { template, day, cycle, training: isTrainingDay(key, training), key };
}

// The session window in minutes for a weekday (0 = Sunday), or null when the gym is not on.
export function sessionWindow(weekday, training) {
  if (weekday === 0) return null;
  return weekday === 6 ? training.windows.saturday : training.windows.weekday;
}

// One session: the template day's two lifts with every set's weight, plus its supersets.
export function sessionPlan(position, training) {
  const template = training.templates[position.template];
  const day = template.days[position.day];
  const lifts = day.lifts.map((entry, tier) => {
    const tm = training.trainingMax[entry.base || entry.lift];
    const sets = training.schemes[entry.scheme].map(([percent, reps, amrap]) => ({
      percent,
      reps,
      amrap: amrap === "+",
      weight: roundWeight((tm * percent) / 100),
    }));
    return { lift: entry.lift, tier: tier + 1, base: entry.base || entry.lift, trainingMax: tm, sets, superset: entry.superset };
  });
  // Accessories after the template: pull-ups with curls on upper days, with dips on lower days.
  const accessories = day.kind === "upper" ? ["pullup", "curl"] : ["pullup", "dip"];
  return {
    template: position.template,
    templateLabel: template.label,
    day: position.day,
    dayLabel: WEEKDAYS[(position.day % 6) + 1],
    kind: day.kind,
    cycle: position.cycle,
    lifts,
    finisher: day.finisher || null,
    accessories,
    panRaise: true,
  };
}

const supersetSeconds = (lift, reps) => reps * REP_SECONDS[lift] * (lift === "curl" ? 2 : 1) + SUPERSET_OVERHEAD[lift];

// The session as a timeline of segments (seconds from the start). Every working set is a block:
// change plates when the weight changes, set up, lift every rep, re-rack, superset the opposite
// muscle group, then rest. The day opens with empty-bar warm-ups; each bar is stripped after its
// last set; accessories and a note on the whiteboard close it.
export function sessionTimeline(plan) {
  const segments = [];
  let t = 0;
  const push = (kind, seconds, extra = {}) => {
    segments.push({ kind, start: t, end: t + seconds, ...extra });
    t += seconds;
  };
  push("arrive", 60);
  push("board", 50, { note: "plan" });
  const first = plan.lifts[0];
  const station = (lift) => LIFT_STATION[lift];
  for (let k = 0; k < 2; k++) {
    const weight = k === 0 ? 45 : roundWeight(first.sets[0].weight * 0.6);
    if (k === 1) push("load", 16, { lift: first.lift, weight, from: 45, station: station(first.lift) });
    push("setup", SETUP_SECONDS[first.lift], { lift: first.lift, weight, station: station(first.lift), warmup: true });
    const reps = k === 0 ? 10 : 5;
    push("set", reps * REP_SECONDS[first.lift], { lift: first.lift, weight, reps, warmup: true, station: station(first.lift) });
    push("rerack", RERACK_SECONDS[first.lift], { lift: first.lift, weight, station: station(first.lift), warmup: true });
    push("rest", 75, { after: first.lift, warmup: true });
  }
  let loaded = { [station(first.lift)]: roundWeight(first.sets[0].weight * 0.6) };
  for (const entry of plan.lifts) {
    const block = entry.tier === 1 ? 300 : 245;
    const where = station(entry.lift);
    entry.sets.forEach((set, index) => {
      const start = t;
      const previous = loaded[where] ?? 45;
      if (set.weight !== previous) push("load", 18, { lift: entry.lift, weight: set.weight, from: previous, station: where, set: index });
      loaded[where] = set.weight;
      push("setup", SETUP_SECONDS[entry.lift], { lift: entry.lift, weight: set.weight, station: where, set: index });
      const reps = set.amrap ? set.reps + 2 : set.reps;
      push("set", reps * REP_SECONDS[entry.lift], {
        lift: entry.lift,
        weight: set.weight,
        reps,
        set: index,
        tier: entry.tier,
        station: where,
        amrap: set.amrap,
      });
      push("rerack", RERACK_SECONDS[entry.lift], { lift: entry.lift, weight: set.weight, station: where, set: index });
      if (entry.superset) {
        const reps2 = SUPERSET_REPS[entry.superset];
        push("walk", 5, { to: entry.superset });
        push("superset", supersetSeconds(entry.superset, reps2), { lift: entry.superset, reps: reps2, set: index });
      }
      push("rest", Math.max(20, block - (t - start)), { after: entry.lift, set: index });
    });
    // Strip the bar for the next person (and the next lift).
    push("load", 15, { lift: entry.lift, weight: 45, from: loaded[where], station: where, strip: true });
    loaded[where] = 45;
  }
  const extra = (lift, k, flags) => {
    push("walk", 5, { to: lift });
    push("superset", supersetSeconds(lift, flags.reps), { lift, reps: flags.reps, set: k, ...flags });
  };
  if (plan.finisher) {
    for (let k = 0; k < 3; k++) {
      extra(plan.finisher, k, { reps: 10, finisher: true });
      push("rest", 75, { after: plan.finisher });
    }
  }
  for (let k = 0; k < 2; k++) {
    for (const lift of plan.accessories || []) extra(lift, k, { reps: lift === "pullup" ? 8 : SUPERSET_REPS[lift], accessory: true });
    push("rest", 60, { after: "accessories" });
  }
  if (plan.panRaise) extra("pan-raise", 0, { reps: 8, accessory: true });
  push("board", 90, { note: "log" });
  push("leave", 30);
  return { segments, duration: t };
}

// Where a session stands at `seconds` from its start: the segment, its progress, and how many
// working sets of each lift are done (for the board's ticks).
export function sessionState(timeline, seconds) {
  const s = Math.max(0, Math.min(seconds, timeline.duration - 0.001));
  let index = timeline.segments.findIndex((segment) => s < segment.end);
  if (index < 0) index = timeline.segments.length - 1;
  const segment = timeline.segments[index];
  const done = {};
  for (const other of timeline.segments.slice(0, index)) {
    if (other.kind === "set" && !other.warmup && other.lift) done[other.lift] = (done[other.lift] || 0) + 1;
  }
  return { segment, index, local: s - segment.start, progress: (s - segment.start) / (segment.end - segment.start), done, seconds: s };
}

// Everything the scene needs about the gym on a date at a minute: whether this is a session, the
// plan and timeline, the minute it ends, and the state (null outside the session). `force` shows a
// session even on a rest day or outside the hours (a visitor asked for "Training"): the program's
// day for that date, in the weekday window, half an hour in when the minute is outside it.
export function trainingAt(training, key, minute, second = 0, { force = false } = {}) {
  const weekday = weekdayOf(key),
    position = programDay(key, training);
  let window = sessionWindow(weekday, training);
  const scheduled = Boolean(position.training && window);
  if (!scheduled && force) window = window || training.windows.weekday;
  const plan = scheduled || force ? sessionPlan(position, training) : null;
  const timeline = plan ? sessionTimeline(plan) : null;
  const endMinute = plan ? window[0] + Math.ceil(timeline.duration / 60) : null;
  let at = minute;
  if (force && plan && (minute < window[0] || minute >= endMinute)) at = window[0] + 30;
  const inSession = Boolean(plan && at >= window[0] && at < endMinute);
  const state = inSession ? sessionState(timeline, (at - window[0]) * 60 + second) : null;
  return { key, weekday, position, window, plan, timeline, endMinute, state, trainingDay: position.training, scheduled, inSession, minute: at };
}
