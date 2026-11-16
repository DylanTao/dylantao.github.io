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
// asks the look's structure buffers about its own point: is it in view, does the key light reach
// it, how much light does the frame hold there. It takes one colour for its whole mark from the same
// three mixes the coat under it uses (COLOUR_GLSL in print-look.mjs), varied a little, and is drawn
// as a small quad along its direction as the picture sees it. Blendi's game gives the rule for the
// colour: each thing has a light, a half-tone and a shade mix, and the light on a stroke's spot
// picks one.
//
//   sizes    five lengths, each three times the last. Large strokes are laid first and small ones
//            over them, as a painter blocks in before detailing. A stroke shorter than a few pixels
//            is not drawn, so distance thins the paint by itself.
//   edges    a stroke may spill a little over what lies behind its own thing, never over what
//            stands in front, so a chair leg stays a chair leg with a brushed edge.
//   figures  are not painted: they stay flat cels on the painted world, as in drawn animation.
//
// Nothing here runs unless a look asks for paint.

// A stroke's length in metres, finest first.
export const STROKE_SIZES = Object.freeze([0.12, 0.36, 1.08, 3.24, 9.72]);
// Width over length, and how many times over each size covers a surface.
export const STROKE_ASPECT = 0.3;
const COVER = 1.5;
// Strokes a square metre for each size.
export const STROKE_DENSITY = Object.freeze(STROKE_SIZES.map((size) => COVER / (STROKE_ASPECT * size * size)));
// The most strokes the scene may hold, and the most one mesh may.
export const STROKE_LIMITS = Object.freeze({ scene: 1300000, mesh: 260000 });

// A stroke suits the thing it paints: the finest is about an eighteenth of the thing's length (a
// cushion gets the smallest, a wall or a floor the next), and three sizes are laid from there up.
// Ground and rock are painted broadly, and more broadly far from where the view is centred.
const BROAD = /hinterland|coast_|mainland|cliff|bluff|beach|terrain|boulder|sandstone/i;
export const STROKE_LAYERS = 3;
export function finestStroke(name, distance, length = 1) {
  if (BROAD.test(name)) return distance < 70 ? 2 : 3;
  let finest = 0;
  while (finest < 2 && STROKE_SIZES[finest] < length / 18) finest++;
  return Math.max(finest, distance < 32 ? 0 : distance < 90 ? 1 : 2);
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

// The direction a brush would follow on a surface, in world space: along the boards on anything
// level, upright on a post, and across a wall or a cliff the way its courses and strata run.
export function strokeAlong(normal, longAxis, upright, out) {
  if (Math.abs(normal.y) > 0.75) out.copy(longAxis);
  else if (upright) out.set(0, 1, 0);
  else out.set(normal.z, 0, -normal.x);
  // Lay it in the surface.
  out.addScaledVector(normal, -out.dot(normal));
  if (out.lengthSq() < 1e-8) out.set(1, 0, 0).addScaledVector(normal, -normal.x);
  return out.normalize();
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

// Eight brush marks on one sheet, four by two, made here and not copied from anywhere. Red is how
// much paint a point holds, green how thick it lies. A mark starts loaded and ends dry: toward its
// tail the bristles part and the ground shows between them.
export const BRUSH_SHEET = Object.freeze({ columns: 4, rows: 2, width: 256, height: 64 });
export function brushSheetPixels() {
  const { columns, rows, width, height } = BRUSH_SHEET,
    data = new Uint8Array(columns * width * rows * height * 4);
  for (let mark = 0; mark < columns * rows; mark++) {
    const noise = valueNoise(mark * 7919 + 13),
      ox = (mark % columns) * width,
      oy = Math.floor(mark / columns) * height;
    for (let y = 0; y < height; y++)
      for (let x = 0; x < width; x++) {
        const u = (x + 0.5) / width,
          v = (y + 0.5) / height - 0.5;
        const bristle = noise(u * 3 + 17, v * 46),
          body = noise(u * 9, v * 9 + 31),
          start = 0.06 + 0.07 * noise(v * 6, 1.7),
          end = 0.92 - 0.16 * noise(v * 7, 9.1),
          half = 0.39 + 0.08 * (noise(u * 4, 3.3) - 0.5) - 0.1 * smooth(0.7, 1, u);
        let paint =
          smooth(start - 0.03, start + 0.03, u) * (1 - smooth(end - 0.05, end + 0.05, u)) * (1 - smooth(half - 0.05, half + 0.03, Math.abs(v)));
        const dry = 0.08 + 0.9 * smooth(0.45, 1, u);
        paint *= 1 - dry * smooth(0.42, 0.62, bristle);
        paint *= 0.82 + 0.18 * body;
        // Thick along the loaded bristles and where the mark's edge piles up.
        const ridge = smooth(half - 0.12, half - 0.02, Math.abs(v)) * (1 - smooth(half - 0.02, half + 0.03, Math.abs(v)));
        const thick = 0.5 + 0.45 * (bristle - 0.5) + 0.3 * ridge;
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
// material is (structureId, structureKind, structureSkips), so paint and structure agree.
export function scatterStrokes(mesh, { focus, tools, thin = 1, limit = STROKE_LIMITS.mesh }) {
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
    point = new THREE.Vector3(),
    unturn = new THREE.Matrix3().setFromMatrix4(world).invert();
  // What the whole mesh is like: which way its long side runs, and whether it stands like a post.
  if (!geometry.boundingBox) geometry.computeBoundingBox();
  const size = geometry.boundingBox.getSize(new THREE.Vector3()).applyMatrix3(new THREE.Matrix3().setFromMatrix4(world));
  size.set(Math.abs(size.x), Math.abs(size.y), Math.abs(size.z));
  const longAxis = size.x >= size.z ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 0, 1),
    upright = size.y > 2.2 * Math.max(size.x, size.z),
    length = Math.max(size.x, size.y, size.z);

  let capacity = 4096,
    made = 0;
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
        finest = finestStroke(name, distance, length),
        coarsest = Math.min(finest + STROKE_LAYERS, STROKE_SIZES.length);
      let expected = 0;
      for (let size = finest; size < coarsest; size++) expected += STROKE_DENSITY[size];
      expected *= area * thin;
      let strokes = Math.floor(expected + random());
      if (!strokes) continue;
      localNormal.crossVectors(edge1.subVectors(b, a), edge2.subVectors(c, a)).normalize();
      strokeAlong(normal, longAxis, upright, along);
      const perpendicular = edge1.crossVectors(normal, along);
      while (strokes-- > 0 && made < limit) {
        if (made === capacity) grow();
        // Which size: in proportion to how many of each a surface holds.
        let pick = random() * (expected / (area * thin)),
          size = finest;
        while (size < coarsest - 1 && pick > STROKE_DENSITY[size]) pick -= STROKE_DENSITY[size++];
        let u = random(),
          v = random();
        if (u + v > 1) {
          u = 1 - u;
          v = 1 - v;
        }
        const w = 1 - u - v;
        point.set(a.x * w + b.x * u + c.x * v, a.y * w + b.y * u + c.y * v, a.z * w + b.z * u + c.z * v);
        places[made * 3] = point.x;
        places[made * 3 + 1] = point.y;
        places[made * 3 + 2] = point.z;
        normals[made * 4] = Math.round(localNormal.x * 127);
        normals[made * 4 + 1] = Math.round(localNormal.y * 127);
        normals[made * 4 + 2] = Math.round(localNormal.z * 127);
        normals[made * 4 + 3] = size;
        // A hand never repeats an angle: each stroke turns a little off the grain.
        const turn = (random() - 0.5) * 0.3,
          tx = along.x * Math.cos(turn) + perpendicular.x * Math.sin(turn),
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
  const starts = new Array(STROKE_SIZES.length + 1).fill(0);
  for (let i = 0; i < made; i++) starts[STROKE_SIZES.length - 1 - normals[i * 4 + 3]]++;
  for (let size = 0, sum = 0; size <= STROKE_SIZES.length; size++) {
    const held = starts[size];
    starts[size] = sum;
    sum += held;
  }
  const order = new Uint32Array(made);
  for (let i = 0; i < made; i++) order[starts[STROKE_SIZES.length - 1 - normals[i * 4 + 3]]++] = i;
  const sorted = (old, Type, width) => {
    const next = new Type(made * width);
    for (let i = 0; i < made; i++) for (let k = 0; k < width; k++) next[i * width + k] = old[order[i] * width + k];
    return next;
  };
  return {
    count: made,
    places: sorted(places, Float32Array, 3),
    normals: sorted(normals, Int8Array, 4),
    alongs: sorted(alongs, Int8Array, 4),
    owns: sorted(owns, Uint8Array, 4),
    ids: sorted(ids, Uint16Array, 1),
  };
}

const vertexShader = /* glsl */ `
uniform sampler2D tStructure;
uniform sampler2D tAlbedo;
uniform sampler2D tDiffuse;
uniform vec2 paintResolution;
uniform vec4 paintScale;   // pixels a metre spans at one metre away (or anywhere, without perspective), 1 with perspective, the fewest and the most pixels a stroke may be long
uniform float paintSizes[${STROKE_SIZES.length}];
uniform vec4 paintStroke;  // width over length, opacity, how far a stroke may spill over what lies behind, how much its thickness catches the light
attribute vec3 dabPlace;
attribute vec4 dabNormal;  // xyz the surface's normal, w its size
attribute vec4 dabAlong;   // xyz the direction of the stroke, w a number of its own
attribute vec4 dabOwn;     // rgb the surface's own colour (square root of linear), a another number of its own
attribute float dabId;
varying vec3 vOwn;         // the surface's own colour, linear
varying vec3 vBrush;       // xy across the mark, z which of the eight
varying vec3 vWhere;       // how far away the stroke is, whose it is, and its length in metres
varying vec4 vSpot;        // at the stroke's own point: the light that reached the eye, and the byte that says what it is
varying vec2 vHand;        // the stroke's two numbers of its own
void main() {
  vec4 view = modelViewMatrix * vec4(dabPlace, 1.0);
  vec4 clip = projectionMatrix * view;
  float depth = -view.z;
  vec2 ndc = clip.xy / max(clip.w, 1e-5);
  vec2 uv = ndc * 0.5 + 0.5;
  float size = paintSizes[int(floor(dabNormal.w * 127.0 + 0.5))];
  float px = size * paintScale.x / (paintScale.y > 0.5 ? max(depth, 0.05) : 1.0);
  // A stroke is drawn when its own point is what the picture shows there.
  vec4 there = texture2D(tStructure, uv);
  bool seen = clip.w > 0.0 && abs(ndc.x) < 1.02 && abs(ndc.y) < 1.02 && px > paintScale.z
    && abs(there.z - dabId) < 0.5 && abs(there.w - depth) < 0.06 + 0.03 * depth;
  if (!seen) {
    gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
    return;
  }
  px = min(px, paintScale.w);
  vOwn = dabOwn.rgb * dabOwn.rgb;
  vSpot = vec4(dot(texture2D(tDiffuse, uv).rgb, vec3(0.2126, 0.7152, 0.0722)), texture2D(tAlbedo, uv).a, 0.0, 0.0);
  vHand = vec2(dabAlong.w * 0.5 + 0.5, dabOwn.a);
  // The mark lies along its direction as the picture sees it; seen end on, it is shorter.
  vec2 axis = (mat3(modelViewMatrix) * dabAlong.xyz).xy;
  float shown = length(axis);
  axis = shown > 0.08 ? axis / shown : vec2(1.0, 0.0);
  float reach = px * mix(0.55, 1.0, clamp(shown, 0.0, 1.0));
  vec2 offset = (axis * position.x * reach + vec2(-axis.y, axis.x) * position.y * reach * paintStroke.x) * 2.0 / paintResolution;
  gl_Position = vec4(ndc + offset, 0.0, 1.0);
  vBrush = vec3(position.xy, floor(fract(sin(dabId * 12.9898 + vHand.x * 78.233) * 43758.5453) * 8.0));
  vWhere = vec3(depth, dabId, size);
}`;

// A stroke has one colour of its own (the surface's, where it was laid), one place on the ramp of
// light (so a soft fall of light is laid in strokes that differ) and one variation of the hand. The
// light itself is read at every pixel, so a cast shadow keeps its edge across a stroke: it is
// glazed over the paint, as a painter goes back over a shadow's edge.
const fragmentShader = (glsl) => /* glsl */ `
uniform sampler2D tStructure;
uniform sampler2D tAlbedo;
uniform sampler2D tDiffuse;
uniform sampler2D paintBrush;
uniform float toneMappingExposure;
uniform vec2 paintResolution;
uniform vec4 paintStroke;
uniform vec3 paintVary;    // how far one stroke's lightness and chroma stray from the mix, and how far it wanders along its ramp of light (stops)
varying vec3 vOwn;
varying vec3 vBrush;
varying vec3 vWhere;
varying vec4 vSpot;
varying vec2 vHand;
${glsl}
void main() {
  vec2 cell = vec2(mod(vBrush.z, ${BRUSH_SHEET.columns}.0), floor(vBrush.z / ${BRUSH_SHEET.columns}.0));
  vec4 mark = texture2D(paintBrush, (cell + vBrush.xy + 0.5) / vec2(${BRUSH_SHEET.columns}.0, ${BRUSH_SHEET.rows}.0));
  // A loaded brush leaves an edge: the paint is there or it is not.
  float paint = smoothstep(0.3, 0.52, mark.r);
  if (paint < 0.03) discard;
  // On another thing's pixel: never over what stands in front, and only a little over what lies
  // behind. On its own thing a stroke still stops at a part that stands well in front of it.
  vec2 uv = gl_FragCoord.xy / paintResolution;
  vec4 there = texture2D(tStructure, uv);
  bool own = abs(there.z - vWhere.y) < 0.5;
  if (own ? there.w < vWhere.x - max(0.08, 0.35 * vWhere.z) : (there.w < vWhere.x - 0.04 || max(abs(vBrush.x), abs(vBrush.y)) > paintStroke.z)) discard;
  // The light at this pixel on its own thing; where it spills, the light at the stroke's own point.
  float seen = own ? luma(texture2D(tDiffuse, uv).rgb) : vSpot.x;
  vec3 spot = kindSkyKey(own ? texture2D(tAlbedo, uv).a : vSpot.y);
  float stops;
  vec3 fill = spotFill(vOwn, seen, spot.x, step(0.5, spot.z), spot.y, vec2(0.0), (vHand.x - 0.5) * 2.0 * paintVary.z, stops);
  fill.x *= 1.0 + (vHand.y - 0.5) * 2.0 * paintVary.x;
  fill.yz *= 1.0 + (fract(vHand.y * 7.31) - 0.5) * 2.0 * paintVary.y;
  gl_FragColor = vec4(unlab(fill) * (1.0 + (mark.g - 0.5) * paintStroke.w), paint * paintStroke.y);
}`;

// `glsl` and `uniforms` are the look's colour source and its uniform objects (shared, so the hour
// and the dials reach the strokes with no copying); `tools` its tests for what a material is.
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
    paintBrush: { value: sheet },
  };
  const material = new THREE.ShaderMaterial({
    name: "Brush strokes",
    uniforms,
    vertexShader,
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
  const painted = [],
    focus = new THREE.Vector3();
  let queue = null,
    strokes = 0,
    world = null,
    draws = 0,
    scatterMs = 0;

  // Everything still that can be painted, nearest the view's centre first.
  function begin(root, centre) {
    world = root;
    focus.copy(centre);
    queue = [];
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
        found = scatterStrokes(object, { focus, tools, limit: Math.min(STROKE_LIMITS.mesh, STROKE_LIMITS.scene - strokes) });
      if (!found) continue;
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
      scene.add(mesh);
      painted.push({ mesh, source: object });
      strokes += found.count;
    }
    if (queue && (!queue.length || strokes >= STROKE_LIMITS.scene)) queue = [];
    scatterMs += performance.now() - from;
  }
  const shown = (object) => {
    for (let o = object; o; o = o.parent) if (!o.visible) return false;
    return true;
  };

  return {
    scene,
    material,
    // Draws the strokes over what the target already holds (the coat). `extent` is the view's full
    // height at one metre (or its height in metres without perspective).
    // A view that holds still (reduced motion, or paused) is painted in one go, since no later
    // frame is promised; a moving one fills in over its first frames.
    render(renderer, root, camera, { width, height, extent, centre, dials, still = false }) {
      if (world !== root) begin(root, centre || camera.position);
      if (queue.length) scatter(still ? Infinity : dials.strokeScatter);
      const perspective = camera.isPerspectiveCamera;
      uniforms.paintResolution.value.set(width, height);
      uniforms.paintScale.value.set(height / Math.max(extent, 1e-6), perspective ? 1 : 0, dials.strokePixels[0], dials.strokePixels[1]);
      uniforms.paintStroke.value.set(STROKE_ASPECT, dials.strokeOpacity, dials.strokeSpill, dials.strokeImpasto);
      uniforms.paintVary.value.set(dials.strokeVary[0], dials.strokeVary[1], dials.strokeVary[2]);
      // A stroke goes where its thing goes, and is put away with it.
      for (const { mesh, source } of painted) {
        mesh.visible = shown(source);
        if (mesh.visible) mesh.matrixWorld.copy(source.matrixWorld);
      }
      const clear = renderer.autoClear,
        before = renderer.info.render.calls;
      renderer.autoClear = false;
      renderer.render(scene, camera);
      renderer.autoClear = clear;
      draws = renderer.info.render.calls - before;
    },
    evidence() {
      return { strokes, meshes: painted.length, waiting: queue ? queue.length : null, draws, scatterMs: Math.round(scatterMs) };
    },
    dispose() {
      for (const { mesh } of painted) mesh.geometry.dispose();
      painted.length = 0;
      scene.clear();
      material.dispose();
      sheet.dispose();
    },
  };
}
