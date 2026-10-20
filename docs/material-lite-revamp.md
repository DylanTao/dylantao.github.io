# Material-Lite Revamp Notes

This site keeps its al-folio academic/editorial identity while borrowing a small Material 3-inspired design grammar. It is not a Material UI implementation, and it should not grow into a framework layer.

## Design Intent

- Orange is the source color for identity, primary actions, active states, and the ST brand mark.
- Warm paper, sandstone, sky, mint, and coastal navy remain supporting atmosphere rather than competing accents.
- Surfaces should feel tactile through shape, tonal fills, focus rings, and motion, not through shadows, glass or glossy gradients (see the 2026-10 refresh below).
- Dense academic pages should stay utilitarian. Publications, CV, and long case studies need scanning clarity before decoration.
- Motion should explain state: hover means clickable, focus means keyboard location, and reduced-motion users should lose motion without losing content.

## Main Files

- `_sass/_material-lite.scss`: shared shape, surface-container, state-layer, focus, chrome-glass and motion tokens.
- `_sass/_glass.scss`: flat content surfaces (cards, panels, chips, buttons, decks) and the `chrome-glass` mixin for the floating layer; `assets/js/glass-motion.mjs` drives the hover light, lift and press.
- `_sass/_springs.scss` and `assets/js/site-motion.mjs`: the springs, including the `morph` spring for presses and indicators.
- `_sass/_themes.scss`: four time-of-day palettes. Keep morning, noon, afternoon, and evening visually distinct.
- `_sass/_components.scss`, `_sass/_publications.scss`, `_sass/_blog.scss`, `_sass/_utilities.scss`: broad card, chip, button, and surface usage.
- `_sass/_navbar.scss`, `_sass/_home.scss`, `_sass/_layout.scss`, `_sass/_cv.scss`: global chrome and page-specific polish.
- `_includes/brand-orange.liquid`, `_sass/_brand-orange.scss`, `assets/js/brand-orange.js`: procedural 2D orange mark.

## Token Use

Prefer these tokens before adding one-off values:

```scss
border-radius: var(--md-lite-radius-md);
box-shadow: var(--md-lite-elevation-1);
background: var(--md-lite-surface-tonal);
outline: var(--md-lite-focus-ring);
box-shadow: var(--md-lite-focus-shadow);
```

Use the filled action for the one primary action in a local cluster. Use tonal surfaces for secondary actions, chips, and quiet controls. Avoid turning every repeated item orange; neutral surfaces should carry most of the page.

## 2026-10 design language refresh

Dated 2026-10-19. Sirui's review of the October 18 glass pass: the panels and buttons felt heavy, "glass-like effect etc was a type in 2017 18", some 3D effects felt old, the icons stale, and the transitions like "a silly powerpoint animation". Apple and Google have both moved on. Their current systems agree on the direction, and this section turns it into rules for this site.

### Where the field is (checked 2026-10-19)

- **Apple Liquid Glass** (WWDC25 [Meet Liquid Glass](https://developer.apple.com/videos/play/wwdc2025/219/) and [Get to know the new design system](https://developer.apple.com/videos/play/wwdc2025/356/); [HIG Materials](https://developer.apple.com/design/human-interface-guidelines/materials)). Glass is a lensing material "best reserved for the navigation layer that floats above the content". Apple says to avoid glass in the content layer and to "always avoid glass on glass"; elements that sit on glass use fills and vibrancy. Corners are fixed, capsules (half the height) or concentric (the parent's radius minus the padding). A menu grows out of the button that opens it, and soft scroll-edge effects replace hard dividers under floating bars. Reduce Transparency makes glass frostier, Increase Contrast turns it black or white with a border, and Reduce Motion removes the elastic behaviour. Sliders and toggles look like glass only while they are being used.
- **Apple, WWDC26** ([session 102](https://developer.apple.com/videos/play/wwdc2026/102/)). The glass now diffuses busy content more, with "a darkened edge along with brighter specular highlights". A Settings slider runs from clear to fully tinted. Legibility won.
- **Material 3 Expressive** (May 2025; [research](https://design.google/library/expressive-material-design-google-research): 46 studies, more than 18,000 participants, key elements found up to four times faster). Surfaces are separated by [tonal difference, with shadows used sparingly](https://m3.material.io/styles/elevation/applying-elevation). State layers lay the content colour over a fill at 8% (hover), 10% (focus and press) and 16% (drag). Buttons are round or square, and their [shape morphs when pressed](https://m3.material.io/components/buttons/overview) (a small round button squares to 8 dp). The [corner scale](https://m3.material.io/styles/shape/corner-radius-scale) is 0, 4, 8, 12, 16, 20, 28, 32 and 48 dp, plus full, and nested corners follow outer radius minus padding. [Physics springs replace easing curves](https://m3.material.io/styles/motion/overview/how-it-works). Spatial springs (position, size, corners) may overshoot; effects springs (colour, opacity) are critically damped and never do. Connected button groups replace segmented buttons. Google I/O 2026 added an 8 dp spacing scale; Material Web is in maintenance mode, so a website writes this grammar in its own CSS.
- **What replaced the 2017–2020 trends.** Frosted cards everywhere gave way to glass as one functional floating layer. Soft extruded shadows (neumorphism, which [NN/g](https://www.nngroup.com/articles/glassmorphism/) faults for low contrast) gave way to flat tonal containment. Glossy gradients gave way to hierarchy from layout, grouping, colour, size and shape. Fixed easing curves gave way to springs and shape morphs.

### Rules for this site

1. **Two layers.** The content layer is flat: cards, panels, chips and in-page controls are tonal fills with no grain, sheen, gradient boxes, double borders, glossy highlights or outer glows. Hierarchy comes from type, spacing, tone and shape. Only chrome that floats above content (the navbar, the theme menu, the back-to-top button, the search palette and the projects deck trail) is translucent: a thin, saturated blur with a bright specular top edge, a slightly darker lower edge and concentric corners. Nothing translucent sits on another translucent layer; a control on the navbar is a tonal fill.
2. **Tonal surfaces.** A resting card is `--md-lite-surface-container`. A hovered card deepens one state-layer step (`--surface-card-hover`). An open card's story sits on `--md-lite-surface-container-lowest`, white stock in the light themes. Figures keep white stock in every theme. One hairline (`--md-lite-outline-variant`) is allowed where a tone cannot draw an edge, such as between rows of a list.
3. **Shape.** Use the scale: `--md-lite-shape-xs` 4 px, `-sm` 8 px, `-md` 12 px, `-lg` 16 px, `-xl` 28 px and `-full`. Cards are 16 px. Anything inset in a card takes the card's radius minus the inset (a picture inset 8 px is 8 px). Chips are 8 px, not pills.
4. **Actions.** Each panel gets one primary action. Filled: the theme's pastel fill (`--md-lite-filled` and `--md-lite-on-filled`, contrast-tested in all four themes). Tonal: the primary container, for secondary actions and selection. Text buttons are for the rest. Buttons are flat, without shadows or gloss. A press lays a 10% state layer of the ink over the fill and morphs the corners from round to 8 px on the morph spring, with a slight scale. Orange stays the identity colour (the fruit and the rare warm detail it means); filled actions use the time-of-day fill.
5. **Elevation.** Content has no resting shadow. A card lifted under a pointer earns one soft shadow (`--surface-lift-shadow`) because, for that moment, it floats. Floating chrome keeps its glass shadow.
6. **The current item.** One active-state language everywhere: a tonal indicator (`--md-lite-tonal`) behind the current page, the current format (Human or AI), the current deck level and the selected segment of a control.
7. **Motion.** Springs from `_sass/_springs.scss` and `assets/js/site-motion.mjs`, held in step by a test. Spatial changes (position, size, corners, indicators) use a spring and may overshoot. Colour and opacity use a plain ease, because an effects spring never bounces. The new `morph` spring (damping ratio 0.6, period 0.222 s, settling in 0.41 s with 9.4% overshoot) is Material 3 Expressive's fast spatial spring. It is for shapes answering a touch: a press, a stretching indicator, a toggle's knob. Hover lights and lifts; it never tilts.
8. **Accessibility.** Reduced transparency and more contrast make chrome solid through the tokens, so nothing opts in twice. More contrast also draws hairline edges on cards. Forced colours use system colours. Reduced motion keeps every colour change, drops corner morphs and lifts, and shows content at once.

### Tokens

```scss
// _sass/_material-lite.scss
--md-lite-shape-xs | -sm | -md | -lg | -xl | -full;            // 4 8 12 16 28 999px
--md-lite-surface;                                              // the page
--md-lite-surface-container-lowest | -low | (none) | -high | -highest;
--md-lite-outline-variant;                                      // the one hairline
--md-lite-on-surface | -on-surface-variant | -ink-accent;       // body, quiet and accent words
--md-lite-filled | -on-filled | -tonal | -on-tonal;             // action fills and their inks
--md-lite-state-hover-opacity | -focus- | -press- | -drag-;    // 8% 10% 10% 16%
--md-lite-glass-tint | -tint-strong | -solid | -blur | -saturate | -specular | -shade | -rim | -shadow;
// _sass/_springs.scss and assets/js/site-motion.mjs
--spring-morph, --spring-morph-duration;                        // with confident, playful, layout, gentle
// _sass/_glass.scss
@mixin chrome-glass; @mixin tonal-surface;
@mixin md-button-filled | md-button-tonal | md-button-text; @mixin md-press-motion;
```

### Retired on 2026-10-19

These were removed: the feTurbulence paper grain, the card sheen and the blurred teaser behind each card (`--project-teaser`); candy-gradient buttons with outer glows; the few degrees of 3D tilt and the picture drift on hover; accent top rules and gradient washes on cards; the left-and-top-ruled story beats and the gradient "Intended outcome" box (now one labelled list); and uppercase monospace labels on cards. Deck sheets no longer rotate. They peek out below a deck as flat, narrowing layers, and only the feature deck still fans its hand of real thumbnails.

## Glass on cards (October 18, 2026, superseded)

The October 18 pass gave cards and their controls one frosted glass material: a tint, sheen, grain and blurred teaser, with candy buttons and a tilt toward the pointer. The 2026-10 refresh above replaced it on content surfaces. `_sass/_glass.scss` keeps its name and now holds the flat surfaces and the chrome-glass mixin; `git log -- _sass/_glass.scss` has the old material.

## Brand Mark

The navbar mark is an inline SVG with a no-JS SVG fallback. JavaScript varies the orange shape, size inside the fixed viewbox, rind gradient, peel pores, small navel/calyx details, leaves, and subtle pointer response on each page load. The home link owns the accessible label; the SVG remains decorative. Add `?orangeSeed=...` to a URL when a specific generated mark needs repeatable visual inspection.

Do not engrave `ST` into the fruit at navbar size. At roughly 32px, initials made the orange read like a glossy app icon instead of a crisp site mark. Prefer a flat 2D citrus silhouette with enough orange-specific anchors to avoid category drift: round or slightly oval body, dimpled rind, warm orange gradient, small calyx/navel cues, and optional green leaves.

Keep these behaviors intact:

- no layout shift when JavaScript loads;
- the orange silhouette remains readable in all four themes;
- leaf motion and pointer parallax stop under `prefers-reduced-motion: reduce`;
- clicking the logo still navigates home;
- no heavy animation or 3D dependency for the navbar mark.

## Verification

For visual changes, use Docker and screenshots before pushing:

```powershell
docker compose up -d
docker compose exec -T jekyll bundle exec jekyll build
curl.exe -fsS http://127.0.0.1:8080/ | Out-Null
```

Recommended screenshot coverage:

- home desktop and mobile;
- projects desktop and mobile, including a scrolled mobile card state;
- one project case page;
- publications in evening mode;
- blog and CV;
- navbar search focus;
- mobile nav open;
- logo in all four themes when touching brand files;
- reduced-motion and no-JS logo fallback when touching brand motion.

Run the repo checks that match the touched files:

```powershell
npm.cmd run lint:style-contract
npm.cmd run lint:prettier
bundle exec al-folio upgrade overrides audit
```
