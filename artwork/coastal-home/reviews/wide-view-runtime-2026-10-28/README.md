This checkpoint refreshes the sea mirror's existing transmission exclusion list after model preparation. Previously, the late hinterland could add its spring, creek and koi water after the list was sampled. Until its periodic refresh, those three materials triggered another opaque scene capture inside the mirror. Main-scene objects, materials, lighting, resolution, samples and detail stay intact.

In the retained native 2K first-entry pair, every one of 14 visible late-model mirror draws submits 1,450 draws before the fix and 744 after it. Both versions submit 744 after the old list catches up. The actual garden water remains visible and transmissive in the main scene. This is a first-entry repair; it does not solve the expensive steady outside view.

| First visible mirror window, native RTX 3080 Ti |   Before |    After |
| ----------------------------------------------- | -------: | -------: |
| Draws per mirror capture                        |    1,450 |      744 |
| CPU submission median, 14 captures              | 19.90 ms | 10.25 ms |
| GPU elapsed median, 14 valid captures           | 20.58 ms |  9.66 ms |

The coordinator and native-geometry worker held compute/render work during this paired window. `TIME_ELAPSED_EXT` surrounds the real sea-mirror `renderer.render`; its interval includes GPU idle time waiting for CPU dispatch. It is not pure shader time. The scene clock is held through reduced motion, while RAF, performance and timers remain native. These figures are neither moving-scene FPS nor a physical-phone result. All model bytes are delivered; the test briefly holds the real hinterland response only to guarantee that it arrives after the mirror's first sample.

The [measurements](measurements.json), [raw timing records](raw/first-entry-timed-2k.json) and [source/asset bindings](source-bindings.json) retain that scope. The frozen complete production asset set contains 121 home assets and the official `5251671b…` light cache. It predates subsequent F6 geometry candidates. Compiled owned modules use the production `site_module_assets.rb` recipe; no cache JSON or descriptor is hand-signed.

At 2K, the native main buffer is 2560×1440 and its mirror is 1280×720. At 4K, they are 3840×2160 and 1536×864. These are the same settings before and after. The final 2K timing pair has identical steady PNGs. The 4K pair has identical first-entry and steady PNGs. An earlier 2K pair differs at two fireplace-edge pixels; the unchanged candidate's repeat matches the baseline exactly. Both controls are retained, rather than masking that region or relaxing a pixel gate.

- [2K before](images/2k-before.png) / [after](images/2k-after.png)
- [4K first entry before](images/4k-first-before.png) / [after](images/4k-first-after.png)
- [4K steady before](images/4k-before.png) / [after](images/4k-after.png)
- [Earlier 2K candidate](images/2k-control-initial.png) / [unchanged repeat](images/2k-control-repeat.png)

The new real-browser regression seeds the mirror before releasing the complete hinterland, checks the actual reflected render list, and confirms that all three garden waters remain present in the main scene. It also checks a room return, a new avatar prepared inside, a quality change and nonblank pixels. Native Chromium passed it and the existing real context-loss/retry case. Windows WebKit 27.2 passed the same late-load case at a 390×1000 touch viewport. That independent engine check is not a physical iPhone measurement. The public style is fixed to realistic; disabled/style deferral is covered as a unit contract.

Broader attempts were rejected:

| Attempt                                                  | Retained observation                                                                                                                            | Decision                                                         |
| -------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| Same-source finish reuse with original depth-tie order   | 814→665 materials; native 2K ABBA source 17.43/17.28 fps, shared 17.30/17.49 fps                                                                | No useful gain; withdrawn                                        |
| Receiver cache correction required by that prototype     | Initial sharing restored 127 wrong receiver groups through the style cache; correction restored all 961 compared material entries/uniform packs | Current unshared initial scene already matched; keep recipe only |
| Conservative geometry-box refinement                     | Zero eligible outside-view draws proved outside the frustum                                                                                     | No implementation                                                |
| Static-field uniform bypass diagnostic                   | Shared-host timing; continuous bypass state was not retained                                                                                    | Unqualified diagnostic, no cost bound or product change          |
| Contiguous raw-buffer batching with flat Float32 diffuse | Exact native 2K/4K pixels and about 254 fewer steady draws, but source 17.04/16.68 fps versus 15.92/15.66 fps                                   | Regression; withdrawn                                            |
| Memoized material-state batching                         | Fingerprints rebuilt only 348 times over more than 630,000 visits; source 16.99/17.05 fps versus 15.84/15.78 fps                                | Regression; withdrawn                                            |

Both batching versions retained original objects and raw position/normal/colour data, guarded material and custom-uniform owners, and waited for actual buffer-upload callbacks. Nevertheless, they cost roughly 25–32 MB of additional buffers and did not improve frame pacing. Ready program counts stayed at 124; later candidate counts reached 141 versus 137 in the controls. No renderer hook, diffuse-attribute shader, buffer cache, receiver-cache patch, culling rule or quality reduction remains in the runtime code. The compressed patches and raw ABBA records in [attempts](attempts/) preserve those failures. A future broad renderer change needs an actual GPU/driver trace and program-variant explanation, not a draw-count proxy or an assumed WebGPU speedup.

The as-run Windows producers in [recipes](recipes/) retain their local dependency/server paths. [checks.json](checks.json) records the completed qualification. [MANIFEST.json](MANIFEST.json) binds every other packet file by byte count and SHA-256; the local attributes preserve text line endings across checkouts. The coordinator owns the new scene-title registry row, combined source-bound cache bake, full CI and deployed-byte qualification. No steady-FPS, 10-second startup, physical-phone or completed-item-24 claim follows from this checkpoint.
