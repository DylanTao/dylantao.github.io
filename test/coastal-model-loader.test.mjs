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
  assert.notEqual(later.loader.dracoLoader, pool, "a later loader starts a fresh pool, as a retry after a failed load does");
  later.decoder.dispose();
  assert.equal(ended, 1);
});

test("a failed decoder download is fetched again by the next decode", async () => {
  const { loader, decoder } = createModelLoader();
  const pool = loader.dracoLoader;
  let attempts = 0;
  pool._loadLibrary = async () => {
    if (++attempts === 1) throw new Error("offline");
    return new ArrayBuffer(8);
  };
  await assert.rejects(pool._initDecoder(), /offline/);
  await pool._initDecoder();
  assert.equal(attempts, 2);
  assert.equal(pool.decoderConfig.wasmBinary.byteLength, 8);
  decoder.dispose();
});

test("a decoder worker that fails is retired, so the next decode starts a new one", async () => {
  class FakeWorker {
    constructor(url) {
      this.url = url;
      this.handlers = [];
      this.terminated = false;
    }
    postMessage() {}
    addEventListener(type, handler) {
      if (type === "error") this.handlers.push(handler);
    }
    terminate() {
      this.terminated = true;
    }
  }
  const NativeWorker = globalThis.Worker;
  globalThis.Worker = FakeWorker;
  try {
    const { loader, decoder } = createModelLoader();
    const pool = loader.dracoLoader;
    pool._loadLibrary = async () => new ArrayBuffer(8);
    const worker = await pool._getWorker(1, 10);
    const task = new Promise((resolve, reject) => (worker._callbacks[1] = { resolve, reject }));
    worker.handlers.forEach((handler) => handler());
    await assert.rejects(task, /could not start/);
    assert.equal(worker.terminated, true);
    assert.equal(pool.workerPool.includes(worker), false);
    assert.notEqual(await pool._getWorker(2, 10), worker);
    decoder.dispose();
  } finally {
    globalThis.Worker = NativeWorker;
  }
});
