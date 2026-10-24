# Connected arrival and lounge, October 23

The main route starts at the clifftop portal, follows the retained 32 treads, turns down 16 new
treads behind the landward wall, and reaches the ground-floor foyer and public living circulation.
The upper gallery remains a side entrance. A native decorative rail that crossed that doorway is
cut, while guards identify the stair opening's closed edges. The former sage cupboard banks are
removed; a recessed oak coat and shoe bench serves the new arrival.

`native-route.json` measures the actual retained Blender triangles at all 58 main-route points:
floors agree with the manifest within 2.5 mm, and the minimum headroom is 2.227 m. The new lower
flight has at least 2.57 m over its tread centres. The separate runtime test decodes the delivered
Draco assets and advances its real capsule both ways over the main route, upper side entrance,
and a clifftop loop. Root release evidence records the browser's input journey and mobile cost.

`lounge-before.png` and `lounge-after.png` share the existing manifest camera. They show removal
of the intrusive rear cupboard banks, cushion welts, slightly leaned loose pillows and one draped
throw. The after study includes an analytic pendant stand-in; Blender uses placeholder designed
furniture and its own preview light, so it is not a capture of the browser's final lighting. Native
entry-turn and lower-foyer iteration renders remain in `.jekyll-cache/architecture-candidate/`;
the final small entry fixtures were subsequently placed on the walls to keep headroom clear.

`asset-report.json` binds the four delivered GLBs to their baseline and final hashes, byte and
triangle counts. The additional circulation and upholstery reuse the existing material batches,
with no new texture downloads or renderer passes. Source and emitted lighting are a practical
browser scene, not a claim of photographic materials or physically simulated cloth.

Rebuild with Blender 4.5.9 LTS:

```powershell
blender -b --python-exit-code 1 --python bin/refresh_coastal_arrival_living.py
blender -b --python-exit-code 1 --python bin/bake_coastal_light.py -- --prefixes=core_arrival_,lounge_
blender -b --python-exit-code 1 --python bin/optimize_coastal_exports.py -- --only=home-shell,coast,room-onsen,room-lounge
blender -b --python-exit-code 1 --python bin/review_coastal_arrival.py
```
