# Static surface reuse: review cursor

Read [the November research plan](../../../../docs/coastal-rendering-research-2026-11.md),
the retained temporal census, and the earlier exact-pixel batching regression.
The complete HiPR extended-abstract method text was reviewed; it schedules
path-traced updates using visibility and discovered light-transport dependencies.
This raster house does not implement that discovery pass.

The next hypothesis is a cache of expensive static surface evaluation with
explicit invalidation and the original renderer as fallback. Output differences
and offline oracle tile reconstruction do not certify runtime independence.
Gym micro-movement, live water, reflections, shadows and late-model preparation
must remain actual inputs. The census has real 2.4–4.6-second observation gaps;
it cannot establish display-frame reuse rate or speed.

The current lease covers only the existing census/accounting producers and this
note. Before a code trial, propose one unused lab module, its exact new paths,
source/camera/projection/material/visibility dependency generations and runnable
correctness gates. Amend the queue only after that review. Preserve the old
renderer, full detail, assets, native timers and failed controls. No renderer
change is admitted by this proposed entry.
