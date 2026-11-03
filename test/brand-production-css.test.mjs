import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";
import { defaultOptions, PurgeCSS } from "purgecss";

const require = createRequire(import.meta.url);
const configuration = require("../purgecss.config.js");
// The state attribute is intentionally absent from the initial HTML and literal
// script tokens: the browser creates it through dataset after visitor input.
const content = [
  {
    raw: '<div class="site-brand"><button class="site-brand-name"><span class="brand-name-first">Sirui</span><span class="brand-name-identity">Tao</span><span class="brand-name-story"><span class="brand-wave-letter">a</span></span></button></div>',
    extension: "html",
  },
  { raw: 'brand.dataset.brandState = "discovering"; brand.dataset.brandState = "adrift";', extension: "js" },
];
const css = `
.site-brand[data-brand-state="discovering"] .brand-name-first { animation: brand-name-drift 4.8s ease both; }
.site-brand[data-brand-state="adrift"] .brand-name-identity { visibility: hidden; }
.site-brand[data-brand-state="adrift"] .brand-name-story { opacity: 1; }
.site-brand[data-brand-state] .brand-wave-letter { animation: brand-letter-float 5.6s infinite; }
@media (max-width: 991px) { .site-brand[data-brand-state="discovering"] .brand-name-first { animation-name: brand-compact-name-drift; } }
@media (prefers-reduced-motion: reduce) { .site-brand[data-brand-state] * { animation: none !important; } }
@keyframes brand-name-drift { to { opacity: 0; } }
@keyframes brand-compact-name-drift { to { opacity: 0; } }
@keyframes brand-letter-float { to { transform: translateY(-1px); } }
.unused-cleanup-control { color: red; }
@keyframes unused-cleanup-control { to { opacity: 0; } }
`;

async function process(safelist, defaultExtractor = configuration.defaultExtractor) {
  const [result] = await new PurgeCSS().purge({
    ...configuration,
    content,
    css: [{ raw: css }],
    safelist,
    defaultExtractor,
    keyframes: true,
  });
  return result.css;
}

test("production CSS cleanup retains the visitor-created brand animation and its compact/reduced-motion states", async () => {
  const output = await process(configuration.safelist);
  assert.match(output, /data-brand-state="discovering"/);
  assert.match(output, /data-brand-state="adrift"/);
  assert.match(output, /data-brand-state\]/);
  assert.match(output, /max-width: 991px/);
  assert.match(output, /prefers-reduced-motion: reduce/);
  assert.match(output, /@keyframes brand-name-drift/);
  assert.match(output, /@keyframes brand-compact-name-drift/);
  assert.match(output, /@keyframes brand-letter-float/);
  assert.doesNotMatch(output, /unused-cleanup-control/);
});

test("the retained pre-fix cleanup control removes those runtime selectors", async () => {
  const output = await process(
    {
      ...configuration.safelist,
      greedy: configuration.safelist.greedy.filter((pattern) => !pattern.test("data-brand-state")),
    },
    defaultOptions.defaultExtractor
  );
  assert.doesNotMatch(output, /data-brand-state/);
});
