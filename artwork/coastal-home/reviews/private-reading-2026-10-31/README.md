# A supported reading light for private living

Source `9abe4425a` adds one small native paper lantern beside and behind the upper
living chairs. Visiting the room turns it on; otherwise it rests by day and keeps
a restrained evening glow. The previously near-black chair backs gain readable
warm fabric at noon and night. Existing fixture powers, schedules, material colors,
exposure, shadows, the original probe cage and the 28 practical transport channels
are unchanged. The earlier rejected cage experiments remain documented in the
[lighting diagnostic review](../interior-lighting-2026-10-31/README.md).

## Physical placement and preservation

The final native fixture has 572 triangles in three batched pieces: the paper
shade, cord, and brass canopy with three fine hoops. No floor stand intrudes into
the bedroom approach. Seventeen floor samples beneath the whole fixture footprint
hit the retained upper floor at native z2.6025. The shade bottom is z4.78, leaving
2.1775 m of clear height and 0.4275 m above the 1.75 m standing body. Its cord meets
a real roof surface at native [0.65, -12.65, 5.968626]; all twelve canopy rim
contacts are within 0.000477 mm of that surface. This uses actual face/ray tests,
not an attachment name. The default cutaway lifts the roof away visually; the
standing view retains it.

The decoded effort-10 export adds exactly those three meshes to the four old
upper-room meshes. Every old decoded position, normal, index, auxiliary attribute
and glTF material definition is exact. The full native retained-object digest is
also exact. Maximum observed new-piece compression position error is 0.0539 mm;
the delivered canopy contacts remain within 0.0192 mm of the native roof, and the
delivered shade preserves 2.1775 m clearance. All new native pieces are closed,
manifold solids with positive volume. The canonical master remains byte-exact at
`75afc57f664101e59150910f86662b21ccf01087c393521ab1fa1886e481c5ad`.

## Actual rendered evidence

Twenty matched native RTX 3080 Ti/D3D11 captures cover noon/evening private-room
default cameras, actual supported standing-eye fixtures, kitchen, gym and exterior.
The disclosed standing placement uses the real Walkfield/capsule and eye camera;
it is a lighting/clearance qualification, not a public navigation journey.

Kitchen and gym pixels are exact in both times. Exterior noon changes twenty
pixels by at most 1/255; evening has the small visible interior glow (2,361 changed
pixels, at most 7/255). The unchanged dark fabric stays dark, with visible weave
and form instead of the old black silhouette. The two disclosed chair-interior
ROIs gain about 4.84/7.04 luma levels by noon and 6.97/9.93 by evening on the
0-255 scale. These are local comparison witnesses, not a whole-scene brightness
or measured illumination claim.

Passive `onAfterRender` observers confirm the actual current GPU program and
read the live emitter endpoints/colors for the linen beauty draws. The field is
ready and all observer callbacks restore exactly. Unnamed depth/normal override
draws have no lighting uniforms and are identified separately. No observer
changes a camera, material or uniform. The real shade's emissive strength follows
the schedule: approximately 0.715 on a noon visit and 1.1 on an evening visit.

The 32 Chromium captures cover all four standard widths, noon/evening,
embed/fullscreen, and baseline/candidate. Eight WebKit 27.2 phone captures cover
the same two times and display modes at 390 px. All are nonblank, restore the
official cache and have zero runtime errors. The phone is emulation, not physical
iPhone or frame-rate evidence. The existing 390 px default camera crops part of
the peripheral shade at the right edge; it does not cover the chair view. The
final coordinator build must check its actual public Rooms framing separately.

The first layout producer incorrectly tried to exit fullscreen through its hidden
enter button. The corrected producer uses the visible Back button, retains the
two valid initial captures, and completes the remaining states. Both failed
harness logs remain. This was a selector error, not a blank-scene result.

## Bounded lighting and retained attempts

The single new analytic line is direct-only. Its shortened segment retains the
authored integral intensity of the first attempt (0.52 in scene units); no watt
measurement is implied. The existing 18-line/10-point shader budgets stay fixed.
Actual region overlap places architecture at 18 lines/10 points and upper at
13/10; other packs remain within capacity. Combined arrival changes must repeat
this test. Geometry labels alone do not prove emitter exclusion.

The original transport configuration is byte-exact. The unmodified official
baker includes all 572 new triangles: 620,345 accepted plus 116,123 skipped =
736,468 before ROI, below its 750,000 gate. The final private cache is 792,584 bytes,
below the 800,000 gate. It has 128 probes and 28 practical channels plus the three
sky terms. The lantern is a real occluder, but its own indirect bounce is omitted
because the practical-channel budget is full. There is no new PointLight,
shadow map, full paper transmission or additional diffuse-bounce claim.

Retained native receipts, candidate GLBs and representative renders explain the
form iterations: V1 was too tall and clipped the 2K default frame; V2 fitted but
looked plain and polygonal; V3 rounded the profile but its mismatched hoop/shade
tessellation produced broken ribs. V4 matches the angular samples and offsets
the fine hoops just above the paper, producing continuous details with fewer
triangles. Only V4 is offered for replay.

## Replay and remaining integration gates

Use exact Blender 4.5.9. On an existing final-retreat source, replay
`bin/refresh_coastal_private_reading.py::migrate(scene, config)` after the accepted
hardware/foliage recipes. Its CLI defaults write an ignored private candidate,
never the canonical master or input manifest. A fresh `coastal_retreat.build`
adds the same fixture after its final frame; do not apply both routes to one
source. Double application rejects, and independent cage/frame/fixture changes
fail closed. `finish_metadata` registers only its one installation idempotently.

The 322 Python tests, 29 focused Node tests, style contract, compile, targeted
formatter and diff checks pass. The earlier source-only gym checkpoint records
the expected signed-production-cache failure; no worker has weakened that gate.
The coordinator owns the combined native AO/export/support/sketch pipeline,
official final cache, actual public desktop/phone Rooms views, complete current
root checks, CI, publication and live check. These isolated products are evidence,
not canonical assets or an independent deployment.

`MANIFEST.json` binds the portable payloads. `SOURCE_BINDINGS.json` binds the
source commit, canonical input and actual compiled scope. No independent push
occurred.
