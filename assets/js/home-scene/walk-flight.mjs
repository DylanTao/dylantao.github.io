import { BODY } from "./colliders.mjs";
import { DIVE, diveAcceleration, diveWater, insideDiveArea } from "./pacific-diving.mjs";

export const FLIGHT = Object.freeze({ gravity: 9.80665, jumpSpeed: 5.1, tick: 1 / 120, maxFrame: 0.25 });

// Fixed small collision steps, exact constant-gravity travel within each step. The caller supplies
// its already integrated horizontal distance. There is no health, fall penalty or respawn teleport.
export function stepFlight(
  state,
  field,
  { dt, dx = 0, dz = 0, jump = false, waterAt = () => null, impact = () => {}, dynamic = null, swim = null } = {}
) {
  dt = Math.min(FLIGHT.maxFrame, Math.max(0, Number.isFinite(dt) ? dt : 0));
  state.vy ??= 0;
  state.grounded ??= true;
  if (jump && state.grounded && !swim) {
    state.vy = FLIGHT.jumpSpeed;
    state.grounded = false;
    state.jumps = (state.jumps || 0) + 1;
  }
  const steps = Math.max(1, Math.ceil(dt / FLIGHT.tick)),
    tick = dt / steps,
    bounds = field.bounds;
  let moved = 0,
    blocked = false;
  for (let i = 0; i < steps; i++) {
    const water = waterAt(state.x, state.z),
      submergence = water ? Math.max(0, water.y - state.foot) : 0;
    let acceleration = -FLIGHT.gravity;
    if (submergence > 0) {
      // A vertical body proxy: displaced volume gives buoyancy, submerged area gives quadratic
      // drag. The analytic drag step cannot flip velocity on a high-speed entry.
      acceleration += FLIGHT.gravity * 1.05 * Math.min(1.5, submergence / 1.2);
      const drag = 0.42 * Math.min(1, submergence / 0.5);
      state.vy = (state.vy * Math.exp(-1.4 * Math.min(1, submergence / 0.5) * tick)) / (1 + drag * Math.abs(state.vy) * tick);
    }
    const steering = diveAcceleration(water, state.foot, state.vy, swim);
    if (steering !== null) acceleration = steering;
    const beforeFoot = state.foot,
      beforeVelocity = state.vy;
    let stepX = dx / steps,
      stepZ = dz / steps,
      dy = state.vy * tick + 0.5 * acceleration * tick * tick,
      touchesBed = false,
      openWater = false;
    if ((swim || bounds) && submergence > 0 && diveWater(water) && insideDiveArea(state.x, state.z)) {
      const x = state.x + stepX,
        z = state.z + stepZ;
      const outside =
        bounds &&
        (x - BODY.radius < bounds.min[0] || x + BODY.radius > bounds.max[0] || z - BODY.radius < bounds.min[2] || z + BODY.radius > bounds.max[2]);
      if (swim || outside) {
        const ahead = stepX || stepZ ? insideDiveArea(x, z) && waterAt(x, z) : water;
        let bed = water.floor;
        if (diveWater(ahead) && ahead.floor <= state.foot + 0.065) {
          bed = Math.max(bed, ahead.floor);
          openWater = Boolean(outside);
        } else if (stepX || stepZ) {
          stepX = stepZ = 0;
          blocked = true;
        }
        const bottom = bed + DIVE.bottomClearance - state.foot;
        if (dy < bottom) {
          dy = Math.min(bottom, Math.max(dy, FLIGHT.jumpSpeed * tick));
          touchesBed = true;
        }
      }
    }
    const result = field.sweepBody(
      state,
      {
        dx: stepX,
        dz: stepZ,
        dy,
        grounded: state.grounded,
        stepping: !swim && (state.grounded || submergence > 0),
        openWater,
        wading: !swim && submergence > 0 && Math.hypot(dx, dz) > 1e-6,
      },
      BODY,
      dynamic
    );
    state.x = result.x;
    state.z = result.z;
    state.foot = result.foot;
    state.grounded = result.grounded;
    state.vy = result.grounded || result.ceiling || touchesBed ? 0 : state.vy + acceleration * tick;
    moved += result.moved;
    blocked ||= result.blocked;
    const nextWater = waterAt(state.x, state.z),
      wet = Boolean(nextWater && state.foot < nextWater.y);
    if (wet && !state.wet && beforeVelocity < -0.7 && beforeFoot >= nextWater.y - 0.02) {
      impact({ x: state.x, z: state.z, y: nextWater.y, speed: -beforeVelocity, radius: BODY.radius, water: nextWater });
      state.waterEntries = (state.waterEntries || 0) + 1;
    }
    state.wet = wet;
  }
  return { moved, blocked };
}
