# Graphics Lab Agent Brief

Use this brief to take one paper from the Graphics Lab's watchlist into Sirui Tao's 3D coastal home, or to keep your own browser scene honest about the graphics research it borrows. The record at `/projects/graphics-lab/record/` (data in `_data/design_records/graphics-lab.yml`) is the starting point; the coastal home record holds each technique's full build history.

## Visitor problem

A scene full of graphics techniques looks like one picture. A visitor cannot tell which effect comes from which paper, where it simplifies, or what would make it better. Keep every experiment traceable: one row on the lab page, one section in the record, real files and functions, checked sources, stated limits.

## Start from the record, not from the paper

1. Run `python bin/design_record_brief.py graphics-lab --system <system-id>` and read the technique's current state, limits, last move and papers to try.
2. Open the technique's files at the functions the record names, and the scene note it links (`PHYSICS.md`, `ONSEN-WATER.md`, `THERMAL-STEAM.md` and the others).
3. Read the paper for the one thing the watchlist says it adds. Decide what you will simplify before you write code, and write that down where the technique's notes live.

## Keep the house's contracts

- The homepage opens in 2D. 3D loads only on request, and any failure returns the 2D desk.
- Simulations advance on the scene's active clock in fixed ticks, accept at most 0.25 s per call and drop the rest. Pause, hidden tabs, offscreen views and reduced motion compose a still frame.
- Every new material, pass or override draw joins `program-warmup.mjs`, or its first draw freezes the page.
- WebGL2 through three.js r164: no compute shaders and no ray queries. A solver that needs them becomes fragment passes, a CPU module, or a separate experiment page first, as the light lab did.
- A change meant only to save cost changes 0 pixels in seeded, paused-clock captures. A change of look gets a matched A/B, measured interleaved, never batch against batch.

## Test the math before the picture

- Put the method in a pure module that runs in Node, and test it against a closed form or a brute-force reference: conservation, boundary behaviour, determinism across frame rates, energy decay.
- Then check the rendered scene: nonblank WebGL, the affected room at the routine's hours, reduced motion and recovery.
- Report measured cost with the machine, the browser and the load on the host.

## Record what happened

- Update the technique in `_data/design_records/graphics-lab.yml`: what it does now, the files and key functions (each name must appear in its file), the new source, the limits that remain. Move the paper from the watchlist into the technique's sources.
- Append the move to the coastal home record's history (frame, dimensions, move, backtalk, reframe, commit) and update its technique there too.
- Recapture the experiment's still with `node bin/capture_graphics_lab_stills.cjs <preview-url> <still>` and `python bin/make_graphics_lab_thumbnails.py`. Scale frames; never retouch them.
- Cite only what you checked against a DOI record, a publisher's page or the authors' page. Run `python -m unittest test.test_design_records`.

## Credit

The experiments adapt published work in small, bounded forms; each record entry credits the papers it builds on and says where it simplifies. Borrow methods and cite them. Do not copy code or assets without their licence.
