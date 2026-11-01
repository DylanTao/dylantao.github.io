import * as THREE from "../three.module.min.js";

// This site's static vertex shaders depend on attributes and per-draw uniforms, never the vertex
// index. Two bit-identical complete inputs therefore occupy the same clip-space point: a triangle
// joining them has no filled coverage. Keep every other triangle, including tiny/collinear ones.
// This is an index-only representation; the authored geometry and every vertex buffer survive.
const originals = new WeakMap();
const controls = new WeakMap();

function sameInput(attributes, a, b) {
  for (const { array, itemSize, stride, bytes } of attributes) {
    for (let component = 0; component < itemSize; component++)
      if (!Number.isFinite(array[a * itemSize + component]) || !Number.isFinite(array[b * itemSize + component])) return false;
    for (let component = 0; component < stride; component++) if (bytes[a * stride + component] !== bytes[b * stride + component]) return false;
  }
  return true;
}

export function configureStaticTriangleIndices(mesh, style, { indexIndependentShaders = false } = {}) {
  const current = mesh.geometry;
  const source = originals.get(current) || current;
  if (!source) return null;
  mesh.geometry = source;
  if (!indexIndependentShaders || style !== "realistic" || !mesh.isMesh || mesh.isSkinnedMesh || mesh.isInstancedMesh || mesh.isBatchedMesh)
    return null;
  for (let parent = mesh; parent; parent = parent.parent)
    if (parent.userData.dynamic || parent.userData.bedding || parent.userData.activityProp || parent.userData.outline) return null;
  const material = mesh.material;
  if (
    !material?.isMeshStandardMaterial ||
    material.wireframe ||
    material.transparent ||
    material.opacity < 0.999 ||
    material.transmission > 0 ||
    material.alphaTest > 0
  )
    return null;
  if (source.groups.length || Object.values(source.morphAttributes).some((attributes) => attributes.length)) return null;
  const position = source.attributes.position;
  const index = source.index;
  if (
    !position ||
    !index?.array ||
    index.itemSize !== 1 ||
    index.normalized ||
    index.count % 3 ||
    source.drawRange.start !== 0 ||
    source.drawRange.count < index.count
  )
    return null;
  const attributes = Object.values(source.attributes);
  if (
    attributes.some(
      (attribute) =>
        !attribute.array || attribute.isInterleavedBufferAttribute || attribute.count !== position.count || attribute.usage !== THREE.StaticDrawUsage
    )
  )
    return null;
  let control = controls.get(source);
  if (!control) {
    // Construct byte views once, rather than allocating one for each triangle comparison.
    const inputs = attributes.map(({ array, itemSize }) => ({
      array,
      itemSize,
      stride: itemSize * array.BYTES_PER_ELEMENT,
      bytes: new Uint8Array(array.buffer, array.byteOffset, array.byteLength),
    }));
    let retained = null,
      written = 0,
      removed = 0;
    for (let i = 0; i < index.count; i += 3) {
      const a = index.getX(i),
        b = index.getX(i + 1),
        c = index.getX(i + 2);
      if (![a, b, c].every((vertex) => Number.isInteger(vertex) && vertex >= 0 && vertex < position.count)) return null;
      if (sameInput(inputs, a, b) || sameInput(inputs, b, c) || sameInput(inputs, c, a)) {
        removed++;
        if (!retained) {
          retained = new index.array.constructor(index.count);
          retained.set(index.array.subarray(0, i));
          written = i;
        }
      } else if (retained) {
        retained[written++] = a;
        retained[written++] = b;
        retained[written++] = c;
      }
    }
    if (!removed) {
      controls.set(source, { geometry: source, removed: 0 });
      return null;
    }
    const geometry = new THREE.BufferGeometry();
    for (const [name, attribute] of Object.entries(source.attributes)) geometry.setAttribute(name, attribute);
    geometry.setIndex(new THREE.BufferAttribute(retained.subarray(0, written), 1));
    geometry.boundingBox = source.boundingBox;
    geometry.boundingSphere = source.boundingSphere;
    geometry.name = source.name;
    geometry.userData = { ...source.userData };
    control = { geometry, removed, sourceTriangles: index.count / 3 };
    originals.set(geometry, source);
    controls.set(source, control);
    let disposing = false;
    source.addEventListener("dispose", () => {
      if (!disposing) {
        disposing = true;
        geometry.dispose();
      }
    });
    geometry.addEventListener("dispose", () => {
      if (!disposing) {
        disposing = true;
        source.dispose();
      }
    });
  }
  mesh.geometry = control.geometry;
  return control.removed ? { removed: control.removed, sourceTriangles: control.sourceTriangles, triangles: control.geometry.index.count / 3 } : null;
}

export function configureStaticModelIndices(root, style) {
  root.traverse((mesh) => {
    if (mesh.isMesh) configureStaticTriangleIndices(mesh, style, { indexIndependentShaders: true });
  });
}
