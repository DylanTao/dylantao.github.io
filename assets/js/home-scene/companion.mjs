import * as THREE from "../three.module.min.js";
import { companion, companionLights } from "../companion/bridge.mjs";
import { randomSource } from "../companion/behaviour.mjs";
import { roomRoute } from "./navigation.mjs";
import { beachPoint } from "./shore.mjs";
import { createPipDirector, createPipFlight, samplePipFlight } from "../companion/performance.mjs";
import { pipLocalAim, advancePipHeading, createPipTouchInvitation } from "../companion/attention.mjs";

export async function createWorldCompanion(scene, config, container, loader) {
  const gltf = await loader.loadAsync(new URL("../../models/pip/pip.glb", import.meta.url).href);
  const group = new THREE.Group();
  group.name = "P companion";
  group.visible = false;
  scene.add(group);
  const body = gltf.scene;
  group.add(body);
  const head = body.getObjectByName("PipHead");
  const shell = body.getObjectByName("PipBody");
  const antennas = ["L", "R"].map((s) => body.getObjectByName("PipAntenna" + s));
  const arms = ["L", "R"].map((s) => body.getObjectByName("PipArm" + s));
  const pupils = ["L", "R"].map((s) => body.getObjectByName("PipEye" + s));
  const pupilOrigins = pupils.map((p) => p.position.clone());
  const catchlights = ["L", "R"].map((s) => body.getObjectByName("Optical_catchlight_" + s));
  const catchlightOrigins = catchlights.map((p) => p?.position.clone());
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
    hoverHeight = null,
    performancePose = {},
    flightPose = null;
  const shadowMaterial = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: { strength: { value: 0.22 } },
    vertexShader: "varying vec2 v;void main(){v=uv-.5;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}",
    fragmentShader: "varying vec2 v;uniform float strength;void main(){gl_FragColor=vec4(.025,.04,.045,exp(-dot(v,v)*19.)*strength);}",
  });
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(1.15, 1.15), shadowMaterial);
  shadow.visible = false;
  shadow.rotation.x = -Math.PI / 2;
  shadow.userData.noOcclusion = true;
  scene.add(shadow);
  const random = randomSource(1037),
    director = createPipDirector(1037),
    goal = new THREE.Vector3(),
    position = new THREE.Vector3(),
    projected = new THREE.Vector3(),
    taskTarget = new THREE.Vector3(),
    pointerTarget = new THREE.Vector3(),
    aimTarget = new THREE.Vector3(),
    opticalOrigin = new THREE.Vector3(),
    toCamera = new THREE.Vector3(),
    pointerNdc = new THREE.Vector2(),
    pointerRay = new THREE.Raycaster(),
    visitorPlane = new THREE.Plane(),
    touchInvitation = createPipTouchInvitation();
  let record = null,
    human = null,
    humanHead = null,
    inputKind = typeof matchMedia !== "undefined" && matchMedia("(pointer: coarse)").matches ? "touch" : "mouse",
    aim = null;
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
    nextTrip = 40,
    inputTime = null,
    wasWorld = false,
    heading = null,
    bank = 0,
    needsMotorReset = true,
    taskObject = "Sirui";
  const perches = config.companion.perches;
  function closeToP(x, y) {
    const rect = container.getBoundingClientRect(),
      p = companion.projected;
    return Boolean(
      p &&
      x >= rect.left &&
      x <= rect.right &&
      y >= rect.top &&
      y <= rect.bottom &&
      Math.hypot(x - p.x, y - p.y) < Math.max(36, Math.min(70, rect.width * 0.085))
    );
  }
  const touchEvents = [
    [
      "pointerdown",
      (e) => {
        inputKind = e.pointerType || "mouse";
        if (inputKind === "touch" && companion.owner === "world") touchInvitation.down(e.pointerId, e.clientX, e.clientY);
      },
    ],
    [
      "pointermove",
      (e) => {
        inputKind = e.pointerType || "mouse";
        if (inputKind === "touch") touchInvitation.move(e.pointerId, e.clientX, e.clientY);
      },
    ],
    [
      "pointerup",
      (e) => {
        if (e.pointerType === "touch")
          touchInvitation.up(e.pointerId, e.clientX, e.clientY, now, !paused && companion.owner === "world" && closeToP(e.clientX, e.clientY));
      },
    ],
    ["pointercancel", () => touchInvitation.cancel()],
  ];
  // Observe the existing canvas gesture without consuming it. Model taps
  // still use the controller's project link; drags still orbit the camera.
  for (const [type, handler] of touchEvents) container.addEventListener?.(type, handler, { passive: true, capture: true });
  function releaseOwnership() {
    if (companion.owner === "world") return;
    // The page can replace the shared gesture while this renderer is stopped.
    // Interrupt only our director now; never reset a motor owned by the page.
    performancePose = director.update(0, { still: true });
    touchInvitation.cancel();
    needsMotorReset = true;
    wasWorld = false;
    fade = 0;
    group.visible = shadow.visible = false;
  }
  const ownerEvents = typeof window === "undefined" ? null : window;
  ownerEvents?.addEventListener("pip:change", releaseOwnership);
  function startFlight(points) {
    route = createPipFlight(points);
    routeStart = now;
  }
  function roomGoal(id, instant = false) {
    const next = config.rooms.find((r) => r.id === id) || config.rooms[0];
    const list = perches[next.id],
      candidates = list.filter((p) => position.distanceTo(new THREE.Vector3(...p)) > 0.02),
      p = (candidates.length ? candidates : list)[Math.floor(random() * (candidates.length || list.length))];
    goal.fromArray(p);
    if (room && room.id !== next.id && !instant) {
      const corridor = roomRoute(config, room, next, position.toArray());
      // The robot's endpoint is its safe perch, not the human activity anchor.
      startFlight([...corridor.points.slice(0, -1), goal.toArray()]);
    } else if (room && !instant) startFlight([position.toArray(), goal.toArray()]);
    else route = null;
    if (!room || instant) {
      position.copy(goal);
      flightPose = null;
    }
    room = next;
    nextWander = now + 7 + random() * 8;
    away = false;
    returning = false;
    outing = null;
  }
  function update(dt, time, camera, id, moving) {
    paused = !moving || companion.napping || companion.reduced || companion.paused;
    const inWorld = companion.owner === "world";
    // The room clock already excludes hidden/paused wall time. Account for
    // ownership separately: a page excursion must not finish a world flight.
    const activeDelta = inWorld && wasWorld && !paused && inputTime !== null ? Math.max(0, time - inputTime) : 0;
    inputTime = time;
    wasWorld = inWorld;
    now += activeDelta;
    group.visible = inWorld;
    shadow.visible = inWorld;
    if (!inWorld) {
      releaseOwnership();
      return;
    }
    if (needsMotorReset) {
      // The world owns the motor again and starts from a quiet composed pose.
      // The existing zero-scale arrival fade hides that change of embodiment.
      companion.motion.update(0, { still: true, autonomous: false });
      needsMotorReset = false;
    }
    const actualRoom = config.rooms.some((r) => r.id === id) ? id : room?.id || "study";
    if (!room || actualRoom !== room.id) roomGoal(actualRoom, paused);
    // The occupied room streams after P. Resolve its turntable when it arrives.
    if (!record && room.id === "study")
      scene.traverse((o) => {
        if (o.userData.action?.type === "spin") record = o;
      });
    const rect = container.getBoundingClientRect(),
      pointer = companion.pointer;
    projected.copy(position);
    projected.y += hoverHeight ?? config.companion.hover[room.id] ?? 0.72;
    projected.project(camera);
    const screenX = rect.left + (projected.x + 1) * rect.width * 0.5;
    const screenY = rect.top + (1 - projected.y) * rect.height * 0.5;
    if (paused) touchInvitation.cancel();
    const tap = inputKind === "touch" ? touchInvitation.sample(now) : null;
    const activePointer = tap || pointer;
    const recent = inputKind === "touch" ? Boolean(tap) : pointer.at > 0 && performance.now() - pointer.at < 4500;
    const inside =
      recent && activePointer.x >= rect.left && activePointer.x <= rect.right && activePointer.y >= rect.top && activePointer.y <= rect.bottom;
    const near =
      Boolean(tap) || (inside && Math.hypot(activePointer.x - screenX, activePointer.y - screenY) < Math.max(36, Math.min(70, rect.width * 0.085)));
    // From the study's safe perch Sirui is behind the visitor-facing lenses.
    // Make that a bounded, purposeful glance rather than permanently showing
    // the back of P's head. Quiet composed beats keep its face readable.
    const taskGlance = now % 18 >= 6.5 && now % 18 < 10;
    taskObject = away
      ? "Pacific"
      : !taskGlance
        ? "visitor-ready"
        : room.id === "study" && record && Math.floor(now / 18) % 2 === 1
          ? "record"
          : "Sirui";
    if (taskObject === "Pacific") {
      taskTarget.copy(position);
      taskTarget.y += 0.9;
      taskTarget.z -= 3;
    } else if (taskObject === "record") record.getWorldPosition(taskTarget);
    else if (taskObject === "visitor-ready") taskTarget.copy(camera.position);
    else {
      if (!human?.parent) {
        human = scene.getObjectByName("active-Sirui");
        humanHead = human?.getObjectByName("Head");
      }
      if (humanHead) {
        humanHead.getWorldPosition(taskTarget);
        taskTarget.y += 0.06;
      } else {
        taskTarget.fromArray(room.actor);
        taskTarget.y += room.id === "sleep" ? 0.4 : 1.05;
      }
    }
    performancePose = director.update(activeDelta, { near, traveling: Boolean(route), still: paused });
    if (!paused && !performancePose.hold && now > nextWander && !away && !route) roomGoal(actualRoom);
    if (!paused && !performancePose.hold && now > nextTrip && !route) {
      nextTrip = now + 65 + random() * 50;
      if (random() < 0.45) {
        const lounge = config.rooms.find((r) => r.id === "lounge");
        const corridor = roomRoute(config, room, lounge, position.toArray());
        outing = [
          ...corridor.points.slice(0, -1),
          perches.lounge[0],
          [3.8, 0, -4.4],
          [3.8, 0, -7.4],
          [3.8, -5.8, -10.5],
          beachPoint(6, 0.35, config.beach),
        ];
        startFlight(outing);
        away = true;
        returning = false;
        goal.fromArray(route.points.at(-1));
      }
    }
    if (route && !paused) {
      flightPose = samplePipFlight(route, now - routeStart);
      position.fromArray(flightPose.position);
      if (flightPose.done) {
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
      startFlight([...outing].reverse());
      returning = true;
    } else if (!route && !paused) {
      flightPose = null;
      if (position.distanceTo(goal) > 0.02) startFlight([position.toArray(), goal.toArray()]);
    }
    const bob = paused ? 0 : Math.sin(now * 2.05) * 0.012;
    group.position.copy(position);
    const hover = away ? 0.72 : config.companion.hover[room.id] || 0.72;
    hoverHeight = hoverHeight === null || paused ? hover : THREE.MathUtils.lerp(hoverHeight, hover, 1 - Math.exp(-dt * 3));
    group.position.y += hoverHeight + (flightPose?.lift || 0);
    toCamera.copy(camera.position).sub(group.position);
    const facing = Math.atan2(toCamera.x, toCamera.z);
    heading ??= facing;
    opticalOrigin.copy(group.position);
    opticalOrigin.y += 0.4 * 0.46;
    pointerTarget.copy(camera.position);
    if (inside) {
      // Map the pointer onto a visitor plane in front of P, not onto P's
      // image plane. This works with both orthographic and perspective views.
      toCamera.normalize();
      aimTarget.copy(opticalOrigin).addScaledVector(toCamera, 1.4);
      visitorPlane.setFromNormalAndCoplanarPoint(toCamera, aimTarget);
      pointerNdc.set(((activePointer.x - rect.left) / rect.width) * 2 - 1, 1 - ((activePointer.y - rect.top) / rect.height) * 2);
      pointerRay.setFromCamera(pointerNdc, camera);
      pointerRay.ray.intersectPlane(visitorPlane, pointerTarget);
    }
    aimTarget.copy(taskTarget).lerp(pointerTarget, performancePose.attention || 0);
    const velocity = flightPose?.velocity || [0, 0, 0];
    const lateral = velocity[0] * Math.cos(heading) - velocity[2] * Math.sin(heading);
    const targetBank = paused ? 0 : THREE.MathUtils.clamp(-lateral * 0.13, -0.16, 0.16);
    bank = paused ? 0 : THREE.MathUtils.lerp(bank, targetBank, 1 - Math.exp(-dt * 4));
    if (flightPose?.phase === "anticipate" || flightPose?.phase === "fly") {
      const direction = flightPose.direction;
      aimTarget.copy(opticalOrigin).add(new THREE.Vector3(...direction).normalize());
    }
    aim = pipLocalAim(opticalOrigin.toArray(), aimTarget.toArray(), heading);
    const gaze = aim.gaze;
    const motionInput = {
      gaze,
      still: paused,
      nap: companion.napping,
      blink: performancePose.blink,
      flight: bank,
      autonomous: false,
      elapsed: activeDelta,
    };
    pose = companion.motion.update(dt, motionInput);
    if (performancePose.gesture) {
      companion.motion.play(performancePose.gesture, { elapsed: performancePose.phaseAge });
      pose = companion.motion.update(0, { ...motionInput, elapsed: 0 });
    }
    if (!paused) heading = advancePipHeading(heading, aim.yaw, dt);
    group.rotation.y = heading;
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
      if (catchlights[i]) {
        catchlights[i].position.copy(catchlightOrigins[i]);
        catchlights[i].position.x += pose.gaze[0] * 0.018;
        catchlights[i].position.y += pose.gaze[1] * 0.012;
      }
    });
    fade = paused ? 1 : Math.min(1, fade + dt * 2);
    body.scale.setScalar(0.46 * fade);
    shadow.position.set(position.x, position.y + 0.016, position.z);
    shadow.scale.setScalar(0.9 + bob * 2);
    shadowMaterial.uniforms.strength.value = (companion.theme === "evening" ? 0.35 : 0.22) * fade;
    eyes.color.setRGB(...(companionLights[companion.theme] || companionLights.noon).accent);
    eyes.emissive.copy(eyes.color);
    projected.copy(group.position).project(camera);
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
      flight: {
        phase: flightPose?.phase || "rest",
        bank,
        velocity: flightPose?.velocity || [0, 0, 0],
        progress: route ? Math.min(1, (now - routeStart) / route.duration) : 1,
      },
      attention: { phase: performancePose.phase, greetings: performancePose.greetings, cooldown: performancePose.cooldown, target: taskObject },
      aim: {
        heading,
        target: aimTarget.toArray(),
        origin: opticalOrigin.toArray(),
        yaw: aim?.yaw,
        pitch: aim?.pitch,
        taskSource:
          taskObject === "visitor-ready"
            ? "visitor-plane"
            : taskObject === "record"
              ? "live-record"
              : taskObject === "Sirui" && humanHead
                ? "live-head"
                : "room-anchor",
      },
      input: { kind: inputKind, touchInvitation: Boolean(touchInvitation.sample(now)), touchPending: touchInvitation.pending() },
      gaze: pose.gaze,
      eyes: pose.eyes,
      arms: pose.arms,
      activeSeconds: now,
      projected: companion.projected,
      opticalCatchlights: catchlights.filter(Boolean).length,
    }),
    dispose() {
      ownerEvents?.removeEventListener("pip:change", releaseOwnership);
      for (const [type, handler] of touchEvents) container.removeEventListener?.(type, handler, { capture: true });
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
