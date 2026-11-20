// A small buoyant plume in the space between the wood and the suspended hood.
// Heat is carried up from three cut faces. A cooling pocket between them gives
// a sheet of flame a neck and, occasionally, a detached tip.
export const HEARTH_GRID = Object.freeze([24, 26, 16]);
export const HEARTH_STEP = 1 / 24;
const [W, H, D] = HEARTH_GRID;
const layer = W * H;
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

export function createHearthField(breeze = 0) {
  let current = new Float32Array(W * H * D);
  let next = new Float32Array(current.length);
  const image = new Uint8Array(current.length);
  const curl = new Float32Array(H),
    cross = new Float32Array(H),
    pulse = new Float32Array(3);
  const char = [0.33, 0.51, 0.24];
  const fuel = [0.91, 0.76, 0.98];
  const centers = [
    [0.33, 0.42],
    [0.58, 0.51],
    [0.48, 0.66],
  ];
  let time = 0;

  function step(ageWood = true) {
    time += HEARTH_STEP;
    if (ageWood) {
      for (let i = 0; i < fuel.length; i++) {
        char[i] = Math.min(0.99, char[i] + HEARTH_STEP * (0.0035 + i * 0.00034) * fuel[i]);
        fuel[i] = Math.max(0, fuel[i] - HEARTH_STEP * (0.00134 + i * 0.00017) * (0.65 + char[i]));
      }
    }
    for (let i = 0; i < pulse.length; i++) pulse[i] = 0.77 + 0.16 * Math.sin(time * (2.6 + 0.31 * i) + i) + 0.09 * Math.sin(time * 4.1 + 3 * i);
    for (let y = 0; y < H; y++) {
      const height = y / H;
      curl[y] =
        (0.25 + 1.15 * height) * (0.56 * Math.sin(y * 0.31 - time * 3.7) + 0.44 * Math.sin(y * 0.17 - time * 5.1)) +
        breeze * height * (0.55 + 0.38 * Math.sin(time * 1.7));
      cross[y] = (0.15 + 0.42 * height) * Math.sin(y * 0.27 - time * 2.95);
    }
    for (let z = 1; z < D - 1; z++) {
      for (let x = 1; x < W - 1; x++) {
        const k = z * layer + x;
        let source = 0;
        for (let i = 0; i < centers.length; i++) {
          const [cx, cz] = centers[i];
          const u = x / (W - 1) - cx - 0.035 * Math.sin(time * 2.7 + 2 * i);
          const v = z / (D - 1) - cz;
          const spread = (u + v * 0.48) ** 2 * 56 + (v - u * 0.3) ** 2 * 116;
          source += Math.max(0, 1 - spread) ** 2 * pulse[i] * Math.min(1, fuel[i] * 1.7);
        }
        next[k] = Math.min(source, 1.2);
        for (let y = 1; y < H - 1; y++) {
          const i = k + y * W,
            hot = current[i];
          // Backtrace in a rising, sheared flow. Hotter gas lifts faster.
          const sy = clamp(y - (1.16 + 0.52 * hot), 0, H - 2);
          const sx = clamp(x - curl[y] - (W * 0.48 - x) * 0.023, 0.01, W - 1.01);
          const sz = clamp(z - cross[y] - (D * 0.5 - z) * 0.042, 0.01, D - 1.01);
          const ix = Math.floor(sx),
            iy = Math.floor(sy),
            iz = Math.floor(sz);
          const at = iz * layer + iy * W + ix;
          const fx = sx - ix,
            fy = sy - iy,
            fz = sz - iz;
          const a = current[at] * (1 - fx) + current[at + 1] * fx;
          const b = current[at + W] * (1 - fx) + current[at + W + 1] * fx;
          const c = current[at + layer] * (1 - fx) + current[at + layer + 1] * fx;
          const e = current[at + layer + W] * (1 - fx) + current[at + layer + W + 1] * fx;
          const heat = (a * (1 - fy) + b * fy) * (1 - fz) + (c * (1 - fy) + e * fy) * fz;
          next[i] = Math.max(0, heat * (0.965 - (0.017 * y) / H) - 0.0055);
        }
      }
    }
    [current, next] = [next, current];
    for (let i = 0; i < image.length; i++) image[i] = Math.min(255, Math.round(current[i] * 255));
  }
  for (let i = 0; i < 30; i++) step(false);
  return {
    image,
    step,
    char,
    fuel,
    get time() {
      return time;
    },
  };
}
