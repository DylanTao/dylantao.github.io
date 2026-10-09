// Duh's center-body physics is independent of its expression and silhouette.
// Fixed 1/120 s steps, bounded velocity and damped contact keep interruptions stable.
export const DUH_LIMITS = Object.freeze({ radius: 28, speed: 1600, roughSpeed: 850, retreatSeconds: 8, throwWindow: 12 });
export const clamp = (n, a, b) => Math.max(a, Math.min(b, n));

export function createDuhMotion(width = 1000, height = 800) {
  const s = { x: width - 52, y: height - 120, vx: 0, vy: 0, state: "REST", mood: "content", squash: 0, squashV: 0, time: 0, hiddenUntil: 0 };
  let w = width,
    h = height,
    held = null,
    accumulator = 0,
    clicks = [],
    throws = [],
    retreatPending = false,
    playUntil = 0;
  const impacts = [];
  const bounds = () => ({ left: 36, right: Math.max(36, w - 36), top: Math.min(100, h / 3), bottom: Math.max(110, h - 42) });
  function constrain() {
    const b = bounds();
    s.x = clamp(s.x, b.left, b.right);
    s.y = clamp(s.y, b.top, b.bottom);
  }
  function stop() {
    held = null;
    s.vx = s.vy = 0;
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
    if (!held) return;
    held.moved ||= Math.hypot(x - held.startX, y - held.startY) > 6;
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
      scale = Math.min(1, DUH_LIMITS.speed / Math.max(speed, 1));
    s.vx = vx * scale;
    s.vy = vy * scale;
    s.state = "AIRBORNE";
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
    if (s.state === "RETREAT" && s.time >= s.hiddenUntil) reset();
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
      if (s.state !== "AIRBORNE") continue;
      s.vy += 1100 * d;
      s.vx *= Math.exp(-0.75 * d);
      s.x += s.vx * d;
      s.y += s.vy * d;
      const b = bounds();
      let impact = 0;
      if (s.x < b.left || s.x > b.right) {
        impact = Math.abs(s.vx);
        s.vx *= -0.5;
      }
      if (s.y < b.top || s.y > b.bottom) {
        impact = Math.max(impact, Math.abs(s.vy));
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
