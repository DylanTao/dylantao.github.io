# Design Experiment Backlog

This is the durable queue for visual and interaction ideas that are promising but not yet proven. It keeps the site's design spine alive without turning every reference into production code.

Use this alongside [`WEBSITE_DESIGN_HEURISTICS.md`](../WEBSITE_DESIGN_HEURISTICS.md). Before shipping an experiment, fill every field, inspect the rendered route, and record Sirui's keep/revise/remove decision. A reference is permission to study a principle, not permission to copy code, assets, or visual identity.

## Experiment Record

| Field           | What to record                                                                             |
| --------------- | ------------------------------------------------------------------------------------------ |
| Hypothesis      | The visitor problem and the specific improvement expected.                                 |
| Route           | The smallest public surface where the idea can be tested.                                  |
| Reference       | The source that shaped the idea and what was learned from it.                              |
| Licensing       | Whether code/assets may be used, what credit is required, and unresolved questions.        |
| Visitor benefit | What becomes clearer, easier, more meaningful, or more delightful.                         |
| Budget          | Performance, accessibility, motion, privacy, and maintenance limits.                       |
| Status          | `idea`, `scoped`, `prototype`, `implemented`, `kept`, `revised`, `removed`, or `deferred`. |
| Evidence        | Comparable screenshots, measurements, tests, and observed tradeoffs.                       |
| Sirui decision  | Keep/revise/remove plus the judgment behind it.                                            |
| Revisit trigger | A concrete event that makes another pass worthwhile.                                       |

## Current And Deferred Experiments

### October 1 working previews: selected work and a quieter conversation note

- **Hypothesis:** A larger original figure beside a short explanation lets a visitor inspect the strongest work earlier; a small margin photograph or text acknowledgement can connect the thesis to people without making one encounter dominate it.
- **Route:** Unlisted `/design-lab/` previews A, B1 and B2. DesignWeaver now leads homepage selected work; the workshop paper remains in the archives. B1 adds a small margin photograph to the homepage thesis; B2 is retained as a text-only comparison.
- **Reference:** [087's artifact and process relationship](https://miaai-lab.github.io/Claude-Opus-5.5-100-HTML-Files/087-sketchbook-portfolio.html), [008's editorial figure and margin-note relationship](https://miaai-lab.github.io/Claude-Opus-5.5-100-HTML-Files/008-lighthouse-longform.html), and its two versions inspected in the [unified collection](https://zcnofdpgpxud.feishuapp.com/app/app_17exzr8eka4/). Keep this site's Inter, ordinary scrolling, and theme tokens.
- **Licensing:** Original markup and styles around existing Sirui figures, approved copy, and the already-public Don Norman photograph. No reference code, imagery, fonts, or video imported. The displayed design principle is explicitly Sirui's words.
- **Visitor benefit:** Inspect the original DesignWeaver interface at a useful size, then follow a direct case-study link; understand that the thesis develops through work with Steven P. Dow and conversations with Don Norman and many others.
- **Budget:** No new runtime dependencies or motion. Whole, uncropped research figures with declared dimensions. Native links, theme-aware surfaces, readable mobile stacking, no horizontal overflow. The review route has no navigation/search/sitemap entry and requests `noindex, nofollow`.
- **Status:** Selected-work, shared-credit and B1 corrections are `implemented` locally. B2 remains a comparison on the review route.
- **Evidence:** Original desktop renders and the responsive report live under `.jekyll-cache/visual-qa/october-design-previews-revised/`. The [preview handoff](design-previews-2026-10-01.md) records sources and comparisons. These establish rendered behavior, not measured visitor comprehension.
- **Sirui decision:** Requested ongoing implementation and concrete renders. Declined the workshop paper's selected-work prominence and the Don-dominant framing; requested broader credit, then chose B1's small margin photograph. Integrated B1 after that choice.
- **Revisit trigger:** Revised wording or whether the small photograph still gives one person disproportionate emphasis.

### October 1 quiet updates and contextual record caption

- **Hypothesis:** A dated reading list avoids empty equal-height cards and truncated announcements; a caption tied to the visible record avoids labeling an ordinary portrait with a song title.
- **Route:** Existing homepage updates and 2D portrait/record; preview C shows the same updates treatment.
- **Reference:** [003's aligned reading structure](https://miaai-lab.github.io/Claude-Opus-5.5-100-HTML-Files/003-swiss-poster-machine.html). The record refinement follows the existing 057/V07 causal-state work rather than adding another control layer.
- **Licensing:** Original styles and interaction changes; existing announcement content, dates, record metadata, and sources are preserved.
- **Visitor benefit:** Read complete news entries and understand which artwork a source link identifies. The source remains reachable as keyboard focus moves from the disc into its caption.
- **Budget:** Preserve native disc controls, shared 2D/3D state, stable caption space, accessible focus, reduced motion, and offscreen suspension. No new controls or dependencies.
- **Status:** `implemented` locally; visual review remains open.
- **Evidence:** Comparable work/update captures, the responsive preview report, and the existing on-disc interaction case with caption focus/return checks. See the [preview handoff](design-previews-2026-10-01.md).
- **Sirui decision:** Authorized the next refinement pass and asked to judge concrete renders. Preview C is available for keep/revise/remove feedback.
- **Revisit trigger:** Sirui's response to C or a record input path that loses its source link or leaves a stale caption.

### Reading roles across the public site

- **Hypothesis:** A consistent title hierarchy, comfortable prose measure, and compact utility metadata let readers find work and scan notes sooner.
- **Route:** Blog and project indexes, CV, publications, and the What Happened and Why? case study; review the remaining public routes for shared regressions.
- **Reference:** [008 editorial composition](https://miaai-lab.github.io/Claude-Opus-5.5-100-HTML-Files/008-lighthouse-longform.html), [087 process beside artifacts](https://miaai-lab.github.io/Claude-Opus-5.5-100-HTML-Files/087-sketchbook-portfolio.html), and the [current unified effect collection](https://zcnofdpgpxud.feishuapp.com/app/app_17exzr8eka4/). Study spatial relationships and causal feedback while retaining this site's Inter roles and theme tokens.
- **Licensing:** Original site changes; no reference code, fonts, illustrations, audio, or screenshots copied into public pages.
- **Visitor benefit:** Distinguish a page title from a list entry, read the research without overly long lines, reach papers sooner, and keep captions clear of P.
- **Budget:** Preserve research meaning, signature copy, scientific figure pixels, publication status, the requested rejection badges, and exact XP. Native scrolling, immediately readable prose, complete figures, keyboard paths, and four viewport/theme checks.
- **Status:** `implemented` locally; title roles, archive navigation, the publications opening, the trace-paper reading spread, announcement titles, and P's caption clearance are integrated on `main`.
- **Evidence:** The [October 1 review](design-review-2026-10-01.md) records 54 inspected HTML targets, desktop/phone comparisons, explicit four-viewport light/dark checkpoints, and keyboard/interaction checks. Every published note, local project, paper context, and announcement received individual inspection. Repeated archive filters were sampled. Visitor comprehension remains unmeasured.
- **Sirui decision:** Requested a whole-site visual review and improvements informed by both collections. Final visual taste remains reviewable; visitor benefit has not been measured in a study.
- **Revisit trigger:** The integrated before/after review or a new public route that breaks the reading roles.

### La Jolla home: geometry and physical relationships

- **Hypothesis:** More credible adult proportions, hollow and rounded everyday objects, recognizable coastal geology, and consistent contact and light make the inhabited room convincing at its actual homepage size.
- **Route:** Existing Realistic coastal home and the 2D vinyl mechanism, with close-up authoring renders used to inspect details.
- **Reference:** [057 fixed light and vinyl mechanics](https://miaai-lab.github.io/Claude-Opus-5.5-100-HTML-Files/057-vinyl-listening-room.html), [093 constrained mechanical contact](https://miaai-lab.github.io/Claude-Opus-5.5-100-HTML-Files/093-strandbeest-walker.html), [096 coherent architectural light and material](https://miaai-lab.github.io/Claude-Opus-5.5-100-HTML-Files/096-concrete-monolith.html), and [V07 continuous interaction](https://zcnofdpgpxud.feishuapp.com/app/app_17exzr8eka4/#v07-ui-morph). Select primary graphics research after inspecting the existing analytic water, reflections, and contact-shadow implementation; document actual equations and approximations, rather than declaring a renderer state of the art.
- **Licensing:** Original Blender geometry and shader/dynamics implementations around the existing licensed Three.js runtime. Record research sources near the implementation; no reference models, illustrations, textures, or audio imported.
- **Visitor benefit:** Read a human action, understand the record mechanism, and recognize the room as part of a continuous La Jolla cliff and Pacific environment.
- **Budget:** Preserve the five adult male identities, long swept-back hair and glasses, shared record state, automatic routine, original capybara wall print, contact anchors, 2D default, native scroll, and graphics-failure alternatives. Bound asset size and rendering cost with measured evidence. Alternate public art directions remain deferred.
- **Status:** `implemented` locally; original model refinements and the paper-informed water, light, reflection, and record mechanics are integrated on `main`.
- **Evidence:** The [October 1 review](design-review-2026-10-01.md), [physical methods](../assets/js/home-scene/PHYSICS.md), and [model comparisons](evidence/coastal-models-2026-10-01/README.md) record source measurements, actual browser views, visible water/orbit/zoom changes, interruption and suspension checks, reduced-motion and graphics-failure alternatives, and measured asset/frame costs.
- **Sirui decision:** Requested parallel improvement of the room, vinyl, objects, human figure, environment, and customized paper-informed physical techniques. No scientific validation or universal SOTA claim follows from that request.
- **Revisit trigger:** The integrated geometry/material review, a remaining contact or silhouette defect, or a measured performance regression.

### Tactile record and continuous interaction states

- **Hypothesis:** Better light, mechanical cause and effect, and a readable record caption make the existing meme spinner more understandable and personal without enlarging the hero.
- **Route:** Homepage 2D record first; existing project expansion only after a successful bounded state experiment.
- **Reference:** [057 Vinyl Listening Room](https://miaai-lab.github.io/Claude-Opus-5.5-100-HTML-Files/057-vinyl-listening-room.html), [V07 source](https://youmind.com/video-prompts/ui-morphing-motion-template-11361), and [050 micro-interactions](https://miaai-lab.github.io/Claude-Opus-5.5-100-HTML-Files/050-loader-atelier.html). Detailed critique in the [September 29 study](design-study-2026-09-29.md).
- **Licensing:** Principles only; no reference code, audio or assets copied. Implement with site-owned controls and the current licensed renderer. Any later reuse requires a source-specific license check.
- **Visitor benefit:** Understand the selected record, its source and the result of an action while retaining a playful physical object.
- **Budget:** Current hero footprint and shared 2D/3D state; no new rendering engine, autoplay audio, fake audio meters or progress, or continuous decorative loops. Stationary accessible controls, interruptible motion, reduced-motion still state and offscreen suspension.
- **Status:** `implemented`; release checks and rendered comparison are recorded in the study.
- **Evidence:** Desktop and phone captures reviewed after iteration. Four-viewport checks verify fixed controls, continuous pause/resume, keyboard order, reduced motion and offscreen suspension. The record is a visual spinner; visitor benefit remains a hypothesis.
- **Sirui decision:** September 29: named V07 and 057 as promising, then requested completion, iteration and publication of all planned refinements. Visitor benefit remains a hypothesis.
- **Revisit trigger:** The next record refinement; compare material-only and material-plus-motion versions at the actual homepage size.

### Artifact-and-decision reading spreads

- **Hypothesis:** A real artifact paired with a short note about the decision it informed makes research thinking clearer and uses wide-screen space meaningfully.
- **Route:** One existing turning point in DesignWeaver or Website Revamp before wider reuse.
- **Reference:** [008 editorial layout](https://miaai-lab.github.io/Claude-Opus-5.5-100-HTML-Files/008-lighthouse-longform.html), [087 sketchbook process](https://miaai-lab.github.io/Claude-Opus-5.5-100-HTML-Files/087-sketchbook-portfolio.html), and [003 hierarchy](https://miaai-lab.github.io/Claude-Opus-5.5-100-HTML-Files/003-swiss-poster-machine.html); [study](design-study-2026-09-29.md).
- **Licensing:** Original layout around existing credited artifacts. No copied illustrations, fake manuscript material or replacement research figures.
- **Visitor benefit:** See what changed and why, with evidence adjacent to the explanation.
- **Budget:** Existing typography and theme tokens, immediately readable prose, complete figures, native scrolling. A short side note on wide screens becomes inline on phones. Enhance the current lens/comparison treatment instead of adding duplicate panels.
- **Status:** `implemented` in DesignWeaver; complete figure and three documented mechanism notes.
- **Evidence:** Complete figure and notes reviewed at desktop and phone sizes. The first composition squeezed the figure, so the final spread uses the wider desktop canvas and stacks on small screens. Four-viewport checks verify complete, unfiltered imagery and no overflow.
- **Sirui decision:** September 29: requested completion, iteration and publication of the proposed refinements. Final visual taste remains open to his review.
- **Revisit trigger:** A case-study refinement with a documented turning point and inspectable source artifact.

### A quiet key to the La Jolla miniature

- **Hypothesis:** Linking an accessible place list to selected geometry helps visitors understand the miniature and its personal meaning.
- **Route:** A little La Jolla project page first, without adding permanent controls to the shared footer.
- **Reference:** [056 drawing and key](https://miaai-lab.github.io/Claude-Opus-5.5-100-HTML-Files/056-architectural-blueprint.html); [study](design-study-2026-09-29.md).
- **Licensing:** Existing original geometry and place provenance; no reference blueprint or invented survey data.
- **Visitor benefit:** Identify a landmark, see the corresponding building group, and read a concise source-backed or personal note.
- **Budget:** One selected place at a time, touch and keyboard equivalents, ordinary text/link fallback, clear reset, and no extra renderer. Geometry must be recognizable independently of labels. Preserve the authored-collage boundary and the deferred status of alternate home rendering styles.
- **Status:** `implemented` on the La Jolla project; four source-backed places, actual geometry emphasis, native fallback and reset.
- **Evidence:** All four names select actual building groups without changing the orbit. Desktop and phone captures reviewed; four-viewport selection and unavailable-WebGL checks pass. A key alone does not establish architectural or geographic accuracy.
- **Sirui decision:** September 29: requested completion and publication after the study. The scene remains an authored place collage; visual taste remains reviewable.
- **Revisit trigger:** The next review of the miniature's project page, after architecture and placement are convincing.

### Authored reading starts in Paper Constellation

- **Hypothesis:** One or two short reading routes help a newcomer choose a first paper and understand its relationship to a second.
- **Route:** Optional Paper Constellation view on publications; authoritative list stays default.
- **Reference:** [036 selected network route](https://miaai-lab.github.io/Claude-Opus-5.5-100-HTML-Files/036-transit-map.html); [study](design-study-2026-09-29.md).
- **Licensing:** Original UI using the existing constellation data; no transit artwork or simulation copied.
- **Visitor benefit:** A meaningful starting point and an explanation of the next connection.
- **Budget:** Reuse existing graph/trail emphasis, preserve extension versus bridge semantics, and exclude anonymous future work. Compare against a plain two-link note before adding controls. No force simulation, animated trains or invented journey metrics.
- **Status:** `implemented`; two ordered pairs reuse the existing graph and direct publication routes.
- **Evidence:** Two authored pairs preserve direct paper links, with the thematic bridge distinguished from a benchmark extension. Four-viewport interaction checks verify disclosure, graph emphasis and filter interruption. Phone capture reviewed.
- **Sirui decision:** September 29: requested completion and publication of the study's refinements. Visitor benefit remains a hypothesis.
- **Revisit trigger:** A newcomer cannot choose where to start from the existing publication orientation.

### A shared print treatment for original personal illustrations

- **Hypothesis:** A limited, coherent print treatment can connect a few original Fun illustrations without flattening the diversity of project evidence.
- **Route:** One original personal illustration or coastal postcard first.
- **Reference:** [049 Riso Lab](https://miaai-lab.github.io/Claude-Opus-5.5-100-HTML-Files/049-riso-halftone-lab.html); [study](design-study-2026-09-29.md).
- **Licensing:** Original or licensed artwork only; no demo asset or runtime copied.
- **Visitor benefit:** A recognizable personal visual voice at thumbnail size.
- **Budget:** Static art, modest texture, existing color tokens and readable captions. No sitewide paper overlay, live print engine, grayscale-on-hover revival, or filters on research figures and photographs.
- **Status:** `implemented`; static framing on the existing coastal concept pair, with unfiltered images and original provenance.
- **Evidence:** Desktop composition reviewed; the original credited images stay complete and unfiltered. Responsive light/dark route checks pass. The earlier full-color project-thumbnail correction remains in force.
- **Sirui decision:** September 29: requested completion and publication of the study's refinements. Final art direction remains open to review.
- **Revisit trigger:** A new personal illustration needs art direction, followed by thumbnail-size light/dark review.

### La Jolla along the footer

- **Hypothesis:** A small landscape at the end of a reading route makes the site feel personal and situated without interrupting the research.
- **Route:** The shared human footer; no scene on AI profiles, redirects, or the secret globe.
- **Reference:** Sirui's four miniature-city footer screenshots and two annotated DIB photographs, supplied September 14, 2026.
- **Licensing:** Original Blender geometry, an actual Cycles fallback render, and the existing licensed Three.js/Draco closure. No source website models, screenshots, or building photographs are shipped. See [provenance](../artwork/la-jolla/PROVENANCE.md).
- **Visitor benefit:** Discover La Jolla's coast, courts, houses, and a recognizable DIB with a small personal third-floor light. Wider displays also reveal Geisel, Salk, Brockton Villa, La Valencia and the Children's Pool seawall; phones can pan to these places.
- **Budget:** Approximately 2 MB of combined compressed footer and miniature geometry, load near the footer, at most 30 fps, capped pixel density, system reduced motion and offscreen suspension, native scrolling, and static graphics-failure/reduced-motion alternatives.
- **Status:** Implemented locally for visual review. The buildings form an authored place collage above a sourced OSM atlas; the office light is not an occupancy feed.
- **Evidence:** [Footer brief](la-jolla-footer.md) and [captures/checks](evidence/la-jolla-footer/README.md).
- **Sirui decision:** Requested implementation of the miniature La Jolla direction. On September 28 he rejected generic trees as widescreen filler and requested recognizable local architecture, informed by map outlines, aerial views and photographs, while retaining a cozy feeling. He then rejected the evenly spaced landmark lineup: distinct names alone do not make a convincing place. The revision groups the campus, home and coastal village through varied setbacks, continuous bluffs, a recessed Cove, park paths and a seawall connected to land. Final visual taste remains open to his review.
- **Revisit trigger:** Sirui's review, an obstructed reading/footer control, or a measured loading/rendering regression.

### Approved A–F reading enhancements

- **Hypothesis:** Let readers inspect relevant research details and materials without scattering the explanation.
- **Route:** DesignWeaver (lens, resource folder, compact sticky explanation), selected inline project references (local preview), Fun thumbnails (chroma), Website Revamp (matched Connect comparison).
- **Reference:** Aceternity Lens, Link Preview, Sticky Scroll Reveal, Compare; React Bits Folder and Chroma Grid. Links and credit appear in the Website Revamp story.
- **Licensing:** Original Jekyll/CSS/JavaScript implementations; no React component code or bundled dependency copied.
- **Visitor benefit:** Inspect a detail, recognize a destination, find supplementary resources, and compare an actual changed view.
- **Budget:** Direct full-image/material links, keyboard focus and Escape, native disclosure/range controls, full-color touch/reduced-motion thumbnails, no forced scrolling.
- **Status:** `kept` except the Fun chroma effect, removed after Sirui's September 28 review because mixed grayscale and color thumbnails made the project index inconsistent.
- **Evidence:** `test/visual/reading-effects.spec.js` and [refinement captures](evidence/coastal-refinement-2026-09-14/README.md).
- **Sirui decision:** Explicitly approved A–F and this implementation plan.
- **Revisit trigger:** An effect obscures a figure, makes navigation harder, breaks keyboard/touch access, or lacks a truly comparable image pair.

### GPT-7 handoff: three genuinely different ways to render the same home

- **Hypothesis:** Architectural and Illustrated could add expressive interpretations once each has convincing form, lighting, mark-making, and motion of its own.
- **Route:** The homepage scene's private `?scene-lab=1` prototype, before any public controls return.
- **Reference:** Sirui's supplied three-style boards and graphic illustration references. The current Realistic home is the shared spatial reference.
- **Licensing:** Original Blender geometry and the existing licensed Three.js closure. Study visual principles; do not copy film assets or research figures into decoration.
- **Visitor benefit:** A meaningful change in feeling and visual explanation, worth the extra choice.
- **Budget:** Preserve the scene's loading, accessibility, responsive layout, album state, and automatic Pacific routine. No landscape image behind the home.
- **Status:** `deferred`, explicitly for a future GPT-7 attempt.
- **Evidence:** The September 12 live review found that the three treatments were too similar and the Realistic treatment worked best. The old comparative captures remain in `docs/evidence/coastal-home-refinement/`.
- **Sirui decision:** Focus current implementation on Realistic. Remove the public style picker; retain the two experiments only in the authoring lab.
- **Revisit trigger:** GPT-7 or a later explicit Sirui request, followed by a convincing same-camera comparison. A shader swap alone does not qualify.

### September 2026 research studio and inhabited home

- **Hypothesis:** Concrete selected work followed by a quieter research narrative improves first-glance understanding, while an inhabited coastal miniature communicates Sirui's personality.
- **Route:** Homepage, project index/case pages, blog index/posts, publications, CV, news, archives, and the existing experiment routes.
- **Reference:** Sirui's approved editorial/notebook board, six-room board, corrected male character studies, and real portrait.
- **Licensing:** Original Blender geometry and generated Pacific print; font and loader licenses recorded in `artwork/coastal-home/PROVENANCE.md`.
- **Visitor benefit:** Direct project entry, more comfortable reading, and a small world with recognizable activities and clear exploration controls.
- **Budget:** Initial scene payload under 4 MB compressed; lazy room/character loading, capped density, offscreen pause, 2D recovery, and reduced-motion poses.
- **Status:** `revised` and integrated locally on `main`; continued visual refinement follows Sirui's live review.
- **Evidence:** `docs/research-studio-implementation.md` and `docs/evidence/research-studio/`.
- **Sirui decision:** Implement the supplied plan (September 2026); visual quality remains reviewable.
- **Revisit trigger:** Sirui's visual review or a failed contact/performance/accessibility check.

### Pacific print: authored layers, depth mesh, and image-derived splats

- **Hypothesis:** A generated coastal drawing can gain useful parallax without becoming a heavy homepage dependency.
- **Route:** Separate local `artwork/coastal-home/splat-lab/`; excluded from Jekyll output.
- **Reference:** Spark's documented `imageSplats` API, pinned Spark 2.2.0 and Three.js r180.
- **Licensing:** Same original print and pinned open-source libraries; homepage remains on r164.
- **Visitor benefit:** Compare edge fidelity, holes, texture stretching, and frame cost from the same camera.
- **Budget:** Three authored layers, 25,600 mesh triangles, or a subsampled Gaussian field; no training or claim of recovered geometry.
- **Status:** `prototype`; findings in the implementation handoff.
- **Evidence:** Front and oblique captures plus runtime frame-rate samples.
- **Sirui decision:** Build an isolated experiment and report the tradeoff.
- **Revisit trigger:** A measured quality or performance advantage over simple textured geometry.

The entries below retain historical experiment context. Their old typography, numerical count-ups, single-room boundaries, and deferred GPT-6 status are superseded by the active September 2026 brief and heuristics.

## Historical Experiment Record

### The cinematic layer: scroll scenes, spotlight, and tilt

- **Hypothesis:** A reader understands a research project faster when the page walks them through its one figure step by step, and a project grid feels alive when the card under the pointer answers it. Scroll-driven scenes and pointer-aware surfaces can do both without taking control of scrolling.
- **Route:** Pages that declare `cinematic: true`: the projects index first (entrance stagger, section headings sliding in, a pointer spotlight and a few degrees of tilt over the card grid, a title that lingers as the page starts to move, a slow gradient field behind the page title) and the DesignWeaver case study (the hero copy scrolls away while the teaser stays; three steps take its place and a lens moves over the part of the figure each step describes; proof numbers count up once). Second slice: the homepage below the desk (a story thread that fills with scroll and lights the section being read, headings that drift slower than the page, a marker that sweeps the thesis question, staggered claim and update cards, counting build-ledger numbers) and a card-to-hero morph between the projects index and a case page. Third slice: the blog index as an editorial list (date column, hover hairline and title underline) and the publications page with papers first, the thread beside the year headings, and Scholar bars that grow into view.
- **Reference:** GSAP 3 with ScrollTrigger for choreography; CSS `position: sticky` for the stage so the scene also works without script; the site's own explain-the-page motion rules, now with bounded permissions for parallax, spotlight, and pinned scenes.
- **Licensing:** GSAP 3.15.0 core and ScrollTrigger vendored under the GSAP Standard License (free for any use since 3.13); provenance in `assets/vendor/gsap/3.15.0/NOTICE.md`.
- **Visitor benefit:** The figure is read in the order the research happened; the grid says "this is a thing you can open" before a click; nothing moves faster than reading and nothing loops quickly.
- **Budget:** About 117 KB of script before compression, loaded only on opted-in pages; no wheel or touch hijacking; every effect is a still page under reduced motion, without a fine pointer, or under automation (visual captures see the still page unless a run opts into `?cinematic=live`).
- **Status:** `prototype`; Sirui chose the cinematic tier and this first slice on 2026-09-05 and reviews the live result. Fourth slice (2026-09-05, after Sirui called the homepage scroll "a bit vanilla" and pointed at <https://pear.no/> as inspiration): the homepage Research Focus becomes a pinned scroll story (the sketch stays beside the three lens notes and the note in view picks the lens), the thesis paragraph arrives word by word with scroll, blog posts get staged reveals, and shallow parallax (Sirui asked for 视差滚动) separates the principle note from the thesis, the why-now framing from its claims, a case figure from its copy, and blog figures from their words, whole and uncropped. From pear.no the site borrows the idea of one pinned scene whose copy changes as the reader scrolls and of a statement that assembles itself on arrival, not its full-bleed illustrated world, serif display face, dark field, or labeled progress rail (the rail was already rejected as the side thread). Sirui's second look (2026-09-05): the pinned sketch now sits in its own sticky well, stops with its notes, and fills the viewport beside them under a 3:4 cap.
- **Evidence:** Runtime in `assets/js/cinematic.js`, styles in `_sass/_cinematic.scss`, the scene markup in `_projects/designweaver.md`, the wiring in `_includes/scripts.liquid` and `_layouts/page.liquid`; production build, Playwright probes with `?cinematic=live`, the project-card FLIP suite, and the projects and DesignWeaver checkpoints.
- **Sirui decision:** Direction approved 2026-09-05 ("be creative and wild and fun, make something great and iterate"). First review the same day: keep the projects index, the DesignWeaver scene, the homepage marker and count-ups, the blog rows, and the morph; drop the side threads, the gradient field behind page titles, the title drift, and the papers-first reorder ("the design modification you make should be meaningful and add value instead of confusion"); make the Research Focus sketch and the Paper Constellation more elegant instead.
- **Revisit trigger:** Sirui's review, any reader report of motion sickness or a stuck lens, a Lighthouse total-blocking-time regression on the projects index, or a GSAP release that changes the ScrollTrigger API.

### Generated imagery and a continuous homepage world (GPT-6 lane)

- **Hypothesis:** The homepage reads as a sequence of sections because only the desk at the top has a world. If the desk's horizon, paper, and coastal language continue down the page as a slow scroll-scrubbed backdrop, and posts and cards that have no image get one made for them, the site feels like one place rather than a template with a scene on top. Sirui named <https://pear.no/> as the reference on 2026-09-05: one illustrated world the reader scrolls through, imagery that changes with scroll, big statements with tiny mono labels.
- **Route:** Homepage below the desk first (desk-scene lane, since the world belongs to the scene); then blog thumbnails for posts without one (the index reserves a fixed 4:5 well), section art for Why now and Recruiting, and made images beside research figures on the cards, never in place of the real figure.
- **Reference:** pear.no for the continuous-world idea only; the site's own paper and coastal language from `docs/homepage-desk-scene-brief.md`; the bounded motion rules in `WEBSITE_DESIGN_HEURISTICS.md` (Motion).
- **Licensing:** Generated assets record prompt, model, date, and license here before they ship; nothing from pear.no is copied (no artwork, type, layout, or code). Any reference photo used for a generation must be owned or licensed.
- **Visitor benefit:** Orientation and mood: the page feels like one place, sections are easier to tell apart at a glance, and posts without an image stop looking like gaps in the blog index.
- **Budget:** Backdrop imagery must stay quieter than text (no reading surface loses contrast), load lazily below the fold, keep the LCP element the hero, and be a still image under reduced motion and automation. Total added weight per route under 300 KB compressed until Lighthouse proves headroom.
- **Status:** `deferred` until GPT-6's session; no asset exists yet.
- **Evidence:** None yet. Acceptance is the four-viewport checkpoint on `home` and `blog-index`, light and dark, reduced motion, plus a Lighthouse re-measure against the 2026-09-05 baseline in `docs/site-experience-roadmap.md`.
- **Sirui decision:** 2026-09-05: "I will use GPT-6 later to make the experience better because it can generate images." Fable left the image-led parts open on purpose.
- **Revisit trigger:** GPT-6's first pass; any Lighthouse LCP or CLS regression on the homepage; Sirui's review of the first generated asset.

### Cross-document continuity for same-origin navigation

- **Hypothesis:** A short root crossfade between pages, with the navbar and progress bar held still, lets a reader keep their place in the site's chrome while the content changes, replacing a white flash with continuity.
- **Route:** Every same-origin navigation between two opted-in documents; the AI profile, the homepage, and the hidden page are not opted in, so navigations to or from them stay hard cuts.
- **Reference:** The CSS View Transitions Level 2 cross-document API; the site's own explain-the-page motion rules.
- **Licensing:** Platform feature; no external code.
- **Visitor benefit:** Object constancy for the chrome and a calmer page change, at the standard 180 ms duration, once per navigation.
- **Budget:** Pure opacity on the root snapshot, no element morphs, no clipping; browsers without support or with reduced motion get an instant swap; captures in the visual harness are unaffected because they navigate with `page.goto` and disable animations.
- **Status:** `prototype`; awaiting Sirui's judgment on a live click-through in all four theme modes.
- **Evidence:** Stylesheet emitted per document from `_includes/head.liquid`; timing in `_sass/_transitions.scss`; PurgeCSS safelists the pseudo-elements.
- **Sirui decision:** Not yet judged. Card-to-hero element morphs were set aside at first; on 2026-09-05 Sirui asked for the cinematic tier, so the cinematic layer now names the clicked card image and the case page's hero image `project-hero` for a shared-element morph in both directions (see the cinematic layer entry). The projects index's own FLIP is untouched.
- **Revisit trigger:** Sirui's live review, or any report of a flash, a doubled navbar, or a stuck transition.

### Hatched fill for later code-activity sources under high contrast

- **Hypothesis:** Readers who ask for `prefers-contrast: more` could tell the intern band from the personal band by texture as well as hue, so the stacked commit bands would survive grayscale printing and forced-colors modes.
- **Route:** The Build Rhythm commits panel on `/github-activity/`, only when more than one code-activity source is visible.
- **Reference:** The dataviz method's texture rule for the CVD/print/forced-colors case; the site's own seam-and-hue treatment shipped in the key redesign.
- **Licensing:** Site-owned SVG `<pattern>`; no external asset.
- **Visitor benefit:** Identity of the second source no longer depends on color alone in the one mode where color is deliberately reduced.
- **Budget:** No new value line; the key swatch must keep matching the band fill exactly, which a `url(#pattern)` paint breaks unless the swatch adopts the same pattern; no change outside the contrast media query.
- **Status:** `deferred`; the shipped high-contrast treatment raises the alt band to 0.7 opacity and widens the seam to 2px instead.
- **Evidence:** Olive versus the terracotta Claude area measures OKLab ΔE 15.5–17.0 across the four theme modes, so hue alone now clears the normal-vision floor; no high-contrast user evidence yet.
- **Sirui decision:** Not yet judged; the seam-and-hue pass was chosen because it keeps swatch equals fill.
- **Revisit trigger:** A forced-colors or grayscale-print review of the chart, or a third code-activity source.

### Dot Orbit behind Research Focus

- **Hypothesis:** A clearly perceptible but secondary moving field can make the three research modes feel more alive while the semantic 2D drawing remains the explanation.
- **Route:** Only routes that render the Research Focus component: the homepage and Website Revamp story.
- **Reference:** [Paper Shaders](https://shaders.paper.design/) by [Paper](https://paper.design/), plus the founder's [design walkthrough](https://youtu.be/P06RgnUKX_I?si=7xfPgwCjDHvjVG46).
- **Licensing:** Vendored minimal ESM closure from `@paper-design/shaders@0.0.80` under Apache-2.0, with license, notice, source, version, integrity, and per-file hashes retained.
- **Visitor benefit:** Mode changes gain a subtle sense of gathering, testing, and situating without adding another explanation or hiding the existing controls.
- **Budget:** One WebGL2 context; at most 480,000 processed pixels; offscreen and hidden-tab pause; deterministic reduced-motion still; complete 2D fallback; no layout shift or blocking loader.
- **Status:** `revised`; awaiting Sirui's live visual judgment.
- **Evidence:** Automated checks observed one live context, no more than 480,000 processed pixels, no layout shift, offscreen and hidden-tab pausing, mode-responsive parameters, a deterministic reduced-motion still, and an intact 2D experience after module failure and simulated context loss. Sirui's first live review found the original nested opacity treatment perceptually absent: the implementation existed, but the design did not communicate that it existed.
- **Sirui decision:** Strengthen the Paper color and compositing levels enough to be unmistakable on entry, while keeping the semantic canvas above it. Do not call an imperceptible effect “restrained.”
- **Revisit trigger:** Sirui's next live preview judgment, or any contrast, frame-time, context-count, layout-shift, or comprehension regression.

### Interaction-linked glint for origin stories

- **Hypothesis:** A tiny glint can stay out of the reading hierarchy, then become legible when someone engages the artifact or focuses the provenance route.
- **Route:** Every existing origin-link placement; no new origin links are invented in this pass.
- **Reference:** The site's existing source-linked project stories and Sirui's request for subtler motion and illumination.
- **Licensing:** Site-owned SVG and CSS; no external asset.
- **Visitor benefit:** Curious readers can follow the design story while everyone else reads the artifact without icon clutter or a surprise popover.
- **Budget:** 44px target; immediate focus ring; no spatial animation, tooltip, pulse, or JavaScript; visible text must remain legible at 200% zoom.
- **Status:** `revised`; the wordmark has been removed and the interaction-linked glint is awaiting rendered judgment.
- **Evidence:** Sirui rejected the original dot-and-line mark because it resembled a slider, the large hover disclosure because it was confusing, and the later `story ↗` wordmark because it became a prominent repeated action that affected the general experience.
- **Sirui decision:** Keep the 44px target and concrete story destination, but show only a tiny four-point glint at rest. Let the glint extend and illuminate briefly on owner hover/focus or direct interaction; use no wordmark, arrow, continuous pulse, slider line, or custom tooltip.
- **Revisit trigger:** Sirui's next live preview judgment, or evidence that the wordmark competes with its artifact or becomes too easy to miss.

### Static Paper Texture for Website Revamp

- **Hypothesis:** A seeded paper texture can give the Website Revamp story a tactile, authored surface without spending another runtime WebGL context or delaying its text.
- **Route:** Website Revamp story only.
- **Reference:** [Paper Shaders](https://shaders.paper.design/) by [Paper](https://paper.design/), plus the founder's [design walkthrough](https://youtu.be/P06RgnUKX_I?si=7xfPgwCjDHvjVG46).
- **Licensing:** Site-owned deterministic output; the reproducible recipe records its Paper Texture inspiration, seed, parameters, output hash, and source credits. No third-party runtime code is needed for the image.
- **Visitor benefit:** The story gains a quiet material identity that supports its editorial pacing instead of adding another box or animation.
- **Budget:** One responsive WebP, no runtime context, no loader, decorative semantics, and sufficient foreground contrast in light and dark themes.
- **Status:** `kept` after the sitewide realignment release QA.
- **Evidence:** The deterministic WebP and recipe reproduce the same hashed asset. Four-viewport light/dark inspection showed no text obstruction, layout shift, or extra loading state.
- **Sirui decision:** Keep it as a story-specific material accent, not a new sitewide background language.
- **Revisit trigger:** The texture becomes visually generic, weakens contrast, or begins spreading to routes without a narrative reason.

### Static Paper fields for project identity

- **Hypothesis:** A small family of semantically matched shader fields can make projects feel authored and distinct without turning the whole site into one ambient effect.
- **Route:** Paper Waves on Build Rhythm and the playful-build category; Paper Static Mesh Gradient on DesignWeaver and the research category.
- **Reference:** [Paper Shaders](https://shaders.paper.design/) by [Paper](https://paper.design/), using the package's static Waves and Static Mesh Gradient shaders.
- **Licensing:** Deterministic WebPs generated from the vendored Apache-2.0 `@paper-design/shaders@0.0.80` closure; recipes retain shader names, parameters, output hashes, package version, and source URLs.
- **Visitor benefit:** Build Rhythm gains a cadence-shaped field, while DesignWeaver's many-dimensional design space gains a blended color field. The project index quietly previews that distinction at category boundaries.
- **Budget:** Two static WebPs totaling under 400 KB; no additional live WebGL context, loader, layout shift, or continuous animation; short owner-hover background shift only; hidden under increased contrast and forced colors.
- **Status:** `prototype`; awaiting rendered judgment on the project index and both project stories. The DesignWeaver field is masked to an ellipse behind the title and figure (2026-09-05): the scroll scene had stretched the full-box field into a two-viewport column whose edge read as a sharp color step against the page in evening mode.
- **Evidence:** Both outputs pass deterministic recipe/hash checks and direct pixel inspection. Route-level light, dark, mobile, and reduced-motion judgment remains before release. After the mask, pixel sampling at the DesignWeaver hero's sides shows no step in either theme where evening mode had a 12-level one.
- **Sirui decision:** Use different shaders only where their visual behavior helps explain the project. Do not assign every route a shader or turn shader variety into the site's navigation system.
- **Revisit trigger:** The fields read as generic decoration, compete with project evidence, cost too much on mobile, or fail to remain recognizably different at their rendered opacity.

### Paper Water for the 3D ocean

- **Hypothesis:** A restrained water shader could make the cliff-cave exterior feel more spatial and alive without becoming the subject of the homepage.
- **Route:** Homepage 3D desk exterior only.
- **Reference:** [Paper Shaders](https://shaders.paper.design/) by [Paper](https://paper.design/).
- **Licensing:** Reassess the exact package/version and preserve its license before any implementation.
- **Visitor benefit:** Stronger continuity between the room, cliff edge, and ocean when exploring the 3D view.
- **Budget:** Separate desk-scene lane; one-scene topology and reflection proof; stable low-end frame rate; reduced-motion still; no change to 2D/3D state continuity.
- **Status:** `deferred`.
- **Evidence:** None yet; do not infer feasibility from the Research Focus substrate.
- **Sirui decision:** Worth revisiting, not part of the sitewide realignment release.
- **Revisit trigger:** A dedicated desk-scene brief with full topology, performance, and cross-device acceptance evidence.

### Owned-photo editorial abstraction

- **Hypothesis:** A sparse abstraction of an owned travel photo could add personal visual memory to one story without introducing a generic stock-image mood.
- **Route:** One future photo-led post or project, selected before prototyping.
- **Reference:** [`Evianis/travel-photo-abstraction`](https://github.com/Evianis/travel-photo-abstraction).
- **Licensing:** Source-available with modification and redistribution constraints; do not vendor, modify, or redistribute the skill without a separate permission review. Use only an owned input photo.
- **Visitor benefit:** A story-specific visual pause that carries place and memory while keeping text readable.
- **Budget:** One static asset, descriptive alt text, no runtime dependency, and a before/after review showing that the abstraction supports rather than replaces the story.
- **Status:** `deferred`.
- **Evidence:** Reference reviewed; no site asset created.
- **Sirui decision:** Keep as a future owned-photo experiment.
- **Revisit trigger:** Sirui chooses an owned photograph and a story where place is part of the claim.

### One conclusion per chart

- **Hypothesis:** Giving each chart one explicit question and a reading speed matched to its evidence will make Build Rhythm and future data stories easier to enter.
- **Route:** Build Rhythm first; later chart-bearing stories only after comparison.
- **Reference:** [`lieflat-charts`](https://github.com/larashero3-dotcom/lieflat-charts/blob/main/README.en.md), used as an influence for conclusion-led charts and varied reading speeds.
- **Licensing:** Do not copy templates or code without a separate license decision.
- **Visitor benefit:** Faster orientation while exact values and boundaries remain available.
- **Budget:** No loss of metrics, table access, provenance, keyboard inspection, or uncertainty language.
- **Status:** `kept` in Build Rhythm; a reusable visual grammar remains `deferred`.
- **Evidence:** Four-viewport rendered review and legacy interaction checks confirmed that each chart opens with one question, the conclusion and limits precede implementation history, literal and linear readings remain distinct, and exact tables remain reachable without changing any metric or evidence boundary.
- **Sirui decision:** Keep the narrative principle. Do not adopt an external chart template until another data story proves the grammar transfers cleanly.
- **Revisit trigger:** The Build Rhythm release is deployed and reviewed at all four standard viewports.

### Retell the remaining project stories in situated waves

- **Hypothesis:** Giving each project the medium and pacing its evidence deserves will feel more human than applying one case-study template everywhere.
- **Route:** The project index and every project story not deeply rewritten in the current release.
- **Reference:** The “Less, but more Sirui” spine, the Website Revamp and Build Rhythm retellings, and the one-conclusion-per-chart lesson above.
- **Licensing:** Use project-owned text and assets; make a separate license decision before importing any external template, code, photograph, or generated visual system.
- **Visitor benefit:** Each project becomes easier to enter and more memorable without losing evidence boundaries or Sirui's phrases.
- **Budget:** Preserve every factual claim, source link, privacy boundary, reproduction record, accessible fallback, and project interaction contract. Deep-rewrite one route at a time with fixed before/after captures.
- **Status:** `deferred`; this release applies only the shared hierarchy, lighter type, provenance disclosure, and interaction-linked origin glint.
- **Evidence:** The two flagship retellings establish the first comparison pair. No claim is made yet that the same narrative shape fits the other projects.
- **Sirui decision:** Sequence future passes instead of forcing a uniform rewrite into this release.
- **Revisit trigger:** Start a new visual lane with the owning story sources and baseline captures available.

Suggested sequence:

1. **Spatial and data stories:** The Desk That Learned Depth, Paper Constellation, and Scholar Lens. Decide separately whether each story is best taught through interaction, diagram, or annotated evidence.
2. **Playful provenance stories:** Wall of Rejection, The IKEA Card Experiment, HCI Spooder-Man, Dogtor's Hidden Portal, and OpenAI Build Week. Keep the joke or surprise, then move custody details behind it.
3. **Research artifacts:** DesignWeaver, What Happened and Why, HotSpot, Physion, GraphHSCN, and Context-Aware Encoding. Lead with the research question and connect to canonical publication evidence where it exists.
4. **Standalone world:** Not A Good Driver. Retell only when surviving visual evidence can support more than the current role-and-sightline account.

## Completed Experiments

Move an entry here only after recording evidence and Sirui's decision. Keep removed experiments too: knowing why an idea failed is part of the site's professional vision.

### Homepage build ledger and desk-scene tally

- **Hypothesis:** Publishing what the site cost in machine work (Codex tokens, agent-hours, commits, estimated kWh, and a tongue-in-cheek API-rate replay) as an honest receipt beside the contact links would make the vibe-coding story concrete and give the homepage one candid, slightly funny number block.
- **Route:** The homepage Connect section (`.home-agentic-tally` with four stat cells and the Sam-money cost tooltip), the 3D desk's compact `commits · tokens` tag, and the Build Rhythm token-rhythm and personal-agent panels on `/github-activity/`.
- **Reference:** The "honest receipt" idea in Less, But More Sirui; retained Codex session logs on one Windows checkout; this repository's Git history.
- **Licensing:** Site-owned markup, SCSS, Python, and one owned image (`sam-money-altman.png`), all removed with the feature.
- **Visitor benefit:** Intended: a scale marker for how much agent work the site took. Observed: once every agent user has billions of tokens the numbers stopped differentiating anything, and the caveats needed to keep them truthful outgrew the joke.
- **Budget:** Exceeded. The write audit took 50 to 110 minutes on the personal laptop and the hook's daily check about 100 seconds; 236 ledger-refresh commits (of roughly 1,980 on `main` by 2026-09-08) inflated the very commit count the block displayed.
- **Status:** `removed` (2026-09-08).
- **Evidence:** The audit read one machine's Codex logs only, so the published 13B tokens, 831 agent-hours, and 520 commits undercounted Claude and every other account while the refresh commits overcounted the build. Removal covered `_layouts/home.liquid`, `_includes/home/hero.liquid`, `_sass/_home.scss`, `assets/js/home.js`, the Build Rhythm page, script, and styles, the ledger tooling and data, the doc and skill, the hook branch, CI path filters, and the Playwright cases.
- **Sirui decision:** Remove, not tune: the numbers no longer say anything a reader could not assume, the accounting cost more than the joke returned, and the refresh commits polluted the history. One plain sentence linking the Website Revamp story and Build Rhythm replaces the block, and Build Rhythm keeps its code-history explorer only.
- **Revisit trigger:** A cross-account, cross-agent usage source that is exact, privacy-safe, refreshable in seconds, and a story in which the number itself changes what a reader understands.
