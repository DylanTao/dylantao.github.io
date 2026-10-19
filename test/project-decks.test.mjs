import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { deckChange, deckPath, fanAngles, fanFrames, foldFrames, parseDeckHash, startPath } from "../assets/js/project-decks.mjs";
import { spring } from "../assets/js/site-motion.mjs";

// The hierarchy as the projects index builds it from front matter: each project's `parent`.
const projectsDir = new URL("../_projects/", import.meta.url);
const parents = new Map();
for (const file of readdirSync(projectsDir).filter((name) => name.endsWith(".md"))) {
  // Windows checkouts (core.autocrlf) carry CRLF; CI carries LF.
  const source = readFileSync(new URL(file, projectsDir), "utf8").split("\r\n").join("\n");
  const front = source.match(/^---\n([\s\S]*?)\n---/)?.[1] || "";
  const parent = front.match(/^parent:\s*([a-z0-9-]+)\s*$/m)?.[1] || null;
  parents.set(file.replace(/\.md$/, ""), parent);
}

test("a deck hash names one deck", () => {
  assert.equal(parseDeckHash("#deck/graphics-lab"), "graphics-lab");
  assert.equal(parseDeckHash("#fun"), null);
  assert.equal(parseDeckHash("#deck/"), null);
  assert.equal(parseDeckHash("#deck/Graphics Lab"), null);
  assert.equal(parseDeckHash(""), null);
});

test("the site experiments nest from the website revamp down to the Graphics Lab", () => {
  assert.deepEqual(deckPath("graphics-lab", parents), ["website-revamp", "homepage-desk-scene", "graphics-lab"]);
  assert.deepEqual(deckPath("light-paths", parents), ["website-revamp", "homepage-desk-scene", "graphics-lab", "light-paths"]);
  assert.deepEqual(deckPath("graphics-performance", parents), ["website-revamp", "homepage-desk-scene", "graphics-lab", "graphics-performance"]);
  assert.deepEqual(deckPath("website-revamp", parents), ["website-revamp"]);
  // Every parent is a real project, and no chain loops.
  for (const [slug, parent] of parents) {
    if (!parent) continue;
    assert.ok(parents.has(parent), `${slug} names a missing parent ${parent}`);
    assert.ok(deckPath(slug, parents).length > 1, `${slug} does not reach the top`);
  }
  // Research stays its own top-level group.
  for (const slug of ["designweaver", "hotspot", "physion", "what-happened-and-why", "context-aware-encoding", "graphhscn"]) {
    assert.equal(parents.get(slug), null, `${slug} should stay top level`);
  }
});

test("the page starts on a shared level, else on the default deck where its media matches, else closed", () => {
  const wide = { defaultSlug: "website-revamp", defaultMatches: true };
  const narrow = { defaultSlug: "website-revamp", defaultMatches: false };
  // Sirui could not find the graphics work two closed decks down (2026-10-19): wide screens open the revamp.
  assert.deepEqual(startPath("", parents, wide), ["website-revamp"]);
  assert.deepEqual(startPath("", parents, narrow), []);
  assert.deepEqual(startPath("", parents), []);
  // A shared link wins on every screen.
  assert.deepEqual(startPath("#deck/graphics-lab", parents, wide), ["website-revamp", "homepage-desk-scene", "graphics-lab"]);
  assert.deepEqual(startPath("#deck/graphics-lab", parents, narrow), ["website-revamp", "homepage-desk-scene", "graphics-lab"]);
  // An unknown deck or a category anchor is not a level.
  assert.deepEqual(startPath("#deck/nowhere", parents, narrow), []);
  assert.deepEqual(startPath("#fun", parents, wide), ["website-revamp"]);
  assert.deepEqual(startPath("", parents, { defaultSlug: "nowhere", defaultMatches: true }), []);
});

test("unknown decks and loops give no path", () => {
  assert.deepEqual(deckPath("nowhere", parents), []);
  const loop = new Map([
    ["a", "b"],
    ["b", "a"],
  ]);
  assert.deepEqual(deckPath("a", loop), []);
});

test("a change between levels names what closes and what opens", () => {
  assert.deepEqual(deckChange([], ["a", "b"]), { closing: [], opening: ["a", "b"], depthChange: 2 });
  assert.deepEqual(deckChange(["a", "b", "c"], ["a"]), { closing: ["c", "b"], opening: [], depthChange: -2 });
  assert.deepEqual(deckChange(["a", "b"], ["a", "x"]), { closing: ["b"], opening: ["x"], depthChange: 0 });
});

test("children fan out like a hand of cards, never wider than 14 degrees either way", () => {
  assert.deepEqual(fanAngles(0), []);
  assert.deepEqual(fanAngles(1), [0]);
  const angles = fanAngles(11);
  assert.equal(angles.length, 11);
  assert.equal(angles[5], 0);
  assert.ok(Math.abs(angles[0]) <= 14 && Math.abs(angles.at(-1)) <= 14);
  assert.equal(angles[0], -angles.at(-1));
});

test("a card flying out of its deck fades in, bounces once and lands exactly at rest", () => {
  const frames = fanFrames(spring("layout"), spring("playful"), { x0: -320, y0: -180, s0: 0.4, r0: -8 });
  assert.equal(frames.at(-1).transform, "translate(0px, 0px) rotate(0deg) scale(1)");
  assert.equal(frames.at(-1).opacity, 1);
  assert.equal(frames[0].opacity, 0);
  assert.ok(
    frames.every((frame, i) => i === 0 || frame.offset > frames[i - 1].offset),
    "offsets increase"
  );
  const scales = frames.slice(0, -1).map((frame) => {
    const match = frame.transform.match(/scale\(([\d.]+), ([\d.]+)\)/);
    return Math.sqrt(Number(match[1]) * Number(match[2]));
  });
  assert.ok(Math.abs(scales[0] - 0.4) < 0.01, "it starts at the deck's size");
  assert.ok(Math.max(...scales) > 1.005, "the playful spring overshoots: a small bounce");
  assert.ok(Math.max(...scales) < 1.2, "a small bounce, not a jump");
});

test("a card leaving folds toward its target and is gone at the end", () => {
  const frames = foldFrames(spring("gentle"), { x1: 100, y1: -60, s1: 0.2, r1: 4 });
  assert.equal(frames[0].opacity, 1);
  assert.equal(frames.at(-1).opacity, 0);
  assert.match(frames.at(-1).transform, /translate\(100\.00px, -60\.00px\) rotate\(4\.00deg\) scale\(0\.2000\)/);
});
