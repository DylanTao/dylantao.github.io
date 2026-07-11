# Website Design Heuristics

Use this file as the shared design memory for future homepage and portfolio refinements. The goal is a personal academic site that feels thoughtful, alive, and readable without becoming a corporate product site or a visual demo reel.

Agent-facing Codex overlays live in `.codex/skills/website-design-critique/SKILL.md`, `.codex/skills/portfolio-writing-voice/SKILL.md`, and `.codex/skills/tacit-knowledge-to-skill/SKILL.md`. This file remains the canonical human-readable, copy-pastable source; skills should point here by heading instead of duplicating the full heuristics.

## Decision Order

When two heuristics compete, protect the earlier concern first:

1. Research meaning, factual integrity, source credit, accessibility, and a working route.
2. First-glance comprehension: who Sirui is, what the work asks, why it matters, and where to go next.
3. Proof proximity, reading order, responsive layout, and legibility.
4. Discoverable interaction state, bounded motion, and clear recovery paths.
5. Materiality, atmosphere, personality, and delight.

A more expressive result is not better if it weakens an earlier concern. Treat `must` and `never` rules as contracts; treat named visual references and opportunities as taste guidance that still needs rendered evidence.

## Agent Quick Index

| Task                                 | Start with these headings                                                                                                             | Agent overlay                                                   |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| Sitewide or homepage critique        | Decision Order; First-Glance Story; Visual Hierarchy; Accessibility And Quality Checks; Screenshot Critique Ritual; Responsive Layout | `$website-design-critique`                                      |
| Blog, project, or case-study writing | Decision Order; Content; Page Archetypes; Blog Voice; Conservative Inspiration Boundaries; Process Artifacts                          | `$portfolio-writing-voice`                                      |
| Homepage 2D/3D desk scene            | Decision Order; Motion; Playful Portfolio Lessons; Research Desk Materiality; Responsive Layout                                       | `$homepage-desk-scene` plus `docs/homepage-desk-scene-brief.md` |
| Recording a durable lesson           | Decision Order; the affected topic heading; Maintenance And CI                                                                        | `$tacit-knowledge-to-skill`                                     |

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
- Pinned content is a route into the work, not a reason to remove that work from the chronological archive.
- Line breaks are part of hierarchy. If a phrase leaves one orphan word on a line, adjust width, type size, or copy before accepting the wrap.

## Color

- Orange is the primary action and identity accent.
- Mint and sky should be semantic highlights, used sparingly for contrast or a specific idea.
- Neutral surfaces should carry most of the layout.
- Avoid a page that reads as all orange, all pastel, all purple, or all gradient.
- If color does not communicate hierarchy, state, or meaning, remove it.
- Colored ink should mean action, active state, status, or a deliberate semantic grouping. Do not use a tinted card because a section feels empty.
- The global time-of-day themes should change atmosphere without changing the research story: morning is gentle, noon is clearest, afternoon is warmer and more exploratory, evening is quiet and dark.
- Theme palettes need hue variety and contrast, not four versions of the same orange wash.
- Time-of-day themes should default from the visitor's local time. Manual changes can be remembered within the current session, then return to the time-based rule on a future visit.
- If a page stays open across a time boundary, automatic theme changes are allowed only when the visitor has not manually picked a theme in that session.
- Theme backgrounds should stay clean. Use pastel atmosphere as a soft field, not as muddy color spread across every surface.
- In dark mode, keep orange bright by role and tone instead of darkening the same hue into brown: use a clear tangerine primary, a separate on-primary text color, restrained primary-container tints, and neutral surface containers.

## Project Images

- Research teaser figures must remain inspectable.
- Do not crop diagrams or teaser figures into decorative ratios.
- Use `object-fit: contain` for project previews unless the source image is clearly photographic and safe to crop.
- Use clean white preview wells for figures so diagram backgrounds remain legible.
- If a teaser is unusually wide or tall, add an image aspect hint in page frontmatter instead of forcing every project into the same crop.

## Motion

- Motion should explain the page, not decorate it.
- Good motion: section reveal, active rail state, hover feedback, and small transitions that show "this is clickable."
- Bad motion: constant ambient movement, unrelated loops, or effects that compete with reading.
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
- Content polish must preserve research meaning. A tighter phrase is worse if it narrows the actual claim, erases scope, or turns a thesis into a UI slogan.
- The AI in Design 2026 report is useful as context: it frames AI as changing tools, craft, and teams. Borrow the questions, not the corporate tone.
- A compact influence note can credit Katie Dill and AI in Design 2026, including the line: "AI is sparking a creative renaissance in design."
- Keep the main page centered on Sirui's work, not on external inspiration.

## Accessibility And Quality Checks

- Check light mode, dark mode, mobile, tablet, and desktop.
- Check keyboard navigation and visible focus.
- Check that text does not overlap cards, nav, footer, or the back-to-top button.
- Check that mobile has no horizontal overflow.
- Check that colors have enough contrast, especially orange text on light backgrounds and nav text in dark mode.
- Check that reduced-motion users can still see all content.

## Screenshot Critique Ritual

For each meaningful homepage iteration:

1. Capture desktop, tablet, and mobile screenshots.
2. Read the page as a rushed research peer.
3. Read it as a prospective student.
4. Read it as a returning collaborator.
5. Mark anything that is visually loud but not meaningful.
6. Mark anything important that is hard to notice.
7. Revise until the page is clearer, not merely prettier.

For sitewide passes:

1. Keep a temporary critique scratchpad while working, then delete it before handoff.
2. Audit each public route at desktop, laptop, tablet, and narrow mobile widths.
3. Read each page through four lenses: rushed research peer, prospective student, interested non-specialist, and returning collaborator.
4. Treat the page as a reflective practice artifact: make a change, observe what it clarifies or hides, then revise.
5. Move durable lessons back into this file so future sessions start smarter.

## Acceptance Evidence

- Compare the same route, viewport, theme, and interaction state before and after the change.
- Name the visitor problem and show how the result improves comprehension, proof proximity, reading, state clarity, or recovery.
- For meaningful visual work, inspect 1440x1000, 1280x800, 768x1024, and 390x1000 rather than extrapolating from one desktop screenshot.
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
- Test 1440x1000, 1280x800, 768x1024, and 390x1000 before calling a visual pass done.

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
- Research grounding: object constancy and simple staging from [Jeffrey Heer and George Robertson](https://idl.cs.washington.edu/files/2007-AnimatedTransitions-InfoVis.pdf); narrative checkpoints from [Edward Segel and Jeffrey Heer](https://idl.cs.washington.edu/files/2010-Narrative-InfoVis.pdf); animation-state recovery from [CMU DIG's Counterpoint](https://dig.cmu.edu/publications/2024-counterpoint.html); accessible alternatives from [Chartability](https://www.frank.computer/chartability/). These are principle-level influences; no source assets, layouts, or code are copied.

Current accepted intent record:

- Research-motion kinetic response: the existing particles did not make local engagement or a mode change easy to perceive. Pointer proximity and explicit mode selection now briefly increase travel speed and trail clarity to show attention moving through the selected research loop; the field settles when engagement stops, pauses offscreen or in a hidden tab, keeps a stable particle count, and becomes a still composition under reduced motion.
- Desk tally wording: compact abbreviations made provenance harder to parse, so the in-scene note uses only explicit `commits` and `tokens`; it does not count up or imply live activity.
- Coffee-ring hierarchy: the stain should connect the two proof slips without becoming the first thing a visitor sees, so its scale and opacity stay below the artifact titles in light and dark themes.

## Maintenance And CI

- Formatter drift is design debt. Pin formatter versions locally and in CI so the same file does not pass on one machine and fail on GitHub.
- Treat generated or vendored third-party bundles as dependencies. Prefer excluding them from project-specific static analysis over hand-editing minified or generated code.
- If demo content exists only to show theme features, unpublish it from the public portfolio until it becomes part of Sirui's real story.
