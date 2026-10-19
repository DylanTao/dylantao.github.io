// Opaque draws grouped by shader program. Three r164 sorts opaque draws by material id, and every
// mesh in this scene has its own material, so consecutive draws switched program about 580 times in
// an outside frame. Each switch re-uploads the camera, every light struct and the material's
// uniforms (WebGLRenderer.setProgram); grouping cut those switches to about 170 and the frame's
// script time by a quarter (docs/performance-notes.md).
//
// Each program's group sits where the earliest material using it sat in three's own order (material
// ids follow creation), so groups keep their old relative order: the sea, created before the coast,
// still draws before the beach. That matters only where two surfaces of different programs tie in
// depth exactly, such as the waterline, the one place a depth-tested opaque draw's order shows.
export function sortOpaqueByProgram(renderer) {
  const properties = renderer.properties,
    rank = new WeakMap();
  const programRank = (material) => {
    const program = properties.get(material).currentProgram;
    if (!program) return material.id;
    const known = rank.get(program);
    if (known !== undefined && known <= material.id) return known;
    rank.set(program, material.id);
    return material.id;
  };
  renderer.setOpaqueSort(
    (a, b) =>
      a.groupOrder - b.groupOrder ||
      a.renderOrder - b.renderOrder ||
      programRank(a.material) - programRank(b.material) ||
      a.material.id - b.material.id ||
      a.z - b.z ||
      a.id - b.id
  );
}
