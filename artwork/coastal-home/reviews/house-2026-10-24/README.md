# House geometry pass, October 24

This is the house worker's evidence for checklist items 8, 12, 10 and 9 in `docs/october-2026-handoff.md`. Raw captures and full reports stay in the ignored `.jekyll-cache/visual-qa/house-2026-10-24/` and `.jekyll-cache/overlap-audit/`. The durable picks are kept here.

## Item 8: overlap audit and repairs

[overlap-audit.md](overlap-audit.md) summarizes the method, results, CI enforcement and limits. The supporting files are:

- [overlap-audit.json](overlap-audit.json): the compact ranked report. It is bound by SHA-256 to the source, the delivered GLBs and the tool, and it records the furniture it placed.
- [overlap-verdicts.json](overlap-verdicts.json): reviewed, bounded verdicts for the ranked pairs.
- [overlap-repairs.json](overlap-repairs.json): every island the repairs edited, with before and after values.

### Before and after

Each pair below uses the same camera. Browser stills come from `bin/capture_coastal_interior.cjs`, captured in full screen at 1600×1000 on the canonical Windows D3D11 backend. The before frames are served from `COAST_REF=HEAD` (source `c1fced7e`); the after frames come from the repaired working tree. Native views are Blender workbench renders of the same source pair, made from identical camera points.

| Defect                                                                  | Before                                               | After                                               |
| ----------------------------------------------------------------------- | ---------------------------------------------------- | --------------------------------------------------- |
| A potted olive grew inside the glass wine fridge                        | [browser](item8/before-fridge-bay.png)               | [browser](item8/after-fridge-bay.png)               |
| Terrain broke through the clifftop path                                 | [browser](item8/before-garden-path.png)              | [browser](item8/after-garden-path.png)              |
| Terrace tiles fought their stone bed once delivered (speckle)           | [browser](item8/before-terrace-pool.png)             | [browser](item8/after-terrace-pool.png)             |
| The pantry ran into the guest bath doorway, over the parked pocket leaf | [browser](item8/before-guest-bath-door.png)          | [browser](item8/after-guest-bath-door.png)          |
| Stone and oak fought on stair treads and floors                         | [native](item8/before-native-house-stair-treads.png) | [native](item8/after-native-house-stair-treads.png) |
| The olive's new place in the arrival foyer                              | [native](item8/before-native-foyer-corner.png)       | [native](item8/after-native-foyer-corner.png)       |
| Library floor: the stone bed fought with the boards (hatching)          | [native](item8/before-native-library-floor.png)      | [native](item8/after-native-library-floor.png)      |
| Guest bath doorway, pantry and fridge                                   | [native](item8/before-native-guest-bath-door.png)    | [native](item8/after-native-guest-bath-door.png)    |

### Checks run for this checkpoint

- **Overlap audit.** The final native audit (39 visible z-fighting pairs, 1.96 m²; 5.4 m of grazing seams; 303 deep crossings over 5 cm) and the decoded-delivery audit (1.84 m²) pass the ratchets in `test/test_coastal_overlap_audit.py`. The delivery audit is what found the terrace speckle, 76 m² of it, that the source audit could not see.
- **Delivered Draco.** `test/coastal-overlap-delivered.test.mjs` decodes the shipped GLBs and confirms:
  - stone sits more than 15 mm under every oak top;
  - no plant stands inside the fridge;
  - no foyer slab top lies at floor height under the guest bath.
- **Walk routes.** The native Walk routes pass on delivered geometry (`coastal-estate-native`, `coastal-walk-native`). That includes the main entry turning past the foyer olive, whose leaves are now soft foliage like the rest of the planting; the pot and stems stay solid.
- **Companion flights.** All 420 flights (2,832,715 sampled centres) were re-sampled from the final manifest and re-audited natively against the final source (SHA-256 `38f46819…`). The minimum clearance is 0.430948 m, conservatively 0.4266 m, against the unchanged 0.42 m envelope.
- **Derived data.** The static light cache was re-baked from the repaired GLBs on the rebased tree, the loading sketch was re-traced, and the perch support was rebuilt (only its source binding changed).
- **Arched facade frame.** The perf worker's lead was real: the lunette frame sat exactly on the rock arch. It now keeps a 5 mm reveal (see [overlap-audit.md](overlap-audit.md)).

The browser garden-path still also shows a bollard light standing in the middle of the walkway, as it did before. It is queued with the clifftop entrance redesign.

### What this checkpoint does not cover

- People and animals in their live runtime poses. That pose capture and audit runs with the item 9 sweep, after item 12 moves the bed.
- A fresh Cycles vertex-colour bake. The edits are rigid moves, hidden faces, a 1–16 cm path lift and two trims under walls, so the retained baked colours stay plausible. This follows the agave-grounding precedent; the next geometry checkpoint re-bakes.
- Physical-phone or deployment checks.
