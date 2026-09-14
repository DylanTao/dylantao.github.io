import { createPortrait } from "./portrait.mjs";
import { companion } from "./bridge.mjs";

const studio = document.querySelector("[data-pip-studio]");
if (studio) start();
function start() {
  const canvas = studio.querySelector("canvas"),
    status = studio.querySelector("[data-pip-status]"),
    rest = studio.querySelector("[data-pip-rest]");
  const reduced = matchMedia("(prefers-reduced-motion: reduce)");
  let renderer,
    raf = 0,
    last = 0,
    frames = 0,
    time = 0,
    visible = true,
    disposed = false,
    lastGesture = "rest",
    sample = null;
  function makeRenderer() {
    try {
      renderer = createPortrait(canvas);
    } catch {
      renderer = null;
    }
    studio.dataset.renderer = renderer ? "webgl" : "poster";
    studio.querySelector(".pip-studio-gestures").hidden = !renderer;
    if (!renderer) status.textContent = "P’s portrait. Interactive motion is unavailable in this browser.";
  }
  makeRenderer();
  function request() {
    if (!raf && visible && !document.hidden && !disposed) raf = requestAnimationFrame(frame);
  }
  function syncRest() {
    rest.setAttribute("aria-pressed", String(companion.napping));
    rest.textContent = companion.napping ? "Wake P up" : "Let P nap";
    request();
  }
  function frame(now) {
    raf = 0;
    const dt = last ? Math.min(0.05, (now - last) / 1000) : 1 / 60;
    last = now;
    if (companion.owner !== "studio") {
      request();
      return;
    }
    const still = reduced.matches || companion.napping;
    if (!still) time += dt;
    const rect = canvas.getBoundingClientRect(),
      pointer = companion.pointer;
    const active = pointer.at > 0 && performance.now() - pointer.at < 5000;
    const gaze = active
      ? [(pointer.x - rect.left - rect.width / 2) / (rect.width * 0.55), (rect.top + rect.height * 0.45 - pointer.y) / (rect.height * 0.5)]
      : [0, 0];
    sample = companion.motion.update(dt, {
      gaze,
      still,
      nap: companion.napping,
      blink: !still && Math.sin(time * 1.15) > 0.997 ? 1 : 0,
      autonomous: false,
    });
    renderer?.draw({ pose: sample, theme: companion.theme });
    if (renderer) frames++;
    if (sample.gesture === "rest" && lastGesture !== "rest" && !reduced.matches) status.textContent = "A little room to be curious.";
    lastGesture = sample.gesture;
    if (!still && renderer) request();
  }
  studio.addEventListener("click", (event) => {
    const button = event.target.closest("button");
    if (!button) return;
    if (button === rest) {
      companion.napping = !companion.napping;
      try {
        sessionStorage.setItem("pip-napping", companion.napping ? "1" : "0");
      } catch {
        /* Session storage is optional. */
      }
      window.dispatchEvent(new Event("pip:nap"));
      status.textContent = companion.napping ? "A little rest. Still here." : "Oh, hello again.";
      syncRest();
    } else if (button.dataset.pipGesture) {
      if (companion.napping) {
        companion.napping = false;
        try {
          sessionStorage.setItem("pip-napping", "0");
        } catch {
          /* Optional. */
        }
        window.dispatchEvent(new Event("pip:nap"));
        syncRest();
      }
      companion.motion.play(button.dataset.pipGesture);
      const labels = {
        hello: "Hello! A small wave, then a moment to settle.",
        curious: "What’s that? A head tilt, with the antennae following.",
        nod: "Got it. A little nod is enough.",
        repair: "Oops. One sec… there, all better.",
      };
      status.textContent = reduced.matches ? "Reduced motion is on. P stays in a quiet pose." : labels[button.dataset.pipGesture];
      request();
    }
  });
  const observer = new IntersectionObserver((entries) => {
    visible = entries[0].isIntersecting;
    last = 0;
    if (visible) request();
    else {
      cancelAnimationFrame(raf);
      raf = 0;
    }
  });
  observer.observe(studio);
  window.addEventListener("pip:change", request);
  window.addEventListener("pip:nap", syncRest);
  window.addEventListener("resize", request);
  document.addEventListener("pointermove", request, { passive: true });
  document.addEventListener("visibilitychange", () => {
    last = 0;
    if (document.hidden) {
      cancelAnimationFrame(raf);
      raf = 0;
    } else request();
  });
  const theme = new MutationObserver(request);
  theme.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme", "data-theme-mode", "data-theme-setting"] });
  reduced.addEventListener("change", request);
  canvas.addEventListener("webglcontextlost", (event) => {
    event.preventDefault();
    renderer = null;
    studio.dataset.renderer = "poster";
    studio.querySelector(".pip-studio-gestures").hidden = true;
    status.textContent = "P’s portrait. Interactive motion is unavailable in this browser.";
  });
  canvas.addEventListener("webglcontextrestored", () => {
    if (!disposed) {
      makeRenderer();
      if (renderer) status.textContent = "A little room to be curious.";
      request();
    }
  });
  window.addEventListener("pagehide", (event) => {
    cancelAnimationFrame(raf);
    raf = 0;
    if (!event.persisted) {
      disposed = true;
      renderer?.dispose();
      observer.disconnect();
      theme.disconnect();
    }
  });
  window.addEventListener("pageshow", () => {
    last = 0;
    request();
  });
  studio.getPipEvidence = () => ({ renderer: renderer ? "webgl" : "poster", pose: sample, visible, time, frames, owner: companion.owner });
  syncRest();
}
