// How the orange on the Page not found page leaves it: it rolls along a level shelf, tips over the
// shelf's end, and falls into the sea in the footer. Numbers and motion only (no page), shared by
// orange-roll.mjs and the node tests.
//
// The page is the orange's own size: its radius on the page is about 37 px and a real one's is
// 3.7 cm, so a metre is a thousand pixels and gravity is the real one. Three things are real:
//
//   roll   a sphere that rolls without slipping turns exactly as far as it travels (angle =
//          distance / radius) and loses speed to rolling resistance
//   tip    at the shelf's end it turns about the edge (moment of inertia 7/5 m r^2 there) until the
//          edge can no longer hold it, which is when g cos(angle) = r * (angular speed)^2
//   fall   a ballistic path, still spinning
//
// and two are staged, and said so: the page plays at six tenths of real time, so the fall can be
// watched, and as the orange falls toward the footer's miniature coast it shrinks to that coast's
// scale. Its speed on the page shrinks with it, the way something falling away from the eye slows.

export const ROLL = Object.freeze({
  pixelsPerMetre: 1000,
  gravity: 9.81, // metres per second squared
  slow: 0.6, // the page's seconds per real second
  resistance: 0.045, // rolling resistance of a soft fruit on a table: it loses this share of g
  push: [0.12, 3.2], // metres per second: the gentlest and the hardest push a pointer gives
  // The shelf ends this share of the way to the landing's x (no nearer or farther than the next two,
  // in pixels). Most of the way: the orange should roll and then drop, not be shot across the page.
  // The last is the least room left for the drop: tipping off an edge carries it about that far.
  shelf: [0.82, 70, 1500, 150],
  step: 1 / 240, // seconds: the integration step
});

const smooth = (t) => {
  const x = Math.min(Math.max(t, 0), 1);
  return x * x * (3 - 2 * x);
};

// Where the shelf ends, for an orange resting at x that should land at landingX (pixels).
export function shelfEnd(x, landingX) {
  const [share, least, most, drop] = ROLL.shelf,
    distance = landingX - x;
  return x + Math.min(Math.max(Math.min(distance * share, distance - drop), least), most);
}

// The angle from upright at which a sphere rolling at `speed` (metres per second) leaves the edge
// it is tipping over. Energy about the edge: (7/5) r^2 w^2 / 2 grows by g r (1 - cos a); it leaves
// when g cos a = r w^2, so cos a = (10 + 7 v^2 / (g r)) / 17. Fast enough, and it leaves at once.
export function leaveAngle(speed, radius, gravity = ROLL.gravity) {
  return Math.acos(Math.min(1, (10 + (7 * speed * speed) / (gravity * radius)) / 17));
}

// The orange's motion from rest on the shelf to the sea. Lengths in pixels of the page, angles in
// radians (a roll to the right turns clockwise, positive here).
//
//   start     { x, y }: the centre of the orange at rest
//   radius    its radius
//   edge      the x where the shelf ends
//   landing   { x, y }: the centre as it touches the sea
//   endScale  its size at the sea, over its size on the page
//   push      metres per second, to the right
//
// step(dt) moves it dt seconds of the page's time and returns the state:
//   { phase: "roll" | "tip" | "fall" | "landed", x, y, angle, scale, speed, spin, time }
// with speed in pixels of the page per second and spin in radians per second, both as seen.
export function createRoll({ start, radius, edge, landing, endScale, push }) {
  const metre = ROLL.pixelsPerMetre,
    r = radius / metre,
    g = ROLL.gravity,
    state = { phase: "roll", x: start.x, y: start.y, angle: 0, scale: 1, speed: push * metre * ROLL.slow, spin: (push / r) * ROLL.slow, time: 0 };
  // Real quantities, in metres and real seconds.
  let v = push, // along the shelf
    tip = 0, // the angle about the edge
    turning = 0, // its rate
    vx = 0,
    vy = 0,
    spin = 0,
    left = { x: 0, y: 0 },
    owed = 0; // real seconds not yet simulated
  const advance = (h) => {
    if (state.phase === "roll") {
      // Rolling resistance acts at the contact; a rolling sphere answers with 5/7 of it.
      v = Math.max(v - (5 / 7) * ROLL.resistance * g * h, 0);
      const moved = v * h * metre;
      spin = v / r;
      if (state.x + moved >= edge) {
        // It reaches the shelf's end partway through this step: stop exactly there, upright over
        // the edge, and spend the rest of the step tipping. (Left to overshoot, where it landed
        // depended on how the steps happened to fall.)
        const share = moved > 0 ? (edge - state.x) / moved : 1;
        state.angle += (edge - state.x) / radius;
        state.x = edge;
        state.phase = "tip";
        tip = 0;
        turning = v / r;
        if (share < 1) advance(h * (1 - share));
        return;
      }
      state.x += moved;
      state.angle += moved / radius;
      if (v === 0) state.phase = "stopped";
    } else if (state.phase === "tip") {
      // About the edge: (7/5) r^2 a'' = g r sin a. The edge holds it while g cos a > r a'^2; the
      // moment that fails is found inside the step, so where it lands does not depend on how the
      // steps happen to fall.
      const rate = (5 * g * Math.sin(tip)) / (7 * r),
        holds = g * Math.cos(tip) - r * turning * turning,
        nextTurning = turning + rate * h,
        nextTip = tip + nextTurning * h,
        after = g * Math.cos(nextTip) - r * nextTurning * nextTurning,
        leaves = after <= 0 || nextTip > 1.5,
        share = after <= 0 ? (holds > 0 ? holds / (holds - after) : 0) : 1;
      turning += rate * h * share;
      tip += turning * h * share;
      state.angle += turning * h * share;
      state.x = edge + radius * Math.sin(tip);
      state.y = start.y + radius * (1 - Math.cos(tip));
      spin = turning;
      if (leaves) {
        state.phase = "fall";
        vx = r * turning * Math.cos(tip);
        vy = r * turning * Math.sin(tip);
        left = { x: state.x, y: state.y };
        if (share < 1) advance(h * (1 - share));
        return;
      }
    } else if (state.phase === "fall") {
      vy += g * h;
      // Falling toward the miniature coast it shrinks, and what it covers on the page shrinks with it.
      const share = (state.y - left.y) / Math.max(landing.y - left.y, 1);
      state.scale = 1 + (endScale - 1) * smooth(share);
      const dx = vx * h * metre * state.scale,
        dy = vy * h * metre * state.scale;
      if (state.y + dy >= landing.y) {
        // It touches the sea partway through this step.
        const share = dy > 0 ? (landing.y - state.y) / dy : 1;
        state.x += dx * share;
        state.angle += spin * h * share;
        state.y = landing.y;
        state.scale = endScale;
        state.phase = "landed";
      } else {
        state.x += dx;
        state.y += dy;
        state.angle += spin * h;
      }
    }
    const fast = state.phase === "roll" ? v : state.phase === "tip" ? r * turning : Math.hypot(vx, vy);
    state.speed = fast * metre * state.scale * ROLL.slow;
    state.spin = spin * ROLL.slow;
  };
  return {
    state,
    step(dt) {
      // The page's time runs slow; the physics inside is real, and always takes the same steps, so
      // one push ends in one place whatever the frame rate.
      state.time += Math.max(dt, 0);
      owed += Math.max(dt, 0) * ROLL.slow;
      while (owed >= ROLL.step && state.phase !== "landed" && state.phase !== "stopped") {
        owed -= ROLL.step;
        advance(ROLL.step);
      }
      return state;
    },
  };
}

// Where a push lands the orange, and how long the page takes to show it.
export function landingOf(setup, push) {
  const roll = createRoll({ ...setup, push });
  let guard = 0;
  while (roll.state.phase !== "landed" && roll.state.phase !== "stopped" && guard++ < 6000) roll.step(1 / 60);
  return { x: roll.state.x, time: roll.state.time, phase: roll.state.phase };
}

// The push that lands it on the landing's x: harder pushes land farther, so bisect.
export function solvePush(setup) {
  let [low, high] = ROLL.push;
  // The gentlest push that still reaches the shelf's end.
  const reach = Math.sqrt((2 * (5 / 7) * ROLL.resistance * ROLL.gravity * Math.max(setup.edge - setup.start.x, 0)) / ROLL.pixelsPerMetre) + 0.05;
  low = Math.max(low, reach);
  if (landingOf(setup, low).x >= setup.landing.x) return low;
  if (landingOf(setup, high).x <= setup.landing.x) return high;
  for (let i = 0; i < 26; i++) {
    const mid = (low + high) / 2;
    if (landingOf(setup, mid).x < setup.landing.x) low = mid;
    else high = mid;
  }
  return (low + high) / 2;
}
