// Original bounded Tessendorf-style experiment. Research reference and limitations: FFT-OCEAN.md.
// CPU inverse FFT, not a sparse wave sum renamed as FFT. No borrowed implementation or asset.
export function inverseFFT(real, imaginary) {
  const n = real.length;
  if (n < 2 || n & (n - 1) || imaginary.length !== n) throw new RangeError("FFT size must be a power of two");
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      [real[i], real[j]] = [real[j], real[i]];
      [imaginary[i], imaginary[j]] = [imaginary[j], imaginary[i]];
    }
  }
  for (let length = 2; length <= n; length *= 2) {
    const angle = (2 * Math.PI) / length,
      c = Math.cos(angle),
      s = Math.sin(angle);
    for (let start = 0; start < n; start += length) {
      let wr = 1,
        wi = 0;
      for (let j = 0; j < length / 2; j++) {
        const a = start + j,
          b = a + length / 2,
          tr = wr * real[b] - wi * imaginary[b],
          ti = wr * imaginary[b] + wi * real[b];
        real[b] = real[a] - tr;
        imaginary[b] = imaginary[a] - ti;
        real[a] += tr;
        imaginary[a] += ti;
        [wr, wi] = [wr * c - wi * s, wr * s + wi * c];
      }
    }
  }
  for (let i = 0; i < n; i++) {
    real[i] /= n;
    imaginary[i] /= n;
  }
}
export function createFFTOcean({ size = 64, length = 128, windSpeed = 8, seed = 521, rms = 0.13 } = {}) {
  if (size < 8 || size > 128 || size & (size - 1)) throw new RangeError("ocean FFT size must be 8–128 and power of two");
  const count = size * size,
    h0r = new Float64Array(count),
    h0i = new Float64Array(count),
    omega = new Float64Array(count),
    kx = new Float64Array(count),
    kz = new Float64Array(count),
    real = new Float64Array(count),
    imaginary = new Float64Array(count),
    rowR = new Float64Array(size),
    rowI = new Float64Array(size),
    data = new Float32Array(count * 4);
  let state = seed >>> 0,
    seconds = NaN,
    transforms = 0,
    lastMilliseconds = 0;
  const random = () => {
    state = (Math.imul(1664525, state) + 1013904223) >>> 0;
    return (state + 0.5) / 4294967296;
  };
  const gaussian = () => Math.sqrt(-2 * Math.log(random())) * Math.cos(2 * Math.PI * random());
  let variance = 0;
  for (let z = 0; z < size; z++)
    for (let x = 0; x < size; x++) {
      const i = z * size + x;
      kx[i] = (2 * Math.PI * (x < size / 2 ? x : x - size)) / length;
      kz[i] = (2 * Math.PI * (z < size / 2 ? z : z - size)) / length;
      const k = Math.hypot(kx[i], kz[i]);
      omega[i] = Math.sqrt(9.80665 * k);
      // Phillips spectrum, wind toward +Z; suppress the grid's unresolved end and reverse seas.
      const L = windSpeed ** 2 / 9.80665;
      const power = k === 0 ? 0 : (Math.exp(-1 / (k * L) ** 2) / k ** 4) * (kz[i] / k) ** 2 * Math.exp(-((k * 0.8) ** 2)) * (kz[i] < 0 ? 0.25 : 1);
      h0r[i] = gaussian() * Math.sqrt(power * 0.5);
      h0i[i] = gaussian() * Math.sqrt(power * 0.5);
      variance += 2 * (h0r[i] ** 2 + h0i[i] ** 2);
    }
  const gain = (rms * count) / Math.sqrt(variance);
  for (let i = 0; i < count; i++) {
    h0r[i] *= gain;
    h0i[i] *= gain;
  }
  function transform() {
    for (let z = 0; z < size; z++) {
      for (let x = 0; x < size; x++) {
        rowR[x] = real[z * size + x];
        rowI[x] = imaginary[z * size + x];
      }
      inverseFFT(rowR, rowI);
      for (let x = 0; x < size; x++) {
        real[z * size + x] = rowR[x];
        imaginary[z * size + x] = rowI[x];
      }
    }
    for (let x = 0; x < size; x++) {
      for (let z = 0; z < size; z++) {
        rowR[z] = real[z * size + x];
        rowI[z] = imaginary[z * size + x];
      }
      inverseFFT(rowR, rowI);
      for (let z = 0; z < size; z++) {
        real[z * size + x] = rowR[z];
        imaginary[z * size + x] = rowI[z];
      }
    }
  }
  function update(time) {
    if (time === seconds) return false;
    const start = performance.now();
    seconds = time;
    for (let z = 0; z < size; z++)
      for (let x = 0; x < size; x++) {
        const i = z * size + x,
          mirror = ((size - z) % size) * size + ((size - x) % size),
          c = Math.cos(omega[i] * time),
          s = Math.sin(omega[i] * time);
        real[i] = (h0r[i] + h0r[mirror]) * c - (h0i[i] + h0i[mirror]) * s;
        imaginary[i] = (h0r[i] - h0r[mirror]) * s + (h0i[i] - h0i[mirror]) * c;
      }
    transform();
    const cell = length / size;
    for (let z = 0; z < size; z++)
      for (let x = 0; x < size; x++) {
        const i = z * size + x;
        data[i * 4] = real[i];
        data[i * 4 + 1] = (real[z * size + ((x + 1) % size)] - real[z * size + ((x + size - 1) % size)]) / (2 * cell);
        data[i * 4 + 2] = (real[((z + 1) % size) * size + x] - real[((z + size - 1) % size) * size + x]) / (2 * cell);
        data[i * 4 + 3] = 1;
      }
    transforms++;
    lastMilliseconds = performance.now() - start;
    return true;
  }
  function sampleData(x, z, values = data) {
    const u = ((((x / length) % 1) + 1) % 1) * size,
      v = ((((z / length) % 1) + 1) % 1) * size,
      ix = Math.floor(u),
      iz = Math.floor(v),
      fx = u - ix,
      fz = v - iz;
    const a = (iz * size + ix) * 4,
      b = (iz * size + ((ix + 1) % size)) * 4,
      c = (((iz + 1) % size) * size + ix) * 4,
      d = (((iz + 1) % size) * size + ((ix + 1) % size)) * 4;
    const channel = (q) => (values[a + q] * (1 - fx) + values[b + q] * fx) * (1 - fz) + (values[c + q] * (1 - fx) + values[d + q] * fx) * fz;
    const h = channel(0),
      sx = channel(1),
      sz = channel(2),
      norm = Math.hypot(sx, 1, sz);
    return {
      displacement: [0, h, 0],
      tangentX: [1, sx, 0],
      tangentZ: [0, sz, 1],
      normal: [-sx / norm, 1 / norm, -sz / norm],
      jacobian: 1,
      lostVariance: 0,
    };
  }
  update(0);
  return {
    size,
    length,
    data,
    update,
    sampleData,
    sample(x, z, time) {
      update(time);
      return sampleData(x, z);
    },
    evidence: () => ({
      method: "64² CPU inverse FFT, Phillips deep-water spectrum, vertical displacement",
      size,
      length,
      seconds,
      transforms,
      lastMilliseconds,
      uploadBytes: data.byteLength,
    }),
  };
}

export const fftSamplingGLSL = `
uniform sampler2D oceanFFT;
uniform float oceanFFTEnabled, oceanFFTLength, oceanFFTSize;
vec3 oceanFFTSample(vec2 p) {
  vec2 uv=fract(p/oceanFFTLength)*oceanFFTSize;
  ivec2 base=ivec2(floor(uv)), size=ivec2(int(oceanFFTSize)); vec2 f=fract(uv);
  vec3 a=texelFetch(oceanFFT,base,0).rgb;
  vec3 b=texelFetch(oceanFFT,(base+ivec2(1,0))%size,0).rgb;
  vec3 c=texelFetch(oceanFFT,(base+ivec2(0,1))%size,0).rgb;
  vec3 d=texelFetch(oceanFFT,(base+ivec2(1,1))%size,0).rgb;
  return mix(mix(a,b,f.x),mix(c,d,f.x),f.y);
}`;
