# Website Design Heuristics

Use this file as the shared design memory for future homepage and portfolio refinements. The goal is a personal academic site that feels thoughtful, alive, and readable without becoming a corporate product site or a visual demo reel.

The current design spine is **Less, but more Sirui**: lively, fun, unmistakably personal, and intentionally designed, with fewer things competing for a visitor's limited attention.

Agent-facing Codex overlays live in `.codex/skills/website-design-critique/SKILL.md`, `.codex/skills/portfolio-writing-voice/SKILL.md`, and `.codex/skills/tacit-knowledge-to-skill/SKILL.md`. This file remains the canonical human-readable, copy-pastable source; skills should point here by heading instead of duplicating the full heuristics.

## Decision Order

When two heuristics compete, protect the earlier concern first:

1. Research meaning, factual integrity, source credit, accessibility, and a working route.
2. First-glance comprehension: who Sirui is, what the work asks, why it matters, and where to go next.
3. Proof proximity, reading order, responsive layout, and legibility.
4. Discoverable interaction state, bounded motion, and clear recovery paths.
5. Materiality, atmosphere, personality, and delight.

A more expressive result is not better if it weakens an earlier concern. Treat `must` and `never` rules as contracts; treat named visual references and opportunities as taste guidance that still needs rendered evidence.

## Less, But More Sirui

- Spend attention deliberately. Prefer fewer containers, hierarchy levels, competing actions, and repeated explanations; give the remaining elements enough space and specificity to matter.
- Use a card only when it communicates interaction, containment, or a meaningful boundary. A summary that repeats the next section should become whitespace, a hairline, an editorial sequence, or a plain list.
- Lively does not mean constantly moving. Let one idea, gesture, or visual surprise carry a section, then let the rest of the page breathe.
- Keep the site fun and Sirui. A warm aside, honest receipt, unusual interaction, or small joke is welcome when it reveals the person, research process, or evidence behind the work.
- Content earns its place. Explain the idea once in clear language, keep proof close to it, and move technical custody or reproduction detail into an optional disclosure when it would interrupt the human story.

### An Evolving Spine

The spine is stable enough to guide decisions and open enough to learn. Experiments are welcome when they strengthen meaning, personality, or discovery and survive rendered critique across the required viewports, themes, input modes, and accessibility states. Record uncertain ideas in [`docs/design-experiment-backlog.md`](docs/design-experiment-backlog.md) with a hypothesis and revisit trigger instead of either freezing the design language or shipping an effect without evidence.

### Signature Copy Locklist

These phrases carry Sirui's voice or research framing. Preserve them exactly unless Sirui explicitly approves a rewrite; do not condense them merely to reduce word count:

- “Making AI tools that sharpen design judgment.”
- “Scaffolding taste in an age of generative abundance.”
- “Design, Evaluate, Situate.”
- “Vibes -> Variables -> Value”
- “Make better design decisions visible.”

### Three Narrative Type Roles

- **Display:** the one major statement or page title that should lead a viewport. Use Inter 700.
- **Heading:** section titles and local structure. Use Inter 600.
- **Reading:** paragraphs and explanatory prose. Use Inter 400.
- **Compact exception:** controls, metadata, CV tables, code, chart labels, and other genuinely dense records. Use Inter 500 or the existing monospace face where the content is code-like.
- Load and request only the Inter weights the site uses: 400, 500, 600, and 700. Never synthesize 750–900. Legacy type variables remain aliases during the transition; new narrative styles must use the role variables instead of inventing a new size.

### Human And AI Are Different Reading Surfaces

- **Human routes** are visual, warm, selective, and first-person. They should make a question easy to feel, show the most useful proof, and reward curiosity without requiring the reader to decode a development log.
- **AI routes** are compact, semantic, source-linked, motion-free, and information-dense. They should expose stable anchors, plain fields, evidence boundaries, and reproduction paths without inheriting decorative human layouts.
- Reciprocal Human/AI links should preserve the closest meaningful context. Shared canonical facts may project into both surfaces, but the presentation should not be forced into one compromise template.

### Story With The Right Medium

Tell each design story through the best combination of text, image, interaction, and truthful data. Do not force every case study into the same card grid. Some claims need a sentence, some need a before/after image, some need a chart and exact table, and some need an interaction the visitor can try. Mixed media is coherent when every element advances the same question.

## Agent Quick Index

| Task                                 | Start with these headings                                                                                                                                     | Agent overlay                                                   |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| Sitewide or homepage critique        | Decision Order; First-Glance Story; Visual Hierarchy; Accessibility And Quality Checks; Screenshot Critique Ritual; Proportional Visual QA; Responsive Layout | `$website-design-critique`                                      |
| Blog, project, or case-study writing | Decision Order; Content; Page Archetypes; Blog Voice; Conservative Inspiration Boundaries; Process Artifacts                                                  | `$portfolio-writing-voice`                                      |
| Homepage 2D/3D desk scene            | Decision Order; Motion; Playful Portfolio Lessons; Research Desk Materiality; Responsive Layout                                                               | `$homepage-desk-scene` plus `docs/homepage-desk-scene-brief.md` |
| Recording a durable lesson           | Decision Order; the affected topic heading; Maintenance And CI                                                                                                | `$tacit-knowledge-to-skill`                                     |
| Evaluating a design experiment       | Less, But More Sirui; Motion; Acceptance Evidence; `docs/design-experiment-backlog.md`                                                                        | `$website-design-critique`                                      |

Begin with the rendered route and the visitor problem, not with a preferred effect. Keep one-off implementation notes in the owning file or temporary scratchpad; add to this document only when a lesson generalizes beyond the current patch.

## First-Glance Story

- A rushed visitor should learn, within 15-30 seconds: who Sirui is, what problem space he studies, what he has built, why it matters, and where to click next.
- Lead with the research thesis, not with a long biography.
- Every section should answer one visitor question:
  - Start: Who is this?
  - Taste: What is the intellectual thread?
  - Focus: What are Sirui's research loops and areas?
  - Publications: What concrete evidence should I open first?
  - Updates: What is active right now?
  - Students: How can someone work with Sirui?
  - Connect: How can someone follow up?

## Visual Hierarchy

- One dominant headline per viewport is enough.
- Use section labels for scanning, but keep them quiet and consistent.
- Prefer fewer, stronger CTAs over many equal buttons.
- Put proof close to claims: projects, publications, venue labels, and updates should appear near the research story they support.
- Use whitespace to clarify grouping, not to create empty drama.
- Every ounce of ink should matter, whether it is black text, colored text, a border, a card, a shadow, or a line.
- Repeated information is useful only when it improves orientation; remove it when it merely restates the same claim.
- When comparable time series begin on different dates, keep every verified earlier segment and let later series join when their evidence begins; never truncate the shared history merely to force a common start.
- Pinned content is a route into the work, not a reason to remove that work from the chronological archive.
- Line breaks are part of hierarchy. If a phrase leaves one orphan word on a line, adjust width, type size, or copy before accepting the wrap.

## Color

- Brand orange and interface accent are separate roles. The fruit keeps the invariant `#f07a38` brand orange; links, controls, focus, and selected states use the active time-of-day accent.
- Reserve brand orange for the fruit and rare warm details that carry meaning. Do not spread it through page washes, generic cards, or every interactive state.
- Mint and sky should be semantic highlights, used sparingly for contrast or a specific idea.
- Neutral surfaces should carry most of the layout.
- Avoid a page that reads as all orange, all pastel, all purple, or all gradient.
- If color does not communicate hierarchy, state, or meaning, remove it.
- Colored ink should mean action, active state, status, or a deliberate semantic grouping. Do not use a tinted card because a section feels empty.
- The global time-of-day themes should change atmosphere without changing the research story: morning uses dawn rose, noon Pacific blue, afternoon sea glass, and evening moonlit lavender.
- Theme palettes need hue variety and contrast, not four versions of the same orange wash.
- Keep accessible accent ink separate from lighter pastel fills. Links and labels need a darker contrast-safe mode color; selected controls may use the related pastel only with its own tested on-fill text color.
- A time mode should register through the whole surface hierarchy—page field, cards, elevated surfaces, outlines, shadows, and footer—not only through the logo or a few tiny accents. Verify representative routes in every mode before calling the palette sitewide.
- Time-of-day themes should default from the visitor's local time. Manual changes can be remembered within the current session, then return to the time-based rule on a future visit.
- If a page stays open across a time boundary, automatic theme changes are allowed only when the visitor has not manually picked a theme in that session.
- Theme backgrounds should stay clean. Use pastel atmosphere as a soft field, not as muddy color spread across every surface.
- In evening mode, use moonlit lavender for interface actions and restrained containers over neutral blue-black surfaces. The fruit remains orange because it is identity, not a dark-mode action color.

## Project Images

- Research teaser figures must remain inspectable.
- Do not crop diagrams or teaser figures into decorative ratios.
- Use `object-fit: contain` for project previews unless the source image is clearly photographic and safe to crop.
- Use clean white preview wells for figures so diagram backgrounds remain legible.
- If a teaser is unusually wide or tall, add an image aspect hint in page frontmatter instead of forcing every project into the same crop.

## Motion

- Motion should explain the page, not decorate it.
- Good motion: section reveal, active rail state, hover feedback, small transitions that show "this is clickable," and, on pages that opt into the cinematic layer, scroll-driven scenes that walk a reader through one figure.
- Bounded cinematic motion (Sirui, 2026-09-05): a sticky figure with a moving lens while three steps scroll past, staggered entrances, a pointer spotlight and a few degrees of tilt over card grids, shallow parallax (a title moving under a third of its own height), count-ups on one or two proof numbers, and a gradient field behind a page title that takes tens of seconds to drift. Each plays once per element or slower than reading, never takes over scrolling, and every one is a still page under reduced motion, without a fine pointer, or under automation.
- Bad motion: constant fast movement, unrelated loops, cursor trails, scroll hijacking, or effects that compete with reading.
- Always respect `prefers-reduced-motion`.
- Smooth scrolling should preserve native control: use anchor smoothing and reveal timing, not wheel or touch hijacking.
- Animation should make Sirui feel thoughtful and dynamic, not flashy.
- Interactive research motion should map to an idea: design means option exploration, evaluate means evidence and traces, situated means context-aware assistance.
- Autoplay is acceptable only when it is slow, pausable by leaving the viewport/tab, and visually secondary to the words.
- If an animation competes with the explanation, change the layout before decorating the animation. Claim and controls should come before the moving field.
- Draw inside intentional bounds. Clipping should never be the default way to create drama.
- Ambient motion may echo the main interaction, but it should be quieter than the text, strongest near the relevant section, and absent under reduced motion.

## Playful Portfolio Lessons

- Borrow from Jackie Hu's portfolio as an interaction principle, not as a visual costume: a personal site can feel like a small desk of artifacts when each object teaches something real about the person.
- Artifact constellations work only when the artifacts are proof. On Sirui's homepage, playful objects should point to actual tools, papers, teaching artifacts, or active research threads.
- Reveal-on-hover should answer "what is this and why open it?" rather than merely showing that something can move.
- Hover should preview the current state; explicit controls should change state. If hovering a portrait changes the selected record before the visitor can click play, the interaction feels slippery instead of polished.
- Playful metadata belongs behind a deliberate reveal. A hover preview can tease the disk/object, but titles, artists, durations, and catalog notes should stay hidden until the visitor opens the liner note.
- If a playful object has multiple states, provide a small explicit control for touch and keyboard users. Hover can preview; it should not be the only way to reach the full set.
- Give substantial site widgets one quiet origin route near the widget heading or mode control. Its resting mark should stay below the content hierarchy: use a tiny consistent glint that illuminates once when the owning artifact or cue receives hover or focus, never a competing text label, continuous pulse, slider-like line, or explanatory popover. The accessible name should identify the destination, and touch/keyboard activation must open the same concrete case study or reproduction note.
- Put state-changing controls where the state lives. Record switching belongs beside the disk, not inside a progress bar where it can be mistaken for play/pause.
- Put one or two concrete proof routes above the fold, but do not let proof cards compete with the thesis headline.
- Small rotations, lifts, image zooms, and caption emphasis are enough. If the motion becomes the thing a visitor remembers more than the work, simplify it.
- Do not fake copyrighted music. If the referenced songs cannot be licensed, keep the album as a visual artifact rather than adding unrelated free music, generated tones, progress bars, or volume controls.
- Music references can be taste cues, but they should read as liner-note metadata: title, artist, duration, mood caption, and source link. The joke should never imply the site is playing a song it cannot legally play.
- Future audio must be owned, licensed, or deliberately Creative Commons for the story being told, and it still needs explicit activation, visible control, no autoplay, and no surprise keyboard-focus sound.

## Research Desk Materiality

- Paper texture, desk surfaces, coffee rings, pens, records, and other small objects should support Sirui's story as a researcher-designer making judgment visible. If an object cannot answer "what proof or process does this point to?", remove it.
- Treat material effects as quiet evidence framing: clean white stock, warm hairline borders, small shadows, and restrained stains are enough. Avoid fake crosshatch paper textures, visible diagonal fibers, decorative connector lines, and stains that read like clip art.
- A desk stage should have one related material language, not one merged object. If two proof cards represent different claims, keep them as separate slips; combining them into one note makes the evidence feel less intentional.
- Dark-mode materiality must be native to the theme. Do not force white paper/card surfaces into evening mode unless the contrast is deliberately rare and justified; use muted theme-aware pastel surfaces instead.
- Coffee rings should be thin, broken, and partially hidden behind content, with at most a few tiny pooled dots. If the ring draws attention before the research cards, lower the opacity or remove it.
- Put material marks on or directly behind a specific artifact, not in empty background space. A coffee ring reads as intentional when it belongs to a paper slip; it reads as decoration when it floats offstage.
- "Premium paper" should be white first: warm edge, paper-thickness shadow, crisp typography, and maybe a barely perceptible surface variation. Avoid colored fills, visible grain, grid textures, and large rounded app-card shapes when the metaphor is paper.
- Controls embedded in playful objects should feel native to the object: translucent glass on vinyl, quiet focus rings, and enough hit area to be usable without looking like a separate app button. Hide controls when they compete with the artifact and reveal them on hover/focus.
- Album metadata belongs in a liner-note easter egg, not in a player strip. Avoid progress bars, elapsed time, and volume UI when the interaction is only a visual record spin.
- Use CSS-only texture first for paper and stain details. Add image assets only when the object itself is meaningful evidence.
- Keep the thesis and research proof above the fold more important than the desk vibe. Materiality should make the page feel handled and human, not turn it into a prop scene.
- Credit visible influences when they shape interaction taste. Borrow principles from references such as Jackie Hu's playful object language, not their assets, code, layout, or exact styling.

## Future Style Opportunities

- Extend the desk material language only where it clarifies process: project case-study process notes, selected teaching artifacts, and the website-revamp story can use paper slips, margin notes, or receipts because those pages are about artifacts and critique.
- Keep publications, CV, and archive pages more utilitarian. Their job is trust, scanning, and citation, so materiality should appear as restrained spacing, crisp typography, and proof grouping rather than decorative desk objects.
- Blog posts can carry more personality than bibliography pages, but the playful object should belong to the post's subject. A record, coffee ring, doodle, or taped note needs a reason inside the story.
- Reuse the homepage's paper system before inventing new effects: warm white stock, tiny grain, small tape tabs, thin borders, and short shadows. Consistency will feel more polished than a new visual trick on every page.

## Navigation

- Keep the global nav simple.
- Use in-page navigation only when it helps a reader understand the story structure.
- Desktop can support a compact story rail; mobile should stay clean and linear.
- On narrow or vertical reading pages, keep in-page navigation inline or collapsed; after the top of the page, surface it as a compact on-demand control instead of a sticky top card.
- Floating reading aids should have exit conditions: hide them near the footer, reveal them on scroll-up or section changes, and keep the trigger out of the main text column.
- Anchor links must land with enough top spacing below the fixed nav.
- Active navigation state should match the section currently being read.

## Content

- Keep Sirui's voice warm and specific.
- Avoid generic AI/design language unless it is tied to a concrete research question or project.
- Project and blog pages should tell the concrete story first. Keep design philosophy in process notes or heuristics, not as a substitute for what actually happened.
- A fun-project opening should answer four questions without making the reader decode a case-study template: What is this? What did I make? What changed while I designed it? What should the result let someone notice, do, or feel? Use first-person nouns and verbs tied to visible things; words such as "system," "artifact," and "scaffold" need a named object beside them.
- Story labels must carry information. Replace empty stage names such as "Spark / Turn / Now" with the actual version, problem, decision, or current behavior they introduce.
- Lead with what a project does and why it matters. State privacy, provenance, or evidence limits once near the relevant claim; avoid repeating defensive “X, not Y” constructions through the main story.
- Content polish must preserve research meaning. A tighter phrase is worse if it narrows the actual claim, erases scope, or turns a thesis into a UI slogan.
- The AI in Design 2026 report is useful as context: it frames AI as changing tools, craft, and teams. Borrow the questions, not the corporate tone.
- A compact influence note can credit Katie Dill and AI in Design 2026, including the line: "AI is sparking a creative renaissance in design."
- Keep the main page centered on Sirui's work, not on external inspiration.

### Dual-Audience Publishing Intention

- Machine-first content should be route-addressable, server-rendered, semantic, source-linked, and human-auditable. JavaScript may improve copying or state feedback, but it must never gate the research record.
- A dark terminal aesthetic is not a synonym for AI readability. Preserve the site's theme, use normal reading typography for prose, and reserve monospace for labels, paths, identifiers, and format cues.
- A why-cite guide must keep contribution, reported evidence, and scope together. It should help a reader decide whether a citation fits without turning an author interpretation into a paper result.
- Keep bibliographic facts in the canonical bibliography and editorial interpretation in a separately validated overlay. Human cards, machine pages, structured data, and raw citation files should project from that shared contract rather than drift into parallel copies.
- Treat `/llms.txt`, raw Markdown, and structured data as retrieval aids, not ranking promises. Crawlable HTML, stable paper URLs, searchable PDFs, canonical identifiers, and scholarly indexes remain the discovery foundation.
- The Human/AI transition is a route change, so use ordinary links with visible current state and a usable mobile fallback. The machine view should remove visual decoding work while remaining welcoming to a human reader.
- Keep Human/AI navigation explicit and route-addressable. Enter the machine view at the closest stable section or paper anchor, keep its navigation within that view, and make the Human action return to the closest canonical counterpart. Recompute that counterpart after direct hash edits as well as Back/Forward navigation so a browser event can never be mistaken for a section ID. Preserve Back, shared URLs, keyboard order, and a deterministic no-JavaScript fallback; do not silently redirect from a stored mode preference.
- Manual reading in the machine view should keep the final section current through small post-load chrome or font-metric corrections. Use a bounded document-end tolerance for active-section state, and never synthesize a URL hash merely because the reader scrolled.
- Give the machine view one local navigation taxonomy. Name any link that intentionally exits to a human page, and use `rel=alternate` only when the target is a genuine representation of the current document rather than a generic site index or related dataset.
- Help web agents by reducing redundant observations and exposing descriptive semantic links, stable section IDs, canonical/raw alternatives, and source provenance. This adapts lessons from [Mind2Web 2 (NeurIPS 2025)](https://dblp.org/rec/conf/nips/GouHNGLQKYGSSWC25), [AgentOccam (ICLR 2025)](https://dblp.org/rec/conf/iclr/00030CFCKR25), [WebLINX (ICML 2024)](https://dblp.org/rec/conf/icml/LuKR24), and [VisualWebArena (ACL 2024)](https://aclanthology.org/2024.acl-long.50/) without claiming that an alternate view or `llms.txt` guarantees discovery.
- On a long no-JavaScript machine profile, prefer immediate native anchor placement over pagewide smooth travel. Without the coordinating script, a second section choice can overtake a still-running scroll and end at the stale target; deterministic arrival is more important than transitional polish.
- Design influence: the Human/Machine framing adapts [Paxel](https://paxel.ycombinator.com/) as demonstrated by YC Head of Design Eve Bouffard with Aaron Epstein in [Y Combinator's 2026 design walkthrough](https://youtu.be/VbqaL_eHhKY?t=433); the site adds static URLs, no-JavaScript readability, and explicit scholarly provenance.

## Accessibility And Quality Checks

- Check light mode, dark mode, mobile, tablet, and desktop.
- Check keyboard navigation and visible focus.
- Check that text does not overlap cards, nav, footer, or the back-to-top button.
- Check that mobile has no horizontal overflow.
- Check that colors have enough contrast, especially orange text on light backgrounds and nav text in dark mode.
- Check that reduced-motion users can still see all content.

## Screenshot Critique Ritual

For each meaningful homepage direction, not every CSS adjustment:

1. Capture one representative affected route, state, and viewport.
2. Read the page as a rushed research peer.
3. Read it as a prospective student.
4. Read it as a returning collaborator.
5. Mark anything that is visually loud but not meaningful.
6. Mark anything important that is hard to notice.
7. Revise the same frame until the direction is clearer, not merely prettier.
8. Expand to boundary viewports and relevant accessibility states only after the direction earns a checkpoint.

For sitewide passes:

1. Keep a temporary critique scratchpad while working, then delete it before handoff.
2. Audit each public route at desktop, laptop, tablet, and narrow mobile widths.
3. Read each page through four lenses: rushed research peer, prospective student, interested non-specialist, and returning collaborator.
4. Treat the page as a reflective practice artifact: make a change, observe what it clarifies or hides, then revise.
5. Move durable lessons back into this file so future sessions start smarter.

## Proportional Visual QA

Visual evidence should match the decision being made. Do not spend a release-sized test budget on a local taste question.

### Fast iteration: one design decision

- Reuse one already-running, owned localhost server. Do not rebuild Jekyll, restart Docker, or reconnect browser control for every CSS or copy adjustment.
- Inspect one affected route, one meaningful state, one representative viewport, and the currently relevant theme. Capture one screenshot per hypothesis, compare it with the last useful frame, then make the next design decision.
- Prefer the repository's deterministic Playwright iteration lane and inspect its saved PNG under `.jekyll-cache/visual-qa/` directly. Keeping artifacts in this unwatched directory prevents screenshots from waking Jekyll and rebuilding the site mid-critique. Browser control is for interactions that cannot be reproduced in the harness or when Sirui explicitly needs a live tab.
- If browser capture stalls once, stop retrying and use the repository lane. Repeated browser setup, documentation output, and screenshot retries are not design work.
- The lane has a one-minute global budget. If it is unexpectedly slow, set `VISUAL_TIMINGS=1` once. Use its concise phase report to fix the measured bottleneck; do not repeat captures while guessing.
- If timings show that the page and screenshot finished but Chromium teardown dominates, stop the loop. Treat a persistent-browser worker as a separate harness improvement; do not make the capture faster by hiding or stubbing design assets that the judgment depends on.
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

- Run the full public, scene, legacy, build, crawl, and release gates only after the design diff is accepted and ready to publish.
- The four-viewport sitewide matrix remains release evidence; it is not the inner design loop.
- A failed release gate should route back to the smallest responsible test, not trigger repeated full-suite runs after every fix.

## Acceptance Evidence

- Compare the same route, viewport, theme, and interaction state before and after the change.
- Name the visitor problem and show how the result improves comprehension, proof proximity, reading, state clarity, or recovery.
- At checkpoint and release, inspect 1440x1000, 1280x800, 768x1024, and 390x1000 rather than extrapolating from one desktop screenshot. During active iteration, use the smallest representative frame that answers the current design question.
- Check light and dark themes when color or surfaces changed; check keyboard focus and reduced motion when interaction changed.
- Reject changes that introduce overlap, horizontal overflow, primary-media occlusion, broken links, console errors, or a weaker first-glance story.
- A design pass is complete when the affected route is clearer and its important states are verified, not when every possible surface has been restyled.

## Page Archetypes

- Homepage: editorial thesis and routing hub. It should explain the intellectual thread and send people to work, papers, writing, student info, or contact.
- Projects: evidence surface. Each card should show artifact, problem, venue/status, and where to click without requiring the visitor to parse a paragraph.
- Project detail: case study. Lead with the research question, contribution, artifact preview, venue, and links before long author blocks or implementation detail.
- Publications: bibliography with orientation. Keep the citation list authoritative, but help readers find selected/current work quickly.
- Playful publication modules should still serve the bibliography: a rejection wall can celebrate hidden research failure when it stays rejection-only, keeps receipts close to each badge, and avoids becoming a leaderboard.
- Blog: research notebook with personality. Casual voice is welcome; vague dumping-ground copy is not.
- CV: utility page. Optimize for scanning, PDF access, dates, roles, and correctness over decoration.
- News: timeline. Short, dated signals should be easy to skim and should not fight the homepage updates section.

## Occam's Razor For UI

- Prefer the smallest change that makes the visitor's next decision easier.
- Remove a visual element if it does not clarify hierarchy, state, rhythm, or trust.
- Do not add a new component when copy, spacing, or ordering solves the problem.
- Remove the component before designing around its awkwardness.
- Let repeated components carry consistency; reserve custom pages for genuinely different reading tasks.

## Responsive Layout

- Design the first viewport at multiple shapes, not just one width.
- On mobile, the first useful explanation should appear before long media, author grids, or metadata blocks.
- Fixed-format content needs explicit dimensions or aspect ratios so cards do not jump or crop meaningful diagrams.
- If a footer, floating button, or nav competes with reading on mobile, reduce its footprint or move it out of the way.
- Primary media must not be covered on mobile. If an overlay hides a map, globe, figure, face, or artifact, move the overlay below the media or collapse it.
- Whitespace should manage cognitive load: group related things, separate new ideas, and let the next step peek without creating dead air.
- Use page-type widths: narrow for long reading, medium for notebooks and lists, wide only when grids or diagrams need the room.
- Test 1440x1000, 1280x800, 768x1024, and 390x1000 before calling a visual checkpoint or release done; do not rerun the matrix after every local adjustment.

## Footer And Global Chrome

- Global navigation should tell the site story in order: about, publications, projects, blog, CV.
- Keep page chrome quiet. The work should be louder than the frame.
- Tiny brand marks should read by silhouette before detail. Avoid engraving, lettering, or 3D shading inside a 32px nav logo; use a flat glyph with one or two meaningful details.
- At nav-logo size, natural texture should collapse into low-contrast category cues: many tiny uneven marks can say "citrus rind," but they must stay quieter than the silhouette and leaf.
- Procedural brand marks need category anchors. Vary silhouette, color, texture, and attachments within the object family, but preserve the cues that make the object legible at icon size.
- Search, dark mode, footer links, and back-to-top controls should stay discoverable without covering content.
- Page titles and descriptions should sound written by Sirui, not generated by the theme.

## Blog Voice

- Blog copy can be casual, but it should still tell readers why a note is worth opening.
- Use concrete nouns and research situations instead of generic "AI tools" or "cool stuff."
- A small playful interaction is fine when it rewards curiosity and does not block reading.
- Long research notes need generous line length, heading rhythm, and a clear next-read path.
- Pinned notes should behave like starting-point cards. Keep them compact, show the same trust signals as normal posts, and leave the canonical list intact.

## Annotations And Portraits

- Speech bubbles and annotations must point to a real idea, not fill awkward space.
- Never let an annotation cover a face, project evidence, or primary figure.
- If a bubble uses color, the color should separate roles or meaning. Neutral should remain the default surface.
- Playful portrait hovers should preload and crossfade. A jagged image swap makes the joke feel cheaper than the rest of the design.

## Conservative Inspiration Boundaries

- Stripe is useful for hierarchy, modular proof cards, CTA restraint, and strong sequencing.
- Do not copy Stripe's company-site goals, heavy sales posture, or brand spectacle.
- AI in Design 2026 is useful for framing the moment: infinite output, craft, taste, tool fluency, role blur, and messy collaboration.
- The site should remain a personal academic portfolio with research credibility first.
- Give credit where credit is due. Inspiration, reports, talks, books, collaborators, and tools should be cited plainly when they shaped the work.
- Source credit is part of design craft. Cite the artifact or person near the lesson they shaped, but keep credit quieter than the main story.

## Process Artifacts

- A project page or blog post about the website should teach the design process, not just display screenshots.
- Show before/after evidence, name the critique loop, and explain what changed because of taste, not just because it was possible.
- Process writing should be reusable by students: include the heuristics, prompts, constraints, and reflective-practice lessons that helped the work improve.
- Teaching artifacts should let students inspect the method, not only admire the result. If a heuristic file is central, preview it before asking people to download it.
- When using AI coding help, describe the human design judgment and review loop. The agent is part of the workflow, not the author of taste.
- For model-to-model re-review, hold the brief, viewports, interaction states, and acceptance rubric steady. Record the model/effort, commit, attempted change, what was kept or reverted, and comparable evidence; attribute the outcome to the model, prompt, retained context, implementation history, and human critique together rather than treating a model label as the cause.

## Stripe Lessons, Adapted

- Use Stripe as a pattern reference, not a visual costume: crisp hierarchy, proof near claims, strong section rhythm, and quiet controls.
- Prefer a clean sans-serif system for confidence and readability. Display headings can be large, but should not become chunky or theatrical.
- Use a monospaced accent only for labels, metadata, dates, shortcuts, compact stats, and code-like signals.
- Let the next section peek into view when possible. A visitor should always feel the page has a clear next step.
- Motion should clarify state: hover means clickable, active rail means current section, reveal means a new idea has entered the reading path.
- Navigation should survive zoom and tablet widths before it looks impressive. Collapse earlier if links become cramped.
- Do not borrow Stripe's gradient spectacle or sales posture. Sirui's site should feel like a thoughtful research portfolio, not a company homepage.
- Credit inspiration compactly when it materially shaped the craft direction, but keep the page centered on Sirui's research.
- Stripe's time-of-day pattern is most useful here as a mood and state model: the control is small, the palette changes are coherent, and the main content still carries the claim.

## Research Motion Rules

- The homepage motion section is a research diagram first and an animation second.
- Keep canvas geometry abstract enough to avoid fake data, but structured enough that each mode has a reason to exist.
- Use a stable number of lines and dots; reduce density on mobile.
- Give each mode enough copy to make the metaphor readable before asking visitors to interpret the motion.
- Mouse movement may bend or separate the field, but it should never make text harder to read or turn the section into a toy.
- Pointer entry should ease in. Nothing should snap just because a cursor crossed a canvas boundary.
- Reduced-motion mode should render a still composition for the selected mode, not hide the idea.
- Stop animation when offscreen or when the tab is hidden.
- Local theme controls can sit near the thing they affect, but they must mirror the global theme state exactly. No second, hidden source of truth.

### Research-Grounded Motion Intention

Before keeping an effect, record the visitor problem, trigger, semantic meaning, stop or recovery condition, reduced-motion or static equivalent, and acceptance evidence.

- Motion is justified when it preserves object identity, reveals a real change, clarifies an affordance, or encodes a truthful interaction or measured state.
- Use one coordinated transition by default. Stage only when separating meaningful changes makes their relationship easier to understand.
- Kinetic intensity is information: particle count, velocity, direction, and trail strength may change only with a named interaction or truthful state. If they do not, remove them as decoration.
- Keep particles inside bounded diagrams or evidence surfaces, not as persistent page-wide confetti or cursor trails.
- Progressive or changing values must expose freshness and provenance; never animate a static snapshot as if it were live activity.
- Global consistency means shared timing, state clarity, accessibility, interruption, and recovery rules, not the same visual trick on every route.
- Interactive motion must settle into a valid state after interruption and retain a readable still state, equivalent text, keyboard path, and reduced-motion treatment.
- A data story should teach one visual relationship at a time, move from a plain-language question through annotated examples, and then hand control to the complete explorer and exact table. Scroll may choose an explanatory state, but it must not hijack the wheel, rewrite reported values, or become the only route to the evidence.
- Small editorial constellations should use deterministic semantic axes and a few source-reviewed edges instead of force simulation. Keep node size, citation influence, status, and future-work timing as separate visual channels; preserve the authoritative list by default, and turn desktop geometry into labeled thread trails on narrow screens rather than shrinking it into illegibility.
- Research grounding: object constancy and simple staging from [Jeffrey Heer and George Robertson](https://idl.cs.washington.edu/files/2007-AnimatedTransitions-InfoVis.pdf); narrative checkpoints from [Edward Segel and Jeffrey Heer](https://idl.cs.washington.edu/files/2010-Narrative-InfoVis.pdf); interruptible intermediate/final animation-state management from [CMU DIG's Counterpoint](https://dig.cmu.edu/publications/2024-counterpoint.html); accessible alternatives and animation control from [Chartability](https://www.frank.computer/chartability/). These are principle-level influences; no source assets, layouts, or code are copied.

Current accepted intent record:

- Skip link and landmark: every page starts with one "Skip to content" link that is invisible until it receives keyboard focus and moves focus to the `#main` landmark only when used; the landmark itself never carries a resting `tabindex`, so ordinary clicks keep focusing their targets and existing focus-return logic (the project preview cards) stays intact.
- Cross-document crossfade: same-origin navigation between two opted-in documents crossfades the page root at the standard motion duration while the navbar and progress bar hold still; the homepage, AI profile, and hidden page are not opted in, reduced motion makes every navigation an instant swap, and no element morphs are named because they would compete with the projects index's FLIP identity.
- Adjacent-project wayfinding: every project page ends with previous, all-projects, and next links that follow the projects index order for that category (research by importance, site experiments by debut date, other playful builds by importance), reusing the blog navigation grammar rather than adding a second component.
- Blog index measure: rows with and without a thumbnail share one text measure and thumbnails crop to one 4:5 shape, so the index reads as one column with images beside it; footer destinations (RSS, GitHub, Email, AI-readable profile) sit in one quiet compact row above the copyright line.
- Names and hidden tab stops: collapsed publication panels (abstract, award, Bib, video) are `inert` while closed, so the copy button inside a folded Bib block is never a keyboard stop or a screen-reader target; sentence links in the footer are underlined rather than told apart by color alone; Scholar Lens year bars take their accessible name from their visible count and year plus visually hidden connecting words instead of an `aria-label` that repeats them in another order; project figures declare their intrinsic width and height so the browser reserves their space and the summary below a hero never jumps when the image lands.
- Research-motion kinetic response: the particles should make direct local engagement or a mode change perceptible without turning nearby page space into an invisible accelerator. Only a pointer inside the bounded canvas may raise a clamped speed/trail signal; the inner edge ramps in gently, exit decays to rest, explicit mode selection stays brief, and the field pauses offscreen or in a hidden tab, keeps a stable particle count, and becomes a still composition under reduced motion.
- Desk tally wording: compact abbreviations made provenance harder to parse, so the in-scene note uses only explicit `commits` and `tokens`; it does not count up or imply live activity. That compact scene label is not a sitewide simplification rule: the fuller homepage ledger retains tokens, agent-hours, commits, and estimated kWh with its provenance caveat.
- Build-rhythm evidence: commits describe cadence, while additions and deletions describe change magnitude and direction; neither substitutes for the other. Code history appears only after an exact schema-5 source-calendar contract proves complete coverage with one row per calendar label from the pinned lifetime start through the latest reported label. Each source must declare its date basis and completion timezone: `Personal` uses GitHub profile author-date labels completed in `America/Los_Angeles`, while contributed feeds use UTC calendar labels. Matching `YYYY-MM-DD` labels may align the display but do not describe one shared timezone or 24-hour interval. Until the contract passes, show one compact `Code history is being rebuilt.` state and no inherited totals; an invalid refresh preserves only a previously valid current-schema snapshot. Schema 4 may be validated only as a one-way migration predecessor and must never remain renderable. Publish two commit counts, not one: each source's `commits` is its reported total, while `authored_commits` is the non-merge, non-deploy subset that alone carries added and removed lines. For `Personal`, the approved `github_contribution_parity` basis makes its reported total reproduce the GitHub contribution graph (default branch plus `gh-pages`, merges included); do not extend that claim to other sources or a combined total. A merge diff restates its branch and a deploy restates the whole generated site. Line counts are first-parent raw-text changes for authored commits, including documentation and data text; intrinsic binaries count as zero and repository attributes are neutralized. Compare the commit counts in one figure: render the reported total across visible sources as a quiet outer boundary with a soft band down to the summed authored line, so the visible gap means merges and deploys. Do not hide that distinction behind an All/Authored mode switch. Name each encoding in the key by what it means rather than by the mark: the key is an HTML strip above the SVG that reads `All commits`, `Merges + deploys`, and `Authored only`, the same words as the GitHub-profile SVG twin, and its gap glyph still draws the band between its own muted boundary and crisp authored line so the key shows the same relationship as the chart; terse keys such as `total`/`gap`/`authored` leave a reader guessing. Set the key in HTML so the browser wraps it and its glyphs read the marks' own CSS variables; never estimate mono advance widths inside the SVG. Panel headings stay inside the SVG, read `COMMITS PER DAY · LOG1P` (`COMMITS PER DATE LABEL` across mixed calendars) with the compact `/` form on narrow screens, and keep transform names without the Readable/Literal adjectives the control already states. Lifetime is the published evidence window, not the readable default view. Measured on the 2026-08 snapshot, only about 15% of 3,264 lifetime date labels carry a commit, and the stretch before sustained activity begins spends roughly a third of the plot width on about a tenth of the active days; at that scale one day occupies under a third of a pixel and no daily detail survives. Default the explorer to the three-year window, where one day is about one pixel and roughly a third of labels carry data, and keep lifetime one explicit click away with the header totals still lifetime. Retain explicit shorter windows for recent daily detail, thin year labels before they collide on compact screens, and state the independent date span of any shorter agent trace instead of stretching it across the lifetime domain. Name every approved public source (`Personal`, later `Intern work`), key points by source id, stack them as non-overlapping lower-to-upper bands with a legend that doubles as the filter, and omit a source from labels outside its own coverage rather than padding it with zeroes. Give every later source a hue that survives the whole figure (olive, because the Claude area beside it is terracotta and the original orange sat within OKLab ΔE 5 of it in every theme mode), a denser fill than the first source, and a surface-colored seam along its lower edge, so the band stays legible beneath the summed lines without adding a value line; when more than one source is visible, the readout adds one cell per source that says `no record` outside that source's coverage. Keep the code views synchronized to the same selected date label, provide readable and literal scales plus a reported-value table, and label them as build rhythm rather than productivity or causal evidence. Defer the lifetime table's thousands of DOM cells until its disclosure opens; exact access does not require making every hidden row part of initial rendering. On compact screens, shorten chart headings without dropping units or transform names, give each readout value its own cell rather than joining them into one sentence with separators, so wrapping happens between values instead of stranding punctuation and the numbers stay column-aligned for scanning, and name the horizontal reading path when the reported-value table preserves more columns than the viewport can show. A sanitized personal agent completed-day series may appear only when its own coverage and source-count provenance tuple validate; show it in a separately dated inset spanning its observed days, keep it separate from the repo-scoped retained-session estimate, and describe inspector matches as UTC date-label alignment rather than a shared day. Because that inset carries its own date domain, the same cumulative series may also be drawn once on the code axis as a quiet backdrop behind the commit and line panels, which is the only place the two rhythms can be compared by eye. Draw it cumulative, not per-date: a per-date wash reads as vertical striping, which is noise rather than a trend. Keep it a single fill with no stroke or markers so it reads as ground rather than a fourth series, span only the labels the agent record observed, mark the first observed day with a dated rule, and drop the fill under `prefers-contrast: more` while keeping that rule. Word it as co-occurrence in time; it is not attribution, productivity, or causal evidence. Leave code-history labels outside agent coverage without a marker instead of inventing zeros. When fixed Codex and Claude families are available, their priors and daily values must conserve the combined series; show them as stacked cumulative areas plus exact labels, keep both Codex accounts combined, and limit Claude to retained usage observed on this laptop. Readable/Literal may change number formatting, not an evidence boundary. Account identities and per-account histories remain private; rounded daily repo points describe a separate retained build rhythm rather than exact usage, quality, or productivity.
- Desk-mode continuity: visitors need the quick 2D collage and exploratory 3D room to feel related without becoming duplicate scenes. Both modes preserve the same record identity, spin state, discovery order, artwork, and paper/album language; only an explicit mode choice changes representation, reduced motion keeps the same settled state, and both modes share one stable stage height at each breakpoint so switching representation does not shift the surrounding page.
- Canvas click-suppression boundary: suppress only the synthetic native click that follows a WebGL canvas gesture. Sibling mode, transport, and reset controls must remain immediately actionable, and interaction telemetry should expose a window or return target only while production picking can actually reach it. Acceptance should prove an immediate reset restores the front camera and window affordance before the genuine entry raycast.
- Cliff-room continuity: the old outside view looked like a separate floating dollhouse, so inside and outside now use the same room scene graph under reciprocal camera states; there is no hand-matched exterior miniature to drift. The outside aperture mirrors the interior's screen ordering, sits measurably high in the live cliff mass with substantially more rock below than above, and connects through the cliff foot, beach, shoreline, and single ocean layer. Exterior framing should preserve enough coast below the cliff to ground that height; prefer a small camera-target correction over shrinking the aperture or adding decorative terrain. Only deliberate window activation enters outside mode; window activation returns, while Escape, reset, or scrolling away recover the room. Wheel zoom explores only the active view; the interior orbit clamps the camera inside the side, rear, and window-side room boundaries, while the exterior rear orbit adds clearance instead of clipping through the cliff. Compact canvases step the room scale down only as needed to keep rack, onsen, and lounge landmarks in frame, and acceptance requires regenerated, state-asserted default/side/rear/outside/mobile screenshots from the current served asset.
- Live architectural topology before texture: floor silhouette, shell joints/open ends, glass-to-floor coverage, cliff elevation, and sightlines must be derived from the transformed geometry and visible materials visitors actually receive. Cache truly static topology, keep automatic interaction telemetry lightweight, and reserve deep multi-ray occlusion evidence for an explicit QA request so instrumentation never slows the visitor's orbit. A failed multi-ray visibility verdict must select a blocked sample and name its live occluder instead of reporting a clear representative as the failure. Landmark evidence should target the recognizable rendered surface, not a tiny subpart or a broad proxy that changes the claim. Never let copied coordinates or unused base materials certify a drifting scene.
- Layered window affordance: the window should be quietly discoverable in the default still frame, may receive one bounded introductory pulse, and can reveal explanatory copy on hover or closer zoom. Place the object-native cue on the sill or frame where it reads as an affordance, not as a decorative dot floating high in the glass; keep disclosed copy short enough to scan without covering the view. The static hotspot, keyboard path, and reduced-motion treatment remain sufficient without the pulse; zoom never changes inside/outside state by itself.
- Texture-ready is not readable copy: a loaded paper texture proves only asset availability. Important scene copy such as `Welcome to Sirui's cave.` must also face the camera, clear its backing geometry, occupy measurable rendered bounds, and remain visually legible in desktop and narrow-mobile acceptance captures. An onboarding note is not permanent architecture: once the visitor deliberately goes outside, it should yield rather than block the reciprocal room landmarks.
- Small-world composition: scale is semantic in a thumbnail-sized scene, so the onsen and lounge must occupy enough projected area to read before they receive more detail. Small character and device landmarks also need minimum projected width and height; area alone can pass while a side-on head or code screen still reads as a sliver. One landscape layer should have one source of truth: derive dry sand, wet sand, foam, cliff contact, and ocean ordering from the same shoreline logic instead of stacking duplicate backdrops. Use a few broad geological planes rather than tiny facets that turn stone into visual noise. Blank decor is worse than no decor; every framed wall object should carry a real image or evidence cue. Keep lightweight composition telemetry for anchor order, projected area, control clearance, texture readiness, and cliff-to-shore contact so a visually attractive refactor cannot silently break the shared-world topology. That telemetry must sample rendered geometry and live material instances, not hand-placed proxy markers or unused base materials that can pass while the visible scene drifts.
- Album-drop physics: discoveries should feel collected, not emitted as decoration. Shake or album flick produces one short shallow flight, impact, small rebound, deterministic fan slot, and delayed contact shadow; the motion stops at a floor-safe pose clear of the controls, four-card replay preserves order, and reduced motion goes directly to the same settled state. Album sleeves, revealed song cards, and their contact shadows must settle in one room-floor coordinate system; reparent them or transform the pose before animation rather than applying room coordinates inside a translated desk group. Validate final bounds from the rendered hierarchy, and check both control clearance and pairwise edge exposure so a technically safe fan cannot collapse into one slab. Widen later fan rows only enough to reveal distinct card edges, then pull the control-side card inward to preserve a deliberate safety gap rather than scattering the collection. After a swap, the camera returns to the full room before another sleeve can be selected so visible targets and raycasts stay aligned.
- Touch-native record controls: a preview that reveals play or navigation must also make those controls hit-testable. Preview/vinyl state enables the controls for touch, hover/focus keeps the desktop cue, neutral portrait space still accepts shaking, and keyboard activation plus Escape recovery remain equivalent paths.
- Material truth over simulated detail: color gradients are not height data. The room floor uses a rough color texture, lighting, and contact shadows without recycling its sRGB albedo as a bump map; cliff/wood/paper contrast must stay legible in light and dark before adding heavier assets or shaders.
- Coffee-ring hierarchy: the stain should connect the two proof slips without becoming the first thing a visitor sees, so its scale and opacity stay below the artifact titles in light and dark themes.
- Project-preview feedback: FLIP remains the projects index's only layout motion because it preserves card identity while one preview expands. One cancelable clock measures current visible bounds, translates cards only, clips the newly opening surface without scaling its contents, clears finished animation objects, and performs at most one post-settle visibility correction. Rapid retargeting cancels the old clock; keyboard focus advances only if the visitor has not moved it, while dismissal restores a focused hidden control to the trigger before hiding it. Keep primary and close actions at least 44 pixels, retain one quiet collapsed-card hover lift, and apply the same final state immediately under reduced motion.
- Explicit-anchor arrival: long CV, project, and blog pages briefly mark and focus the destination heading only after an explicit in-page choice, so a large viewport jump has a perceptible ending. A new choice interrupts the old cue, ordinary scrolling never steals focus, and reduced motion uses the same short-lived underline as a static state.
- Recovery-route restraint: error and unlisted maintainer routes need identity plus a few truthful next steps, not an automatic redirect or decorative animation. Keep the recovery choices native, keyboard-visible, and specific to the visitor's likely intent.
- Chronological-route reveal: news and archive entries use the same short reveal contract as other evidence lists because their order is part of the reading structure; the effect runs once on entry, does not alter order or density, and becomes immediately visible under reduced motion.
- Secret fruit checkpoint: because every offered fruit is valid, the response confirms the chosen fruit instead of pretending there was one correct guess. The modal contains keyboard focus, Escape and backdrop closing cancel pending navigation, and focus returns to the dog so the playful gate still has a clear recovery path.
- Secret direct-entry state: a visitor who reaches the locked URL gets a real page heading and a compact, quiet route card that explains where the checkpoint lives and offers one return action; it should feel intentional without exposing or visually competing with the unlocked experience.
- Secret-session recovery: a valid fruit pass lasts for the current browser tab session so refresh and back navigation do not unexpectedly relock the route. Invalid or legacy passes are removed, and a new session still begins locked.
- Precise-location consent: the secret map may reuse browser coordinates only when geolocation permission is already granted. A prompt or unknown state stays approximate and offers an explicit `use precise location` action; denial remains legible and retryable.
- Mobile publication evidence order: on narrow phones, the filter and accepted-paper list precede the supporting Scholar lens so visitors reach the primary evidence before the secondary dashboard; desktop keeps the side-by-side analytical relationship.
- Long-CV navigation: the mobile CV keeps a compact native `Sections` control near the viewport edge because the desktop rail disappears across a very long document; it starts collapsed, exposes real heading anchors, closes after selection, and does not replace normal scrolling.
- Archive date economy: year archives let the page heading carry the year and show only month and day in each row. Tag and category archives retain the full date because they mix years.
- Paginated-blog priority: pinned `Start here` notes appear only on page one. Later pages begin with the older writing visitors explicitly paged toward instead of repeating the homepage orientation card.

## Maintenance And CI

- Formatter drift is design debt. Pin formatter versions locally and in CI so the same file does not pass on one machine and fail on GitHub.
- Treat generated or vendored third-party bundles as dependencies. Prefer excluding them from project-specific static analysis over hand-editing minified or generated code.
- If demo content exists only to show theme features, unpublish it from the public portfolio until it becomes part of Sirui's real story.
- Keep visual QA in three explicit lanes: `test:visual:iterate` for one fast screenshot, `test:visual:checkpoint` for explicit affected routes, and `test:visual` for release. Never make the fastest lane silently start a Jekyll server or expand to the full route matrix.
