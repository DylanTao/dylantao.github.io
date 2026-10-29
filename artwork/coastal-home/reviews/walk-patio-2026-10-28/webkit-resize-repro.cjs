// Run from the repository with NODE_PATH pointing at the Playwright installation
// being compared. No site assets, Three.js, fake clock or popover are involved.
const fs = require("node:fs");
const path = require("node:path");
const { webkit } = require("playwright");
const { PNG } = require("pngjs");

const output = process.argv[2] || ".jekyll-cache/visual-qa/webkit-resize-repro";
fs.mkdirSync(output, { recursive: true });

(async () => {
  const browser = await webkit.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 1000 }, isMobile: true, hasTouch: true, deviceScaleFactor: 1 });
    await page.setContent(`<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1">
      <style>body{margin:0;background:white}canvas{display:block;width:350px;height:352px}</style>
      <canvas id="canvas" width="350" height="352"></canvas>
      <script>
        const canvas=document.getElementById('canvas');
        const gl=canvas.getContext('webgl2',{alpha:true,antialias:false,preserveDrawingBuffer:false});
        function draw(){
          gl.clearColor(1,.2,.1,1);gl.clear(gl.COLOR_BUFFER_BIT);
          const pixel=new Uint8Array(4);gl.readPixels(10,10,1,1,gl.RGBA,gl.UNSIGNED_BYTE,pixel);
          window.livePixel=Array.from(pixel);window.resizeProofFrames=(window.resizeProofFrames||0)+1;
          requestAnimationFrame(draw);
        }
        requestAnimationFrame(draw);
      </script>`);
    await page.waitForFunction(() => window.resizeProofFrames > 5);
    const beforeGpu = await page.evaluate(() => window.livePixel);
    const before = PNG.sync.read(await page.screenshot({ path: path.join(output, "before.png") }));
    const frame = await page.evaluate(() => {
      const canvas = document.querySelector("canvas");
      canvas.width = 390;
      canvas.height = 1000;
      canvas.getContext("webgl2").viewport(0, 0, 390, 1000);
      return window.resizeProofFrames;
    });
    await page.waitForFunction((value) => window.resizeProofFrames > value + 5, frame);
    const afterGpu = await page.evaluate(() => window.livePixel);
    const after = PNG.sync.read(await page.screenshot({ path: path.join(output, "after.png") }));
    const pixel = (image) => Array.from(image.data.subarray((40 + image.width * 40) * 4, (40 + image.width * 40) * 4 + 4));
    const proof = {
      platform: process.platform,
      playwright: require("playwright/package.json").version,
      browser: browser.version(),
      beforeGpu,
      afterGpu,
      beforeComposed: pixel(before),
      afterComposed: pixel(after),
      expected: [255, 51, 25, 255],
    };
    fs.writeFileSync(path.join(output, "proof.json"), JSON.stringify(proof, null, 2) + "\n");
    process.stdout.write(JSON.stringify(proof) + "\n");
  } finally {
    await browser.close();
  }
})().catch((error) => {
  process.stderr.write(String(error) + "\n");
  process.exitCode = 1;
});
