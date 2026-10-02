# Gym character framing and continuous orbit

The original gym arrival showed Sirui from behind. Native rig projections placed the camera 147–163° behind the authored forward direction across rest, pull-ups, dips and curls. The prior exercise pause screenshots also made the glasses and held weight difficult to read.

## Result

The gym now arrives from a front three-quarter angle with a 44° vertical perspective lens. Its target includes the rack, bench and exercising character. Other rooms, the overview, exterior and animal inspections retain their 38° lens. Lens changes settle with the camera and compose immediately during pause or reduced motion.

The wider orbit initially exposed a second defect: one native ArrowLeft press moved the camera 5.058 m because the existing clearance fallback pushed it behind the side wall. The gym now bounds each orbit ray before the wall and upstairs slab. Angle-dependent dollying preserves the visitor's requested zoom; turning back restores that zoom. The default view needs no fallback correction. The global fallback remains for room transitions.

The camera, target and clearance envelope are reproducible in `bin/coastal_furnishing.py` and `bin/coastal_camera.py`. No model rebuild is required for these metadata/runtime changes. Equipment facing, contact anchors, rigs, animations, public controls and approved homepage content remain intact.

## Evidence

The [checkpoint](checkpoint.json) records native framing, orbit continuity, source hashes, production matching and limits. Local images and reproduction scripts are retained under `.jekyll-cache/visual-qa/`:

- `gym-framing-review/comparison.png`: actual before/after exercise renders for remote review.
- `gym-framing-review/comparable-cycle.json`: equivalent steady activity phases under controlled clocks; baseline substitutes the previous manifest camera and final uses served source.
- `gym-framing-review/audit.mjs` and `projection-proof.json`: delivered GLB skeleton/animation projections across five identities, four clips and five key times, in desktop/mobile proportions. Meshes are explicitly disabled in this supporting probe.
- `gym-framing-review/dark-public-controls.png` and `dark-mobile.json`: actual dark mobile and system reduced-motion composition, with the authoring panel closed.
- `gym-clearance-reproduction/`: original failing native orbit jump, screenshot and coordinates.
- `gym-final-acceptance/` and `gym-final-webkit/`: corrected native exercise poses, orbit/zoom pixels, radius restoration and 38° reset on leaving the gym. The existing exterior/interior boundary case is included in the former directory.

Use the owned Docker preview at `http://127.0.0.1:8080` with `NO_WEBSERVER=1`; verify rebuilt source with `node bin/verify_character_preview.cjs`. The focused browser case matches `gym frames`; existing integration coverage matches `full exterior orbit`. The CPU camera regression fails against the original manifest's rear arrival and passes against the corrected view.

Four Chromium viewport cases and a WebKit phone-emulation case pass. Every case covers pull-ups, rest, dips and curls, a bounded orbit sweep, zoom pixels and destination lens reset. A return to the original angle restores radius 5.2 exactly. Paused orbit views stop requesting frames; the existing reduced-motion boundary test passes across all destinations. All 24 focused Node tests and 166 Python tests pass, along with formatting and the style contract. The final `/al-folio` production build completed in 63.846 seconds; the changed camera/controller modules and canonical manifest match source, Docker preview and production output. The override audit retains 80 existing overrides.

Native joint probes leave at least 11.6% horizontal and 12.5% top margin in the mobile framing samples. Actual Ghibli renders provide skin, hair, shading and furniture evidence; the skeleton figures alone do not prove mesh visibility. Gym equipment can still occlude parts of the body. These are controlled framing and continuity checks in desktop browser emulation, without a physical-phone, film-quality animation, or universal collision claim. Pending sitewide concepts remain available for Sirui's taste feedback.
