# Gym light ownership and private-room diagnostics

Source `b636e67c6` repairs two reproduced gym defects. Its existing pendants now
use their workout power while a visitor looks or walks into the gym. The
whiteboard replacement and moving bars/plates declare the gym as their physical
lighting receiver before the shared material factory binds them. They previously
used the default exterior receiver and missed the gym's emitters.

Explicit model assignments and an already-bound material keep precedence over
that declaration. Unmarked materials retain their old default. No fixture,
power, source position, receiving region, base color, exposure, shadow map or
shader loop budget changes. The authored workout and unoccupied schedules remain.

The matched native RTX 3080 Ti/D3D11 captures use the real authored camera at
2560x1440, noon/evening, Ghibli and the complete optional models. The whiteboard
becomes readable. A separately disclosed body fixture stands on the actual gym
floor and takes ordinary movement input before its first-person capture.
These are light/receiver controls, not a claim of a complete public navigation
journey or measured frame-rate performance.

Passive `onAfterRender` observers read the GPU uniforms immediately after each
real draw. They confirm the current GPU program, `slfReady=1`, and the board's
receiver change from `exterior` to `gym`, including its actual pendant colors.
Every observer callback is restored exactly. No light, material or uniform was
overridden by the observer. Private-living noon pixels remain exact under the
gym-only repair; evening differs at two pixels by at most 1/255, with its
chair-back region exact.

The 28 focused tests pass, including the real prop constructor, emitter-pack
binding and explicit-override precedence. Style, formatting and diff checks
pass. The full worker suite reports 901 cases: 893 pass, seven existing opt-in
rendering cases skip, and the signed production-cache test correctly fails
because this source-only branch has not replaced its canonical cache. An
initial missing worktree ESM Playwright installation was resolved with
`npm.cmd ci`; the cache is the only failure after that. The coordinator must
run the complete current-root suite after the combined official bake before
publication. No test was skipped or weakened to hide that gate.

## Private living: two rejected cage trials

The ordinary private-room camera mainly presents the chair backs. They are
extremely dark, while their sun-facing surfaces remain bright. The native
back-face witnesses reach world z12.39. All original probes lie seaward of
them, at z10.825/11.975. A restored unit-white-sky control measures positive
weights and dim irradiance there; this is not a zero-weight blackout or a
missing GPU field.

The isolated source/output workspace at port 4159 used unmodified copies of
the official baker for a fresh baseline and two bounds-only trials. All keep
16 regions, 128 probes, 28 practical channels, 619,773 accepted and 116,123
skipped triangles, with the original 750,000-triangle and 800,000-byte gates.
The geometry includes the accepted hardware/leaf candidate from the separate
[foliage review](../study-foliage-2026-10-31/README.md).

- Extending max.z from 12.55 to 14.1 moves two near low probes into seat cushions.
  Private valid probes fall from eight to six; chair backs become darker.
  The cache is 785,129 bytes. Rejected.
- The geometry-derived 13.25 extent places the near probes in front of the
  seats and the far probes behind the backs. All eight private probes remain
  valid and the cache is 795,558 bytes. Actual noon chair backs still become
  darker, so the trial is also rejected.

Both trials retain matched noon/evening, real standing-body and adjacent-room/
outside captures. The original cage and exact fresh official baseline cache
are restored to the preview. Neither private metadata trial enters the source
commit. Its 792,594-byte cache and manifest remain QA controls; they are not
copied into the canonical products or offered as the final combined bake.

The old 70ee4eac5 public preview stays on the desk even at the attempted workout clock,
so the attempted plain-public gym capture fails its room guard in both engines.
Those failures are retained. The coordinator's new public Rooms flow owns the
final desktop/phone selection proof; this packet does not relabel an authoring
fixture as that public navigation result.

`MANIFEST.json` seals the portable evidence and `SOURCE_BINDINGS.json` binds
the source and actual compiled controls. The canonical native master remains
`75afc57f664101e59150910f86662b21ccf01087c393521ab1fa1886e481c5ad`.
No independent push occurred. The private-room lighting problem remains open;
a fitted, physically supported reading lantern is the next approved attempt.
