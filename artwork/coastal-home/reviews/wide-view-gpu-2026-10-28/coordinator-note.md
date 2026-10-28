# Scope of the retained GPU diagnostic

This packet measures the earlier complete 4130 build, before the final material-retirement fix. Its shadow cache was disabled before the renderer hooks and it retained 48 invalid-program warnings; it is not a clean-cache or after-fix performance benchmark. The final lifetime packet separately proves zero warnings and active cached-shadow frames. No before/after FPS gain follows from comparing those different states.

The raw timer scopes are not additive: ocean and shadow samples are subsets of scene draws. Analytic haze composition is not the entire volumetric pipeline. The 2K process ended on a fullscreen resize protocol error before its final backend readback; the fresh 4K process completed and retains its actual backend. The worker records fixed time, seeded randomness and public South Park selection explicitly.

The useful next hypothesis is to measure the actual conservative refractive sampling footprint before attempting transmission-capture scissoring. Preserve full target resolution, multisampling, projection, materials and final beauty; include thickness/roughness/mip support, fall back to the full frame on uncertainty, and require controlled pixel parity. No optimization code from this diagnostic is admitted.
