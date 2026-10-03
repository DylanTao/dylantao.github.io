# Local diffuse transport for the original avatars

`skin-diffusion-profile.mjs` and `skin-diffusion.mjs` are an original, bounded skin-lighting implementation for the coastal home's existing authored meshes. They preintegrate irradiance over a locally curved surface, then replace only the direct diffuse response of an explicitly bound physical material. Specular, clearcoat, sheen, emission, ordinary clothing, hair and glasses keep their existing shaders. No scenic image, borrowed face asset, generated replacement, public control or animation timer is added.

This is a local approximation informed by published rendering work, not a complete spatial BSSRDF, a reproduction of a film renderer, or a claim of current SOTA quality. The normalized profile is useful here because it defines a scale in meters and redistributes light without an arbitrary additive glow. Native rendered acceptance and GPU measurements belong to the coordinator; CPU evidence alone does not establish the final appearance.

## Sources and choice

[Christensen and Burley, Approximate Reflectance Profiles for Efficient Subsurface Scattering, Pixar Technical Memo 15-04, July 2015](https://research.pixar.com/docs/2015.TechnicalReport.CB.pdf) supplies the normalized two-exponential radial profile, Equation 2, and its radial CDF, Equation 11. The complete seven-page paper was read at this current official URL; the older graphics.pixar.com link redirects to an unrelated technology page. Their profile can be parameterized artistically or fitted to physical material properties. This implementation uses authored RGB distance parameters, not a measured optical fit to Sirui's skin.

[Jimenez et al., Separable Subsurface Scattering, 2015, author project](https://www.iryoku.com/separable-sss/) and its [supplement](https://www.iryoku.com/separable-sss/downloads/Separable-Subsurface-Scattering-Suplementary-Material.pdf) describe separable spatial filtering with normalized kernels. That method informed the requirement to isolate diffuse transport and preserve kernel mass. Its screen-space passes, fitted profile, implementation, temporal sampling and performance figures are not used or claimed here. A spatial diffuse-only buffer would resolve shadow and albedo diffusion more faithfully, but would require additional geometry/lighting buffers and reconstruction for these small animated subjects.

[Chen, Lambert and Penner, Pre-Integrated Deferred Subsurface Scattering, SIGGRAPH 2014 poster](https://history.siggraph.org/wp-content/uploads/2022/12/2014-Poster-77-Chen_PDSS_-Pre-Integrated-Deferred-Subsurface-Scattering.pdf) motivates preintegrating a local surface response and measuring curvature in geometric coordinates instead of a raw pixel-distance ratio. Our fundamental-form calculation below is original code; it does not implement that poster's deferred buffers or cross-bilateral curvature filter. No third-party shader, lookup-table data or example asset was copied.

## Normalized profile and curved-patch integral

For radial distance r and authored profile scale d, both in meters:

```text
R(r;d) = [exp(-r/d) + exp(-r/(3d))] / (8 pi d r)
p(t) = [exp(-t) + exp(-t/3)] / 4,    t = r/d
CDF(t) = 1 - exp(-t)/4 - 3 exp(-t/3)/4
integral p(t) dt = 1,    E[r] = 2.5d
```

The existing material's linear diffuse albedo is applied exactly once by Three's Lambert BRDF. The profile is unit mass, so albedo is not duplicated inside the LUT.

We approximate the illuminated neighborhood by a convex sphere with curvature k = 1/radius. A surface ring at geodesic distance r rotates its normal by theta = kr. Its area relative to a planar ring is sinc(theta). For mu = N dot L:

```text
q = kd
theta(t) = qt
a = mu cos(theta),    b = sqrt(1-mu^2) sin(theta)
A(mu,theta) = average_phi max(a + b cos(phi), 0)

A = a                            if a >= b
A = 0                            if a <= -b
A = [a phi0 + b sin(phi0)] / pi    otherwise,
    phi0 = acos(-a/b)

w(t) = p(t) sinc(qt),    0 <= t <= min(30, pi/q)
Z = integral w(t) dt
D(mu,k,d) = integral w(t) A(mu,qt) dt / Z
```

This is our curved-patch adaptation. It uses geodesic distance and a local sphere; the paper's flat radial profile does not itself establish that approximation for an arbitrary curved body. The antipodal cutoff prevents folding the sphere past pi. The retained positive weights are normalized after cutoff and numerical quadrature. A 96-node Gauss-Legendre integration uses an analytic azimuth integral; no stochastic samples or temporal history are involved. The finite radial tail omits less than 0.000035 of planar mass, before normalization.

At k = 0 the implementation returns max(mu,0) exactly. For k > 0, the convex combination remains between zero and one. For each fixed k and d, averaging over a uniform incident-direction field preserves its constant irradiance. Equivalently, the integral of D over mu in [-1,1] remains 1/2, as it does for a clamped cosine. This is a useful local energy check, not a proof of global energy conservation on a heterogeneous mesh with varying curvature, visibility and albedo.

The shader mixes 70% diffused and 30% ordinary diffuse response. The default dRGB is [3.2, 1.2, 0.65] mm; these authored scales are distinct from the profile's mean distance 2.5d. Red spreads farther around a terminator, while some frontal diffuse energy is redistributed. The sphere's radius is bounded below by 6.25 mm (maximum curvature 160 m^-1). These defaults require native visual review rather than a claim of calibrated skin optics.

## Metric curvature and silhouette safety

The shader computes view-space derivatives of the current skinned position P and the unperturbed, interpolated geometric normal N. The view transform is rigid, so position lengths remain meters. With x/y representing screen parameters:

```text
g00 = Px dot Px;    g01 = Px dot Py;    g11 = Py dot Py
b00 = Nx dot Px;    b11 = Ny dot Py
b01 = (Nx dot Py + Ny dot Px)/2
H = [g11 b00 + g00 b11 - 2 g01 b01] / [2(g00 g11 - g01^2)]
```

This is half the trace of the normal derivative in the tangent metric. An outward-normal sphere has H = 1/radius and a cylinder has H = 1/(2 radius), independent of a skew pixel basis or rigid camera orientation. Concave curvature uses the flat Lambert limit. A nearly singular metric (determinant <= max(1e-24, g00 g11 1e-5)) also uses that limit; the valid result is clamped to [0,160] m^-1. There is no unconstrained division by a small silhouette derivative and no sampling of adjacent image pixels or unrelated meshes.

Derivatives are evaluated once after Three's normal calculation, outside the direct-light loop. They follow the actual posed/skinned geometry; bump-map detail is deliberately excluded from the transport scale. No independent animation time or accumulated history can drift during pause, hidden-page suspension or graphics recovery.

## Exact lighting hook and limits

The private r164 `lights_physical_pars_fragment` expansion changes only this term in `RE_Direct_Physical`:

```text
old: dotNL * directLight.color * BRDF_Lambert(material.diffuseColor)
new: mix(vec3(dotNL), D_RGB(N dot L,H), strength)
     * directLight.color * BRDF_Lambert(material.diffuseColor)
```

The shader retains the signed N dot L as the lookup coordinate; the existing clamped cosine remains the fallback and the specular irradiance. Three's direct-light color already contains attenuation and pointwise shadow visibility. A zero direct-light color therefore adds zero light, including at night. Point, spot and directional lights receive this response. Rectangular area-light LTC shading, environment/hemisphere diffuse, contact-lighting indirect bounce, reflected specular, emission, clearcoat and sheen are untouched. The contact hook composes in either order.

The method omits transport across spatial shadow edges, changing surface albedo, occluding hair or mesh boundaries. It does not compute ear/backside transmission, thickness, Fresnel boundary transport, heterogeneous volume scattering or directional refraction. It approximates changing point-light direction and attenuation across the neighborhood by their value at the current fragment. An anisotropic shape is represented only by scalar mean curvature; the local sphere is less accurate on ridges or narrow cylinders. The fixed LUT samples and derivative curvature can still show discrete-mesh/driver artifacts. These are material limits; they must not be presented as a full spatial scattering simulation.

## Integration, ownership and capability plan

The coordinator owns `realism.mjs`, `materials.mjs` and `controller.mjs`. The worker changes no shared scene file. The integration points are:

```js
// In the opaque room finish, once per renderer/finish:
const skinDiffusion = createSkinDiffusion();
// Expose it to physical-material finishing alongside contactLighting.

// For an existing cloned physical skin material on an original avatar:
skinDiffusion.bind(m); // exact material name "skin" only
bindContactLighting(m, contactLighting); // either wrapper order is supported

// The existing shirt primitive can become bare torso during the soak routine:
const torsoSkin = skinDiffusion.bind(m, { surface: true, enabled: false });
// In wardrobe(), after the existing color/roughness changes:
torsoSkin.setEnabled(routine.id === "soak");

// Optional private comparison, not public UI:
skinDiffusion.setEnabled(false);
skinDiffusion.setStrength(0.7);
// Include skinDiffusion.evidence in the existing private evidence object.

// If removing a material without disposing it:
torsoSkin.release();
// Material.dispose() automatically releases its borrower too.
// On finish disposal, before disposing the renderer:
skinDiffusion.dispose();
```

The bind API returns a handle, not a replacement material. Material color, roughness, skin deformation, public selection and wardrobe stay owned by the existing scene. Explicit `surface:true` enables only a reviewed material such as the torso; arbitrary cloth is not auto-bound. Each bound material gets its own boolean uniform; changing the torso does not disable the face. Rebinding within the same finish reuses the hook and handle. Sharing one material between two finishes is rejected; clone it first, as existing physical finishing already does.

`release()` removes a borrower from live evidence and disables its local uniform. It leaves the disabled wrapper in place, because restoring a previous callback would destroy a later contact wrapper. The global registry is a WeakMap; entries contain no material or avatar reference. `totalBindings` is cumulative, while `boundMaterials`, `compiledMaterials`, `incompatibleMaterials` and `activeMaterials` count current unreleased borrowers. The coordinator should additionally count current scene draws if it needs a visible-avatar count. Finish disposal disables all remaining borrowers and disposes the shared texture exactly once. A new renderer/finish receives a new independent texture.

The half-float LUT uses linear filtering available in the existing WebGL2 room pipeline and needs no renderable-half-float extension. A legacy WebGL1 adapter would require half-float texture/filter extensions, or explicitly choose `{ storage: "unorm8" }` for the supported 8-bit linear texture fallback. This module does not detect a renderer or silently assume GPU timing support. If the expected Three shader anchors or direct-diffuse term change, binding reports `compatible:false` and leaves the prior shader intact. That condition must fail the coordinator's native acceptance gate rather than be mistaken for successful SSS.

The existing reflection draws may retain this skin response: unlike contact occlusion, the LUT is independent of the main camera image. No auxiliary-camera texture or history is borrowed. The transparent footer's separate finish need not create this module. Failed context/retry follows the existing material/finish recreation contract.

## CPU evidence and cost

On this Windows host, seven native Node construction runs took 44.5–62.5 ms, median 56.4 ms, including original deterministic integration and Float16 conversion. About 3.55 million ring evaluations run once per finish, outside the animation loop; browser startup must be measured independently. Default texture memory is 257 x 49 x 4 x 2 = 100,744 bytes. Generation temporarily uses a 201,488-byte Float32 table plus the final storage and small quadrature arrays; the table is not retained by the factory. The 8-bit fallback uses 50,372 bytes. No new render target, image/model request, full-screen pass or draw call is added.

Each active skin fragment computes four vector derivatives and the metric once, then samples one bilinear LUT per punctual/direct sun light evaluated by Three. Disabled/flat materials skip the lookup. These are algorithmic costs, not measured GPU milliseconds or a universal frame-rate claim.

`node --test test/skin-diffusion.test.mjs` verifies independent radial/azimuth quadrature, bounded response, flat and concave limits, angular energy, off-grid sampling, metric shape/scale invariance, silhouette degeneracy, exact untouched specular/area-light chunks, authored/contact hook composition, scope, torso enable behavior, separate finish ownership, fail-closed compatibility, release and idempotent disposal. All thirteen cases pass on the worker checkpoint.

Quantitative default-table checks:

| Quantity                                                                     | Observed maximum absolute error |
| ---------------------------------------------------------------------------- | ------------------------------- |
| Integral over mu compared with 1/2, all 49 rows and RGB channels             | 0.00000504                      |
| Off-grid bilinear lookup versus 256-node radial reference, 144 named samples | 0.000837                        |
| Half-float texel storage versus generated Float32                            | 0.000489                        |
| 8-bit texel storage versus generated Float32                                 | below 0.00197                   |

For a 12 m^-1 convex patch at the terminator (mu = 0), unmixed D_RGB is approximately [0.02991, 0.01142, 0.00620]; at mu = 1 it is [0.98989, 0.99853, 0.99957]. This confirms visible spectral redistribution in the mathematical response, not visibility in the actual product camera. The coordinator must compare native study/gym sun and practical-light onsen views, specular/hair/glass edges, ordinary shirt versus soak torso, zero-direct night, disabled equivalence, reduced motion, hidden/recovery and measured GPU timing before accepting the integrated appearance.
