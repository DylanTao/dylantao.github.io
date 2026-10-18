import { GLTFLoader } from "../vendor/three-r164/loaders/GLTFLoader.js";
import { DRACOLoader } from "../vendor/three-r164/loaders/DRACOLoader.js";

// The pinned loader's default inline blob worker conflicts with the site's CSP.
// Serve the same decoder/worker as ordinary same-origin files instead.
class StaticDracoLoader extends DRACOLoader {
  _initDecoder() {
    if (!this.decoderPending) {
      this.decoderPending = this._loadLibrary("draco_decoder.wasm", "arraybuffer").then((binary) => {
        this.decoderConfig.wasmBinary = binary;
        this.workerSourceURL = new URL("draco-worker.js", this.decoderPath).href;
      });
    }
    return this.decoderPending;
  }
  async _getWorker(id, cost) {
    const worker = await super._getWorker(id, cost);
    if (!worker.coastalErrorHandler) {
      worker.coastalErrorHandler = true;
      worker.addEventListener("error", () => {
        for (const callback of Object.values(worker._callbacks)) callback.reject(new Error("The model decoder could not start."));
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
// decoders, and the pool's workers end when the last loader is disposed.
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
      if (--decoderUsers === 0) pool.dispose();
    },
  };
  return { loader: new GLTFLoader().setDRACOLoader(pool), decoder };
}
