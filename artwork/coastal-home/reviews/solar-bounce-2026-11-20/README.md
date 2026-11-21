# One-bounce solar field measurement

In the lounge at 2:15 p.m., sunlight reflected from a single surface contributed 0.19 units of diffuse irradiance toward a north-facing receiver at the 256-ray setting. The baked field supplied 0.107 there from sky, ground and reflected lamplight. The gym, living room and onsen also received afternoon light this way. In the bedroom one apparent highlight disappeared when the shadow ray reached farther into the cliff. Those four sea-facing rooms are the places to compose a lighting study. [All rooms, times and sampling checks](RESULTS.md)

This package replays the November 20 solar study on site release `ba2272f7e4397d4dee1cfd504641ee40b88aeccc`. The committed field has source signature `71a97134a170db1223ca047ce8e67276a6cc9f935ae6d682c8c6778ab821a046` and snapshot SHA-256 `13253d65486252e0a56d70ee0f0500600bfb19e710f8660ded00601da3c2f91a`.

Use Node 22, Git and tar. The collector uses the checkout’s Playwright Chromium against an existing root-site preview. Run from this package directory with an existing checkout containing the full release commit and an external scratch directory for output.

```text
node collect-r2.cjs CHECKOUT ba2272f7e4397d4dee1cfd504641ee40b88aeccc OUTPUT http://127.0.0.1:8080/
node measure-r2.mjs CHECKOUT ba2272f7e4397d4dee1cfd504641ee40b88aeccc OUTPUT 2026-11-20
```

The collector stages immutable modules and cache metadata from Git. It reads a checkout model only when its bytes match the release inventory and falls back to the immutable blob otherwise. The private authoring tab uses the released collector with a single hook just before BVH creation. When the arrays are written, it closes the browser. Add `--dry` to validate source staging, the full signature and the hook without launching Chromium.

The measurement runs entirely in Node. It accepts a compatible preceding `COLLECTOR.json` with the exact release, manifest, cache and Float32 array hashes. The collection and CPU replay write their artifacts under `OUTPUT`.

- `COLLECTOR.json` records source and geometry custody.
- `positions.f32le` holds three XYZ vertices per triangle in the collected order. `albedo.f32le` holds one RGB diffuse albedo per triangle.
- `R2-RESULT.json` records the room summaries, representative times, absolute energy, both shadow distances and quadrature sensitivity.
- [Room tables](RESULTS.md) and the [full compressed readings](daylight-readings.json.gz) record the November 20 run. Two independent CPU replays agreed on every numeric lighting result. The geometry arrays stay in the external working directory.

The release admitted 738,069 of 852,118 triangles and 123 of 128 probes. All 7,872 primary ray distances for valid probes matched the signed cache exactly. The deterministic day uses 58 Pacific times from 06:15 to 17:15, including five-minute samples near sunset, and evaluates 14 normals at each probe. Bundled visitor weather and a clear control use the same geometry, sun position, and routine-based practical schedules.

The numerator is one Lambertian solar reflection, evaluated from the current geometric hit, albedo, visibility and directional light at each time. The denominator is the signed first-order irradiance field’s sky and ground plus indirect practical contribution. Absolute units are Rec.709 luminance of the linear diffuse irradiance before material response and exposure. Ratios include only rows whose denominator is at least the greater of 0.001 and 1% of the same time’s open horizontal sky. Absolute maxima include all valid rows.

Both 16 m and 64 m secondary shadow rays use the exact same collected geometry. The 64 m control still inherits the collector’s original spatial bounds. The study covers the opaque static field, its existing cages, and current first-order reconstruction. Moving and transparent occluders, geometry outside the collection bounds, deeper solar bounces, and other shader light are outside the comparison. The listening room has no named transport cage. The result calls for a targeted measurement of a few rooms and times before fitting any representation.

The measured package replay matched the original room/time matrices exactly on the archived extraction and added the denser probe sensitivity checks. Regenerate the compact table from any result of the same format.

```text
node summarize-r2.cjs OUTPUT/R2-RESULT.json RESULTS.md
```
