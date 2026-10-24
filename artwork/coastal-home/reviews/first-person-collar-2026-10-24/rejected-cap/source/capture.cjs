const fs = require("node:fs/promises"),
  http = require("node:http"),
  path = require("node:path");
const { chromium } = require("D:/dev/dylantao.github.io/node_modules/playwright");
const root = process.cwd(),
  out = path.join(root, ".jekyll-cache/neck-cap/iteration-1");
const types = {
  ".mjs": "text/javascript",
  ".js": "text/javascript",
  ".html": "text/html",
  ".json": "application/json",
  ".wasm": "application/wasm",
  ".glb": "model/gltf-binary",
  ".png": "image/png",
};
const server = http.createServer(async (req, res) => {
  try {
    const file = path.resolve(root, "." + decodeURIComponent(req.url.split("?")[0]));
    if (!file.startsWith(root + path.sep)) throw Error("path");
    const bytes = await fs.readFile(file);
    res.writeHead(200, { "content-type": types[path.extname(file)] || "application/octet-stream" });
    res.end(bytes);
  } catch {
    res.writeHead(404);
    res.end();
  }
});
async function main() {
  await fs.mkdir(out, { recursive: true });
  await new Promise((r) => server.listen(4191, "127.0.0.1", r));
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1000, height: 800 }, deviceScaleFactor: 1 });
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  const report = { errors, avatars: {} };
  try {
    await page.goto("http://127.0.0.1:4191/.jekyll-cache/neck-cap/fixture.html");
    await page.waitForFunction(() => window.ready, null, { timeout: 120000 });
    for (const id of ["ghibli", "lizard"]) {
      const initial = await page.evaluate((id) => api.load(id), id),
        captures = {};
      for (const pitch of [1.4, 1.2, 0])
        for (const caps of [false, true]) {
          const label = `${id}-${pitch === 0 ? "mirror" : pitch === 1.4 ? "down80" : "down69"}-${caps ? "cap" : "before"}`;
          captures[label] = await page.evaluate(([c, p]) => api.draw(c, p), [caps, pitch]);
          await page.screenshot({ path: path.join(out, label + ".png") });
        }
      const idle = await page.evaluate(() => api.sample(120, false)),
        walk = await page.evaluate(() => api.sample(120, true));
      const animated = await page.evaluate(() => api.draw(true, 1.4));
      await page.screenshot({ path: path.join(out, `${id}-after-walk-cap.png`) });
      report.avatars[id] = { initial, captures, idle, walk, animated };
      await fs.writeFile(path.join(out, "evidence.json"), JSON.stringify(report, null, 2));
    }
    await fs.writeFile(path.join(out, "evidence.json"), JSON.stringify(report, null, 2));
    console.log(JSON.stringify(report));
  } finally {
    await browser.close();
    await new Promise((r) => server.close(r));
  }
}
main().catch((e) => {
  console.error(e);
  server.close();
  process.exitCode = 1;
});
