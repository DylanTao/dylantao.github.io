// One motion language for the site. The stylesheets carry these springs as CSS linear() curves
// (_sass/_springs.scss, printed by bin/spring_easing.cjs); this module gives the same springs to
// scripts that move things themselves: keyframes for the project cards, eases for the cinematic
// layer, canvas sketches. A spring is a damping ratio (zeta) and a period, the seconds one undamped
// oscillation would take, the way Apple's motion guidance describes springs. The 3D home's loading
// sketch set the bar: motion that arrives with a little weight, settles without wobble, and keeps its
// velocity through an interruption instead of starting over.

export const SPRINGS = Object.freeze({
  // Controls and menus answering a press: quick, with at most a hint of overshoot.
  confident: Object.freeze({ zeta: 0.8, period: 0.35 }),
  // The desk toys: bouncier, with a visible settle.
  playful: Object.freeze({ zeta: 0.55, period: 0.45 }),
  // Things that change place or size, like a project card opening inside its grid.
  layout: Object.freeze({ zeta: 0.84, period: 0.46 }),
  // Content arriving on the page: soft, with no visible overshoot.
  gentle: Object.freeze({ zeta: 0.9, period: 0.62 }),
});

// A spring has settled once it is within 0.1% of rest.
const SETTLE = -Math.log(0.001);

export function spring(nameOrParams) {
  const params = typeof nameOrParams === "string" ? SPRINGS[nameOrParams] : nameOrParams;
  if (!params) throw new Error(`Unknown spring: ${nameOrParams}`);
  const { zeta, period } = params,
    omega = (2 * Math.PI) / period,
    rate = zeta * omega,
    damped = omega * Math.sqrt(1 - zeta * zeta),
    seconds = SETTLE / rate;
  // Offset and velocity t seconds after a release at offset x0 moving at v0 (units per second),
  // with rest at 0. An interrupted motion hands its current pair to the next one.
  const state = (x0, v0, t) => {
    const decay = Math.exp(-rate * t),
      c = Math.cos(damped * t),
      s = Math.sin(damped * t),
      b = (v0 + rate * x0) / damped;
    return [decay * (x0 * c + b * s), decay * ((b * damped - rate * x0) * c - (x0 * damped + rate * b) * s)];
  };
  // The step response across the settle time as an easing: 0 at p = 0, 1 at p = 1.
  const ease = (p) => (p <= 0 ? 0 : p >= 1 ? 1 : 1 - state(1, 0, p * seconds)[0]);
  return { zeta, period, seconds, duration: seconds * 1000, state, ease };
}

// The same curve as a CSS linear() easing, sampled the way bin/spring_easing.cjs prints it.
export function linearEasing(nameOrParams, samples = 36) {
  const s = spring(nameOrParams),
    points = [];
  for (let i = 0; i <= samples; i++) points.push(i === samples ? 1 : +(1 - s.state(1, 0, (s.seconds * i) / samples)[0]).toFixed(3));
  return `linear(${points.join(", ")})`;
}

// One axis of a spring that starts at offset x0 moving at v0 and comes to rest at 0 over
// durationMs, sampled count + 1 times for keyframes that the browser interpolates linearly.
export function springSamples(nameOrSpring, x0, v0, durationMs, count = 32) {
  const s = typeof nameOrSpring === "object" && nameOrSpring.state ? nameOrSpring : spring(nameOrSpring),
    out = [];
  for (let i = 0; i <= count; i++) out.push(i === count ? 0 : s.state(x0, v0, (durationMs / 1000) * (i / count))[0]);
  return out;
}

// Offset and velocity of a sampled spring that started `elapsedMs` ago, for handing an interrupted
// motion's momentum to the next one.
export function springNow(nameOrSpring, x0, v0, elapsedMs) {
  const s = typeof nameOrSpring === "object" && nameOrSpring.state ? nameOrSpring : spring(nameOrSpring);
  return s.state(x0, v0, Math.max(0, elapsedMs) / 1000);
}

// One frame of a spring chasing a target that may move between frames (a pointer, a hover state):
// the exact solution over dt with the target held still, so the step is stable at any frame rate.
export function springStep(nameOrSpring, value, velocity, target, dtSeconds) {
  const s = typeof nameOrSpring === "object" && nameOrSpring.state ? nameOrSpring : spring(nameOrSpring);
  const [offset, v] = s.state(value - target, velocity, Math.max(0, Math.min(dtSeconds, 0.1)));
  return [target + offset, v];
}

// A ripple that spreads from where a change began: each element waits for the wave to reach it,
// nearer ones first. `speed` is in px per ms; no element waits longer than `maxDelay`.
export function rippleDelays(points, origin, { speed = 8, maxDelay = 120 } = {}) {
  return points.map((point) => Math.round(Math.min(maxDelay, Math.hypot(point.x - origin.x, point.y - origin.y) / speed)));
}

// Keyframes for something travelling from offset (x0, y0) to rest on a spring. It stretches a little
// along its path while the spring pulls it up to speed and squashes as it slows into place (area
// kept), so it lands with a hint of weight. The squash scales with the distance travelled, so a
// short hop barely deforms; `squash` is the largest deformation (0.03 = 3%). The last frame is
// exactly at rest.
export function flightFrames(nameOrSpring, { x0 = 0, y0 = 0, vx0 = 0, vy0 = 0, squash = 0.03, count = 30, durationMs } = {}) {
  const s = typeof nameOrSpring === "object" && nameOrSpring.state ? nameOrSpring : spring(nameOrSpring);
  const duration = (durationMs ?? s.duration) / 1000;
  const distance = Math.hypot(x0, y0);
  // The direction of travel: toward rest, or the way it was already moving.
  const ax = distance > 0.5 ? -x0 / distance : Math.hypot(vx0, vy0) > 1 ? vx0 / Math.hypot(vx0, vy0) : 1;
  const ay = distance > 0.5 ? -y0 / distance : Math.hypot(vx0, vy0) > 1 ? vy0 / Math.hypot(vx0, vy0) : 0;
  const angle = (Math.atan2(ay, ax) * 180) / Math.PI;
  const omega = (2 * Math.PI) / s.period;
  // The largest acceleration a release from this distance can produce, to normalise the squash.
  const reference = Math.max(1, omega * omega * Math.max(distance, 1));
  const amplitude = squash * Math.min(1, distance / 240);
  const frames = [];
  for (let i = 0; i <= count; i++) {
    if (i === count) {
      frames.push("translate(0px, 0px)");
      break;
    }
    const t = duration * (i / count);
    const h = 1e-4;
    const [x, vx] = s.state(x0, vx0, t);
    const [y, vy] = s.state(y0, vy0, t);
    const [, vxh] = s.state(x0, vx0, t + h);
    const [, vyh] = s.state(y0, vy0, t + h);
    // Acceleration along the direction of travel: positive speeds it up, negative slows it. The
    // deformation eases in over the first 80 ms so the resting shape never jumps.
    const along = ((vxh - vx) / h) * ax + ((vyh - vy) / h) * ay;
    const ramp = Math.min(1, t / 0.08);
    const k = amplitude ? Math.max(-1, Math.min(1, along / reference)) * amplitude * ramp * ramp * (3 - 2 * ramp) : 0;
    const translate = `translate(${x.toFixed(2)}px, ${y.toFixed(2)}px)`;
    if (Math.abs(k) < 0.0005) {
      frames.push(translate);
      continue;
    }
    const stretch = 1 + k;
    frames.push(
      `${translate} rotate(${angle.toFixed(1)}deg) scale(${stretch.toFixed(4)}, ${(1 / stretch).toFixed(4)}) rotate(${(-angle).toFixed(1)}deg)`
    );
  }
  return frames;
}

if (typeof window !== "undefined") {
  window.SiteMotion = Object.assign(window.SiteMotion || {}, {
    SPRINGS,
    spring,
    linearEasing,
    springSamples,
    springNow,
    springStep,
    rippleDelays,
    flightFrames,
  });

  // Pictures that arrive after the page has drawn fade in (_sass/_springs.scss) instead of popping
  // into their reserved space. Pictures already loaded, reduced motion, and automation (whose
  // captures must stay deterministic unless the URL asks for ?cinematic=live) see them at once.
  const forceLive = /[?&]cinematic=live(?:&|$)/.test(window.location.search);
  const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches || (navigator.webdriver && !forceLive);
  if (!still)
    for (const image of document.querySelectorAll("main img, #main img")) {
      if (image.complete || image.closest(".duh-companion, [data-home-desk-scene], [aria-hidden='true']")) continue;
      image.setAttribute("data-site-image", "loading");
      const ready = () => image.setAttribute("data-site-image", "ready");
      image.addEventListener("load", ready, { once: true });
      image.addEventListener("error", ready, { once: true });
    }
}
