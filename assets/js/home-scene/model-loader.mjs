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

export function createModelLoader() {
  const decoder = new StaticDracoLoader()
    .setDecoderPath(new URL("../vendor/three-r164/libs/draco/", import.meta.url).href)
    .setDecoderConfig({ type: "wasm" })
    .setWorkerLimit(1);
  return { loader: new GLTFLoader().setDRACOLoader(decoder), decoder };
}
