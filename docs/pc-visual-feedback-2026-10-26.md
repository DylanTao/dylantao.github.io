# PC visual review, October 26, 2026

Sirui reviewed the local site on the RTX 3080 Ti PC after the takeover checkpoint. These requests extend the October handoff; they do not cancel branch recovery or its CI/live checks. His supplied screenshots are the before observations. Do not turn passing source or interaction tests into visual acceptance.

## Observed problems and ownership

- **Home scene:** an airborne-looking raccoon near the pavilion, gulls whose poses read as hovering, odd animal movement, angular terrain openings and unsupported-looking excavation edges. Inspect contact with the actual delivered support and motion over time. A single frame of an intentional flight does not settle the reported defect.
- **PC full screen:** severe softness and jagged detail on a 2K display. Sirui wants richer detail on this GPU and questioned excessive LOD. Preserve detail while measuring where time and memory go; assess WebGPU from the actual renderer and bottlenecks.
- **Cliff:** integrate the house into a convincing rocky La Jolla landform. The current broad brown bands and box-cut sections read as a dirt pile with carved holes. Preserve bearing rock, circulation and terrace support while improving the silhouette, erosion structure and material scale.
- **Footer:** improve water, reflections, underwater form and depth-dependent light transport. Improve the distant hills and houses from real reference photographs and existing geodata; scattered points alone do not provide convincing settlement geometry.
- **Header:** refine the orange-sun mark's execution while keeping the established identity and Inter. Eliminate the returned text distortion below the navbar. The latter is reproduced by the intentionally refracting `header#top::after` lip, backed by `liquid-glass.js`.

The sitewide worker owns header, brand and footer files in its separate worktree. The home worker is finishing the whiskey routine and its one necessary ottoman-placement correction. The coordinator owns home quality/resolution and wildlife diagnosis; native cliff edits are serialized after the whiskey source is handed back. No two writers change the canonical house source concurrently.

## Live quality observation

The actual Brave preview, with its existing `?perf=1` readout, identified the RTX 3080 Ti through ANGLE/D3D11. At a 2560 × 1303 CSS full-screen viewport, it was on **low**, drawing **1880 × 957** pixels. Its history recorded a standard-to-low decision from frame p50 50 ms, p75 50.1 ms and script 16 ms. That demotion is currently permanent for the session. Later wall-frame intervals were roughly 0.52–0.55 s while the reported GPU pass was about 10–22 ms. Those timer scopes differ; this observation does not prove the source of the long wall gaps.

The resolution governor tried a 0.6 factor twice against those gaps, saw no improvement and restored it. The desktop default profile nevertheless permits a 0.35 linear floor, and the low tier itself caps full screen at 1.8 MP. The repair must distinguish GPU work from frame pacing, permit measured recovery after temporary pressure and protect a useful desktop image-quality floor. Retain slow intervals in telemetry.

## Reference study

California State Parks photographs [090-P99076](https://www.parks.ca.gov/pages/657/images/090-P99076.jpg) and [090-P99072](https://www.parks.ca.gov/pages/657/images/090-P99072.jpg) were viewed locally. They show vertical erosion ribs, pale sandstone ledges, rounded hollows, irregular undercuts and scrub concentrated on soil shelves. They are visual references, not redistributed textures or claims that the authored house occupies that exact cliff. Local copies remain ignored under `.jekyll-cache/visual-qa/pc-fidelity-2026-10-26/references/`.

The [California State Parks geology description](https://www.parks.ca.gov/pages/980/files/12468_MND_Torrey%20Pines%20Utility%20Modernization_Draft_July%202019.pdf) distinguishes layered rock and light sandstone with rounded weathering hollows. The implementation should use those relationships at believable scales, rather than add uniform noise everywhere. Document borrowed lessons and source/license boundaries near the eventual review.

## Acceptance still required

Retain comparable 2K and 4K full-screen captures, actual GPU/backend and buffer sizes, motion and stable-rest states, and appropriate phone checks. Inspect animal support and complete movement, the real terrain opening silhouette, readable header text while scrolling and small-size brand rendering. For water, show the bottom/depth contribution and reflection/scattering comparisons at matched time and camera. Re-bake source-bound lighting and regenerate traced loading drawings after native inputs change. Keep claims bounded and leave unresolved items open with the failed attempt and next hypothesis.
