# Material-Lite Revamp Notes

This site keeps its al-folio academic/editorial identity while borrowing a small Material 3-inspired design grammar. It is not a Material UI implementation, and it should not grow into a framework layer.

## Design Intent

- Orange is the source color for identity, primary actions, active states, and the ST brand mark.
- Warm paper, sandstone, sky, mint, and coastal navy remain supporting atmosphere rather than competing accents.
- Surfaces should feel tactile through shape, tonal fills, focus rings, and soft elevation, not through heavy shadows or glossy gradients.
- Dense academic pages should stay utilitarian. Publications, CV, and long case studies need scanning clarity before decoration.
- Motion should explain state: hover means clickable, focus means keyboard location, and reduced-motion users should lose motion without losing content.

## Main Files

- `_sass/_material-lite.scss`: shared radius, elevation, tonal-surface, state-layer, focus, and motion tokens.
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

Use filled orange for the primary action in a local cluster. Use tonal surfaces for secondary actions, chips, and quiet controls. Avoid turning every repeated item orange; neutral surfaces should carry most of the page.

## Glass (October 2026)

Cards and the controls that sit on them share one glass material, defined once in `_sass/_glass.scss`:

- `--glass-tint`, `--glass-tint-strong`, `--glass-tint-faint`: the theme's card colour at 74%, 88% and 46%.
- `--glass-sheen`, `--glass-grain`, `--glass-rim-top`, `--glass-edge`, `--glass-shadow`, `--glass-shadow-lifted`: the face of the glass. The grain is an SVG `feTurbulence` tile drawn by the browser.
- `--glass-vibrancy`, `--glass-vibrancy-filter`, `--glass-vibrancy-mask`: a card's own teaser, blurred and scaled behind its glass (`assets/js/glass-motion.mjs` sets `--project-teaser` from the picture the card already loaded). It fades toward the bottom, where the words are.
- `--glass-ink-soft`, `--glass-ink-accent`: secondary and accent words on glass, a step deeper than on paper so they keep 4.5:1 over a teaser in all four themes.
- Mixins: `glass-surface` (frosted, for chips, the deck trail and buttons that float over content), `glass-candy` (a filled primary control under a sheen), `glass-press-motion` (the press and its spring return), `glass-solid`.

Rules that keep it honest:

- The sheen, grain and highlight sit beneath a card's content; figures and thumbnails keep their original colour in every state.
- `backdrop-filter` is for small controls and the sticky trail only; a card's glass never re-reads what is behind it.
- Reduced transparency and more contrast get solid surfaces; forced colours get system colours. The refraction lens on the blog toggle is Chromium-only, behind the `data-liquid-glass` brand check.
- Filled orange is still for the primary action in a local cluster; the candy fill uses the theme's primary fill, not brand orange.

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
