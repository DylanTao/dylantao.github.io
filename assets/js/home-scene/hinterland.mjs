import { bindGliders } from "./gliders.mjs";
import { coastWind } from "./wind-field.mjs";
import { bindWaterGarden } from "./water-garden.mjs";

// Runtime glue for the land beyond the mainland's walls (bin/build_coastal_hinterland.py, loaded
// lazily by the controller): the gliders, the gliderport's wind sock, and the outside camera's
// terrain grid.
//
// The retained grid (manifest `cameraCollision`) covers only the mainland and its beach. The build
// samples the new land into `hinterland.cameraGrid` on the same 2 m lattice; once the land is in
// the scene the two are merged so the camera cannot dip into it. Where both have a cell, the
// retained grid's value wins, so later changes to the mainland's grid carry through untouched.

export function mergeCameraGrid(base, extra) {
  if (!base || !extra?.elevations?.length || base.step !== extra.step) return base;
  const step = base.step;
  const offset = (a, b) => (a - b) / step;
  const aligned = (a, b) => Math.abs(offset(a, b) - Math.round(offset(a, b))) < 1e-6;
  if (!aligned(base.origin[0], extra.origin[0]) || !aligned(base.origin[1], extra.origin[1])) return base;
  const x0 = Math.min(base.origin[0], extra.origin[0]),
    z0 = Math.min(base.origin[1], extra.origin[1]),
    x1 = Math.max(base.origin[0] + (base.width - 1) * step, extra.origin[0] + (extra.width - 1) * step),
    z1 = Math.max(base.origin[1] + (base.height - 1) * step, extra.origin[1] + (extra.height - 1) * step);
  const width = Math.round((x1 - x0) / step) + 1,
    height = Math.round((z1 - z0) / step) + 1;
  // Cells neither grid samples are open sea: the lowest elevation either grid records.
  let floor = Infinity;
  for (const value of base.elevations) floor = Math.min(floor, value);
  const elevations = new Array(width * height).fill(floor);
  for (const grid of [extra, base]) {
    const di = Math.round(offset(grid.origin[0], x0)),
      dj = Math.round(offset(grid.origin[1], z0));
    for (let j = 0; j < grid.height; j++)
      for (let i = 0; i < grid.width; i++) elevations[(j + dj) * width + i + di] = grid.elevations[j * grid.width + i];
  }
  return { ...base, origin: [x0, z0], width, height, elevations };
}

// How a wind cone hangs (radians below horizontal) for the coast wind's `extension`, 0 in calm to 1
// at 15 knots: nearly straight down in still air, a few degrees below level when full.
export const sockDroop = (extension) => 0.05 + 1.2 * (1 - Math.min(1, Math.max(0, extension))) ** 1.4;

// The gliderport's wind sock follows the coast's one wind (wind-field.mjs coastWind.vane). The
// controller steps that wind at the start of each frame; the sock reads it when it is drawn, once
// per wind instant, so it turns and fills with the gusts and holds still whenever the wind does
// (pause, reduced motion, a hidden page). The node's local +Z runs from the hoop down the sock.
export function bindWindsock(root, entry, wind = coastWind) {
  const node = entry && root.getObjectByName(entry.node);
  if (!node || typeof wind?.vane !== "function") return null;
  const [x, , z] = entry.pivot;
  const vane = {},
    state = (node.userData.windsock = { yaw: 0, extension: 0, droop: 0, seconds: NaN });
  let posedSeconds = NaN,
    posedMinute = NaN;
  node.rotation.order = "YXZ";
  const pose = () => {
    const { seconds, minute } = wind.state;
    if (seconds === posedSeconds && minute === posedMinute) return;
    posedSeconds = seconds;
    posedMinute = minute;
    wind.vane(x, z, seconds, vane);
    state.yaw = vane.yaw;
    state.extension = vane.extension;
    state.droop = sockDroop(vane.extension);
    state.seconds = seconds;
    node.rotation.set(state.droop, vane.yaw, 0);
    // A slack sock bunches toward its hoop; the hoop itself stays round.
    node.scale.set(1, 1, 0.86 + 0.14 * vane.extension);
    node.updateMatrixWorld(true);
  };
  node.traverse((part) => {
    if (part.isMesh) part.onBeforeRender = pose;
  });
  pose();
  return { node, state, pose };
}

export function bindHinterland(root, config, clock, wind = coastWind) {
  const gliders = bindGliders(root, config.hinterland?.gliders, clock);
  const windsock = bindWindsock(root, config.hinterland?.windsock, wind);
  const waterGarden = bindWaterGarden(root, clock);
  config.cameraCollision = mergeCameraGrid(config.cameraCollision, config.hinterland?.cameraGrid);
  return { gliders, windsock, waterGarden };
}
