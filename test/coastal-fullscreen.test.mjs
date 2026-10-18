import test from "node:test";
import assert from "node:assert/strict";
import { createWorldFullscreen, FULLSCREEN_HISTORY_KEY } from "../assets/js/home-scene/world-fullscreen.mjs";

// A small DOM stand-in: elements with attributes, classes, focus and a parent chain; events reach the
// target and, for the document listeners the module uses, the document.
class FakeElement extends EventTarget {
  constructor(doc, tag = "div", attributes = {}) {
    super();
    this.ownerDocument = doc;
    this.tagName = tag.toUpperCase();
    this.attributes = new Map(Object.entries(attributes));
    this.classes = new Set();
    this.classList = {
      add: (name) => this.classes.add(name),
      remove: (name) => this.classes.delete(name),
      contains: (name) => this.classes.has(name),
    };
    this.dataset = {};
    this.children = [];
    this.parent = null;
    this.hidden = false;
  }
  append(...children) {
    for (const child of children) {
      child.parent = this;
      this.children.push(child);
    }
    return this;
  }
  getAttribute(name) {
    return this.attributes.has(name) ? this.attributes.get(name) : null;
  }
  setAttribute(name, value) {
    this.attributes.set(name, String(value));
  }
  removeAttribute(name) {
    this.attributes.delete(name);
  }
  contains(node) {
    for (let n = node; n; n = n.parent) if (n === this) return true;
    return false;
  }
  matches(selector) {
    return selector.split(",").some((part) => {
      const s = part.trim();
      const attribute = s.match(/^\[([\w-]+)\]$/);
      if (attribute) return attribute[1] === "hidden" ? this.hidden : this.attributes.has(attribute[1]);
      const [tag, cls] = s.split(".");
      return this.tagName === tag.toUpperCase() && (!cls || this.classes.has(cls));
    });
  }
  querySelector(selector) {
    for (const child of this.children) {
      if (child.matches(selector)) return child;
      const found = child.querySelector(selector);
      if (found) return found;
    }
    return null;
  }
  closest(selector) {
    for (let n = this; n; n = n.parent) if (n.matches(selector)) return n;
    return null;
  }
  focus() {
    this.ownerDocument.activeElement = this;
    const event = new Event("focusin");
    Object.defineProperty(event, "target", { value: this });
    this.ownerDocument.dispatchEvent(event);
  }
}

function setup({ native = true, refuse = false, popover = true } = {}) {
  const doc = new EventTarget();
  doc.activeElement = null;
  doc.fullscreenElement = null;
  doc.documentElement = new FakeElement(doc, "html");
  const make = (tag, attributes) => new FakeElement(doc, tag, attributes);
  const stage = make("div", { "aria-label": "Portrait and research artifacts" });
  const scene = make("div");
  const canvas = make("canvas");
  canvas.classes.add("home-desk-corner-canvas");
  scene.append(canvas);
  const bar = make("div", { "data-world-immersive-bar": "" });
  bar.hidden = true;
  const exitButton = make("button", { "data-world-exit": "" });
  bar.append(exitButton);
  const ui = make("div", { "data-home-world-controls": "" });
  const enterButton = make("button", { "data-world-fullscreen": "" });
  ui.append(enterButton);
  stage.append(make("p"), scene, bar, ui);
  const calls = [];
  if (native) {
    stage.requestFullscreen = function (options) {
      calls.push(["request", options]);
      if (refuse) return Promise.reject(new TypeError("Permissions check failed"));
      doc.fullscreenElement = this;
      queueMicrotask(() => doc.dispatchEvent(new Event("fullscreenchange")));
      return Promise.resolve();
    };
    doc.exitFullscreen = () => {
      calls.push(["exit"]);
      doc.fullscreenElement = null;
      queueMicrotask(() => doc.dispatchEvent(new Event("fullscreenchange")));
      return Promise.resolve();
    };
  }
  if (popover) {
    stage.showPopover = () => calls.push(["showPopover", stage.getAttribute("popover")]);
    stage.hidePopover = () => calls.push(["hidePopover"]);
  }
  const win = new EventTarget();
  win.scrollY = 640;
  win.scrollTo = (options) => {
    calls.push(["scrollTo", options.top]);
    win.scrollY = options.top;
  };
  const entries = [null];
  win.history = {
    get state() {
      return entries.at(-1);
    },
    pushState(state) {
      entries.push(state);
    },
    back() {
      entries.pop();
      queueMicrotask(() => win.dispatchEvent(new Event("popstate")));
    },
  };
  const fullscreen = createWorldFullscreen({ stage, scene, ui, win });
  const key = (target, key, extra = {}) => {
    const event = new Event("keydown", { cancelable: true });
    Object.assign(event, { key, ...extra });
    Object.defineProperty(event, "target", { value: target });
    // The stage's capture listener runs first and can stop the event before the scene sees it.
    stage.dispatchEvent(event);
    if (!event.cancelBubble) scene.dispatchEvent(event);
    return event;
  };
  const flush = () => new Promise((resolve) => setTimeout(resolve, 0));
  return { doc, stage, scene, canvas, bar, ui, enterButton, exitButton, calls, win, entries, fullscreen, key, flush };
}

test("full screen uses the Fullscreen API, focuses the scene and marks the stage as a dialog", async () => {
  const t = setup();
  t.enterButton.dispatchEvent(new Event("click"));
  assert.deepEqual(t.calls[0], ["request", { navigationUI: "hide" }]);
  assert.equal(t.fullscreen.mode, "native");
  assert.ok(t.stage.classList.contains("is-world-immersive"));
  assert.ok(t.doc.documentElement.classList.contains("is-world-immersive"));
  assert.equal(t.bar.hidden, false);
  assert.equal(t.stage.getAttribute("role"), "dialog");
  assert.equal(t.stage.getAttribute("aria-modal"), "true");
  assert.equal(t.stage.getAttribute("aria-label"), "Sirui’s coastal home, full screen");
  assert.equal(t.doc.activeElement, t.canvas);
  await t.flush();
  assert.equal(t.fullscreen.mode, "native", "the entering fullscreenchange keeps the view");
});

test("Escape leaves full screen ahead of the scene's own Escape and restores the page", async () => {
  const t = setup();
  let sceneSawEscape = false;
  t.scene.addEventListener("keydown", (event) => event.key === "Escape" && (sceneSawEscape = true));
  t.enterButton.dispatchEvent(new Event("click"));
  await t.flush();
  t.win.scrollY = 0; // full screen may move the page underneath
  const event = t.key(t.canvas, "Escape");
  assert.equal(event.defaultPrevented, true);
  assert.equal(sceneSawEscape, false);
  assert.deepEqual(t.calls.at(-1), ["exit"]);
  await t.flush();
  assert.equal(t.fullscreen.mode, null);
  assert.ok(!t.stage.classList.contains("is-world-immersive"));
  assert.ok(!t.doc.documentElement.classList.contains("is-world-immersive"));
  assert.equal(t.bar.hidden, true);
  assert.equal(t.stage.getAttribute("role"), null);
  assert.equal(t.stage.getAttribute("aria-modal"), null);
  assert.equal(t.stage.getAttribute("aria-label"), "Portrait and research artifacts");
  assert.ok(
    t.calls.some(([name, top]) => name === "scrollTo" && top === 640),
    "the page returns to where it was"
  );
  assert.equal(t.doc.activeElement, t.enterButton);
});

test("the browser leaving full screen on its own (its Escape, F11) restores the page", async () => {
  const t = setup();
  t.enterButton.dispatchEvent(new Event("click"));
  await t.flush();
  t.doc.fullscreenElement = null;
  t.doc.dispatchEvent(new Event("fullscreenchange"));
  assert.equal(t.fullscreen.mode, null);
  assert.ok(!t.stage.classList.contains("is-world-immersive"));
});

test("without the Fullscreen API the stage opens as a manual popover that the back gesture closes", async () => {
  const t = setup({ native: false });
  t.enterButton.dispatchEvent(new Event("click"));
  assert.equal(t.fullscreen.mode, "popover");
  assert.deepEqual(t.calls[0], ["showPopover", "manual"]);
  assert.equal(t.win.history.state[FULLSCREEN_HISTORY_KEY], true);
  // The visitor's back gesture pops the entry: the view closes and the page stays.
  t.win.history.back();
  await t.flush();
  assert.equal(t.fullscreen.mode, null);
  assert.deepEqual(t.calls.at(-1)[0] === "scrollTo" ? t.calls.at(-2) : t.calls.at(-1), ["hidePopover"]);
  assert.equal(t.stage.getAttribute("popover"), null);
  assert.equal(t.entries.length, 1);
});

test("Back to the site in the popover pops its own history entry instead of leaving one behind", async () => {
  const t = setup({ native: false });
  t.win.history.pushState({ page: "home" });
  t.enterButton.dispatchEvent(new Event("click"));
  assert.deepEqual(t.win.history.state, { page: "home", [FULLSCREEN_HISTORY_KEY]: true }, "existing state is kept");
  t.exitButton.dispatchEvent(new Event("click"));
  await t.flush();
  assert.equal(t.fullscreen.mode, null);
  assert.deepEqual(t.win.history.state, { page: "home" });
});

test("a refused request keeps the same layout through the popover", async () => {
  const t = setup({ refuse: true });
  t.enterButton.dispatchEvent(new Event("click"));
  assert.equal(t.fullscreen.mode, "native");
  await t.flush();
  assert.equal(t.fullscreen.mode, "popover");
  assert.ok(t.stage.classList.contains("is-world-immersive"));
  assert.equal(t.stage.getAttribute("role"), "dialog");
  t.key(t.canvas, "Escape");
  await t.flush();
  assert.equal(t.fullscreen.mode, null);
  assert.equal(t.stage.getAttribute("role"), null, "the stage's own attributes come back, not the dialog's");
});

test("with neither API the stage still fills the screen by itself", async () => {
  const t = setup({ native: false, popover: false });
  t.enterButton.dispatchEvent(new Event("click"));
  assert.equal(t.fullscreen.mode, "fixed");
  assert.ok(t.stage.classList.contains("is-world-immersive"));
  // A popstate that leaves this view's entry on top (another script's navigation) keeps it open.
  t.win.dispatchEvent(new Event("popstate"));
  assert.equal(t.fullscreen.mode, "fixed");
  t.fullscreen.exit();
  await t.flush();
  assert.equal(t.fullscreen.mode, null);
  assert.equal(t.entries.length, 1);
});

test("F on the scene toggles full screen; modified or composing presses and other targets do not", async () => {
  const t = setup();
  for (const extra of [{ ctrlKey: true }, { metaKey: true }, { altKey: true }, { isComposing: true }]) {
    const event = t.key(t.canvas, "f", extra);
    assert.equal(event.defaultPrevented, false);
  }
  t.key(t.scene, "f");
  assert.equal(t.fullscreen.mode, null, "only the canvas takes the shortcut");
  assert.equal(t.key(t.canvas, "F").defaultPrevented, true);
  assert.equal(t.fullscreen.mode, "native");
  await t.flush();
  t.key(t.canvas, "f");
  await t.flush();
  assert.equal(t.fullscreen.mode, null);
});

test("focus that wanders outside the open view comes back to Back to the site", async () => {
  const t = setup();
  t.enterButton.dispatchEvent(new Event("click"));
  const outside = new FakeElement(t.doc, "a");
  outside.focus();
  assert.equal(t.doc.activeElement, t.exitButton);
  t.fullscreen.exit();
  await t.flush();
  outside.focus();
  assert.equal(t.doc.activeElement, outside, "a closed view leaves focus alone");
});

test("dispose restores the page and stops listening", async () => {
  const t = setup({ native: false });
  t.enterButton.dispatchEvent(new Event("click"));
  t.fullscreen.dispose();
  assert.equal(t.fullscreen.mode, null);
  assert.ok(!t.stage.classList.contains("is-world-immersive"));
  t.enterButton.dispatchEvent(new Event("click"));
  assert.equal(t.fullscreen.mode, null);
});
