import * as THREE from "../three.module.min.js";

// Brush strokes fixed to the scene's surfaces: the painted look's paint.
//
// Sirui's bar for a drawn world (November 14 to 16, 2026) is a painting, not a filter: Jake Eaton's
// pictures of several hundred thousand simulated strokes, and Blendi's painted game, where "every
// frame is about 1.5 million brush strokes". Both are built from strokes that belong to things. A
// filter's strokes belong to the screen, and swim when the camera moves.
//
// So each stroke here is pinned to a point on a surface (Meier, "Painterly Rendering for Animation",
// SIGGRAPH 1996): points are scattered over the scene's still meshes once, by area, each with the
// direction a brush would follow there, the surface's own colour and a size. Every frame a stroke
// asks the look's structure buffers about its own point: is it in view, how does the surface lie
// to the light and to the sky, how much light does the frame hold there. It decides one colour for
// its whole mark from the same mixes the coat under it uses (COLOUR_GLSL in print-look.mjs), and
// is drawn as a small quad along its direction as the picture sees it. Blendi's game gives the
// rule for the colour: each thing has a light, a half-tone and a shade mix, and the light on a
// stroke's spot picks one.
//
//   sizes    five lengths, each three times the last. Large strokes are laid first and small ones
//            over them, as a painter blocks in before detailing, and the broad ones cover more
//            than the fine ones, so the blocking-in shows between the detail. A stroke shorter
//            than a few pixels is not drawn, so distance thins the paint by itself.
//   colour   one decision a stroke (Sirui, November 16, on the first pass: "background feel lazy
//            ... the artistic beauty and uniqueness is still limited"). The first pass read the
//            light at every pixel, which made the strokes a texture over a shaded picture. Now a
//            stroke is one colour; only a cast shadow's edge still cuts across it, as a painter
//            goes back over a shadow. No two strokes of one mass are the same paint: each turns
//            its hue a little at the same value, and one in a few is an accent, the warm of the
//            ground's light laid into shade or the cool of the shade laid into light.
//   land     is painted as land, from what the stroke's own point is: sandstone in beds of uneven
//            thickness, each with its own stain; dark streaks where water runs down a face; wet
//            rock and a band of weed at the tide line; soil and dry grass on the top; sand that
//            is dark and holds the sky where the last wave reached; scrub in drifts of sage and
//            olive. The beds follow the photoreal sandstone's own recipe (realism.mjs), at the
//            scale a brush can say.
//   marks    eight, made here: loaded strokes with dry tails, filberts, drags, a comma. A mark is
//            bent a little, each stroke its own way, and its thickness is lit from the upper
//            left the way a canvas is in a room.
//   manner   follows the sun (an idea from rewind's painted walk, credited in the record: "when
//            the sun goes down it turns from gouache into oil paint"). Gouache by day: flat,
//            opaque, even marks and quiet colour. Oil as the sun goes down and through the
//            night: bristles that part, ridges that catch the light, deeper darks, more broken
//            colour.
//   edges    a stroke may spill a little over what lies behind its own thing, never over what
//            stands in front, so a chair leg stays a chair leg with a brushed edge.
//   figures  are not painted: they stay flat cels on the painted world, as in drawn animation.
//
// Nothing here runs unless a look asks for paint.

// A stroke's length in metres, finest first.
export const STROKE_SIZES = Object.freeze([0.12, 0.36, 1.08, 3.24, 9.72]);
// Width over length.
export const STROKE_ASPECT = 0.3;
// Strokes a square metre that cover a surface once, for each size.
export const STROKE_DENSITY = Object.freeze(STROKE_SIZES.map((size) => 1 / (STROKE_ASPECT * size * size)));
// Three sizes are laid on a surface. How many times over each covers it, finest first: the broad
// strokes under the others cover most, and the fine ones leave some of them showing.
export const STROKE_LAYERS = 3;
export const STROKE_COVER = Object.freeze([0.9, 1.2, 1.5]);
// The most strokes the scene may hold, and the most one mesh may.
export const STROKE_LIMITS = Object.freeze({ scene: 1300000, mesh: 260000 });
// Close to, the house needs finer paint than its walls and floors carry from across a room. A
// made thing is given every size below its own finest when the eye comes within `near` metres of
// it, each covering it `cover` times, and gives them up again past `far`. Only the part of it
// within `reach` metres of the eye is given the smallest size (three times as far for each size
// above), and a thing larger than that is painted again once the eye has moved `step` metres.
// The land is not refined: a cliff's finest stroke already says a bed.
export const STROKE_FINE = Object.freeze({ near: 7, far: 12, reach: 7, step: 2.5, cover: 0.7, limit: 300000 });

// A stroke suits the thing it paints: the finest is about an eighteenth of the thing's length (a
// cushion gets the smallest, a wall or a floor the next). Ground and rock are painted more broadly
// than the house, and more broadly still far from where the view is centred; near it a brush is
// fine enough to say a bed of sandstone.
const BROAD = /hinterland|coast_|mainland|cliff|bluff|beach|terrain|boulder|sandstone/i;
export function finestStroke(name, distance, length = 1) {
  if (BROAD.test(name)) return distance < 30 ? 1 : distance < 160 ? 2 : 3;
  let finest = 0;
  while (finest < 2 && STROKE_SIZES[finest] < length / 18) finest++;
  return Math.max(finest, distance < 32 ? 0 : distance < 90 ? 1 : 2);
}

// What land a surface is, from its mesh's and its material's names: 0 not land, 1 rock of the
// coast (cliff, bluff, boulder), 2 sand, 3 open ground (loam, a trail, a lawn), 4 scrub, 5 rock
// that the house is cut from (a carved wall or floor: beds, but no tide line and no soil).
const TERRAIN = /hinterland|coast_|mainland|liftaway|boulder|talus/i;
export function landClass(meshName = "", materialName = "") {
  const material = String(materialName);
  if (/scrub|canopy/i.test(material)) return 4;
  if (/loam|trail dust|lawn|soil/i.test(material)) return 3;
  if (/\bsand\b/i.test(material)) return 2;
  if (/sandstone|limestone|bluff stone|cut stone|boulder|\brock\b/i.test(material)) return TERRAIN.test(`${meshName} ${material}`) ? 1 : 5;
  return 0;
}

// A small seeded generator, so the same scene is painted with the same strokes every time.
export function strokeRandom(seed) {
  let state = seed >>> 0 || 1;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function valueNoise(seed) {
  const at = (x, y) => {
    let h = Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ Math.imul(seed, 1274126177);
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
  };
  return (x, y) => {
    const xi = Math.floor(x),
      yi = Math.floor(y),
      fx = x - xi,
      fy = y - yi,
      sx = fx * fx * (3 - 2 * fx),
      sy = fy * fy * (3 - 2 * fy);
    const top = at(xi, yi) + (at(xi + 1, yi) - at(xi, yi)) * sx,
      bottom = at(xi, yi + 1) + (at(xi + 1, yi + 1) - at(xi, yi + 1)) * sx;
    return top + (bottom - top) * sy;
  };
}
const smooth = (a, b, x) => {
  const t = Math.min(Math.max((x - a) / (b - a), 0), 1);
  return t * t * (3 - 2 * t);
};

// The direction a brush would follow on a made thing, in world space: along the boards on anything
// level, upright on a post, and across a wall the way its courses run.
export function strokeAlong(normal, longAxis, upright, out) {
  if (Math.abs(normal.y) > 0.75) out.copy(longAxis);
  else if (upright) out.set(0, 1, 0);
  else out.set(normal.z, 0, -normal.x);
  // Lay it in the surface.
  out.addScaledVector(normal, -out.dot(normal));
  if (out.lengthSq() < 1e-8) out.set(1, 0, 0).addScaledVector(normal, -normal.x);
  return out.normalize();
}

// A rounded thing is painted around its form, the way a hand wraps a stroke over a cushion's edge.
// Across a triangle, the edge along which the surface's normal turns fastest is the direction it
// bends in; where that is sharper than STROKE_CURVE (radians a metre), a made thing's stroke follows
// it. Returns the bend, and sets `out` to the direction, laid in the surface.
export const STROKE_CURVE = 2.5;
const wrapEdge = new THREE.Vector3(),
  wrapTurn = new THREE.Vector3();
export function strokeWrap(points, normals, normal, out) {
  let best = 0;
  for (const [i, j] of [
    [0, 1],
    [1, 2],
    [2, 0],
  ]) {
    const length = wrapEdge.subVectors(points[j], points[i]).length();
    if (length < 1e-6) continue;
    const bend = wrapTurn.subVectors(normals[j], normals[i]).length() / length;
    if (bend > best) {
      best = bend;
      out.copy(wrapEdge);
    }
  }
  if (!best) return 0;
  out.addScaledVector(normal, -out.dot(normal));
  if (out.lengthSq() < 1e-12) return 0;
  out.normalize();
  return best;
}

// The direction a brush would follow on land. On a slope it is the land's own contour, the level
// line that lies in the surface, which on a cliff is the way its beds run. On ground too level to
// have one the hand follows a slow drift that turns from place to place, and sand is laid along
// its shore (`shore`, the long side of its mesh). `pick` is a number of the stroke's own: one
// stroke in twelve on steep rock runs down the face instead, the way water has cut it. Returns how
// far the direction should then sway, in radians: neighbours sway together, so the brushwork
// flows where parallel strokes would read as courses of brick.
const drift = valueNoise(911),
  sway = valueNoise(127);
export function landAlong(land, normal, at, shore, pick, out) {
  const level = Math.abs(normal.y),
    flat = land === 2 ? 1 : smooth(0.9, 0.99, level),
    turn = 2 * Math.PI * 2 * drift(at.x * 0.021, at.z * 0.021);
  if (land === 2) out.copy(shore);
  else out.set(Math.cos(turn), 0, Math.sin(turn));
  if (flat < 1 && level < 0.9999) {
    const run = Math.hypot(normal.x, normal.z);
    out.set((normal.z / run) * (1 - flat) + out.x * flat, 0, (-normal.x / run) * (1 - flat) + out.z * flat);
  }
  out.addScaledVector(normal, -out.dot(normal));
  if (out.lengthSq() < 1e-8) out.set(1, 0, 0).addScaledVector(normal, -normal.x);
  out.normalize();
  if (land === 1 && level < 0.8 && pick < 0.08) out.cross(normal).normalize();
  return (sway(at.x * 0.07 + at.y * 0.11, at.z * 0.07 - at.y * 0.05) - 0.5) * (land === 2 || level < 0.8 ? 0.35 : 0.9);
}

// Eight brush marks on one sheet, four by two, made here and not copied from anywhere. Red is how
// much paint a point holds, green how thick it lies. A mark starts loaded and ends dry: toward its
// tail the bristles part and the ground shows between them. They differ the way a painter's marks
// do: `half` is half the mark's width in its cell, `rise` and `fall` how much of its length the
// head and the tail take to come to a point, `dry` how far the bristles part by the tail, `streak`
// how much of that is there from the start, and `load` how thick the paint lies at the head.
export const BRUSH_SHEET = Object.freeze({ columns: 4, rows: 2, width: 256, height: 64 });
export const BRUSH_MARKS = Object.freeze([
  { name: "loaded", half: 0.3, rise: 0.1, fall: 0.45, dry: 0.6, streak: 0.04, load: 0.3 },
  { name: "filbert", half: 0.27, rise: 0.18, fall: 0.3, dry: 0.35, streak: 0.02, load: 0.2 },
  { name: "drag", half: 0.32, rise: 0.07, fall: 0.6, dry: 0.8, streak: 0.22, load: 0.1 },
  { name: "liner", half: 0.2, rise: 0.22, fall: 0.5, dry: 0.45, streak: 0.03, load: 0.15 },
  { name: "flat", half: 0.32, rise: 0.07, fall: 0.2, dry: 0.3, streak: 0.02, load: 0.25 },
  { name: "leaf", half: 0.28, rise: 0.32, fall: 0.34, dry: 0.35, streak: 0.04, load: 0.2 },
  { name: "comma", half: 0.31, rise: 0.12, fall: 0.72, dry: 0.65, streak: 0.05, load: 0.4 },
  { name: "scumble", half: 0.26, rise: 0.1, fall: 0.36, dry: 0.55, streak: 0.3, load: 0.05 },
]);
export function brushSheetPixels() {
  const { columns, rows, width, height } = BRUSH_SHEET,
    data = new Uint8Array(columns * width * rows * height * 4);
  for (let mark = 0; mark < columns * rows; mark++) {
    const noise = valueNoise(mark * 7919 + 13),
      shape = BRUSH_MARKS[mark],
      ox = (mark % columns) * width,
      oy = Math.floor(mark / columns) * height;
    for (let y = 0; y < height; y++)
      for (let x = 0; x < width; x++) {
        const u = (x + 0.5) / width,
          v = (y + 0.5) / height - 0.5,
          // Along the mark from its head (0) to its tail (1): it keeps clear of the cell's ends.
          t = (u - 0.05) / 0.9;
        let paint = 0,
          thick = 0;
        if (t > 0 && t < 1) {
          const head = Math.pow(smooth(0, shape.rise, t), 0.6),
            tail = Math.pow(1 - smooth(1 - shape.fall, 1, t), 0.8),
            // The edge of a mark is never a ruled line.
            ragged = 1 + 0.12 * (noise(t * 6 + 3.3, 1.7) - 0.5) + 0.05 * (noise(t * 31, v > 0 ? 5.1 : 9.4) - 0.5),
            half = shape.half * Math.min(head, tail) * ragged,
            across = half > 1e-4 ? Math.abs(v) / half : 2,
            bristle = noise(t * 2.6 + 17, v * 21),
            body = noise(t * 9, v * 9 + 31),
            dry = Math.min(1, shape.streak + shape.dry * smooth(0.35, 1, t));
          paint = 1 - smooth(0.84, 1, across);
          paint *= 1 - dry * smooth(0.4, 0.62, bristle);
          paint *= 0.84 + 0.16 * body;
          // Thick along the loaded bristles, where the mark's edge piles up, and at the loaded head.
          const ridge = smooth(0.62, 0.86, across) * (1 - smooth(0.9, 1, across));
          thick = 0.42 + 0.5 * (bristle - 0.5) + 0.3 * ridge + shape.load * (1 - smooth(0, 0.3, t));
        }
        const o = ((oy + y) * columns * width + ox + x) * 4;
        data[o] = Math.round(Math.min(Math.max(paint, 0), 1) * 255);
        data[o + 1] = Math.round(Math.min(Math.max(thick, 0), 1) * 255);
        data[o + 2] = 0;
        data[o + 3] = 255;
      }
  }
  return data;
}

// Scatters strokes over one mesh. Returns null when it has nothing to paint, else the typed arrays
// of an instanced geometry, largest strokes first. `tools` are the look's own tests for what a
// material is (structureId, structureKind, structureSkips), so paint and structure agree. A
// stroke's size and what land it is on (landClass) share one number: size + 8 * land. `finest`
// returns the smallest size laid. With `fine` set to a size, only the sizes below it are laid,
// each covering the surface STROKE_FINE.cover times: the paint a thing takes on when the eye
// comes close. `eye` then limits each size to the part of the thing within its reach of the eye.
export function scatterStrokes(mesh, { focus, tools, thin = 1, limit = STROKE_LIMITS.mesh, fine = null, eye = null }) {
  const geometry = mesh.geometry,
    position = geometry?.attributes?.position;
  if (!position || mesh.isSkinnedMesh || mesh.isInstancedMesh || mesh.isPoints || mesh.isLine) return null;
  if (mesh.userData.noOcclusion || mesh.userData.noContactOcclusion || mesh.userData.flora) return null;
  const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material],
    index = geometry.index,
    painted = geometry.attributes.color,
    count = index ? index.count : position.count,
    groups = Array.isArray(mesh.material) && geometry.groups.length ? geometry.groups : [{ start: 0, count, materialIndex: 0 }];
  const paintable = groups.filter((group) => {
    const material = materials[group.materialIndex];
    return material && tools.structureKind(material) === 0 && !tools.structureSkips(material);
  });
  if (!paintable.length) return null;

  mesh.updateWorldMatrix(true, false);
  const world = mesh.matrixWorld,
    random = strokeRandom(mesh.id * 2654435761),
    a = new THREE.Vector3(),
    b = new THREE.Vector3(),
    c = new THREE.Vector3(),
    wa = new THREE.Vector3(),
    wb = new THREE.Vector3(),
    wc = new THREE.Vector3(),
    edge1 = new THREE.Vector3(),
    edge2 = new THREE.Vector3(),
    normal = new THREE.Vector3(),
    localNormal = new THREE.Vector3(),
    along = new THREE.Vector3(),
    perpendicular = new THREE.Vector3(),
    point = new THREE.Vector3(),
    place = new THREE.Vector3(),
    unturn = new THREE.Matrix3().setFromMatrix4(world).invert(),
    vertexNormals = geometry.attributes.normal,
    bendMatrix = new THREE.Matrix3().getNormalMatrix(world),
    na = new THREE.Vector3(),
    nb = new THREE.Vector3(),
    nc = new THREE.Vector3(),
    wrap = new THREE.Vector3();
  // What the whole mesh is like: which way its long side runs, and whether it stands like a post.
  if (!geometry.boundingBox) geometry.computeBoundingBox();
  const size = geometry.boundingBox.getSize(new THREE.Vector3()).applyMatrix3(new THREE.Matrix3().setFromMatrix4(world));
  size.set(Math.abs(size.x), Math.abs(size.y), Math.abs(size.z));
  const longAxis = size.x >= size.z ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 0, 1),
    upright = size.y > 2.2 * Math.max(size.x, size.z),
    length = Math.max(size.x, size.y, size.z);

  let capacity = 4096,
    made = 0,
    smallest = STROKE_SIZES.length;
  let places = new Float32Array(capacity * 3),
    normals = new Int8Array(capacity * 4),
    alongs = new Int8Array(capacity * 4),
    owns = new Uint8Array(capacity * 4),
    ids = new Uint16Array(capacity);
  const grow = () => {
    capacity *= 2;
    const more = (old, Type, width) => {
      const next = new Type(capacity * width);
      next.set(old);
      return next;
    };
    places = more(places, Float32Array, 3);
    normals = more(normals, Int8Array, 4);
    alongs = more(alongs, Int8Array, 4);
    owns = more(owns, Uint8Array, 4);
    ids = more(ids, Uint16Array, 1);
  };
  const corner = (i) => (index ? index.getX(i) : i);
  const colourOf = (vertex, k) => (painted ? [painted.getX(vertex), painted.getY(vertex), painted.getZ(vertex)][k] : 1);

  for (const group of paintable) {
    const material = materials[group.materialIndex],
      id = tools.structureId(mesh.id, group.materialIndex),
      own = material.color,
      usesPaint = Boolean(material.vertexColors && painted),
      name = `${mesh.name} ${material.name}`,
      land = landClass(mesh.name, material.name),
      end = Math.min(group.start + group.count, count);
    for (let i = group.start; i + 2 < end && made < limit; i += 3) {
      const ia = corner(i),
        ib = corner(i + 1),
        ic = corner(i + 2);
      a.fromBufferAttribute(position, ia);
      b.fromBufferAttribute(position, ib);
      c.fromBufferAttribute(position, ic);
      wa.copy(a).applyMatrix4(world);
      wb.copy(b).applyMatrix4(world);
      wc.copy(c).applyMatrix4(world);
      normal.crossVectors(edge1.subVectors(wb, wa), edge2.subVectors(wc, wa));
      const area = normal.length() * 0.5;
      if (!(area > 1e-7)) continue;
      normal.multiplyScalar(0.5 / area);
      const distance = Math.hypot((wa.x + wb.x + wc.x) / 3 - focus.x, (wa.y + wb.y + wc.y) / 3 - focus.y, (wa.z + wb.z + wc.z) / 3 - focus.z),
        suited = finestStroke(name, distance, length),
        finest = fine === null ? suited : 0,
        coarsest = fine === null ? Math.min(finest + STROKE_LAYERS, STROKE_SIZES.length) : Math.min(fine, suited),
        cover = (size) => (fine === null ? STROKE_COVER[size - finest] : STROKE_FINE.cover);
      if (coarsest <= finest) continue;
      // How many strokes of all its sizes a square metre of this surface holds.
      let each = 0;
      for (let size = finest; size < coarsest; size++) each += STROKE_DENSITY[size] * cover(size);
      const expected = each * area * thin;
      let strokes = Math.floor(expected + random());
      if (!strokes) continue;
      localNormal.crossVectors(edge1.subVectors(b, a), edge2.subVectors(c, a)).normalize();
      if (!land) {
        strokeAlong(normal, longAxis, upright, along);
        if (!upright && vertexNormals) {
          na.fromBufferAttribute(vertexNormals, ia).applyMatrix3(bendMatrix).normalize();
          nb.fromBufferAttribute(vertexNormals, ib).applyMatrix3(bendMatrix).normalize();
          nc.fromBufferAttribute(vertexNormals, ic).applyMatrix3(bendMatrix).normalize();
          if (strokeWrap([wa, wb, wc], [na, nb, nc], normal, wrap) > STROKE_CURVE) along.copy(wrap);
        }
        perpendicular.crossVectors(normal, along);
      }
      while (strokes-- > 0 && made < limit) {
        if (made === capacity) grow();
        // Which size: in proportion to how many of each a surface holds.
        let pick = random() * each,
          size = finest;
        while (size < coarsest - 1 && pick > STROKE_DENSITY[size] * cover(size)) {
          pick -= STROKE_DENSITY[size] * cover(size);
          size++;
        }
        smallest = Math.min(smallest, size);
        let u = random(),
          v = random();
        if (u + v > 1) {
          u = 1 - u;
          v = 1 - v;
        }
        const w = 1 - u - v;
        // Fine paint is laid only as far from the eye as its size can be seen.
        if (fine !== null && eye) {
          place.set(wa.x * w + wb.x * u + wc.x * v, wa.y * w + wb.y * u + wc.y * v, wa.z * w + wb.z * u + wc.z * v);
          if (place.distanceTo(eye) > STROKE_FINE.reach * 3 ** size) continue;
        }
        point.set(a.x * w + b.x * u + c.x * v, a.y * w + b.y * u + c.y * v, a.z * w + b.z * u + c.z * v);
        places[made * 3] = point.x;
        places[made * 3 + 1] = point.y;
        places[made * 3 + 2] = point.z;
        normals[made * 4] = Math.round(localNormal.x * 127);
        normals[made * 4 + 1] = Math.round(localNormal.y * 127);
        normals[made * 4 + 2] = Math.round(localNormal.z * 127);
        normals[made * 4 + 3] = size + 8 * land;
        // A hand never repeats an angle: each stroke turns a little off the grain, and on land
        // the grain itself wanders from place to place.
        let turn = (random() - 0.5) * 0.3;
        if (land) {
          place.set(wa.x * w + wb.x * u + wc.x * v, wa.y * w + wb.y * u + wc.y * v, wa.z * w + wb.z * u + wc.z * v);
          turn += landAlong(land, normal, place, longAxis, random(), along);
          perpendicular.crossVectors(normal, along);
        }
        const tx = along.x * Math.cos(turn) + perpendicular.x * Math.sin(turn),
          ty = along.y * Math.cos(turn) + perpendicular.y * Math.sin(turn),
          tz = along.z * Math.cos(turn) + perpendicular.z * Math.sin(turn);
        edge2.set(tx, ty, tz).applyMatrix3(unturn).normalize();
        alongs[made * 4] = Math.round(edge2.x * 127);
        alongs[made * 4 + 1] = Math.round(edge2.y * 127);
        alongs[made * 4 + 2] = Math.round(edge2.z * 127);
        alongs[made * 4 + 3] = Math.round((random() * 2 - 1) * 127);
        for (let k = 0; k < 3; k++) {
          const tint = usesPaint ? colourOf(ia, k) * w + colourOf(ib, k) * u + colourOf(ic, k) * v : 1,
            value = [own.r, own.g, own.b][k] * tint;
          // The square root keeps the darks in eight bits, as the structure's colour does.
          owns[made * 4 + k] = Math.round(Math.sqrt(Math.min(Math.max(value, 0), 1)) * 255);
        }
        owns[made * 4 + 3] = Math.round(random() * 255);
        ids[made] = id;
        made++;
      }
    }
  }
  if (!made) return null;
  // Largest first: a counting sort on the five sizes.
  const sizeOf = (i) => normals[i * 4 + 3] & 7,
    starts = new Array(STROKE_SIZES.length + 1).fill(0);
  for (let i = 0; i < made; i++) starts[STROKE_SIZES.length - 1 - sizeOf(i)]++;
  for (let size = 0, sum = 0; size <= STROKE_SIZES.length; size++) {
    const held = starts[size];
    starts[size] = sum;
    sum += held;
  }
  const order = new Uint32Array(made);
  for (let i = 0; i < made; i++) order[starts[STROKE_SIZES.length - 1 - sizeOf(i)]++] = i;
  const sorted = (old, Type, width) => {
    const next = new Type(made * width);
    for (let i = 0; i < made; i++) for (let k = 0; k < width; k++) next[i * width + k] = old[order[i] * width + k];
    return next;
  };
  return {
    count: made,
    finest: smallest,
    places: sorted(places, Float32Array, 3),
    normals: sorted(normals, Int8Array, 4),
    alongs: sorted(alongs, Int8Array, 4),
    owns: sorted(owns, Uint8Array, 4),
    ids: sorted(ids, Uint16Array, 1),
  };
}

// The land as a painter finds it, in shader source: what a stroke's own point is made of turns its
// own mix (OKLab) before the light picks a mix of it. `amount` is how much of this shows.
export const LAND_GLSL = /* glsl */ `
float hash1(float n) { return fract(sin(n * 12.9898) * 43758.5453); }
float hash2(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}
float vnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash2(i), hash2(i + vec2(1.0, 0.0)), f.x), mix(hash2(i + vec2(0.0, 1.0)), hash2(i + vec2(1.0, 1.0)), f.x), f.y);
}
// A mix made lighter or darker, its hue turned (radians) and its chroma scaled.
vec3 turned(vec3 lab, float lightness, float hue, float chroma) {
  float c = cos(hue), s = sin(hue);
  return vec3(lab.x * lightness, (lab.y * c - lab.z * s) * chroma, (lab.y * s + lab.z * c) * chroma);
}
// Sandstone. Beds of uneven thickness, gently warped, each with its own stain: most are the
// rock's own gold, some pale, some rust, a few a cool grey that the warm ones set off. Where two
// beds part there is a dark line in places, and dark streaks run down a face where water does.
// With tide set, the foot of the rock is wet and carries a band of weed, and the top is soil and
// dry grass.
vec3 rockPaint(vec3 lab, vec3 p, vec3 n, float sea, float amount, float hand, float tide) {
  float steep = 1.0 - smoothstep(0.5, 0.85, abs(n.y));
  float warp = (vnoise(p.xz * 0.045) - 0.5) * 3.2 + (vnoise(p.xz * 0.19 + 7.3) - 0.5) * 0.9;
  float bed = (p.y + warp) / 1.25;
  bed += 0.35 * sin(bed * 1.9 + 1.3) + 0.2 * sin(bed * 4.1);
  float which = floor(bed);
  float stain = mix(hash1(which * 1.37 + 0.71), vnoise(vec2(dot(p.xz, vec2(0.06, 0.045)), which * 3.71)), 0.45);
  float pale = 1.0 - smoothstep(0.2, 0.36, stain);
  float rust = smoothstep(0.6, 0.72, stain) * (1.0 - smoothstep(0.84, 0.92, stain));
  float cool = smoothstep(0.86, 0.94, stain);
  float parting = (1.0 - smoothstep(0.03, 0.14, fract(bed))) * step(0.45, hash1(which * 2.9 + 4.1));
  float streak = smoothstep(0.6, 0.8, vnoise(vec2(p.x * 0.55 + p.z * 0.4, p.z * 0.55 - p.x * 0.4) + vec2(0.0, p.y * 0.035)));
  float bedded = mix(0.35, 1.0, steep) * amount;
  float l = 1.0 + (0.04 * pale - 0.05 * rust - 0.04 * cool - 0.07 * parting) * bedded - 0.09 * streak * steep * amount;
  float h = (0.16 * pale - 0.34 * rust + 0.05 * cool) * bedded - 0.08 * streak * steep * amount;
  float c = 1.0 + (0.55 * rust - 0.32 * pale - 0.6 * cool) * bedded - 0.3 * streak * steep * amount;
  lab = turned(lab, l, h, c);
  if (tide > 0.5) {
    float above = p.y - sea;
    float wet = 1.0 - smoothstep(0.5, 1.5, above + 0.3 * (vnoise(p.xz * 0.7) - 0.5));
    lab = mix(lab, vec3(lab.x * 0.72, lab.yz * 0.75 + printShadeMix.xy * 0.15), wet * amount);
    float weed = (1.0 - smoothstep(0.0, 0.55, abs(above - 0.45 + 0.25 * (vnoise(p.xz * 1.3) - 0.5)))) * steep;
    lab = mix(lab, vec3(lab.x * 0.7, -0.045, 0.07), weed * 0.6 * amount);
    float top = smoothstep(0.75, 0.92, n.y) * smoothstep(10.0, 12.5, above);
    float grass = smoothstep(0.42, 0.7, vnoise(p.xz * 0.28) + 0.25 * (hand - 0.5));
    vec3 soil = vec3(lab.x * 0.86, lab.yz * 1.1 + vec2(0.012, 0.004));
    vec3 dry = vec3(lab.x * 0.97, 0.004, 0.095);
    vec3 sage = vec3(lab.x * 0.82, -0.04, 0.06);
    lab = mix(lab, mix(soil, mix(dry, sage, smoothstep(0.55, 0.8, vnoise(p.xz * 0.11 + 31.0))), grass), top * 0.75 * amount);
  }
  return lab;
}
// Sand: dark where the last wave reached, and holding the sky there; dry sand in warmer and
// cooler patches, with the lines the tide left.
vec3 sandPaint(vec3 lab, vec3 p, float sea, float amount) {
  float above = p.y - sea;
  float wet = 1.0 - smoothstep(0.05, 0.5, above + 0.12 * (vnoise(p.xz * 0.35) - 0.5));
  lab = mix(lab, vec3(lab.x * 0.8, lab.yz * 0.55 + printSkyLow.yz * 0.5), wet * 0.8 * amount);
  float zone = vnoise(p.xz * 0.22 + 11.0);
  float line = sin(above * 16.0 + vnoise(p.xz * 0.5) * 5.0);
  return turned(lab, 1.0 + ((zone - 0.5) * 0.07 + line * 0.018) * amount, (zone - 0.5) * 0.3 * amount, 1.0 + (0.5 - zone) * 0.35 * amount);
}
// Open ground: bare earth and dry grass in patches.
vec3 groundPaint(vec3 lab, vec3 p, float amount, float hand) {
  float zone = vnoise(p.xz * 0.09 + 3.0), fine = vnoise(p.xz * 0.6 + 9.0);
  float grass = smoothstep(0.5, 0.72, zone + (fine - 0.5) * 0.4);
  vec3 bare = vec3(lab.x * 0.95, lab.yz * 1.15 + vec2(0.014, 0.0));
  vec3 dry = vec3(lab.x * 1.08, 0.006, 0.09);
  lab = mix(mix(lab, bare, (1.0 - grass) * 0.5 * amount), dry, grass * 0.45 * amount);
  return turned(lab, 1.0 + (fine - 0.5) * 0.06 * amount, (hand - 0.5) * 0.2 * amount, 1.0);
}
// Scrub: sage, olive and a dusty blue-green in drifts; what faces up is lighter.
vec3 scrubPaint(vec3 lab, vec3 p, vec3 n, float amount, float hand) {
  float zone = vnoise(p.xz * 0.13 + 17.0), fine = vnoise(p.xz * 0.9 + 5.0);
  return turned(lab, 1.0 + ((fine - 0.5) * 0.16 + 0.1 * max(n.y, 0.0)) * amount, ((zone - 0.5) * 0.9 + (hand - 0.5) * 0.3) * amount, 1.0 + (zone - 0.5) * 0.5 * amount);
}
vec3 landPaint(vec3 lab, float land, vec3 p, vec3 n, float sea, float amount, float hand) {
  if (land < 1.5) return rockPaint(lab, p, n, sea, amount, hand, 1.0);
  if (land < 2.5) return sandPaint(lab, p, sea, amount);
  if (land < 3.5) return groundPaint(lab, p, amount, hand);
  if (land < 4.5) return scrubPaint(lab, p, n, amount, hand);
  return rockPaint(lab, p, n, sea, amount * 0.6, hand, 0.0);
}
`;

const vertexShader = (glsl) => /* glsl */ `
uniform sampler2D tStructure;
uniform sampler2D tAlbedo;
uniform sampler2D tDiffuse;
uniform float toneMappingExposure;
uniform vec2 paintResolution;
uniform vec4 paintScale;   // pixels a metre spans at one metre away (or anywhere, without perspective), 1 with perspective, the fewest and the most pixels a stroke may be long
uniform float paintSizes[${STROKE_SIZES.length}];
uniform vec4 paintStroke;  // width over length, opacity, how far a stroke may spill over what lies behind, how much its thickness catches the light
uniform vec3 paintVary;    // how far one stroke's lightness and chroma stray from the mix, and how far it wanders along its ramp of light (stops)
uniform vec4 paintBroken;  // how far a stroke turns its hue (radians), the share of strokes that are accents, how far an accent goes, how much the land's own painting shows
uniform vec4 paintManner;  // where a mark's paint begins and is full (of the sheet's red), gouache 0 to oil 1, how much longer a gouache stroke is
${glsl}
${LAND_GLSL}
attribute vec3 dabPlace;
attribute vec4 dabNormal;  // xyz the surface's normal, w its size and what land it is on
attribute vec4 dabAlong;   // xyz the direction of the stroke, w a number of its own
attribute vec4 dabOwn;     // rgb the surface's own colour (square root of linear), a another number of its own
attribute float dabId;
varying vec3 vLit;         // the stroke's colour where the key light reaches (display)
varying vec3 vShade;       // and where it does not
varying vec3 vBrush;       // xy across the mark, z which of the eight
varying vec4 vWhere;       // how far away the stroke is, whose it is, its length in metres, the key light's reach at its own point
varying vec3 vShape;       // how far the mark is bent, and its width and its length on the picture in pixels
void main() {
  vec4 world = modelMatrix * vec4(dabPlace, 1.0);
  vec4 view = viewMatrix * world;
  vec4 clip = projectionMatrix * view;
  float depth = -view.z;
  vec2 ndc = clip.xy / max(clip.w, 1e-5);
  vec2 uv = ndc * 0.5 + 0.5;
  float code = floor(dabNormal.w * 127.0 + 0.5);
  float land = floor(code / 8.0);
  float size = paintSizes[int(code - land * 8.0)];
  vec2 hand = vec2(dabAlong.w * 0.5 + 0.5, dabOwn.a);
  // A hand varies its reach.
  float lengthM = size * (0.72 + 0.56 * fract(hand.y * 13.7)) * paintManner.w;
  float px = lengthM * paintScale.x / (paintScale.y > 0.5 ? max(depth, 0.05) : 1.0);
  // A stroke is drawn when its own point is what the picture shows there.
  vec4 there = texture2D(tStructure, uv);
  bool seen = clip.w > 0.0 && abs(ndc.x) < 1.02 && abs(ndc.y) < 1.02 && px > paintScale.z
    && abs(there.z - dabId) < 0.5 && abs(there.w - depth) < 0.06 + 0.03 * depth
    // What lies under the sea is the sea's to paint.
    && !(printSea.w > 0.5 && (modelMatrix * vec4(dabPlace, 1.0)).y < printSea.x - 0.03);
  if (!seen) {
    gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
    return;
  }
  px = min(px, paintScale.w);
  // The mark lies along its direction as the picture sees it; seen end on, it is shorter.
  vec2 axis = (mat3(modelViewMatrix) * dabAlong.xyz).xy;
  float shown = length(axis);
  axis = shown > 0.08 ? axis / shown : vec2(1.0, 0.0);
  vec2 across = vec2(-axis.y, axis.x);
  float reach = px * mix(0.55, 1.0, clamp(shown, 0.0, 1.0));
  // (A bed of rock is said with a longer, thinner mark.)
  float wide = reach * paintStroke.x * (0.7 + 0.75 * fract(hand.x * 29.3)) * (land > 0.5 && land < 1.5 ? 0.8 : 1.0);
  gl_Position = vec4(ndc + (axis * position.x * reach + across * position.y * wide) * 2.0 / paintResolution, 0.0, 1.0);
  vBrush = vec3(position.xy, floor(fract(sin(dabId * 12.9898 + hand.x * 78.233) * 43758.5453) * 8.0));
  vShape = vec3((fract(hand.x * 57.3 + hand.y * 3.1) - 0.5) * 1.1, wide, reach);

  // What the stroke knows of its own spot. The light is read over the stroke's own body, on its
  // own thing, so one bright or dark pixel of the frame does not decide a whole mark.
  float light = luma(texture2D(tDiffuse, uv).rgb), taps = 1.0;
  for (int i = 0; i < 4; i++) {
    vec2 o = (i < 2 ? axis * reach : across * wide) * (i == 0 || i == 2 ? 0.3 : -0.3) / paintResolution;
    float same = step(abs(texture2D(tStructure, uv + o).z - dabId), 0.5);
    light += luma(texture2D(tDiffuse, uv + o).rgb) * same;
    taps += same;
  }
  light /= taps;
  vec3 spot = kindSkyKey(texture2D(tAlbedo, uv).a);
  float keyHere = step(0.5, spot.z);
  // How the surface lies: to the key light, to the sky, above the sea, and to the afterglow,
  // averaged over about a metre of the same thing, as the coat does: the mass, not the grain.
  vec3 faces = vec3(there.xy, sqrt(max(1.0 - dot(there.xy, there.xy), 0.0)));
  float metre = clamp(paintScale.x / (paintScale.y > 0.5 ? max(depth, 0.05) : 1.0), 2.0, 60.0);
  for (int i = 0; i < 8; i++) {
    float turn = float(i) * 0.785398 + 0.39;
    vec4 near = texture2D(tStructure, uv + vec2(cos(turn), sin(turn)) * metre / paintResolution);
    if (abs(near.z - dabId) < 0.5) faces += vec3(near.xy, sqrt(max(1.0 - dot(near.xy, near.xy), 0.0)));
  }
  faces = normalize(faces);
  vec3 up = normalize(transpose(mat3(viewMatrix)) * faces);
  vec4 geo = vec4(dot(faces, printSun.xyz), up.y, world.y - printSea.x, dot(faces, printGlow.xyz));
  vec3 own = dabOwn.rgb * dabOwn.rgb;
  vec3 own3 = ownMix(labLinear(own));
  if (land > 0.5 && paintBroken.w > 0.0) own3 = landPaint(own3, land, world.xyz, up, printSea.x, paintBroken.w, hand.y);
  float wander = (hand.x - 0.5) * 2.0 * paintVary.z * mix(1.0, 0.35, smoothstep(0.5, 4.0, size));
  // Two colours: where the key light reaches the stroke and where it does not. Seen from a spot
  // the sun is on, shade is what the sky alone would leave there, and the other way about.
  // (In a room the difference is the room's to say, so a stroke there takes its own spot's light.)
  float skyOnly = mix(1.0, 0.2, printDay.x * spot.y);
  vec3 read;
  vec3 lit = spotFill(own, own3, light / mix(skyOnly, 1.0, keyHere), spot.x, 1.0, spot.y, vec2(0.0), wander, geo, read);
  vec3 dark = spotFill(own, own3, light * mix(1.0, skyOnly, keyHere), spot.x, 0.0, spot.y, vec2(0.0), wander, geo, read);
  // The hand: no two strokes of one mass are the same paint. The broad strokes that block a
  // mass in stay close to its colour; the variety is in the small ones laid over them.
  float calm = mix(1.0, 0.35, smoothstep(0.5, 4.0, size));
  float third = fract(hand.x * 43.37 + hand.y * 17.11);
  float lighter = 1.0 + (hand.y - 0.5) * 2.0 * paintVary.x * calm;
  float stronger = 1.0 + (fract(hand.y * 7.31) - 0.5) * 2.0 * paintVary.y * calm;
  float hue = (third - 0.5) * 2.0 * paintBroken.x * calm;
  lit = turned(lit, lighter, hue, stronger);
  dark = turned(dark, lighter, hue, stronger);
  // An accent keeps its value and changes its temperature: the shade's cool laid into light, the
  // warm the ground throws back laid into shade.
  // (A thing with almost no colour of its own takes none: an orange touch on white marble is a stain.)
  float accent = step(1.0 - paintBroken.y, fract(hand.x * 91.7 + third * 3.3)) * paintBroken.z * step(size, 1.5) * smoothstep(0.02, 0.07, length(own3.yz));
  lit = mix(lit, vec3(lit.x, lit.yz * 0.75 + printShadeMix.xy * 0.22), accent);
  dark = mix(dark, vec3(dark.x, dark.yz * 0.6 + printBounce.xy * 1.2 + printLightMix.xy * 0.3), accent);
  // Oil goes deeper in its darks than gouache does.
  dark = vec3(dark.x * mix(1.03, 0.94, paintManner.z), dark.yz * mix(0.95, 1.1, paintManner.z));
  vLit = unlab(airFill(lit, depth));
  vShade = unlab(airFill(dark, depth));
  vWhere = vec4(depth, dabId, size, keyHere);
}`;

// A stroke is one colour of its own. Only the key light's reach is read at every pixel, so a cast
// shadow keeps its edge across a stroke, as a painter goes back over a shadow's edge. The mark's
// thickness is lit from the upper left, as a canvas is in a room.
const fragmentShader = (glsl) => /* glsl */ `
uniform sampler2D tStructure;
uniform sampler2D tAlbedo;
uniform sampler2D paintBrush;
uniform float toneMappingExposure;
uniform vec2 paintResolution;
uniform vec4 paintStroke;
uniform vec4 paintManner;
varying vec3 vLit;
varying vec3 vShade;
varying vec3 vBrush;
varying vec4 vWhere;
varying vec3 vShape;
${glsl}
void main() {
  // The mark bends, each stroke its own way.
  vec2 at = vec2(vBrush.x, vBrush.y + vShape.x * (vBrush.x * vBrush.x - 0.25));
  vec2 cell = vec2(mod(vBrush.z, ${BRUSH_SHEET.columns}.0), floor(vBrush.z / ${BRUSH_SHEET.columns}.0));
  vec4 mark = texture2D(paintBrush, (cell + clamp(at, -0.5, 0.5) + 0.5) / vec2(${BRUSH_SHEET.columns}.0, ${BRUSH_SHEET.rows}.0));
  float relief = clamp((dFdx(mark.g) - dFdy(mark.g)) * vShape.y * 0.22, -1.0, 1.0);
  // A loaded brush leaves an edge: the paint is there or it is not.
  float paint = smoothstep(paintManner.x, paintManner.y, mark.r) * step(abs(at.y), 0.5);
  if (paint < 0.03) discard;
  // On another thing's pixel: never over what stands in front, and only a little over what lies
  // behind. On its own thing a stroke still stops at a part that stands well in front of it.
  vec2 uv = gl_FragCoord.xy / paintResolution;
  vec4 there = texture2D(tStructure, uv);
  bool own = abs(there.z - vWhere.y) < 0.5;
  // (A broad stroke spills no farther than a fine one: a few pixels.)
  float spill = min(paintStroke.z, 9.0 / max(vShape.z, 1.0));
  if (own ? there.w < vWhere.x - max(0.08, 0.35 * vWhere.z) : (there.w < vWhere.x - 0.04 || max(abs(vBrush.x), abs(vBrush.y)) > spill)) discard;
  float key = own ? step(0.5, kindSkyKey(texture2D(tAlbedo, uv).a).z) : vWhere.w;
  vec3 colour = mix(vShade, vLit, key);
  colour *= 1.0 + relief * paintStroke.w + (mark.g - 0.5) * paintStroke.w * 0.5;
  gl_FragColor = vec4(colour, paint * paintStroke.y);
}`;

// The sky and the sea are painted too, with the same marks, from the look's own design of them
// (FIELD_GLSL in print-look.mjs: skyPaint and seaPaint). A stroke of sky is pinned to a direction
// of the world, and one of sea to a point of the water, so neither swims when the view turns.
//
// Sky: three sizes over the whole dome, largest first, each along the level with a slow drift.
export const SKY_SIZES = Object.freeze([0.035, 0.09, 0.22]); // radians
// Sea: three sizes in each of three bands of distance from the house, each band three times
// broader than the last. Past `SEA_NEAR` metres the strokes thin out as the distance grows: seen
// from the house the far water is looked along, and a stroke there covers a great deal of it.
export const SEA_SIZES = Object.freeze([1.2, 3.6, 10.8, 32.4, 97.2]); // metres
export const SEA_BANDS = Object.freeze([
  { to: 90, finest: 0 },
  { to: 420, finest: 1 },
  { to: 3200, finest: 2 },
]);
export const SEA_NEAR = 90;
const fieldDrift = valueNoise(523),
  fieldSway = valueNoise(389);
export function scatterSky(seed = 20261116) {
  const random = strokeRandom(seed),
    low = -0.03,
    solid = 2 * Math.PI * (1 - low),
    places = [],
    alongs = [],
    hands = [];
  for (let layer = SKY_SIZES.length - 1; layer >= 0; layer--) {
    const size = SKY_SIZES[layer],
      count = Math.round((solid / (STROKE_ASPECT * size * size)) * STROKE_COVER[layer]);
    for (let i = 0; i < count; i++) {
      const y = low + random() * (1 - low),
        turn = random() * 2 * Math.PI,
        run = Math.sqrt(Math.max(1 - y * y, 0)),
        x = run * Math.cos(turn),
        z = run * Math.sin(turn),
        // Along the level, leaning up or down by a slow drift and a little of its own.
        lean = (fieldDrift(turn * 1.9, y * 4) - 0.5) * 1.1 + (random() - 0.5) * 0.4;
      places.push(x, y, z);
      alongs.push(
        -Math.sin(turn) * Math.cos(lean) - y * Math.cos(turn) * Math.sin(lean),
        run * Math.sin(lean),
        Math.cos(turn) * Math.cos(lean) - y * Math.sin(turn) * Math.sin(lean)
      );
      hands.push(size, random(), random());
    }
  }
  return { count: hands.length / 3, places: new Float32Array(places), alongs: new Float32Array(alongs), hands: new Float32Array(hands) };
}
// `centre` is the house; the sea lies on its -z side. Largest strokes first.
export function scatterSea(centre, seed = 20261117) {
  const random = strokeRandom(seed),
    layers = [];
  SEA_BANDS.forEach((band, index) => {
    const from = index ? SEA_BANDS[index - 1].to : 0,
      area = (Math.PI / 2) * (band.to * band.to - from * from);
    for (let layer = 0; layer < STROKE_LAYERS; layer++) {
      const size = SEA_SIZES[band.finest + layer],
        tries = Math.round((area / (STROKE_ASPECT * size * size)) * STROKE_COVER[layer]),
        places = [],
        alongs = [],
        hands = [];
      for (let i = 0; i < tries; i++) {
        const radius = Math.sqrt(from * from + random() * (band.to * band.to - from * from)),
          turn = Math.PI + random() * Math.PI,
          keep = random(),
          own = [random(), random(), random()];
        if (keep > SEA_NEAR / Math.max(radius, SEA_NEAR)) continue;
        const x = centre.x + radius * Math.cos(turn),
          z = centre.z + radius * Math.sin(turn),
          // Along the shore, swaying a little from place to place.
          lean = (fieldSway(x * 0.02, z * 0.02) - 0.5) * 0.5 + (own[0] - 0.5) * 0.24;
        places.push(x, 0, z);
        alongs.push(Math.cos(lean), 0, Math.sin(lean));
        hands.push(size, own[1], own[2]);
      }
      layers.push({ size, places, alongs, hands });
    }
  });
  layers.sort((a, b) => b.size - a.size);
  const all = (key) => new Float32Array(layers.flatMap((layer) => layer[key]));
  const hands = all("hands");
  return { count: hands.length / 3, places: all("places"), alongs: all("alongs"), hands };
}

const fieldVertexShader = (glsl) => /* glsl */ `
uniform sampler2D tStructure;
uniform float toneMappingExposure;
uniform vec2 paintResolution;
uniform vec4 paintScale;
uniform vec4 paintStroke;
uniform vec3 paintVary;
uniform vec4 paintBroken;
uniform vec4 paintManner;
${glsl}
${LAND_GLSL}
attribute vec3 fieldPlace;  // a point of the sea (x and z), or a direction of the sky
attribute vec3 fieldAlong;  // the direction of the stroke, in the world
attribute vec3 fieldHand;   // its length (metres on the sea, radians in the sky) and two numbers of its own
varying vec3 vColour;
varying vec3 vBrush;
varying vec3 vShape;        // how far the mark is bent, its width on the picture in pixels, how much of it shows
varying vec3 vRay;          // the look through this corner of the mark, in the camera's space, at one metre
varying vec4 vPlane;        // the sea's surface in the camera's space: its normal, and where it lies along it
void main() {
  vec2 hand = fieldHand.yz;
  vec3 seaUp = mat3(viewMatrix) * vec3(0.0, 1.0, 0.0);
  vPlane = vec4(seaUp, dot(seaUp, (viewMatrix * vec4(0.0, printSea.x, 0.0, 1.0)).xyz));
  #ifdef FIELD_SEA
    vec3 place = vec3(fieldPlace.x, printSea.x, fieldPlace.z);
    vec4 view = viewMatrix * vec4(place, 1.0);
  #else
    vec4 view = vec4(mat3(viewMatrix) * fieldPlace, 0.0);
  #endif
  vec4 clip = projectionMatrix * view;
  float depth = -view.z;
  vec2 ndc = clip.xy / max(clip.w, 1e-5);
  vec2 uv = ndc * 0.5 + 0.5;
  float px = fieldHand.x * (0.75 + 0.5 * fract(hand.y * 13.7)) * paintManner.w * paintScale.x / max(depth, 0.05);
  float solid = texture2D(tStructure, uv).w;
  // A stroke is drawn when its own point is sky, or sea, in the picture.
  bool seen = paintScale.y > 0.5 && printSea.w > 0.5 && clip.w > 0.0 && abs(ndc.x) < 1.05 && abs(ndc.y) < 1.05 && px > paintScale.z
  #ifdef FIELD_SEA
    && vPlane.w < -0.05 && solid > depth + 0.03;
  #else
    && solid > 50000.0 && fieldPlace.y > 0.002;
  #endif
  if (!seen) {
    gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
    return;
  }
  float third = fract(hand.x * 43.37 + hand.y * 17.11);
  #ifdef FIELD_SEA
    vec3 look = normalize(place - cameraPosition);
    // How much water lies over the bed under the stroke.
    vec3 bed = view.xyz * (solid / depth);
    float under = solid > 50000.0 ? 60.0 : printSea.x - ((transpose(mat3(viewMatrix)) * bed).y + cameraPosition.y);
    float white;
    vec3 fill = seaPaint(place.xz, under, look, hand, white);
    fill = airFill(fill, distance(place, cameraPosition) * 0.5);
    float quiet = 1.0 - white;
  #else
    float cloud;
    vec3 fill = skyPaint(normalize(fieldPlace), cloud);
    float quiet = 1.0;
  #endif
  // The hand, as on land: every stroke a little its own paint.
  fill = turned(
    fill,
    1.0 + (hand.y - 0.5) * 2.0 * paintVary.x * quiet,
    (third - 0.5) * 2.0 * paintBroken.x * 0.7 * quiet,
    1.0 + (fract(hand.y * 7.31) - 0.5) * 2.0 * paintVary.y * quiet
  );
  vColour = unlab(fill);
  vec2 axis = (mat3(viewMatrix) * fieldAlong).xy;
  float shown = length(axis);
  axis = shown > 0.08 ? axis / shown : vec2(1.0, 0.0);
  vec2 across = vec2(-axis.y, axis.x);
  float reach = min(px, paintScale.w) * mix(0.55, 1.0, clamp(shown, 0.0, 1.0));
  float wide = reach * paintStroke.x * (0.7 + 0.75 * fract(hand.x * 29.3));
  #ifdef FIELD_SEA
    // Water far off is looked along, and lies in thin lines.
    wide *= mix(0.4, 1.0, clamp(-look.y * 3.0, 0.0, 1.0));
  #endif
  vec2 corner = ndc + (axis * position.x * reach + across * position.y * wide) * 2.0 / paintResolution;
  gl_Position = vec4(corner, 0.0, 1.0);
  vRay = vec3(corner.x / projectionMatrix[0][0], corner.y / projectionMatrix[1][1], -1.0);
  vBrush = vec3(position.xy, floor(fract(sin(hand.x * 78.233 + hand.y * 12.9898) * 43758.5453) * 8.0));
  vShape = vec3((fract(hand.x * 57.3 + hand.y * 3.1) - 0.5) * 1.1, wide, smoothstep(paintScale.z, paintScale.z * 1.6, px));
}`;

// A stroke of sky stops at anything solid and at the sea; one of sea stops at the land. The sun's
// or the moon's own disc and the stars are left to the coat.
const fieldFragmentShader = (glsl) => /* glsl */ `
uniform sampler2D tStructure;
uniform sampler2D tDiffuse;
uniform sampler2D paintBrush;
uniform float toneMappingExposure;
uniform vec2 paintResolution;
uniform vec4 paintStroke;
uniform vec4 paintManner;
uniform vec2 paintField;   // how much the sky's strokes show, and the sea's
varying vec3 vColour;
varying vec3 vBrush;
varying vec3 vShape;
varying vec3 vRay;
varying vec4 vPlane;
${glsl}
void main() {
  vec2 at = vec2(vBrush.x, vBrush.y + vShape.x * (vBrush.x * vBrush.x - 0.25));
  vec2 cell = vec2(mod(vBrush.z, ${BRUSH_SHEET.columns}.0), floor(vBrush.z / ${BRUSH_SHEET.columns}.0));
  vec4 mark = texture2D(paintBrush, (cell + clamp(at, -0.5, 0.5) + 0.5) / vec2(${BRUSH_SHEET.columns}.0, ${BRUSH_SHEET.rows}.0));
  float relief = clamp((dFdx(mark.g) - dFdy(mark.g)) * vShape.y * 0.22, -1.0, 1.0);
  float paint = smoothstep(paintManner.x, paintManner.y, mark.r) * step(abs(at.y), 0.5);
  if (paint < 0.03) discard;
  vec2 uv = gl_FragCoord.xy / paintResolution;
  float solid = texture2D(tStructure, uv).w;
  // How far along this pixel's look the sea is met, if it is.
  float toward = dot(vPlane.xyz, vRay);
  float water = vPlane.w < -0.05 && toward < -1e-5 ? vPlane.w / toward : 1e9;
  #ifdef FIELD_SEA
    if (water > solid - 0.03) discard;
    float shows = paintField.y;
  #else
    if (solid < 50000.0 || water < 1e8) discard;
    if (dot(normalize(vRay), printSun.xyz) > 0.9993) discard;
    // By night whatever stands out of the dark is a star, and is the coat's.
    float night = 1.0 - smoothstep(0.3, 0.45, printSkyTop.x);
    float star = smoothstep(0.03, 0.12, luma(texture2D(tDiffuse, uv).rgb) * toneMappingExposure) * night;
    float shows = paintField.x * (1.0 - star);
  #endif
  vec3 colour = vColour * (1.0 + relief * paintStroke.w + (mark.g - 0.5) * paintStroke.w * 0.5);
  gl_FragColor = vec4(colour, paint * paintStroke.y * vShape.z * shows);
}`;

// How much of the paint a device can carry: all of it on a desktop, half on a touch screen or on a
// machine that reports at most 4 GB of memory or 4 cores, where every stroke's vertices cost more
// than they are worth. `asked` (the strokeThin dial) overrides it.
export function paintThin(asked = null, env = globalThis) {
  if (Number.isFinite(asked)) return Math.min(Math.max(asked, 0.1), 1);
  const coarse = typeof env.matchMedia === "function" && env.matchMedia("(pointer: coarse)").matches,
    nav = env.navigator || {},
    small = (nav.deviceMemory ?? 8) <= 4 || (nav.hardwareConcurrency ?? 8) <= 4;
  return coarse || small ? 0.5 : 1;
}

// The manner of the paint, from the sine of the sun's elevation: gouache (0) while the sun stands
// high, oil (1) as it goes down and through the night.
export function paintManner(sunHeight) {
  return 1 - smooth(0.1, 0.45, sunHeight);
}

// `glsl` and `uniforms` are the look's colour source (COLOUR_GLSL and FIELD_GLSL of print-look.mjs)
// and its uniform objects (shared, so the hour and the dials reach the strokes with no copying);
// `tools` its tests for what a material is.
export function createPaint({ glsl, uniforms: look, tools }) {
  const scene = new THREE.Scene();
  scene.matrixWorldAutoUpdate = false;
  const sheet = new THREE.DataTexture(
    brushSheetPixels(),
    BRUSH_SHEET.columns * BRUSH_SHEET.width,
    BRUSH_SHEET.rows * BRUSH_SHEET.height,
    THREE.RGBAFormat
  );
  sheet.minFilter = THREE.LinearMipmapLinearFilter;
  sheet.magFilter = THREE.LinearFilter;
  sheet.generateMipmaps = true;
  sheet.needsUpdate = true;
  const shared = Object.fromEntries(
    [
      "printKey",
      "printDay",
      "printMoon",
      "printLocal",
      "printSpread",
      "printLightMix",
      "printShadeMix",
      "printMore",
      "printDeep",
      "printNight",
      "printSun",
      "printGlow",
      "printBounce",
      "printSkyLow",
      "printAir",
      "printSkyTop",
      "printSunDir",
      "printKeyDir",
      "printWeather",
      "printSea",
      "printSeaShallow",
      "printSeaDeep",
      "tStructure",
      "tAlbedo",
      "tDiffuse",
      "toneMappingExposure",
    ].map((name) => [name, look[name]])
  );
  const uniforms = {
    ...shared,
    paintResolution: { value: new THREE.Vector2(1, 1) },
    paintScale: { value: new THREE.Vector4(1, 1, 5, 150) },
    paintSizes: { value: [...STROKE_SIZES] },
    paintStroke: { value: new THREE.Vector4(STROKE_ASPECT, 0.92, 0.3, 0.22) },
    paintVary: { value: new THREE.Vector3(0.045, 0.1, 0.4) },
    paintBroken: { value: new THREE.Vector4(0, 0, 0, 0) },
    paintManner: { value: new THREE.Vector4(0.3, 0.52, 1, 1) },
    paintField: { value: new THREE.Vector2(1, 1) },
    paintBrush: { value: sheet },
  };
  const material = new THREE.ShaderMaterial({
    name: "Brush strokes",
    uniforms,
    vertexShader: vertexShader(glsl),
    fragmentShader: fragmentShader(glsl),
    transparent: true,
    depthTest: false,
    depthWrite: false,
    toneMapped: false,
  });
  // One quad, drawn once for every stroke.
  const quad = {
    position: new THREE.BufferAttribute(new Float32Array([-0.5, -0.5, 0, 0.5, -0.5, 0, 0.5, 0.5, 0, -0.5, 0.5, 0]), 3),
    index: new THREE.BufferAttribute(new Uint16Array([0, 1, 2, 0, 2, 3]), 1),
  };
  // The sky's strokes and the sea's: one mesh each, drawn before the land's, sky first.
  const fields = new THREE.Scene();
  fields.matrixWorldAutoUpdate = false;
  const fieldMaterial = (name, define) =>
    new THREE.ShaderMaterial({
      name,
      uniforms,
      defines: { [define]: "" },
      vertexShader: fieldVertexShader(glsl),
      fragmentShader: fieldFragmentShader(glsl),
      transparent: true,
      depthTest: false,
      depthWrite: false,
      toneMapped: false,
    });
  const skyMaterial = fieldMaterial("Sky strokes", "FIELD_SKY"),
    seaMaterial = fieldMaterial("Sea strokes", "FIELD_SEA");
  const fieldMesh = (found, fieldsMaterial, order) => {
    const geometry = new THREE.InstancedBufferGeometry();
    geometry.setAttribute("position", quad.position);
    geometry.setIndex(quad.index);
    geometry.setAttribute("fieldPlace", new THREE.InstancedBufferAttribute(found.places, 3));
    geometry.setAttribute("fieldAlong", new THREE.InstancedBufferAttribute(found.alongs, 3));
    geometry.setAttribute("fieldHand", new THREE.InstancedBufferAttribute(found.hands, 3));
    geometry.instanceCount = found.count;
    const mesh = new THREE.Mesh(geometry, fieldsMaterial);
    mesh.frustumCulled = false;
    mesh.matrixAutoUpdate = false;
    mesh.matrixWorldAutoUpdate = false;
    mesh.renderOrder = order;
    fields.add(mesh);
    return mesh;
  };
  let skyMesh = null,
    seaMesh = null;
  const painted = [],
    focus = new THREE.Vector3();
  let queue = null,
    strokes = 0,
    fineStrokes = 0,
    world = null,
    draws = 0,
    oil = 1,
    thin = 1,
    scatterMs = 0;
  const eye = new THREE.Vector3(),
    middle = new THREE.Vector3();

  function strokeMesh(found, object, order) {
    const geometry = new THREE.InstancedBufferGeometry();
    geometry.setAttribute("position", quad.position);
    geometry.setIndex(quad.index);
    geometry.setAttribute("dabPlace", new THREE.InstancedBufferAttribute(found.places, 3));
    geometry.setAttribute("dabNormal", new THREE.InstancedBufferAttribute(found.normals, 4, true));
    geometry.setAttribute("dabAlong", new THREE.InstancedBufferAttribute(found.alongs, 4, true));
    geometry.setAttribute("dabOwn", new THREE.InstancedBufferAttribute(found.owns, 4, true));
    geometry.setAttribute("dabId", new THREE.InstancedBufferAttribute(found.ids, 1));
    geometry.instanceCount = found.count;
    // A stroke can reach past its mesh by its own length.
    geometry.boundingSphere = object.geometry.boundingSphere.clone();
    geometry.boundingSphere.radius += STROKE_SIZES[STROKE_SIZES.length - 1];
    const mesh = new THREE.Mesh(geometry, material);
    mesh.matrixAutoUpdate = false;
    mesh.matrixWorldAutoUpdate = false;
    // Fine strokes are laid over every thing's broad ones.
    mesh.renderOrder = order;
    scene.add(mesh);
    return mesh;
  }
  function drop(entry) {
    scene.remove(entry.fine);
    fineStrokes -= entry.fine.geometry.instanceCount;
    entry.fine.geometry.dispose();
    entry.fine = null;
  }
  // The finer paint of whatever the eye stands close to, nearest first, for a few milliseconds;
  // what it has left behind gives its fine paint up.
  function refine(camera, milliseconds) {
    const from = performance.now(),
      until = from + milliseconds,
      wanted = [];
    camera.getWorldPosition(eye);
    for (const entry of painted) {
      if (entry.land || !(entry.finest > 0) || !entry.mesh.visible) continue;
      const sphere = entry.source.geometry.boundingSphere,
        away = middle.copy(sphere.center).applyMatrix4(entry.source.matrixWorld).distanceTo(eye) - sphere.radius;
      if (entry.fine) {
        // Left behind, or (a large thing) painted for where the eye was and not where it is.
        if (away > STROKE_FINE.far || (sphere.radius > STROKE_FINE.reach * 0.5 && entry.fineAt.distanceTo(eye) > STROKE_FINE.step)) {
          if (away <= STROKE_FINE.far) wanted.push({ entry, away });
          else drop(entry);
        }
      } else if (away < STROKE_FINE.near && entry.fine !== false) wanted.push({ entry, away });
    }
    wanted.sort((p, q) => p.away - q.away);
    for (const { entry } of wanted) {
      if (performance.now() >= until || fineStrokes >= STROKE_FINE.limit * thin) break;
      const again = Boolean(entry.fine);
      if (again) drop(entry);
      const found = scatterStrokes(entry.source, {
        focus,
        tools,
        fine: entry.finest,
        eye,
        thin,
        limit: Math.min(STROKE_LIMITS.mesh, STROKE_FINE.limit * thin - fineStrokes),
      });
      // (false: looked, and it has nothing finer to take. A large thing is asked again as the eye moves.)
      entry.fine = found ? strokeMesh(found, entry.source, 1) : again ? null : false;
      if (found) {
        fineStrokes += found.count;
        entry.fineAt = eye.clone();
      }
    }
    scatterMs += performance.now() - from;
  }

  // Everything still that can be painted, nearest the view's centre first.
  function begin(root, centre, dials) {
    world = root;
    thin = paintThin(dials?.strokeThin);
    focus.copy(centre);
    queue = [];
    // The sky is the same everywhere; the sea is scattered round the house.
    skyMesh ||= fieldMesh(scatterSky(), skyMaterial, 0);
    if (seaMesh) {
      fields.remove(seaMesh);
      seaMesh.geometry.dispose();
    }
    seaMesh = fieldMesh(scatterSea(focus), seaMaterial, 1);
    root.updateMatrixWorld();
    root.traverse((object) => {
      if (!object.isMesh || object.isSkinnedMesh || object.isInstancedMesh || !object.geometry?.attributes?.position) return;
      if (!object.geometry.boundingSphere) object.geometry.computeBoundingSphere();
      const distance = object.geometry.boundingSphere.center.clone().applyMatrix4(object.matrixWorld).distanceTo(focus);
      queue.push({ object, distance });
    });
    queue.sort((p, q) => q.distance - p.distance);
  }
  // Scatter for a few milliseconds; the painting fills in over the first frames.
  function scatter(milliseconds) {
    const from = performance.now(),
      until = from + milliseconds;
    while (queue?.length && strokes < STROKE_LIMITS.scene && performance.now() < until) {
      const { object } = queue.pop(),
        found = scatterStrokes(object, { focus, tools, thin, limit: Math.min(STROKE_LIMITS.mesh, STROKE_LIMITS.scene - strokes) });
      if (!found) continue;
      const mesh = strokeMesh(found, object, 0);
      painted.push({
        mesh,
        source: object,
        finest: found.finest,
        land: BROAD.test(`${object.name} ${[object.material].flat()[0]?.name || ""}`),
        fine: null,
      });
      strokes += found.count;
    }
    if (queue && (!queue.length || strokes >= STROKE_LIMITS.scene)) queue = [];
    scatterMs += performance.now() - from;
  }
  const shown = (object) => {
    for (let o = object; o; o = o.parent) if (!o.visible) return false;
    return true;
  };
  const between = (a, b, t) => a + (b - a) * t;

  return {
    scene,
    material,
    // Draws the strokes over what the target already holds (the coat). `extent` is the view's full
    // height at one metre (or its height in metres without perspective), and `sunHeight` the sine
    // of the sun's elevation, which sets the paint's manner unless the dials fix it.
    // A view that holds still (reduced motion, or paused) is painted in one go, since no later
    // frame is promised; a moving one fills in over its first frames.
    render(renderer, root, camera, { width, height, extent, centre, dials, still = false, sunHeight = 1 }) {
      if (world !== root) begin(root, centre || camera.position, dials);
      if (queue.length) scatter(still ? Infinity : dials.strokeScatter);
      else refine(camera, still ? Infinity : dials.strokeScatter);
      const perspective = camera.isPerspectiveCamera;
      oil = Number.isFinite(dials.manner) ? Math.min(Math.max(dials.manner, 0), 1) : paintManner(sunHeight);
      uniforms.paintResolution.value.set(width, height);
      uniforms.paintScale.value.set(height / Math.max(extent, 1e-6), perspective ? 1 : 0, dials.strokePixels[0], dials.strokePixels[1]);
      // Gouache lies flat; oil stands up from the picture.
      uniforms.paintStroke.value.set(STROKE_ASPECT, dials.strokeOpacity, dials.strokeSpill, dials.strokeImpasto * between(0.3, 0.6, oil));
      uniforms.paintVary.value.set(dials.strokeVary[0], dials.strokeVary[1], dials.strokeVary[2]);
      // Oil is a little more broken than gouache and its bristles part a little sooner. More than
      // this, and a lamp-lit room at night flickered stroke by stroke (November 17).
      const broken = between(0.7, 0.95, oil);
      uniforms.paintBroken.value.set(dials.strokeBroken[0] * broken, dials.strokeBroken[1], dials.strokeBroken[2] * broken, dials.landPaint);
      uniforms.paintManner.value.set(between(0.24, 0.3, oil), between(0.44, 0.52, oil), oil, between(1.15, 0.92, oil));
      // A stroke goes where its thing goes, and is put away with it.
      for (const { mesh, source, fine } of painted) {
        mesh.visible = shown(source);
        if (mesh.visible) mesh.matrixWorld.copy(source.matrixWorld);
        if (fine) {
          fine.visible = mesh.visible;
          if (fine.visible) fine.matrixWorld.copy(source.matrixWorld);
        }
      }
      uniforms.paintField.value.set(dials.skyStrokes, dials.seaStrokes);
      skyMesh.visible = perspective && dials.skyStrokes > 0;
      seaMesh.visible = perspective && dials.seaStrokes > 0;
      const clear = renderer.autoClear,
        before = renderer.info.render.calls;
      renderer.autoClear = false;
      if (skyMesh.visible || seaMesh.visible) renderer.render(fields, camera);
      renderer.render(scene, camera);
      renderer.autoClear = clear;
      draws = renderer.info.render.calls - before;
    },
    evidence() {
      return {
        strokes,
        fine: fineStrokes,
        meshes: painted.length,
        waiting: queue ? queue.length : null,
        draws,
        scatterMs: Math.round(scatterMs),
        manner: oil,
        thin,
        sky: skyMesh?.geometry.instanceCount ?? 0,
        sea: seaMesh?.geometry.instanceCount ?? 0,
      };
    },
    dispose() {
      for (const { mesh, fine } of painted) {
        mesh.geometry.dispose();
        if (fine) fine.geometry.dispose();
      }
      painted.length = 0;
      scene.clear();
      for (const mesh of [skyMesh, seaMesh]) mesh?.geometry.dispose();
      fields.clear();
      skyMaterial.dispose();
      seaMaterial.dispose();
      material.dispose();
      sheet.dispose();
    },
  };
}
