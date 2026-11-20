import * as THREE from "../three.module.min.js";

// The split is flat on two sides and keeps bark on the original outer arc.
// The three bands of the atlas describe bark, lengthwise cleft and sawn end.
function woodAtlas() {
  const width = 160,
    band = 80;
  const pixels = new Uint8Array(width * band * 3 * 4);
  const grain = (v) => 0.5 + 0.5 * Math.sin(v);
  let seed = 9619;
  for (let y = 0; y < 3 * band; y++) {
    for (let x = 0; x < width; x++) {
      const u = x / (width - 1),
        v = (y % band) / (band - 1);
      const random = (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296 - 0.5;
      const bend = u + 0.017 * Math.sin(11 * v + 2 * Math.sin(3 * u));
      let rgb, ink, fissure;
      if (y < band) {
        const furrow = grain(79 * bend + 1.3 * Math.sin(22 * bend + 4 * v));
        const plates = Math.abs(Math.sin(11 * v + 3 * Math.sin(17 * bend)));
        ink = 0.72 + 0.33 * furrow + random * 0.2;
        fissure = Math.max(Math.max(0, 0.15 - furrow) * 6, Math.max(0, 0.09 - plates) * 9 * furrow);
        rgb = [106, 80, 59];
      } else if (y < 2 * band) {
        const fibres = grain(170 * bend + 2 * Math.sin(31 * bend));
        ink = 0.87 + 0.18 * fibres + random * 0.11;
        fissure = Math.max(0, 0.075 - fibres) * 9 * grain(7 * v);
        rgb = [195, 149, 98];
      } else {
        const dx = u - 0.11,
          dy = v - 0.19;
        const radius = Math.hypot(dx * 1.04, dy) + 0.009 * Math.sin(9 * u + 17 * v);
        const ring = grain(radius * 94 + 0.5 * Math.sin(radius * 17));
        const split = Math.abs(Math.sin(Math.atan2(dy, dx) * 5.0 + 0.06 * Math.sin(radius * 19)));
        ink = 0.89 + 0.2 * ring + 0.1 * random;
        fissure = Math.max(0, 1 - split / 0.043) * Math.min(1, Math.max(0, radius - 0.36) * 4);
        rgb = [207, 163, 109];
      }
      const i = (y * width + x) * 4;
      for (let c = 0; c < 3; c++) pixels[i + c] = Math.round(rgb[c] * ink * (1 - 0.55 * fissure));
      pixels[i + 3] = Math.round(255 * Math.min(1, fissure));
    }
  }
  const texture = new THREE.DataTexture(pixels, width, band * 3);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  texture.needsUpdate = true;
  return texture;
}

function splitBillet(seed) {
  const positions = [],
    uvs = [];
  const profile = [
    [-0.78, -0.54],
    [0.63, -0.54],
    [0.83, -0.25],
    [0.88, 0.11],
    [0.72, 0.45],
    [0.43, 0.69],
    [0.1, 0.82],
    [-0.17, 0.76],
  ];
  const end = (i, z) => {
    const [x, y] = profile[i % profile.length];
    const shift = Math.sin(i * 13.7 + seed + z) * 0.023;
    return [x + shift, y + 0.024 * Math.sin(i * 2 + seed), z + Math.sin(i * 3.3 + seed) * 0.016];
  };
  function face(verts, coords, band) {
    for (let i = 0; i < 3; i++) {
      positions.push(...verts[i]);
      uvs.push(0.01 + 0.98 * coords[i][0], (band + 0.018 + 0.964 * coords[i][1]) / 3);
    }
  }
  for (let i = 0; i < profile.length; i++) {
    const a = end(i, -1),
      b = end(i + 1, -1),
      c = end(i + 1, 1),
      d = end(i, 1);
    const materialBand = i === 0 || i === profile.length - 1 ? 1 : 0;
    const u = materialBand ? 0 : i / profile.length,
      v = materialBand ? 1 : (i + 1) / profile.length;
    face(
      [a, b, c],
      [
        [u, 0],
        [v, 0],
        [v, 1],
      ],
      materialBand
    );
    face(
      [a, c, d],
      [
        [u, 0],
        [v, 1],
        [u, 1],
      ],
      materialBand
    );
    for (const side of [-1, 1]) {
      const edges = side > 0 ? [d, c] : [b, a];
      const tri = [[0, 0, side], ...edges];
      face(
        tri,
        tri.map(([x, y]) => [0.5 + x * 0.49, 0.5 + y * 0.49]),
        2
      );
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  g.computeVertexNormals();
  return g;
}

export function createBurningWood(parent) {
  const texture = woodAtlas();
  const logs = [];
  // The two lower split faces support the third billet over their gap.
  const pile = [
    [-0.079, 0.843, -0.006, 0.04, 0.19, 0.058, 0.53],
    [0.091, 0.846, 0.008, -0.04, -0.2, 0.053, 0.58],
    [0.004, 0.893, -0.052, 0.11, 0.92, 0.049, 0.41],
  ];
  for (const [i, [x, y, z, tilt, yaw, radius, length]] of pile.entries()) {
    const tone = { value: new THREE.Vector3(0.4, 0.8, 0) };
    const material = new THREE.MeshStandardMaterial({ name: "Hearth · split oak and embers", map: texture, roughness: 0.9 });
    material.onBeforeCompile = (shader) => {
      shader.uniforms.burningWood = tone;
      shader.vertexShader =
        "varying vec3 billetPosition;\n" +
        shader.vertexShader.replace("#include <begin_vertex>", "#include <begin_vertex>\nbilletPosition = position;");
      shader.fragmentShader =
        "uniform vec3 burningWood;\nvarying vec3 billetPosition;\n" +
        shader.fragmentShader
          .replace(
            "#include <map_fragment>",
            `#include <map_fragment>
          float crack = texture2D(map,vMapUv).a;
          float sunken = .5 + .5*sin(vMapUv.x*21.7 + vMapUv.y*17.4);
          float charred = smoothstep(.05,.88,burningWood.x*.77 + .34*sunken);
          diffuseColor.rgb = mix(diffuseColor.rgb * .63,
            vec3(.020,.016,.014) * (.71 + .65*sunken), charred);
          // The ends furthest from the central flame stay dark. Only broken
          // pockets of the cracked bark expose glowing fuel underneath.
          float hotLength = 1. - smoothstep(.18,.92,abs(billetPosition.z+.11));
          float plates = sin(8.6*billetPosition.z+2.3*billetPosition.x)
            + .64*sin(14.3*billetPosition.x-6.2*billetPosition.z);
          float coal = crack * hotLength * smoothstep(-.45,.92,plates) * burningWood.y;
          diffuseColor.a = 1.;`
          )
          .replace(
            "#include <emissivemap_fragment>",
            `#include <emissivemap_fragment>
          totalEmissiveRadiance += vec3(1.65,.19,.013) * coal * (.85+.15*sin(burningWood.z*.9+vMapUv.y*9.));`
          );
    };
    const mesh = new THREE.Mesh(splitBillet(i + 0.3), material);
    mesh.name = "Hearth · burning split " + (i + 1);
    mesh.position.set(x, y, z);
    mesh.scale.set(radius, radius, length * 0.5);
    mesh.rotation.set(tilt, yaw, 0.12 * (i - 1), "YXZ");
    mesh.receiveShadow = true;
    Object.assign(mesh.userData, { fixedMaterial: true, dynamic: true });
    parent.add(mesh);
    logs.push({ mesh, tone, y, radius });
  }
  return {
    update(field, time) {
      for (const [i, { mesh, tone, y, radius }] of logs.entries()) {
        const fuel = field.fuel[i];
        tone.value.set(field.char[i], Math.min(1, fuel * 2) * (0.4 + 0.6 * field.char[i]), time + i * 2);
        mesh.scale.y = radius * (0.56 + 0.44 * fuel);
        mesh.position.y = y - (1 - fuel) * (i === 2 ? 0.048 : 0.012);
      }
    },
    dispose() {
      for (const { mesh } of logs) {
        mesh.removeFromParent();
        mesh.geometry.dispose();
        mesh.material.dispose();
      }
      texture.dispose();
    },
  };
}
