// A shelf: a row you can take hold of.
//
// The row is an ordinary scroll container with CSS scroll snapping. Touch, trackpads, wheels and
// keys already scroll it natively, so they are left alone and none of this loads on a phone. A
// mouse has no way to throw a row, so for fine pointers a press that travels becomes a drag: the
// row follows the hand, and on release it carries the hand's speed onto the snap point that speed
// was heading for, on the same spring as everything else that changes place on this site
// (site-motion.mjs).
//
// The approach is Blossom Carousel's (Jesper Vos, https://github.com/jespervos/blossom-carousel,
// Apache-2.0): enhance native scrolling instead of replacing it, engage only where the platform
// offers nothing, and let any other input win at once. No code is copied. Where this differs:
//   - momentum is measured in seconds, so a throw travels the same distance at 60 and 120 Hz;
//   - a throw lands on a damped spring that inherits the release velocity, not a geometric decay;
//   - reduced motion and the site's Pause motion get a drag with no flight;
//   - nothing global is patched, and listeners live only on the row and only while pressed;
//   - text inside the row stays selectable until a drag actually begins.

import { springStep } from "./site-motion.mjs";

export const SHELF = Object.freeze({
  slop: 6, // px a press may wander and still be a click
  history: 0.08, // seconds of pointer history that set the release speed
  glide: 4.2, // 1/s: a free throw's speed decays as exp(-glide t)
  nudge: 260, // px/s: a quick short flick still advances one stop
  maxSpeed: 5200, // px/s
  rubber: 0.55, // how far the row gives past its end, as a share of the pull
  spring: "layout",
  rest: [0.4, 6], // px and px/s under which the flight has landed
});

// Release speed from recent pointer samples [{ t: ms, x: px }], in px/s. Samples older than the
// history window say nothing about where the hand is going now.
export function releaseVelocity(samples, now, history = SHELF.history, maxSpeed = SHELF.maxSpeed) {
  const recent = samples.filter((sample) => now - sample.t <= history * 1000);
  if (recent.length < 2) return 0;
  const first = recent[0],
    last = recent[recent.length - 1],
    seconds = (last.t - first.t) / 1000;
  if (seconds <= 0) return 0;
  return Math.max(-maxSpeed, Math.min(maxSpeed, (last.x - first.x) / seconds));
}

// Where a free throw would come to rest.
export const restingPoint = (position, velocity, glide = SHELF.glide) => position + velocity / glide;

// One frame of a free throw, exact for any frame length: the speed decays as exp(-glide t) and the
// position takes that decay's integral, so 60 and 120 Hz screens land on the same pixel.
export function glideStep(position, velocity, seconds, glide = SHELF.glide) {
  const decay = Math.exp(-glide * seconds);
  return [position + (velocity * (1 - decay)) / glide, velocity * decay];
}

// The stop a release is heading for. `stops` are scroll offsets in ascending order. A throw goes
// to the stop nearest its resting point; a short quick flick that would fall back still moves on
// one stop, because that is what the hand asked for.
export function chooseStop(stops, position, velocity, { glide = SHELF.glide, nudge = SHELF.nudge } = {}) {
  if (!stops.length) return null;
  const nearest = (x) => stops.reduce((best, stop) => (Math.abs(stop - x) < Math.abs(best - x) ? stop : best), stops[0]);
  const here = nearest(position),
    there = nearest(restingPoint(position, velocity, glide));
  if (there !== here || Math.abs(velocity) < nudge) return there;
  const index = stops.indexOf(here) + Math.sign(velocity);
  return stops[Math.max(0, Math.min(stops.length - 1, index))];
}

// Resistance past an end: a small pull is followed at the `rubber` share, a long one less and less,
// and never beyond the row's own width (the curve iOS uses for its scroll views).
export function rubberBand(overshoot, width, rubber = SHELF.rubber) {
  if (!overshoot || width <= 0) return 0;
  const pull = Math.abs(overshoot);
  return Math.sign(overshoot) * ((pull * width * rubber) / (width + rubber * pull));
}

// Scroll offsets the row snaps to, read from its children's snap alignment.
export function snapStops(scroller, view = globalThis.getComputedStyle) {
  const style = view(scroller);
  if (!style.scrollSnapType || style.scrollSnapType === "none") return [];
  const max = scroller.scrollWidth - scroller.clientWidth,
    box = scroller.getBoundingClientRect(),
    padStart = parseFloat(style.scrollPaddingLeft) || 0,
    padEnd = parseFloat(style.scrollPaddingRight) || 0,
    stops = new Set();
  for (const child of scroller.children) {
    const align = view(child).scrollSnapAlign?.split(" ").pop();
    if (!align || align === "none") continue;
    const rect = child.getBoundingClientRect(),
      left = rect.left - box.left + scroller.scrollLeft;
    const offset =
      align === "center"
        ? left + rect.width / 2 - (padStart + (scroller.clientWidth - padStart - padEnd) / 2)
        : align === "end"
          ? left + rect.width - (scroller.clientWidth - padEnd)
          : left - padStart;
    stops.add(Math.round(Math.max(0, Math.min(max, offset))));
  }
  return [...stops].sort((a, b) => a - b);
}

const finePointer = () => globalThis.matchMedia?.("(hover: hover) and (pointer: fine)").matches ?? false;
const motionAllowed = () =>
  !(globalThis.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false) &&
  document.documentElement.getAttribute("data-motion") !== "paused";

// Gives one row its handle. Returns { destroy, state } or null where the platform needs no help.
export function createShelf(scroller, options = {}) {
  if (!scroller || !finePointer()) return null;
  const dials = { ...SHELF, ...options };
  let phase = "idle", // idle | pressed | dragging | flying
    samples = [],
    pressX = 0,
    pressScroll = 0,
    position = 0,
    velocity = 0,
    target = null,
    frame = 0,
    last = 0,
    snapType = "",
    behaviour = "",
    wanted = 0,
    give = 0,
    stops = [];

  const max = () => Math.max(0, scroller.scrollWidth - scroller.clientWidth);
  const show = () => scroller.setAttribute("data-shelf", scroller.scrollWidth > scroller.clientWidth + 1 ? phase : "still");
  const lean = (px) => {
    give = px;
    scroller.style.translate = Math.abs(px) > 0.05 ? `${px.toFixed(2)}px 0` : "";
  };
  function hold() {
    // Read the stops while the row still snaps, then take over: scripted positions must land
    // where they are put, with no snapping or smoothing in between.
    stops = snapStops(scroller);
    snapType = scroller.style.scrollSnapType;
    behaviour = scroller.style.scrollBehavior;
    scroller.style.scrollSnapType = "none";
    scroller.style.scrollBehavior = "auto";
  }
  function release() {
    scroller.style.scrollSnapType = snapType;
    scroller.style.scrollBehavior = behaviour;
  }
  function settle() {
    cancelAnimationFrame(frame);
    frame = 0;
    lean(0);
    if (phase === "dragging" || phase === "flying") release();
    phase = "idle";
    scroller.style.userSelect = "";
    show();
  }

  function fly(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    const edge = max();
    if (target !== null) {
      [position, velocity] = springStep(dials.spring, position, velocity, target, dt);
    } else {
      [position, velocity] = glideStep(position, velocity, dt, dials.glide);
      // A free throw that reaches an end stops there and gives a little.
      if (position < 0 || position > edge) {
        target = position < 0 ? 0 : edge;
      }
    }
    const inside = Math.max(0, Math.min(edge, position));
    scroller.scrollLeft = inside;
    lean(-rubberBand(position - inside, scroller.clientWidth, dials.rubber) * 0.5);
    const goal = target ?? position;
    if (Math.abs(position - goal) < dials.rest[0] && Math.abs(velocity) < dials.rest[1]) {
      if (target !== null) scroller.scrollLeft = Math.max(0, Math.min(edge, target));
      settle();
      scroller.dispatchEvent(new CustomEvent("shelf:rest", { bubbles: true }));
      return;
    }
    frame = requestAnimationFrame(fly);
  }

  function onPointerDown(event) {
    if (event.pointerType !== "mouse" || event.button !== 0 || scroller.scrollWidth <= scroller.clientWidth + 1) return;
    // A new press takes over from a flight where it is.
    if (phase === "flying") {
      cancelAnimationFrame(frame);
      frame = 0;
      lean(0);
      phase = "dragging";
    } else {
      phase = "pressed";
    }
    pressX = event.clientX;
    pressScroll = scroller.scrollLeft;
    samples = [{ t: event.timeStamp, x: event.clientX }];
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("pointercancel", onPointerUp);
    show();
  }

  function onPointerMove(event) {
    samples.push({ t: event.timeStamp, x: event.clientX });
    if (samples.length > 24) samples.shift();
    if (phase === "pressed") {
      if (Math.abs(event.clientX - pressX) < dials.slop) return;
      phase = "dragging";
      hold();
      scroller.style.userSelect = "none";
      show();
    }
    if (phase !== "dragging") return;
    event.preventDefault();
    wanted = pressScroll - (event.clientX - pressX);
    const edge = max(),
      inside = Math.max(0, Math.min(edge, wanted));
    scroller.scrollLeft = inside;
    lean(-rubberBand(wanted - inside, scroller.clientWidth, dials.rubber));
  }

  function onPointerUp(event) {
    window.removeEventListener("pointermove", onPointerMove);
    window.removeEventListener("pointerup", onPointerUp);
    window.removeEventListener("pointercancel", onPointerUp);
    if (phase !== "dragging") {
      phase = "idle";
      show();
      return;
    }
    // The click that ends a drag is the drag's, not the card's.
    scroller.addEventListener("click", swallow, { capture: true, once: true });
    setTimeout(() => scroller.removeEventListener("click", swallow, { capture: true }), 0);
    // Past an end the row was only leaning; the flight starts from where the lean shows it.
    position = scroller.scrollLeft - give;
    // The row moves against the hand.
    velocity = -releaseVelocity(samples, event.timeStamp, dials.history, dials.maxSpeed);
    if (!motionAllowed()) {
      settle();
      return;
    }
    target = stops.length ? chooseStop(stops, position, velocity, dials) : null;
    phase = "flying";
    last = performance.now();
    show();
    frame = requestAnimationFrame(fly);
  }

  const swallow = (event) => {
    event.preventDefault();
    event.stopPropagation();
  };
  // Any other way of scrolling wins at once: the flight stops and the platform takes over.
  const yieldTo = () => {
    if (phase === "flying") settle();
  };
  const noNativeDrag = (event) => {
    if (phase !== "idle") event.preventDefault();
  };

  scroller.addEventListener("pointerdown", onPointerDown);
  scroller.addEventListener("wheel", yieldTo, { passive: true });
  scroller.addEventListener("touchstart", yieldTo, { passive: true });
  scroller.addEventListener("keydown", yieldTo);
  scroller.addEventListener("dragstart", noNativeDrag);
  const resize = new ResizeObserver(show);
  resize.observe(scroller);
  show();

  return {
    get state() {
      return { phase, position, velocity, target, give, wanted };
    },
    // For buttons: go to the neighbouring stop on the same spring, from wherever the row is.
    step(direction) {
      if (phase === "flying") cancelAnimationFrame(frame);
      else hold();
      if (!stops.length) {
        if (phase !== "flying") release();
        return false;
      }
      position = scroller.scrollLeft;
      const here = stops.reduce((best, stop) => (Math.abs(stop - position) < Math.abs(best - position) ? stop : best), stops[0]);
      target = stops[Math.max(0, Math.min(stops.length - 1, stops.indexOf(here) + Math.sign(direction)))];
      if (!motionAllowed()) {
        scroller.scrollLeft = target;
        phase = "flying";
        settle();
        return true;
      }
      velocity = phase === "flying" ? velocity : 0;
      phase = "flying";
      last = performance.now();
      show();
      frame = requestAnimationFrame(fly);
      return true;
    },
    destroy() {
      settle();
      resize.disconnect();
      scroller.removeAttribute("data-shelf");
      scroller.removeEventListener("pointerdown", onPointerDown);
      scroller.removeEventListener("wheel", yieldTo);
      scroller.removeEventListener("touchstart", yieldTo);
      scroller.removeEventListener("keydown", yieldTo);
      scroller.removeEventListener("dragstart", noNativeDrag);
    },
  };
}
