// Glass motion (2026-10-18): the site's glass cards lean a few degrees toward the pointer, a highlight
// follows it across the glass, and the card lifts with a deeper shadow; cards and glass buttons sink
// on a press and come back on the playful spring with a small bounce (_sass/_glass.scss). Pointer
// motion uses the confident spring from site-motion.mjs, stepped exactly each frame, so a hover that
// leaves mid-motion settles from wherever it is.
//
// Who sees what: a pointer that can hover gets tilt, highlight and press; touch gets press only;
// reduced motion and automation (navigator.webdriver, unless the URL asks for ?cinematic=live) see a
// still page. The teaser behind each card's glass is material, not motion, so everyone gets it.

// Largest lean in degrees (around the horizontal and vertical axes), hover lift in px, and how far the
// picture drifts against the lean, in px.
export const TILT = Object.freeze({ maxX: 3.2, maxY: 4.2, lift: -4, drift: 5 });

const clamp = (value, low, high) => Math.min(high, Math.max(low, value));

// Where a pointer sits over a box, as a lean (rx, ry in degrees: the edge under the pointer dips
// away, the convention the projects index has used since the cinematic pass), a highlight position
// (gx, gy in % of the box) and a picture drift (dx, dy in px, against the lean).
export function tiltFromPointer(x, y, box, limits = TILT) {
  if (!box || !(box.width > 0) || !(box.height > 0)) return { rx: 0, ry: 0, gx: 50, gy: 50, dx: 0, dy: 0 };
  const px = clamp((x - box.left) / box.width, 0, 1) - 0.5;
  const py = clamp((y - box.top) / box.height, 0, 1) - 0.5;
  return {
    rx: -py * 2 * limits.maxX,
    ry: px * 2 * limits.maxY,
    gx: (px + 0.5) * 100,
    gy: (py + 0.5) * 100,
    dx: -px * 2 * limits.drift,
    dy: -py * 2 * limits.drift,
  };
}

// The resting state a released card springs back to.
export const REST = Object.freeze({ rx: 0, ry: 0, lift: 0, hover: 0, dx: 0, dy: 0 });

// Advance every channel of a tilt state one frame toward its target on a spring from site-motion.mjs
// (an object with state(x0, v0, t)), solved exactly over the frame with the target held still.
export function stepTilt(state, target, dt, motion) {
  const next = { ...state };
  const step = Math.max(0, Math.min(dt, 0.1));
  let moving = false;
  for (const key of ["rx", "ry", "lift", "hover", "dx", "dy", "gx", "gy"]) {
    if (!(key in target)) continue;
    const [offset, velocity] = motion.state((state[key] ?? target[key]) - target[key], state[`v${key}`] ?? 0, step);
    const value = target[key] + offset;
    next[key] = value;
    next[`v${key}`] = velocity;
    if (Math.abs(value - target[key]) > 0.002 || Math.abs(velocity) > 0.02) moving = true;
  }
  next.settled = !moving;
  return next;
}

export const TILT_SELECTOR = ".projects .project-card > .card, .blog-card, .lab-card, .project-child-card";
export const PRESS_SELECTOR = [
  TILT_SELECTOR,
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

  // The teaser behind the glass: the picture the card already loaded, as a CSS image, so the blurred
  // layer costs no extra request. Swapped pictures (random teasers) update it when they load.
  const teaserFor = (surface) =>
    surface.querySelector(".project-card-media img, .blog-card-media img, .lab-card-thumb img, .project-child-thumb img");
  const paintTeaser = (surface) => {
    const image = teaserFor(surface);
    if (!image) return;
    const apply = () => {
      const source = image.currentSrc || image.src;
      if (!source || !image.naturalWidth) return;
      surface.style.setProperty("--project-teaser", `url("${source.replace(/"/g, "%22")}")`);
    };
    if (image.complete) apply();
    image.addEventListener("load", apply);
  };
  const paintAllTeasers = () => document.querySelectorAll(".projects .project-card > .card, .blog-card").forEach(paintTeaser);
  paintAllTeasers();

  const live = () => !reduce.matches && !automated;
  const syncClasses = () => {
    root.classList.toggle("glass-motion", live());
    root.classList.toggle("glass-tilt", live() && fine.matches);
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
    style.setProperty("--glass-rx", `${state.rx.toFixed(3)}deg`);
    style.setProperty("--glass-ry", `${state.ry.toFixed(3)}deg`);
    style.setProperty("--glass-lift", `${state.lift.toFixed(2)}px`);
    style.setProperty("--glass-hover", state.hover.toFixed(3));
    style.setProperty("--glass-x", `${state.gx.toFixed(1)}%`);
    style.setProperty("--glass-y", `${state.gy.toFixed(1)}%`);
    style.setProperty("--glass-drift-x", `${state.dx.toFixed(2)}px`);
    style.setProperty("--glass-drift-y", `${state.dy.toFixed(2)}px`);
  };
  const clear = (surface) => {
    for (const name of ["--glass-rx", "--glass-ry", "--glass-lift", "--glass-hover", "--glass-x", "--glass-y", "--glass-drift-x", "--glass-drift-y"])
      surface.style.removeProperty(name);
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
      entry.state = stepTilt(entry.state, entry.target, dt, motion);
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
    if (!entry) {
      entry = { state: { ...REST, gx: 50, gy: 50 }, target: { ...REST, gx: 50, gy: 50 }, active: false };
      states.set(surface, entry);
    }
    const lean = tiltFromPointer(event.clientX, event.clientY, surface.getBoundingClientRect());
    entry.active = true;
    entry.target = { rx: lean.rx, ry: lean.ry, lift: TILT.lift, hover: 1, dx: lean.dx, dy: lean.dy, gx: lean.gx, gy: lean.gy };
    // The highlight appears where the pointer entered instead of sliding in from the middle.
    if (entry.state.hover < 0.02) {
      entry.state.gx = lean.gx;
      entry.state.gy = lean.gy;
    }
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
      if (!root.classList.contains("glass-tilt")) return;
      const surface = event.target instanceof Element ? event.target.closest(TILT_SELECTOR) : null;
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
  // A card that opens or starts moving lets go of its lean at once.
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
      if (!target || target.closest(".is-expanded > .card, .is-open > .card")) return;
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

  window.SiteGlass = Object.assign(window.SiteGlass || {}, { paintTeaser, paintAllTeasers, tiltFromPointer });
}
