# Native house checkpoint v84

This is a frozen candidate for coordinator review. The native source, candidate GLBs, manifest geometry and companion preset are retained under `.jekyll-cache/visual-qa/finish-house-2026-10-26/`; [intake-manifest.json](intake-manifest.json) records their exact paths, sizes and SHA-256 values. They have not replaced the canonical authoring master or public assets. The committed packet contains the original rendered evidence and compact readbacks.

The native master is `attempts/v84/candidate.blend`, SHA-256 `4aaa7a66626af86d1c10ff021fda6a52e97e46caed3fad1e39c9e0173617d681`. The delivery tree is `models-v84`. The full authored manifest is `attempts/v84/manifest.json`; `models-v84/manifest.json` removes the stale cache descriptor for the fresh-field functional preview. Do not admit that preview manifest as the final source-bound manifest.

## What changed

The bedchamber sits at 1.5 m beside the library, reached by ten real 150 mm spiral risers. It retains the actual curved bed bearing, distinct seated foot stations for all five delivered avatars, fitted sleeper covers and a standing route to the working study. The library has a real patio aperture and correctly owned moving door leaf. Corridor niches, two opals, book dividers, a supported record ledge, the cloud seat, pool entry contacts and bounded patio/pool structure complete the interior and near-house changes.

The final two repairs are local and measured. Four rail ends are cut and capped at the actual beveled wardrobe faces; the former 96.7 mm burial is removed. The closed cabinet rises 0.864 m above the retained rail and fills that guard interval. A separate roof underside moves 8 mm upward at exactly ten vertices, removing a new same-facing roof patch without changing its top, the retained core or floors. [rail-sections.png](rail-sections.png) shows actual native triangle cross-sections; [rail-and-roof-controls.json](rail-and-roof-controls.json) records the contacts and complete roof vertex comparison. [native-scope-readback.json](native-scope-readback.json) binds every other mesh's position, topology, material, split normal and active AO field exactly to the immutable v82 source.

The export copy removes only redundant planar interior vertices whose complete incident material, emitted AO color and split-normal fields are constant. The native authoring topology stays intact. Core triangles fall from 115,376 to 95,604; Draco stays at level 10 with position/normal/color bits 14/8/6. The pinned Blender 4.5.9 exporter receives the retained float corner-normal field through an in-memory adapter; the Blender installation is unchanged.

## Verified evidence

| Check                             | Final result                                                                                                                                                     |
| --------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Export surface, both directions   | 1,476,860 probes, maximum distance 2.862 micrometres, exact bounds, no nonmanifold edges                                                                         |
| Export optical fields             | Maximum split-normal error 3.336e-7; AO color error 2.221e-16; active decoded `COLOR_0`                                                                          |
| Native overlap ratchets           | 0.7289 m² visible z-fighting, 3.257 m grazing seam, 288 deep sites over 5 cm, severity 33,574; no native visible pair over 0.35 m²                               |
| Decoded overlap                   | 1.1715 m² visible z-fighting; unchanged global 2.5 m² ceiling                                                                                                    |
| Native contacts and supports      | Nine authored routes, 117 contact samples, twelve rock bearings and four cantilever-clearance controls pass                                                      |
| Actual delivered BODY circulation | Actual capsule solver passes the authored routes in both directions, including all compact spiral risers, real patio aperture and dry promenade                  |
| Actual companion flights          | All 420 runtime flights pass; 3,629,951 samples, 0.42 m sphere, conservative minimum clearance 0.441936 m                                                        |
| Decoded local repairs             | Maximum rail cap error 31.95 micrometres; roof gap 8.7667 mm at all three witnesses                                                                              |
| Public rendered interaction       | Six room/exterior visits, evening bedroom, nonblank WebGL, correct patio leaf, and visible drag/zoom pixel changes at 1440×1000, 1280×800, 768×1024 and 390×1000 |
| Actual 4K optical control         | 3840×2160 drawing buffer; 53 geology position/index/normal hashes stay exact; whitening AO changes 5,506,739 pixels                                              |
| Full static geometry              | 735,604 potential triangles = 619,481 traced + 116,123 skipped by unchanged ROI selection; below 750,000                                                         |

The [AO render](architecture-4k-actual-ao.png), [white-color control](architecture-4k-white-color-control.png) and [same-geometry receipt](architecture-4k-same-geometry-control.json) are original browser outputs. The [library](architecture-library.png), [bedroom](architecture-sleep.png), [evening bedroom](architecture-evening-bedroom.png) and [exterior](architecture-outside.png) captures show the public views. These are functional appearance checks with reduced motion, not isolated performance measurements.

[overlap-audit.json](overlap-audit.json) binds the actual native source, decoded exports and audit tool. Its historical before-repair totals are retained from the committed October 24 compact report, with the input report's SHA recorded. [proposed-overlap-verdicts.json](proposed-overlap-verdicts.json) contains candidate pair-specific proposals for coordinator review; it is not a canonical reviewed admission. Global thresholds are unchanged. An unchanged decoded bathroom tile/grout pair is 0.3710 m²; the native counterpart remains 0.2016 m² and the decoded total remains within its existing ceiling.

[retained-coast-controls.json](retained-coast-controls.json) preserves the bounded coast restoration controls. Both all-surface coast controls report zero distance and exact bounds for the exterior compaction; the v84 scope readback binds that unchanged coast to the final source. The original final avatar library, all five avatar GLBs/contact JSON, furniture and both fireplace GLBs remain exact references.

## Gates retained for the coordinator

The fresh functional field is 780,475 JSON bytes and 263,391 gzip bytes **before** final source inputs. This is not the complete 800,000-byte source-bound cache admission. Regenerate the canonical field and loading sketches from the admitted source and runtime; do not copy the stale cache or old sketches from the candidate tree.

[arrival-budget-controls.json](arrival-budget-controls.json) keeps the scopes separate. With the served raw runtime, the existing core formula plus the unbound field is 4,178,630 gzip bytes. The three table-setting assets actually loaded before the first frame add 84,705 bytes, taking the broad raw formula to 4,263,335 bytes before final source inputs. That exceeds 4 MiB. This formula counts all unminified scene/vendor modules; production ships a minified dependency graph. Only the coordinator's complete actual production network closure, including tableware, validation fetches, decoder, indexes and the final cache, can establish the unchanged 4 MiB arrival target. No complete arrival pass is claimed here.

[exact-buffer-duplicates.json](exact-buffer-duplicates.json) records the negative arrival Draco deduplication survey. The only duplicate Draco payloads are in the lazy hinterland. Four protected avatar files contain duplicate non-Draco buffers; no protected file or delivery was changed by this survey.

F6 remains incomplete: the retained upper cliff plane still needs a successful visual solution. The local v73 deformation produced an ugly beak/seam at the retained rock interface and was rejected. The safe source is preserved; this packet does not claim that plane is solved. Whole transfer skin/IK acceptance belongs to the coordinated runtime stream; neutral foot witnesses and the native cloth fit do not replace it.

## Reproduce the candidate checks

Use `D:\tools\blender-4.5.9-windows-x64\blender.exe`, exactly Blender 4.5.9. Set `NODE_PATH=C:\dev\dylantao.github.io\node_modules`; no dependency junction is needed. The recipes are incremental: extend the retained source, not a scratch rebuild. The v82 and rejected v73 attempts remain immutable.

```powershell
$env:COASTAL_MODELS_ROOT=(Resolve-Path '.jekyll-cache/visual-qa/finish-house-2026-10-26/models-v84').Path
$env:COASTAL_COMPANION_PRESET=(Resolve-Path '.jekyll-cache/visual-qa/finish-house-2026-10-26/attempts/v84/companion-flight-paths.json').Path
node.exe --test test/coastal-estate-native.test.mjs test/coastal-architecture-finish.test.mjs
```

The targeted browser case lives in `test/visual/architecture-finish.spec.js` with `architecture-finish.config.js`. Use the owned 4112 overlay server or an explicitly owned production baseline with `NO_WEBSERVER=1`, `VISUAL_BASE_URL`, `COASTAL_MODELS_ROOT` and `COASTAL_RUNTIME_ROOT`. The test overlays the raw candidate module graph, including compiled `.min.mjs` parent imports. Set `VISUAL_ARCHITECTURE_4K=1` and select `desktop-1440` for the actual 4K control. Root owns final test-group registration and production admission.
