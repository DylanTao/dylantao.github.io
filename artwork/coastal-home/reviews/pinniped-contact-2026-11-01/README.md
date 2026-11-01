# Grounded marine rests and continuous weight transfers

Source `b6b2946296f23c8d3e78b281d4914552205f1b1b` fits the three land sea lions and
three harbor seals to their actual delivered terrain. It corrects buried
flippers, transfers a released roll onto the body's real skin, and removes
side-switch and collision-solver twitches. It preserves every delivered skin
vertex, model, instance, authored schedule and update cadence. Swimming animals
retain their original motion. No native model, canonical manifest or official
light cache was written in this worker checkpoint.

## Contact and motion

The bearing survey uses native body samples and retained terrain triangles.
Actual body/skin support controls the root correction; each flipper moves about
its real shoulder, with its tip acting and shape intact. A consistent measured
hinge avoids changing rotation axes when the lowest corner changes. The target
clearance remains 0.65 mm, the joint limit 0.75 rad and the existing planted
contact upper limit 2 mm. The maximum measured joint correction is 0.592519 rad.
Native Float32 skin weights retain their explicit micrometre precision bound.

A raised rolling shoulder releases naturally. When both front fins release,
the former centreline lift could leave the whole animal 27–28 mm above rock.
The revised fit seats it onto an actual skin vertex or triangle interior. A
conservative soft envelope of all delivered points rounds the transfer between
contacts; exact finite-face overlap guards rock creases between those points.
Its additional support offset is capped at 1.2 mm. This is a bounded kinematic
contact fit, not a mass or elastic-body simulation. Intentional shuffle humps
retain their authored lift. The dense survey's largest physical contact gap
above that intentional lift is 1.341282 mm. Signed root correction ranges from
−26.936973 to +95.406226 mm; there is no extra upward correction for sea-lion 0.

The isolated sea-lion 0 relocation is the coordinator's native-surveyed proposal
`[-9.7, -6.6382, -14.8115]` on native source `de217984`. It preserves the original
12.2658 micrometre authoring offset, then rounds the metadata point. The unsafe
old point is retained as a rejected rock-shoulder fixture. A 337 mm body lift is
not an accepted solution. The proposed point appears only in the private
qualification manifest here; the coordinator owns the producer/manifest update.

Full spring tails and continuous left/right activation replace the binary side
switch without changing the label API or shared acting code. Collision-only
Newton used to stop at different positive overshoots; a bounded collision/free
bracket now refines the first clear pose. Already-clear raised fins stay free.
The old fin witness at `seal-1 / 29.609660902 s` and the failed gravity support
corners remain in the attempts. The final motion check covers 1,007 events and
15,105 full-skin poses, including every retained failure, authored boundaries,
observed side/contact/roll thresholds and measured seating/support-cap changes.
Maximum skin motion over 20 microseconds is 0.062633 mm; maximum one-sided
velocity difference with a 0.1 ms step is 0.096288 m/s, with zero unresolved
poses. Seven-frame 30/60 Hz trajectories and periodic forced-pose hash controls
qualify the actual draw catch-up path. These are finite numeric trajectories,
not browser FPS or a proof over all possible times.

## Delivered geometry and explicit missing queries

At half-second steps through 180 seconds, all 2,166 poses and 10,258,176 delivered
vertices are independently checked. Both finite-face BVHs produce exactly the
same full world-skin hashes, root transforms and measured fields as flat face
queries. The other 22 animals' skeleton matrices are exact against accepted
source `98474dd24` at all 361 times. Source and ground ownership remain bounded;
there is no global drop, geometry reduction, rate reduction or clearance waiver.

The smallest mapped vertex gap is 0.649934 mm. That number is **not** complete
skin coverage: 700 dense poses retain 1,783 missing upward projections, at most
seven per pose. The enlarged event survey checks 72,017,700 vertices and retains
13,061 missing projections in 5,179 poses, again at most seven. Runtime evidence
separates bounded contact resolution, planted-query coverage, missing queries
and whole-skin coverage (`null`). Even a planted paddle can have an upper lobe
without a valid upward projection; the dense survey retains 322 such query
misses rather than silently removing them.

Every missing mesh/vertex has native joint/weight custody, nearest full-terrain
and projected-edge records, and vertical-ray records. The event missing points
remain at least 0.758356 mm from the full terrain, with outward dot at least
0.599619 mm and zero negative dots. Tiny decoded beach seams remain unmodified.
Independent triangle SAT tests cover every delivered animal face against all
classified solid terrain faces within the enclosing habitat region, including
side and underside faces: zero intersections in both dense and event surveys.
The runtime height/face query explicitly reports vertical or degenerate
projections as unassessed; its result is not substituted for that all-face audit.

Sea-lions 0 and 1 also retain all 34 earlier separation controls plus 13 new
seating/roll controls. Their minimum sampled skin-vertex distance is 86.320 mm,
with zero full deformed-triangle intersections. This is evidence for that pair,
not a general claim about every animal pair.

## Public views, actual GPU and cost

Public N inspection and arrow-key orbit are exercised at Noon and Evening in
native Chromium/D3D11 at a 2560×1440 viewport and modern WebKit 27.2 at 390×1000.
There are 53 original final PNGs and their live records, with zero runtime
errors. Preloaded probe dependencies keep measured skin/evidence in one
synchronous task; screenshot-end frame/time reads bracket the later image.
One extra desktop frame reached rest after the intended timestamp, so it is
retained as rest. Separate desktop and phone witnesses wait for an actual
naturally occurring roll and more than 15 mm of measured seating. No browser
clock API is called. This is Windows WebKit emulation, not a physical iPhone
performance claim. The scenery, materials and existing night darkness were not
redesigned by this contact checkpoint.

Passive actual beauty-draw readback checks all six skeleton textures: the
bound sampler is the real skin texture and every uploaded bone matrix matches
its live bone-world/inverse-bind product with maximum error zero. Original
callbacks, draw/read framebuffers and active texture restore, with zero GL or
runtime errors.

Performance remains open. A quiet native-clock pair on this PC's RTX 3080 Ti
uses the same fixed 2K/high scene, authoring-point manifest and complete assets.
Public Noon/N/Enter clears animal following before the existing authoring camera
places the matched view. Actual primary camera world matrices match within
`8.88e-16`; projection matrices and solar state match exactly. The yaw scalars
differ by one full `2π` winding, with the same physical camera. Every primary
body draw's matrices, native stamps, fit calls and source-stage records remain
in the receipt. The coordinator and F6 worker held CPU/GPU work during both runs.

| Measured native window, 30–50 s    | Accepted tail baseline |   Final source |
| ---------------------------------- | ---------------------: | -------------: |
| Aggregate contact CPU median / P95 |            no new fits | 16.7 / 20.7 ms |
| Pinniped source stage median / P95 |           0.1 / 0.2 ms | 17.0 / 21.1 ms |
| Primary body frame median / P95    |         33.3 / 49.9 ms | 33.3 / 49.9 ms |
| Delivered frames in the window     |                    610 |            608 |

Six fits run per candidate frame. This is substantial CPU cost. One pair does
not establish a meaningful throughput change or any performance improvement.
The older public-N pair's approximately 4% difference is not final-source
evidence: its cameras differed by about 4.2 cm/0.159° and it predates gravity and
overshoot repairs. A first overlapping baseline window is also rejected. Those
records and the earlier clock correction remain explicitly qualified. The final
benchmark binds the frozen production module receipt's 14 compiled dependency
sources/outputs to accepted `98474dd24`; worker overlays and raw served bodies
are separately bound. Final production minification/build/CI belongs to the
coordinator.

## Verification and next work

All 63 animal tests pass, including delivered skin/cache equivalence, actual
grades and edges, shoulder/shape preservation, released-roll support and the
retained temporal failures. Targeted Prettier, style contract and diff checks
pass. The pre-gravity four-width registered paws/gull run was interrupted when
the unsupported roll was found; no final pass is claimed for it here. No new
formal browser case or scene-group entry is introduced by these focused unit
tests and private qualification producers. The coordinator owns integrated
scene-group registration/checks, the final F6 support survey, official light
rebake, complete release gates, CI and deployed verification.

The unchanged raccoon trunk underside still needs its separate measured repair;
the retained Hips/Chest witnesses are about 49/46 mm below terrain. Remaining
species' appearance/motion review and whole-site performance stay open. This
packet does not close the house walkthrough or other page todos.

`SOURCE_BINDINGS.json` separates exact Git blobs from raw served module bytes.
`MANIFEST.json` hashes every payload. Full dense/event rows, missing-vertex
custody, reference graphs, GPU matrices, original PNGs, benchmark bodies/records,
producers and selected failed attempts are retained. The previous
[rabbit](../rabbit-contact-2026-10-31/README.md),
[tail](../raccoon-tail-2026-10-31/README.md) and
[clock correction](../animal-clock-correction-2026-10-31/README.md) packets retain
the earlier inputs and claim corrections. Nothing was pushed by this worker.
