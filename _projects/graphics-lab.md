---
layout: page
title: Graphics Lab
description: "The rendering and simulation papers I have tried in the 3D coastal home, in one place: each experiment with its sources, its limits and newer papers to try."
img: assets/img/project_pics/graphics-lab/teaser.png
image_aspect: 996 / 756
importance: -33
category: fun
year: 2026
# Sirui: confirm the role.
role: Designer and reviewer
status: Living site experiment
site_experiment: true
parent: homepage-desk-scene
deck_children: record
debut_date: 2026-10-18T00:30:00-07:00
hide_title: true
og_image_alt: Four frames from the Graphics Lab, the light lab's two renderers, the light well's beam in the onsen, the beach below the cave house and a pen sketch of the bedroom
og_image_width: 996
og_image_height: 756
---

<section class="project-case-hero site-experiment-hero">
  <div class="project-case-copy">
    <p class="project-case-kicker">Site experiment · Rendering and simulation</p>
    <h1>Graphics Lab</h1>
    <p class="project-case-lede">
      The 3D coastal home on my homepage is where I try graphics and simulation papers: sunlight down a drilled light well, waves that grow with the sea breeze, steam carried by its own heat, curtains that billow at an open door. Other experiments begin with the house itself, like a carved creek feeding a koi pond. This page keeps them in one place, with what each does now and the papers that could take it further. The technical record behind it holds each one's code, sources and limits, and a separate page shows how I keep the house fast.
    </p>
    <div class="project-case-actions">
      <a href="{{ '/projects/graphics-lab/record/' | relative_url }}">Read the technical record</a>
      <a href="{{ '/projects/graphics-performance/' | relative_url }}">How I made it fast</a>
      <a href="{{ '/' | relative_url }}">Open the 3D home</a>
    </div>
  </div>
</section>

<section class="project-case-summary" aria-label="Graphics Lab summary">
  <div>
    <span>Why</span>
    <p>I kept adding graphics experiments to the home, and a project page for each one would have buried the rest of my work.</p>
  </div>
  <div>
    <span>What</span>
    <p>One row per experiment, with a still from the scene, where it stands, the paper it adapts and a link to its write-up.</p>
  </div>
  <div>
    <span>How</span>
    <p>The record distinguishes paper adaptations from original scene work, says where each simplifies, and keeps tests and sources beside the method.</p>
  </div>
</section>

## The experiments

Each row opens the experiment's own page or its section of the [technical record]({{ '/projects/graphics-lab/record/' | relative_url }}). Its caption records the scene's camera and clock. Most stills date from October 18–19, 2026; the creek and spectral ocean were captured on October 23. The light well, steam and onsen are set in late August, when the noon sun reaches the shaft and the bath runs in daylight. How the house itself is built, from its Blender sources to shader warmup and loading, is in [the coastal home's record]({{ '/projects/homepage-desk-scene/record/' | relative_url }}). The last group, Performance, opens [Making the 3D home fast]({{ '/projects/graphics-performance/' | relative_url }}): where each frame went, what each change saved and what comes next.

The October 23 work adds five bright planets checked against JPL Horizons, a small live cloth around the sleeping duvet's fitted shape, and the clifftop water garden. The spectral ocean stays separately enabled in the authoring lab; the public home keeps its analytic waves. That lab also has a frozen-photo sampler and a separate static-house ink comparison. Their [methods and limits]({{ '/projects/graphics-lab/record/' | relative_url }}#bounded-studies) sit beside a review of learned representations, with no trained-pipeline or performance claim borrowed from the papers.

{% include graphics_lab.liquid part="experiments" %}

## Next papers to try

Each technique in the record keeps a short list of newer work that advances it, mostly from SIGGRAPH, SIGGRAPH Asia, Eurographics, EGSR and SCA, with what it would add here and a rough effort. These four would each change something a visitor can see:

{% include graphics_lab.liquid part="shortlist" %}

{% if site.data.design_records['graphics-lab'].bench.size > 0 %}

## On the bench

Work that is still in progress elsewhere in the house joins the list when it lands.

{% include graphics_lab.liquid part="bench" %}

{% endif %}

<details class="project-story-disclosure">
  <summary>How the stills and the record are made</summary>
  <div class="project-story-disclosure-body">
    <ul>
      <li><strong>Stills.</strong> <code>bin/capture_graphics_lab_stills.cjs</code> opens the homepage's authoring lab in headless Chromium at a named hour, room and camera, without the homepage's feathered edge, and <code>bin/make_graphics_lab_thumbnails.py</code> scales the frames. The October 23 creek and FFT frames come from <code>bin/verify_environment.cjs</code> against the candidate scene. They are scaled, never retouched. The light lab's still is a frame of its own renderer.</li>
      <li><strong>Record.</strong> Each technique lives in <code>_data/design_records/graphics-lab.yml</code> with its files and key functions, its sources, its limits and its papers to try; <code>python bin/design_record_brief.py graphics-lab</code> turns it into a brief for the next pass, and the <a href="{{ '/assets/downloads/site-experiments/graphics-lab-reproduction.md' | relative_url }}" download>agent brief</a> says how to take a paper from the list into the house.</li>
      <li><strong>Citations.</strong> References were checked against DOI records, publisher or author pages, and JPL's own documentation between October 16 and 23, 2026. Four DOIs in the first draft resolved to other papers and were corrected.</li>
      <!-- Sirui: confirm -->
      <li><strong>Credit.</strong> Sirui Tao, with AI coding agents: the experiments, their tests and notes. Anthropic's Claude compiled the original page, stills and technical record; Codex integrated the October 23 continuations and their evidence boundaries.</li>
    </ul>
  </div>
</details>
