import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "../assets/js/three.module.min.js";
import { finishPhysicalMaterial } from "../assets/js/home-scene/realism.mjs";

function compile(material) {
  const shader = {
    uniforms: {},
    vertexShader: "#include <project_vertex>",
    fragmentShader: "#include <color_fragment>\n#include <roughnessmap_fragment>\n#include <normal_fragment_maps>",
  };
  material.onBeforeCompile(shader);
  return shader.fragmentShader;
}

test("limewash and washed plaster receive the actual plaster finish", () => {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial());
  for (const name of ["arrival mineral limewash", "arrival pale lime plaster", "washed lime plaster"]) {
    const source = new THREE.MeshStandardMaterial({ name });
    const material = finishPhysicalMaterial(source, mesh);
    assert.equal(material.roughness, 0.62, name);
    assert.match(compile(material), /plasterTrowel/, name);
    assert.doesNotMatch(compile(material), /float growth =/, name);
    material.dispose();
    source.dispose();
  }
  mesh.geometry.dispose();
  mesh.material.dispose();
});

test("the current washi diffusers retain their authored finish rather than acquiring wood grain", () => {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial());
  for (const name of ["private living washi diffuser", "washi lantern paper"]) {
    const source = new THREE.MeshStandardMaterial({ name, roughness: 0.83 });
    const material = finishPhysicalMaterial(source, mesh);
    assert.equal(material.roughness, source.roughness, name);
    assert.doesNotMatch(compile(material), /float growth =/, name);
    material.dispose();
    source.dispose();
  }
  const source = new THREE.MeshStandardMaterial({ name: "honey ash" });
  const material = finishPhysicalMaterial(source, mesh);
  assert.equal(material.roughness, 0.48);
  assert.match(compile(material), /float growth =/);
  material.dispose();
  source.dispose();
  mesh.geometry.dispose();
  mesh.material.dispose();
});
