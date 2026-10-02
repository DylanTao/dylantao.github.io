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
    cells.push(await image(path.join(wildlife, "after", `${file}.png`), `${label} · first anatomy checkpoint`));
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
    const boards = [
      {
        name: "robot-flight-comparison",
        title: "P · clearance through the coastal home",
        note: "Actual native GLBs and production motor poses · matched private inspection cameras",
        pairs: [
          ["robot-flight", "kitchen-wander", "Kitchen · rise before crossing the island"],
          ["robot-flight", "study-to-onsen", "Upper gallery · clear the stone guard"],
          ["robot-flight", "study-to-sleep", "Study passage · fly in front of the shelf"],
        ],
      },
      {
        name: "gull-contact-comparison",
        title: "Gulls · native foot contact",
        note: "Actual retained rocks and railing · matched private detail cameras, time and heading",
        pairs: [
          ["gull-perches", "coast-feet", "Coast · fitted feet and native leg length"],
          ["gull-perches", "east-coast-feet", "East coast · fit the actual slope"],
          ["gull-perches", "rail-feet", "Gallery · supported sole with intentional toe overhang"],
        ],
      },
    ];
    for (const board of boards) {
      const figures = [];
      for (const [folder, file, label] of board.pairs) {
        for (const phase of ["before", "after"]) {
          const source =
            folder === "robot-flight" ? path.join(output, folder, `${phase}-${file}.png`) : path.join(output, folder, phase, `${file}.png`);
          figures.push(await image(source, `${label} · ${phase}`));
        }
      }
      const file = path.join(output, `${board.name}.html`);
      await fs.writeFile(
        file,
        html
          .replace(/<h1>[\s\S]*?<\/h1>/, `<h1>${board.title}</h1>`)
          .replace(/<p>[\s\S]*?<\/p>/, `<p>${board.note}</p>`)
          .replace(/<div class="grid">[\s\S]*?<\/div>/, `<div class="grid">${figures.join("")}</div>`)
          .replace(
            /<footer>[\s\S]*?<\/footer>/,
            "<footer>Original assets and native WebGL renders. These show sampled authored contact/flight behavior, not a continuous physical solver. Private cameras are for inspection; public controls remain minimal.</footer>"
          )
      );
      await page.goto(pathToFileURL(file).href);
      await page.evaluate(() => Promise.all([...document.images].map((element) => element.decode())));
      await page.screenshot({ path: path.join(output, `${board.name}.png`), fullPage: true });
    }
    const publicFigures = [];
    for (const [source, label] of [
      ["characters-final/1440-study.png", "Human and P · actual live study"],
      ["animal-inspections-final/rabbit-1.png", "Rabbit · clear scrub-edge habitat"],
      ["animal-inspections-final/raccoon-0.png", "Raccoon · planted paws and indirect contacts"],
      ["animal-inspections-final/balcony-gull-0.png", "Gallery gull · fitted rail contact"],
    ])
      publicFigures.push(await image(path.resolve(".jekyll-cache/visual-qa", source), label));
    const publicFile = path.join(output, "current-public-characters.html");
    await fs.writeFile(
      publicFile,
      html
        .replace(/<h1>[\s\S]*?<\/h1>/, "<h1>Current room and coastal visitors</h1>")
        .replace(/<p>[\s\S]*?<\/p>/, "<p>Actual Docker homepage renders · Realistic · 13:20 Pacific</p>")
        .replace(/<div class="grid">[\s\S]*?<\/div>/, `<div class="grid">${publicFigures.join("")}</div>`)
        .replace(
          /<footer>[\s\S]*?<\/footer>/,
          "<footer>Served product assets and public cameras, composed here for review. The study is a native live-frame observation; animal views use the reduced-motion still. No generated concept imagery.</footer>"
        )
    );
    await page.goto(pathToFileURL(publicFile).href);
    await page.evaluate(() => Promise.all([...document.images].map((element) => element.decode())));
    await page.screenshot({ path: path.join(output, "current-public-characters.png"), fullPage: true });
  } finally {
    await browser.close();
  }
  console.log(path.join(output, "wildlife-comparison.png"));
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
