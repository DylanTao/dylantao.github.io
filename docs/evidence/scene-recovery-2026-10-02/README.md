# Character continuity and P playground scheduling

The original room restarted an unchanged activity when a visitor scrolled back, returned from 2D, unhid the page or resumed a retained page. Native Docker capture reproduced the coffee phase returning to breakfast's first phase: the cup disappeared from Sirui's hand. The previous tests observed animation frames and activity IDs, which did not detect this phase reset.

Recovery now preserves the sequence clock, prop ownership and any walk in progress when the routine is unchanged. If wall time crossed an activity boundary during absence, it composes the current activity. Ordinary visible clock changes still walk between rooms; explicit previews, new avatars, Now and reduced-motion changes still deliberately recompose.

P's project playground also kept requesting frames while it was partly visible and the page owned P. The actual studio controller scheduled 31 unowned callbacks over a 500 ms native observation, without drawing the portrait. It now settles with zero pending callbacks until ownership or visibility events wake it. Returning to studio ownership still renders and animates the portrait.

## Rendered evidence

Ignored local artifacts are retained under `.jekyll-cache/visual-qa/`:

- `activity-continuity-before/`: original native failing coffee case, before/after canvas PNGs and state JSON.
- `scene-recovery-desktop/` and `scene-recovery-mobile/`: coffee, strength and mid-stair continuity captures with state JSON.
- `scene-recovery-webkit/`: representative coffee recovery in WebKit iPhone emulation.
- `scene-recovery-integration-final/`: existing offscreen and room-transition checks plus the integrated P playground checks. The earlier attempt was interrupted after its trace identified a private lab control click before opening the menu; that test setup is corrected.
- `pip-idle-review/`: counted native original/patched scheduling observation, actual screenshots and reproduction script.
- `scene-recovery-review/comparison.png`: labeled comparison assembled from actual native coffee captures.

The [checkpoint JSON](checkpoint.json) records source/served/production hashes and final test results. Character assets, materials, public controls, homepage credit and featured work were not redesigned in this checkpoint. This addresses continuity and idle work; it does not claim a new animation quality tier or measured battery savings.

## Reproduction

Use the owned Docker preview with `NO_WEBSERVER=1` and `VISUAL_BASE_URL=http://127.0.0.1:8080`. Confirm rebuilt source with `node bin/verify_character_preview.cjs` before scene captures. Run the scoped public Playwright cases matching `choreography resumes|recovery preserves a stair journey` on desktop and mobile, and the companion case matching `partially visible playground`.

Coffee and strength tests run the actual rendered scene with an explicitly controlled clock. They check phase, prop ownership, root position and frozen elapsed time across four recovery paths. The stair case checks retained route progress, then changes wall time while hidden and checks a composed ground-level dinner arrival. The scheduling unit test executes the actual studio controller with event/scheduling adapters; its portrait draw counter is a probe, not model or visual evidence.

Seven new continuity cases passed across Chromium desktop/phone emulation and a representative WebKit iPhone coffee case. Five integration cases passed; the existing real-time room-transition case intentionally skips mobile. The focused Node checks passed (38 P checks and seven routine checks), as did 166 Python checks, targeted formatting and the style contract. The `/al-folio` production build completed in 63.23 seconds; both changed modules match source, served Docker output and production output after LF normalization. The override audit retains the same 80 local overrides.

## Limits

Hidden-document and retained-page events are simulated to exercise the browser handlers deterministically. They do not demonstrate that real navigation admitted this page to BFCache. Mobile captures use browser emulation on the desktop machine; they do not measure physical-phone performance. The controlled clocks test continuity rather than real-time frame rate. Lifecycle correctness and avoided callbacks do not establish film-quality animation, continuous collision safety, energy savings or a general physics solver.
