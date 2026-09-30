# Playfulness with a purpose: reference study

September 29, 2026. Started as a design study; Sirui subsequently requested that all planned refinements be implemented, checked, iterated and published. Read alongside [the design heuristics](../WEBSITE_DESIGN_HEURISTICS.md) and [experiment backlog](design-experiment-backlog.md).

## Judgment

The most promising direction is a research notebook inside an inhabited coastal home. The site already has enough interactive objects to establish that character. Make those objects more coherent, make research decisions more inspectable, and give each interaction a clear end state.

057 and V07 belong together: the first teaches material and mechanical coherence; the second teaches continuity between states. Their strongest application is the existing record, followed by a careful refinement of existing project expansion. The greatest reading benefit comes from 008 and 087: put a real artifact beside the thinking that changed it.

These are hypotheses for prototypes, not measured improvements. A beautiful full-screen demo does not establish that its details work at 300 pixels, beside a research introduction, on a phone, or with reduced motion.

## What was studied

- Screened the descriptions across the [100 HTML collection](https://miaai-lab.github.io/Claude-Opus-5.5-100-HTML-Files/) and the first collection's [22-entry source index](https://zcnofdpgpxud.feishuapp.com/app/app_17exzr8eka4/fusion/legacy-22). This was catalogue screening, not an interaction audit of every example.
- Inspected rendered examples 003, 008, 036, 049, 050, 056, 057 and 087. Exercised record play and album selection, an inline footnote, a selected map route, drawing tabs, the sketchbook's process navigation, and one feedback specimen.
- The first collection's V07 preview routed back to its index during inspection. Followed its attribution to the [YouMind source page](https://youmind.com/video-prompts/ui-morphing-motion-template-11361), inspected the playing source video in several states, and read its documented sequence. That page credits [@zero / twoclipping](https://x.com/twoclipping/status/2103273003555402193). The generated collection preview and original source are distinct references.
- Compared the live homepage's default portrait and active 2D record. Read the current scene brief, hero markup, record renderer/state code, and publication constellation data to avoid proposing features already present.
- Did not run a full accessibility, performance, or responsive audit of the reference demos. Their published test claims are not acceptance evidence for our site.

No reference code, audio, illustrations, textures or screenshots were copied into the website. Any implementation should be original and preserve source credit; source asset/code reuse would need a separate license check.

## A first-principles filter

| Visitor need                    | A useful design response                                                                | A reason to reject an effect                                               |
| ------------------------------- | --------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| Understand the research quickly | Keep the question, contribution, evidence and next link dominant                        | The visitor remembers the effect but cannot name the work                  |
| Understand what a click did     | Keep the acted-on object recognizable through its state change                          | A familiar control transforms into an unrelated function                   |
| Discover Sirui's personality    | A real personal artifact, an authored place, or a small responsive action               | A generic widget could appear on anyone's portfolio                        |
| Read comfortably at any size    | Use extra width for meaningful comparisons and notes; retain a comfortable text measure | Enlarging everything, filling every margin, or shrinking a desktop tableau |
| Choose how deeply to explore    | Optional detail near the relevant artifact                                              | A tour, animation or page turn becomes a prerequisite for reading          |

Playfulness earns its place when it rewards curiosity, makes a state legible, or reveals something personal. Restraint does not require making everything flat. It requires concentrating detail where the visitor has chosen to look.

## 1. A more convincing record: 057, with V07 continuity

**Reference:** [057 — Vinyl Listening Room](https://miaai-lab.github.io/Claude-Opus-5.5-100-HTML-Files/057-vinyl-listening-room.html).

The convincing details are related: a fixed light catches a turning label, the arm moves around a plausible pivot, and the selected sleeve agrees with the record. The walnut cabinet and green felt are specific to that demo, not the essential lesson.

Our current disc already has grooves, an arm, a spindle and lighting. It uses a lazy Three.js renderer with a CSS fallback. The opportunity is to refine those relationships, not add another renderer or claim that grooves are missing. It is also a **visual meme-record spinner**, not an audio player.

Prototype within the existing hero footprint:

1. Preserve the portrait as the default and the current 2D/3D state contract.
2. Give the disc a restrained fixed highlight and clearer contact shadow. Keep the cover rotating within it; avoid a highlight that looks painted onto the rotating surface.
3. Make start, stop and record change feel causal: a short acceleration or deceleration, a small arm lift before a change, and a settled resting pose. Rapid input must interrupt cleanly rather than queue a performance.
4. Put the current record title and source in one compact caption beneath it. Integrate the existing source-card interaction instead of creating a second album catalogue.
5. Keep previous, spin/stop and next controls readable, stationary and reachable. A literal arm may move; the hit target should not escape the pointer.

Do not import fake VU meters, a seek bar, track lengths or a “now playing” claim. Audio would be a separate feature. Do not add a full cabinet that pushes research links below the fold. If tactile motion makes the record more expressive, reduce competing nearby glow/portal effects in the same comparison.

**Success:** At the actual homepage size, a visitor can identify the record and its action immediately. It feels better before anyone zooms in. The introduction and primary links retain their hierarchy. Reduced motion shows the selected cover and clear state without requiring rotation.

## 2. One object through a real change: V07 and 050

**References:** [V07 — UI morphing source](https://youmind.com/video-prompts/ui-morphing-motion-template-11361), [050 — Loading, Beautifully](https://miaai-lab.github.io/Claude-Opus-5.5-100-HTML-Files/050-loader-atelier.html).

V07's demonstration chains many different interfaces through one continuous shape. The transferable principle is that the eye can keep its place. The whole showreel, its beat synchronization and its unrelated function changes would be excessive on a reading page.

Use the principle to refine existing interactions:

- For an expanding project, keep its image and title as visual anchors while the container changes size; introduce supporting text once there is room. Closing returns attention and keyboard focus to the same card. The site already has in-place expansion and FLIP motion, so first inspect and tune that path rather than build a duplicate.
- For a successful copy action, acknowledge it inside the same control. The state must follow actual success, including failure handling; a decorative checkmark must not claim an operation completed.
- For the record, keep the control in place as its label/icon changes. The mechanism can settle slightly later without delaying the action.
- Preserve the existing poster-to-WebGL alignment contract. Matching framing and a composed fallback matter more than an elaborate loader.

Start with one short response, roughly 180–260 ms, as a prototype parameter rather than a universal rule. Reserve a longer physical settle for the record. No invented percentage, artificial loading delay, global button wobble, or spring on reading text. New decoration stays off the semantic AI routes.

**Success:** A visitor can tell what changed and where to continue, even after clicking twice quickly. The still/reduced-motion version communicates the same state. “More animation” is not the success criterion.

## 3. Research decisions beside artifacts: 008, 087 and 003

**References:** [008 — The Last Keepers](https://miaai-lab.github.io/Claude-Opus-5.5-100-HTML-Files/008-lighthouse-longform.html), [087 — Sketchbook Portfolio](https://miaai-lab.github.io/Claude-Opus-5.5-100-HTML-Files/087-sketchbook-portfolio.html), [003 — Swiss Poster Machine](https://miaai-lab.github.io/Claude-Opus-5.5-100-HTML-Files/003-swiss-poster-machine.html).

008 separates the reading column, supporting notes and larger explanatory plates. 087 puts process alongside finished work. 003 demonstrates hierarchy through unequal areas and deliberate alignment. These suggest an editorial improvement, not three new visual themes.

For one case study, compose an existing artifact with a concise, source-backed note: the question being tested, what the artifact made visible, and what changed in response. A rough sketch or failed attempt is useful only when it explains an actual decision. Do not invent notebook history or make every project follow the same template.

On a wide screen, let the artifact break into the right-hand space while prose stays around a comfortable 60–68 characters. A short decision note can occupy an adjacent margin. Use the left gutter for the existing navigation only where it remains useful and clear of the footer. On a phone, put the note immediately after the relevant artifact; no horizontal notebook navigation. A 4K display can support a genuine before/after pair instead of simply enlarging cards or adding filler.

Keep the site's Inter typography and theme tokens. Borrow the relationships, not the serif magazine face, fake handwriting, tape everywhere, giant poster lettering or simulated page-turn navigation. During inspection, the demos' entrance fades and sequential page turns delayed access to content; our prose should be immediately legible.

**First surface:** One already documented turning point in DesignWeaver or Website Revamp. Enhance the existing lens/comparison/resource treatment rather than introduce another competing panel.

**Success:** A reader can explain both the result and one decision that produced it. The wide view gives evidence more useful space, while the narrow view preserves the same reading order and complete figures.

## 4. Make the miniature's places legible: 056

**Reference:** [056 — Architectural Blueprint](https://miaai-lab.github.io/Claude-Opus-5.5-100-HTML-Files/056-architectural-blueprint.html).

The useful relationship is between a spatial drawing and a compact, organized key. A blue drafting-paper theme would be a costume change with little benefit.

On the A little La Jolla project page, prototype a small list of real places linked to the miniature. Focusing or tapping a name would gently emphasize the corresponding building group and show one short personal or architectural note with its reference. Use the existing authored landmarks and provenance. Keep all names accessible as ordinary text and links when 3D is unavailable.

Start on the project page, where visitors have chosen to explore the scene. Keep the shared footer quiet; do not attach a dashboard or a cloud of permanent labels to every page. A selected place needs a clear reset, touch path and keyboard equivalent.

This is **not a substitute for geometry and composition**. A silhouette, setback and relationship to land/water should make a place plausible before its label explains it. The miniature remains an authored collage, not a surveyed map. Do not invent floor plans or imply geographic precision. This proposal also does not reopen the deferred Architectural/Illustrated home-rendering experiment.

**Success:** Someone unfamiliar with the composition can identify the selected place and understand why it belongs. Someone familiar with La Jolla still recognizes the underlying architecture without relying on the label.

## 5. An optional reading route through existing research: 036

**Reference:** [036 — Meridian Metro](https://miaai-lab.github.io/Claude-Opus-5.5-100-HTML-Files/036-transit-map.html).

Selecting a route makes an otherwise dense network easier to follow. Our Paper Constellation already has named research threads, relationship emphasis and mobile trails; replacing it with a literal subway map would mostly add a new visual metaphor.

A smaller experiment would add one or two authored starting points, with a short ordered reading list next to the existing graph. Candidate pairs already exist in `_data/publication_constellation.yml`: Physion to Physion++ is an extension; DesignWeaver to What Happened and Why? is a bridge. Keep that distinction explicit. Curated reading order must not become a claim of citation, causation or publication status.

Keep the authoritative publication list as the default. No simulated trains, shortest-path machinery, estimated research “journey time,” force simulation, or route into anonymous future work.

**Success:** A newcomer can choose a relevant first paper and understand the connection to the next. If a two-link text note does that as well as an interactive route, keep the text note.

## 6. A small print vocabulary for original personal art: 049

**Reference:** [049 — Riso Lab](https://miaai-lab.github.io/Claude-Opus-5.5-100-HTML-Files/049-riso-halftone-lab.html).

The print's limited inks and consistent surface treatment give it character. The same principle could connect a few original Fun illustrations or an authored coastal postcard: shared paper, deliberate accent colors, modest texture, and a clear caption.

This is lower priority than the record and reading improvements. Keep it as a static image treatment, not a live print engine or another global texture overlay. Preserve the recently restored full-color project thumbnails. Do not filter research figures, regenerate their evidence, age their labels, or recolor photographs to make the grid match. Consistency can come from framing and captions while the actual images stay different.

**Success:** Personal illustrations feel related while remaining distinguishable at thumbnail size. The treatment survives dark themes and does not make the research cards look desaturated again.

## Ideas to leave aside

The catalogue contains attractive full-screen fluid fields, cursor effects, kinetic typography and kinetic galleries. They would compete with existing scenes and research motion. The bento portfolio, seasonal palettes and specimen cabinet are useful secondary references, but our site already has cards, time-of-day themes and artifact metadata; importing their full interfaces would duplicate work.

From the first collection, staged zooms and exploded product explanations may be useful for a future research-method illustration. They need a specific mechanism to explain before they earn implementation. A perpetual home-page showreel does not have that justification.

No sitewide palette replacement, new font, animated background layer, extra ambient companion, scrapbook wrapper around the whole website, or forced scroll story is recommended by this study.

## Implementation and iteration

1. **Record:** Fixed lighting, continuous angular state, acceleration/braking, a short arm cue, and a stable caption/source/transport beneath the disc. Keyboard order follows previous, spin, next. Visibility, 3D mode and reduced motion suspend rotation.
2. **State continuity:** Project images and titles retain their position through expansion. Closing and rapid interruption return focus to the same card. Code-copy feedback follows the clipboard promise and explains refusal.
3. **DesignWeaver:** The complete existing figure sits beside three notes grounded in its documented mechanism. The first rendered iteration was too narrow; the spread now uses a wider desktop area and stacks below 850 pixels.
4. **La Jolla:** An exclusive native disclosure guide selects four actual GLB building groups: DIB, Geisel, Salk and Scripps Pier. A small projected bracket follows the selected geometry without moving the camera. Source notes remain usable with WebGL unavailable; the shared footer stays quiet.
5. **Paper Constellation:** Two optional ordered pairs reuse graph emphasis and retain direct publication links. The thematic bridge and benchmark extension have different labels and explanatory notes.
6. **Personal prints:** Existing credited front/back coastal concept illustrations share a static paper frame, ink marks and captions. The images themselves remain unfiltered.

For each prototype, ask an unfamiliar reader to identify the next action or explain the artifact. Record what they actually notice, including confusion; do not turn one taste review into a measured usability claim. Compare at 390, 768, 1280 and 1440 pixels, plus a wide 4K case for composition. Check keyboard, touch, reduced motion, theme contrast, interruption, offscreen suspension and the full static fallback where relevant. Keep only a result that improves the visitor's task as well as the screenshot.

The implementation uses original site code and existing assets. Reference demos are influences, not imported components. Automated interaction and visual evidence establishes rendering and behavior; it does not establish a measured visitor benefit. `docs/` remains excluded from public Jekyll output.

### September 29 release checks

- The affected-route checkpoint covers home, projects, DesignWeaver, La Jolla, publications and Build Rhythm at 1440, 1280, 768 and 390 pixels, in light and dark: 24 cases passed.
- The full public-route run completed with 203 passes and 92 scoped skips. Its one failure sampled axis paint while keyboard focus replaced the story's SVG nodes. Reacquiring settled paint passed the follow-up at all four sizes.
- The separate WebGL/scene run completed with 136 passes and 39 scoped skips. Its one failure placed the phone companion between two controls with no safe perch; the correctly refused action was tested again with the card centered, passing all four sizes. Original release outputs are retained alongside these follow-ups.
- Chromium desktop and WebKit/iPhone legacy interactions, served under `/al-folio`, passed 50 applicable cases; 42 baseline/fixture cases were intentionally skipped.
- The commits-only format preserves exact totals through Readable and Literal at all four sizes. Four new integration cases passed; 166 site unit tests and 179 collector tests passed.
- The September 29 refresh contains 20,793 lifetime personal commits, including 19,473 in 2026 and 16,898 authored commits overall, through the last completed Pacific day, September 28. Website personal daily totals equal the profile's weekly totals. Eight rendered size/theme checks passed with the actual schema-6 snapshot. The previously captured August 28 profile was stale; the collector's 10,000-author-ID ceiling also needed removal. GitHub's contribution calendar includes other contribution types and some retained credits from replaced branch history, so it is not labeled as an identical commit counter.
- The chart uses a square-root scale with more useful intermediate ticks and a taller commit plot. The refreshed project image records the actual September 29 build and removes the obsolete line-history panel. The website preserves the separate intern source's recorded coverage rather than inventing later work.
- The 4K coast's loading and ready captures preserve composition and unclipped roofs. Selected research spreads, phone controls, reading pairs, place guide and static fallbacks were also inspected directly.
- Hosted software-WebGL runners exposed a wall-clock delay in the record-resume assertion. The follow-up checks unchanged angular state at the action boundary, then advances exactly 100 ms with the browser clock. Transport position is measured after fonts load, in document coordinates so an accessible click's scroll does not masquerade as layout movement. All four local follow-up cases passed.
- The final phone capture exposed a companion perch behind the new record caption. Its avoidance boundary now covers the full caption/transport console, including the title span, and the reflow checks include that homepage surface.

The final data refresh and deployed checks are recorded with the publication checkpoint. No visitor study or usability improvement is claimed from these engineering checks.
