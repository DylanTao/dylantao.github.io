# Scholar Lens Reproduction Brief

Use this brief to add a dated citation-context layer beside your own canonical publication list.

## Source contract

- Keep titles, authors, venues, years, links, and identifiers in one canonical bibliography.
- Store volatile role, format, and citation fields in a separately dated overlay keyed to the bibliography.
- Distinguish lifetime-total freshness from any annual snapshot date.
- Never duplicate future work or placeholders into canonical publication outputs.

## Interaction pattern

1. Filter by a small number of meaningful dimensions such as authorship and format.
2. Let year bars expose the papers contributing to each annual total.
3. Hovering or focusing a paper highlights its citation chip, annual share, and list entry.
4. Keep the accepted-paper list server-rendered and authoritative when JavaScript is absent.

## Access and restraint

- Use radio buttons or another native single-choice control with visible labels.
- Make chart marks keyboard reachable and preserve a readable textual total.
- On mobile, put the publication list before the supporting lens.
- Treat citation counts as dated context, not impact rankings or claims of quality.

## Runtime evidence contract

- If you archive a current interaction state, record its source commit, capture date, source viewport, artifact crop, theme, browser, and exact interaction state.
- Let responsive evidence differ honestly: a desktop capture may show a linked row and sticky chart together, while a mobile capture should preserve the real list-first reading order rather than fabricate the desktop composition.

## Acceptance checks

- Every overlay key resolves to exactly one canonical paper.
- Totals and annual contributions state their actual freshness separately.
- Filter, hover, focus, keyboard, mobile order, dark mode, and no-JavaScript states work.
- A failed refresh keeps the previous dated snapshot rather than silently inventing current data.

## Copy-ready coding-agent prompt

> Add a compact citation lens beside my canonical publication list. Keep bibliographic facts in one source and volatile role, format, and citation data in a separately dated overlay keyed to it. Support authorship and format filters, year-to-paper highlighting, keyboard focus, mobile list-first order, and a complete no-JavaScript bibliography. Label lifetime and annual freshness truthfully. Do not turn citations into a leaderboard or duplicate publication facts into the visualization.

## Credit

Sirui's lens adapts the contextual-highlighting lesson of the [Google Scholar Author Highlighter](https://chromewebstore.google.com/detail/google-scholar-author-hig/ijmngekkpaccbbjimedfkjpigplaikah?hl=en), recommended by [Howard](https://howardhan.com/).
