# Gym task lighting and painted equipment

The public walkthrough found an almost black gym during an evening visit. Its strip lights noticed the visitor, but the main practical still followed the avatar's workout schedule. Its historical anchor also sat away from the modeled pendants. The rack's opaque powder coating used a half-metallic finish, which left much of its painted surface dependent on small specular highlights.

The selected revision updates the practical when a visitor enters or leaves, including daytime visits to this sheltered room. The gym source sits at the actual long pendant midpoint, world `[8.7, 2.9448975324630737, 7.1]`, with a 4 cm transport-emitter radius and its existing 3.5 m cutoff. Its peak increases from 3 to 6. A downward cone models the opaque housing's shield, with the same direction and penumbra in direct light and cached bounce. There are eight practical lights in total: seven points and one spot, with no added shadow map. The three existing neutral task lines retain their positions, with three times their previous output and a strict downward emission boundary. The painted rack uses dielectric metalness 0 and roughness 0.55; the bare barbell retains its metal finish. The native master and every GLB remain unchanged.

## Compared controls

The retained native 2560 × 1440 captures use the complete product, normal clocks, public theme/Rooms/fullscreen controls and the Windows D3D11 backend. They make no frame-rate claim. Each source variant has its own compiled 189-module inventory and official cache. Requested scene bodies are checked against those exact outputs.

- [The public baseline](views/before-evening-gym.png) establishes the dim equipment and floor.
- [Visit-aware power at the old anchor](views/visit-only-old-anchor.png) improves the back wall but leaves the equipment too dark. That capture's final custody assertion fails because its local expected-body lookup omits P's separate model; the original failure remains. There are no application errors or failed requests in that run.
- [The short-pendant trial](views/rejected-short-pendant.png) moves light to a real fixture but loses the useful back-wall wash. Its corrected eight-state capture passes its custody checks; its appearance is rejected.
- [The paint and line-light trial](views/paint-and-task-lines.png) reveals the rack and rubber tiles. The short-pendant placement remains insufficient.
- [The long-pendant trial](views/after-evening-gym.png), [its public turn](views/after-evening-turn.png) and [noon view](views/after-noon-gym.png) improve equipment visibility. Its eight native 2K states pass console and body checks. The subsequent four-width review exposes a broad white band above the phone camera, so this trial is superseded rather than accepted as the finished ambience.

## The phone glare and its cause

The long native diffuser's front lies 3.8975 mm above the historical analytic line source. The general 50 mm floor-receiver tolerance also admitted that diffuser, allowing its own line to illuminate it at nearly zero distance. The retained finite witness measures red-channel irradiance 1,770.346 at the actual native front. A downward cone alone leaves that separate line-source error in place; the first directed phone control is retained with the same glare.

The corrected line boundary cancels the floor tolerance specifically for the emitter's downward half-space. Self-irradiance at that same front is exactly zero, while the floor remains lit. Bloom, exposure and lamp powers stay fixed across this causal correction. Compare [the phone glare](views/phone-before-self-light.png) with [the corrected source plane](views/phone-after-strict-plane.png), [an upward view](views/phone-after-strict-plane-angle.png) and [modern PC WebKit](views/webkit-after-strict-plane.png). Six Chromium and six modern PC WebKit states cover noon/evening and deliberate viewing-angle changes, with exact compiled/source/body bindings, successful cache restoration and zero application or request errors. The second theme's default view is reset through public room visits; the earlier carried-over camera control remains retained.

The native fixture proofs use the actual closed diffuser, finite rays in all six axis directions and source hashes. The first diagnostic's `boundsWorld` incorrectly omitted the sign reversal of Blender Y; it is retained and superseded by the corrected short- and long-fixture records. The accepted anchor is measured from the long fixture itself. A successful program compilation or a bounding-box overlap alone is not used as placement evidence.

## Verification and limits

The fresh canonical cache keeps 731,733 triangles before ROI, 16 regions, 128 probes and 28 practical sources, in 712,169 bytes. The native/GLB hashes remain unchanged. Focused behavior tests check entry, departure, daytime use, unrelated lamp powers, preservation of the bare-metal material, fixture self-light rejection and cache invalidation when emission direction changes. The registered public scene case covers embedded and fullscreen visits outside the workout schedule. Production, four-width and WebKit results are recorded in the release gates before publication.

This is a gym-lighting checkpoint. The whole-house ambience, exterior appearance and physical-phone performance remain separate checks. The numeric lamp outputs are renderer parameters; they are not calibrated room illuminance measurements. `MANIFEST.json` binds compressed raw receipts and producers, plus the selected original PNGs. Additional local PNGs have their hashes and retained paths recorded. CI and live delivery of this checkpoint require their own subsequent receipt.
