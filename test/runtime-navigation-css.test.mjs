import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";
import { defaultOptions, PurgeCSS } from "purgecss";

const require = createRequire(import.meta.url);
const configuration = require("../purgecss.config.js");
const content = [
  {
    raw: '<html><details class="cv-mobile-sections" aria-expanded="false"></details><div class="duh-companion" aria-hidden="true"></div><div class="pip-companion"><span class="pip-speech"></span></div></html>',
    extension: "html",
  },
  {
    raw: 'n.dataset.cvEnhanced="";e.dataset.visible=String(v);r.dataset["speaking"]=String(s);d.dataset?.routeDirection;d.dataset.routeDirection="back";nav.className="section-reading-aid-mobile-"+variant;nav.classList.toggle("is-readable",ready);',
    extension: "js",
  },
];
const css = `
.cv-mobile-sections[data-cv-enhanced] { position: sticky; top: 4.2rem; }
.duh-companion[data-visible="false"] { visibility: hidden; }
.pip-companion[data-speaking="true"] .pip-speech { opacity: 1; }
html[data-route-direction="back"] { --route-sign: -1; }
.section-reading-aid-mobile-dock.is-readable { position: fixed; }
.section-reading-aid-mobile-inline { position: relative; }
.unreferenced-cleanup-control { color: red; }
`;
async function cleanup(overrides = {}) {
  const [result] = await new PurgeCSS().purge({ ...configuration, ...overrides, content, css: [{ raw: css }] });
  return result.css;
}

test("actual production cleanup retains runtime mobile navigation, companion visibility and page direction", async () => {
  const output = await cleanup();
  for (const selector of [
    "data-cv-enhanced",
    'data-visible="false"',
    'data-speaking="true"',
    "data-route-direction",
    "section-reading-aid-mobile-dock",
    "section-reading-aid-mobile-inline",
  ])
    assert.ok(output.includes(selector), selector);
  assert.match(output, /position: sticky/);
  assert.match(output, /position: fixed/);
  assert.doesNotMatch(output, /unreferenced-cleanup-control/);
});

test("the retained original extractor loses these runtime selectors despite their JavaScript being present", async () => {
  const output = await cleanup({
    defaultExtractor: defaultOptions.defaultExtractor,
    safelist: {
      ...configuration.safelist,
      standard: configuration.safelist.standard.filter((pattern) => !(pattern instanceof RegExp && pattern.test("section-reading-aid-mobile-dock"))),
    },
  });
  for (const selector of [
    "data-cv-enhanced",
    "data-visible",
    "data-speaking",
    "data-route-direction",
    "section-reading-aid-mobile-dock",
    "section-reading-aid-mobile-inline",
  ])
    assert.ok(!output.includes(selector), selector);
});
