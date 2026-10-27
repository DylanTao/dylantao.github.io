const clamp = (t) => Math.max(0, Math.min(1, t));
const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
const distance = (a, b) => Math.hypot(...a.map((v, i) => v - b[i]));
const point = (p) => Array.isArray(p) && p.length === 3 && p.every(Number.isFinite);

// An outdoor activity station uses the actual terrace approach and camera; it
// does not create an empty model room or admit water to first-person walking.
export function poolActivityRoom(config, id = "terrace") {
  const spec = config.infinityPool?.activity;
  if (
    !spec ||
    !point(spec.entry) ||
    !point(spec.camera?.target) ||
    !point(spec.egress) ||
    !Array.isArray(spec.entranceRoute) ||
    spec.entranceRoute.length < 2
  )
    return null;
  return {
    id,
    label: "Pool terrace",
    actor: [...spec.entry],
    walkActor: [...spec.entry],
    floor: spec.entry[1],
    facing: Math.PI,
    target: [...spec.camera.target],
    camera: { ...spec.camera },
    egress: [...spec.egress],
    exitPath: spec.entranceRoute.map((p) => [...p]).reverse(),
  };
}

// A single supported entry, quiet standing pause, and reverse exit. These are
// authored kinematics on native tread contacts, without swimming/fluid dynamics.
export function createPoolActivity(spec) {
  if (!spec?.path || spec.path.length < 3 || !spec.path.every((p) => point(p.position) && p.supportId) || !spec.supportSurfaces?.length)
    throw new Error("Pool activity requires exported entry contacts and local supports");
  const points = spec.path.map((p) => [...p.position]);
  if (!point(spec.recovery) || distance(spec.recovery, points[0]) > 0.001) throw new Error("Pool recovery must return to its actual dry entry");
  for (const contact of spec.path) {
    const support = spec.supportSurfaces.find((s) => s.id === contact.supportId);
    if (!support || Math.abs(support.height - contact.position[1]) > 0.001) throw new Error("Pool contact has no matching native support height");
  }
  const times = [0];
  for (let i = 1; i < points.length; i++) {
    const stairs = Math.abs(points[i][1] - points[i - 1][1]) > 0.08;
    times.push(times.at(-1) + Math.max(stairs ? 0.8 : 0.7, distance(points[i], points[i - 1]) / (stairs ? 0.48 : 0.5)));
  }
  const entrySeconds = times.at(-1),
    pauseSeconds = 14,
    duration = 2 * entrySeconds + pauseSeconds;
  return {
    entrySeconds,
    pauseSeconds,
    duration,
    terrain: { supportSurfaces: spec.supportSurfaces },
    pose(seconds, { reduced = false } = {}) {
      const t = reduced ? entrySeconds + pauseSeconds / 2 : Math.max(0, Number(seconds) || 0);
      const resting = t >= entrySeconds && t < entrySeconds + pauseSeconds;
      const exiting = t >= entrySeconds + pauseSeconds && t < duration;
      const done = t >= duration;
      const routeTime = resting ? entrySeconds : exiting ? duration - t : done ? 0 : Math.min(t, entrySeconds);
      let i = times.findIndex((v, i) => i > 0 && v >= routeTime);
      if (i < 1) i = points.length - 1;
      const u = clamp((routeTime - times[i - 1]) / (times[i] - times[i - 1]));
      const a = points[i - 1],
        b = points[i];
      const speed = distance(a, b) / (times[i] - times[i - 1]);
      const facing = Math.atan2(b[0] - a[0], b[2] - a[2]) + (exiting ? Math.PI : 0);
      // Turn gently towards the court after arriving in the basin, ready for
      // the return up the same steps. The camera remains outside the water.
      const turn = clamp((t - entrySeconds) / 1.2),
        ease = turn * turn * (3 - 2 * turn);
      return {
        position: mix(a, b, u),
        facing: resting
          ? facing + Math.atan2(Math.sin((spec.pause?.facing ?? 0) - facing), Math.cos((spec.pause?.facing ?? 0) - facing)) * ease
          : done
            ? 0
            : facing,
        clip: resting || done ? "idle" : "walk",
        phase: resting ? "quiet in the water" : exiting ? "leaving the pool" : done ? "back on the dry deck" : "entering the pool",
        onStairs: !resting && !done && Math.abs(b[1] - a[1]) > 0.08,
        walkingSpeed: resting || done ? 0 : speed,
        supportIds: [spec.path[i - 1].supportId, spec.path[i].supportId],
        done,
        waterline: spec.waterline,
      };
    },
  };
}
