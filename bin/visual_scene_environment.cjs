const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const crypto = require("node:crypto");
const { spawn, spawnSync } = require("node:child_process");

const mesaArgs = ["--use-gl=angle", "--use-angle=gl", "--ignore-gpu-blocklist"];

function sceneBrowserUse(base, env = process.env) {
  if (env.VISUAL_SCENE_BACKEND !== "llvmpipe") return base;
  return { ...base, channel: "chromium", launchOptions: { ...base.launchOptions, args: [...(base.launchOptions?.args || []), ...mesaArgs] } };
}

function assertSceneBackend(backend) {
  if (!backend.webgl2 || !/llvmpipe/i.test(backend.renderer || ""))
    throw new Error("Scene proof requires the qualified Mesa llvmpipe WebGL2 backend");
  if (!Number.isInteger(backend.maxSamples) || backend.maxSamples < 4 || backend.floatColorBuffer !== true)
    throw new Error("Scene backend must retain four-sample and floating-point render targets");
}

async function startSceneEnvironment(folder) {
  if (process.platform !== "linux") return { env: process.env, close: async () => {} };
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), "al-folio-scene-"));
  const authority = path.join(temporary, "authority");
  fs.writeFileSync(authority, "", { mode: 0o600 });
  let displayNumber = 100 + (process.pid % 1000);
  while (fs.existsSync(`/tmp/.X11-unix/X${displayNumber}`) || fs.existsSync(`/tmp/.X${displayNumber}-lock`)) displayNumber++;
  const displayName = `:${displayNumber}`;
  const env = { ...process.env, DISPLAY: displayName, XAUTHORITY: authority, LIBGL_ALWAYS_SOFTWARE: "1", VISUAL_SCENE_BACKEND: "llvmpipe" };
  let display;
  let browser;
  let log;
  async function close() {
    if (browser) {
      await browser.close();
      browser = undefined;
    }
    if (display && display.exitCode === null) {
      display.kill();
      await Promise.race([new Promise((resolve) => display.once("exit", resolve)), new Promise((resolve) => setTimeout(resolve, 2000))]);
      if (display.exitCode === null) display.kill("SIGKILL");
    }
    if (log !== undefined) {
      fs.closeSync(log);
      log = undefined;
    }
    // Only this invocation's newly created private display authority is removed.
    if (path.dirname(fs.realpathSync(temporary)) !== fs.realpathSync(os.tmpdir())) throw new Error("Unexpected scene temporary directory");
    fs.rmSync(temporary, { recursive: true });
  }
  try {
    // Keep the new display private; never alter an existing display's access.
    const auth = spawnSync("xauth", ["-f", authority, "add", displayName, "MIT-MAGIC-COOKIE-1", crypto.randomBytes(16).toString("hex")], {
      env,
      stdio: "pipe",
    });
    if (auth.error || auth.status !== 0) throw new Error("Could not create the private scene display authority");
    log = fs.openSync(path.join(folder, "xvfb.log"), "a");
    display = spawn("Xvfb", [displayName, "-screen", "0", "1920x1080x24", "-nolisten", "tcp", "-auth", authority], {
      env,
      stdio: ["ignore", log, log],
    });
    let displayError;
    display.on("error", (error) => {
      displayError = error;
    });
    const deadline = Date.now() + 5000;
    while (!fs.existsSync(`/tmp/.X11-unix/X${displayNumber}`)) {
      if (displayError || display.exitCode !== null || Date.now() > deadline)
        throw new Error("Private scene display did not become ready within five seconds");
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    const { chromium } = require("@playwright/test");
    browser = await chromium.launch({ headless: true, channel: "chromium", args: mesaArgs, env, timeout: 30000 });
    const page = await browser.newPage();
    let backendTimer;
    const backend = await Promise.race([
      page.evaluate(() => {
        const gl = document.createElement("canvas").getContext("webgl2");
        if (!gl) return { webgl2: false };
        const debug = gl.getExtension("WEBGL_debug_renderer_info");
        return {
          webgl2: true,
          renderer: debug ? gl.getParameter(debug.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER),
          maxSamples: gl.getParameter(gl.MAX_SAMPLES),
          floatColorBuffer: Boolean(gl.getExtension("EXT_color_buffer_float")),
        };
      }),
      new Promise((_, reject) => {
        backendTimer = setTimeout(() => reject(new Error("Scene WebGL qualification exceeded ten seconds")), 10000);
      }),
    ]).finally(() => clearTimeout(backendTimer));
    assertSceneBackend(backend);
    const qualification = {
      ...backend,
      browserVersion: browser.version(),
      headless: true,
      channel: "chromium",
      args: mesaArgs,
      softwareFunctionalProof: true,
      performanceBenchmark: false,
    };
    fs.writeFileSync(path.join(folder, "backend-qualification.json"), JSON.stringify(qualification, null, 2) + "\n");
    process.stdout.write(JSON.stringify({ sceneBackend: qualification }) + "\n");
    await browser.close();
    browser = undefined;
    return { env, close };
  } catch (error) {
    await close();
    throw error;
  }
}

module.exports = { assertSceneBackend, sceneBrowserUse, startSceneEnvironment };
