import * as THREE from "../three.module.min.js";
import { companion, companionLights } from "../companion/bridge.mjs";
import { randomSource } from "../companion/behaviour.mjs";
import { roomRoute, sampleRoute } from "./navigation.mjs";
import { beachPoint } from "./shore.mjs";

export async function createWorldCompanion(scene, config, container, loader) {
  const gltf = await loader.loadAsync(new URL("../../models/pip/pip.glb", import.meta.url).href);
  const group = new THREE.Group();
  group.name = "P companion";
  scene.add(group);
  const body = gltf.scene;
  group.add(body);
  const head = body.getObjectByName("PipHead");
  const shell = body.getObjectByName("PipBody");
  const antennas = ["L", "R"].map((s) => body.getObjectByName("PipAntenna" + s));
  const arms = ["L", "R"].map((s) => body.getObjectByName("PipArm" + s));
  const pupils = ["L", "R"].map((s) => body.getObjectByName("PipEye" + s));
  const pupilOrigins = pupils.map((p) => p.position.clone());
  const meshes = [],
    materials = new Set(),
    geometries = new Set();
  body.traverse((o) => {
    if (!o.isMesh) return;
    o.castShadow = o.receiveShadow = true;
    o.userData.action = { type: "pip" };
    meshes.push(o);
    materials.add(o.material);
    geometries.add(o.geometry);
    if (/^(P|Pip) porcelain$/.test(o.material.name)) {
      o.material.roughness = 0.38;
      o.material.envMapIntensity = 0.65;
    }
  });
  const eyes = [...materials].find((m) => /^(P|Pip) iris$/.test(m.name));
  body.scale.setScalar(0.46);
  companion.worldReady = true;
  let pose = {},
    hoverHeight = null;
  const shadowMaterial = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: { strength: { value: 0.22 } },
    vertexShader: "varying vec2 v;void main(){v=uv-.5;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}",
    fragmentShader: "varying vec2 v;uniform float strength;void main(){gl_FragColor=vec4(.025,.04,.045,exp(-dot(v,v)*19.)*strength);}",
  });
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(1.15, 1.15), shadowMaterial);
  shadow.rotation.x = -Math.PI / 2;
  shadow.userData.noOcclusion = true;
  scene.add(shadow);
  const ray = new THREE.Raycaster(),
    plane = new THREE.Plane(new THREE.Vector3(0, 1, 0)),
    point = new THREE.Vector3();
  const random = randomSource(1037),
    goal = new THREE.Vector3(),
    position = new THREE.Vector3();
  let room = null,
    route = null,
    routeStart = 0,
    nextWander = 0,
    now = 0,
    fade = 0,
    paused = false,
    away = false,
    returning = false,
    outing = null,
    nextTrip = 40;
  const perches = config.companion.perches;
  function roomGoal(id, instant = false) {
    const next = config.rooms.find((r) => r.id === id) || config.rooms[0];
    const list = perches[next.id],
      p = list[Math.floor(random() * list.length)];
    goal.fromArray(p);
    if (room && room.id !== next.id && !instant) {
      route = roomRoute(config, room, next, position.toArray());
      routeStart = now;
    } else route = null;
    if (!room || instant) position.copy(goal);
    room = next;
    nextWander = now + 7 + random() * 8;
    away = false;
    returning = false;
    outing = null;
  }
  function update(dt, time, camera, id, moving) {
    now = time;
    paused = !moving || companion.napping || companion.reduced || companion.paused;
    const inWorld = companion.owner === "world";
    group.visible = inWorld;
    shadow.visible = inWorld;
    if (!inWorld) {
      fade = 0;
      return;
    }
    const actualRoom = config.rooms.some((r) => r.id === id) ? id : room?.id || "study";
    if (!room || actualRoom !== room.id) roomGoal(actualRoom, paused);
    if (!paused && now > nextWander && !away && !route) roomGoal(actualRoom);
    if (!paused && now > nextTrip && !route) {
      nextTrip = now + 65 + random() * 50;
      if (random() < 0.45) {
        const lounge = config.rooms.find((r) => r.id === "lounge");
        route = roomRoute(config, room, lounge, position.toArray());
        for (const p of [[3.8, 0, -4.4], [3.8, 0, -7.4], [3.8, -5.8, -10.5], beachPoint(6, 0.35, config.beach)]) {
          const prior = route.points.at(-1);
          route.points.push(p);
          route.distances.push(route.distances.at(-1) + Math.hypot(...p.map((v, i) => v - prior[i])));
        }
        route.length = route.distances.at(-1);
        outing = route.points.map((p) => [...p]);
        routeStart = now;
        away = true;
        returning = false;
        goal.fromArray(route.points.at(-1));
      }
    }
    if (route && !paused) {
      const t = Math.min(1, (now - routeStart) / (route.length / 1.6));
      const p = sampleRoute(route, t);
      position.fromArray(p.position);
      if (t === 1) {
        route = null;
        if (returning) {
          away = returning = false;
          outing = null;
          goal.fromArray(perches[actualRoom][0]);
          nextWander = now + 8;
        } else if (away) {
          nextWander = now + 9;
        }
      }
    } else if (away && now > nextWander && !paused) {
      const points = [...outing].reverse(),
        distances = [0];
      for (let i = 1; i < points.length; i++) distances.push(distances.at(-1) + Math.hypot(...points[i].map((v, j) => v - points[i - 1][j])));
      route = { points, distances, length: distances.at(-1) };
      routeStart = now;
      returning = true;
    } else if (!paused) position.lerp(goal, 1 - Math.exp(-dt * 0.8));
    const bob = paused ? 0 : Math.sin(time * 2.05) * 0.012;
    group.position.copy(position);
    const hover = away ? 0.72 : config.companion.hover[room.id] || 0.72;
    hoverHeight = hoverHeight === null || paused ? hover : THREE.MathUtils.lerp(hoverHeight, hover, 1 - Math.exp(-dt * 3));
    group.position.y += hoverHeight;
    const toCamera = camera.position.clone().sub(group.position);
    group.rotation.y = Math.atan2(toCamera.x, toCamera.z);
    const rect = container.getBoundingClientRect(),
      pointer = companion.pointer;
    let lookX = 0,
      lookY = 0;
    if (!paused && pointer.at > 0 && performance.now() - pointer.at < 4500) {
      const projected = group.position.clone().project(camera);
      lookX = THREE.MathUtils.clamp(((pointer.x - rect.left) / rect.width - (projected.x + 1) * 0.5) * 2, -1, 1);
      lookY = THREE.MathUtils.clamp(((pointer.y - rect.top) / rect.height - (1 - projected.y) * 0.5) * 2, -1, 1);
      if (pointer.x >= rect.left && pointer.x <= rect.right && pointer.y >= rect.top && pointer.y <= rect.bottom && !route && !away) {
        ray.setFromCamera(new THREE.Vector2(((pointer.x - rect.left) / rect.width) * 2 - 1, (-(pointer.y - rect.top) / rect.height) * 2 + 1), camera);
        plane.constant = -(room.floor + hover);
        if (ray.ray.intersectPlane(plane, point)) {
          const anchor = new THREE.Vector3(...perches[room.id][0]);
          const reach = room.id === "study" ? 0.15 : 0.22;
          goal.x = anchor.x + THREE.MathUtils.clamp(point.x - anchor.x, -reach, reach);
          goal.z = anchor.z + THREE.MathUtils.clamp(point.z - anchor.z, -reach, reach);
        }
      }
    }
    pose = companion.motion.update(dt, {
      gaze: [lookX, -lookY],
      still: paused,
      nap: companion.napping,
      blink: paused ? 0 : Math.sin(time * 1.07) > 0.996 ? 1 : 0,
    });
    head.rotation.set(...pose.head);
    head.rotation.order = "ZYX";
    head.position.y = 0.4;
    body.position.y = pose.lift * 0.46;
    shell.rotation.z = pose.lean;
    shell.rotation.x = pose.bodyPitch;
    antennas.forEach((a, i) => (a.rotation.z = pose.antennas[i]));
    arms.forEach((a, i) => {
      a.rotation.z = (i ? 0.16 : -0.16) + pose.arms[i];
      a.rotation.x = pose.armPitch[i];
    });
    pupils.forEach((p, i) => {
      p.position.copy(pupilOrigins[i]);
      p.position.x += pose.gaze[0] * 0.024;
      p.position.y += pose.gaze[1] * 0.019;
      p.scale.x = pose.pupil[0];
      p.scale.y = pose.eyes[i] * pose.pupil[1];
    });
    fade = paused ? 1 : Math.min(1, fade + dt * 2);
    body.scale.setScalar(0.46 * fade);
    shadow.position.set(position.x, position.y + 0.016, position.z);
    shadow.scale.setScalar(0.9 + bob * 2);
    shadowMaterial.uniforms.strength.value = (companion.theme === "evening" ? 0.35 : 0.22) * fade;
    eyes.color.setRGB(...(companionLights[companion.theme] || companionLights.noon).accent);
    eyes.emissive.copy(eyes.color);
    const projected = group.position.clone().project(camera);
    companion.projected = { x: rect.left + (projected.x + 1) * rect.width * 0.5, y: rect.top + (1 - projected.y) * rect.height * 0.5 };
    companion.room = away ? "beach" : room.id;
    companion.worldReady = true;
  }
  return {
    update,
    pick: (raycaster) => (group.visible ? raycaster.intersectObjects(meshes, false)[0] : null),
    evidence: () => ({
      visible: group.visible,
      position: group.position.toArray(),
      head: [head.rotation.x, head.rotation.y, head.rotation.z],
      model: "blender-pip",
      gesture: pose.gesture,
      room: away ? "beach" : room?.id,
      traveling: Boolean(route),
    }),
    dispose() {
      group.removeFromParent();
      shadow.removeFromParent();
      geometries.forEach((g) => g.dispose());
      materials.forEach((m) => m.dispose());
      shadow.geometry.dispose();
      shadowMaterial.dispose();
      companion.worldReady = false;
    },
  };
}
