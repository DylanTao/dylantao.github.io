# Website Design Heuristics

Use this file as the shared design memory for future homepage and portfolio refinements. The goal is a personal academic site that feels thoughtful, alive, and readable without becoming a corporate product site or a visual demo reel.

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

## Navigation

- Keep the global nav simple.
- Use in-page navigation only when it helps a reader understand the story structure.
- Desktop can support a compact story rail; mobile should stay clean and linear.
- Anchor links must land with enough top spacing below the fixed nav.
- Active navigation state should match the section currently being read.

## Content

- Keep Sirui's voice warm and specific.
- Avoid generic AI/design language unless it is tied to a concrete research question or project.
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

## Page Archetypes

- Homepage: editorial thesis and routing hub. It should explain the intellectual thread and send people to work, papers, writing, student info, or contact.
- Projects: evidence surface. Each card should show artifact, problem, venue/status, and where to click without requiring the visitor to parse a paragraph.
- Project detail: case study. Lead with the research question, contribution, artifact preview, venue, and links before long author blocks or implementation detail.
- Publications: bibliography with orientation. Keep the citation list authoritative, but help readers find selected/current work quickly.
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

## Process Artifacts

- A project page or blog post about the website should teach the design process, not just display screenshots.
- Show before/after evidence, name the critique loop, and explain what changed because of taste, not just because it was possible.
- Process writing should be reusable by students: include the heuristics, prompts, constraints, and reflective-practice lessons that helped the work improve.
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
