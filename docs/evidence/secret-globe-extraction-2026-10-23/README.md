# Secret globe asset extraction

The hidden globe page contained roughly 6,700 lines of inline styles and script. This mechanical cleanup moves those rules and behavior into `assets/css/secret-globe.css` and `assets/js/secret-globe.js`, loaded only by that page. Seven escaped data attributes carry the existing Jekyll URLs/settings into the script. The encrypted payload, access checkpoint, opt-in location behavior, visible copy, and appearance are preserved.

Baseline: `9a8236b3337c6562aa516230bc741cd67e83c364`. Both builds use `/al-folio`; the isolated preview used port 4163. The captures use a fresh browser, a fixed October 23 clock, reduced motion, and a Los Angeles timezone-derived approximate location. They contain no real visitor history or precise location.

## Preservation

- [Source preservation](preservation.json): formatter-normalized original CSS and JavaScript match after the explicitly recorded transfer of Jekyll values. Page markup and encrypted payload are unchanged apart from the extraction/configuration wiring.
- Desktop and phone locked/unlocked DOM, text, geometry, computed backgrounds, canvas dimensions, and night-sky URL match the baseline. The four full-viewport image comparisons differ by 0.0093%–0.0383% of pixels at the comparison threshold; this is comparable-render evidence, not a claim of identical screenshots.
- [Asset scope](scope.json): the generated HTML references the new assets only from the hidden route. Its `noindex, nofollow` and sitemap exclusion remain.
- [SVG fragment check](svg-fragment.json): the fallback map's document-local pattern reference resolves identically after moving its rule to an external stylesheet. Native fallback captures are retained locally.

| State           | Desktop                                      | Phone                                       |
| --------------- | -------------------------------------------- | ------------------------------------------- |
| Locked before   | [baseline](baseline-fixed-locked-1440.png)   | [baseline](baseline-fixed-locked-390.png)   |
| Locked after    | [extracted](after-locked-1440.png)           | [extracted](after-locked-390.png)           |
| Unlocked before | [baseline](baseline-fixed-unlocked-1440.png) | [baseline](baseline-fixed-unlocked-390.png) |
| Unlocked after  | [extracted](after-unlocked-1440.png)         | [extracted](after-unlocked-390.png)         |

## Behavior and deployment styling

The existing `secret checkpoint tells the truth, contains focus, and survives a refresh` browser case passes in 12.7 seconds, including keyboard focus containment, real fruit selection, cancellation, navigation, explicit location consent, and refresh.

[Additional native browser checks](behavior.json) cover 1440×1000, 1280×800, 768×1024, and 390×1000. Real sun/moon/visitor clicks work; a real pointer drag changes 6.2%–11.5% of canvas pixels; refresh retains the pass; precise geolocation is requested only after the button is clicked. There is no horizontal overflow or runtime exception. With JavaScript disabled, the notice remains visible, the globe and encrypted-note region stay hidden, and no globe canvas starts. These checks do not claim usability-study evidence or a newly strengthened security boundary.

Moving inline rules into an asset exposes them to deployment's CSS purge. A targeted run with the current published PurgeCSS 8.0.0 initially removed [six selectors](purge-before.json), including dynamically created Leaflet controls. Adding only `^sirui-` to the existing standard and deep safelists preserves [all 271 rules byte-for-byte](purge.json). No keyframe or variable safelist expansion was needed.

Scoped Prettier, the style contract, JavaScript syntax, the production Jekyll build (135.98 seconds), generated publication/discovery validation, and `git diff --check` pass. Local scripts, full receipts, fallback/no-JavaScript captures, and four-width interaction captures remain under `.jekyll-cache/visual-qa/secret-globe-extraction/`; they are not part of the visitor flow.
