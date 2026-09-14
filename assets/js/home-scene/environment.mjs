import * as THREE from "../three.module.min.js";
import { mergeGeometries } from "../vendor/three-r164/utils/BufferGeometryUtils.js";
import { surfaceNoise } from "./realism.mjs";
import { createSeaReflection } from "./reflection.mjs";
import { createWildlife } from "./wildlife.mjs";
import { beachPoint, beachWidth } from "./shore.mjs";

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
    environment;
  const physicalWater = new THREE.MeshPhysicalMaterial({
    color: 0x286877,
    roughness: 0.24,
    metalness: 0.12,
    clearcoat: 1,
    clearcoatRoughness: 0.12,
    envMapIntensity: 1.3,
  });
  physicalWater.onBeforeCompile = (shader) => {
    shader.uniforms.pacificTime = time;
    shader.uniforms.shoreProfile = { value: shoreTexture };
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
    shader.fragmentShader =
      `uniform float pacificTime; uniform sampler2D shoreProfile; varying vec2 oceanXZ;\n${surfaceNoise}\n` + shader.fragmentShader;
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <normal_fragment_maps>",
      `
      #include <normal_fragment_maps>
      // Analytic small ripples catch the sky at pixel scale, independent of
      // the lower-resolution mesh used for the broad moving swells.
      float swellA = oceanXZ.x * 0.8 + oceanXZ.y * 0.48 - pacificTime * 0.8;
      float swellB = oceanXZ.x * 1.8 - oceanXZ.y * 1.4 + pacificTime * 1.15;
      vec3 flow = vec3(oceanXZ * 2.0, pacificTime * .16);
      float n = stoneNoise(flow);
      float slopeX = .03*cos(swellA) + .03*cos(swellB) + (stoneNoise(flow + vec3(.13,0,0))-n)*.7;
      float slopeZ = .025*cos(swellA) - .025*cos(swellB) + (stoneNoise(flow + vec3(0,.13,0))-n)*.7;
      normal = normalize(mat3(viewMatrix) * vec3(-slopeX, 1.0, -slopeZ));
    `
    );
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <opaque_fragment>",
      `
      // Thin, broken wind lines supplement reflections. A height threshold
      // on intersecting swells made large polka dots across the old sea.
      // Same continuous shoreline section as the Blender beach (world +Y in
      // Blender becomes -Z here; ocean local coordinates are offset by 28 m).
      float x = oceanXZ.x;
      float waterline = texture2D(shoreProfile,vec2(clamp((x+36.)/112.,0.,1.),.5)).r;
      float distanceToBeach = 28.-oceanXZ.y-waterline;
      float shoal = (1.-smoothstep(.5,6.0,distanceToBeach)) * smoothstep(-.5,.35,distanceToBeach);
      float drift = stoneNoise(vec3(x*.22,distanceToBeach*.35,pacificTime*.06));
      float wash = sin(distanceToBeach*1.65 - pacificTime*.82 + drift*3.5);
      float lace = stoneNoise(vec3(oceanXZ*3.8,pacificTime*.16));
      float foam = smoothstep(.66,.99,wash) * shoal * smoothstep(.30,.67,lace);
      outgoingLight = mix(outgoingLight, outgoingLight*vec3(.9,1.35,1.25),shoal*.4);
      outgoingLight = mix(outgoingLight, vec3(.69,.76,.71), foam*.76);
      #include <opaque_fragment>
    `
    );
  };
  const modelWater = new THREE.MeshStandardMaterial({ color: 0x8db9bb, roughness: 0.95 });
  const printWater = new THREE.MeshToonMaterial({ color: 0x287b8a });
  const waterGeometry = new THREE.PlaneGeometry(400, 400, 120, 120);
  waterGeometry.rotateX(-Math.PI / 2);
  const ocean = new THREE.Mesh(waterGeometry, modelWater);
  ocean.position.set(0, -7.35, -28);
  ocean.receiveShadow = true;
  root.add(ocean);
  const reflection = createSeaReflection(renderer, scene, ocean, physicalWater);
  const steamGeometry = new THREE.BufferGeometry();
  steamGeometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(
      Array.from({ length: 18 }, (_, i) => {
        const angle = i * 2.399,
          radius = 0.63 + (i % 3) * 0.055;
        return [Math.cos(angle) * radius, (i * 0.173) % 1, Math.sin(angle) * radius];
      }).flat(),
      3
    )
  );
  const steamMaterial = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: { steamTime: time },
    vertexShader: `uniform float steamTime; varying float veil;
      void main(){ float rise=fract(position.y+steamTime*.085); vec3 p=position;
        p.y=rise*.75; p.x+=sin(rise*5.0+position.z*3.0)*.06;
        vec4 eye=modelViewMatrix*vec4(p,1.0); gl_Position=projectionMatrix*eye;
        gl_PointSize=clamp(145.0/-eye.z,2.0,55.0); veil=sin(rise*3.14159)*.045; }`,
    fragmentShader: `varying float veil;
      void main(){ float falloff=exp(-dot(gl_PointCoord-.5,gl_PointCoord-.5)*17.0);
        gl_FragColor=vec4(.78,.85,.83,falloff*veil); }`,
  });
  const steam = new THREE.Points(steamGeometry, steamMaterial);
  steam.name = "Warm onsen vapor";
  steam.position.set(3.17, 3.03, 3.18);
  steam.visible = false;
  root.add(steam);

  // Advected surf droplets and sunlit dust: bounded particle lifetimes, not
  // an image overlay. The same clock pauses with the inhabited world.
  const mistPositions = [];
  for (let i = 0; i < 140; i++) {
    const x = -22 + ((i * 3.719) % 67),
      p = beachPoint(x, 0.47, beach);
    mistPositions.push(x, p[2], (i * 0.618) % 1, beachWidth(x, beach));
  }
  const sprayGeometry = new THREE.BufferGeometry();
  sprayGeometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(
      mistPositions.flatMap((_, i, a) => (i % 4 === 0 ? [a[i], a[i + 1], a[i + 2]] : [])),
      3
    )
  );
  const sprayMaterial = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: { age: time },
    vertexShader: `uniform float age;varying float alpha;
    void main(){float life=fract(position.z+age*.09);vec3 p=vec3(position.x+sin(life*5.+position.x)*.35,-7.30+sin(life*3.14159)*.23,position.y-1.4+life*2.2);
    vec4 v=modelViewMatrix*vec4(p,1.);gl_Position=projectionMatrix*v;gl_PointSize=clamp(36./-v.z,1.,7.);alpha=sin(life*3.14159)*.17;}`,
    fragmentShader: "varying float alpha;void main(){vec2 p=gl_PointCoord-.5;gl_FragColor=vec4(.86,.91,.85,exp(-dot(p,p)*15.)*alpha);}",
  });
  const spray = new THREE.Points(sprayGeometry, sprayMaterial);
  spray.name = "Breaking-wave spray";
  root.add(spray);
  const dustGeometry = new THREE.BufferGeometry();
  dustGeometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(
      Array.from({ length: 42 }, (_, i) => [-1.2 + ((i * 0.719) % 2.4), 3 + ((i * 0.31) % 2.2), 2.4 + ((i * 0.437) % 2)]).flat(),
      3
    )
  );
  const dustMaterial = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: { age: time, glow: { value: 0.25 } },
    vertexShader: `uniform float age,glow;varying float alpha;void main(){vec3 p=position;
    p.y+=sin(age*.23+p.x*2.)*.06;p.x+=sin(age*.17+p.z)*.04;p.z+=cos(age*.21+p.y)*.035;
    vec4 v=modelViewMatrix*vec4(p,1.);gl_Position=projectionMatrix*v;gl_PointSize=clamp(6./-v.z,1.,3.);alpha=(.5+.5*sin(age*.5+p.x*7.))*glow;}`,
    fragmentShader: "varying float alpha;void main(){gl_FragColor=vec4(1.,.86,.62,exp(-dot(gl_PointCoord-.5,gl_PointCoord-.5)*20.)*alpha);}",
  });
  const dust = new THREE.Points(dustGeometry, dustMaterial);
  dust.name = "Dust in the study light";
  root.add(dust);

  // The modeled sky also supplies a physically useful environment reflection.
  const skyMaterial = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {
      zenith: { value: new THREE.Color(0x6c9fc4) },
      horizon: { value: new THREE.Color(0xdde0d7) },
      sunDirection: { value: new THREE.Vector3(-14, 18, -22).normalize() },
      night: { value: 0 },
      printMode: ink,
    },
    vertexShader:
      "varying vec3 direction; void main(){ direction = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }",
    fragmentShader: `${surfaceNoise}
      uniform vec3 zenith; uniform vec3 horizon; uniform vec3 sunDirection; uniform float night; varying vec3 direction;
      void main(){
        vec3 d = normalize(direction);
        float height = pow(max(0.0,d.y),.45);
        vec3 color = mix(horizon,zenith,height);
        float alignment = max(0.0,dot(d,sunDirection));
        color += vec3(1.0,.83,.58) * pow(alignment,28.0) * .2 * (1.-night);
        color += vec3(1.0,.88,.69) * pow(alignment,2200.0) * 5.0;
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
  function setPalette(next) {
    if (palette === next && environment) return;
    palette = next;
    const night = next === "evening";
    skyMaterial.uniforms.zenith.value.set(night ? 0x112441 : next === "morning" ? 0x8bb3c8 : 0x4b92bd);
    skyMaterial.uniforms.horizon.value.set(night ? 0x435771 : next === "afternoon" ? 0xbfcfce : 0xd9e5e7);
    skyMaterial.uniforms.night.value = night ? 1 : 0;
    skyMaterial.uniforms.sunDirection.value.set(next === "afternoon" ? -14 : 10, night ? 16 : 18, -22).normalize();
    physicalWater.color.set(night ? 0x193447 : 0x216e7b);
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
    scene.fog = style === "realistic" ? new THREE.Fog(skyMaterial.uniforms.horizon.value, 38, 110) : null;
    // The first palette update builds the sky environment for the actual hour.
    // Building a default environment here compiled and captured the sky twice.
  }
  function update(elapsed) {
    time.value = elapsed;
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
    steamMaterial.dispose();
    sprayMaterial.dispose();
    dustMaterial.dispose();
    root.removeFromParent();
  }
  setStyle(style);
  return {
    setStyle,
    setPalette,
    update,
    dispose,
    evidence: () => ({ wildlife: wildlife.evidence(), beachWidth: beach.width, particles: 140 + 42 + 18 }),
    reflect: reflection.update,
    setActivity(activity) {
      steam.visible = style === "realistic" && activity === "soak";
    },
  };
}
