import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";

const source = readFileSync(new URL("../assets/js/seo-optimization.js", import.meta.url), "utf8");

function eventTarget() {
  const listeners = new Map();
  return {
    addEventListener(type, listener, options = {}) {
      const entries = listeners.get(type) || [];
      entries.push({ listener, once: options.once });
      listeners.set(type, entries);
    },
    dispatch(type, event = {}) {
      for (const entry of [...(listeners.get(type) || [])]) {
        if (entry.once)
          listeners.set(
            type,
            listeners.get(type).filter((candidate) => candidate !== entry)
          );
        entry.listener(event);
      }
    },
  };
}

function browser({ readyState = "interactive", analytics = true, navigation = [{ startTime: 0, loadEventStart: 1490, loadEventEnd: 1500 }] } = {}) {
  const calls = [];
  const timers = [];
  const search = eventTarget();
  const document = {
    ...eventTarget(),
    readyState,
    documentElement: { scrollHeight: 2000, scrollTop: 0 },
    querySelector(selector) {
      return selector === "#search-input" ? search : null;
    },
    querySelectorAll() {
      return [];
    },
  };
  const window = {
    ...eventTarget(),
    innerHeight: 1000,
    pageYOffset: 0,
    setTimeout(callback) {
      timers.push(callback);
    },
  };
  if (navigation !== null) window.performance = { getEntriesByType: () => navigation };
  let now = 1000;
  const globals = { window, document, performance: window.performance, Date: { now: () => now } };
  if (analytics) globals.gtag = (...args) => calls.push(JSON.parse(JSON.stringify(args)));
  vm.runInNewContext(source, globals);
  return {
    window,
    document,
    search,
    navigation,
    calls,
    metrics: window.seoOptimization.metrics,
    flushTimers() {
      while (timers.length) timers.shift()();
    },
    scroll(offset, height = 2000) {
      window.pageYOffset = offset;
      document.documentElement.scrollHeight = height;
      window.dispatch("scroll");
    },
    advance(milliseconds) {
      now += milliseconds;
    },
    events(name) {
      return calls.filter((call) => call[1] === name).map((call) => call[2]);
    },
  };
}

test("load timing waits until handlers finish and measures navigation start through completed load", () => {
  const page = browser({ navigation: [{ startTime: 25.5, loadEventStart: 1470, loadEventEnd: 0 }] });
  assert.equal(page.calls.length, 0);
  page.window.dispatch("load");
  assert.equal(page.calls.length, 0, "an unfinished load event must not become a timing sample");
  page.navigation[0].loadEventEnd = 1475.75;
  page.flushTimers();
  assert.equal(page.metrics.pageLoadTime, 1450.25);
  assert.deepEqual(page.events("timing_complete"), [{ name: "page_load", value: 1450 }]);
  page.window.dispatch("load");
  page.flushTimers();
  assert.equal(page.events("timing_complete").length, 1);
});

test("a script initialized after load still records the completed navigation", () => {
  const page = browser({ readyState: "complete" });
  assert.equal(page.calls.length, 0);
  page.flushTimers();
  assert.equal(page.metrics.pageLoadTime, 1500);
  assert.deepEqual(page.events("timing_complete"), [{ name: "page_load", value: 1500 }]);
});

test("missing or incomplete navigation timing never fabricates a zero, negative, or nonfinite sample", () => {
  const entries = [
    null,
    [],
    [{ startTime: 0, loadEventEnd: 0 }],
    [{ startTime: 5, loadEventEnd: 4 }],
    [{ startTime: -1, loadEventEnd: 100 }],
    [{ startTime: Number.NaN, loadEventEnd: 100 }],
    [{ startTime: 0, loadEventEnd: Number.POSITIVE_INFINITY }],
    [{ loadEventEnd: 100 }],
  ];
  for (const navigation of entries) {
    const page = browser({ readyState: "complete", navigation });
    page.flushTimers();
    assert.equal(page.metrics.pageLoadTime, 0);
    assert.deepEqual(page.events("timing_complete"), []);
  }
});

test("each scroll threshold reports once with a numeric value and its existing readable label", () => {
  const page = browser();
  for (const offset of [250, 260, 490, 500, 510, 740, 750, 760, 990, 1000, 1100]) page.scroll(offset);
  assert.deepEqual(
    page.events("scroll_depth"),
    [25, 50, 75, 100].map((milestone) => ({ event_category: "engagement", event_label: `${milestone}%`, value: milestone }))
  );
  assert.equal(page.metrics.scrollDepth, 100);
});

test("large jumps report every crossed threshold and high-water depth survives scrolling back", () => {
  const page = browser();
  page.scroll(900);
  assert.deepEqual(
    page.events("scroll_depth").map((event) => event.value),
    [25, 50, 75]
  );
  assert.equal(page.metrics.scrollDepth, 90);
  page.scroll(100);
  assert.equal(page.metrics.scrollDepth, 90);
  page.scroll(1250);
  page.scroll(800);
  assert.deepEqual(
    page.events("scroll_depth").map((event) => event.value),
    [25, 50, 75, 100]
  );
  assert.equal(page.metrics.scrollDepth, 100);
});

test("thresholds are actual percentages rather than rounded-up reading progress", () => {
  const page = browser();
  page.scroll(249.99);
  assert.deepEqual(page.events("scroll_depth"), []);
  assert.ok(page.metrics.scrollDepth < 25);
  page.scroll(250);
  assert.deepEqual(
    page.events("scroll_depth").map((event) => event.value),
    [25]
  );
});

test("zero-height pages, overscroll, and invalid geometry cannot emit impossible depth", () => {
  const page = browser();
  for (const [offset, height] of [
    [100, 1000],
    [100, 900],
    [100, Number.NaN],
    [100, Number.POSITIVE_INFINITY],
    [Number.NaN, 2000],
    [Number.POSITIVE_INFINITY, 2000],
    [-100, 2000],
  ]) {
    page.scroll(offset, height);
  }
  assert.equal(page.metrics.scrollDepth, 0);
  assert.deepEqual(page.events("scroll_depth"), []);
  page.scroll(5000);
  assert.equal(page.metrics.scrollDepth, 100);
  assert.deepEqual(
    page.events("scroll_depth").map((event) => event.value),
    [25, 50, 75, 100]
  );
});

test("a real zero page offset takes precedence over the document fallback", () => {
  const page = browser();
  page.document.documentElement.scrollTop = 500;
  page.scroll(0);
  assert.equal(page.metrics.scrollDepth, 0);
  assert.deepEqual(page.events("scroll_depth"), []);
  page.scroll(undefined);
  assert.equal(page.metrics.scrollDepth, 50);
  assert.deepEqual(
    page.events("scroll_depth").map((event) => event.value),
    [25, 50]
  );
});

test("public initialization is idempotent even before DOMContentLoaded", () => {
  const page = browser({ readyState: "loading" });
  page.window.seoOptimization.init();
  page.window.seoOptimization.init();
  page.document.readyState = "interactive";
  page.document.dispatch("DOMContentLoaded");
  page.scroll(800);
  page.advance(4200);
  page.window.dispatch("beforeunload");
  page.window.dispatch("load");
  page.flushTimers();
  assert.deepEqual(
    page.events("scroll_depth").map((event) => event.value),
    [25, 50, 75]
  );
  assert.deepEqual(page.events("timing_complete"), [
    { name: "time_on_page", value: 4 },
    { name: "page_load", value: 1500 },
  ]);
  assert.equal(page.metrics.userEngagement, 4);
});

test("metrics still update without analytics and elapsed time remains nonnegative", () => {
  const page = browser({ analytics: false, readyState: "complete" });
  page.flushTimers();
  page.scroll(870);
  page.advance(4200);
  page.window.dispatch("beforeunload");
  assert.equal(page.metrics.pageLoadTime, 1500);
  assert.equal(page.metrics.scrollDepth, 87);
  assert.equal(page.metrics.userEngagement, 4);
  page.advance(-10000);
  page.window.dispatch("beforeunload");
  assert.equal(page.metrics.userEngagement, 0);
  assert.deepEqual(page.calls, []);
});

test("existing search events still require Enter and no new analytics requests are made", () => {
  const page = browser();
  page.search.dispatch("input", { target: { value: "design" } });
  page.search.dispatch("keypress", { key: "d", target: { value: "design" } });
  assert.deepEqual(page.calls, []);
  page.search.dispatch("keypress", { key: "Enter", target: { value: "design" } });
  assert.deepEqual(page.calls, [["event", "search", { search_term: "design" }]]);
});
