import * as THREE from "../three.module.min.js";

export function createArtDirection() {
  const textures = new Map();
  const outlines = new Set();
  const gradient = new THREE.DataTexture(new Uint8Array([65, 155, 245]), 3, 1, THREE.RedFormat);
  gradient.minFilter = gradient.magFilter = THREE.NearestFilter;
  gradient.needsUpdate = true;

  function texture(kind) {
    if (textures.has(kind)) return textures.get(kind);
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 256;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 900; i++) {
      const x = (i * 73.31) % 256,
        y = (i * 39.17) % 256;
      ctx.strokeStyle = kind === "ink" ? "rgba(25,34,43,.16)" : "rgba(55,38,20,.065)";
      ctx.fillStyle = ctx.strokeStyle;
      if (kind === "ink") {
        if (i < 400) {
          ctx.beginPath();
          ctx.arc(x, y, 0.8, 0, Math.PI * 2);
          ctx.fill();
        } else {
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.lineTo(x + 3, y - 5);
          ctx.stroke();
        }
      } else if (kind === "fabric") {
        ctx.fillRect(x, y, 1, 5);
        ctx.fillRect(x, y, 5, 1);
      } else if (kind === "wood") {
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.bezierCurveTo(x + 2, y + 8, x - 2, y + 22, x, y + 48);
        ctx.stroke();
      } else {
        ctx.fillRect(x, y, 1 + (i % 3), 1);
      }
    }
    const map = new THREE.CanvasTexture(canvas);
    map.wrapS = map.wrapT = THREE.RepeatWrapping;
    map.colorSpace = THREE.SRGBColorSpace;
    textures.set(kind, map);
    return map;
  }

  function apply(root, style) {
    const meshes = [];
    root.traverse((o) => {
      if (o.isMesh && !o.userData.outline && !o.userData.fixedMaterial) meshes.push(o);
    });
    for (const mesh of meshes) {
      const base = (mesh.userData.baseMaterial ||= mesh.material);
      const cache = (mesh.userData.styleMaterials ||= {});
      if (!cache[style]) {
        const make = (source) => {
          if (style === "illustrated") {
            const color = source.color.clone();
            const printPalette = {
              "chalk limestone": 0xf6c9a8,
              "warm cut stone": 0x85809d,
              "pale oak": 0xeaaa6e,
              "honey ash": 0xac653f,
              linen: 0xf7e5c7,
              "sage textile": 0x6fa5ac,
              "olive leaf": 0x3b9878,
              terracotta: 0xe76e50,
              "onsen turquoise": 0x4eb7bf,
            };
            if (printPalette[source.name]) color.setHex(printPalette[source.name]);
            else if (color.getHSL({}).l > 0.15) color.offsetHSL(0, 0.16, 0);
            const m = new THREE.MeshToonMaterial({ color, map: source.map || texture("ink"), gradientMap: gradient, side: source.side });
            m.name = source.name;
            // Printed shadows: blue color separation, a halftone screen, and
            // intersecting hatch marks. Stable screen-space ink never crawls.
            m.onBeforeCompile = (shader) => {
              shader.fragmentShader = shader.fragmentShader.replace(
                "#include <opaque_fragment>",
                `
                float shade = 1.0 - smoothstep(-0.2, 0.85, dot(normal, normalize(vec3(-0.6, 0.8, 0.4))));
                vec2 paper = gl_FragCoord.xy;
                float dots = 1.0 - smoothstep(0.14, 0.23, length(fract(paper / 5.0) - 0.5));
                float hatchA = 1.0 - smoothstep(0.09, 0.19, abs(fract((paper.x + paper.y * 1.4) / 9.0) - 0.5));
                float hatchB = 1.0 - smoothstep(0.08, 0.17, abs(fract((paper.x - paper.y * 1.1) / 13.0) - 0.5));
                outgoingLight = mix(outgoingLight, outgoingLight * vec3(0.48, 0.57, 0.86) + vec3(0.028, 0.025, 0.10), shade * 0.66);
                float ink = dots * shade * 0.35 + hatchA * smoothstep(0.40, 0.85, shade) * 0.34 + hatchB * smoothstep(0.7, 1.0, shade) * 0.30;
                outgoingLight = mix(outgoingLight, vec3(0.025, 0.036, 0.068), min(ink, 0.72));
                #include <opaque_fragment>
              `
              );
            };
            return m;
          }
          const m = source.clone();
          m.roughness = style === "realistic" ? Math.min(m.roughness ?? 0.7, 0.7) : 0.86;
          if (mesh.isSkinnedMesh) m.roughness = /hair/i.test(source.name) ? 0.5 : /skin/i.test(source.name) ? 0.74 : 0.86;
          if (style === "realistic" && !source.map && !mesh.isSkinnedMesh) {
            const grain = /wood|oak|ash/i.test(source.name) ? "wood" : /linen|textile|cotton|trousers/i.test(source.name) ? "fabric" : "stone";
            m.map = texture(grain);
            m.bumpMap = m.map;
            m.bumpScale = grain === "fabric" ? 0.013 : 0.025;
            m.roughness = grain === "fabric" ? 0.93 : grain === "wood" ? 0.46 : 0.62;
            if (/water|turquoise/i.test(source.name)) {
              m.roughness = 0.1;
              m.metalness = 0.25;
              m.bumpScale = 0.006;
            }
          }
          return m;
        };
        cache[style] = Array.isArray(base) ? base.map(make) : make(base);
      }
      mesh.material = cache[style];
      if (!mesh.userData.inkOutline) {
        const mat = new THREE.MeshBasicMaterial({ color: 0x202634, side: THREE.BackSide });
        mat.onBeforeCompile = (shader) => {
          shader.vertexShader = shader.vertexShader.replace(
            "#include <begin_vertex>",
            mesh.isSkinnedMesh
              ? "vec3 transformed = vec3(position + normal * 0.005);"
              : "vec3 transformed = vec3(position + normal * (0.014 + 0.004 * sin(position.x * 23.0 + position.y * 19.0)));"
          );
        };
        const outline = mesh.isSkinnedMesh ? new THREE.SkinnedMesh(mesh.geometry, mat) : new THREE.Mesh(mesh.geometry, mat);
        if (mesh.isSkinnedMesh) {
          outline.bindMode = mesh.bindMode;
          outline.bind(mesh.skeleton, mesh.bindMatrix);
        }
        outline.userData.outline = true;
        outline.raycast = () => {};
        mesh.add(outline);
        mesh.userData.inkOutline = outline;
        outlines.add(outline);
      }
      mesh.userData.inkOutline.visible = style === "illustrated";
      mesh.castShadow = mesh.receiveShadow = true;
    }
  }

  return {
    apply,
    forget(root) {
      root.traverse((o) => {
        if (o.userData.outline) outlines.delete(o);
      });
    },
    dispose() {
      gradient.dispose();
      textures.forEach((t) => t.dispose());
      outlines.forEach((o) => o.material.dispose());
      outlines.clear();
    },
  };
}
