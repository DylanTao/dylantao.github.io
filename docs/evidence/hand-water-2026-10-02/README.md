# Hand-driven bath water checkpoint

The previous served scene injected a 3 mm height pulse every three active seconds while both hands stayed still. Native animation sampling confirmed stationary wrists on all five soak clips. The new gesture lifts and skims one hand; the water receives the composed palm's measured horizontal velocity at its actual contact location.

The gesture is prescribed anatomical IK, with a smooth 18 cm sweep and a peak speed of approximately .130 m/s. The opposite hand and complete rest retain the native clip transforms. An initial 1.2-second rest follows the incoming mixer pose before freezing its anchor. This corrects a reproduced walk-to-soak crossfade defect that otherwise kept the palm approximately 49 mm beneath the surface. The settled skim is 8 mm below the displaced mean surface. Contacts below the native floor are excluded.

Five runtime rays measure the native stone bottom: approximately 2.880026 m beneath a 3.007513 m water surface, giving .127487 m bath depth. Both the shallow-water model and Three's existing refraction thickness now use that depth. Missing/nonflat receivers report an illustrative fallback. Independent CPU decoding of the actual Draco assets found the same bottom on 44 samples; hashes and the reproducible script are in the ignored review bundle.

The momentum kernel adapts [Chentanez and Müller, SCA 2010, section 2.3.2](https://matthias-research.github.io/pages/publications/hfFluid.pdf) with a compact Gaussian palm proxy and convex exponential face-velocity relaxation inside the existing fixed CFL substeps. It edits no heights directly, preserves volume through shared fluxes and leaves blocked faces zero. The coefficient and proxy dimensions are authored. This is original bounded one-way coupling; buoyancy, swept hand volume, vertical splash and caustics remain omitted. The detailed equation and source relationship are in [ONSEN-WATER.md](../../../assets/js/home-scene/ONSEN-WATER.md).

## Evidence

Local artifacts live under `.jekyll-cache/visual-qa/hand-water-review/`:

- `before-after.png`: actual comparable Docker renders. The after frame is 3.3 seconds into the shipped gesture, not generated concept art.
- `hand-water-motion.webm`: eight seconds of native RAF/WebGL capture. The raw canvas excludes the CSS vignette; no review-only motion amplitude is added.
- `desktop/` and `responsive/`: native contact, water-patch, conservation, pause, offscreen recovery and reduced-motion assertions at 1440, 1280, 768 and 390 px widths. The desktop run also delays the avatar's real request during a cold bath arrival.
- `webkit/`: a separate WebKit mobile-emulation engine check. This is not physical phone performance evidence.
- `receiver/`: native geometry/visibility audit and a bounded future caustic feasibility study. No caustic implementation is included in this checkpoint.
- `numerical-tests.log`: 20 focused CPU cases, including all five native rig streams, the arrival blend, force direction, rest, boundaries, positivity, conservation, cadence and recovery.

The 30/60/144 Hz actual-palm probe produced approximately 2.98–3.00 mm surface range at seven seconds, with RMS difference below 7.25 µm against 144 Hz and relative volume error below 6.1×10⁻¹⁵. A constant-contact probe follows bit-identical fixed-tick trajectories across those frame partitions. The served desktop frame at 3.3 seconds produced a 4.48 mm depth range, relative volume error −7.45×10⁻¹⁶ and a .887% changed-pixel ratio in the clear water patch. These are local model diagnostics, not validation of complete hand hydrodynamics.

The 166 Python repository checks, targeted formatting/style checks and the production `/al-folio` Docker build also pass. Public controls and existing shared album state are unchanged. Completed source is saved locally; deployment is outside this checkpoint.
