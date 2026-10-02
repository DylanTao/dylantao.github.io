// Deterministic authored neighbours, sampled from active scene time. Planted
// contacts and flight derivatives are explicit; this is not a dynamics solver.
const clamp = (value) => Math.max(0, Math.min(1, value));
const smooth = (value) => {
  const u = clamp(value);
  return u ** 3 * (10 + u * (-15 + 6 * u));
};
const wrap = (value, period) => ((value % period) + period) % period;
const activeTime = (time) => Math.max(0, Number.isFinite(time) ? time : 0);
const mix = (a, b, u) => a.map((value, index) => value + (b[index] - value) * u);

export function createHabitatRoute(path) {
  const lengths = path.map((point, index) =>
    Math.hypot(point[0] - path[(index + 1) % path.length][0], point[2] - path[(index + 1) % path.length][2])
  );
  const length = lengths.reduce((sum, value) => sum + value, 0);
  const vertices = [];
  let station = 0;
  for (let index = 0; index < path.length; index++) {
    vertices.push(station);
    station += lengths[index];
  }
  const angleDelta = (a, b) => Math.atan2(Math.sin(b - a), Math.cos(b - a));
  const tangent = (index) => {
    const from = path[index],
      to = path[(index + 1) % path.length];
    return { yaw: Math.atan2(to[0] - from[0], to[2] - from[2]), slope: Math.atan2(to[1] - from[1], lengths[index]) };
  };
  const gradients = path.map((origin, index) => {
    let xx = 0,
      xz = 0,
      zz = 0,
      xy = 0,
      zy = 0;
    for (const point of path) {
      const x = point[0] - origin[0],
        z = point[2] - origin[2],
        y = point[1] - origin[1];
      const radius = Math.hypot(x, z);
      if (radius > 0.75) continue;
      const weight = Math.exp((-radius * radius) / 0.18);
      xx += x * x * weight;
      xz += x * z * weight;
      zz += z * z * weight;
      xy += x * y * weight;
      zy += z * y * weight;
    }
    const determinant = xx * zz - xz * xz;
    if (determinant > (xx + zz) ** 2 * 0.01) return [(xy * zz - zy * xz) / determinant, (zy * xx - xy * xz) / determinant];
    const direction = tangent(index),
      grade = Math.tan(direction.slope);
    return [Math.sin(direction.yaw) * grade, Math.cos(direction.yaw) * grade];
  });
  function point(distance) {
    let d = wrap(distance, length);
    for (let index = 0; index < path.length; index++) {
      if (d <= lengths[index] || index === path.length - 1) return mix(path[index], path[(index + 1) % path.length], d / lengths[index]);
      d -= lengths[index];
    }
  }
  function sample(distance) {
    const position = point(distance),
      d = wrap(distance, length);
    let segment = vertices.findLastIndex((vertex) => vertex <= d),
      { yaw, slope } = tangent(segment);
    let strongest = 0;
    for (let index = 0; index < vertices.length; index++) {
      // The initial preview begins facing the first segment, rather than
      // inheriting a fictional pre-scene stance on the closing half-turn.
      if (index === 0 && distance < 0.35) continue;
      const delta = wrap(d - vertices[index] + length / 2, length) - length / 2;
      if (Math.abs(delta) >= 0.35) continue;
      const before = tangent((index + path.length - 1) % path.length),
        after = tangent(index);
      const turn = angleDelta(before.yaw, after.yaw),
        strength = Math.abs(turn) * (1 - Math.abs(delta) / 0.35);
      if (strength <= strongest) continue;
      strongest = strength;
      const blend = smooth((delta + 0.35) / 0.7);
      yaw = before.yaw + turn * blend;
      slope = before.slope + (after.slope - before.slope) * blend;
    }
    const segmentU = (d - vertices[segment]) / lengths[segment];
    const gradient = mix(gradients[segment], gradients[(segment + 1) % path.length], segmentU);
    slope = Math.atan(gradient[0] * Math.sin(yaw) + gradient[1] * Math.cos(yaw));
    return { position, yaw, slope, gradient };
  }
  return { length, point, sample };
}

export function plantedFoot(distance, offset, stride = 0.18, stance = 0.68) {
  const phase = distance / stride + offset,
    cycle = Math.floor(phase),
    u = phase - cycle;
  const anchor = (cycle - offset + stance * 0.5) * stride;
  const swing = clamp((u - stance) / (1 - stance));
  return {
    anchorDistance: anchor + stride * smooth(swing),
    lift: u <= stance ? 0 : Math.sin(Math.PI * swing) ** 2,
    contact: u <= stance,
    phase: u,
  };
}

export function raccoonMotion(time, evening, routeLength) {
  const t = activeTime(time),
    cycle = wrap(t, 48),
    duration = evening ? 18 : 5;
  const walking = cycle < duration;
  const activity = smooth(cycle / 0.35) * (1 - smooth((cycle - duration + 0.45) / 0.45));
  const look = smooth((cycle - duration) / 0.8) * (1 - smooth((cycle - 25) / 1));
  const groom = smooth((cycle - 27) / 0.7) * (1 - smooth((cycle - 33) / 0.8));
  return {
    distance: (Math.floor(t / 48) + smooth(cycle / duration)) * routeLength * 0.25,
    activity,
    state: walking ? "walk" : cycle < 26 ? "look" : cycle < 34 ? "groom" : "rest",
    headYaw: look * Math.sin((cycle - duration) * 0.36) * 0.25,
    headPitch: groom * (0.16 + Math.sin((cycle - 27) * 1.9) * 0.04),
    earAnswer: Math.sin(Math.PI * clamp((cycle - duration - 2) / 1.1)) ** 2 * 0.15,
    tailYaw: Math.sin(t * 0.45 - 0.35) * (0.035 + activity * 0.055),
  };
}

export function shorebirdMotion(time, index) {
  const t = activeTime(time) + index * 4,
    cycle = wrap(t, 24);
  const phase = Math.floor(t / 24) + smooth(cycle / 5);
  const angle = wrap(phase, Math.PI * 2),
    lap = Math.floor(phase / (Math.PI * 2));
  const arc = angle < Math.PI / 2 ? Math.sin(angle) : angle < Math.PI * 1.5 ? 2 - Math.sin(angle) : 4 + Math.sin(angle);
  const look = smooth((cycle - 5) / 0.4) * (1 - smooth((cycle - 10) / 0.6));
  const probe = smooth((cycle - 12) / 0.5) * (1 - smooth((cycle - 16) / 0.5));
  return {
    x: -6 + index * 4.1 + Math.sin(phase) * 1.3,
    distance: (lap * 4 + arc) * 1.3,
    activity: smooth(cycle / 0.25) * (1 - smooth((cycle - 4.65) / 0.35)),
    state: cycle < 5 ? "walk" : cycle < 11 ? "look" : cycle < 17 ? "probe" : "rest",
    // A short pivot at the zero-speed end of each probing pass replaces an
    // instantaneous half-turn. Stance feet keep their own world orientation.
    yaw: Math.atan2(Math.cos(phase), Math.sin(phase) * 0.12),
    headYaw: look * Math.sin((cycle - 5) * 0.8) * 0.25,
    headPitch: probe * (0.25 + Math.sin((cycle - 12) * 3.8) * 0.05),
  };
}

function orbit(time, index) {
  const rate = 0.06 + index * 0.008,
    angle = time * rate + index * 1.5;
  const x = 12 + index * 1.8,
    z = 5 + index;
  return {
    position: [Math.cos(angle) * x, 8 + index * 0.85 + Math.sin(angle * 2) * 0.3, -26 - Math.sin(angle) * z],
    velocity: [-Math.sin(angle) * x * rate, Math.cos(angle * 2) * 0.6 * rate, -Math.cos(angle) * z * rate],
    acceleration: [-Math.cos(angle) * x * rate ** 2, -Math.sin(angle * 2) * 1.2 * rate ** 2, Math.sin(angle) * z * rate ** 2],
  };
}

function transfer(from, to, u, duration, arcHeight) {
  const position = [],
    velocity = [],
    acceleration = [];
  for (let axis = 0; axis < 3; axis++) {
    const a = from.position[axis],
      b = from.velocity[axis] * duration,
      c = from.acceleration[axis] * duration ** 2 * 0.5;
    const delta = to.position[axis] - a - b - c,
      speed = to.velocity[axis] * duration - b - 2 * c;
    const accel = to.acceleration[axis] * duration ** 2 - 2 * c;
    const d = 10 * delta - 4 * speed + accel * 0.5,
      e = -15 * delta + 7 * speed - accel,
      f = 6 * delta - 3 * speed + accel * 0.5;
    position.push(a + b * u + c * u ** 2 + d * u ** 3 + e * u ** 4 + f * u ** 5);
    velocity.push((b + 2 * c * u + 3 * d * u ** 2 + 4 * e * u ** 3 + 5 * f * u ** 4) / duration);
    acceleration.push((2 * c + 6 * d * u + 12 * e * u ** 2 + 20 * f * u ** 3) / duration ** 2);
  }
  // The lift bump has zero position, velocity and acceleration at both ends.
  position[1] += arcHeight * 64 * u ** 3 * (1 - u) ** 3;
  velocity[1] += (arcHeight * 192 * u ** 2 * (1 - u) ** 2 * (1 - 2 * u)) / duration;
  acceleration[1] += (arcHeight * 384 * u * (1 - u) * (1 - 5 * u + 5 * u ** 2)) / duration ** 2;
  return { position, velocity, acceleration };
}

export function gullMotion(time, index, perch) {
  const t = activeTime(time),
    cycle = wrap(t + index * 19, 90),
    start = t - cycle;
  const still = { position: perch, velocity: [0, 0, 0], acceleration: [0, 0, 0] };
  let pose, state;
  if (cycle < 48) {
    pose = orbit(t, index);
    state = "glide";
  } else if (cycle < 68) {
    pose = transfer(orbit(start + 48, index), still, (cycle - 48) / 20, 20, 1.1);
    state = "approach";
  } else if (cycle < 86) {
    pose = still;
    state = "perch";
  } else {
    pose = transfer(still, orbit(start + 90, index), (cycle - 86) / 4, 4, 2.1);
    state = "depart";
  }
  const landingDirection = transfer(orbit(start + 48, index), still, 0.999, 20, 1.1).velocity;
  const direction = state === "perch" ? landingDirection : pose.velocity;
  const horizontal = Math.hypot(direction[0], direction[2]);
  const landingYaw = Math.atan2(landingDirection[0], landingDirection[2]),
    flightYaw = Math.atan2(direction[0], direction[2]);
  const yawDelta = Math.atan2(Math.sin(flightYaw - landingYaw), Math.cos(flightYaw - landingYaw));
  const flapCycle = wrap(t + index, 12);
  const ordinaryFlap = smooth(flapCycle / 0.25) * (1 - smooth((flapCycle - 2.6) / 0.4));
  const departBlend = smooth((cycle - 89.5) / 0.5);
  const flapStrength =
    state === "depart"
      ? smooth((cycle - 86) / 0.15) * (1 - departBlend) + ordinaryFlap * departBlend
      : state === "approach"
        ? smooth((cycle - 64) / 0.45) * (1 - smooth((cycle - 67.65) / 0.35))
        : state === "glide"
          ? ordinaryFlap
          : 0;
  const look = state === "perch" ? smooth((cycle - 71) / 1) * (1 - smooth((cycle - 80) / 1)) : 0;
  return {
    ...pose,
    state,
    yaw: state === "depart" ? landingYaw + yawDelta * smooth((cycle - 86) / 0.3) : flightYaw,
    pitch:
      state === "perch"
        ? 0
        : -Math.atan2(direction[1], horizontal) *
          (state === "approach" ? 1 - smooth((cycle - 66) / 2) : state === "depart" ? smooth((cycle - 86) / 0.35) : 1),
    bank:
      (state === "glide" ? 1 : state === "depart" ? departBlend : state === "approach" ? 1 - smooth((cycle - 48) / 0.6) : 0) *
      Math.max(
        -0.18,
        Math.min(0.18, ((pose.velocity[2] * pose.acceleration[0] - pose.velocity[0] * pose.acceleration[2]) / Math.max(0.01, horizontal ** 2)) * 1.8)
      ),
    wingFold: state === "perch" ? 1 : state === "depart" ? 1 - smooth((cycle - 86) / 0.3) : state === "approach" ? smooth((cycle - 67.65) / 0.35) : 0,
    wingBeat: Math.sin(t * 5.5 + index * 0.8) * 0.38 * flapStrength + 0.025 * Math.sin(t * 0.7 + index) * (1 - flapStrength),
    headYaw: look * Math.sin((cycle - 71) * 0.7) * 0.2,
    blink: Math.sin(Math.PI * clamp(wrap(t + index * 1.7, 9.4) / 0.18)) ** 2,
    footDeploy: state === "perch" ? 1 : state === "approach" ? smooth((cycle - 65) / 1.4) : state === "depart" ? 1 - smooth((cycle - 86) / 0.5) : 0,
  };
}
