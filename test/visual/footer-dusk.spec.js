const { test, expect } = require("@playwright/test");
const { writeFile } = require("node:fs/promises");
const { PNG } = require("pngjs");
const { preparePage, collectRuntimeErrors } = require("./helpers");
const { publicRouteUrl } = require("./public-routes");
const twoFrames = (page) => page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));

async function openClockBoundary(page) {
  await page.clock.setFixedTime(new Date("2026-10-19T18:22:00-07:00"));
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await preparePage(page, "noon");
  await page.addInitScript(() => {
    for (const key of ["theme", "theme-manual", "site-time"]) sessionStorage.removeItem(key);
    localStorage.removeItem("theme");
  });
  await page.goto(`${publicRouteUrl("/blog/")}?cinematic=live`, { waitUntil: "domcontentloaded" });
  const host = page.locator("footer [data-footer-coast]");
  await host.scrollIntoViewIfNeeded();
  await expect(host).toHaveAttribute("data-state", "ready", { timeout: 60000 });
  await page.evaluate(() => document.fonts.ready);
  await expect(page.locator("html")).toHaveAttribute("data-theme-mode", "afternoon");
  return host;
}

const meanPatch = (buffer) => {
  const p = PNG.sync.read(buffer),
    mean = [0, 0, 0];
  for (let i = 0; i < p.data.length; i += 4) for (let c = 0; c < 3; c++) mean[c] += p.data[i + c];
  return mean.map((sum) => sum / (p.width * p.height));
};

async function recordBoundary(page, testInfo, reading = true) {
  test.skip(!["desktop-1440", "mobile-390"].includes(testInfo.project.name));
  const errors = collectRuntimeErrors(page);
  const host = await openClockBoundary(page);
  const backend = await host.locator(".footer-coast__canvas").evaluate((canvas) => {
    const gl = canvas.getContext("webgl2"),
      extension = gl.getExtension("WEBGL_debug_renderer_info");
    return {
      buffer: [canvas.width, canvas.height],
      css: [canvas.clientWidth, canvas.clientHeight],
      renderer: gl.getParameter(extension ? extension.UNMASKED_RENDERER_WEBGL : gl.RENDERER),
    };
  });
  if (!reading) {
    await page.evaluate(() => scrollTo({ top: 0, left: 0, behavior: "instant" }));
    await twoFrames(page);
  }
  // Read the actual blank page gutter below the fixed header. A wide content-row sample also
  // includes text whose inherited color transitions can continue during a slow screenshot.
  // The page's own painted background must pass through the same strict intermediate colors.
  const clip = { x: 2, y: 100, width: 4, height: 16 };
  const before = await page.screenshot({ clip });
  const beforeState = await page.evaluate(() => ({
    mode: document.documentElement.dataset.themeMode,
    theme: document.documentElement.dataset.theme,
    body: getComputedStyle(document.body).backgroundColor,
    htmlBackground: getComputedStyle(document.documentElement).backgroundColor,
    root: getComputedStyle(document.documentElement).getPropertyValue("--global-bg-color"),
    scroll: [scrollX, scrollY],
    credit: (() => {
      const style = getComputedStyle(document.querySelector("footer.coastal-page-footer > .container"));
      return { color: style.color, shadow: style.textShadow };
    })(),
  }));
  if (!reading) expect(beforeState.scroll, "the native-head control starts at the actual document head").toEqual([0, 0]);
  // Freeze the real native or CSS/retained-frame animations at their creation. A software-WebGL
  // CI runner may take longer than the fade to answer IPC; evidence cannot depend on racing it.
  await page.evaluate(() => {
    window.__duskAnimations = [];
    const retain = (animation) => {
      if (window.__duskAnimations.includes(animation)) return;
      animation.pause();
      animation.currentTime = 0;
      window.__duskAnimations.push(animation);
    };
    const animate = Element.prototype.animate;
    Element.prototype.animate = function (...args) {
      const animation = animate.apply(this, args);
      if (this.classList.contains("theme-coast-retained")) retain(animation);
      return animation;
    };
    if (document.startViewTransition) {
      const start = document.startViewTransition.bind(document);
      document.startViewTransition = (update) => {
        const transition = start(update);
        transition.ready.then(() => {
          const animation = document.getAnimations().find((a) => a.animationName === "site-theme-crossfade");
          if (!animation) return;
          retain(animation);
          window.__duskAnimation = animation;
          window.__duskPath = "native snapshot";
        });
        return transition;
      };
    }
    window.__retainDuskColors = () => {
      document.body.getBoundingClientRect();
      const colors = document
        .getAnimations()
        .filter((a) => /^(color|background-color|border.*color|box-shadow|text-shadow|fill|stroke)$/.test(a.transitionProperty));
      colors.forEach(retain);
      const background = colors.find((a) => a.transitionProperty === "background-color" && a.effect.target === document.body);
      if (background) {
        window.__duskAnimation = background;
        window.__duskPath = "reading colors and retained coast";
      }
    };
  });
  await page.clock.setFixedTime(new Date("2026-10-19T18:23:00-07:00"));
  await page.evaluate(() => {
    applyAutomaticThemeIfNeeded();
    window.__retainDuskColors();
    // The coast's MutationObserver applies its halo in the next microtask. Freeze those real
    // shadow transitions there too, before a slow CI round trip can let them finish off camera.
    queueMicrotask(() => window.__retainDuskColors());
  });
  await page.waitForFunction(() => Boolean(window.__duskAnimation));
  const frames = [];
  let repeatedMean, repeatState;
  for (const time of [0, 175, 350, 525, 700]) {
    await page.evaluate((time) => {
      window.__duskAnimations.forEach((animation) => (animation.currentTime = time));
    }, time);
    await twoFrames(page);
    const frame = await page.screenshot({ clip, path: testInfo.outputPath(`dusk-${time}.png`) });
    const animation = await page.evaluate(() => ({
      currentTime: window.__duskAnimation.currentTime,
      playState: window.__duskAnimation.playState,
      progress: window.__duskAnimation.effect.getComputedTiming().progress,
      path: window.__duskPath,
      animations: window.__duskAnimations.map((a) => ({
        name: a.animationName || a.transitionProperty || "retained coast",
        target: a.effect.target?.className || a.effect.target?.tagName,
        currentTime: a.currentTime,
      })),
      opacity: getComputedStyle(document.documentElement, "::view-transition-new(root)").opacity,
      activeClass: document.documentElement.classList.contains("theme-crossfading"),
      body: getComputedStyle(document.body).backgroundColor,
      htmlBackground: getComputedStyle(document.documentElement).backgroundColor,
      scroll: [scrollX, scrollY],
      credit: (() => {
        const style = getComputedStyle(document.querySelector("footer.coastal-page-footer > .container"));
        return { color: style.color, shadow: style.textShadow };
      })(),
    }));
    frames.push({ time, mean: meanPatch(frame), animation });
    if (time === 175) {
      await page.evaluate(() => {
        const owned = () =>
          window.__duskAnimations.filter(
            (a) => a.animationName === "site-theme-crossfade" || a.effect.target?.classList?.contains("theme-coast-retained")
          );
        window.__duskRepeatBefore = {
          driver: window.__duskAnimation,
          frames: [...document.querySelectorAll(".theme-coast-retained")],
          animations: owned(),
          owned,
        };
        setThemeSetting("evening", { persist: false, manual: false });
      });
      await twoFrames(page);
      repeatedMean = meanPatch(await page.screenshot({ clip, path: testInfo.outputPath("dusk-repeat.png") }));
      repeatState = await page.evaluate(() => {
        const before = window.__duskRepeatBefore,
          frames = [...document.querySelectorAll(".theme-coast-retained")],
          animations = before.owned();
        return {
          sameDriver: window.__duskAnimation === before.driver,
          sameFrames: frames.length === before.frames.length && frames.every((frame, i) => frame === before.frames[i]),
          sameAnimations: animations.length === before.animations.length && animations.every((animation, i) => animation === before.animations[i]),
          body: getComputedStyle(document.body).backgroundColor,
        };
      });
    }
    if ([0, 350, 700].includes(time)) {
      if (reading) await page.locator("footer").screenshot({ path: testInfo.outputPath(`dusk-coast-${time}.png`) });
      else await page.screenshot({ path: testInfo.outputPath(`dusk-page-${time}.png`) });
    }
  }
  const start = frames[0].mean,
    end = frames.at(-1).mean;
  await writeFile(
    testInfo.outputPath("dusk-transition-recorder.json"),
    JSON.stringify({ clip, backend, before: meanPatch(before), beforeState, frames, repeatedMean, repeatState, errors }, null, 2)
  );
  if (reading) expect(frames[0].animation.credit, "the credit's old halo stays with its old ink when the blend starts").toEqual(beforeState.credit);
  expect(repeatState.sameDriver, "repeating a mode keeps the current palette animation").toBe(true);
  expect(repeatState.sameFrames, "repeating a mode keeps the retained coastal frame").toBe(true);
  expect(repeatState.sameAnimations, "repeating a mode does not replace the live blend").toBe(true);
  expect(Math.hypot(...repeatedMean.map((v, c) => v - frames[1].mean[c])), "repeated arc positions do not replace a live blend").toBeLessThan(2);
  const distance = Math.hypot(...end.map((v, c) => v - start[c]));
  expect(distance, "the actual page palette changes").toBeGreaterThan(100);
  const direction = end.map((v, c) => (v - start[c]) / distance);
  const progress = frames.map((f) => f.mean.reduce((sum, v, c) => sum + (v - start[c]) * direction[c], 0) / distance);
  expect(progress[2], "the middle frame must retain both lights").toBeGreaterThan(0.25);
  expect(progress[2]).toBeLessThan(0.75);
  for (let i = 1; i < progress.length; i++) {
    expect(progress[i]).toBeGreaterThan(progress[i - 1]);
    expect(progress[i] - progress[i - 1], "no cream/navy single-frame jump").toBeLessThan(0.6);
  }
  await page.evaluate(() => window.__duskAnimations.forEach((animation) => animation.finish()));
  await page.waitForFunction(() => !document.documentElement.classList.contains("theme-crossfading"));
  await expect(page.locator("html")).toHaveAttribute("data-theme-mode", "evening");
  await page.screenshot({ path: testInfo.outputPath("dusk-complete.png") });
  await writeFile(testInfo.outputPath("dusk-transition.json"), JSON.stringify({ frames, progress, before: meanPatch(before), errors }, null, 2));
  expect(errors).toEqual([]);
}

test("footer dusk: automatic page and sky boundaries crossfade continuously", async ({ page }, testInfo) => {
  await recordBoundary(page, testInfo);
});

test("footer dusk: page-head snapshots retain intermediate light", async ({ page }, testInfo) => {
  await recordBoundary(page, testInfo, false);
});

test("footer dusk: interruption, reduced motion and fallback keep the latest light", async ({ page }, testInfo) => {
  test.skip(!["desktop-1440", "mobile-390"].includes(testInfo.project.name));
  const errors = collectRuntimeErrors(page);
  await openClockBoundary(page);
  await page.evaluate(() => {
    setThemeSetting("evening");
    setThemeSetting("afternoon");
    setThemeSetting("noon");
  });
  await expect(page.locator("html")).toHaveAttribute("data-theme-mode", "noon");
  await page.waitForFunction(() => !document.documentElement.classList.contains("theme-crossfading"));
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.evaluate(() => setThemeSetting("evening"));
  await expect(page.locator("html")).toHaveAttribute("data-theme-mode", "evening");
  expect(await page.locator(".theme-coast-retained").count()).toBe(0);
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.evaluate(() => {
    document.startViewTransition = undefined;
    const animate = Element.prototype.animate;
    Element.prototype.animate = function (...args) {
      const animation = animate.apply(this, args);
      if (this.classList.contains("theme-coast-retained")) {
        animation.pause();
        animation.currentTime = 350;
        window.__fallbackAnimation = animation;
      }
      return animation;
    };
    setThemeSetting("morning");
    Element.prototype.animate = animate;
  });
  await expect(page.locator("html")).toHaveAttribute("data-theme-mode", "morning");
  await expect(page.locator(".theme-coast-retained")).toHaveCount(1);
  await page.locator("footer").screenshot({ path: testInfo.outputPath("fallback-crossfade.png") });
  await page.evaluate(() => window.__fallbackAnimation.finish());
  await expect(page.locator(".theme-coast-retained")).toHaveCount(0);
  await page.locator("footer").screenshot({ path: testInfo.outputPath("fallback-complete.png") });
  expect(errors).toEqual([]);
});
