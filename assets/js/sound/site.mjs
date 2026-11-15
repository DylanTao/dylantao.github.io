// The page played as an instrument: what a visitor does becomes notes in the hour's key
// (score.mjs), on the engine (engine.mjs). site-sound.mjs loads this only for a visitor who has been
// offered sound, and nothing here makes an audio context until start() is called from a gesture.
import { createSound } from "./engine.mjs";

const PRESSABLE = "a[href], button, summary, [role='button'], [role='option'], [role='tab']";
const SWITCH = "[role='switch'], input[type='checkbox']";
const ROWS = [
  // The navigation's links, left to right, are a rising scale.
  { row: ".navbar-nav", item: ".nav-link" },
  // The theme panel's four hours.
  { row: ".theme-stops", item: ".theme-option" },
];

export function createSiteSound({ root = document, view = globalThis } = {}) {
  const mode = () => root.documentElement.dataset.themeMode || "noon";
  const sound = createSound({ mode });
  const listeners = [];
  const listen = (target, type, handler, options) => {
    target.addEventListener(type, handler, options);
    listeners.push(() => target.removeEventListener(type, handler, options));
  };
  let pointed = null,
    lastPoint = 0,
    lastArrive = 0,
    arrived = null,
    scrolled = false,
    lastMode = mode(),
    expanding = null,
    sections = null;

  function point(target) {
    for (const { row, item } of ROWS) {
      const element = target.closest?.(item),
        container = element?.closest(row);
      if (!container) continue;
      const now = performance.now();
      if (element === pointed || now - lastPoint < 70) return;
      pointed = element;
      lastPoint = now;
      const items = [...container.querySelectorAll(item)].filter((candidate) => candidate.offsetParent !== null);
      sound.play("point", { index: Math.max(0, items.indexOf(element)), of: items.length });
      return;
    }
    pointed = null;
  }

  function bind() {
    if (listeners.length) return;
    listen(root, "pointerover", (event) => event.pointerType === "mouse" && point(event.target), { passive: true });
    listen(root, "focusin", (event) => event.target.matches?.(":focus-visible") && point(event.target));
    // A press: a knock, unless the control makes its own sound (a switch, something that opens).
    listen(
      root,
      "pointerdown",
      (event) => {
        const control = event.target.closest?.(PRESSABLE);
        if (!control || control.matches(SWITCH) || control.matches("summary, [aria-expanded]")) return;
        sound.play("tap");
      },
      { passive: true, capture: true }
    );
    // A switch speaks after its own handler has flipped it.
    listen(root, "click", (event) => {
      const control = event.target.closest?.(SWITCH);
      if (control) sound.play("switch", { on: control.getAttribute("aria-checked") === "true" || control.checked === true });
    });
    // Things that open: a control that says so (aria-expanded), read before and after its click.
    listen(
      root,
      "click",
      (event) => {
        const control = event.target.closest?.("[aria-expanded]");
        expanding = control ? { control, was: control.getAttribute("aria-expanded") } : null;
      },
      { capture: true }
    );
    listen(root, "click", () => {
      const pending = expanding;
      expanding = null;
      if (!pending) return;
      // Some controls flip in a later task (a transition's start); give them one.
      setTimeout(() => {
        const now = pending.control.getAttribute("aria-expanded");
        if (now !== pending.was) sound.play(now === "true" ? "open" : "close");
      }, 0);
    });
    // A <details> element's toggle does not bubble, so it is caught on the way down.
    listen(root, "toggle", (event) => event.target instanceof view.HTMLDetailsElement && sound.play(event.target.open ? "open" : "close"), {
      capture: true,
    });
    // The hour changing key.
    listen(view, "siteThemeChange", () => {
      const next = mode();
      if (next === lastMode) return;
      lastMode = next;
      sound.play("hour");
    });
    // A thrown row coming to rest (shelf.mjs).
    listen(root, "shelf:rest", () => sound.play("land", { force: 0.35 }));
    // A hidden tab is silent.
    listen(root, "visibilitychange", () => sound.hidden(root.hidden));
    // The homepage's sections arrive as the page scrolls: one soft bar each, never on load and
    // never the same section twice running.
    listen(view, "scroll", () => (scrolled = true), { passive: true, once: true });
    const marked = [...root.querySelectorAll("[data-home-section]")];
    if (marked.length && view.IntersectionObserver) {
      sections = new view.IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            if (!entry.isIntersecting || !scrolled || entry.target === arrived) continue;
            const now = performance.now();
            if (now - lastArrive < 900) continue;
            lastArrive = now;
            arrived = entry.target;
            sound.play("arrive", { index: marked.indexOf(entry.target) });
          }
        },
        { threshold: 0.35 }
      );
      for (const section of marked) sections.observe(section);
      listeners.push(() => sections.disconnect());
    }
  }

  return {
    sound,
    // Call from the click or key press that asked for sound.
    async start() {
      const started = await sound.start();
      if (started) {
        bind();
        lastMode = mode();
      }
      return started;
    },
    async stop() {
      await sound.stop();
      while (listeners.length) listeners.pop()();
    },
    evidence: () => ({ ...sound.evidence(), bound: listeners.length > 0 }),
  };
}
