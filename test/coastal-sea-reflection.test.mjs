import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "../assets/js/three.module.min.js";
import { createSeaReflection } from "../assets/js/home-scene/reflection.mjs";

function fixture() {
  const scene = new THREE.Scene(),
    camera = new THREE.PerspectiveCamera(50, 1.5, 0.1, 300),
    ocean = new THREE.Mesh(),
    opaque = new THREE.Mesh();
  ocean.name = "ocean";
  opaque.name = "land";
  scene.add(ocean, opaque);
  camera.position.set(0, 3, 18);
  camera.lookAt(0, 0, 0);
  camera.updateMatrixWorld();
  let target = { name: "beauty" };
  const frames = [],
    renderer = {
      shadowMap: { autoUpdate: true },
      toneMapping: THREE.ACESFilmicToneMapping,
      getRenderTarget: () => target,
      setRenderTarget(value) {
        target = value;
      },
      clear() {},
      render() {
        const visible = [];
        scene.traverseVisible((o) => {
          if (o.isMesh) visible.push(o.name);
        });
        frames.push(visible);
      },
    };
  const reflection = createSeaReflection(renderer, scene, ocean, new THREE.MeshPhysicalMaterial());
  const glass = (name) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshPhysicalMaterial({ transmission: 0.5 }));
    mesh.name = name;
    scene.add(mesh);
    return mesh;
  };
  return { scene, camera, ocean, renderer, reflection, glass, frames };
}

test("late model invalidation suppresses its transmission on the next mirror draw and preserves main visibility", () => {
  const f = fixture(),
    first = f.glass("first");
  f.reflection.update(f.camera, true);
  assert.deepEqual(f.frames.at(-1), ["land"]);
  const late = f.glass("late");
  f.reflection.update(f.camera, true);
  assert.ok(f.frames.at(-1).includes("late"), "negative control reproduces the old periodic-list gap");
  f.reflection.invalidate();
  f.reflection.update(f.camera, true);
  assert.deepEqual(f.frames.at(-1), ["land"]);
  assert.equal(first.visible, true);
  assert.equal(late.visible, true);
  assert.equal(f.ocean.visible, true);
  assert.equal(first.material.transmission, 0.5);
  assert.equal(late.material.transmission, 0.5);
  f.reflection.dispose();
});

test("disabled/style intervals defer invalidation, and hidden objects and render state survive a failed capture", () => {
  const f = fixture(),
    hidden = f.glass("hidden");
  hidden.visible = false;
  f.reflection.invalidate();
  f.reflection.invalidate();
  f.reflection.update(f.camera, false);
  assert.equal(f.frames.length, 0);
  const late = f.glass("late"),
    original = f.renderer.getRenderTarget(),
    tone = f.renderer.toneMapping;
  f.renderer.render = () => {
    throw new Error("capture failure");
  };
  assert.throws(() => f.reflection.update(f.camera, true), /capture failure/);
  assert.equal(hidden.visible, false);
  assert.equal(late.visible, true);
  assert.equal(f.ocean.visible, true);
  assert.equal(f.renderer.getRenderTarget(), original);
  assert.equal(f.renderer.toneMapping, tone);
  assert.equal(f.renderer.shadowMap.autoUpdate, true);
  f.reflection.dispose();
});
