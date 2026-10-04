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

async function useNativeSceneFrames(page) {
  await page.evaluate(() => {
    // Playwright retains these actual browser APIs when installing its clock.
    // Native RAF coalesces a busy renderer's missed frames; an automatically
    // advancing fake RAF instead tries to render the growing callback backlog.
    const native = window.__pwClock?.builtins;
    if (!native?.requestAnimationFrame || !native.cancelAnimationFrame || !native.performance)
      throw new Error("The installed Playwright clock must expose its native frame APIs for live-motion proof.");
    const cancelClockFrame = window.cancelAnimationFrame.bind(window);
    window.requestAnimationFrame = native.requestAnimationFrame;
    window.cancelAnimationFrame = (id) => {
      // A page companion can have one virtual request from before the switch.
      cancelClockFrame(id);
      native.cancelAnimationFrame(id);
    };
    window.performance = native.performance;
    window.coastalProofFrameClock = "native RAF and performance; controlled Date and timers";
  });
}

module.exports = { pauseSceneClock, useSoftwareSceneCadence, useNativeSceneFrames };
