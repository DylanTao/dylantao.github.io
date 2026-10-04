// Functional animation proof only. Performance captures keep native clocks.
async function pauseSceneClock(page, { advanceDate = true } = {}) {
  const time = await page.evaluate(() => Date.now());
  // Freeze Date while acquiring the pause across a busy software renderer.
  await page.clock.setFixedTime(time);
  await page.clock.pauseAt(time);
  if (advanceDate) await page.clock.setSystemTime(time);
}

async function useSoftwareSceneCadence(page) {
  if (process.platform !== "linux" && process.env.VISUAL_TRANSPORT_SOFTWARE !== "1") return;
  await page.evaluate(() => {
    const pending = new Set(),
      cancelOriginal = window.cancelAnimationFrame.bind(window);
    let inFrame = false;
    // A new input still draws promptly. Continuous callbacks sample the full
    // elapsed interval at 10 Hz, retaining the actual solver and rendered pixels.
    window.coastalProofCadence = { virtualHz: 10, firstFrameDelayMs: 16, timestamps: [] };
    window.requestAnimationFrame = (callback) => {
      const id = window.setTimeout(
        () => {
          pending.delete(id);
          const now = performance.now();
          window.coastalProofCadence.timestamps.push(now);
          inFrame = true;
          try {
            callback(now);
          } finally {
            inFrame = false;
          }
        },
        inFrame ? 1000 / 10 : 16
      );
      pending.add(id);
      return id;
    };
    window.cancelAnimationFrame = (id) => {
      if (pending.delete(id)) window.clearTimeout(id);
      else cancelOriginal(id);
    };
  });
}

module.exports = { pauseSceneClock, useSoftwareSceneCadence };
