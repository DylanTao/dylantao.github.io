// The 3D home's build diary (_includes/build-diary.liquid). Two small jobs:
//
// 1. A same-camera pair becomes one frame with a divider: the before view on the left of it, the after
//    view on the right, in reading order. Drag across the picture, or use the range under it (the
//    keyboard's way in), to move the divider. Without this script every pair stands side by side, so
//    nothing depends on it.
// 2. When the cinematic layer is live (assets/js/cinematic.js: no reduced motion, no Pause motion and
//    no automation unless ?cinematic=live), entries below the fold settle into place once as they
//    arrive, on the site's gentle spring. Their words and pictures are visible the whole time; the
//    motion only carries them the last few pixels. As a frame scrolls in, its divider sweeps from the
//    right edge to the middle, so the after view slides in over the before one. That sweep is CSS
//    (_sass/_build-diary.scss), and stops for good once a visitor moves the divider.
const root = document.documentElement;
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

// The range is the divider's position from the left edge: everything left of it is the before view.
function describe(value) {
  if (value <= 0) return "All after";
  if (value >= 100) return "All before";
  return `${value}% before, ${100 - value}% after`;
}

function enhanceCompare(figure) {
  const frames = figure.querySelector(".build-diary-frames");
  const control = figure.querySelector("[data-diary-control]");
  const range = control?.querySelector('input[type="range"]');
  if (!frames || !range) return;
  const show = () => {
    figure.style.setProperty("--diary-split", `${range.value}%`);
    range.setAttribute("aria-valuetext", describe(Number(range.value)));
  };
  // Once a visitor moves the divider it is theirs: the scroll-driven sweep stops for this frame.
  const adjust = () => {
    figure.classList.add("is-adjusted");
    show();
  };
  range.addEventListener("input", adjust);

  // The divider can also be dragged across the picture itself. Vertical swipes still scroll the page
  // (touch-action: pan-y in the stylesheet); the range stays the keyboard's way in.
  let dragging = null;
  const follow = (event) => {
    const box = frames.getBoundingClientRect();
    if (!box.width) return;
    const value = Math.round(Math.min(1, Math.max(0, (event.clientX - box.left) / box.width)) * 100);
    if (String(value) === range.value && figure.classList.contains("is-adjusted")) return;
    range.value = String(value);
    adjust();
  };
  frames.addEventListener("pointerdown", (event) => {
    if (event.button !== 0) return;
    // A mouse press would otherwise start dragging the picture itself.
    if (event.pointerType === "mouse") event.preventDefault();
    dragging = event.pointerId;
    frames.setPointerCapture?.(event.pointerId);
    follow(event);
  });
  frames.addEventListener("pointermove", (event) => {
    if (event.pointerId === dragging) follow(event);
  });
  const release = (event) => {
    if (event.pointerId === dragging) dragging = null;
  };
  frames.addEventListener("pointerup", release);
  frames.addEventListener("pointercancel", release);

  show();
  control.hidden = false;
  figure.classList.add("is-slider");
}

function motionLive() {
  return root.classList.contains("cinematic-live") && !reducedMotion.matches && root.getAttribute("data-motion") !== "paused";
}

function settleEntries(entries) {
  if (!motionLive() || !("IntersectionObserver" in window)) return;
  const arriving = new Set();
  const settle = (entry) => {
    if (!arriving.delete(entry)) return;
    entry.classList.remove("is-arriving");
    observer.unobserve(entry);
  };
  const observer = new IntersectionObserver(
    (records) => {
      for (const record of records) if (record.isIntersecting) settle(record.target);
    },
    { rootMargin: "0px 0px -6% 0px" }
  );
  for (const entry of entries) {
    // Entries already on screen stay where they are; only the ones still to come wait below.
    if (entry.getBoundingClientRect().top < window.innerHeight) continue;
    entry.classList.add("is-arriving");
    arriving.add(entry);
    observer.observe(entry);
  }
  // Keyboard visitors never wait for the scroll position, and Pause motion settles everything at once.
  document.addEventListener("focusin", (event) => {
    const entry = event.target instanceof Element ? event.target.closest(".build-diary-entry") : null;
    if (entry) settle(entry);
  });
  const settleAll = () => {
    if (!motionLive()) [...arriving].forEach(settle);
  };
  reducedMotion.addEventListener?.("change", settleAll);
}

function start() {
  for (const diary of document.querySelectorAll("[data-build-diary]")) {
    diary.querySelectorAll('[data-diary-compare="slider"]').forEach(enhanceCompare);
    settleEntries(diary.querySelectorAll(".build-diary-entry"));
  }
}

// This module can run before cinematic.js (both wait for the document to parse, in page order), so
// wait for it to set html.cinematic-ready, or for DOMContentLoaded on a page without the layer.
if (root.classList.contains("cinematic-ready") || document.readyState === "complete") start();
else document.addEventListener("DOMContentLoaded", start, { once: true });
