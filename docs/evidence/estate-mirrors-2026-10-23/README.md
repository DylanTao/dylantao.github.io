# Bathroom mirrors and Walk presence

Sirui's October 23 review asked for a bathroom mirror that reflects the surrounding room and himself convincingly, with a practical rendering budget. This checkpoint owns `interior-reflections.mjs`, the new `walk-presence.mjs`, and their focused tests. The coordinator owns controller wiring and final rendered acceptance.

## Observed limitation

The previous capture hid every world child except the active bathroom and the shell. This excluded the actual Sirui avatar, held props and adjoining rooms. Its invalidation key considered camera and light only, so including an animated person without changing that key would freeze him behind a stationary camera. Walk had a physical capsule and camera, but no visible body.

## Delivered approach

- Keep the real reflected camera and oblique near plane. Crop its projection to the mirror's visible rectangle, with a filtering guard band. The unchanged 128-pixel touch / 256-pixel desktop shared linear half-float target now spends its texels on the mirror, rather than on unrelated screen area.
- Include nearby loaded rooms and supplied live actor/prop roots when their conservative bounds intersect the reflected frustum. A 12-metre context bound excludes distant roots. The shell still encloses the view. Both mirrors remain hidden during capture, preserving the nonrecursive pass.
- Refresh changed composed content at the existing maximum 15 Hz, including when the camera is still. The composed scene clock and Walk's actual pose version drive invalidation. A paused or reduced-motion still, an unseen actor, a hidden room and a mirror outside the view do not create continuous capture work.
- Represent Walk with a bound skeletal clone of the selected Sirui avatar, using the existing idle/walk clips and shared geometry/materials. His world transform follows the actual capsule and its existing +Z-facing yaw convention. Native gait follows travelled distance; blocked input does not cause treadmill animation. Explicit reduced-motion movement updates the pose even while the idle clock is frozen. The native GLBs have one skin shared by 10–12 material primitives; preserve that sharing in the clone, so only one owned skeleton/bone buffer is needed per avatar rather than one per primitive.
- Hide the routine avatar while embodied and restore its prior visibility on leaving Walk. Its schedule, transform and skeleton remain independent. Avatar replacement and disposal release only the clone's skeleton buffers.
- Use a scoped built-in clipping plane just above the actual neck base (`Head + 0.04 m`) for the primary first-person render. Native inspection established that this rig's Head bone is the neck root, not the face centre. Looking down can still show the body. Reflections render outside this scope and retain the complete person. `clipShadows=false` preserves the complete shadow; bones and geometry are never collapsed. Warm both ordinary and clipped shader variants before presenting Walk, and restore material/renderer state even after asynchronous failure or an overlapping avatar replacement.

The module creates no animation loop, new model download, additional reflection target or screen-space ray marcher. The indoor reflection remains a bounded local view; sky, sea, distant scenery and recursive mirrors are excluded. Near-mirror roughness is still the authored satin material with bilinear target filtering, rather than a claim of a full microfacet reflection convolution.

## Research and decisions

[Eric Lengyel's oblique clipping paper](https://terathon.com/lengyel/Lengyel-Oblique.pdf) explains moving the projection's near plane to the reflector so geometry behind the reflective face is clipped. The existing implementation already follows this construction; the crop changes the X/Y projection before that step and retains the physical mirror plane.

The official [three.js Reflector implementation](https://github.com/mrdoob/three.js/blob/r164/examples/jsm/objects/Reflector.js) uses a reflected camera, projective texture lookup, half-float target, hidden reflector, disabled shadow-map refresh and restored render target. It also explicitly enables depth writes before clearing a reflection target. This checkpoint retains those practical choices and adds a projected crop and local content policy instead of increasing resolution globally.

The official [SkeletonUtils clone](https://github.com/mrdoob/three.js/blob/r164/examples/jsm/utils/SkeletonUtils.js) remaps the cloned meshes' skeleton bones into the cloned hierarchy while sharing geometry and materials. `cloneWalkSkeleton` follows that small correspondence algorithm, with credit and a link to the retained MIT license. Separate mixers preserve the routine's pose.

The [Material clipping contract](https://threejs.org/docs/pages/Material.html#clippingPlanes) specifies world-space clipping planes and a separate `clipShadows` switch. The pinned [WebGLShadowMap implementation](https://github.com/mrdoob/three.js/blob/r164/src/renderers/webgl/WebGLShadowMap.js) supports preserving shadow geometry while the primary view clips the camera's head interior. This avoids a custom fragment shader or cloned materials.

[Stochastic Screen-Space Reflections, SIGGRAPH 2015](https://advances.realtimerendering.com/s2015/) demonstrates the filtering and history machinery required for noisy screen-space reflection rays. [Pixel-Projected Reflections, SIGGRAPH 2017](https://advances.realtimerendering.com/s2017/PixelProjectedReflectionsAC_v_1.92_withNotes.pdf) describes a screen-space alternative limited to planar reflecting areas. For two small bathroom mirrors that must show a person outside the primary view, retaining a bounded real scene capture is the simpler fit. No screen-space reconstruction or temporal-history quality claim is made here.

## Verification

`node --test test/interior-reflections.test.mjs test/walk-presence.test.mjs`: **20 passed**. The assertions cover camera/plane geometry, projective correspondence at three angles, local scene inclusion, content cadence and stills, independent skeleton binding, capsule/yaw, distance-driven gait, native optical measurement independent of routine pose, clipping/shadow state, warmup, cancellation and resource/visibility restoration.

At the three retained numeric camera positions, the mirror crop occupies 10.47%, 11.94% and 52.82% of the original full-view capture. The geometric mean increase in linear texel density is **3.09Ã—, 2.89Ã— and 1.38Ã—**, respectively, at the same target dimensions. These are projection measurements, not device performance measurements.

Targeted source syntax, Prettier and `git diff --check` pass.

## Native browser checkpoint

A bounded Chromium harness loaded the delivered shell, both bathroom GLBs and all five native avatars, applying the real `createArtDirection(...).apply(root, "realistic")` material hooks. It used simple controlled lights to isolate reflection and clipping behavior; these screenshots do not establish the final scene's lighting or accessibility/layout acceptance.

- **All five avatars:** removing the actual Walk presence and refreshing the mirror changed **16,115–30,612 pixels**, all inside the mirror's projected rectangle. This distinguishes a genuine reflected body from a body merely drawn in the primary view. The person, opposite wall, doorway and stair change with the real geometry.
- **Both bathrooms:** the upper-floor Ghibli check changed **16,141 mirror pixels**. [Guest mirror](native-guest-mirror.png) and [bedroom mirror](native-bedroom-mirror.png) retain comparable camera framing.
- **Still and exit:** twelve additional manual still renders increased capture count from **19 to 19**. Leaving Walk restored `routineVisible: true` and `presenceVisible: false`.
- **Shader/runtime:** ordinary and primary-clipped variants were prepared; all browser error lists were empty and all recorded WebGL error codes were zero.
- **Compact target:** a touch/mobile browser context verified the 128-pixel target and a visible self reflection. The bare harness omitted a viewport meta tag, so that context used a 980-CSS-pixel layout; this is **not** a 390-pixel responsive acceptance result or a physical-phone performance measurement.

[Raw numeric evidence](native-evidence.json) records the initial working implementation before skeleton deduplication and the optical-offset API. It therefore records 10–12 owned skeletons. The [final native check](optical-evidence.json), with exact module SHA-256 values retained, verifies **one shared owned skeleton**, prepared shaders, the corrected neck-root plane and a live self reflection for Ghibli and Lizard after those changes. The final integrated browser checkpoint must confirm the final source together with controller lifecycle, production lighting and true desktop/mobile layouts.

The optical API measures the average native `Eye.L`/`Eye.R` anchor in the clone's bind/idle local frame. The raw forward offsets are **9.164 cm for Ghibli** and **19.270 cm for Lizard**. The second harness moves only the camera forward by `min(offset, 0.14 m)` along Walk's existing heading; body position, capsule and 1.6-metre eye height remain unchanged. The [shifted guest mirror](optical-guest-mirror.png) still records **17,368 changed mirror pixels** for Ghibli; Lizard records **27,072**, with no WebGL/runtime errors.

### Remaining visual limit

The optional [original near-vertical look-down view](native-look-down-limit.png) exposed an open clipped neck/torso ring: the initial plane incorrectly assumed that Head was the face centre and cut the shoulder/shirt at 1.28 metres. Moving the cut to **1.40 metres**, just above the measured 1.36-metre neck base, preserves more of the closed shirt and removes the broad clipped rim. Together with the conservative optical shift, the final [Ghibli](optical-ghibli-look-down.png) and [Lizard](optical-lizard-look-down.png) views show the body lower in frame and Lizard's feet. A small lower-frame open neck section remains in the extreme Ghibli view. Head clipping prevents camera obstruction and preserves the complete mirror/shadow, but that optional first-person composition is not accepted as fully polished body rendering. No filler cap mesh or painted self image was added, and no further quality experiments were performed after the bounded two-model correction check. Physical-phone frame rates also require an actual device baseline.
