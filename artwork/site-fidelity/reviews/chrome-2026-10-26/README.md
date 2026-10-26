# Header reading edge and orange sun, October 26

This PC checkpoint starts at `4b77a54d9cda04d81ed416f38a7d4d999970753e`. It addresses Sirui's report that text stretches beneath the fixed navbar, and his rejection of the current mark's execution. The orange-sun concept, Inter, public copy and home-link behavior remain.

The old header drew a ten-pixel refracting strip below the frosted bar. Native Chromium rendered the upper part of a passing article line stretched vertically. The new header removes that strip and its SVG displacement map. The normal frosted bar remains, as does the separate opt-in used by the blog's localized lens controls.

The mark uses one curved sea cut in a flat orange disk, a simpler leaf and the same geometry in the navbar and 16-pixel favicon. The glossy highlight, halo and stacked bands are removed. The ICO and home-screen PNG were rebuilt with `node bin/build_brand_icons.cjs`. This is a verified execution pass, not a claim that Sirui has approved its appearance.

## Rendered evidence

- `reading-before.png` and `reading-after.png` are actual article crops from the live-motion regression, with a real line passing beneath the fixed header. The final test fails the old source at a 4.79% shape difference and passes all eight new states with zero difference. The comparison permits only a whole-frame vertical translation of one device pixel for native mobile scroll settling; it cannot straighten locally stretched glyphs.
- `icon-16-comparison.png` displays the actual 16-pixel PNG entries extracted from the old and new ICO files, at native size and eight-times nearest-neighbor magnification on light and dark backgrounds.
- `navbar-desktop-light.png` and `navbar-phone-dark.png` are complete viewport captures from the blog route checkpoint. The phone image is a 390-pixel Chromium viewport on this PC, not a physical-phone result.
- `receipt.json` binds selected images and exact input bytes to the eight reading states. All page and model assets were available; no route-specific asset omissions were used.

The local `.jekyll-cache/visual-qa/site-fidelity-2026-10-26/` folder retains full logs, the failed baseline test, the first candidate attempt with one-pixel scroll settling, and two contact sheets inspected across all four widths and both themes. An early single-scroll probe also moved between captures; its raw ratio is not the acceptance result. The stable two-scroll regression above is the acceptance evidence.

## Checks

- Production Jekyll build with `/al-folio`: passed in 102.965 seconds.
- Python: 311 passed. Node: 801 passed, 7 skipped. Style contract and targeted Prettier: passed.
- Reading regression: 8 passed at 1440×1000, 1280×800, 768×1024 and 390×1000, each in light and dark, with native Chromium motion enabled and no fake clock.
- Scoped route checkpoint: 8 passed, covering blog index and research-skills article in both themes at those four widths; 16 rendered route/theme states were inspected.
- Exact `Human and AI formats keep stable, auditable route counterparts` case: passed. It now expects 23 projects and explicitly checks the new house-in-the-cliff record, human page, machine Markdown and reciprocal format targets.
- Override audit: the reviewed `_sass/_navbar.scss` override is acknowledged. Unrelated existing override drift is retained.

This is local verification on Windows Chromium/ANGLE/D3D11. The footer probe identifies the native RTX 3080 Ti backend, but this checkpoint makes no timing, physical-phone or cross-engine performance claim. Deployment and CI belong to the coordinator.
