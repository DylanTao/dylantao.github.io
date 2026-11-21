import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import vm from "node:vm";

const source = readFileSync(new URL("../assets/js/home-scene/controller.mjs", import.meta.url), "utf8");
const begin = source.indexOf("  let floraLoad = null,"),
  end = source.indexOf("  async function attachFlora() {", begin);
assert.ok(begin >= 0 && end > begin, "exercise the controller's coast request and reveal code");
const settle = () => new Promise(setImmediate);

// Substitute only the two model decoders, driver warmup and render request. Hold each independently
// so the production request/reveal's ordering and failures are tested without a GPU or hard-coded delays.
function fixture(config = { flora: "flora.glb", hinterland: { file: "hinterland.glb" } }) {
  const requests = [],
    warmups = [],
    visible = [],
    frames = [];
  function hold(list, fields = {}) {
    let finish;
    const promise = new Promise((resolve) => (finish = resolve));
    list.push({ ...fields, finish });
    return promise;
  }
  const model = (name, options) => hold(requests, { name, options });
  const { loadCoast, dispose } = vm.runInNewContext(`${source.slice(begin, end)}; ({ loadCoast, dispose() { disposed = true; } });`, {
    config,
    disposed: false,
    attachFlora: () => model("flora"),
    attachHinterland: (options) => model("hinterland", options),
    compilePrograms: () => hold(warmups),
    requestFrame: () => frames.push([...visible]),
  });
  const finish = (index) => requests[index].finish(() => visible.push(requests[index].name));
  return { loadCoast, dispose, requests, warmups, visible, frames, finish };
}

test("an ordinary coast visit attaches both groups for one warmup and one reveal", async () => {
  const f = fixture();
  const outside = f.loadCoast();
  const film = f.loadCoast({ surveyBeforeReveal: true });
  assert.deepEqual(
    f.requests.map(({ name }) => name),
    ["flora", "hinterland"]
  );
  assert.equal(f.requests[1].options.surveyBeforeReveal, false, "a pending ordinary request owns its reveal timing");
  f.finish(0);
  await settle();
  assert.deepEqual(f.visible, []);
  assert.equal(f.warmups.length, 0);
  f.finish(1);
  await settle();
  assert.equal(f.warmups.length, 1);
  assert.deepEqual(f.visible, []);
  f.warmups[0].finish();
  await Promise.all([outside, film, f.loadCoast()]);
  assert.deepEqual(f.frames, [["flora", "hinterland"]]);
  assert.equal(f.requests.length, 2);
});

test("Whole home requests just the headland; Step outside joins that request and loads planting", async () => {
  const f = fixture();
  const overview = f.loadCoast({ includeFlora: false });
  assert.deepEqual(
    f.requests.map(({ name }) => name),
    ["hinterland"]
  );
  const outside = f.loadCoast();
  f.finish(0);
  await settle();
  f.warmups[0].finish();
  await overview;
  assert.deepEqual(f.visible, ["hinterland"]);
  assert.deepEqual(
    f.requests.map(({ name }) => name),
    ["hinterland", "flora"]
  );
  f.finish(1);
  await settle();
  f.warmups[1].finish();
  await outside;
  assert.deepEqual(f.visible, ["hinterland", "flora"]);
});

test("a failed optional model can retry after another destination request", async () => {
  const f = fixture();
  const film = f.loadCoast({ surveyBeforeReveal: true });
  assert.equal(f.requests[1].options.surveyBeforeReveal, true);
  f.requests[0].finish();
  f.finish(1);
  await settle();
  f.warmups[0].finish();
  await film;
  assert.deepEqual(f.visible, ["hinterland"]);
  const outside = f.loadCoast();
  assert.deepEqual(
    f.requests.map(({ name }) => name),
    ["flora", "hinterland", "flora"]
  );
  f.finish(2);
  await settle();
  f.dispose();
  f.warmups[1].finish();
  await outside;
  assert.deepEqual(f.frames, [["hinterland"]]);
});

test("an unconfigured asset adds no request or wait", async () => {
  const f = fixture({ flora: "flora.glb" });
  await f.loadCoast({ includeFlora: false });
  assert.equal(f.requests.length, 0);
  const outside = f.loadCoast();
  f.finish(0);
  await settle();
  assert.equal(f.warmups.length, 1);
  f.warmups[0].finish();
  await outside;
  assert.deepEqual(f.frames, [["flora"]]);
});
