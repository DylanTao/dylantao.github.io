// What the 3D home's shader programs cost to compile (docs/performance-notes.md, October 24).
//
//   node bin/coastal_shader_census.cjs dump <url> <census.json>
//     Every WebGL program the home links up to ready (and four seconds after), with full sources.
//   node bin/coastal_shader_census.cjs bench <census.json> <out.json> [--only 3,7,9] [--concurrency 6]
//       [--variants variants.cjs]
//     Compiles each program alone in a fresh Chromium (ANGLE/Direct3D 11 on Windows) and times
//     link-to-completion; a variants module exports { name: (vs, fs, index) => ({ vs, fs }) | null }
//     to time edited sources side by side. Each job's source gets a unique comment, so no program
//     cache can answer it. Times are FXC compile time on this host, best compared within one run.
// $env:OVERRIDES = "name.mjs=D:/path/file.mjs;…" serves local module versions to `dump`.
const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require("playwright");

const [mode, ...rest] = process.argv.slice(2);
const launch = () => chromium.launch({ headless: true, args: process.platform === "win32" ? ["--use-angle=d3d11", "--ignore-gpu-blocklist"] : [] });
const option = (name, fallback) => {
  const i = rest.indexOf(`--${name}`);
  return i < 0 ? fallback : rest[i + 1];
};

async function dump(url, out) {
  const browser = await launch();
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, timezoneId: "America/Los_Angeles" });
  await context.addInitScript(() => {
    const log = (window.__census = { shaders: new Map(), programs: [] });
    let next = 1;
    for (const proto of [WebGL2RenderingContext.prototype, WebGLRenderingContext.prototype]) {
      const { shaderSource, attachShader, linkProgram } = proto;
      proto.shaderSource = function (shader, source) {
        if (!shader.__id) shader.__id = next++;
        log.shaders.set(shader.__id, source);
        return shaderSource.call(this, shader, source);
      };
      proto.attachShader = function (program, shader) {
        (program.__shaders ||= []).push(shader.__id);
        return attachShader.call(this, program, shader);
      };
      proto.linkProgram = function (program) {
        log.programs.push({ at: performance.now(), shaders: program.__shaders || [] });
        return linkProgram.call(this, program);
      };
    }
    window.__censusDump = () =>
      log.programs.map((p) => {
        const [vs, fs] = p.shaders.map((id) => log.shaders.get(id) || "");
        return { at: Math.round(p.at), vs, fs };
      });
  });
  const page = await context.newPage();
  for (const pair of (process.env.OVERRIDES || "").split(";").filter(Boolean)) {
    const [name, file] = pair.split("=");
    const body = fs.readFileSync(file);
    await page.route(
      (u) => u.pathname.endsWith("/" + name),
      (route) => route.fulfill({ body, contentType: "text/javascript" })
    );
  }
  await page.goto(url, { waitUntil: "load", timeout: 180000 });
  const clickAt = await page.evaluate(() => performance.now());
  await page.locator('[data-home-desk-mode="3d"]').click();
  await page.waitForFunction(() => document.querySelector("[data-home-desk-scene]")?.dataset.sceneState === "ready", null, {
    timeout: 400000,
    polling: 500,
  });
  const readyAt = await page.evaluate(() => performance.now());
  await page.waitForTimeout(4000);
  const programs = await page.evaluate(() => window.__censusDump());
  await browser.close();
  fs.writeFileSync(out, JSON.stringify({ clickAt, readyAt, programs }));
  const name = (p) => (p.fs.match(/#define SHADER_NAME ([^\n]*)/) || [, ""])[1];
  console.log(
    JSON.stringify({
      programs: programs.length,
      beforeReady: programs.filter((p) => p.at <= readyAt).length,
      fragmentKiB: Math.round(programs.reduce((a, p) => a + p.fs.length, 0) / 1024),
      named: [...new Set(programs.map(name).filter(Boolean))].length,
    })
  );
}

async function bench(censusFile, out) {
  const census = JSON.parse(fs.readFileSync(censusFile, "utf8"));
  const variants = option("variants", null) ? require(path.resolve(option("variants"))) : { base: (vs, fs) => ({ vs, fs }) };
  const only = option("only", null)?.split(",").map(Number) ?? null;
  const concurrency = Number(option("concurrency", 6));
  const jobs = [];
  census.programs.forEach((p, index) => {
    if (only && !only.includes(index)) return;
    for (const [variant, transform] of Object.entries(variants)) {
      const edited = transform(p.vs, p.fs, index);
      if (!edited) continue;
      const salt = `\n// bench ${variant} ${index} ${Math.random()}\n`;
      const salted = (src) => src.replace(/^(#version[^\n]*\n)/, `$1${salt}`);
      jobs.push({ index, variant, vs: salted(edited.vs), fs: salted(edited.fs) });
    }
  });
  const browser = await launch();
  const page = await browser.newPage();
  await page.setContent("<canvas width=1 height=1></canvas>");
  const results = await page.evaluate(
    async ({ jobs, concurrency }) => {
      const gl = document.querySelector("canvas").getContext("webgl2");
      const parallel = gl.getExtension("KHR_parallel_shader_compile");
      if (!parallel) throw new Error("KHR_parallel_shader_compile is unavailable");
      const results = [];
      let next = 0;
      async function run(job) {
        const program = gl.createProgram();
        const shaders = [
          [gl.VERTEX_SHADER, job.vs],
          [gl.FRAGMENT_SHADER, job.fs],
        ].map(([type, source]) => {
          const shader = gl.createShader(type);
          gl.shaderSource(shader, source);
          gl.compileShader(shader);
          gl.attachShader(program, shader);
          return shader;
        });
        const start = performance.now();
        gl.linkProgram(program);
        while (!gl.getProgramParameter(program, parallel.COMPLETION_STATUS_KHR)) await new Promise((resolve) => setTimeout(resolve, 2));
        const ms = performance.now() - start;
        const linked = gl.getProgramParameter(program, gl.LINK_STATUS);
        results.push({ index: job.index, variant: job.variant, ms, linked, log: linked ? "" : gl.getProgramInfoLog(program) });
        shaders.forEach((shader) => gl.deleteShader(shader));
        gl.deleteProgram(program);
      }
      await Promise.all(
        Array.from({ length: concurrency }, async () => {
          while (next < jobs.length) await run(jobs[next++]);
        })
      );
      return results;
    },
    { jobs, concurrency }
  );
  await browser.close();
  const rows = results.map((r) => {
    const p = census.programs[r.index];
    return { ...r, ms: Math.round(r.ms), name: (p.fs.match(/#define SHADER_NAME ([^\n]*)/) || [, ""])[1], fsKiB: Math.round(p.fs.length / 1024) };
  });
  fs.writeFileSync(out, JSON.stringify(rows, null, 1));
  const byVariant = {};
  for (const r of rows) (byVariant[r.variant] ||= []).push(r);
  for (const [variant, list] of Object.entries(byVariant))
    console.log(
      `${variant}: ${list.length} programs, ${(list.reduce((a, r) => a + r.ms, 0) / 1000).toFixed(1)} s, ${list.filter((r) => !r.linked).length} failed`
    );
  for (const r of [...rows].sort((a, b) => b.ms - a.ms).slice(0, 20))
    console.log(`${String(r.ms).padStart(6)} ms  #${r.index} ${r.variant} ${r.fsKiB} KiB ${r.name}`);
}

(mode === "dump"
  ? dump(rest[0], rest[1])
  : mode === "bench"
    ? bench(rest[0], rest[1])
    : Promise.reject(new Error("usage: dump <url> <out> | bench <census> <out>"))
).catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
