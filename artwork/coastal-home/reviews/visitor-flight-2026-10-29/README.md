# Cliff jumps, pool entry and the native beach

This is a local functional checkpoint for Sirui's requested cliff jumps. It does not complete the mountain, entrance-stair, room-decoration, avatar-contact or physical-phone performance work. Publication and CI readback belong to the coordinator's later release receipt.

The visitor can jump with Space, the touch Jump button or a new controller A press, fall without damage, enter the actual pool, float and climb out by the native steps. A second airborne press adds no impulse. The near-beach collision field now reaches the actual shore instead of ending at the old house-only bound. Falling eyes follow the body; the full airborne state survives leaving and returning to Walk.

No native `.blend` or GLB changed in this checkpoint. The current pouf/source remains the published `75afc57f…` revision. Source bindings cover the actual native source, delivered home geometry, manifest and runtime. The official cache was regenerated: signature `947dbaa666db522e59b9291e63705e51b72a15b4ab4839fef96109a590364bbd`, SHA-256 `308e7ab19f76d6b226f0513b3301e5ac0c8119f4c1f8ac04d0e6f4becd28628f`, 792,953 bytes. No cache JSON was merged by hand.

The separate settled-light check enters Look around, waits for visible flora/hinterland and samples another 22 seconds. All 32 model timings are present; the actual runtime stays ready with a restored 619,353-triangle cache and no lighting error. This does not qualify the independent F6 candidate, whose geometry and field budget differ. The first probe incorrectly waited for optional outside models before entering Look around; its readiness timeout was a fixture error, not an empty furnished scene.

## Actual journeys

- `journeys/native-complete-route.json.gz` and its Mesa counterpart retain the completed study→covered patio→study→living→patio→living route after the collision/flight integration: 41 actual waypoints, more than 100 metres, no later body/door/camera placement and no sustained obstruction. The native three journey cases passed; the first added touch case exposed a harness limitation, so the original combined native log remains under `attempts/`.
- The earlier pinned Linux/Mesa run passed all four relevant journeys/control cases, with four explicit project skips, in 19.8 minutes. The functional 480×320 reduction happens only after full assets load and is disclosed. It is not a GPU or phone performance result.
- `journeys/*-final-pool.json.gz` records the final native, Mesa and modern WebKit pool journey, including material ownership and actual sheet-shader compilation. One supported starting fixture is followed by ordinary keyboard steering, jump, entry, buoyant recovery, a real turn and wading up the original treads. Entry speed exceeds 8 m/s, the modal amplitude bound stays below 0.12 m, and spray/foam recover fully.
- The separate beach case crosses real air and descends more than 10 metres onto native ground, without a respawn. Both Chromium and WebKit pass it; the actual native-mesh CPU tests independently cover pool/steps/beach support.

The final combined native pool/touch/new-footer-ground run passed four cases with two explicit project skips in 1.7 minutes. Modern Windows WebKit 27.2 passed the same three applicable cases in 4.9 minutes. The final Mesa pool/touch run passed two cases with two project skips in 5.3 minutes. These are functional checks, not physical-device measurements.

## Touch and visible output

`controls/` retains actual 390×1000 and 844×390 screenshots, target rectangles and hit testing. Jump has an 82.5×44px target with a 24px gap above Look; it does not cover either thumb stick. Trusted taps launch the body, an airborne tap cannot double-jump, and the button disappears outside Walk. WebKit rotates in place. Chromium's native OS fullscreen cannot be resized by Playwright, so its second orientation uses the real exit/resize/re-entry controls. That difference is explicit; no CDP-only crop is presented as a furnished phone view.

The failed raw-CDP screenshot experiment captured the underlying page rather than the fullscreen presentation. It was rejected despite passing metadata/physics checks. Earlier boolean/string fullscreen assumptions and the rejected capture are retained in the harness logs. Actual accepted screenshots use the normal Playwright capture path. The pixel gate also rejects uniformly black/background-only canvases.

An older Windows WebKit build failed before jumping with an empty resized canvas; its original failure is preserved. The modern 27.2 engine passes. This does not relabel that older failure or replace the outstanding finished-build iPhone check.

## Splash appearance and limits

`appearance/phase-0.png` through `phase-5.png` show a controlled-clock witness at approximately 0.033, 0.117, 0.200, 0.283, 0.533 and 0.783 seconds after an actual entry. Only after that real jump does the witness switch to an independent observer camera. Its disclosed 30Hz functional clock and free camera are not another visitor journey or a performance benchmark. The full scene and ordinary rendering pipeline remain.

The finite-depth, zero-mean basin modes drive the native grid's height and slopes. Ballistic, volume-preserving spray, patchy surface flecks and a low spreading sheet provide a bounded appearance proxy. The sheet is still stylized and the surface ripples are subtle in some light; no photorealism or solved breaking-water interface is claimed. Equations, coupling limits and resource bounds are in [POOL-IMPACT.md](../../../../assets/js/home-scene/POOL-IMPACT.md).

Retained attempts include the first opaque blue cup, a glass-like shard trial and later material studies. A concrete defect explained several poor frames: the shared scene finish cloned the dynamic water material and removed its shader hook. The final meshes own their materials explicitly, matching the native pool's existing contract. Browser evidence now checks both identity retention and actual shader compilation after streamed models finish.

The photographic shape study was [Lavi Perchik's pool splash](https://unsplash.com/photos/person-diving-on-pool-splashing-water-1qCSGzVEKKQ); no photograph or extracted texture was added to the site. The result remains a procedural effect.

## Gates and reproduction

All 911 Node tests completed: 904 passed and seven existing tests skipped. All 319 Python tests passed. The final complete production build took 122.41 seconds. Targeted Prettier, the style contract and diff checks pass. A read-only check of all 1,719 intended files passes with Git line endings; the raw Windows checkout check reports 1,239 CRLF-only differences, which were not rewritten. The registry covers 141 unique scene cases at each of the four standard widths, with no omission or duplicate. This final build also includes the independently reviewed footer terrain and Duh reading fix. Later independent cases can extend that inventory.

The earlier full route precedes the later splash-material refinement; the body/collider/route/native sources did not change afterward. The final three-engine pool checks explicitly verify the refined material path. `checks/` retains both scopes, and `attempts/` preserves the failures instead of treating a later pass as their result.

Run the relevant `visitor circulation:`, `visitor flight:` and `visitor controls:` cases in `test/visual/estate-redesign.spec.js` against a complete owned build. Pinned Linux uses `bin/visual_scene_environment.cjs` and the qualified scene configuration. Its browser evidence is Mesa software functionality. `checks/modern-runner.json.gz` records the isolated modern WebKit runner used on Windows. `producers/` retains the appearance witness. Verify this sealed checkpoint with `python artwork/coastal-home/reviews/visitor-flight-2026-10-29/verify.py --git <checkpoint>`; later source revisions need their own acceptance.
