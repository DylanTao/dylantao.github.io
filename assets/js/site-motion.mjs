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

if (typeof window !== "undefined") {
  window.SiteMotion = Object.assign(window.SiteMotion || {}, { SPRINGS, spring, linearEasing, springSamples, springNow });

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
