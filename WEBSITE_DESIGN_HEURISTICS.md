# Website Design Heuristics

Use this file as the shared design memory for future homepage and portfolio refinements. The goal is a personal academic site that feels thoughtful, alive, and readable without becoming a corporate product site or a visual demo reel.

## First-Glance Story

- A rushed visitor should learn, within 15-30 seconds: who Sirui is, what problem space he studies, what he has built, why it matters, and where to click next.
- Lead with the research thesis, not with a long biography.
- Every section should answer one visitor question:
  - Start: Who is this?
  - Taste: What is the intellectual thread?
  - Motion: How do Sirui's research loops feel as an interaction?
  - Focus: What are the research areas?
  - Work: What concrete artifacts prove it?
  - Updates: What is active now?
  - Students: How can someone work with Sirui?
  - Connect: How can someone follow up?

## Visual Hierarchy

- One dominant headline per viewport is enough.
- Use section labels for scanning, but keep them quiet and consistent.
- Prefer fewer, stronger CTAs over many equal buttons.
- Put proof close to claims: projects, publications, venue labels, and updates should appear near the research story they support.
- Use whitespace to clarify grouping, not to create empty drama.

## Color

- Orange is the primary action and identity accent.
- Mint and sky should be semantic highlights, used sparingly for contrast or a specific idea.
- Neutral surfaces should carry most of the layout.
- Avoid a page that reads as all orange, all pastel, all purple, or all gradient.
- If color does not communicate hierarchy, state, or meaning, remove it.
- The global time-of-day themes should change atmosphere without changing the research story: morning is gentle, noon is clearest, afternoon is warmer and more exploratory, evening is quiet and dark.
- Theme palettes need hue variety and contrast, not four versions of the same orange wash.

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
- Animation should make Sirui feel thoughtful and dynamic, not flashy.
- Interactive research motion should map to an idea: design means option exploration, evaluate means evidence and traces, situated means context-aware assistance.
- Autoplay is acceptable only when it is slow, pausable by leaving the viewport/tab, and visually secondary to the words.

## Navigation

- Keep the global nav simple.
- Use in-page navigation only when it helps a reader understand the story structure.
- Desktop can support a compact story rail; mobile should stay clean and linear.
- Anchor links must land with enough top spacing below the fixed nav.
- Active navigation state should match the section currently being read.

## Content

- Keep Sirui's voice warm and specific.
- Avoid generic AI/design language unless it is tied to a concrete research question or project.
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
- Let repeated components carry consistency; reserve custom pages for genuinely different reading tasks.

## Responsive Layout

- Design the first viewport at multiple shapes, not just one width.
- On mobile, the first useful explanation should appear before long media, author grids, or metadata blocks.
- Fixed-format content needs explicit dimensions or aspect ratios so cards do not jump or crop meaningful diagrams.
- If a footer, floating button, or nav competes with reading on mobile, reduce its footprint or move it out of the way.
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

## Conservative Inspiration Boundaries

- Stripe is useful for hierarchy, modular proof cards, CTA restraint, and strong sequencing.
- Do not copy Stripe's company-site goals, heavy sales posture, or brand spectacle.
- AI in Design 2026 is useful for framing the moment: infinite output, craft, taste, tool fluency, role blur, and messy collaboration.
- The site should remain a personal academic portfolio with research credibility first.

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
- Mouse movement may bend or separate the field, but it should never make text harder to read or turn the section into a toy.
- Reduced-motion mode should render a still composition for the selected mode, not hide the idea.
- Stop animation when offscreen or when the tab is hidden.
