#!/usr/bin/env node
// Rasterizes assets/img/favicon.svg, the orange sun drawn on a 16-pixel grid, into the icons the
// browser and home screen use: favicon.ico with 16, 32 and 48 px PNG entries, and a 180 px
// apple-touch-icon on the light page colour (iOS fills transparent icon pixels with black).
// Usage: node bin/build_brand_icons.cjs
const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require("playwright");

const root = path.resolve(__dirname, "..");
const image = (name) => path.join(root, "assets", "img", name);
const svg = fs.readFileSync(image("favicon.svg"), "utf8");

function ico(entries) {
  const header = Buffer.alloc(6 + 16 * entries.length);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(entries.length, 4);
  let offset = header.length;
  entries.forEach(({ size, png }, index) => {
    const at = 6 + 16 * index;
    header.writeUInt8(size % 256, at);
    header.writeUInt8(size % 256, at + 1);
    header.writeUInt16LE(1, at + 4);
    header.writeUInt16LE(32, at + 6);
    header.writeUInt32LE(png.length, at + 8);
    header.writeUInt32LE(offset, at + 12);
    offset += png.length;
  });
  return Buffer.concat([header, ...entries.map((entry) => entry.png)]);
}

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const render = async (size, { background = null, inset = 0 } = {}) =>
    Buffer.from(
      await page.evaluate(
        async ({ svg, size, background, inset }) => {
          const img = new Image();
          img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
          await img.decode();
          const canvas = document.createElement("canvas");
          canvas.width = canvas.height = size;
          const context = canvas.getContext("2d");
          if (background) {
            context.fillStyle = background;
            context.fillRect(0, 0, size, size);
          }
          context.drawImage(img, inset, inset, size - 2 * inset, size - 2 * inset);
          return canvas.toDataURL("image/png").split(",")[1];
        },
        { svg, size, background, inset }
      ),
      "base64"
    );
  const entries = [];
  for (const size of [16, 32, 48]) entries.push({ size, png: await render(size) });
  fs.writeFileSync(image("favicon.ico"), ico(entries));
  fs.writeFileSync(image("apple-touch-icon.png"), await render(180, { background: "#fbf6ee", inset: 24 }));
  await browser.close();
  console.log("Wrote favicon.ico (16, 32, 48) and apple-touch-icon.png (180) from favicon.svg");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
