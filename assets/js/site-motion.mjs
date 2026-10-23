// One motion language for the site. The stylesheets carry these springs as CSS linear() curves
// (_sass/_springs.scss, printed by bin/spring_easing.cjs); this module gives the same springs to
// scripts that move things themselves: keyframes for the project cards, eases for the cinematic
// layer, canvas sketches. A spring is a damping ratio (zeta) and a period, the seconds one undamped
// oscillation would take, the way Apple's motion guidance describes springs. The 3D home's loading
// sketch set the bar: motion that arrives with a little weight, settles without wobble, and keeps its
// velocity through an interruption instead of starting over.

import { dissolveCardInk } from "./card-ink.mjs";

export const SPRINGS = Object.freeze({
  // Controls and menus answering a press: quick, with at most a hint of overshoot.
  confident: Object.freeze({ zeta: 0.8, period: 0.35 }),
  // The desk toys: bouncier, with a visible settle.
  playful: Object.freeze({ zeta: 0.55, period: 0.45 }),
  // Things that change place or size, like a project card opening inside its grid.
  layout: Object.freeze({ zeta: 0.84, period: 0.46 }),
  // Content arriving on the page: soft, with no visible overshoot.
  gentle: Object.freeze({ zeta: 0.9, period: 0.62 }),
  // Shapes answering a touch: a pressed button's corners, an indicator stretching between items.
  // Material 3 Expressive's fast spatial spring (damping ratio 0.6, stiffness 800, 2025).
  morph: Object.freeze({ zeta: 0.6, period: 0.222 }),
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

// The theme's light spreads like a drop finding its edge. Every sample has the same quadratic
// path topology, so the browser interpolates it without a per-frame DOM write. The last outline
// clears every corner, even when the choice is near an edge of a tall phone viewport.
export function waterPath(cx, cy, radius, wobble, phase, points = 72) {
  const vertices = Array.from({ length: points }, (_, i) => {
    const a = (i / points) * Math.PI * 2;
    const wave = 0.55 * Math.sin(3 * a + 1.7 + phase * 2.1) + 0.3 * Math.sin(5 * a + 0.4 - phase * 3.3) + 0.15 * Math.sin(9 * a + 2.9 + phase * 5.2);
    const r = Math.max(0, radius * (1 + wobble * wave));
    return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
  });
  const mid = (p, q) => [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2];
  const pair = (p) => p.map((v) => v.toFixed(1)).join(" ");
  let path = `M${pair(mid(vertices[0], vertices[1]))}`;
  for (let i = 1; i <= points; i++) path += `Q${pair(vertices[i % points])} ${pair(mid(vertices[i % points], vertices[(i + 1) % points]))}`;
  return `path("${path}Z")`;
}

export function waterFrames({ x, y, width, height, frames = 28, points = 72 } = {}) {
  const reach = Math.hypot(Math.max(x, width - x), Math.max(y, height - y)) * 1.12;
  const ease = spring("gentle").ease;
  return Array.from({ length: frames + 1 }, (_, i) => {
    const p = i / frames;
    return { clipPath: waterPath(x, y, 6 + (reach - 6) * ease(p), 0.075 * (1 - p) ** 1.4 + 0.004, 0.6 + p, points) };
  });
}

export function waterReveal(origin, root = document.documentElement) {
  const pseudoElement = "::view-transition-new(root)";
  const animation = root.animate(waterFrames({ ...origin, width: window.innerWidth, height: window.innerHeight }), {
    duration: 620,
    easing: "linear",
    fill: "both",
    pseudoElement,
  });
  // Some engines accept unknown animation options silently. Never clip the real document when
  // pseudo-element animation is unavailable; theme.js retains its CSS snapshot reveal instead.
  if (animation.effect?.pseudoElement !== pseudoElement) {
    animation.finished.catch(() => {});
    animation.cancel();
    return null;
  }
  return animation;
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

// A scroll carried to its resting place on a spring: the page to `top`, a sideways row to `left`, or
// both. An empty animation on `host` keeps the time, so whatever waits for the host's animations also
// waits for the scroll, and the last position is set exactly as that animation finishes: a change
// that has settled never leaves the page still travelling. `speed` (px/s) hands over the page's speed
// from a follow that was interrupted. A reader who scrolls meanwhile takes over, and the page stays
// where they put it.
export function scrollFollow(nameOrSpring, host, { top = null, row = null, left = 0, speed = 0 } = {}) {
  const s = typeof nameOrSpring === "object" && nameOrSpring.state ? nameOrSpring : spring(nameOrSpring);
  const view = host.ownerDocument.defaultView;
  const vertical = top !== null && top !== undefined;
  let lastY = view.scrollY;
  let lastX = row ? row.scrollLeft : 0;
  const y0 = vertical ? lastY - top : 0;
  const x0 = row ? lastX - left : 0;
  const animation = host.animate([], { duration: s.duration, easing: "linear" });
  let done = false;
  // Mandatory snapping would pull every step back to a snap point; the row snaps again once done.
  if (row) row.style.scrollSnapType = "none";
  const stop = () => {
    done = true;
    row?.style.removeProperty("scroll-snap-type");
  };
  const elapsed = () => Math.max(0, animation.currentTime || 0) / 1000;
  const land = () => {
    if (done) return;
    if (vertical) view.scrollTo({ top, behavior: "instant" });
    if (row) row.scrollTo({ left, behavior: "instant" });
    stop();
  };
  const step = () => {
    if (done || animation.playState !== "running") return;
    if (Math.abs(view.scrollY - lastY) > 2 || (row && Math.abs(row.scrollLeft - lastX) > 2)) {
      stop();
      animation.cancel();
      return;
    }
    const t = elapsed();
    if (vertical) {
      view.scrollTo({ top: top + s.state(y0, speed, t)[0], behavior: "instant" });
      lastY = view.scrollY;
    }
    if (row) {
      row.scrollTo({ left: left + s.state(x0, 0, t)[0], behavior: "instant" });
      lastX = row.scrollLeft;
    }
    view.requestAnimationFrame(step);
  };
  view.requestAnimationFrame(step);
  animation.finished.then(land, () => done || stop());
  return {
    animation,
    get active() {
      return !done;
    },
    // The page's speed now (px/s), for a follow that takes over from this one.
    speed: () => (vertical && !done ? s.state(y0, speed, elapsed())[1] : 0),
    land,
    cancel: () => {
      if (done) return;
      stop();
      animation.cancel();
    },
  };
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
    waterReveal,
    flightFrames,
    scrollFollow,
    dissolveCardInk,
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
