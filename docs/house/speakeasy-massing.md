# The speakeasy, the longer study and the glass lift: three massings

The first step of docs/todo.md, item 4 (creative direction, brief 3): three ways to place the rooms, on paper, before any geometry. Written by Claude as creative director on November 17, 2026, for Sirui to choose from. Render each in Blender's workbench, from the sea and from inside, before deciding.

**His words.** "leverage the empty area of the study room, maybe it can be a better decorated speakeasy bar and also the study room can also further go into that area, and the elevator go down from speakeasy to bottom"; "a transparent cliff elevator ... while appreciating the view from ocean". **Where:** `docs/images/sirui-2026-11-16-house-at-night-speakeasy-and-lift.webp`, the dark rock right of the study as seen from the sea, with his lines down to the beach.

**Shared by all three.** The study grows a few metres into the rock with its own shelves and a reading chair. A bookcase in it swings open: the secret door a speakeasy promises. The bar is warm and low-lit, never murky: a back bar of brass and amber glass lit from below, a short counter with stools, a banquette, a record player for his records. The lift is a glass cab in a glass and steel shaft, ridden in walk mode, about eight metres down to the beach, one line of light on the cliff at night.

## A. Behind the bookcase

The bar is dug straight back into the rock behind the study. No window to the sea except one narrow slot, framed like a painting, at the end of the room. The lift's door is beside the slot; the shaft runs down the cliff face from there.

- **For the visitor:** the strongest surprise. From bright study through a bookcase into a dark, warm room, then the slot of sea, then the glass cab dropping down the cliff.
- **Costs:** the most carving and the deepest room, so the most new geometry for the light bake (B1 budget); the bar has no daylight.
- **From the sea:** almost unchanged. The slot and the lift's line of light are all that show.

## B. Along the cliff face

The bar extends sideways to the right of the study along the cliff, a long low room with one horizontal window over the sea at study level. The lift stands at its far end.

- **For the visitor:** the best view while drinking; the room reads from the sea as a lit band in the dark rock, which answers his ring on the screenshot directly.
- **Costs:** less carving than A; the window changes the house's elevation, so it must be drawn with the existing glazing's rhythm.
- **From the sea:** a new lit band right of the study, the lift beyond it.

## C. A half level down

Behind the bookcase a short spiral stair goes down half a level to the bar, which opens onto a small terrace at the head of the lift, cut into the cliff below the study.

- **For the visitor:** two moments, the stair's descent and the terrace's open air; the lift starts outdoors with the whole sea in front of it.
- **Costs:** a stair for walk mode and the camera (the stair hall lesson, H7), a terrace that must look engineered (the under-the-pool lesson, O2), the most varied geometry.
- **From the sea:** a terrace with a light under the study, the lift dropping from it.

## Rendered

`docs/images/speakeasy-massings-2026-11-17.webp`, made by `bin/render_speakeasy_massings.py` (Blender's workbench, November 17): each option from the sea and in plan, the bar in amber, the study's extension in oak, glass in pale yellow and the lift in blue, laid over the house so they read through the rock. The site, measured in the model: the study's floor is the house's zero, behind glass about 0.8 m landward of the model's origin line; the headland Sirui ringed rises to about 11 m south of the study; its sea face is about 14 m out from the study's glass; the beach is about 7.5 m below the study's floor.

## Recommendation

**B**, with A's secret door. It answers what he drew (the empty dark rock right of the study, lit), gives the bar the view the house is built for, carves the least, and keeps the lift at the end of a room rather than inside rock. If he wants the surprise above all, A. Decide the tide-line question after the massing: whether the shaft goes on below the water to a window into the sea (item 9).

## Before building

- Read the light bake's triangle budget (B1) and the arrival's plan (item 6), which shares the architecture pass.
- Keep every room reachable in walk mode and by the Rooms panel; give each new room its own entry in the manifest.
- Judge from the sea at noon and at night, and from inside at night, beside the references.
