import * as THREE from "../three.module.min.js";
import { mergeGeometries } from "../vendor/three-r164/utils/BufferGeometryUtils.js";
import { surfaceNoise } from "./realism.mjs";
import { createSeaReflection } from "./reflection.mjs";
import { createWildlife } from "./wildlife.mjs";
import { beachPoint } from "./shore.mjs";
import { OCEAN_WAVES, oceanFieldGLSL, sampleOcean } from "./ocean-spectrum.mjs";
import { createWindParticles } from "./wind-particles.mjs";

// Geometry, light, and a procedural sky. No photograph or illustration is
// placed behind the home. Blender supplies the connected coastal headlands.
export function createPacific(scene, renderer, config) {
  const root = new THREE.Group();
  root.name = "Pacific environment";
  scene.add(root);
  const beach = config.beach;
  const wildlife = createWildlife(root, config);
  const shoreData = new Float32Array(beach.samples.flatMap((row) => [row[3], row[1], row[2], 1]));
  const shoreTexture = new THREE.DataTexture(shoreData, beach.samples.length, 1, THREE.RGBAFormat, THREE.FloatType);
  shoreTexture.minFilter = shoreTexture.magFilter = THREE.LinearFilter;
  shoreTexture.needsUpdate = true;
  const time = { value: 0 },
    ink = { value: 0 };
  let style = "realistic",
    palette = "afternoon",
    skyKey = "",
    environment;
  const physicalWater = new THREE.MeshPhysicalMaterial({
    color: 0x185462,
    roughness: 0.14,
    metalness: 0,
    ior: 1.333,
    envMapIntensity: 1,
  });
  physicalWater.onBeforeCompile = (shader) => {
    shader.uniforms.pacificTime = time;
    shader.uniforms.shoreProfile = { value: shoreTexture };
    shader.uniforms.shoreRange = { value: new THREE.Vector2(beach.samples[0][0], beach.samples.at(-1)[0] - beach.samples[0][0]) };
    shader.vertexShader = `uniform float pacificTime; varying vec2 oceanXZ;\n${oceanFieldGLSL}\n` + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace(
      "#include <beginnormal_vertex>",
      `
      vec3 oceanDisplacement, oceanTx, oceanTz; float vertexVariance;
      // Geometry carries the resolvable swells; the pixel stage carries the
      // shorter ripples, avoiding undersampled high-frequency vertices.
      oceanField(position.xz,pacificTime,1.1,oceanDisplacement,oceanTx,oceanTz,vertexVariance);
      vec3 objectNormal = normalize(cross(oceanTz,oceanTx));
    `
    );
    shader.vertexShader = shader.vertexShader.replace(
      "#include <begin_vertex>",
      `
      vec3 transformed = position + oceanDisplacement;
      oceanXZ = position.xz;
    `
    );
    shader.fragmentShader =
      `uniform float pacificTime; uniform sampler2D shoreProfile; uniform vec2 shoreRange; varying vec2 oceanXZ;\n${surfaceNoise}\n${oceanFieldGLSL}\n` +
      shader.fragmentShader;
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <roughnessmap_fragment>",
      `
      #include <roughnessmap_fragment>
      float footprint=max(length(dFdx(oceanXZ)),length(dFdy(oceanXZ)));
      vec3 fieldDisplacement, fieldTx, fieldTz; float slopeVariance;
      oceanField(oceanXZ,pacificTime,footprint,fieldDisplacement,fieldTx,fieldTz,slopeVariance);
      // Unresolved wave energy broadens the GGX lobe instead of vanishing
      // or flickering. This scalar isotropic fit is not the full ocean BRDF.
      roughnessFactor=clamp(pow(pow(roughnessFactor,4.)+slopeVariance,.25),.14,.65);
    `
    );
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <normal_fragment_maps>",
      `
      #include <normal_fragment_maps>
      vec3 waveNormal=normalize(cross(fieldTz,fieldTx));
      float slopeX=-waveNormal.x/max(.1,waveNormal.y);
      float slopeZ=-waveNormal.z/max(.1,waveNormal.y);
      normal=normalize(mat3(viewMatrix)*waveNormal);
    `
    );
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <opaque_fragment>",
      `
      float x = oceanXZ.x;
      float waterline = texture2D(shoreProfile,vec2(clamp((x-shoreRange.x)/shoreRange.y,0.,1.),.5)).r;
      float distanceToBeach = 28.-oceanXZ.y-waterline;
      float shoal = (1.-smoothstep(.5,7.,distanceToBeach)) * smoothstep(-.4,.4,distanceToBeach);
      // Compression of the horizontal displacement Jacobian selects crests.
      // Foam is an authored shoreline model; there is no breaking-fluid solver.
      float jacobian=fieldTx.x*fieldTz.z-fieldTx.z*fieldTz.x;
      float compression=1.-smoothstep(.84,.985,jacobian);
      float crest=smoothstep(.035,.22,fieldDisplacement.y);
      float lace = stoneNoise(vec3(oceanXZ*3.8,pacificTime*.16));
      float foam = smoothstep(.11,.52,shoal*(crest*.4+compression*.6))*smoothstep(.25,.66,lace);
      float waterDepth=max(.05,distanceToBeach*.18);
      vec3 transmission=exp(-vec3(.45,.12,.08)*waterDepth);
      outgoingLight=mix(outgoingLight,outgoingLight+vec3(.10,.21,.16)*transmission,shoal*.35);
      outgoingLight=mix(outgoingLight,vec3(.63,.70,.68),foam*.83);
      #include <opaque_fragment>
    `
    );
  };
  physicalWater.customProgramCacheKey = () => "pacific-spectrum-v2";
  const modelWater = new THREE.MeshStandardMaterial({ color: 0x8db9bb, roughness: 0.95 });
  const printWater = new THREE.MeshToonMaterial({ color: 0x287b8a });
  const waterGeometry = new THREE.PlaneGeometry(400, 400, 160, 160);
  waterGeometry.rotateX(-Math.PI / 2);
  // Concentrate vertices near the inhabited coast without growing a uniform
  // high-resolution grid over all 400 meters of the distant sea.
  const waterPositions = waterGeometry.getAttribute("position");
  for (let i = 0; i < waterPositions.count; i++) {
    for (const axis of ["X", "Z"]) {
      const value = waterPositions[`get${axis}`](i) / 200;
      waterPositions[`set${axis}`](i, Math.sign(value) * value * value * 200);
    }
  }
  waterGeometry.computeBoundingSphere();
  const ocean = new THREE.Mesh(waterGeometry, modelWater);
  ocean.position.set(0, -7.35, -28);
  ocean.receiveShadow = true;
  // The normal-depth override does not run this material's wave displacement.
  // Its flat mesh would create false animal contacts up to 26 cm away from
  // the sampled beauty surface. Keep the real sea in beauty/reflections and
  // arrival rays; exclude it only from local indirect-contact reconstruction.
  ocean.userData.noContactOcclusion = true;
  root.add(ocean);
  const reflection = createSeaReflection(renderer, scene, ocean, physicalWater);
  const particleSystems = [];
  function particles(kind, emitters, bounds, warmSeconds, size, maxSize, glow, color, falloff) {
    const started = performance.now(),
      population = createWindParticles({ kind, emitters: new Float32Array(emitters), bounds, timeOffset: -warmSeconds }),
      geometry = new THREE.BufferGeometry();
    // Deterministic active-time prewarm supplies a mature still composition,
    // including reduced motion. The history ends at scene time zero.
    for (let i = 0; i < Math.round(warmSeconds * 60); i++) population.advance(1 / 60);
    geometry.setAttribute("position", new THREE.BufferAttribute(population.positions, 3).setUsage(THREE.DynamicDrawUsage));
    geometry.setAttribute("particleOpacity", new THREE.BufferAttribute(population.opacity, 1).setUsage(THREE.DynamicDrawUsage));
    const material = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      vertexShader: `attribute float particleOpacity; varying float alpha;
        void main(){ vec4 eye=modelViewMatrix*vec4(position,1.);gl_Position=projectionMatrix*eye;
        gl_PointSize=clamp(${size.toFixed(1)}/-eye.z,1.,${maxSize.toFixed(1)});alpha=particleOpacity*${glow.toFixed(3)}; }`,
      fragmentShader: `varying float alpha;void main(){vec2 p=gl_PointCoord-.5;
        gl_FragColor=vec4(vec3(${color.join(",")}),exp(-dot(p,p)*${falloff.toFixed(1)})*alpha);}`,
    });
    const object = new THREE.Points(geometry, material);
    // Bounds are fixed emitter volumes; their particles cannot leave them.
    const box = new THREE.Box3(new THREE.Vector3(...bounds.min), new THREE.Vector3(...bounds.max));
    geometry.boundingSphere = box.getBoundingSphere(new THREE.Sphere());
    root.add(object);
    particleSystems.push({ population, geometry, material, prewarmMilliseconds: performance.now() - started });
    return object;
  }
  const steam = particles(
    "steam",
    Array.from({ length: 18 }, (_, i) => {
      const angle = i * 2.399,
        radius = 0.63 + (i % 3) * 0.055;
      return [3.17 + Math.cos(angle) * radius, 3.03, 3.18 + Math.sin(angle) * radius];
    }).flat(),
    { min: [2.3, 3.02, 2.31], max: [4.03, 3.97, 4.05] },
    9,
    145,
    55,
    0.045,
    [0.78, 0.85, 0.83],
    17
  );
  steam.name = "Warm onsen vapor";
  steam.visible = false;

  // Advected surf droplets and sunlit dust: bounded particle lifetimes, not
  // an image overlay. The same clock pauses with the inhabited world.
  const mistPositions = [];
  for (let i = 0; i < 140; i++) {
    const x = -22 + ((i * 3.719) % 67),
      p = beachPoint(x, 0.47, beach);
    mistPositions.push(x, -7.3, p[2] - 1.4);
  }
  const spray = particles("spray", mistPositions, { min: [-23, -7.34, -100], max: [46, -6.8, 20] }, 1, 36, 7, 0.17, [0.86, 0.91, 0.85], 15);
  spray.name = "Breaking-wave spray";
  const dust = particles(
    "dust",
    Array.from({ length: 42 }, (_, i) => [-1.2 + ((i * 0.719) % 2.4), 3 + ((i * 0.31) % 2.2), 2.4 + ((i * 0.437) % 2)]).flat(),
    { min: [-1.45, 2.85, 2.25], max: [1.45, 5.35, 4.55] },
    18,
    6,
    3,
    0.25,
    [1.0, 0.86, 0.62],
    20
  );
  dust.name = "Dust in the study light";

  // The modeled sky also supplies a physically useful environment reflection.
  const skyMaterial = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {
      zenith: { value: new THREE.Color(0x6c9fc4) },
      horizon: { value: new THREE.Color(0xdde0d7) },
      sunDirection: { value: new THREE.Vector3(-14, 18, -22).normalize() },
      night: { value: 0 },
      sunRadiance: { value: 5 },
      printMode: ink,
    },
    vertexShader:
      "varying vec3 direction; void main(){ direction = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }",
    fragmentShader: `${surfaceNoise}
      uniform vec3 zenith; uniform vec3 horizon; uniform vec3 sunDirection; uniform float night; uniform float sunRadiance; varying vec3 direction;
      void main(){
        vec3 d = normalize(direction);
        float height = pow(max(0.0,d.y),.45);
        vec3 color = mix(horizon,zenith,height);
        float alignment = max(0.0,dot(d,sunDirection));
        color += vec3(1.0,.83,.58) * pow(alignment,28.0) * .2 * (1.-night);
        color += vec3(1.0,.88,.69) * pow(alignment,2200.0) * sunRadiance;
        vec3 cloudPoint = vec3(d.xz / max(.14,d.y+.18) * 2.4, .4);
        float clouds = smoothstep(.56,.75,stoneNoise(cloudPoint)) * smoothstep(-.02,.16,d.y);
        color = mix(color, horizon*1.08, clouds*.36*(1.-night));
        float stars = pow(hash31(floor(d*780.0)),280.0)*smoothstep(.1,.8,d.y)*night;
        color += stars*vec3(.35,.44,.55);
        gl_FragColor = vec4(color,1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(120, 40, 24), skyMaterial);
  sky.renderOrder = -10;
  root.add(sky);

  // Physical ribbons distinguish a quiet model sea from drawn comic surf.
  const caps = new THREE.Group();
  root.add(caps);
  const capMaterial = new THREE.MeshBasicMaterial({ color: 0xe5eeee, transparent: true, opacity: 0.58 });
  const capGeometries = [];
  for (let i = 0; i < 42; i++) {
    const x = ((i * 5.47) % 46) - 23,
      z = -4 - ((i * 3.73) % 42);
    const points = Array.from(
      { length: 7 },
      (_, j) => new THREE.Vector3(x + j * 0.34, -7.31 + Math.sin(j * 0.52 + i) * 0.014, z + Math.sin(j * 0.6 + i) * 0.13)
    );
    capGeometries.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), 12, 0.018, 3, false));
  }
  caps.add(new THREE.Mesh(mergeGeometries(capGeometries), capMaterial));
  capGeometries.forEach((g) => g.dispose());
  const printSun = new THREE.Mesh(new THREE.SphereGeometry(2.0, 24, 12), new THREE.MeshBasicMaterial({ color: 0xf08a49 }));
  printSun.position.set(-12, 9, -48);
  root.add(printSun);
  function makeEnvironment() {
    if (environment) environment.dispose();
    const capture = new THREE.Scene();
    capture.add(sky.clone());
    const pmrem = new THREE.PMREMGenerator(renderer);
    environment = pmrem.fromScene(capture, 0.04, 0.1, 180);
    pmrem.dispose();
    scene.environment = environment.texture;
  }
  function setPalette(next, light) {
    // PMREM captures are static across a 20-minute light interval; animation
    // never rebuilds them. The visible sun still follows the current minute.
    if (light) skyMaterial.uniforms.sunDirection.value.fromArray(light.keyDirection).normalize();
    const key = `${next}:${light ? Math.floor(light.minute / 20) : "authored"}`;
    if (skyKey === key && environment) return;
    skyKey = key;
    palette = next;
    const night = light ? light.daylight < 0.15 : next === "evening";
    skyMaterial.uniforms.zenith.value.set(night ? 0x112441 : next === "morning" ? 0x8bb3c8 : 0x4b92bd);
    skyMaterial.uniforms.horizon.value.set(night ? 0x435771 : next === "afternoon" ? 0xbfcfce : 0xd9e5e7);
    skyMaterial.uniforms.night.value = light ? 1 - light.daylight : night ? 1 : 0;
    skyMaterial.uniforms.sunRadiance.value = light ? 0.2 + light.sunlight * 4.8 : night ? 0.2 : 5;
    if (!light) skyMaterial.uniforms.sunDirection.value.set(next === "afternoon" ? -14 : 10, night ? 16 : 18, -22).normalize();
    physicalWater.color.set(night ? 0x122a3c : 0x185462);
    modelWater.color.set(night ? 0x526d86 : 0x8db9bb);
    printWater.color.set(night ? 0x273e66 : 0x267787);
    if (style === "realistic") {
      makeEnvironment();
      scene.fog.color.copy(skyMaterial.uniforms.horizon.value);
    }
  }
  function setStyle(next) {
    style = next;
    ocean.material = style === "realistic" ? physicalWater : style === "illustrated" ? printWater : modelWater;
    sky.visible = style === "realistic";
    caps.visible = style !== "realistic";
    caps.scale.y = 1;
    capMaterial.color.set(style === "illustrated" ? 0xf4e2b3 : 0xe5eeee);
    capMaterial.opacity = style === "illustrated" ? 0.9 : 0.42;
    caps.children.forEach((o) => (o.scale.z = style === "illustrated" ? 1.35 : 1));
    spray.visible = style === "realistic";
    dust.visible = style === "realistic";
    printSun.visible = style === "illustrated";
    scene.environment = style === "realistic" ? environment?.texture || null : null;
    // Keep near-shore surface contrast at the authored 24–72 m exterior
    // distance. This bounded haze is a clear-day art direction, not weather.
    scene.fog = style === "realistic" ? new THREE.Fog(skyMaterial.uniforms.horizon.value, 65, 180) : null;
    // The first palette update builds the sky environment for the actual hour.
    // Building a default environment here compiled and captured the sky twice.
  }
  function update(elapsed, delta = 0) {
    time.value = elapsed;
    for (const { population, geometry } of particleSystems) {
      if (population.advance(delta, { fieldTime: elapsed })) {
        geometry.getAttribute("position").needsUpdate = true;
        geometry.getAttribute("particleOpacity").needsUpdate = true;
      }
    }
    caps.position.x = Math.sin(elapsed * 0.18) * 0.16;
    wildlife.update(elapsed, palette);
  }
  function dispose() {
    shoreTexture.dispose();
    wildlife.dispose();
    reflection.dispose();
    root.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
    });
    [physicalWater, modelWater, printWater, skyMaterial, capMaterial, printSun.material].forEach((m) => m.dispose());
    environment?.dispose();
    particleSystems.forEach(({ material }) => material.dispose());
    root.removeFromParent();
  }
  setStyle(style);
  return {
    setStyle,
    setPalette,
    update,
    dispose,
    pick: (raycaster) => wildlife.pick?.(raycaster) || null,
    neighbours: () => wildlife.targets?.() || [],
    neighbour: (id) => wildlife.target?.(id) || null,
    evidence: () => ({
      wildlife: wildlife.evidence(),
      beachWidth: beach.width,
      particles: 140 + 42 + 18,
      particleMotion: particleSystems.map(({ population, prewarmMilliseconds }) => ({ ...population.evidence(), prewarmMilliseconds })),
      water: {
        waves: OCEAN_WAVES.length,
        vertices: waterPositions.count,
        triangles: waterGeometry.index.count / 3,
        seconds: time.value,
        sample: sampleOcean(0, 0, time.value, 0.02),
        reflection: reflection.evidence(),
      },
    }),
    reflect: reflection.update,
    setActivity(activity) {
      steam.visible = style === "realistic" && activity === "soak";
    },
  };
}
