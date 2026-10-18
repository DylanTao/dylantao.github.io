// node --test test/light-lab-chart.test.mjs
// The race chart and pool-floor view on /projects/light-paths/ (assets/js/light-lab/chart.mjs).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  ERROR_DOMAIN,
  MARGIN,
  TIME_START,
  blankFrameError,
  chartMarkup,
  decadeTicks,
  describeElapsed,
  describeWait,
  logScale,
  percent,
  sqrtGuide,
  takeaway,
  timeTicks,
  timeToReach,
} from "../assets/js/light-lab/chart.mjs";
import { POOL_CROP, luminanceRmse } from "../assets/js/light-lab/core.mjs";

const root = new URL("..", import.meta.url);
const reference = JSON.parse(readFileSync(new URL("assets/js/light-lab/onsen-reference.json", root), "utf8"));
// The run recorded on Sirui's laptop, as page.mjs draws it.
const RECORDED = {
  pt: [
    [5, 30.97],
    [10, 25.43],
    [20, 16.09],
    [40, 11.88],
    [60, 9.84],
  ],
  mlt: [
    [5, 2.88],
    [10, 2.94],
    [20, 3.0],
    [40, 2.37],
    [60, 1.8],
  ],
};
const close = (a, b, tolerance = 1e-9) => Math.abs(a - b) <= tolerance * Math.max(1, Math.abs(b));

test("log scales give every decade the same room and clamp outside their domain", () => {
  const y = logScale(0.1, 1000, 200, 0);
  assert.equal(y(0.1), 200);
  assert.equal(y(1000), 0);
  assert.ok(close(y(1), 150) && close(y(10), 100) && close(y(100), 50));
  assert.equal(y(0.01), 200);
  assert.equal(y(1e6), 0);
  assert.deepEqual(decadeTicks(...ERROR_DOMAIN).map(percent), ["10%", "100%", "1,000%", "10,000%", "100,000%"]);
});

test("time ticks climb 1-2-5 from half a second and close the axis in minutes", () => {
  assert.deepEqual(
    timeTicks(60).map((t) => t.label),
    ["0.5 s", "1 s", "2 s", "5 s", "10 s", "20 s", "1 min"]
  );
  assert.deepEqual(
    timeTicks(120)
      .slice(-2)
      .map((t) => t.label),
    ["1 min", "2 min"]
  );
  assert.deepEqual(
    timeTicks(180)
      .slice(-3)
      .map((t) => t.label),
    ["1 min", "2 min", "3 min"]
  );
  assert.equal(timeTicks(60)[0].value, TIME_START);
});

test("the guide falls as 1/sqrt(time) through its anchor", () => {
  const anchor = [60, 9.84];
  const [[t0, e0], [t1, e1]] = sqrtGuide(anchor, 0.5, 120);
  assert.equal(t0, 0.5);
  assert.equal(t1, 120);
  for (const [t, e] of [
    [t0, e0],
    [t1, e1],
  ])
    assert.ok(close(e * Math.sqrt(t), 9.84 * Math.sqrt(60)));
  const slope = (Math.log10(e1) - Math.log10(e0)) / (Math.log10(t1) - Math.log10(t0));
  assert.ok(close(slope, -0.5));
});

test("the time to match grows with the square of the error ratio", () => {
  assert.ok(close(timeToReach(60, 9.84, 1.8), 60 * (9.84 / 1.8) ** 2));
  // Four times the time halves the error, so halving it costs four times as long.
  assert.ok(close(timeToReach(10, 2, 1), 40));
  assert.equal(timeToReach(60, 1.8, 9.84), null);
  assert.equal(timeToReach(60, 2, 2), null);
  assert.equal(timeToReach(0, 2, 1), null);
  assert.equal(timeToReach(60, 2, 0), null);
});

test("elapsed times and long waits read the way people say them", () => {
  assert.equal(describeElapsed(60), "a minute");
  assert.equal(describeElapsed(120.4), "two minutes");
  assert.equal(describeElapsed(20.2), "20 seconds");
  assert.equal(describeWait(45), "about 45 seconds");
  assert.equal(describeWait(1793), "about 30 minutes");
  assert.equal(describeWait(1507), "about 25 minutes");
  assert.equal(describeWait(7200), "about 2 hours");
  assert.equal(describeWait(200000), "about 2 days");
});

test("the takeaway projects path tracing to Metropolis's error and names its assumption", () => {
  assert.equal(
    takeaway({ time: 60, pt: 9.84, mlt: 1.8 }, { recorded: true }),
    "In my recorded run, path tracing would need about 30 minutes to get as close to the reference as Metropolis did in a minute, if its error kept falling as 1/√time."
  );
  assert.equal(
    takeaway({ time: 20, pt: 24, mlt: 2.9 }),
    "Path tracing would need about 25 minutes to get as close to the reference as Metropolis did in 20 seconds, if its error kept falling as 1/√time."
  );
  assert.equal(takeaway({ time: 40, pt: 1.2, mlt: 1.5 }), "Path tracing is ahead after 40 seconds.");
  assert.equal(takeaway({ time: 1, pt: 200, mlt: 3.9 }), "");
  assert.equal(takeaway({ time: 30, pt: null, mlt: 2 }), "");
  assert.equal(takeaway(null), "");
});

test("an all-black frame scores 393% against the shipped reference", () => {
  assert.ok(close(blankFrameError({ luminance: [1, 1, 1, 1] }), 1));
  assert.ok(close(blankFrameError({ luminance: [0, 0, 0, 4] }), 2));
  const blank = blankFrameError(reference);
  assert.equal(percent(blank), "393%");
  // The same number the renderers' error measure gives an empty image.
  const black = new Float32Array(240 * 180 * 3);
  assert.ok(close(luminanceRmse(black, 240, 180, reference).relative, blank, 1e-12));
});

function count(markup, pattern) {
  return (markup.match(pattern) || []).length;
}

test("before a run the chart reads the recording: guide, black-frame floor and labelled ends", () => {
  const { markup, viewBox } = chartMarkup({ width: 600, height: 240, recorded: RECORDED, blank: 3.93 });
  assert.equal(viewBox, "0 0 600 240");
  assert.equal(count(markup, /light-lab-line--recorded/g), 2);
  assert.equal(count(markup, /<polyline class="light-lab-line light-lab-line--(pt|mlt)"/g), 0);
  assert.equal(count(markup, /class="light-lab-guide"/g), 1);
  assert.equal(count(markup, /class="light-lab-blank"/g), 1);
  assert.ok(markup.includes(">all-black frame<"));
  assert.ok(markup.includes(">∝ 1/√time<"));
  assert.ok(markup.includes(">984%</text>") && markup.includes(">180%</text>"));
  for (const label of ["10%", "100,000%", "0.5 s", "1 min"]) assert.ok(markup.includes(`>${label}</text>`), label);
});

test("during a run the live lines carry the labels and anchor the guide, clipped to the axes", () => {
  const live = {
    pt: [
      [0.2, 3.9],
      [1, 220],
      [10, 27],
      [30, 15],
    ],
    mlt: [
      [0.2, 3.93],
      [1, 3.6],
      [10, 2.9],
      [30, 2.8],
    ],
  };
  const width = 600,
    height = 240;
  const { markup } = chartMarkup({ width, height, live, recorded: RECORDED, blank: 3.93 });
  assert.equal(count(markup, /<polyline class="light-lab-line light-lab-line--(pt|mlt)"/g), 2);
  assert.equal(count(markup, /light-lab-line--recorded/g), 2);
  assert.ok(markup.includes(">1,500%</text>") && markup.includes(">280%</text>"));
  assert.ok(!markup.includes(">984%</text>"), "recorded ends are not labelled during a live run");
  // Reference-line labels are drawn over the data lines, so a steep jump never cuts through them.
  const lastLine = markup.lastIndexOf("<polyline");
  assert.ok(markup.indexOf(">∝ 1/√time<") > lastLine && markup.indexOf(">all-black frame<") > lastLine);
  // Points before the axis starts are left out rather than squashed onto its edge.
  const ptLine = markup.match(/light-lab-line--pt" points="([^"]+)"/)[1].split(" ");
  assert.equal(ptLine.length, 3);
  // The guide passes through path tracing's latest point.
  const x = logScale(TIME_START, 60, MARGIN.left, width - MARGIN.right);
  const y = logScale(...ERROR_DOMAIN, height - MARGIN.bottom, MARGIN.top);
  const [gx1, gy1, gx2, gy2] = markup
    .match(/class="light-lab-guide" x1="([\d.]+)" y1="([\d.]+)" x2="([\d.]+)" y2="([\d.]+)"/)
    .slice(1)
    .map(Number);
  const yAt = gy1 + ((gy2 - gy1) * (x(30) - gx1)) / (gx2 - gx1);
  assert.ok(Math.abs(yAt - y(15)) < 0.2, `guide at 30 s is ${yAt}, expected ${y(15)}`);
});

test("other sun sizes have no reference, so the chart says so and draws no error lines", () => {
  const { markup } = chartMarkup({ note: "The reference exists for the 0.8° sun only, so this run has no error curve." });
  assert.ok(markup.includes("The reference exists for the 0.8° sun only"));
  assert.equal(count(markup, /<polyline/g), 0);
  assert.equal(count(markup, /light-lab-guide|light-lab-blank/g), 0);
});

function pngSize(path) {
  const bytes = readFileSync(new URL(path, root));
  return [bytes.readUInt32BE(16), bytes.readUInt32BE(20)];
}

test("the page wires a live pool-floor canvas and a still for each renderer and the reference", () => {
  const page = readFileSync(new URL("_projects/light-paths.md", root), "utf8");
  for (const method of ["pt", "mlt"])
    assert.ok(
      page.includes(`<canvas data-light-lab-zoom="${method}" width="${POOL_CROP.width}" height="${POOL_CROP.height}" aria-hidden="true"></canvas>`),
      method
    );
  assert.equal(page.match(/class="light-lab-zoom-box"/g).length, 3);
  assert.ok(page.includes("data-light-lab-takeaway"));
  for (const name of ["pt-60s-pool", "mlt-60s-pool", "reference-pool"]) {
    assert.ok(page.includes(`/assets/img/project_pics/light-paths/${name}.png`), name);
    assert.deepEqual(pngSize(`assets/img/project_pics/light-paths/${name}.png`), [POOL_CROP.width, POOL_CROP.height]);
  }
  for (const name of ["pt-05s", "pt-60s", "mlt-05s", "mlt-60s", "reference"])
    assert.deepEqual(pngSize(`assets/img/project_pics/light-paths/${name}.png`), [240, 180]);
});
