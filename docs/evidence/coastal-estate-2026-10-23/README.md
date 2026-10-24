# Coastal estate checkpoint

The house now has a supported pool terrace, covered cooking/dining pavilion, wet bar,
grounded arrival garden and a two-storey cave library on the right of its ocean-facing
view. The private gallery connects to the bedroom behind the bathrooms. Two real
fluted-glass pocket doors separate the public living-floor arrival and upper private
arrival from the outside stair.

The pool has a 10.8 m swimming lane, a 22 cm sun shelf with two loungers, and an 85 cm
bar-stool bay. The terrace's ring beam and three cliff-connected piers are modelled
solids. The retained fire bench faces the sea, leaving the dry promenade continuous.

The final circulation checks caught and corrected a desk blocking its stair landing,
two lower vestibule wall islands intruding into the public stair, and the old bench
severing the pool promenade. These fixes changed the source geometry; the body radius,
step limits and collision exclusions were preserved. The garden-to-roof route now
follows the mineral path around the portal's solid stone fin and oak brow.

## Acceptance evidence

- **Native circulation:** all 15 delivered-Draco tests pass. Both entrances, both
  library floors, bedroom connection, internal stair, stair-to-writing-table passage,
  bathrooms, dry promenade and rooftop return are covered. The promenade uses a
  56 cm test body and passes 13.79 m each way. See [native journeys](native-journeys.json).
- **Native source:** 321 library/arrival samples retain at least 2.273 m headroom;
  the library stair has at least 2.825 m. Mainland and library roof are closed solids.
  [Source contacts](architecture-contacts.json), [outdoor contacts](outdoor-contacts.json)
  and [the bounded bench repair](firebench-repair.json) retain the measured data.
- **Rendered states:** 1440×1000, 1280×800, 768×1024 and 390×1000 show the complete
  ten-room scene without runtime errors. The mobile document remains 390 CSS pixels
  wide without overflow. An orbit changes 399,219 pixels in the 768-pixel capture.
  The final desktop drag and zoom change 1,326,733 and 1,197,995 pixels;
  [interaction evidence](drag-zoom-evidence.json) retains the measured camera change.
  [Browser evidence](browser-evidence.json) records readiness, mirrors, body binding,
  doors, rendering dimensions and cache state.
- **Interactions:** six targeted Playwright cases pass: both bathroom floors by day
  and night at all four sizes, actual opening/crossing/closing of both entrance doors,
  and real twin-thumb movement/look on mobile. Six viewport-inapplicable repetitions
  are intentional skips. Desktop and mobile self-reflections use the selected native
  avatar, one owned skeleton and the existing 256/128-pixel shared reflection target.
- **Engineering:** 685 JavaScript tests pass with seven existing skips; 271 Python
  tests pass. Style, skill validation and portable Prettier checks pass. Windows CRLF
  differences are separated from formatting changes. The root production build and
  publication/AI-readable output validator pass. The starter `/al-folio` build also
  passes. [Built asset hashes](built-asset-hashes.json) verify 106 byte-exact runtime,
  model and cache assets, plus the three semantically identical JSON projections.
- **Budget:** the existing first-scene calculation is 4,063,659 of 4,194,304 bytes.
  The exact-source diffuse cache is 725,784 bytes. All 12 loading-sketch views are
  regenerated from the delivered geometry. Materials retain the 18-line/10-point
  analytic-light budget; 20 cached practical channels supply diffuse transport.

## Visual review

The [exterior](1440-exterior-day.png), [terrace](1440-pool-day.png), [pavilion](1440-pavilion-night.png),
[garden](1440-garden.png), [reading room](1440-library.png),
[private gallery](1440-library-upper.png) and [live mirror](1440-mirror-guest.png)
are actual browser captures. The [mobile library](390-library.png) and
[mobile mirror](390-mirror-guest.png) use a real 390-pixel page layout.

The post-integration repair run passes seven further browser cases: the full water/
clothing recovery proof, wildlife orbit/zoom/return at all four widths, and gym
framing on desktop and mobile. [Mobile gym samples](mobile-gym-framing.json) retain
the actual resumed-frame advance for every tested pose; the [mobile animal orbit](390-sea-lion-orbit.png)
retains its real touch-sized layout. These functional checks use a disclosed 10 Hz
virtual clock and do not measure device performance.

The final live smoke exposed duplicated contact-lighting declarations when a room
change created an avatar material variant and wildlife inspection rebound it.
The corrected hook applies once per compiled shader, keeps the active finish's
uniforms, and preserves the installation, skin and static-light callbacks. The
complete library-to-Walk-to-mirror-to-wildlife sequence now passes without runtime
errors, with a matching CPU regression. Two further horizon cases retain the
original pixel threshold and sampling region: their camera moved 30 m seaward so
the expanded pavilion no longer intersects the intended sea-only view.
[The retained samples](contact-and-horizon-repair.json) record both checks.
The fullscreen entry/exit/focus/scroll case retains its original assertions and
whole-test budget. Eight-millisecond virtual-clock steps admit one input/resize
RAF callback per poll. Its frame wait uses that existing test budget so a valid
software paint can finish without tripping a shorter nested synchronization limit.
The legacy outside-view/zoom/scroll/explicit-return case now passes in Linux Docker
with its original 300-second test budget. It uses the existing
[qualified Mesa WebGL2 backend](legacy-backend-qualification.json), retaining four-sample
and floating-point targets. Chromium and WebKit remain separate legacy projects.
Its input polling observes actual new frames; it does not replace geometry, pixels
or state assertions.

Night review added useful output to the two actual library task lamps and pavilion
pendants. The reading lamp's transport radius matches its shade, so the shade does
not incorrectly eliminate its entire indirect-light contribution. Library cameras
keep the vault and mezzanine enclosed, preventing suspended guard balusters in
the lower view. The mirror preserves the complete reflected body and sun shadow.

## Retained limits and next inspections

- Physical-phone frame rates still need a device baseline. These captures and the
  desktop host's rendering time establish layout and behavior, not phone performance.
- The optional first-person body has a small open-neck artifact at an extreme
  straight-down angle. It stays recorded in the [mirror checkpoint](../estate-mirrors-2026-10-23/README.md).
- The retained broad mainland/coast material batches use bounded receiver approximations.
  A future precision pass can partition those batches locally; it should retain the
  per-material lighting budget. The final night views are the current acceptance.
- Pool swimming, stool seating and lounger activity animations remain future interactions;
  the pool's distinct spaces are modelled, and Walk retains its water exclusion.

The broader Linux release matrix also caught the wildlife orbit entering a new
terrace pier, five empty outdoor transport channels, and clocked fixture
issues. Wildlife inspection now uses the real collision field down to the nearby
beach, preserving its opaque-picking check. Compare the [blocked view](1440-sea-lion-before.png)
with the [repaired orbit](1440-sea-lion-orbit.png); the [native ray diagnosis](inspection-pier-diagnosis.json)
identifies the new pier and the duplicate terrain lift. The five garden/portal fixtures remain
direct analytic lights; they no longer store empty diffuse channels outside the
16 receiver cages. Activity clothing is reapplied when the actor changes cached material groups, so
leaving the bath restores the authored shirt; [recovery evidence](transport-recovery.json)
retains the before/after materials and all 20 positive channels. Gym sampling waits for a real resumed frame, and legacy software
checks use the existing disclosed 10 Hz functional cadence at full viewport size.

Architectural source references and original-geometry boundaries are in
[asset provenance](../../../artwork/coastal-home/PROVENANCE.md). The scene skill points
to the updated architectural-continuity and walking/mirror guidance in the canonical brief.
