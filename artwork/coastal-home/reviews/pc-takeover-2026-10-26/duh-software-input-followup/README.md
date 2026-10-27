# Companion input proof on the software renderer

The native desktop mode/format integration case passes. CI exhausted its total 120 s budget after readiness while continuous llvmpipe frames held the page: focusing took 11.34 s and the first two real key presses 24.89 s and 30.00 s.

The test now uses the repository's existing explicitly advanced 10 Hz functional clock after native readiness on the qualified software backend. All assets, real key inputs, nonblank/different-pixel assertions, camera-velocity checks and single-companion/Human-AI transitions remain. Native scheduling and its 120 s budget are unchanged. Software proof has a 600 s wall budget and makes no performance claim.

The final focused case passes in native D3D11 and in the official Playwright 1.58.2 Ubuntu container with qualified Mesa llvmpipe, four samples and floating-point targets. The first clocked attempt failed because the reduced-motion listener had not been stepped; it remains in the ignored local review. The corrected case advances that listener before inspecting cleared velocity. See verification.json for source binding and CI identifiers.
