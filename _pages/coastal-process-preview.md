---
layout: default
title: La Jolla process preview
permalink: /design-lab/coastal-process/
description: An unlisted comparison of La Jolla's generated design studies, local shape reconstruction, and authored production miniature.
panel_wide: true
nav: false
sitemap: false
search: false
robots: noindex, nofollow
---

<link rel="stylesheet" href="{{ '/assets/css/coastal-process-preview.css' | relative_url }}">

<article class="coastal-process-preview" aria-labelledby="coastal-preview-title">
  <div class="coastal-process-preview__review">
    <p>Concept G · Unlisted review</p>
    <a href="{{ '/projects/la-jolla/' | relative_url }}"><span aria-hidden="true">←</span> Current La Jolla case study</a>
  </div>

  <header class="coastal-process-preview__opening">
    <p class="coastal-process-preview__meta">A coastal atlas · From reference to geometry</p>
    <h1 id="coastal-preview-title">A little La Jolla</h1>
    <p>La Jolla is the cliff above the water, a walk past the Cove, and the light in a third-floor corner of the Design and Innovation Building. I wanted those places to sit together on this site, small enough to turn in your hand.</p>
  </header>

  <section class="coastal-process-preview__studies" aria-labelledby="coastal-studies-title">
    <div class="coastal-process-preview__section-intro">
      <p class="coastal-process-preview__meta">01 · Direction</p>
      <h2 id="coastal-studies-title">Generated design studies</h2>
      <p>I started with coordinated generated views, then ran Tencent's Hunyuan3D-2mv locally to see what shape it could recover.</p>
    </div>

    <div class="coastal-process-preview__pair">
      <figure>
        <img src="{{ '/assets/img/coastal-process/la-jolla-front.webp' | relative_url }}" width="1254" height="1254" alt="Generated front design study of the proposed La Jolla miniature, with campus landmarks above the coastline" loading="eager" decoding="async">
        <figcaption><strong>Front study.</strong> Generated design direction. Embedded source metadata identifies gpt-image, version 2.0.</figcaption>
        <a class="coastal-process-preview__original" href="{{ '/assets/img/coastal-process/la-jolla-front.webp' | relative_url }}">Open original front study <span aria-hidden="true">↗</span></a>
      </figure>
      <figure>
        <img src="{{ '/assets/img/coastal-process/la-jolla-back.webp' | relative_url }}" width="1254" height="1254" alt="Generated opposite view of the same proposed coastal miniature, showing the pier, cliffs, and campus buildings" loading="eager" decoding="async">
        <figcaption><strong>Reverse study.</strong> A coordinated generated view of the same proposed miniature.</figcaption>
        <a class="coastal-process-preview__original" href="{{ '/assets/img/coastal-process/la-jolla-back.webp' | relative_url }}">Open original reverse study <span aria-hidden="true">↗</span></a>
      </figure>
    </div>

    <p class="coastal-process-preview__boundary">Generated design studies, not photographs or the live browser renderer. The production atlas uses sourced geometry.</p>

  </section>

  <section class="coastal-process-preview__comparison" aria-labelledby="coastal-comparison-title">
    <div class="coastal-process-preview__section-intro">
      <p class="coastal-process-preview__meta">02 → 03 · Shape and architecture</p>
      <h2 id="coastal-comparison-title">From shape study to authored geometry</h2>
      <p>The reconstruction recovered the overall coastal mass, but softened the glass bays, library supports, and trees. I kept it as a shape study and built the interactive landmark geometry in Blender.</p>
    </div>

    <div class="coastal-process-preview__pair coastal-process-preview__outcomes">
      <section aria-labelledby="coastal-reconstruction-title">
        <p class="coastal-process-preview__meta">02 · Local reconstruction</p>
        <h3 id="coastal-reconstruction-title">The recovered shape</h3>
        <figure>
          <img src="{{ '/assets/img/coastal-process/reconstruction-clay.webp' | relative_url }}" width="800" height="800" alt="Actual Blender clay render of the local Hunyuan multiview reconstruction, showing the broad coastal mass and softened architectural details" loading="lazy" decoding="async">
          <figcaption><strong>Raw reconstruction.</strong> Actual Blender clay render of the locally inferred Hunyuan3D-2mv shape. Retained as a generated shape study.</figcaption>
          <a class="coastal-process-preview__original" href="{{ '/assets/img/coastal-process/reconstruction-clay.webp' | relative_url }}">Open original reconstruction render <span aria-hidden="true">↗</span></a>
        </figure>
      </section>
      <section aria-labelledby="coastal-production-title">
        <p class="coastal-process-preview__meta">03 · Authored in Blender</p>
        <h3 id="coastal-production-title">The production miniature</h3>
        <figure>
          <img src="{{ '/assets/models/la-jolla/posters/miniature-noon.webp' | relative_url }}" width="1000" height="1000" alt="Noon capture of the actual Three.js renderer showing the authored La Jolla miniature with distinct Geisel supports, Salk courtyard, DIB glass bays, and Scripps Pier" loading="lazy" decoding="async">
          <figcaption><strong>Runtime poster · noon.</strong> Still captured from the actual Three.js renderer using the authored miniature. The live model remains in the <a href="{{ '/projects/la-jolla/' | relative_url }}">current case study</a>.</figcaption>
          <a class="coastal-process-preview__original" href="{{ '/assets/models/la-jolla/posters/miniature-noon.webp' | relative_url }}">Open original runtime poster <span aria-hidden="true">↗</span></a>
        </figure>
      </section>
    </div>

    <div class="coastal-process-preview__reading-note">
      <h3>Architecture worth looking for</h3>
      <p>It is useful to compare the silhouette with the architecture that needs deliberate modeling: the folded DIB bays, Geisel's stepped crown, the Salk courtyard, and the thin structure of the pier.</p>
      <p>Their distances are deliberately compressed. On the live page, the translucent atlas underneath uses real OpenStreetMap coastline and road geometry; the buildings above it are an artistic composition.</p>
    </div>

  </section>

  <aside class="coastal-process-preview__provenance" aria-labelledby="coastal-provenance-title">
    <h2 id="coastal-provenance-title">Sources and materials</h2>
    <p>The raw reconstruction is retained alongside the editable Blender composition. The production miniature is separately authored geometry; this preview displays its noon runtime poster.</p>
    <details>
      <summary>Open the source and license notes</summary>
      <ul>
        <li>Building references: <a href="https://dib.ucsd.edu/about/index.html">UCSD Design and Innovation Building</a>, <a href="https://geisel50.ucsd.edu/about/architecture.html">Geisel Library architecture</a>, <a href="https://www.salk.edu/explore-salk-architecture-guide/">Salk's architecture guide</a>, and <a href="https://scripps.ucsd.edu/about/scripps-pier">Scripps Pier</a>.</li>
        <li>Village references: <a href="https://www.brocktonvilla.com/about">Brockton Villa's history and photographs</a>, <a href="https://www.lavalencia.com/gallery">La Valencia's gallery</a> and <a href="https://www.lavalencia.com/ResourceFiles/pdf/la-valencia-map-new.pdf">property plan</a>, and the <a href="https://www.sandiego.gov/lifeguards/beaches/pool">City of San Diego's Children's Pool guide</a>.</li>
        <li>Geographic base: © <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>, under the Open Database License. The exported vector atlas carries the same attribution.</li>
        <li>Shape experiment: <a href="https://github.com/Tencent-Hunyuan/Hunyuan3D-2">Tencent Hunyuan3D-2</a>. The <a href="https://github.com/DylanTao/dylantao.github.io/blob/main/artwork/la-jolla/reconstruction/HUNYUAN-LICENSE.txt">Tencent Hunyuan3D 2.0 Community License</a> is retained with the raw reconstruction.</li>
        <li>Modeling and rendering: <a href="https://www.blender.org/">Blender</a> and <a href="https://threejs.org/">Three.js</a>. The source images retain metadata identifying gpt-image, version 2.0; the image tool did not offer a model selector.</li>
      </ul>
    </details>
  </aside>

  <aside class="coastal-process-preview__review-note" aria-label="Preview intent and references">
    <p><strong>Review question:</strong> Does keeping the reconstruction beside the production miniature make the modeling decisions easier to see?</p>
    <details>
      <summary>About this preview</summary>
      <p>Concept G is an unlisted layout study. Factual wording and source credit come from the <a href="{{ '/projects/la-jolla/' | relative_url }}">La Jolla case study</a> and its <a href="https://github.com/DylanTao/dylantao.github.io/blob/main/artwork/la-jolla/PROVENANCE.md">provenance record</a>. The different viewpoints and artistic compression support a qualitative process comparison.</p>
      <p>Stage and artifact adjacency draws on <a href="https://miaai-lab.github.io/Claude-Opus-5.5-100-HTML-Files/063-history-of-flight.html">063: Skyward</a>; whole-artifact reading and nearby provenance draw on <a href="https://miaai-lab.github.io/Claude-Opus-5.5-100-HTML-Files/039-virtual-gallery.html">039: Galerie Nocturne</a>. Linking a visible state to its explanation draws on the <a href="https://zcnofdpgpxud.feishuapp.com/app/app_17exzr8eka4/fusion/demos/v14-lab-explainer.html">Feishu V14 optics demonstration</a>, recreated there from misbahsy's public prompt. This preview uses existing owned assets and original HTML/CSS.</p>
    </details>
  </aside>
</article>
