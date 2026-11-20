import { ORBIT_DIRECTION } from "./camera.mjs";
import { SEA_LEVEL } from "./sea-optics.mjs";

const anchor = (name, offset) => ({ anchor: name, offset });
const lookAtSea = (eye) => [eye[0] + 12, -6.2, eye[2] - 56];
const coastFrame = [-25, 38, -96];
const closerCoast = [-17, 30, -73];
const subject = [2.5, 0.4, 0];
const keys = (eyes, target) =>
  eyes.map((eye, i) => ({
    at: eyes.length === 1 ? 0 : i / (eyes.length - 1),
    eye,
    target: typeof target === "function" ? target(eye, i) : target,
  }));

function roomTripod(config, roomId) {
  const room = config.rooms?.find((entry) => entry.id === roomId);
  if (!room?.camera || !room.target) return null;
  const direction = ORBIT_DIRECTION(room.camera.yaw, room.camera.pitch);
  return { point: room.target.map((value, i) => value + room.camera.radius * direction[i]), target: room.target };
}

const fixed = (config, room, id, caption, minute, eye, target, { look, activity, fov = 33 } = {}) => {
  const authored = roomTripod(config, room);
  return {
    id,
    caption,
    duration: 5,
    minute,
    room,
    fov,
    look,
    activity,
    keys: keys([eye ?? authored?.point], target ?? authored?.target),
  };
};

// The straight arrival's public Walk route owns its eye positions. Meter-based
// keys keep the longer landings and stair treads at the same physical speed.
export const FILM_STAIR_EYE = 1.5;
const arrivalPoint = ([x, floor, z], height) => [x, floor + height, z];
const span = (a, b) => Math.hypot(...a.map((n, i) => n - b[i]));

function straightArrivalEyes(config) {
  return config.entrance?.straightDescent && config.walk?.mainEntryRoute?.length > 1
    ? config.walk.mainEntryRoute.map((point) => arrivalPoint(point, FILM_STAIR_EYE))
    : null;
}

function straightArrivalKeys(eyes) {
  if (!eyes) return null;
  let total = 0;
  const offsets = eyes.map((p, i) => (total += i ? span(p, eyes[i - 1]) : 0));
  if (!(total > 0)) return null;
  const [x, y, z] = eyes.at(-1);
  const reveal = [x, y - 0.14, z - 3.4];
  return eyes.map((eye, i) => ({
    at: offsets[i] / total,
    eye,
    target: eyes[i + 4]?.map((value, axis) => (axis === 1 ? value + 0.23 : value)) ?? reveal,
  }));
}

export function visitorRailRegions(config) {
  const previous = config.visitorFilm?.collisionRegions ?? [];
  const eyes = straightArrivalEyes(config);
  const hall = config.entrance?.hall;
  if (!eyes || !hall) return previous;
  // The local field now follows the full live hall from clifftop to the foyer.
  // Its small cell and the same collision classification still protect the near plane.
  return [
    {
      min: [hall.min[0] - 0.3, hall.min[1] - 0.3, Math.min(hall.min[2], eyes.at(-1)[2]) - 0.5],
      max: hall.max.map((value) => value + 0.3),
      cell: 0.1,
      air: eyes.filter((_, i) => i % 8 === 0 || i === eyes.length - 1),
    },
    ...previous.slice(1),
  ];
}

export function visitorRailShots(config) {
  const extra = config.visitorFilm ?? {};
  const landmarks = extra.landmarks ?? {};
  const shots = [
    {
      id: "coast-dawn",
      caption: "The coast at dawn",
      duration: 12,
      minute: 390,
      room: "outside",
      fov: 18,
      keys: keys([coastFrame, closerCoast], subject),
    },
    {
      id: "living-floor",
      caption: "The living floor",
      duration: 15,
      minute: 557,
      room: "lounge",
      fov: 39,
      activity: "lounge",
      keys: keys(
        [
          [2.09, 1.602618, 4.44],
          [0.64, 1.602618, 4.44],
        ],
        [-0.2, 0.95, 7.5]
      ),
    },
    fixed(config, "kitchen", "breakfast", "Breakfast", 486, [-0.74146, 1.602618, 4.76407], undefined, { activity: "breakfast" }),
    fixed(config, "study", "desk", "At the desk", 736, [-10.7, 1.611915, 3.85], [-10.8, 1.35, 5.15], { look: "paint", activity: "work" }),
    fixed(config, "gym", "training", "Training at dusk", 1115, [9.31, 1.61793, 4.16], [9.48, 1.3, 2.8], {
      look: "paint",
      activity: "rowing",
      fov: 47,
    }),
    fixed(config, "onsen", "onsen", "The upper bath at night", 1295, [2.215, 4.202397, 9.847], undefined, {
      look: "paint",
      activity: "soak",
      fov: 45,
    }),
    {
      id: "section",
      caption: "The cliff in section",
      duration: 10,
      minute: 725,
      room: "overview",
      fov: 33,
      look: "paint",
      keys: keys(
        [
          [0, 10.2, -8.6],
          [0, 17.5, -8.6],
        ],
        [0.35, 2.7, 6.9]
      ),
    },
    {
      id: "coast-dusk",
      caption: "Dusk from the sea",
      duration: 14,
      minute: [1120, 1170],
      room: "outside",
      fov: 18,
      look: "paint",
      keys: keys([closerCoast, coastFrame], subject),
    },
    { id: "coast-night", caption: "Night on the coast", duration: 6, minute: 1275, room: "outside", fov: 18, keys: keys([coastFrame], subject) },
  ];
  if (config.estateOutdoors?.pavilion?.coveredKitchen) {
    shots.splice(
      2,
      0,
      fixed(config, "outside", "dining-terrace", "Dining under the study roof", 581, [-9.61, 1.601, 0.32], [-10.55, 0.94, -3.55], { fov: 52 })
    );
  }
  const arrival =
    straightArrivalKeys(straightArrivalEyes(config)) ??
    (Array.isArray(extra.arrivalKeys) && extra.arrivalKeys.length
      ? extra.arrivalKeys
      : extra.arrival === true && landmarks.arrivalReveal
        ? keys(
            [
              ...(config.walk?.mainEntryRoute ?? []).slice(0, -3).map(([x, floor, z]) => [x, floor + 1.6, z]),
              ...(landmarks.arrivalThreshold ? [anchor("arrivalThreshold")] : []),
            ],
            (_eye, i) => {
              const point = config.walk?.mainEntryRoute?.[i + 3];
              return point && i + 3 < config.walk.mainEntryRoute.length - 3 ? [point[0], point[1] + 1.35, point[2]] : anchor("arrivalReveal");
            }
          )
        : null);
  if (arrival?.length) {
    shots.splice(1, 0, {
      id: "arrival",
      caption: "Down the arrival stair",
      duration: 14,
      minute: 530,
      room: config.entrance?.straightDescent ? "lounge" : "library",
      fov: 53,
      keys: arrival,
    });
  }
  const insertAt = shots.findIndex((shot) => shot.id === "coast-dusk");
  if (landmarks.listeningSeat && landmarks.soundCabinet) {
    const standing = config.walk?.places?.speakeasy?.position;
    shots.splice(insertAt, 0, {
      id: "listening-room",
      caption: "Behind the bookcase",
      duration: 10,
      minute: 1188,
      room: "study",
      fov: 46,
      look: "paint",
      // Optional authored approach must follow the actual opened door and clear the bench.
      keys: keys(extra.listeningApproach ?? [standing ? arrivalPoint(standing, 1.6) : anchor("listeningSeat")], anchor("soundCabinet")),
    });
  }
  const cab = config.cliffLift;
  const dockMatches = (eye, dock) =>
    Array.isArray(eye) &&
    Array.isArray(cab?.center) &&
    Math.abs(eye[0] - cab.center[0]) <= 0.25 &&
    Math.abs(eye[2] - cab.center[1]) <= 0.25 &&
    Math.abs(eye[1] - (cab.stops?.[dock]?.height + 1.6)) <= 0.09;
  if (extra.stageLift === true && dockMatches(landmarks.liftCabTop, "top") && dockMatches(landmarks.liftCabBeach, "beach")) {
    shots.splice(
      shots.findIndex((shot) => shot.id === "coast-dusk"),
      0,
      {
        id: "glass-lift",
        caption: "The glass lift down",
        duration: 12,
        minute: 1152,
        room: "outside",
        fov: 53,
        lift: true,
        keys: keys(
          [anchor("liftCabTop"), anchor("liftCabBeach")],
          (_, i) => extra.liftTargets?.[i] ?? anchor(i ? "liftCabBeach" : "liftCabTop", [0, -0.12, -8])
        ),
      }
    );
  }
  const y = SEA_LEVEL + 1.72;
  const boatEyes = [
    [-28, y, -27.6],
    [-16, y, -27.8],
    [2, y, -28.5],
    [17, y, -30.2],
    [31, y, -31.0],
  ];
  const boatTargets = [
    [-17, 1.0, 4],
    [-8.5, 1.1, 1.5],
    [1.5, 0.1, 1.0],
    [7, 0.8, 0.4],
    [12, 1.6, 2.5],
  ];
  const boat = [
    {
      id: "boat-west",
      caption: "Along the bluff",
      duration: 17,
      minute: 1040,
      room: "outside",
      kind: "boat",
      fov: 53,
      keys: keys(boatEyes.slice(0, 3), (_, i) => boatTargets[i]),
    },
    {
      id: "boat-east",
      caption: "Past the house",
      duration: 16,
      minute: 1040,
      room: "outside",
      kind: "boat",
      fov: 53,
      keys: keys(boatEyes.slice(2), (_, i) => boatTargets[i + 2]),
    },
  ];
  const timed = (shot) => ({
    ...shot,
    minute: extra.minutes?.[shot.id] ?? shot.minute,
    keys: extra.shotKeys?.[shot.id] ?? shot.keys,
  });
  return { shots: shots.map(timed), boat: boat.map(timed), landmarks };
}
