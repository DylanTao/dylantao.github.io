# Bedroom light bindings, November 1, 2026

Source checkpoint: `a72ebca5b`. This fixes the actual public bedroom's diffuse-light coverage, preserves the occupied old loft, and binds the existing bedside source and visible diffuser to the retained lamp. It does not establish that every reported angle-dependent bright patch is repaired.

## What was measured

Public Rooms → Bedroom selects `sleep`, whose actual bed floor is at Y=1.5, X≈[-8.429,-5.251], Z=[3.4,8.5]. The old `sleep` light cage remained in the former loft: X=[-4.3,-1.85], Y=[2.55,4.4], Z=[10,12.8]. The bed and its frame had no cage support. Their shader used the unoccluded sky fallback instead. Exposure stayed at 1.05 throughout the 42-view baseline; this was not a measured exposure jump.

Moving only that cage made the bedroom darker and removed all cage support from 364 real loft floorboard vertices. That candidate was rejected. The accepted metadata also expands `library-upper` to contain both original occupied loft envelopes. All 1,110 vertices that lost some union support in the first attempt recover it. The final configuration still has 16 regions, 128 probes and 28 practical sources. All eight expanded-loft probes are valid; one moves 87.79 mm to find a valid position. The two-cage bake preserves the other 112 probe payloads exactly.

The old bedside point was 4.942 m from the actual globe, beyond its 4.8 m cutoff. The source now uses the native globe centre [-5.770000458,2.330000162,5.950000525] and a 0.20 m emitter radius. Its identity, powers, distance, colour and authored schedule are unchanged. This improves the nearby wall, pillow and plant, while a dark opaque shade still looked inconsistent with the bright table pool. The final step gives only that globe a named runtime diffuser role. Offline emission remains zero; visible emission follows the same existing source, with maximum scalar intensity 0.65. No light, source channel or transport emitter was added.

## Comparable views

- [Original bedroom, Noon](images/qualified-noon-sleep-default.png) and [Evening](images/qualified-evening-sleep-default.png).
- [Rejected cage-only dark-room control](images/cage-qualified-evening-sleep-default.png).
- [Final bedroom, Noon](images/shade-qualified-noon-sleep-default.png) and [Evening](images/shade-qualified-evening-sleep-default.png).
- [Maximum existing bedside power, side angle](images/shade-peak-maximum-source-sleep-left.png). The table pool remains strong; this is a retained limit, not a claim that every highlight is solved.
- [Preserved occupied loft](images/shade-qualified-evening-library-upper-default.png).
- [Ocean framing at actual public Walk eye height](images/eye-evening-sleep-eye-ocean.png), entered through public Rooms → Bedroom → Walk here and a real canvas drag. No source camera was moved.
- [Existing adjacent nook at measured seated eye height](images/nook-ocean-evening-current-nook-head-height-frame.png). This is a read-only lab camera derived from actual iris vertices, not an implemented new breakfast room.
- [Modern WebKit phone bedroom, Noon](images/webkit-shade-clean-noon-sleep-default.png), [Evening](images/webkit-shade-clean-evening-sleep-default.png), and [preserved loft](images/webkit-shade-clean-evening-library-upper-default.png).

## Native and delivered preservation

The qualified native input is `de217984242f77903145dd6d16f277923b57fd5e3eb2469c906c2507b494ad87`. The isolated candidate used for the exported appearance control is `e1d38fad88fa6c0f01d07efbd4b5c093cffd2a1faf16b6965b485da788143665`. It is a private candidate and must not replace a later combined native source.

The globe has 222 native vertices and 240 native polygons, delivering 440 triangles. Only those polygon material indices and the new copied material role change. All 462 native mesh coordinate/topology/normal/UV/colour/other numeric-attribute and matrix fingerprints are exact; original material base properties remain exact. Material indices are exhaustively checked against the allowed polygon IDs, rather than waived from preservation.

The unchanged official room exporter at effort 10 reproduces the original room's entire BIN stream exactly; its no-edit JSON difference consists only of six later scene revision extras. Effort 7 was also retained as a control. The shade export preserves every unowned original compressed primitive exactly. The retained mattress's positions, normals, RGB and winding-preserving triangle payloads are exact. Its UV quantization changes by at most 0.000213683; its modified shared primitive is therefore not byte-identical. The globe's split quantization changes positions by at most 0.106518 mm. Room triangle count remains 96,058.

Actual GPU programs read only position, normal and colour for the current linen finish, use world-space cloth detail, and have no texture maps. UV is inactive in this renderer. Any future texture-mapped linen finish requires new qualification. Nine native PC Noon/Evening/maximum-source draw controls and two phone bedroom controls confirm the uploaded shade emission follows the existing source; uploaded mattress emission remains [0,0,0]. The original mattress scalar is 1 with a black emissive colour, so scalar zero is not claimed.

## Source, cache and product binding

The complete preview contains all 1,364 paths from the root's `201be0fe3` product. Only six delivered files differ: compiled controller, compiled warm-practicals, module receipt, sleep GLB, manifest and official cache. The seeded product uses the official module compiler for the two overlays; this is not represented as a new full Jekyll build. The private raw controller preserves the root's current camera changes plus the single reserved binding call; the source patch is the same one-line addition on the worktree base.

The official cache signature is `a9d30c2f7d48b3c6d0e7bc1c12e92c690901e61065ea8f4893fb040217267ab1`; its body SHA is `ca99e38cd7c3de3f0a387c6318030f53c7a682177d11da00ac5d1a089fd5ee7f`. All 103 private dependency hashes and descriptor fields pass the final producer-input guard. The shade quantization changes only four sleep probe payloads; the other 124 remain exact. The 28 source definitions and probe positions remain exact. This cache qualifies only this product, not the coordinator's later index/rain/import/native changes.

Native PC evidence uses actual 2560×1440 viewport and drawing buffer, MSAA 2, pinned high quality, Chromium D3D11 on RTX 3080 Ti, native clocks and no omissions. Each room visit settles normally before the public scene-lab Pause is used for the comparable angles. Thirty final views are clean. Modern Playwright 1.58.2 WebKit 26 uses an actual 390×1000 buffer, MSAA 2, complete product and public touch controls through a byte-preserving container-local proxy. Four phone views have zero console, page, request or proxy errors. These concurrent captures establish functionality and appearance, not speed or physical-iPhone performance.

## Retained failures and verification

Raw receipts, original producer scripts and failed controls are compressed without rewriting their bytes. They retain the first cage-only coverage loss, an implicit-encoding manifest rejection, the compiled-vendor/raw-source mismatch, three native attribute-census implementation failures, the ambiguous delivered primitive lookup, the first cached peak with no fresh draw, and the original phone observer's four invalid-uniform-location GL errors. The replacement observer queries only the currently drawing program with fresh locations; no errors are filtered. A resumed-session attempt without a running 4203 server was stopped and preserved separately, followed by an exclusive resumed server and exact body readbacks.

The 19 related JavaScript tests and five focused metadata tests pass. Full Python discovery passes all 333 tests with zero skips using an invocation-only extended-path root for the sealed custody test. Ordinary discovery's ten Windows long-path errors and the first malformed workaround invocation are retained; no assertions or archived packets were changed. Targeted source Prettier and `git diff --check` pass.

## Guarded replay and remaining gates

[replay_lighting.py](replay_lighting.py) requires Blender 4.5.9, an explicit coordinator-provided input SHA, and a new output directory inside `.jekyll-cache/visual-qa`. It guards the exact original globe digest `4fca94a1b386416b1a0f41fce837f75938008bc0691acd48965ab8e46805f6e9`, replays only the two owning region assignments and the measured globe role/query, and compares all outside fields against the actual provided input. It does not rerun a consumed whole-room builder. It rejects an incorrect SHA or existing output directory; the final exact-globe replay and idempotent replay both pass. A 100 µm globe perturbation changes the identity digest and is rejected by that guard.

```powershell
& D:/tools/blender-4.5.9-windows-x64/blender.exe --background $verifiedCombinedSource --python-exit-code 1 --python artwork/coastal-home/reviews/bedroom-ambience-2026-11-01/replay_lighting.py -- --repo-root . --source $verifiedCombinedSource --source-sha $verifiedCombinedSha --manifest $combinedManifest --out .jekyll-cache/visual-qa/bedroom-combined-replay
```

The coordinator must retain current controller imports/version tags, combine F6 → arrival → shade/plant, perform the final native bake/export and official cache bake, then verify the complete public product. No canonical asset or cache was committed by this worker. Source/material changes do not establish a general fix for unoccluded environment specular response, direct-light leakage, or every angle-dependent brightness report.

The requested breakfast area is still a separate measured proposal: the existing 42 cm sunken nook is beside the actual bedroom, not beneath it. Under the bedroom slab, its current level would provide only 1.760 m clearance and cannot be admitted as a 2.1 m walking route.

## Coordinator portability correction, November 2 UTC

The original working-tree seal failed against the committed payload: it hashed
CRLF helper bytes and, for the bedroom packet, listed an ignored interpreter
cache. [The correction](CUSTODY-CORRECTION.json) retains that original failed
index, verifies the line-ending-only difference and seals the supplied LF source
and evidence. The original native/render findings are unchanged; the old seal
is not relabeled as passing.
