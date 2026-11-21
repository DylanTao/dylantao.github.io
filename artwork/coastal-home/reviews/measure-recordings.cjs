// Compare whole performances at the site's shared output. Run against a built
// homepage. Optional third argument replays the first equal-gain experiment.
const { chromium } = require("playwright");
const { spawnSync } = require("node:child_process");

async function main() {
  const [home, ffmpeg = "ffmpeg", initialLevel] = process.argv.slice(2);
  if (!home || (initialLevel !== undefined && !(Number(initialLevel) > 0 && Number(initialLevel) <= 1))) {
    throw new Error("Usage: node measure-recordings.cjs HOMEPAGE [FFMPEG] [INITIAL_STYLE_GAIN]");
  }
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    await page.route("**/livereload.js*", (route) => route.fulfill({ contentType: "text/javascript", body: "" }));
    await page.goto(home, { waitUntil: "domcontentloaded" });
    const tracks = await page.evaluate(async (initialLevel) => {
      const script = document.querySelector('script[src*="/js/site-sound.mjs"]');
      const deck = document.querySelector("[data-record-track-sources]");
      const root = new URL("../../", script.src);
      const { COASTAL_THEME_LEVELS } = await import(new URL("assets/js/sound/coastal-music.mjs", root));
      if (!COASTAL_THEME_LEVELS) throw new Error("Rebuild the preview with the individual style playback gains before measuring.");
      const titles = deck.dataset.recordTrackTitles.split("|");
      return [
        ...deck.dataset.recordTrackSources.split("|").map((url, index) => ({ piece: titles[index], url, gain: 1 })),
        ...Object.entries(COASTAL_THEME_LEVELS).map(([piece, level]) => ({
          piece,
          url: new URL("assets/audio/coastal-score/" + piece + ".mp3", root).href,
          gain: initialLevel === null ? level : Number(initialLevel),
        })),
      ];
    }, initialLevel ?? null);

    const rows = [];
    for (const track of tracks) {
      const pcm = await page.evaluate(async ({ url, gain }) => {
        const siteSound = document.querySelector('script[src*="/js/site-sound.mjs"]').src;
        const { buildGraph } = await import(new URL("sound/engine.mjs", siteSound));
        const response = await fetch(url);
        if (!response.ok) throw new Error("Missing recording " + url);
        const decoder = new OfflineAudioContext(2, 1, 24000);
        const buffer = await decoder.decodeAudioData(await response.arrayBuffer());
        const context = new OfflineAudioContext(2, buffer.length, buffer.sampleRate);
        const graph = buildGraph(context);
        const source = context.createBufferSource();
        const fader = context.createGain();
        source.buffer = buffer;
        fader.gain.value = gain;
        source.connect(fader).connect(graph.dry);
        source.start();
        const mixed = await context.startRendering();
        const left = mixed.getChannelData(0);
        const right = mixed.getChannelData(1);
        const interleaved = new Int16Array(left.length * 2);
        for (let i = 0; i < left.length; i++) {
          interleaved[2 * i] = Math.round(32767 * left[i]);
          interleaved[2 * i + 1] = Math.round(32767 * right[i]);
        }
        const bytes = new Uint8Array(interleaved.buffer);
        const chunks = [];
        for (let i = 0; i < bytes.length; i += 16384) chunks.push(String.fromCharCode(...bytes.subarray(i, i + 16384)));
        return btoa(chunks.join(""));
      }, track);
      const args = [
        "-hide_banner",
        "-f",
        "s16le",
        "-ar",
        "24000",
        "-ac",
        "2",
        "-i",
        "pipe:0",
        "-af",
        "loudnorm=print_format=json",
        "-f",
        "null",
        "-",
      ];
      const meter = spawnSync(ffmpeg, args, { input: Buffer.from(pcm, "base64"), maxBuffer: 4 * 1024 * 1024 });
      if (meter.error) throw meter.error;
      if (meter.status !== 0) throw new Error(meter.stderr.toString());
      const log = meter.stderr.toString();
      const result = JSON.parse(log.slice(log.lastIndexOf("{"), log.lastIndexOf("}") + 1));
      rows.push({
        piece: track.piece,
        playbackGain: track.gain,
        integratedLUFS: Number(result.input_i),
        truePeakDBTP: Number(result.input_tp),
        loudnessRangeLU: Number(result.input_lra),
      });
    }
    process.stdout.write(JSON.stringify(rows, null, 2) + "\n");
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
