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

The first Linux attempts reached the PC over an HTTP host alias, where `isSecureContext` was false and the controller correctly remained unavailable. A local HTTPS endpoint then verified `isSecureContext === true`. In that run, 13 checks passed and the slow landscape capture exposed a one-shot sensor fixture: screen rotation reset neutral, then the fixture sent no further samples and correctly reached the no-data fallback. The fixture now supplies a continuing held pose every 100 ms, including after rotation; its pause/resume transition updates the held pose before resuming. The timeout was not relaxed. The final HTTPS Linux run passed all 14 selected checks. CI and deployed readback are recorded when complete.

The background remains a stylized relief/glyph representation. Rendered checks establish functional behavior and the saved appearance; Sirui's aesthetic decision and physical iPhone motion/permission checks remain separate. The laptop-only metrics pipeline is outside this PC batch.
