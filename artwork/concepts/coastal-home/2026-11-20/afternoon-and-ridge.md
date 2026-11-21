# Afternoon light and the Torrey ridge

[Four rooms in afternoon light](four-rooms-in-afternoon-light.webp) · [Torrey pines from the water](torrey-pines-from-the-water.webp)

## The ridge at dawn

At 1.5 seconds into the opening film shot, the original 300 m view fades the crowns to broken outlines. Several of those crowns are only 270–295 m from the eye because the depth composite begins its fade ahead of the clip plane. Extending the camera reach to 440 m reveals the intact crown geometry and the gaps beneath it. The fitted limbs close those gaps, using the existing trunks and canopy centres as their attachment points.

The fit adds 508 tapered branches to 127 retained Torrey pines. All 160 original visitor-mesh primitives are byte-identical. The deferred model contains 229,239 triangles and 1,511,716 bytes. Camera reach eases from 300 to 440 m as the view distance goes from 48 to 66 m. At the standing and interior views, the near plane, far plane and haze retain their original values.

The three 460 × 92 px crops share the 1440 × 1000 camera, film time, and crop ([206, 270] to [666, 362]). They are reproduced at native size. The overview uses the finished frame cropped vertically from y=64 to y=869. All images keep their capture exposure. The 440 m control comes from the settled repeat of the original crown geometry and the same reach as the fitted frame.

Replay the opening shot through **Rooms → Film**. Pause at 1.50 s on the November 20 Pacific date and use a 1440 × 1000 fullscreen canvas. The shared eye is `[-50.5390625, 5.8, -64.0859375]`, the target is `[17.26953125, 1.90859375, -13.3984375]`, and the lens is 40.69921875°. The baseline source is `c8caa2553`, the camera checkpoint is `92ac4793b`, and the geometry checkpoint is `011a1821c`. [Camera](../../../../assets/js/home-scene/camera.mjs) · [Native branch fit](../../../../bin/fit_coastal_hinterland_pines.py) · [Exact Draco append](../../../../bin/pack_coastal_hinterland_pines.py)

## The afternoon rooms

The comparison adds one measured diffuse solar reflection to the signed field from `ba2272f7e4397d4dee1cfd504641ee40b88aeccc`. Each pair uses the same grounded standing camera, actual sky, direct sun, scheduled lamps, and released exposure. The trace uses 256 primary rays per valid probe with 64 m sun-shadow queries within the retained geometry. The viewer still uses the released probe moments and their visibility weights. The photographs are matched crops of 1440 × 900 WebGL frames, downsampled equally. The living floor uses the settled repeat control so the cushion seams are shared by both sides.

| Pacific time | Room              | Visible change                                                                                        |
| ------------ | ----------------- | ----------------------------------------------------------------------------------------------------- |
| 2:15 p.m.    | Lounge            | Shaded oak gains 7.05 mean luma values and the sofa’s inside face gains 4.10.                         |
| 2:45 p.m.    | Living floor      | The nearby seat fabric gains 4.16 values. The hearth highlight holds.                                 |
| 3:30 p.m.    | Gym               | The sunward floor edge changes subtly. The strongest lift falls on neighbouring foreground equipment. |
| 4:15 p.m.    | Upper indoor bath | The near stone rim responds. The basin is golden in the control and gains only 0.60 mean luma values. |

These measurements are on the final 8-bit display output, after tone mapping. The clearest improvement is the lounge, where the bounce restores detail in the shadowed oak. A general brightness lift would take contrast from the fireplace and flatten the already-golden indoor bath. The existing steam and water optics are combined in both bath photographs.

Run these commands from the [solar transport review](../../../coastal-home/reviews/solar-bounce-2026-11-20/README.md) with an existing root-site preview, a checkout containing the source commit, and an external output directory.

```text
node collect-r2.cjs CHECKOUT ba2272f7e4397d4dee1cfd504641ee40b88aeccc OUTPUT http://127.0.0.1:8080/
node measure-r2.mjs CHECKOUT ba2272f7e4397d4dee1cfd504641ee40b88aeccc OUTPUT 2026-11-20 --room-addend
node capture-r2-ab.cjs CHECKOUT ba2272f7e4397d4dee1cfd504641ee40b88aeccc OUTPUT http://127.0.0.1:8080/
```

The measurement emits the four exact coefficient arrays in `R2-DELTAS.json`. The capture binds the release cache, records both frames and takes a repeat after switching off the addend. For the board, the lounge, living floor, gym and bath use crops beginning at y=305, 284, 257 and 233 respectively, all finishing at y=900 over the full frame width. The script supports `--dry` to check the signed inputs and instrumented modules without opening a browser. [Measured ratios and limits](../../../coastal-home/reviews/solar-bounce-2026-11-20/RESULTS.md) · [Comparison capture](../../../coastal-home/reviews/solar-bounce-2026-11-20/capture-r2-ab.cjs)

Coastal Home by Sirui Tao and Codex. Codex fitted the native branches, reviewed the camera, and produced the solar trace and comparison captures. The panels are browser renderings of the authored scene. [Native asset provenance](../../../coastal-home/PROVENANCE.md)
