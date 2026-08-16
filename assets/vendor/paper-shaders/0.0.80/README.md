# Paper Shaders 0.0.80 vendor record

This directory contains the minimal ESM closure used by this site for the Dot Orbit Research Focus substrate and for reproducing one static Paper Texture asset. It is copied without source modifications from [`@paper-design/shaders@0.0.80`](https://www.npmjs.com/package/@paper-design/shaders/v/0.0.80).

- Project: [Paper Shaders](https://shaders.paper.design/)
- Company: [Paper](https://paper.design/)
- Upstream source: [paper-design/shaders](https://github.com/paper-design/shaders)
- License: Apache-2.0; see `LICENSE` and `NOTICE` in this directory.
- Runtime entry points: `dist/shader-mount.js`, `dist/shaders/dot-orbit.js`, `dist/get-shader-noise-texture.js`, and `dist/get-shader-color-from-string.js`.
- Reproduction-only shader: `dist/shaders/paper-texture.js`.
- No React wrapper, runtime CDN, or site-local bundle step is used.

`manifest.json` records the upstream package archive integrity and SHA-256 hash for every vendored file. Refresh the manifest if and only if the pinned upstream version changes.
