const { webkit } = require("playwright"),
  { PNG } = require("pngjs"),
  fs = require("fs");
(async () => {
  const b = await webkit.launch(),
    p = await b.newPage({ viewport: { width: 390, height: 664 } });
  try {
    await p.setContent(
      '<body style="margin:0"><canvas id="c"></canvas><script>const gl=c.getContext("webgl");function resize(){c.width=innerWidth;c.height=innerHeight;gl.viewport(0,0,c.width,c.height)}onresize=resize;resize();function frame(){gl.clearColor(1,0,0,1);gl.clear(gl.COLOR_BUFFER_BIT);requestAnimationFrame(frame)}frame()</script>'
    );
    const rows = [];
    for (const height of [664, 844]) {
      await p.setViewportSize({ width: 390, height });
      await p.waitForTimeout(300);
      const bytes = await p.screenshot(),
        im = PNG.sync.read(bytes),
        i = ((im.height >> 1) * im.width + (im.width >> 1)) * 4;
      rows.push({ height, pixel: [...im.data.slice(i, i + 4)] });
      fs.writeFileSync(".jekyll-cache/visual-qa/finish-todos-2026-10-26/webkit-red-" + height + ".png", bytes);
    }
    fs.writeFileSync(
      ".jekyll-cache/visual-qa/finish-todos-2026-10-26/webkit-resize-repro.json",
      JSON.stringify({ browser: b.version(), platform: process.platform, rows }, null, 2)
    );
    console.log(rows);
  } finally {
    await b.close();
  }
})();
