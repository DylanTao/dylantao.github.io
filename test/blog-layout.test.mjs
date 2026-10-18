import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { LAYOUT_KEY, normalizeLayout, parseTags, readLayout, relatedNotes, sharedTags, writeLayout } from "../assets/js/blog-layout.mjs";
import { dropFrames, lensMap } from "../assets/js/liquid-drop.mjs";
import { spring } from "../assets/js/site-motion.mjs";

const memory = () => {
  const values = new Map();
  return { getItem: (key) => (values.has(key) ? values.get(key) : null), setItem: (key, value) => values.set(key, String(value)) };
};
const refusing = {
  getItem() {
    throw new DOMException("blocked", "SecurityError");
  },
  setItem() {
    throw new DOMException("blocked", "QuotaExceededError");
  },
};

test("the list is the default and only 'cards' changes it", () => {
  assert.equal(normalizeLayout(undefined), "list");
  assert.equal(normalizeLayout("grid"), "list");
  assert.equal(normalizeLayout("cards"), "cards");
});

test("a visitor's layout is remembered, and blocked storage falls back to the list", () => {
  const storage = memory();
  assert.equal(readLayout(storage), "list");
  assert.equal(writeLayout(storage, "cards"), true);
  assert.equal(storage.getItem(LAYOUT_KEY), "cards");
  assert.equal(readLayout(storage), "cards");
  assert.equal(writeLayout(storage, "something else"), true);
  assert.equal(readLayout(storage), "list");
  assert.equal(readLayout(refusing), "list");
  assert.equal(writeLayout(refusing, "cards"), false);
  assert.equal(readLayout(null), "list");
});

test("the page reads the same key before the first paint", () => {
  const page = readFileSync(new URL("../_pages/blog.md", import.meta.url), "utf8");
  assert.ok(page.includes(`localStorage.getItem('${LAYOUT_KEY}') === 'cards'`), "the inline script reads blog:layout");
  assert.match(page, /try \{[\s\S]*localStorage[\s\S]*\} catch/, "the inline read is wrapped in try/catch");
  assert.ok(page.includes('data-blog-layout="list"') && page.includes('data-blog-layout="cards"'));
  assert.ok(page.includes('role="radiogroup"'));
  // The hidden portal and its origin stay on the page.
  assert.ok(page.includes('id="sirui-secret-dog"'));
  assert.ok(page.includes("data-sirui-secret-origin"));
});

test("notes relate through the topics they share", () => {
  const a = { tags: parseTags("research hci gen-ai") };
  const b = { tags: parseTags("hci design") };
  const c = { tags: parseTags("pottery art") };
  assert.deepEqual(sharedTags(a.tags, b.tags), ["hci"]);
  assert.deepEqual(sharedTags(a.tags, c.tags), []);
  const related = relatedNotes(a, [a, b, c]);
  assert.equal(related.size, 1);
  assert.deepEqual(related.get(b), ["hci"]);
  assert.deepEqual(parseTags("  one   two "), ["one", "two"]);
});

test("the lens is neutral in the middle and pulls toward the centre at its rim", () => {
  const width = 44;
  const height = 44;
  const map = lensMap(width, height);
  const at = (x, y) => {
    const i = (y * width + x) * 4;
    return [map[i], map[i + 1], map[i + 2], map[i + 3]];
  };
  assert.deepEqual(at(22, 22), [128, 128, 128, 255]);
  const [rightR] = at(42, 22);
  const [leftR] = at(1, 22);
  const [, bottomG] = at(22, 42);
  const [, topG] = at(22, 1);
  assert.ok(rightR < 128 && leftR > 128, "horizontal rim pulls inward");
  assert.ok(bottomG < 128 && topG > 128, "vertical rim pulls inward");
  assert.ok(Math.abs(128 - rightR - (leftR - 128)) <= 2, "symmetric");
  assert.deepEqual(at(0, 0), [128, 128, 128, 255], "outside the lens is untouched");
});

test("a drop buds small, stretches along its path and lands at rest", () => {
  const frames = dropFrames(spring("layout"), spring("playful"), { x0: -48, s0: 0.3 });
  assert.equal(frames.at(-1).transform, "translate(0px, 0px) scale(1)");
  const stretches = frames.slice(0, -1).map((frame) => {
    const match = frame.transform.match(/scale\(([\d.]+), ([\d.]+)\)/);
    return Number(match[1]) / Number(match[2]);
  });
  assert.ok(Math.max(...stretches) > 1.2, "it stretches while it moves fastest");
  assert.ok(Math.abs(stretches.at(-1) - 1) < 0.2, "it is nearly round as it lands");
});
