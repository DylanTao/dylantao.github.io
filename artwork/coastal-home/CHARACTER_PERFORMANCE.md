# Character performance — October 2, 2026

The five original Sirui studies now have paired sculpted upper/lower eyelid surfaces and two native `BlinkL` / `BlinkR` morphs. `bin/coastal_expression.py` fits the patches to the retained eyes, including the actual protruding iris and catchlight envelope. It attaches the lids and sclera to Head while the iris/pupil continues to follow the named Eye joints. The existing head, hair, face, spectacles, body, fingers and all fourteen authored clips remain intact. These are original Blender surfaces, not imported studio models or generated images.

`character-performance.mjs` layers an occasional asymmetric blink, quiet breathing at the neck, and a bounded pointer invitation onto the existing routine. The eyes lead the head, attention briefly holds, and it returns to the activity with a cooldown. Pausing, reduced motion, a hidden viewport or mode change interrupt the glance and compose neutral lids; the sleeping pose uses closed eyes. Strength, walking, coffee preparation and carrying suppress additive neck motion. No Spine, wrist, finger, foot or Root transform is modified by this layer.

The eye/head bandwidth distinction and habituation take architectural inspiration from Disney Research's [Realistic and Interactive Robot Gaze](https://la.disneyresearch.com/wp-content/uploads/root.pdf). This implementation is a small authored pointer-response layer, without the paper's camera perception or physical robot apparatus. It does not claim film production quality, biological simulation, automatic face detection or Disney affiliation.

[Expression measurements](reviews/character-expression.json) retain raw bytes and computed gzip equivalents per delivered GLB. Each avatar adds one 792-vertex / 1,280-triangle lid mesh. The small runtime module is approximately 6 KB raw and 2.2 KB computed gzip. Computed gzip size is not a measurement of HTTP transfer encoding. [Exact retention checks](reviews/character-retained.json) compare rest vertices, polygon/material connectivity, limb/finger weights, rest bones and every authored animation key with `4767b7805`; all five match exactly. Only static ocular weights and the additional eyelid mesh are changed.

Reproduce the focused update and inspection with Blender 4.5.9 LTS:

```powershell
& $blender -b --python-exit-code 1 --python bin/refresh_coastal_expression.py -- --baseline-ref=4767b7805
& $blender -b --python-exit-code 1 --python bin/review_coastal_expression.py -- --baseline-ref=4767b7805
& $blender -b --python-exit-code 1 --python bin/render_coastal_expression.py -- --baseline=.jekyll-cache/visual-qa/human-performance/ghibli-before.blend
node --test test/character-performance.test.mjs
```

The full character builder calls the same expression helper. Matched actual Cycles open/closed studies, Ghibli's closed profile, and actual Docker browser captures are under `.jekyll-cache/visual-qa/human-performance/`; those local QA files do not ship. Initial coverage at the sclera depth left the protruding irises visible and was rejected. The delivered closed surfaces cover those optical layers with visible clearance from the spectacles in the inspected native profile. This visual review is separate from a continuous eyelid/glasses collision proof, which is not supplied.

Six focused motion/rig tests, all 166 Python checks, the style contract, syntax/formatting and the exact retained-source review passed. Integration review corrected the exported Y-up gaze axes: horizontal invitations now rotate about Y, screen-up pitch about negative X, and only the head rolls about Z. The new optical-direction test protects that visible distinction. [Coordinator acceptance](../../docs/evidence/character-performance-2026-10-02/README.md) records combined responsive lifecycle/contact checks and the current production build. The human geometry retains the five existing stylistic interpretations; it is not a photographic likeness reconstruction or a replacement of the house.

## October 15: likeness pass

The four human studies' hair, brows, face skin and mouths were replaced to follow Sirui's 2D portraits (see [provenance](PROVENANCE.md)). The eyelid mesh, Blink morphs, Eye joints and every clip key are unchanged. `review_coastal_expression.py` therefore compares everything outside those replaced head features with `4767b7805`. `review_coastal_likeness.py` checks the replacement against `f403dfead`: exact retention of the rest, Head-only skinning, the sleep contact and clearances.

## October 24: meals, drinks and the hands that use them

Sirui's 4K review found a hand through the nook's table, an empty plate, and a fork and cup that bobbed to the face on a loop. Meals are now a seated story with modelled food:

- `assets/js/home-scene/dining-menu.mjs` rotates breakfast, lunch, dinner, dessert and the coffee by Pacific date. Each list cycles in full before it repeats, and a day's dishes recur together every 35 days. The evening drink keeps `routine.mjs`'s kind (whiskey, cocktail, beer, coffee) and chooses which one.
- `bin/build_coastal_table_setting.py` (with `coastal_table_geometry.py` and `coastal_table_dishes.py`) authors 22 plated dishes and desserts, eight glasses, a tea cup, cutlery, chopsticks, a linen napkin, a saucer and the drinks' garnishes. It retains them in `table-setting.blend` and exports them at two levels to `assets/models/home/table-setting/`. Food carries its colour in vertices over a Cycles contact-light bake. Each vertex's piece number (0 stays on the plate; 1 and up in eating order) rides in TEXCOORD_0.x.
- `dining-motion.mjs` plans each meal from a seeded stream. The plan covers the reach, the press that takes a piece, the lift as the head meets the fork, chewing and a swallow, sips that tip the glass at the lips, looks out at the sea, the knife laid down before a sip, the swap to dessert and a lingering finish. Beat lengths are drawn per action, so the timing varies from bite to bite. Hand changes blend from the grip they leave, not from the clip.
- `dining.mjs` applies the plan after the authored clip: a lean and a head turn, a two-bone arm solve to the utensil, glass or palm on the table, and closed fingers on the articulated Ghibli hands. A piece collapses off the plate as the fork takes it, and a mouthful-sized copy of that piece rides to the mouth. Liquid levels fall per sip, with the surface kept level as the glass tips. At breakfast the coffee bar's own cup rides in the fingers by its handle and rests on a saucer.
- Breakfast (`activities.mjs` `COFFEE_TIMELINE`) is one story per visit: coffee made once, drunk by the sea, then breakfast, and finally the cup is taken back to the bar.

Pause holds the bones, props and phase. Reduced motion composes the plan's first bite at the lips; redraws restore the clip's pose first, so the still never accumulates. While the visitor walks, or while Sirui travels, the cutlery rests on the table. Its materials reuse the house's configurations (porcelain, nickel, linen, walnut and the refrigerator's blended glass), and food uses plain vertex colour; measured program, draw and byte costs are in the checkpoint report.
