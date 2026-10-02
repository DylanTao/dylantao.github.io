# P's visitor performance

This October checkpoint replaces unrelated random room gestures with an authored visitor encounter: notice, wave, listen, then return to Sirui's activity or the record. A nearby pointer triggers one greeting. Remaining nearby cannot trigger repeated waves; a new encounter needs both an absence and an 18-second cooldown. No camera, microphone or person tracking is used.

The eyes lead the neck, the shell follows more slowly, and the antennae retain their damped response. The actual GLB's optical catchlights now follow its pupil positions. Flights look before departure, use minimum-jerk distance timing, bank within a 0.16-radian limit, round authored corridor corners within 12 centimeters, and finish with less than a centimeter of settling. The endpoint is P's safe perch, rather than the human activity anchor. This is original staged animation, not a rigid-body flight solver or autonomous physical robot.

The robot retains its two antennae, unequal convex lenses, white tapered ceramic shell, orange dot and detached fins. Its 848,688-byte GLB and 27 meshes are unchanged. P still has one owner across the page, world and playground; it cannot select a room, move the camera or change the record. Its real modeled click opens `/projects/p/`.

## Evidence

- Six new pure tests cover encounter order and habituation, cooldown/flyby/travel suppression, composed stillness, pause during a wave, flight clearance and speed, four-second render intervals, and eye/neck/shell ordering. The ten existing companion tests pass too.
- An actual Docker homepage capture observed task → notice → greet → listen → return → task, one greeting, no runtime errors, and a successful click on the modeled robot that opened its project page. A separate run confirmed paused active time stayed fixed and 2D return restored page ownership and its working project link.
- The 12-second scene recording shows the encounter and a short study-perch flight. It records the real WebGL canvas; it does not include browser chrome or the page's CSS edge feather. Full-page screenshots show that composition separately.
- An isolated studio view renders the same product GLB through the same world companion and shared motion. Its notice, wave, listen, return and rest images are labeled as studio views, rather than homepage screenshots. Both optical catchlights were found and driven; no generated mockup is used.
- A desktop D3D11 capture reported a 16 ms median frame interval, 18 ms p95 and 7 ms median submission time for the whole occupied-room renderer. These are one desktop run, not a physical-phone benchmark or an isolated robot cost. A 100,000-iteration director/flight microbenchmark took 57.55 ms; that excludes WebGL and does not predict device frame rate.
- The existing scoped browser regressions passed desktop 2D pointer/graphics recovery and page/world ownership at desktop and phone widths. The phone 2D pointer test failed its fixed 500 ms gaze sample with zero movement; the unchanged page controller can suppress pointer tracking during its authored quiet interval after a journey. This fixture result remains for the integration coordinator to resolve; it is not reported as a pass.
- Syntax, targeted Prettier, the style contract and `git diff --check` pass. The fresh worker's Python run could not complete because PyYAML and timezone data were absent; the integration coordinator runs that gate in the established QA environment.

The local artifacts are in `.jekyll-cache/visual-qa/robot-performance/`: `room-before.png`, `room-after.png`, `room-performance-12s.webm`, `room-12s-evidence.json`, the five `studio-*.png` captures and `studio-evidence.json`. They are intentionally outside Jekyll's watched inputs.

## References and limits

[Disney Research's _Realistic and Interactive Robot Gaze_](https://la.disneyresearch.com/wp-content/uploads/root.pdf) informed habituation, differing eye/head bandwidth and returning to an authored task. [Reachy Mini's movement documentation](https://huggingface.co/docs/reachy_mini/SDK/python-sdk#movement) remains the reference for independently articulated targets and standard minimum-jerk interpolation. The choreography and browser controller are original; neither research implementation nor recorded robot motion is copied.

Pointer proximity is a deliberately small visitor signal. Listening means a visual attention pose; P cannot hear or understand a visitor. The short flights respect authored perches and circulation envelopes, but there is no general object collision solver. Phone checks use browser emulation. Sirui's taste feedback remains the design acceptance criterion. This checkpoint is local and does not publish the site.
