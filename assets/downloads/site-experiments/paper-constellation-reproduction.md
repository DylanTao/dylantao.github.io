# Reproducing the Paper List / Paper Constellation pattern

This guide describes how to add an optional relationship view to a publication page without weakening its bibliography, accessibility, or privacy boundaries.

## 1. Start with the authoritative record

Keep bibliographic facts in one canonical source. On this site, `_bibliography/papers.bib` owns titles, authors, venues, dates, and paper links. `_data/publication_lens.yml` owns display classifications, authorship roles, and volatile lifetime citation totals. The constellation data is an editorial overlay; it must not duplicate or override those facts.

The HTML order should be:

1. the canonical bibliography, visible by default;
2. the optional constellation, server-rendered but hidden by default;
3. a view switch that is itself hidden until JavaScript initializes.

With JavaScript disabled, the switch stays hidden and the full bibliography remains available.

## 2. Use a small deterministic overlay

Create one reviewed data file with these concepts:

- three stable threads with labels, summaries, and anchor coordinates;
- accepted-paper keys that must exactly match the canonical bibliography;
- explicit paper memberships such as `primary`, `bridge`, or `adjacent`;
- bounded x/y coordinates rather than runtime force simulation;
- a short, explicit edge list whose endpoints must resolve;
- anonymous future markers with only neutral IDs, size, thread, position, and allowlisted public receipts.

Validate every coordinate as an integer from 0 through 100. Validate every paper and edge endpoint against the canonical sources. Keeping geometry deterministic makes comparison, debugging, screenshots, and explanation easier.

## 3. Treat future work as a privacy schema

Do not store private names and then hide them with CSS. Never place private titles, collaborators, draft venues, descriptive hints, or codenames in source, comments, generated HTML, downloads, analytics, alt text, or commit messages.

Use neutral identifiers such as `future-major-01`. Render a question mark plus a coarse size and public research thread. If an external receipt is shown, resolve only an allowlisted public record already present elsewhere on the site.

Before release, inspect the YAML, Liquid, JavaScript, built HTML, download files, analytics calls, and outgoing commit messages. A screenshot that looks anonymous is not enough.

## 4. Project existing evidence instead of copying it

Let the publication filter remain the source of truth. Dispatch a small local event containing only accepted-paper keys when its role or format changes. The constellation should disable and remove filtered papers from the tab order while leaving their dimmed positions visible as context.

When someone previews or pins an accepted paper in the constellation, send its canonical key back to the existing citation lens. Do not create another citation table or fetch path. Clearing either surface should restore the shared neutral state.

No event needs future-work details, and no analytics event should carry them.

## 5. Make interaction equivalent across inputs

Desktop interaction:

- hover or focus previews immediate neighbors;
- click or Enter pins the paper and opens its detail;
- clicking the selected paper, using the clear control, or pressing Escape clears it;
- focus returns to the control that created the pinned state.

Narrow-screen interaction:

- replace the plotted map with ordered thread sections;
- keep accepted papers as real buttons;
- keep anonymous future markers noninteractive;
- preserve the same filter, detail, and Escape behavior.

For reduced motion, render the final map immediately, remove transitions, and keep every state change understandable through text, color, and focus—not animation alone.

## 6. Keep freshness claims precise

Lifetime citation totals and annual per-paper contribution bars may come from different snapshots. Name both dates separately, for example:

- `totals_last_synced`
- `yearly_snapshot_as_of`

The ordinary totals updater should update only the lifetime totals date. Do not imply that an older annual breakdown was refreshed at the same time.

## 7. Acceptance evidence

At minimum, verify:

- exactly five accepted-paper records project from the bibliography;
- exactly seven anonymous future records: five Design, two Situate; three major, four minor;
- only one future record exposes the two allowlisted public rejection tags;
- exactly nine valid edges;
- Paper List is the initial JavaScript state and the only visible no-JavaScript state;
- filtered nodes are disabled, have `tabindex=-1`, and are absent from the accessibility tree;
- hover, focus, Enter, click, clear, and Escape reach equivalent states;
- reduced motion reveals a stable final composition;
- no horizontal overflow or console error at 1440x1000, 1280x800, 768x1024, and 390x1000;
- light and dark themes preserve legibility;
- origin, citation-context, project, and download links resolve;
- the built HTML and outgoing changes contain no private future-work identity.

## 8. Credit the interaction lineage

This pattern adapts interaction principles from Nadieh Bremer's [Royal Constellations](https://royalconstellations.visualcinnamon.com/) and its [process story](https://www.datasketch.es/project/royal-constellations), shared with Sirui by [John Thompson](https://jrthomp.com/). It does not copy their data, visual assets, layout, code, or canvas implementation.
