import assert from "node:assert/strict";
import test from "node:test";
import { TRACKED, eventFor, installSiteEvents } from "../assets/js/site-events.mjs";

// A stand-in element: attributes, a parent, and selector matching for the `[data-x]` and
// `[data-x="v"]` forms the module uses.
function element(attributes = {}, parent = null) {
  const dataset = {};
  for (const [name, value] of Object.entries(attributes))
    if (name.startsWith("data-")) dataset[name.slice(5).replace(/-([a-z])/g, (_, c) => c.toUpperCase())] = value;
  const one = (selector) => {
    const match = /^\[([a-z-]+)(?:="([^"]*)")?\]$/.exec(selector.trim());
    return Boolean(match) && match[1] in attributes && (match[2] === undefined || attributes[match[1]] === match[2]);
  };
  const node = {
    dataset,
    parent,
    matches: (list) => list.split(",").some(one),
    closest: (list) => {
      for (let at = node; at; at = at.parent) if (at.matches(list)) return at;
      return null;
    },
  };
  return node;
}

test("a click on a control the home is judged by stands for one event, with no personal data", () => {
  assert.deepEqual(eventFor(element({ "data-home-desk-mode": "3d" })), ["scene_enter_3d", {}]);
  assert.equal(eventFor(element({ "data-home-desk-mode": "2d" })), null, "going back to 2D is not entering 3D");
  assert.deepEqual(eventFor(element({ "data-world-drawing": "paint" })), ["look_change", { look: "paint" }]);
  assert.deepEqual(eventFor(element({ "data-world-room": "gym" })), ["room_visit", { room: "gym" }]);
  assert.deepEqual(eventFor(element({ "data-world-destination": "outside" })), ["room_visit", { room: "outside" }]);
  assert.deepEqual(eventFor(element({ "data-world-walk": "" })), ["walk_start", {}]);
  assert.deepEqual(eventFor(element({ "data-world-fullscreen": "" })), ["scene_fullscreen", {}]);
  assert.deepEqual(eventFor(element({ "data-world-view": "" })), ["scene_look_around", {}]);
  // A click on the icon inside a button counts as the button.
  assert.deepEqual(eventFor(element({}, element({ "data-world-walk": "" }))), ["walk_start", {}]);
  assert.equal(eventFor(element({ "data-anything-else": "" })), null);
  assert.equal(eventFor(null), null);
  for (const [, make] of TRACKED) {
    const [name, parameters] = make(element({}));
    assert.match(name, /^[a-z0-9_]{1,40}$/, "a name Analytics accepts");
    for (const value of Object.values(parameters)) assert.equal(typeof value, "string");
  }
});

test("events go to Analytics only when its tag is on the page, and the orange's landing counts", () => {
  const listeners = {},
    doc = { addEventListener: (type, listener, options) => (listeners[type] = { listener, options }) };
  const sent = [],
    win = {};
  installSiteEvents(doc, win);
  assert.equal(listeners.click.options.passive, true, "it never delays a click");
  assert.equal(listeners.click.options.capture, true, "a control that stops its click is still counted");
  listeners.click.listener({ target: element({ "data-world-room": "study" }) });
  assert.deepEqual(sent, [], "no tag, nothing sent and nothing thrown");
  win.gtag = (...args) => sent.push(args);
  listeners.click.listener({ target: element({ "data-world-room": "study" }) });
  listeners.click.listener({ target: element({ "data-unrelated": "" }) });
  listeners["orange:landed"].listener({});
  assert.deepEqual(sent, [
    ["event", "room_visit", { room: "study" }],
    ["event", "orange_roll", {}],
  ]);
});
