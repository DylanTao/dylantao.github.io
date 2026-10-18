// Builds the camera's collision field (camera.mjs createCollisionGrid) off the main thread:
// voxelizing the house, room and coast meshes and classifying the result takes a few hundred
// milliseconds, which would otherwise stall the page while the rooms stream in. Messages come
// from controller.mjs; one classification follows each burst of meshes.
import { createCollisionGrid } from "./camera.mjs";

let grid = null,
  scheduled = false;

function classify() {
  scheduled = false;
  if (!grid) return;
  grid.finish();
  const flags = grid.flags();
  self.postMessage({ type: "field", flags, evidence: grid.evidence() }, [flags.buffer]);
}

self.onmessage = ({ data }) => {
  if (data.type === "init") grid = createCollisionGrid(data.bounds);
  else if (!grid) return;
  else if (data.type === "mesh") {
    const { positions, index, matrix } = data;
    grid.addGeometry({
      position: (i, out) => {
        out[0] = positions[i * 3];
        out[1] = positions[i * 3 + 1];
        out[2] = positions[i * 3 + 2];
      },
      count: positions.length / 3,
      index,
      matrix,
    });
  } else if (data.type === "solid") grid.addSolid(data.min, data.max);
  else if (data.type === "classify" && !scheduled) {
    // Meshes already queued behind this message are voxelized first.
    scheduled = true;
    setTimeout(classify, 0);
  }
};
