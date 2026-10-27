# Real graphics-context loss and lower-tier retry

The test allocates standard quality, waits for an actual subsequent rendered frame, then invokes the driver's real WEBGL_lose_context extension. Desktop draws four samples; compact phone full screen intentionally caps two within standard. Both retain the standard tier's four-sample ceiling.

The public page returns to the 2D portrait, releases native full screen and stores the lower quality cap. Retrying 3D creates a new canvas with every room and a real avatar, preserves the selected record, uses unpinned low quality and produces a nonblank image. All runtime-error lists are empty.

Final cases pass on native Windows Chromium/D3D11 at 1440 and 390 CSS widths, and Playwright WebKit in phone emulation. These are driver-loss and recovery proofs on this PC. The WebKit renderer label is not evidence of physical Apple hardware; Sirui's actual iPhone measurements remain separate.

Retained earlier attempts exposed an allocation-wait omission, a mistaken four-sample expectation for compact full screen, and an asynchronous native-fullscreen-exit race. The final assertions inspect actual completed browser/render states. No renderer policy or pixel threshold changed. See verification.json and each before/allocated/after record.
