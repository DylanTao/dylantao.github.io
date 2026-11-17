// What happens when something falls into the coast's sea: the rings, the drops and the bobbing.
// Numbers and formulas only (no renderer), shared by the sea's shader (water.mjs), the splash's
// objects (splash.mjs) and the node tests.
//
// The coast is a miniature, so the splash runs at a toy scale: a body two thirds of a unit across
// (an orange as big as a beach umbrella, so it can be seen) and a gravity that makes its rings
// spread at about a unit a second. Within that scale the physics is
// the real thing:
//
//   rings    the far field of the Cauchy-Poisson problem, a hump of water released on deep water
//            (treated in Lamb's Hydrodynamics, 1932). Deep-water waves disperse (omega^2 = g k), so long
//            waves outrun short ones: at any moment the rings are long outside and short inside,
//            and the middle calms first. A hump as wide as the body carries no waves much
//            shorter than itself, which is what bounds the pattern near the middle.
//   drops    thrown from the rim as a crown, then from the middle as the cavity closes (the
//            Worthington jet), each on a ballistic path with a little air drag.
//   floater  a sphere at the surface: weight, the buoyancy of its submerged cap, the water it has
//            to carry with it (added mass, and the slam of taking that water on at entry) and
//            form drag. An orange is lighter than water, so it plunges, comes back up and floats.

export const SPLASH = Object.freeze({
  gravity: 23, // units per second squared: the miniature's toy scale
  radius: 0.32, // the floating body's radius, in the coast's units
  density: 0.72, // the body's density over the sea's: a third of its height floats dry (a real orange, about a quarter)
  dragCoefficient: 0.9, // a sphere and the cavity it drags down with it
  heaveDamping: 1.6, // per second: the bobbing's waves carry its energy away
  ringHeight: 0.155, // ring height in body radii at unit scale: the largest slope is about a quarter
  ringDamping: 5, // seconds: rings lose a factor e
  life: 11, // seconds until an impact is forgotten
  foamReach: 3.2, // body radii: how far the churned foam spreads
  foamLife: 3.4, // seconds until the foam is gone
  crown: 44, // drops thrown from the rim
  jet: 12, // drops thrown from the middle when the cavity closes
  jetDelay: 2.06, // in units of sqrt(radius / gravity): the cavity's pinch-off time for a sphere
  dropDrag: 0.35, // per second
  entrySpeed: [4, 11], // units per second: the limits of an impact's speed
  impacts: 2, // impacts the sea can show at once
});

// The body's own length and time: its radius, and how long gravity takes to matter across it.
export const splashTime = (radius = SPLASH.radius, gravity = SPLASH.gravity) => Math.sqrt(radius / gravity);

const smooth = (a, b, x) => {
  const t = Math.min(Math.max((x - a) / (b - a), 0), 1);
  return t * t * (3 - 2 * t);
};

// The rings at distance r from an impact, t seconds after it: the surface's height and its slope
// along r. With rho = r / a and theta = t / sqrt(a / g):
//
//   height / a = H theta^2 / rho^3 * exp(-kappa^2 / 4) * cos(theta^2 / (4 rho)),   kappa = theta^2 / (4 rho^2)
//
// kappa is the local wave number times a: the waves at rho are shorter the later it is. The
// exponential is the hump's own width leaving out what is much shorter than it.
export function ringWave(r, t, { radius = SPLASH.radius, gravity = SPLASH.gravity, height = SPLASH.ringHeight, damping = SPLASH.ringDamping } = {}) {
  if (!(t > 0) || !(r > 0)) return { height: 0, slope: 0 };
  const rho = Math.max(r / radius, 0.35),
    theta = t / splashTime(radius, gravity),
    kappa = (theta * theta) / (4 * rho * rho),
    // Inside the body there is no far field: the rings begin at its rim.
    envelope =
      ((height * theta * theta) / (rho * rho * rho)) * Math.exp(-(kappa * kappa) / 4) * smooth(0.6, 1.6, r / radius) * Math.exp(-t / damping),
    phase = (theta * theta) / (4 * rho);
  return { height: radius * envelope * Math.cos(phase), slope: envelope * kappa * Math.sin(phase) };
}

// Where the tallest ring is, t seconds after an impact: it travels at the group speed of waves
// about as long as the body is round, 0.42 sqrt(g a).
export const ringRadius = (t, { radius = SPLASH.radius, gravity = SPLASH.gravity } = {}) => (radius * t) / splashTime(radius, gravity) / 32 ** 0.25;

// The churned foam an impact leaves: a patch that spreads to a few body radii and thins out.
// Returns how much foam lies at distance r, before the sea's own noise breaks it up.
export function splashFoam(r, t, { radius = SPLASH.radius, reach = SPLASH.foamReach, life = SPLASH.foamLife } = {}) {
  if (!(t > 0) || t > life) return 0;
  // Thickest in the middle and thinning to nothing at its edge, which is what lets the sea's noise
  // break it into lace from the outside in.
  const edge = radius * (1 + (reach - 1) * (1 - Math.exp(-t * 3.2)));
  return (1 - smooth(edge * 0.15, edge, r)) * (1 - smooth(life * 0.35, life, t));
}

// A small seeded generator (mulberry32), so one impact always throws the same drops.
export function splashRandom(seed) {
  let state = seed >>> 0 || 1;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// The drops one impact throws. The crown leaves the rim at once, leaning outward; the jet leaves
// the middle when the cavity closes, almost straight up. Each drop: where it starts (x, y above
// the still sea, z), its velocity, when it leaves (seconds after the impact) and its size.
export function splashDrops({ x, z, speed, radius = SPLASH.radius, gravity = SPLASH.gravity, seed = 1 }) {
  const random = splashRandom(seed),
    drops = [];
  for (let i = 0; i < SPLASH.crown; i++) {
    const around = ((i + random()) / SPLASH.crown) * Math.PI * 2,
      lean = 0.87 + random() * 0.5, // 50 to 78 degrees above the water
      launch = speed * (0.22 + random() * 0.4),
      from = radius * (0.85 + random() * 0.45);
    drops.push({
      x: x + Math.cos(around) * from,
      y: 0,
      z: z + Math.sin(around) * from,
      vx: Math.cos(around) * Math.cos(lean) * launch,
      vy: Math.sin(lean) * launch,
      vz: Math.sin(around) * Math.cos(lean) * launch,
      at: random() * 0.05,
      size: radius * (0.12 + random() * 0.2),
    });
  }
  const closes = SPLASH.jetDelay * splashTime(radius, gravity);
  for (let i = 0; i < SPLASH.jet; i++) {
    const around = random() * Math.PI * 2,
      out = random() * 0.09,
      launch = speed * (0.45 + (0.5 * (i + random())) / SPLASH.jet);
    drops.push({
      x: x + Math.cos(around) * radius * 0.2,
      y: 0,
      z: z + Math.sin(around) * radius * 0.2,
      vx: Math.cos(around) * out * launch,
      vy: launch,
      vz: Math.sin(around) * out * launch,
      at: closes + random() * 0.07,
      size: radius * (0.14 + random() * 0.22),
    });
  }
  return drops;
}

// One drop, dt seconds on: gravity and a little air drag. It lands when it is back at the sea.
export function stepDrop(drop, dt, { gravity = SPLASH.gravity, drag = SPLASH.dropDrag } = {}) {
  const keep = Math.exp(-drag * dt);
  drop.vx *= keep;
  drop.vz *= keep;
  drop.vy = drop.vy * keep - gravity * dt;
  drop.x += drop.vx * dt;
  drop.y += drop.vy * dt;
  drop.z += drop.vz * dt;
  return drop;
}

// The volume of a sphere's cap of height h (its part below the surface when it sits h deep).
export const capVolume = (h, radius) => {
  const depth = Math.min(Math.max(h, 0), 2 * radius);
  return (Math.PI * depth * depth * (3 * radius - depth)) / 3;
};
// The area of the disc where the surface cuts the sphere, and beyond its middle the whole section.
const cutArea = (h, radius) => {
  const depth = Math.min(Math.max(h, 0), 2 * radius);
  return depth < radius ? Math.PI * (2 * radius * depth - depth * depth) : Math.PI * radius * radius;
};

// How high a floating sphere's centre rides above the surface: Archimedes, solved for the cap.
export function floatLevel(radius = SPLASH.radius, density = SPLASH.density) {
  const whole = (4 / 3) * Math.PI * radius ** 3;
  let low = 0,
    high = 2 * radius;
  for (let i = 0; i < 48; i++) {
    const mid = (low + high) / 2;
    if (capVolume(mid, radius) < density * whole) low = mid;
    else high = mid;
  }
  return radius - (low + high) / 2;
}

// The floater, dt seconds on. `state` is { y, vy }: its centre's height and speed; `surface` is the
// sea's height where it floats. Masses are per unit of the sea's density.
//
//   d/dt [(m + ma) v] = -m g + g V(h) - drag,   ma = V(h) / 2
//
// so taking on added mass at entry is itself a force (the slam), which is what stops a fast body
// within about its own radius and throws the crown.
export function stepFloater(state, dt, { surface = 0, radius = SPLASH.radius, gravity = SPLASH.gravity, density = SPLASH.density } = {}) {
  const whole = (4 / 3) * Math.PI * radius ** 3,
    mass = density * whole;
  let left = dt;
  while (left > 1e-9) {
    const step = Math.min(left, 1 / 240);
    left -= step;
    const depth = Math.min(Math.max(surface + radius - state.y, 0), 2 * radius),
      wet = capVolume(depth, radius),
      area = cutArea(depth, radius),
      added = wet / 2,
      // The added mass grows as the body goes in (dV/dh is the cut's area), and shrinks as it comes out.
      taking = depth > 0 && depth < 2 * radius ? (area / 2) * -state.vy : 0,
      force =
        -mass * gravity +
        gravity * wet -
        0.5 * SPLASH.dragCoefficient * area * Math.abs(state.vy) * state.vy -
        SPLASH.heaveDamping * wet * state.vy -
        Math.max(taking, 0) * state.vy;
    state.vy += (force / (mass + added)) * step;
    state.y += state.vy * step;
  }
  return state;
}
