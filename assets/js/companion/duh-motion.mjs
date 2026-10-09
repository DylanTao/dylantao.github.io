// Duh's center-body physics is independent of its expression and silhouette.
// Fixed 1/120 s steps, bounded velocity and damped contact keep interruptions stable.
export const DUH_LIMITS = Object.freeze({ radius: 28, speed: 1600, roughSpeed: 850, retreatSeconds: 8, throwWindow: 12 });
export const clamp = (n, a, b) => Math.max(a, Math.min(b, n));

export function createDuhMotion(width = 1000, height = 800) {
  const s = {
    x: width - 52,
    y: height - 120,
    vx: 0,
    vy: 0,
    state: "REST",
    mood: "content",
    squash: 0,
    squashV: 0,
    ax: 0,
    ay: 0,
    contactAngle: Math.PI / 2,
    time: 0,
    hiddenUntil: 0,
  };
  let w = width,
    h = height,
    viewLeft = 0,
    viewTop = 0,
    safeBottom = 0,
    safeLeft = 0,
    safeRight = 0,
    safeTop = 0,
    held = null,
    accumulator = 0,
    clicks = [],
    throws = [],
    retreatPending = false,
    playUntil = 0,
    flightUntil = 0,
    surfaces = [];
  const impacts = [];
  const bounds = () => ({
    left: viewLeft + 36 + safeLeft,
    right: viewLeft + Math.max(36 + safeLeft, w - 36 - safeRight),
    top: viewTop + Math.max(Math.min(100, h / 3), 36 + safeTop),
    bottom: viewTop + Math.max(110, h - 42 - safeBottom),
  });
  function constrain() {
    const b = bounds();
    s.x = clamp(s.x, b.left, b.right);
    s.y = clamp(s.y, b.top, b.bottom);
  }
  function stop() {
    held = null;
    s.vx = s.vy = s.ax = s.ay = 0;
    accumulator = 0;
  }
  function rest() {
    stop();
    if (retreatPending) {
      s.state = "RETREAT";
      s.hiddenUntil = s.time + DUH_LIMITS.retreatSeconds;
      retreatPending = false;
    } else s.state = "REST";
  }
  function reset(x = w - 52, y = h - 120) {
    stop();
    clicks = [];
    throws = [];
    retreatPending = false;
    impacts.length = 0;
    Object.assign(s, { x, y, state: "REST", mood: "content", squash: 0, squashV: 0, hiddenUntil: 0 });
    constrain();
  }
  function pet(still = false) {
    if (s.state === "RETREAT") return;
    clicks = clicks.filter((t) => s.time - t < 1.2);
    clicks.push(s.time);
    s.mood = clicks.length >= 3 ? "giggle" : "happy";
    s.state = "PLAY";
    playUntil = s.time + 0.8;
    s.squashV = still ? 0 : s.mood === "giggle" ? 3.5 : 1.7;
    if (clicks.length >= 3) clicks = [];
  }
  function grab(x, y, now) {
    if (s.state === "RETREAT") return false;
    stop();
    s.state = "HELD";
    s.mood = "curious";
    held = { ox: s.x - x, oy: s.y - y, x, y, now, moved: false, startX: x, startY: y, samples: [{ x: s.x, y: s.y, now }] };
    return true;
  }
  function drag(x, y, now) {
    if (!held || (now === held.now && x === held.x && y === held.y)) return;
    held.moved ||= Math.hypot(x - held.startX, y - held.startY) > 6;
    const dt = clamp((now - held.now) / 1000, 0.008, 0.05);
    const vx = clamp((x - held.x) / dt, -1600, 1600),
      vy = clamp((y - held.y) / dt, -1600, 1600);
    s.ax = clamp((vx - s.vx) / dt, -16000, 16000);
    s.ay = clamp((vy - s.vy) / dt, -16000, 16000);
    s.vx = vx;
    s.vy = vy;
    s.x = x + held.ox;
    s.y = y + held.oy;
    constrain();
    held.samples.push({ x: s.x, y: s.y, now });
    held.samples = held.samples.filter((p) => now - p.now < 100).slice(-12);
    held.x = x;
    held.y = y;
    held.now = now;
  }
  function toss(vx, vy, still = false) {
    stop();
    if (still) {
      s.state = "REST";
      return;
    }
    const speed = Math.hypot(vx, vy),
      // A phone gets a smaller arc at the same finger speed.
      limit = Math.min(DUH_LIMITS.speed, Math.max(900, w * 3)),
      scale = Math.min(1, limit / Math.max(speed, 1));
    s.vx = vx * scale;
    s.vy = vy * scale;
    s.state = "AIRBORNE";
    flightUntil = s.time + 4;
    s.mood = "delighted";
    throws = throws.filter((t) => s.time - t < DUH_LIMITS.throwWindow);
    if (speed >= DUH_LIMITS.roughSpeed) throws.push(s.time);
    if (throws.length >= 3) {
      retreatPending = true;
      throws = [];
    }
  }
  function release(now, still = false) {
    if (!held) return false;
    const gesture = held;
    held = null;
    if (!gesture.moved) {
      pet(still);
      return false;
    }
    const first = gesture.samples[0],
      last = gesture.samples.at(-1);
    const dt = (last.now - first.now) / 1000;
    const fresh = now - last.now < 90 && dt > 0.008;
    toss(fresh ? (last.x - first.x) / dt : 0, fresh ? (last.y - first.y) / dt : 0, still);
    return true;
  }
  function cancel() {
    stop();
    retreatPending = false;
    impacts.length = 0;
    s.squash = s.squashV = 0;
    if (s.state !== "RETREAT") s.state = "REST";
  }
  function step(dt, still = false) {
    dt = clamp(dt, 0, 0.05);
    s.time += dt;
    if (s.state === "RETREAT" && s.time >= s.hiddenUntil) reset(s.x, s.y);
    if (still) {
      s.squash = s.squashV = 0;
      if (s.state === "AIRBORNE") rest();
      return [];
    }
    accumulator += dt;
    while (accumulator >= 1 / 120) {
      const d = 1 / 120;
      accumulator -= d;
      s.squashV += (-180 * s.squash - 20 * s.squashV) * d;
      s.squash = clamp(s.squash + s.squashV * d, -0.18, 0.24);
      s.ax *= Math.exp(-12 * d);
      s.ay *= Math.exp(-12 * d);
      if (s.state === "HELD") {
        s.vx *= Math.exp(-10 * d);
        s.vy *= Math.exp(-10 * d);
      }
      if (s.state !== "AIRBORNE") continue;
      if (s.time > flightUntil) {
        rest();
        continue;
      }
      s.vy += 1100 * d;
      s.vx *= Math.exp(-0.75 * d);
      const dx = s.vx * d,
        dy = s.vy * d;
      const contact = sweepDuhContact(s.x, s.y, dx, dy, surfaces);
      if (contact) {
        s.x += dx * contact.t + contact.nx * 0.1;
        s.y += dy * contact.t + contact.ny * 0.1;
        const velocity = s.vx * contact.nx + s.vy * contact.ny;
        s.vx -= 1.48 * velocity * contact.nx;
        s.vy -= 1.48 * velocity * contact.ny;
        s.contactAngle = Math.atan2(-contact.ny, -contact.nx);
        s.squashV = Math.min(5, Math.abs(velocity) / 180);
        impacts.push({ x: s.x, y: s.y, speed: Math.abs(velocity), nx: contact.nx, ny: contact.ny, target: contact.target });
        if (Math.abs(velocity) < 50 && contact.ny < 0) rest();
      } else {
        s.x += dx;
        s.y += dy;
      }
      const b = bounds();
      let impact = 0;
      if (s.x < b.left || s.x > b.right) {
        impact = Math.abs(s.vx);
        s.contactAngle = 0;
        s.vx *= -0.5;
      }
      if (s.y < b.top || s.y > b.bottom) {
        impact = Math.max(impact, Math.abs(s.vy));
        s.contactAngle = Math.PI / 2;
        s.vy *= -0.45;
        s.vx *= 0.8;
      }
      constrain();
      if (impact > 100) {
        s.squashV = Math.min(4, impact / 250);
        impacts.push({ x: s.x, y: s.y, speed: impact });
      }
      if (s.y >= b.bottom - 0.5 && Math.abs(s.vy) < 45 && Math.abs(s.vx) < 45) rest();
    }
    if (s.state === "PLAY" && s.time > playUntil) {
      s.state = "REST";
      s.mood = "content";
    }
    return impacts.splice(0);
  }
  return {
    state: s,
    reset,
    pet,
    grab,
    drag,
    release,
    toss,
    cancel,
    step,
    bounds,
    setSurfaces(next) {
      surfaces = next.slice(0, 160);
    },
    setViewport({ width, height, left = 0, top = 0, bottom = 0, insetLeft = 0, insetRight = 0, insetTop = 0 }) {
      // Browser chrome and visual-viewport changes update constraints only.
      // The controller settles an out-of-bounds pose; capture is not canceled.
      w = width;
      h = height;
      viewLeft = left;
      viewTop = top;
      safeBottom = bottom;
      safeLeft = insetLeft;
      safeRight = insetRight;
      safeTop = insetTop;
    },
    resize(width, height) {
      w = width;
      h = height;
      cancel();
      constrain();
    },
    evidence() {
      return { ...s, roughThrows: throws.length, retreatPending, held: Boolean(held) };
    },
  };
}

// Swept circle/AABB contact: thin text lines cannot be skipped by a fast throw.
// An initially intersecting surface is ignored, allowing a drag to release anywhere.
export function sweepDuhContact(x, y, dx, dy, surfaces, radius = 28) {
  let closest = null;
  for (const target of surfaces) {
    const r = target.rect;
    const left = r.left - radius,
      right = r.right + radius;
    const top = r.top - radius,
      bottom = r.bottom + radius;
    if (x > left && x < right && y > top && y < bottom) continue;
    let enter = -Infinity,
      leave = Infinity,
      nx = 0,
      ny = 0,
      missed = false;
    for (const [p, delta, min, max, horizontal] of [
      [x, dx, left, right, true],
      [y, dy, top, bottom, false],
    ]) {
      if (Math.abs(delta) < 1e-9) {
        if (p < min || p > max) missed = true;
        continue;
      }
      const a = (min - p) / delta,
        b = (max - p) / delta;
      const near = Math.min(a, b),
        far = Math.max(a, b);
      if (near > enter) {
        enter = near;
        nx = horizontal ? -Math.sign(delta) : 0;
        ny = horizontal ? 0 : -Math.sign(delta);
      }
      leave = Math.min(leave, far);
    }
    if (!missed && enter >= 0 && enter <= 1 && enter <= leave && (!closest || enter < closest.t)) closest = { t: enter, nx, ny, target };
  }
  return closest;
}
