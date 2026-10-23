import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "../assets/js/three.module.min.js";
import { captureStillPhoto, stillPhotoJitter } from "../assets/js/home-scene/still-photo.mjs";

test("a photo rejects a changed final sample and restores the exact projection", async () => {
  const camera = new THREE.PerspectiveCamera(43, 1.4, 0.05, 1000);
  const projection = camera.projectionMatrix.toArray();
  const inverse = camera.projectionMatrixInverse.toArray();
  let state = 0,
    renders = 0;
  const context = { RGBA: 1, UNSIGNED_BYTE: 2, readPixels() {} };
  await assert.rejects(
    captureStillPhoto({
      renderer: { domElement: { width: 2, height: 2 }, getContext: () => context },
      camera,
      samples: 2,
      isFrozen: () => true,
      stateKey: () => state,
      renderFrame() {
        if (++renders === 2) setTimeout(() => state++, 0);
      },
    }),
    /view changed/
  );
  assert.deepEqual(camera.projectionMatrix.toArray(), projection);
  assert.deepEqual(camera.projectionMatrixInverse.toArray(), inverse);
  assert.equal(renders, 3, "the restored projection is rendered even after cancellation");
});

test("bounded photo samples are centered and a live view is refused before drawing", async () => {
  const jitter = stillPhotoJitter(8);
  for (const axis of [0, 1]) assert.ok(Math.abs(jitter.reduce((sum, p) => sum + p[axis], 0)) < 1e-12);
  assert.throws(() => stillPhotoJitter(17), RangeError);
  await assert.rejects(captureStillPhoto({ isFrozen: () => false }), /Pause motion/);
});
