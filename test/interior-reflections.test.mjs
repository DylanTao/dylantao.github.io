import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "../assets/js/three.module.min.js";
import { createInteriorReflections, mirrorPlane, reflectInteriorCamera } from "../assets/js/home-scene/interior-reflections.mjs";

const close = (actual, expected, epsilon = 1e-6) => assert.ok(Math.abs(actual - expected) < epsilon, `${actual} vs ${expected}`);

function fixture(compact = false) {
  const scene = new THREE.Scene(),
    world = new THREE.Group(),
    shell = new THREE.Group(),
    other = new THREE.Group(),
    effects = new THREE.Group();
  const ceiling = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial());
  ceiling.userData.caveRoof = true;
  ceiling.visible = false;
  shell.add(ceiling);
  world.add(shell, other);
  const sunlight = new THREE.DirectionalLight();
  scene.add(world, effects, sunlight);
  scene.background = new THREE.Color(0x123456);
  const roots = new Map(),
    materials = [];
  for (const [id, floor] of [
    ["bath-living", 0],
    ["bath-bedroom", 2.6],
  ]) {
    const root = new THREE.Group();
    const material = new THREE.MeshStandardMaterial({ name: "bathroom satin mirror", metalness: 0.98, roughness: 0.055, envMapIntensity: 0.7 });
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.93, 1.46), material);
    mesh.position.set(-8.185, floor + 1.67, 3.65);
    root.add(mesh);
    world.add(root);
    roots.set(id, root);
    materials.push(material);
  }
  scene.updateMatrixWorld(true);
  const draws = [],
    compiles = [];
  let currentTarget = { original: true },
    scissorTest = true;
  const renderer = {
    shadowMap: { autoUpdate: true, needsUpdate: true },
    toneMapping: THREE.ACESFilmicToneMapping,
    autoClear: false,
    xr: { enabled: true },
    getRenderTarget: () => currentTarget,
    setRenderTarget: (next) => {
      currentTarget = next;
    },
    getViewport: (value) => value.set(1, 2, 3, 4),
    getScissor: (value) => value.set(5, 6, 7, 8),
    getScissorTest: () => scissorTest,
    setViewport: () => {},
    setScissor: () => {},
    setScissorTest: (next) => {
      scissorTest = next;
    },
    clear: () => {},
    compileAsync: async () => {
      compiles.push(currentTarget);
    },
    render: (source, camera) => {
      assert.equal(source, scene);
      assert.equal(renderer.shadowMap.autoUpdate, false);
      assert.equal(renderer.shadowMap.needsUpdate, false);
      assert.equal(renderer.toneMapping, THREE.NoToneMapping);
      assert.equal(ceiling.visible, true);
      assert.equal(other.visible, false);
      assert.equal(effects.visible, false);
      assert.equal(sunlight.visible, true);
      assert.equal(scissorTest, false);
      for (const root of roots.values())
        for (const child of root.children)
          if (child.material?.name === "bathroom satin mirror") assert.equal(child.visible, false, "mirrors cannot capture each other recursively");
      draws.push({ target: currentTarget, camera: camera.clone(), visibleRooms: [...roots].filter(([, root]) => root.visible).map(([id]) => id) });
    },
  };
  const originalTarget = currentTarget,
    originalBackground = scene.background;
  let withoutContact = 0;
  let contentVersion = 0;
  const dynamicRoots = [];
  const reflections = createInteriorReflections({
    renderer,
    scene,
    world,
    shell,
    rooms: roots,
    compact,
    getDynamicRoots: () => dynamicRoots,
    getContentVersion: () => contentVersion,
    withoutContact: (draw) => {
      withoutContact++;
      return draw();
    },
  });
  const camera = new THREE.PerspectiveCamera(54, 1.4, 0.05, 100);
  camera.position.set(-5.2, 1.6, 4.6);
  camera.lookAt(-8.179, 1.67, 3.65);
  camera.updateMatrixWorld(true);
  function restored() {
    assert.equal(renderer.getRenderTarget(), originalTarget);
    assert.equal(scene.background, originalBackground);
    assert.equal(renderer.shadowMap.autoUpdate, true);
    assert.equal(renderer.shadowMap.needsUpdate, true);
    assert.equal(renderer.toneMapping, THREE.ACESFilmicToneMapping);
    assert.equal(renderer.autoClear, false);
    assert.equal(renderer.xr.enabled, true);
    assert.equal(ceiling.visible, false);
    assert.equal(other.visible, true);
    assert.equal(effects.visible, true);
    assert.equal(scissorTest, true);
    for (const root of roots.values()) assert.equal(root.visible, true);
  }
  return {
    reflections,
    camera,
    renderer,
    scene,
    world,
    roots,
    ceiling,
    materials,
    draws,
    compiles,
    restored,
    dynamicRoots,
    advanceContent: () => contentVersion++,
    contactCalls: () => withoutContact,
  };
}

test("the actual vertical mirror plane reflects the camera pose and clips geometry on its hidden side", () => {
  const f = fixture();
  const mesh = f.roots.get("bath-living").children[0];
  const plane = mirrorPlane(mesh);
  close(plane.constant, 8.179, 1e-5);
  const view = reflectInteriorCamera(f.camera, plane);
  close(view.camera.position.x, 2 * -plane.constant - f.camera.position.x);
  close(view.camera.position.y, f.camera.position.y);
  close(view.camera.position.z, f.camera.position.z);
  const wanted = f.camera.getWorldDirection(new THREE.Vector3()).reflect(plane.normal);
  close(view.camera.getWorldDirection(new THREE.Vector3()).distanceTo(wanted), 0);
  const visible = new THREE.Vector3(-6.5, 1.6, 3.65).project(view.camera);
  const behind = new THREE.Vector3(-8.7, 1.6, 3.65).project(view.camera);
  assert.ok(visible.z >= -1 && visible.z <= 1, "room geometry survives the oblique plane");
  assert.ok(behind.z < -1, "the cliff behind the reflective face is clipped");
  f.reflections.dispose();
});

test("one bounded linear target follows only the active bathroom and caps ordinary movement at 15 Hz", async () => {
  const f = fixture(true);
  await f.reflections.prepare({ camera: f.camera });
  assert.equal(f.compiles.length, 2);
  assert.equal(new Set(f.compiles).size, 1, "both rooms warm the same render target");
  f.restored();
  assert.equal(f.reflections.update(f.camera, { room: "bath-living", now: 0, lightKey: "night" }), true);
  f.camera.position.z += 0.01;
  f.camera.updateMatrixWorld(true);
  assert.equal(f.reflections.update(f.camera, { room: "bath-living", now: 20, lightKey: "night" }), false);
  assert.equal(f.reflections.update(f.camera, { room: "bath-living", now: 70, lightKey: "night" }), true);
  f.camera.fov += 0.1;
  f.camera.updateProjectionMatrix();
  assert.equal(
    f.reflections.update(f.camera, { room: "bath-living", now: 75, lightKey: "night" }),
    false,
    "ordinary lens animation retains the 15 Hz bound"
  );
  for (const now of [76, 77]) {
    f.camera.position.z += 0.2;
    f.camera.updateMatrixWorld(true);
    assert.equal(
      f.reflections.update(f.camera, { room: "bath-living", now, lightKey: "night" }),
      false,
      "continuous travel is not mistaken for a teleport as distance accumulates"
    );
  }
  f.camera.position.x += 0.5;
  f.camera.updateMatrixWorld(true);
  assert.equal(f.reflections.update(f.camera, { room: "bath-living", now: 80, lightKey: "night" }), true, "camera jumps refresh immediately");
  assert.equal(f.reflections.update(f.camera, { room: "bath-living", now: 90, lightKey: "day" }), true, "lighting changes refresh immediately");
  assert.equal(f.reflections.update(f.camera, { room: "study", now: 100, lightKey: "day" }), false);
  f.camera.position.y += 2.6;
  f.camera.lookAt(-8.179, 4.27, 3.65);
  f.camera.updateMatrixWorld(true);
  assert.equal(f.reflections.update(f.camera, { room: "bath-bedroom", now: 110, lightKey: "day" }), true);
  assert.equal(f.draws.length, 5);
  assert.equal(new Set(f.draws.map((draw) => draw.target)).size, 1);
  for (const draw of f.draws) {
    assert.equal(draw.target.width, 128);
    assert.equal(draw.target.height, 128);
    assert.equal(draw.target.texture.colorSpace, THREE.LinearSRGBColorSpace);
    assert.equal(draw.visibleRooms.length, 1);
  }
  assert.deepEqual(f.draws.at(-1).visibleRooms, ["bath-bedroom"]);
  assert.equal(f.contactCalls(), 5);
  f.restored();
  f.reflections.dispose();
});

test("cropping concentrates the unchanged target on the mirror and preserves projective correspondence", () => {
  const f = fixture();
  const mesh = f.roots.get("bath-living").children[0],
    bounds = new THREE.Box3().setFromObject(mesh),
    plane = mirrorPlane(mesh);
  for (const eye of [
    [-5.2, 1.6, 4.6],
    [-5.4, 1.8, 2.7],
    [-6.8, 1.6, 3.65],
  ]) {
    f.camera.position.fromArray(eye);
    f.camera.lookAt(-8.179, 1.67, 3.65);
    f.camera.updateMatrixWorld(true);
    const full = reflectInteriorCamera(f.camera, plane),
      cropped = reflectInteriorCamera(f.camera, plane, new THREE.PerspectiveCamera(), bounds);
    assert.ok(cropped.crop.gain > 1.1, "actual mirror detail increases without a larger texture");
    assert.ok(cropped.crop.area < 0.83);
    for (const y of [bounds.min.y, bounds.max.y])
      for (const z of [bounds.min.z, bounds.max.z]) {
        const point = new THREE.Vector3(bounds.max.x, y, z),
          uv = point.clone().applyMatrix4(cropped.projection),
          ndc = point.clone().project(cropped.camera);
        close(uv.x, ndc.x * 0.5 + 0.5);
        close(uv.y, ndc.y * 0.5 + 0.5);
        assert.ok(uv.x > 0 && uv.x < 1 && uv.y > 0 && uv.y < 1, "guard band surrounds every visible mirror corner");
      }
    close(cropped.camera.position.distanceTo(full.camera.position), 0);
    const visible = new THREE.Vector3(-6.5, 1.6, 3.65).project(cropped.camera),
      hidden = new THREE.Vector3(-8.7, 1.6, 3.65).project(cropped.camera);
    assert.ok(visible.z >= -1 && visible.z <= 1);
    assert.ok(hidden.z < -1, "cropping retains the true mirror clipping plane");
  }
  f.reflections.dispose();
});

test("nearby rooms and real live actors survive capture while distant scene roots stay excluded", () => {
  const f = fixture();
  const adjacent = new THREE.Group(),
    distant = new THREE.Group(),
    actor = new THREE.Group(),
    farActor = new THREE.Group();
  adjacent.add(new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial()));
  adjacent.position.set(-4.5, 1.5, 3.65);
  distant.add(new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial()));
  distant.position.set(50, 1.5, 3.65);
  actor.position.set(-6, 0, 3.65);
  actor.name = "actual-animated-Sirui";
  farActor.position.set(50, 0, 3.65);
  f.world.add(adjacent, distant, actor, farActor);
  f.roots.set("adjacent-living", adjacent);
  f.roots.set("distant-study", distant);
  f.dynamicRoots.push(actor, farActor);
  f.world.updateMatrixWorld(true);
  const render = f.renderer.render;
  f.renderer.render = (source, camera) => {
    assert.equal(adjacent.visible, true);
    assert.equal(distant.visible, false);
    assert.equal(actor.visible, true, "the original posed actor is rendered, not a replacement or image");
    assert.equal(farActor.visible, false);
    render(source, camera);
  };
  assert.equal(f.reflections.update(f.camera, { room: "bath-living", now: 0 }), true);
  const e = f.reflections.evidence();
  assert.deepEqual(e.dynamicRoots, ["actual-animated-Sirui"]);
  assert.ok(e.contextRooms.includes("adjacent-living"));
  assert.ok(!e.contextRooms.includes("distant-study"));
  assert.ok(e.linearTexelGain > 1);
  for (const object of [adjacent, distant, actor, farActor]) assert.equal(object.visible, true, "capture restores world visibility");
  f.reflections.dispose();
});

test("posed content refreshes behind a still camera at 15 Hz and freezes with its composed clock", () => {
  const f = fixture();
  const actor = new THREE.Group();
  actor.position.set(-6, 0, 3.65);
  f.world.add(actor);
  f.dynamicRoots.push(actor);
  f.world.updateMatrixWorld(true);
  assert.equal(f.reflections.update(f.camera, { room: "bath-living", now: 0 }), true);
  f.advanceContent();
  assert.equal(f.reflections.update(f.camera, { room: "bath-living", now: 20 }), false);
  assert.equal(f.reflections.update(f.camera, { room: "bath-living", now: 70 }), true);
  assert.equal(f.reflections.update(f.camera, { room: "bath-living", now: 2000 }), false, "Pause/reduced-motion is a composed still");
  f.advanceContent();
  assert.equal(f.reflections.update(f.camera, { room: "bath-living", now: 2010 }), true, "reduced-motion input can explicitly change the pose");
  f.dynamicRoots.length = 0;
  assert.equal(f.reflections.update(f.camera, { room: "bath-living", now: 2100 }), true, "leaving actors invalidate their previous pixels");
  f.advanceContent();
  assert.equal(f.reflections.update(f.camera, { room: "bath-living", now: 2200 }), false, "unseen content does not recapture an empty room");
  f.reflections.dispose();
});

test("looking away, standing behind the mirror and hidden room roots never capture", () => {
  const f = fixture();
  f.camera.lookAt(0, 1.6, 4.6);
  f.camera.updateMatrixWorld(true);
  assert.equal(f.reflections.update(f.camera, { room: "bath-living", now: 0 }), false);
  f.camera.position.set(-9, 1.6, 3.65);
  f.camera.lookAt(-8.179, 1.67, 3.65);
  f.camera.updateMatrixWorld(true);
  assert.equal(f.reflections.update(f.camera, { room: "bath-living", now: 100 }), false);
  f.camera.position.set(-5.2, 1.6, 4.6);
  f.camera.lookAt(-8.179, 1.67, 3.65);
  f.camera.updateMatrixWorld(true);
  f.roots.get("bath-living").visible = false;
  assert.equal(f.reflections.update(f.camera, { room: "bath-living", now: 200 }), false);
  assert.equal(f.draws.length, 0);
  f.reflections.dispose();
});

test("planar radiance replaces only mirror specular and never samples the outdoor environment", () => {
  const f = fixture();
  for (const material of f.materials) {
    assert.equal(material.envMapIntensity, 0);
    const shader = { uniforms: {}, vertexShader: "#include <project_vertex>", fragmentShader: "#include <lights_fragment_end>" };
    material.onBeforeCompile(shader, f.renderer);
    assert.ok(shader.fragmentShader.includes("reflectedLight.indirectSpecular=indoorRadiance"));
    assert.ok(!shader.fragmentShader.includes("directDiffuse="));
    assert.equal(shader.uniforms.indoorMirror.value.colorSpace, THREE.LinearSRGBColorSpace);
  }
  f.reflections.bind({ "room:bath-living": 0.16 });
  for (const material of f.materials) assert.equal(material.envMapIntensity, 0, "light levels do not multiply reflected radiance twice");
  f.reflections.dispose();
  for (const material of f.materials) close(material.envMapIntensity, 0.7);
});

test("failed capture restores targets, enclosure visibility, lights and renderer state", async () => {
  const f = fixture();
  await f.reflections.prepare({ camera: f.camera });
  f.renderer.render = () => {
    throw new Error("capture failed");
  };
  assert.throws(() => f.reflections.update(f.camera, { room: "bath-living", now: 0 }), /capture failed/);
  f.restored();
  assert.equal(f.reflections.evidence().captures, 0);
  assert.equal(f.reflections.evidence().size, 256);
  f.reflections.dispose();
});
