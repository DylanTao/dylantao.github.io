import { DEFAULT_WIND, WIND_MODES, wrapWindPhase } from "./wind-field.mjs";

// Original scalar transport, informed by Stam (1999) and Fedkiw et al. (2001).
// Density is a bounded optical droplet-concentration proxy; temperature is K
// above ambient. The prescribed curl wind + thermal rise is NOT a projected
// Navier–Stokes velocity solve, a condensation model, or conserved vapor mass.
const smooth = (x) => {
  const t = Math.max(0, Math.min(1, x));
  return t * t * (3 - 2 * t);
};
const lerp = (a, b, t) => a + (b - a) * t;

export function createSteamDensity({
  bounds = { min: [2.21, 3.0075, 2.22], max: [4.13, 3.7275, 4.14] },
  grid = [24, 24, 24],
  center = [3.17, 3.18],
  radius = 0.8,
  surfaceY = bounds.min[1],
  step = 1 / 30,
  maxFrame = 0.25,
  wind = DEFAULT_WIND,
  windScale = 0.16,
  thermalRise = 0.018,
  baseRise = 0.018,
  diffusion = 0.0007,
  cooling = 0.62,
  dissipation = 0.42,
  escape = 2.6,
  sourceRate = 6,
  sourceTemperature = 14,
  maximumDensity = 1,
} = {}) {
  if (
    !Array.isArray(grid) ||
    grid.length !== 3 ||
    !grid.every((n) => Number.isInteger(n) && n >= 4 && n <= 40) ||
    !bounds?.min ||
    !bounds?.max ||
    ![...bounds.min, ...bounds.max, ...center, radius, surfaceY, step, maxFrame].every(Number.isFinite) ||
    bounds.min.length !== 3 ||
    bounds.max.length !== 3 ||
    center.length !== 2 ||
    !bounds.max.every((v, i) => v > bounds.min[i]) ||
    radius <= 0 ||
    step < 1 / 120 ||
    step > 1 / 15 ||
    maxFrame < step ||
    maxFrame > 0.25 ||
    ![windScale, thermalRise, baseRise, diffusion, cooling, dissipation, escape, sourceRate].every((x) => Number.isFinite(x) && x >= 0) ||
    !Number.isFinite(sourceTemperature) ||
    sourceTemperature <= 0 ||
    !Number.isFinite(maximumDensity) ||
    maximumDensity <= 0
  )
    throw new RangeError("finite bounded steam domain and positive transport parameters required");
  const [nx, ny, nz] = grid,
    min = [...bounds.min],
    max = [...bounds.max],
    cell = grid.map((n, i) => (max[i] - min[i]) / n),
    weights = cell.map((h) => (diffusion * step) / (h * h)),
    weightSum = 2 * weights.reduce((a, b) => a + b, 0),
    count = nx * ny * nz,
    state = { density: new Float32Array(count), temperature: new Float32Array(count) },
    advectedDensity = new Float32Array(count),
    advectedTemperature = new Float32Array(count),
    velocity = Array.from({ length: 3 }, () => new Float32Array(count)),
    emitter = new Float32Array(count),
    boundaryLoss = new Float32Array(count),
    coordinates = grid.map((n, axis) => Float64Array.from({ length: n }, (_, i) => min[axis] + (i + 0.5) * cell[axis])),
    // Six analytic modes use separability of sin(k.x+phase): only O(6N)
    // transcendental evaluations per axis, rather than six sin() per voxel.
    modeAxes = WIND_MODES.map(() => grid.map((n) => ({ sin: new Float64Array(n), cos: new Float64Array(n) }))),
    phaseSin = new Float64Array(WIND_MODES.length),
    phaseCos = new Float64Array(WIND_MODES.length),
    mean = wind.mean ?? DEFAULT_WIND.mean,
    gust = wind.gust ?? DEFAULT_WIND.gust,
    windRate = wind.rate ?? 1;
  if (weightSum > 1) throw new RangeError("explicit diffusion must remain a positive six-neighbor convex update");
  if (![...mean, gust, windRate].every(Number.isFinite) || mean.length !== 3 || gust < 0) throw new RangeError("finite prescribed wind required");
  const index = (i, j, k) => (k * ny + j) * nx + i;
  let pending = 0,
    fieldEndTime = 0,
    simulationTime = 0,
    ticks = 0,
    droppedTime = 0,
    sourceTicks = 0,
    revision = 0,
    maximumSpeed = 0;
  let prewarming = false;
  for (let mode = 0; mode < WIND_MODES.length; mode++)
    for (let axis = 0; axis < 3; axis++)
      for (let i = 0; i < grid[axis]; i++) {
        const angle = WIND_MODES[mode].k[axis] * coordinates[axis][i];
        modeAxes[mode][axis].sin[i] = Math.sin(angle);
        modeAxes[mode][axis].cos[i] = Math.cos(angle);
      }
  for (let k = 0; k < nz; k++)
    for (let j = 0; j < ny; j++)
      for (let i = 0; i < nx; i++) {
        const p = index(i, j, k),
          x = coordinates[0][i],
          y = coordinates[1][j],
          z = coordinates[2][k],
          r = Math.hypot(x - center[0], z - center[1]),
          edge = smooth((radius - r) / 0.13),
          height = y - surfaceY,
          sourceHeight = Math.exp(-(((height - 0.035) / 0.055) ** 2)),
          // A fixed, bounded wet-surface variation enters as SOURCE, not a
          // scrolling/noise opacity texture. The evolving volume is advected.
          patch = 0.73 + 0.27 * Math.cos((x - center[0]) * 8.1) * Math.cos((z - center[1]) * 6.3),
          side = Math.max(1 - i / 2, 1 - (nx - 1 - i) / 2, 1 - k / 2, 1 - (nz - 1 - k) / 2, 0),
          top = smooth((j / (ny - 1) - 0.62) / 0.38);
        emitter[p] = edge * sourceHeight * patch;
        boundaryLoss[p] = escape * Math.max(side, top);
      }

  function sample(array, x, y, z, outsideZero = true) {
    if (outsideZero && (x < min[0] || x > max[0] || y < min[1] || y > max[1] || z < min[2] || z > max[2])) return 0;
    const gx = Math.max(0, Math.min(nx - 1, (x - min[0]) / cell[0] - 0.5)),
      gy = Math.max(0, Math.min(ny - 1, (y - min[1]) / cell[1] - 0.5)),
      gz = Math.max(0, Math.min(nz - 1, (z - min[2]) / cell[2] - 0.5)),
      i = Math.floor(gx),
      j = Math.floor(gy),
      k = Math.floor(gz),
      hi = Math.min(i + 1, nx - 1),
      hj = Math.min(j + 1, ny - 1),
      hk = Math.min(k + 1, nz - 1),
      fx = gx - i,
      fy = gy - j,
      fz = gz - k,
      a = lerp(array[index(i, j, k)], array[index(hi, j, k)], fx),
      b = lerp(array[index(i, hj, k)], array[index(hi, hj, k)], fx),
      c = lerp(array[index(i, j, hk)], array[index(hi, j, hk)], fx),
      d = lerp(array[index(i, hj, hk)], array[index(hi, hj, hk)], fx);
    return lerp(lerp(a, b, fy), lerp(c, d, fy), fz);
  }

  function tick(time, sourceEnabled) {
    for (let mode = 0; mode < WIND_MODES.length; mode++) {
      const phase = wrapWindPhase(WIND_MODES[mode].phase + WIND_MODES[mode].rate * time * windRate);
      phaseSin[mode] = Math.sin(phase);
      phaseCos[mode] = Math.cos(phase);
    }
    for (let k = 0; k < nz; k++)
      for (let j = 0; j < ny; j++)
        for (let i = 0; i < nx; i++) {
          const p = index(i, j, k);
          let vx = mean[0],
            vy = mean[1],
            vz = mean[2];
          for (let mode = 0; mode < WIND_MODES.length; mode++) {
            const [a, b, c] = modeAxes[mode],
              sinXY = a.sin[i] * b.cos[j] + a.cos[i] * b.sin[j],
              cosXY = a.cos[i] * b.cos[j] - a.sin[i] * b.sin[j],
              sinXYZ = sinXY * c.cos[k] + cosXY * c.sin[k],
              cosXYZ = cosXY * c.cos[k] - sinXY * c.sin[k],
              s = gust * (sinXYZ * phaseCos[mode] + cosXYZ * phaseSin[mode]),
              v = WIND_MODES[mode].velocity;
            vx += v[0] * s;
            vy += v[1] * s;
            vz += v[2] * s;
          }
          velocity[0][p] = vx * windScale;
          velocity[1][p] = vy * windScale + baseRise + thermalRise * state.temperature[p];
          velocity[2][p] = vz * windScale;
          maximumSpeed = Math.max(maximumSpeed, Math.hypot(velocity[0][p], velocity[1][p], velocity[2][p]));
        }
    for (let k = 0; k < nz; k++)
      for (let j = 0; j < ny; j++)
        for (let i = 0; i < nx; i++) {
          const p = index(i, j, k),
            x = coordinates[0][i],
            y = coordinates[1][j],
            z = coordinates[2][k],
            // Midpoint characteristic backtrace; the three velocity grids
            // include measured prior-cell temperature, sampled coherently.
            mx = x - velocity[0][p] * step * 0.5,
            my = y - velocity[1][p] * step * 0.5,
            mz = z - velocity[2][p] * step * 0.5,
            bx = x - sample(velocity[0], mx, my, mz, false) * step,
            by = y - sample(velocity[1], mx, my, mz, false) * step,
            bz = z - sample(velocity[2], mx, my, mz, false) * step;
          advectedDensity[p] = sample(state.density, bx, by, bz);
          advectedTemperature[p] = sample(state.temperature, bx, by, bz);
        }
    const neighbor = (array, i, j, k) => (i < 0 || i >= nx || j < 0 || j >= ny || k < 0 || k >= nz ? 0 : array[index(i, j, k)]),
      diffuse = (array, p, i, j, k) =>
        array[p] * (1 - weightSum) +
        weights[0] * (neighbor(array, i - 1, j, k) + neighbor(array, i + 1, j, k)) +
        weights[1] * (neighbor(array, i, j - 1, k) + neighbor(array, i, j + 1, k)) +
        weights[2] * (neighbor(array, i, j, k - 1) + neighbor(array, i, j, k + 1));
    for (let k = 0; k < nz; k++)
      for (let j = 0; j < ny; j++)
        for (let i = 0; i < nx; i++) {
          const p = index(i, j, k),
            source = sourceEnabled ? 1 - Math.exp(-sourceRate * emitter[p] * step) : 0,
            rho = diffuse(advectedDensity, p, i, j, k) * Math.exp(-(dissipation + boundaryLoss[p]) * step),
            heat = diffuse(advectedTemperature, p, i, j, k) * Math.exp(-(cooling + boundaryLoss[p]) * step);
          state.density[p] = Math.max(0, Math.min(maximumDensity, rho + (maximumDensity - rho) * source));
          state.temperature[p] = Math.max(0, Math.min(sourceTemperature, heat + (sourceTemperature - heat) * source));
        }
    ticks++;
    if (sourceEnabled) sourceTicks++;
    revision++;
  }

  const tiles = Math.ceil(Math.sqrt(nz)),
    rows = Math.ceil(nz / tiles),
    atlasWidth = tiles * nx,
    atlasHeight = rows * ny,
    atlas = new Uint8Array(atlasWidth * atlasHeight * 4);
  function writeAtlas(out = atlas) {
    if (!(out instanceof Uint8Array) || out.length !== atlas.length) throw new RangeError("matching RGBA8 steam atlas required");
    for (let k = 0; k < nz; k++)
      for (let j = 0; j < ny; j++)
        for (let i = 0; i < nx; i++) {
          const p = index(i, j, k),
            a = ((Math.floor(k / tiles) * ny + j) * atlasWidth + (k % tiles) * nx + i) * 4;
          out[a] = Math.round((Math.max(0, Math.min(maximumDensity, state.density[p])) / maximumDensity) * 255);
          out[a + 1] = Math.round((Math.max(0, Math.min(sourceTemperature, state.temperature[p])) / sourceTemperature) * 255);
          out[a + 2] = 0;
          out[a + 3] = 255;
        }
    return out;
  }
  function advance(delta, { active = true, reduced = false, fieldTime, sourceEnabled = true } = {}) {
    if (prewarming || !active || reduced || !Number.isFinite(delta) || delta <= 0) return 0;
    const accepted = Math.min(delta, maxFrame);
    droppedTime += delta - accepted;
    pending += accepted;
    fieldEndTime = Number.isFinite(fieldTime) ? fieldTime : fieldEndTime + accepted;
    let advanced = 0;
    while (pending + 1e-10 >= step) {
      tick(fieldEndTime - pending + step * 0.5, sourceEnabled);
      pending = Math.max(0, pending - step);
      simulationTime += step;
      advanced++;
    }
    return advanced;
  }
  function warmCount(seconds) {
    if (!Number.isFinite(seconds) || seconds < 0 || seconds > 20) throw new RangeError("bounded 0–20 second prewarm required");
    if (ticks || pending || prewarming) throw new Error("prewarm is a one-time initialization");
    return Math.round(seconds / step);
  }
  return {
    state,
    get revision() {
      return revision;
    },
    domain: Object.freeze({ min, max, grid: [...grid], cell, center: [...center], radius, surfaceY }),
    atlas: Object.freeze({ data: atlas, width: atlasWidth, height: atlasHeight, tiles, rows, maximumDensity, sourceTemperature }),
    advance,
    prewarm(seconds = 6) {
      const warmTicks = warmCount(seconds);
      for (let i = 0; i < warmTicks; i++) tick((i - warmTicks + 0.5) * step, true);
      fieldEndTime = 0;
      writeAtlas();
      return warmTicks;
    },
    async prewarmAsync(seconds = 6, { yieldTask, shouldContinue = () => true } = {}) {
      if (typeof yieldTask !== "function" || typeof shouldContinue !== "function")
        throw new TypeError("caller-owned task yield and abort guard required");
      const warmTicks = warmCount(seconds);
      prewarming = true;
      try {
        for (let i = 0; i < warmTicks; i++) {
          if (!shouldContinue()) return false;
          tick((i - warmTicks + 0.5) * step, true);
          // A single tick per slice: callers choose their own scheduling and
          // disposal guard. The kernel owns no frame loop, timer or listener.
          if (i + 1 < warmTicks) await yieldTask();
        }
        if (!shouldContinue()) return false;
        fieldEndTime = 0;
        writeAtlas();
        return true;
      } finally {
        prewarming = false;
      }
    },
    writeAtlas,
    sample(point) {
      return { density: sample(state.density, ...point), temperature: sample(state.temperature, ...point) };
    },
    evidence() {
      let total = 0,
        heat = 0,
        maximum = 0,
        maximumHeat = 0,
        top = 0,
        finite = true;
      const centroid = [0, 0, 0];
      for (let k = 0; k < nz; k++)
        for (let j = 0; j < ny; j++)
          for (let i = 0; i < nx; i++) {
            const p = index(i, j, k),
              rho = state.density[p],
              temperature = state.temperature[p];
            total += rho;
            heat += temperature;
            maximum = Math.max(maximum, rho);
            maximumHeat = Math.max(maximumHeat, temperature);
            finite &&= Number.isFinite(rho) && Number.isFinite(temperature) && rho >= 0 && temperature >= 0;
            centroid[0] += rho * coordinates[0][i];
            centroid[1] += rho * coordinates[1][j];
            centroid[2] += rho * coordinates[2][k];
            if (j > ny * 0.82) top += rho;
          }
      return {
        method: "prescribed curl wind / temperature rise / RK2 semi-Lagrangian scalars / positive diffusion",
        grid: [...grid],
        cells: count,
        fixedStep: step,
        ticks,
        sourceTicks,
        simulationTime,
        fieldEndTime,
        pending,
        droppedTime,
        revision,
        prewarming,
        finite,
        maximumDensity: maximum,
        maximumTemperature: maximumHeat,
        meanDensity: total / count,
        meanTemperature: heat / count,
        densityIntegral: total * cell[0] * cell[1] * cell[2],
        centroid: centroid.map((x) => (total ? x / total : 0)),
        topFraction: total ? top / total : 0,
        maximumSpeed,
        diffusionWeight: weightSum,
        storageBytes:
          9 * count * 4 + (modeAxes.length * 2 + 1) * grid.reduce((a, b) => a + b, 0) * 8 + phaseSin.byteLength + phaseCos.byteLength + atlas.length,
        conservedMass: false,
        ownedFrameLoops: 0,
      };
    },
  };
}
