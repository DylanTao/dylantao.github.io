# Stable palette sampling after the Linux CI failure

The [mobile footer job on `78671568e`](https://github.com/DylanTao/dylantao.github.io/actions/runs/40426020359/job/121931866678) rejected the repeated-request check: the mean of the sampled row moved by 8.0757 RGB units against the unchanged limit of 2. The retained artifact is `12699727769`; its full ZIP and trace remain under `.jekyll-cache/visual-qa/footer-linux-78671568e/`.

The row contained blog-card text. In the 175 ms screenshot and the repeated-request trace frame, the blank left margin stayed exactly RGB(221, 221, 219), while the text pixels changed. Those screenshots took about 3.18 and 2.06 seconds respectively on CI's software renderer. Manually paused parent transitions do not freeze every subsequently inherited text-color transition. This was an unstable palette measurement, not evidence that the background fade restarted.

The test now samples an actual blank gutter strip 4 px wide below the fixed header. It adds no probe element, hides no component, and keeps the same greater-than-100 color distance, 25–75% midpoint, monotonic progression, less-than-60% quarter step and less-than-2 repeated-request distance. Full footer/viewport frames remain part of the evidence.

Repeating the same mode must also preserve the actual palette animation, retained coastal canvas and its animation. A real runtime ablation disables only the repeated-mode guard: the gutter remains identical, but the coastal frame and animation are replaced and the strengthened test rejects it. That negative control proves the repeated-arc intent still has a meaningful gate.

The repaired three-case suite passes in the matching Playwright 1.58.2 Linux container against the complete owned site, with all assets available. It reports Vulkan SwiftShader; the original GitHub job used llvmpipe, so this is a separate software-renderer check. Native Chromium and WebKit results are recorded in `verification.json`. No production runtime, shader, quality setting, drawing asset or numeric threshold changes in this repair.

`ci-patch-175.png` is the original PNG sample. `ci-repeat-trace.jpg` is the repeated-request sample from the trace's JPEG screencast, not a reconstructed lossless screenshot. The exact recorder, trace, controls and all local outputs remain ignored. The coordinator owns the new Linux CI run and deployed verification.
