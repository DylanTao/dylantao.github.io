# Our sea beside the photoreal bar: the gaps, largest first

docs/todo.md, item 10, step T1. Sirui, November 15: "can you use code and things and blender etc. to get to similar or better quality for things we have?", linking William Faucher's Easy Waterscape for Unreal Engine 5.7 (https://www.fab.com/listings/ddd28113-6f59-4ba3-bf60-ad7b1920a547). Its listing describes layered swell, mid waves and fine chop made not to repeat; foam where the water folds; a coast tool for foam, wave run-up and breaking surf along the land; an underwater view with a crossing at the surface; and buoyancy from the waves.

Judged by Claude on November 17, 2026 from our realistic render at 16:20 on November 14: one frame from the surf line on the beach and one from out on the water facing the cliff. What exists is described in `assets/js/home-scene/FFT-OCEAN.md` and `shore.mjs`; read them before changing anything.

## The gaps

1. **No surf.** Nothing breaks and nothing runs up the beach: the water meets the sand as a still edge with a thin white line. La Jolla's beaches are made by breaking waves, so a coast without them reads as a lake. A breaking band where the depth shoals, run-up that wets the sand and drains back, and foam left behind are the largest step toward the bar.
2. **No swell.** The surface is nearly flat, with no long lines of swell coming in from the horizon toward the shore. Swell sets the rhythm of the place: the breaking in gap 1, the lift of the floating orange and the sea lions, the sound in item 8.
3. **Repetition.** The fine ripple tiles visibly, close at the surf line and as a regular grain across the bay from the water. The listing's layers are chosen not to repeat; ours need at least two scales of chop at unrelated sizes, and detail that fades with distance.
4. **Thin foam.** Only a line at the waterline. Foam belongs where waves fold and break, in streaks drawn out by the wind, and in a lace that thins as it ages.
5. **Wet sand that does not breathe.** The beach has a wet band, but it does not darken and dry with each wave's run-up.
6. **No underwater view.** Item 9's sea below would close this; the crossing at the surface is part of it.
7. **What already holds up:** reflections of the cliff, the shallow sand showing through near the shore, and the colour of the open water.

## Next

Close gap 1 first and measure it: frames at the same hour and place, before and after, with the surf's motion recorded at CI's clock. Then gap 2, which gap 1 will need anyway. Keep the frame budget: the outside view's see-through surfaces already cost a fifth of the frame (item 15).
