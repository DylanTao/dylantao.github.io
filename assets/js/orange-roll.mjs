// The orange on the Page not found page leaves it. Touch it (hover, or a tap) and it rolls to the
// right along the shelf it was resting on, tips over the end, falls down the page into the footer's
// sea, shrinking to that coast's scale, and lands with a splash; an orange floats, so it stays
// there, bobbing. Sirui, November 16, 2026: "when hover on the orange, it will roll to right
// following physics simulation and then fall into ocean as it become smaller and you can do great
// water splash simulation there."
//
// The motion is orange-roll-physics.mjs; the splash and the floating orange belong to the footer's
// sea (footer-coast/splash.mjs), reached through two hooks on its element: coastLanding (where is
// open water under this column of the screen?) and coastSplash (it has landed here). Without a
// running sea (no WebGL, or the model has not arrived) the fall ends in a plain ring drawn on the
// page. With reduced motion the orange stays where it is.
import { ROLL, createRoll, shelfEnd, solvePush } from "./orange-roll-physics.mjs?v=orange-roll-20261116";

const reduced = matchMedia("(prefers-reduced-motion: reduce)");
// The footer's scale when the sea cannot say: its camera shows at least 40.5 of its units across,
// 14.5 for every unit of height, and the body is 0.32 of a unit in radius (footer-coast/scene.mjs,
// splash-physics.mjs).
const COAST = { least: 40.5, perHeight: 14.5, radius: 0.32, sea: 0.93 };

function landingFor(host, body) {
  const scene = host?.querySelector(".footer-coast__scene");
  if (!scene) return null;
  const frame = scene.getBoundingClientRect();
  if (!frame.width || !frame.height) return null;
  // Right of the orange and well inside the window, clear of the page's edge.
  const room = innerWidth - body.x;
  for (const share of [0.62, 0.74, 0.5, 0.84, 0.4]) {
    const clientX = Math.min(body.x + Math.max(room * share, 110), innerWidth - 36);
    const found = host.coastLanding?.({ clientX });
    if (found) return { x: found.clientX, y: found.clientY, radius: found.radius * found.pixelsPerUnit, live: true };
  }
  // The sea is not up yet: its still picture has the water along the bottom of the frame.
  const pixelsPerUnit = frame.width / Math.max(COAST.least, (frame.width / frame.height) * COAST.perHeight);
  return {
    x: Math.min(body.x + Math.max(room * 0.62, 110), innerWidth - 36),
    y: frame.top + frame.height * COAST.sea,
    radius: COAST.radius * pixelsPerUnit,
    live: false,
  };
}

// A plain ring where it went in, for a sea that is not running.
function ring(x, y, size) {
  for (const delay of [0, 0.22]) {
    const mark = document.createElement("span");
    mark.className = "orange-roll-ring";
    mark.setAttribute("aria-hidden", "true");
    mark.style.left = `${x}px`;
    mark.style.top = `${y}px`;
    mark.style.width = mark.style.height = `${size}px`;
    mark.style.animationDelay = `${delay}s`;
    document.body.append(mark);
    mark.addEventListener("animationend", () => mark.remove());
  }
}

function roll(mark, host) {
  const shell = mark.querySelector("[data-brand-body]"),
    art = mark.querySelector("svg");
  if (!shell || !art) return false;
  const box = mark.getBoundingClientRect(),
    round = shell.getBoundingClientRect();
  if (!round.width) return false;
  // The body as a circle: its centre and radius on the screen now.
  const body = { x: round.left + round.width / 2, y: round.top + round.height / 2, radius: (round.width + round.height) / 4 };
  host?.dispatchEvent(new Event("coast:wake"));
  const landing = landingFor(host, body);
  if (!landing) return false;

  // A copy that can cross the page; the original keeps its place, unseen, so nothing reflows.
  const mover = document.createElement("div");
  mover.className = `${mark.className} orange-roll`;
  mover.setAttribute("aria-hidden", "true");
  const turner = document.createElement("div");
  turner.className = "orange-roll__turn";
  turner.append(art.cloneNode(true));
  mover.append(turner);
  const origin = `${body.x - box.left}px ${body.y - box.top}px`;
  Object.assign(mover.style, {
    left: `${box.left + scrollX}px`,
    top: `${box.top + scrollY}px`,
    width: `${box.width}px`,
    height: `${box.height}px`,
    transformOrigin: origin,
  });
  turner.style.transformOrigin = origin;
  document.body.append(mover);
  mark.style.visibility = "hidden";
  mark.dataset.orangeRoll = "rolling";

  // In the page's own coordinates, so scrolling during the fall changes nothing.
  const start = { x: body.x + scrollX, y: body.y + scrollY },
    setup = {
      start,
      radius: body.radius,
      edge: shelfEnd(start.x, landing.x + scrollX),
      landing: { x: landing.x + scrollX, y: landing.y + scrollY },
      endScale: Math.min(1, landing.radius / body.radius),
    },
    motion = createRoll({ ...setup, push: solvePush(setup) });
  // The page follows the fall when the sea is below the fold, unless the visitor scrolls.
  let following = true;
  const release = () => (following = false);
  for (const type of ["wheel", "touchmove", "keydown"]) addEventListener(type, release, { passive: true, once: true });

  let before = performance.now();
  const frame = (now) => {
    const state = motion.step(Math.min((now - before) / 1000, 0.05));
    before = now;
    mover.style.transform = `translate3d(${state.x - start.x}px, ${state.y - start.y}px, 0) scale(${state.scale})`;
    turner.style.transform = `rotate(${state.angle}rad)`;
    if (state.phase === "fall") mark.dataset.orangeRoll = "falling";
    if (state.phase === "fall" && following) {
      const below = state.y - scrollY - innerHeight * 0.7;
      if (below > 0) scrollTo({ top: scrollY + below, behavior: "instant" });
    }
    if (state.phase === "stopped") {
      // A push too gentle to reach the end: it rests where it stopped.
      mark.dataset.orangeRoll = "stopped";
      return;
    }
    if (state.phase !== "landed") return requestAnimationFrame(frame);
    for (const type of ["wheel", "touchmove", "keydown"]) removeEventListener(type, release);
    const at = { clientX: state.x - scrollX, clientY: state.y - scrollY };
    const taken = Boolean(host?.coastSplash?.({ ...at, speed: state.speed, spin: state.spin }));
    if (!taken) ring(state.x, state.y, body.radius * state.scale * 9);
    mover.remove();
    mark.dataset.orangeLanding = `${Math.round(at.clientX)},${Math.round(at.clientY)}`;
    mark.dataset.orangeSea = taken ? "live" : "still";
    mark.dataset.orangeRoll = "landed";
    mark.dispatchEvent(new CustomEvent("orange:landed", { bubbles: true, detail: { ...at, sea: taken } }));
  };
  requestAnimationFrame(frame);
  return true;
}

for (const mark of document.querySelectorAll("[data-orange-specimen]")) {
  // The site's footer coast, not a miniature of it on some other page.
  const host = document.querySelector("[data-footer-coast]:not([data-miniature])");
  mark.dataset.orangeRoll = "ready";
  const begin = () => {
    if (mark.dataset.orangeRoll !== "ready" || reduced.matches) return;
    if (!roll(mark, host)) mark.dataset.orangeRoll = "ready";
  };
  mark.addEventListener("pointerenter", begin);
  mark.addEventListener("pointerdown", begin);
}

// For the tests: the page's scale of the motion.
export { ROLL };
