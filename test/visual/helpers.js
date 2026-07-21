const { PNG } = require("pngjs");
const pixelmatchModule = require("pixelmatch");
const pixelmatch = pixelmatchModule.default || pixelmatchModule;

const NON_ACTIONABLE_CONSOLE_ERRORS = new Set(["Permissions policy violation: compute-pressure is not allowed in this document."]);

const DETERMINISTIC_EXTERNAL_STUB_HOSTS = [
  "badge.dimensions.ai",
  "badge.altmetric.com",
  "bsz.saop.cc",
  "cdn.jsdelivr.net",
  "cdnjs.cloudflare.com",
  "d1bxh8uas1mnw7.cloudfront.net",
  "fonts.googleapis.com",
  "fonts.gstatic.com",
  "github.githubassets.com",
  "img.shields.io",
  "plausible.io",
  "www.google-analytics.com",
  "www.googletagmanager.com",
  "www.youtube.com",
  "www.youtube-nocookie.com",
  "i.ytimg.com",
];

const EXTERNAL_IMAGE_STUB_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><circle cx="12" cy="12" r="8" fill="#d8e9e7"/></svg>`;
const EMPTY_EXTERNAL_STUB_SHA256 = "47DEQpj8HBSa+/TImW+5JCeuQeRkm5NMpJWZG3hSuFU=";

function isExpectedExternalStubIntegrityError(message) {
  const computedMatch = message.match(/resource '([^']+)' with computed SHA-256 integrity '([^']+)'/);
  if (computedMatch?.[2] === EMPTY_EXTERNAL_STUB_SHA256) {
    try {
      const hostname = new URL(computedMatch[1]).hostname.toLowerCase();
      return DETERMINISTIC_EXTERNAL_STUB_HOSTS.some((domain) => hostname === domain || hostname.endsWith(`.${domain}`));
    } catch {
      return false;
    }
  }

  // Linux WebKit reports the same intentionally empty jsDelivr stub without
  // the computed empty-body digest. Match only its exact no-content SRI
  // diagnostic and the npm path that applyNetworkStubs intercepts.
  const emptyStubMatch = message.match(
    /^Cannot load (?:stylesheet|script) (https:\/\/\S+)\. Failed integrity metadata check\. Content length: \(no content\), Expected content length: 0, Expected metadata: sha256-[A-Za-z0-9+/]+={0,2}$/
  );
  if (!emptyStubMatch) return false;

  try {
    const url = new URL(emptyStubMatch[1]);
    return url.hostname.toLowerCase() === "cdn.jsdelivr.net" && url.pathname.startsWith("/npm/");
  } catch {
    return false;
  }
}

const REPO_STATS_STUB_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="180" viewBox="0 0 400 180"><rect width="400" height="180" fill="#f3f4f6"/><rect x="8" y="8" width="384" height="164" rx="8" fill="#ffffff" stroke="#d1d5db"/><text x="20" y="42" font-size="20" font-family="Arial, sans-serif" fill="#111827">Repository Stats (stub)</text><text x="20" y="76" font-size="14" font-family="Arial, sans-serif" fill="#6b7280">Deterministic fixture for visual parity</text></svg>`;
const REPO_TROPHY_STUB_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="180" viewBox="0 0 400 180"><rect width="400" height="180" fill="#111827"/><rect x="8" y="8" width="384" height="164" rx="8" fill="#1f2937" stroke="#374151"/><text x="20" y="42" font-size="20" font-family="Arial, sans-serif" fill="#f9fafb">Repository Trophies (stub)</text><text x="20" y="76" font-size="14" font-family="Arial, sans-serif" fill="#d1d5db">Deterministic fixture for visual parity</text></svg>`;

async function applyNetworkStubs(page) {
  const matchesBlockedHost = (requestUrl) => {
    try {
      const hostname = new URL(requestUrl).hostname.toLowerCase();
      return DETERMINISTIC_EXTERNAL_STUB_HOSTS.some((domain) => hostname === domain || hostname.endsWith(`.${domain}`));
    } catch {
      return false;
    }
  };

  await page.route("**/*", (route) => {
    const url = route.request().url();
    if (/^http:\/\/127\.0\.0\.1:35729\/livereload\.js(?:\?|$)/.test(url)) {
      route.fulfill({ status: 200, contentType: "application/javascript", body: "" });
      return;
    }
    if (url.includes("github-readme-stats.vercel.app")) {
      route.fulfill({
        status: 200,
        contentType: "image/svg+xml",
        body: REPO_STATS_STUB_SVG,
      });
      return;
    }
    if (url.includes("github-profile-trophy.vercel.app")) {
      route.fulfill({
        status: 200,
        contentType: "image/svg+xml",
        body: REPO_TROPHY_STUB_SVG,
      });
      return;
    }
    if (matchesBlockedHost(url)) {
      const resourceType = route.request().resourceType();
      if (resourceType === "stylesheet") {
        route.fulfill({ status: 200, contentType: "text/css", body: "" });
      } else if (resourceType === "script") {
        route.fulfill({ status: 200, contentType: "application/javascript", body: "" });
      } else if (resourceType === "document") {
        route.fulfill({
          status: 200,
          contentType: "text/html",
          body: '<!doctype html><html lang="en"><title>Deterministic external embed stub</title><body></body></html>',
        });
      } else if (resourceType === "image") {
        route.fulfill({ status: 200, contentType: "image/svg+xml", body: EXTERNAL_IMAGE_STUB_SVG });
      } else {
        route.fulfill({ status: 204, contentType: "text/plain", body: "" });
      }
      return;
    }
    route.continue();
  });
}

async function preparePage(page, themeSetting = "light") {
  await page.addInitScript((setting) => {
    const normalizedSetting = setting === "dark" ? "evening" : setting === "light" ? "noon" : setting;
    window.sessionStorage.setItem("theme", normalizedSetting);
    window.sessionStorage.setItem("theme-manual", "true");
    window.localStorage.setItem("theme", setting);
  }, themeSetting);
  await applyNetworkStubs(page);
}

function collectRuntimeErrors(page) {
  const errors = [];
  page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));
  page.on("console", (message) => {
    const text = message.text();
    if (message.type() === "error" && !NON_ACTIONABLE_CONSOLE_ERRORS.has(text) && !isExpectedExternalStubIntegrityError(text)) {
      errors.push(`console.error: ${text}`);
    }
  });
  return errors;
}

async function stabilizeVisuals(page) {
  await page.evaluate(() => {
    const styleId = "__alfolio_visual_stabilize";
    if (document.getElementById(styleId)) {
      return;
    }
    const style = document.createElement("style");
    style.id = styleId;
    style.textContent = `
      *, *::before, *::after {
        animation-duration: 0ms !important;
        animation-delay: 0ms !important;
        caret-color: transparent !important;
      }
      .altmetric-embed,
      .__dimensions_badge_embed__,
      iframe.giscus-frame,
      #giscus_thread,
      .cc-window {
        visibility: hidden !important;
      }
    `;
    document.head.appendChild(style);
  });
}

function diffRatio(actualPng, baselinePng, options = {}) {
  const width = Math.min(actualPng.width, baselinePng.width);
  const height = Math.min(actualPng.height, baselinePng.height);
  const actual = new PNG({ width, height });
  const baseline = new PNG({ width, height });
  PNG.bitblt(actualPng, actual, 0, 0, width, height, 0, 0);
  PNG.bitblt(baselinePng, baseline, 0, 0, width, height, 0, 0);
  const diff = new PNG({ width, height });
  const changed = pixelmatch(actual.data, baseline.data, diff.data, width, height, {
    threshold: options.threshold ?? 0.1,
    includeAA: false,
  });
  return changed / (width * height);
}

function screenshotDiffRatio(actualBuffer, baselineBuffer, options = {}) {
  return diffRatio(PNG.sync.read(actualBuffer), PNG.sync.read(baselineBuffer), options);
}

function screenshotMetrics(buffer) {
  const png = PNG.sync.read(buffer);
  const colors = new Set();
  let sampledPixels = 0;
  let opaquePixels = 0;
  let luminanceTotal = 0;
  let luminanceSquaredTotal = 0;
  const sampleStep = Math.max(1, Math.floor(Math.min(png.width, png.height) / 180));

  for (let y = 0; y < png.height; y += sampleStep) {
    for (let x = 0; x < png.width; x += sampleStep) {
      const offset = (y * png.width + x) * 4;
      const red = png.data[offset];
      const green = png.data[offset + 1];
      const blue = png.data[offset + 2];
      const alpha = png.data[offset + 3];
      const luminance = red * 0.2126 + green * 0.7152 + blue * 0.0722;

      sampledPixels += 1;
      if (alpha > 8) opaquePixels += 1;
      luminanceTotal += luminance;
      luminanceSquaredTotal += luminance * luminance;
      if (colors.size < 4096) colors.add(`${red},${green},${blue},${alpha}`);
    }
  }

  const meanLuminance = luminanceTotal / Math.max(1, sampledPixels);
  const luminanceVariance = luminanceSquaredTotal / Math.max(1, sampledPixels) - meanLuminance * meanLuminance;

  return {
    height: png.height,
    luminanceVariance,
    opaqueRatio: opaquePixels / Math.max(1, sampledPixels),
    sampledPixels,
    uniqueColors: colors.size,
    width: png.width,
  };
}

async function attachScreenshot(page, testInfo, name, options = {}) {
  const outputPath = testInfo.outputPath(`${name.replace(/[^a-z0-9._-]+/gi, "-")}.png`);
  const capture = () =>
    options.locator
      ? options.locator.screenshot({ animations: "disabled", path: outputPath })
      : page.screenshot({ animations: "disabled", fullPage: options.fullPage !== false, path: outputPath });

  let body;
  try {
    body = await capture();
  } catch (error) {
    const isTransientChromiumCaptureFailure =
      error instanceof Error && error.message.includes("Protocol error (Page.captureScreenshot): Unable to capture screenshot");
    if (!isTransientChromiumCaptureFailure) throw error;

    await page.waitForTimeout(100);
    body = await capture();
  }

  await testInfo.attach(name, {
    path: outputPath,
    contentType: "image/png",
  });

  return body;
}

async function compareWithBaseline(context, currentPage, route, themeSetting, options = {}) {
  const fullPage = options.fullPage !== false;

  const captureParityScreenshot = async (page) => {
    if (!fullPage) {
      return page.screenshot({ fullPage: false });
    }

    const maxScreenshotDimension = 32760;
    const dimensions = await page.evaluate(() => {
      const doc = document.documentElement;
      const body = document.body || { scrollWidth: 0, scrollHeight: 0 };
      return {
        width: Math.max(doc.scrollWidth, body.scrollWidth, doc.clientWidth),
        height: Math.max(doc.scrollHeight, body.scrollHeight, doc.clientHeight),
      };
    });

    if (dimensions.width <= maxScreenshotDimension && dimensions.height <= maxScreenshotDimension) {
      return page.screenshot({ fullPage: true });
    }

    const viewport = page.viewportSize() || { width: 1280, height: 720 };
    const clipWidth = Math.max(1, Math.min(Math.max(viewport.width, dimensions.width), maxScreenshotDimension));
    const clipHeight = Math.max(1, Math.min(Math.max(viewport.height, dimensions.height), maxScreenshotDimension));

    return page.screenshot({
      fullPage: false,
      clip: {
        x: 0,
        y: 0,
        width: clipWidth,
        height: clipHeight,
      },
    });
  };

  const baselineURL = process.env.BASELINE_URL;
  if (!baselineURL) {
    return null;
  }
  const normalizedRoute = route.replace(/^\//, "");
  const normalizedBaselineRoot = baselineURL.endsWith("/") ? baselineURL : `${baselineURL}/`;
  const baselineTarget = new URL(normalizedRoute, normalizedBaselineRoot).toString();

  const baselinePage = await context.newPage();
  await preparePage(baselinePage, themeSetting);
  await baselinePage.goto(baselineTarget, { waitUntil: "networkidle" });
  await stabilizeVisuals(baselinePage);
  await baselinePage.waitForTimeout(500);
  const baselineBuffer = await captureParityScreenshot(baselinePage);

  await currentPage.goto(normalizedRoute, { waitUntil: "networkidle" });
  await stabilizeVisuals(currentPage);
  await currentPage.waitForTimeout(500);
  const currentBuffer = await captureParityScreenshot(currentPage);

  await baselinePage.close();

  return diffRatio(PNG.sync.read(currentBuffer), PNG.sync.read(baselineBuffer));
}

module.exports = {
  attachScreenshot,
  collectRuntimeErrors,
  isExpectedExternalStubIntegrityError,
  preparePage,
  screenshotDiffRatio,
  screenshotMetrics,
  stabilizeVisuals,
  compareWithBaseline,
};
