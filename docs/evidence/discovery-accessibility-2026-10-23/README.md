# Discovery and CV accessibility: October 23, 2026

The visitor task is to find Sirui's work, understand what it claims, and reach a usable current CV. This pass preserves the portfolio's first-person writing and its research facts. It changes metadata, format links, CV semantics/navigation/print, browser measurements, and the existing design/writing skills. It introduces no new promotional landing pages or scene changes.

## Observations and decisions

The baseline build had syntactically valid JSON-LD but assigned `BlogPosting` to 18 pages for 12 real posts: year archives, paginated indexes, and a separate globe page were included by a URL substring rule. Project indexes, technical records, and fun projects could also claim `Research Publication`. A homepage `SearchAction` led to a nonexistent `/search?q=...` route. The Pip Human/AI switch derived `#project-p` from its human URL even though the stable catalog identifier is `pip`.

Use collection membership and the canonical project catalog instead of guessing from URL shapes. Keep unknown project dates absent. Remove the unsupported search action. Give the CV an accurate search summary and an `AboutPage` linked to the existing Person identifier, plus its current JSON alternative. Emit the legitimate Google verification token already configured; this does not establish Search Console account access or indexing.

The baseline CV was readable on screen, but JavaScript generated duplicate IDs, its section navigation was empty without JavaScript, and dates/summaries inflated the heading outline. The current web/JSON CV had also moved beyond the manually maintained July PDF. Preserve the factual content and visible voice while fixing document structure, native section links, keyboard arrival, and print. Label the PDF snapshot in each discovery surface.

The coordinator's no-JavaScript screenshot exposed an empty desktop Sections rail after the first checkpoint. Comparing the compact-navigation breakpoint with the global sidebar breakpoint also found a tablet-width gap. The follow-up emits the same native section list in the desktop rail, makes its data context self-contained, and exposes the compact control through the full width range where the rail is hidden. Acceptance now follows a real section link without JavaScript on desktop and tablet as well as phone. This is a second observed correction, not evidence that the first passing test covered every access state.

The browser metrics code measured the wrong load interval and failed to report scroll milestones reliably. Navigation timing now uses completed load from navigation start; crossed scroll thresholds are numeric and reported once. These measurements describe browser behavior, not comprehension or popularity.

## Skill changes

[Reflective Practice](../../../WEBSITE_DESIGN_HEURISTICS.md#reflective-practice) records the reusable method: separate observation from interpretation, choose an observable visitor benefit, inspect the result during the work, and retain the outcome, uncertainty, and next decision. The existing portfolio-writing, website-design-critique, and tacit-knowledge skills route to that human source. They now cover faithful discovery summaries, document semantics, and meaningful outcome checks. They remain concise overlays rather than copies of the heuristics.

[Search and AI discovery](../../SEO.md) replaces the generic guide's ranking/citation promises with the actual source contracts, verification commands, crawler distinction, and measurement plan. The technical fixes support access and truthful interpretation. Search ranking and recommendation frequency remain unmeasured without authenticated reporting over time.

## Verification

The integrated candidate passes:

- **257 Python tests** and **606 JavaScript tests**; seven existing native-GL cases skip intentionally (613 JavaScript cases total).
- **16 discovery fixtures**, including both baseurls and invalid cross-projections. The previous generated build fails the new CI entrypoint at its false archive `BlogPosting`. The 11 browser-metrics cases pass; the old metrics implementation fails nine.
- Production Jekyll builds with `/al-folio` and an empty baseurl, followed by the generated publication/discovery validator on each. Final build wall times were 147.094 and 125.797 seconds. All 366 existing responsive image variants are present; no images were omitted. These are warm-cache builds, not proof of cold Windows ImageMagick conversion.
- A **16-case checkpoint** for CV, AI index, and Pip at four viewports with light/dark captures. After the desktop/tablet correction, **eight final CV cases** pass, including real keyboard/native navigation with and without JavaScript, unique IDs, heading levels, contact semantics, print-media content preservation, and overflow/console checks. Native desktop and tablet arrival images were inspected directly.
- Scoped Prettier, style contract, diff checks, all three skill validators, and the override audit. Canonical LF hashes agree for all ten changed overrides; untouched checkout line-ending advisories were not bulk-accepted.

The final generated build has 12 `BlogPosting` records for the 12 actual writing entries and 22 project `CreativeWork` records: six research projects, fifteen website experiments, and one personal project. Archives, indexes, and technical records no longer claim those authored-document types. Both source resume JSON files remain byte-identical; generated JSON is minified but its parsed values agree. The public PDF and factual CV text are unchanged. Starter Einstein CV output is absent from deployment.

The independent skill check used frozen baseline source and raw audit artifacts without this pass's proposed answers. It produced a concrete proposal that preserved the existing writing and credit, diagnosed the semantic/native-navigation problems, and separated technical acceptance from search outcomes. Its scoped proposal and reproducible source evidence are retained locally under `.jekyll-cache/skill-forward-check/`; it did not publish or modify tracked files.

The [first candidate](cv-native-desktop-before.png) and [corrected candidate](cv-native-desktop-after.png) show the same 1440 ? 1000 light CV state without JavaScript. The later image exposes all sixteen section links. Actual current-web print preview was also inspected; the separately maintained four-page PDF was retained.

Exact-SHA CI, Pages, and live proof belong to the release receipt after push; these local results do not imply that a deployment or search improvement has already occurred.

## Remaining boundaries

- The manual July CV PDF is retained and explicitly dated. Its native editable source is absent from this repository; a future native refresh must reconcile current submission statuses and citation snapshots and preserve Sirui's control over the unpublished manuscript's placeholder title. The current web CV and its print layout provide the current record.
- No authenticated Search Console/Bing/analytics report was used in this pass. Establish comparable baseline and follow-up periods before claiming a visibility increase. Public crawler access and metadata can be verified independently.
- Moving-scene TAA and trained representation replacements retain their existing implementation gates in the [October handoff](../../october-2026-handoff.md). This discovery pass does not relabel the static rendering studies as those implementations.
