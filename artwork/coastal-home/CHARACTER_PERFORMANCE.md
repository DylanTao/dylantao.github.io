# Character performance — October 2, 2026

The five original Sirui studies now have paired sculpted upper/lower eyelid surfaces and two native `BlinkL` / `BlinkR` morphs. `bin/coastal_expression.py` fits the patches to the retained eyes, including the actual protruding iris and catchlight envelope. It attaches the lids and sclera to Head while the iris/pupil continues to follow the named Eye joints. The existing head, hair, face, spectacles, body, fingers and all fourteen authored clips remain intact. These are original Blender surfaces, not imported studio models or generated images.

`character-performance.mjs` layers an occasional asymmetric blink, quiet breathing at the neck, and a bounded pointer invitation onto the existing routine. The eyes lead the head, attention briefly holds, and it returns to the activity with a cooldown. Pausing, reduced motion, a hidden viewport or mode change interrupt the glance and compose neutral lids; the sleeping pose uses closed eyes. Strength, walking, coffee preparation and carrying suppress additive neck motion. No Spine, wrist, finger, foot or Root transform is modified by this layer.

The eye/head bandwidth distinction and habituation take architectural inspiration from Disney Research's [Realistic and Interactive Robot Gaze](https://la.disneyresearch.com/wp-content/uploads/root.pdf). This implementation is a small authored pointer-response layer, without the paper's camera perception or physical robot apparatus. It does not claim film production quality, biological simulation, automatic face detection or Disney affiliation.

[Expression measurements](reviews/character-expression.json) retain raw bytes and computed gzip equivalents per delivered GLB. Each avatar adds one 792-vertex / 1,280-triangle lid mesh. The runtime module is 6,040 raw bytes and 2,180 computed gzip bytes. Computed gzip size is not a measurement of HTTP transfer encoding. [Exact retention checks](reviews/character-retained.json) compare rest vertices, polygon/material connectivity, limb/finger weights, rest bones and every authored animation key with `4767b7805`; all five match exactly. Only static ocular weights and the additional eyelid mesh are changed.

Reproduce the focused update and inspection with Blender 4.5.9 LTS:

```powershell
& $blender -b --python-exit-code 1 --python bin/refresh_coastal_expression.py -- --baseline-ref=4767b7805
& $blender -b --python-exit-code 1 --python bin/review_coastal_expression.py -- --baseline-ref=4767b7805
& $blender -b --python-exit-code 1 --python bin/render_coastal_expression.py -- --baseline=.jekyll-cache/visual-qa/human-performance/ghibli-before.blend
node --test test/character-performance.test.mjs
```

The full character builder calls the same expression helper. Matched actual Cycles open/closed studies, Ghibli's closed profile, and actual Docker browser captures are under `.jekyll-cache/visual-qa/human-performance/`; those local QA files do not ship. Initial coverage at the sclera depth left the protruding irises visible and was rejected. The delivered closed surfaces cover those optical layers with visible clearance from the spectacles in the inspected native profile. This visual review is separate from a continuous eyelid/glasses collision proof, which is not supplied.

Five focused motion/rig tests, all 166 Python checks, the style contract, syntax/formatting and the exact retained-source review passed. Coordinator acceptance adds the combined responsive lifecycle/contact checks and current production build. The human geometry retains the five existing stylistic interpretations; it is not a photographic likeness reconstruction or a replacement of the house.
