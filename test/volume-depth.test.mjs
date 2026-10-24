import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "../assets/js/three.module.min.js";
import { createVolumeDepth } from "../assets/js/home-scene/volume-depth.mjs";

test("volume warmup includes the pool's displaced custom depth program before its first visible visit", () => {
  const scene = new THREE.Scene();
  const wall = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial());
  const pool = new THREE.Mesh(new THREE.PlaneGeometry(), new THREE.MeshPhysicalMaterial({ transmission: 1 }));
  pool.visible = false;
  pool.customDepthMaterial = new THREE.MeshDepthMaterial();
  const omitted = new THREE.Mesh(new THREE.PlaneGeometry(), new THREE.MeshBasicMaterial());
  omitted.userData.noVolumeDepth = true;
  omitted.customDepthMaterial = new THREE.MeshDepthMaterial();
  scene.add(wall, pool, omitted);
  const depth = createVolumeDepth({}, scene);
  const warmup = depth.programWarmup;
  assert.equal(warmup.length, 2);
  assert.equal(warmup[0].accept(wall), true);
  assert.equal(warmup[0].accept(pool), false);
  assert.equal(warmup[1].material, pool.customDepthMaterial);
  assert.equal(warmup[1].accept(pool), true, "hidden pool depth is still precompiled");
  assert.equal(warmup[1].accept(omitted), false);
  depth.dispose();
  for (const object of [wall, pool, omitted]) {
    object.geometry.dispose();
    object.material.dispose();
    object.customDepthMaterial?.dispose();
  }
});
