# Coastal wildlife

Twenty-eight animals live around the coastal home: two brush rabbits, five California sea lions (three hauled out, two swimming), three harbor seals, a raccoon, four Western gulls and a balcony gull, three sandpipers, five brown pelicans and four Brandt's cormorants. All eight species are original Blender models built by code. No downloaded mesh, motion capture, commercial texture or generated image is used.

## Models

Three scripts build the masters in Blender 4.5.14 LTS and keep their editable sources:

| Script                           | Editable source   | Exports                                                                                       |
| -------------------------------- | ----------------- | --------------------------------------------------------------------------------------------- |
| `bin/build_coastal_wildlife.py`  | `wildlife.blend`  | `BrushRabbit.glb`, `CaliforniaSeaLion.glb`, `HarborSeal.glb`                                  |
| `bin/build_coastal_neighbors.py` | `neighbors.blend` | `Raccoon.glb`, `WesternGull.glb`, `Sandpiper.glb`, then `wildlife-perch-support.json` (below) |
| `bin/build_coastal_seabirds.py`  | `seabirds.blend`  | `BrownPelican.glb`, `BrandtsCormorant.glb`                                                    |

`bin/coastal_wildlife_rig.py` turns each master into one skinned mesh. The parts' colours are baked into a byte vertex-colour layer, `Coat`, and the mesh draws with two materials: a matte coat, and a gloss for eyes, noses, bills and wet flippers. Bones point along +Z with zero roll, so every joint exports at identity rotation and the runtime poses each animal from its rest pose. The sea lion and seal have a hinged jaw with a mouth interior, the gull a lower mandible, the raccoon a three-bone tail, and the rabbit and raccoon separate chest and hip bones, so their backs bend. The pelican and cormorant have two neck bones, and their primaries are separate fingered feathers.

| Species             | Bones | Triangles | GLB bytes, before → after | Instances |
| ------------------- | ----: | --------: | ------------------------: | --------: |
| Brush rabbit        |    18 |    15,374 |           83,108 → 51,116 |         2 |
| California sea lion |    14 |     8,924 |           53,172 → 34,376 |         5 |
| Harbor seal         |    13 |     9,748 |           49,368 → 35,632 |         3 |
| Raccoon             |    24 |    13,864 |          100,960 → 49,332 |         1 |
| Western gull        |    16 |     6,132 |           38,524 → 22,912 |         5 |
| Sandpiper           |    15 |     5,248 |           36,444 → 20,696 |         3 |
| Brown pelican       |    17 |     7,584 |               new, 34,440 |         5 |
| Brandt's cormorant  |    17 |     6,404 |               new, 31,040 |         4 |

The six earlier masters were built from 12 to 23 separately drawn parts each and weighed 361,576 bytes. All eight skinned masters weigh 279,544 bytes. The 28 animals draw 56 primitives, where the 17 earlier animals drew 256, and 228,416 triangles.

## Acting

Every pose is a function of the scene's active time. Nothing integrates from frame to frame, so a pause, a slow frame or the reduced-motion still cannot drift, and the same time always gives the same coast. `wildlife-acting.mjs` holds the shared pieces:

- Behaviour comes in epochs with jittered boundaries, so no animal repeats on a fixed beat. Each epoch is a varied run of segments that opens and closes in a settled pose.
- Posture channels are springs driven by keyed targets. A linear spring's response to stepped targets is the sum of one step response per change, so each turn overshoots a little and settles, with no integration.
- Heads lead. Ears, tails, flippers and wingtips follow on lagged springs. Gaze moves in quick turns with irregular holds, and blinks come at irregular intervals.
- Flight joins are quintic transfers that match position, velocity and acceleration at both ends. Birds bank from their lateral acceleration, with an exaggerated gravity so slow miniature flight still leans into its turns, and wingbeats have a quick downstroke with the wrist lagging the arm.

Each species has its own repertoire:

- **Brush rabbits** (40 s epochs) sit and look about, hop in bouts along their clifftop loops, graze with chewing and head-up scans, groom, and swivel one ear at a time. About a third of the epochs hold a freeze, a bolt of four or five long bounds and a second freeze. In each hop the forepaws reach ahead and plant before the body arrives, the hind paws push from the take-off spot and swing through, and the ears lie back in the air.
- **California sea lions** (52 s) look about, bark in irregular pulses near 2.3 Hz with the neck stretched up and the jaw opening on each bark, point their noses at the sky, raise and fan a front flipper, yawn, lie down, roll onto one side and scratch with a rear flipper.
- **Harbor seals** (60 s) look about, curl into the banana pose with head and tail raised, scratch, yawn, roll, and shuffle down to the wash and back. They move only while the chest pushes, one hump at a time.
- **Swimming sea lions** (46 s cycle) porpoise along an offshore lane at about 2.3 m/s. Each leap clears the swell at about 30 degrees, with a splash crown where it enters. They then raft on the swell with a flipper raised, take a periscope look and turn slowly for the run back.
- **The raccoon** sleeps curled at its den by day. When the house's evening begins it wakes, stretches and forages round the clifftop loop: it digs, rears up to sniff, and washes food in its paws. At dawn it walks on round to the den.
- **Western gulls** (90 s) soar their loops with flap bouts and banked turns. A landing glides in over the clifftop rim to a point 4.2 m out and 1.55 m up, then flares with wings raised and tail fanned and absorbs the touchdown. A departure climbs out before it turns for the sea. On a perch a gull looks about, preens, stretches, gives a long call with its bill open and shakes. Now and then a flying gull hovers over an occupied perch, calling, and the resident crouches and gapes until it leaves. The balcony gull acts the same perched repertoire on the rail.
- **Sandpipers** chase the swash like sanderlings. They run up the beach ahead of each wave's run-up, then follow the drawdown to probe the wet sand, sprinting at up to 2.3 m/s.
- **Brown pelicans** glide in a line about a metre above the swell. Each bird repeats the leader's wingbeats at the same place, so a wave of flaps runs down the line. The line climbs out to sea, returns behind the outside camera and descends to the swell again. On alternate laps the last bird climbs to about 6 m, tips over with its wings swept back, rolls a quarter turn as it falls and plunges in. It surfaces, drains its pouch, shakes, runs off the water and flies 20 % faster until it regains its place.
- **Brandt's cormorants** (70 s) stand upright on low rocks at the cliff foot. They spend long spells with their wings spread to dry, shrugging and now and then fanning them in a few slow beats. Otherwise they look about, preen, stretch with the bill open and shake, and their throats flutter in short bursts.

The pelican line and plunge-dive follow the Cornell Lab's [Brown Pelican overview](https://www.allaboutbirds.org/guide/Brown_Pelican/overview): squadrons that glide above the surf, "rising and falling in a graceful echo of the waves", plunge-diving from height, and draining the throat pouch on the surface afterwards. The sandpipers follow its [Sanderling overview](https://www.allaboutbirds.org/guide/Sanderling/overview): small shorebirds "running back and forth in sync with the waves" and probing the wet sand left by receding waves. The cormorants are the Pacific coast's [Brandt's Cormorant](https://www.allaboutbirds.org/guide/Brandts_Cormorant/overview); their wing-drying, preening and throat flutter are authored acting, not taken from that page. The habitats follow the [City of San Diego's Children's Pool information](https://www.sandiego.gov/lifeguards/beaches/pool).

## Contacts

- **Sea surface.** The sandpipers, pelicans and swimmers sample the same displaced sea the renderer draws (`sampleOcean` in `ocean-spectrum.mjs`), with the coast's wind state (`oceanWindState` of `coastWind`), so they follow the wind-driven swell as it grows and turns. The sandpipers find the water's edge where that surface meets the shared beach section.
- **Planted feet.** Rabbit paws hold their take-off and landing spots. The raccoon's stance paws hold world anchors while its two-bone legs follow them, and its stride divides the loop, so the den's footholds repeat every lap. Sandpiper toes alternate planted, at the shared beach heights.
- **Perches.** `bin/build_coastal_perch_support.py` exports bounded support patches from the retained coast: three clifftop perches and the gallery rail for the gulls (21 and 16 triangles), and four rock roosts for the cormorants (68 triangles). It also exports sole samples of the skinned gull's feet, found by their vertex groups (194 per foot, tarsus 114 mm). The runtime fits each webbed foot to its patch, keeps the tarsus length and accommodates the difference in the hidden hips. Feet take the perch over the last 4 s of an approach and leave it in 0.45 s. The formatted JSON is 30,471 bytes and records hashes of the coast geometry and the gull GLB.
- **Right of way.** The west rabbit's loop passes a gull perch, so while a gull holds that perch the rabbit steps round it with about a metre of berth.

## Performance

- Each animal is one skinned mesh with two primitives that share a single skeleton and bone texture. Bounding spheres are generous so frustum culling never clips a pose.
- An animal that was not drawn in the last frame (off screen, or the camera is indoors) acts only on every twelfth frame, staggered across the animals, so its root still travels. If the camera turns to it in between, it acts just before it is drawn, so no stale pose reaches the screen. One that is still culled at its last position appears at its next update, at most eleven frames later.
- In an interleaved before/after comparison outside (Chromium, Intel Arc, the same server and seed), scene draw calls fell from about 1,804 to 1,061. Updating all 28 animals cost about 2.1 to 2.2 ms per frame outside and 1.4 ms indoors, where most of them are unseen.
- `test/wildlife-assets.test.mjs` holds the payload, triangle and draw budgets.

## Limits

This is authored acting, not measured biomechanics, aerodynamics or a physics solver. Contacts are checked at sampled times, not guaranteed between samples or for terrain that has changed since the support data was built.

- The swash edge uses the sea's vertical displacement only; the swell's horizontal drift is ignored. A bird's swash target is read once per half-second tick, under the wind state of that moment.
- The pelicans' sea contact is a sampled height, and the splash is a small particle crown, not a fluid simulation.
- Wildlife shaders compile lazily the first time a species is drawn, as they did before this pass; the scene's program warm-up does not include them yet.
- Rebuilds reproduce the same geometry, but Draco can order vertices differently between runs, so GLB bytes and the perch support's gull hash can change without any change in shape.

## Rebuild and review

Run each builder from the repository root with `blender --background --python-exit-code 1 --python bin/<script>.py`. `build_coastal_neighbors.py` finishes by running `build_coastal_perch_support.py`. Run that script alone (same flags) after any change to the retained coast or the gull, then format the JSON with Prettier. It never saves the coast or rewrites the manifest.

`bin/render_coastal_wildlife_rigs.py -- <blend> <out-dir> [pose-json]` renders Workbench review sheets of a source's rigs (pass absolute paths). `bin/capture_coastal_wildlife.cjs --plan=<plan.json>` captures frame-stepped browser shots on a paused clock against a running preview. Its frames, encoded videos and contact sheets go to `.jekyll-cache/visual-qa/`, which is not published.

The node tests `test/wildlife-*.test.mjs` cover the rigs, budgets, each species' repertoire, continuity and contacts. The desk-scene Playwright cases "coastal neighbours: keyboard inspection…" and "coastal neighbours: new raccoon and birds…" cover inspection in the browser. Realistic remains the only treatment, and this pass adds no public control.
