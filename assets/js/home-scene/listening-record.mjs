import { RECORD_RPM } from "./record-motion.mjs";

const radiansPerSecond = (RECORD_RPM * Math.PI * 2) / 60;
// Physical length of the house pressing. The score-index test binds it to the
// actual recording so its runout also works with the amplifier switched off.
export const HOUSE_SIDE_SECONDS = 42.395;
const clamp = (x) => Math.max(0, Math.min(1, x));
const ease = (x) => clamp(x) ** 2 * (3 - 2 * clamp(x));

// The groove clock belongs to the platter. Walking away, muting the site or
// waiting for a download cannot put the needle back at the first note.
export function createListeningRecord() {
  let selected = false;
  let seconds = 0;
  let previousAngle = null;
  let finished = false;
  return {
    choose() {
      if (finished) {
        seconds = 0;
        previousAngle = null;
      }
      finished = false;
      selected = true;
    },
    lift() {
      selected = false;
      previousAngle = null;
    },
    finish() {
      finished = true;
    },
    advance(pose) {
      if (!selected || finished || !pose.playing || pose.phase !== "tracking") {
        previousAngle = null;
        return false;
      }
      if (previousAngle !== null) seconds += Math.max(0, pose.angle - previousAngle) / radiansPerSecond;
      previousAngle = pose.angle;
      if (seconds < HOUSE_SIDE_SECONDS) return false;
      seconds = HOUSE_SIDE_SECONDS;
      finished = true;
      return true;
    },
    get tracking() {
      return selected && previousAngle !== null && !finished;
    },
    get seconds() {
      return seconds;
    },
  };
}

// Inside the cabinet room the separate stereo instruments keep their place.
// Through the doorway, distance softens the top end and the two horns narrow
// to the direction of the cabinet. The receiver is the built room's bounds.
export function listeningPerspective(eye, cabinetInView, bounds) {
  const distance = cabinetInView.length();
  if (!bounds || distance >= 10) return null;
  const outside = Math.hypot(...[eye.x, eye.y, eye.z].map((v, i) => Math.max(0, bounds.min[i] - v, v - bounds.max[i])));
  const doorway = ease(outside / 2.1);
  const gain = (0.78 * (1 - ease((distance - 5) / 5)) * (1 - 0.69 * doorway)) / (1 + (distance / 4.7) ** 2);
  return {
    gain,
    pan: (0.78 * cabinetInView.x) / Math.max(0.5, Math.hypot(cabinetInView.x, cabinetInView.z)),
    cutoff: (8000 + 5500 * (1 - ease(distance / 7))) * (1 - 0.71 * doorway),
  };
}
