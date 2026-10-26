# Build diary review - October 26, 2026

This review takes the unrendered `wip/story-diary` (`cfe6fc369`) onto the October 26 main-line site. It verifies the diary and its House in the Cliff page, not the current geometry or performance of the 3D home. The coordinator owns integration, CI, publication and the deployed receipt.

## What changed in review

- The first-room and retreat overviews now stand side by side. The first-room camera changes between eras, and the retreat cameras follow the house's eight-metre move. Those views are comparable authored shots, not pixel-registered comparisons.
- The shader entry names the October 12 Windows/RTX 3080 Ti checkpoint. Its 26.0 to 0.6 seconds measure blocking program-log reads across a session. The paired readiness figures are historical; subsequent scene changes and the remaining loading work prevent a current loading guarantee.
- The grip entry describes 132 left/right hand samples, including interpolation samples, rather than calling them 132 animation frames or implying continuous collision clearance.
- Review notes without a retained verbatim transcript are paraphrases. Model credit is retained where a commit trailer or earlier reviewed project record names it. The house subpage's debut date is October 26, rather than the date of its unrendered draft.
- The house page preserves the partial bedroom adjacency, angular excavation and laundry-view follow-ups. It makes no structural-certification or photorealism claim.

## Source custody

[source-custody.json](source-custody.json) binds 26 displayed image halves to their retained page derivatives. Twenty-two original captures exist in committed review/evidence folders. Four coffee/Connect originals were laptop-local; their WebP derivatives are present, but this PC does not have original-byte hashes. The page says so. The earlier WIP did not retain every crop/resize argument, so these hashes do not establish deterministic reproduction of each derivative.

The factual checks used the retained [October 12 startup review](../../../../docs/evidence/coastal-startup-2026-10-12/README.md), [grip review](../../../../docs/evidence/coastal-grips-2026-10-01/README.md), [retreat review](../../../../docs/design-reviews/2026-10-24/HOUSE_REVISION.md), [interior source review](../interior-refinement-2026-10-24/README.md), [head-exclusion review](../first-person-head-2026-10-24/README.md), earlier coastal-section/realism reviews, and the linked commit messages. These are dated checkpoints; they do not verify a later scene revision.

## Rendered result

The diary keeps a dated spine, review notes, change descriptions and source links. Matched comparisons retain a keyboard- and pointer-operated divider. Different cameras display both full views, side by side on desktop and stacked on a phone. Without JavaScript the comparisons remain visible and chapter links remain native anchors.

- [Desktop diary](rendered/homepage-desk-scene-1440-script.png)
- [Phone diary](rendered/homepage-desk-scene-390-script.png)
- [House page, desktop](rendered/house-in-the-cliff-1440-script.png)
- [House page, phone with JavaScript disabled](rendered/house-in-the-cliff-390-native.png)

The focused captures show one representative chapter; the complete two-route checkpoint is retained in this worktree's ignored `.jekyll-cache/visual-qa/checkpoint/`. The dated source captures inside the diary remain screenshots of historical scene versions.

## Verification

- Full Python suite: **311 passed**. The diary's data/images and project chronology are included.
- Targeted Prettier, style contract, JavaScript syntax and `git diff --check`: pass.
- Full-asset production Jekyll build with `/al-folio`: pass, **168.485 s** in the existing Docker image. Publication/AI-readable output validation: pass.
- Scoped public-route checkpoint: **8 passed**, covering both routes at 1440x1000, 1280x800, 768x1024 and 390x1000, in light and dark (**16 route/theme states**). It checks overflow, runtime errors, chapter targets and keyboard divider interaction.
- [Focused browser proof](browser-proof.json): **8 passed** states, both routes at 1440 and 390, with and without JavaScript. Every diary image decodes; heading levels, unique IDs, real chapter targets, range endpoints, pointer dragging, visible no-script comparisons and document overflow pass. `capture.cjs` uses the public suite's Windows D3D11 launch flags. Phone sizes are host emulation, not physical-phone evidence.
- Override audit: the intentional `assets/css/main.scss` import is acknowledged; its hash is reviewed. Docker sees unrelated pre-existing CRLF/LF override differences, which were not bulk-accepted.

Local baseline PNGs, complete checkpoint captures and build/test logs remain under `.jekyll-cache/visual-qa/diary-review/` and `.jekyll-cache/visual-qa/checkpoint/`. An extra close-capture preflight failed its image-decode precondition; it was not used as acceptance evidence. The focused report independently visits and decodes each image. No scene model, light-cache input, runtime, private analytics or credential changed in this lane.

## Reproduce

Serve a complete production `/al-folio` build on an owned port. Set `NO_WEBSERVER=1`, `VISUAL_BASE_URL=http://127.0.0.1:4102/al-folio`, `VISUAL_PORT=4102`, and `VISUAL_ROUTE_IDS=project-homepage-desk-scene,project-house-in-the-cliff`, then run `npm.cmd run test:visual:checkpoint`. Run `node artwork/coastal-home/reviews/build-diary-2026-10-26/capture.cjs` with `DIARY_URL` set to that same base URL for the focused proof. The script writes only ignored QA output.
