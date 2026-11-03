# Preserve the visual suite within the CI deadline

The Ubuntu 24.04 runner pin repaired Ruby setup on `0b63eb579…`. Deployment,
integration, formatting, upgrade checks and CodeQL pass. Forty-one of the 42
visual jobs finish successfully. The desktop exploration log also reports all
26 executed cases passing and three intentional skips, but its job reaches the
unchanged 75-minute limit while uploading evidence. GitHub's annotation records
that deadline; the workflow remains cancelled, not green.

Four existing public-room cases now run in `scene-rooms` at each standard width.
The original exploration group retains 25 cases. The measured slow run spent
about 18.5 minutes on Rooms pointer input and 11.2 minutes on the adjacent-room
inspection; moving these with the public room/Walk and desktop turning cases
gives both groups room to finish and upload their evidence. These timings
describe that CI run, not website frame rate.

The actual Playwright inventory verifies all 149 registered cases at all four
widths, with exact duplicate-free membership. No test, assertion, fixture, asset,
intentional skip, worker restriction or renderer qualification changes. The job
limit stays at 75 minutes. The matrix grows from 42 to 46 jobs; the new full run
still needs its own CI and deployed receipt.

`MANIFEST.json` binds the original run, unmodified log, deadline annotation,
before/after partition, workflow semantic comparison and actual registration
qualification. This changes CI scheduling; the public runtime and model bytes
remain unchanged.
