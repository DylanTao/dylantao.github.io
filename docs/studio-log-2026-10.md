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

## 11. Twenty-six seconds of shaders, moved off the page

- **Frame:** Opening the 3D home froze the whole page for about 13 seconds, then for 5 more when the other rooms streamed in and again on the first Look around.
- **Dimensions:** programs first used in a frame, blocking time per program (0.1–1.8 s each on D3D11), time to the first composed view, and pixels changed, which had to stay at zero.
- **Move:** `assets/js/home-scene/program-warmup.mjs` creates every program a frame needs (scene materials, the contact pass's normal override, shadow depth variants, the coffee glass's back faces, full-screen passes) and waits for the driver without blocking; streamed rooms join the house once ready.
- **Backtalk:** Three's own `compileAsync` cut blocking from 26 s to 5 s, but each first frame still linked ten programs. A define diff showed the shadow variants matched except for one key field: the shadow pass draws without a scene, so it is keyed without fog. Then the scene suite failed because the wait used `setTimeout`, which its paused clock freezes; polling moved to the browser scheduler. Final: 0.6 s of blocking reads, the longest startup frame 0.2 s, readiness 11.3 → 7.5 s, and 0 changed pixels in deterministic captures.
- **Reframe:** Next is the outside view's cost: about 2,000 draws a frame, partly because the sea mirror redraws the scene.
- **Concept:** A shader program has a creation cost and a first-use cost. `KHR_parallel_shader_compile` (Khronos, 2019) lets a page ask "is it done?" (`COMPLETION_STATUS_KHR`) instead of waiting, but only if nothing reads the program first. A renderer's program cache is an equality test over compile state, so warming up means reproducing that state exactly, down to whether fog exists.

## 12. Twelve cards, one row

- **Frame:** On a 390 px phone the twelve site-experiment cards stacked into about 6,650 px of scrolling before "Other playful builds".
- **Dimensions:** section height, how much of the next card shows (the affordance), position feedback, and an expanded card's width.
- **Move:** Below 768 px the grid becomes one scroll-snapped row (`_sass/_design-details.scss`), each card 84% wide so the next one peeks; a "1 / 12" count follows the card most in view (`assets/js/project-cards.js`), and the row is a focusable region for arrow keys. An expanded card widens to the full row.
- **Backtalk:** The section shrinks to about 690 px; the existing disclosure test still finds every story with no clipping or overflow, because the expanded card claims the row instead of squeezing into its slot.
- **Reframe:** The desktop grid stays; a carousel only pays off where the column is one card wide.
- **Concept:** _Scroll snapping_ (CSS Scroll Snap) turns free scrolling into discrete stops without hijacking the gesture. The peeking edge is the affordance; Norman's _The Design of Everyday Things_ calls such cues signifiers.

## 13. A scroll-driven laptop, no script

- **Frame:** The revamp case study told its before/after in captions; the change itself was easy to miss.
- **Dimensions:** scroll progress through the section, lid angle, wipe position, and which capture each moment shows.
- **Move:** `_sass/_revamp-device.scss` pins a CSS laptop while the reader scrolls: the lid opens on the February 9 Wayback capture, then the screen wipes along an orange seam to an October 12 capture of the same 1440 × 1000 view.
- **Backtalk:** The first wipe showed the seam during the lid opening (an animation's `both` fill applies its first keyframe early), and the base's extra width overflowed phones; both fixed. Under reduced motion or automation the laptop stands open with a February/today button.
- **Reframe:** Use the same pattern only where a single comparison carries the story.
- **Concept:** _Scroll-driven animations_ (`animation-timeline: view()`, CSS Scroll-driven Animations) map scroll position to an animation's progress on the compositor, so the effect stays smooth without a scroll listener.

## 14. Springs, named by their damping

- **Frame:** Buttons and menus moved on fixed 180 ms eases, so a press felt like a fade rather than something physical.
- **Dimensions:** damping ratio ζ (overshoot) and period T (speed), giving settle time; plus which controls deserve a bouncier spring.
- **Move:** `_sass/_springs.scss` defines a confident spring (ζ 0.8, settles in 0.48 s, 1.5% overshoot) for buttons and menus and a playful one (ζ 0.55, 0.9 s, 12.6%) for the desk toys; `bin/spring_easing.cjs` turns any ζ and T into a CSS `linear()` curve. The theme menu enters with `@starting-style`; reading disclosures open through `::details-content`.
- **Backtalk:** Measured in the browser, "When this paper helps" grows from 46 to 477 px in about 160 ms, overshoots to 481, and settles; the menu scales from 0.96 to 1.0003 and back.
- **Reframe:** Keep springs on direct manipulation and discrete toggles; ambient motion stays on eases or stops.
- **Concept:** A damped harmonic oscillator; overshoot is e^(−ζπ/√(1−ζ²)). Apple's spring guidance (WWDC23, "Animate with springs") describes springs by bounce and duration rather than stiffness and mass, the same two dimensions here.

## 15. A palette that had quietly lost its curation

- **Frame:** The ⌘K palette offered "light, dark, system" themes this site does not have, and none of its curated "Start here" routes.
- **Dimensions:** which data the palette actually renders, what each action controls, and what every page (including the AI profile) is allowed to say.
- **Move:** The curated data moved from `_scripts/` (which v1 no longer builds) to `_includes/search_data.liquid.js`, rendered inline, with a "Do" section whose actions call the site's own controls: the four time-of-day themes, the 3D home, the AI-readable page, duh, Build Rhythm.
- **Backtalk:** The first push broke deploy: the palette now renders on the AI profile, and its email action used the older address the publication validator forbids. A comma inside one theme description also split it into a fifth, nonsense action. Both fixed, both tested.
- **Reframe:** Run the production build and output validator before pushing anything that renders on every page.
- **Concept:** _Single source of truth_: an action that clicks or calls the existing control can never disagree with it, unlike one that reimplements its effect.

## 16. Soft duh, held by what holds it

- **Frame:** Sirui asked for a softer, simulated duh with studio-quality motion; the existing body was an art-directed shell.
- **Dimensions:** volume error, settling time, deformation under a held shake and a sideways push, the resting pool's width-to-height ratio, and the idle frame budget.
- **Move:** `assets/js/companion/duh-softbody.mjs` (XPBD ring: stretch, bending, area, shape matching), previewed with `?duh=soft`; the classic body stays the default.
- **Backtalk:** First pass: perfectly round under shaking, because a uniform pseudo-force on a free body only translates it. Attaching the body the way it is actually held (a grip arc while carried, static friction at the base on a surface, a centroid anchor only in flight) produced the jelly: about 8 px of swing under a 15,000 px/s² shake, 4.5 px of lean from a push, a 1.1 resting pool, under 0.5% volume error. A second miss: the pooled shape counted as "moving", so the page drew 60 fps at idle; activity now means velocity, not deformation.
- **Reframe:** Sirui compares the two in a matched recording and live; the choice decides the default.
- **Concept:** XPBD (Macklin, Müller and Chentanez, MIG 2016) makes stiffness a compliance independent of step count; shape matching (Müller et al., SIGGRAPH 2005) returns a body to its rest shape without a mesh. In animation terms, the attachment is the _pivot_ of follow-through: overlap comes from what leads and what drags.

## 17. A mirror that rendered the house twice

- **Frame:** Stepping outside cost about 1,900 draws a frame, and the sea's reflection was a large share of them.
- **Dimensions:** draws and triangles per frame by render pass, the mirror's resolution, and pixels changed, which had to stay at zero.
- **Move:** The 384 px sea mirror skips meshes with transmission, the onsen water and the coffee glass (`assets/js/home-scene/reflection.mjs`); the house and footer canvases stop multisampling (`antialias: false`), because their composers already multisample an off-screen target and finish with one full-screen triangle.
- **Backtalk:** Attributing every draw to its framebuffer showed the cause: a transmissive mesh makes Three draw the whole opaque scene again into a transmission buffer at full canvas size, even inside a 384 px mirror where the glass covers a few texels. Skipping it cut the outside frame from 1,934 to 1,574 draws and 4.45 to 3.57 million triangles. Seeded, paused-clock captures of the house inside and outside, and of the footer, changed 0 pixels for both moves.
- **Reframe:** A main-thread profile then ruled out the next suspects. Walking the scene each frame costs 0.57 ms inside and 0.04 ms outside, and a cached shadow would only help while everything is paused, because P, the wildlife and the swaying plants move on almost every frame. What remains is draw submission: outside, 1,577 draws a frame (mirror 357, shadow 409, the glass's full-size transmission copy 403, the view itself 408) take about 11 of the 16 ms. The next real gain is merging static meshes that share a material, a larger change kept for its own pass.
- **Concept:** A planar reflection renders the scene from a camera mirrored across the water plane (an oblique near plane clips what is below it); it only needs what the reflection can resolve. Multisampling belongs where geometry is rasterized, which here is the composer's target, not the canvas that receives a single triangle.

## 18. A comic panel that prints in

- **Frame:** The Spooder-Man gallery cross-faded like any slideshow, though the page is a love letter to _Spider-Verse_.
- **Dimensions:** plate offset (how far out of register), Ben-Day dot strength, drawings per second, and whether two captions can ever overlap.
- **Move:** `assets/js/spooder-project.js` splits the new slide into red, green and blue plates with an SVG filter and brings them into register over three held drawings at 12 per second (9, 5, then 2 px), while magenta and cyan dots recede from 0.85 to 0.25 (`_sass/_spooder-verse.scss`). A hovered thumbnail slips out of register by 2 px. Only this page loads it.
- **Backtalk:** The first version stepped the old cross-fade too, and on its first drawing both captions showed at once. A hard cut, like turning to the next panel, keeps one caption, and the print-in alone carries the motion. Chromium and WebKit draw the same frames; reduced motion gets the instant swap with no filter.
- **Reframe:** Keep the effect on change only. A print-in on every scroll or idle loop would turn a signature into noise.
- **Concept:** _Animating on twos_ holds each drawing for two film frames (12 per second at 24 fps), which _Into the Spider-Verse_ (Sony Pictures Imageworks, SIGGRAPH 2019 talks) used to make motion read as drawn. Misregistered plates borrow from offset printing, where each ink is a separate plate; screen-blending disjoint channels rebuilds the original exactly when the offset is zero.

## 19. Glass that bends only where it can

- **Frame:** Sirui asked for liquid-glass chrome; the bar was already frosted, so the question was what glass could add on a site that is mostly text on paper.
- **Dimensions:** where refraction is visible (over text, photos, the 3D home), the bevel's height and displacement, legibility behind and through the glass, engine support, and scroll cost.
- **Move:** A 10 px lip under the navigation bar refracts what scrolls beneath it: its top rows show the page 4 px lower, so a passing line stretches as it slides under, like the rounded edge of a glass slab (`assets/js/liquid-glass.js`, `_sass/_navbar.scss`). Chromium only; Firefox and Safari, reduced transparency, more contrast and forced colors keep the frosted bar.
- **Backtalk:** A 14 px, 22-scale lip smeared text into a glitch, and a glass theme menu let "2D | 3D" show through "Evening", so the menu stays solid. Moving the bar's frost into a pseudo-element broke it outright: the bar's `view-transition-name` makes it a backdrop root, so its children could only blur the bar itself, and page text showed through sharp. The lip now belongs to the header and anchors to the bar's bottom edge, one pixel below the reading-progress line. Scroll stays at 60 fps with it on or off.
- **Reframe:** Glass reads as glass over images and motion, not over paper. If a surface floats over the 3D home or a photograph, try it there next; Sirui decides whether the lip stays.
- **Concept:** _Backdrop root_ (CSS Filter Effects Level 2): a backdrop filter sees only what is painted behind it up to the nearest ancestor that has a filter, opacity, mask, clip path, blend mode, backdrop filter or view-transition name. Refraction itself is a displacement map: each output pixel samples the input at an offset stored in the map's color channels (SVG `feDisplacementMap`).

## 20. A look lab instead of a guess

- **Frame:** Sirui asked for studio-grade lighting and materials. A new tone curve or bloom changes every frame of the home, so it is Sirui's call, made from matched evidence.
- **Dimensions:** the tone curve (ACES Filmic, AgX, Khronos PBR Neutral), exposure matched to equal mean brightness, bloom threshold and strength in HDR, and sheen on woven fabric.
- **Move:** `assets/js/home-scene/look.mjs` turns URL flags into a session-long preview (`?tone=`, `&bloom=1`, `&sheen=1`, `?look=reset`); `realism.mjs` adds an optional bloom pass and sheen fabrics; the bloom code (Three r164, MIT) loads only when asked.
- **Backtalk:** With no flags, seeded captures change 0 pixels. At equal exposure AgX and Neutral rendered 4% and 12% darker than ACES, so a naive comparison would favor ACES for brightness alone; factors of 1.08 and 1.24 bring them within 2–3%. In the matched sheet, AgX greys the sandstone and turns the evening lamp white; Neutral keeps the truest sea and sandstone outside; ACES with bloom gives the evening kitchen the warmest glow. Sheen is a soft rim on the sofa and lamp shade. A first harness pass compared two different arriving avatars; pinning the avatar fixed the comparison.
- **Reframe:** Sirui asked me to decide. A second round raised the bloom threshold from 0.92 to 1.6, above sunlit walls, which removed the midday haze entirely (0 changed pixels at noon) while the evening sconce still glows; Neutral, best at noon outside, lifted the evening shadows into grey. Shipped: ACES Filmic, bloom at 1.6, fabric sheen. Hair highlights, temporal antialiasing and the ocean are now judged against that look.
- **Concept:** A _tone curve_ maps scene radiance, which has no upper limit, to display values. ACES Filmic adds contrast and shifts saturated highlights in hue; AgX (Troy Sobotka) desaturates highlights toward white to avoid those shifts; Khronos PBR Neutral (2024) keeps base colors faithful for product-like rendering. _Bloom_ imitates light scattering in a lens; thresholding in HDR, before the curve, keeps it on actual light sources rather than on white paper.

## 21. A loading bar that only reports finished work

- **Frame:** Opening the 3D home showed an empty frame and a status line for 2–6 seconds, with nothing to say whether it was working.
- **Dimensions:** which work is known up front (house, coast, room, Sirui, then the view's programs), how each piece reports progress, whether the bar can ever run ahead of the work or move backward, and the longest main-thread task while it fills.
- **Move:** `_includes/home/world_controls.liquid` adds a five-segment `role="progressbar"`; `controller.mjs` fills each segment from real events (streamed bytes, then the parse; for the view, batches submitted and programs the driver reports finished), and `program-warmup.mjs` now creates the scene's programs in batches of six materials with a task boundary between them.
- **Backtalk:** GitHub Pages gzips the models, so `Content-Length` is the compressed size; a model's segment holds just short of full until its last byte arrives. The first bar sat at 80% for 2.2 s because one task froze the page while every program was created. A profile blamed the shadow-variant warmup, and a fix there changed nothing: timing each section showed shadow variants take 10–37 ms, while Three's own `renderer.compile(scene)` took 0.1–1.6 s in a single task. Batches cut that to tasks of usually under 40 ms (worst seen 0.4 s); the longest frame fell from 658 to 196 ms, the same 48 programs link before the first view with none after, and seeded captures change 0 pixels.
- **Reframe:** The remaining long tasks (median about 0.6 s) come from elsewhere, likely the first frame's buffer and texture uploads; pre-uploading in batches is the next measurement. And a sampling profile is a lead, not a verdict: time the sections before changing one.
- **Concept:** Progress indicators are judged against the work they claim to show. Harrison et al. ("Rethinking the Progress Bar", UIST 2007) found that the same wait feels shorter when a bar accelerates toward the end than when it stalls. An honest bar earns that by moving the slow, invisible work (here, program creation) into visible steps, not by inventing motion.

## 22. The scaffold, small enough to try

- **Frame:** The DesignWeaver page described dimensional scaffolding in words and figures; a visitor never got to feel what it does to a prompt.
- **Dimensions:** fidelity to the study (which tags, which selection, whose words), what the page itself writes, and what a reader can see changing as they click.
- **Move:** A "Try it" palette on `/projects/designweaver/` (`_data/designweaver_scaffold.yml`, `assets/js/designweaver-scaffold.mjs`, `_sass/_designweaver-scaffold.scss`) with four dimensions and the tags from a study session in the CHI 2025 talk. It opens on that session's selection and the prompt DesignWeaver wrote for it; any change rebuilds the prompt as a fixed sentence and underlines each phrase in its dimension's color.
- **Backtalk:** The honest boundary had to be visible, not buried: the label changes from "DesignWeaver's prompt for this selection" to "Your prompt, as a fixed sentence", and the note says the real system uses a language model and that nothing is sent or generated. Without JavaScript the session's selection still shows, with the chips disabled. A word counter backfired on the deployed page: the fixed sentence is terser than the model's prose, so adding an eighth tag dropped the count from 26 words to 16. The counter now reports tags across dimensions, which is what the scaffold changes; clearing every tag leaves "A chair."
- **Reframe:** The copy (heading, lead, note) is new and in Sirui's voice only by imitation, so it joins the copy batch for review.
- **Concept:** _Scaffolding_ (Wood, Bruner and Ross, 1976) is support that lets a novice do what they could not do alone and that can be withdrawn later. DesignWeaver scaffolds vocabulary: naming the dimensions turns an open text box into a set of choices. Color-coding each phrase by dimension makes the scaffold visible in the result.

## 23. The reset that was a ghost

- **Frame:** Sirui preferred the classic duh to the soft-body preview, which read as jittery with broken physics, and saw "a weird free reset of position at the end of a throw".
- **Dimensions:** position continuity frame to frame, what moves duh after a landing and why, and which parts of the soft preview were worth keeping.
- **Move:** A frame-by-frame trace of throws found no teleport. It found the recovery: after landing beside text, duh turned half-transparent and slid to a clear perch. The recovery hop always failed its path check, because its starting point is by definition not clear, so every recovery fell back to that ghost glide. Recovery is now a jump (`assets/js/companion/duh-page.mjs`): a 0.1-second wind-up, an arc sized to the distance, and a landing squash at the perch already found clear. The soft body is gone; its theme-keyed rim, key and core shading now gives the classic body volume (`duh-portrait.mjs`).
- **Backtalk:** The trace shows the jump in three frames (wind-up, apex, landing on the clear rule line). The duh and companion suites pass at desktop and phone sizes.
- **Reframe:** Watch for any relocation that has no visible cause; a character's moves need one.
- **Concept:** Disney's principles again: _anticipation_ and _arcs_ make a move read as intended. A straight, half-transparent glide reads as a correction by the system, not as an action by the character.

## 24. A sun you can drag, and a switch that stills everything

- **Frame:** Four theme buttons felt static; Sirui asked for a control that feels like the day itself, colors the slider and the page as it moves, and syncs the 3D scenes, plus a way to pause motion that looks good.
- **Dimensions:** where an hour lives (minutes on a 24-hour loop), which surfaces follow every move and which only follow a settled choice, contrast safety of continuous color, and how many places must learn about "paused".
- **Move:** The theme panel became a sun arc (`assets/js/sun-arc.mjs`, `sun-arc-math.mjs`, `_includes/theme_mode_control.liquid`, `_sass/_sun-arc.scss`): the sun rides a day arc from 5:00 to 20:00 and becomes a moon on a flatter night arc. Dragging or arrow keys pick any minute; the theme snaps to that hour's mode, the panel and a sky glow at the top of the page shift color continuously and the glow moves left to right with the sun, the footer coast blends its four authored looks by the minute, and the 3D home previews the hour when the drag ends. Now hands everything back to the clock. Pause motion wraps `matchMedia("(prefers-reduced-motion: reduce)")` in the head (`theme.js`), so every surface that already honored reduced motion stills through that path, with CSS loops paused by `html[data-motion]`.
- **Backtalk:** Continuous color stays out of text: the four token sets still carry contrast, and only the panel and the page's background glow are continuous. A theme chosen anywhere else (the palette, a test) moves the sun but never sets a preview hour, so the 3D home's San Diego routine is untouched unless the visitor uses the arc. The first glow at 17% opacity was invisible; 30% reads as light without touching contrast. A test of mine expected 1:20 pm plus four hours to be evening.
- **Reframe:** Keep the panel's four stops; they are both the quick choice and the test contract.
- **Concept:** _Direct manipulation_ (Shneiderman, 1983): continuous representation of the object, physical actions instead of commands, and rapid, reversible feedback. The arc maps the day onto a shape people already read (sunrise left, noon high, sunset right), so the control explains itself. Wrapping one shared query instead of patching six modules is the _single point of truth_ applied to motion.

## 25. A coffee ring, by the physics of drying

- **Frame:** The homepage's coffee stain was a broken ring of dashes, closer to a stamp than a stain, and it nearly vanished in the evening theme.
- **Dimensions:** rim sharpness and width around the circle, interior tint, tide lines, a second ring, drips, edge texture, and how the stain reads at its on-page strength in light and dark themes.
- **Move:** `assets/js/home-coffee-stain.js` now draws the ring the way one dries: a continuous rim, sharp outside and fading inward, thickest where the drop pooled; one or two partial tide lines; a faint interior that deepens toward the rim; sometimes a partial second ring; drips with their own small rims and a splash streak. Evening uses a lighter, dried-coffee palette, redrawn when the theme changes; the on-page strength rose from 0.28 to 0.38 of the theme opacity.
- **Backtalk:** The first prototype's interior turned into pale clouds (a frosted-glass look) and its fiber displacement sawtoothed the rim; a radial pool gradient and a lower-frequency, slightly blurred displacement fixed both. Each visit still gets its own seeded stain (`?coffeeSeed=` reproduces one).
- **Reframe:** The stain is a desk cue, not a feature: keep it quiet enough that the cards beneath stay effortless to read.
- **Concept:** The _coffee-ring effect_ (Deegan et al., "Capillary flow as the cause of ring stains from dried liquid drops", Nature 1997): with the drop's edge pinned, evaporation is fastest at the edge, so liquid flows outward to replace it and carries the coffee particles there. A stain drawn from its cause reads as real at a glance.
