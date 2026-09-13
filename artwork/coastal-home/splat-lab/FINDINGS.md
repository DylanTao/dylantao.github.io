# Pacific image-depth study

This is a separate local experiment. No illustration, photograph, splat, or new Three.js dependency from this lab is used behind the homepage home. The homepage coast and ocean are geometry.

## Method

The same generated 1200 × 600 alpha WebP is represented as three authored depth planes, a textured mesh with 25,600 triangles, and 56,674 image-derived Gaussians. All use the same simple foreground/coast/distance classification. The splats use Spark `imageSplats`, `subXY: 3`, `dotRadius: 0.75`, and an authored depth offset; alpha below 0.08 is discarded. This is not multiview reconstruction or training. [Spark procedural image splats](https://sparkjs.dev/docs/procedural-splats/)

The independent import map pins Three.js 0.180.0 and Spark 2.2.0. The production homepage remains on Three.js r164; the lab's newer dependency graph stays separate. [Spark package compatibility](https://github.com/sparkjsdev/spark/blob/main/package.json)

## Observations

| Approach             | What the captures show                                                                                                    | Local median FPS, frontal / oblique |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------- | ----------------------------------- |
| Authored layers      | Clear original image detail; visible gaps and detached pieces when looking along the planes                               | 60 / 60                             |
| Textured geometry    | Connects the layers, but the interpolated transitions stretch pixels into thin sheets at depth breaks                     | 60 / 60                             |
| Image-derived splats | Softer boundaries and dot coverage; depth seams remain, and the scene still collapses into a shallow cutout from the side | 60 / 60                             |

Measured serially in Chromium 145.0.7632.6 on the local RTX 3080 Ti through ANGLE/D3D11, at a 1280 × 1000 viewport and DPR 1. Each viewpoint had three seconds of warmup followed by five one-second readings. These results are capped by the display cadence and do not establish equal GPU cost or physical-phone performance. The raw report records draw/triangle counts and camera coordinates.

The most useful finding is about missing information: neither splats nor displaced textured geometry invents the occluded sides of the cliff. The hand-authored foreground boundaries also introduce seams even near the original viewpoint. A small, deliberately limited parallax illustration could use layers; a freely explorable ocean-facing home needs the modeled exterior used on the homepage.

## Review and reproduce

- [Evidence and raw measurements](../../../docs/evidence/research-studio/README.md)
- [Original artwork and provenance](../PROVENANCE.md)
- Serve the repository root with `python -m http.server 4106 --bind 127.0.0.1`.
- Open [the local lab](http://127.0.0.1:4106/artwork/coastal-home/splat-lab/).
- Run `node bin/measure_coastal_splats.cjs` from the repository root for comparable frontal/oblique captures. The Windows measurement requests D3D11 explicitly; the recorded GPU identifies the actual renderer.

The experiment remains local and excluded from the Jekyll build.
