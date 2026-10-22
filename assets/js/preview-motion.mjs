// Animated publication previews play by themselves (Sirui, 2026-10-19: "you can just play instead of
// having a button for it"). Each [data-preview-motion] figure in _layouts/bib.liquid holds the poster
// image and a muted, looping video (bin/make_preview_media.py). The video starts once a quarter of it
// is on screen and stops when it leaves or the tab is hidden; a small pause control in the corner
// meets WCAG 2.2.2 for motion longer than five seconds, and a pause the visitor chose sticks until
// they press play again. Reduced motion, Save-Data and automation (unless ?cinematic=live) keep the
// poster, with the same control to start it. Clicking the video opens the original GIF large, in the
// same zoom the poster has. The module is listed once per animated preview; browsers run it once.

const VISIBLE_SHARE = 0.25;

export function prefersStill({ reducedMotion = false, saveData = false, automated = false } = {}) {
  return Boolean(reducedMotion || saveData || automated);
}

// Whether a figure should be playing now, from what the visitor chose and what they can see.
export function shouldPlay({ autoplay, userChoice, visibleShare, pageHidden }) {
  if (pageHidden || visibleShare < VISIBLE_SHARE) return false;
  if (userChoice === "paused") return false;
  if (userChoice === "playing") return true;
  return Boolean(autoplay);
}

function setup(figure, { autoplay }) {
  const video = figure.querySelector("video");
  const poster = figure.querySelector("img");
  if (!video) return;
  let userChoice = null; // null until the visitor presses the control: "playing" | "paused"
  let visibleShare = 0;

  const button = document.createElement("button");
  button.type = "button";
  button.className = "preview-motion-toggle";
  figure.append(button);

  const label = () => {
    const playing = !video.paused && !video.hidden;
    button.setAttribute("aria-pressed", String(playing));
    button.setAttribute("aria-label", playing ? "Pause the animation" : "Play the animation");
    button.title = playing ? "Pause" : "Play";
    figure.setAttribute("data-preview-motion-state", playing ? "playing" : "paused");
  };

  const sync = () => {
    const play = shouldPlay({ autoplay, userChoice, visibleShare, pageHidden: document.hidden });
    if (play && video.paused) {
      if (video.preload === "none") video.preload = "auto";
      const attempt = video.play();
      if (attempt && typeof attempt.catch === "function") attempt.catch(() => label());
    } else if (!play && !video.paused) {
      video.pause();
    }
  };

  // The video takes the poster's place only once it is drawing frames, so a slow network or a
  // refused play() leaves the poster in view instead of an empty box.
  video.addEventListener("playing", () => {
    video.hidden = false;
    label();
  });
  video.addEventListener("pause", label);
  video.addEventListener("error", () => {
    video.hidden = true;
    button.hidden = true;
  });
  video.addEventListener("click", () => poster?.click());

  button.addEventListener("click", () => {
    const playing = !video.paused && !video.hidden;
    userChoice = playing ? "paused" : "playing";
    sync();
    label();
  });

  if ("IntersectionObserver" in window) {
    new IntersectionObserver(
      ([entry]) => {
        visibleShare = entry.isIntersecting ? entry.intersectionRatio : 0;
        sync();
      },
      { threshold: [0, VISIBLE_SHARE, 0.5, 1] }
    ).observe(figure);
  } else {
    visibleShare = 1;
  }
  document.addEventListener("visibilitychange", sync);
  window.addEventListener("pagehide", () => video.pause());
  window.addEventListener("pageshow", (event) => event.persisted && sync());
  label();
  sync();
}

if (typeof window !== "undefined" && typeof document !== "undefined") {
  const forceLive = /[?&]cinematic=live(?:&|$)/.test(window.location.search);
  const autoplay = !prefersStill({
    reducedMotion: window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    saveData: Boolean(navigator.connection?.saveData),
    automated: Boolean(navigator.webdriver) && !forceLive,
  });
  const start = () =>
    document.querySelectorAll("[data-preview-motion]:not([data-preview-motion-state])").forEach((figure) => setup(figure, { autoplay }));
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start, { once: true });
  else start();
}
