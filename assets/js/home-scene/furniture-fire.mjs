import * as THREE from "../three.module.min.js";
import { createHearthField, HEARTH_GRID, HEARTH_STEP } from "./hearth-combustion.mjs";
import { createBurningWood } from "./hearth-wood.mjs";

const modes = { realistic: 0, watercolour: 1, print: 2, toon: 3, paint: 4 };
const activeHearths = new Set();

export function drawHearths(renderer, scene, camera, depth, width, height) {
  for (const hearth of activeHearths) {
    let owner = hearth;
    while (owner && owner !== scene && owner.visible) owner = owner.parent;
    if (owner === scene) hearth.userData.drawHearth(renderer, camera, depth, width, height);
  }
}
const vertexShader = /* glsl */ `
  out vec3 boxPosition;
  void main(){
    boxPosition = position;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.);
  }`;
const fragmentShader = /* glsl */ `
  precision highp sampler3D;
  uniform sampler3D heatField;
  uniform vec3 eyeInBox;
  uniform int art;
  uniform float phase;
  uniform mat4 toClip;
  uniform sampler2D sceneDepth;
  uniform vec2 imageSize;
  uniform bool overprint, parallelView;
  uniform vec3 eyeDirection;
  in vec3 boxPosition;
  out vec4 colour;
  void main() {
    if(art != 0 && !overprint) discard;
    vec3 ray = parallelView ? eyeDirection : normalize(boxPosition - eyeInBox);
    vec3 origin = parallelView ? boxPosition-ray*3.0 : eyeInBox;
    vec3 inv = sign(ray + vec3(1e-8))/max(abs(ray),vec3(1e-6));
    vec3 lo = (vec3(-.5)-origin)*inv, hi=(vec3(.5)-origin)*inv;
    vec3 nearT = min(lo,hi), farT = max(lo,hi);
    float enter = max(max(nearT.x,nearT.y),max(nearT.z,0.));
    float leave = min(min(farT.x,farT.y),farT.z);
    if(leave<=enter) discard;
    float dt = (leave-enter)/30.;
    float density=0., peak=0., first=leave;
    vec3 hotAt=vec3(0.);
    for (int i=0;i<30;i++) {
      float t=enter+(float(i)+.5)*dt;
      vec3 p=origin+t*ray+vec3(.5);
      float heat=texture(heatField,p).r;
      float body=smoothstep(.027,.31,heat);
      density+=body*dt*1.9;
      if (heat>.058 && first==leave) first=t;
      if(heat>peak) { peak=heat; hotAt=p; }
    }
    if (first==leave || density<.004) discard;
    vec3 rgb;
    float alpha;
    if(art==0) {
      // Thin edges transmit the dark steel behind them. The denser interior
      // tends towards a hot straw colour and leaves some red in the coals.
      float core = smoothstep(.15,.68,peak+.28*density);
      rgb=mix(vec3(2.9,.23,.012),vec3(5.9,3.25,.66),core);
      rgb=mix(rgb,vec3(6.3,4.85,2.45),smoothstep(.57,.88,peak));
      alpha=1.-exp(-density*(2.5+core*3.3));
    } else if(art==1) {
      // A cut of untouched paper within two transparent washes. The thin
      // edge left by receding wet pigment moves with the plume.
      float tide=smoothstep(.046,.10,peak)*(1.-smoothstep(.10,.16,peak));
      float paper=smoothstep(.18,.40,peak+density*.17);
      rgb=mix(vec3(2.,.12,.018),vec3(5.4,2.1,.19),smoothstep(.06,.25,peak));
      rgb=mix(rgb,vec3(8.,6.0,3.45),paper);
      alpha=clamp(.24*tide+.77*smoothstep(.06,.27,peak)+.36*paper,0.,1.);
    } else if(art==2) {
      // Two nested relief cuts and chatter on the edge of the narrow cut.
      float score=sin(hotAt.y*63.+hotAt.x*13.);
      if(peak<.13+.022*score || (peak>.19 && peak<.235)) discard;
      rgb=peak>.34 ? vec3(4.9,3.7,1.8) : vec3(1.45,.29,.07);
      alpha=.98;
    } else if(art==3) {
      // A two-colour cel held on twos. The outer silhouette folds first.
      if(peak<.10) discard;
      rgb=peak>.29 ? vec3(4.5,2.55,.55) : vec3(2.4,.37,.035);
      alpha=.97;
    } else {
      // Opaque, interrupted bristle strokes swept in the direction of lift.
      float bristle=sin(hotAt.x*133.+hotAt.z*43.+2.*sin(hotAt.y*10.+phase*.46));
      if(peak<.073+.024*bristle) discard;
      rgb=mix(vec3(1.75,.18,.036),vec3(4.15,2.7,.73),
        smoothstep(.11,.47,peak+.038*bristle));
      alpha=clamp(.73+.26*bristle+.14*peak,0.,1.);
    }
    vec4 depth=toClip*vec4(origin+first*ray,1.);
    gl_FragDepth=.5+.5*depth.z/depth.w;
    if(overprint) {
      if(gl_FragDepth > texture(sceneDepth,gl_FragCoord.xy/imageSize).r + .000001) discard;
      if(art==1) rgb=mix(vec3(.85,.24,.052),vec3(.999,.959,.83),smoothstep(.13,.35,peak));
      else if(art==2) rgb=peak>.34 ? vec3(.995,.89,.66) : vec3(.79,.38,.14);
      else if(art==3) rgb=peak>.29 ? vec3(1.,.90,.48) : vec3(.97,.47,.12);
      else rgb=mix(vec3(.86,.28,.095),vec3(.999,.85,.53),smoothstep(.11,.48,peak));
    }
    colour=vec4(rgb,alpha);
  }`;

export function createFurnitureFire(parent, { name = "Living hearth", breeze = 0 } = {}) {
  const field = createHearthField(breeze),
    still = field.image.slice();
  const texture = new THREE.Data3DTexture(field.image, ...HEARTH_GRID);
  texture.format = THREE.RedFormat;
  texture.minFilter = texture.magFilter = THREE.LinearFilter;
  texture.unpackAlignment = 1;
  texture.needsUpdate = true;
  const uniforms = {
    heatField: { value: texture },
    eyeInBox: { value: new THREE.Vector3() },
    art: { value: 0 },
    phase: { value: 0 },
    toClip: { value: new THREE.Matrix4() },
    sceneDepth: { value: null },
    imageSize: { value: new THREE.Vector2() },
    overprint: { value: false },
    parallelView: { value: false },
    eyeDirection: { value: new THREE.Vector3() },
  };
  const material = new THREE.ShaderMaterial({
    name: "Hearth · rising heat",
    glslVersion: THREE.GLSL3,
    vertexShader,
    fragmentShader,
    uniforms,
    transparent: true,
    depthWrite: false,
    side: THREE.BackSide,
    toneMapped: false,
  });
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), material);
  mesh.name = name + " · flame volume";
  mesh.position.set(0, 0.971, 0);
  mesh.scale.set(0.47, 0.312, 0.42);
  Object.assign(mesh.userData, { dynamic: true, fixedMaterial: true, noOcclusion: true, noContactOcclusion: true, noVolumeDepth: true });
  mesh.renderOrder = 1;
  const invWorld = new THREE.Matrix4();
  mesh.onBeforeRender = (_renderer, _scene, camera) => {
    mesh.worldToLocal(camera.getWorldPosition(uniforms.eyeInBox.value));
    uniforms.parallelView.value = Boolean(camera.isOrthographicCamera);
    if (camera.isOrthographicCamera)
      camera.getWorldDirection(uniforms.eyeDirection.value).transformDirection(invWorld.copy(mesh.matrixWorld).invert());
    uniforms.toClip.value.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse).multiply(mesh.matrixWorld);
  };
  // A drawn flame goes on the sheet after the coats of pigment or hatching.
  // The resolved, opaque scene depth still allows wood and steel to mask it.
  const inkScene = new THREE.Scene();
  const mark = new THREE.Mesh(mesh.geometry, material);
  mark.matrixAutoUpdate = false;
  mark.onBeforeRender = mesh.onBeforeRender;
  inkScene.add(mark);
  mesh.userData.drawHearth = (renderer, camera, depth, width, height) => {
    for (let p = mesh; p; p = p.parent) if (!p.visible) return;
    if (!depth || uniforms.art.value === 0) return;
    mesh.updateWorldMatrix(true, false);
    mark.matrix.copy(mesh.matrixWorld);
    mark.matrixWorldNeedsUpdate = true;
    uniforms.overprint.value = true;
    uniforms.imageSize.value.set(width, height);
    uniforms.sceneDepth.value = depth;
    const clear = renderer.autoClear;
    try {
      renderer.autoClear = false;
      material.depthTest = false;
      renderer.render(inkScene, camera);
    } finally {
      renderer.autoClear = clear;
      material.depthTest = true;
      uniforms.overprint.value = false;
      uniforms.sceneDepth.value = null;
    }
  };
  parent.add(mesh);
  activeHearths.add(mesh);
  const wood = createBurningWood(parent);
  const composed = { fuel: [0.91, 0.76, 0.98], char: [0.33, 0.51, 0.24] };
  wood.update(composed, 0);
  let last = null,
    bank = 0,
    clock = 0,
    steps = 0,
    uploads = 1,
    stillShown = false;
  return {
    update(seconds, { reduced = false, visible = true, look = "realistic" } = {}) {
      uniforms.art.value = modes[look] ?? 0;
      const elapsed = last === null ? 0 : Math.max(0, Math.min(seconds - last, 0.125));
      last = seconds;
      if (!visible) return;
      if (reduced !== stillShown) {
        texture.image.data = reduced ? still : field.image;
        texture.needsUpdate = true;
        uploads++;
        stillShown = reduced;
      }
      if (reduced) {
        uniforms.phase.value = 0;
        wood.update(composed, 0);
        return;
      }
      bank += elapsed;
      let changed = false;
      while (bank >= HEARTH_STEP) {
        bank -= HEARTH_STEP;
        field.step();
        steps++;
        clock += HEARTH_STEP;
        // The cel painter exposes each alternate drawing at twelve a second.
        if (look !== "toon" || steps % 2 === 0) changed = true;
      }
      if (changed) {
        uniforms.phase.value = clock;
        texture.needsUpdate = true;
        uploads++;
        wood.update(field, clock);
      }
    },
    evidence: () => ({
      clock: stillShown ? 0 : clock,
      triangles: 12,
      still: stillShown,
      grid: HEARTH_GRID,
      steps,
      uploads,
      look: Object.keys(modes).find((key) => modes[key] === uniforms.art.value),
      fuel: [...field.fuel],
      char: [...field.char],
    }),
    dispose() {
      activeHearths.delete(mesh);
      wood.dispose();
      mesh.removeFromParent();
      mesh.geometry.dispose();
      material.dispose();
      texture.dispose();
    },
  };
}
