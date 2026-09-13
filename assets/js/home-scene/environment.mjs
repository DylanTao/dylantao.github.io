import * as THREE from "../three.module.min.js";
import { mergeGeometries } from "../vendor/three-r164/utils/BufferGeometryUtils.js";

// Geometry, light, and a procedural sky. No photograph or illustration is
// placed behind the home. Blender supplies the connected coastal headlands.
export function createPacific(scene, renderer) {
  const root = new THREE.Group();
  root.name = "Pacific environment";
  scene.add(root);
  const time = { value: 0 },
    ink = { value: 0 };
  let style = "architectural",
    palette = "afternoon",
    environment;
  const physicalWater = new THREE.MeshPhysicalMaterial({
    color: 0x216e7b,
    roughness: 0.18,
    metalness: 0.25,
    clearcoat: 1,
    clearcoatRoughness: 0.12,
    envMapIntensity: 1.3,
  });
  physicalWater.onBeforeCompile = (shader) => {
    shader.uniforms.pacificTime = time;
    shader.vertexShader = "uniform float pacificTime; varying vec2 oceanXZ;\n" + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace(
      "#include <beginnormal_vertex>",
      `
      float a = position.x * 0.8 + position.z * 0.48 - pacificTime * 0.8;
      float b = position.x * 1.8 - position.z * 1.4 + pacificTime * 1.15;
      vec3 objectNormal = normalize(vec3(-0.07 * 0.8 * cos(a) - 0.028 * 1.8 * cos(b), 1.0, -0.07 * 0.48 * cos(a) + 0.028 * 1.4 * cos(b)));
    `
    );
    shader.vertexShader = shader.vertexShader.replace(
      "#include <begin_vertex>",
      `
      vec3 transformed = position;
      oceanXZ = position.xz;
      float crest = 0.07 * sin(a) + 0.028 * sin(b);
      transformed.y += crest;
    `
    );
    shader.fragmentShader = "uniform float pacificTime; varying vec2 oceanXZ;\n" + shader.fragmentShader;
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <normal_fragment_maps>",
      `
      #include <normal_fragment_maps>
      // Analytic small ripples catch the sky at pixel scale, independent of
      // the lower-resolution mesh used for the broad moving swells.
      float swellA = oceanXZ.x * 0.8 + oceanXZ.y * 0.48 - pacificTime * 0.8;
      float swellB = oceanXZ.x * 1.8 - oceanXZ.y * 1.4 + pacificTime * 1.15;
      float rippleA = oceanXZ.x * 13.0 + oceanXZ.y * 8.5 - pacificTime * 1.7;
      float rippleB = oceanXZ.x * 7.5 - oceanXZ.y * 17.0 + pacificTime * 1.3;
      float slopeX = 0.056 * cos(swellA) + 0.0504 * cos(swellB)
        + 0.032 * cos(rippleA) + 0.018 * cos(rippleB);
      float slopeZ = 0.0336 * cos(swellA) - 0.0392 * cos(swellB)
        + 0.021 * cos(rippleA) - 0.041 * cos(rippleB);
      normal = normalize(mat3(viewMatrix) * vec3(-slopeX, 1.0, -slopeZ));
    `
    );
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <opaque_fragment>",
      `
      // Thin, broken wind lines supplement reflections. A height threshold
      // on intersecting swells made large polka dots across the old sea.
      float ridge = pow(max(0.0, sin(swellA)), 32.0);
      float broken = smoothstep(0.1, 0.9, sin(oceanXZ.x * 3.7 - oceanXZ.y * 1.4)
        * sin(oceanXZ.x * 0.73 + oceanXZ.y * 2.3));
      outgoingLight = mix(outgoingLight, vec3(0.64, 0.79, 0.8), ridge * broken * 0.075);
      #include <opaque_fragment>
    `
    );
  };
  const modelWater = new THREE.MeshStandardMaterial({ color: 0x8db9bb, roughness: 0.95 });
  const printWater = new THREE.MeshToonMaterial({ color: 0x287b8a });
  const waterGeometry = new THREE.PlaneGeometry(100, 105, 120, 120);
  waterGeometry.rotateX(-Math.PI / 2);
  const ocean = new THREE.Mesh(waterGeometry, modelWater);
  ocean.position.set(0, -2.36, -28);
  ocean.receiveShadow = true;
  root.add(ocean);

  // The modeled sky also supplies a physically useful environment reflection.
  const skyMaterial = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {
      zenith: { value: new THREE.Color(0x86bac8) },
      horizon: { value: new THREE.Color(0xf4d7b3) },
      sunDirection: { value: new THREE.Vector3(-0.5, 0.3, -1).normalize() },
      printMode: ink,
    },
    vertexShader:
      "varying vec3 direction; void main(){ direction = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }",
    fragmentShader: `uniform vec3 zenith; uniform vec3 horizon; uniform vec3 sunDirection; uniform float printMode; varying vec3 direction;
      void main(){ vec3 d = normalize(direction); float height = smoothstep(-.08,.64,d.y); vec3 color = mix(horizon,zenith,height); float sun = pow(max(0.0,dot(d,sunDirection)),360.0); color += vec3(1.0,.69,.35)*sun*.9; gl_FragColor = vec4(color,1.0); }`,
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(70, 40, 24), skyMaterial);
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
      (_, j) => new THREE.Vector3(x + j * 0.34, -2.29 + Math.sin(j * 0.52 + i) * 0.014, z + Math.sin(j * 0.6 + i) * 0.13)
    );
    capGeometries.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), 12, 0.018, 3, false));
  }
  caps.add(new THREE.Mesh(mergeGeometries(capGeometries), capMaterial));
  capGeometries.forEach((g) => g.dispose());
  const printSun = new THREE.Mesh(new THREE.SphereGeometry(2.0, 24, 12), new THREE.MeshBasicMaterial({ color: 0xf08a49 }));
  printSun.position.set(-12, 9, -48);
  root.add(printSun);
  const birds = new THREE.Group();
  root.add(birds);
  const birdMaterial = new THREE.MeshBasicMaterial({ color: 0x253e4c });
  for (let i = 0; i < 5; i++) {
    const x = -5 + i * 1.1,
      y = 3 + (i % 3) * 0.38,
      z = -17 - i * 0.9;
    birds.add(
      new THREE.Mesh(
        new THREE.TubeGeometry(
          new THREE.CatmullRomCurve3([new THREE.Vector3(x - 0.3, y + 0.12, z), new THREE.Vector3(x, y, z), new THREE.Vector3(x + 0.3, y + 0.14, z)]),
          8,
          0.019,
          3,
          false
        ),
        birdMaterial
      )
    );
  }
  function makeEnvironment() {
    if (environment) environment.dispose();
    const capture = new THREE.Scene();
    capture.add(sky.clone());
    const pmrem = new THREE.PMREMGenerator(renderer);
    environment = pmrem.fromScene(capture, 0.04, 0.1, 100);
    pmrem.dispose();
    scene.environment = environment.texture;
  }
  function setPalette(next) {
    if (palette === next && environment) return;
    palette = next;
    const night = next === "evening";
    skyMaterial.uniforms.zenith.value.set(night ? 0x101d3c : next === "morning" ? 0x99c0cd : 0x76aebf);
    skyMaterial.uniforms.horizon.value.set(night ? 0x596287 : next === "afternoon" ? 0xe7bd97 : 0xdbe9e4);
    physicalWater.color.set(night ? 0x193447 : 0x216e7b);
    modelWater.color.set(night ? 0x526d86 : 0x8db9bb);
    printWater.color.set(night ? 0x273e66 : 0x267787);
    if (style === "realistic") makeEnvironment();
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
    birds.visible = style !== "architectural";
    printSun.visible = style === "illustrated";
    scene.environment = style === "realistic" ? environment?.texture || null : null;
    scene.fog = style === "realistic" ? new THREE.Fog(skyMaterial.uniforms.horizon.value, 28, 80) : null;
    if (style === "realistic" && !environment) makeEnvironment();
  }
  function update(elapsed) {
    time.value = elapsed;
    caps.position.x = Math.sin(elapsed * 0.18) * 0.16;
    birds.position.x = Math.sin(elapsed * 0.1) * 1.1;
  }
  function dispose() {
    root.traverse((o) => {
      if (o.isMesh) o.geometry.dispose();
    });
    [physicalWater, modelWater, printWater, skyMaterial, capMaterial, birdMaterial, printSun.material].forEach((m) => m.dispose());
    environment?.dispose();
    root.removeFromParent();
  }
  setStyle(style);
  return { setStyle, setPalette, update, dispose };
}
