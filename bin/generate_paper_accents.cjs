const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");
const { chromium } = require("playwright");

const root = path.resolve(__dirname, "..");
const defaultRecipes = ["assets/img/paper-shaders/build-rhythm-waves.recipe.json", "assets/img/paper-shaders/designweaver-static-mesh.recipe.json"];
const requestedRecipes = process.argv.slice(2);
const recipePaths = (requestedRecipes.length ? requestedRecipes : defaultRecipes).map((recipePath) => path.resolve(root, recipePath));

for (const recipePath of recipePaths) {
  if (!recipePath.startsWith(`${root}${path.sep}`) || !recipePath.endsWith(".recipe.json") || !fs.existsSync(recipePath)) {
    throw new Error(`Invalid Paper accent recipe: ${recipePath}`);
  }
}

const mime = (filename) => {
  if (filename.endsWith(".js")) return "text/javascript; charset=utf-8";
  if (filename.endsWith(".json")) return "application/json; charset=utf-8";
  return "application/octet-stream";
};

const buildHtml = (recipe) => `<!doctype html>
<meta charset="utf-8">
<style>
  html, body { margin: 0; background: transparent; }
  #accent { width: ${recipe.width}px; height: ${recipe.height}px; }
</style>
<div id="accent"></div>
<script type="module">
  import { ShaderMount } from "/assets/vendor/paper-shaders/0.0.80/dist/shader-mount.js";
  import { wavesFragmentShader } from "/assets/vendor/paper-shaders/0.0.80/dist/shaders/waves.js";
  import { staticMeshGradientFragmentShader } from "/assets/vendor/paper-shaders/0.0.80/dist/shaders/static-mesh-gradient.js";

  const recipe = ${JSON.stringify(recipe)};
  const p = recipe.parameters;
  const sizing = {
    u_fit: 2,
    u_scale: p.scale,
    u_rotation: p.rotation,
    u_offsetX: p.offsetX,
    u_offsetY: p.offsetY,
    u_originX: 0.5,
    u_originY: 0.5,
    u_worldWidth: 0,
    u_worldHeight: 0,
  };
  let preset;
  if (recipe.shader_id === "waves") {
    preset = {
      shader: wavesFragmentShader,
      uniforms: {
        ...sizing,
        u_colorFront: p.colorFront,
        u_colorBack: p.colorBack,
        u_shape: p.shape,
        u_frequency: p.frequency,
        u_amplitude: p.amplitude,
        u_spacing: p.spacing,
        u_proportion: p.proportion,
        u_softness: p.softness,
      },
    };
  } else if (recipe.shader_id === "static-mesh-gradient") {
    preset = {
      shader: staticMeshGradientFragmentShader,
      uniforms: {
        ...sizing,
        u_colors: p.colors,
        u_colorsCount: p.colors.length,
        u_positions: p.positions,
        u_waveX: p.waveX,
        u_waveXShift: p.waveXShift,
        u_waveY: p.waveY,
        u_waveYShift: p.waveYShift,
        u_mixing: p.mixing,
        u_grainMixer: p.grainMixer,
        u_grainOverlay: p.grainOverlay,
      },
    };
  }
  if (!preset) throw new Error("Unsupported Paper accent shader: " + recipe.shader_id);
  const mount = new ShaderMount(
    document.querySelector("#accent"),
    preset.shader,
    preset.uniforms,
    { alpha: true, antialias: false, depth: false, preserveDrawingBuffer: true },
    0,
    0,
    1,
    ${recipe.width * recipe.height}
  );
  if (!mount.program) throw new Error(recipe.shader + " shader did not compile or link");
  mount.setFrame(0);
  await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  window.__paperAccentMount = mount;
  window.__paperAccentReady = true;
</script>`;

let activeRecipe;
const server = http.createServer((request, response) => {
  const requestPath = new URL(request.url, "http://127.0.0.1").pathname;
  if (requestPath === "/") {
    response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    response.end(buildHtml(activeRecipe));
    return;
  }

  const localPath = path.resolve(root, `.${requestPath}`);
  if (!localPath.startsWith(`${root}${path.sep}`) || !fs.existsSync(localPath) || !fs.statSync(localPath).isFile()) {
    response.writeHead(404);
    response.end("Not found");
    return;
  }
  response.writeHead(200, { "Content-Type": mime(localPath) });
  fs.createReadStream(localPath).pipe(response);
});

(async () => {
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  const browser = await chromium.launch({ headless: true });
  try {
    for (const recipePath of recipePaths) {
      activeRecipe = JSON.parse(fs.readFileSync(recipePath, "utf8"));
      const outputPath = path.resolve(root, activeRecipe.output);
      if (!outputPath.startsWith(`${root}${path.sep}`)) throw new Error(`Output escapes repository: ${outputPath}`);

      const page = await browser.newPage({
        deviceScaleFactor: 1,
        viewport: { width: activeRecipe.width, height: activeRecipe.height },
      });
      try {
        page.on("pageerror", (error) => process.stderr.write(`[browser:error] ${error.message}\n`));
        await page.goto(`http://127.0.0.1:${address.port}/?shader=${activeRecipe.shader_id}`, { waitUntil: "networkidle" });
        await page.waitForFunction(() => window.__paperAccentReady === true);
        const sample = await page.locator("#accent canvas").evaluate((canvas) => {
          const gl = canvas.getContext("webgl2", { preserveDrawingBuffer: true });
          const rgba = new Uint8Array(canvas.width * canvas.height * 4);
          gl.readPixels(0, 0, canvas.width, canvas.height, gl.RGBA, gl.UNSIGNED_BYTE, rgba);
          let visible = 0;
          let min = 255;
          let max = 0;
          for (let index = 0; index < rgba.length; index += 4) {
            if (rgba[index + 3] > 4) visible += 1;
            min = Math.min(min, rgba[index], rgba[index + 1], rgba[index + 2]);
            max = Math.max(max, rgba[index], rgba[index + 1], rgba[index + 2]);
          }
          return { height: canvas.height, range: max - min, visibleRatio: visible / (canvas.width * canvas.height), width: canvas.width };
        });
        if (sample.visibleRatio < 0.002 || sample.range < 8) {
          throw new Error(`Generated ${activeRecipe.shader} accent failed the pixel check: ${JSON.stringify(sample)}`);
        }
        const quality = activeRecipe.quality ?? 0.8;
        const dataUrl = await page.locator("#accent canvas").evaluate((canvas, webpQuality) => canvas.toDataURL("image/webp", webpQuality), quality);
        if (!dataUrl.startsWith("data:image/webp;base64,")) throw new Error("Chromium did not encode WebP");
        fs.mkdirSync(path.dirname(outputPath), { recursive: true });
        fs.writeFileSync(outputPath, Buffer.from(dataUrl.split(",", 2)[1], "base64"));
        process.stdout.write(`${path.relative(root, outputPath)} ${JSON.stringify(sample)}\n`);
      } finally {
        await page.close();
      }
    }
  } finally {
    await browser.close();
    await new Promise((resolve) => server.close(resolve));
  }
})().catch((error) => {
  server.close();
  console.error(error);
  process.exitCode = 1;
});
