# P: model, motion, and references

Created for Sirui Tao’s website on September 14, 2026. Sirui directed the character through references and critique; OpenAI Codex implemented the original geometry, materials, and browser motion.

## Editable assets

The latest pass keeps the original silhouette while broadening the fins, lengthening the antennae, and replacing flat circular eye lights with shaded oval expressions. Page motion uses verified rounded routes, continuous travel timing, a gaze-first departure, and separate head/body/fin/antenna responses. The new listen, stretch and delight gestures are original choreography. The browser portrait and Blender source were updated together.

| File                                     | Origin and purpose                                                                                                                                                                                                         |
| ---------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pip.blend`                              | Original model authored in Blender 4.5.9 LTS through its background Python API. Rounded ceramic head, tapered shell, separate convex optical lenses, two antennae, and detached arms. Includes a studio camera and lights. |
| `../../bin/build_pip.py`                 | Reproducible authoring, GLB export, and transparent Cycles render. No downloaded model, traced mesh, or image-to-mesh service.                                                                                             |
| `../../assets/models/pip/pip.glb`        | Exported articulated nodes, 848,688 bytes. The browser poses named head, antenna, eye, and arm pivots; there is no skeletal animation clip or physics simulation.                                                          |
| `pip-model.png`                          | Actual 800 × 900 transparent Cycles render of the model, 48 samples and denoising. This is model evidence, not generated concept art.                                                                                      |
| `../../assets/models/pip/poster.webp`    | 640 × 720 transparent WebP derivative of that render, quality 88. Used for the project thumbnail and progressive fallback.                                                                                                 |
| `../../assets/js/companion/portrait.mjs` | Original analytic WebGL portrait matching the model’s design. Shaped surfaces, optical reflections, ambient occlusion, soft light and a ground shadow; no raster scene backdrop.                                           |
| `../../assets/js/companion/motion.mjs`   | Shared original pose vocabulary, gaze blending, standard minimum-jerk interpolation, and damped antenna springs.                                                                                                           |
| `../../assets/js/companion/travel.mjs`   | Original page navigation: bounded visibility graph around rendered rectangles, a smaller footprint for squeezed passages, and authored portal transitions between clear endpoints.                                         |

Rebuild from the repository root:

```powershell
& 'C:/Users/dylan/.cache/sirui-studio-tools/blender-4.5.9-windows-x64/blender.exe' --background --python-exit-code 1 --python bin/build_pip.py
```

Blender was used programmatically. Native application mouse control was unavailable in this session; no manual sculpting through the Blender UI is claimed. GLB nodes export in Y-up coordinates with +Z facing forward. The web runtime retains one pose controller across the page, room, and project playground.

The second September 14 pass replaces hollow eye rings with filled elliptical pupils and separate catchlights, softens the optical bezels, shortens the antennae, rounds the body and shapes curved flippers. Independent eye apertures and pupil proportions carry winks, squints and surprise in both renderers. The model, transparent Cycles render and web poster were regenerated together; no image generation was used for this revision.

## Inspiration and resources

- **Pollen Robotics / Hugging Face, [Reachy Mini](https://huggingface.co/docs/reachy_mini/index):** expressive articulated head, unequal circular optical eyes, and independently moving antennae. Sirui supplied two product photographs as visual references; those photographs are not shipped with the website.
- **[Reachy Mini Python SDK movement API](https://huggingface.co/docs/reachy_mini/SDK/python-sdk#movement):** separation of head, antennae, and body targets, and minimum-jerk timing. The SDK and its Apache-2.0 license were inspected. P does not distribute or execute the SDK; the interpolation polynomial is standard mathematics implemented locally.
- **[Reachy Mini Dances Library](https://github.com/pollen-robotics/reachy_mini_dances_library):** reference vocabulary for nods, tilts, glances, pauses, and recovery. P’s nine short gestures are independently authored for a reading page. No library implementation, choreography file, or recorded motion is copied or bundled; no license to those assets is assumed.
- **Pixar, [WALL·E](https://www.pixar.com/wall-e), especially EVE:** floating tapered silhouette, detached arms, and expressive stillness. Sirui supplied a film still for direction. No film image, character mesh, sound, or animation is distributed.
- **[Blender](https://www.blender.org/) and [Three.js](https://threejs.org/):** authoring/rendering tools. The room uses the existing version-matched Three.js r164 loader closure and retained MIT notice. The initial 2D page does not load Three.js or the GLB.

The public [P project page](../../_projects/pip.md) keeps these credits visible. The work is an unofficial personal interaction experiment, with no claim of endorsement by the reference creators.

## Review limits

Page motion is bounded authored animation, not robot inverse kinematics or flight physics. The room uses an articulated node model; the page uses a matching analytic model. They share identity and motion, but their lighting pipelines are different. Phone figures in the evidence report are desktop browser emulation, not physical-device measurements. Sirui’s judgment remains the design acceptance criterion.

## Automatic P refinement

The public name is **P**, for Prototype / ProtoLab. `/projects/pip/` redirects to `/projects/p/`; internal asset and module filenames remain stable. The September 14 revision makes the optics rounder, catchlights quieter, antenna tips smaller, and fin/body shapes softer. It regenerates the editable model, browser export, and actual Blender poster together.

Page entry clears the obsolete persistent nap key. The first journey starts after 4–8 seconds and later journeys use 12–24-second intervals. Temporary rests end automatically. Gaze, head, body, antennae, and travel settle at different rates. Shared ownership transfers one character among the page, room, and motion playground. There are no ambient lighting/motion controls; system reduced motion retains a still greeting pose. Project gesture controls are deliberate demonstrations and do not create another persistent preference.

The new implementation and automatic recovery tests are recorded in [the refinement evidence](../../docs/evidence/coastal-refinement-2026-09-14/README.md).
