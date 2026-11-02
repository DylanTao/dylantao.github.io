import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "../assets/js/three.module.min.js";
import { createArrivalRill } from "../assets/js/home-scene/arrival-rill.mjs";

function fixture() {
  const root = new THREE.Group();
  for (const name of ["arrival flowing spring water", "arrival spring rill spill"]) {
    const m = new THREE.MeshPhysicalMaterial({ name });
    root.add(new THREE.Mesh(new THREE.PlaneGeometry(1, 1), m));
  }
  return root;
}
const descriptor = () => ({ origin: [0, 17.3], direction: [0.8, 0.6], speed: 0.16, depth: 0.01 });

test("arrival water retains native geometry and the shared clock while chaining its real shader", () => {
  const root = fixture(),
    time = { value: 0 };
  let chained = 0;
  root.children[0].material.onBeforeCompile = (shader) => {
    chained++;
    shader.uniforms.existing = { value: 3 };
  };
  const positions = root.children.map((m) => [...m.geometry.attributes.position.array]);
  const water = createArrivalRill(root, descriptor(), time);
  assert.equal(water.evidence().meshes.length, 2);
  for (const mesh of root.children) {
    const shader = { uniforms: {}, vertexShader: "#include <begin_vertex>", fragmentShader: "#include <normal_fragment_maps>" };
    mesh.material.onBeforeCompile(shader);
    assert.equal(shader.uniforms.rillTime, time);
    assert.match(shader.fragmentShader, /rillPhase/);
    assert.match(shader.vertexShader, /vRillWorld/);
    assert.equal(mesh.userData.walk, "through");
    assert.equal(mesh.userData.fixedMaterial, true);
    assert.equal(mesh.material.ior, 1.333);
  }
  assert.equal(chained, 1);
  assert.deepEqual(
    root.children.map((m) => [...m.geometry.attributes.position.array]),
    positions
  );
  time.value = 7;
  assert.equal(water.evidence().time, 7);
  water.dispose();
  for (const mesh of root.children) {
    mesh.geometry.dispose();
    mesh.material.dispose();
  }
});

test("arrival water rejects missing surfaces, nonphysical finishes and invalid surveyed flow", () => {
  const time = { value: 0 };
  assert.equal(createArrivalRill(new THREE.Group(), null, time), null);
  assert.throws(() => createArrivalRill(new THREE.Group(), descriptor(), time));
  for (const edit of [(d) => (d.direction = [0, 0]), (d) => (d.origin = [Infinity, 0]), (d) => (d.speed = 0)]) {
    const root = fixture(),
      d = descriptor();
    edit(d);
    assert.throws(() => createArrivalRill(root, d, time), TypeError);
    for (const mesh of root.children) {
      mesh.geometry.dispose();
      mesh.material.dispose();
    }
  }
  const root = fixture();
  root.children[0].material.dispose();
  root.children[0].material = new THREE.MeshStandardMaterial({ name: "arrival flowing spring water" });
  assert.throws(() => createArrivalRill(root, descriptor(), time), TypeError);
  for (const mesh of root.children) {
    mesh.geometry.dispose();
    mesh.material.dispose();
  }
});
