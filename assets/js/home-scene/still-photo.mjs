// Finite spatial supersampling for a frozen photograph. There is deliberately no history from
// moving frames, no reprojection and no claim of motion-vector temporal antialiasing.
const linear = (v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
const srgb = (v) => (v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055);
export function halton(index, base) {
  let value = 0,
    fraction = 1;
  while (index > 0) {
    fraction /= base;
    value += fraction * (index % base);
    index = Math.floor(index / base);
  }
  return value;
}
export function stillPhotoJitter(samples = 8) {
  if (!Number.isInteger(samples) || samples < 2 || samples > 16) throw new RangeError("photo sample count must be 2–16");
  const points = Array.from({ length: samples }, (_, i) => [halton(i + 1, 2) - 0.5, halton(i + 1, 3) - 0.5]);
  const mean = points.reduce((sum, p) => [sum[0] + p[0] / samples, sum[1] + p[1] / samples], [0, 0]);
  return points.map((p) => [p[0] - mean[0], p[1] - mean[1]]);
}
export async function captureStillPhoto({ renderer, camera, renderFrame, isFrozen, stateKey, samples = 8 }) {
  if (!isFrozen()) throw new Error("Pause motion and select a fixed preview minute before taking a photo");
  const width = renderer.domElement.width,
    height = renderer.domElement.height;
  if (width * height > 2200000) throw new RangeError("Photo capture is limited to 2.2 megapixels; reduce the canvas size first");
  const jitter = stillPhotoJitter(samples),
    context = renderer.getContext(),
    pixels = new Uint8Array(width * height * 4),
    sum = new Float32Array(width * height * 3),
    projection = camera.projectionMatrix.clone(),
    signature = stateKey(),
    started = performance.now();
  try {
    for (const [x, y] of jitter) {
      if (!isFrozen() || stateKey() !== signature) throw new Error("The view changed during photo capture; photo discarded");
      camera.projectionMatrix.copy(projection);
      camera.projectionMatrix.elements[8] += (2 * x) / width;
      camera.projectionMatrix.elements[9] += (2 * y) / height;
      camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
      renderFrame();
      context.readPixels(0, 0, width, height, context.RGBA, context.UNSIGNED_BYTE, pixels);
      for (let i = 0; i < width * height; i++) for (let c = 0; c < 3; c++) sum[i * 3 + c] += linear(pixels[i * 4 + c] / 255) / samples;
      // Yield between samples so capture cannot monopolize the UI; changed views abort above.
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
    if (!isFrozen() || stateKey() !== signature) throw new Error("The view changed during photo capture; photo discarded");
    const output = new Uint8ClampedArray(width * height * 4);
    for (let y = 0; y < height; y++)
      for (let x = 0; x < width; x++) {
        const source = ((height - 1 - y) * width + x) * 3,
          destination = (y * width + x) * 4;
        for (let c = 0; c < 3; c++) output[destination + c] = Math.round(255 * srgb(sum[source + c]));
        output[destination + 3] = 255;
      }
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    canvas.getContext("2d").putImageData(new ImageData(output, width, height), 0, 0);
    return {
      canvas,
      evidence: {
        method: "finite jittered still-photo supersampling of composed sRGB output, accumulated in linear light",
        samples,
        width,
        height,
        milliseconds: performance.now() - started,
        movingSceneHistory: false,
      },
    };
  } finally {
    camera.projectionMatrix.copy(projection);
    camera.projectionMatrixInverse.copy(projection).invert();
    renderFrame();
  }
}
