# Frozen v84 walkthrough ? 2026-10-28

This read-only review found three obstructed default room compositions. The Living room has a measured causal blocker: a hidden fireplace proxy marks a voxel grazed by the requested camera ray. The Private living and Onsen views also stop well short of their authored camera arms. This packet preserves the failing baseline; it does not accept the coordinator?s subsequent camera candidate.

No model, native source, runtime, manifest, cache, thresholds, canonical brief or public test registry was changed. Only this review directory is intended for integration.

## Findings to fix

| Priority | Reproduction                                                    | Observed result                                                                                                                                                                                                                                                                                           | Representative evidence                                                                                                                                                  |
| -------- | --------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| P1       | Full screen ? Explore the home ? Living room                    | Requested arm 5.8 m resolves to 0 m. Camera and target both become `[0.55, 0.42, 7.45]`; nearby black fireplace geometry dominates the frame. Waiting, requesting 12 real frames, Living ? Kitchen ? Living, and changing reduced motion to live motion preserve the failure at desktop and phone widths. | [Desktop](images/room-lounge-desktop.webp), [phone](images/living-default-phone.webp), [4K](images/living-default-4k.webp)                                               |
| P2       | Full screen ? Explore the home ? Private living                 | Requested arm 3.6 m resolves to 0.1426295 m, below the reported minimum 1.44 m. The default composition is a balcony rail, flue and seagull; the living room is difficult to understand. The seagull is not itself established as the collider.                                                           | [Desktop](images/room-library-upper-desktop.webp), [phone](images/private-living-default-phone.webp), [4K](images/private-living-default-4k.webp)                        |
| P2       | Full screen ? Explore the home ? Onsen; then preview Onsen time | Requested arm 3.7 m resolves to 1.1552264 m, below the reported minimum 1.48 m. The empty daylight view is mostly the pool edge/water; the activity view crops to a large face and torso.                                                                                                                 | [Daylight default](images/room-onsen-desktop.webp), [activity](images/station-soak.webp), [phone](images/onsen-activity-phone.webp), [4K](images/onsen-activity-4k.webp) |

The two P2 collider origins were not individually established. The coordinator independently reproduced all three blocked arms in its compiled candidate and is evaluating raised authored look targets with collision enabled. Those later changes are outside this frozen packet.

## Living room causal evidence

The requested orbit is yaw `3.18`, pitch `0.34`, radius `5.8`. Its authored eye would be `[0.3400411390, 2.3542251344, 1.9860554170]`. Target flags are `CLEARANCE=2`; the authored eye and occupied headroom/egress samples are free (`0`). No crossed interval has `INSIDE=4`. These measurements do not support the initial missing-air-seed hypothesis for this ray.

An independent grid-plane traversal covers every crossed cell. It finds one `BLOCKING=1` interval:

| Quantity                    | Measured value                                          |
| --------------------------- | ------------------------------------------------------- |
| Cell                        | `[129, 75, 98]`, cell width 0.12 m                      |
| World cell bounds           | min `[0.48, 0.40, 7.06]`, max `[0.60, 0.52, 7.18]`      |
| Ray entry                   | 0.2866061279011933 m, crossing `z=7.18`                 |
| Ray exit                    | 0.2998616808766162 m, crossing `y=0.52`                 |
| Crossed interval            | 0.0132555529754229 m                                    |
| Production restricted march | distance `0`, blocked `true`, exit `0.2866061279011931` |
| Hard-mask march             | distance `0.2866061279011931`, blocked `true`           |

Uniform 0.06 m point samples miss this short corner interval. Triangle-only ray tests also miss it: the ray grazes a voxel containing fireplace surface samples without intersecting those actual triangles.

The only eligible mesh intersecting that cell is **hidden `lounge_placeholder_living-fireplace`**, with `furniturePlaceholder: living-fireplace` and `furnitureCollision: true`. Seven decoded triangles (1103?1105, 1199?1202) mark that cell with **13 exact production barycentric samples**. All seven are structural, not small detail. The eligibility check includes hidden native proxies; the streamed furniture anchors are excluded by the runtime?s actual predicate.

The frozen native object has 784 vertices and 1,544 triangles. Bounds in web coordinates are approximately `[[0.5, 0.13, 6.4], [1.4, 1.78, 7.3]]`. Native loop triangles 440/441/438/344/345/342/343 match the seven decoded contributors within 46.8?64.2 ?m. The native source was opened read-only in pinned Blender 4.5.9 and never saved.

The explicit non-mesh onsen steam solid was also checked. Its actual bounds are min `[2.210000062, 2.957513124, 10.220000291]`, max `[4.130000091, 3.727513124, 12.140000319]`; they do not overlap the blocking cell. The earlier visible-mesh point-parity survey was only a preliminary exclusion check and does not name the causal collider.

Evidence: [exact crossed cells and samples](data/living-cell-origin.json), [full ray flags](data/living-ray-flags.json), [native triangle matches](data/native-living-cell-origin.json), [desktop settling/return/live checks](data/living-blocker-1440.json.gz), [phone checks](data/living-blocker-390.json.gz). The [small DDA replay](probes/replay-living-ray.mjs) exercises the measured crossed cells through the frozen production ray marcher; it does not recreate the full scene or camera cone.

## Walkthrough coverage

All ten rooms were visited through the public room buttons: Cave study, Kitchen, Gym, Onsen, Living room, Sleep, Cave library, Private living, Guest bathroom and Bedroom en suite. [The room sheet](images/rooms-desktop-contact-sheet.webp) and [coverage records](data/room-coverage.json) preserve their compositions. A room visit changes the camera while the normal lunch actor remains in the kitchen; that is expected. Seven public activity previews separately covered work, reading, training, onsen, sleep, lounge and pool, using the selected Lizard rig. [The activity sheet](images/stations-contact-sheet.webp) shows those actual views. The public activity presets choose their own preview hours.

The physical routes used the runtime capsule solver and ordinary input handlers. Playwright held W; synthetic public pointer drags steered the view. The route code never sets position, floor, camera target or yaw. A lab placement was used only to establish the explicitly recorded starting station for the separate patio and bedroom tests.

| Route                                                       | Result                                                                                                                                                                                                                                                                                            |
| ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Main entrance inward and back outward, one continuous visit | All three flights, landings and automatic main door passed. 69.724 m cumulative capsule travel; no blocked frames. The two traces use no placement between them. Flight/landing endpoint height differences from nominal are at most 2.62 mm.                                                     |
| Library ? patio ? library                                   | Both physical threshold crossings passed. Door fraction reaches 1. Maximum sampled threshold support is 5.03 mm above nominal floor.                                                                                                                                                              |
| New bedroom stair up and down                               | Both directions passed the bounded route. Twelve ascent waypoints and thirteen return waypoints reached; 2 ascent and 1 descent collision responses resolved while continuing near the bedside approach. The final return support is `y=0.01191473` at approximately `[-10.0438, 4.9490]` in x/z. |
| Phone Move and Look pads                                    | Both 104 px pads are visible and clear of the status bar. Synthetic touch PointerEvents on the actual pads moved the capsule 3.2458 m down the first entrance flight (`y=8.30008?6.87498`) with zero blocked frames. A separate Look input changed yaw `??2.86677` without translating the body.  |

On descent, the capsule spans a higher tread while its center approaches the next nominal route point; intermediate center heights can be one 150 mm riser above that point. This is recorded rather than counted as an exact foot-to-point match. These are functional observations, not speed or frame-rate measurements.

[Route summary](data/physical-route-summary.json), [inward entrance](images/entrance-inbound-complete.webp), [outward entrance](images/entrance-outbound-complete.webp), [patio outward](images/library-patio-outward.webp), [patio return](images/library-patio-return.webp), [stair return](images/bedroom-stairs-return-verified.webp), [phone before](images/entrance-phone-walk-start.webp), [phone after](images/entrance-phone-after-stick.webp), [phone input trace](data/phone-stick-input.json).

Two additional exterior angles use explicitly labeled authoring cameras placed over the sea, plus the public default coast/overview and evening state: [east](images/exterior-east-day.webp), [west](images/exterior-west-day.webp), [day coast](images/outside-day-default.webp), [overview](images/overview-day-default.webp), [evening 4K](images/outside-evening-4k.webp). No new plant, leaf, animal topology or lighting defect was established by this bounded inspection. The broad carved cliff transition remains the existing open F6 issue, not a newly accepted cliff design.

## Source and render binding

- Isolated worktree `finish-sweep`, base `cdb6bb7c4`; owned server port 4118.
- Exactly **249 files / 17,184,326 bytes** were copied from the coordinator?s frozen room-runtime/home-model family and rehashed unchanged after capture. [Full roster](data/freeze-manifest.json). Rejected F6 geometry was never used.
- Native v84 source SHA-256: `4aaa7a66626af86d1c10ff021fda6a52e97e46caed3fad1e39c9e0173617d681`.
- `home-shell.glb`: 894,112 bytes, SHA-256 `54733b6da084ced6949ef3b6cc2fd535e9ad1924887fe7d2766762c626aaca18`.
- Light-cache signature `50df38ed13ede47cd5eca13ef6807bb6433bdf85ce323d6c2642e57e801c7b09`; payload 791,700 bytes, SHA-256 `912695a66d4ca38b1a538c705c86c330c7718c3c87a129a92008c664279c5ddf`. The actual browser reports restored cache/cacheHit.
- The server uses the coordinator?s immutable production build for remaining site assets. Every home-scene module and home model comes from the frozen family. Minified module aliases resolve to that family?s raw module, so the graph cannot silently fall back to the old compiled controller. Missing frozen files fail instead of falling through.
- Actual response bodies were hashed against the server?s source hashes. Where the browser body API was unavailable, an explicitly recorded independent raw HTTP readback verified the same served URL. There are 177 distinct bound responses and zero hash mismatches. See [response readback](data/source-readback.json) and [render/image index](data/render-index.json).
- Chromium rendered the actual WebGL scene with D3D11. Desktop captures are 1440?1000; 4K captures retain 3840?2160 pixels. Phone emulation is 390?1000 CSS px at DPR 2, with a 780?2000 canvas. The portable WebP derivatives preserve every original RGB pixel and dimension; their hashes and original PNG hashes are in the index.

No home-scene models, textures or graphics modules were omitted. The selected captures have no collected page/HTTP errors. A separate [console check](data/console-check.json) using the repository collector finds zero unexpected runtime errors; its raw log retains three known empty-CDN-stub integrity errors and five D3D11 shader warning messages. The compiler warns about potentially uninitialized `f_farSurface`, `f_atmoBackground` and `dyn_index_vec2_int`. No corresponding visible failure was established; this is a diagnostic follow-up for the runtime owner, not a fourth proven visual defect. Source binding to this explicit overlay is established; this packet does not claim a fresh production build, deployed verification, WebKit/physical-phone parity, performance, full five-rig contact acceptance, every furniture collision surface, or exhaustive plant/animal geometry validation. The coordinator owns the final compiled production and publication gates.

## Retained attempts and reproduction

Raw captures and failed harness attempts remain under `.jekyll-cache/visual-qa/sweep-2026-10-28/`. [Retained attempt hashes](data/retained-attempts.json) distinguish Arrow-key overshoot, accidental pointer capture from tiny helper drags, and an authoring camera placed into terrain from actual product failures. The final stair helper ends its synthetic drag with `pointercancel`; the verified cycle remains unlocked. The first-person bedside forward view faces a wall; no eye/mesh penetration was established from that picture.

The larger raw browser reports and complete route traces are stored as deterministic gzip files. [Their index](data/compressed-reports.json) records both compressed and original byte hashes; decompression recovers the unmodified captured JSON. The summaries and causal records remain ordinary JSON. The exact source camera module is also gzip-wrapped so its original CRLF bytes survive Git checkouts.

The probes were run from the isolated worktree, using the complete frozen family and the immutable site build. `probes/` retains their code, including the source camera module. The server and browser helpers retain the original local QA paths so the existing evidence remains reproducible in this workspace; the native probe asserts the source hash and exact Blender version.

```powershell
# Fast portable mechanism replay; no browser or native file required.
node artwork/coastal-home/reviews/sweep-v84-2026-10-28/probes/replay-living-ray.mjs

# Full browser/native diagnosis against the owned frozen QA family.
python .jekyll-cache/visual-qa/sweep-2026-10-28/serve.py
node .jekyll-cache/visual-qa/sweep-2026-10-28/living-origin.cjs
& D:\tools\blender-4.5.9-windows-x64\blender.exe -b --factory-startup --python .jekyll-cache/visual-qa/sweep-2026-10-28/native-living-origin.py
```

The browser helper uses the normal external-host stubs from `test/visual/helpers`, including CDN scripts/styles, Google Fonts, embeds and repository badges. All local home-scene graphics remain present. These captures judge the full-screen scene geometry, camera and control bounds; they do not establish remote font or embed parity. The [verification receipt](data/verification.json) records the bounded checks for this review. No release matrix or timing benchmark was run.
