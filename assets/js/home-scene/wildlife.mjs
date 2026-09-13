import * as THREE from "../three.module.min.js";
import { beachPoint } from "./shore.mjs";

export function createWildlife(parent, beach) {
  const root = new THREE.Group();
  root.name = "Coastal neighbours";
  parent.add(root);
  const sphere = new THREE.SphereGeometry(1, 12, 8),
    wingGeo = new THREE.SphereGeometry(1, 12, 6);
  const materials = {
    cream: new THREE.MeshStandardMaterial({ color: 0xe6e6d5, roughness: 0.95 }),
    gray: new THREE.MeshStandardMaterial({ color: 0x877f71, roughness: 1 }),
    ink: new THREE.MeshStandardMaterial({ color: 0x252d2c, roughness: 0.9 }),
    pink: new THREE.MeshStandardMaterial({ color: 0xc8a4a0, roughness: 1 }),
    beak: new THREE.MeshStandardMaterial({ color: 0xd9a65b, roughness: 0.8 }),
    brown: new THREE.MeshStandardMaterial({ color: 0x796655, roughness: 1 }),
  };
  const ellipsoid = (parent, material, position, scale, geometry = sphere) => {
    const m = new THREE.Mesh(geometry, materials[material]);
    m.position.set(...position);
    m.scale.set(...scale);
    m.castShadow = m.receiveShadow = true;
    parent.add(m);
    return m;
  };
  function rabbit(x, seed) {
    const group = new THREE.Group();
    group.name = "Brush rabbit";
    root.add(group);
    ellipsoid(group, "gray", [0, 0.23, 0], [0.23, 0.25, 0.35]);
    ellipsoid(group, "gray", [0, 0.41, 0.22], [0.2, 0.2, 0.19]);
    ellipsoid(group, "cream", [0, 0.4, 0.365], [0.095, 0.07, 0.052]);
    const ears = [];
    for (const side of [-1, 1]) {
      const ear = new THREE.Group();
      ear.position.set(side * 0.105, 0.55, 0.17);
      group.add(ear);
      ellipsoid(ear, "gray", [0, 0.15, 0], [0.058, 0.22, 0.065]);
      ellipsoid(ear, "pink", [0, 0.16, 0.052], [0.025, 0.14, 0.012]);
      ears.push(ear);
      ellipsoid(group, "ink", [side * 0.145, 0.45, 0.335], [0.028, 0.031, 0.025]);
      ellipsoid(group, "gray", [side * 0.16, 0.065, 0.17], [0.11, 0.068, 0.2]);
    }
    ellipsoid(group, "cream", [0, 0.21, -0.34], [0.1, 0.105, 0.1]);
    ellipsoid(group, "pink", [0, 0.43, 0.413], [0.025, 0.018, 0.018]);
    return { group, ears, x, seed };
  }
  const rabbits = [rabbit(-3.2, 1), rabbit(12.3, 2)];
  const raccoon = new THREE.Group();
  raccoon.name = "Curious raccoon";
  root.add(raccoon);
  ellipsoid(raccoon, "gray", [0, 0.26, 0], [0.26, 0.27, 0.41]);
  ellipsoid(raccoon, "gray", [0, 0.47, 0.29], [0.23, 0.22, 0.22]);
  for (const side of [-1, 1]) {
    ellipsoid(raccoon, "cream", [side * 0.1, 0.49, 0.47], [0.12, 0.105, 0.035]);
    ellipsoid(raccoon, "ink", [side * 0.1, 0.49, 0.493], [0.107, 0.059, 0.025]);
    ellipsoid(raccoon, "ink", [side * 0.12, 0.64, 0.24], [0.086, 0.098, 0.052]);
    ellipsoid(raccoon, "cream", [side * 0.115, 0.5, 0.518], [0.022, 0.022, 0.012]);
    for (const z of [-0.23, 0.24]) ellipsoid(raccoon, "ink", [side * 0.18, 0.065, z], [0.071, 0.075, 0.11]);
  }
  ellipsoid(raccoon, "cream", [0, 0.38, 0.49], [0.12, 0.085, 0.12]);
  ellipsoid(raccoon, "ink", [0, 0.41, 0.58], [0.045, 0.029, 0.03]);
  const tail = new THREE.Group();
  tail.position.set(0, 0.28, -0.35);
  tail.rotation.x = -0.4;
  raccoon.add(tail);
  for (let i = 0; i < 7; i++) ellipsoid(tail, i % 2 ? "gray" : "ink", [0, -0.035 * i, -0.08 * i], [0.095 - i * 0.004, 0.085, 0.07]);
  function bird(name, material, scale) {
    const g = new THREE.Group();
    g.name = name;
    root.add(g);
    g.scale.setScalar(scale);
    ellipsoid(g, material, [0, 0.14, 0], [0.1, 0.125, 0.25]);
    ellipsoid(g, material, [0, 0.27, 0.2], [0.102, 0.103, 0.112]);
    ellipsoid(g, "beak", [0, 0.26, 0.34], [0.036, 0.03, 0.1]);
    for (const side of [-1, 1]) ellipsoid(g, "ink", [side * 0.086, 0.287, 0.246], [0.019, 0.019, 0.016]);
    const wings = [-1, 1].map((side) => {
      const pivot = new THREE.Group();
      pivot.position.set(side * 0.067, 0.19, 0);
      g.add(pivot);
      ellipsoid(pivot, material, [side * 0.24, 0, -0.04], [0.31, 0.027, 0.14], wingGeo);
      ellipsoid(pivot, "ink", [side * 0.48, -0.006, -0.073], [0.105, 0.022, 0.098], wingGeo);
      return pivot;
    });
    const feet = [-1, 1].map((side) => ellipsoid(g, "beak", [side * 0.055, 0.05, 0.05], [0.021, 0.06, 0.045]));
    return { group: g, wings, feet };
  }
  const gulls = Array.from({ length: 4 }, () => bird("Pacific gull", "cream", 1.55));
  const perch = bird("Balcony visitor", "cream", 1.1);
  const shorebirds = Array.from({ length: 3 }, () => bird("Sandpiper", "brown", 1.35));
  const scratch = new THREE.Vector3();
  function update(t, palette = "afternoon") {
    for (const r of rabbits) {
      const travel = Math.max(0, Math.sin(t * 0.18 + r.seed)),
        hop = palette === "evening" ? 0 : Math.max(0, Math.sin(t * 4.2 + r.seed)) * travel * 0.17;
      const x = r.x + Math.sin(t * 0.18 + r.seed) * 0.75,
        p = beachPoint(x, 0.29, beach);
      r.group.position.set(p[0], p[1] + hop, p[2]);
      r.group.rotation.y = Math.sin(t * 0.18 + r.seed) > 0.3 ? Math.PI * 0.6 : -Math.PI * 0.6;
      r.ears.forEach((e, i) => (e.rotation.z = (i ? 1 : -1) * (0.12 + Math.sin(t * 0.7 + r.seed) * 0.08)));
    }
    const rp = beachPoint(4.5 + Math.sin(t * 0.11) * 1.1, 0.27, beach);
    raccoon.position.set(...rp);
    raccoon.position.y += Math.abs(Math.sin(t * 2)) * 0.012;
    raccoon.rotation.y = Math.cos(t * 0.11) > 0 ? Math.PI * 0.5 : -Math.PI * 0.5;
    tail.rotation.y = Math.sin(t * 0.6) * 0.1;
    gulls.forEach((b, i) => {
      const a = t * (0.06 + i * 0.008) + i * 1.5;
      b.group.position.set(Math.cos(a) * (7 + i * 1.8), 3.9 + i * 0.85 + Math.sin(a * 2) * 0.3, -11 - Math.sin(a) * (3 + i));
      scratch.set(-Math.sin(a) * (7 + i * 1.8), 0, -Math.cos(a) * (3 + i));
      b.group.rotation.y = Math.atan2(scratch.x, scratch.z);
      b.wings.forEach((w, j) => (w.rotation.z = (j ? 1 : -1) * (0.12 + Math.sin(t * (2.3 + i * 0.2) + i) * 0.32)));
      b.feet.forEach((f) => (f.visible = false));
    });
    perch.group.position.set(3.95, 3.65, 1.43);
    perch.group.rotation.y = 0.4 + Math.sin(t * 0.25) * 0.35;
    perch.wings.forEach((w, j) => w.rotation.set(0, (j ? 1 : -1) * 1.28, (j ? -1 : 1) * 0.2));
    shorebirds.forEach((b, i) => {
      const x = -6 + i * 4.1 + Math.sin(t * 0.23 + i) * 1.3,
        p = beachPoint(x, 0.38, beach);
      b.group.position.set(...p);
      b.group.position.y += Math.abs(Math.sin(t * 6 + i)) * 0.026;
      b.group.rotation.y = Math.cos(t * 0.23 + i) > 0 ? Math.PI * 0.5 : -Math.PI * 0.5;
      b.wings.forEach((w, j) => w.rotation.set(0, (j ? 1 : -1) * 1.28, (j ? -1 : 1) * 0.2));
    });
  }
  update(0);
  return {
    update,
    evidence: () => ({ rabbits: rabbits.length, raccoons: 1, gulls: gulls.length + 1, shorebirds: shorebirds.length }),
    dispose() {
      sphere.dispose();
      wingGeo.dispose();
      Object.values(materials).forEach((m) => m.dispose());
      root.removeFromParent();
    },
  };
}
