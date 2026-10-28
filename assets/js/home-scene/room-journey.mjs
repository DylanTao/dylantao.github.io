const clamp = (x) => Math.max(0, Math.min(1, x));
const smooth = (x) => (x = clamp(x)) * x * (3 - 2 * x);
const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
const distance = (a, b) => Math.hypot(...a.map((v, i) => v - b[i]));
const angle = (a, b, t) => a + Math.atan2(Math.sin(b - a), Math.cos(b - a)) * t;

export function verifiedRoomTransfer(room, avatarId) {
  return !room?.bedTransfer || Boolean(room.bedTransfer.verifiedTransferAvatars?.includes(avatarId));
}

// Parameterize the existing supported polyline by time without changing its
// geometry. A riser gets a whole, slower step; flat walking keeps its own pace.
export function timeSupportedRoute(route, { flatSpeed = 1.1, stairSpeed = 0.45, minimumStairSeconds = 0.8 } = {}) {
  if (!route?.points || route.points.length < 2 || [flatSpeed, stairSpeed, minimumStairSeconds].some((v) => !(v > 0)))
    throw new TypeError("A supported route and positive gait timings are required");
  const segments = [],
    times = [0];
  for (let i = 1; i < route.points.length; i++) {
    const a = route.points[i - 1],
      b = route.points[i],
      length = distance(a, b),
      onStairs = Math.abs(b[1] - a[1]) > 0.01;
    if (!Number.isFinite(length) || length < 1e-8) throw new TypeError("A route must contain finite, distinct consecutive points");
    const seconds = Math.max(onStairs ? minimumStairSeconds : 0.15, length / (onStairs ? stairSpeed : flatSpeed));
    segments.push({ a, b, seconds, onStairs, speed: length / seconds });
    times.push(times.at(-1) + seconds);
  }
  return {
    duration: times.at(-1),
    times,
    pose(seconds) {
      const time = Math.max(0, Math.min(times.at(-1), seconds));
      let i = times.findIndex((v, i) => i > 0 && v >= time);
      if (i < 1) i = segments.length;
      const segment = segments[i - 1],
        u = clamp((time - times[i - 1]) / segment.seconds);
      return {
        position: mix(segment.a, segment.b, u),
        facing: Math.atan2(segment.b[0] - segment.a[0], segment.b[2] - segment.a[2]),
        onStairs: segment.onStairs,
        walkingSpeed: segment.speed,
        clip: "walk",
        phase: segment.onStairs ? "taking the stairs" : "walking to the next room",
        segment: i - 1,
      };
    },
  };
}

// Authored transfers are distinct from a supported walking route. In
// particular, a lying root is never projected onto the floor inside the bed.
// The caller fits seatedRoot to the delivered cloth and binds avatar contacts
// to the actual GLB bytes before constructing this timeline.
export function roomTransfer(room, clip, { seatedRoot, avatarId } = {}) {
  if (!room?.walkActor) return null;
  const spec = room.bedTransfer;
  if (spec && clip === "sleep") {
    if (!seatedRoot?.every(Number.isFinite)) throw new TypeError("Bed transfer requires the measured, cloth-fitted seated root");
    const feet = spec.feetByAvatar?.[avatarId] || spec.feet,
      duration = 6.2,
      rollSeconds = 2.8,
      pauseSeconds = 1,
      riseSeconds = duration - rollSeconds - pauseSeconds,
      facing = spec.seat.facing;
    if (!feet?.L?.position || !feet?.R?.position) throw new TypeError("Bed transfer requires actual per-side floor contacts");
    return {
      duration,
      length: distance(spec.lyingActor, seatedRoot) + distance(seatedRoot, spec.standingActor),
      pose(seconds) {
        const t = Math.max(0, Math.min(duration, seconds));
        if (t < rollSeconds) {
          const u = smooth(t / rollSeconds);
          return {
            position: mix(spec.lyingActor, seatedRoot, u),
            facing: angle(room.facing, facing, u),
            blend: { from: "sleep", to: "lounge", weight: u },
            feet,
            plantedWeight: smooth((t / rollSeconds - 0.88) / 0.12),
            phase: "turning to sit at the bed edge",
          };
        }
        if (t < rollSeconds + pauseSeconds)
          return {
            position: [...seatedRoot],
            facing,
            clip: "lounge",
            feet,
            plantedWeight: 1,
            phase: "seated with feet on the floor",
          };
        const progress = (t - rollSeconds - pauseSeconds) / riseSeconds,
          u = smooth(progress);
        return {
          position: mix(seatedRoot, spec.standingActor, u),
          facing,
          blend: { from: "lounge", to: "idle", weight: u },
          feet,
          plantedWeight: 1 - smooth((progress - 0.25) / 0.45),
          phase: "standing beside the bed",
        };
      },
    };
  }
  // This is the room's seated visit spot, never a different furniture station
  // that happens to belong to the same room.
  if (distance(room.actor, room.walkActor) < 0.01 || /walk|idle/.test(clip)) return null;
  return {
    duration: 2.2,
    length: distance(room.actor, room.walkActor),
    pose(seconds) {
      const u = smooth(seconds / 2.2);
      return {
        position: mix(room.actor, room.walkActor, u),
        facing: room.facing,
        blend: { from: clip, to: "idle", weight: u },
        phase: "leaving the chair",
      };
    },
  };
}

export function createRoomJourney({ route, departure = null, arrival = null }) {
  const walking = timeSupportedRoute(route),
    departureSeconds = departure?.duration || 0,
    arrivalSeconds = arrival?.duration || 0,
    duration = departureSeconds + walking.duration + arrivalSeconds;
  return {
    duration,
    walkingSeconds: walking.duration,
    length: route.length + (departure?.length || 0) + (arrival?.length || 0),
    pose(seconds) {
      if (departure && seconds < departureSeconds) return { ...departure.pose(seconds), transfer: "departure", done: false };
      if (arrival && seconds >= departureSeconds + walking.duration) {
        const pose = arrival.pose(Math.max(0, duration - seconds)),
          phase =
            {
              "standing beside the bed": "sitting down at the bed edge",
              "turning to sit at the bed edge": "lying down from the bed edge",
              "leaving the chair": "sitting at the desk",
            }[pose.phase] || pose.phase;
        return {
          ...pose,
          phase,
          transfer: "arrival",
          done: seconds >= duration,
        };
      }
      return { ...walking.pose(seconds - departureSeconds), transfer: null, done: seconds >= duration };
    },
  };
}
