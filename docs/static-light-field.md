# Static traced diffuse light field

This is original, bounded CPU code for the existing Three r164 coastal house. It caches static opaque visibility and one diffuse bounce, then relights the cached transport from the actual procedural sky gradient and fixed modeled practical lamps. It does not implement full DDGI, progressive path tracing, dynamic ray-traced shadows or transparent light transport.

## Research and adopted equations

[Ramamoorthi and Hanrahan, 2001](https://graphics.stanford.edu/papers/envmap/envmap.pdf) derive diffuse irradiance as the spherical convolution of incident radiance with a clamped cosine. This adaptation keeps only bands 0 and 1. The paper's nine-coefficient accuracy result does not apply to this four-coefficient approximation.

For incident radiance `L(w)`, the implementation integrates deterministic octahedral directions with normalized solid-angle weights `q`:

```text
E(n) = C0 + Bx nx + By ny + Bz nz
C0   = 1/4 sum(q L)
B    = 1/2 sum(q L w)
sum(q) = 4 pi
```

The diffuse SH convolution factors are `pi` for the constant band and `2 pi / 3` for the first directional band. A constant environment returns exactly `pi L`, up to floating-point storage error. Each RGB directional vector is shortened to at most its DC coefficient. This preserves the spherical mean and ensures nonnegative irradiance for every unit normal; it suppresses directional contrast rather than inventing energy.

[Majercik et al., 2019](https://jcgt.org/published/0008/02/01/paper-lowres.pdf) use octahedral probe maps, distance moments, bias and visibility-weighted interpolation. This static adaptation stores first and second hit-distance moments and applies a cubed Chebyshev weight, normal-facing weight and trilinear cage interpolation. It omits dynamic ray updates, recursive multibounce feedback and DDGI's full directional irradiance textures. Sparse moment visibility is an approximation and can miss thin walls.

[PBRT, fourth edition, BVH chapter](https://www.pbr-book.org/4ed/Primitives_and_Intersection_Acceleration/Bounding_Volume_Hierarchies) explains bounding-volume hierarchy acceleration. The implementation here uses an original balanced median partition, flattened typed-array nodes, slab box tests and double-sided triangle intersection. It retains actual triangles; there is no striding or triangle decimation.

At a primary geometric hit, unit sky transport is estimated with eight deterministic cosine-weighted secondary rays. A clear boundary sample contributes `rho L / K` to outgoing radiance; a blocked sample contributes zero. Unit practical transport is `rho / pi * max(n dot lightDirection,0) * sourceColor * inverseSquareAttenuation * visibility`, with the same finite-distance falloff as the native point lights. The final `emitterRadius` segment, default 0.18 m, is exempted from shadow testing: it represents a diffuse bulb inside its own lampshade. A farther wall still blocks it. Base diffuse reflectance is clamped to 0..0.95; texture, vertex color and procedural detail are not included in the bounce albedo.

Direct practical lights remain native and unshadowed. Only their cached indirect bounce includes traced visibility. Direct sun, its shadow map, PMREM radiance/specular reflections, emissive fixtures and the existing water refraction remain native.

## Integration and ownership

```js
const field = createStaticLightField({
  practicalSources: warmPracticals.sources,
  // Optional: regions, raysPerProbe:64, skyRaysPerHit:8,
  // maxTraceDistance:16, maxTriangles:750000, acceptMesh(mesh,rootId).
});
field.addRoot(shell, { id: "shell" });
field.addRoot(coast, { id: "coast" });
for (const room of loadedStaticRooms) field.addRoot(room, { id: room.name });
const detach = field.bindMaterial(pbrMaterial);
field.setLighting({
  ...pacific.lightColors(), // actual linear zenith and horizon RGB
  ground: hemi.groundColor.clone().multiplyScalar(hemi.intensity).toArray(),
  practicalPowers: warmPracticals.lights.map((light) => light.intensity),
});
await field.bake({ signal, yieldTask });
// Recombine only when these light inputs change. This traces zero rays.
field.setLighting(nextActualLighting);
field.sample(worldPointArray, worldNormalArray); // CPU parity/evidence
field.evidence();
detach(); // optional material-local ownership release
field.dispose();
```

Collect roots only after their transforms and realistic physical materials are finalized and the chosen static rooms have finished loading. `acceptMesh` must exclude any runtime animated rigid props still embedded in a static room root. Skinned/instanced/dynamic objects, alternate styles, outlines, transparent/alpha-tested/transmissive materials, `noContactOcclusion` and `noOpaqueShadow` are excluded automatically. The physical roof is included even when the camera hides it for presentation. Shader-deformed foliage/coast geometry contributes its exported rest shape only.

The seven region cages contain eight cell-center probes each and include their actual floor heights. A bounded relocation attempts to escape short back-facing solid intersections; invalid probes are rejected. Rejecting every probe in a region produces zero indirect light there rather than an invented unoccluded sky. Overlapping cages blend continuously by normalized spatial weights. A 0.25 m smooth outer support band blends toward actual unoccluded sky-gradient/ground-boundary diffuse irradiance beyond the cages; it does not establish traced visibility outside the field.

`bindMaterial` chains the existing PBR shader hook and preserves its cache key. Before the bake is ready, the native indirect terms remain active. Afterward it sets ordinary hemisphere/ambient `irradiance` to zero and replaces `iblIrradiance` with the field. Three r164's physical indirect function consumes that term once for energy-compensated diffuse and specular multiscattering; PMREM specular `radiance` is preserved. Transmission remains the engine's separate approximation. Binding is idempotent. A material `dispose` event releases the binding, and field disposal restores owned hooks and releases all three textures. No model, source material or renderer is disposed by this module.

Cancellation fails closed. A disposed or aborted bake cannot publish stale ready data. Geometry is not traced again on clock changes, actor movement, camera changes, pause or viewport recovery. Actor occlusion, wind-deformed visibility, multiple diffuse bounces, direct-sun bounce, solar disk/cloud/star transport, volumetric scattering, refraction and caustics are omitted.

## Cost and verification

The shader uses three nearest-filtered float RGBA textures: coefficients `4 x 56`, positions `56 x 1`, and distance moments `8 x 448`. Texture backing arrays total 61,824 bytes. Each cage query requires up to 48 texture reads per shaded fragment. The default layout overlaps at most two cages, so boundary regions may require 96 reads; custom overlapping regions increase that cost. Browser/GPU frame-time acceptance is required separately. The 59,136-byte unit transport basis remains for lighting changes; the triangle BVH is released after the bake. Total retained typed arrays are 120,960 bytes, excluding small JS records and renderer texture copies.

A Windows Node CPU proof decoded all eight native Draco assets and their world node transforms. It retained 437,789 opaque triangles in 105 meshes, accepted 55 of 56 probes, relocated four, and traced 37,975 rays. All eight unit practical bounce bases were nonzero. The final floor-inclusive cages produced a 3.67 s wall-clock bake over 268 yields; the longest measured task was 18.74 ms. The earlier less-sliced run took 2.55 s with a 39.64 ms maximum. Neither result establishes a 500 ms bake or a universal 10 ms task bound. Timer scheduling, GC and concurrent work affect those numbers. Relighting took 0.27 ms with zero added rays in the final run. The approximately 36.77 MB accelerator and triangle storage is released before returning the completed bake.

The ignored reproducible script and input hashes are under `.jekyll-cache/visual-qa/static-light-field/native-bake.mjs` and `native-bake.json` in the lighting worktree. That CPU proof excludes root-created new fixture occluders, infers runtime glass exclusions by source material name and uses representative analytic linear sky colors; it is not a native screenshot or GPU benchmark.

Run `node --test test/static-light-field.test.mjs` for constant-radiance conservation, nonnegative directional energy, native triangle-ray agreement, closed-room sky rejection, embedded-probe rejection, practical power linearity and wall blocking, transmission exclusion, zero-ray relighting, shader/disposal ownership and interrupted-bake behavior. Actual day/night screenshots and native shader/frame evidence belong to the coordinator's integration checkpoint.
Per-field program identities prevent stale cached uniforms when a disposed field is replaced on the same material. The static collector also follows native `drawRange` and single-material versus material-group submission, rather than tracing invisible triangles. `test/visual/static-light-field.spec.js` supplies an independent linear WebGL fixture for diffuse algebra, hemisphere removal, zero-ray relighting and replacement-field ownership; it is included in the isolated scene test command. Native production-scene evidence and performance are in [the warm-house checkpoint](warm-house-checkpoint.md).
