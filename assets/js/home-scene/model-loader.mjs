import { GLTFLoader } from "../vendor/three-r164/loaders/GLTFLoader.js";
import { DRACOLoader } from "../vendor/three-r164/loaders/DRACOLoader.js";

// The pinned loader's default inline blob worker conflicts with the site's CSP.
// Serve the same decoder/worker as ordinary same-origin files instead.
class StaticDracoLoader extends DRACOLoader {
  // The pool below is shared by every loader on the page and can outlive a failed load, so it must
  // not remember a failure: a failed decoder download is fetched again by the next decode, and a
  // worker that fails is retired so the next decode starts a new one.
  _initDecoder() {
    if (!this.decoderPending) {
      const pending = this._loadLibrary("draco_decoder.wasm", "arraybuffer").then((binary) => {
        this.decoderConfig.wasmBinary = binary;
        this.workerSourceURL = new URL("draco-worker.js", this.decoderPath).href;
      });
      pending.catch(() => {
        if (this.decoderPending === pending) this.decoderPending = null;
      });
      this.decoderPending = pending;
    }
    return this.decoderPending;
  }
  async _getWorker(id, cost) {
    const worker = await super._getWorker(id, cost);
    if (!worker.coastalErrorHandler) {
      worker.coastalErrorHandler = true;
      worker.addEventListener("error", () => {
        for (const callback of Object.values(worker._callbacks)) callback.reject(new Error("The model decoder could not start."));
        const index = this.workerPool.indexOf(worker);
        if (index >= 0) this.workerPool.splice(index, 1);
        worker.terminate();
      });
    }
    return worker;
  }
}

// GLTFLoader decodes each Draco primitive as its own task, so a pool decodes a model's primitives in
// parallel. One worker serialized them: 0.4-1.3 s for the house shell's 45 primitives on the test
// laptop, against about 0.3 s with four (docs/performance-notes.md). Half the cores, at most
// four, leave the page, the compositor and the GPU process their own. Every loader on the page (the
// home, its wildlife, the footer coast) shares the one pool, so the page never runs more than four
// decoders. The pool ends when the last loader is disposed, and a later loader starts a fresh one.
const decoderWorkers = () => Math.max(1, Math.min(4, Math.floor((globalThis.navigator?.hardwareConcurrency || 2) / 2)));
let sharedDecoder = null,
  decoderUsers = 0;

export function createModelLoader() {
  sharedDecoder ||= new StaticDracoLoader()
    .setDecoderPath(new URL("../vendor/three-r164/libs/draco/", import.meta.url).href)
    .setDecoderConfig({ type: "wasm" })
    .setWorkerLimit(decoderWorkers());
  const pool = sharedDecoder;
  decoderUsers++;
  let released = false;
  const decoder = {
    dispose() {
      if (released) return;
      released = true;
      if (--decoderUsers > 0) return;
      pool.dispose();
      if (sharedDecoder === pool) sharedDecoder = null;
    },
  };
  return { loader: new GLTFLoader().setDRACOLoader(pool), decoder };
}
