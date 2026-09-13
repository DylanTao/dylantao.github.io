import * as THREE from "../three.module.min.js";

// A small live mirror of the actual land and home. Oblique near-plane clipping
// follows Three r164's Water implementation; no landscape image is sampled.
export function createSeaReflection(renderer, scene, ocean, material) {
  const target = new THREE.WebGLRenderTarget(384, 384, { type: THREE.HalfFloatType });
  const mirror = new THREE.PerspectiveCamera();
  const textureMatrix = new THREE.Matrix4();
  const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 7.35);
  const clip = new THREE.Vector4(),
    q = new THREE.Vector4();
  const direction = new THREE.Vector3();
  const reflected = { value: target.texture },
    projection = { value: textureMatrix },
    strength = { value: 0 };
  const compile = material.onBeforeCompile;
  material.onBeforeCompile = (shader) => {
    compile(shader);
    Object.assign(shader.uniforms, { coastalReflection: reflected, coastalProjection: projection, reflectionStrength: strength });
    shader.vertexShader = "uniform mat4 coastalProjection; varying vec4 reflectionPoint;\n" + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace(
      "#include <project_vertex>",
      "#include <project_vertex>\nreflectionPoint = coastalProjection * modelMatrix * vec4(transformed,1.0);"
    );
    shader.fragmentShader =
      "uniform sampler2D coastalReflection; uniform float reflectionStrength; varying vec4 reflectionPoint;\n" + shader.fragmentShader;
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <opaque_fragment>",
      `
      vec2 reflectedUv = reflectionPoint.xy / reflectionPoint.w;
      reflectedUv += vec2(slopeX, slopeZ)*.045;
      float inside = step(.002, reflectedUv.x)*step(.002,reflectedUv.y)*step(reflectedUv.x,.998)*step(reflectedUv.y,.998);
      vec3 reflectedColor = texture2D(coastalReflection, reflectedUv).rgb;
      float fresnel = .08 + .55*pow(1.0-max(0.0,dot(normal,normalize(vViewPosition))),3.0);
      outgoingLight = mix(outgoingLight, reflectedColor, fresnel*reflectionStrength*inside);
      #include <opaque_fragment>
    `
    );
  };
  return {
    update(camera, enabled) {
      strength.value = enabled ? 1 : 0;
      if (!enabled) return;
      mirror.copy(camera);
      mirror.position.y = -14.7 - camera.position.y;
      camera.getWorldDirection(direction);
      direction.y *= -1;
      mirror.up.set(0, -1, 0);
      mirror.lookAt(direction.add(mirror.position));
      mirror.updateMatrixWorld();
      // Construct the texture transform before changing the clipping plane.
      textureMatrix
        .set(0.5, 0, 0, 0.5, 0, 0.5, 0, 0.5, 0, 0, 0.5, 0.5, 0, 0, 0, 1)
        .multiply(mirror.projectionMatrix)
        .multiply(mirror.matrixWorldInverse);
      const viewPlane = plane.clone().applyMatrix4(mirror.matrixWorldInverse);
      clip.set(viewPlane.normal.x, viewPlane.normal.y, viewPlane.normal.z, viewPlane.constant);
      const p = mirror.projectionMatrix.elements;
      q.set((Math.sign(clip.x) + p[8]) / p[0], (Math.sign(clip.y) + p[9]) / p[5], -1, (1 + p[10]) / p[14]);
      clip.multiplyScalar(2 / clip.dot(q));
      p[2] = clip.x;
      p[6] = clip.y;
      p[10] = clip.z + 1;
      p[14] = clip.w;
      const previousTarget = renderer.getRenderTarget();
      const previousShadowUpdate = renderer.shadowMap.autoUpdate;
      ocean.visible = false;
      renderer.shadowMap.autoUpdate = false;
      renderer.setRenderTarget(target);
      renderer.clear();
      renderer.render(scene, mirror);
      renderer.setRenderTarget(previousTarget);
      renderer.shadowMap.autoUpdate = previousShadowUpdate;
      ocean.visible = true;
    },
    dispose() {
      target.dispose();
    },
  };
}
