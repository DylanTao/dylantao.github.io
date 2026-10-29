# Duh leaves live reading clear

The default idle character could remain over article text during scrolling, then take a recovery arc across several more lines. The delivered-source control produces **105 occluding frames out of 504**, with up to **1,505 opaque contour pixels** inside live ink rectangles. The corrected controller produces **zero** such pixels across **4,051 native Chromium frames** at four widths and both themes, plus **1,015 modern WebKit frames** at phone width. The character remains painted and visible throughout; native idle morphs and desktop hops remain active.

Product checkpoint: `bd2942a7171a7b937d6647b3499feb845f142221`. Separate browser-input harness checkpoint: `435ccef03b0cd166442cf3e8c5dc87349e6cc78b`. These are local worker checkpoints for coordinator integration, not a deployment or physical-iPhone acceptance claim.

## What changed

Only `assets/js/companion/duh-page.mjs` changes at runtime. A native document scroll refreshes its reading rectangles synchronously. An unsolicited blocked idle pose moves directly to a clear perch before paint, instead of waiting 180 ms and flying across prose. A clear pose stays put. This can relocate the character during a large scroll; it avoids a decorative flight through what someone is reading. Ordinary idle excursions still require clear paths. No article-wide hiding, contour mask, scene pause, reduced-quality rendering or text change was introduced.

Intentional placement remains a different interaction. A drag/drop, keyboard placement/toss, tap invitation or explicit playground invitation retains its chosen pose through the current navigation gesture and then uses the existing physical recovery. Placement provenance is consumed by that gesture and released as ordinary autonomous control resumes after its existing quiet period. The initial automatic playground setup does not acquire deliberate-placement provenance. Physics, deformation, portraits, rough-throw counts, capture, pause and reduced-motion rules remain unchanged.

The first prototype immediately relocated every blocked pose, including a deliberately invited playground pose. It removed the article overlap but failed the unchanged mobile no-jump check with a 62.55 px relocation during a 35 px scroll. Its source, compiled bytes, report and failure image remain under `attempts/`. The accepted intent-aware version passes that same check without changing its limits.

## Rendered and measured proof

- [Reported Linux reading failure](views/reported-reading-failure.png): parent-provided reproduction of the head over the first paragraph. Its byte hash is retained; this is not presented as a same-engine before/after pair.
- Final current-runtime screenshots: [phone light](views/chromium-390-light.png), [phone dark](views/chromium-390-dark.png), [tablet](views/chromium-768-dark.png), [desktop](views/chromium-1440-light.png), [WebKit phone](views/webkit-390-dark.png). All four standard Chromium widths have both themes under `views/`.
- The new case uses real RAF and actual scrolling with no fake scene clock. At every sampled frame it reads the painted canvas contour and current text-line rectangles. It requires a visibly painted character, zero ink overlap, preserved text, zero contact/repair/displacement activity and observable native idle motion. It includes forward/back scrolling and 7.2 seconds of subsequent idle observation. Each accepted cohort contains 505–510 sampled frames and at least 2,388 painted body pixels; the existing scroll opacity remains 0.22 rather than disappearing.
- The sensitive control substitutes only the retained delivered compiled Duh module into the same complete site. It fails the actual painted-ink assertion as expected. `negative/results.json.gz` records an **expected failure**, not a successful fix; `negative/live.json.gz` retains every sampled frame.
- The native suite preserves all intentional paragraph-impact, repair, throw, invitation, captured-touch, viewport/no-jump, card/home drop, native link, selection and fallback checks. No old threshold was relaxed.

`data/summary.json.gz` maps every run and cohort to actual counts. The full original reports remain under `runs/`, including the rejected prototype and initial WebKit harness failures.

## The tablet paragraph translation

The passive original-runtime trace shows zero Duh contacts, repairs, displacements and article `Element.animate` calls. The paragraph's CSS transform changes while post-scroll `scrollY` stays fixed.

A separate live tablet readback directly identifies the active GSAP tween targeting the actual first paragraph: `y:20`, `scale:1`, `runBackwards:1`, duration `0.7573667855`, and `clearProps:"transform"`. Its CSS matrix progresses through Y offsets 20 → 8.2294 → 3.2794 → 1.8138 → 0.8294 → … → `none`. Contacts and repairs remain zero. This verifies the once-only block entrance in the unchanged `cinematic.js`, rather than attributing it to Duh or guessing compositor scroll motion. The original Linux two-image comparison is owned by the coordinator; this packet establishes the live entrance mechanism, not an independent replay of that exact Linux pixel pair. The coordinator's reading fixture waits for that actual entrance to settle and retains its original ±1 px registration and 0.002 local-shape gate.

## Browser input qualification

The initial modern WebKit full run records 16 passes, five existing scope skips and three harness failures. Each failure reaches an unconditional `newCDPSession` call before its gesture can execute. These original failures are retained.

Both the pinned Playwright **1.58.2** and the separately installed modern **1.65.0-alpha-2026-10-28** expose a tap-only public Touchscreen interface. The current [Touchscreen documentation](https://playwright.dev/docs/api/class-touchscreen) confirms that scope; [BrowserContext documentation](https://playwright.dev/docs/api/class-browsercontext#browser-context-new-cdp-session) limits CDP sessions to Chromium. The local package/interface hashes are in `data/sdk-touch.json.gz`.

The separate harness commit keeps Chromium's genuine CDP touch streams unchanged. Generic drop, pickup and underlying-canvas drag use their existing real mouse-pointer path on WebKit, matching the existing viewport/capture test. All physical-drop, grabbability, recovery, native-page-action and camera-turn assertions remain. Those two previously blocked WebKit cases then pass. The dedicated CDP touch-stream test is explicitly Chromium-only; it is not relabeled as WebKit native touch dragging. Chromium's three affected touch/drop cases pass again after the guards. Physical iPhone touch-drag behavior remains a separate device check.

## Gates and custody

| Check                                                | Result                                                         |
| ---------------------------------------------------- | -------------------------------------------------------------- |
| Native full Duh suite, desktop + phone               | 39 pass, nine existing scope skips                             |
| Remaining new-case widths, 1280 + 768                | Two pass, both themes each                                     |
| Modern WebKit initial full run                       | 16 pass, five scope skips, three retained CDP harness failures |
| Modern WebKit corrected generic cases                | Two pass; one explicitly qualified CDP-only skip               |
| Chromium affected touch/drop cases after harness fix | Three pass                                                     |
| Delivered-source negative control                    | Expected painted-ink failure; 105 occluding frames             |
| Focused Duh Node tests                               | 13 pass                                                        |
| Full Python suite                                    | 319 pass                                                       |
| Style contract, targeted Prettier, diff check        | Pass                                                           |
| Complete production Jekyll build                     | Pass, 136.639 seconds                                          |

The changed module has source SHA-256 `c4615ac4d51e95a34682d1670f141aa0e6f3df1674ad97f04fd7f34a837b9366` after LF normalization and compiled SHA-256 `db1a51688ff2dcd65c03d6ba20823edfac8c48bf4cf08b91a067772f776ea306` (22,111 bytes). Actual production output, owned complete preview and HTTP response match exactly. Fourteen other companion modules match the immutable previous complete production build. The later harness-only edit does not change delivered runtime bytes. No header/brand, footer, homepage, native geometry, manifest or light cache was changed in this lease.

The exact new registry title is **`duh: live article scrolling and idle motion leave ink clear without moving prose`**, in `test/visual/duh.spec.js`. The coordinator owns registration, combined-main checks, publication and deployed verification. No worker push was made.

The sealed complete Duh production build and raw Playwright artifacts remain in ignored QA. The immutable prior footer build remains separate. Gzipped producers retain their original ignored-Q relative layout; restore them there to reproduce, using a complete production server and the external-server settings. The modern WebKit config records the separate 27.2 runner without changing the repository pin. `manifest.json` binds payloads and normalized source inputs. Run `python verify.py` locally or `python verify.py --git HEAD` for committed-blob readback.
