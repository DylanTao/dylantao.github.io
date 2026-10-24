# Guest bathroom and bedroom en suite

Two original stacked bathrooms expand the retained cliff house on its bedroom side. The clear
room plan is 3.4 × 4.25 m on each floor, at native elevations 0 and 2.6 m. A guest can enter the
lower room from the rear living aisle; the upper room belongs to the bedroom and has its own
clear dressing approach. The original main arrival, optional gallery entrance and all six
existing room anchors remain intact.

Both rooms have a genuine hollow wall-hung WC, an inset mirror cabinet, a fluted floating oak
vanity and hollow basin, a curbless shower with a readable glass edge, a linear drain, a recessed
shower niche and quiet warm fixtures. The en suite's celadon shower zone distinguishes it from
the guest room's pale honed stone. WCs sit behind full-height rounded privacy nibs and are not
visible from the two tested hall standing positions. Door leaves are visibly parked in their
pocket recesses, so access needs no new interaction control.

`geometry.json` records the authored objects and manifest contacts. `native-survey.json` records
raycasts against retained source triangles, plus exact source/export hashes and compressed sizes.
The shell also contains persistent `anchor_bath-living` and `anchor_bath-bedroom` EMPTY contacts
matching the room actor coordinates. `anchor-custody.json` verifies that adding those contacts
preserved all 291 retained meshes, including topology, material indices and baked vertex colours.
The authored stone door apertures are 1.2 m; the delivered minimum framed widths are measured
separately by the native Draco/capsule acceptance test, rather than represented as the same number.
Room ceilings provide roughly 2.34–2.35 m and the upper doorway about 2.28 m of clear height.
Existing cliff cover remains several metres thick: about 2.35–2.45 m at the old-cave join and
2.86–4.36 m over the main new wing. No new exterior opening or invented landscape image is used.

The three PNGs are direct Eevee renders from the retained geometry, not generated design boards:

- `bath-living.png`: guest-room camera, broad dry spine and curbless shower.
- `bath-bedroom.png`: the matching en suite camera and celadon glazed zone.
- `upper-wc.png`: the actual separate bowl, seat/lid and screened toilet compartment.

The native review uses warm area-light stand-ins for the browser's bounded mirror and shower
lines. Browser screenshots remain the acceptance evidence for the shipped material/light system.
The artist renders use 12 Eevee samples at 1050 × 744; they document modeled design and contacts,
not a claim of photographic rendering quality or physical-phone frame rate.

Rebuild from the repository root with Blender 4.5.9 LTS:

```text
blender --background --python-exit-code 1 --python bin/refresh_coastal_bathrooms.py
blender --background --python-exit-code 1 --python bin/bake_coastal_light.py -- --prefixes=core_bathwing_,bath-living_,bath-bedroom_,sleep_reno_wardrobe
blender --background --python-exit-code 1 --python bin/optimize_coastal_exports.py -- --only=home-shell,room-sleep,room-bath-living,room-bath-bedroom
blender --background --python-exit-code 1 --python bin/build_coastal_perch_support.py
blender --background --python-exit-code 1 --python bin/review_coastal_bathrooms.py
blender --background --python-exit-code 1 --python bin/refresh_coastal_bathrooms.py -- --preview=artwork/coastal-home/reviews/bathrooms --only=bath-living,bath-bedroom,upper-wc --samples=12
```

The preview does not save the source or manifest. After geometry/metadata integration, regenerate
the runtime static-light transport cache and loading sketch using their existing owned-preview
commands; the old transport cache must not be accepted for this geometry.

For an anchor-only repair, `refresh_coastal_bathrooms.py -- --anchors-only` updates the two EMPTY
contacts without rebuilding furniture or changing its baked colours; then export the shell and
refresh the source-bound perch metadata and native survey. The normal refresh creates the same
anchors idempotently.
