import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import vm from "node:vm";

// Exercise the actual listener with platform adapters. Browser tests separately
// verify bubbling, focus and the native disc buttons on the rendered homepage.
function keyboardProbe({ foundAll = false, mode = "2d" } = {}) {
  const source = fs.readFileSync(new URL("../assets/js/home.js", import.meta.url), "utf8").replace(/\r\n/g, "\n");
  const start = source.indexOf('    portrait.addEventListener("keydown", (event) => {');
  const end = source.indexOf('\n\n    document.addEventListener("click"', start);
  assert.ok(start >= 0 && end > start, "the real portrait listener must be present");
  const spinButton = {};
  const actions = [];
  let listener;
  vm.runInNewContext(source.slice(start, end), {
    portrait: { addEventListener: (_type, callback) => (listener = callback) },
    spinButton,
    stage: { dataset: { deskMode: mode } },
    records: [{}, {}],
    droppedRecords: new Set(foundAll ? [0, 1] : []),
    advanceRecord: (direction) => actions.push({ action: "advance", direction }),
    dropRecordCard: () => actions.push({ action: "drop" }),
    replayAllDroppedRecordCards: () => actions.push({ action: "replay" }),
  });
  return (properties) => {
    actions.length = 0;
    let prevented = false;
    listener({
      target: spinButton,
      ctrlKey: false,
      metaKey: false,
      altKey: false,
      shiftKey: false,
      isComposing: false,
      preventDefault: () => (prevented = true),
      ...properties,
    });
    return { prevented, actions: [...actions] };
  };
}

for (const key of ["d", "D", "ArrowLeft", "ArrowRight"]) {
  test(`disc keyboard yields ${key} to modified or composing input`, () => {
    const probe = keyboardProbe();
    for (const property of ["ctrlKey", "metaKey", "altKey", "isComposing"]) {
      assert.deepEqual(probe({ key, [property]: true }), { prevented: false, actions: [] }, property);
    }
  });
}

test("disc plain arrows and D including Shift+D retain their actions", () => {
  const probe = keyboardProbe();
  assert.deepEqual(probe({ key: "ArrowLeft" }), { prevented: true, actions: [{ action: "advance", direction: -1 }] });
  assert.deepEqual(probe({ key: "ArrowRight" }), { prevented: true, actions: [{ action: "advance", direction: 1 }] });
  for (const properties of [{ key: "d" }, { key: "D", shiftKey: true }]) {
    assert.deepEqual(probe(properties), { prevented: true, actions: [{ action: "drop" }] });
  }
  assert.deepEqual(keyboardProbe({ foundAll: true })({ key: "D", shiftKey: true }), {
    prevented: true,
    actions: [{ action: "replay" }],
  });
  assert.deepEqual(keyboardProbe({ mode: "3d" })({ key: "d" }), { prevented: false, actions: [] });
});
