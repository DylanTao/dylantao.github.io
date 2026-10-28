// One authored, closed carve. Position, velocity, board frame and stance share this clock;
// this is a miniature's animation, not a surf dynamics simulation. The two ocean modes
// complete four and three cycles in the same period (wave-motion.mjs).
export const RIDE = Object.freeze({ period: Math.PI * 10, along: 1.4, across: 0.55, easing: 0.12, trailSeconds: 4.8, trailPoints: 9 });
export const SHOULDER = Object.freeze({ height: 0.115, behind: 0.72, alongWidth: 0.48, acrossWidth: 0.65 });
const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));

export function sampleSurferRide(seconds, origin = [0, 0], yaw = 0) {
  const w = (2 * Math.PI) / RIDE.period;
  const s = seconds * w;
  const u = s + RIDE.easing * Math.sin(s);
  const du = w * (1 + RIDE.easing * Math.cos(s));
  const ddu = -w * w * RIDE.easing * Math.sin(s);
  const x = RIDE.along * Math.sin(u),
    z = RIDE.across * (1 - Math.cos(u));
  const vx = RIDE.along * Math.cos(u) * du,
    vz = RIDE.across * Math.sin(u) * du;
  const ax = RIDE.along * (-Math.sin(u) * du * du + Math.cos(u) * ddu);
  const az = RIDE.across * (Math.cos(u) * du * du + Math.sin(u) * ddu);
  const c = Math.cos(yaw),
    sn = Math.sin(yaw);
  const speed = Math.hypot(vx, vz);
  const heading = [(c * vx + sn * vz) / speed, (-sn * vx + c * vz) / speed];
  const turnRate = (vx * az - vz * ax) / (speed * speed);
  const acceleration = (vx * ax + vz * az) / speed;
  const bank = clamp(Math.atan((speed * turnRate) / 0.7), -0.16, 0.16);
  return {
    x: origin[0] + c * x + sn * z,
    z: origin[1] - sn * x + c * z,
    velocity: [c * vx + sn * vz, -sn * vx + c * vz],
    heading,
    speed,
    turnRate,
    acceleration,
    bank,
    power: clamp(speed / 0.34, 0, 1),
    crouch: 0.008 + bank * 0.13 + Math.max(0, -acceleration) * 0.3,
  };
}

// Local rolling shoulder, separate from the unchanged two global ocean modes. The GPU uses
// these same constants/formula. Its broad crest stays just behind the rider's face of the wave.
export function sampleRideShoulder(x, z, ride) {
  if (!ride) return { height: 0, dx: 0, dz: 0 };
  const [hx, hz] = ride.heading;
  const rx = x - ride.x,
    rz = z - ride.z;
  const a = rx * hx + rz * hz + SHOULDER.behind;
  const b = -rx * hz + rz * hx;
  const height = SHOULDER.height * ride.power * Math.exp((-a * a) / SHOULDER.alongWidth - (b * b) / SHOULDER.acrossWidth);
  const da = (-2 * a * height) / SHOULDER.alongWidth,
    db = (-2 * b * height) / SHOULDER.acrossWidth;
  return { height, dx: da * hx - db * hz, dz: da * hz + db * hx };
}

// Tangent / normal / cross-board axes, banked about the board's nose. Slopes are world
// derivatives; constructing a basis keeps them correct through the whole heading circle.
export function surferBoardFrame(heading, wave, bank = 0) {
  const normalize = (v) => {
    const n = Math.hypot(...v);
    return v.map((x) => x / n);
  };
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const up = normalize([-wave.dx, 1, -wave.dz]);
  const nose = normalize([heading[0], wave.dx * heading[0] + wave.dz * heading[1], heading[1]]);
  const side = cross(nose, up);
  const c = Math.cos(bank),
    s = Math.sin(bank);
  return { nose, up: up.map((v, i) => v * c + side[i] * s), side: side.map((v, i) => v * c - up[i] * s) };
}

export function surferRideTrail(seconds, origin, yaw) {
  return Array.from({ length: RIDE.trailPoints }, (_, i) => {
    const age = (i * RIDE.trailSeconds) / (RIDE.trailPoints - 1);
    const state = sampleSurferRide(seconds - age, origin, yaw);
    // The foam is laid down at the real tail, then fades where it was left.
    return { x: state.x - state.heading[0] * 0.62, z: state.z - state.heading[1] * 0.62, age, power: state.power };
  });
}
