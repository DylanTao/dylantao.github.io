import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { ENTRY_KEY, TARGET_SELECTOR, followsEntry, pageKey } from "../assets/js/page-entry.mjs";

const here = { origin: "https://dylantao.github.io", pathname: "/projects/" };
const link = (href, extra = {}) => {
  const url = new URL(href, "https://dylantao.github.io/projects/");
  return { origin: url.origin, pathname: url.pathname, target: "", hasAttribute: (name) => name in extra, ...extra };
};

test("a page is matched by its address without query or fragment", () => {
  assert.equal(pageKey("https://dylantao.github.io/projects/graphics-lab/?x=1#top"), "https://dylantao.github.io/projects/graphics-lab/");
  assert.equal(pageKey("not a url ::"), "http://localhost/not%20a%20url%20::");
});

test("only a plain click on a same-site page carries its card", () => {
  assert.equal(followsEntry(link("/projects/graphics-lab/"), here, {}), true);
  assert.equal(followsEntry(link("https://example.org/paper"), here, {}), false, "other sites");
  assert.equal(followsEntry(link("/projects/#deck/website-revamp"), here, {}), false, "the same page");
  assert.equal(followsEntry(link("/assets/pdf/paper.pdf"), here, {}), false, "files");
  assert.equal(followsEntry(link("/publications/designweaver.bib"), here, {}), false, "files");
  assert.equal(followsEntry(link("/projects/graphics-lab/", { target: "_blank" }), here, {}), false, "new tabs");
  assert.equal(followsEntry(link("/projects/graphics-lab/"), here, { metaKey: true }), false, "modified clicks");
  assert.equal(followsEntry(link("/projects/graphics-lab/"), here, { button: 1 }), false, "middle clicks");
  assert.equal(followsEntry(null, here, {}), false);
});

test("the early listener in head.liquid and the module agree on names and targets", () => {
  const head = readFileSync(new URL("../_includes/head.liquid", import.meta.url), "utf8");
  assert.ok(head.includes(`sessionStorage.getItem('${ENTRY_KEY}')`));
  for (const name of ["entry-surface", "entry-title", "entry-media"]) assert.ok(head.includes(`'${name}'`), name);
  assert.ok(head.includes(TARGET_SELECTOR.replace(/"/g, "'")), "the same hero selector");
  // Only an expected entry holds the first frame, and only until the content is parsed.
  assert.match(head, /blocking', 'render'/);
  assert.match(head, /#entry-ready/);
  for (const layout of ["_layouts/page.liquid", "_layouts/post.liquid", "_pages/blog.md"]) {
    assert.ok(readFileSync(new URL(`../${layout}`, import.meta.url), "utf8").includes('id="entry-ready"'), layout);
  }
});
