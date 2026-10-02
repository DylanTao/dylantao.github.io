# Record intent and mode preservation — October 2, 2026

This follows the [character refinement checkpoint](../character-refinement-2026-10-02/README.md). The next rendered review found two independent defects in the simple 2D player. This checkpoint changes record interaction in `assets/js/home.js`; it adds no public controls, scene treatments, artwork or character geometry. The approved B1 margin photo and shared research credit remain, and the workshop paper stays out of featured work.

## Defects and correction

Discovering a card scheduled an automatic advance 460 milliseconds later. Immediately playing, selecting the previous record, or skipping twice left that action queued. It replaced the visitor's selection; starting playback could also leave the renderer suspended. A discovery whose image decode finished after the deliberate input could queue another stale advance even after a simple timer cancellation.

Deliberate transport, card inspection, mode changes and page lifecycle now invalidate pending discovery advances. Each asynchronous discovery checks the original intent revision and selection after decoding and before its timer runs. The discovered card still joins the collection. Default discovery retains its delay and next-unfound behavior, including rapid discovery and four-card replay.

A paused disc also reset when clicking a mode button or its artwork source, because both sat outside the portrait's dismissal boundary. The entire player and the mode controls now preserve that state. A mode press dragged outside its button retains native cancellation and does not dismiss the disc; the next independent outside click still dismisses it. Mobile mode changes no longer schedule an automatic recenter that can move the switch during a subsequent press.

## Rendered evidence

Five defect cases failed against the original `5c171c4c0` source before editing: immediate play, previous, two skips, late image decode, and paused mode return. The first three changed to Hey Jude despite the visitor's choice; mode return showed the portrait instead of the paused disc.

The final interaction suite passes all 22 checks: seven new cases and four existing discovery/card cases in each of Chromium desktop and WebKit/iPhone emulation. Browser time is held during the discovery race and then advanced by one second, preventing slow test IPC from hiding the defect. The player is warmed with its real graphics module before the transport cases; the saved observations report loaded native graphics and continued playback after the play race.

The late-decode case intentionally delays one `HTMLImageElement.decode()` promise. The retained-page case dispatches synthetic persisted `pagehide`/`pageshow` events; it verifies the application lifecycle handlers, not browser eligibility for an actual back/forward cache. Other cases use ordinary native keyboard and pointer input. External analytics and font/embed sources use the repository's deterministic stubs. Neither mobile emulation nor these checks measure a physical phone.

Actual screenshot files remain under `.jekyll-cache/visual-qa/record-intent-before/` and `record-intent-final/`. The review board at `record-intent-review/comparison.png` places original and corrected player crops together. It uses actual Docker product captures, not generated concepts. Incidental record angles, P poses and unrelated page animation vary; no frame-rate or animation-quality improvement is claimed.

## Reproduction

Use the owned Docker server, then run the focused interaction checks:

```powershell
$env:NO_WEBSERVER='1'
$env:VISUAL_BASE_URL='http://127.0.0.1:8080'
npx.cmd playwright test --config test/visual/playwright.config.js interactions.spec.js --project desktop --project mobile --workers 1 --grep 'home record intent|keyboard-equivalent record-card|disc clicks only|dropped meme record|opened meme record' --output .jekyll-cache/visual-qa/record-intent-final
```

Wait for Docker to finish rebuilding before testing. One intermediate run loaded the old script in its first two cases while Jekyll rebuilt; those results are superseded. The final source-to-served Terser digest must match. The later mode-input correction received a fresh complete interaction run.

## Final verification

The [checkpoint data](checkpoint.json) retains six native transport observations, source/build hashes and the scoped checks. The final served script and the `/al-folio` production script both match the source compiled with the configured Terser options. The production homepage references the prefixed script.

- Focused discovery, transport, source-link and mode interactions: 22 passed in Chromium and WebKit.
- Existing player graphics/mechanics cases: 9 passed; the touch-only case intentionally skips the desktop project. These include native rotation and offscreen recovery, needle cue order, delayed/unavailable graphics and genuine Chromium touch transport across modes.
- Homepage checkpoint: all four viewport cases passed, each inspecting light and dark at 1440×1000, 1280×800, 768×1024 and 390×1000.
- Production Jekyll build with `/al-folio`: passed in 61.923 seconds after the final source change.
- Style contract, 166 Python checks, targeted formatting and diff checks passed. Override audit retains the same 80 existing local overrides.

The generated review board was inspected directly. Its upper pair shows the discovery title/selection correction; its lower pair shows preservation of the paused disc. The workshop, B1 credit treatment, realistic room, avatar assets and private concept decisions are unchanged. This is a verified local checkpoint, without publication or push.
