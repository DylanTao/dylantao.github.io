# Working design previews, October 1

Sirui asked for continued improvement alongside good reference examples rendered with the site's own content. The review route is `/design-lab/`, with no navigation, search, or sitemap entry and `noindex, nofollow`. A, B1 and C reflect local homepage refinements. B2 remains a comparison. Sirui chose B1 after reviewing both quieter versions.

## What to judge

| Preview          | Proposed placement      | What the reference teaches                                                                                                                                                                                                                                                                                 | Tradeoff                                                                                                      |
| ---------------- | ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| A: selected work | Homepage selected work  | [087 Sketchbook](https://miaai-lab.github.io/Claude-Opus-5.5-100-HTML-Files/087-sketchbook-portfolio.html) keeps artifacts close to their context; [008 Editorial](https://miaai-lab.github.io/Claude-Opus-5.5-100-HTML-Files/008-lighthouse-longform.html) makes room for a figure beside a reading lane. | DesignWeaver leads alone, with a larger original figure. The workshop paper remains in the archives.          |
| B1: margin photo | Existing thesis section | 008's margin-note relationship, also inspected in the [unified collection](https://zcnofdpgpxud.feishuapp.com/app/app_17exzr8eka4/), connects an artifact with its explanation.                                                                                                                            | A 208-pixel photograph adds a personal detail at desktop size and stays small on mobile. Shared credit leads. |
| B2: text only    | Existing thesis section | The same relationship, reduced to a quiet acknowledgement and reading link.                                                                                                                                                                                                                                | The lightest treatment; less visual emphasis on any single conversation.                                      |
| C: quiet updates | Homepage updates        | [003 Swiss Poster Machine](https://miaai-lab.github.io/Claude-Opus-5.5-100-HTML-Files/003-swiss-poster-machine.html) uses alignment and hierarchy to organize reading.                                                                                                                                     | Complete announcements take the space they need; short entries no longer inherit a tall card.                 |

The live reference inspection included 087's work/process navigation, 096's material library, the unified collection's 008 detail and source/version panel, and 003's poster structure. This is a focused review, not a new audit of every reference demo. No reference code, illustrations, screenshots, audio, textures, or typefaces were copied into the site.

## Local refinements

- DesignWeaver now leads selected work alone, with its original diagram beside the summary on desktop. The October 1 away-review follow-up puts the name and question before the whole diagram on mobile and in the DOM reading order. The figure retains its color and labels and declares intrinsic dimensions. The workshop paper's case study and publication record remain available.
- The thesis acknowledgement now credits work with Steven P. Dow and conversations with Don Norman and many others. Its reading link labels the specific Don Norman talk note separately. The main research question and design principle retain their existing words.
- B1 is integrated into the existing thesis section, with a 208-pixel margin image on desktop and a 192-pixel image below the copy on mobile. The existing responsive-image include uses build-generated WebPs and keeps the original photograph as fallback; the 480-pixel WebP is 21,162 bytes, versus the 1,269,588-byte original.
- Updates use a quiet list with aligned dates and complete, unclamped sentences.
- The record title/source appear with the preview or active disc. The original portrait has no song caption. Space is retained to avoid a layout jump, and focus can move into the source link without collapsing the preview.
- The room keeps its single Realistic treatment and minimal public controls. Its organic mask is slightly wider; the edge fade ends three pixels inside every canvas boundary after a narrow dark-theme check exposed residual edge color. The isolated Blender refinement is integrated as `dc67a2c29`: a smaller Ghibli head, finer glasses, clearer hair/cloth surfaces, darker joinery, and distinct ceramic glaze. See the [matched model and browser evidence](evidence/coastal-realistic-2026-10-01/README.md).

## Evidence

Comparable homepage captures:

- `.jekyll-cache/visual-qa/iteration-october-work-before/`
- `.jekyll-cache/visual-qa/iteration-october-work-after/`
- `.jekyll-cache/visual-qa/iteration-october-work-revised/`
- `.jekyll-cache/visual-qa/iteration-october-updates-before/`

Preview screenshots use the actual Docker-served HTML and original site images. `.jekyll-cache/visual-qa/october-design-previews-revised/report.json` records all four standard viewports in light/dark, image loading, overflow, full update visibility, shared acknowledgement, small margin-photo size, and runtime errors. All eight states pass with zero horizontal overflow, broken images, or runtime errors. The captures use real announcement emoji images. Full-document section clips preserve the fixed navbar's actual document-top position, avoiding an element-capture artifact that stamped it over a tall mobile section.

The existing on-disc case in `test/visual/desk-scene.spec.js` now checks caption absence at rest, source-link keyboard access, and return to the plain portrait. Desktop and mobile runs pass. The mobile pinch case also opens the collapsed lab disclosure before tapping Now; this corrects the test path to match the minimal public controls.

## Verified checkpoint

- Homepage: the explicit `home` checkpoint passes at 1440×1000, 1280×800, 768×1024 and 390×1000, with light/dark checks in each of the four tests. The final B1 section capture is `.jekyll-cache/visual-qa/iteration-october-b1-home-final/`.
- Review gallery: eight viewport/theme states pass; all 32 section captures retain complete figures, shared credit, loaded images and unclamped updates. The browser chooses the 480-pixel WebP for the small photograph.
- Four time modes: the existing desktop/mobile theme-settlement cases pass across the homepage, projects, publications and blog. Their homepage sample now uses the retained research-focus card because the thesis principle is intentionally an unboxed note. The semantic color and settlement assertions are preserved.
- Record: desktop/mobile caption-focus cases pass, plus four existing playback/click checks across Chromium desktop and iPhone WebKit. Evidence is under `october-caption-mobile`, the desktop on-disc run, and `october-record-browser-engines`.
- Room: all four minimal-control and eight light/dark composition cases pass, including nonblank WebGL, actual orbit/zoom pixel changes, connected-room/exterior navigation and overflow. The first combined run had 19 passes and one mobile dark-edge failure; the revised interior edge guard passes all eight light/dark boundary cases. Evidence is under `october-integrated-room` and `october-integrated-edges`. The final desktop minimal-control view passes again under `october-room-final-preview`.
- Touch: the corrected pinch/Now case passes under `october-integrated-pinch`, with its camera and pixel-change assertions retained.
- Source and build: 166 Python tests, the style contract, changed-path Prettier, JavaScript syntax and diff checks pass. The final production Docker Jekyll build with `/al-folio` finishes successfully in 80.096 seconds; the generated homepage retains responsive photo URLs with that baseurl. The override audit reports the existing 80 local overrides, with no registry change.
- Served assets: the Ghibli, study, kitchen and shell GLBs match their source SHA-256 values. The model/contact checkpoint and its explicit rendering limits remain in the linked evidence document.

This is a local design checkpoint, not a release-scale route matrix. Visitor comprehension is not measured. Sirui's actual feedback is recorded: less workshop-paper prominence, broader credit, then B1's small margin photograph.

## Away-review follow-up

Sirui requested actual screenshots or renders because localhost is unavailable while away. Images below are actual Docker-served HTML or WebGL captures, rather than generated mockups. Proposal D on `/design-lab/` shows a compact research reading list using the existing publication-context data and role labels. This proposal has not replaced the public homepage bibliography.

The touch-record baseline exposed a disappearing center cue after tapping either skip button: CSS hover moved off the play button, including when reduced motion prevented rotation from conveying state. The composed disc now keeps its play/pause cue on coarse pointers. The source link's hit target grows from 18.89 to 44 pixels, with no extra transport below the record. The dedicated touch test uses actual taps and checks both playing and paused states after skipping; native accessibility labels continue to match state.

The record's thirty static strobe marks now share one instanced mesh, with its instance resources disposed alongside geometry and materials. Same-size desktop and mobile WebGL runs reduce draw calls from 62 to 33, while measured frame intervals remain about 16.7 ms median and p95. This is a submission-cost reduction, not a measured frame-rate gain. The implementation uses the site's pinned [Three.js r164 instancing API](https://github.com/mrdoob/three.js/blob/r164/src/objects/InstancedMesh.js).

Comparable evidence:

- Mobile work order: `.jekyll-cache/visual-qa/iteration-october-mobile-work-before/` and `iteration-october-mobile-work-after/`.
- Touch playback: `.jekyll-cache/visual-qa/october-touch-record/baseline-after-skip/` and `after/`; both themes report visible cues, 44-pixel source targets and zero overflow after the fix.
- Record graphics: `.jekyll-cache/visual-qa/october-record-draws/before/` and `after/`, including rendered desktop/mobile discs and measured draw submissions.
- Review gallery: `.jekyll-cache/visual-qa/october-design-previews-away/` contains forty section captures across eight viewport/theme states, including D. Canonical purpose and role rows, complete images/updates, small B1 photo and overflow/error checks pass.

The longer room-lighting, hand-contact and case-story passes run in separate worktrees. Their proposals and verified integration evidence are recorded when those checkpoints finish.

The public homepage checkpoint passes all four standard sizes with light/dark captures. Seven targeted record checks pass across desktop/mobile; the touch-only case intentionally skips desktop. The Docker production `/al-folio` build succeeds in 210.505 seconds. Changed-path Prettier, style-contract, JavaScript syntax and diff checks pass.
