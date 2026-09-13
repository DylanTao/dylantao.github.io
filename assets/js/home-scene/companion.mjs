import * as THREE from "../three.module.min.js";
import { companion, companionLights } from "../companion/bridge.mjs";
import { randomSource } from "../companion/behaviour.mjs";
import { roomRoute, sampleRoute } from "./navigation.mjs";
import { beachPoint } from "./shore.mjs";

function rounded(width, height, depth, radius) {
  const s = new THREE.Shape(),
    x = -width / 2,
    y = -height / 2,
    r = radius;
  s.moveTo(x + r, y);
  s.lineTo(x + width - r, y);
  s.quadraticCurveTo(x + width, y, x + width, y + r);
  s.lineTo(x + width, y + height - r);
  s.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  s.lineTo(x + r, y + height);
  s.quadraticCurveTo(x, y + height, x, y + height - r);
  s.lineTo(x, y + r);
  s.quadraticCurveTo(x, y, x + r, y);
  const g = new THREE.ExtrudeGeometry(s, {
    depth: Math.max(0.008, depth - 0.06),
    bevelEnabled: true,
    bevelSegments: 3,
    steps: 1,
    bevelSize: 0.03,
    bevelThickness: 0.03,
    curveSegments: 10,
  });
  g.translate(0, 0, -depth / 2 + 0.03);
  return g;
}

export function createWorldCompanion(scene, config, container) {
  const group = new THREE.Group();
  group.name = "Pip companion";
  scene.add(group);
  const body = new THREE.Group();
  group.add(body);
  body.scale.setScalar(0.4);
  const ceramic = new THREE.MeshPhysicalMaterial({ color: 0xecf1ef, roughness: 0.26, metalness: 0.02, clearcoat: 0.9, clearcoatRoughness: 0.16 });
  const glass = new THREE.MeshPhysicalMaterial({ color: 0x10232b, roughness: 0.12, metalness: 0.35, clearcoat: 1 });
  const metal = new THREE.MeshStandardMaterial({ color: 0x889f9e, metalness: 0.65, roughness: 0.32 });
  const eyes = new THREE.MeshStandardMaterial({ color: 0x75dad0, emissive: 0x4dc5ba, emissiveIntensity: 1.8, roughness: 0.3 });
  const orange = new THREE.MeshStandardMaterial({ color: 0xf58b41, emissive: 0xf58b41, emissiveIntensity: 0.5 });
  const sphere = new THREE.SphereGeometry(1, 20, 14),
    owned = [];
  const add = (parent, g, m, pos, scale) => {
    const o = new THREE.Mesh(g, m);
    o.position.set(...pos);
    if (scale) o.scale.set(...scale);
    o.castShadow = true;
    o.receiveShadow = true;
    parent.add(o);
    return o;
  };
  add(body, sphere, ceramic, [0, -0.16, 0], [0.255, 0.3, 0.21]);
  add(body, sphere, metal, [0, 0.15, 0], [0.065, 0.1, 0.065]);
  const head = new THREE.Group();
  head.position.y = 0.46;
  body.add(head);
  const headGeometry = rounded(0.96, 0.62, 0.5, 0.19),
    visorGeometry = rounded(0.79, 0.43, 0.045, 0.15),
    eyeGeometry = rounded(0.088, 0.16, 0.02, 0.035);
  owned.push(headGeometry, visorGeometry, eyeGeometry);
  add(head, headGeometry, ceramic, [0, 0, 0]);
  add(head, visorGeometry, glass, [0, 0, 0.275]);
  const gaze = new THREE.Group();
  gaze.position.z = 0.322;
  head.add(gaze);
  for (const side of [-1, 1]) {
    add(gaze, eyeGeometry, eyes, [side * 0.155, 0, 0]);
    add(head, sphere, metal, [side * 0.507, 0, 0], [0.035, 0.09, 0.09]);
  }
  const arms = [-1, 1].map((side) => {
    const arm = new THREE.Group();
    arm.position.set(side * 0.31, -0.12, 0);
    body.add(arm);
    add(arm, sphere, ceramic, [0, -0.06, 0], [0.075, 0.145, 0.075]);
    return arm;
  });
  add(head, sphere, metal, [0, 0.39, -0.02], [0.022, 0.072, 0.022]);
  add(head, sphere, orange, [0, 0.46, -0.02], [0.038, 0.038, 0.038]);
  add(body, sphere, eyes, [0, -0.447, 0], [0.12, 0.023, 0.1]);
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
    const bob = paused ? 0 : Math.sin(time * 2.4) * 0.035;
    group.position.copy(position);
    const hover = away ? 0.72 : config.companion.hover[room.id] || 0.72;
    group.position.y += hover + bob;
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
    head.rotation.y = THREE.MathUtils.lerp(head.rotation.y, lookX * 0.32, paused ? 1 : 0.1);
    head.rotation.x = THREE.MathUtils.lerp(head.rotation.x, lookY * 0.23, paused ? 1 : 0.1);
    gaze.position.x = lookX * 0.032;
    gaze.position.y = -lookY * 0.025;
    const blink = companion.napping ? 0.09 : paused ? 1 : Math.sin(time * 1.07) > 0.996 ? 0.1 : 1;
    gaze.scale.y = blink;
    arms.forEach((arm, i) => (arm.rotation.z = (i ? 1 : -1) * (0.22 + (paused ? 0 : Math.sin(time * 2) * 0.08) + companion.mood * 0.65)));
    body.rotation.z = paused ? 0 : Math.sin(time * 1.3) * 0.035;
    fade = paused ? 1 : Math.min(1, fade + dt * 2);
    body.scale.setScalar(0.4 * fade);
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
    evidence: () => ({
      visible: group.visible,
      position: group.position.toArray(),
      head: [head.rotation.x, head.rotation.y],
      room: away ? "beach" : room?.id,
      traveling: Boolean(route),
    }),
    dispose() {
      group.removeFromParent();
      shadow.removeFromParent();
      sphere.dispose();
      owned.forEach((g) => g.dispose());
      shadow.geometry.dispose();
      [ceramic, glass, metal, eyes, orange, shadowMaterial].forEach((m) => m.dispose());
      companion.worldReady = false;
    },
  };
}
