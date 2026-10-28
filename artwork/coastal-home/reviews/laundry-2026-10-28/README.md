# Supported laundry bay ? 2026-10-28

The complete laundry installation moves to the dry service corner behind the pavilion kitchen. This clears the pool foreground and the sea view through the private-living rail. The coordinator reviewed the first paired native 4K compositions and preferred this direction; final physical gates now pass. This packet is a local candidate for integration, not a published site or a performance result.

## Comparable rendered result

| View                               | Frozen production                                  | Candidate                                                                                                                                          |
| ---------------------------------- | -------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| Pool, 3840 ? 2160                  | [Before](captures/baseline-pool-4k.webp)           | [After](captures/final-pool-4k.webp)                                                                                                               |
| Private living, 3840 ? 2160        | [Before](captures/baseline-private-living-4k.webp) | [After](captures/final-private-living-4k.webp)                                                                                                     |
| Complete supported bay             | ?                                                  | [4K detail](captures/final-supported-bay-4k.webp)                                                                                                  |
| Emulated phone, 390 CSS px / DPR 2 | ?                                                  | [Bay](captures/final-supported-bay-phone.webp), [pool](captures/final-pool-phone.webp), [private living](captures/final-private-living-phone.webp) |

The two 4K comparisons have identical camera, target, Lizard selection, actor position, activity and canvas dimensions. All eight WebP files preserve their source PNG pixels exactly; dimensions and hashes are in [captures.json](captures.json). Actual browser rendering used Chromium 145, ANGLE / NVIDIA RTX 3080 Ti / D3D11. Phone captures are Chromium emulation, not physical-phone evidence. The direct bay view starts at an explicitly labeled valid authoring walk station; the separate service-access route uses actual public W-key and pointer inputs without position injection during the route.

## Source and installation

The isolated branch starts at `75f621ad6e8fcecd333c29d6d4ed7eaae63f1368`. That commit's native source is **not** the admitted v84 file. The coordinator explicitly authorized intake of the frozen, then-uncommitted source SHA `4aaa7a66626af86d1c10ff021fda6a52e97e46caed3fad1e39c9e0173617d681`, its complete model family and flight preset. The receipt records all 123 copied inputs and matching before/after hashes. The unchanged complete production baseline is the coordinator's 4121 build, copied once: 1,353 files / 425,337,188 bytes. Every frozen copy still matches.

The retired native festoon posts were already absent from v84; the baseline live rope and clothes hung above the pool without those native masts. This patch therefore adds two real supported bronze masts rather than claiming to move nonexistent objects. `core_laundry_frame_posts` adds 328 triangles, reuses the existing dark-bronze material and carries `nativeLaundryFrame`. Existing topology, attributes, active color field, split normals, transforms, properties and materials checked by the recipe remain exact across all 467 retained native objects. All 183 delivered nodes, including 166 mesh payloads, retain exact Draco bytes, accessors, materials, transforms and extras. The new masts have closed mesh edges. Their new `AOColor0` is neutral white modulation, not a claimed new Cycles bake.

The complete line, four garments, nine pegs, knot anchors, mast contacts, floor and wind frame use one rigid placement. World wind is sampled at the actual relocated points and rotated back to local solver axes. Culling uses the same world transform. The retired parapet collider is absent from this bay; the legacy source path keeps its existing collider and offset behavior.

The first candidate retained at `attempt1/` failed: one footprint crossed a paving grout joint, and a live shirt shoulder sample reached 0.20078 stretch against the existing 0.20 limit. The whole installation moved 3 cm onto flat paving. The unpegged shirt shoulder/collar row now receives the same nearest-peg reach used by the lower rows. This adds 18 tethers (834 total), preserving 876 particles, 1,520 cloth triangles, six cloth draws, 30 Hz, six substeps and the existing maximum of two steps per frame. Wind strength and the shared solver are unchanged. Raw native failures, renders and first source stay under the owned ignored QA directory; the failed compact audit, frame recipe and strain diagnosis are portable here.

## Bounded verification

- **Native support and cloth:** all 18 footprint witnesses hit actual paving within 1.7e-8 m of the authored floor. All 19 captured garment poses have zero hard-geometry triangle crossings; minimum garment-vertex distance is 0.0510 m. This is a sampled pose check, not an all-weather guarantee.
- **Cloth dynamics:** 18 live browser poses peak at 0.16292 stretch; Pause holds vertex arrays exactly. Offscreen stepping holds and resumes when visible. Reduced motion is asleep with zero kinetic energy and no step increase. Three deterministic 60-second world-wind stress cases peak below 0.187. All 15 focused Node cases pass.
- **Public rendered regression:** the existing facade-cloth case passes at 1440 ? 1000, 1280 ? 800, 768 ? 1024 and 390 ? 1000. Its title, movement/pixel-difference, wind, stretch, Pause and reduced-motion assertions are preserved. Only its native inspection camera derives from the actual anchors. No registry change.
- **Bodies and structure:** nine native routes / 117 contact witnesses, 12 bearings and all four forward-cantilever controls pass. The real service approach/return has zero blocked frames. Emulated phone public move/look pads change position/yaw with zero blocked frames.
- **Companion:** 420 actual runtime routes / 3,629,951 samples pass the existing 0.42 m native envelope; minimum conservative native clearance is 0.44194 m. Every sampled center is also at least 1.84086 m from the conservative union box containing all captured cloth and rope particles.
- **Overlap:** full native audit includes streamed furniture. Deep sites over 5 cm: 288 / 350; severity: 33,574 / 50,250; visible z-fighting: 0.7289 / 2.2 m? (largest pair 0.201617 / 0.35 m?); grazing: 3.257 / 5.6 m. The four new hardware contacts are shallow seams at the paving/bed, with zero offenders. No thresholds or exclusions changed.
- **Bounds:** shell 896,520 bytes, +2,408 from baseline. Static potential 735,932 / 750,000 triangles. Preview cache 791,761 / 800,000 bytes. Existing complete-first-scene level-six gzip formula: 3,919,674 / 4,194,304 bytes. These are byte/geometry bounds, not timing or memory measurements.
- **Source binding:** 175 served bodies match their recorded hashes. Six explicit candidate overrides sit over the complete frozen production site; no local scene assets are omitted. The production manifest is equal except for the producer-generated preview-cache descriptor. Zero unexpected page/local-request errors. Raw console evidence retains the harness's three external empty-stub SRI errors and existing D3D11 shader warnings; it does not claim an empty console.

The focused style-contract and Prettier checks pass. JSON evidence is compressed deterministically under `evidence/`; exact tested modules and inspection/audit helpers are under `source/`. [bindings.json](bindings.json) records response bytes, comparison controls and limitations.

## Coordinator intake

Do not copy this worktree's dirty intake model roster or old-base manifest wholesale. The commit contains runtime/test changes and this review only. Preserve all newer root camera targets, labels, bed transfers, Lizard guards, pool behavior, character work and other models.

The reviewed native candidate remains at `.jekyll-cache/visual-qa/laundry-2026-10-28/candidate.blend`, SHA `92c06962eabe924b1e4cd91b32d06f23fa6407b63d83e64828c8309c03ce51ca`. Its only exported replacement is `candidate-assets/assets/models/home/home-shell.glb`, SHA `9cb7746437d43c6e8c40651d3b26994f81d1893186d7933626adfcad71a5998f`.

Alternatively, reproduce from the exact 4aaa intake with [patch_native.py](patch_native.py), which refuses another source hash or overwriting the intake:

```powershell
& 'D:/tools/blender-4.5.9-windows-x64/blender.exe' -b --factory-startup -t 8 --python-exit-code 1 --python artwork/coastal-home/reviews/laundry-2026-10-28/patch_native.py -- --source=<pinned-v84.blend> --output=<fresh-candidate.blend> --report=<recipe-report.json>
& 'D:/tools/blender-4.5.9-windows-x64/blender.exe' -b --factory-startup -t 8 --python-exit-code 1 --python bin/optimize_coastal_exports.py -- --source=<fresh-candidate.blend> --manifest=assets/models/home/manifest.json --models-out=<candidate-models> --report=<export-report.json> --only=home-shell --draco-level=10 --active-geology-ao
```

The tested portable replay exports the byte-identical shell above. Native file hashes differ with save/path metadata; the recipe checks retained semantic fields and the exported delivery. Compression remains level 10, position 14 / normal 8 / color 6 bits.

The coordinator still owns final source/model admission, manifest/cache and loading-sketch regeneration, combined production build, release checks and publication. The included cache is a **preview** producer run against frozen compiled inputs, signature `4f7ff3c0ebd84b8723f9eabcc95200004fed09c39a8062075d1d06a35c59f34e`, SHA `52c0470950707fa007574d2d0d5ace4354a15b2a888b94c61ba357fcfa3760a0`. It must not replace the coordinator's final source-bound bake. No independent push, canonical copy change or hardware timing claim is part of this packet.
