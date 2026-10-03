const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
export const pipAngle = (v) => Math.atan2(Math.sin(v), Math.cos(v));

// The authored lenses face local +Z. Screen horizontal is not that axis:
// orbiting the room must not make P look at the opposite side of an object.
export function pipLocalAim(origin, target, heading) {
  const x = target[0] - origin[0],
    y = target[1] - origin[1],
    z = target[2] - origin[2],
    horizontal = Math.hypot(x, z);
  const yaw = horizontal > 0.00001 ? Math.atan2(x, z) : heading;
  const localYaw = pipAngle(yaw - heading),
    pitch = Math.atan2(y, horizontal);
  return { yaw, pitch, gaze: [clamp(localYaw / 0.48, -1, 1), clamp(pitch / 0.34, -1, 1)] };
}

// Eyes and neck already have separate response rates in the shared motor.
// This slower shell follow is rate-limited, including across the +/-pi seam.
export function advancePipHeading(heading, desired, dt) {
  const step = Math.min(0.25, Math.max(0, dt)),
    error = pipAngle(desired - heading),
    follow = error * (1 - Math.exp(-step * 1.8));
  return heading + clamp(follow, -step * 1.8, step * 1.8);
}

// A tap is an invitation, not an enduring mouse hover. Keep one bounded
// greeting/listening beat, and reject multi-touch, panning and cancellation.
// Its clock is the world's active time, so pause/ownership cannot age it.
export function createPipTouchInvitation() {
  let candidate = null,
    tap = null,
    until = -1;
  const fingers = new Set();
  return {
    down(id, x, y) {
      fingers.add(id);
      if (fingers.size > 1) {
        candidate = null;
        tap = null;
        until = -1;
        return;
      }
      candidate = { id, x, y, moved: false };
    },
    move(id, x, y) {
      if (candidate?.id === id && Math.hypot(x - candidate.x, y - candidate.y) > 10) {
        candidate.moved = true;
        tap = null;
        until = -1;
      }
    },
    up(id, x, y, now, near) {
      if (candidate?.id === id && !candidate.moved && near) {
        tap = { x, y };
        until = now + 6.3;
      }
      if (candidate?.id === id) candidate = null;
      fingers.delete(id);
    },
    cancel() {
      candidate = tap = null;
      until = -1;
      fingers.clear();
    },
    sample: (now) => (now < until ? tap : null),
    pending: () => Boolean(candidate),
  };
}
