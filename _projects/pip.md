---
layout: page
title: duh & P, a Little Company
permalink: /projects/p/
description: A soft black dot, a curious little robot, and an experiment in making room for play.
img: assets/models/pip/poster.webp
image_aspect: 8 / 9
card_image_fit: contain
importance: -31
category: fun
site_experiment: true
debut_date: 2026-09-13T01:00:00-07:00
year: 2026
role: Designer and character director
status: Living interaction experiment
hide_title: true
pip_studio: true
---

<section class="duh-introduction" aria-labelledby="duh-title">
  <p class="project-case-kicker">duh & P · a living site experiment</p>
  <h1 id="duh-title">A softer sort of company.</h1>
  <p class="project-case-lede">A small black dot. A little curiosity. Just enough mischief.</p>
  <p>Meet duh, the website's new companion. I wanted something less mechanical: a soft shape that can take a gentle pet, stretch into a throw, and settle back into a quiet corner. Leave it a little room and it will hop, roll, or come over to say hello. Hold duh still for a moment and it closes its eyes to rest; a tap wakes it.</p>
  <p>Sometimes it becomes an apple, a peach, a striped watermelon, or a simple geometric shape. Its eyes stay familiar, and its soft body follows your hand. A few quick pets get a happy squish; repeated energetic throws lead to a short breather. You can always invite duh back.</p>
  <div class="duh-stage" data-duh-playground aria-label="Duh's play corner">
    <div class="duh-stage-words" aria-hidden="true"><span data-duh-piece aria-hidden="true">hello</span><span data-duh-piece aria-hidden="true">softly</span><span data-duh-piece aria-hidden="true">again</span></div>
    <div class="duh-block" data-duh-heavy aria-hidden="true"></div>
    <p class="duh-stage-caption"><button type="button" data-duh-invite>Invite duh here</button> Toss toward the block; the loose words come home again.</p>
  </div>
  <p>Drag duh directly with a finger or mouse; the rest of the page scrolls as usual. To move without dragging, double-tap duh and tap an empty spot nearby. With duh focused, arrow keys move it, T gives a little toss, P pauses, and R resets. Shift-click also resets; Alt + Shift + D recalls it from anywhere. The invitation above starts fresh in the play corner. Reduced motion keeps the shapes and expressions, with the bouncing and scattered pieces turned off.</p>
</section>

<section class="project-case-hero pip-project-hero">
  <div class="project-case-copy">
    <p class="project-case-kicker">P · a living site experiment</p>
    <h2>P is still here.</h2>
    <p class="project-case-lede">How little motion does it take to make a character feel attentive?</p>
    <p>P was the first companion: curious about your pointer, occasionally distracted, and usually trying to help. P stands for prototype, with a nod to my home in ProtoLab. The robot now keeps this playground, while duh joins the wider website.</p>
    <p class="pip-project-invitation">Move your pointer nearby, or try a gesture. P’s head leads; the rest catches up.</p>
    <div class="project-case-actions">
      <a class="project-case-link" href="{{ '/' | relative_url }}">Visit the home <span aria-hidden="true">→</span></a>
      <a class="project-case-link" href="#credits">Inspiration & credits</a>
    </div>
  </div>
  <div class="pip-studio" data-pip-studio aria-label="P’s motion playground">
    <div class="pip-studio-figure">
      <img src="{{ '/assets/models/pip/poster.webp' | relative_url }}" alt="P: a white floating robot with two antennae, unequal round lens eyes, an orange dot, and small detached arms" width="640" height="720" class="pip-studio-poster">
      <canvas aria-hidden="true"></canvas>
    </div>
    <div class="pip-studio-gestures" role="group" aria-label="Try P’s gestures" hidden>
      <button type="button" data-pip-gesture="hello">Hello</button>
      <button type="button" data-pip-gesture="curious">Curious</button>
      <button type="button" data-pip-gesture="nod">Got it</button>
      <button type="button" data-pip-gesture="repair">Oops…</button>
      <button type="button" data-pip-rest aria-pressed="false">Let P nap</button>
    </div>
    <p class="pip-studio-status" data-pip-status aria-live="polite">A little room to be curious.</p>
  </div>
</section>

## Looking is a small conversation

A quick head turn says “I noticed.” A held tilt leaves a moment for curiosity. The antennae settle a little later, and the body takes its time. Those differences matter more to me than adding another facial expression.

I built a small vocabulary around those moments: a greeting, a curious lean, an affirmative nod, a glance away, and a startled recovery. Each gesture has an arrival, a pause, and a way back to rest. Pointer tracking blends into that movement; it does not restart the whole performance every time you move.

<div class="pip-motion-notes">
  <div><h3>Notice</h3><p>The lens eyes and head turn first. A tilt and an uneven antenna pose make the attention feel a little less mechanical.</p></div>
  <div><h3>Follow</h3><p>The floating body accelerates gently and settles above its shadow. Sometimes P loses interest and wanders.</p></div>
  <div><h3>Make room</h3><p>P waits in gaps around the reading. A small accidental nudge is followed by a repair; the words and links stay intact.</p></div>
</div>

## P's first chapter: one companion, two places

<div class="pip-encounter" data-pip-play-space>
  <p class="pip-encounter-note">A thought in the way.<br>A little room to get around it.</p>
  <div class="pip-trip-controls" role="group" aria-label="Try P’s page interactions" hidden>
    <button type="button" data-pip-trip="fly">Fly around</button>
    <button type="button" data-pip-trip="squeeze">Squeeze past</button>
    <button type="button" data-pip-trip="portal">Open a portal</button>
    <button type="button" data-pip-trip="bump">A little bump</button>
  </div>
  <p class="pip-trip-status" data-pip-trip-status aria-live="polite">Invite P out into the page.</p>
</div>

P originally began beside the homepage record and moved between the reading surface and the 3D home. Its white shell, optical lenses, orange detail, and gestures kept that identity recognizable. That work remains here as an interactive part of the project's history.

On the page, P looks for a clear way around the words and cards. It usually flies around an edge, sometimes tucks into a smaller gap, and opens a pair of little portals when a crossing is blocked. A rare bump has a visible approach, a small wobble, and a repair. The reading stays where it belongs.

The surface responds to the site’s four times of day: softer morning light, cooler daylight, a warm afternoon, and a quiet evening rim. The page version draws a tiny analytic 3D portrait; the room uses the articulated Blender model. They share their motion vocabulary, attention, and brief rests.

This is an authored character experiment. P’s remarks and actions are local, with no language-model requests, camera access, or microphone access. Reduced motion gives it a composed still pose, and its brief rests end automatically.

## What changed after the first pass

The move from P to duh changes the default silhouette, not the interest in attentive motion. Duh uses a stable center with a small deformable outline; its mood, shape, and gestures remain separate. A strong throw can nudge a paragraph or shake the block in the play corner. Duh then makes a small repair gesture as things settle back. Only the corner’s decorative words become loose copies; real text, links, selection, and page order stay intact. Scrolling, selecting text, pausing, or resetting puts everything back immediately, and a refresh starts clean. This is an original browser character, with no proprietary character assets or remote model calls.

The first P had a rectangular visor and a small round body. In review, I asked for the physical charm of Reachy Mini and the floating ease of EVE. Separate convex lenses and a tapered shell helped, but the hollow eye rings still felt cold and the antennae too wiry. The next pass uses softer filled pupils that widen, squint and wink, shorter flexible antennae, and shaped flippers. The larger playground makes those small differences easier to judge.

The useful lesson: a character needs a coherent silhouette and a few legible gestures before it needs more behavior. The next question is whether its occasional interruptions remain welcome during a longer reading session; I have not run a visitor study yet.

<details class="project-story-disclosure">
  <summary>Inside the little robot</summary>
  <div class="project-story-disclosure-body">
    <p>The room model has separate pivots for the head, two antennae, two optical pupils, and two arms. Blender exports those parts to a GLB; a small JavaScript controller poses them at runtime. The page portrait draws the matching silhouette directly in a small WebGL canvas, so the default reading page does not need to download Three.js or the house.</p>
    <p>Both renderers use the same gesture controller. Authored poses blend with pointer attention, antennae follow damped springs, and a quintic minimum-jerk curve eases into and out of each pose. An interrupted gesture starts from its current pose. Hidden tabs stop drawing; a failed graphics context leaves a still portrait.</p>
    <p>The <a href="https://github.com/DylanTao/dylantao.github.io/blob/main/bin/build_pip.py">Blender authoring script</a> and <a href="https://github.com/DylanTao/dylantao.github.io/blob/main/assets/js/companion/motion.mjs">motion controller</a> are available to inspect and adapt.</p>
  </div>
</details>

<section id="credits" class="pip-credits" aria-labelledby="pip-credits-title">
  <h2 id="pip-credits-title">Inspiration & resources</h2>
  <ul>
    <li><strong>Pollen Robotics and Hugging Face’s <a href="https://huggingface.co/docs/reachy_mini/index">Reachy Mini</a>:</strong> the expressive head, unequal lens eyes, and independently posed antennae. Its <a href="https://huggingface.co/docs/reachy_mini/SDK/python-sdk#movement">movement API</a> informed the separation of head, antennae, and body, and the use of minimum-jerk timing.</li>
    <li><strong>The <a href="https://github.com/pollen-robotics/reachy_mini_dances_library">Reachy Mini Dances Library</a>:</strong> a reference for nods, side tilts, glances, and recovery gestures. P’s smaller, quieter browser choreography is original; no dance recordings, choreography files, or SDK code are bundled.</li>
    <li><strong>Pixar’s <a href="https://www.pixar.com/wall-e">WALL·E</a>, especially EVE:</strong> the floating tapered silhouette, detached arms, and expressive pauses. These are visual and motion influences; P uses original geometry, with no film images or studio models in the site.</li>
    <li><strong><a href="https://www.blender.org/">Blender</a> and <a href="https://threejs.org/">Three.js</a>:</strong> the editable articulated model, GLB export, and room renderer. The lightweight page portrait and motion controller are original WebGL and JavaScript.</li>
    <li><strong>Sirui Tao, with OpenAI Codex:</strong> character direction, references, critique, implementation, and iteration. <a href="https://github.com/DylanTao/dylantao.github.io/tree/main/artwork/pip">Model source and provenance</a> · <a href="https://github.com/DylanTao/dylantao.github.io/tree/main/assets/js/companion">browser source</a>.</li>
  </ul>
</section>
