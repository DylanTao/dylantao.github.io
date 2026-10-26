// Delivered-geometry regressions for the October 24 overlap audit's repaired defects.
// The audit itself (bin/audit_coastal_overlaps.py) needs Blender; these checks decode the
// shipped Draco GLBs in Node, so CI proves the repairs reached the compressed delivery.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as THREE from "../assets/js/three.module.min.js";
import { nativeGeometry } from "./helpers/coastal-native-geometry.mjs";

const manifest = JSON.parse(readFileSync(new URL("../assets/models/home/manifest.json", import.meta.url), "utf8"));
const furniture = JSON.parse(readFileSync(new URL("../assets/models/home/furniture/index.json", import.meta.url), "utf8"));

// World-space triangles of every primitive under the named nodes.
function triangles(root, names) {
  const out = [];
  const a = new THREE.Vector3(),
    b = new THREE.Vector3(),
    c = new THREE.Vector3();
  root.traverse((object) => {
    if (!object.isMesh || !names(object.parent?.name || "")) return;
    const position = object.geometry.attributes.position;
    const index = object.geometry.index;
    const count = index ? index.count : position.count;
    for (let i = 0; i < count; i += 3) {
      const ia = index ? index.getX(i) : i,
        ib = index ? index.getX(i + 1) : i + 1,
        ic = index ? index.getX(i + 2) : i + 2;
      a.fromBufferAttribute(position, ia).applyMatrix4(object.matrixWorld);
      b.fromBufferAttribute(position, ib).applyMatrix4(object.matrixWorld);
      c.fromBufferAttribute(position, ic).applyMatrix4(object.matrixWorld);
      out.push([a.clone(), b.clone(), c.clone()]);
    }
  });
  return out;
}

// Upward-facing, horizontal faces (three.js +Y up): plan bounds and height.
function tops(tris) {
  const n = new THREE.Vector3();
  return tris
    .filter(([a, b, c]) => {
      n.subVectors(b, a).cross(new THREE.Vector3().subVectors(c, a));
      const length = n.length();
      return length > 1e-8 && n.y / length > 0.995;
    })
    .map(([a, b, c]) => ({
      y: (a.y + b.y + c.y) / 3,
      x0: Math.min(a.x, b.x, c.x),
      x1: Math.max(a.x, b.x, c.x),
      z0: Math.min(a.z, b.z, c.z),
      z1: Math.max(a.z, b.z, c.z),
    }));
}

const overlaps = (p, q, inset = 0.01) => p.x0 < q.x1 - inset && q.x0 < p.x1 - inset && p.z0 < q.z1 - inset && q.z0 < p.z1 - inset;

test("retreat stone beds sit under their oak boards and tread caps, never flush with them", async () => {
  const root = await nativeGeometry(manifest.shell);
  // The retreat's arrival and house stairs are retired; the arrival hall's flights replace them.
  for (const module of ["core_retreat_library", "core_retreat_clifftop", "core_arrival_hall"]) {
    const stone = tops(triangles(root, (name) => name === `${module}__warm cut stone`));
    const oak = tops(triangles(root, (name) => name === `${module}__pale oak`));
    assert.ok(stone.length && oak.length, `${module}: delivered stone and oak batches`);
    let closest = Infinity;
    for (const s of stone) for (const o of oak) if (overlaps(s, o)) closest = Math.min(closest, Math.abs(o.y - s.y));
    // 22 mm boards and 28 mm caps; Draco position quantisation stays far below 15 mm.
    assert.ok(closest > 0.015, `${module}: an exposed stone top is ${(closest * 1000).toFixed(1)} mm from an oak top above it`);
  }
});

test("no plant stands inside the streamed glass wine fridge", async () => {
  const root = await nativeGeometry(manifest.shell);
  const anchor = manifest.furniture.find((item) => item.id === "kitchen-glass-fridge");
  const bounds = furniture.items[anchor.item].bounds;
  const inverse = new THREE.Matrix4()
    .makeRotationY(anchor.yaw || 0)
    .setPosition(...anchor.position)
    .invert();
  const local = new THREE.Vector3();
  let inside = 0;
  for (const tri of triangles(root, (name) => /^core__(olive leaf|terracotta|charcoal|honey ash)$/.test(name)))
    for (const p of tri) {
      local.copy(p).applyMatrix4(inverse);
      if (
        local.x > bounds.min[0] &&
        local.x < bounds.max[0] &&
        local.y > bounds.min[1] &&
        local.y < bounds.max[1] &&
        local.z > bounds.min[2] &&
        local.z < bounds.max[2]
      )
        inside++;
    }
  assert.equal(inside, 0, "potted olive vertices inside the fridge's delivered bounds");
});

test("the arrival foyer slab stops at the guest bathroom wall instead of running under its tiles", async () => {
  const root = await nativeGeometry(manifest.shell);
  const slab = tops(triangles(root, (name) => name === "core_retreat_arrival__warm cut stone"));
  // Bathroom wing plan in three.js metres (native x -8.46..-4.74, y -14.3..-9.65).
  const bath = { x0: -8.4, x1: -4.8, z0: 9.7, z1: 14.25 };
  const exposed = slab.filter((t) => t.y > -0.01 && overlaps(t, bath, 0));
  assert.equal(exposed.length, 0, `${exposed.length} foyer slab tops lie at floor height inside the bathroom wing`);
});
