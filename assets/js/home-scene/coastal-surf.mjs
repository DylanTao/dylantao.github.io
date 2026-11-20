const G = 9.80665;
const DRY = 0.008;
const clamp = (value, lo, hi) => Math.max(lo, Math.min(value, hi));
const mix = (a, b, t) => a + (b - a) * t;
const smooth = (a, b, value) => {
  const t = clamp((value - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

export const COASTAL_SURF = Object.freeze({
  lanes: 58,
  cells: 60,
  offshore: -10.4,
  inland: 3.9,
  step: 1 / 84,
  uploadSeconds: 1 / 24,
  maximumSteps: 19,
});

export function insideCoastalTidePool(x, z, pools = []) {
  return pools.some(({ center, radii }) => ((x - center[0]) / (radii[0] + 0.06)) ** 2 + ((z - center[2]) / (radii[1] + 0.06)) ** 2 <= 1);
}

// The authored profiles are uniform along X. Sample both the visible contour
// and the 21 retained sand elevations at the same cross-shore position.
function profileAt(rows, x, z) {
  const index = clamp(((x - rows[0][0]) / (rows.at(-1)[0] - rows[0][0])) * (rows.length - 1), 0, rows.length - 1);
  const a = Math.min(rows.length - 2, Math.floor(index));
  const t = index - a;
  const read = (i) => mix(rows[a][i], rows[a + 1][i], t);
  const line = -read(3);
  if (z === undefined) return line;
  const fraction = (-z - read(1)) / read(2);
  const u = clamp(fraction * 20, 0, 20);
  const k = Math.min(19, Math.floor(u));
  return { height: mix(read(4 + k), read(5 + k), u - k), fraction };
}

function interfaceFlux(zL, hL, uL, zR, hR, uR, flux) {
  const sill = Math.max(zL, zR);
  const left = Math.max(0, zL + hL - sill);
  const right = Math.max(0, zR + hR - sill);
  const qL = left * uL;
  const qR = right * uR;
  const speed = Math.max(Math.abs(uL) + Math.sqrt(G * left), Math.abs(uR) + Math.sqrt(G * right));
  flux[0] = 0.5 * (qL + qR - speed * (right - left));
  const momentum = 0.5 * (qL * uL + qR * uR + 0.5 * G * (left * left + right * right) - speed * (qR - qL));
  // Hydrostatic reconstruction. Separate face corrections let the two
  // neighbours see the same water flux while a still sloping lake stays still.
  flux[1] = momentum + 0.5 * G * (hL * hL - left * left);
  flux[2] = momentum + 0.5 * G * (hR * hR - right * right);
}

export function createCoastalSurf({
  beach,
  seaLevel,
  pools = [],
  incoming,
  bedAt = () => null,
  lanes = COASTAL_SURF.lanes,
  cells = COASTAL_SURF.cells,
}) {
  const rows = beach.samples;
  const bounds = { minX: rows[0][0], maxX: rows.at(-1)[0], minS: COASTAL_SURF.offshore, maxS: COASTAL_SURF.inland };
  const ds = (bounds.maxS - bounds.minS) / (cells - 1);
  const dt = Math.min(COASTAL_SURF.step, ds * 0.068);
  const lines = new Float32Array(lanes);
  const depth = new Float32Array(lanes * cells);
  const discharge = new Float32Array(depth.length);
  const grades = new Float32Array(depth.length);
  const foam = new Float32Array(depth.length);
  const moisture = new Float32Array(depth.length);
  const closed = new Uint8Array(depth.length);
  const atlas = new Float32Array(depth.length * 4);
  const nextHeight = new Float32Array(cells);
  const nextFlow = new Float32Array(cells);
  const nextFoam = new Float32Array(cells);
  const speed = new Float32Array(cells);
  const flux = new Float64Array(3);
  let seconds = 0;
  let atlasSeconds = -Infinity;
  let updated = 0;
  let ready = false;
  const xAt = (col) => mix(bounds.minX, bounds.maxX, col / (lanes - 1));
  const zAt = (col, row) => lines[col] + bounds.minS + row * ds;

  function pack() {
    for (let i = 0; i < depth.length; i++) {
      atlas[i * 4] = depth[i] > 0.0005 ? grades[i] + depth[i] : Math.min(0, grades[i]);
      atlas[i * 4 + 1] = depth[i];
      atlas[i * 4 + 2] = foam[i];
      atlas[i * 4 + 3] = moisture[i];
    }
    atlasSeconds = seconds;
    updated++;
  }

  function evolve(now) {
    for (let col = 0; col < lanes; col++) {
      const offset = col * cells;
      for (let j = 0; j < cells; j++) {
        const i = offset + j;
        speed[j] = depth[i] > DRY ? clamp(discharge[i] / depth[i], -4.4, 4.4) : 0;
      }
      const offshoreBed = grades[offset];
      const stillDepth = Math.max(0.08, -offshoreBed);
      const tide = clamp(incoming(xAt(col), zAt(col, 0), now), -0.38, 0.38);
      const imposed = Math.max(0.008, stillDepth + tide);
      const incomingR = tide * Math.sqrt(G / stillDepth) + 2 * Math.sqrt(G * imposed);
      const outgoingR = speed[0] - 2 * Math.sqrt(G * depth[offset]);
      const waveSpeed = Math.max(0.05, (incomingR - outgoingR) / 4);
      interfaceFlux(offshoreBed, (waveSpeed * waveSpeed) / G, (incomingR + outgoingR) / 2, offshoreBed, depth[offset], speed[0], flux);
      let leftMass = flux[0],
        leftMomentum = flux[2];
      for (let j = 0; j < cells; j++) {
        const i = offset + j;
        if (j + 1 < cells) interfaceFlux(grades[i], depth[i], speed[j], grades[i + 1], depth[i + 1], speed[j + 1], flux);
        else interfaceFlux(grades[i], depth[i], speed[j], grades[i], depth[i], -speed[j], flux);
        const h = Math.max(0, depth[i] - (dt / ds) * (flux[0] - leftMass));
        const flow = discharge[i] - (dt / ds) * (flux[1] - leftMomentum);
        const friction = 1 + (dt * 0.025 * Math.abs(speed[j])) / Math.max(0.025, h) ** 1.35;
        nextHeight[j] = closed[i] ? 0 : h;
        nextFlow[j] = h > DRY && !closed[i] ? clamp(flow / friction, -4.4 * h, 4.4 * h) : 0;
        leftMass = flux[0];
        leftMomentum = flux[2];
      }
      for (let j = 0; j < cells; j++) {
        const i = offset + j;
        const h = nextHeight[j];
        const source = clamp(j - (speed[j] * dt) / ds, 0, cells - 1);
        const a = Math.min(cells - 2, Math.floor(source));
        const transported = mix(foam[offset + a], foam[offset + a + 1], source - a);
        const near = Math.min(cells - 1, j + 1);
        const behind = Math.max(0, j - 1);
        const compression = Math.max(0, speed[behind] - speed[near]);
        const bore = Math.max(0, nextHeight[behind] + grades[offset + behind] - (nextHeight[near] + grades[offset + near]));
        const breakStrength = smooth(0.14, 0.86, compression) * smooth(0.035, 0.19, bore) * (1 - smooth(0.72, 1.6, h));
        const washFront = smooth(0.01, 0.055, h) * (1 - smooth(0.075, 0.265, h)) * smooth(0.32, 1.05, speed[j]);
        const bubbles = Math.max(breakStrength, 0.54 * washFront);
        const life = h > DRY ? 1.5 : 3.35;
        nextFoam[j] = closed[i] ? 0 : clamp(transported * Math.exp(-dt / life) + dt * 5.2 * bubbles, 0, 1);
        moisture[i] = closed[i] ? 0 : Math.max(smooth(0.001, 0.035, h), moisture[i] * Math.exp(-dt / 7.8));
      }
      depth.set(nextHeight, offset);
      discharge.set(nextFlow, offset);
      foam.set(nextFoam, offset);
    }
  }

  function rebuild(now = 0, warm = 4.5) {
    for (let col = 0; col < lanes; col++) {
      const x = xAt(col);
      lines[col] = profileAt(rows, x);
      for (let j = 0; j < cells; j++) {
        const i = col * cells + j;
        const z = zAt(col, j);
        const profile = profileAt(rows, x, z);
        const measured = bedAt(x, z);
        const sand = profile.fraction > 1 ? (measured?.height ?? profile.height - (profile.fraction - 1) * 1.25) : profile.height;
        const rock = measured?.rock > 0.32 ? measured.height : -Infinity;
        closed[i] = insideCoastalTidePool(x, z, pools) ? 1 : 0;
        grades[i] = closed[i] ? 1.5 : clamp(Math.max(sand, rock) - seaLevel, -3.1, 2.5);
        depth[i] = Math.max(0, -grades[i]);
        discharge[i] = foam[i] = 0;
        moisture[i] = smooth(0.001, 0.035, depth[i]);
      }
    }
    seconds = now - Math.min(5, warm);
    while (seconds + dt <= now + 1e-9) {
      seconds += dt;
      evolve(seconds);
    }
    ready = true;
    pack();
  }

  function advance(now) {
    if (!ready || now <= seconds) return false;
    // An offscreen tab may leave a long hole in its clock. Keep a hard
    // stepping limit and align the boundary forcing to the active coast time.
    if (now - seconds > 0.3) seconds = now - COASTAL_SURF.maximumSteps * dt;
    let count = 0;
    while (seconds + dt <= now + 1e-9 && count++ < COASTAL_SURF.maximumSteps) {
      seconds += dt;
      evolve(seconds);
    }
    if (seconds - atlasSeconds < COASTAL_SURF.uploadSeconds - 1e-9) return false;
    pack();
    return true;
  }

  function sample(x, z) {
    if (!ready || x < bounds.minX || x > bounds.maxX) return null;
    const lane = ((x - bounds.minX) / (bounds.maxX - bounds.minX)) * (lanes - 1);
    const col = Math.min(lanes - 2, Math.floor(lane));
    const u = lane - col;
    const s = z - mix(lines[col], lines[col + 1], u);
    if (s < bounds.minS || s > bounds.maxS) return null;
    const row = (s - bounds.minS) / ds;
    const j = Math.min(cells - 2, Math.floor(row));
    const v = row - j;
    const k = (col * cells + j) * 4;
    const offset = cells * 4;
    const read = (c) => mix(mix(atlas[k + c], atlas[k + offset + c], u), mix(atlas[k + 4 + c], atlas[k + offset + 4 + c], u), v);
    const blend = smooth(bounds.minS, bounds.minS + 2.2, s) * smooth(0, 3.4, Math.min(x - bounds.minX, bounds.maxX - x));
    const h = read(1);
    return { y: seaLevel + read(0), depth: h, foam: read(2), moisture: read(3), blend, s };
  }

  return {
    lines,
    atlas,
    bounds,
    lanes,
    cells,
    rebuild,
    advance,
    sample,
    get ready() {
      return ready;
    },
    get seconds() {
      return atlasSeconds;
    },
    get uploads() {
      return updated;
    },
  };
}
