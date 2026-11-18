// What visitors do with the 3D home and the orange, sent to Google Analytics as events, never who
// they are. Sirui, November 17, 2026: "data-driven self improvement" (docs/creative-direction.md,
// brief 8). Analytics' own consent mode and the test-browser switch in _includes/scripts.liquid
// apply, so nothing is sent without consent or from a browser driven by automation.
//
// One listener on the document reads clicks on the controls that matter, so no scene module has to
// know about analytics. The keyboard shortcuts V (walk) and F (full screen) count too, when the key
// really started walking or entered full screen.

export const TRACKED = Object.freeze([
  ['[data-home-desk-mode="3d"]', () => ["scene_enter_3d", {}]],
  ["[data-world-drawing]", (element) => ["look_change", { look: element.dataset.worldDrawing || "" }]],
  ["[data-world-room]", (element) => ["room_visit", { room: element.dataset.worldRoom || "" }]],
  ["[data-world-destination]", (element) => ["room_visit", { room: element.dataset.worldDestination || "" }]],
  ["[data-world-walk]", () => ["walk_start", {}]],
  ["[data-world-fullscreen]", () => ["scene_fullscreen", {}]],
  ["[data-world-view]", () => ["scene_look_around", {}]],
]);
const SELECTOR = TRACKED.map(([selector]) => selector).join(", ");

// The event a click on `target` stands for, as [name, parameters], or null.
export function eventFor(target) {
  const element = target?.closest?.(SELECTOR);
  if (!element) return null;
  for (const [selector, make] of TRACKED) if (element.matches(selector)) return make(element);
  return null;
}

export function installSiteEvents(doc, win) {
  const send = ([name, parameters]) => {
    if (typeof win.gtag === "function") win.gtag("event", name, parameters);
  };
  doc.addEventListener(
    "click",
    (event) => {
      const found = eventFor(event.target);
      if (found) send(found);
    },
    { capture: true, passive: true }
  );
  doc.addEventListener(
    "keydown",
    (event) => {
      const key = String(event.key || "").toLowerCase();
      if (event.repeat || event.ctrlKey || event.metaKey || event.altKey || (key !== "v" && key !== "f")) return;
      const walk = doc.querySelector?.("[data-world-walk]"),
        walking = walk?.getAttribute("aria-pressed") === "true",
        full = Boolean(doc.fullscreenElement);
      win.setTimeout?.(() => {
        if (key === "v" && !walking && walk?.getAttribute("aria-pressed") === "true") send(["walk_start", { by: "key" }]);
        if (key === "f" && !full && doc.fullscreenElement) send(["scene_fullscreen", { by: "key" }]);
      }, 300);
    },
    { capture: true, passive: true }
  );
  // The orange on the Page not found page has rolled off and landed in the footer's sea.
  doc.addEventListener("orange:landed", () => send(["orange_roll", {}]));
  return send;
}

if (typeof document !== "undefined" && typeof window !== "undefined") installSiteEvents(document, window);
