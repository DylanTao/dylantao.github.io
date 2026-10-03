# Warm-house transport checkpoint — October 2, 2026

The bath now uses an opaque teal textile instead of a skin-colored shirt. Its cloth shader uses the mesh's rest coordinates; skin diffusion stays disabled on garments. Privacy does not depend on steam, motion or viewing angle. The public controls, five adult male variants, shared album state and homepage copy remain as approved.

Four new modeled fixtures warm the bath ledge, gym alcove and two front terrace corners. Together with the four existing lamps, they use eight inverse-square point lights, with no new shadow maps. Three lanterns and the brass gym rail are batched into two meshes. Native support rays place the bath base within 0.49 mm of its ledge and both terrace bases within 0.20–0.95 mm of the oak floor, with no measured penetration. The gym rail sits on the actual batten plane. These are authored fixtures, not a general light-placement solver.

## Paper-informed custom code

- [Stam, 1999](https://www.dgp.toronto.edu/people/stam/reality/Research/pdf/ns.pdf) and [Fedkiw, Stam and Jensen, 2001](https://graphics.stanford.edu/papers/smoke/smoke.pdf): a local 18³ density/temperature field, fixed 30 Hz RK2 semi-Lagrangian advection, positive diffusion, cooling, a warm surface source, prescribed curl wind and temperature-dependent rise. This is scalar transport, without a pressure projection, phase-change model or mass-conserving gas solver.
- [Wronski, SIGGRAPH 2014](https://bartwronski.com/publications/): a custom 40-step, emission-free, Beer–Lambert single-scattering shader with a normalized Henyey–Greenstein phase. It uses a 90×72 RGBA8 tiled atlas and needs no floating-point linear filtering. Two raster depth passes clip against opaque objects and split the volume around the nearest physical transmission interface. The back interval participates in Three's refraction capture; the front interval is composed afterward. This is a local volume adaptation, not the paper's whole frustum-grid system.
- [Ramamoorthi and Hanrahan, 2001](https://graphics.stanford.edu/papers/envmap/envmap.pdf) and [Majercik et al., 2019](https://jcgt.org/published/0008/02/01/paper-lowres.pdf): an original CPU triangle BVH traces static sky visibility and one Lambertian bounce into seven eight-probe cages. First-order directional irradiance, octahedral distance moments, bounded probe relocation and smooth cage blending support WebGL lookup. Unit sky and lamp bases let time changes relight the cache without new rays. This is a static bounded adaptation; the nine-coefficient SH accuracy result and full dynamic DDGI do not apply.

The field replaces native diffuse hemisphere/environment irradiance once while preserving direct light and PMREM specular radiance. Geometry follows actual draw ranges and material groups. Each field gets a distinct program key so a reused material cannot retain a disposed field's uniforms. The temporary accelerator is released after baking; aborts cannot publish late ready data.

Detailed equations, ownership and limitations: [thermal steam](../assets/js/home-scene/THERMAL-STEAM.md), [static light field](static-light-field.md). Existing normalized skin diffusion, hand-driven shallow water, coherent wind and Pacific spectrum remain in [the earlier transport checkpoint](coastal-transport-checkpoint.md).

## Actual rendering and evidence

[Review images and acceptance](evidence/warm-house-2026-10-02/README.md) retain comparable before/after images, source hashes, native fixtures and verification results. All review images are actual Docker/WebGL output. Intermediate dense-steam and wrongly positioned fixture trials are excluded from accepted evidence.

The independent native GPU fixtures verify analytic steam extinction and opaque clipping, nearest-glass interval composition, diffuse agreement with rho E / pi, removal of double ambient light, zero-ray relighting and same-material field replacement after disposal. Native scene checks cover the opaque garment, water/steam motion, scalar/upload freezing during pause, offscreen suspension, bounded recovery, reduced motion and restored clothing on departure.

Local desktop frame observations are evidence about this machine and scene size, not a physical-phone or general 60 fps promise. The final native sample measured16.7 ms median RAF intervals for study and bath, with median finish GPU times6.33/7.75 ms and p95 14.19/18.37 ms. The live watcher remained active and production building overlapped this development-host run; no isolated speedup is claimed. The finish timer includes volume depth, contact, beauty, refraction and output; ocean reflection and CPU scalar work are outside that GPU interval. Occasional bath GPU samples exceed16.7 ms. Full observations are retained in the evidence README.

## Honest limits and next work

The custom tracer handles static opaque diffuse transport and one bounce. Animated people, props and wind-deformed plants do not affect its visibility. Base colors supply bounce albedo; existing vertex/texture/procedural detail is not baked again. Native direct practical lights remain unshadowed. Sparse first-order probes can lose contrast or leak at thin unsampled walls; outside their support the field uses unoccluded sky-gradient diffuse.

Steam has prescribed buoyant velocity, short-range light attenuation and one scattering event. It has no full fluid pressure solve, arbitrary solid gas collision, opaque sun-shadow query or multiple scattering. The nearest-interface split is approximate for refracted rays and layered glass. Ordinary transparent alpha particles retain engine sorting. Water and hopper glass use Three's screen-space dielectric transmission; reflections use PMREM and the existing ocean reflection. There is no all-material progressive path tracer, ray-traced refraction/caustics or hardware RTX here.

The visible result remains a stylized browser scene. Further character sculpting, physically swept fluid boundaries and complete transparent transport are separate work, not delivered film-studio realism.
