const fs = require("node:fs"),
  path = require("node:path"),
  { execFileSync } = require("node:child_process"),
  crypto = require("node:crypto");
const { chromium } = require("playwright");
const root = path.resolve(__dirname, "../../../.."),
  base = (process.argv[2] || "http://127.0.0.1:4102/al-folio").replace(/\/$/, ""),
  pin = "4b77a54d9";
const files = execFileSync("git", ["ls-tree", "-r", "--name-only", pin, "assets/js/footer-coast"], { cwd: root, encoding: "utf8" })
  .trim()
  .split(/\r?\n/);
files.push("assets/js/footer-coast/bed-relief.mjs", "assets/models/la-jolla/hills.png");
const bodies = { baseline: new Map(), candidate: new Map() };
for (const file of new Set(files)) {
  if (fs.existsSync(path.join(root, file))) bodies.candidate.set(file, fs.readFileSync(path.join(root, file)));
  if (file !== "assets/js/footer-coast/bed-relief.mjs")
    bodies.baseline.set(file, execFileSync("git", ["show", `${pin}:${file}`], { cwd: root, maxBuffer: 8e6 }));
}
const percentile = (a, p) => {
  const b = a.filter(Number.isFinite).sort((x, y) => x - y);
  return b[Math.min(b.length - 1, Math.floor(b.length * p))] ?? null;
};
(async () => {
  fs.mkdirSync(path.join(root, ".jekyll-cache/visual-qa/site-fidelity-2026-10-26"), { recursive: true });
  const browser = await chromium.launch({ args: ["--use-angle=d3d11", "--ignore-gpu-blocklist"] });
  const receipt = {
    at: new Date().toISOString(),
    baseline: pin,
    method:
      "Complete bare footer, noon, live motion, native ANGLE/D3D11; three interleaved pairs per viewport; fresh contexts in one browser process; 24 actually drawn callbacks each. GPU EXT_disjoint_timer_query_webgl2 covers submitted GL work, not later compositor/presentation or retained-buffer copies. Only owned GPU jobs were quiet; concurrent CPU work and other PC apps uncontrolled. Viewport emulation is not physical phone performance.",
    sources: {},
    runs: [],
  };
  for (const [variant, map] of Object.entries(bodies))
    receipt.sources[variant] = Object.fromEntries([...map].map(([p, b]) => [p, crypto.createHash("sha256").update(b).digest("hex")]));
  for (const width of [2560, 390])
    for (const variant of ["baseline", "candidate", "candidate", "baseline", "baseline", "candidate"]) {
      const context = await browser.newContext({ viewport: { width, height: 480 }, deviceScaleFactor: 1, reducedMotion: "no-preference" }),
        page = await context.newPage();
      const errors = [];
      page.on("pageerror", (e) => errors.push(e.message));
      page.on("console", (m) => {
        if (m.type() === "error") errors.push(m.text());
      });
      await page.route("**/assets/**", (r) => {
        const p = new URL(r.request().url()).pathname.replace("/al-folio/", "");
        const b = bodies[variant].get(p);
        if (b) r.fulfill({ body: b, contentType: p.endsWith(".png") ? "image/png" : "application/javascript" });
        else r.continue();
      });
      const url = base + "/__footer-cost__?cinematic=live";
      await page.route(url, (r) =>
        r.fulfill({
          contentType: "text/html",
          body: `<!doctype html><html data-theme-mode="noon"><head><style>:root{--global-bg-color:#fffefa}html,body,figure{margin:0;background:#fffefa}.footer-coast__scene{width:100vw;height:100vh}canvas{display:block}</style></head><body><figure data-footer-coast><div class="footer-coast__scene"><canvas></canvas></div></figure><script type="module">import{mountCoast}from'${base}/assets/js/footer-coast/scene.mjs';await mountCoast(document.querySelector('figure'));</script></body></html>`,
        })
      );
      const started = Date.now();
      await page.goto(url);
      await page.waitForSelector('[data-state="ready"]', { timeout: 60000 });
      const firstReadyWallMs = Date.now() - started;
      await page.waitForFunction(() => document.querySelector("figure").getCoastEvidence().frames >= 4);
      const measured = await page.evaluate(
        () =>
          new Promise((resolve, reject) => {
            const host = document.querySelector("figure"),
              canvas = host.querySelector("canvas"),
              gl = canvas.getContext("webgl2"),
              ext = gl.getExtension("EXT_disjoint_timer_query_webgl2"),
              debug = gl.getExtension("WEBGL_debug_renderer_info");
            const originalRAF = window.requestAnimationFrame,
              records = [],
              originals = {},
              start = performance.now();
            let previousDraw = null,
              draws = 0,
              finished = false;
            for (const key of ["drawElements", "drawArrays", "drawElementsInstanced", "drawArraysInstanced"]) {
              originals[key] = gl[key];
              gl[key] = function (...args) {
                draws++;
                return originals[key].apply(gl, args);
              };
            }
            const renderer = debug ? gl.getParameter(debug.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
            const finish = () => {
              if (finished) return;
              finished = true;
              window.requestAnimationFrame = originalRAF;
              for (const key in originals) gl[key] = originals[key];
              const end = performance.now();
              const poll = () => {
                let pending = false;
                for (const r of records)
                  if (r.query) {
                    if (gl.getQueryParameter(r.query, gl.QUERY_RESULT_AVAILABLE)) {
                      r.gpuMs = gl.getQueryParameter(r.query, gl.QUERY_RESULT) / 1e6;
                      gl.deleteQuery(r.query);
                      delete r.query;
                    } else pending = true;
                  }
                if (pending && performance.now() - end < 5000) return setTimeout(poll, 10);
                for (const r of records) {
                  if (r.query) {
                    gl.deleteQuery(r.query);
                    delete r.query;
                    r.gpuMs = null;
                  }
                }
                resolve({
                  renderer,
                  buffer: { width: canvas.width, height: canvas.height, cssWidth: canvas.clientWidth, cssHeight: canvas.clientHeight },
                  contextAttributes: gl.getContextAttributes(),
                  timerQuery: Boolean(ext),
                  disjoint: ext ? gl.getParameter(ext.GPU_DISJOINT_EXT) : null,
                  records,
                  evidence: host.getCoastEvidence(),
                });
              };
              poll();
            };
            window.requestAnimationFrame = function (cb) {
              return originalRAF.call(window, (t) => {
                if (finished) return cb(t);
                const frame = host.getCoastEvidence().frames,
                  drawStart = draws,
                  q = ext ? gl.createQuery() : null;
                if (q) gl.beginQuery(ext.TIME_ELAPSED_EXT, q);
                const cpu = performance.now();
                cb(t);
                const cpuMs = performance.now() - cpu;
                if (q) gl.endQuery(ext.TIME_ELAPSED_EXT);
                if (host.getCoastEvidence().frames > frame) {
                  records.push({ cpuMs, draws: draws - drawStart, query: q, callbackGapMs: previousDraw === null ? null : t - previousDraw });
                  previousDraw = t;
                } else if (q) gl.deleteQuery(q);
                if (records.length >= 24) finish();
                if (performance.now() - start > 12000) {
                  finish();
                }
              });
            };
            setTimeout(() => {
              if (!finished) {
                finish();
              }
            }, 13000);
          })
      );
      const run = { width, variant, firstReadyWallMs, ...measured, errors };
      run.summary = {
        samples: run.records.length,
        callbackGapP50: percentile(
          run.records.map((r) => r.callbackGapMs),
          0.5
        ),
        cpuP50: percentile(
          run.records.map((r) => r.cpuMs),
          0.5
        ),
        cpuP75: percentile(
          run.records.map((r) => r.cpuMs),
          0.75
        ),
        gpuP50: run.disjoint
          ? null
          : percentile(
              run.records.map((r) => r.gpuMs),
              0.5
            ),
        gpuP75: run.disjoint
          ? null
          : percentile(
              run.records.map((r) => r.gpuMs),
              0.75
            ),
        drawsP50: percentile(
          run.records.map((r) => r.draws),
          0.5
        ),
      };
      receipt.runs.push(run);
      fs.writeFileSync(path.join(root, ".jekyll-cache/visual-qa/site-fidelity-2026-10-26/footer-cost.json"), JSON.stringify(receipt, null, 2) + "\n");
      console.log(JSON.stringify({ width, variant, firstReadyWallMs, renderer: run.renderer, buffer: run.buffer, ...run.summary, errors }));
      await context.close();
    }
  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
