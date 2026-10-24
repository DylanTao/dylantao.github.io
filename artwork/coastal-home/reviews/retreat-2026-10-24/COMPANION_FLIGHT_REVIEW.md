# Companion circulation after the inland retreat

The furniture, single-volume library, new bedroom connection and eight-metre
setback changed the space around P's old flight paths. Human-sized route
clearance did not establish clearance for P's wider hovering envelope.

## Integration evidence

`companion-before-native.json` records the integration baseline against the
pre-grounding native geometry: the old rounded cruise line approached the bedside
screen at 0.364 m, the reading furniture at 0.197 m, and the library-to-living
route at 0.012 m. This is a before-repair integration witness, not a screenshot
or a claim about the formerly published architecture. It samples cruise
geometry; the acceptance audit below additionally tests takeoff and settling.

The final [grounded-agave native audit](agave-companion-native-flight-audit.json)
passes **420 flights and 2,832,715 sampled centres**, using the actual
`roomRoute`, `createPipClearanceFlight` and `samplePipClearanceFlight`
implementations. It covers every directed room pair with every authored
alternate perch, twenty same-room wanders, and twenty complete beach departures
with their twenty returns. Sampling includes corner rounding, hover and
settling lift at 0.005 seconds. All four moved agave nodes participate in this
fresh native BVH proof; the previous source proof remains historical.

The final native source SHA-256 is `c1fced7e108395b64ca7c8ad96e9a275d131b47115d4cbaf334da48701940027`.
The final resample manifest SHA-256 is `d18cf00964742ff9579825ab2fd0bc9e4b68f9a244bfd2a8e2f228a6fcf7896b`,
with static-light-cache signature `5c22d31113986ac2170783ff36986c69721cefea93dc2e5df075f524ec4c4fd8`.
Only the cache descriptor differs semantically from the retained production
manifest snapshot; earlier receipts preserve the whitespace-only formatting
chain. The four runtime modules and both sampler/audit scripts retain their
exact raw hashes; canonical-LF hashes are also reverified for deployment. Every final flight record is byte-identical to the fresh audit
input: payload SHA-256
`9d72e61b9b62bcd5ffb8c10223213af92b9b7582591543bd9192aecc7f219e01`, excluding its context header.

The [final sample binding](companion-final-sample-binding.json) preserves the
earlier source, heading/cache and formatting stages, then explicitly binds
this fresh grounded-geometry audit to the final manifest. The final post-CI resample verifies identical records after the gull-selection
and onsen-inlet fixes and subsequent cache refresh. Native geometry and all
four companion modules remain unchanged, so the fresh agave BVH result is
retained without another native replay. No old-source geometry result
substitutes for the fresh grounded-geometry audit. Its minimum surface
distance is 0.430948168 m; after the conservative between-sample arc allowance,
every flight remains at least 0.426573168 m clear against the unchanged 0.42 m
envelope. Each route retains its closest native mesh and position. Large raw
JSONL and native audit files from the removed worker worktrees now live in
`.jekyll-cache/retreat-worker-custody/2026-10-24/`. Its verified inventory maps
original paths to copied paths with exact bytes and raw SHA-256. The latest
resample lives in `.jekyll-cache/retreat-companion-post-ci/` in the root checkout.

## Authored changes and tradeoffs

The canonical `artwork/coastal-home/companion-flight-paths.json` preset supplies
P-only room exits, a private bedroom/library connection, main-stair air-point
adjustments, safer resting positions, and a dry-patio approach to the fixed
coast. Coordinates are final world coordinates after the eight-metre housing
setback. Apply the preset once at the end of native metadata authoring; do not
translate it again. Human contacts, supported steps and their route remain
unchanged by this preset.

P takes a longer, higher arc above the workstation and through the tall
library, then descends into the lower hall. That avoids fitted shelves and
kitchen fixtures without changing their design. The reading trip joins the
shared aisle directly. The patio path stays near X=3 until Z=-3.7 before
joining the established coast waypoints. The coast and beach remain fixed.
Several rest positions move slightly away from chair arms and screens.
No runtime path search, new render pass or additional light is introduced.

The native audit treats proximity door leaves as open and excludes shadow-only
shells and soft foliage; it includes solid foliage trunks and all other native
mesh triangles. Nighttime facade access therefore also requires the controller
to open doors for `worldCompanion.doorPose`, using its base/storey height before
hover. The getter does not allocate full evidence each frame and becomes
inactive when the page owns P. Door automation, delivered compressed geometry
and rendered motion are separate integration checks owned by the coordinator.
This receipt does not claim a visual or physical-phone performance verdict.

## Reproduce

Run from the repository root after the final preset has been merged into the
manifest. Keep the large sampled JSONL file in the ignored cache.

```powershell
node bin/sample_coastal_companion_flights.mjs assets/models/home/manifest.json .jekyll-cache/companion-flights.jsonl
& 'D:\tools\blender-4.5.9-windows-x64\blender.exe' -b --python-exit-code 1 --python bin/audit_coastal_companion_flights.py -- --source artwork/coastal-home/coastal-home.blend --flights .jekyll-cache/companion-flights.jsonl --output .jekyll-cache/companion-native-audit.json
```

Refresh the receipt if geometry, contact routes, resting positions, hover,
rounding or the authored air preset changes. A metadata-only camera or lighting
change may alter the full manifest hash; retain that distinction explicitly.

The binding also retains canonical LF hashes for the runtime and audit/sampler scripts. Original Windows raw-byte hashes remain historical custody; Git normalizes those text files to LF. This line-ending distinction changes neither source statements nor sampled flight records.
