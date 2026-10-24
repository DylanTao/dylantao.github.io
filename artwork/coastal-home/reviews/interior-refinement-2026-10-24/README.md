# Interior refinement, October 24

Sirui wanted the view to lead, plants to feel deliberately placed, bathroom
finishes to feel considered, and the library to have a warm hearth. This is the
source checkpoint for those changes. The estate's final exports, transformed
coordinates, circulation, light cache and browser proof are owned by the
coordinator's integrated architecture review.

## What changed

- The public kitchen/living curtains remain gathered overnight and while the
  private upstairs quarter sleeps. Low western sun draws them only 12–20% of
  their travel; an explicit room visit gathers that pair completely. The
  existing linen, hardware, wind, pause and reduced-motion behavior remain.
- Bathroom floors use a narrow limestone frame, larger staggered honed stone
  cuts in the dry zone, and finer cuts in the flush shower floor. Three close
  stone shades use the existing procedural travertine surface. The support
  plane, doorway and shower approach keep their existing heights.
- A concealed line under each vanity lights the stone and toe clearance, while
  the existing mirror wash is slightly stronger. Authored room coves retain a
  26% night guide level between visits instead of 16%; this adds no light source.
- The freestanding lounge olive leaves the facade doorway. A fitted stone bed
  at the north glazing return holds a varied-height Strelitzia fan. Small
  Asplenium compositions rest on actual vanity stone, and an Epipremnum trails
  from fitted library joinery. The retained small credenza plant stays.
- The library receives a recessed stone hearth with a real opening, charred
  logs, individual embers, restrained authored flame geometry and a slim flue
  entering the rock. One bounded analytic emitter follows its hearth schedule;
  no native PointLight or shadow map is added.

## Matched native evidence

These are Blender Eevee previews of the complete retained source, at
1050×744 and 12 samples, using identical room cameras and afternoon lighting
before and after. Practical area lights are the existing native preview
stand-ins, not proof of the browser's analytic night lighting. No final source
or public asset was saved by these captures.

| State                | Before                                   | After                                  |
| -------------------- | ---------------------------------------- | -------------------------------------- |
| Bedroom en suite     | [Before](native/bath-bedroom-before.png) | [After](native/bath-bedroom-after.png) |
| Guest bathroom       | [Before](native/bath-living-before.png)  | [After](native/bath-living-after.png)  |
| North glazing return | [Before](native/lounge-plant-before.png) | [After](native/lounge-plant-after.png) |

The close view demonstrates the new planting's placement and form. It does not
claim new photoreal botanical surfacing or establish physical-phone performance.
The final library layout and fireplace need the integrated estate capture;
the earlier two-floor library is deliberately not reused as final evidence.

The [native receipt](native-review.json) records:

- 27 downward probes against actual bathroom geometry, with maximum floor
  difference **2.51 mm**, including doorway, WC and shower routes.
- Two consecutive decoration builds with identical names and vertex signatures,
  and exactly one hearth metadata entry.
- 22 decoration material batches and **10,827 native triangles** before the
  final export. The final scene owns its compressed-byte and draw-count budget.

The pre-setback source is from `e0658c636`, SHA-256
`e907fb08f65525bf1388d48e6dc79ea6627c2f89d0941bc6d05a5fac239ea813`.
The source/test checkpoint is `064dc771f`. The retained
[native acceptance runner](native-acceptance.py) rejects a different source:
pass `--source=PATH` to that original Blender file. It is a dated fixture,
not a command for rebuilding old-coordinate bathrooms inside the later
transformed estate.

## Runtime and integration checks

The curtain/laundry solver keeps its original local constraint coordinates.
`createCurtainRig({ offset: [0, 0, 8] })` translates the render groups, world
culling and glazing order once. The shared local wind adapter samples actual
translated world points. Laundry receives its own original coast plus offset;
there is no double translation.

The checkpoint passed **59 focused Node tests**, including the existing cloth,
laundry, fixture and receiver tests, plus translated live-wind/culling/glass-order
checks. Targeted Prettier, Python compile and `git diff --check` passed. The
dated receiver receipt remains immutable; its test explicitly scales only its
old idle-room powers to the new 26% level.

For final integration, call `coastal_bathrooms.build(scene, config)` and then
`coastal_interior_refinement.apply(scene, config)` before the estate's single
landward transform. All new library parts start with `library_refined_`, so
moving the old `study_` workstation does not move the new hearth again. Regenerate
the source-bound bake, exports, collision data and scene drawings together.

## Tradeoffs and remaining proof

The finer shower joints and fitted greenery add modest native geometry and
material batches. Existing texture shaders carry the finish detail; there are
no new image textures, cloth passes, PointLights or shadow maps. Fine wet-zone
cuts suggest a grippier surface but do not establish a real-world slip rating.

Keeping public curtains open favors Sirui's requested panoramic living space.
Private bedroom and bath enclosure remain architectural responsibilities; the
living curtains are not used as their privacy substitute. The small glare
response does not simulate thermal comfort or measured visual glare.

Final acceptance still requires the combined estate's actual browser views,
night walk usability, curtain/glazing alignment after setback, fireplace
placement beside the relocated workstation, and fixed receiver capacities.
These source-native images do not replace those checks.
