# November 2026 takeover: resume here

Claude (Fable 5.2) picked the site up from Codex on November 13, 2026, after Codex ran out of tokens mid-batch. This file is the running todo list and notebook for that takeover. The [October handoff](october-2026-handoff.md) stays the history; this file says what is open now, what was tried, and what the next model should do first.

Sirui's request, in his words: finish the unfinished todos, check the site's own open-problem lists, critique and improve the design with the lessons from [YC's Design Review with Marvin Schwaibold](https://youtu.be/eojywvxqoLc), try the Graphics Lab's research queue for real, make the 3D scene better and faster, "be fun and record todos and notes as you go along."

## How to read this file

- **Todo** is the live checklist. `[x]` means verified with the evidence named beside it. `[ ]` with a **Best effort** note means a real attempt fell short; the note says why and what to try next.
- **Notebook** holds the lessons, in the October studio log's card format (frame, dimensions, move, backtalk, reframe).
- Nothing here claims "photoreal" or "state of the art" unless a measurement on this scene says so.

## Where the first session stopped (November 13, about 10:40 Pacific)

Sirui asked for a wrap-up to save tokens. Everything below is committed and pushed to `main`; nothing is left half done in the working tree.

**Shipped this session**

- Codex's dinner fix, CI timeouts and the first-scene budget correction (A1 to A3).
- The house: a court garden with its own lantern light in the bay under the bedroom (B1); the cut rock under the lifted roof drawn as hatched section material (B2 steps 1 and 1c); a whole-home orbit that can no longer enter the cliff (B2 step 1b).
- The site: three homepage and project-card fixes from the design review, and a video row a mouse can throw (C1 to C7).
- An experimental print treatment of the 3D home, off unless `?print=1` (R3).
- Two new rows on the Graphics Lab page and its record, and corrections to stale record entries.

**Check first next time**

1. CI for the last push. The visual workflow takes about an hour over 46 jobs. If only desktop-1440 `scene-rooms` fails on time, re-run that job (section G).
2. Sirui has seen none of this session's visual work. His eye is the open gate on the garden (day, night and a phone), the hatched section, the orbit limits and the print treatment. `?print=1` on the homepage, then 3D, shows the print.
3. The code-activity refresh was 16 hours old at the wrap-up and was not run locally, because the scan takes two hours. The scheduled refresh will catch it.

**Next, in the order I would take them**

1. Ask Sirui for the view where he saw the hard sunlit edge in the study (B3). Two looks at noon did not find it.
2. The print treatment at dusk and night, and a phone (R3). The colourways for those hours have never been looked at on a frame.
3. The rock above the cut, only if Sirui still sees leftover masses now that the orbit keeps to the open side (B2 step 2). It is the largest item: a split of the cliff mesh and a full shell export.
4. Lift the lid (B2 step 3). A first try at drawing the lifted roof as a floating outline read as scratches, not as a roof: the roof solids are cliff-shaped, so their rims are ragged. A plain rise-and-fade of the real pieces is the remaining idea.
5. The transmission copy experiment (E1), and the sun-bounce measurement (R2).

## State at takeover (November 13, 00:10 Pacific)

- `main` was at `4fd43cafc`; a fast-forward to `88b95c89b` brought in eighteen scheduled weather, activity and Scholar commits.
- Codex left one unfinished change uncommitted: a dinner fix (hands went to the dessert plate before it was served), its unit test, a browser case, and longer CI timeouts for three workflows. The unit test fails on the old code and passes on the fix.
- Sirui's last phone review (November 3) is the brief for the house: the study is brighter but still has a hard sunlit edge; some geometry "curves weirdly"; the bedroom needed sleep curtains (shipped in `1e7adb981`); the bay under the bedroom should become a planted, comfortable extension of the breakfast nook; five screenshots mark the empty bay, the crown above the living rooms, the gym-side terrace cut and the library-side hanging sheet.
- The cliff "F6" branch reached version 383 without an accepted shape. Its notes are in `artwork/coastal-home/reviews/terrain-f6-2026-10-29/WORKING.md`.

## Todo

### A. Codex's unfinished batch

- [x] **A1. Dinner pause.** At dinner, both hands went to the dessert plate during the pause before it was brought forward. Codex's one-line fix in `dining-motion.mjs` keeps the main plate in front until the swap. The unit test fails on the old code and passes on the fix. Its browser case waited for a redraw that a paused scene never owes; that step now clicks without the wait. Four widths pass on a local production-style build. Commit `4cbba72d5`.
- [x] **A2. The 4 MiB first-scene budget counted the wrong bytes.** See the notebook card "The gate that measured the source". Verified by `python -m unittest discover -s test -p "test_coastal_assets.py"` (7 pass) and `bundle exec ruby test/site_module_assets_test.rb` (3 pass, 34 s). Commit `757b3e986`.
- [x] **A3. Longer CI timeouts** for the Prettier, integration and upgrade workflows (Codex's uncommitted change; full checkouts of this 3 GB repository outran the old limits). Commit `9ceac52e8`.

### B. Sirui's November 3 house review

- [x] **B1. A garden refuge under the bedroom.** Built by `bin/coastal_garden_refuge.py`: a _tsubo-niwa_ in the bay beside the breakfast nook. Ray casts on the house file give the bay as 2.98 m wide, 2.9 m deep and 1.54 m high, one 20 cm step below the terrace, so nobody stands in it: a low timber deck carries a futon with two bolsters, two floor cushions, a tea table and a standing paper lantern; ferns, cast-iron plants and moss fill the back and west side; three stepping stones lead in past a stone basin. 16 meshes, 4,280 triangles, all additive (no rock cut, nothing moved). The objects are `kitchen_garden__*`, so only `room-kitchen.glb` is re-exported and the shell keeps its bytes. Review packet: `artwork/coastal-home/reviews/garden-refuge-2026-11-13/README.md`.
  - Control first: re-exporting the unchanged kitchen with the ported exporter reproduced the shipped file byte for byte (sha256 `6f8ef82b…`), so any difference after the install is the garden.
  - Cost: `room-kitchen.glb` grows by 20,906 bytes gzip. The overlap audit is unchanged where it counts: 939 offenders, 306 deep sites over 5 cm, no garden pair among them, no garden z-fighting in the source or the decoded delivery. The first candidate had one new deep site (a moss mound inside an accent stone I had placed 8 cm apart); the stone is gone.
  - The lantern is a real light at night, without a new light in every shader. See the notebook card "A light only its neighbours pay for."
  - Watch: the light bake now collects 736,041 triangles against its 750,000 ceiling. The next piece of geometry inside a light region needs that ceiling looked at first.
  - Not seen yet: a phone, and Sirui's eye.
- [ ] **B2. The cut-away reads as broken geometry.** Orbiting hides fourteen "lift-away" roof solids (`caveRoof` in `controller.mjs`). What is left are their seats: flat ledges and walls in the same sandstone as the natural cliff, the brightest thing in the view, plus rock outside the lifted solids (the library-side sheet, the gym-side lump). Codex spent 383 versions re-sculpting the rock. My reading: it is a drawing problem first.
  - [x] **Step 1, the cut faces.** `section-cut.mjs` finds every seat per pixel and prints it in one muted umber, an architect's poché. Commit `bd3fc9ea6`; unit tests 3 of 3; the browser case passes at four widths (the tone is visible, and nothing is drawn with the roof on). See the notebook card "A section is a drawing."
  - [x] **Step 1c, the cut is hatched.** From above, the cut seats were 40 to 60 percent of the picture in one flat dark tone: still "big and empty", only darker. They now carry fine hatch lines 42 cm apart, half as light again as the tone: the planes x + y + z = constant, rebuilt from each pixel's depth, so they cross level and upright faces at 45°, turn where the rock turns, and stay fixed to it as the view moves. Where they would fall closer than a few pixels they fade out. `hatchLine` in `section-cut.mjs` mirrors the shader for the unit test.
  - [x] **Step 1b, the orbit no longer enters the cliff.** Found by driving the whole-home view with real drags: a 47° turn east at the arrival height put the camera inside the cliff (a grey frame with only contact shadows on it), and 54° west filled the frame with the bedroom wing's seat. Both predate the takeover. The view now turns all the way round only from 0.95 rad of pitch or more; lower down it is held to the 71° arc that faces the sea (`frontEnvelope` in `camera.mjs`, `views.overview.envelope.front` in the manifest). See the notebook card "Which way a cave house can be looked at."
  - [ ] **Step 2, the rock above the cut.** The sheet and the lump are part of the main cliff mesh, so no flag hides them. Plan: in Blender, split the cliff above y = 5.83 m inside the house's plan into a new closed solid tagged like the other roofs (`caveRoof`, `closedSolid`, `cutawaySection`); step 1 then marks its seat for free. The hard part is the planting rooted on that crown, which lives in whole-cliff batches: either split those plants into a `core_retreat_roof_planting__<piece>` object as the existing roofs do, or hide them in the flora vertex shader while the section is open. Budget for the new triangles and bytes exists now (A2). Rejected on paper: clipping planes with a stencil cap (the shadow cache would not see a moved plane, and the composer's target has no stencil buffer).
  - [ ] **Step 3, lift the lid.** Raise and fade the roof over about 400 ms when the section opens, so the motion says where it went. Tried once as a drawing instead: the seat outline of each lifted piece (2,112 line segments from the 14 pieces) floating a metre above the section, like the dashed roof of an exploded axonometric. It read as scratches. The pieces are cliff-shaped, their rims are ragged, and one-pixel lines are too weak at this scale. Not kept.
- [ ] **B3. A hard sunlit edge in the study at noon.** Looked for on November 13 and not found: the Study destination at 12:00 and 13:30 on November 3, at 1600 × 900 and at a 390 px phone size (embedded, full screen, and after a quarter turn), shows soft light only. The right wall carries faint diagonal streaks with soft edges and a warm gradient from the desk lamp. Needs Sirui's screenshot or the direction he was looking. Codex's notes (`docs/coastal-rendering-research-2026-11.md`, "Daylight transport, November 3") already measured that the sun's single bounce is small in the study, so missing bounce is unlikely to be what he saw; a sun patch's own edge is the likelier candidate, and that is a shadow-filter question.
- [x] **B4. Bedroom curtains during sleep.** Shipped by Codex in `1e7adb981`, clock pinned in `4fd43cafc`.

### C. The site, read against the video

Observed on the local build at 1440 × 1000, light theme:

- [x] **C1. Chips that looked like buttons.** Now a labelled line of plain words. Commit `916548cd3`.
- [x] **C2. The loudest thing on the page was the least important.** The Connect icons drew at 51 px because a 36 px rule lost the cascade; fixed. Commit `916548cd3`.
- [x] **C3. Selected publications leave a third of the row empty** on the homepage. Left alone: `_home.scss` caps the list at a reading measure on purpose ("so the dividers end where the words do").
- [x] **C4. Interruption audit** of the project cards. Nothing to fix: a second card answers 26 ms after its click while the first is still opening; five clicks 60 ms apart settle in the right state with no animation left running.
- [x] **C5. Phone pass** at 390 px. Found the Scholar icon orphaned on a second row and a wrapped line starting with a separator; both fixed in `916548cd3`.
- [x] **C6. A wide figure left a hole in its opened card.** HotSpot's strip now opens across the card. Commit `916548cd3`.
- [x] **C7. A row you can throw.** Sirui's follow-up: study Blossom Carousel (the video, 1:04:27) and do at least as well. `assets/js/shelf.mjs` is this site's own version, first used on the Spooder-Man video row. See the notebook card "A row you can take hold of." Commit `3524d9742`; unit tests 5 of 5; the browser case passes 12 of 12 (three repeats at four widths). Next rows to give a handle: the phone deck carousels already scroll natively; the candidates are any future gallery and the paper strip on the publications page.

- [x] **C8. Inner pages, first screens.** Publications, CV, the design notebook and the blog at 1440 × 1000 and 390 × 844 on November 13: nothing broken and nothing changed. One observation for Sirui, not a fix: on a phone the Publications page opens with the Wall of Rejection, the Failure XP card, the list and constellation switch and the filter, so the first paper starts below the first screen.

### D. Research queue (run for real, on the local GPU)

- [x] **R1. Fixed-point water.** Parked after checking what it would buy: see section S.
- [ ] **R2. A small network for the sun's bounce.** Read Codex's result before starting: a traced grid of 289 sun directions at the 128 probes failed both ways. It was inaccurate at held-out directions around the study's apertures (normalized RMS error about 7.85 against a reference whose maximum was only 0.00417 in unit-illuminance irradiance) and too large (834,743 bytes against the cache's 800,000-byte ceiling). The signal itself is small in the study. So the first step is a measurement, not a network: the exact one-bounce solar term at every probe through a day, as a share of the sky and lamp light already there. If it is under a few percent everywhere, drop this. If the sea-facing rooms show a real term in the afternoon, a network conditioned on sun direction is the candidate, and the 289-direction table is the baseline to beat on error and bytes.
- [x] **R3. A woodblock-print treatment** for the home, version 1. `?print=1`, or the lab's "Print it as a woodblock". See the notebook card "Same blocks, different hours". Commit `e5ed6da82`; unit tests 4 of 4, browser case at four widths, full suites 420 Python and 1,080 Node passing. Sirui has not seen it yet. Open: a visible control for visitors, the paper margin and seal, night and dusk frames, phone cost.

### E. Performance

- [ ] **E1. The outside view is slow:** about 2,110 draws at 2560 × 1440 and 15.6 frames a second on an RTX 3080 Ti. Read `docs/performance-notes.md` first; Codex measured and withdrew uniform-upload reuse, material sharing, two batching variants (254 fewer draws, slower), a 15 Hz sea mirror and a smaller transmission capture, and found the GPU busy 99 to 100 percent at 2K as well.
  - Census, November 13 (`getSceneEvidence` plus a scene walk, 2560 × 1440): the outside frame submits 2,146 draws for 692 object draws, so every object is drawn about 3.1 times (shadow map until the cache settles, three's transmission copy, the sea mirror, beauty). Only 22 of the 692 are under 2 px in radius and 52 under 4 px. Culling small things is not the lever; the passes are.
  - Not tried yet: dropping the transmission copy while no refracting surface covers more than a few pixels of the frame, by hiding those surfaces rather than changing their material (no program change, and three skips the copy when the list is empty). The onsen water has to be shown to be out of sight first.

### S. Simulation and learning ideas, checked against what they would buy

Sirui asked for "quantized physics" and "a light network trained on quantized bigger models". Checked on November 13 before building either:

- **Fixed-point onsen water (R1).** The solver is a 40 × 40 grid stepped at 120 Hz in Float64, uploaded as a 40 × 40 float texture with nearest filtering. It costs almost nothing, it already runs on phones, and it uses only arithmetic that every engine rounds the same way. An integer version would be a curiosity, not a gain. Parked.
- **A network for the sun's bounce (R2).** See R2: the signal is small where it was measured. A measurement comes first.
- Where bytes do matter: the light cache is 712,655 bytes (about 187 KB compressed) of the first scene's 4 MiB. A small quantized network that reproduces the probes' transport is the honest version of the second idea. It would have to beat the current packing on bytes at equal error, and its decode would have to cost less than the transfer it saves.

### F. Stale entries on the public records

The record pages listed these as open; the code says otherwise.

- [x] "Minify the ES modules" (Graphics Lab `next-performance`, website-revamp `page-weight`): removed on November 13. Done since `_plugins/site_module_assets.rb`; the live `controller.mjs` is 105,698 bytes against 218,320 in source.
- [x] `sidenotes` was listed as blocked: removed on November 13; the backlog says they are implemented.
- [ ] `temporal-antialiasing` is listed as blocked; `temporal-aa.mjs` exists and the backlog says its opt-in study met its gate on October 23. Read the study before changing the row.
- [ ] `spectral-ocean` asks for a prototype; `fft-ocean.mjs` is one. Same: read it first.

### G. CI

- The first push of this takeover (`bd3fc9ea6`) failed one of 46 visual jobs: desktop-1440 `scene-rooms` hit the 20-minute limit of "every Rooms destination receives pointer input", which renders at 2560 × 1440 on software WebGL. A re-run of that job passed (that case took 12.3 minutes), so the run is green.
- The commit did not slow the scene in general: the same nine cases on the other three viewports ran as fast as or faster than the last green run before the takeover (laptop: 64 s, 3.9 min and 2.8 min for the first three cases, against 104 s, 7.5 min and 5.3 min). On this machine a forced still frame of the whole-home view takes the same time with the section cut on or off.
- The desktop job itself has now been slow twice (6.7 minutes for that case on November 8; over 20 and then 12.3 on November 13). Hosted runners vary by a factor of two between jobs of one run, and this case has no slack for a slow one. If it fails again on a commit that passes elsewhere, re-run the job before reading anything into it; if it keeps taking over 12 minutes, the limit is the thing to look at.

## Ideas ledger

Ideas wait here until someone tries them. Each names what it would change, why it might be right, and the cheapest test.

- **Same blocks, different hours.** Hiroshi Yoshida printed one set of woodblocks in several colourways (_Sailing Boats_: morning, forenoon, afternoon, mist, evening, night). This site already changes palette by the hour. A print treatment for the 3D home would use the same idea: one keyblock of lines from depth edges, flat colour blocks, shadows pushed toward Prussian blue, paper grain, and the hour choosing the colourway. Kawase Hasui's dusk prints, with lit windows against blue, are the reference for evening. It suits low-polygon rock better than a photographic look does. Cheapest test: one full-screen pass after tone mapping, behind `?look=print`, judged on four fixed frames.
- **On twos.** In the print treatment, step the avatars at 12 poses a second while the camera stays smooth, as _Spider-Verse_ does. One line in the mixer update; costs nothing.
- **The drawing gets painted.** The loading sketch already grows line by line. In print mode it could hand over to colour block by block instead of cutting to the render.
- **Lift the lid.** When the view goes from outside to the section, raise the roof pieces half a metre and fade them over about 400 ms, back to front, and settle them back on the way out. The motion explains where the roof went; under reduced motion it stays a cut.
- **The orange as a seal.** A shin-hanga print carries its maker's red seal in a corner. The brand mark is already a small orange sun: in full-screen print mode it can sit where the seal would.
- **A dial panel for the look.** The video's point about exposing the dials: a hidden `?dials=1` panel for line weight, band count and shadow hue would let Sirui tune the print by hand instead of by message.

## Notebook

### What the Design Review video teaches, and what it means here

Source: [Design Review, Marvin Schwaibold (Shopify)](https://youtu.be/eojywvxqoLc). I read the full transcript and looked at the frames around 9:20 and 20:05, the two moments Sirui pointed to.

- **9:20, the bookshelf.** Collins's case studies are books of unequal height on a shelf. A toggle lays them flat as a stack of spines. On hover the books lift, settle on each other and land once more as the last one arrives. The motion is small, physical and specific to the object: it says "these are books" rather than "this is a card grid." The lesson is not "add bounce." It is that one object on the page carries the craft, and its motion follows from what the object is.
- **20:05, the interruptible grid.** A 2 × 3 grid of clips; tap one and it grows from its own cell, drag down and it returns. The first build made him wait for the return before the next tap. His fix: every state can be interrupted, because "our thought patterns are interruptible." He drew the states as plain colored boxes to explain it. The lesson: test every open/close on the site by clicking the next thing before the first one settles.
- **One thing per section.** His studio's rule: each homepage section is the first chapter of a child page, in the order of the navigation, most important first, because readers drop off with depth. A page "has to dictate": one thing in each viewport takes the eye first.
- **Progressive disclosure, but not burial.** Assume nobody opens a tab. Show three things, each one tap from its detail, and let the page be long.
- **Curate.** AI makes animation cheap; an animated dot that explains nothing subtracts. Reusing one decorative effect in every card drains it.
- **Type.** Five sizes in one viewport is noise. A display face is for headlines only.
- **Scroll.** Never smooth-scroll or hijack the wheel. Carousels drag; whole cards are the tap target; hover answers at once.
- **Expose the dials.** When a value has to be felt (spring stiffness, grass length), build a small panel and tune it by hand instead of describing it in chat.

Most of this is already in `WEBSITE_DESIGN_HEURISTICS.md` (native scroll, one motion language, interruption hands velocity on). The parts worth testing against the rendered site are: what each viewport dictates, how many type sizes the first screen uses, whether every open/close really is interruptible, and whether the site has its one "bookshelf."

### The gate that measured the source

- **Frame:** The "complete first scene" test allows 4 MiB of transfer. It had 2,461 bytes left, so every new mesh, however small, failed it. Codex's garden and cliff work both ran into this.
- **Dimensions:** bytes counted versus bytes served; where each number comes from.
- **Move:** The test summed the gzip size of the scene modules' _source_. Pages serves them after the site's own Terser step, which is 263,875 bytes smaller for the 140 modules (736,459 against 472,584, gzip level 6, measured with the build's compiler on November 13). `test/fixtures/first-scene-transfer.json` now holds a 240 KiB credit; the Python budget subtracts it, and `test/site_module_assets_test.rb` compiles every module and fails if the real saving ever drops below the credit.
- **Backtalk:** Headroom went from 2,461 to 248,221 bytes with the 4 MiB ceiling untouched. The Ruby guard adds about 34 s to the unit job. The vendored three.js files are also minified on the way out (about 21 KB) and are deliberately not credited.
- **Reframe:** Budgets should read what a visitor downloads. The next check of this kind belongs in the deploy job, against `_site` itself.
- **Concept:** A proxy metric drifts from its target when the pipeline between them changes. Here the pipeline gained a minifier in October and the proxy kept counting the old bytes.

### Same blocks, different hours

- **Frame:** Sirui asked for a non-photoreal look after an earlier toon-and-hatch attempt disappointed him. The old attempt swapped every material for a three-step toon ramp, so it threw away the lighting the home already had.
- **Dimensions:** where the line comes from (geometry, not shading); how flat the colour is; how many pigments; what the hour changes; cost.
- **Move:** `assets/js/home-scene/print-look.mjs` keeps the realistic frame and redraws it in one pass. Lines come from the second difference of the depth buffer, which is zero on any flat surface and jumps at a fold or an edge. Colour is averaged inside each surface by a 12-tap filter that weighs neighbours by colour distance in OKLab, then settles into five soft steps. Shadows lean toward one blue; the green-to-magenta axis is muted so the palette stays on the site's orange-to-blue axis. The home's minute picks the colourway.
- **Backtalk:** Three failures on the way. (1) No lines at all: a multisampled target throws away its depth samples after the first resolve, and my pass was the second thing to resolve it. Fix: take the output pass's place and tone-map inside. (2) Cow-print blotches on every sloping plane: the depth texture is unfiltered, and off-centre taps rounded unevenly. Fix: snap every tap to a texel centre a whole number of texels away. (3) Trees as black scribble: every leaf is an edge. Fix: a line runs in some direction, so where all four directions break at once the cut is thinned to a stipple. The first frames with these fixed read closer to _ligne claire_ than to a woodblock; honest name for now is "print treatment."
- **Reframe:** Judge it at dusk and night, where Kawase Hasui's lit windows are the reference, and on a phone. Then decide whether it earns a visible control.
- **Concept:** Saito and Takahashi drew contour and crease lines from first and second differences of a depth image in 1990 ("Comprehensible Rendering of 3-D Shapes"). The flatten-then-quantize colour step follows Winnemöller, Olsen and Gooch, "Real-Time Video Abstraction" (2006). OKLab is Björn Ottosson's (2020).

### A section is a drawing

- **Frame:** In the cut-away, the eye went to the leftover rock, not the rooms. Sirui called it "sharp big empty curving or geometry removal."
- **Dimensions:** which pixels are cut material; their tone against the rooms; how much of the sun's shadow the cut keeps; cost per frame.
- **Move:** `assets/js/home-scene/section-cut.mjs` merges the lifted roof solids into one mesh at load. While the section is open it draws their back faces once, with no depth test, and keeps a pixel only where that face's depth equals the depth the frame already holds. Those pixels are, exactly, surfaces the roof was sitting on. The haze composite, which already reads depth, mixes them to a flat umber lit by the hour's sun and sky.
- **Backtalk:** Four matched frames at noon. Untreated, the seats are the brightest shapes in the picture and carry hard shadow patterns. With a multiply-only tone they went dark but stayed busy. A first flat tone was too light and looked like the untreated rock again. The chosen tone (flat colour 0.072, 0.06, 0.052, nine-tenths flat) sits between the rock and a black fill, and the rooms become the subject. The tall cut wall on the library side takes the tone too. The lump and sheet outside the lifted solids are untouched.
- **Reframe:** Geometry decides what lifts; drawing decides how the cut reads. Step 2 is an authoring change (a crown piece), not more shader.
- **Concept:** _Poché_, from the Beaux-Arts habit of inking the cut walls of a plan solid, so a reader separates mass from room at a glance. The mask is a depth-equal decal test, the same idea as a decal that only lands where it touches a surface.

### A row you can take hold of

- **Frame:** In the video Marvin Schwaibold drags a row of cards with a mouse, throws it, and it lands on a card; the page keeps its native scroll. The reviewed sites failed the same test: carousels that only move by their arrow buttons. On this site the Spooder-Man video row was one of those for mouse users.
- **Dimensions:** who needs help (mouse only; touch, trackpad, wheel and keys already scroll); what a release does (carry speed, land on a stop); what interrupts (everything); frame-rate independence; reduced motion.
- **Move:** I read Blossom Carousel's engine (Jesper Vos, Apache-2.0, `packages/core/src/index.ts` at `fbfcaa3`). Its ideas, kept: the row is a real scroll container with CSS snap; JavaScript engages only for fine pointers and can be lazy-loaded; a press becomes a drag after a few pixels so clicks survive; the release is projected to the snap point it was heading for; wheel, keys and outside scrolls stop the motion at once; past an end the row leans instead of stopping dead. `assets/js/shelf.mjs` is written from those ideas in this site's spring language, with five differences: momentum is in seconds, exact per frame, so 60 and 120 Hz land on the same pixel (Blossom multiplies speed by 0.72 every frame); the landing is the site's `layout` spring carrying the release velocity; reduced motion and Pause motion get a drag with no flight; no prototype or global is patched (Blossom wraps `Element.prototype.scrollIntoView` and listens for keys on `window`); text in the row stays selectable until a drag begins.
- **Backtalk:** The first live run never flew: I read the snap points after switching snapping off for the drag, so there were none, and the row "landed" where it was released. Reading them before taking over fixed it. A first version also moved the opened (enlarged) video card to wherever a throw rested; that reflowed the row under the hand, and a trackpad scroll does no such thing, so a throw now leaves the open card alone. Measured on the built page: a 240 px drag follows 1:1; a release at rest settles on the nearest stop; an eight-step flick lands two stops on; a wheel tick mid-flight returns control within 60 ms; pulled 240 px past the start the row leans 112 px and returns.
- **Reframe:** One primitive, named for the desk it sits on. New rows should start as native scrollers with snap and add `createShelf` only if a mouse user would otherwise be stuck. Effects (a stack on phones, a ripple through neighbours when one card is dropped) can build on its `shelf:rest` event and state.
- **Concept:** Progressive enhancement: start from what the platform already does well for most inputs and add only the missing behaviour, so the fallback is the product, not a degraded copy.

### A light only its neighbours pay for

The garden's first lantern was a white box in a dark bay: an emissive material with no light behind it. The obvious repair, a ninth warm practical, would have added a point light to every lit shader in the house for the sake of three square metres.

The house already has the right tool. `light-installations.mjs` evaluates authored lines and points analytically, and each material only sees the lights of its receiver group, each light only inside its own box. A lamp there is one entry in the manifest (`installationPoints`, id `tea-garden-lantern`) and costs nothing outside its box.

What made it fiddly, and worth remembering:

- **Three receiver groups are full.** `living`, `upper` and `architecture` each carry ten points, the shader's limit. The lamp's box therefore stops inside the rock fin (x = -5.42) and under the bedroom slab (y = 1.36), so it joins only `exterior` (now 5 points) and `library` (3). `test/coastal-garden-refuge.test.mjs` holds that.
- **Geometry chooses its group by custom property.** Room models default to their room's group. The garden's objects carry `installationGroup = "exterior"` from the builder, exported as glTF extras, so the garden is lit with the terrace it opens onto. No scene code changed.
- **The rock around the garden stays dark.** The slab above and the cliff behind belong to `architecture`, which is full. At night that reads as a lit garden against dark stone, which is how a court garden looks; from a low camera the unlit ceiling just above the lantern is a visible lie. Raising the limit from ten points to twelve would cost every installation shader two more loop turns.
- **Paper needs less light than you think.** The living room's washi (`emissiveFactor` 0.6, 0.48, 0.33) at its night level prints as a white box, because the night exposure is high. The garden's paper is 0.6, 0.3, 0.12, scaled by the lamp's 0.45: a peach shade.
- **The lamp belongs above the seats.** The first lantern stood 44 cm tall at the bay's mouth, lower than the table top and two metres from it, so the seats stayed dark. The second stands 78 cm on the deck between the cushions, lamp at 0.49 m, within 60 cm of the table, both cushions and the path's last two stones.

### Which way a cave house can be looked at

A dollhouse can be turned all the way round. This house cannot: it stands inside a cliff, open on one side. The whole-home view allowed a full turn anyway, and trusted the spring arm to keep the camera out of the rock. The arm measures "somewhere in open air to stand", and with the roof lifted the space where the roof was counts as open air, so a low camera behind the house stood inside the hill and drew a grey frame.

The fix is a statement about the building, not a better collision test. From the sea the house can be seen from any height. From the sides and from behind it can only be seen from above, looking down past the rock, where it reads as a plan. So yaw is free above 0.95 rad of pitch and held to the seaward arc below it, and behind the house the view cannot be lowered. Both limits are ordinary envelope edges, so the drag cushion that already softens every room's limits softens these too.

- **Check the public controls, not the lab camera.** A lab camera can be placed anywhere, and my first "views from the side" were inside the rock for that reason. The broken views a visitor could actually reach only showed up when I dragged the real canvas in steps.
- **One state, one envelope.** The envelope depends on where the orbit is (inside the arc and low, inside and high, outside). Every legal orbit is unchanged by its own envelope, so crossing from one case to another never moves the camera. The shown, still-settling orbit is clamped by its own case rather than the requested one, so it cannot be snapped across a corner.
- **What it does not fix.** At the arc's western end the bedroom wing's cut face is a large dark shape on the right of the frame. From above, the cut seats cover 40 to 60 percent of the picture; the hatch (step 1c) is what keeps that from reading as empty.
