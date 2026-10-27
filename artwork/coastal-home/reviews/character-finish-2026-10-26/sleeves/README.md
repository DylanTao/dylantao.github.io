# Sleeve finish, October 26, 2026

This checkpoint fixes the retained arm–shirt crossings in the five avatars. It changes connected sleeve cloth positions and weights. The original Skin coordinates, weights and faces, rest joints, Blink shapes and every original channel in all fourteen NLA clips remain exact. The five original `sirui-*.blend` inputs are preserved; the editable result lives separately in `artwork/coastal-home/character-finish.blend`.

The successful fit first follows the actual arm surface's barycentric weights, then gives the cloth clearance in nine explicit authored poses through inverted linear skinning. It does not change the skin to conceal a hole. The largest cloth displacement is 45.94 mm for Lizard and 22.21–27.56 mm for the four human styles. This is a finite authoring fit, not runtime cloth simulation or a continuous collision guarantee.

The native audit compares actual arm-skin and shirt triangles at frames 1, 49 and 97 in idle, lounge and drink. Summed intersection-segment lengths fall from 26.041 to 0.963 m for Lizard, and from 16.452/11.939/11.883/9.763 m to zero for South Park/Simpsons/Ghibli/Rick and Morty. Lizard's remaining intersections are at the upper attachment; the saved resting and raised-arm views show no exposed tear in the inspected pose. These lengths include hidden contacts and are not overlap volumes.

The independent pinned GLTF/Draco readback retains the exact original decoded Skin attributes and matches every bone matrix at seven explicit times in every complete clip. Two fresh exports of the same master produce identical GLB bytes for all five styles. `native-preservation.json`, `decoded-preservation.json` and `library-export.json` retain those source bindings. The seat-contact interface was regenerated from the new master and five actual exports, including the measured neutral Foot orientation and full sole-center offset. The offsets and original anatomy are unchanged.

`renders.json` binds the complete source-routed 4K set to the actual five GLBs, clock, camera and renderer. The raw 3840×2160 PNGs remain under `.jekyll-cache/visual-qa/character-finish-2026-10-26/sleeves-final-4k/`; the selected JPEGs here retain their original dimensions, while the cuff comparison PNGs are unscaled crops. Chromium reported native RTX 3080 Ti / ANGLE D3D11 and zero runtime errors. These are desktop appearance checks, not physical-phone or frame-rate claims. Complete head-to-feet views, body/side views and every standard viewport are retained.

The existing four-viewport light/dark orbit-and-zoom and all-five-avatar cases pass, 12/12. The all-five-avatar WebKit phone-emulation case also passes; that host check is separate from Sirui's physical iPhone evidence. Python passes 314 tests. The full Node suite reports 822 passed, seven existing opt-in skips and one source-binding failure: the changed GLBs invalidate the old static-light cache. The coordinator owns the required bake and combined production/CI/live gates; this worker has not edited the manifest/cache or weakened that test. Final source checks are recorded in `verification.json`.

Reproduce the editable library with Blender 4.5.9:

```powershell
blender --background --python-exit-code 1 --python bin/build_coastal_character_finish.py -- --out=.jekyll-cache/character-sleeves
blender --background --python-exit-code 1 --python bin/build_coastal_character_library.py -- --source-dir=.jekyll-cache/character-sleeves --out=.jekyll-cache/character-library
blender --background --python-exit-code 1 --python bin/audit_coastal_character_finish.py -- --master=.jekyll-cache/character-library/character-finish.blend --out=.jekyll-cache/character-audit.json
```

The retained inputs produce a newer-file-format warning in the exact required Blender version. Their bytes remain unchanged, and the independent native/decoded comparisons above check the preserved result rather than treating the warning as acceptance.

Failed sleeve attempts remain in the ignored QA folder: nearest-cloth skin binding distorted the resting arm; broad cuff binding created a torso fan; the first narrow cuff and small-clearance anatomical fits still exposed resting skin; the wider cuff alone improved the raised edge but retained a poke-through. Actual posed-cloth clearance produced this result. No failed tail pose or corrective is in this checkpoint. Tail/seat contacts, comfortable complete-body bearing, planted feet and natural meal evidence remain separate item 22 work, with the current 5/5/7/5 dish rotation preserved.
