# Outdoor estate authoring checkpoint, October 23, 2026

This is the source-only outdoor contribution. The coordinator applies
`bin/coastal_estate_outdoors.py` after the library and entrance architecture, then
bakes and exports one final native house. No retained `.blend`, public GLB, manifest,
or browser runtime is committed by this worker.

## Site plan

Coordinates below are native Blender metres: +Z up, +Y toward the Pacific. Positive
X appears on the left in a frontal sea view.

| Element                 | Native bounds and use                                                                                                                                                         |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Connected terrace       | X −8.5…8, Y 4.58…12.8, finished Z 0; 79.65 m² of dry slab around the actual pool aperture                                                                                     |
| Uninterrupted swim lane | X −7.8…3, Y 9.3…11.65; 10.8 m long, finished water depth 1.35 m                                                                                                               |
| Sun shelf               | X −7.8…−3.3, Y 6.9…9.3; 22 cm water over the actual tiled floor, with two original curved shell chaises                                                                       |
| Pool entry              | X −3.3…0.3, Y 6.9…9.3; seven genuine treads with uniform 18 cm risers                                                                                                         |
| Social pool bay         | X 0.3…3, Y 6.9…9.3; 85 cm water, two submerged round stools and a low bench, beside the dry wet bar                                                                           |
| Entertaining pavilion   | X 3.65…7.9, Y 6.6…11.7; supported oak cover, barbecue and recessed prep sink, wet bar, elliptical stone dining table and six chairs                                           |
| Arrival landscape       | Existing stair and landing retained; three edged native-grounded meadow beds, a contour-following mineral path, two view benches, low lanterns and a layered stone/oak portal |

The former thin ledge is replaced by a deep pool ring beam, front edge girder and
three broad battered stone webs. Their rear sockets meet actual retained cliff
triangles and extend into the rock. This makes the load path legible; it is an
architectural model rather than structural engineering certification. The pool has
an actual catch trough and dry perimeter guard. Water remains excluded from Walk.

The quiet library belongs on the opposite, negative-X side. Its east masonry wall
occupies approximately X −8.55…−8.43. The outdoor rock cutter stops at X −8.39,
preserving that wall and its reveal. The narrow strip west of the pool is **not**
advertised as a library entrance; library access remains through the rear approach.
The positive-X pavilion leaves X 8…11.5 clear toward the gym.

## What inspection changed

- The old palm was rooted over the excavated stair. Its trunk and entire crown move
  together to a measured native support at (7.25, −17), retaining their authored
  sway weights.
- The old 17-stone landward path and six-stone portal branch are retired. Their
  replacements follow the evaluated terrain triangles instead of an old height
  equation. Bed edging stops where the path crosses; it does not create a concealed
  trip barrier across circulation.
- Local leaf cards and the old triangular groundcover are removed before the new
  meadow roots are placed. New mineral mulch follows the same retained triangles.
- Applying an Exact Boolean to the old open-bottom ledge produced a large cap over
  the pool in the first render. The replacement now retires that ledge and parapet
  directly, preserving only the fire nook's real bench and plinth. Pool floor rays
  start above water so they catch an obscuring cap.
- Two old rosemary planters occupied the enlarged water footprint. Each pot and its
  complete foliage move together onto dry deck.
- The prep sink actually passes through the stone counter and cabinet. A circular
  mesh resting over an uncut countertop is not accepted as a hollow basin.

## Retained verification

Blender 4.5.9 LTS builds the module twice with identical delivered object names and
vertex/face counts. After the final weighted-normal pass, the addition has 39
material-batched meshes, 30,044 vertices and 45,120 triangles. It adds no texture
downloads and no native lights.

The native contact audit checks 21 pool-floor samples, all 123 planted roots and
three retained cliff sockets. It also verifies that both chaise feet meet the
actual shelf, their seats clear the water by 9.6 cm, and the prep sink reaches a
real recessed bowl at Z 0.835. Maximum measured pool-level discrepancy is
0.00000030 m; maximum root discrepancy is 0.00000596 m. These are source-contact
measurements, not measured phone performance. The public compressed exports,
combined-house circulation, day/night lighting and final browser appearance still
belong to the coordinator's integration checkpoint.

Raw preview `.blend`, manifest patch, repeat-build log, contact JSON and native
renders are under the ignored `.jekyll-cache/estate-outdoors/` directory. The early
pool cap was rejected and its corrected render retained; final chair, planter and
sink refinements must be included in the combined browser review.

Reproduce from a named final architectural source:

```powershell
& D:/tools/blender-4.5.9-windows-x64/blender.exe -b --python-exit-code 1 --python bin/refresh_coastal_estate_outdoors.py -- --source=PATH-TO-ARCHITECTURE.blend --manifest=PATH-TO-ARCHITECTURE.json --repeat-check
& D:/tools/blender-4.5.9-windows-x64/blender.exe -b --python-exit-code 1 --python bin/review_coastal_estate_outdoors.py
```

The refresh helper defaults to ignored outputs. Passing retained source or public
manifest paths as explicit output arguments is the coordinator's final integration
step. New lighting coordinates live under `estateOutdoors.pavilion`, `.portal` and
`.garden`; pavilion perimeter strips reuse the existing terrace schedule and emitter
count. Runtime bounds must include the new terrace front at browser Z −12.8.

## Design references

The geometry is original. The coordinator reviewed primary references for
principles, without copying images, plans or models:

- [WOHA, Alila Villas Uluwatu](https://woha.net/project/alila-villas-uluwatu/): local
  stone, cliff, pavilion and planting read as one architecture.
- [Aman, Amangiri](https://www.aman.com/resorts/amangiri): a pool court organized
  around retained rock, with a framed lounging terrace.
- [Ledge Lounger, in-pool chaise loungers](https://ledgeloungers.com/collections/in-pool-chaise-loungers):
  the shallow-water chaise typology informs the 22 cm shelf; the chair meshes here
  are independently authored.
