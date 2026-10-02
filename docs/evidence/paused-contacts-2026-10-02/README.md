# Paused contacts and respectful visitor input

Three concrete defects remained after the scene recovery checkpoint. This pass fixes them without adding public controls or promoting pending visual concepts.

## Paused human performance

The original paused render cleared its cached activity pose, sending the authored cup or weight back toward its storage target. Native Docker coffee and strength tests failed before editing: the phase became null and the prop moved despite frozen active time. The captured cup moved 0.748 m and the weight 0.109 m. An unchanged paused recovery could also re-evaluate the animation mixer, overwriting fitted wrist corrections.

Manual Pause now retains the sequence snapshot, fitted hands and existing prop positions. It preserves a stair journey rather than teleporting to the destination. A newly loaded prop composes once at its current target; a deliberate activity/avatar change or system reduced-motion state places stored props directly at their rest anchors. Ordinary moving pickup/return interpolation is unchanged.

## P after a visitor leaves

P's director emitted a new `listen` cue when hello completed, then immediately changed the phase to `return` because the pointer visitor was absent. The native world rig and rendered browser both reproduced the mismatch: `return` phase with a fresh listening gesture. The director now discards that stale cue. The existing wave can complete; cooldown, greeting count, bounded touch invitations and ownership remain governed by their existing contracts.

## Keyboard shortcuts

Focused disc and canvas handlers consumed modified shortcuts such as Ctrl+D and Alt+Left. Native controller delivery probes observed 16 modified/composing disc events canceled before the fix, with an unintended discovered card; none were canceled after the fix. These probes use DOM keyboard events for modified keys and trusted Playwright input for plain-key positive controls. They verify the listener's cancellation and state changes, not the browser's bookmark dialog or operating-system accelerator delivery.

Both handlers now yield Ctrl, Meta, Alt and composition events. Plain arrows, Space/Enter and D/Shift+D remain usable on the disc; ordinary canvas orbit/zoom and N/Shift+N remain available.

## Evidence and reproduction

The [checkpoint](checkpoint.json) records final verification and native observations. Local actual images and JSON remain under `.jekyll-cache/visual-qa/`:

- `held-props-before/`: original failing coffee and strength pause captures.
- `p-departure-before/`: original rendered stale listening cue.
- `paused-contacts-final/`: corrected pause, resumed contact, explicit static composition, stair and canvas shortcut cases.
- `record-shortcuts-review/`: native Chromium/WebKit original/patched input delivery, actual captures and reproduction script.
- `pause-performance-review/comparison.png`: labeled actual before/after coffee and exercise frames.

Use the owned Docker preview with `NO_WEBSERVER=1` and `VISUAL_BASE_URL=http://127.0.0.1:8080`; verify rebuilt scene modules with `node bin/verify_character_preview.cjs` before visual tests. The new rendered cases match `pausing (breakfast|workout) keeps`, `P finishes a wave`, `modified and composing canvas` and the extended stair-recovery test. The record test is in the legacy interaction suite. `test/pip-departure.test.mjs` executes the actual GLB rig and shared motor, while `test/record-keyboard.test.mjs` executes the actual disc listener with event adapters.

Ten scene cases passed across Chromium desktop/phone emulation and a representative WebKit coffee case; pointer departure intentionally skips the separate touch path. Six focused record interaction cases passed in Chromium/WebKit. All 52 focused Node tests, 166 Python tests, targeted formatting and the style contract passed. The `/al-folio` production build completed in 59.07 seconds; source/served/production hashes match for both scene modules, and the compiled record script matches the source compiled with the Docker Terser options. The override audit retains 80 local overrides.

Mobile routes are desktop browser emulation. Controlled animation clocks test continuity and intent; no physical-phone, energy-saving, film-quality animation or continuous-collision claim follows from these fixes. System reduced motion deliberately composes a still state. The pending sitewide visual concepts remain available for Sirui's taste feedback.
