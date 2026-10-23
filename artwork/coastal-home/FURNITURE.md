# Furniture source and runtime

The October 23 completion extends the original Eames work in `cad6532bf`. Every
piece is original Blender geometry from `bin/build_coastal_furniture.py`, retained
in `furniture.blend`. No downloaded configurator mesh or texture is redistributed.
The Eames source retains the earlier measured-reference provenance. The ergonomic
chair is an original interpretation of the Aeron silhouette; the range, hood,
pot filler, refrigerator, dining set, pan, weights and suspended fireplace are
original constructions.

The standalone source and exports use the shared furniture interface: metres,
glTF +Y up, front +Z, a floor-centred horizontal footprint and room-owned anchors.
Wall-mounted and suspended pieces retain the room's floor as their vertical datum.
The house's final manifest supplies 17 placements for 11 shared item types. Six
dining chairs and both working dumbbells share their respective source resources.

| Item                    | Default GLB bytes | Fine GLB bytes |
| ----------------------- | ----------------: | -------------: |
| Eames chair and ottoman |            66,580 |        444,044 |
| Aeron with headrest     |            82,404 |        167,488 |
| Italian range           |            32,936 |         49,312 |
| Plaster hood            |             7,520 |          8,944 |
| Swing-arm pot filler    |             7,340 |          7,812 |
| Glass refrigerator      |            33,328 |         46,968 |
| Travertine dining table |             6,880 |          8,932 |
| Woven oak chair         |            17,416 |         30,636 |
| Cast-iron pan           |             9,488 |         45,100 |
| Hex dumbbell            |             4,676 |          8,564 |
| Suspended fireplace     |            12,616 |         17,356 |
| **Unique assets total** |       **281,184** |    **835,156** |

Default levels stream with their rooms. Distance, projected resolution and full
screen request finer levels with hysteresis and a byte budget. A failed piece
leaves its room placeholder visible. Disposal restores placeholders and releases
owned buffers, materials, images and fire geometry. Hidden rooms do not request
fine levels. The model report records source bounds, triangle counts, hashes,
bytes and per-vertex Cycles AO ranges for both levels.

Carbon is the Aeron's default. `?aeron=mineral` and the authoring panel's Aeron
finish select provide the Mineral alternative using the same geometry. Its
commissioned working seat is 0.515 m above the floor to preserve the study's
existing body, keyboard and footrest contacts. The dining chairs remain 0.45 m.
The pot filler and refrigerator door have retained pivots and authoring controls;
their angles persist through LOD swaps. Refrigerator glazing blends after the
opaque contents with depth writes disabled.

The pan's eight controlled wrist raises close each training session's accessory
work. It moves the same authored pan between the gym shelf and the measured
finger/thumb cup, retaining the item's exported grip through rotation and LOD
changes. It returns to its original shelf transform. Existing barbells, curls,
walking routes and the training board continue through the same session system.
The working dumbbells use their existing exact rack/hand transfer.

The open fireplace bowl retains its authored flue and meets the house's flue
extension. Its bounded flame geometry uses one draw and 1,260 triangles, with no
texture downloads. Pause and offscreen state freeze the active clock; reduced
motion uses a composed still.

## Verification

`node --test test/coastal-furniture.test.mjs test/coastal-training.test.mjs
test/coastal-gym-session.test.mjs test/coastal-lift-rig.test.mjs` passes 31 tests.
They cover missing assets, placement/resource sharing, LOD budget and hysteresis,
compilation, hidden-room requests, disposal, exact pan-grip transforms and return,
the eight-repetition finisher, finite joints, standing soles and session routes.
Python compilation, targeted Prettier and `git diff --check` also pass.

`bin/capture_coastal_furniture.cjs` records actual placed assets and byte requests
in the public scene, including full screen, default/fine comparisons, phone,
Carbon/Mineral, door articulation and pan transfer. The retained capture JSON and
images under `reviews/furniture/` name their states. Development captures used
the built `/al-folio/` page with this branch's source/runtime and the final house
assets overlaid; the release coordinator repeats the integrated production check.
The phone proof uses a 390 × 1000 viewport, a nonblank 350 × 352 canvas, no horizontal
overflow and no console errors. Review renders are Blender Cycles stills, separate
from browser evidence.
