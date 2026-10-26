# House geometry pass, October 24

This is the house worker's evidence for checklist items 8, 12, 10 and 9 in `docs/october-2026-handoff.md`, and for Sirui's October 24 feedback on the house. Raw captures and full reports stay in the ignored `.jekyll-cache/visual-qa/house-2026-10-24/` and `.jekyll-cache/overlap-audit/`. The durable picks are kept here.

[feedback-log.md](feedback-log.md) lists each of Sirui's feedback points with fixed before views (and after views as each group lands).

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

## Arrival and entrance (feedback F1–F5 and F12)

Built by `bin/coastal_arrival_hall.py` through `bin/refresh_coastal_arrival_hall.py`, and `bin/refresh_coastal_seat_anchors.py` for F12. Both apply once to the source and say what they changed. The before and after views are listed per point in [feedback-log.md](feedback-log.md).

- **One stair, in the rock.** The floating stair in front of the back wall is gone. A stair hall cut into the cliff behind the wall now carries the house's only stair. It has three straight flights of stone treads with oak caps, laid around a well lit by three round oculi. Sandstone lines the walls and stone paves the floor.
  - The top flight rises into a small sandstone pavilion on the clifftop. The pavilion opens onto a paved forecourt that eases into the ground with no step.
  - The first flight's landing is at the upper floor, behind an oak pocket door.
  - On the well side, bronze-rod guards run under the hall's lower ceiling and end where its sandstone wall takes over, so the top flight climbs between two walls toward the light of the portal.
- **The main entrance.** A 1.5 × 3.0 m pivot door sits in the back wall. Its face is the wall's own sandstone, so the texture runs across it. It turns into the hall on an axis 0.35 m in from its west jamb. The back wall is now one sandstone plane across the vault. A hidden linear light at the top of the slot grazes it at night.
- **Walk.** Walk now begins in the pavilion's mouth, at the head of the stair, and the public route runs down the three flights and through the pivot door into the living.
- **Light in the hall.** The hall has no window, only three small oculi, so it is lit like a gallery all day. A line of light under each wall handrail grazes the sandstone and lights every tread, and a cove at the top of the well washes the landward wall. They follow the entrance's schedule, which now stays at 0.6 by day for this windowless hall and reaches full brightness after dark, and they feed the cached bounce. At night the portal's lit brow and the glow through the oculi mark the way down.
- **The spiral and the trenches.** The private onsen spiral is retired, and its clifftop hole is closed with ground that follows the slope. The open arrival trench and the old portal are closed at grade. The old private stair's channel was still open: it ran down from the clifftop and opened onto the sky over the upper passage between the onsen and the hall's upper door. It is now closed at grade too, and its level soffit continues the passage's ceiling and lifts away with the rooms' roof. The clifftop path is re-laid as two ribbons from the forecourt: east past the oculi, and west a metre clear of the pavilion, over the gentle ground beside it.
- **The land around it.** The hinterland's transition planting had grown where the pavilion now stands. `bin/coastal_hinterland_clearings.py` removes the 12 plant parts within 2.2 m of the built arrival from the delivered hinterland, and `bin/build_coastal_hinterland.py` now keeps clear of the arrival in any later rebuild.
- **Privacy.** The hall's only opening to the living is the pivot door.
  - At the onsen's open edge, deep horizontal cedar blades stand on the gallery's edge and serve as its guard there, in place of the brass posts. They let a level view of the sea through but stop any line tilted more than about 10 degrees. So the living cannot see into the sunken tub, and the tub cannot look down into the living. The onsen's own camera looks over the blades, and the companion's onsen perch keeps its full clearance.
- **Kitchen and living batch.** The nook's breakfast plate and celadon carafe are removed. The banquette and the cloud sofa are now streamed furniture: anchors `nook-banquette` (item `banquette`) and `living-sofa` (item `cloud-sofa`). Their current geometry stays as each anchor's placeholder until the items land.

Design principles applied:

- a pivot door set into a textured stone wall;
- one family of materials used consistently (sandstone, warm cut stone, oak and bronze);
- light that grazes textured stone: lines under the handrails and a cove over the well in the hall, a hidden slot along the back wall at night;
- round light wells as shaped openings in the rock;
- a screen that keeps the view while hiding the room;
- wayfinding by light and threshold instead of signs: the portal's lit brow, the oculi over the stair and the grazed wall around the pivot door lead the way down. This applies a lesson from Susan Kare's Startup School 2026 talk (see "Lessons From Susan Kare" in `WEBSITE_DESIGN_HEURISTICS.md`): clear metaphors carry meaning without added labels.

### Checks run for the arrival checkpoint

- **Native contacts.** `bin/review_coastal_retreat.py` walks the 9 authored routes (133 samples) with no failure: the arrival from the pavilion's mouth down three flights and through the pivot door, and the house stair from the living up to the upper landing.
- **Companion.** The native clearance audit passes all 420 flights against the 0.42 m envelope; the closest is 0.427 m, at the onsen perch beside the new louvers.
- **Overlap re-audit.** Visible z-fighting is 1.61 m² natively and 1.92 m² decoded, grazing seams 1.64 m. Deep crossings over 5 cm rose from 303 to 340 with the hall's designed embeds: oculus rims in the ground, stone reveals in the rock, paths bedded in the grade. Every new pair among the top 60 has a bounded verdict in [overlap-verdicts.json](overlap-verdicts.json), and the deep ratchet in `test/test_coastal_overlap_audit.py` rose once, to 350, with that reason.
- **Delivery.** The first-scene budget stays within 4 MiB. The moved seats keep their baked colour as the active attribute, so they ship quantized like the batches they came from.
- **Wildlife.** The gull's gallery perch moves west of the screen, midway between two of the rail's brass posts, and takes the rail's decoded delivered surface as its contact, as the displaced west perch already did.
- **Suites.** The Node and Python suites, Prettier on the changed files and the style contract pass. The light cache is re-signed after rebasing on `main`, and the loading sketch is re-traced.
- **Not covered.** The browser Walk journey in `test/visual/desk-scene.spec.js` was not run here; the native route checks above cover the same path.

## Study: the whiskey corner (feedback F9)

Built by `bin/refresh_coastal_whiskey_corner.py`, which applies once to the source and says what it changed. Sirui asked for "a nice place and comfy small sofa with ottoman for me to enjoy whiskry and enjoy the ocean view", with "some nice bottles there".

- **The corner.** It sits at the library's sea end, between the glass and the desk, with the hearth on its west wall. The two reading chairs there are retired.
- **The anchors,** each with a plain placeholder until the life worker's item streams:
  - `study-whiskey-lounge` (item `whiskey-loveseat`): the loveseat's origin at [-10.50, 0, 2.55], at yaw π, facing the sea.
  - `study-whiskey-ottoman`: at [-10.17, 0, 1.69], that is x -0.28 and z +0.86 in the loveseat's frame, under its left seat.
  - `study-whiskey-side-table`: at [-11.40, 0, 2.50], that is x +0.95 and z +0.05, by the right hand and the fire.
  - `study-whiskey-bottles`: on the niche's shelf at [-12.69, 0.97, 1.41], at yaw π/2, facing the room.
- **The niche.** A 1.04 × 0.30 m niche is cut into the west wall between the window and the hearth. It is lined in the hearth's honed travertine, and a warm line of light is hidden under its lintel. The light follows the hearth's evening schedule. From the loveseat, the niche glows beside the fire.
- **Circulation.** The library's visit spot moves to the window, reached down the 0.72 m between the loveseat and the east shelf. The companion's first exit point moves to its own perch, clear of the loveseat's back.

Design principles applied: a warm, low-lit corner turned to the view; one material family, the hearth's travertine carried into the niche; and light hidden in the architecture rather than added as fixtures.

Checks: the native contacts still pass all 9 routes (133 samples), and the targeted Node suites pass (64 tests: furniture collision, interior, navigation, Walk, light installations, light cache and sketch). Day and night captures from the sea corner and the niche show the life worker's items, already in `main`'s furniture index, standing at these anchors.
