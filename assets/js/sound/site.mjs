// Ordinary visits play the authored house recordings after opt-in. The
// instrument lab keeps the synthesized gestures in the current hour's key.
import { createSound } from "./engine.mjs";
import { createGestureFoley } from "./gesture-foley.mjs";
import { COASTAL_LOOKS, createCoastalMusic } from "./coastal-music.mjs";

const PRESSABLE = "a[href], button, summary, [role='button'], [role='option'], [role='tab']";
const SWITCH = "[role='switch'], input[type='checkbox']";
const ROWS = [
  // The navigation's links, left to right, are a rising scale.
  { row: ".navbar-nav", item: ".nav-link" },
  // The theme panel's four hours.
  { row: ".theme-stops", item: ".theme-option" },
];

export function createSiteSound({
  root = document,
  view = globalThis,
  audioContext = null,
  instrumentLab = false,
  recordSelected = () => false,
} = {}) {
  const mode = () => root.documentElement.dataset.themeMode || "noon";
  const sound = createSound({ mode, audioContext });
  const reduced = view.matchMedia?.("(prefers-reduced-motion: reduce)");
  const listeners = [];
  const listen = (target, type, handler, options) => {
    target.addEventListener(type, handler, options);
    listeners.push(() => target.removeEventListener(type, handler, options));
  };
  let coastal = null;
  let gestures = null;
  let syncCoast = null;
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

  function bindInstrument() {
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

  function bindCoastal() {
    // This preview uses a separate rendering clock. The public soundtrack follows
    // actual visitor playback and never a lab pose or an authored test still.
    const params = new URLSearchParams(view.location.search);
    const scene = root.querySelector("[data-home-desk-scene]");
    const stage = scene?.closest("[data-home-artifact-stage]");
    if (params.get("scene-lab") === "1") return;
    coastal ??= createCoastalMusic(sound.graph);
    gestures ??= createGestureFoley(sound.graph);
    const recordingFor = (look) => view.siteArt?.worlds?.find((world) => world.id === look)?.recording || look;
    const pageLook = () => recordingFor(view.siteArt?.look || "realistic");
    const look = () => {
      const style = recordingFor(scene?.dataset.drawing);
      return visible3D() && COASTAL_LOOKS.includes(style) ? style : pageLook();
    };
    const visible3D = () => stage?.dataset.deskMode === "3d" && scene.getAttribute("aria-hidden") !== "true";
    const rect = scene?.getBoundingClientRect();
    let visible = rect && rect.bottom > 0 && rect.top < view.innerHeight;
    let arrival = false;
    let scrollAt = -Infinity;
    const onRail = () => stage?.classList.contains("is-world-visit");
    const filmClock = () => scene.getFilmPlayback?.();
    const recordClock = () => scene.getListeningPlayback?.();
    const liftNeedle = () => scene.finishListeningRecord?.();
    // Sound and Volume are explicit choices, including when the visitor keeps the picture still.
    const audible = () => !root.hidden && sound.on && !recordSelected();
    const cuesAllowed = () => audible() && !reduced?.matches && !view.siteMotion?.paused;
    const available = () => audible() && visible && visible3D();
    syncCoast = (seek) => {
      if (!audible()) coastal.pause({ hard: recordSelected() });
      else if (!visible3D() || !visible) coastal.select(pageLook());
      else if (scene.dataset.sceneState !== "ready") coastal.pause();
      else if (onRail()) coastal.playFilm(filmClock, seek === true);
      else if (recordClock()) coastal.playRecord(recordClock, liftNeedle);
      else coastal.select(look());
    };
    if (stage) {
      const observer = new view.MutationObserver(syncCoast);
      observer.observe(scene, { attributes: true, attributeFilter: ["data-scene-state", "data-drawing", "aria-hidden"] });
      observer.observe(stage, { attributes: true, attributeFilter: ["data-desk-mode", "class"] });
      listeners.push(() => observer.disconnect());
    }
    if (scene && view.IntersectionObserver) {
      const exposure = new view.IntersectionObserver(([entry]) => {
        visible = entry.isIntersecting;
        syncCoast();
      });
      exposure.observe(scene);
      listeners.push(() => exposure.disconnect());
    }
    listen(root, "coastal:score", ({ detail }) => {
      if (detail?.kind !== "film" || !COASTAL_LOOKS.includes(recordingFor(detail.look))) return;
      if (detail.action === "stop" || detail.action === "pause") coastal.pause();
      else syncCoast(detail.action === "seek");
    });
    listen(view, "siteMotionChange", syncCoast);
    listen(view, "siteArtChange", syncCoast);
    if (scene) listen(scene, "coastal:record", syncCoast);
    if (reduced?.addEventListener) listen(reduced, "change", syncCoast);
    const cue = (type, selected = look()) => {
      if (cuesAllowed() && !onRail()) coastal.motif(recordingFor(selected), type);
    };
    const route = "button[data-world-room], button[data-world-destination], button[data-world-view], button[data-world-visit-start]";
    if (stage)
      listen(
        stage,
        "click",
        (event) => {
          const target = event.target.closest?.(route);
          if (!event.isTrusted || !target || target.matches(":disabled, [hidden], [aria-disabled=true]")) return;
          if (!available() || onRail()) return;
          // Use the guest's choice to prepare the first pick while the coast opens.
          if (target.dataset.worldVisitStart === "film") coastal.prepareFilmOpening();
          else coastal.motif(look(), "select");
        },
        true
      );
    if (scene) listen(scene, "coastal:threshold", ({ detail }) => cue("threshold", detail?.look));
    listen(root, "click", (event) => {
      const button = event.target.closest?.("button, summary, [role='tab']");
      if (
        event.isTrusted &&
        button &&
        !root.hidden &&
        !button.closest("[data-home-artifact-stage], .duh-companion") &&
        !button.matches("[data-sound-toggle], :disabled") &&
        !button.closest("main [aria-expanded], main summary, [data-shelf-next], [data-shelf-prev]")
      )
        gestures.play("latch");
      if (!event.isTrusted || event.target.closest?.("[data-home-artifact-stage], [data-theme-control]")) return;
      const control = event.target.closest?.("details > summary, [aria-expanded], [data-shelf-next], [data-shelf-prev]");
      if (control?.closest("main, [role='main']")) cue("select", pageLook());
    });
    const markScroll = (event) => {
      if (event.isTrusted) scrollAt = view.performance.now();
    };
    listen(view, "wheel", markScroll, { passive: true });
    listen(view, "touchmove", markScroll, { passive: true });
    listen(view, "keydown", (event) => {
      if (["ArrowDown", "PageDown", " ", "End"].includes(event.key) && !event.target.closest?.("input, button, select, textarea")) markScroll(event);
    });
    listen(
      view,
      "scroll",
      () => {
        if (!arrival && view.performance.now() - scrollAt < 1100 && cuesAllowed() && !onRail()) {
          arrival = true;
          cue("arrival");
        }
      },
      { passive: true }
    );
    syncCoast();
    if (available() && stage.querySelector('[data-world-visit-start="film"][aria-disabled="true"]')) coastal.prepareFilmOpening();
    if (cuesAllowed()) coastal.prepareMotifs();
  }

  function bind() {
    if (listeners.length) return;
    if (instrumentLab) bindInstrument();
    else bindCoastal();
    listen(root, "coastal:foley", ({ detail }) => {
      if (detail?.name === "quiet") sound.foley("quiet");
      else if (!root.hidden && !reduced?.matches) sound.foley(detail?.name, detail?.strength);
    });
    if (reduced?.addEventListener) listen(reduced, "change", (event) => event.matches && sound.foley("quiet"));
    // A hidden tab is silent.
    listen(root, "visibilitychange", async () => {
      if (root.hidden) {
        coastal?.pause({ hard: true });
        gestures?.quiet();
      }
      await sound.hidden(root.hidden);
      if (!root.hidden && sound.on) syncCoast?.();
    });
  }

  return {
    sound,
    gesture(kind, strength, pan, material) {
      if (sound.on && !root.hidden) gestures?.play(kind, strength, pan, material);
    },
    refresh() {
      syncCoast?.();
    },
    // Call from the click or key press that asked for sound.
    async start() {
      const started = await sound.start({ withBed: instrumentLab });
      if (started) {
        bind();
        lastMode = mode();
      }
      return started;
    },
    async stop() {
      gestures?.quiet();
      coastal?.clear({ hard: true });
      syncCoast = null;
      while (listeners.length) listeners.pop()();
      await sound.stop();
    },
    evidence: () => ({
      ...sound.evidence(),
      bound: listeners.length > 0,
      instrumentLab,
      coastal: coastal?.evidence() ?? null,
      gestures: gestures?.evidence() ?? null,
    }),
  };
}
