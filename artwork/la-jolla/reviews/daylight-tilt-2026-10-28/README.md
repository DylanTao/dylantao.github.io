# Daylight coast and optional phone tilt

Sirui asked for a brighter daytime background, better background movement, and phone tilt as an optional counterpart to mouse movement. The frozen `6d1058730` noon baseline already had a light page, but the distant ground read as a gray band. Its evening anchor closely reproduced the supplied dark view while keeping foreground buildings unusually bright. Manual theme choices remain deliberate choices; **Follow clock** in the theme menu restores the current hour.

The revision gives the daytime horizon a pale atmospheric blue, adds stationary grass/chaparral variation to the measured relief, and reduces blue-hour/night presentation fill. The ground cover is authored procedural shading, not surveyed vegetation. USGS relief, OSM footprints, their provenance, and the compressed composition remain as documented in the [owning brief](../../../../docs/la-jolla-footer.md).

An asynchronous lighting defect was also corrected: completing a new sky table used to repaint the sky while leaving horizon haze and the reflected sky based on the preceding table. Completion now relights them together. The regression test compares the actual water uniforms with the completed atmospheric samples in the same clock step.

The camera now makes a small, damped two-axis movement, bounded to 0.32/0.15 scene units with fixed world-up. Terrain, foreground and reflected water share that camera. On capable touch devices, **Enable tilt** requests orientation only after a tap, calibrates to the held pose, and maps gravity into portrait/landscape screen coordinates. Dragging, visibility recovery and motion pause reset calibration. Sensors detach while inactive. The five-second no-data fallback remains; scrolling and swipe exploration remain available.

## Comparable native renders

All four images use the same 2560 × 1440 viewport, 2560 × 480 drawing buffer, fixed October 28 noon clock, reduced motion and manual theme anchor. They are actual Chromium/ANGLE/D3D11 renders on this PC's NVIDIA GeForce RTX 3080 Ti. No runtime errors were collected. The framebuffer, browser version and served module receipt are in [captures.json](captures.json).

| State   | Before                                                          | After                                                 |
| ------- | --------------------------------------------------------------- | ----------------------------------------------------- |
| Noon    | [Gray distance](noon-before-2560.png)                           | [Pale horizon and warmer ground](noon-after-2560.png) |
| Evening | [Bright foreground against dark hills](evening-before-2560.png) | [Reduced foreground fill](evening-after-2560.png)     |

[Phone composition](phone-noon.png) and [landscape tilt control](phone-landscape.png) retain the smaller view. The landscape image uses simulated sensor input, not physical-phone hardware.

## Verification and retained attempts

[verification.json](verification.json) records counts and contrast; [source-build-proof.json](source-build-proof.json) binds the authored LF source to the production compiler's served module bytes and CSS.

- Full Chromium footer/dusk matrix: 79 passed, 45 existing viewport-specific skips. The minimum median credit contrast among the 16 theme/viewport checks was 5.909:1.
- Final sensor-stream/motion checks: 16 passed across the four standard viewports.
- WebKit/iPhone emulation at DPR 3: 13 selected footer/dusk checks passed; four final sensor-stream checks passed again separately.
- Affected route checkpoint: home, blog and La Jolla project, four widths and light/dark, 12 route cases passed with both themes captured inside each case.
- Node: 877 passed, seven existing skips. Python: 314 passed. Formatting, style contract, scene-group registration, production Jekyll build and override audit passed.
- The home light-cache input signature still equals the committed `446cb58634c9d9c6d2e8a3c4d076c41fed18dfb1ff0bac95397d886e46411b39`.

The first Linux attempts reached the PC over an HTTP host alias, where `isSecureContext` was false and the controller correctly remained unavailable. A local HTTPS endpoint then verified `isSecureContext === true`. In that run, 13 checks passed and the slow landscape capture exposed a one-shot sensor fixture: screen rotation reset neutral, then the fixture sent no further samples and correctly reached the no-data fallback. The fixture now supplies a continuing held pose every 100 ms, including after rotation; its pause/resume transition updates the held pose before resuming. The timeout was not relaxed. The final HTTPS Linux run passed all 14 selected checks. The corrected [complete CI run](ci-results.json) and [deployed readback](live-readback.json) are green.

The background remains a stylized relief/glyph representation. Rendered checks establish functional behavior and the saved appearance; Sirui's aesthetic decision remains separate. The laptop-only metrics pipeline is outside this PC batch.

## Published bytes and the CI clock correction

The live [readback](live-readback.json) binds the five footer modules to their authored and compiled hashes, with the Pages commit/run mapped to source `1a4c1c9fb56bce076a7c7075e47fbc0e0e9fdbf2`. The full production stylesheet differs from the local build because deployment runs PurgeCSS. All tilt CSSOM rules matched; the [live browser check](live-render-proof.json) verified the 44px control, actual camera movement, motion pause and no runtime errors. Its sensor input is simulated; the [live phone-layout capture](live-mobile.png) is not physical-device evidence.

The initial `c145c647d` visual run passed 38 jobs, failed the tablet site job at clock setup, and had two remaining jobs superseded by the correction. The historical `install`/one-second `pauseAt` target could already be in the past on a busy runner. The correction installs the clock before application timers with real Date for snapshot admission, freezes Date before pausing, then restores advancing Date while staying paused. The original interrupted-animation assertions remain. All four native and all four Linux/HTTPS viewport cases passed; a separate public-API probe held across 2200ms before pausing and 1500ms afterward, then advanced Date/performance by exactly 32ms. [Clock evidence](clock-setup.json) retains the rejected historical-Date admission attempt and the corrected sequence. Only the test file changed after the product checkpoint.

The corrected [visual run](https://github.com/DylanTao/dylantao.github.io/actions/runs/40793829383) succeeded on attempt 1 with all 41 jobs successful. Its seven triggered source workflows ended in six successes and one intentional source-link skip; Pages succeeded on the source-bound deployment above. The complete tablet site job executed the corrected case and finished with 68 passed / 24 existing skips. The four footer groups finished with 86 passed / 50 existing skips, including all 16 executions of the new cases. The upgrade workflow did not trigger for the change confined to the test; the unchanged product/upgrade inputs passed that workflow on the product checkpoint.

Sirui subsequently tested the deployed footer on his physical iPhone and reported: “Tilt feels natural; scrolling works.” This closes the requested motion-feel and native-scrolling check for that test. No new device model, frame-time measurement or house-performance sample accompanied the reply; those remain separate from this qualitative footer result.

The file manifest hashes canonical UTF-8/LF text and raw image bytes. This packet records the verified source checkpoint; later changes confined to review artifacts preserve its product and test inputs.
