const STOPS = ["top", "beach"];
const PARTS = ["cab", "cabDoorTop", "cabDoorBeach", "topGate", "beachGate"];
const LEAVES = { cabDoorTop: "top", cabDoorBeach: "beach", topGate: "top", beachGate: "beach" };
const DOOR_SECONDS = 0.42;
const EXIT_SECONDS = 0.94;
const DECK_TOLERANCE = 0.1;
const LIP_TOLERANCE = 0.035;
const WALL_CLEARANCE = 0.045;
const PORTAL_CLEARANCE = 0.008;
const EXIT_CLEARANCE = 0.56;
const GATE_SKIN = 0.012;
const GATE_HEADROOM = 2.15;

const clamp = (n, min, max) => Math.min(max, Math.max(min, n));
const mix = (a, b, t) => a + (b - a) * t;
const ease = (t) => t * t * t * (t * (t * 6 - 15) + 10);
const otherStop = (id) => (id === "top" ? "beach" : "top");
const pointInside = (x, z, bounds, extra = 0) =>
  x >= bounds.min[0] - extra && x <= bounds.max[0] + extra && z >= bounds.min[1] - extra && z <= bounds.max[1] + extra;

// Socket coordinates use the same [x, up, seaward-negative-z] frame as Walk.
export function createCliffLift(plan, { paint = () => {}, requestFrame = () => {}, radius = 0.24 } = {}) {
  const [x, z] = plan.center;
  const [width, depth] = plan.size;
  const opening = Math.min(width, depth, plan.opening ?? 1.08);
  const duration = plan.duration ?? 6.2;
  const thresholdSupport = radius + 0.1;
  const sideInterior = width / 2 - radius - WALL_CLEARANCE;
  const endInterior = depth / 2 - radius - WALL_CLEARANCE;
  const portalInterior = opening / 2 - radius - PORTAL_CLEARANCE;
  if (![x, z, width, depth, opening, duration, radius].every(Number.isFinite) || portalInterior <= 0 || endInterior <= 0 || duration <= 0) {
    throw new RangeError("Invalid cliff lift cabin");
  }
  const stops = Object.fromEntries(
    STOPS.map((id) => {
      const { label, height, side, pad, axis = "z" } = plan.stops[id];
      const along = axis === "x" ? 0 : 2;
      const across = 2 - along;
      const half = (axis === "x" ? width : depth) / 2;
      const landing = [x, height, z];
      const edge = landing[along] + side * half;
      landing[along] = edge + side * EXIT_CLEARANCE;
      if (
        !label ||
        ![height, ...pad.min, ...pad.max].every(Number.isFinite) ||
        !["x", "z"].includes(axis) ||
        ![-1, 1].includes(side) ||
        !pointInside(landing[0], landing[2], pad)
      ) {
        throw new RangeError("Invalid cliff lift stop " + id);
      }
      return [id, { label, height, side, pad, along, across, half, edge, landing }];
    })
  );
  if (stops.top.height <= stops.beach.height) throw new RangeError("Cliff lift stops are reversed");

  // Walk cannot enter a shaft with its ordinary airborne solver. The cabin deck and
  // moving leaves are outside the static field, so only the supported handoff below
  // opens a passage for the capsule. The solid gate remains in every fallback sweep.
  const gateBarriers = Object.values(stops).map((dock) => {
    const min = [x - width / 2, z - depth / 2];
    const max = [x + width / 2, z + depth / 2];
    const along = dock.along / 2;
    min[along] = dock.edge - GATE_SKIN;
    max[along] = dock.edge + GATE_SKIN;
    return { min, max, bottom: dock.height - DECK_TOLERANCE, top: dock.height + GATE_HEADROOM };
  });

  const lengths = { closing: DOOR_SECONDS, travelling: duration, opening: DOOR_SECONDS, leaving: EXIT_SECONDS };

  let phase = "docked";
  let stop = "top";
  let target = null;
  let height = stops.top.height;
  let door = 1;
  let elapsed = 0;
  let boarded = false;
  let rider = null;
  let exit = null;
  let lastVisual = null;
  let preview = null;

  function visual() {
    if (lastVisual?.height === height && lastVisual.stop === stop && lastVisual.door === door) return;
    lastVisual = { height, stop, door };
    paint(lastVisual);
  }

  function setPhase(next) {
    phase = next;
    elapsed = 0;
  }

  function stageFilm(progress) {
    if (boarded || phase !== "docked" || !Number.isFinite(progress)) return false;
    const fraction = clamp(progress, 0, 1);
    if (preview === fraction) return true;
    preview = fraction;
    paint({ height: mix(stops.top.height, stops.beach.height, fraction), stop: fraction < 0.5 ? "top" : "beach", door: 0 });
    return true;
  }

  function releaseFilm() {
    if (preview === null) return;
    preview = null;
    lastVisual = null;
    visual();
  }

  function update(dt) {
    if (preview !== null) return;
    let remaining = clamp(Number.isFinite(dt) ? dt : 0, 0, 0.25);
    while (remaining > 0 && lengths[phase]) {
      const seconds = lengths[phase];
      const used = Math.min(remaining, seconds - elapsed);
      elapsed += used;
      remaining -= used;
      const fraction = elapsed / seconds;
      if (phase === "closing") door = 1 - ease(fraction);
      if (phase === "travelling") height = mix(stops[stop].height, stops[target].height, ease(fraction));
      if (phase === "opening") door = ease(fraction);
      if (elapsed < seconds) break;
      switch (phase) {
        case "closing":
          setPhase("travelling");
          break;
        case "travelling":
          stop = target;
          height = stops[stop].height;
          setPhase("opening");
          break;
        case "opening":
          setPhase(rider ? "checkLanding" : "docked");
          if (!rider) target = null;
          break;
        case "leaving":
          setPhase("stepOff");
          break;
      }
    }
    visual();
  }

  function inPortal(dock, lateral) {
    return Math.abs(lateral - dock.landing[dock.across]) <= portalInterior;
  }

  function supportedExit(dock, stand) {
    const marker = dock.landing;
    const found = stand(marker);
    if (
      !found ||
      !found.every(Number.isFinite) ||
      Math.abs(found[1] - dock.height) > DECK_TOLERANCE ||
      Math.hypot(found[0] - marker[0], found[2] - marker[2]) > LIP_TOLERANCE ||
      !pointInside(found[0], found[2], dock.pad)
    ) {
      return null;
    }
    return found;
  }

  function canRide(pose) {
    const position = pose?.position;
    return Boolean(
      phase === "docked" &&
      boarded &&
      pose.active &&
      pose.grounded &&
      !pose.wet &&
      Math.abs(position[0] - x) <= sideInterior + 1e-5 &&
      Math.abs(position[1] - height) <= DECK_TOLERANCE &&
      Math.abs(position[2] - z) <= endInterior + 1e-5
    );
  }

  function canCall(pose) {
    if (phase !== "docked" || boarded || !pose?.active || !pose.grounded || pose.wet) return false;
    const dock = stops[otherStop(stop)];
    const [px, py, pz] = pose.position;
    const approach = dock.side * (pose.position[dock.along] - dock.edge);
    return pointInside(px, pz, dock.pad) && Math.abs(py - dock.height) <= DECK_TOLERANCE && approach >= 0 && approach <= 1.1;
  }

  function requestRide(pose, stand) {
    if (preview !== null) return false;
    const movingRider = canRide(pose);
    if (!movingRider && !canCall(pose)) return false;
    const destination = otherStop(stop);
    if (movingRider && !supportedExit(stops[destination], stand)) return false;
    target = destination;
    rider = movingRider ? [...pose.position] : null;
    setPhase("closing");
    requestFrame();
    return true;
  }

  function control(pose) {
    if (rider) return { label: "Lift to " + stops[target].label, disabled: true };
    if (canRide(pose)) return { label: "Ride lift to " + stops[otherStop(stop)].label, disabled: false };
    if (canCall(pose)) return { label: "Call lift", disabled: false };
    return null;
  }

  // A handled step belongs to this cabin. A null step belongs to the normal collision and flight field.
  // Look controls remain with Walk in all phases. Only its feet and horizontal movement are constrained.
  function constrain(pose, { dx = 0, dz = 0, jump = false } = {}, stand = () => null) {
    if (!pose.active) return null;
    const dock = stops[stop];
    const [px, py, pz] = pose.position;
    if (phase === "checkLanding" && rider) {
      exit = supportedExit(dock, stand);
      if (exit) setPhase("leaving");
      else {
        rider = null;
        target = null;
        setPhase("docked");
        return { position: [x, height, z] };
      }
    }
    if (phase === "stepOff" && exit) {
      const position = exit;
      boarded = false;
      rider = null;
      exit = null;
      target = null;
      setPhase("docked");
      return { position, released: true };
    }
    if (rider) {
      const t = phase === "closing" ? ease(elapsed / DOOR_SECONDS) : 1;
      if (phase === "leaving") {
        const reach = ease(elapsed / EXIT_SECONDS);
        const foot = [mix(x, exit[0], reach), mix(height, exit[1], reach), mix(z, exit[2], reach)];
        return { position: foot };
      }
      return { position: [mix(rider[0], x, t), height, mix(rider[2], z, t)] };
    }
    if (phase !== "docked") return null;

    const position = [px + dx, height, pz + dz];
    const near = dock.side * (pose.position[dock.along] - dock.edge);
    const next = dock.side * (position[dock.along] - dock.edge);
    const lateral = pose.position[dock.across];
    const nextLateral = position[dock.across];
    const portal = inPortal(dock, nextLateral) && inPortal(dock, lateral);
    if (!boarded) {
      if (
        jump ||
        !pose.grounded ||
        pose.wet ||
        Math.abs(py - height) > DECK_TOLERANCE ||
        near < -LIP_TOLERANCE ||
        next >= thresholdSupport ||
        next >= near ||
        !portal ||
        !pointInside(px, pz, dock.pad, LIP_TOLERANCE)
      ) {
        return null;
      }
      boarded = true;
    } else if (near <= thresholdSupport && next >= 0 && portal && pointInside(position[0], position[2], dock.pad, LIP_TOLERANCE)) {
      const ground = stand(position);
      if (ground && Math.abs(ground[1] - height) <= DECK_TOLERANCE && Math.hypot(ground[0] - position[0], ground[2] - position[2]) <= LIP_TOLERANCE) {
        boarded = false;
        return { position: ground, released: true, walking: true };
      }
    }

    const centre = dock.edge - dock.side * dock.half;
    const inner = dock.half - radius - WALL_CLEARANCE;
    const far = centre - dock.side * inner;
    const lip = centre + dock.side * (portal ? dock.half + thresholdSupport : inner);
    const lateralCentre = dock.landing[dock.across];
    const lateralRoom = dock.across === 0 ? sideInterior : endInterior;
    position[dock.across] = clamp(nextLateral, lateralCentre - lateralRoom, lateralCentre + lateralRoom);
    position[dock.along] = clamp(position[dock.along], Math.min(far, lip), Math.max(far, lip));
    return { position, walking: true };
  }

  function detach() {
    boarded = false;
    rider = null;
    exit = null;
    if (["checkLanding", "leaving", "stepOff"].includes(phase)) setPhase("docked");
  }

  visual();
  return {
    update,
    control,
    requestRide,
    constrain,
    gateBarriers,
    detach,
    stageFilm,
    releaseFilm,
    get filmAvailable() {
      return phase === "docked" && !boarded;
    },
    get boarded() {
      return boarded;
    },
    get busy() {
      return phase !== "docked";
    },
    evidence() {
      return { phase, stop, target, position: [x, height, z], door, boarded };
    },
  };
}

// The native exporter carries the owning part on each mesh node. Work in parent space, so
// glTF's transforms and authored material batches survive both the vertical run and the gate slides.
export function bindCliffLift(root, plan, requestFrame) {
  if (!root || !plan) return null;
  root.updateWorldMatrix(true, true);
  const nodes = [];
  root.traverse((object) => {
    const part = object.userData.cliffLiftPart;
    if (PARTS.includes(part) && !PARTS.includes(object.parent?.userData.cliffLiftPart)) nodes.push({ object, part });
  });
  if (!PARTS.every((part) => nodes.some((node) => node.part === part))) return null;
  if (nodes.some(({ object, part }) => LEAVES[part] && !Number.isFinite(object.userData.cliffLiftSlide))) return null;

  const groups = nodes.map(({ object, part }) => {
    const rest = object.position.clone();
    const origin = rest.clone().set(0, 0, 0);
    const slideAlongZ = plan.stops[LEAVES[part]]?.axis === "x";
    const slideAxis = rest.clone().set(slideAlongZ ? 0 : 1, 0, slideAlongZ ? 1 : 0);
    const worldY = rest.clone().set(0, 1, 0);
    if (object.parent) {
      object.parent.worldToLocal(origin);
      object.parent.worldToLocal(slideAxis);
      object.parent.worldToLocal(worldY);
    }
    object.traverse((node) => {
      node.userData.dynamic = true;
      node.userData.walk = "through";
    });
    return { object, part, rest, slideAxis: slideAxis.sub(origin), yAxis: worldY.sub(origin) };
  });
  const lift = createCliffLift(plan, {
    requestFrame,
    paint({ height, stop, door }) {
      for (const { object, part, rest, slideAxis, yAxis } of groups) {
        object.position.copy(rest);
        if (part.startsWith("cab")) object.position.addScaledVector(yAxis, height - plan.stops.top.height);
        if (LEAVES[part] === stop) object.position.addScaledVector(slideAxis, door * object.userData.cliffLiftSlide);
        object.updateMatrix();
        object.updateMatrixWorld(true);
      }
    },
  });
  lift.gateObjects = groups.filter(({ part }) => part === "topGate" || part === "beachGate").map(({ object }) => object);
  return lift;
}
