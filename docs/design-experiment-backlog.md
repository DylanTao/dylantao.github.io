# Design Experiment Backlog

This is the durable queue for visual and interaction ideas that are promising but not yet proven. It keeps the site's design spine alive without turning every reference into production code.

Use this alongside [`WEBSITE_DESIGN_HEURISTICS.md`](../WEBSITE_DESIGN_HEURISTICS.md). Before shipping an experiment, fill every field, inspect the rendered route, and record Sirui's keep/revise/remove decision. A reference is permission to study a principle, not permission to copy code, assets, or visual identity.

## Experiment Record

| Field           | What to record                                                                      |
| --------------- | ----------------------------------------------------------------------------------- |
| Hypothesis      | The visitor problem and the specific improvement expected.                          |
| Route           | The smallest public surface where the idea can be tested.                           |
| Reference       | The source that shaped the idea and what was learned from it.                       |
| Licensing       | Whether code/assets may be used, what credit is required, and unresolved questions. |
| Visitor benefit | What becomes clearer, easier, more meaningful, or more delightful.                  |
| Budget          | Performance, accessibility, motion, privacy, and maintenance limits.                |
| Status          | `idea`, `scoped`, `prototype`, `kept`, `revised`, `removed`, or `deferred`.         |
| Evidence        | Comparable screenshots, measurements, tests, and observed tradeoffs.                |
| Sirui decision  | Keep/revise/remove plus the judgment behind it.                                     |
| Revisit trigger | A concrete event that makes another pass worthwhile.                                |

## Current And Deferred Experiments

### Dot Orbit behind Research Focus

- **Hypothesis:** A clearly perceptible but secondary moving field can make the three research modes feel more alive while the semantic 2D drawing remains the explanation.
- **Route:** Only routes that render the Research Focus component: the homepage and Website Revamp story.
- **Reference:** [Paper Shaders](https://shaders.paper.design/) by [Paper](https://paper.design/), plus the founder's [design walkthrough](https://youtu.be/P06RgnUKX_I?si=7xfPgwCjDHvjVG46).
- **Licensing:** Vendored minimal ESM closure from `@paper-design/shaders@0.0.80` under Apache-2.0, with license, notice, source, version, integrity, and per-file hashes retained.
- **Visitor benefit:** Mode changes gain a subtle sense of gathering, testing, and situating without adding another explanation or hiding the existing controls.
- **Budget:** One WebGL2 context; at most 480,000 processed pixels; offscreen and hidden-tab pause; deterministic reduced-motion still; complete 2D fallback; no layout shift or blocking loader.
- **Status:** `revised`; awaiting Sirui's live visual judgment.
- **Evidence:** Automated checks observed one live context, no more than 480,000 processed pixels, no layout shift, offscreen and hidden-tab pausing, mode-responsive parameters, a deterministic reduced-motion still, and an intact 2D experience after module failure and simulated context loss. Sirui's first live review found the original nested opacity treatment perceptually absent: the implementation existed, but the design did not communicate that it existed.
- **Sirui decision:** Strengthen the Paper color and compositing levels enough to be unmistakable on entry, while keeping the semantic canvas above it. Do not call an imperceptible effect “restrained.”
- **Revisit trigger:** Sirui's next live preview judgment, or any contrast, frame-time, context-count, layout-shift, or comprehension regression.

### Interaction-linked glint for origin stories

- **Hypothesis:** A tiny glint can stay out of the reading hierarchy, then become legible when someone engages the artifact or focuses the provenance route.
- **Route:** Every existing origin-link placement; no new origin links are invented in this pass.
- **Reference:** The site's existing source-linked project stories and Sirui's request for subtler motion and illumination.
- **Licensing:** Site-owned SVG and CSS; no external asset.
- **Visitor benefit:** Curious readers can follow the design story while everyone else reads the artifact without icon clutter or a surprise popover.
- **Budget:** 44px target; immediate focus ring; no spatial animation, tooltip, pulse, or JavaScript; visible text must remain legible at 200% zoom.
- **Status:** `revised`; the wordmark has been removed and the interaction-linked glint is awaiting rendered judgment.
- **Evidence:** Sirui rejected the original dot-and-line mark because it resembled a slider, the large hover disclosure because it was confusing, and the later `story ↗` wordmark because it became a prominent repeated action that affected the general experience.
- **Sirui decision:** Keep the 44px target and concrete story destination, but show only a tiny four-point glint at rest. Let the glint extend and illuminate briefly on owner hover/focus or direct interaction; use no wordmark, arrow, continuous pulse, slider line, or custom tooltip.
- **Revisit trigger:** Sirui's next live preview judgment, or evidence that the wordmark competes with its artifact or becomes too easy to miss.

### Static Paper Texture for Website Revamp

- **Hypothesis:** A seeded paper texture can give the Website Revamp story a tactile, authored surface without spending another runtime WebGL context or delaying its text.
- **Route:** Website Revamp story only.
- **Reference:** [Paper Shaders](https://shaders.paper.design/) by [Paper](https://paper.design/), plus the founder's [design walkthrough](https://youtu.be/P06RgnUKX_I?si=7xfPgwCjDHvjVG46).
- **Licensing:** Site-owned deterministic output; the reproducible recipe records its Paper Texture inspiration, seed, parameters, output hash, and source credits. No third-party runtime code is needed for the image.
- **Visitor benefit:** The story gains a quiet material identity that supports its editorial pacing instead of adding another box or animation.
- **Budget:** One responsive WebP, no runtime context, no loader, decorative semantics, and sufficient foreground contrast in light and dark themes.
- **Status:** `kept` after the sitewide realignment release QA.
- **Evidence:** The deterministic WebP and recipe reproduce the same hashed asset. Four-viewport light/dark inspection showed no text obstruction, layout shift, or extra loading state.
- **Sirui decision:** Keep it as a story-specific material accent, not a new sitewide background language.
- **Revisit trigger:** The texture becomes visually generic, weakens contrast, or begins spreading to routes without a narrative reason.

### Static Paper fields for project identity

- **Hypothesis:** A small family of semantically matched shader fields can make projects feel authored and distinct without turning the whole site into one ambient effect.
- **Route:** Paper Waves on Build Rhythm and the playful-build category; Paper Static Mesh Gradient on DesignWeaver and the research category.
- **Reference:** [Paper Shaders](https://shaders.paper.design/) by [Paper](https://paper.design/), using the package's static Waves and Static Mesh Gradient shaders.
- **Licensing:** Deterministic WebPs generated from the vendored Apache-2.0 `@paper-design/shaders@0.0.80` closure; recipes retain shader names, parameters, output hashes, package version, and source URLs.
- **Visitor benefit:** Build Rhythm gains a cadence-shaped field, while DesignWeaver's many-dimensional design space gains a blended color field. The project index quietly previews that distinction at category boundaries.
- **Budget:** Two static WebPs totaling under 400 KB; no additional live WebGL context, loader, layout shift, or continuous animation; short owner-hover background shift only; hidden under increased contrast and forced colors.
- **Status:** `prototype`; awaiting rendered judgment on the project index and both project stories.
- **Evidence:** Both outputs pass deterministic recipe/hash checks and direct pixel inspection. Route-level light, dark, mobile, and reduced-motion judgment remains before release.
- **Sirui decision:** Use different shaders only where their visual behavior helps explain the project. Do not assign every route a shader or turn shader variety into the site's navigation system.
- **Revisit trigger:** The fields read as generic decoration, compete with project evidence, cost too much on mobile, or fail to remain recognizably different at their rendered opacity.

### Paper Water for the 3D ocean

- **Hypothesis:** A restrained water shader could make the cliff-cave exterior feel more spatial and alive without becoming the subject of the homepage.
- **Route:** Homepage 3D desk exterior only.
- **Reference:** [Paper Shaders](https://shaders.paper.design/) by [Paper](https://paper.design/).
- **Licensing:** Reassess the exact package/version and preserve its license before any implementation.
- **Visitor benefit:** Stronger continuity between the room, cliff edge, and ocean when exploring the 3D view.
- **Budget:** Separate desk-scene lane; one-scene topology and reflection proof; stable low-end frame rate; reduced-motion still; no change to 2D/3D state continuity.
- **Status:** `deferred`.
- **Evidence:** None yet; do not infer feasibility from the Research Focus substrate.
- **Sirui decision:** Worth revisiting, not part of the sitewide realignment release.
- **Revisit trigger:** A dedicated desk-scene brief with full topology, performance, and cross-device acceptance evidence.

### Owned-photo editorial abstraction

- **Hypothesis:** A sparse abstraction of an owned travel photo could add personal visual memory to one story without introducing a generic stock-image mood.
- **Route:** One future photo-led post or project, selected before prototyping.
- **Reference:** [`Evianis/travel-photo-abstraction`](https://github.com/Evianis/travel-photo-abstraction).
- **Licensing:** Source-available with modification and redistribution constraints; do not vendor, modify, or redistribute the skill without a separate permission review. Use only an owned input photo.
- **Visitor benefit:** A story-specific visual pause that carries place and memory while keeping text readable.
- **Budget:** One static asset, descriptive alt text, no runtime dependency, and a before/after review showing that the abstraction supports rather than replaces the story.
- **Status:** `deferred`.
- **Evidence:** Reference reviewed; no site asset created.
- **Sirui decision:** Keep as a future owned-photo experiment.
- **Revisit trigger:** Sirui chooses an owned photograph and a story where place is part of the claim.

### One conclusion per chart

- **Hypothesis:** Giving each chart one explicit question and a reading speed matched to its evidence will make Build Rhythm and future data stories easier to enter.
- **Route:** Build Rhythm first; later chart-bearing stories only after comparison.
- **Reference:** [`lieflat-charts`](https://github.com/larashero3-dotcom/lieflat-charts/blob/main/README.en.md), used as an influence for conclusion-led charts and varied reading speeds.
- **Licensing:** Do not copy templates or code without a separate license decision.
- **Visitor benefit:** Faster orientation while exact values and boundaries remain available.
- **Budget:** No loss of metrics, table access, provenance, keyboard inspection, or uncertainty language.
- **Status:** `kept` in Build Rhythm; a reusable visual grammar remains `deferred`.
- **Evidence:** Four-viewport rendered review and legacy interaction checks confirmed that each chart opens with one question, the conclusion and limits precede implementation history, literal and linear readings remain distinct, and exact tables remain reachable without changing any metric or evidence boundary.
- **Sirui decision:** Keep the narrative principle. Do not adopt an external chart template until another data story proves the grammar transfers cleanly.
- **Revisit trigger:** The Build Rhythm release is deployed and reviewed at all four standard viewports.

### Retell the remaining project stories in situated waves

- **Hypothesis:** Giving each project the medium and pacing its evidence deserves will feel more human than applying one case-study template everywhere.
- **Route:** The project index and every project story not deeply rewritten in the current release.
- **Reference:** The “Less, but more Sirui” spine, the Website Revamp and Build Rhythm retellings, and the one-conclusion-per-chart lesson above.
- **Licensing:** Use project-owned text and assets; make a separate license decision before importing any external template, code, photograph, or generated visual system.
- **Visitor benefit:** Each project becomes easier to enter and more memorable without losing evidence boundaries or Sirui's phrases.
- **Budget:** Preserve every factual claim, source link, privacy boundary, reproduction record, accessible fallback, and project interaction contract. Deep-rewrite one route at a time with fixed before/after captures.
- **Status:** `deferred`; this release applies only the shared hierarchy, lighter type, provenance disclosure, and interaction-linked origin glint.
- **Evidence:** The two flagship retellings establish the first comparison pair. No claim is made yet that the same narrative shape fits the other projects.
- **Sirui decision:** Sequence future passes instead of forcing a uniform rewrite into this release.
- **Revisit trigger:** Start a new visual lane with the owning story sources and baseline captures available.

Suggested sequence:

1. **Spatial and data stories:** The Desk That Learned Depth, Paper Constellation, and Scholar Lens. Decide separately whether each story is best taught through interaction, diagram, or annotated evidence.
2. **Playful provenance stories:** Wall of Rejection, The IKEA Card Experiment, HCI Spooder-Man, Dogtor's Hidden Portal, and OpenAI Build Week. Keep the joke or surprise, then move custody details behind it.
3. **Research artifacts:** DesignWeaver, What Happened and Why, HotSpot, Physion, GraphHSCN, and Context-Aware Encoding. Lead with the research question and connect to canonical publication evidence where it exists.
4. **Standalone world:** Not A Good Driver. Retell only when surviving visual evidence can support more than the current role-and-sightline account.

## Completed Experiments

Move an entry here only after recording evidence and Sirui's decision. Keep removed experiments too: knowing why an idea failed is part of the site's professional vision.
