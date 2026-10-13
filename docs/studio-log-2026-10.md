# Studio log, October 2026

A working record of design moves on this site, kept in the loop Sirui describes after Schön's _The Reflective Practitioner_: make a move, let the material talk back, then reframe the next move. Each card names the **dimensions** being moved, the scaffold that turns a vague "make it better" into variables someone can reason about.

Unpublished (`docs/` is excluded from the build). A public version in Sirui's voice is offered only after he approves it.

| Field      | What it records                                                  |
| ---------- | ---------------------------------------------------------------- |
| Frame      | The visitor problem or design question, in one sentence          |
| Dimensions | The named variables being moved                                  |
| Move       | What changed, with the file                                      |
| Backtalk   | What the rendered result and the numbers said, failures included |
| Reframe    | The next move, or why we stopped                                 |
| Concept    | A short explainer and its primary source                         |

---

## 1. The screenshot that ran out of memory

- **Frame:** The CI visual checkpoints had been red since the companion landed on October 9; Linux Chromium could not capture the full HCI Spooder-Man page.
- **Dimensions:** decoded bitmap bytes per page (width × height × 4), image count, capture area.
- **Move:** `_includes/responsive_variant.liquid` serves the 480/800/1400-pixel WebP variants that CI's ImageMagick step already generates, sized to how large each image is actually shown (gallery slides, thumbnails, card and call-to-action teasers).
- **Backtalk:** The page's transfer fell from 33 MB to 5.2 MB on the local preview. Twenty images were wider than 1,600 pixels; one 3,838 × 1,588 PNG alone decodes to about 24 MB of RGBA in memory, whatever its 4 MB file size. A Windows capture of the old page succeeded every time, which is why the failure looked random.
- **Reframe:** Prove it on the Linux runner image before calling the gate fixed; only if it still fails, quiet the companion's canvas under automation. Result: in the official `mcr.microsoft.com/playwright:v1.58.2-noble` image, the live page failed one of two baseline runs (a runtime-error assertion, not the CI capture crash, so the old page was unstable in more than one way), while the fixed page passed 16 of 16 runs (two routes × four viewports × two repeats, light and dark).
- **Concept:** File size and memory are different budgets. Browsers keep images decoded as bitmaps, so a capture's cost scales with pixel dimensions, not compressed bytes. Serving pixels at display size fixes both the download and the decode.

## 2. Four tries at an invisible-but-findable mark, then removal

- **Frame:** A tiny origin "glint" beside seven widgets read as a stray rendering speck in the October 12 review.
- **Dimensions:** salience at rest versus on engagement, repetition (seven placements), target size, wording.
- **Move:** Removed the mark; the projects-index line that already had a visible label became a plain text link. Only the hidden blog portal keeps its reveal-on-discovery origin.
- **Backtalk:** The history is the evidence: a dot-and-line (read as a slider), a hover disclosure (confusing), a "story ↗" wordmark (too loud when repeated), then the glint (read as an artifact). Each tried to be both invisible and discoverable.
- **Reframe:** Route-finding belongs to labelled places (the projects index, each case page), not to decorations on the work.
- **Concept:** _Information scent_ (Pirolli & Card, "Information Foraging", _Psychological Review_ 1999): people follow cues whose wording predicts the destination. An unlabelled speck carries no scent, so no amount of polish makes it findable.

## 3. Hidden from screen readers is not hidden from the eye

- **Frame:** On phones, duh settled on top of the homepage Research Focus diagram and wandered across it.
- **Dimensions:** the companion's obstacle set (what it treats as content), accessibility semantics versus visual importance.
- **Move:** The diagram's stage carries `data-duh-protect`, which the companion's layout scan treats as protected (`assets/js/companion/duh-page.mjs`); a phone test asserts duh never rests on the diagram or the Connect miniature.
- **Backtalk:** The canvas is `aria-hidden` on purpose, because a text readout narrates it. The companion read `aria-hidden` as "decorative" and skipped it. One attribute, two meanings.
- **Reframe:** Mark visual importance explicitly instead of inferring it from accessibility attributes.
- **Concept:** `aria-hidden` removes an element from the accessibility tree; it says nothing about how important it is to sighted readers (WAI-ARIA 1.2, `aria-hidden`).

## 4. Repetition that read as noise

- **Frame:** On phones the hero's fact strip said "Thesis thread" a few pixels before the next section's "Thesis thread" heading.
- **Dimensions:** first-viewport height, repeated phrases, information each block adds.
- **Move:** Removed the strip (it repeated the next heading and the hero's affiliation; "Build, test, iterate" named nothing specific).
- **Backtalk:** About 160 px shorter on phones and no duplicate label. It did **not** lift the thesis above the 1280 × 800 fold: the portrait column sets the hero's height. Worth knowing before promising it.
- **Reframe:** Above-the-fold space on laptops is governed by the media column; any future change there is a scene-lane question.
- **Concept:** Redundancy helps when it reinforces at a decision point; the same words twice in one glance spend attention without adding meaning (the heuristics' "Less, but more Sirui").
