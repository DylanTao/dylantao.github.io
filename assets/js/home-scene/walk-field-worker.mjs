// Builds the walk field (colliders.mjs createWalkField) off the main thread: rasterizing the house,
// its rooms and the nearby coast takes a few hundred milliseconds that would otherwise stall the
// view while Walk mode starts. Meshes arrive from colliders.mjs createWalkFieldBuilder; each
// "snapshot" request answers with a transferable copy of the field so far.
import { createWalkField } from "./colliders.mjs";

let field = null;

self.onmessage = ({ data }) => {
  if (data.type === "init") field = createWalkField(data.bounds);
  else if (!field) return;
  else if (data.type === "mesh") field.addGeometry(data);
  else if (data.type === "snapshot") {
    const snapshot = field.snapshot();
    self.postMessage({ type: "field", version: data.version, ...snapshot }, [snapshot.lo.buffer, snapshot.hi.buffer, snapshot.count.buffer]);
  }
};
