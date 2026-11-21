# Reflected sunlight in the lounge

[Matched standing photographs](../../../concepts/coastal-home/2026-11-20/reflected-sun-in-the-lounge.webp)

At 2:15 p.m. Pacific on November 20, the reflection lifts shaded oak by 7.83 and the inner sofa by 4.17 mean luma values in the 8-bit photograph. The sampled bright cushion, sunlit landing, media cabinet, and hearth match pixel for pixel. Exposure is 1.89 for both images. Both panels crop the same 1440 × 900 frame from y=218 and resize equally at the original exposure. The camera used actual Walk ground contact at [2.09, 0.00262, 4.44] m, with a held 49° lens and eye [2.11916, 1.60262, 4.57693] m. The lab holds the camera and switches the reflection in the same browser tab. Switching back reproduced the first PNG byte for byte.

## What the table measures

The released room comes from source `2273f067940b2bfda12ba839437ceb6118f42cf8` with signed static field `419cabc1b5d8dfb9bcc9c0ffd3fc9b954e8f265552574e3c7e1388c97af9e01c`. The tracer uses the loaded scene’s 738,069 retained opaque triangles, exact decoded positions and diffuse albedos. It traces 256 primary rays per valid lounge probe up to 16 m, and a shadow ray up to 64 m from each candidate reflecting surface. The 64 m query operates inside the retained static volume. The calculation approximates opaque, first-order diffuse transport.

The bake fits eight first-order irradiance vectors across a 4° azimuth × 2° elevation lattice. Signed coefficient bytes carry color and prior-elevation differences. The browser interpolates the four neighbouring directions, multiplies by the actual linear RGB of the current sun under the visitor’s weather, and uses the same probe visibility as the room’s base field. The geometric sun must be above the horizon and be the selected key. The exposure meter continues to use the original field. The other room probes retain their original coefficients.

Across 504 held-out solar directions from all 12 months, eight probes and fourteen receiver normals give 56,448 comparisons. The summed absolute error is 5.43% of the summed direct-trace reference, with mean absolute error 0.00185, P95 0.00878 and maximum 0.09106 in linear diffuse irradiance luma units. The reference peak is 0.61229. One sample predicts above 0.025 where the reference is at most 0.005. No reference above 0.025 falls to 0.005 or less. A separate 256-ray quadrature rotated 7° varies by 16.96% against the original reference. At the pictured angle the predicted peak is 0.1703 and the independently traced peak is 0.1904. The runtime has zero added reflection in the held night sample at 9 p.m. [Results and per-season metrics](lounge-solar-receipt.json)

The table is 349,410 source bytes and 44,887 bytes at gzip level 6. The browser requests it and its decoder after the first frame on a visit to or an approach toward the lounge. The preview recorded neither request during initial entry. Only the small controller and field hooks join first-scene delivery. All 96 decoded coefficients at the photographed sun direction and RGB agree bit for bit between the captured prototype and the final table.

## Authoring and replay

Run the regular static-light bake from a checkout with an owned root-site preview. The producer fingerprints the actual triangle and albedo pairs in the canonical collector, independent of asynchronous collection order. It binds that SHA-256 to the lounge cage, probe positions and validity, and primary trace limit. It retains and reattaches the table on ordinary re-bakes of the same physical input. The signed light snapshot and manifest descriptor carry the matching geometry fingerprint. The runtime checks those two fields and the uncompressed table’s SHA-256 before installing it.

```powershell
$env:COASTAL_CACHE_URL='http://127.0.0.1:8080/'
node bin/bake_coastal_static_light.cjs
node --test test/lounge-solar.test.mjs test/static-light-cache.test.mjs
python -m unittest test.test_coastal_assets.CoastalAssetsTest.test_complete_first_scene_budget_includes_all_rooms_furniture_and_selected_avatar
```

A change to the traced geometry, diffuse albedo or receiver layout makes the regular bake stop before publishing a stale field. Use the same authoring command with `--refresh-lounge-solar` to fit the replacement using the new bake’s actual arrays. Node does the directional tracing after Chromium closes. The producer writes the optional descriptor, table, signed static field and normal input inventory together.

Replay the pinned measurement from this review directory using a checkout with the full source commit and a root-site preview. Use an external working directory for OUTPUT.

```text
node collect-r2.cjs CHECKOUT 2273f067940b2bfda12ba839437ceb6118f42cf8 OUTPUT http://127.0.0.1:8080/
node build-lounge-solar.mjs CHECKOUT 2273f067940b2bfda12ba839437ceb6118f42cf8 OUTPUT
```

Serve the rebuilt checkout with the signed descriptor for the browser replay. It navigates via **Rooms → Living room → Walk**, locks the pose in the authoring view, and records the baseline, reflection and repeated baseline.

```text
node capture-lounge.cjs CHECKOUT OUTPUT http://127.0.0.1:8080/
```
