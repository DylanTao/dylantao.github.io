# Studio log, October 2026

A working record of design moves on this site, kept in the loop Sirui describes after Schön's _The Reflective Practitioner_: make a move, let the material talk back, then reframe the next move. Each card names the **dimensions** being moved, the scaffold that turns a vague "make it better" into variables someone can reason about.

Unpublished (`docs/` is excluded from the build). A public version in Sirui's voice is published only with Sirui's approval.

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

## 5. Sixty-eight characters, measured in the wrong unit

- **Frame:** Posts and case studies ran about 95 characters per line at 1440 px, long enough that the eye loses its place on the return sweep.
- **Dimensions:** characters per line, the font each element measures `ch` against, alignment of prose with figures and the contents rail.
- **Move:** `_sass/_reading.scss` gives prose, headings, and the post header one centered `33.5rem` column (`--reading-width`) and lets figures and code reach `68ch` (`--reading-wide-width`); the trace page and the contents rail follow it.
- **Backtalk:** The first try, `max-width: 50ch`, narrowed paragraphs but not headings. A later rule also reset the margins, and the contents layout pinned prose to the left.
- **Reframe:** Size the column once in `rem` and let every element inherit it; keep `ch` for single-font contexts such as code.
- **Concept:** `ch` is the advance width of "0" in _the element's own_ font (CSS Values and Units 4, font-relative lengths), so a 2rem heading's `50ch` is twice as wide as a paragraph's. Bringhurst, _The Elements of Typographic Style_ §2.1.2: 45–75 characters, 66 ideal.

## 6. Order is a claim

- **Frame:** DesignWeaver, the flagship paper, sat third on the homepage because the bibliography lists papers in file order.
- **Dimensions:** display order versus data order, one source of truth (the bibliography's `selected` flags), test coverage.
- **Move:** `selected_paper_order` in `_pages/about.md`, rendered with `{% nocite %}` and `--cited_in_order` (`_includes/home/news_publications.liquid`); project `importance` swapped; `test/test_selected_paper_order.py` keeps the order equal to the selected entries.
- **Backtalk:** `nocite` works inside a loop because jekyll-scholar resolves a key as a variable before treating it as a literal. The DesignWeaver hero's floating "Visual field" credit moved into a closing Credits disclosure.
- **Reframe:** Ordering becomes an explicit, tested decision instead of a side effect of file order.
- **Concept:** The serial-position effect: items at the start of a list are recalled best (Murdock, "The serial position effect of free recall", _Journal of Experimental Psychology_ 1962). The first slot is the most valuable real estate.

## 7. A poster frame for a moving figure

- **Frame:** The two Physion previews were 2.2 MB and 6.9 MB GIFs that every homepage and publications visitor downloaded and watched loop; every preview's alt text was its file name.
- **Dimensions:** bytes per listing page, motion by default versus on request, alt text that describes, social-card size limits.
- **Move:** `bin/make_gif_posters.py` writes a first-frame PNG; `_layouts/bib.liquid` shows the poster through responsive WebP variants, zooms into the original, and offers "Play the animation", which opens the same zoom. Citation pages use the poster for Open Graph.
- **Backtalk:** The publications page fell from 7.3 MB to 4.9 MB (with the hidden meme viewer, card 9). A `}` inside `{{ }}` ended the Liquid tag early (`remove: '}'`); moving the filter into `{% assign %}` fixed it.
- **Reframe:** Motion on request also serves reduced-motion visitors without a special case.
- **Concept:** WCAG 2.2 success criterion 2.2.2 (Pause, Stop, Hide): moving content that starts by itself and lasts more than five seconds needs a way to stop it. A poster that plays on request meets it by construction.

## 8. Retry after the page settles, not after a fixed wait

- **Frame:** Visual checkpoints failed with "Unable to capture screenshot" on a different route each run.
- **Dimensions:** main-thread idleness at capture time, retry count and backoff, runner cores.
- **Move:** `test/visual/helpers.js` waits for two animation frames and an idle callback, then retries at 250, 750, and 1,500 ms; any other error still fails at once.
- **Backtalk:** The next run was green across every site and scene job, the first fully green Visual checkpoints since the companion landed on October 9.
- **Reframe:** Keep the retry, and still make the page cheaper (the efficiency tier starts with duh's layout rescans), because work that stalls a 2-core runner also stalls a slow phone.
- **Concept:** A screenshot needs a fresh compositor frame, and a busy main thread delays it. `requestAnimationFrame` followed by `requestIdleCallback` approximates "the page has finished its current work" (HTML Standard, event-loop processing model).

## 9. Record art 40 times larger than its frame

- **Frame:** The homepage preloaded four 1024 px record-art PNGs (6.4 MB) for a disc never shown wider than about 340 CSS pixels.
- **Dimensions:** device pixels needed (rendered size × pixel ratio), bytes, behavior when a variant is missing.
- **Move:** `data-record-images` points to the 800 px WebP variants (31–46 KB each) with `data-record-originals` as the fallback in `assets/js/home.js`; plain variant images and random teasers fall back the same way.
- **Backtalk:** The homepage fell from 12.3 MB to 6.1 MB on the local preview; the 2D record, the 3D desk records, and their tests behave as before.
- **Reframe:** What remains is the 3D coast model, three.js, CSS, and fonts: the efficiency tier.
- **Concept:** Serve images at their rendered size times the device pixel ratio (`srcset` and `sizes`, HTML Standard); pixels beyond that cost bytes and decode memory without adding anything visible.

## 10. Test the invariants the site already keeps

- **Frame:** Before adding assertions, check whether the site already meets them, so the test records reality instead of hope.
- **Dimensions:** `h1` count, the first Tab stop, images without `alt`; 30 routes at two widths.
- **Move:** A one-off audit, then three assertions in `exercisePublicRoute` (`test/visual/sitewide.spec.js`).
- **Backtalk:** All 60 route-and-width pairs already passed; the test now keeps them that way.
- **Reframe:** The next accessibility work is behavioral (a global motion pause, focus return), not structural.
- **Concept:** WCAG 2.4.1 Bypass Blocks (the skip link) and 1.1.1 Non-text Content (`alt`); one `h1` per page is a convention for heading navigation rather than a WCAG requirement.
