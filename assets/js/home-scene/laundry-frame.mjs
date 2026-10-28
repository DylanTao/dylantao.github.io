// The cloth island stays in its authored coordinates. A native installation
// supplies the one rigid frame used by render bounds, anchors and world wind.
const triple = (v) => Array.isArray(v) && v.length === 3 && v.every(Number.isFinite);

export function laundryFrame(record = null, fallback = [0, 0, 0]) {
  if (!record) {
    if (!triple(fallback)) throw new RangeError("Invalid laundry offset");
    return { native: false, yaw: 0, translation: fallback.slice(), rail: null, floorY: 0, postBaseY: 0.4, postTopY: 2.5 };
  }
  if (typeof record === "string") record = JSON.parse(record);
  if (record.version !== 1 || !Number.isFinite(record.yaw) || !triple(record.translation)) throw new RangeError("Invalid native laundry frame");
  if (!Array.isArray(record.rail) || !record.rail.every((p) => Array.isArray(p) && p.length === 2 && p.every(Number.isFinite))) {
    throw new RangeError("Invalid native laundry rail");
  }
  for (const key of ["floorY", "postBaseY", "postTopY"]) if (!Number.isFinite(record[key])) throw new RangeError(`Invalid laundry ${key}`);
  if (!(record.postTopY > record.postBaseY)) throw new RangeError("Invalid laundry mast height");
  return { ...record, native: true, translation: record.translation.slice(), rail: record.rail.map((p) => p.slice()) };
}

export function frameFromScene(scene, fallback) {
  const records = new Map();
  scene?.traverse?.((object) => {
    const value = object.userData?.nativeLaundryFrame;
    if (value) records.set(typeof value === "string" ? value : JSON.stringify(value), object.name);
  });
  if (records.size > 1) throw new RangeError("Conflicting native laundry frames");
  const [record, node] = records.entries().next().value || [];
  return { ...laundryFrame(record, fallback), node: node || null };
}

export function framePoint(frame, point, out = [0, 0, 0]) {
  const c = Math.cos(frame.yaw),
    s = Math.sin(frame.yaw),
    x = point[0],
    z = point[2];
  out[0] = c * x + s * z + frame.translation[0];
  out[1] = point[1] + frame.translation[1];
  out[2] = -s * x + c * z + frame.translation[2];
  return out;
}

export function frameVector(frame, vector, inverse = false, out = [0, 0, 0]) {
  const c = Math.cos(frame.yaw),
    s = Math.sin(frame.yaw) * (inverse ? -1 : 1),
    x = vector[0],
    z = vector[2];
  out[0] = c * x + s * z;
  out[1] = vector[1];
  out[2] = -s * x + c * z;
  return out;
}

// Sample the same world draft at the cloth's actual world positions, then bring
// its velocity back to the island's axes. Scratch storage grows only on demand.
export function windInFrame(wind, frame) {
  const p = [0, 0, 0],
    v = [0, 0, 0];
  let worldPoints = new Float64Array(0),
    worldVelocity = new Float64Array(0);
  const sample = (x, y, z, time, out = [0, 0, 0]) => {
    p[0] = x;
    p[1] = y;
    p[2] = z;
    framePoint(frame, p, p);
    wind.sample(p[0], p[1], p[2], time, v);
    return frameVector(frame, v, true, out);
  };
  const sampleBatch = (points, count, clock, out) => {
    if (worldPoints.length < count * 3) {
      worldPoints = new Float64Array(count * 3);
      worldVelocity = new Float64Array(count * 3);
    }
    const c = Math.cos(frame.yaw),
      s = Math.sin(frame.yaw),
      t = frame.translation;
    for (let i = 0; i < count * 3; i += 3) {
      worldPoints[i] = c * points[i] + s * points[i + 2] + t[0];
      worldPoints[i + 1] = points[i + 1] + t[1];
      worldPoints[i + 2] = -s * points[i] + c * points[i + 2] + t[2];
    }
    wind.sampleBatch(worldPoints, count, clock, worldVelocity);
    for (let i = 0; i < count * 3; i += 3) {
      out[i] = c * worldVelocity[i] - s * worldVelocity[i + 2];
      out[i + 1] = worldVelocity[i + 1];
      out[i + 2] = s * worldVelocity[i] + c * worldVelocity[i + 2];
    }
    return out;
  };
  sample.sampleBatch = sampleBatch;
  return { ...wind, sample, sampleBatch };
}
