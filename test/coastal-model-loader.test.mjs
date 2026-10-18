import test from "node:test";
import assert from "node:assert/strict";
import { createModelLoader } from "../assets/js/home-scene/model-loader.mjs";

test("every loader shares one bounded Draco pool, ended by the last release", () => {
  const home = createModelLoader(),
    wildlife = createModelLoader();
  const pool = home.loader.dracoLoader;
  assert.equal(wildlife.loader.dracoLoader, pool, "one pool for the page");
  assert.ok(pool.workerLimit >= 1 && pool.workerLimit <= 4, `${pool.workerLimit}`);
  let ended = 0;
  const dispose = pool.dispose.bind(pool);
  pool.dispose = () => {
    ended++;
    return dispose();
  };
  wildlife.decoder.dispose();
  wildlife.decoder.dispose();
  assert.equal(ended, 0, "the home still decodes streamed rooms");
  home.decoder.dispose();
  assert.equal(ended, 1);
  const later = createModelLoader();
  assert.equal(later.loader.dracoLoader, pool, "a later loader reuses the pool, which starts workers on demand");
  later.decoder.dispose();
  assert.equal(ended, 2);
});
