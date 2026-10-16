// Compose reference | before | after boards from actual Blender renders (bin/render_coastal_likeness.py).
// The 2D portraits are Sirui's supplied references; every other cell is a render of the authored mesh.
const fs = require("node:fs/promises");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const { chromium } = require("playwright");

const root = path.resolve(".jekyll-cache/visual-qa/character-likeness");
const styles = [
  ["ghibli", "Ghibli", "assets/img/sirui_pic_ghbili.png"],
  ["south-park", "South Park", "assets/img/sirui_pic_south_park.png"],
  ["simpsons", "Simpsons", "assets/img/sirui_pic_simpsons.png"],
  ["rick-and-morty", "Rick and Morty", "assets/img/sirui_pic_rick_and_morty.png"],
];
const css = `*{box-sizing:border-box}body{margin:0;padding:32px;background:#f8f7f3;color:#263737;font:17px/1.45 Arial,sans-serif}
  h1{font-size:30px;margin:0 0 6px}p{margin:0 0 20px;color:#596b6a}.grid{display:grid;gap:14px}
  figure{margin:0;background:#fff;border:1px solid #d9deda;border-radius:10px;overflow:hidden}
  img{display:block;width:100%;height:auto;aspect-ratio:1/1;object-fit:cover}img.body{aspect-ratio:4/5}
  figcaption{padding:10px 14px;font-weight:600;border-top:1px solid #e6e8e2}footer{margin-top:20px;color:#596b6a;font-size:15px}`;

const cell = (file, label, cls = "") => `<figure><img class="${cls}" src="${pathToFileURL(file).href}"><figcaption>${label}</figcaption></figure>`;

async function shoot(browser, name, html, width) {
  const file = path.join(root, `${name}.html`);
  await fs.writeFile(file, `<!doctype html><meta charset="utf-8"><style>${css}</style>${html}`);
  const page = await browser.newPage({ viewport: { width, height: 800 }, deviceScaleFactor: 1 });
  await page.goto(pathToFileURL(file).href);
  await page.evaluate(() => Promise.all([...document.images].map((image) => image.decode())));
  await page.screenshot({ path: path.join(root, `${name}.png`), fullPage: true });
  await page.close();
  console.log(path.join(root, `${name}.png`));
}

(async () => {
  const browser = await chromium.launch();
  try {
    const overview = [];
    for (const [id, title, reference] of styles) {
      const r = (label, view) => path.join(root, `${id}-${label}-${view}.png`);
      const files = [r("before", "front"), r("after", "front"), r("before", "three"), r("after", "three"), r("after", "profile")];
      for (const file of files) await fs.access(file);
      overview.push(cell(path.resolve(reference), `${title} · reference`), cell(r("before", "front"), "Before"), cell(r("after", "front"), "After"));
      const html = `<h1>Sirui · ${title}</h1><p>Sirui's 2D portrait beside actual Blender renders of the avatar, before and after the October 15 pass · matched orthographic cameras and lights</p>
        <div class="grid" style="grid-template-columns:repeat(3,1fr)">
        ${cell(path.resolve(reference), "Reference · Sirui's 2D portrait")}${cell(r("before", "front"), "Before · front")}${cell(r("after", "front"), "After · front")}
        ${cell(r("before", "three"), "Before · three-quarter")}${cell(r("after", "three"), "After · three-quarter")}${cell(r("after", "profile"), "After · profile")}
        ${cell(r("before", "body"), "Before · full body", "body")}${cell(r("after", "body"), "After · full body", "body")}${cell(r("after", "back"), "After · back")}
        </div><footer>Head features only: hair, brows, face skin and mouth. Rig, body, hands, eyelids, glasses and all fourteen clips are retained. Original authored geometry; no generated imagery.</footer>`;
      await shoot(browser, `${id}-comparison`, html, 1200);
    }
    await shoot(
      browser,
      "overview-comparison",
      `<h1>Sirui · reference, before, after</h1><p>Front busts, matched cameras · actual Blender renders beside Sirui's 2D portraits</p>
       <div class="grid" style="grid-template-columns:repeat(3,1fr)">${overview.join("")}</div>
       <footer>The 2D portraits are the ground truth for hair, brows and expression; the 3D studies remain original interpretations.</footer>`,
      1100
    );
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
