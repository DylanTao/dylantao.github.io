const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");
const { chromium } = require("playwright");

const root = path.resolve(__dirname, "..");
const recipePath = path.join(root, "assets", "img", "website-revamp", "paper-texture.recipe.json");
const recipe = JSON.parse(fs.readFileSync(recipePath, "utf8"));
const outputPath = path.join(root, recipe.output);

const mime = (filename) => {
  if (filename.endsWith(".js")) return "text/javascript; charset=utf-8";
  if (filename.endsWith(".json")) return "application/json; charset=utf-8";
  return "application/octet-stream";
};

const html = `<!doctype html>
<meta charset="utf-8">
<style>
  html, body { margin: 0; background: transparent; }
  #texture { width: ${recipe.width}px; height: ${recipe.height}px; }
</style>
<div id="texture"></div>
<script type="module">
  import { getShaderNoiseTexture } from "/assets/vendor/paper-shaders/0.0.80/dist/get-shader-noise-texture.js";
  import { ShaderMount } from "/assets/vendor/paper-shaders/0.0.80/dist/shader-mount.js";
  import { paperTextureFragmentShader } from "/assets/vendor/paper-shaders/0.0.80/dist/shaders/paper-texture.js";

  const waitForImage = (image) => new Promise((resolve, reject) => {
    if (image.complete && image.naturalWidth) return resolve(image);
    image.addEventListener("load", () => resolve(image), { once: true });
    image.addEventListener("error", reject, { once: true });
  });

  const paperImage = new Image();
  paperImage.src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='1' height='1'%3E%3C/svg%3E";
  const noise = getShaderNoiseTexture();
  await Promise.all([waitForImage(paperImage), waitForImage(noise)]);

  const p = ${JSON.stringify(recipe.parameters)};
  const mount = new ShaderMount(
    document.querySelector("#texture"),
    paperTextureFragmentShader,
    {
      u_fit: 2,
      u_scale: 1,
      u_rotation: 0,
      u_offsetX: 0,
      u_offsetY: 0,
      u_originX: 0.5,
      u_originY: 0.5,
      u_worldWidth: 0,
      u_worldHeight: 0,
      u_colorFront: p.colorFront,
      u_colorBack: p.colorBack,
      u_image: paperImage,
      u_contrast: p.contrast,
      u_roughness: p.roughness,
      u_fiber: p.fiber,
      u_fiberSize: p.fiberSize,
      u_crumples: p.crumples,
      u_crumpleSize: p.crumpleSize,
      u_folds: p.folds,
      u_foldCount: p.foldCount,
      u_drops: p.drops,
      u_seed: p.seed,
      u_fade: p.fade,
      u_noiseTexture: noise,
    },
    { alpha: true, antialias: false, depth: false, preserveDrawingBuffer: true },
    0,
    0,
    1,
    ${recipe.width * recipe.height}
  );
  if (!mount.program) throw new Error("Paper Texture shader did not compile or link");
  mount.setFrame(0);
  await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  window.__paperTextureMount = mount;
  window.__paperTextureReady = true;
</script>`;

const server = http.createServer((request, response) => {
  const requestPath = new URL(request.url, "http://127.0.0.1").pathname;
  if (requestPath === "/") {
    response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    response.end(html);
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
    const page = await browser.newPage({
      deviceScaleFactor: 1,
      viewport: { width: recipe.width, height: recipe.height },
    });
    page.on("pageerror", (error) => process.stderr.write(`[browser:error] ${error.message}\n`));
    await page.goto(`http://127.0.0.1:${address.port}/`, { waitUntil: "networkidle" });
    await page.waitForFunction(() => window.__paperTextureReady === true);
    const sample = await page.locator("#texture canvas").evaluate((canvas) => {
      const gl = canvas.getContext("webgl2", { preserveDrawingBuffer: true });
      const rgba = new Uint8Array(4);
      gl.readPixels(Math.floor(canvas.width / 2), Math.floor(canvas.height / 2), 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, rgba);
      return { width: canvas.width, height: canvas.height, rgba: Array.from(rgba) };
    });
    if (sample.rgba[3] === 0 || sample.rgba[0] + sample.rgba[1] + sample.rgba[2] < 300) {
      throw new Error(`Generated texture failed the light-paper pixel check: ${JSON.stringify(sample)}`);
    }
    const dataUrl = await page.locator("#texture canvas").evaluate((canvas) => canvas.toDataURL("image/webp", 0.86));
    if (!dataUrl.startsWith("data:image/webp;base64,")) throw new Error("Chromium did not encode WebP");
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, Buffer.from(dataUrl.split(",", 2)[1], "base64"));
    process.stdout.write(`${path.relative(root, outputPath)}\n`);
  } finally {
    await browser.close();
    await new Promise((resolve) => server.close(resolve));
  }
})().catch((error) => {
  server.close();
  console.error(error);
  process.exitCode = 1;
});
