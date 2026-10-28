// Exact triangle rays with a bounds tree. The surface must already contain the
// complete actual posed geometry; this index never substitutes proxy solids.
export function createTriangleParity(THREE, geometry) {
  const triangles = [],
    points = geometry.attributes.position,
    index = geometry.index;
  for (let i = 0; i < (index?.count ?? points.count); i += 3) {
    const vertices = [0, 1, 2].map((k) => new THREE.Vector3().fromBufferAttribute(points, index ? index.getX(i + k) : i + k));
    const box = new THREE.Box3().setFromPoints(vertices);
    triangles.push({ vertices, box, center: box.getCenter(new THREE.Vector3()) });
  }
  if (!triangles.length) throw new Error("Complete actual triangle geometry is required");
  function build(items) {
    const box = new THREE.Box3();
    for (const item of items) box.union(item.box);
    if (items.length <= 12) return { box, items };
    const size = box.getSize(new THREE.Vector3()),
      axis = size.x >= size.y && size.x >= size.z ? "x" : size.y >= size.z ? "y" : "z";
    items.sort((a, b) => a.center[axis] - b.center[axis]);
    const middle = items.length >> 1;
    return { box, left: build(items.slice(0, middle)), right: build(items.slice(middle)) };
  }
  const tree = build(triangles),
    ray = new THREE.Ray(),
    hit = new THREE.Vector3();
  const directions = [
    [1, 0.317, 0.131],
    [0.193, 1, 0.413],
    [0.271, 0.157, 1],
  ].map((value) => new THREE.Vector3(...value).normalize());
  return (point) => {
    if (!tree.box.containsPoint(point)) return false;
    let votes = 0;
    for (const direction of directions) {
      ray.set(point, direction);
      const stack = [tree],
        distances = [];
      while (stack.length) {
        const node = stack.pop();
        if (!ray.intersectsBox(node.box)) continue;
        if (node.items) {
          for (const triangle of node.items) if (ray.intersectTriangle(...triangle.vertices, false, hit)) distances.push(point.distanceTo(hit));
        } else stack.push(node.left, node.right);
      }
      distances.sort((a, b) => a - b);
      let count = 0,
        last = -1;
      for (const distance of distances)
        if (distance - last > 1e-5) {
          last = distance;
          count++;
        }
      votes += count % 2;
    }
    return votes >= 2;
  };
}
