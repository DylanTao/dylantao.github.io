# Rain contacts and filtered surface detail

Verified local checkpoint, November 1 Pacific / November 2 UTC. CI and deployed
delivery are recorded separately when published. The canonical native master and
all GLBs are unchanged by this checkpoint.

The scene now uses varied representative drop sizes, shorter exposure-based
streaks and first downward surface contacts. Ocean impacts launch bounded
gravity-capillary normal packets. A separate authored shower estimate supplies
the much denser small-wave detail that the displayed lines cannot represent.
Pixel-footprint filtering turns unresolved slopes into reflection roughness.
The existing ocean displacement, optics, foam, reflection, animal wakes and
quality-tier geometry remain intact. There is no additional draw, shadow caster
or rendering pass.

The [physics notes](../../../../assets/js/home-scene/PHYSICS.md#rain-contact-and-small-wave-detail-november-2026)
give equations, primary sources and limits. This is an original bounded browser
approximation, not a reproduction of a named solver or a state-of-the-art claim.
The contact mask uses existing conservative terrain/roof heights, the captured
bed and the pool's mean waterline. Rain does not drive the pool's visitor waves.

## Contact and representation evidence

- `actual-contact-comparison.json.gz` records a parallel frozen pre-optimization
  tracker and the final height-bound tracker on the complete actual scene, using
  identical native times and trajectories. All **652 water events** match
  exactly, including both Pacific and pool ownership. Every observed landed
  state agrees. Queries fall from **241,910 to 63,326** (73.8% fewer).
- That diagnostic adds observers and a reference tracker to two source modules;
  `observer-bindings.json` records their original/observed hashes. The reference
  never drives the scene. Its doubled workload is not a performance benchmark.
- The normal-on, repeat and normal-off images share one paused native 2K frame.
  Only rain-response uniforms are disabled for the off control. On/repeat have
  zero changed RGBA channels. On/off differ in 6,245,867 channels, with a maximum
  change of 106. These are authored close-water comparisons, not public-room
  navigation or an isolated proof of individual ripple visibility.
- The source tests compare contact times at 30/60/120/240 Hz with an independent
  Three triangle raycast over the displaced rendered-grid model. They also check
  wraps, pause, duplicate/solid rejection, exact events and rendered segments
  with/without height bounds, packed Float32 IDs, crowded-bin limits, expiry and
  compact/full shower consistency.

`source-snapshot.json.gz`, the producer sources and `PROOF.json` bind the local
source/build/cache. The official baker regenerated the signature: configuration,
probe data, transport and moments remain byte-equivalent to the previous
snapshot. The 750,000-triangle / 800 KB ceilings, 16 regions, 128 probes and 28
practical sources are unchanged.

## Native cost and remaining work

The earlier full-product comparison runs baseline 2K, candidate 2K, candidate 4K
and baseline 4K sequentially. The final source is measured again after the query
optimization. Workers held their heavy CPU/GPU jobs during both windows. These
use an actual RTX 3080 Ti, real clocks, fixed high quality, MSAA 4 and exact
2560×1440 / 3840×2160 buffers, with the complete world loaded. The existing
authoring time control sets 13:20 and the declared eye faces the coast. The
geometry and graphics APIs are not replaced.

| Measurement            | Baseline 2K | Final 2K | Baseline 4K | Final 4K |
| ---------------------- | ----------: | -------: | ----------: | -------: |
| GPU median, ms         |       25.68 |    25.43 |       42.55 |    42.26 |
| Whole-frame median, ms |        49.9 |     50.0 |        50.0 |     50.0 |
| Whole-frame p95, ms    |        50.1 |     50.1 |        66.7 |     66.7 |

These are single local comparisons, not a statistically established speedup.
The added detail has no material GPU increase in these samples, but full quality
still runs at about **20 fps in this rainy scene state**. Overall performance remains open. The first
candidate's 2K p95 was 66.6 ms; that result is retained rather than overwritten.
The final four-second CDP profile follows the timed interval. It points to ground
contact/surface queries and renderer work as investigation targets; sampled wall
time includes native driver waits and is not a clean CPU-utilization partition.
`profile-summary.json` and the original compressed profile preserve that limit.
Physical-iPhone performance is not established by these PC or software checks.

## Checks and retained failures

The final complete production build includes every responsive image. Four
unmodified Chromium desktop/touch cases and two modern Docker/WebKit cases pass,
covering retained natural NWS rain and authored first contact, roof clipping,
nonblank water and paused state. WebKit uses the pinned Playwright 1.58.2 image;
it is Linux software functional evidence, not physical-iPhone or native-GPU cost.
The scene registry covers all 149 cases once at each standard width. Node passes
988 cases (981 passing, seven intentional skips); Python passes 378 tests before
packet sealing. The packet's own custody check runs after sealing.

Early experiments had a reserved GLSL identifier, a malformed producer and
nearly invisible sparse-only ripples. The first production build lacked its
parent directory; the next selected Windows' filesystem `convert.exe`, so eight
responsive pictures 404ed even though rain behavior passed. The complete build
uses the existing ImageMagick wrapper and repeats the same error checks without
filtering. A pre-bake source test also correctly rejected the stale cache
signature. Selected failure logs are retained here; all original trials, full
builds, images and traces remain in the local authoring folders. This selected
packet does not claim complete custody of every private trial.
