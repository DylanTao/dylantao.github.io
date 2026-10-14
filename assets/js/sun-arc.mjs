// The sun arc in the theme panel (_includes/theme_mode_control.liquid). Moving the sun picks the
// theme for that hour (the four token sets stay the contrast-checked source of color), tints the
// panel and the page's sky glow continuously, and tells the 3D home and the footer coast which hour
// to show through window "siteTimeChange" ({ minute, preview, committed }). The 3D home follows only
// committed changes; light-only surfaces follow every move. "Now" hands time back to the clock, and
// the motion switch drives window.siteMotion (theme.js). Only the arc itself (dragging, keys, or a
// stop chosen in the panel) sets a preview hour; a theme chosen elsewhere just moves the sun.
import {
  GEOMETRY,
  MODE_MINUTE,
  formatMinute,
  isNight,
  minuteOfDate,
  minuteToPoint,
  modeForMinute,
  modeLabel,
  pointToMinute,
  skyColor,
  wrapMinute,
} from "./sun-arc-math.mjs";

const STORAGE_KEY = "site-time";
const root = document.documentElement;
const controls = [...document.querySelectorAll("[data-theme-control]")].filter((control) => control.querySelector("[data-sun-arc]"));
const storage = {
  get(key) {
    try {
      return sessionStorage.getItem(key);
    } catch {
      return null;
    }
  },
  set(key, value) {
    try {
      if (value === null) sessionStorage.removeItem(key);
      else sessionStorage.setItem(key, value);
    } catch {
      /* Storage can be blocked; the choice holds for this page. */
    }
  },
};

const storedMinute = Number(storage.get(STORAGE_KEY));
let previewMinute = storage.get(STORAGE_KEY) !== null && Number.isFinite(storedMinute) ? wrapMinute(storedMinute) : null;
let minute = previewMinute ?? (storage.get("theme-manual") === "true" ? MODE_MINUTE[root.getAttribute("data-theme-mode")] : null) ?? minuteOfDate();
let ownThemeChange = false;

window.siteTime = {
  get minute() {
    return minute;
  },
  // The hour the visitor chose on the arc, or null while the site follows the clock.
  get preview() {
    return previewMinute;
  },
};

function paint() {
  const [r, g, b] = skyColor(minute);
  const point = minuteToPoint(minute);
  const across = (point.x - (GEOMETRY.cx - GEOMETRY.rx)) / (2 * GEOMETRY.rx);
  root.style.setProperty("--site-sky", `${r} ${g} ${b}`);
  root.style.setProperty("--site-sun-x", `${(8 + across * 84).toFixed(1)}%`);
  const mode = modeForMinute(minute),
    label = modeLabel(mode),
    time = formatMinute(minute),
    night = isNight(minute),
    following = previewMinute === null && storage.get("theme-manual") !== "true";
  for (const control of controls) {
    control.querySelector("[data-sun-arc]").style.setProperty("--sun-sky", `${r} ${g} ${b}`);
    const knob = control.querySelector("[data-sun-knob]");
    knob.style.left = `${((point.x / 240) * 100).toFixed(2)}%`;
    knob.style.top = `${((point.y / 124) * 100).toFixed(2)}%`;
    knob.classList.toggle("is-night", night);
    knob.setAttribute("aria-valuenow", String(minute));
    knob.setAttribute("aria-valuetext", `${label}, ${time}`);
    control.querySelector("[data-sun-label]").textContent = label;
    control.querySelector("[data-sun-time]").textContent = following ? `${time} · now` : time;
    control.querySelector("[data-sun-now]").setAttribute("aria-pressed", String(following));
    const motion = control.querySelector("[data-motion-toggle]");
    motion?.setAttribute("aria-checked", String(Boolean(window.siteMotion?.paused)));
  }
}

function announce(committed) {
  window.dispatchEvent(new CustomEvent("siteTimeChange", { detail: { minute, preview: previewMinute, committed } }));
}

function applyTheme(mode) {
  if (root.getAttribute("data-theme-mode") === mode && storage.get("theme-manual") === "true") return;
  ownThemeChange = true;
  try {
    setThemeSetting(mode, { persist: true, manual: true });
  } finally {
    ownThemeChange = false;
  }
}

function setPreview(next, committed) {
  minute = previewMinute = wrapMinute(next);
  applyTheme(modeForMinute(minute));
  if (committed) storage.set(STORAGE_KEY, String(minute));
  paint();
  announce(committed);
}

function followClock() {
  previewMinute = null;
  minute = minuteOfDate();
  storage.set(STORAGE_KEY, null);
  storage.set("theme-manual", null);
  ownThemeChange = true;
  try {
    setThemeSetting(determineDefaultThemeMode(), { persist: true, manual: false });
  } finally {
    ownThemeChange = false;
  }
  paint();
  announce(true);
}

for (const control of controls) {
  const arc = control.querySelector("[data-sun-arc]"),
    knob = control.querySelector("[data-sun-knob]");
  let dragging = null,
    pending = null,
    frame = 0,
    keyTimer = 0;
  const fromPointer = (event) => {
    const box = arc.getBoundingClientRect();
    return pointToMinute(((event.clientX - box.left) / box.width) * 240, ((event.clientY - box.top) / box.height) * 124);
  };
  const flush = () => {
    frame = 0;
    if (pending !== null) setPreview(pending, false);
    pending = null;
  };
  arc.addEventListener("pointerdown", (event) => {
    if (event.button !== 0) return;
    event.preventDefault();
    dragging = event.pointerId;
    arc.setPointerCapture(event.pointerId);
    knob.focus({ preventScroll: true });
    arc.classList.add("is-dragging");
    setPreview(fromPointer(event), false);
  });
  arc.addEventListener("pointermove", (event) => {
    if (event.pointerId !== dragging) return;
    pending = fromPointer(event);
    frame ||= requestAnimationFrame(flush);
  });
  const finish = (event) => {
    if (event.pointerId !== dragging) return;
    dragging = null;
    arc.classList.remove("is-dragging");
    if (frame) cancelAnimationFrame(frame);
    flush();
    setPreview(minute, true);
  };
  arc.addEventListener("pointerup", finish);
  arc.addEventListener("pointercancel", finish);
  knob.addEventListener("keydown", (event) => {
    const step = { ArrowRight: 15, ArrowUp: 15, ArrowLeft: -15, ArrowDown: -15, PageUp: 60, PageDown: -60 }[event.key];
    let next = null;
    if (step) next = minute + step;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = 1425;
    if (next === null) return;
    event.preventDefault();
    setPreview(next, false);
    // The 3D home's routine follows once the keys settle, not on every step.
    window.clearTimeout(keyTimer);
    keyTimer = window.setTimeout(() => setPreview(minute, true), 320);
  });
  // A stop chosen in this panel is an arc choice: the sun moves to that mode's hour.
  control.querySelectorAll("[data-theme-mode-option]").forEach((option) => {
    option.addEventListener("click", () => setPreview(MODE_MINUTE[option.dataset.themeModeOption], true), { capture: true });
  });
  control.querySelector("[data-sun-now]")?.addEventListener("click", followClock);
  control.querySelector("[data-motion-toggle]")?.addEventListener("click", () => {
    window.siteMotion?.setPaused(!window.siteMotion.paused);
    paint();
  });
}

// A theme chosen elsewhere (the command palette, an old link) moves the sun to that mode's hour
// without becoming a preview hour for the 3D home.
window.addEventListener("siteThemeChange", (event) => {
  if (ownThemeChange) return;
  const mode = event.detail?.themeMode;
  if (mode && modeForMinute(minute) !== mode)
    minute = previewMinute !== null && modeForMinute(previewMinute) === mode ? previewMinute : MODE_MINUTE[mode];
  paint();
  // A preview hour that no longer matches the chosen theme ends, and the 3D home returns to now.
  if (mode && previewMinute !== null && modeForMinute(previewMinute) !== mode) {
    previewMinute = null;
    storage.set(STORAGE_KEY, null);
    announce(true);
  }
});
window.addEventListener("siteMotionChange", paint);

// While following the clock the sun keeps moving with it.
window.setInterval(() => {
  if (previewMinute !== null || storage.get("theme-manual") === "true") return;
  minute = minuteOfDate();
  paint();
}, 30000);

paint();
