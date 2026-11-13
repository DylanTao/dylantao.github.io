import assert from "node:assert/strict";
import test from "node:test";
import * as THREE from "../assets/js/three.module.min.js";
import { SECTION_DEFAULTS, createSectionCut, hatchLine, sectionGLSL, worldTriangles } from "../assets/js/home-scene/section-cut.mjs";

function slab({ indexed = true, at = [0, 0, 0], quantized = false } = {}) {
  const geometry = new THREE.BoxGeometry(2, 1, 4);
  const mesh = new THREE.Mesh(indexed ? geometry : geometry.toNonIndexed());
  if (quantized) {
    // A compressed export stores normalized integers; the scale lives in the node's transform.
    const source = mesh.geometry.attributes.position,
      packed = new Int16Array(source.count * 3);
    for (let i = 0; i < source.count * 3; i++) packed[i] = Math.round((source.array[i] / 2) * 32767);
    mesh.geometry.setAttribute("position", new THREE.BufferAttribute(packed, 3, true));
    mesh.scale.setScalar(2);
  }
  mesh.position.set(...at);
  return mesh;
}

test("lifted solids become one world-space triangle list, whatever their encoding", () => {
  const plain = slab({ at: [10, 5, -3] }),
    flat = slab({ indexed: false, at: [10, 5, -3] }),
    packed = slab({ quantized: true, at: [10, 5, -3] });
  const a = worldTriangles([plain]),
    b = worldTriangles([flat]),
    c = worldTriangles([packed]);
  assert.equal(a.length, 12 * 9, "a box is twelve triangles");
  assert.deepEqual(Array.from(a), Array.from(b));
  for (let i = 0; i < a.length; i++) assert.ok(Math.abs(a[i] - c[i]) < 2e-4, "normalized integers decode to the same metres");
  const bounds = new THREE.Box3().setFromArray(a);
  assert.deepEqual(bounds.min.toArray(), [9, 4.5, -5]);
  assert.deepEqual(bounds.max.toArray(), [11, 5.5, -1]);
  // A parent's transform counts too: the roofs hang under the shell's root.
  const parent = new THREE.Group();
  parent.position.set(0, 100, 0);
  parent.add(plain);
  assert.equal(new THREE.Box3().setFromArray(worldTriangles([plain])).min.y, 104.5);
  assert.equal(worldTriangles([plain, flat]).length, 2 * 12 * 9);
});

test("the cut is marked only while the roof is lifted, and rebuilt only when the pieces change", () => {
  const section = createSectionCut();
  assert.equal(section.open, false);
  assert.equal(section.render({}, { image: { width: 4, height: 4 } }, {}), null, "nothing is drawn with the roof on");
  const roof = new THREE.Group();
  roof.add(slab(), slab({ at: [3, 0, 0] }));
  const rim = slab({ at: [0, 4, 0] });
  section.sync([roof, rim], false);
  assert.equal(section.open, false);
  assert.deepEqual(
    (({ pieces, triangles, drawCalls }) => ({ pieces, triangles, drawCalls }))(section.evidence()),
    { pieces: 2, triangles: 36, drawCalls: 1 },
    "every mesh under every piece, in one draw"
  );
  section.sync([roof, rim], true);
  assert.equal(section.open, true);
  section.sync([roof, rim], true);
  assert.equal(section.evidence().triangles, 36);
  section.sync([roof], true);
  assert.equal(section.evidence().triangles, 24, "a changed set of pieces rebuilds the solids");
  section.sync([], true);
  assert.equal(section.open, false, "no pieces, no section");

  // One draw of the back faces against the frame's depth, with the caller's state handed back.
  section.sync([roof, rim], true);
  const calls = [];
  let target = "screen",
    autoClear = false;
  const renderer = {
    getRenderTarget: () => target,
    setRenderTarget: (value) => (target = value),
    getClearColor: (colour) => colour.set(0x336699),
    getClearAlpha: () => 0.5,
    setClearColor: (colour, alpha) => calls.push(["clear", typeof colour === "number" ? colour : colour.getHex(), alpha]),
    get autoClear() {
      return autoClear;
    },
    set autoClear(value) {
      autoClear = value;
    },
    render: (scene, camera) => calls.push(["render", scene.children.length, scene.children[0].material.side, camera.near, autoClear, target.width]),
  };
  const depth = { image: { width: 640, height: 360 } },
    camera = { near: 0.05, far: 300, isPerspectiveCamera: true };
  const mask = section.render(renderer, depth, camera);
  assert.ok(mask?.isTexture);
  assert.deepEqual(calls, [
    ["clear", 0, 0],
    ["render", 1, THREE.BackSide, 0.05, true, 640],
    ["clear", 0x336699, 0.5],
  ]);
  assert.equal(target, "screen");
  assert.equal(autoClear, false);
  assert.equal(section.evidence().draws, 1);
  section.dispose();
});

test("with the roof on, the tone's strength is zero and the frame's colour passes through", () => {
  assert.match(sectionGLSL, /float mask = texture2D\(tSection, uv\)\.r \* sectionTone\.a;\s+if \(mask <= 0\.0\) return colour;/);
  assert.match(sectionGLSL, /return mix\(colour, cut, mask\)/);
  assert.ok(
    SECTION_DEFAULTS.tone.every((value) => value > 0 && value < 1),
    "the tone darkens and never inverts"
  );
  assert.ok(SECTION_DEFAULTS.tolerance <= 0.05, "contact means centimetres");
  assert.equal(new Uint8Array(createSectionCut().none.image.data)[0], 0);
});

test("the hatch is fixed to the rock, crosses level and upright faces alike, and fades before it can shimmer", () => {
  const hatch = SECTION_DEFAULTS.hatch,
    [period, share, lighter] = hatch,
    fine = 0.02; // a pixel covering a fiftieth of the spacing
  assert.ok(period > 0.2 && period < 1 && share > 0.02 && share < 0.3 && lighter > 0 && lighter < 1, "lines, not stripes, and lighter, not white");
  // A line lies on every plane x + y + z = a whole number of spacings, whichever axis carries it.
  for (const point of [
    [period, 0, 0],
    [0, 3 * period, 0],
    [0, 0, -2 * period],
    [0.3 * period, 0.5 * period, 0.2 * period],
  ])
    assert.ok(hatchLine(point, hatch, fine) > 0.99, `on a line: ${point}`);
  // Half way between lines there is none, and a line is as wide as its share says.
  assert.equal(hatchLine([0.5 * period, 0, 0], hatch, fine), 0);
  assert.ok(hatchLine([0.4 * share * period, 0, 0], hatch, fine) > 0.9, "inside the line");
  assert.equal(hatchLine([(0.5 * share + fine + 0.01) * period, 0, 0], hatch, fine), 0, "just outside it");
  // Moving along a line changes nothing: (1, -1, 0) and (0, 1, -1) lie in its plane.
  const along = hatchLine([0.03, 0.01, 0.0], hatch, fine);
  assert.ok(Math.abs(hatchLine([0.03 + 7, 0.01 - 7, 0.0], hatch, fine) - along) < 1e-9);
  assert.ok(Math.abs(hatchLine([0.03, 0.01 + 4, 0.0 - 4], hatch, fine) - along) < 1e-9);
  // When lines would be closer than a few pixels they are gone, even at a line's centre.
  assert.equal(hatchLine([period, 0, 0], hatch, 0.4), 0);
  assert.ok(hatchLine([period, 0, 0], hatch, 0.3) < hatchLine([period, 0, 0], hatch, 0.2));
  // The shader states the same rule.
  assert.match(sectionGLSL, /float t = \(world\.x \+ world\.y \+ world\.z\) \/ sectionHatch\.x;/);
  assert.match(sectionGLSL, /abs\(fract\(t - 0\.5\) - 0\.5\)/);
  assert.match(sectionGLSL, /1\.0 - smoothstep\(0\.18, 0\.4, width\)/);
});
