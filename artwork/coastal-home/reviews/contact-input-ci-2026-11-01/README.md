# Contact/input CI follow-up, November 1

The first visual run on `321a8ebc9` retained two software-renderer failures. The complete original job logs and failing traces are kept here; the run is not relabeled green.

The graphics-loss case exhausted the generic 15-second fullscreen assertion. Its trace contains native fullscreen with seven drawn frames after that deadline. The precondition now uses the existing bounded scene-readiness allowance and returns only the fullscreen mode per poll. All real driver loss, lower-tier allocation, new-canvas, record-state, fullscreen-exit and nonblank-pixel assertions remain. The complete case passes on native desktop/phone and independently qualified Linux/Mesa desktop/phone.

The new Rooms case exhausted its whole ten-minute budget after 22 successful selections at 2K. The final scroll-stability message identifies the interrupted operation, not a demonstrated layout deadlock. It now avoids a duplicate pair of driver RAF waits before each trusted input and has a bounded twenty-minute software budget. It keeps the full 2K desktop, all 26 embedded/fullscreen selections, actual elementFromPoint checks, real clicks/taps, room state, overflow and error gates. The revised case passes on native 2K and phone, and all 26 selections pass on independently qualified Linux/Mesa. These are functional results, not performance benchmarks.

The first local Docker command omitted the required Mesa environment. Its failed desktop trace and terminated run remain explicitly unqualified. The replacements use the owning private-display/backend preflight and retain its actual llvmpipe renderer, four-sample support and float render-target evidence. No model, shader, scene size or graphics allocation was omitted to obtain the replacements.

This checkpoint changes tests and documentation only. The public runtime and signed cache remain those of `321a8ebc9`. The next CI run and live source check require their own release receipt.
