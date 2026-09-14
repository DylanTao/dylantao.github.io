# Three.js r164 addons

These MIT-licensed addons match the site's existing r164 engine. The only source
change is replacing the bare `three` import with the relative path to that engine.

| File | Original source | Original SHA-256 |
| --- | --- | --- |
| `loaders/GLTFLoader.js` | https://raw.githubusercontent.com/mrdoob/three.js/r164/examples/jsm/loaders/GLTFLoader.js | `4e7c3ad7d8fb4c388169e0692b0782e427fba5f54ff424436f6fe0ccefdbbeef` |
| `utils/BufferGeometryUtils.js` | https://raw.githubusercontent.com/mrdoob/three.js/r164/examples/jsm/utils/BufferGeometryUtils.js | `b0c64fe6f3b9907262921b73fafc4ade874c07ba6b4876e164c87a830c2c2113` |

License source: https://raw.githubusercontent.com/mrdoob/three.js/r164/LICENSE.
No engine upgrade or second engine instance is introduced on the homepage.

## Realistic rendering and compressed models

The added postprocessing, math, shader, and Draco loader files are from the same Three.js r164 tag. Bare engine imports are changed; trailing indentation on one empty line each in OutputShader and SSAOShader is removed for the repository whitespace check. The glTF Draco decoder is distributed with that release under the Apache-2.0 license retained in `libs/draco/LICENSE`. These are local assets; no runtime CDN is required.

`libs/draco/draco-worker.js` is the r164 loader worker extracted by `bin/prepare_draco_worker.py`, with a static import of the matching decoder wrapper. The site adapter uses it without an inline blob worker.

| File | Source | Local SHA-256 |
| --- | --- | --- |
| `libs/draco/draco-worker.js` | Generated from the pinned DRACOLoader | `024d7e85ca5477cde33bb72891e70277f6a227bcb3029da6a859ddcc5f6918c5` |
| `libs/draco/draco_decoder.wasm` | https://raw.githubusercontent.com/mrdoob/three.js/r164/examples/jsm/libs/draco/gltf/draco_decoder.wasm | `a680d927bed9cb864ddbd63521868891af2bfbe755092761b4837487618df8ac` |
| `libs/draco/draco_wasm_wrapper.js` | https://raw.githubusercontent.com/mrdoob/three.js/r164/examples/jsm/libs/draco/gltf/draco_wasm_wrapper.js | `8bb2952d2ba7d67e1414f8df819410cb0434a666be53f671fff75f68843d76f6` |
| `loaders/DRACOLoader.js` | https://raw.githubusercontent.com/mrdoob/three.js/r164/examples/jsm/loaders/DRACOLoader.js | `7c54926e14cf506a53b36a051864a673dfd70bc25d01ce1d817419e0fb0c14e2` |
| `math/SimplexNoise.js` | https://raw.githubusercontent.com/mrdoob/three.js/r164/examples/jsm/math/SimplexNoise.js | `9b8d541b77b0ddc79afaa6a1de8941452c191b8b9006f04e7b8fc422e2b263f7` |
| `postprocessing/EffectComposer.js` | https://raw.githubusercontent.com/mrdoob/three.js/r164/examples/jsm/postprocessing/EffectComposer.js | `50cebcd63a553e28cd615678c06f5d4e93e3341ffa664c7e7e4853141b4940b4` |
| `postprocessing/MaskPass.js` | https://raw.githubusercontent.com/mrdoob/three.js/r164/examples/jsm/postprocessing/MaskPass.js | `328cf7db0da5d9be83ffe39d54b01d5ac1fddf108cc98182ddbb056f5c8b537f` |
| `postprocessing/OutputPass.js` | https://raw.githubusercontent.com/mrdoob/three.js/r164/examples/jsm/postprocessing/OutputPass.js | `f1c975fa535fbb83971a24e8b3b806b603dd5e6e9affea2d344942c8c5dccdb7` |
| `postprocessing/Pass.js` | https://raw.githubusercontent.com/mrdoob/three.js/r164/examples/jsm/postprocessing/Pass.js | `b5e80974d22b920facf778c560cecdffb94e51181c683a7c61b50ad454d25566` |
| `postprocessing/RenderPass.js` | https://raw.githubusercontent.com/mrdoob/three.js/r164/examples/jsm/postprocessing/RenderPass.js | `ef3f895f0b960d0f0dd32b8c22717377aaf4c9760f2b33367e98080094537cce` |
| `postprocessing/ShaderPass.js` | https://raw.githubusercontent.com/mrdoob/three.js/r164/examples/jsm/postprocessing/ShaderPass.js | `428c6dc08d8d01aa8bc9dcc423eb3c2b435ae7c5491bfaaeed01785416e0ada1` |
| `postprocessing/SSAOPass.js` | https://raw.githubusercontent.com/mrdoob/three.js/r164/examples/jsm/postprocessing/SSAOPass.js | `bf48c4f2faa9509a5327c3f0a80f5b8f0d7afba7fc5758f4c4c736f433ac6beb` |
| `shaders/CopyShader.js` | https://raw.githubusercontent.com/mrdoob/three.js/r164/examples/jsm/shaders/CopyShader.js | `4e3346db194db56a596cd074e9bdb39fb5eb52040c333e0d29dc4eb1324d3b1d` |
| `shaders/OutputShader.js` | https://raw.githubusercontent.com/mrdoob/three.js/r164/examples/jsm/shaders/OutputShader.js | `291c9abf4beac165524f5963bda38691ed4631d8e6288d07f9e8910a452790a7` |
| `shaders/SSAOShader.js` | https://raw.githubusercontent.com/mrdoob/three.js/r164/examples/jsm/shaders/SSAOShader.js | `b54fc9b5d535163486559f14ea07ae803a43d4b0e7eb8825a0450a061c43f77b` |

The live sea-reflection camera follows the plane-reflection and oblique-clipping construction in [Three.js r164 Water](https://raw.githubusercontent.com/mrdoob/three.js/r164/examples/jsm/objects/Water.js); the site-specific shader, shoreline, and scene state remain in `assets/js/home-scene/`.
