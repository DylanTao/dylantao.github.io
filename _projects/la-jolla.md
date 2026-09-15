---
layout: page
title: A little La Jolla
description: A few places from my everyday orbit, compressed into a coastal miniature.
img: assets/models/la-jolla/miniature.webp
importance: -10
category: fun
site_experiment: true
debut_date: 2026-09-14
year: 2026
role: Design and direction
permalink: /projects/la-jolla/
hide_title: true
---

<section class="project-case-hero">
  <div class="project-case-copy">
    <p class="project-case-kicker">A coastal atlas</p>
    <h1>A little La Jolla</h1>
    <p>La Jolla is the cliff above the water, a walk past the Cove, and the light in a third-floor corner of the Design and Innovation Building. I wanted those places to sit together on this site, small enough to turn in your hand.</p>
    <div class="project-case-actions">
      <a class="project-case-link" href="#from-reference-to-geometry">See the process</a>
      <a class="project-case-link" href="{{ '/assets/models/la-jolla/miniature.glb' | relative_url }}">Download the model</a>
    </div>
  </div>
</section>

{% include la-jolla-miniature.liquid large=true %}

## A place, compressed

The miniature follows a walk through campus and the Cove: Geisel's concrete supports, the Salk courtyard, DIB, Scripps Pier, wind-shaped Torrey pines, and sea lions on the rocks. The footer takes a different route, past Spanish houses, palms, a cliff villa, tennis, and the beach. DIB connects the two, with five folded bays and my third-floor office in the middle one.

Their distances are deliberately compressed. The translucent atlas underneath uses real OpenStreetMap coastline and road geometry; the buildings above it are an artistic composition.

The selected site theme changes the light and the little activities: a quiet morning, surfing around noon, warm afternoon light, and a small evening bonfire on the footer beach. My DIB office gets a light from noon onward and on some nights. That is a personal vignette, not live occupancy information.

## From reference to geometry

I started with coordinated generated views, then ran Tencent's Hunyuan3D-2mv locally to see what shape it could recover. The raw reconstruction is retained alongside the editable Blender composition. It is useful to compare the silhouette with the architecture that needs deliberate modeling: the folded DIB bays, Geisel's stepped crown, the Salk courtyard, and the thin structure of the pier.

<div class="row"><div class="col-sm-6">{% include figure.liquid path="assets/img/coastal-process/la-jolla-front.webp" alt="Generated front view of the proposed La Jolla miniature" class="img-fluid" %}</div><div class="col-sm-6">{% include figure.liquid path="assets/img/coastal-process/la-jolla-back.webp" alt="Generated opposite view of the same proposed miniature" class="img-fluid" %}</div></div>
<p class="caption">Generated design studies, not photographs or the live browser renderer. The production atlas uses sourced geometry.</p>

{% include figure.liquid path="assets/img/coastal-process/reconstruction-clay.webp" alt="Actual Blender clay render of the local Hunyuan multiview reconstruction" class="img-fluid" %}

The reconstruction recovered the overall coastal mass, but softened the glass bays, library supports, and trees. I kept it as a shape study and built the interactive landmark geometry in Blender. The source images retain their tool provenance: their embedded metadata identifies **gpt-image, version 2.0**. The image tool did not offer a model selector.

## Sources and materials

- Building references: [UCSD Design and Innovation Building](https://dib.ucsd.edu/about/index.html), [Geisel Library architecture](https://geisel50.ucsd.edu/about/architecture.html), [Salk architecture](https://www.salk.edu/about/about-salk/architecture/), and [Scripps Pier](https://scripps.ucsd.edu/about/scripps-pier).
- Geographic base: [OpenStreetMap contributors](https://www.openstreetmap.org/copyright), under the Open Database License. The exported vector atlas carries the same attribution.
- Shape experiment: [Tencent Hunyuan3D-2](https://github.com/Tencent-Hunyuan/Hunyuan3D-2), with its model license retained in the process notes.
- Modeling and rendering: [Blender](https://www.blender.org/) and [Three.js](https://threejs.org/).

<details class="resource-folder project-story-disclosure">
  <summary>Open the model folder</summary>
  <div class="resource-folder__papers">
    <a href="{{ '/assets/img/coastal-process/la-jolla-front.webp' | relative_url }}">Concept view ↗</a>
    <a href="https://github.com/DylanTao/dylantao.github.io/raw/refs/heads/main/artwork/la-jolla/miniature.blend">Blender source ↓</a>
    <a href="{{ '/assets/models/la-jolla/miniature.glb' | relative_url }}">Web model ↓</a>
    <a href="https://github.com/DylanTao/dylantao.github.io/raw/refs/heads/main/artwork/la-jolla/reconstruction/multiview-shape.glb">Shape experiment ↓</a>
  </div>
</details>
