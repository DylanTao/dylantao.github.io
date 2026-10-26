# Whiskey evening, October 26

This checkpoint connects the existing whiskey corner to whiskey nights in the authored routine. The original strict house-overlap blocker is retained below as history; the subsequent [PC cliff repair](../pc-cliff-2026-10-26/README.md) physically moves complete agave rosettes clear of the chimney and passes both native/decoded audits without changing their ratchets. Final production/CI/live acceptance is recorded by the coordinator. Item 22 remains open for the broader character and routine review.

## Placement and contact

The room and niche came from `4b93e637f`. The loveseat still faces the ocean at `[-10.50, 0, 2.55]`, yaw π. Its occupied seat changes from local x `-0.28` to `+0.28`; its ottoman follows that seat from world x `-10.22` to `-10.78`. The side table stays at `[-11.45, 0, 2.50]`, clear of the east passage. Moving that table to the other side would narrow the library's approximately 0.72 m circulation aisle.

The original left seat could not reach the table: measured shoulder-to-table distances were 0.84–0.92 m against the delivered arm chain's 0.513 m length. The first corrected-seat attempt also placed the ankles too far forward, at the ottoman centre. It left 6–8 cm of ankle drift; [that failed measurement](attempts/ankles-at-ottoman-centre.json) is retained. The accepted ankle targets use the near half of the cushion, loveseat local z `+0.74`, ottoman local z `-0.12`, with a 0.09 m spread and ankle centres 0.075 m above measured support.

The [native fixture](seating-whiskey-loveseat-lounge.json) uses the actual deformed source skins and an analytic two-bone leg solve. All five styles have zero measured ankle gap, positive knee rise and 35–44° knee bend, with no hard-furniture vertices inside the avatars. The human feet compress the soft cushion by up to 0.0243 m. The Lizard tail still penetrates the soft seat by 0.0726 m. The historical left-seat fixture in `../life-2026-10-24/` is unchanged.

[Source comparison](source-change.json) hashes every native mesh's vertices, polygon topology and world matrix. The only changed mesh is `library_placeholder_study-whiskey-ottoman`. The matching library GLB is re-exported through the existing optimizer. [Native walk contacts](native-contacts.json) survey nine routes and 133 samples, with no failures. The perch-survey generator changes only its source hash; every support patch, foot sample and delivered hash remains identical.

## Authored behavior

The manifest schedules remain unchanged: weekday lounge runs **21:30–23:00**, weekend lounge **20:00–22:30**. The existing deterministic daily drink choice controls the station. Whiskey uses `study-whiskey-lounge` in `library`; cocktail, beer and coffee retain their existing lounge setting. The library's public visit spot remains separate from the occupied seat.

The setting reads its per-style fitted root shifts from the native fixture. It probes the real streamed ottoman and table rather than their retired placeholders. The glass rests on a free tabletop point between the existing decanter, bottle, glasses and ice bucket; its measured base height is approximately 0.578 m. Whiskey preserves both authored menu variants: a highball and whisky on a clear cube.

The arm sequence reaches, grasps, lifts, sips, lowers, releases and returns to the lounge clip, with long varied pauses. A table-supported glass has no held-prop representation. The two legs retain their measured supports during sips. Pause redraws reproduce the same pose, Walk/travel leave the glass on its table, and returning to the routine restores the setting. Head performance yields while the glass is held, so a second gaze layer does not move the lips away from the authored sip.

## Evidence and limits

The browser uses actual delivered room, furniture, tableware and avatar GLBs. The local proxy serves this worktree's models/modules and the coordinator's complete production-baseurl build for the rest of the page. The 4K stills use 1920×1080 CSS at DPR 2; phone uses a 390×1000 CSS viewport. The fixed evening camera is target `[-10.9, 0.72, 2.05]`, yaw `3.5`, pitch `0.26`, radius `2.6`. Close views use the capture tool's measured head camera. Reduced-motion stills intentionally show a sip.

The recorded live renderer is NVIDIA GeForce RTX 3080 Ti through ANGLE/D3D11, WebGL 2. Its fullscreen resolution governor reports 8,294,400 pixels, factor 1 and cap 1 in this bounded view. This is a resolution receipt, not a frame-rate or physical-phone performance claim.

Actual images were inspected for all five styles. Both feet read supported; the glass appears at the mouth and on the table in the corresponding states. The close views also expose existing shoulder/underarm skin openings. The grip appearance and skin intersections need further character review: submillimetre wrist-target drift does not establish perfect finger contact or absence of skin clipping.

The first continuous live capture was retained in the ignored QA directory as a timing-mixed attempt: taking a PNG can span seconds, so evidence sampled after it can describe a later pose. `--freeze-capture` pauses only while taking each final live PNG and records both sides of the capture. A failed first frozen-capture run tried the Pause button while its Explore menu was closed; that harness failure is retained too. Neither attempt changes the product assertions.

The new browser case is registered in `test/visual/scene-groups.json` as “coastal home: whiskey evenings support feet and set the glass on the side table”. It checks supported feet, bounded wrists, table rest, exact Pause state, fullscreen Walk, activity clearing and Now recovery. Desktop covers all five styles; the three other standard widths cover Ghibli. The case uses a dry past whiskey date, October 1, to stay outside the rolling forecast.

The CPU replay covers both glass variants on all five delivered rigs for 100 seconds each, including Pause/Walk/return, with ankle drift below 1 mm and wrist-target drift below 3 mm. Initial source checks correctly failed the stale light-cache and perch bindings; the generators, rather than hand edits to those bindings, refresh them.

Final checks: Node **804 passed, 7 skipped, 0 failed** (811 cases); Python **306 passed, 1 failed** (307 cases), solely the strict overlap bound below. The four Chromium viewport cases pass, and the same case passes WebKit/iPhone. The scene registry has no missing, extra or duplicate membership. Style contract, targeted Prettier and whitespace checks pass. The drawing byte budgets remain unchanged; the test now derives arrival rooms from the actual daily routine rather than only the activity's base room.

The [cache receipt](cache-receipt.json) records the generated cache and proves that only `staticLightFieldCache` changed in the manifest during the bake. [The drawing receipt](loading-sketch-receipt.json) binds every regenerated drawing to this native source. The final baked-light [4K view](browser/post-bake-4k/4k-fixed-lounge-ghibli.png) and [phone view](browser/post-bake-phone/phone-fixed-lounge-ghibli.png) were inspected after the bake; the all-style and close fixtures record their earlier lighting state explicitly.

## Remaining strict audit failure

[The exact control](overlap-control.json) retains the failing site from both native audits. The same pair, depth, sample and severity occur before and after this ottoman change:

- `core_fireplace_cap__golden coastal sandstone`
- `core_retreat_roof_planting__core_liftaway_cave_ceiling_rear`
- depth **0.054 m**, retained bound **0.052 m**
- native sample `[0.92, -6.982, 7.375]`; Three world `[0.92, 7.375, 6.982]`

Both named objects' exact geometry/world-matrix hashes are unchanged. The audit tool, thresholds and verdicts are unchanged, and the historical compact report's `before` record is preserved exactly as data. Full raw native, delivered and before-control audits remain under `.jekyll-cache/visual-qa/whiskey-2026-10-26/`; their hashes are recorded in the control. The coordinator will inspect the physical seam and sampling method in the subsequent geometry pass before publication.

The coordinator's native follow-up identifies the second object as an agave leaf batch, rather than the solid rock roof. The subsequent physical repair moves the complete rosettes clear of the chimney and re-grounds them on their roof. All 282 delivered leaves/32 rosettes pass the unchanged grounding limits. This whiskey-only checkpoint did not change that planting, its threshold or its verdict; the combined source and later audit are bound separately in the PC cliff review.

## Reproduction

Use exactly Blender 4.5.9 LTS (`8bf95cbd38d1`). After rebuilding the room/anchors, rerun the native seating fixture, the library optimizer, native walk contacts, perch survey and both overlap audits. The loading drawings are regenerated from source-routed views, including library as a possible whiskey arrival. Re-bake the light cache after the final scene inputs; never merge its JSON by hand.

```powershell
& 'D:\tools\blender-4.5.9-windows-x64\blender.exe' --background -t 8 --python-exit-code 1 --python bin/review_coastal_seating.py -- --item=whiskey-loveseat --clip=lounge --seat-x=0.28 --with=whiskey-ottoman@0.28,-0.86 --feet=0.28,-0.74 --render --out=artwork/coastal-home/reviews/whiskey-2026-10-26
node --test test/whiskey.test.mjs test/dining*.test.mjs test/routine.test.mjs
$env:NO_WEBSERVER='1'
$env:VISUAL_BASE_URL='http://127.0.0.1:4103/al-folio'
$env:VISUAL_PORT='4103'
npx.cmd playwright test --config test/visual/public.config.js desk-scene.spec.js --grep 'whiskey evenings' --workers=1
node bin/run_visual_scene_group.cjs scene-core-1 --project all --verify-only
node bin/build_loading_sketch.cjs
node bin/build_loading_sketch.cjs --check
$env:COASTAL_CACHE_URL='http://127.0.0.1:4104/al-folio/'
$env:COASTAL_BAKE_TIMEOUT_MS='900000'
node bin/bake_coastal_static_light.cjs
node --test test/static-light-cache.test.mjs
```

This checkpoint does not certify other open item-22 behaviors, avatar skinning, the cliff/animal issues reported later on this PC, CI or the deployed site. The coordinator owns integration, final acceptance and publication.
