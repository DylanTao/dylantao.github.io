// While the 3D home loads, a pen sketch assembles in the empty scene (Sirui, 2026-10-14): strokes
// draw the sea, rise into the cliff, open into the cut-away house, settle into the room where
// Sirui is, and finally trace the first rendered frame before it fades in beneath them.
//
// Positions live in view units: v runs from -1 (top) to 1 (bottom) and u from the centre in the
// same units, so a sketch captured at one aspect lines up with three.js's fixed vertical field of
// view at any other. Each stroke flies on a damped-spring curve (zeta 0.68: a small, confident
// overshoot) along a slight arc, smears along its velocity while moving, and boils on twos once
// it lands, the way hand-drawn line work does.

export const SKETCH_RANGE = { u: 1.65, v: 1 };
const PI = Math.PI;
const SPRING_OMEGA = 7.2,
  SPRING_ZETA = 0.68,
  SPRING_DAMPED = SPRING_OMEGA * Math.sqrt(1 - SPRING_ZETA * SPRING_ZETA);

// Normalized step response of the underdamped spring: 0 at s = 0, a 5% overshoot near s = 0.6,
// within 1% of rest by s = 1.
export function springStep(s) {
  if (s <= 0) return 0;
  if (s >= 1.5) return 1;
  const decay = Math.exp(-SPRING_ZETA * SPRING_OMEGA * s);
  return 1 - decay * (Math.cos(SPRING_DAMPED * s) + ((SPRING_ZETA * SPRING_OMEGA) / SPRING_DAMPED) * Math.sin(SPRING_DAMPED * s));
}

export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Distance along a Hilbert curve over an order x order grid. Sorting both the strokes and their
// next targets by it pairs each stroke with a target in the same neighbourhood, so a morph flows
// instead of tangling.
export function hilbertIndex(x, y, order = 256) {
  let d = 0;
  for (let s = order >> 1; s > 0; s >>= 1) {
    const rx = (x & s) > 0 ? 1 : 0,
      ry = (y & s) > 0 ? 1 : 0;
    d += s * s * ((3 * rx) ^ ry);
    if (ry === 0) {
      if (rx === 1) {
        x = s - 1 - x;
        y = s - 1 - y;
      }
      [x, y] = [y, x];
    }
  }
  return d;
}

function hilbertKey(u, v) {
  const x = Math.max(0, Math.min(255, Math.floor(((u + 2) / 4) * 256))),
    y = Math.max(0, Math.min(255, Math.floor(((v + 1.25) / 2.5) * 256)));
  return hilbertIndex(x, y);
}

// Packed sketches: three bytes per stroke (u, v, direction modulo pi), dithered within a step on
// decode so strokes never sit on a visible grid.
export function decodeSketch(bytes, random = mulberry32(7)) {
  const count = Math.floor(bytes.length / 3),
    out = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const j = i * 3;
    out[j] = ((bytes[j] + random() - 0.5) / 255) * 2 * SKETCH_RANGE.u - SKETCH_RANGE.u;
    out[j + 1] = ((bytes[j + 1] + random() - 0.5) / 255) * 2 * SKETCH_RANGE.v - SKETCH_RANGE.v;
    out[j + 2] = (bytes[j + 2] / 256) * PI;
  }
  return out;
}

export function strokeBudget(width, height) {
  return Math.round(Math.min(1400, Math.max(480, (width * height) / 200)));
}

// Strokes along the strongest edges of a rendered frame: blurred luminance (plus a little blue
// minus red, so sea against sand registers), Sobel gradients thinned to their ridge, the top 40%
// kept, then picked by weighted sampling with a minimum spacing so detail never clumps.
export function frameStrokes(rgba, width, height, limit, random = mulberry32(11)) {
  const size = width * height,
    lum = new Float32Array(size),
    blur = new Float32Array(size);
  for (let i = 0, q = 0; i < size; i++, q += 4) {
    const alpha = rgba[q + 3] / 255;
    lum[i] = alpha * (0.299 * rgba[q] + 0.587 * rgba[q + 1] + 0.114 * rgba[q + 2] + 0.35 * (rgba[q + 2] - rgba[q]));
  }
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      blur[i] = (lum[x > 0 ? i - 1 : i] + 2 * lum[i] + lum[x < width - 1 ? i + 1 : i]) * 0.25;
    }
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      lum[i] = (blur[y > 0 ? i - width : i] + 2 * blur[i] + blur[y < height - 1 ? i + width : i]) * 0.25;
    }
  const magnitude = new Float32Array(size),
    angle = new Float32Array(size);
  let peak = 0;
  for (let y = 1; y < height - 1; y++)
    for (let x = 1; x < width - 1; x++) {
      const i = y * width + x;
      const gx = lum[i - width + 1] + 2 * lum[i + 1] + lum[i + width + 1] - lum[i - width - 1] - 2 * lum[i - 1] - lum[i + width - 1];
      const gy = lum[i + width - 1] + 2 * lum[i + width] + lum[i + width + 1] - lum[i - width - 1] - 2 * lum[i - width] - lum[i - width + 1];
      magnitude[i] = Math.hypot(gx, gy);
      angle[i] = Math.atan2(gy, gx);
      if (magnitude[i] > peak) peak = magnitude[i];
    }
  if (!(peak > 0)) return new Float32Array(0);
  const histogram = new Uint32Array(256),
    ridge = [],
    cx = width / 2,
    cy = height / 2;
  for (let y = 1; y < height - 1; y++)
    for (let x = 1; x < width - 1; x++) {
      const i = y * width + x,
        m = magnitude[i];
      if (!m || ((x - cx) / (0.47 * width)) ** 2 + ((y - cy) / (0.46 * height)) ** 2 > 1) continue;
      const sector = Math.round((((angle[i] + PI) % PI) / PI) * 4) % 4,
        step = sector === 0 ? 1 : sector === 1 ? width + 1 : sector === 2 ? width : width - 1;
      if (m < magnitude[i - step] || m < magnitude[i + step]) continue;
      ridge.push(i);
      histogram[Math.min(255, Math.floor((m / peak) * 255))]++;
    }
  let seen = 0,
    cut = 0;
  for (let bin = 0; bin < 256; bin++) {
    seen += histogram[bin];
    if (seen >= ridge.length * 0.6) {
      cut = (bin / 255) * peak;
      break;
    }
  }
  const candidates = ridge.filter((i) => magnitude[i] >= cut);
  // Efraimidis-Spirakis keys give a strength-weighted random order with one sort.
  const keyed = candidates.map((i) => [Math.pow(random(), 1 / Math.pow(magnitude[i] / peak, 1.5)), i]).sort((a, b) => b[0] - a[0]);
  const spacing = Math.min(6, Math.max(1.5, Math.sqrt(candidates.length / Math.max(1, limit)) * 1.25)),
    columns = Math.ceil(width / spacing) + 1,
    grid = new Map(),
    out = [];
  for (const [, i] of keyed) {
    if (out.length >= limit * 3) break;
    const x = i % width,
      y = (i / width) | 0,
      gx = Math.floor(x / spacing),
      gy = Math.floor(y / spacing);
    let clear = true;
    for (let oy = -1; oy <= 1 && clear; oy++)
      for (let ox = -1; ox <= 1 && clear; ox++)
        for (const [nx, ny] of grid.get((gy + oy) * columns + gx + ox) || [])
          if ((nx - x) ** 2 + (ny - y) ** 2 < spacing * spacing) {
            clear = false;
            break;
          }
    if (!clear) continue;
    const key = gy * columns + gx;
    if (!grid.has(key)) grid.set(key, []);
    grid.get(key).push([x, y]);
    out.push((x - cx) / cy, (y - cy) / cy, (((angle[i] + PI / 2) % PI) + PI) % PI);
  }
  return Float32Array.from(out);
}

// How each drawing arrives: "rise" lifts strokes from the sea upward; "open" spreads from the
// middle. Spread is the stagger across the drawing, in seconds.
const STAGES = {
  outside: { sweep: "rise", duration: 1.15, spread: 0.55 },
  overview: { sweep: "open", duration: 1.05, spread: 0.45 },
  room: { sweep: "open", duration: 0.95, spread: 0.35 },
  frame: { sweep: "open", duration: 0.5, spread: 0.12 },
};

// Once a drawing has landed and the next has not come, the line work breathes: a slow swell about
// the middle of the view whose depth eases in, then decays toward a quiet floor, so a long wait
// for the first frame reads as the house resting rather than as a stall. A breath that is cut
// short (the next drawing, or the hand-off to the render) runs out over CARRY seconds instead of
// jumping (Sirui, 2026-10-15).
export const BREATH = { period: 4.2, depth: 0.022, floor: 0.25, decay: 7, ease: 1.4, carry: 0.45 };

export function breathDepth(seconds) {
  if (!(seconds > 0)) return 0;
  const e = Math.min(1, seconds / BREATH.ease),
    ease = e * e * (3 - 2 * e);
  return BREATH.depth * ease * (BREATH.floor + (1 - BREATH.floor) * Math.exp(-seconds / BREATH.decay));
}

function withAlpha(color, alpha) {
  const hex = /^#([\da-f]{6})$/i.exec(color.trim());
  if (!hex) return color;
  const n = parseInt(hex[1], 16);
  return `rgba(${n >> 16}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}

export function createSketchEngine(context, options = {}) {
  let width = options.width || 300,
    height = options.height || 150,
    ratio = options.dpr || 1,
    ink = options.ink || "#2c3533",
    accent = options.accent || "#c46a2c";
  const reduced = Boolean(options.reduced),
    random = mulberry32(options.seed || 20261014),
    count = strokeBudget(width, height),
    daylight = options.daylight ?? 0.55;
  const fields = ["x", "y", "px", "py", "x0", "y0", "tx", "ty", "ta", "delay", "duration", "arc", "born", "jitter", "key"];
  const p = Object.fromEntries(fields.map((name) => [name, new Float32Array(count)]));
  let stage = "sea",
    stageAt = 0,
    started = null,
    lastTime = null,
    step = 1 / 60,
    pending = null,
    finishing = null,
    previousTargets = null,
    settledAt = Infinity,
    lastBoil = -1,
    breathFrom = Infinity,
    carryValue = 0,
    carryAt = -Infinity,
    washCarry = 0,
    swell = 0;

  // The breath's offset (a fractional scale about the middle of the view) at a moment.
  function breathAt(now) {
    if (reduced) return 0;
    const carry = carryValue * Math.max(0, 1 - (now - carryAt) / BREATH.carry);
    if (now < breathFrom) return carry;
    const t = now - breathFrom;
    return carry + breathDepth(t) * Math.sin((2 * PI * t) / BREATH.period);
  }

  // How far the warm wash under a resting drawing has bloomed (0 to 1); it fades over 0.6 s
  // when the drawing moves on.
  function restingAt(now) {
    if (now >= breathFrom) return Math.min(1, (now - breathFrom) / 2.5);
    return washCarry * Math.max(0, 1 - (now - carryAt) / 0.6);
  }

  // The opening sea: a straight horizon, five swells that grow and slow toward the viewer, and
  // the sun (or a crescent moon) where the visitor's own sky has it. Nearer swells carry more
  // strokes, spaced evenly along each line with a little jitter.
  const lineOf = new Uint8Array(count),
    alongOf = new Float32Array(count),
    sun = new Uint8Array(count);
  const sunShare = Math.round(count * 0.07),
    lineShares = [0.1, 0.06, 0.12, 0.18, 0.23, 0.24],
    totals = lineShares.map((share) => Math.round(share * (count - sunShare)));
  totals[5] = count - sunShare - totals.slice(0, 5).reduce((a, b) => a + b, 0);
  for (let i = 0, line = 0, within = 0; i < count; i++) {
    p.jitter[i] = random();
    if (i < sunShare) {
      sun[i] = 1;
      alongOf[i] = i / sunShare;
      continue;
    }
    while (within >= totals[line]) {
      line++;
      within = 0;
    }
    lineOf[i] = line;
    alongOf[i] = (within + 0.5 + (random() - 0.5) * 0.7) / totals[line];
    within++;
  }

  const aspect = () => width / height;

  // Daylight is the fraction of the day's light already gone (sunrise 0, sunset 1); null is night.
  function sky() {
    const span = aspect();
    if (daylight === null) return { u: 0.42 * span, v: -0.5 };
    return { u: (daylight * 2 - 1) * 0.8 * span, v: -0.14 - 0.4 * Math.sin(PI * daylight) };
  }

  function seaTarget(i, t, out) {
    if (sun[i]) {
      const r = 0.085,
        { u: su, v: sv } = sky();
      if (daylight === null) {
        // A crescent: most of the outer circle, closed by a tighter offset arc.
        const inner = alongOf[i] > 0.62,
          theta = inner ? PI * 0.62 + ((alongOf[i] - 0.62) / 0.38) * PI * 0.76 : PI * 0.28 + (alongOf[i] / 0.62) * PI * 1.44,
          radius = inner ? r * 0.86 : r,
          shift = inner ? r * 0.38 : 0;
        out[0] = su + shift + Math.cos(theta) * radius;
        out[1] = sv + Math.sin(theta) * radius;
        out[2] = theta + PI / 2;
      } else {
        const theta = alongOf[i] * 2 * PI;
        out[0] = su + Math.cos(theta) * r;
        out[1] = sv + Math.sin(theta) * r;
        out[2] = theta + PI / 2;
      }
      return out;
    }
    const line = lineOf[i],
      u = (alongOf[i] * 2 - 1) * aspect() * 1.06;
    if (line === 0) {
      out[0] = u;
      out[1] = -0.06;
      out[2] = 0;
      return out;
    }
    const depth = line / 5,
      base = -0.02 + 0.82 * Math.pow(depth, 1.35),
      amplitude = 0.008 + 0.055 * depth * depth,
      wavenumber = 10 - 6.5 * depth,
      phase = u * wavenumber + line * 1.7 - t * (0.55 + 0.6 * depth);
    out[0] = u;
    out[1] = base + amplitude * Math.sin(phase);
    out[2] = Math.atan(amplitude * wavenumber * Math.cos(phase));
    return out;
  }

  const scratch = [0, 0, 0];
  // The sea draws itself in from the left along each line; the sun follows.
  for (let i = 0; i < count; i++) {
    seaTarget(i, 0, scratch);
    p.x[i] = p.px[i] = p.x0[i] = p.tx[i] = scratch[0];
    p.y[i] = p.py[i] = p.y0[i] = p.ty[i] = scratch[1];
    p.ta[i] = scratch[2];
    p.born[i] = reduced ? -1 : sun[i] ? 0.55 + alongOf[i] * 0.6 : alongOf[i] * 0.85 + lineOf[i] * 0.05 + p.jitter[i] * 0.1;
    p.duration[i] = 1;
  }

  function assign(targets, kind, now) {
    const settings = STAGES[kind],
      available = Math.floor(targets.length / 3);
    if (!available) return;
    previousTargets = kind === "frame" ? previousTargets : targets;
    for (let i = 0; i < count; i++) p.key[i] = hilbertKey(p.x[i], p.y[i]);
    const strokes = Array.from({ length: count }, (_, i) => i).sort((a, b) => p.key[a] - p.key[b]);
    const picks = Array.from({ length: count }, (_, k) => (k < available ? k : Math.floor(random() * available)));
    const pickKeys = new Float32Array(available);
    for (let k = 0; k < available; k++) pickKeys[k] = hilbertKey(targets[k * 3], targets[k * 3 + 1]);
    picks.sort((a, b) => pickKeys[a] - pickKeys[b]);
    const reach = aspect();
    for (let k = 0; k < count; k++) {
      const i = strokes[k],
        t = picks[k] * 3,
        repeat = picks[k] !== k && k >= available;
      p.x0[i] = p.x[i];
      p.y0[i] = p.y[i];
      p.tx[i] = targets[t] + (repeat ? (random() - 0.5) * 0.012 : 0);
      p.ty[i] = targets[t + 1] + (repeat ? (random() - 0.5) * 0.012 : 0);
      p.ta[i] = targets[t + 2];
      const radial = Math.min(1, Math.hypot(p.tx[i] / reach, p.ty[i]) / 1.2),
        order = settings.sweep === "rise" ? (1 - p.ty[i]) / 2 : radial;
      p.delay[i] = now + order * settings.spread + p.jitter[i] * 0.12;
      p.duration[i] = settings.duration * (0.85 + 0.3 * random());
      p.arc[i] = (random() - 0.5) * 0.55;
      if (p.born[i] > now) p.born[i] = now;
    }
    // Whatever breath was under way runs out smoothly; a new drawing breathes once it has landed,
    // and the first frame's drawing holds still so its strokes meet the render's edges.
    carryValue = breathAt(now);
    washCarry = restingAt(now);
    carryAt = now;
    stage = kind;
    stageAt = now;
    settledAt = now + settings.spread + 0.12 + settings.duration * 1.15;
    breathFrom = kind === "frame" ? Infinity : settledAt;
  }

  function place(now) {
    // While breathing, the boil slows to four drawings a second, so the rest reads calm.
    const breath = breathAt(now),
      boil = reduced ? 0 : Math.floor(now * (now >= breathFrom ? 4 : 8)),
      scale = 1 + breath;
    swell = breath / BREATH.depth;
    for (let i = 0; i < count; i++) {
      p.px[i] = p.x[i];
      p.py[i] = p.y[i];
      if (stage === "sea") {
        seaTarget(i, reduced ? 0 : now, scratch);
        p.x[i] = scratch[0];
        p.y[i] = scratch[1];
        p.ta[i] = scratch[2];
        continue;
      }
      const s = reduced ? 2 : (now - p.delay[i]) / p.duration[i],
        e = springStep(s),
        dx = p.tx[i] - p.x0[i],
        dy = p.ty[i] - p.y0[i],
        bend = p.arc[i] * Math.sin(PI * Math.min(1, Math.max(0, e)));
      let x = p.x0[i] + dx * e - dy * bend,
        y = p.y0[i] + dy * e + dx * bend;
      if (boil && s > 1) {
        // Line boil on twos: a fresh hand-drawn wobble eight times a second.
        const h = Math.sin((boil + 1) * 12.9898 + i * 78.233) * 43758.5453,
          wobble = h - Math.floor(h);
        x += (wobble - 0.5) * 0.004;
        y += (((wobble * 7.31) % 1) - 0.5) * 0.004;
      }
      p.x[i] = x * scale;
      p.y[i] = y * scale;
    }
  }

  function draw(now) {
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.clearRect(0, 0, context.canvas.width, context.canvas.height);
    const half = (height * ratio) / 2,
      middle = (width * ratio) / 2,
      base = 0.028 * half,
      buckets = [[], [], [], []],
      warm = [];
    // A warm wash blooms under the resting drawing, the light of the room before the render brings
    // its colour, and breathes with it.
    const resting = reduced ? 0 : restingAt(now);
    if (!reduced && resting > 0.003 && typeof context.createRadialGradient === "function") {
      const wash = context.createRadialGradient(middle, half * 1.06, 0, middle, half * 1.06, half * 1.15);
      wash.addColorStop(0, withAlpha(accent, 1));
      wash.addColorStop(0.55, withAlpha(accent, 0.45));
      wash.addColorStop(1, withAlpha(accent, 0));
      context.globalAlpha = 0.085 * resting * resting * (1 + 0.3 * swell);
      context.fillStyle = wash;
      context.fillRect(0, 0, context.canvas.width, context.canvas.height);
      context.globalAlpha = 1;
    }
    for (let i = 0; i < count; i++) {
      const life = reduced ? 1 : Math.min(1, Math.max(0, (now - p.born[i]) / 0.35));
      if (life <= 0) continue;
      const vx = (p.x[i] - p.px[i]) / step,
        vy = (p.y[i] - p.py[i]) / step,
        smear = reduced ? 0 : Math.min(1, Math.hypot(vx, vy) * 1.4);
      // Directions blend in doubled-angle space: a stroke and its reverse are the same mark.
      let angle = p.ta[i];
      if (smear > 0.02) {
        const travel = 2 * Math.atan2(vy, vx);
        angle =
          Math.atan2((1 - smear) * Math.sin(2 * angle) + smear * Math.sin(travel), (1 - smear) * Math.cos(2 * angle) + smear * Math.cos(travel)) / 2;
      }
      // A stroke that has just landed is pressed in: longer and fully inked for a moment.
      const landed = stage === "sea" || reduced ? 0 : (now - p.delay[i]) / p.duration[i] - 1,
        press = landed >= 0 && landed < 1.5 ? Math.exp((-landed * p.duration[i]) / 0.16) : 0;
      const length = base * (0.75 + 0.5 * p.jitter[i]) * (1 + 1.8 * smear) * (1 + 0.5 * press),
        ex = (Math.cos(angle) * length) / 2,
        ey = (Math.sin(angle) * length) / 2,
        x = middle + p.x[i] * half,
        y = half + p.y[i] * half;
      (stage === "sea" && sun[i] ? warm : buckets[press > 0.35 ? 3 : Math.min(3, Math.floor(life * 4))]).push(x - ex, y - ey, x + ex, y + ey);
    }
    context.lineCap = "round";
    context.lineWidth = Math.max(1, 1.15 * ratio * (1 + 0.1 * swell));
    const strokes = (segments, color, alpha) => {
      if (!segments.length) return;
      context.strokeStyle = color;
      context.globalAlpha = alpha;
      context.beginPath();
      for (let j = 0; j < segments.length; j += 4) {
        context.moveTo(segments[j], segments[j + 1]);
        context.lineTo(segments[j + 2], segments[j + 3]);
      }
      context.stroke();
    };
    buckets.forEach((segments, k) => strokes(segments, ink, Math.min(1, ((0.78 * (k + 1)) / 4) * (1 + 0.07 * swell))));
    strokes(warm, accent, 0.85);
    context.globalAlpha = 1;
  }

  return {
    count,
    get stage() {
      return stage;
    },
    get settled() {
      return stage === "frame" && lastTime !== null && lastTime >= settledAt;
    },
    resize(nextWidth, nextHeight, nextRatio) {
      width = nextWidth;
      height = nextHeight;
      ratio = nextRatio || ratio;
    },
    colors(nextInk, nextAccent) {
      ink = nextInk || ink;
      accent = nextAccent || accent;
    },
    // A drawing that arrives while the last one has barely begun waits for it (0.45 s; 0.9 s for
    // the opening sea), keeping only the latest request, so a fast load still reads as a sequence.
    morph(kind, targets) {
      pending = { kind, targets };
    },
    // The first frame's own edges; too few (a blank capture) and the last drawing stands in.
    finish(targets) {
      finishing = targets && targets.length >= 300 ? targets : previousTargets || targets;
    },
    // Advance and draw; returns whether another frame is needed. Settled line work only redraws
    // when the boil steps, eight times a second.
    tick(milliseconds) {
      if (started === null) started = milliseconds;
      const now = (milliseconds - started) / 1000;
      step = lastTime === null ? 1 / 60 : Math.min(1 / 20, Math.max(1 / 240, now - lastTime));
      const dwell = reduced ? 0 : stage === "sea" ? 0.9 : 0.45;
      if (pending && now - stageAt >= dwell && (stage !== "sea" || now >= dwell)) {
        assign(pending.targets, pending.kind, now);
        pending = null;
      } else if (finishing && !pending && now - stageAt >= Math.min(dwell, 0.3)) {
        if (finishing) assign(finishing, "frame", now);
        finishing = null;
      }
      // A breathing drawing moves every frame; settled line work otherwise redraws only on the boil.
      const breathing = !reduced && (now >= breathFrom || now - carryAt < 0.6),
        moving = stage === "sea" || now < settledAt + 0.1 || breathing,
        boil = Math.floor(now * 8);
      if (reduced || moving || boil !== lastBoil) {
        place(now);
        draw(now);
        lastBoil = boil;
      }
      lastTime = now;
      return !reduced || Boolean(pending || finishing);
    },
  };
}
