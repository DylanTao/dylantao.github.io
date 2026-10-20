// Surface motion (2026-10-19, after the October 18 glass pass). Cards are flat now: a hovered card lifts on the
// confident spring (_sass/_glass.scss) while a soft light pools under the pointer and follows it, and cards and
// buttons dip on a press and spring back on the morph spring, a pressed button's corners squaring as it goes. The
// cards no longer lean toward the pointer: a tilted pane over a drifting picture read as a 2017 effect. The light
// is stepped exactly each frame on the confident spring from site-motion.mjs, so a hover that leaves mid-motion
// fades from wherever it is.
//
// Who sees what: a pointer that can hover gets the light, lift and press; touch gets the press only; reduced
// motion and automation (navigator.webdriver, unless the URL asks for ?cinematic=live) see a still page.

const clamp = (value, low, high) => Math.min(high, Math.max(low, value));

// Where the light sits over a box for a pointer at (x, y): gx, gy in % of the box, held at the edge when the
// pointer has already left it between frames.
export function lightFromPointer(x, y, box) {
  if (!box || !(box.width > 0) || !(box.height > 0)) return { gx: 50, gy: 50 };
  return {
    gx: clamp((x - box.left) / box.width, 0, 1) * 100,
    gy: clamp((y - box.top) / box.height, 0, 1) * 100,
  };
}

// The resting state a released card's light fades back to.
export const REST = Object.freeze({ hover: 0 });

// Advance every channel of a surface's light one frame toward its target on a spring from site-motion.mjs (an
// object with state(x0, v0, t)), solved exactly over the frame with the target held still.
export function stepSurface(state, target, dt, motion) {
  const next = { ...state };
  const step = Math.max(0, Math.min(dt, 0.1));
  let moving = false;
  for (const key of ["hover", "gx", "gy"]) {
    if (!(key in target)) continue;
    const [offset, velocity] = motion.state((state[key] ?? target[key]) - target[key], state[`v${key}`] ?? 0, step);
    const value = target[key] + offset;
    next[key] = value;
    next[`v${key}`] = velocity;
    const tolerance = key === "hover" ? 0.002 : 0.05;
    if (Math.abs(value - target[key]) > tolerance || Math.abs(velocity) > 0.02) moving = true;
  }
  next.settled = !moving;
  return next;
}

export const SURFACE_SELECTOR = ".projects .project-card > .card, .blog-card, .lab-card, .project-child-card";
export const PRESS_SELECTOR = [
  SURFACE_SELECTOR,
  ".project-card-open-link",
  ".project-card-secondary-link",
  ".project-card-close",
  ".project-case-actions a",
  ".project-deck-trail button",
  ".project-children-deck",
  ".blog-layout-toggle button",
  ".glass-pressable",
].join(", ");

if (typeof window !== "undefined" && typeof document !== "undefined") {
  const root = document.documentElement;
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
  const fine = window.matchMedia("(hover: hover) and (pointer: fine)");
  const forceLive = /[?&]cinematic=live(?:&|$)/.test(window.location.search);
  const automated = Boolean(navigator.webdriver) && !forceLive;

  const live = () => !reduce.matches && !automated;
  const syncClasses = () => {
    root.classList.toggle("glass-motion", live());
    root.classList.toggle("glass-hover", live() && fine.matches);
  };
  syncClasses();
  reduce.addEventListener("change", syncClasses);
  fine.addEventListener("change", syncClasses);

  // The confident spring (site-motion.mjs runs first); a plain critically damped stand-in otherwise.
  const motion = window.SiteMotion?.spring?.("confident") || {
    state: (x0, v0, t) => {
      const w = 18;
      const decay = Math.exp(-w * t);
      return [(x0 + (v0 + w * x0) * t) * decay, (v0 - w * (v0 + w * x0) * t) * decay];
    },
  };
  const states = new Map();
  let frame = 0;
  let last = 0;

  const still = (surface) =>
    Boolean(
      surface.closest(".is-expanded, .is-open, .is-reflowing, .has-expanded-project-card") ||
      root.hasAttribute("data-project-deck-moving") ||
      surface.getAnimations?.().length
    );

  const write = (surface, state) => {
    const style = surface.style;
    style.setProperty("--glass-hover", state.hover.toFixed(3));
    style.setProperty("--glass-x", `${state.gx.toFixed(1)}%`);
    style.setProperty("--glass-y", `${state.gy.toFixed(1)}%`);
  };
  const clear = (surface) => {
    for (const name of ["--glass-hover", "--glass-x", "--glass-y"]) surface.style.removeProperty(name);
  };

  const tick = (now) => {
    frame = 0;
    const dt = last ? Math.min(0.05, (now - last) / 1000) : 1 / 60;
    last = now;
    states.forEach((entry, surface) => {
      if (!surface.isConnected) {
        states.delete(surface);
        return;
      }
      entry.state = stepSurface(entry.state, entry.target, dt, motion);
      write(surface, entry.state);
      if (entry.state.settled && !entry.active) {
        states.delete(surface);
        clear(surface);
      }
    });
    if (states.size) frame = window.requestAnimationFrame(tick);
    else last = 0;
  };
  const wake = () => {
    if (!frame) frame = window.requestAnimationFrame(tick);
  };

  const aim = (surface, event) => {
    let entry = states.get(surface);
    const light = lightFromPointer(event.clientX, event.clientY, surface.getBoundingClientRect());
    if (!entry) {
      // The light appears where the pointer entered instead of sliding in from the middle.
      entry = { state: { ...REST, ...light }, target: { ...REST, ...light }, active: false };
      states.set(surface, entry);
    }
    entry.active = true;
    entry.target = { hover: 1, gx: light.gx, gy: light.gy };
    wake();
  };
  const release = (surface) => {
    const entry = states.get(surface);
    if (!entry) return;
    entry.active = false;
    entry.target = { ...REST, gx: entry.state.gx, gy: entry.state.gy };
    wake();
  };

  let hovered = null;
  document.addEventListener(
    "pointermove",
    (event) => {
      if (event.pointerType !== "mouse" && event.pointerType !== "pen") return;
      if (!root.classList.contains("glass-hover")) return;
      const surface = event.target instanceof Element ? event.target.closest(SURFACE_SELECTOR) : null;
      if (hovered && hovered !== surface) release(hovered);
      hovered = surface && !still(surface) ? surface : null;
      if (hovered) aim(hovered, event);
      else if (surface) release(surface);
    },
    { passive: true }
  );
  document.addEventListener("pointerleave", () => {
    if (hovered) release(hovered);
    hovered = null;
  });
  // A card that opens or starts moving lets go of its light at once.
  document.addEventListener("click", () => {
    if (hovered && still(hovered)) {
      release(hovered);
      hovered = null;
    }
  });

  // Press: all pointers and the keyboard. The class is held at least long enough to be seen.
  const pressedAt = new WeakMap();
  const press = (element) => {
    if (!root.classList.contains("glass-motion")) return;
    element.classList.add("is-pressed");
    pressedAt.set(element, performance.now());
  };
  const unpress = (element) => {
    const since = performance.now() - (pressedAt.get(element) || 0);
    const lift = () => element.classList.remove("is-pressed");
    if (since < 90) window.setTimeout(lift, 90 - since);
    else lift();
  };
  document.addEventListener(
    "pointerdown",
    (event) => {
      if (event.button > 0) return;
      const target = event.target instanceof Element ? event.target.closest(PRESS_SELECTOR) : null;
      if (!target) return;
      // An open card does not dip under a press; the buttons inside it still answer one.
      if (target.matches(SURFACE_SELECTOR) && target.closest(".is-expanded > .card, .is-open > .card")) return;
      press(target);
      const done = () => {
        unpress(target);
        window.removeEventListener("pointerup", done);
        window.removeEventListener("pointercancel", done);
        target.removeEventListener("pointerleave", done);
      };
      window.addEventListener("pointerup", done);
      window.addEventListener("pointercancel", done);
      target.addEventListener("pointerleave", done);
    },
    { passive: true }
  );
  document.addEventListener("keydown", (event) => {
    if (event.repeat || (event.key !== "Enter" && event.key !== " ")) return;
    const target = event.target instanceof Element ? event.target.closest(PRESS_SELECTOR) : null;
    if (target && target === event.target) press(target);
  });
  document.addEventListener("keyup", (event) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    document.querySelectorAll(".is-pressed").forEach(unpress);
  });

  window.SiteGlass = Object.assign(window.SiteGlass || {}, { lightFromPointer });
}
