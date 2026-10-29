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

// The scene owns the visibility/motion/drag gate. Listen automatically where relative sensor
// events are already allowed; a meaningful footer gesture requests any still-required system
// permission. No permission request is made by mount, visibility, or animation frames.
export function createViewTilt({ status, onChange = () => {}, window: scope = window, document: doc = document }) {
  const Orientation = scope.DeviceOrientationEvent;
  const coarse = scope.matchMedia?.("(any-pointer: coarse)").matches || scope.navigator?.maxTouchPoints > 0;
  const supported = Boolean(scope.isSecureContext && typeof Orientation === "function" && coarse);
  const requiresRequest = typeof Orientation?.requestPermission === "function";
  let active = false,
    permission = requiresRequest ? "unknown" : "granted",
    pending = false,
    requested = false,
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
    if (requested && status) status.textContent = text;
  };
  const emit = (value) => {
    output = { ...value };
    onChange({ ...output });
  };
  const clearDeadline = () => {
    scope.clearTimeout(deadline);
    deadline = 0;
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
    pending = false;
    disconnect();
    say(text);
  };
  const waitForData = () => {
    clearDeadline();
    deadline = scope.setTimeout(() => {
      if (listening && !neutral) fail("unavailable", "Motion is unavailable on this device. You can still swipe the coast.");
    }, 5000);
  };
  function onOrientation(event) {
    if (!listening || !live()) return;
    const currentAngle = angle();
    if (currentAngle !== lastAngle) reset();
    const gravity = screenGravity(event, currentAngle);
    if (!gravity) return;
    // A usable event proves that this API already permits relative orientation. This also
    // covers a returning iPhone that has granted access, without prompting on every visit.
    permission = "granted";
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
    if (listening && permission === "granted") waitForData();
  }
  function sync() {
    const wanted = supported && live() && !failure;
    if (wanted && !listening) {
      reset();
      scope.addEventListener("deviceorientation", onOrientation, { passive: true });
      listening = true;
    } else if (!wanted && listening) disconnect();
    // Unknown permission is not a failed sensor: leave time for the visitor's first gesture.
    if (listening && permission === "granted" && !neutral && !deadline) waitForData();
  }
  async function requestFromGesture() {
    if (!supported || !live() || pending || failure || disposed || permission === "granted" || !requiresRequest) return;
    if (scope.navigator?.userActivation?.isActive === false) return;
    const request = ++generation;
    requested = pending = true;
    say("Waiting for motion permission...");
    try {
      // Synchronous call from touch pointerup/keyboard handling, before any await. Prompt
      // permission still requires transient activation; absolute/magnetometer is not requested.
      const answer = await Orientation.requestPermission();
      if (disposed || request !== generation) return;
      pending = false;
      if (answer !== "granted") {
        permission = "denied";
        fail("denied", "Motion access was not allowed. You can still swipe the coast.");
        return;
      }
      permission = "granted";
      sync();
    } catch {
      if (!disposed && request === generation) fail("unavailable", "Motion access is unavailable. You can still swipe the coast.");
    }
  }

  scope.screen?.orientation?.addEventListener("change", reset);
  scope.addEventListener("orientationchange", reset);
  doc.addEventListener("visibilitychange", sync);

  return {
    setActive(value) {
      active = Boolean(value);
      sync();
    },
    requestFromGesture,
    reset,
    evidence() {
      return {
        supported,
        enabled: supported && permission === "granted" && !failure,
        active: live(),
        listening,
        permission: supported ? permission : "unavailable",
        requested,
        state: disposed
          ? "disposed"
          : failure ||
            (!supported
              ? "unsupported"
              : pending
                ? "permission"
                : !live()
                  ? "suspended"
                  : neutral
                    ? "on"
                    : permission === "unknown"
                      ? "waiting"
                      : "calibrating"),
        ...output,
      };
    },
    dispose() {
      disposed = true;
      generation++;
      pending = false;
      disconnect();
      scope.screen?.orientation?.removeEventListener("change", reset);
      scope.removeEventListener("orientationchange", reset);
      doc.removeEventListener("visibilitychange", sync);
    },
  };
}
