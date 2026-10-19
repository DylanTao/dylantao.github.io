// Draws the coast's people as a handful of instanced meshes. Postures come from
// people-pose.mjs; this module turns their rods, ellipsoids and boxes into instance
// matrices, adds soft contact shadows (figures move, but the coast's shadow map is
// rendered on demand), lets the evening fire flicker, and warms its sitters with light.
import * as THREE from "../three.module.min.js";
import { createCast, poseActor, actorParts, actorExtent, isVisible } from "./people-pose.mjs?v=coastal-life-20261018";

const UP = new THREE.Vector3(0, 1, 0);
const ZERO = new THREE.Matrix4().makeScale(0, 0, 0);

function cylinder(top, bottom, sides) {
  return new THREE.CylinderGeometry(top, bottom, 1, sides, 1).translate(0, 0.5, 0);
}

function shadowMaterial() {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: { strength: { value: 0.26 } },
    vertexShader: `varying vec2 vUv;
      void main() {
        vUv = uv;
        vec4 p = vec4(position, 1.0);
        #ifdef USE_INSTANCING
          p = instanceMatrix * p;
        #endif
        gl_Position = projectionMatrix * modelViewMatrix * p;
      }`,
    fragmentShader: `uniform float strength; varying vec2 vUv;
      void main() {
        float d = length(vUv * 2.0 - 1.0);
        float a = strength * (1.0 - smoothstep(0.25, 1.0, d));
        if (a < 0.004) discard;
        gl_FragColor = vec4(0.0, 0.0, 0.0, a);
      }`,
  });
}

export function createPeople(scene, model, figures, { hostVisible = () => true } = {}) {
  const cast = createCast(figures);
  const material = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.72, metalness: 0, envMapIntensity: 0.22 });
  const geometries = {
    rod: cylinder(1, 1, 8),
    torso: cylinder(1, 0.82, 10),
    ball: new THREE.IcosahedronGeometry(1, 1),
    box: new THREE.BoxGeometry(1, 1, 1),
  };
  const entries = { rod: [], torso: [], ball: [], box: [] };
  for (const actor of cast) {
    actor.parent = actor.figure.parent ? model.getObjectByName(actor.figure.parent) : null;
    actor.extent = actorExtent(actor.figure);
    actor.partList = actorParts(actor);
    for (const part of actor.partList) entries[part.type].push({ actor, part });
  }
  const meshes = {};
  const color = new THREE.Color();
  for (const [type, list] of Object.entries(entries)) {
    if (!list.length) continue;
    const mesh = new THREE.InstancedMesh(geometries[type], material, list.length);
    mesh.name = "CoastPeople·" + type;
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    // Instances travel along the whole coast; skip the stale whole-mesh culling sphere.
    mesh.frustumCulled = false;
    mesh.castShadow = false;
    mesh.receiveShadow = true;
    list.forEach(({ part }, i) => mesh.setColorAt(i, color.setRGB(...part.color)));
    mesh.instanceColor.needsUpdate = true;
    scene.add(mesh);
    meshes[type] = mesh;
  }
  const shadowCount = cast.reduce(
    (n, a) => n + (a.figure.kind === "surfer" || a.figure.kind === "swimmer" ? 0 : a.people.length + (a.dog ? 1 : 0)),
    0
  );
  const shadows = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), shadowMaterial(), Math.max(1, shadowCount));
  shadows.name = "CoastPeople·contact";
  shadows.frustumCulled = false;
  shadows.renderOrder = 1;
  // Contact shadows are not geometry: keep them out of the ambient occlusion pass.
  shadows.userData.noOcclusion = true;
  shadows.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  scene.add(shadows);

  // The evening fire: flames flicker from their base and warm the people around them.
  const fireFigure = figures.find((f) => f.kind === "fire");
  const fireActor = cast.find((a) => a.figure === fireFigure);
  const flames = model.getObjectByName("Flames");
  const fireLight = new THREE.PointLight(0xff9a4a, 0, 2.4, 2);
  if (fireFigure) {
    fireLight.position.set(fireFigure.center[0], fireFigure.center[1] + 0.32, fireFigure.center[2]);
    scene.add(fireLight);
  }

  const m = new THREE.Matrix4(),
    q = new THREE.Quaternion(),
    s = new THREE.Vector3(),
    p = new THREE.Vector3(),
    d = new THREE.Vector3(),
    bx = new THREE.Vector3(),
    by = new THREE.Vector3(),
    bz = new THREE.Vector3();
  function partMatrix(part) {
    if (!part.visible) return m.copy(ZERO);
    if (part.type === "rod" || part.type === "torso") {
      d.set(part.b[0] - part.a[0], part.b[1] - part.a[1], part.b[2] - part.a[2]);
      const len = d.length();
      if (len < 1e-5) return m.copy(ZERO);
      q.setFromUnitVectors(UP, d.multiplyScalar(1 / len));
      return m.compose(p.fromArray(part.a), q, s.set(part.r, len, part.r));
    }
    if (part.type === "ball") {
      d.fromArray(part.b);
      if (d.lengthSq() < 1e-9) d.copy(UP);
      q.setFromUnitVectors(UP, d.normalize());
      return m.compose(p.fromArray(part.a), q, s.set(part.r2, part.r, part.r2));
    }
    // Boxes: b is the thin axis; width lies horizontal, height completes the basis.
    bz.fromArray(part.b).normalize();
    bx.crossVectors(UP, bz);
    if (bx.lengthSq() < 1e-6) bx.set(1, 0, 0);
    bx.normalize();
    by.crossVectors(bz, bx);
    m.makeBasis(bx.multiplyScalar(part.r), by.multiplyScalar(part.r2), bz.multiplyScalar(part.r3));
    return m.setPosition(part.a[0], part.a[1], part.a[2]);
  }

  let period = "noon",
    lastPose = null,
    night = false,
    view = null;
  // Present: out at this time of day, on a risen court or a shown board. Visible: also
  // inside the camera's horizontal span, so worth posing and drawing.
  const presence = new Map(),
    visibility = new Map();
  function refreshVisibility() {
    let changed = false;
    for (const actor of cast) {
      const present =
        isVisible(actor.figure, period) &&
        (!actor.figure.host || hostVisible(actor.figure.host)) &&
        (!actor.figure.parent || Boolean(actor.parent?.visible));
      const inView = !view || !actor.extent || (actor.extent[1] >= view[0] && actor.extent[0] <= view[1]);
      const next = present && inView;
      if (visibility.get(actor) !== next) changed = true;
      presence.set(actor, present);
      visibility.set(actor, next);
    }
    return changed;
  }
  refreshVisibility();

  const counters = { rod: 0, torso: 0, ball: 0, box: 0 };
  // People who barely move (sitters, fire warmers, the sunbather) re-pose every third frame;
  // their breathing and glances stay smooth at 10 Hz and the cast costs less to animate.
  const SLOW = new Set(["sitter", "fire", "sunbather"]);
  cast.forEach((actor, i) => (actor.slot = i % 3));
  let tick = 0;
  // Pose visible actors at time t and upload their instances. Actors on moving boards are
  // re-placed every call even when their pose is held still.
  function update(t, { force = false, viewX = null } = {}) {
    view = viewX;
    const changed = refreshVisibility();
    const moving = t !== lastPose;
    lastPose = t;
    tick++;
    for (const key in counters) counters[key] = 0;
    let shadowIndex = 0,
      dirty = false;
    for (const actor of cast) {
      const shown = visibility.get(actor);
      const parts = actor.partList;
      const slots = actor.figure.kind === "surfer" || actor.figure.kind === "swimmer" ? 0 : actor.people.length + (actor.dog ? 1 : 0);
      if (!shown) {
        if (!actor.cleared) {
          for (const part of parts) meshes[part.type].setMatrixAt(counters[part.type]++, ZERO);
          for (let i = 0; i < slots; i++) shadows.setMatrixAt(shadowIndex + i, ZERO);
          actor.cleared = dirty = true;
          actor.posed = false;
        } else for (const part of parts) counters[part.type]++;
        shadowIndex += slots;
        continue;
      }
      const repose = force || changed || !actor.posed || (moving && (!SLOW.has(actor.figure.kind) || (tick + actor.slot) % 3 === 0));
      if (repose) {
        poseActor(actor, t);
        actor.posed = true;
        actor.cleared = false;
      }
      if (!repose && !actor.parent) {
        for (const part of parts) counters[part.type]++;
        shadowIndex += slots;
        continue;
      }
      dirty = true;
      actor.parent?.updateWorldMatrix(true, false);
      for (const part of parts) {
        partMatrix(part);
        if (actor.parent) m.premultiply(actor.parent.matrixWorld);
        meshes[part.type].setMatrixAt(counters[part.type]++, m);
      }
      for (let i = 0; i < slots; i++) {
        const shadow = actor.shadows[i];
        if (shadow && i < actor.shadowCount) {
          m.compose(p.fromArray(shadow.at), q.setFromAxisAngle(UP, shadow.angle), s.set(0.17 * shadow.size, 1, 0.36 * shadow.size));
          shadows.setMatrixAt(shadowIndex + i, m);
        } else shadows.setMatrixAt(shadowIndex + i, ZERO);
      }
      shadowIndex += slots;
    }
    if (dirty) {
      for (const mesh of Object.values(meshes)) mesh.instanceMatrix.needsUpdate = true;
      shadows.instanceMatrix.needsUpdate = true;
    }
    // Fire: a flicker only while the scene animates; a steady glow in still frames.
    const burning = Boolean(fireActor && visibility.get(fireActor));
    const flicker = burning && t !== 0 ? Math.sin(t * 9.1) * 0.6 + Math.sin(t * 15.7 + 1.3) * 0.4 : 0;
    if (flames && (burning || flames.scale.y !== 1)) {
      flames.scale.set(1 - flicker * 0.035, 1 + flicker * 0.12, 1 - flicker * 0.035);
      flames.updateMatrixWorld(true);
    }
    fireLight.intensity = burning ? 1.05 + flicker * 0.18 : 0;
  }

  return {
    update,
    // Every drawn mesh, so the sea's on-demand mirror can leave the moving cast out.
    objects: [...Object.values(meshes), shadows],
    // The burning fire for the sea's glitter path: where it stands and its flickering light.
    fire() {
      return fireActor && visibility.get(fireActor)
        ? { x: fireFigure.center[0], y: fireFigure.center[1], z: fireFigure.center[2], light: fireLight.intensity }
        : null;
    },
    // The swimmer as a wake source for the sea: position, heading and whether it is stroking.
    movers() {
      const out = [];
      for (const actor of cast) {
        if (actor.figure.kind !== "swimmer" || !visibility.get(actor) || !actor.posed) continue;
        const h = actor.people[0];
        out.push({ x: h.root[0], z: h.root[2], heading: [Math.sin(h.yaw), Math.cos(h.yaw)], power: actor.props[0]?.visible ? 0.55 : 0 });
      }
      return out;
    },
    setPeriod(next, isNight) {
      period = next;
      night = isNight;
      shadows.material.uniforms.strength.value = night ? 0.16 : 0.26;
    },
    evidence() {
      const present = cast.filter((a) => presence.get(a));
      return {
        period,
        pose: lastPose,
        actors: cast.length,
        visible: present.map((a) => a.figure.id),
        drawn: cast.filter((a) => visibility.get(a)).map((a) => a.figure.id),
        people: present.reduce((n, a) => n + a.people.length, 0),
        instances: Object.fromEntries(Object.entries(meshes).map(([k, mesh]) => [k, mesh.count])),
      };
    },
    dispose() {
      for (const mesh of Object.values(meshes)) {
        scene.remove(mesh);
        mesh.dispose();
      }
      scene.remove(shadows, fireLight);
      shadows.geometry.dispose();
      shadows.material.dispose();
      shadows.dispose();
      for (const g of Object.values(geometries)) g.dispose();
      material.dispose();
      fireLight.dispose();
    },
  };
}
