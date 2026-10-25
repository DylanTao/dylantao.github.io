# Sirui's feedback on the house, October 24

This log maps each of Sirui's feedback points on the 3D house to fixed views, so every change can be shown from the same camera before and after. Quotes marked "verbatim" are Sirui's own words. The other points are paraphrases relayed by the coordinator.

## How the views are made

All views are browser stills from `bin/capture_coastal_interior.cjs`, in full screen at 1600×1000 on the canonical Windows D3D11 backend. They use reduced motion, a fixed date and seeded randomness.

- **Interior views.** The named `feedback` survey visits every view in one scene load, with free lab cameras in three.js world coordinates.
- **Exterior views.** These use the `exterior-sea`, `exterior-sea-close` and `exterior-clifftop` shots.
- **Before.** Before frames show `main` at `85a6ece96`, the state Sirui reviewed, served with `COAST_REF=origin/main`. Day is 13:20 and night is 21:30.
- **After.** After frames will come from the same views when each group lands. Each point's "After" line stays pending until then.

```powershell
$env:COAST_BASE_URL = "http://127.0.0.1:4180/"; $env:COAST_VIEWPORT = "1600x1000"; $env:COAST_DPR = "1"
$env:COAST_CAMERA_SWEEP = "feedback"; $env:COAST_DATE = "2026-10-02T13:20:00-07:00"
$env:COAST_REF = "origin/main"   # omit for the working tree (after)
node bin/capture_coastal_interior.cjs .jekyll-cache/visual-qa/house-2026-10-24/feedback-before-day kitchen fullscreen
```

The durable picks are stored as WebP in [feedback/](feedback/). Each is named `<view>-<day|dusk|night>-before.webp`, and the after frames will follow the same pattern with `-after`.

## Arrival and entrance

### F1. The entrance geometry is rough

- **Before:** [clifftop entrance, day](feedback/exterior-clifftop-entrance-day-before.webp), [clifftop entrance, night](feedback/exterior-clifftop-entrance-night-before.webp), [arrival stair from the foyer](feedback/arrival-stair-up-day-before.webp), [arrival stair from above](feedback/arrival-stair-down-day-before.webp), [foyer](feedback/arrival-foyer-day-before.webp), [foyer corner](feedback/arrival-foyer-corner-day-before.webp).
- **What it shows:** the arrival stair is an open trench at the clifftop. It descends behind the living's back wall into a narrow foyer with bare corners.
- **After:** pending.

### F2. The onsen and the entrance path must not look into the living space

- **Before:** [onsen outlook, day](feedback/onsen-outlook-day-before.webp), [at night](feedback/onsen-outlook-night-before.webp), [onsen from the living, day](feedback/onsen-from-living-day-before.webp), [at night](feedback/onsen-from-living-night-before.webp), [foyer toward the living](feedback/arrival-foyer-day-before.webp).
- **What it shows:** the onsen sits on the open upper floor at the edge of the double-height living. Bathers look out over the living, and the living looks up into the onsen. The foyer opens straight into the living.
- **After:** pending.

### F3. Remove the misplaced spiral

- **Before:** [private spiral shaft](feedback/private-spiral-shaft-day-before.webp), [its clifftop opening](feedback/private-spiral-clifftop-day-before.webp).
- **What it shows:** the private spiral drops from a round, railed hole beside the clifftop lounge to the upper floor's back corner.
- **After:** pending.

### F4. "There should not be two stairs there." (verbatim)

- **Before:** [back wall overview](feedback/back-wall-overview-day-before.webp), [floating stair](feedback/back-wall-stair-day-before.webp), [arrival stair behind the same wall](feedback/arrival-stair-up-day-before.webp).
- **What it shows:** the arrival stair climbs behind the living's back wall while a second, floating stair climbs in front of it to the upper floor.
- **After:** pending.

### F5. A big pivot door on the textured back wall

Sirui's point: the main entrance belongs on the big, empty, textured back wall of the lower living, where the floating stair runs. It should be a big pivot-axis door that keeps the wall's texture.

- **Before:** [back wall, day](feedback/back-wall-stair-day-before.webp), [at night](feedback/back-wall-stair-night-before.webp), [overview, day](feedback/back-wall-overview-day-before.webp), [at night](feedback/back-wall-overview-night-before.webp).
- **What it shows:** the back wall behind the floating stair is the largest uninterrupted textured surface in the living.
- **After:** pending.

### F12. Kitchen and living export batch (coordinator)

Batched into the next kitchen and living export: remove the nook's breakfast plate and carafe, and turn the banquette and the cloud sofa into streamed furniture.

- **Before:** [nook](feedback/kitchen-nook-day-before.webp), [living sofa](feedback/living-sofa-day-before.webp).
- **After:** pending.

## Exterior

### F6. Blend the building into the rock

Sirui's point: shape or close the carved cavities, wrap rock around the volumes, set the terraces back and compose one elevation set into the cliff. Cantilever the pool and patio 1.5–3 m on a plausible structure, using sandstone, board-formed concrete, planting and intentional night lighting.

- **Before:** [from the sea, day](feedback/exterior-sea-day-before.webp), [dusk](feedback/exterior-sea-dusk-before.webp), [night](feedback/exterior-sea-night-before.webp), [closer, day](feedback/exterior-sea-close-day-before.webp), [closer, night](feedback/exterior-sea-close-night-before.webp), [clifftop, day](feedback/exterior-clifftop-entrance-day-before.webp), [clifftop, night](feedback/exterior-clifftop-entrance-night-before.webp).
- **After:** pending.

## Study, library and bedroom

### F7. Freestanding bookshelves block the view

Sirui's point: make the study spacious and keep the books on the walls.

- **Before:** [library from the desk end](feedback/library-from-desk-end-day-before.webp), [library overview, day](feedback/library-overview-day-before.webp), [at night](feedback/library-overview-night-before.webp), [sea corner](feedback/study-sea-corner-day-before.webp).
- **What it shows:** the study shares the tall library. A freestanding shelf run crosses its width, and the sea end holds the desk, two chairs and a daybed.
- **After:** pending.

### F8. A door from the study out to the patio and pool

- **Before:** [the study's patio wall, day](feedback/study-patio-wall-day-before.webp), [at night](feedback/study-patio-wall-night-before.webp).
- **What it shows:** glass and a full-height shelf line the patio side, with no way out.
- **After:** pending.

### F9. A whiskey corner facing the ocean

"i like whiskey so my study, i want a nice place and comfy small sofa with ottoman for me to enjoy whiskry and enjoy the ocean view" (verbatim), and "some nice bottles there".

- **Before:** [sea corner](feedback/study-sea-corner-day-before.webp), [library overview](feedback/library-overview-day-before.webp).
- **After:** pending.

### F10. The bed beside the library (option B)

Sirui's decision for item 12: a bed chamber carved into the fin beside the tall library, with a compact spiral down into the library by the desk. The bridge is removed.

- **Before:** [bedroom](feedback/bedroom-bed-day-before.webp), [upper bridge](feedback/upper-bridge-day-before.webp), [library spiral](feedback/library-spiral-day-before.webp), [private link from above](feedback/private-link-day-before.webp).
- **After:** pending.

## Corridor

### F11. Soft light and rounded niches with sculpture

Sirui's point: redesign the corridor with soft lighting and softly rounded wall niches. The niches hold sculptures in the spirit of Noguchi, Hepworth or Brâncuși, without copying any work.

- **Before:** [from the library, day](feedback/corridor-from-library-day-before.webp), [at night](feedback/corridor-from-library-night-before.webp), [toward the library, day](feedback/corridor-print-day-before.webp), [at night](feedback/corridor-print-night-before.webp).
- **What it shows:** the ground corridor between the kitchen and the library is a 1.4 m passage with one print and little light.
- **After:** pending.
