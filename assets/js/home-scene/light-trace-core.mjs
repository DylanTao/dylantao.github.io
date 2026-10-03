// Original bounded CPU triangle accelerator and diffuse transport quadrature.
// Coordinates and distances are in world metres; radiance inputs are linear RGB.
export const FOUR_PI = 4 * Math.PI;
export const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));
export const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const normalize = (v) => {
  const l = Math.hypot(...v);
  return l > 1e-15 ? v.map((x) => x / l) : [0, 1, 0];
};
export function octDirection(x, y) {
  let z = 1 - Math.abs(x) - Math.abs(y);
  if (z < 0) {
    const ox = x;
    x = (1 - Math.abs(y)) * (ox < 0 ? -1 : 1);
    y = (1 - Math.abs(ox)) * (y < 0 ? -1 : 1);
  }
  return normalize([x, y, z]);
}
export function octEncode(d) {
  const l = Math.abs(d[0]) + Math.abs(d[1]) + Math.abs(d[2]);
  let x = d[0] / l,
    y = d[1] / l;
  if (d[2] < 0) {
    const ox = x;
    x = (1 - Math.abs(y)) * (ox < 0 ? -1 : 1);
    y = (1 - Math.abs(ox)) * (y < 0 ? -1 : 1);
  }
  return [x * 0.5 + 0.5, y * 0.5 + 0.5];
}
export function sphereQuadrature(side = 8) {
  if (!Number.isInteger(side) || side < 4 || side > 16 || side % 2) throw new RangeError("even quadrature side must be 4..16");
  const rays = [];
  let sum = 0;
  for (let y = 0; y < side; y++)
    for (let x = 0; x < side; x++) {
      const ox = ((x + 0.5) / side) * 2 - 1,
        oy = ((y + 0.5) / side) * 2 - 1;
      let px = ox,
        py = oy,
        pz = 1 - Math.abs(ox) - Math.abs(oy);
      if (pz < 0) {
        px = (1 - Math.abs(oy)) * Math.sign(ox);
        py = (1 - Math.abs(ox)) * Math.sign(oy);
      }
      const weight = 1 / Math.hypot(px, py, pz) ** 3;
      rays.push({ direction: normalize([px, py, pz]), weight });
      sum += weight;
    }
  rays.forEach((r) => (r.weight *= FOUR_PI / sum));
  return rays;
}
export function cosineDirections(normal, count = 8) {
  const n = normalize(normal),
    tangent = normalize(Math.abs(n[1]) < 0.9 ? [n[2], 0, -n[0]] : [0, -n[2], n[1]]);
  const bitangent = [n[1] * tangent[2] - n[2] * tangent[1], n[2] * tangent[0] - n[0] * tangent[2], n[0] * tangent[1] - n[1] * tangent[0]];
  return Array.from({ length: count }, (_, i) => {
    const r = Math.sqrt((i + 0.5) / count),
      a = i * 2.399963229728653;
    return n.map((v, k) => v * Math.sqrt(1 - r * r) + r * (Math.cos(a) * tangent[k] + Math.sin(a) * bitangent[k]));
  });
}
export function skyBasis(direction) {
  if (direction[1] < 0) return [0, 0, 1];
  const t = Math.max(0, direction[1]) ** 0.45;
  return [t, 1 - t, 0];
}
// First-order spherical harmonics with the clamped-cosine kernel convolved in.
export function accumulateL1(target, offset, rgb, direction, solidAngle) {
  for (let c = 0; c < 3; c++) {
    const l = rgb[c] * solidAngle;
    target[offset + c] += 0.25 * l;
    for (let k = 0; k < 3; k++) target[offset + (k + 1) * 3 + c] += 0.5 * l * direction[k];
  }
}
export function deringL1(coefficients, offset = 0) {
  for (let c = 0; c < 3; c++) {
    const dc = Math.max(0, coefficients[offset + c]);
    coefficients[offset + c] = dc;
    const length = Math.hypot(coefficients[offset + 3 + c], coefficients[offset + 6 + c], coefficients[offset + 9 + c]);
    const scale = length > dc ? dc / length : 1;
    for (let k = 1; k < 4; k++) coefficients[offset + k * 3 + c] *= scale;
  }
}
export function evaluateL1(coefficients, normal, offset = 0) {
  return [0, 1, 2].map((c) =>
    Math.max(
      0,
      coefficients[offset + c] +
        coefficients[offset + 3 + c] * normal[0] +
        coefficients[offset + 6 + c] * normal[1] +
        coefficients[offset + 9 + c] * normal[2]
    )
  );
}
export function pointAttenuation(distance, cutoff = 0) {
  const inverseSquare = 1 / Math.max(distance * distance, 0.01);
  return cutoff > 0 ? inverseSquare * Math.max(0, 1 - (distance / cutoff) ** 4) ** 2 : inverseSquare;
}

// Original median BVH. Balanced partitions bound tree depth; no triangle decimation.
export async function createTriangleBVH(positions, albedo, { yieldTask = () => Promise.resolve(), check = () => {}, leafSize = 8 } = {}) {
  const count = positions.length / 9;
  if (!Number.isInteger(count) || albedo.length !== count * 3) throw new RangeError("triangle/albedo lengths differ");
  if (!count) return { count: 0, bytes: 0, nodes: 0, ray: () => null };
  const order = new Uint32Array(count),
    centroids = new Float32Array(count * 3);
  let taskStart = performance.now();
  for (let i = 0; i < count; i++) {
    order[i] = i;
    for (let a = 0; a < 3; a++) centroids[i * 3 + a] = (positions[i * 9 + a] + positions[i * 9 + a + 3] + positions[i * 9 + a + 6]) / 3;
    if (i % 4096 === 4095 && performance.now() - taskStart > 6) {
      await yieldTask();
      check();
      taskStart = performance.now();
    }
  }
  const capacity = 4 * Math.ceil(count / leafSize) + 8,
    bounds = new Float32Array(capacity * 6),
    links = new Int32Array(capacity * 4);
  let nodes = 1;
  const queue = [[0, 0, count]];
  const value = (i, axis) => centroids[order[i] * 3 + axis];
  async function select(start, end, middle, axis) {
    let lo = start,
      hi = end - 1;
    while (lo < hi) {
      const pivot = value((lo + hi) >>> 1, axis);
      let i = lo,
        j = hi;
      let operations = 0;
      while (i <= j) {
        while (value(i, axis) < pivot) {
          i++;
          if (++operations % 2048 === 0 && performance.now() - taskStart > 6) {
            await yieldTask();
            check();
            taskStart = performance.now();
          }
        }
        while (value(j, axis) > pivot) {
          j--;
          if (++operations % 2048 === 0 && performance.now() - taskStart > 6) {
            await yieldTask();
            check();
            taskStart = performance.now();
          }
        }
        if (i <= j) {
          const t = order[i];
          order[i++] = order[j];
          order[j--] = t;
        }
        if (++operations % 2048 === 0 && performance.now() - taskStart > 6) {
          await yieldTask();
          check();
          taskStart = performance.now();
        }
      }
      if (middle <= j) hi = j;
      else if (middle >= i) lo = i;
      else break;
    }
  }
  while (queue.length) {
    check();
    const [node, start, end] = queue.pop(),
      base = node * 6,
      cbMin = [Infinity, Infinity, Infinity],
      cbMax = [-Infinity, -Infinity, -Infinity];
    bounds.set([Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity], base);
    for (let j = start; j < end; j++) {
      const tri = order[j],
        p = tri * 9;
      for (let axis = 0; axis < 3; axis++) {
        cbMin[axis] = Math.min(cbMin[axis], centroids[tri * 3 + axis]);
        cbMax[axis] = Math.max(cbMax[axis], centroids[tri * 3 + axis]);
        for (let v = 0; v < 3; v++) {
          const coordinate = positions[p + v * 3 + axis];
          bounds[base + axis] = Math.min(bounds[base + axis], coordinate);
          bounds[base + axis + 3] = Math.max(bounds[base + axis + 3], coordinate);
        }
      }
      if ((j - start) % 1024 === 1023 && performance.now() - taskStart > 6) {
        await yieldTask();
        check();
        taskStart = performance.now();
      }
    }
    const extent = cbMax.map((v, i) => v - cbMin[i]),
      axis = extent.indexOf(Math.max(...extent)),
      link = node * 4;
    if (end - start <= leafSize || extent[axis] < 1e-9) {
      links.set([-1, -1, start, end], link);
    } else {
      const middle = (start + end) >>> 1;
      await select(start, end, middle, axis);
      const left = nodes++,
        right = nodes++;
      if (nodes > capacity) throw new RangeError("BVH capacity exceeded");
      links.set([left, right, -1, -1], link);
      queue.push([right, middle, end], [left, start, middle]);
    }
    if (performance.now() - taskStart > 6) {
      await yieldTask();
      check();
      taskStart = performance.now();
    }
  }
  const stack = new Int32Array(128);
  let rays = 0,
    triangleTests = 0,
    boxTests = 0;
  function ray(origin, direction, far = Infinity, near = 0.001, any = false) {
    rays++;
    let closest = far,
      triangle = -1,
      top = 1;
    stack[0] = 0;
    while (top) {
      const node = stack[--top],
        b = node * 6;
      boxTests++;
      let entry = near,
        exit = closest;
      for (let a = 0; a < 3; a++) {
        if (Math.abs(direction[a]) < 1e-12) {
          if (origin[a] < bounds[b + a] || origin[a] > bounds[b + a + 3]) {
            exit = -Infinity;
            break;
          }
        } else {
          const t0 = (bounds[b + a] - origin[a]) / direction[a],
            t1 = (bounds[b + a + 3] - origin[a]) / direction[a];
          entry = Math.max(entry, Math.min(t0, t1));
          exit = Math.min(exit, Math.max(t0, t1));
        }
      }
      if (entry > exit) continue;
      const link = node * 4;
      if (links[link] >= 0) {
        stack[top++] = links[link];
        stack[top++] = links[link + 1];
        continue;
      }
      for (let j = links[link + 2]; j < links[link + 3]; j++) {
        triangleTests++;
        const tri = order[j],
          p = tri * 9;
        const ax = positions[p],
          ay = positions[p + 1],
          az = positions[p + 2];
        const ex = positions[p + 3] - ax,
          ey = positions[p + 4] - ay,
          ez = positions[p + 5] - az;
        const fx = positions[p + 6] - ax,
          fy = positions[p + 7] - ay,
          fz = positions[p + 8] - az;
        const px = direction[1] * fz - direction[2] * fy,
          py = direction[2] * fx - direction[0] * fz,
          pz = direction[0] * fy - direction[1] * fx;
        const determinant = ex * px + ey * py + ez * pz;
        if (Math.abs(determinant) < 1e-10) continue;
        const inverse = 1 / determinant,
          tx = origin[0] - ax,
          ty = origin[1] - ay,
          tz = origin[2] - az;
        const u = (tx * px + ty * py + tz * pz) * inverse;
        if (u < -1e-7 || u > 1.0000001) continue;
        const qx = ty * ez - tz * ey,
          qy = tz * ex - tx * ez,
          qz = tx * ey - ty * ex;
        const v = (direction[0] * qx + direction[1] * qy + direction[2] * qz) * inverse;
        if (v < -1e-7 || u + v > 1.0000001) continue;
        const distance = (fx * qx + fy * qy + fz * qz) * inverse;
        if (distance < near || distance > closest) continue;
        if (any) return { distance, triangle: tri };
        closest = distance;
        triangle = tri;
      }
    }
    if (triangle < 0) return null;
    const p = triangle * 9,
      a = positions.subarray(p, p + 3),
      e = [positions[p + 3] - a[0], positions[p + 4] - a[1], positions[p + 5] - a[2]],
      f = [positions[p + 6] - a[0], positions[p + 7] - a[1], positions[p + 8] - a[2]];
    const normal = normalize([e[1] * f[2] - e[2] * f[1], e[2] * f[0] - e[0] * f[2], e[0] * f[1] - e[1] * f[0]]);
    const backface = dot(normal, direction) > 0;
    return {
      distance: closest,
      triangle,
      backface,
      normal: backface ? normal.map((x) => -x) : normal,
      point: origin.map((x, i) => x + direction[i] * closest),
      albedo: albedo.subarray(triangle * 3, triangle * 3 + 3),
    };
  }
  return {
    count,
    nodes,
    bytes: positions.byteLength + albedo.byteLength + order.byteLength + centroids.byteLength + bounds.byteLength + links.byteLength,
    ray,
    evidence: () => ({ rays, triangleTests, boxTests }),
  };
}
