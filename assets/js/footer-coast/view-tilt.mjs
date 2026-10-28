// Optional phone input for the footer's shallow camera glide. The scene owns smoothing and
// presentation; this module only reads gravity after a visitor asks, relative to a comfortable
// starting pose. DeviceOrientation's alpha/compass heading is neither requested nor used.
// Coordinate and permission model: https://www.w3.org/TR/orientation-event/

const RAD = Math.PI / 180;
const ZERO = Object.freeze({ x: 0, y: 0 });
const clamp = (value, low = -1, high = 1) => Math.min(high, Math.max(low, value));
const dot = (a, b) => a.x * b.x + a.y * b.y + a.z * b.z;
const unit = (v) => {
  if (!v || ![v.x, v.y, v.z].every(Number.isFinite)) return null;
  const length = Math.hypot(v.x, v.y, v.z);
  return length > 1e-8 ? { x: v.x / length, y: v.y / length, z: v.z / length } : null;
};
const turn = (angle) => ((angle % 360) + 360) % 360;

// Earth-up in device coordinates, transformed into the current screen's x-right/y-up axes.
// Unlike subtracting Euler angles, gravity remains continuous across beta's -180/180 boundary.
export function screenGravity({ beta, gamma } = {}, angle = 0) {
  if (!Number.isFinite(beta) || !Number.isFinite(gamma) || !Number.isFinite(angle)) return null;
  if (Math.abs(beta) > 180 || Math.abs(gamma) > 90) return null;
  const pitch = beta * RAD,
    roll = gamma * RAD,
    screen = turn(angle) * RAD;
  const x = -Math.cos(pitch) * Math.sin(roll),
    y = Math.sin(pitch),
    z = Math.cos(pitch) * Math.cos(roll);
  return { x: x * Math.cos(screen) + y * Math.sin(screen), y: y * Math.cos(screen) - x * Math.sin(screen), z };
}

// Angular movement on the tangent plane of the neutral gravity vector: about 18 degrees reaches
// the bounded camera input. A one-degree dead zone keeps small hand tremors from moving the view.
export function relativeTilt(neutral, current) {
  const n = unit(neutral),
    c = unit(current);
  if (!n || !c) return null;
  let right = unit({ x: 1 - n.x * n.x, y: -n.x * n.y, z: -n.x * n.z });
  // A screen held on its side can put gravity exactly on x; retain a finite tangent there too.
  right ??= unit({ x: -n.z * n.x, y: -n.z * n.y, z: 1 - n.z * n.z });
  const up = { x: n.y * right.z - n.z * right.y, y: n.z * right.x - n.x * right.z, z: n.x * right.y - n.y * right.x };
  const forward = dot(c, n);
  const response = (axis) => {
    const degrees = Math.atan2(dot(c, axis), forward) / RAD;
    return Math.sign(degrees) * clamp((Math.abs(degrees) - 1) / 17, 0, 1);
  };
  return { x: response(right), y: response(up) };
}

// setActive is the scene's visibility/motion/drag gate, not visitor permission. An inactive scene
// detaches its listener and clears neutral; re-entry resumes only an already requested session.
export function createViewTilt({ button, status, onChange = () => {}, window: scope = window, document: doc = document }) {
  const Orientation = scope.DeviceOrientationEvent;
  const coarse = scope.matchMedia?.("(any-pointer: coarse)").matches || scope.navigator?.maxTouchPoints > 0;
  const supported = Boolean(scope.isSecureContext && typeof Orientation === "function" && coarse);
  let active = false,
    enabled = false,
    pending = false,
    listening = false,
    disposed = false,
    failure = "",
    neutral = null,
    output = { ...ZERO },
    deadline = 0,
    generation = 0,
    lastAngle = 0;

  const angle = () => turn(Number.isFinite(scope.screen?.orientation?.angle) ? scope.screen.orientation.angle : (scope.orientation ?? 0));
  const live = () => active && !doc.hidden && !disposed;
  const say = (text) => {
    if (status) status.textContent = text;
  };
  const emit = (value) => {
    output = { ...value };
    onChange({ ...output });
  };
  const clearDeadline = () => {
    scope.clearTimeout(deadline);
    deadline = 0;
  };
  const controls = () => {
    button.hidden = !supported;
    button.disabled = Boolean(!supported || !live() || pending || failure || disposed);
    button.textContent = pending ? "Enabling tilt…" : enabled ? "Tilt on" : "Enable tilt";
    button.setAttribute("aria-pressed", String(enabled));
  };
  const disconnect = () => {
    clearDeadline();
    if (listening) scope.removeEventListener("deviceorientation", onOrientation);
    listening = false;
    neutral = null;
    emit(ZERO);
  };
  const fail = (reason, text) => {
    failure = reason;
    enabled = false;
    pending = false;
    disconnect();
    controls();
    say(text);
  };
  const waitForData = () => {
    clearDeadline();
    deadline = scope.setTimeout(() => {
      if (listening && !neutral) fail("unavailable", "Tilt is unavailable on this device.");
    }, 5000);
  };
  function onOrientation(event) {
    if (!listening || !live()) return;
    const currentAngle = angle();
    if (currentAngle !== lastAngle) reset();
    const gravity = screenGravity(event, currentAngle);
    if (!gravity) return;
    if (!neutral) {
      neutral = gravity;
      clearDeadline();
      say("Tilt gently to explore the coast.");
      emit(ZERO);
      return;
    }
    emit(relativeTilt(neutral, gravity));
  }
  function reset() {
    neutral = null;
    lastAngle = angle();
    emit(ZERO);
    if (listening) waitForData();
  }
  function sync() {
    const wanted = supported && enabled && live() && !failure;
    if (wanted && !listening) {
      reset();
      scope.addEventListener("deviceorientation", onOrientation, { passive: true });
      listening = true;
      waitForData();
      say("Hold your phone comfortably, then tilt gently.");
    } else if (!wanted && listening) disconnect();
    controls();
  }
  async function toggle() {
    if (!supported || !live() || pending || failure || disposed) return;
    if (enabled) {
      enabled = false;
      disconnect();
      controls();
      say("Tilt off.");
      return;
    }
    const request = ++generation;
    pending = true;
    controls();
    say("Waiting for motion permission…");
    try {
      // Called synchronously from the click handler, before any await: iPhone Safari requires
      // transient user activation. No absolute/magnetometer permission is requested.
      const permission = typeof Orientation.requestPermission === "function" ? await Orientation.requestPermission() : "granted";
      if (disposed || request !== generation) return;
      if (permission !== "granted") {
        fail("denied", "Motion access was not allowed. You can still swipe the coast.");
        return;
      }
      pending = false;
      enabled = true;
      sync();
    } catch {
      if (!disposed && request === generation) fail("unavailable", "Motion access is unavailable. You can still swipe the coast.");
    }
  }

  button.addEventListener("click", toggle);
  scope.screen?.orientation?.addEventListener("change", reset);
  scope.addEventListener("orientationchange", reset);
  doc.addEventListener("visibilitychange", sync);
  controls();

  return {
    setActive(value) {
      active = Boolean(value);
      sync();
    },
    reset,
    evidence() {
      return {
        supported,
        enabled,
        active: live(),
        listening,
        state: disposed
          ? "disposed"
          : failure ||
            (!supported ? "unsupported" : pending ? "permission" : !enabled ? "off" : !live() ? "suspended" : neutral ? "on" : "calibrating"),
        ...output,
      };
    },
    dispose() {
      disposed = true;
      generation++;
      enabled = pending = false;
      disconnect();
      button.removeEventListener("click", toggle);
      scope.screen?.orientation?.removeEventListener("change", reset);
      scope.removeEventListener("orientationchange", reset);
      doc.removeEventListener("visibilitychange", sync);
      controls();
    },
  };
}
