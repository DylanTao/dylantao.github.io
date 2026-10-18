import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "../assets/js/three.module.min.js";
import { createShadowCache } from "../assets/js/home-scene/shadow-cache.mjs";

// A renderer double: the shadow pass records which meshes cast in each call and whether it cleared.
function fixture() {
  const calls = [];
  const gl = {
    READ_FRAMEBUFFER: 1,
    DRAW_FRAMEBUFFER: 2,
    COLOR_BUFFER_BIT: 4,
    DEPTH_BUFFER_BIT: 8,
    NEAREST: 16,
    NO_ERROR: 0,
    blits: 0,
    blitFramebuffer() {
      this.blits++;
    },
    getError: () => 0,
  };
  const scene = new THREE.Scene();
  const light = new THREE.DirectionalLight();
  light.castShadow = true;
  light.shadow.map = new THREE.WebGLRenderTarget(4, 4);
  scene.add(light, light.target);
  const renderer = {
    getContext: () => gl,
    properties: { get: () => ({}) },
    state: { bindFramebuffer() {} },
    target: null,
    getRenderTarget() {
      return this.target;
    },
    setRenderTarget(target) {
      this.target = target;
    },
    getActiveCubeFace: () => 0,
    getActiveMipmapLevel: () => 0,
    clears: 0,
    clear() {
      this.clears++;
    },
  };
  renderer.shadowMap = {
    enabled: true,
    autoUpdate: true,
    needsUpdate: false,
    type: THREE.PCFSoftShadowMap,
    render(lights, root) {
      const casters = [];
      root.traverse((o) => {
        if (o.isMesh && o.castShadow) casters.push(o.name);
      });
      const before = renderer.clears;
      renderer.clear();
      calls.push({ map: light.shadow.map, casters, cleared: renderer.clears > before });
      this.needsUpdate = false;
    },
  };
  const mesh = (name) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial());
    m.name = name;
    m.castShadow = true;
    scene.add(m);
    return m;
  };
  const camera = new THREE.PerspectiveCamera();
  const frame = () => {
    scene.updateMatrixWorld(true);
    calls.length = 0;
    renderer.shadowMap.render([light], scene, camera);
    return [...calls];
  };
  return { scene, light, renderer, gl, mesh, frame };
}

test("casters draw the old way until they have held still, then the static ones are cached once", () => {
  const { light, mesh, frame, renderer, gl } = fixture();
  const cache = createShadowCache(renderer, light, { stillFrames: 3 });
  mesh("wall");
  mesh("floor");
  const actor = mesh("actor");
  for (let i = 0; i < 2; i++) {
    const calls = frame();
    assert.equal(calls.length, 1, "a full redraw while nothing is known to be still");
    assert.deepEqual(calls[0].casters.sort(), ["actor", "floor", "wall"]);
    actor.position.x += 1;
  }
  // Third still frame: the wall and floor are cached (one redraw of them alone into the cache), the
  // cache is copied into the light's map and only the actor is drawn over it, without a clear.
  const calls = frame();
  assert.equal(calls.length, 2);
  assert.notEqual(calls[0].map, light.shadow.map, "the static redraw goes into the cache");
  assert.deepEqual(calls[0].casters.sort(), ["floor", "wall"]);
  assert.equal(calls[1].map, light.shadow.map);
  assert.deepEqual(calls[1].casters, ["actor"]);
  assert.equal(calls[1].cleared, false, "the moving casters draw over the copied cache");
  assert.equal(gl.blits, 1);
  actor.position.x += 1;
  const steady = frame();
  assert.equal(steady.length, 1, "afterwards only the moving caster is drawn");
  assert.deepEqual(steady[0].casters, ["actor"]);
  assert.equal(gl.blits, 2);
  assert.equal(cache.evidence().rebuilds, 1);
  // Every caster casts again outside the shadow pass.
  assert.ok(["wall", "floor", "actor"].every((name) => light.parent.getObjectByName(name).castShadow));
});

test("a caster that moves, hides or appears, and a light that moves, redraw the cache", () => {
  const { light, mesh, frame, renderer } = fixture();
  const cache = createShadowCache(renderer, light, { stillFrames: 2 });
  const wall = mesh("wall");
  const door = mesh("door");
  for (let i = 0; i < 3; i++) frame();
  assert.equal(cache.evidence().rebuilds, 1);
  assert.equal(cache.evidence().staticCasters, 2);
  // The door slides: it leaves the cached set at once (one redraw), drawing every frame while it moves.
  door.position.x += 0.5;
  let calls = frame();
  assert.equal(cache.evidence().rebuilds, 2);
  assert.deepEqual(calls[0].casters, ["wall"]);
  assert.deepEqual(calls.at(-1).casters, ["door"]);
  // Held still again it rejoins the cache, but only after twice as many frames as before.
  frame();
  frame();
  frame();
  assert.equal(cache.evidence().staticCasters, 1, "two still frames are no longer enough for a caster that moved");
  frame();
  assert.equal(cache.evidence().staticCasters, 2);
  const rebuilds = cache.evidence().rebuilds;
  wall.visible = false;
  frame();
  assert.equal(cache.evidence().rebuilds, rebuilds + 1, "a hidden caster leaves the cache");
  light.position.set(3, 9, 2);
  frame();
  assert.equal(cache.evidence().rebuilds, rebuilds + 2, "the light moved");
  // Nothing moving: the light's map already holds the cache and is not copied again.
  const copies = cache.evidence().copies;
  frame();
  assert.equal(cache.evidence().copies, copies);
  assert.ok(cache.evidence().skippedCopies >= 1);
});

test("skinned meshes and casters with their own depth material always draw every frame", () => {
  const { light, mesh, frame, renderer } = fixture();
  const cache = createShadowCache(renderer, light, { stillFrames: 1 });
  mesh("rock");
  const leaves = mesh("leaves");
  leaves.customDepthMaterial = new THREE.MeshDepthMaterial();
  for (let i = 0; i < 3; i++) frame();
  const calls = frame();
  assert.deepEqual(calls.at(-1).casters, ["leaves"]);
  assert.equal(cache.evidence().staticCasters, 1);
});

test("the lab's frozen shadow, a disabled cache and passes without shadow updates keep three's own path", () => {
  const { light, mesh, frame, renderer } = fixture();
  const cache = createShadowCache(renderer, light, { stillFrames: 1, enabled: false });
  mesh("rock");
  for (let i = 0; i < 3; i++) assert.equal(frame()[0].casters.length, 1);
  assert.equal(cache.evidence().cachedFrames, 0);
  cache.enabled = true;
  frame();
  frame();
  light.shadow.autoUpdate = false;
  assert.equal(frame().length, 1, "frozen shadows go straight to three");
  renderer.shadowMap.autoUpdate = false;
  assert.equal(frame().length, 1, "a pass with updates off (the contact pass, the mirror) goes straight to three");
  cache.dispose();
  renderer.shadowMap.autoUpdate = true;
  light.shadow.autoUpdate = true;
  assert.equal(frame().length, 1);
});
