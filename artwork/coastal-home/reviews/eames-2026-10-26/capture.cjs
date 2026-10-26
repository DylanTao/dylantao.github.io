// Matched 4K delivery-model views. Requires the retained baseline under .jekyll-cache.
const fs = require("node:fs/promises");
const path = require("node:path");
const http = require("node:http");
const crypto = require("node:crypto");
const { execFileSync } = require("node:child_process");
const { chromium } = require("playwright");
const root = path.resolve(__dirname, "../../../..");
const output = path.join(root, ".jekyll-cache/visual-qa/eames-2026-10-26");
const types = {
  ".html": "text/html",
  ".mjs": "text/javascript",
  ".js": "text/javascript",
  ".wasm": "application/wasm",
  ".json": "application/json",
  ".glb": "model/gltf-binary",
};
(async () => {
  const baseline = path.join(output, "baseline/furniture");
  await fs.mkdir(baseline, { recursive: true });
  for (const lod of [0, 1]) {
    const filename = `eames-lounge-lod${lod}.glb`;
    try {
      await fs.access(path.join(baseline, filename));
    } catch {
      await fs.writeFile(
        path.join(baseline, filename),
        execFileSync("git", ["show", `78d4ceec6:assets/models/home/furniture/${filename}`], { cwd: root })
      );
    }
  }
  const server = http.createServer(async (req, res) => {
    const filename = path.resolve(root, "." + decodeURIComponent(new URL(req.url, "http://127.0.0.1").pathname));
    if (!filename.startsWith(root + path.sep)) {
      res.writeHead(403).end();
      return;
    }
    try {
      const content = await fs.readFile(filename);
      res.writeHead(200, { "Content-Type": types[path.extname(filename)] || "application/octet-stream", "Cache-Control": "no-store" });
      res.end(content);
    } catch {
      res.writeHead(404).end();
    }
  });
  await new Promise((resolve) => server.listen(4103, "127.0.0.1", resolve));
  const browser = await chromium.launch({
    headless: true,
    args: process.platform === "win32" ? ["--use-angle=d3d11", "--ignore-gpu-blocklist"] : [],
  });
  const receipt = {
    scope: "Delivery GLBs in a neutral Three.js r164 studio; this does not verify their final house lighting or avatar contacts.",
    captures: [],
    errors: [],
  };
  try {
    const page = await browser.newPage({ viewport: { width: 3840, height: 2160 }, deviceScaleFactor: 1 });
    page.on("pageerror", (error) => receipt.errors.push(error.message));
    page.on("console", (message) => {
      if (message.type() === "error") receipt.errors.push(message.text());
    });
    for (const variant of ["baseline", "candidate"])
      for (const lod of [0, 1])
        for (const view of ["front", "side", "rear", "detail"]) {
          const url = `http://127.0.0.1:4103/artwork/coastal-home/reviews/eames-2026-10-26/review.html?variant=${variant}&lod=${lod}&view=${view}`;
          await page.goto(url);
          await page.waitForFunction(() => window.review?.ready);
          const evidence = await page.evaluate(() => window.review);
          const name = `${variant}-lod${lod}-${view}.png`;
          await page.screenshot({ path: path.join(output, name) });
          const bytes = await fs.readFile(path.join(output, name));
          receipt.captures.push({ ...evidence, file: name, sha256: crypto.createHash("sha256").update(bytes).digest("hex"), bytes: bytes.length });
          console.log(name);
        }
    if (receipt.errors.length) throw new Error(JSON.stringify(receipt.errors));
  } finally {
    await fs.writeFile(path.join(output, "delivery-review.json"), JSON.stringify(receipt, null, 2) + "\n");
    await browser.close();
    await new Promise((resolve) => server.close(resolve));
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
