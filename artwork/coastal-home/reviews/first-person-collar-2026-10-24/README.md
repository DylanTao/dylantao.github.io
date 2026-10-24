# First-person collar closure — 24 October 2026

This review is narrowly about the native neck-to-shirt opening in Walk. It does not certify every stylized head silhouette, phone performance, or the broader scene roadmap. `artwork/` is excluded from the public Jekyll output.

## Diagnosis and rejected approach

The visible Ghibli opening at the maximum reachable down-look was primarily missing upper-chest geometry inside the shirt collar, below the head clipping plane. It was not the horizontal head cut alone. Native `Head` is at 1.360 m and the existing cut is at 1.400 m. The primary camera retains its 1.6 m height and native measured optical forward offset, bounded to 0.14 m.

The first prototype reconstructed closed skin/hair loops at the horizontal cut. CPU contours closed, but the before/after images were identical: the hair cap projected below the visible image and the exposed sightlines passed in front of the skin cap. Three diagnosed Ghibli rays at pixels (500,580), (500,600), and (500,620) in the 1000×800 fixture hit native olive trousers around 0.897 m high. A cap at 1.400 m could not fill that lower collar opening.

The rejected prototype also cost roughly 5.69 ms mean presence update for Ghibli and 3.51 ms for Lizard, with Ghibli idle p95 around 10.9 ms. Its original source, receipt and representative identical images are retained under [rejected-cap](rejected-cap/). Nothing from that implementation remains in production assets.

## Accepted strategy and bounded cost

The runtime liner joins the actual native closed neck section at 1.350 m to the inside shirt section at 1.305 m. Five curved rows preserve the native low-poly character rather than adding a flat horizontal cap. The resulting 320 vertices / 512 triangles follow 231–304 bound source vertices per pose; there are no per-frame mesh cuts, native asset changes, added render passes, or added shadow casters. Native skin material is borrowed, not disposed. The liner is visible only inside the existing primary Walk draw scope; mirrors retain the full native body.

The one-time scan first rejects triangles outside a 5 mm bind-height guard. All five styles produce byte-identical fitted geometry against the full-scan reference. Construction resets a private source clone to canonical idle before fitting, so a source actor currently sleeping, bathing or walking cannot change the result. `SkinnedMesh.updateMatrixWorld` is refreshed before CPU skin reads, including after nonzero parent translation/yaw.

Across all fresh fits retained in the final software-WebGL host fixture, setup took **10.9–53.5 ms**. Full presence updates over complete idle and walk cycles had p95 **0.6–1.6 ms**. These are controlled host measurements, including the existing native pose update; they are not isolated liner-only timings or physical-phone FPS. The liner adds one small draw while Walk is active.

## Evidence and its limits

- `node --test test/walk-collar-liner.test.mjs test/walk-presence.test.mjs`: **30 passed**, including all five real Draco avatars, canonical fitting from four routine poses, identical narrowed/full scans, complete idle/walk pose sweeps, the diagnosed Ghibli sightlines, material replacement, borrowed-resource disposal, failed draw restoration, failed constructor recovery, and actual draw-material replacement without an explicit lifecycle refresh (including normal/throw restoration).
- The native fixture is the liner-geometry checkpoint before the final draw-material membership repair; its geometry and pose-update path are unchanged by that small draw-scope scan. [Final native receipt](native/evidence/evidence.json): all five native styles, complete 121-sample idle and walk cycles, actual WebGL quarter-cycle images, no shader/page/GL errors. Representative [Ghibli before](native/evidence/ghibli-down80-before.png) / [liner](native/evidence/ghibli-down80-liner.png) show the repaired collar sightline. Full captures remain in the ignored `.jekyll-cache/neck-cap/final-native/` directory.
- All five native mirror canvas hashes match before/liner. All five full-avatar sun-shadow hashes match, with an **avatar-hidden negative control that changes the target** and an exact restored result.
- Earlier rejected-cap and initial liner shadow hashes covered only the static target: those fixture actors did not have `castShadow` enabled. Original receipts are unchanged and are not evidence of full-body shadow custody. The final corrected fixture explicitly enables native actor casting and disables static-room casting only to isolate this shadow comparison; its lighting is controlled, not production illumination.
- Real-house evidence uses the complete production `/al-folio/` build, with only the two candidate modules overlaid read-only. Desktop 1440 x 1000 and touch-context 390 x 1000 use the actual Intel Arc D3D11 renderer, all assets/quality intact, native timers/RAF/Date. The state-flow receipt covers a bath-origin Walk, an active avatar switch at nonzero upper-floor translation/yaw, actual keyboard travel, return to the bath routine and 2D/3D recovery. Lab placement stages valid capsule poses; it does not substitute for the existing full entrance/door route evidence.
- The [original state-flow receipt](house/state-flow-up-look.json) preserves the already-passing movement, bath return and mode recovery. Its captures accidentally used the native camera's **up-look** sign. Their state assertions are retained, but those images are not collar proof. The corrected camera-only gate records the actual primary draw camera's matrix direction: Y = -0.98545 at native pitch -1.4, rather than trusting the input value alone.
- The [rejected material-membership gate](house-rejected/material-membership.json) and its [native image](house-rejected/desktop-ghibli-upper-down.png) discovered stale initial Ghibli material membership: the actual draw materials had no head plane after a style/receiver rebind, although the recorded Head/clip heights and attached skin matrices were correct. The face remained when the liner was hidden at the same source/pose. The bounded repair refreshes the current material pointers at the start of `withoutHead()`, immediately before applying clipping. It scans only the small native hierarchy/material list, not vertices or triangles. A replacement-material normal/throw regression protects restoration of both the new and obsolete materials. The [final exact-source house receipt](house/evidence.json) passes both viewports with 12/12 actual Ghibli primitives carrying the correct world plane; [desktop](house/desktop-ghibli-upper-down.png) and [mobile](house/mobile-ghibli-upper-down.png) show collar closure and no exposed face. Source switching and the full native [desktop mirror](house/desktop-lizard-upper-mirror.png) / [mobile mirror](house/mobile-lizard-upper-mirror.png) pass before returning to the bath routine. No shader/page errors occurred.
- The initial default-headless full-house attempt selected CPU SwiftShader and stalled during shader warmup. Its failed receipt is retained in ignored cache; it is not acceptance evidence. The corrected D3D11 backend matches the canonical Windows visual harness. Earlier native-avatar fixture costs remain explicitly software-host measurements.

## Exact deployed acceptance

The [live receipt](house/live-evidence.json) repeats the bounded camera-only gate
against source `b66903e74a95a9b545611bbe6705d27d68b2f1fa`, served by Pages commit
`20bdc88eb70c3afe47886b8de2f829a56cee46d9`. There are **no module overlays**. Both
preflight responses and the actual browser-loaded bytes match canonical Git
source in both viewports:

- `walk-presence.mjs`: SHA256 `e5f793b66ca6f875bad2f97bd8cc7959bdbd44dafddc4463e0fa501552c2b338`.
- `walk-collar-liner.mjs`: SHA256 `89284abbdde4b4208bd55871ae76977bd074e6de880ffc269b933c09305b0291`.

Desktop 1440 x 1000 and touch-context 390 x 1000 pass on Intel Arc D3D11 with
native timers, full assets/quality and no runtime errors. The actual draw camera
points down at Y = -0.98545; current native materials carry the clipping plane.
The [live desktop](house/live-desktop-ghibli-upper-down.png) and
[live mobile](house/live-mobile-ghibli-upper-down.png) captures show the closed
collar without the stale exposed face. A same-source liner-hidden diagnostic,
restoration, Ghibli-to-Lizard switch, [full native mobile mirror](house/live-mobile-lizard-upper-mirror.png)
and return from Walk to the bath routine also pass. Capsule positions are staged
valid poses, so this does not add entrance-route or physical-phone claims to the
broader local state-flow evidence.

## Retained South Park extreme-down defect

[Before](native/evidence/south-park-down80-before.png) and [liner](native/evidence/south-park-down80-liner.png) both show a distracting mouth/teeth/lower-face silhouette below the existing cut. This is a retained **primary-view defect**, not a newly polished silhouette. Collar closure does not repair it.

Native triage found the mouth's 587 triangles entirely Head-owned at Y 1.318–1.396 m. The `warm white` primitive combines 2,512 Head-owned triangles with 2,016 shoe triangles; `skin` combines 49,245 Head-owned triangles with 29,822 neck/arm/hand triangles. There are no mixed Head/body triangles, but hiding either whole material primitive would remove useful body geometry. A `withoutHead()` index swap would also remove head shadow triangles despite `clipShadows=false`.

The next separate experiment is a beauty-only Head-bone-ownership exclusion, retaining the measured optical anchor and complete shadow geometry. Adoption requires actual reachable down-look idle/walk images without exposed mouth/teeth or lost neck/hands/shoes, unchanged native mirrors, avatar-sensitive unchanged sun shadows, and successful initial/switch warmup. It must not add a broad stencil pass or conceal the real mirror body. No third rendering strategy was attempted in this closeout.

## Reproduction

Use repository-root working directory and installed Playwright Chromium. With dependencies in another checkout, set `DEPENDENCY_REPO` to that checkout; no dependency junction is needed.

```powershell
node artwork/coastal-home/reviews/first-person-collar-2026-10-24/native/capture.cjs
node artwork/coastal-home/reviews/first-person-collar-2026-10-24/rejected-cap/run.cjs
```

The rejected runner serves the archived prototype modules as read-only HTTP overlays. It does not restore them into production assets. Run the two fixtures serially; both own port 4191 and write new ignored receipts. Original tracked receipts remain unchanged.

The real-house runner supports a complete `/al-folio/` production preview plus exactly the two candidate module overlays, or a `BASE_URL` with **no server or overlays** for an exact deployed smoke. It compares both loaded module SHA256 hashes with working-file bytes for the local overlay, or canonical Git `HEAD` bytes for live publication so Windows CRLF conversion does not invalidate the comparison. It preserves desktop/mobile state receipts and captures. Native RAF, timers and Date remain active; the bath activity is selected explicitly. On Windows it uses the repository's D3D11 backend flags and records the actual graphics renderer. Set `CAMERA_ONLY=1` for the bounded down-look/source-switch/return capture; omit it for the retained broader state-flow scope.

```powershell
# Read-only complete production build; /al-folio/ baseurl.
$env:PREVIEW_DIR = 'D:/path/to/complete-production-build'
$env:CAMERA_ONLY = '1'
node artwork/coastal-home/reviews/first-person-collar-2026-10-24/house-acceptance.cjs
# Exact deployed smoke: BASE_URL disables the preview server and all source overlays.
$env:BASE_URL = 'https://dylantao.github.io/'
node artwork/coastal-home/reviews/first-person-collar-2026-10-24/house-acceptance.cjs
```

Tracked house receipts are focused projections of immutable raw reports, retaining source hashes, errors, actual native camera/material/bind matrices, body/liner/capsule state and returns. Each projection identifies the original raw SHA256; unrelated scene lighting/field arrays are omitted.

The hardware-backed gate is desktop Chromium with a touch mobile viewport, not a physical phone or mobile Safari. The separate stylized South Park extreme-down defect, physical-phone measurements, and broader graphics experiments remain outside this collar closure acceptance.
