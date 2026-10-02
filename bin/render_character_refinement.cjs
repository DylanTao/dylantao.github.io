// Compose existing native renders; this script does not modify scene imagery.
const fs = require("node:fs/promises");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const { chromium } = require("playwright");

(async () => {
  const output = path.resolve(".jekyll-cache/visual-qa/character-refinement-review"),
    wildlife = path.join(output, "wildlife"),
    rows = [
      ["raccoon", "Raccoon · shaped muzzle, mask, paws and ringed tail"],
      ["gull-perched", "Gull · compact folded wings and articulated head"],
      ["sandpiper", "Sandpiper · fitted bill, body and stepping legs"],
    ];
  const image = async (file, label) => {
    await fs.access(file);
    return `<figure><img src="${pathToFileURL(file).href}"><figcaption>${label}</figcaption></figure>`;
  };
  const cells = [];
  for (const [file, label] of rows) {
    cells.push(await image(path.join(wildlife, "before", `${file}.png`), `${label} · before`));
    cells.push(await image(path.join(wildlife, "after", `${file}.png`), `${label} · current`));
  }
  const html = `<meta charset="utf-8"><style>
    *{box-sizing:border-box}body{margin:0;padding:28px;background:#f8f7f3;color:#283838;font:18px/1.45 Arial}
    h1{font-size:30px;margin:0 0 8px}p{margin:0 0 20px}.grid{display:grid;grid-template-columns:1fr 1fr;gap:16px}
    figure{margin:0;border:1px solid #dde2dc;border-radius:12px;overflow:hidden;background:white}
    img{display:block;width:100%}figcaption{padding:12px;font-weight:600}footer{margin-top:20px;color:#5d6b68}
    </style><h1>Coastal neighbours · anatomy and acting</h1>
    <p>Actual WebGL renders · matched camera, routine time and native homepage lighting</p>
    <div class="grid">${cells.join("")}</div>
    <footer>Private close cameras make geometry inspectable; the public room stays minimal. Original coast and foliage are retained.
    New models and authored motion replace the former inline shapes. Planted feet and bounded leg fitting support the raccoon;
    these are authored contacts, without a biological or aerodynamic solver.</footer>`;
  await fs.mkdir(output, { recursive: true });
  const document = path.join(output, "wildlife-comparison.html");
  await fs.writeFile(document, html);
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 1080, height: 900 } });
    await page.goto(pathToFileURL(document).href);
    await page.evaluate(() => Promise.all([...document.images].map((element) => element.decode())));
    await page.screenshot({ path: path.join(output, "wildlife-comparison.png"), fullPage: true });
  } finally {
    await browser.close();
  }
  console.log(path.join(output, "wildlife-comparison.png"));
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
