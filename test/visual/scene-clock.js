// Functional animation proof only. Performance captures keep native clocks.
async function pauseSceneClock(page, { advanceDate = true } = {}) {
  const time = await page.evaluate(() => Date.now());
  // Freeze Date while acquiring the pause across a busy software renderer.
  await page.clock.setFixedTime(time);
  await page.clock.pauseAt(time);
  if (advanceDate) await page.clock.setSystemTime(time);
}

async function useSoftwareSceneCadence(page, { continuousHz = 10 } = {}) {
  if (process.platform !== "linux" && process.env.VISUAL_TRANSPORT_SOFTWARE !== "1") return;
  await page.evaluate((virtualHz) => {
    const pending = new Set(),
      cancelOriginal = window.cancelAnimationFrame.bind(window);
    let inFrame = false;
    // A new input still draws promptly. Continuous callbacks sample the full
    // elapsed interval at the disclosed cadence, retaining the actual solver
    // and rendered pixels. Transport keeps 10 Hz for its 100 ms settle checks.
    window.coastalProofCadence = { virtualHz, firstFrameDelayMs: 16, timestamps: [] };
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
        inFrame ? 1000 / virtualHz : 16
      );
      pending.add(id);
      return id;
    };
    window.cancelAnimationFrame = (id) => {
      if (pending.delete(id)) window.clearTimeout(id);
      else cancelOriginal(id);
    };
  }, continuousHz);
}

module.exports = { pauseSceneClock, useSoftwareSceneCadence };
