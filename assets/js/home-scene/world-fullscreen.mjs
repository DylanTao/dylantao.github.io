// Full screen for the 3D home: the stage (the scene, its controls and a way back to the page) fills
// the screen. Browsers with the Fullscreen API get real full screen. The rest (iPhone Safari) get
// the same layout in the top layer as a manual popover, so the page's own stacking and transforms
// cannot clip it, and the browser's back gesture closes it instead of leaving the site. Escape, the
// Back button, F on the scene and leaving 3D all return the visitor to the page where they were.

export const FULLSCREEN_HISTORY_KEY = "siruiWorldFullscreen";
const LABEL = "Sirui’s coastal home, full screen";

export function createWorldFullscreen({ stage, scene, ui, win = globalThis.window }) {
  const doc = stage.ownerDocument;
  const root = doc.documentElement;
  const enterButton = ui.querySelector("[data-world-fullscreen]");
  const bar = stage.querySelector("[data-world-immersive-bar]");
  const exitButton = bar?.querySelector("[data-world-exit]");
  const fullscreenElement = () => doc.fullscreenElement ?? doc.webkitFullscreenElement ?? null;
  const requestNative = stage.requestFullscreen ?? stage.webkitRequestFullscreen;
  const exitNative = doc.exitFullscreen ?? doc.webkitExitFullscreen;
  const nativeAllowed = typeof requestNative === "function" && (doc.fullscreenEnabled ?? doc.webkitFullscreenEnabled ?? true) !== false;
  const listeners = [];
  let mode = null,
    scrollY = 0,
    stageAria = null,
    backTimer = 0;

  function on(target, type, fn, options) {
    target?.addEventListener(type, fn, options);
    listeners.push(() => target?.removeEventListener(type, fn, options));
  }

  function show(next) {
    mode = next;
    stage.dataset.worldFullscreen = next;
    if (stage.classList.contains("is-world-immersive")) return;
    stageAria = { role: stage.getAttribute("role"), modal: stage.getAttribute("aria-modal"), label: stage.getAttribute("aria-label") };
    stage.classList.add("is-world-immersive");
    root.classList.add("is-world-immersive");
    if (bar) bar.hidden = false;
    stage.setAttribute("role", "dialog");
    stage.setAttribute("aria-modal", "true");
    stage.setAttribute("aria-label", LABEL);
    // The scene takes the keyboard at once (arrows look around); Escape or Back leave.
    (scene.querySelector("canvas.home-desk-corner-canvas") ?? exitButton)?.focus({ preventScroll: true });
  }

  function restoreAttribute(name, value) {
    if (value == null) stage.removeAttribute(name);
    else stage.setAttribute(name, value);
  }

  function hide() {
    if (!mode) return;
    const was = mode;
    mode = null;
    clearTimeout(backTimer);
    if (was === "popover") {
      try {
        stage.hidePopover();
      } catch {
        /* Already closed by the browser. */
      }
      stage.removeAttribute("popover");
    }
    stage.classList.remove("is-world-immersive");
    root.classList.remove("is-world-immersive");
    delete stage.dataset.worldFullscreen;
    if (bar) bar.hidden = true;
    restoreAttribute("role", stageAria?.role);
    restoreAttribute("aria-modal", stageAria?.modal);
    restoreAttribute("aria-label", stageAria?.label);
    if (Math.abs(win.scrollY - scrollY) > 1) {
      try {
        win.scrollTo({ top: scrollY, behavior: "instant" });
      } catch {
        win.scrollTo(0, scrollY);
      }
    }
    // Focus returns to the control that opened full screen, without moving the page.
    if (enterButton && !enterButton.closest("[hidden], [inert]")) enterButton.focus({ preventScroll: true });
  }

  function showFallback() {
    if (typeof stage.showPopover === "function") {
      stage.setAttribute("popover", "manual");
      try {
        stage.showPopover();
        show("popover");
      } catch {
        stage.removeAttribute("popover");
        show("fixed");
      }
    } else show("fixed");
    try {
      const state = win.history.state;
      win.history.pushState(
        state && typeof state === "object" ? { ...state, [FULLSCREEN_HISTORY_KEY]: true } : { [FULLSCREEN_HISTORY_KEY]: true },
        ""
      );
    } catch {
      /* A sandboxed page may refuse history entries; Escape and Back still work. */
    }
  }

  function enter() {
    if (mode) return;
    scrollY = win.scrollY;
    if (!nativeAllowed) {
      showFallback();
      return;
    }
    // The request must start inside the click or key press that asked for it.
    let request;
    try {
      request = requestNative.call(stage, { navigationUI: "hide" });
    } catch (error) {
      request = Promise.reject(error);
    }
    show("native");
    Promise.resolve(request).catch(() => {
      // Refused (a frame without permission, a busy browser): keep the same layout without it.
      if (mode === "native" && fullscreenElement() !== stage) showFallback();
    });
  }

  function exit() {
    if (!mode) return;
    if (mode === "native") {
      if (fullscreenElement() === stage && typeof exitNative === "function") {
        // The fullscreenchange that follows restores the page.
        Promise.resolve(exitNative.call(doc)).catch(hide);
        return;
      }
      hide();
      return;
    }
    if (win.history.state?.[FULLSCREEN_HISTORY_KEY]) {
      // Going back pops the entry this view added, and popstate restores the page.
      win.history.back();
      backTimer = setTimeout(hide, 600);
      return;
    }
    hide();
  }

  on(enterButton, "click", enter);
  on(exitButton, "click", exit);
  for (const type of ["fullscreenchange", "webkitfullscreenchange"])
    on(doc, type, () => {
      const element = fullscreenElement();
      if (mode === "native" && element !== stage) hide();
      // A late grant after the visitor already left: give the screen back.
      else if (element === stage && mode !== "native") Promise.resolve(exitNative?.call(doc)).catch(() => {});
    });
  for (const type of ["fullscreenerror", "webkitfullscreenerror"])
    on(doc, type, () => {
      if (mode === "native" && fullscreenElement() !== stage) showFallback();
    });
  on(win, "popstate", () => {
    if (mode && mode !== "native" && !win.history.state?.[FULLSCREEN_HISTORY_KEY]) hide();
  });
  on(win, "pageshow", () => {
    if (mode === "native" && fullscreenElement() !== stage) hide();
  });
  // Escape leaves full screen in every mode (the browser handles it first in real full screen), and
  // takes precedence over the scene's own Escape, which returns inside.
  on(
    stage,
    "keydown",
    (event) => {
      if (!mode || event.key !== "Escape" || event.isComposing) return;
      event.preventDefault();
      event.stopPropagation();
      exit();
    },
    true
  );
  on(scene, "keydown", (event) => {
    if (event.target?.tagName !== "CANVAS" || event.ctrlKey || event.metaKey || event.altKey || event.isComposing) return;
    if (event.key !== "f" && event.key !== "F") return;
    event.preventDefault();
    if (mode) exit();
    else enter();
  });
  // Keyboard focus stays inside the full screen view while it is open.
  on(doc, "focusin", (event) => {
    if (mode && !stage.contains(event.target)) exitButton?.focus({ preventScroll: true });
  });

  return {
    enter,
    exit,
    get mode() {
      return mode;
    },
    dispose() {
      hide();
      listeners.splice(0).forEach((off) => off());
    },
  };
}
