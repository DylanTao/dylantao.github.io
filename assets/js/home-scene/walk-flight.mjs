import { BODY } from "./colliders.mjs";

export const FLIGHT = Object.freeze({ gravity: 9.80665, jumpSpeed: 5.1, tick: 1 / 120, maxFrame: 0.25 });

// Fixed small collision steps, exact constant-gravity travel within each step. The caller supplies
// its already integrated horizontal distance. There is no health, fall penalty or respawn teleport.
export function stepFlight(state, field, { dt, dx = 0, dz = 0, jump = false, waterAt = () => null, impact = () => {}, dynamic = null } = {}) {
  dt = Math.min(FLIGHT.maxFrame, Math.max(0, Number.isFinite(dt) ? dt : 0));
  state.vy ??= 0;
  state.grounded ??= true;
  if (jump && state.grounded) {
    state.vy = FLIGHT.jumpSpeed;
    state.grounded = false;
    state.jumps = (state.jumps || 0) + 1;
  }
  const steps = Math.max(1, Math.ceil(dt / FLIGHT.tick)),
    tick = dt / steps;
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
    const beforeFoot = state.foot,
      beforeVelocity = state.vy,
      dy = state.vy * tick + 0.5 * acceleration * tick * tick;
    const result = field.sweepBody(
      state,
      {
        dx: dx / steps,
        dz: dz / steps,
        dy,
        grounded: state.grounded,
        stepping: state.grounded || submergence > 0,
        wading: submergence > 0 && Math.hypot(dx, dz) > 1e-6,
      },
      BODY,
      dynamic
    );
    state.x = result.x;
    state.z = result.z;
    state.foot = result.foot;
    state.grounded = result.grounded;
    state.vy = result.grounded || result.ceiling ? 0 : state.vy + acceleration * tick;
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
