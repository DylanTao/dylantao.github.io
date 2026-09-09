# Website Design Heuristics

Use this file as the shared design memory for the homepage and the portfolio. The goal is a personal academic site that feels thoughtful, alive, and readable without becoming a corporate product site or a visual demo reel.

The design spine is **Less, but more Sirui**: lively, fun, unmistakably personal, and intentionally designed, with fewer things competing for a visitor's limited attention.

Agent-facing Codex overlays live in `.codex/skills/website-design-critique/SKILL.md`, `.codex/skills/portfolio-writing-voice/SKILL.md`, and `.codex/skills/tacit-knowledge-to-skill/SKILL.md`. This file stays the canonical human-readable source; skills point here by heading instead of copying it. Desk-scene specifics live in `docs/homepage-desk-scene-brief.md`, unproven ideas in [`docs/design-experiment-backlog.md`](docs/design-experiment-backlog.md), and the Material-Lite token grammar in `docs/material-lite-revamp.md`.

## Decision Order

When two heuristics compete, protect the earlier concern first:

1. Research meaning, factual integrity, source credit, accessibility, and a working route.
2. First-glance comprehension: who Sirui is, what the work asks, why it matters, and where to go next.
3. Proof proximity, reading order, responsive layout, and legibility.
4. Discoverable interaction state, bounded motion, and clear recovery paths.
5. Materiality, atmosphere, personality, and delight.

A more expressive result is not better if it weakens an earlier concern. Treat `must` and `never` rules as contracts; treat named visual references as taste guidance that still needs rendered evidence.

## Less, But More Sirui

- Spend attention deliberately. Prefer fewer containers, hierarchy levels, competing actions, and repeated explanations; give what remains enough space and specificity to matter.
- Use a card only when it communicates interaction, containment, or a meaningful boundary. A summary that repeats the next section becomes whitespace, a hairline, or a plain list.
- Lively does not mean constantly moving. Let one idea, gesture, or visual surprise carry a section, then let the rest of the page breathe.
- Keep the site fun and Sirui. A warm aside, honest receipt, unusual interaction, or small joke is welcome when it reveals the person, the research process, or the evidence behind the work.
- Content earns its place. Explain the idea once in clear language, keep proof close to it, and move custody or reproduction detail into an optional disclosure when it would interrupt the human story.
- A change has to add meaning, not another thing to look at. When a review calls an element confusing, remove it rather than tune it (Sirui, 2026-09-05).

### An Evolving Spine

The spine is stable enough to guide decisions and open enough to learn. Experiments are welcome when they strengthen meaning, personality, or discovery and survive rendered critique across the required viewports, themes, input modes, and accessibility states. Record uncertain ideas in [`docs/design-experiment-backlog.md`](docs/design-experiment-backlog.md) with a hypothesis and a revisit trigger instead of freezing the design language or shipping an effect without evidence.

### Signature Copy Locklist

These phrases carry Sirui's voice or research framing. Preserve them exactly unless Sirui explicitly approves a rewrite; do not condense them merely to reduce word count:

- “Making AI tools that sharpen design judgment.”
- “Scaffolding taste in an age of generative abundance.”
- “Design, Evaluate, Situate.”
- “Vibes -> Variables -> Value”
- “Make better design decisions visible.”

### Three Narrative Type Roles

- **Display:** the one major statement or page title that leads a viewport. Inter 700.
- **Heading:** section titles and local structure. Inter 600.
- **Reading:** paragraphs and explanatory prose. Inter 400.
- **Compact exception:** controls, metadata, CV tables, code, chart labels, and other genuinely dense records. Inter 500, or the monospace face where the content is code-like.
- Load only the Inter weights the site uses: 400, 500, 600, and 700. Never synthesize 750–900. New styles use the `--type-*` role variables instead of inventing a size; legacy type variables stay as aliases.

### Human And AI Are Different Reading Surfaces

- **Human routes** are visual, warm, selective, and first-person. They make a question easy to feel, show the most useful proof, and reward curiosity without asking the reader to decode a development log.
- **AI routes** are compact, semantic, source-linked, motion-free, and information-dense. They expose stable anchors, plain fields, evidence boundaries, and reproduction paths without inheriting decorative human layouts.
- Reciprocal Human/AI links preserve the closest meaningful context. Shared canonical facts may project into both surfaces; the presentation is never forced into one compromise template.

### Story With The Right Medium

Tell each design story through the best combination of text, image, interaction, and truthful data. Do not force every case study into the same card grid. Some claims need a sentence, some a before/after image, some a chart and exact table, and some an interaction the visitor can try. Mixed media is coherent when every element advances the same question.

## Agent Quick Index

| Task                                 | Start with these headings                                                                                                                                     | Agent overlay                                                   |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| Sitewide or homepage critique        | Decision Order; First-Glance Story; Visual Hierarchy; Accessibility And Quality Checks; Screenshot Critique Ritual; Proportional Visual QA; Responsive Layout | `$website-design-critique`                                      |
| Blog, project, or case-study writing | Decision Order; Content; Page Archetypes; Blog Voice; Conservative Inspiration Boundaries; Process Artifacts                                                  | `$portfolio-writing-voice`                                      |
| Homepage 2D/3D desk scene            | Decision Order; Motion; Objects And Materiality; Responsive Layout                                                                                            | `$homepage-desk-scene` plus `docs/homepage-desk-scene-brief.md` |
| Recording a durable lesson           | Decision Order; the affected topic heading; Maintenance And CI                                                                                                | `$tacit-knowledge-to-skill`                                     |
| Evaluating a design experiment       | Less, But More Sirui; Motion; Acceptance Evidence; `docs/design-experiment-backlog.md`                                                                        | `$website-design-critique`                                      |

Begin with the rendered route and the visitor problem, not with a preferred effect. Keep one-off implementation notes in the owning file; add to this document only when a lesson generalizes beyond the current patch.

## First-Glance Story

- A rushed visitor should learn, within 15-30 seconds: who Sirui is, what problem space he studies, what he has built, why it matters, and where to click next.
- Lead with the research thesis, not with a long biography.
- Every section answers one visitor question:
  - Start: Who is this?
  - Taste: What is the intellectual thread?
  - Focus: What are Sirui's research loops and areas?
  - Publications: What concrete evidence should I open first?
  - Updates: What is active right now?
  - Students: How can someone work with Sirui?
  - Connect: How can someone follow up?

## Visual Hierarchy

- One dominant headline per viewport.
- Section labels help scanning; keep them quiet and consistent. Category headings on index pages are real headings set in the heading role, so a reader sees the groups before the labels inside them.
- Prefer fewer, stronger calls to action over many equal buttons.
- Put proof close to claims: projects, publications, venue labels, and updates sit near the research story they support.
- Every ounce of ink should matter: black text, colored text, borders, cards, shadows, and lines alike. Whitespace clarifies grouping; it does not create empty drama.
- Repeat information only when it improves orientation. Pinned content is a route into the work, not a reason to remove that work from the chronological archive.
- When comparable time series begin on different dates, keep every verified earlier segment and let later series join when their evidence begins; never truncate shared history to force a common start.
- Line breaks are part of hierarchy. If a phrase leaves one orphan word on a line, adjust width, type size, or copy before accepting the wrap.
- Research figures stay inspectable: `object-fit: contain` in clean white wells, no decorative crops, intrinsic width and height declared so the layout never jumps, and an aspect hint in front matter for an unusually wide or tall teaser.

## Color

- Brand orange (`#f07a38`) is identity: the fruit and rare warm details that carry meaning. Links, controls, focus, and selected states use the active time-of-day accent. Never spread orange through page washes, generic cards, or every interactive state.
- Mint and sky are semantic highlights for contrast or one specific idea. Neutral surfaces carry most of the layout.
- If color does not communicate hierarchy, state, or meaning, remove it. Colored ink means action, active state, status, or a deliberate grouping; a tinted card is not a cure for a section that feels empty.
- Avoid a page that reads as all orange, all pastel, all purple, or all gradient.
- The time-of-day themes change atmosphere, not the research story: morning dawn rose, noon Pacific blue, afternoon sea glass, evening moonlit lavender. Each palette needs hue variety and contrast, registers through the whole surface hierarchy (page field, cards, elevated surfaces, outlines, shadows, footer), and keeps backgrounds clean rather than muddy. Verify representative routes in every mode before calling a palette sitewide.
- Keep accessible accent ink separate from lighter pastel fills. Links and labels need a darker contrast-safe mode color; selected controls may use the related pastel only with its own tested on-fill text color.
- Themes default from the visitor's local time. A manual choice is remembered for the session, then the time rule returns; a page left open across a time boundary changes automatically only when the visitor has not picked a theme in that session.
- Evening mode uses moonlit lavender for actions and restrained containers over neutral blue-black surfaces. The fruit stays orange because it is identity, not a dark-mode action color.

## Motion

- Motion explains the page; it does not decorate it. Good motion: section reveals, active rail state, hover feedback that says "this is clickable", and, on pages that opt into the cinematic layer, scroll-driven scenes that walk a reader through one figure.
- Bounded cinematic motion (Sirui, 2026-09-05): a sticky figure with a moving lens while three steps scroll past; the homepage Research Focus sketch pinned beside its three lens notes so the note in view picks the lens; staggered entrances for cards and reading blocks; a pointer spotlight and a few degrees of tilt over card grids; count-ups on one or two proof numbers; a clicked project image that travels into the case page through a cross-document view transition; shallow parallax only between two layers that belong together (a principle note behind its thesis, a figure beside its copy), whole and uncropped, under a third of the block's height. Each plays once per element or slower than reading, never takes over scrolling, and every one is a still page under reduced motion, without a fine pointer, or under automation.
- Pinned stages need their own well (Sirui, 2026-09-05, after the Research Focus sketch slid into the Exploring row and left its column half empty): a sticky grid item can travel to the end of the whole grid, so wrap the pinned element in a block that spans only the rows it belongs to; size it to the viewport under the navbar, never taller than a 3:4 portrait of its column and never shorter than the stacked layout's stage; and when a scene grows past one viewport, any pre-rendered field behind it must fade out before its box edge, or that edge shows as a sharp color step against the page.
- Rejected in review (Sirui, 2026-09-05): side threads that track scroll progress, gradient blobs behind page titles, and titles that drift against the page. They moved without meaning anything.
- Bad motion: constant fast movement, unrelated loops, cursor trails, scroll or wheel hijacking, clipping as the default way to make drama, and anything that competes with reading. Anchor smoothing and reveal timing keep native scroll control.
- Always respect `prefers-reduced-motion`: a still composition with all content, never a hidden idea.
- Autoplay is acceptable only when it is slow, pauses offscreen or in a hidden tab, and stays visually secondary to the words. Ambient motion echoes the main interaction, quieter than the text and strongest near the relevant section.
- If an animation competes with the explanation, change the layout before decorating the animation. Claim and controls come before the moving field.

### Research Motion Rules

- The homepage motion section is a research diagram first: design means option exploration, evaluate means evidence and traces, situated means context-aware assistance. Each mode carries enough copy to make the metaphor readable before a visitor interprets the motion.
- Keep canvas geometry abstract enough to avoid fake data and structured enough that each mode has a reason to exist, with a stable number of lines and dots and lower density on mobile.
- A pointer may bend or separate the field inside the bounded canvas, easing in on entry and decaying on exit. Nothing snaps because a cursor crossed a boundary, and nearby page space is never an invisible accelerator.
- Local theme controls near the sketch mirror the global theme state exactly. No second, hidden source of truth.

### Research-Grounded Motion Intention

Before keeping an effect, record the visitor problem, trigger, semantic meaning, stop or recovery condition, reduced-motion equivalent, and acceptance evidence.

- Motion is justified when it preserves object identity, reveals a real change, clarifies an affordance, or encodes a truthful interaction or measured state. Kinetic intensity is information: particle count, velocity, direction, and trail strength change only with a named interaction or truthful state.
- Use one coordinated transition by default; stage only when separating meaningful changes makes their relationship easier to understand. Interactive motion settles into a valid state after interruption and keeps a readable still state, equivalent text, and keyboard path.
- Progressive or changing values expose freshness and provenance; never animate a static snapshot as if it were live activity.
- A data story teaches one visual relationship at a time, moves from a plain-language question through annotated examples, then hands control to the complete explorer and exact table. Scroll may choose an explanatory state but never hijacks the wheel, rewrites reported values, or becomes the only route to the evidence.
- Small editorial constellations use deterministic semantic axes and a few source-reviewed edges instead of force simulation; keep node size, citation influence, status, and future-work timing as separate channels; preserve the authoritative list by default; and become labeled thread trails on narrow screens rather than shrinking into illegibility.
- Research grounding: object constancy and simple staging from [Jeffrey Heer and George Robertson](https://idl.cs.washington.edu/files/2007-AnimatedTransitions-InfoVis.pdf); narrative checkpoints from [Edward Segel and Jeffrey Heer](https://idl.cs.washington.edu/files/2010-Narrative-InfoVis.pdf); interruptible intermediate/final animation-state management from [CMU DIG's Counterpoint](https://dig.cmu.edu/publications/2024-counterpoint.html); accessible alternatives and animation control from [Chartability](https://www.frank.computer/chartability/). These are principle-level influences; no source assets, layouts, or code are copied.

### Accepted Intent Record

Sitewide contracts that rendered review has accepted. Desk-scene records live in `docs/homepage-desk-scene-brief.md`.

- Skip link and landmark: every page starts with one "Skip to content" link that is invisible until it receives keyboard focus and moves focus to the `#main` landmark only when used; the landmark itself never carries a resting `tabindex`, so ordinary clicks keep focusing their targets and existing focus-return logic (the project preview cards) stays intact.
- Cross-document crossfade and morph: same-origin navigation between two opted-in documents crossfades the page root at the standard motion duration while the navbar and progress bar hold still. One element morph exists: the project image a visitor clicks carries the `project-hero` transition name to the case page and back, set at click time so the projects index's FLIP preview keeps its own identity. The homepage, AI profile, and hidden page are not opted in, and reduced motion makes every navigation an instant swap.
- Adjacent-project wayfinding: every project page ends with previous, all-projects, and next links that follow the projects index order for that category (research by importance, site experiments by debut date, other playful builds by importance), reusing the blog navigation grammar rather than adding a second component.
- Blog index measure: rows share one text measure with the date in its own column, thumbnails sit beside the text in one fixed well, and a row without a thumbnail keeps the same measure, so the index reads as one column of dated notes.
- Names and hidden tab stops: collapsed publication panels (abstract, award, Bib, video) are `inert` while closed, so the copy button inside a folded Bib block is never a keyboard stop or a screen-reader target; sentence links in the footer are underlined rather than told apart by color alone; Scholar Lens year bars take their accessible name from their visible count and year plus visually hidden connecting words instead of an `aria-label` that repeats them in another order; project figures declare their intrinsic width and height so the browser reserves their space and the summary below a hero never jumps when the image lands.
- Research-motion kinetic response: the particles should make direct local engagement or a mode change perceptible without turning nearby page space into an invisible accelerator. Only a pointer inside the bounded canvas may raise a clamped speed/trail signal; the inner edge ramps in gently, exit decays to rest, explicit mode selection stays brief, and the field pauses offscreen or in a hidden tab, keeps a stable particle count, and becomes a still composition under reduced motion.
- Build-rhythm evidence: commits describe cadence, while additions and deletions describe change magnitude and direction; neither substitutes for the other. Code history appears only after an exact schema-5 source-calendar contract proves complete coverage with one row per calendar label from the pinned lifetime start through the latest reported label. Each source must declare its date basis and completion timezone: `Personal` uses GitHub profile author-date labels completed in `America/Los_Angeles`, while contributed feeds use UTC calendar labels. Matching `YYYY-MM-DD` labels may align the display but do not describe one shared timezone or 24-hour interval. Until the contract passes, show one compact `Code history is being rebuilt.` state and no inherited totals; an invalid refresh preserves only a previously valid current-schema snapshot. Schema 4 may be validated only as a one-way migration predecessor and must never remain renderable. Publish two commit counts, not one: each source's `commits` is its reported total, while `authored_commits` is the non-merge, non-deploy subset that alone carries added and removed lines. For `Personal`, the approved `github_contribution_parity` basis makes its reported total reproduce the GitHub contribution graph (default branch plus `gh-pages`, merges included); do not extend that claim to other sources or a combined total. A merge diff restates its branch and a deploy restates the whole generated site. Line counts are first-parent raw-text changes for authored commits, including documentation and data text; intrinsic binaries count as zero and repository attributes are neutralized. Compare the commit counts in one figure: render the reported total across visible sources as a quiet outer boundary with a soft band down to the summed authored line, so the visible gap means merges and deploys. Do not hide that distinction behind an All/Authored mode switch. Name each encoding in the key by what it means rather than by the mark: the key is an HTML strip above the SVG that reads `All commits`, `Merges + deploys`, and `Authored only`, the same words as the GitHub-profile SVG twin, and its gap glyph still draws the band between its own muted boundary and crisp authored line so the key shows the same relationship as the chart; terse keys such as `total`/`gap`/`authored` leave a reader guessing. Set the key in HTML so the browser wraps it and its glyphs read the marks' own CSS variables; never estimate mono advance widths inside the SVG. Panel headings stay inside the SVG, read `COMMITS PER DAY · LOG1P` (`COMMITS PER DATE LABEL` across mixed calendars) with the compact `/` form on narrow screens, and keep transform names without the Readable/Literal adjectives the control already states. Lifetime is the published evidence window, not the readable default view. Measured on the 2026-08 snapshot, only about 15% of 3,264 lifetime date labels carry a commit, and the stretch before sustained activity begins spends roughly a third of the plot width on about a tenth of the active days; at that scale one day occupies under a third of a pixel and no daily detail survives. Default the explorer to the three-year window, where one day is about one pixel and roughly a third of labels carry data, and keep lifetime one explicit click away with the header totals still lifetime. Retain explicit shorter windows for recent daily detail and thin year labels before they collide on compact screens. Name every approved public source (`Personal`, later `Intern work`), key points by source id, stack them as non-overlapping lower-to-upper bands with a legend that doubles as the filter, and omit a source from labels outside its own coverage rather than padding it with zeroes. Give every later source a hue that survives the whole figure (olive, chosen after the original orange sat within OKLab ΔE 5 of a neighboring warm area in every theme mode), a denser fill than the first source, and a surface-colored seam along its lower edge, so the band stays legible beneath the summed lines without adding a value line; when more than one source is visible, the readout adds one cell per source that says `no record` outside that source's coverage. Keep the code views synchronized to the same selected date label, provide readable and literal scales plus a reported-value table, and label them as build rhythm rather than productivity or causal evidence. Defer the lifetime table's thousands of DOM cells until its disclosure opens; exact access does not require making every hidden row part of initial rendering. On compact screens, shorten chart headings without dropping units or transform names, give each readout value its own cell rather than joining them into one sentence with separators, so wrapping happens between values instead of stranding punctuation and the numbers stay column-aligned for scanning, and name the horizontal reading path when the reported-value table preserves more columns than the viewport can show. Readable/Literal may change number formatting, not an evidence boundary. Daily code points describe build rhythm, not exact effort, quality, or productivity.
- Project-preview feedback: FLIP remains the projects index's only layout motion because it preserves card identity while one preview expands. One cancelable clock measures current visible bounds, translates cards only, clips the newly opening surface without scaling its contents, clears finished animation objects, and performs at most one post-settle visibility correction. Rapid retargeting cancels the old clock; keyboard focus advances only if the visitor has not moved it, while dismissal restores a focused hidden control to the trigger before hiding it. Keep primary and close actions at least 44 pixels, retain one quiet collapsed-card hover lift, and apply the same final state immediately under reduced motion.
- Explicit-anchor arrival: long CV, project, and blog pages briefly mark and focus the destination heading only after an explicit in-page choice, so a large viewport jump has a perceptible ending. A new choice interrupts the old cue, ordinary scrolling never steals focus, and reduced motion uses the same short-lived underline as a static state.
- Recovery-route restraint: error and unlisted maintainer routes need identity plus a few truthful next steps, not an automatic redirect or decorative animation. Keep the recovery choices native, keyboard-visible, and specific to the visitor's likely intent.
- Chronological-route reveal: news and archive entries use the same short reveal contract as other evidence lists because their order is part of the reading structure; the effect runs once on entry, does not alter order or density, and becomes immediately visible under reduced motion.
- Secret route: because every offered fruit is valid, the checkpoint confirms the chosen fruit instead of pretending there was one correct guess; the modal contains focus, Escape and backdrop closing cancel pending navigation, and focus returns to the dog. A visitor who lands on the locked URL gets a real heading and one quiet route card with a single return action. A valid pass lasts for the browser tab session so refresh and Back do not relock the route; invalid or legacy passes are removed. The map reuses browser coordinates only when geolocation permission is already granted, otherwise it stays approximate and offers an explicit `use precise location` action.
- Mobile publication evidence order: on narrow phones, the filter and accepted-paper list precede the supporting Scholar lens so visitors reach the primary evidence before the secondary dashboard; desktop keeps the side-by-side analytical relationship.
- Long-CV navigation: the mobile CV keeps a compact native `Sections` control near the viewport edge because the desktop rail disappears across a very long document; it starts collapsed, exposes real heading anchors, closes after selection, and does not replace normal scrolling.
- Archive date economy: year archives let the page heading carry the year and show only month and day in each row. Tag and category archives retain the full date because they mix years.
- Paginated-blog priority: pinned `Start here` notes appear only on page one. Later pages begin with the older writing visitors explicitly paged toward instead of repeating the homepage orientation card.

## Objects And Materiality

- Borrow Jackie Hu's portfolio as an interaction principle, not a visual costume: a personal site can feel like a small desk of artifacts when each object teaches something real about the person. Credit influences plainly; borrow principles, never assets, code, layout, or exact styling.
- Objects are proof. Playful objects point to actual tools, papers, teaching artifacts, or active research threads. If an object cannot answer "what proof or process does this point to?", remove it.
- Hover previews the current state and answers "what is this and why open it?"; explicit controls change state, sit where the state lives, and stay reachable by touch and keyboard. Playful metadata (titles, artists, durations, catalog notes) waits behind a deliberate reveal.
- A substantial widget gets one quiet origin route near its heading or mode control: a tiny glint that lights once on hover or focus, with an accessible name that identifies the destination. Never a competing label, continuous pulse, slider-like line, or popover.
- Small rotations, lifts, image zooms, and caption emphasis are enough. If a visitor remembers the motion more than the work, simplify it.
- Material effects are quiet evidence framing: white stock first, warm hairline edges, paper-thickness shadows, and restrained stains placed on or directly behind a specific artifact. Avoid fake crosshatch grain, visible fibers, decorative connector lines, colored fills, clip-art stains, and large rounded app-card shapes when the metaphor is paper. Use CSS texture first; add image assets only when the object is itself evidence.
- Keep one material language per stage and one slip per claim. A coffee ring stays thin, broken, partly hidden, and quieter than the artifact titles in both themes. Dark-mode materiality is native to the theme: muted theme-aware surfaces, not white paper forced into evening.
- Never fake copyrighted music. The album is a visual artifact with liner-note metadata and a source link; no unrelated free music, generated tones, progress bars, elapsed time, or volume UI. Future audio must be owned or licensed, explicitly activated, visibly controlled, and never triggered by keyboard focus.
- Annotations and speech bubbles point to a real idea and never cover a face, evidence, or a primary figure. Color in a bubble separates roles; neutral stays the default. Portrait hovers preload and crossfade.
- Extend the paper language only where it clarifies process: case-study process notes, teaching artifacts, and the website-revamp story. Publications, CV, and archives stay utilitarian, and a playful object in a blog post needs a reason inside the story. Reuse the homepage's paper system before inventing a new effect.
- The thesis and research proof above the fold stay more important than the desk vibe.

## Navigation

- Keep the global nav simple. It tells the site story in order: about, publications, projects, blog, CV.
- Use in-page navigation only when it helps a reader understand the structure: a compact story rail on desktop, inline or collapsed on narrow pages, then a small on-demand control after the top of the page rather than a sticky card.
- Floating reading aids need exit conditions: hide near the footer, reappear on scroll-up or section change, and keep the trigger out of the text column. Active state matches the section being read.
- Anchor links land with enough top spacing below the fixed nav.

## Content

- Keep Sirui's voice warm and specific. Write plainly: short sentences, concrete nouns, verbs that name what happened, and no mannered phrasing, throat-clearing, or rhetorical flourish (Sirui, 2026-09-05).
- Avoid generic AI/design language unless it is tied to a concrete research question or project. Words such as "system," "artifact," and "scaffold" need a named object beside them.
- Project and blog pages tell the concrete story first. Design philosophy lives in process notes or heuristics, not in place of what happened.
- A fun-project opening answers four questions without a case-study template: What is this? What did I make? What changed while I designed it? What should the result let someone notice, do, or feel?
- Story labels carry information. Replace empty stage names such as "Spark / Turn / Now" with the actual version, problem, decision, or current behavior they introduce.
- Lead with what a project does and why it matters. State privacy, provenance, or evidence limits once near the relevant claim; do not repeat defensive “X, not Y” constructions through the story.
- Polish preserves research meaning. A tighter phrase is worse if it narrows the claim, erases scope, or turns a thesis into a UI slogan.
- The AI in Design 2026 report frames AI as changing tools, craft, and teams. Borrow the questions, not the corporate tone. A compact influence note can credit Katie Dill and the report, including the line: "AI is sparking a creative renaissance in design."
- Keep the main page centered on Sirui's work, not on external inspiration.

### Dual-Audience Publishing Intention

- Machine-first content is route-addressable, server-rendered, semantic, source-linked, and human-auditable. JavaScript may improve copying or state feedback; it never gates the research record.
- A dark terminal aesthetic is not AI readability. Keep the site's theme and normal reading typography for prose; reserve monospace for labels, paths, identifiers, and format cues.
- A why-cite guide keeps contribution, reported evidence, and scope together so a reader can judge fit without mistaking author interpretation for a paper result. Bibliographic facts live in the canonical bibliography and editorial interpretation in a separately validated overlay; human cards, machine pages, structured data, and raw citation files all project from that shared contract.
- `/llms.txt`, raw Markdown, and structured data are retrieval aids, not ranking promises. Crawlable HTML, stable paper URLs, searchable PDFs, canonical identifiers, and scholarly indexes remain the discovery foundation.
- The Human/AI switch is a route change: ordinary links with visible current state, entry at the closest stable section or paper anchor, return to the closest canonical counterpart (recomputed after direct hash edits and Back/Forward navigation), a usable mobile and no-JavaScript fallback, and no silent redirect from a stored preference. Without the coordinating script, immediate native anchor placement beats pagewide smooth travel.
- Keep the final machine-view section current through small post-load corrections with a bounded document-end tolerance; never synthesize a URL hash because the reader scrolled. Name links that intentionally exit to a human page, and use `rel=alternate` only for a genuine representation of the current document.
- Help web agents by reducing redundant observations and exposing descriptive semantic links, stable section IDs, canonical/raw alternatives, and source provenance. This adapts lessons from [Mind2Web 2 (NeurIPS 2025)](https://dblp.org/rec/conf/nips/GouHNGLQKYGSSWC25), [AgentOccam (ICLR 2025)](https://dblp.org/rec/conf/iclr/00030CFCKR25), [WebLINX (ICML 2024)](https://dblp.org/rec/conf/icml/LuKR24), and [VisualWebArena (ACL 2024)](https://aclanthology.org/2024.acl-long.50/) without claiming that an alternate view or `llms.txt` guarantees discovery.
- Design influence: the Human/Machine framing adapts [Paxel](https://paxel.ycombinator.com/) as demonstrated by YC Head of Design Eve Bouffard with Aaron Epstein in [Y Combinator's 2026 design walkthrough](https://youtu.be/VbqaL_eHhKY?t=433); the site adds static URLs, no-JavaScript readability, and explicit scholarly provenance.

## Accessibility And Quality Checks

- Check light mode, dark mode, mobile, tablet, and desktop.
- Check keyboard navigation, visible focus, and that collapsed panels are not hidden tab stops.
- Check that text does not overlap cards, nav, footer, or the back-to-top button, and that mobile has no horizontal overflow.
- Check contrast, especially orange text on light backgrounds and nav text in dark mode.
- Check that reduced-motion users can still see all content.

## Screenshot Critique Ritual

For each meaningful direction, not every CSS adjustment:

1. Capture one representative route, state, and viewport.
2. Read it as a rushed research peer, a prospective student, an interested non-specialist, and a returning collaborator.
3. Mark anything visually loud but not meaningful, and anything important that is hard to notice.
4. Revise the same frame until the direction is clearer, not merely prettier.
5. Expand to boundary viewports and accessibility states only after the direction earns a checkpoint.

For sitewide passes, keep a temporary critique scratchpad and delete it before handoff, audit each public route at desktop, laptop, tablet, and narrow mobile widths, and move durable lessons back into this file so future sessions start smarter.

## Proportional Visual QA

Visual evidence matches the decision being made. Do not spend a release-sized test budget on a local taste question.

### Fast iteration: one design decision

- Reuse one already-running, owned localhost server. Do not rebuild Jekyll, restart Docker, or reconnect browser control for every CSS or copy adjustment.
- Inspect one affected route, one meaningful state, one representative viewport, and the relevant theme. Capture one screenshot per hypothesis, compare it with the last useful frame, then decide.
- Prefer the deterministic Playwright iteration lane and inspect its PNG under `.jekyll-cache/visual-qa/` directly; that unwatched directory keeps screenshots from waking Jekyll mid-critique. Browser control is for interactions the harness cannot reproduce or when Sirui needs a live tab.
- If browser capture stalls once, stop retrying and use the repository lane. Repeated browser setup and screenshot retries are not design work.
- The lane has a one-minute global budget. If it is unexpectedly slow, set `VISUAL_TIMINGS=1` once and fix the measured phase; if page work finished but Chromium teardown dominates, stop the loop and treat a persistent-browser worker as a separate harness task. Never speed up a capture by hiding assets the judgment depends on.
- With the owned preview on `4101`, a focused Research Focus pass is:

  ```powershell
  $env:VISUAL_ROUTE_IDS = "home"
  $env:VISUAL_ROUTE_HASH = "focus"
  $env:VISUAL_CAPTURE_SELECTOR = "#focus"
  npm.cmd run test:visual:iterate
  ```

### Checkpoint: prove the chosen direction

- After the direction looks worth keeping, run the affected route or small route set at the four standard viewports and both relevant themes. Add keyboard, reduced-motion, contrast, or interaction checks only when the change touches those contracts.
- The guarded checkpoint command requires an explicit route list and reuses the running preview:

  ```powershell
  $env:VISUAL_ROUTE_IDS = "home,project-website-revamp"
  npm.cmd run test:visual:checkpoint
  ```

### Release: prove the integrated site

- Run the full public, scene, legacy, build, crawl, and release gates only after the design diff is accepted and ready to publish. The four-viewport sitewide matrix is release evidence, not the inner design loop.
- A failed release gate routes back to the smallest responsible test, not to repeated full-suite runs after every fix.

## Acceptance Evidence

- Compare the same route, viewport, theme, and interaction state before and after the change, and name the visitor problem the result improves: comprehension, proof proximity, reading, state clarity, or recovery.
- At checkpoint and release, inspect 1440x1000, 1280x800, 768x1024, and 390x1000 rather than extrapolating from one desktop screenshot. During iteration, use the smallest frame that answers the current question.
- Check light and dark themes when color or surfaces changed; check keyboard focus and reduced motion when interaction changed.
- Reject changes that introduce overlap, horizontal overflow, primary-media occlusion, broken links, console errors, or a weaker first-glance story.
- A design pass is complete when the affected route is clearer and its important states are verified, not when every surface has been restyled.

## Page Archetypes

- Homepage: editorial thesis and routing hub. It explains the intellectual thread and sends people to work, papers, writing, student info, or contact.
- Projects: evidence surface. Each card shows artifact, problem, venue or status, and where to click without a paragraph to parse. Projects with their own site link out to it instead of getting a second local page.
- Project detail: case study. Lead with the research question, contribution, artifact preview, venue, and links before author blocks or implementation detail.
- Publications: bibliography with orientation. The citation list stays authoritative and helps readers find selected or current work quickly. A rejection wall can celebrate hidden research failure when it stays rejection-only, keeps receipts close to each badge, and never becomes a leaderboard.
- Blog: research notebook with personality. Casual voice is welcome; vague dumping-ground copy is not.
- CV: utility page. Optimize for scanning, PDF access, dates, roles, and correctness over decoration.
- News: timeline. Short, dated signals that are easy to skim and do not fight the homepage updates section.

## Occam's Razor For UI

- Prefer the smallest change that makes the visitor's next decision easier.
- Remove a visual element if it does not clarify hierarchy, state, rhythm, or trust; remove the component before designing around its awkwardness.
- Do not add a new component when copy, spacing, or ordering solves the problem.
- Let repeated components carry consistency; reserve custom pages for genuinely different reading tasks.

## Responsive Layout

- Design the first viewport at several shapes, not one width, and test 1440x1000, 1280x800, 768x1024, and 390x1000 before calling a checkpoint or release done.
- On mobile, the first useful explanation appears before long media, author grids, or metadata blocks, and primary media is never covered: move an overlay below the map, globe, figure, face, or artifact, or collapse it.
- Fixed-format content needs explicit dimensions or aspect ratios so cards do not jump or crop meaningful diagrams.
- If a footer, floating button, or nav competes with reading on mobile, reduce its footprint or move it out of the way.
- Whitespace manages cognitive load: group related things, separate new ideas, and let the next step peek into view without dead air.
- Use page-type widths: narrow for long reading, medium for notebooks and lists, wide only when grids or diagrams need the room.
- Never animate a transform that grows past a full-width box on a narrow screen; it adds a horizontal scrollbar. Clip the axis or keep the motion inside.

## Footer And Global Chrome

- Keep page chrome quiet. The work should be louder than the frame.
- Brand-mark rules (flat silhouette before detail, low-contrast texture cues, category anchors at icon size) live in `docs/material-lite-revamp.md`.
- Search, theme, and back-to-top controls stay discoverable without covering content. The footer is one short sentence: copyright, the al-folio credit, and the update date, with its links underlined rather than told apart by color alone. Sirui removed the footer link row (RSS, GitHub, email, AI profile) on 2026-09-06 as clutter; those destinations already live in the navbar format switch and the contact section. Keep the space between the last section and the footer to one section's worth of padding, not a stack of shell padding plus footer margin. A page whose header jumps to its last section (the AI profile's Sources) keeps that landing room inside the page itself, since the footer's height is not a layout contract.
- Page titles and descriptions sound written by Sirui, not generated by the theme.

## Blog Voice

- Blog copy can be casual, but it still tells readers why a note is worth opening.
- Use concrete nouns and research situations instead of generic "AI tools" or "cool stuff."
- A small playful interaction is fine when it rewards curiosity and does not block reading.
- Long research notes need generous line length, heading rhythm, and a clear next-read path.
- Pinned notes behave like starting-point cards: compact, with the same trust signals as normal posts, and the canonical list stays intact.

## Conservative Inspiration Boundaries

- Stripe is a pattern reference, not a costume: crisp hierarchy, proof near claims, strong section rhythm, quiet controls, a clean sans-serif system with a monospaced accent only for labels, metadata, dates, and code-like signals, navigation that survives zoom and tablet widths, and a time-of-day control that stays small while the palette changes coherently. Do not borrow its gradient spectacle, sales posture, or company-site goals.
- AI in Design 2026 frames the moment: infinite output, craft, taste, tool fluency, role blur, and messy collaboration. Borrow the questions, not the tone.
- The site stays a personal academic portfolio with research credibility first.
- Give credit where credit is due. Cite inspiration, reports, talks, books, collaborators, and tools near the lesson they shaped, quieter than the main story.

## Process Artifacts

- A project page or blog post about the website teaches the design process, not just the screenshots: before/after evidence, the critique loop, and what changed because of taste rather than because it was possible.
- Process writing is reusable by students: include the heuristics, prompts, constraints, and reflective-practice lessons that helped the work improve, and let them inspect the method (preview a central heuristic file before asking for a download).
- When using AI coding help, describe the human design judgment and review loop. The agent is part of the workflow, not the author of taste.
- For model-to-model re-review, hold the brief, viewports, interaction states, and acceptance rubric steady. Record the model and effort, commit, attempted change, what was kept or reverted, and comparable evidence; attribute the outcome to model, prompt, retained context, implementation history, and human critique together.

## Maintenance And CI

- Formatter drift is design debt. Pin formatter versions locally and in CI so the same file does not pass on one machine and fail on GitHub.
- Treat generated or vendored third-party bundles as dependencies. Exclude them from project-specific static analysis instead of hand-editing minified or generated code.
- Demo content that exists only to show theme features stays unpublished until it becomes part of Sirui's real story.
- Keep visual QA in three explicit lanes: `test:visual:iterate` for one fast screenshot, `test:visual:checkpoint` for explicit affected routes, and `test:visual` for release. Never make the fastest lane silently start a Jekyll server or expand to the full route matrix.
