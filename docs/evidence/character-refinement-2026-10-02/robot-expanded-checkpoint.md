# P expanded clearance checkpoint — 2026-10-02

Queue fix: worker `549ce4dd0`, integrated root `2b296f060`. Three native-world regression cases and 35 focused P tests passed; independent reviewer reproduced zero drift on the original 2.6 m room-change snap and verified pause/page ownership retention. Coordinator also passed actual desktop/mobile room-change cases. No geometry or public control changes in this queue fix.

## Expanded native geometry results

- `full-rig-intersections.json`: 156 cases, 40,833 sampled poses, zero triangle-surface overlaps, 123.509 seconds CPU.
- Cases: 120 interroom journeys (six rooms, every different room pair, both departure perches, both arrival perches); 12 indoor wander directions; 12 beach outward journeys; 12 reversed beach journeys to their actual departure perch.
- `settle-intersections.json`: 24 beach outward/return directions, 289 settling/arrival poses, zero overlaps, 5.039 seconds CPU. This supplement corrects the away task gaze to the Pacific relative to the physical base, rather than the ordinary destination-camera gaze used in the main catalog's settling phase.
- `positive-control-intersections.json`: three known original collision poses remain detected. Native tapered shell triangle-pair counts match the earlier audit exactly: kitchen cabinetry 140; upper limestone guard 141; horizontal study honey-ash geometry 174. Other original overlapping P parts are also detected (74 total part/object records across the three poses).

## Reconstruction

`routes.mjs` imports the integrated root's clearance flight, motor, local attention, heading, navigation and shore modules, with root's actual manifest/perches. It advances motion at 60 Hz and retains every sixth frame plus each endpoint. Model native scale is 0.46; body/head/fin/antenna transformations use authored hierarchy and local origins. The head uses the runtime ZYX order. Every decoded native P mesh is checked, including optical housings, fins and antennae. Existing cave-roof cutaway geometry is excluded; all other shared/realistic static room/coast GLBs remain.

Native part bounding-box corners produce conservative transformed world boxes and enclosing spheres. The static nearest-surface query only culls pairs that cannot touch that sphere; the remaining candidates use exact tessellated BVH triangle overlaps. Main catalog required 18 exact part BVHs; positive control required 56 and detected all three original defects. This optimization explains the shorter audit without dropping model geometry.

Source and native GLB SHA-256 hashes are embedded in route/result JSON. The main catalog predates the queue-only integration; geometry/flight/motor/navigation data match. The supplemental catalog was regenerated after queue integration. No GPU or browser context ran for this audit, and no root source was modified.

## Limits

This is a sampled triangle-surface overlap audit, not a continuous swept-volume or solid-containment guarantee. It covers the named static routes and native articulated no-visitor flight states. It does not certify arbitrary visitor greeting poses during flight, dynamic collisions with humans/animals, every arbitrary camera heading, or every renderer cadence. Ordinary settling uses the destination's native camera, while the supplemental away settling uses the Pacific. Pupils and catchlights retain authored positions instead of their small animated offsets. Runtime ownership/interruption continuity is separately covered by the committed native-world regression tests, not inferred from this pure route catalog.

No additional implementation was needed after the expanded route audit. Previous verified clearance/perch changes remain the actual product source. Previous native before/after stills and video are retained in sibling `p-clearance/`, with the private inspection camera explicitly labeled.
