# Visitor navigation and PC camera continuation

Sirui reported difficult room navigation and a PC camera that stopped in both directions. The ordinary public study reproduced the stop: repeated horizontal drags stalled at yaw −0.52008, and downward movement stopped near pitch 0.30. The exterior's earlier full-turn test had not covered this interior collision behavior.

The public **Rooms** disclosure now offers every interior, the patio/coast, the clifftop entrance, Whole home and Back to Sirui. Selecting a room closes the menu, returns focus to the canvas and sets the next Walk start there. The actual delivered collision field must find a supported, clear standing position; a pending build waits, and a failed placement refuses the start. Ordinary first Walk still begins at the entrance. The patio start uses its connected dry paving instead of the terrace bounding-box center, which lay inside the pool. Native capsule traversal verifies the dry start through the facade opening.

A desktop drag that reaches an interior orbit obstruction now holds the already-clear camera position and continues looking from there. Yaw remains continuous; vertical look keeps a small pole margin at ±1.52 radians. It does not move through the obstacle. Home, Reset view or another destination restores the authored framing. Touch keeps its existing orbit behavior and can explicitly choose Look freely. Authoring controls remain private. The menu fits above or below its bar, stays inside the viewport, scrolls when needed and keeps 44px targets. Escape closes it before leaving fullscreen.

## Evidence

- Complete production build after fast-forwarding four scheduled weather/Scholar updates to `2ebab9a92`. Its 123 scene-module source/output hashes and exact cache/manifest read back successfully. The local Scholar refresh agreed with the already-published October 31 snapshot, so no duplicate data commit is needed.
- All four standard Chromium widths: five passing cases and three intentional desktop-only skips. Modern WebKit 27.2 phone: the public embed, menu, selected-room Walk and fullscreen return pass. Native 4K and dark-theme captures are retained separately.
- Pinned Linux/Mesa: camera continuation passes; the corrected room journey passes. These are software functional checks, not hardware performance measurements.
- Full Node suite: 908 pass, seven existing opt-in skips, including the new native dry-start/circulation regression. Full Python suite: 320 pass. The post-fast-forward cache/weather/fullscreen contracts pass, and the 144-case-per-project scene registry has no missing or duplicate entries.
- The official `node bin/bake_coastal_static_light.cjs` regenerated the cache from the current source. Geometry remains the `75afc57f…` native checkpoint; this batch changes no GLB. Cache size is 792,929 bytes.

## Retained failures and limits

The first native camera fixture tried to read the private lab object on a public URL. Its replacement observes a read-only collision flag in the existing scene evidence; it does not enable the lab. The first Linux room run completed its visible navigation and failed while demanding another frame after returning to an offscreen, correctly idle embed. The replacement asserts the fullscreen/page transition itself. Both failures remain under `attempts/`.

The first dark-menu inspection also caught its heading behind the fixed site navbar; the final fit includes that visible chrome. The near-bookshelf 4K view prompted an independent native-triangle check: the fixed camera is 0.2468m from the nearest retained surface, not inside the books or ladder. The baseline and later diagnostic image dates differ; they establish interaction behavior and safe coordinates, not a matched lighting comparison. No frame-rate improvement is claimed. Physical-device confirmation of the new controls remains separate. The organic cliff, direct main descent, native hardware/foliage integration and wider interior/life review remain separate work; this navigation checkpoint does not close them.

Run `python artwork/coastal-home/reviews/visitor-navigation-2026-10-31/verify.py --git <checkpoint>` to verify payloads and source bindings. The packet is sealed before publication; later CI/live receipts belong in a separate release record.
