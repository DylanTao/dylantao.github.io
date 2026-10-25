// While the 3D home loads, a pen draws it (Sirui, 2026-10-14, 2026-10-25): first the coast view, its
// cliff and the arched house, as the shell and the coast stream in; then the room the visitor will
// arrive in, structure first and the books last, as the rooms, Sirui and the view's programs load.
// The lines are the scene's own outlines, silhouettes and creases, traced by
// bin/build_loading_sketch.cjs. Ink is gated by honest progress: the pen never runs ahead of the
// work it reports, and while the work stalls it only rests and breathes.
//
// Positions live in view units: v runs from -1 (top) to 1 (bottom) and u from the centre in the
// same units, so a drawing traced at one aspect lines up with three.js's fixed vertical field of
// view at any other.

export const SKETCH_RANGE = { u: 1.65, v: 1 };
const PI = Math.PI;

// The pen: at its slowest it would draw a whole drawing in `whole` seconds; it closes a jump in
// progress over about `catchUp` seconds, rests `lift` seconds before lifting, hands the coast
// drawing over once the room drawing's work allows `handover` of it, dives for `dive` seconds and,
// once the first frame is drawn, completes whatever is left within `settle` seconds.
export const PEN = { whole: 9, catchUp: 0.5, lift: 0.7, handover: 0.12, dive: 1.1, settle: 0.45 };

// Line weight and ink by the generator's weight class: 3 for the structure's outlines, 2 for other
// outlines and silhouettes, 1 for creases, 0 for fine detail.
const WIDTH = [0.6, 0.8, 1.05, 1.4],
  ALPHA = [0.5, 0.62, 0.8, 0.92];

// Once the pen rests, the drawing breathes: a slow swell about the middle of the view whose depth
// eases in, then decays toward a quiet floor, so a long wait reads as the house resting rather than
// as a stall. A breath cut short runs out over CARRY seconds instead of jumping (Sirui, 2026-10-15).
export const BREATH = { period: 4.2, depth: 0.018, floor: 0.25, decay: 7, ease: 1.4, carry: 0.45 };

export function breathDepth(seconds) {
  if (!(seconds > 0)) return 0;
  const e = Math.min(1, seconds / BREATH.ease),
    ease = e * e * (3 - 2 * e);
  return BREATH.depth * ease * (BREATH.floor + (1 - BREATH.floor) * Math.exp(-seconds / BREATH.decay));
}

// Reaching a stage proves the work before it finished. With the controller's per-segment fills
// (house, coast, room, sirui, view) these are only a floor; without them, only completed stages
// count. "first-frame" proves the lighting, which no segment measures, so the view's own layers
// still wait for its programs.
const STAGE_FILLS = {
  home: {},
  coast: { house: 1 },
  room: { house: 1, coast: 1 },
  lighting: { house: 1, coast: 1, room: 1, sirui: 1 },
  "first-frame": { house: 1, coast: 1, room: 1, sirui: 1 },
  ready: { house: 1, coast: 1, room: 1, sirui: 1, view: 1 },
};
export function stageFills(stage) {
  return STAGE_FILLS[stage] || null;
}

// A drawing's plan (loading-sketch.json "plan"): groups of consecutive layers in pen order, each
// gated by the loading segment that brings it, as "house:shell,stairs coast:cliff,sea".
export function parsePlan(text = "") {
  let from = 0;
  return text
    .split(/\s+/)
    .filter(Boolean)
    .map((group) => {
      const [segment, layers = ""] = group.split(":"),
        count = layers.split(",").filter(Boolean).length;
      const entry = { segment, from, to: from + count };
      from += count;
      return entry;
    });
}

// The ink finished work allows: whole groups whose segment is complete, then the first incomplete
// group as far as its segment has come, and nothing after it. The pen never runs ahead.
export function allowedInk(drawing, plan, fills = {}) {
  if (!plan?.length) return 0;
  let ink = 0;
  for (const group of plan) {
    let groupInk = 0;
    for (let layer = group.from; layer < group.to; layer++) groupInk += drawing.layerInk[layer] || 0;
    const fill = Math.max(0, Math.min(1, Number(fills[group.segment]) || 0));
    ink += fill * groupInk;
    if (fill < 1) break;
  }
  return Math.min(drawing.ink, ink);
}

// Packed drawings (bin/build_loading_sketch.cjs): per stroke a header byte (layer << 4, weight << 2,
// kind), a varint point count, the first point as two little-endian 16-bit grid cells, then
// zigzag-varint deltas. Points come back in view units, with each stroke's cumulative length.
export function decodeDrawing(bytes, grid = 4096, range = SKETCH_RANGE) {
  const strokes = [],
    layerInk = new Float64Array(16);
  let at = 0,
    ink = 0;
  const varint = () => {
    let value = 0,
      shift = 0,
      byte;
    do {
      byte = bytes[at++];
      value += (byte & 127) * 2 ** shift;
      shift += 7;
    } while (byte & 128 && at < bytes.length);
    return value;
  };
  const unzig = (n) => (n % 2 ? -(n + 1) / 2 : n / 2);
  const su = (2 * range.u) / (grid - 1),
    sv = (2 * range.v) / (grid - 1);
  while (at + 5 < bytes.length) {
    const head = bytes[at++],
      count = varint();
    let x = bytes[at] | (bytes[at + 1] << 8),
      y = bytes[at + 2] | (bytes[at + 3] << 8);
    at += 4;
    const points = new Float32Array(count * 2),
      lengths = new Float32Array(count);
    points[0] = x * su - range.u;
    points[1] = y * sv - range.v;
    for (let k = 1; k < count; k++) {
      x += unzig(varint());
      y += unzig(varint());
      points[k * 2] = x * su - range.u;
      points[k * 2 + 1] = y * sv - range.v;
      lengths[k] = lengths[k - 1] + Math.hypot(points[k * 2] - points[k * 2 - 2], points[k * 2 + 1] - points[k * 2 - 1]);
    }
    const length = lengths[count - 1];
    strokes.push({ layer: head >> 4, weight: (head >> 2) & 3, kind: head & 3, points, lengths, length, start: ink });
    layerInk[head >> 4] += length;
    ink += length;
  }
  return { strokes, ink, layerInk };
}

function withAlpha(color, alpha) {
  const hex = /^#([\da-f]{6})$/i.exec(color.trim());
  if (!hex) return color;
  const n = parseInt(hex[1], 16);
  return `rgba(${n >> 16}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}

function defaultLayer(width, height) {
  if (typeof OffscreenCanvas === "function") return new OffscreenCanvas(Math.max(1, width), Math.max(1, height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, width);
  canvas.height = Math.max(1, height);
  return canvas;
}

export function createSketchEngine(context, options = {}) {
  let width = options.width || 300,
    height = options.height || 150,
    ratio = options.dpr || 1,
    ink = options.ink || "#2c3533",
    accent = options.accent || "#c46a2c";
  const reduced = Boolean(options.reduced),
    makeLayer = options.layer || defaultLayer,
    // The share of today's daylight already gone (sunrise 0, sunset 1), null at night, or
    // undefined for no opening mark.
    daylight = options.daylight,
    drawings = new Map();
  let focus = options.focus || {};
  let fills = {},
    stageName = "home",
    room = null,
    current = null,
    outgoing = null,
    finishing = null,
    started = null,
    lastTime = null,
    restingSince = Infinity,
    lastInkAt = 0,
    carryValue = 0,
    carryAt = -Infinity,
    settledAt = Infinity,
    lastDrawn = null,
    dirty = true;

  function merge(next) {
    const merged = { ...fills };
    for (const [key, value] of Object.entries(next || {})) if (Number.isFinite(value)) merged[key] = Math.max(merged[key] || 0, Math.min(1, value));
    fills = merged;
  }
  const pixels = () => ({ w: Math.max(1, Math.round(width * ratio)), h: Math.max(1, Math.round(height * ratio)) });
  // Strokes shorter than this on screen only blur at small sizes; the drawing keeps its long lines.
  const minimum = () => 3.5 / Math.max(1, (height * ratio) / 2);

  function open(id, now) {
    const drawing = drawings.get(id);
    if (!drawing) return null;
    const { w, h } = pixels(),
      layer = makeLayer(w, h);
    return { id, drawing, layer, context: layer.getContext("2d"), drawn: 0, index: 0, started: now, shortest: minimum(), budget: 0 };
  }

  // The share of a drawing that finished work allows.
  const shareOf = (drawing) => (drawing?.ink ? allowedInk(drawing, drawing.plan, fills) / drawing.ink : 0);
  function allowance() {
    return current ? shareOf(current.drawing) : 0;
  }

  function strokePath(target, stroke, until, scale, middle, half) {
    const { points, lengths } = stroke;
    target.moveTo(middle + points[0] * half * scale, half + points[1] * half * scale);
    for (let k = 1; k < lengths.length; k++) {
      if (lengths[k] <= until) {
        target.lineTo(middle + points[k * 2] * half * scale, half + points[k * 2 + 1] * half * scale);
        continue;
      }
      const t = (until - lengths[k - 1]) / Math.max(1e-9, lengths[k] - lengths[k - 1]),
        x = points[k * 2 - 2] + (points[k * 2] - points[k * 2 - 2]) * t,
        y = points[k * 2 - 1] + (points[k * 2 + 1] - points[k * 2 - 1]) * t;
      target.lineTo(middle + x * half * scale, half + y * half * scale);
      return [x, y];
    }
    return [points.at(-2), points.at(-1)];
  }

  function styleFor(target, stroke) {
    target.lineWidth = Math.max(0.6, WIDTH[stroke.weight] * ratio);
    target.globalAlpha = ALPHA[stroke.weight];
    target.strokeStyle = ink;
  }

  // Commit every stroke the pen has finished into the drawing's layer, once.
  function commit(view) {
    const { w, h } = pixels(),
      half = h / 2,
      middle = w / 2,
      strokes = view.drawing.strokes,
      target = view.context;
    target.lineCap = "round";
    target.lineJoin = "round";
    while (view.index < strokes.length && strokes[view.index].start + strokes[view.index].length <= view.drawn) {
      const stroke = strokes[view.index++];
      if (stroke.length < view.shortest) continue;
      styleFor(target, stroke);
      target.beginPath();
      strokePath(target, stroke, Infinity, 1, middle, half);
      target.stroke();
    }
    target.globalAlpha = 1;
  }

  function redraw(view) {
    if (!view) return;
    const { w, h } = pixels();
    view.layer.width = w;
    view.layer.height = h;
    view.context = view.layer.getContext("2d");
    view.index = 0;
    view.shortest = minimum();
    commit(view);
  }

  function breathAt(now) {
    if (reduced) return 0;
    const carry = carryValue * Math.max(0, 1 - (now - carryAt) / BREATH.carry);
    if (now < restingSince) return carry;
    const t = now - restingSince;
    return carry + breathDepth(t) * Math.sin((2 * PI * t) / BREATH.period);
  }

  function wake(now) {
    if (now >= restingSince) {
      carryValue = breathAt(now);
      carryAt = now;
    }
    restingSince = Infinity;
  }

  // Move into the room drawing once its work has begun: the coast drawing dives toward the room
  // and fades while the pen starts on the room's structure.
  function maybeHandover(now) {
    if (!room || !drawings.has(room) || (current && current.id === room)) return;
    const late = stageName === "lighting" || stageName === "first-frame" || stageName === "ready" || finishing !== null,
      ready = late || shareOf(drawings.get(room)) >= PEN.handover;
    if (!ready || !current || current.id !== "outside") {
      if (!current) current = open(room, now);
      return;
    }
    // The coast drawing leaves with everything its finished work allows, never more.
    current.drawn = Math.max(current.drawn, allowance() * current.drawing.ink);
    commit(current);
    outgoing = reduced ? null : { view: current, at: now, focus: focus[room] || { u: 0, v: 0 } };
    current = open(room, now);
    wake(now);
    dirty = true;
  }

  function advance(now, dt) {
    if (!current && drawings.has("outside")) current = open("outside", now);
    maybeHandover(now);
    if (!current) return false;
    const total = current.drawing.ink,
      limit = (finishing !== null ? 1 : allowance()) * total;
    const before = current.drawn;
    if (reduced) current.drawn = Math.max(current.drawn, limit);
    else if (current.drawn < limit) {
      const deficit = limit - current.drawn,
        hurry = finishing !== null ? deficit / Math.max(0.05, PEN.settle - (now - finishing)) : 0;
      current.drawn = Math.min(limit, current.drawn + Math.max(total / PEN.whole, deficit / PEN.catchUp, hurry) * dt);
    }
    if (current.drawn > before) {
      lastInkAt = now;
      wake(now);
      commit(current);
      dirty = true;
    } else if (restingSince === Infinity && now - lastInkAt > PEN.lift) restingSince = now;
    if (finishing !== null && current.drawn >= total && settledAt === Infinity) settledAt = now;
    return current.drawn > before;
  }

  // The opening mark, kept from the first sketch (Sirui, 2026-10-14): the sun where San Diego's
  // sky has it, or a crescent moon at night, drawn in amber in the coast drawing's sky as the pen
  // starts. It is a flourish, not progress, so it is never counted as ink.
  function opening(now, middle, half) {
    if (daylight === undefined) return;
    const e = reduced ? 1 : Math.min(1, Math.max(0, (now - 0.15) / 0.9)),
      reveal = e * e * (3 - 2 * e);
    if (reveal <= 0) return;
    const span = width / height,
      r = 0.085 * half;
    context.strokeStyle = accent;
    context.globalAlpha = 0.85;
    context.lineWidth = Math.max(1, 1.3 * ratio);
    context.lineCap = "round";
    context.beginPath();
    if (daylight === null) {
      // Most of the outer circle, closed by a tighter offset arc.
      const x = middle + 0.42 * span * half,
        y = half - 0.5 * half;
      context.arc(x, y, r, PI * 0.28, PI * 0.28 + reveal * PI * 1.44);
      if (reveal > 0.62) context.arc(x + 0.38 * r, y, 0.86 * r, PI * 1.38, PI * 1.38 - ((reveal - 0.62) / 0.38) * PI * 0.76, true);
    } else {
      const x = middle + (daylight * 2 - 1) * 0.8 * span * half,
        y = half + (-0.14 - 0.4 * Math.sin(PI * daylight)) * half;
      context.arc(x, y, r, -PI / 2, -PI / 2 + reveal * 2 * PI);
    }
    context.stroke();
    context.globalAlpha = 1;
  }

  function draw(now) {
    const { w, h } = pixels(),
      half = h / 2,
      middle = w / 2;
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.clearRect(0, 0, context.canvas.width, context.canvas.height);
    // A warm wash blooms under the resting drawing, the light of the room before the render brings
    // its colour, and breathes with it.
    const resting = reduced || now < restingSince ? 0 : Math.min(1, (now - restingSince) / 2.5),
      breath = breathAt(now),
      swell = breath / BREATH.depth;
    if (resting > 0.003 && typeof context.createRadialGradient === "function") {
      const wash = context.createRadialGradient(middle, half * 1.06, 0, middle, half * 1.06, half * 1.15);
      wash.addColorStop(0, withAlpha(accent, 1));
      wash.addColorStop(0.55, withAlpha(accent, 0.45));
      wash.addColorStop(1, withAlpha(accent, 0));
      context.globalAlpha = 0.07 * resting * resting * (1 + 0.3 * swell);
      context.fillStyle = wash;
      context.fillRect(0, 0, context.canvas.width, context.canvas.height);
      context.globalAlpha = 1;
    }
    if (outgoing) {
      const t = Math.min(1, (now - outgoing.at) / PEN.dive),
        ease = t * t * (3 - 2 * t),
        zoom = 1 + 1.6 * ease,
        fx = middle + outgoing.focus.u * half,
        fy = half + outgoing.focus.v * half;
      if (t < 1) {
        context.globalAlpha = 1 - ease;
        context.setTransform(zoom, 0, 0, zoom, fx * (1 - zoom), fy * (1 - zoom));
        context.drawImage(outgoing.view.layer, 0, 0);
        context.globalAlpha = 1 - ease;
        opening(now, middle, half);
        context.setTransform(1, 0, 0, 1, 0, 0);
        context.globalAlpha = 1;
      } else outgoing = null;
    }
    const scale = 1 + breath;
    context.setTransform(scale, 0, 0, scale, middle * (1 - scale), half * (1 - scale));
    // The opening mark belongs to the coast drawing, and leaves with it.
    if (!current || current.id === "outside") opening(now, middle, half);
    if (!current) {
      context.setTransform(1, 0, 0, 1, 0, 0);
      return;
    }
    context.drawImage(current.layer, 0, 0);
    // The stroke under the pen, and the pen's warm nib while it draws.
    const stroke = current.drawing.strokes[current.index];
    if (stroke && current.drawn > stroke.start && current.drawn < stroke.start + stroke.length) {
      context.lineCap = "round";
      context.lineJoin = "round";
      styleFor(context, stroke);
      context.beginPath();
      const [x, y] = strokePath(context, stroke, current.drawn - stroke.start, 1, middle, half);
      context.stroke();
      const lifted = Math.min(1, Math.max(0, (now - lastInkAt) / 0.25));
      if (!reduced && lifted < 1) {
        context.globalAlpha = 0.85 * (1 - lifted);
        context.fillStyle = accent;
        context.beginPath();
        context.arc(middle + x * half, half + y * half, Math.max(1.4, 1.9 * ratio), 0, 2 * PI);
        context.fill();
      }
    }
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.globalAlpha = 1;
  }

  return {
    // Decoded drawings by view id ("outside" and the rooms).
    add(id, drawing, plan) {
      drawings.set(id, { ...drawing, plan: typeof plan === "string" ? parsePlan(plan) : plan || drawing.plan || [] });
      dirty = true;
    },
    // Where each room sits in the coast drawing, for the dive into it.
    focus(points) {
      focus = points || {};
    },
    has: (id) => drawings.has(id),
    // A loading stage, with the room the visitor will arrive in once it is known.
    // Reaching a stage proves the work before it finished, so its fills count as a floor.
    stage(name, nextRoom) {
      if (STAGE_FILLS[name]) {
        stageName = name;
        merge(STAGE_FILLS[name]);
      }
      if (nextRoom) room = nextRoom;
      dirty = true;
    },
    // The controller's per-segment fills (house, coast, room, sirui, view), never decreasing.
    progress(next) {
      merge(next);
      dirty = true;
    },
    // The first frame has arrived: complete the drawing quickly, then report settled.
    finish() {
      if (finishing === null) finishing = lastTime ?? 0;
      dirty = true;
    },
    resize(nextWidth, nextHeight, nextRatio) {
      width = nextWidth;
      height = nextHeight;
      ratio = nextRatio || ratio;
      redraw(current);
      if (outgoing) redraw(outgoing.view);
      dirty = true;
    },
    colors(nextInk, nextAccent) {
      ink = nextInk || ink;
      accent = nextAccent || accent;
      redraw(current);
      dirty = true;
    },
    get settled() {
      return finishing !== null && lastTime !== null && lastTime >= settledAt;
    },
    // What the pen has done, for the page's evidence: the drawing, the share finished work allows
    // and the share drawn (never more than allowed outside the hand-off).
    state() {
      const total = current?.drawing.ink || 0;
      return {
        drawing: current?.id || null,
        allowed: +(current ? (finishing !== null ? 1 : allowance()) : 0).toFixed(4),
        drawn: +(total ? current.drawn / total : 0).toFixed(4),
        strokes: current?.index || 0,
        resting: lastTime !== null && lastTime >= restingSince,
        finishing: finishing !== null,
      };
    },
    // Advance and draw; returns whether another frame is needed.
    tick(milliseconds) {
      if (started === null) started = milliseconds;
      const now = (milliseconds - started) / 1000,
        dt = lastTime === null ? 1 / 60 : Math.min(1 / 15, Math.max(1 / 240, now - lastTime));
      const moved = advance(now, dt),
        drawing = moved || outgoing !== null || now - carryAt < BREATH.carry || (!reduced && daylight !== undefined && now < 1.2),
        // A resting drawing only breathes: thirty redraws a second are plenty for a 4 s swell.
        breathing = !reduced && now >= restingSince && now - (lastDrawn ?? -1) >= 1 / 30;
      lastTime = now;
      if (dirty || drawing || breathing) {
        draw(now);
        lastDrawn = now;
        dirty = false;
      }
      return !reduced || dirty;
    },
  };
}
