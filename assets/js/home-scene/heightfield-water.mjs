// Original closed-basin implementation of the staggered height/velocity
// equations in Chentanez & Mueller (SCA 2010), section 2.1. See ONSEN-WATER.md.
const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));

export function createHeightfieldWater({
  nx = 40,
  nz = 40,
  width = 1.72,
  length = width,
  radius = 0.86,
  depth = 0.24,
  density = 1000,
  gravity = 9.80665,
  damping = 0.55,
  tick = 1 / 120,
  cfl = 0.45,
  maxFrame = 0.25,
  obstacle = null,
} = {}) {
  if (!Number.isInteger(nx) || !Number.isInteger(nz) || nx < 8 || nz < 8 || nx > 64 || nz > 64)
    throw new RangeError("grid must be 8..64 cells per axis");
  for (const x of [width, length, depth, density, gravity, tick, cfl, maxFrame])
    if (!Number.isFinite(x) || x <= 0) throw new RangeError("positive finite fluid parameters required");
  if (
    width < 1 ||
    width > 8 ||
    length < 1 ||
    length > 8 ||
    depth < 0.02 ||
    depth > 1 ||
    gravity > 12 ||
    tick < 1 / 240 ||
    tick > 1 / 120 ||
    cfl < 0.25 ||
    cfl > 0.5 ||
    maxFrame > 0.25 ||
    !Number.isFinite(damping) ||
    damping < 0
  )
    throw new RangeError("fluid parameters exceed the bounded basin budget");
  if (radius !== null && (!Number.isFinite(radius) || radius < 2 * Math.max(width / nx, length / nz) || radius > Math.min(width, length) / 2))
    throw new RangeError("circle must fit the grid");
  const dx = width / nx,
    dz = length / nz,
    area = dx * dz,
    count = nx * nz,
    h = new Float64Array(count),
    wet = new Uint8Array(count),
    u = new Float64Array((nx + 1) * nz),
    v = new Float64Array(nx * (nz + 1)),
    openU = new Uint8Array(u.length),
    openV = new Uint8Array(v.length),
    nextU = new Float64Array(u.length),
    nextV = new Float64Array(v.length),
    fluxU = new Float64Array(u.length),
    fluxV = new Float64Array(v.length),
    outgoing = new Float64Array(count),
    limiter = new Float64Array(count),
    impulse = new Float64Array(count),
    contactRateU = new Float64Array(u.length),
    contactRateV = new Float64Array(v.length),
    contactTargetU = new Float64Array(u.length),
    contactTargetV = new Float64Array(v.length);
  let wetCount = 0,
    referenceMass = 0,
    accumulator = 0,
    simulationTime = 0,
    droppedTime = 0,
    steps = 0,
    maxSubsteps = 0,
    maxCourant = 0,
    limitedFluxes = 0,
    limitedVelocities = 0,
    currentObstacle = null,
    contactCount = 0,
    coupledFaces = 0,
    contactBoundU = 0,
    contactBoundV = 0,
    couplingSteps = 0,
    velocityChange = 0;
  const xAt = (i) => (i + 0.5) * dx - width / 2,
    zAt = (j) => (j + 0.5) * dz - length / 2;
  const mass = () => h.reduce((sum, value) => sum + value, 0) * area;

  function setObstacle(body, initial = false) {
    if (
      body !== null &&
      (!Number.isFinite(body.x) ||
        !Number.isFinite(body.z) ||
        !Number.isFinite(body.radius) ||
        body.radius <= 0 ||
        body.radius > Math.min(Math.min(width, length) * 0.2, radius === null ? Infinity : radius * 0.45))
    )
      throw new RangeError("invalid bounded obstacle");
    const total = initial ? 0 : mass(),
      average = wetCount ? total / (wetCount * area) : depth;
    let changed = initial;
    wetCount = 0;
    for (let j = 0; j < nz; j++)
      for (let i = 0; i < nx; i++) {
        const k = j * nx + i,
          x = xAt(i),
          z = zAt(j),
          active = (radius === null || x * x + z * z <= radius * radius) && (!body || (x - body.x) ** 2 + (z - body.z) ** 2 > body.radius ** 2);
        if (Boolean(wet[k]) !== active) changed = true;
        if (active) {
          if (!wet[k] || initial) h[k] = average;
          wetCount++;
        } else h[k] = 0;
        wet[k] = Number(active);
      }
    // The excluded body's volume goes to the remaining fluid, rather than
    // disappearing when the actor arrives. Removing it refills newly wet cells.
    if (!initial && changed) {
      const correction = (total - mass()) / (wetCount * area);
      for (let k = 0; k < count; k++) if (wet[k]) h[k] += correction;
    }
    for (let j = 0; j < nz; j++)
      for (let i = 0; i <= nx; i++) {
        const k = j * (nx + 1) + i;
        openU[k] = Number(i > 0 && i < nx && wet[j * nx + i - 1] && wet[j * nx + i]);
        if (!openU[k]) u[k] = 0;
      }
    for (let j = 0; j <= nz; j++)
      for (let i = 0; i < nx; i++) {
        const k = j * nx + i;
        openV[k] = Number(j > 0 && j < nz && wet[(j - 1) * nx + i] && wet[j * nx + i]);
        if (!openV[k]) v[k] = 0;
      }
    currentObstacle = body ? { ...body } : null;
    if (initial) referenceMass = mass();
    return changed;
  }
  setObstacle(obstacle, true);

  // A limited first-order backtrace replaces the paper's corrected MacCormack
  // advection. Convex interpolation cannot invent a new velocity extremum.
  function sample(field, columns, rows, gx, gz) {
    gx = clamp(gx, 0, columns - 1);
    gz = clamp(gz, 0, rows - 1);
    const i = Math.floor(gx),
      j = Math.floor(gz),
      ii = Math.min(i + 1, columns - 1),
      jj = Math.min(j + 1, rows - 1),
      fx = gx - i,
      fz = gz - j;
    return (
      (field[j * columns + i] * (1 - fx) + field[j * columns + ii] * fx) * (1 - fz) +
      (field[jj * columns + i] * (1 - fx) + field[jj * columns + ii] * fx) * fz
    );
  }

  function validateContacts(contacts) {
    if (!Array.isArray(contacts) || contacts.length > 2) throw new RangeError("at most two finite palm contacts required");
    for (const c of contacts)
      if (
        !c ||
        ![c.x, c.z, c.vx, c.vz, c.submergence, c.spread].every(Number.isFinite) ||
        c.submergence < 0 ||
        c.submergence > 0.2 ||
        c.spread < 2 * Math.max(dx, dz) ||
        c.spread > 0.25 ||
        Math.hypot(c.vx, c.vz) > 0.4
      )
        throw new RangeError("palm contact exceeds bounded speed, submergence or resolved spread");
  }

  // One-way prescribed solid-to-fluid drag, informed by Chentanez/Mueller
  // section 2.3.2. Gaussian contact proxies replace their triangle samples.
  // Only staggered velocities change: mass still flows through shared faces.
  function prepareContacts(contacts) {
    if (!contacts.length && !contactCount) return;
    contactRateU.fill(0);
    contactRateV.fill(0);
    contactTargetU.fill(0);
    contactTargetV.fill(0);
    contactCount = contacts.length;
    coupledFaces = 0;
    contactBoundU = contactBoundV = 0;
    for (const c of contacts) {
      const sigma2 = c.spread * c.spread,
        submersion = Math.min(1, c.submergence / 0.025),
        rate = 7 * submersion * Math.exp(-c.submergence / 0.18);
      if (rate === 0) continue;
      for (let j = 0; j < nz; j++)
        for (let i = 1; i < nx; i++) {
          const k = j * (nx + 1) + i,
            r2 = ((i * dx - width / 2 - c.x) ** 2 + (zAt(j) - c.z) ** 2) / sigma2;
          if (!openU[k] || r2 > 9) continue;
          const weight = rate * Math.exp(-r2 / 2);
          contactRateU[k] += weight;
          contactTargetU[k] += weight * c.vx;
        }
      for (let j = 1; j < nz; j++)
        for (let i = 0; i < nx; i++) {
          const k = j * nx + i,
            r2 = ((xAt(i) - c.x) ** 2 + (j * dz - length / 2 - c.z) ** 2) / sigma2;
          if (!openV[k] || r2 > 9) continue;
          const weight = rate * Math.exp(-r2 / 2);
          contactRateV[k] += weight;
          contactTargetV[k] += weight * c.vz;
        }
    }
    for (let k = 0; k < u.length; k++)
      if (contactRateU[k] > 0) {
        contactTargetU[k] /= contactRateU[k];
        contactBoundU = Math.max(contactBoundU, Math.abs(contactTargetU[k]));
        coupledFaces++;
      }
    for (let k = 0; k < v.length; k++)
      if (contactRateV[k] > 0) {
        contactTargetV[k] /= contactRateV[k];
        contactBoundV = Math.max(contactBoundV, Math.abs(contactTargetV[k]));
        coupledFaces++;
      }
  }

  const coupledSpeed = (speed, rate, target, dt) => {
    if (rate === 0) return speed;
    const change = (target - speed) * -Math.expm1(-rate * dt);
    velocityChange += Math.abs(change);
    return speed + change;
  };

  function integrate(dt) {
    const drag = Math.exp(-damping * dt);
    if (coupledFaces) couplingSteps++;
    for (let j = 0; j < nz; j++)
      for (let i = 0; i <= nx; i++) {
        const k = j * (nx + 1) + i;
        if (!openU[k]) {
          nextU[k] = fluxU[k] = 0;
          continue;
        }
        const cross = sample(v, nx, nz + 1, i - 0.5, j + 0.5),
          advected = sample(u, nx + 1, nz, i - (u[k] * dt) / dx, j - (cross * dt) / dz),
          pressure = (-gravity * (h[j * nx + i] - h[j * nx + i - 1]) * dt) / dx;
        const speed = coupledSpeed((advected + pressure) * drag, contactRateU[k], contactTargetU[k], dt);
        nextU[k] = clamp(speed, -2, 2);
        if (speed !== nextU[k]) limitedVelocities++;
        fluxU[k] = nextU[k] * h[j * nx + i - (nextU[k] > 0 ? 1 : 0)];
      }
    for (let j = 0; j <= nz; j++)
      for (let i = 0; i < nx; i++) {
        const k = j * nx + i;
        if (!openV[k]) {
          nextV[k] = fluxV[k] = 0;
          continue;
        }
        const cross = sample(u, nx + 1, nz, i + 0.5, j - 0.5),
          advected = sample(v, nx, nz + 1, i - (cross * dt) / dx, j - (v[k] * dt) / dz),
          pressure = (-gravity * (h[j * nx + i] - h[(j - 1) * nx + i]) * dt) / dz;
        const speed = coupledSpeed((advected + pressure) * drag, contactRateV[k], contactTargetV[k], dt);
        nextV[k] = clamp(speed, -2, 2);
        if (speed !== nextV[k]) limitedVelocities++;
        fluxV[k] = nextV[k] * h[(j - (nextV[k] > 0 ? 1 : 0)) * nx + i];
      }
    // Donor-cell draining limiter keeps depths positive without mass-changing
    // height clamps. Each shared face is still used with opposite signs.
    outgoing.fill(0);
    for (let j = 0; j < nz; j++)
      for (let i = 1; i < nx; i++) {
        const f = fluxU[j * (nx + 1) + i];
        outgoing[j * nx + i - (f > 0 ? 1 : 0)] += (Math.abs(f) * dt) / dx;
      }
    for (let j = 1; j < nz; j++)
      for (let i = 0; i < nx; i++) {
        const f = fluxV[j * nx + i];
        outgoing[(j - (f > 0 ? 1 : 0)) * nx + i] += (Math.abs(f) * dt) / dz;
      }
    for (let k = 0; k < count; k++) limiter[k] = outgoing[k] > 0 ? Math.min(1, Math.max(0, h[k] - 1e-8) / outgoing[k]) : 1;
    for (let j = 0; j < nz; j++)
      for (let i = 1; i < nx; i++) {
        const k = j * (nx + 1) + i,
          scale = limiter[j * nx + i - (fluxU[k] > 0 ? 1 : 0)];
        if (scale < 1 && fluxU[k] !== 0) limitedFluxes++;
        fluxU[k] *= scale;
      }
    for (let j = 1; j < nz; j++)
      for (let i = 0; i < nx; i++) {
        const k = j * nx + i,
          scale = limiter[(j - (fluxV[k] > 0 ? 1 : 0)) * nx + i];
        if (scale < 1 && fluxV[k] !== 0) limitedFluxes++;
        fluxV[k] *= scale;
      }
    for (let j = 0; j < nz; j++)
      for (let i = 0; i < nx; i++) {
        const k = j * nx + i;
        if (wet[k])
          h[k] -= (dt / dx) * (fluxU[j * (nx + 1) + i + 1] - fluxU[j * (nx + 1) + i]) + (dt / dz) * (fluxV[(j + 1) * nx + i] - fluxV[j * nx + i]);
      }
    u.set(nextU);
    v.set(nextV);
    steps++;
  }

  function advance(delta, { contacts = [] } = {}) {
    if (!Number.isFinite(delta) || delta < 0) throw new RangeError("finite nonnegative active delta required");
    validateContacts(contacts);
    const accepted = Math.min(delta, maxFrame);
    droppedTime += delta - accepted;
    accumulator += accepted;
    const ticks = Math.floor((accumulator + 1e-12) / tick);
    if (ticks > 0) prepareContacts(contacts);
    for (let t = 0; t < ticks; t++) {
      let maxH = depth,
        maxU = contactBoundU,
        maxV = contactBoundV;
      for (let k = 0; k < count; k++) maxH = Math.max(maxH, h[k]);
      for (const speed of u) maxU = Math.max(maxU, Math.abs(speed));
      for (const speed of v) maxV = Math.max(maxV, Math.abs(speed));
      const waveSpeed = Math.sqrt(gravity * maxH),
        rate = (maxU + waveSpeed) / dx + (maxV + waveSpeed) / dz,
        substeps = Math.max(1, Math.ceil((tick * rate) / cfl)),
        dt = tick / substeps;
      maxSubsteps = Math.max(maxSubsteps, substeps);
      maxCourant = Math.max(maxCourant, dt * rate);
      for (let s = 0; s < substeps; s++) integrate(dt);
      simulationTime += tick;
    }
    accumulator = Math.max(0, accumulator - ticks * tick);
    return ticks > 0;
  }

  function disturb({ x = 0, z = 0, amplitude = 0.008, spread = 0.12 } = {}) {
    if (
      ![x, z, amplitude, spread].every(Number.isFinite) ||
      spread < 2 * Math.max(dx, dz) ||
      spread > Math.min(width, length) / 2 ||
      Math.abs(amplitude) > 0.025
    )
      throw new RangeError("disturbance must be resolved and at most 25 mm");
    let sum = 0;
    for (let j = 0; j < nz; j++)
      for (let i = 0; i < nx; i++) {
        const k = j * nx + i,
          r2 = ((xAt(i) - x) ** 2 + (zAt(j) - z) ** 2) / (spread * spread);
        impulse[k] = wet[k] ? amplitude * (1 - r2 / 2) * Math.exp(-r2 / 2) : 0;
        sum += impulse[k];
      }
    const mean = sum / wetCount;
    let scale = 1;
    for (let k = 0; k < count; k++) if (wet[k] && impulse[k] < mean) scale = Math.min(scale, (h[k] - 1e-8) / (mean - impulse[k]));
    for (let k = 0; k < count; k++) if (wet[k]) h[k] += (impulse[k] - mean) * scale;
  }

  function evidence() {
    const average = mass() / (wetCount * area);
    let minimum = Infinity,
      maximum = -Infinity,
      potential = 0,
      kinetic = 0,
      boundarySpeed = 0,
      finite = true;
    for (let j = 0; j < nz; j++)
      for (let i = 0; i < nx; i++) {
        const k = j * nx + i;
        if (!wet[k]) continue;
        const ux = (u[j * (nx + 1) + i] + u[j * (nx + 1) + i + 1]) / 2,
          vz = (v[j * nx + i] + v[(j + 1) * nx + i]) / 2;
        minimum = Math.min(minimum, h[k]);
        maximum = Math.max(maximum, h[k]);
        potential += (density * gravity * (h[k] - average) ** 2 * area) / 2;
        kinetic += (density * h[k] * (ux * ux + vz * vz) * area) / 2;
        finite &&= Number.isFinite(h[k]);
      }
    for (let k = 0; k < u.length; k++) {
      finite &&= Number.isFinite(u[k]);
      if (!openU[k]) boundarySpeed = Math.max(boundarySpeed, Math.abs(u[k]));
    }
    for (let k = 0; k < v.length; k++) {
      finite &&= Number.isFinite(v[k]);
      if (!openV[k]) boundarySpeed = Math.max(boundarySpeed, Math.abs(v[k]));
    }
    return {
      nx,
      nz,
      dx,
      dz,
      wetCells: wetCount,
      density,
      volume: mass(),
      mass: mass() * density,
      relativeMassError: (mass() - referenceMass) / referenceMass,
      minimumDepth: minimum,
      maximumDepth: maximum,
      potential,
      kinetic,
      energy: potential + kinetic,
      finite,
      boundarySpeed,
      simulationTime,
      retainedTime: accumulator,
      droppedTime,
      steps,
      maxSubsteps,
      maxCourant,
      limitedFluxes,
      limitedVelocities,
      storageBytes: [
        h,
        wet,
        u,
        v,
        openU,
        openV,
        nextU,
        nextV,
        fluxU,
        fluxV,
        outgoing,
        limiter,
        impulse,
        contactRateU,
        contactRateV,
        contactTargetU,
        contactTargetV,
      ].reduce((sum, array) => sum + array.byteLength, 0),
      obstacle: currentObstacle,
      coupling: { method: "Gaussian submerged palm / exponential face drag", contactCount, coupledFaces, couplingSteps, velocityChange },
    };
  }

  function writeSurface(target = new Float32Array(count * 4)) {
    if (target.length !== count * 4) throw new RangeError("surface buffer size differs from the grid");
    for (let j = 0; j < nz; j++)
      for (let i = 0; i < nx; i++) {
        const k = j * nx + i,
          left = i > 0 && wet[k - 1] ? h[k - 1] : h[k],
          right = i + 1 < nx && wet[k + 1] ? h[k + 1] : h[k],
          back = j > 0 && wet[k - nx] ? h[k - nx] : h[k],
          front = j + 1 < nz && wet[k + nx] ? h[k + nx] : h[k];
        target[k * 4] = wet[k] ? h[k] - depth : 0;
        target[k * 4 + 1] = wet[k] ? (right - left) / (2 * dx) : 0;
        target[k * 4 + 2] = wet[k] ? (front - back) / (2 * dz) : 0;
        target[k * 4 + 3] = wet[k];
      }
    return target;
  }

  return {
    advance,
    disturb,
    setObstacle,
    evidence,
    writeSurface,
    grid: { nx, nz, width, length, radius, depth, dx, dz },
    state: { h, u, v, wet, openU, openV },
  };
}
