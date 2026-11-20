import test from "node:test";
import assert from "node:assert/strict";
import { arrivalStandingView } from "../assets/js/home-scene/arrival-view.mjs";

const lens = { eyeHeight: 1.6, fov: 62 };
function manifest() {
  const position = [14.625479586940754, 9.013333333333346, 28.726676982044214];
  return {
    entrance: { straightDescent: true, portal: [...position], top: position[1], headroom: 2.1 },
    walk: { start: { position, yaw: -2.234021442552742, pitch: -0.7 }, region: { min: [-18, -2, -11.2], max: [18, 18.77, 35] } },
  };
}

test("the standing inspection shares the entrance's real foot position and walk lens without changing metadata", () => {
  const config = manifest(),
    before = structuredClone(config);
  const view = arrivalStandingView(config, lens);
  assert.deepEqual(view.position, [config.walk.start.position[0], config.walk.start.position[1] + 1.6, config.walk.start.position[2]]);
  assert.equal(view.yaw, config.walk.start.yaw);
  assert.equal(view.pitch, config.walk.start.pitch);
  assert.equal(view.fov, 62);
  assert.equal(view.destination, "entrance");
  view.position[0] = 0;
  assert.deepEqual(config, before);
});

test("older entrances retain their existing orbit", () => {
  for (const flag of [undefined, false, "true", 1]) {
    const config = manifest();
    config.entrance.straightDescent = flag;
    assert.equal(arrivalStandingView(config, lens), null);
  }
});

test("the garden lens stands on its named Walk destination while the stair keeps its route anchor", () => {
  const config = manifest();
  const garden = { room: "outside", position: [1, 8.2, 33], yaw: -2.75, pitch: -0.32, fov: 71 };
  config.walk.places = { entrance: garden };
  const view = arrivalStandingView(config, lens);
  assert.deepEqual(view, { destination: "entrance", position: [1, 8.2 + lens.eyeHeight, 33], yaw: garden.yaw, pitch: garden.pitch, fov: 71 });
  assert.deepEqual(config.entrance.portal, config.walk.start.position);
  garden.position[2] = config.walk.region.max[2] + 1;
  assert.equal(arrivalStandingView(config, lens), null);
});

test("invalid standing locations, portal mismatch and insufficient headroom never create a free camera", () => {
  const edits = [
    (c) => (c.walk.start.position[0] = NaN),
    (c) => (c.walk.start.position = [1, 2]),
    (c) => (c.walk.start.position[0] += 0.1),
    (c) => (c.entrance.top += 0.1),
    (c) => (c.entrance.headroom = 1.6),
    (c) => (c.walk.region.max[0] = 10),
    (c) => (c.walk.region.min[1] = 20),
    (c) => (c.walk.start.pitch = 2),
    (c) => (c.walk.start.yaw = Infinity),
  ];
  for (const edit of edits) {
    const config = manifest();
    edit(config);
    assert.equal(arrivalStandingView(config, lens), null);
  }
  for (const options of [
    { eyeHeight: -1, fov: 62 },
    { eyeHeight: 1.6, fov: 140 },
    { eyeHeight: NaN, fov: 62 },
  ])
    assert.equal(arrivalStandingView(manifest(), options), null);
});
