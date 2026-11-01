# A grounded curled raccoon tail

Source `98474dd24` corrects the sleeping raccoon's ringed tail, which was mostly
buried in its slope. It rotates only the real tail-base joint toward its measured
skin/ground contact. The curled shape and child-joint acting remain intact. The
root, trunk, other joints, paw contacts and the other 27 animals are unchanged.

## Actual native contact and preservation

An independent paired proof checks all 500 delivered tail vertices in 642 poses
at half-second steps through 160 seconds by day and through an evening transition.
It covers sleep, wake, walking, digging, sniffing, looking and standing. The worst
baseline tail penetration is 193.7 mm. The final minimum gap is 0.6357 mm, with no
missing support; sleeping gaps stay below 0.7076 mm. The largest actual joint
correction is 0.477 rad, within its 0.65 rad guard. Already-clear tails retain
their authored rotation.

At every paired pose, world hashes are exact for all 6,524 non-tail body/paw
vertices, every non-tail joint, the root, and all 27 other neighbours' skeletons.
The fitter never moves a paw or lowers/raises the whole animal. The wider retained
patch measures the tail's actual footprint separately from the existing paw patch.
Incomplete edge support or an excessive correction rejects the attempt and
restores the authored tail pose; it does not invent a plane. Actual tail-vertex
continuity is checked across wake and contact-release boundaries.

Passive actual-draw readback finds the current beauty draw's bone sampler bound
to the real skeleton texture. All uploaded bone matrices match their live
bone-world/inverse-bind products with maximum error zero. Original render
callbacks, framebuffer bindings and active texture restore exactly, with zero
GL/runtime errors. This qualifies actual GPU skinning, not only CPU pose fields.

## Public views and bounded verification

Normal public N inspection and arrow-key orbit show the tail at the front, side
and back of the sleeping animal, followed by an actual evening wake/walk sequence.
Native Chromium/D3D11 captures use 2560 x 1440; WebKit 27.2 uses the 390 x 1000
phone layout. There are 56 uninterrupted RAF records per engine and 28 original
PNGs, all nonblank and error-free. Only Date is fixed. Frame/active-time reads
bracket each image; these are comparable public cameras and motion states rather
than identical-pose pixel comparisons. WebKit is emulation, not a physical-phone
or performance result.

All 42 animal tests pass, including four new focused contact/preservation/edge/
continuity cases. The existing delivered-paws/gull-wings registered browser case
passes at all four standard widths (2.0 minutes); its last-run JSON says passed
with no failed tests. PowerShell reported a native stderr status for benign
NO_COLOR/FORCE_COLOR warnings even though Playwright's four cases passed; both
the complete log and machine-readable status are retained. Style contract,
targeted Prettier and diff checks pass. No new browser case or registry entry is
added by this source-only CPU contact test.

The first modern WebKit launch could not find its executable. Installing the
same WebKit 27.2 build into an isolated QA browser cache enabled the successful
run; no older browser result is substituted. A first unit assertion treated
quaternion angle roundoff as a nonzero change. The evidence now reports exact
zero when no correction occurs; actual unmodified joint/vertex hashes were
already equal. Both harness failures remain in the logs.

## Retained attempts and limits

A fixed local-x tail lift was ineffective after the tail had curled sideways: it
needed over 1.2 rad and still intersected the slope. The accepted correction uses
the actual offending tail radius and world up, transformed into its parent's
frame, and converges in a few small rotations. Attempt source and measurements
are retained.

This fixes the tail only. The unchanged sleeping trunk underside still has
separate native Hips/Chest witnesses reaching about 49/46 mm below soil. Those
vertices are retained honestly and are not relabeled as tail success. The seal
and sea-lion contacts remain a separate measured repair lane. The eastern rabbit
route/cutaway fix has its own
[qualification packet](../rabbit-fixed-ground-2026-10-31/README.md).

`SOURCE_BINDINGS.json` binds the source commit and exact served module bytes;
the source gzip payloads are exact Git blobs. The earlier
[rabbit contact packet](../rabbit-contact-2026-10-31/README.md) retains the full
26-file frozen baseline model/module controls. Native paired rows, actual GPU
matrices, original PNGs, live frame records, tests, logs and producers are retained
here, with every payload hashed by `MANIFEST.json`. These are finite checks on
the accepted terrain, not guarantees for every future pose or a changed F6 surface.

Nothing here changes a native model, official cache or public manifest, and
nothing was pushed. The coordinator owns integration, final F6 support checks,
the official combined cache, full gates, CI and deployed verification.
