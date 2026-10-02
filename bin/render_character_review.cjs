// Compose review boards from inspected, actual renders. No generated imagery.
const fs = require("node:fs/promises");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const { chromium } = require("playwright");

(async () => {
  const root = path.resolve(".jekyll-cache/visual-qa/character-review-october");
  const boards = [
    {
      id: "human-eyes",
      title: "Sirui · expressive eyes",
      note: "Actual Blender asset renders · open, closed and profile · all five identities retain their original body and activity clips",
      columns: 3,
      cells: [
        ["human/ghibli-before-open.png", "Before · fixed eyelids"],
        ["human/ghibli-after-closed.png", "After · a complete blink"],
        ["human/ghibli-after-closed-profile.png", "After · glasses clearance"],
      ],
      footer: "Native asset inspection, not homepage framing. Subtle pointer attention is layered over the existing routine.",
    },
    {
      id: "robot-encounter",
      title: "P · a complete visitor encounter",
      note: "Actual product GLB and motion · isolated studio views · one greeting, then a quiet return",
      columns: 4,
      cells: [
        ["robot/studio-notice.png", "1 · Notice"],
        ["robot/studio-wave.png", "2 · Greet"],
        ["robot/studio-listen.png", "3 · Listen"],
        ["robot/studio-return.png", "4 · Return"],
      ],
      footer: "Pointer proximity supplies the visitor cue. These are authored animation states; P does not hear speech or detect people.",
    },
    {
      id: "rabbit-hop",
      title: "Brush rabbit · planted, airborne, planted",
      note: "Actual Docker WebGL frames · one fixed close-up camera · the authored animal path and plants are retained",
      columns: 4,
      cells: [
        ["wildlife/after/hop-anticipation-planted.png", "1 · Gather weight"],
        ["wildlife/after/hop-flight-apex.png", "2 · Tuck in flight"],
        ["wildlife/after/hop-landing-planted.png", "3 · Land and compress"],
        ["wildlife/after/hop-settled-planted.png", "4 · Settle"],
      ],
      footer: "Horizontal travel pauses during takeoff and landing. This is authored acting, without a biological dynamics solver.",
    },
    {
      id: "marine-shape",
      title: "Coastal animals · clearer silhouettes",
      note: "Actual Docker WebGL before / after · product lighting and terrain · private close-up cameras for asset review",
      columns: 2,
      cells: [
        ["wildlife/before/seaLion-0.png", "California sea lion · before"],
        ["wildlife/after/seaLion-0.png", "California sea lion · after"],
        ["wildlife/before/seal-1.png", "Harbor seal · before"],
        ["wildlife/after/seal-1.png", "Harbor seal · after"],
      ],
      footer: "Continuous bodies, connected flipper roots and articulated acting pivots. The three master GLBs together use 40% fewer bytes.",
    },
    {
      id: "wildlife-shape",
      title: "La Jolla neighbours · before / after",
      note: "Actual Docker WebGL renders · same product lighting, terrain and plants · only the close-up camera is used for review",
      columns: 2,
      cells: [
        ["wildlife/before/Brush-rabbit.png", "Brush rabbit · before"],
        ["wildlife/after/Brush-rabbit.png", "Brush rabbit · after"],
        ["wildlife/before/seaLion-0.png", "California sea lion · before"],
        ["wildlife/after/seaLion-0.png", "California sea lion · after"],
        ["wildlife/before/seal-1.png", "Harbor seal · before"],
        ["wildlife/after/seal-1.png", "Harbor seal · after"],
      ],
      footer:
        "Continuous body silhouettes, articulated acting pivots and fewer marine draw primitives. Plants remain visible where they occlude a rabbit.",
    },
  ];
  const browser = await chromium.launch();
  const selected = new Set(process.argv.slice(2));
  try {
    for (const board of boards) {
      if (selected.size && !selected.has(board.id)) continue;
      for (const [file] of board.cells) await fs.access(path.join(root, file));
      const html = `<!doctype html><meta charset="utf-8"><style>
        *{box-sizing:border-box}body{margin:0;padding:36px;background:#f8f7f3;color:#263737;font:18px/1.5 Arial,sans-serif}
        h1{font-size:32px;margin:0 0 8px}p{margin:0 0 24px;color:#596b6a}.grid{display:grid;grid-template-columns:repeat(${board.columns},1fr);gap:18px}
        figure{margin:0;background:#fff;border:1px solid #d9deda;border-radius:12px;overflow:hidden}img{display:block;width:100%;height:auto}
        figcaption{padding:14px 16px;font-weight:600;border-top:1px solid #e6e8e2}footer{margin-top:24px;color:#596b6a;font-size:16px}
        </style><h1>${board.title}</h1><p>${board.note}</p><div class="grid">${board.cells
          .map(([file, label]) => `<figure><img src="${pathToFileURL(path.join(root, file)).href}"><figcaption>${label}</figcaption></figure>`)
          .join("")}</div><footer>${board.footer}</footer>`;
      const htmlPath = path.join(root, `${board.id}.html`);
      await fs.writeFile(htmlPath, html);
      const page = await browser.newPage({ viewport: { width: 1200, height: 800 }, deviceScaleFactor: 1 });
      await page.goto(pathToFileURL(htmlPath).href);
      await page.evaluate(() => Promise.all([...document.images].map((image) => image.decode())));
      await page.screenshot({ path: path.join(root, `${board.id}.png`), fullPage: true });
      await page.close();
      console.log(`${board.id}.png`);
    }
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
