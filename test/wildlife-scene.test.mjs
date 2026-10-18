import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as THREE from "../assets/js/three.module.min.js";
import { createWildlife } from "../assets/js/home-scene/wildlife.mjs";
import { rabbitActing } from "../assets/js/home-scene/wildlife-motion.mjs";
import { habitatPoint } from "../assets/js/home-scene/shore.mjs";
import { perchContactWeight } from "../assets/js/home-scene/wildlife-perch-contact.mjs";

// The runtime runs headless here: the GLB requests fail and the roots still act, so populations,
// determinism and root placement can be checked on the module the browser loads.
const manifest = JSON.parse(readFileSync(new URL("../assets/models/home/manifest.json", import.meta.url)));

test("the coast hosts 28 animals whose roots are a pure function of active time", () => {
  const wildlife = createWildlife(new THREE.Group(), manifest);
  try {
    const counts = wildlife.evidence();
    assert.deepEqual(
      [
        counts.rabbits,
        counts.seaLions,
        counts.harborSeals,
        counts.raccoons,
        counts.gulls,
        counts.shorebirds,
        counts.pelicans,
        counts.cormorants,
        counts.swimmingSeaLions,
      ],
      [2, 5, 3, 1, 5, 3, 5, 4, 2]
    );
    const roots = (t) => {
      wildlife.update(t, "afternoon");
      const e = wildlife.evidence();
      return [
        ...e.rabbitHabitats,
        ...e.birds,
        ...e.shorebirdContacts,
        ...e.contacts,
        ...e.swimmers,
        ...e.pelicanStates,
        ...e.cormorantStates,
        e.raccoon,
      ].map((item) => item.position);
    };
    const first = roots(123.4);
    roots(5);
    roots(400);
    assert.deepEqual(roots(123.4), first, "the same time gives the same coast however the frames fall");
    for (let t = 0; t < 600; t += 7.7) for (const position of roots(t)) assert.ok(position.every(Number.isFinite));
  } finally {
    wildlife.dispose();
  }
});

test("the west rabbit gives a perched gull a wide berth on the loop they share", () => {
  const wildlife = createWildlife(new THREE.Group(), manifest);
  try {
    const perch = manifest.terrain.perches[0],
      path = manifest.terrain.habitats.rabbitWest.path;
    let conflicts = 0;
    for (let t = 0; t < 2400; t += 0.25) {
      if (Math.max(perchContactWeight(t, 0), perchContactWeight(t, 3)) < 1) continue;
      const raw = habitatPoint(path, rabbitActing(t, 1).progress);
      if (Math.hypot(raw[0] - perch[0], raw[2] - perch[2]) > 0.35) continue;
      wildlife.update(t, "afternoon");
      const [x, , z] = wildlife.evidence().rabbitHabitats[0].position;
      assert.ok(
        Math.hypot(x - perch[0], z - perch[2]) > 0.5,
        `rabbit within ${Math.hypot(x - perch[0], z - perch[2]).toFixed(2)} m of a perched gull at ${t}`
      );
      conflicts++;
    }
    assert.ok(conflicts > 100, "the loop really does pass the perch while gulls hold it");
  } finally {
    wildlife.dispose();
  }
});
