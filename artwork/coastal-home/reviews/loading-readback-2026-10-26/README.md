# Loading drawing: acquire the canvas before exact comparison

The desktop fallback case was the only failed visual job on `eec3a64d5`: 40 of 41 jobs passed in run `40452172173`. Its two held, reduced-motion screenshots differed by only 1–3 channel levels. The original and reconstructed first PNG, the received PNG and an exact difference image are retained here. The first PNG was recovered from Playwright's complete byte-array diff and checked against every received hunk before decoding; it was not redrawn.

Native Chromium reproduced a change between two immediate canvas RGBA reads while the paint journal remained empty. Progress, drawing, stroke count, dimensions, transform, filter and opacity were unchanged. Later reads were identical. This establishes a readback acquisition effect in that control, without assigning it to an unmeasured browser or driver mechanism.

The test now acquires the readback first, then requires exact RGBA hashes, exact PNG bytes, unchanged placement and an empty paint journal over the held interval. It also retains the unfinished-progress bound, real model gate, completed ready state, drawing removal and zero runtime errors. No pixel tolerance, progress injection, omitted model or browser security flag was added.

The final case passes native Chromium desktop and qualified Mesa llvmpipe desktop/phone (two cases). `native-fallback.json`, `native-readback-diagnostic.json`, `mesa-desktop.json`, `mesa-phone.json` and `qualified-result.json` retain the state and backend evidence. These are functional checks with actual compressed assets; their timings are not hardware-performance claims.

The bake CLI also stops promptly when the scene reports a failed initialization or light-field error. A provisional architecture control exceeded the unchanged 750,000-triangle bound; the CLI reported that failure instead of waiting out the readiness timeout. Successful bakes still use the official snapshot export, source recheck, 800,000-byte limit and descriptor-only update.
