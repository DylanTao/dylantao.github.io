# October TODO continuation: local acceptance

The [reconciled handoff](../../october-2026-handoff.md#october-23-integrated-continuation) owns the item-by-item status.
Sirui's October 23 instruction authorized parallel completion and precise notes for experiments that could not be
completed well. One coordinator integrated the verified work on `main`; workers did not publish independently.

## Integrated checks

- Production Jekyll `/al-folio` build: passed, 186.382 seconds. Served controller, furniture, collision, pool and photo
  modules were byte-compared with the final working sources. Responsive image variants were present.
- Python: 241 tests passed. Node: 599 total, 592 passed and seven intentional skips. Style contract passed.
- Prettier: all 898 recognized tracked files passed with CI's LF input, including the final scoped documentation/test
  additions. Unrelated CRLF working files were not rewritten.
- Public route checkpoint: 24 tests passed, covering six routes at 1440x1000, 1280x800, 768x1024 and 390x1000, each in
  light and dark. Scope: projects, Graphics Lab, the 3D-home story, blog, the new studio post and home. Runtime errors,
  layout overflow, content and images are checked by the existing harness. Representative frames were inspected.
- New motion/sidenote cases: all sixteen Chromium viewport cases passed across the full run and the corrected tablet
  expectation retest; eight desktop/phone WebKit cases passed. The compact card layout intentionally discards an ink
  afterimage where other content takes its space. Actual phone taps were subsequently checked in Chromium and WebKit.
- Prior Linux failures: the artifact's second-click navigation passed (3.9 minutes), and interrupted Build Rhythm range
  changes passed (36.9 seconds), in the pinned Playwright 1.58.2 Noble image. Tests stayed unchanged during those Linux
  probes. Earlier PNA/gateway failures and traces remain separate from the successful local-loopback run.
- Scene-group registry: all four projects have 107 cases, zero missing/extra/duplicate membership and one worker per
  group. No scene test was dropped to obtain acceptance.
- Changed upstream-owned overrides were reviewed/re-acknowledged. The staged bytes must match the acknowledgment hashes.

Local logs and full captures are ignored under `.jekyll-cache/finish-*` and `.jekyll-cache/visual-qa/` (including
`checkpoint`, `finish-root` and `finish-linux-regressions`). They are not website content.

## Retained scene evidence

- [House acceptance](../../../artwork/coastal-home/reviews/interior-acceptance.json) and
  [native contacts](../../../artwork/coastal-home/reviews/interior-contacts.json): source/export hashes, supported
  treads, real Walk probes, four device/framing states and pan/fireplace/pool anchors.
- [Furniture](../../../artwork/coastal-home/FURNITURE.md): original source, eleven types/two levels, real placements,
  Carbon/Mineral, bytes, held pan, recovery and inspected room/4K/phone renders. Fourteen existing authored proxies keep
  camera/Walk collision stable across late loading and LOD swaps; they approximate the models rather than matching
  every fine silhouette.
- [Environment](../../../artwork/coastal-home/reviews/environment-2026-10-23.json): JPL references, native water depths,
  exact garden asset hash and actual coast/garden/night/FFT views. The final still-photo guard is newer than its
  environment-module fingerprint; the separate graphics-study record below binds that changed module.
- [Duvet](../../../artwork/coastal-home/reviews/duvet/lizard-optimized.json): raw warmed update costs, bounded deformation,
  pause, exact reduced restoration and 2D/3D recovery. The optimized performance result covers Lizard, not every avatar.
- [Photo/ink studies](../../../artwork/coastal-home/reviews/graphics-studies/README.md): nonblank actual images,
  live/moving refusal, minute/pending-camera cancellation, exact projection restore, matched ink costs, renderer cleanup
  and continued Realistic zoom/pixel changes. These are bounded experiments; no antialiasing-quality or NPR-speed win
  is asserted. The fixed pool was checked not to cast an opaque shadow.

## UI frames

[Settled phone theme menu](theme-menu-390.png), [closing prose at 100 ms](ink-close-1440.png) and
[desktop post with three original margin notes](studio-log-1440.png) are actual browser captures of the candidate.
The closing copy occupies empty space to the right of the card; it never includes the figure or persistent summary.
The compact phone/tablet layout closes without that copy. Notes remain original keyboard-linked nodes and revert to
endnotes on narrower screens, without JavaScript and in print.

## Publication and remaining limits

Release acceptance additionally requires successful CI for the exact pushed commit, its Pages deployment and a live
content/asset check. These post-push results belong to that revision's GitHub Actions/Pages records; a local pass or
HTTP 200 alone is insufficient. The final coordinator report links the actual result.

Moving-scene TAA and trained representation replacements remain explicitly unimplemented in the handoff. The source
review and frozen-photo/static-ink experiments do not count as reproductions. Build Rhythm/profile refresh is held on
the exact October 22 website discrepancy (24 attributable commits versus 23 calendar credits); no unapproved calendar
exception or invented fresh snapshot was published. Scholar's paired October 23 snapshot passed the freshness gate.
