# Fuller Eames cushions, October 26

The parked `wip/life-eames` builder change is now exported. Its seat, back, headrest, arm pads and ottoman have fuller profiles and slightly deeper tufts. The shell, walnut grain, white leather, separate upholstered panels and black bases retain the original model's identity. This is original code-authored geometry; the reference and redistribution boundary in [the provenance record](../../PROVENANCE.md) still apply.

The branch rebased cleanly onto `main` at `e4c36d164`. The baseline exports are identical to `78d4ceec6`; the local profiler/document commits between those revisions do not change furniture.

## Build and preservation

The complete furniture builder ran with Blender **4.5.9 LTS**, build `8bf95cbd38d1`, default vertex-AO baking, all 17 items and both levels. It finished in 12.6 seconds. Every other furniture export reproduced its committed bytes, except the fireplace's rebuilt exports, which were then replaced with the committed `--patch-fireplace-neck` outputs. Their index and report entries were restored too. Only the Eames entry differs in the final index and report.

| Eames level             | Triangles |        Before |         After |
| ----------------------- | --------: | ------------: | ------------: |
| LOD0, close/full screen |    36,130 | 444,044 bytes | 444,892 bytes |
| LOD1, default           |     6,376 |  66,580 bytes |  66,616 bytes |

The floor origin and footprint are unchanged. The seat metadata rises from 0.33 to 0.35 m, and its nominal seat height from 0.38 to 0.40 m. No house actor or furniture placement anchor changes here.

## What was inspected

The actual Draco/WebP delivery GLBs were loaded through the site's Three.js r164 loader in a neutral studio. Sixteen matched **3840 × 2160** captures cover before/after, both levels, front, side, rear and close detail. They used native D3D11 on the RTX 3080 Ti, identical camera/light settings, and produced no runtime or console errors. The close LOD0 capture was also inspected at its original resolution.

The fuller seat and ottoman read most clearly in the side pair. The back and headrest remain separate curved pads; the piping stays continuous, and the walnut shells remain exposed. The rear view preserves the shell profiles and supports. The coarse default level is still visibly simpler at this inspection scale; the existing distance/full-screen selector owns its use. These views support accepting the fuller cushion export. They do not establish avatar contacts, final room lighting, phone performance or physical-product accuracy.

Original 4K front and side pairs, the candidate rear and default-level front are retained here. [review.json](review.json) binds them to exact asset hashes and records the preservation checks. All sixteen images, close details, the baseline assets and full build log remain locally under `.jekyll-cache/visual-qa/eames-2026-10-26/`. The capture fixture can reconstruct the two baseline GLBs from `78d4ceec6` if that local folder is absent:

```powershell
node artwork/coastal-home/reviews/eames-2026-10-26/capture.cjs
```

## Checks and remaining integration

The 14 furniture/collision Node tests, seven coastal-asset Python tests, style contract, targeted Prettier check and `git diff --check` pass. No scene test changed, so this checkpoint adds no registry entry.

The coordinator still owns the final static-light-cache re-bake, house rendering/interaction acceptance, full integrated gates, CI and deployment. The broader life item remains open, including the whiskey routine and the cloud-sofa shin contact recorded in [the earlier review](../life-2026-10-24/README.md).
