# House overlap audit, October 24

Sirui reported "weird geometry intersection issues", inside rooms, on people and animals, and outside. This audit measures them across the whole built house instead of relying on spot checks.

## What it measures

`bin/audit_coastal_overlaps.py` (Blender) reads the native source triangles. These cover the shell, rooms, fixtures, planting and coast, plus every streamed furniture item placed exactly as `furniture.mjs` places it. In total that is 425 meshes and 1.13 M triangles.

- **Interpenetration.** `BVHTree.overlap` gives the crossing triangle pairs. Their intersection segments are clustered into sites, one contact or defect each, even inside a room batch that merges many parts of one material.
  - At each site, sampled points are tested against the other mesh with a winding-number ray test. The deepest inside point gives the penetration depth.
  - A _grazing_ site is one where the two crossing surfaces face the same way within 20°. That leaves a ragged, patchy seam where one face shows through another. Grazing sites are ranked separately and never pass as contacts.
- **Coplanar overlap (z-fighting).** These are faces within 1 mm and 1° of each other that overlap in area, on different meshes or materials.
  - Same-facing pairs flicker, but only their exposed area counts.
  - A face is hidden when, 3 mm out along its normal, it lies inside another closed solid or is sealed by a surface within 2.5 cm (for example, a tile bottom above its slab).

Intentional contacts are explicit rules with a geometric test, a reason and a depth bound, so a contact that grows past its bound is ranked again. The rules are shallow seam, support rest, one-sided embed, structural joint, planting root, terrain landform and water in basin.

Only three things are excluded before measurement, and the report lists them:

- geometry that is never drawn, such as shadow-only copies;
- furniture placeholders, which are replaced by their streamed items;
- mutually exclusive bedding variants.

## Results

| Measure                         | Native before | Native after | Delivered after |
| ------------------------------- | ------------: | -----------: | --------------: |
| Visible z-fighting area         |      105.2 m² |      1.96 m² |         1.84 m² |
| Visible z-fighting pairs        |            65 |           39 |              43 |
| Grazing (patchy) seam length    |        42.3 m |        5.4 m |           0.8 m |
| Deep crossings deeper than 5 cm |           336 |          303 |   not compared¹ |

"Delivered" is the same audit run on the shipped Draco GLBs (`--delivered=1`), decoded in Blender and placed at the same transforms. Draco quantizes each mesh's positions to a 14-bit grid over its own bounds, so two faces a millimetre apart in the source can land on the same plane once delivered. The first delivered run found exactly that: the terrace's travertine tiles stood 1 mm proud of their stone bed, which became 76 m² of speckle on the terrace (78.1 m² delivered in all). Both totals above include the fix.

¹ Decoding renumbers vertices, so many closed source meshes no longer count as closed solids and the inside test sees fewer deep crossings (48 over 5 cm). The deep ratchet therefore stays on the native run.

The worst offenders were systematic builder defects, all fixed by `bin/coastal_overlap_repairs.py` through `bin/refresh_coastal_overlap_repairs.py`. Each repair is recorded island by island in [overlap-repairs.json](overlap-repairs.json).

- **Floors and treads.** Stone bases sat flush with their oak boards and tread caps in five retreat modules (library, corridor and bridge, arrival stair, clifftop lounge, bowed house stair), which caused about 75 m² of stripes. Each stone base now stops under its oak, 22 mm under boards and 28 mm under tread caps. `bin/coastal_retreat.py` carries the same correction for a rebuild from the pristine baseline.
- **Terrace.** The stone bed now stops under the travertine tiles' own bottoms, so the delivered tops can no longer meet. `bin/coastal_estate_outdoors.py` carries the same change.
- **Arched facade frame.** The lunette frame was swept exactly along the rock arch it sits in. Both faces are double-sided, so their depth tie flipped whenever draws regrouped (the perf worker saw this). Its outer edge now keeps a 5 mm shadow reveal below the rock; `bin/coastal_facade.py` sweeps it on the inset path.
- **Kitchen fridge.** A potted olive grew inside the glass wine fridge. It now stands in the arrival foyer's corner.
- **Guest bath doorway.**
  - The parked pocket-door leaf stood inside the fridge and pantry; it now sits in its wall pocket.
  - The oak pantry ran 7 cm into the bathroom doorway; it is narrowed from 60 to 48 cm.
- **Overlapping slabs.**
  - The arrival foyer slab ran under the guest bath tiles.
  - The corridor floor ran 1.15 m over the library floor.
  - The gym passage floor ran over the gym floor.
  - The private-threshold and bridge soffits shared the upper slab's ceiling plane.
- **Clifftop garden.** Terrain and mulch broke through the path ribbon. The ribbon's top now clears the highest ground or mulch within 30 cm by 12 mm (5.7 cm mean lift, 16 cm at most). The mulch bed is kept whole, because an earlier candidate that deleted its faces under the path left bare terrain beside it.
- **Small flush faces.** These were the kitchen hob plate, a facade paving tile, the submerged pool chaises, the terrace face against the pool wall, the laptop keyboard inset and the private garden pad.

Every top-ranked remaining pair carries a reviewed verdict with bounds 25% above its measured value, in [overlap-verdicts.json](overlap-verdicts.json). Most are designed joints, hidden beds and built-into-rock linings. The verdicts also cover:

- **Deferred to item 12:** the bridge and old spiral, which that item removes.
- **Recorded follow-ups:**
  - bottle labels flush with bottle bodies inside the glass fridge (a furniture export);
  - two end books flush with their shelf uprights.

Below the reviewed 60, the bedroom's oak picture frame meets the en suite's oak trim by up to 1.3 cm (ranked 79th). Item 12 moves the bed and rebuilds that wall.

## Regression check in CI

CI has no Blender. Instead, the compact report [overlap-audit.json](overlap-audit.json), written by `bin/summarize_coastal_overlaps.py`, is committed with its bindings. `test/test_coastal_overlap_audit.py` then checks four things:

- **Bindings.** The report must match, by SHA-256, the native source, every delivered house GLB and the audit tool. A house re-export without a re-audit fails. The streamed furniture is audited in place and recorded, but not bound: it has its own owner and collision tests, and a furniture export should not fail the house report. The house worker re-audits at each house checkpoint.
- **Ratchets.** Visible z-fighting must stay at or below 2.2 m² (and 0.35 m² per pair), grazing seams at or below 5.6 m, and deep crossings over 5 cm at or below 315. That last bound leaves about 4% for seeded per-site depth sampling.
- **Delivery.** The decoded GLBs must have been audited too, with the same hashes, and their visible z-fighting must stay at or below 2.5 m².
- **Verdicts.** Every one of the top 60 ranked pairs needs a bounded verdict.

I chose this over a full Node reimplementation because the measurement needs native BVH overlap and inside queries over 1.13 M triangles. That takes minutes in Blender's C code and would add a large, slow duplicate to CI.

The shipped Draco geometry of the repaired families is still checked directly in `test/coastal-overlap-delivered.test.mjs`. That test confirms:

- stone tops sit more than 15 mm under oak;
- no plant stands inside the fridge's bounds;
- no foyer slab top lies at floor height inside the bathroom wing.

## Reproduce

```powershell
$blender = "D:\tools\blender-4.5.9-windows-x64\blender.exe"
# Repairs: from the pre-repair source (SHA-256 c1fced7e…, in git history before this checkpoint) to a
# candidate; review it, copy it over the canonical source, then export, bake and re-trace as usual.
& $blender --background -t 8 --python-exit-code 1 --python bin/refresh_coastal_overlap_repairs.py -- --source=.jekyll-cache/overlap-repair/pristine.blend
# Audits: native source, then the decoded delivery.
& $blender --background -t 8 --python-exit-code 1 --python bin/audit_coastal_overlaps.py -- --out=.jekyll-cache/overlap-audit/final.json
& $blender --background -t 8 --python-exit-code 1 --python bin/audit_coastal_overlaps.py -- --delivered=1 --out=.jekyll-cache/overlap-audit/delivered.json
python bin/summarize_coastal_overlaps.py --audit=.jekyll-cache/overlap-audit/final.json --before=.jekyll-cache/overlap-audit/before.json --delivered=.jekyll-cache/overlap-audit/delivered.json
& $blender --background -t 8 --python-exit-code 1 --python bin/render_coastal_overlaps.py -- --report=.jekyll-cache/overlap-audit/final.json --top=48
```

A native audit takes about 14 minutes and a delivered one about 8. The full reports (about 27 MB each) and the triage tiles stay in `.jekyll-cache/overlap-audit/`.

## Limits

- Scope is the native source and the decoded delivery, each with the streamed furniture placed at its anchors.
- People and animals in their live poses are separate captured evidence; see the house review README.
- Hidden-face detection is conservative where a host mesh is open after earlier doorway cuts (for example, the bathroom plaster batches). Those pairs carry explicit `hidden` verdicts rather than a looser rule.
- This was a native and browser review, not a structural or photoreal claim.
