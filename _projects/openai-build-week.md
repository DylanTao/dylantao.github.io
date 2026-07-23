---
layout: page
title: Scaffolding for Taste — OpenAI Build Week
description: What I added to an existing research portfolio during OpenAI Build Week, with a clear cutoff, linked commits, and reusable project guides.
img: assets/img/project_pics/openai-build-week/openai-build-week-extension.svg
image_aspect: 3 / 2
card_image_fit: contain
card_avoid_scaling: true
importance: -40
category: fun
site_experiment: true
debut_date: 2026-07-18T18:46:02-07:00
year: 2026
role: Designer, researcher, reviewer
status: OpenAI Build Week submission
hide_title: true
openai_build_week: true
heuristics_preview: true
---

<section class="project-case-hero openai-build-week-hero">
  <div class="project-case-copy">
    <p class="project-case-kicker">OpenAI Build Week · Education track · July 2026</p>
    <h1>Scaffolding for Taste</h1>
    <p class="project-case-lede">
      A polished homepage can hide the bad passes and judgment behind it. I wanted students to see what I kept, changed, and threw away, then reuse the same screenshot checks. After the cutoff, I used Codex with GPT-5.6 Sol to add the Human/AI route, Paper Constellation, guided project stories, reproduction briefs, and the tests behind them. The timeline keeps that new work separate from the site I already had.
    </p>
    <div class="project-case-facts">
      <span>12 post-cutoff checkpoints</span>
      <span>7 new reproduction guides</span>
      <span>1 retained GPT-5.6 Sol thread</span>
      <span>0 runtime AI calls</span>
    </div>
    <div class="project-case-actions">
      <a href="#build-week-extension">Follow the evidence</a>
      <a href="?demo=1#build-week-extension">Play the guided tour</a>
      <a href="https://youtu.be/9js8vU6cth4">Watch the 2:45 demo</a>
      <a href="{{ '/' | relative_url }}">Open the live portfolio</a>
      <a href="{{ '/WEBSITE_DESIGN_HEURISTICS.md' | relative_url }}">Read the design memory</a>
    </div>
  </div>

  <figure class="build-week-boundary-figure" aria-labelledby="build-week-boundary-title">
    <div class="build-week-boundary-heading">
      <span>Eligibility line</span>
      <strong id="build-week-boundary-title">July 13 · 9:00 AM PT</strong>
    </div>
    <div class="build-week-boundary-grid">
      <section class="build-week-boundary-side build-week-boundary-side--before" aria-label="Pre-existing foundation">
        <p>Before 09:00</p>
        <h2>Foundation</h2>
        <ul>
          <li>Research portfolio</li>
          <li>COGS 125 framing</li>
          <li>Living heuristics</li>
          <li>Reciprocal 3D room</li>
        </ul>
      </section>
      <div class="build-week-boundary-cutoff" aria-hidden="true"><span>START</span></div>
      <section class="build-week-boundary-side build-week-boundary-side--after" aria-label="Build Week extension">
        <p>After 09:00</p>
        <h2>Extension</h2>
        <ul>
          <li>Human/AI profile</li>
          <li>Guided evidence stories</li>
          <li>Paper Constellation</li>
          <li>Case studies + QA</li>
        </ul>
      </section>
    </div>
    <figcaption>The line marks the work judges should evaluate: the colored extension after July 13 at 9:00 AM. Everything gray was already here; this page asks judges to evaluate only the extension.</figcaption>
  </figure>
</section>

<section class="project-case-summary" aria-label="OpenAI Build Week project summary">
  <div>
    <span>Why</span>
    <p>I wanted visitors and students to see which design decisions survived review and reuse the checks behind them.</p>
  </div>
  <div>
    <span>What</span>
    <p>The extension added new reading routes, a publication map, guided case studies, reproduction guides, and responsive checks.</p>
  </div>
  <div>
    <span>How</span>
    <p>Codex accelerated bounded implementation passes; I reviewed fixed screenshots and decided what to keep, revise, or remove.</p>
  </div>
</section>

<h2 id="build-week-story-title">What changed after the line?</h2>

The timeline below links each public change to its commit. Read left to right by date; the three lanes separate public pages, evidence, and reusable notes.

<section
  class="build-week-data-story"
  id="build-week-extension"
  data-openai-build-week-story
  data-state="static"
  data-active-chapter="all"
  aria-labelledby="build-week-story-title"
>
  <div class="build-week-story-stage" data-build-week-story-stage>
    <div class="build-week-story-readout">
      <p class="project-case-kicker" data-build-week-story-kicker>Selected evidence · date on the horizontal axis</p>
      <h3 data-build-week-story-title>The foundation existed before the cutoff.</h3>
      <p data-build-week-story-copy>The orange rule fixes the eligibility boundary. Equal-sized nodes mark linked checkpoints; horizontal position encodes date.</p>
    </div>

    <div class="build-week-story-plot" aria-hidden="true">
      <svg viewBox="0 0 960 365" role="presentation" focusable="false">
        <g class="build-week-plot-lanes">
          <line x1="136" y1="74" x2="914" y2="74"></line>
          <line x1="136" y1="166" x2="914" y2="166"></line>
          <line x1="136" y1="258" x2="914" y2="258"></line>
          <text x="16" y="79">PUBLIC SURFACE</text>
          <text x="16" y="171">EVIDENCE</text>
          <text x="16" y="263">REUSABLE MEMORY</text>
        </g>

        <g class="build-week-plot-cutoff" data-build-week-chapter="boundary">
          <rect x="136" y="28" width="4" height="268" rx="2"></rect>
          <text x="148" y="44">JUL 13 · 09:00</text>
          <circle cx="108" cy="74" r="8"></circle>
          <text x="92" y="98">a765c5291</text>
        </g>

        <g class="build-week-plot-chapter build-week-plot-chapter--machine" data-build-week-chapter="machine">
          <path d="M 194 74 L 194 166"></path>
          <circle cx="194" cy="74" r="8"></circle>
          <circle cx="194" cy="166" r="8"></circle>
          <text x="174" y="191">d3f13be35</text>
        </g>

        <g class="build-week-plot-chapter build-week-plot-chapter--rhythm" data-build-week-chapter="rhythm">
          <path d="M 462 74 L 462 258"></path>
          <circle cx="452" cy="74" r="8"></circle>
          <circle cx="472" cy="166" r="8"></circle>
          <circle cx="462" cy="258" r="8"></circle>
          <text x="418" y="282">6b4 · f05 · b183</text>
        </g>

        <g class="build-week-plot-chapter build-week-plot-chapter--constellation" data-build-week-chapter="constellation">
          <path d="M 510 74 C 550 74 548 166 608 166"></path>
          <circle cx="510" cy="74" r="8"></circle>
          <circle cx="538" cy="74" r="8"></circle>
          <circle cx="608" cy="166" r="8"></circle>
          <text x="492" y="101">855 · eeb</text>
          <text x="585" y="191">683</text>
        </g>

        <g class="build-week-plot-chapter build-week-plot-chapter--artifacts" data-build-week-chapter="artifacts">
          <path d="M 488 166 C 520 212 590 212 626 258"></path>
          <circle cx="488" cy="166" r="8"></circle>
          <circle cx="626" cy="258" r="8"></circle>
          <circle cx="656" cy="258" r="8"></circle>
          <text x="610" y="282">1ec · 207</text>
        </g>

        <g class="build-week-plot-chapter build-week-plot-chapter--evidence" data-build-week-chapter="evidence">
          <path d="M 598 166 C 686 166 716 166 842 166"></path>
          <circle cx="598" cy="166" r="8"></circle>
          <circle cx="756" cy="166" r="8"></circle>
          <circle cx="842" cy="166" r="8"></circle>
          <text x="578" y="145">739</text>
          <text x="736" y="145">1ae</text>
          <text x="822" y="145">c52</text>
        </g>

        <g class="build-week-plot-axis">
          <line x1="136" y1="322" x2="914" y2="322"></line>
          <g transform="translate(136 322)"><line y2="7"></line><text y="27">JUL 13</text></g>
          <g transform="translate(292 322)"><line y2="7"></line><text y="27">JUL 14</text></g>
          <g transform="translate(448 322)"><line y2="7"></line><text y="27">JUL 15</text></g>
          <g transform="translate(604 322)"><line y2="7"></line><text y="27">JUL 16</text></g>
          <g transform="translate(760 322)"><line y2="7"></line><text y="27">JUL 17</text></g>
          <g transform="translate(914 322)"><line y2="7"></line><text x="-42" y="27">JUL 18</text></g>
        </g>
      </svg>
    </div>

    <p class="build-week-story-legend"><span aria-hidden="true"></span> Equal-sized checkpoint · lane = artifact role · x-position = authored date</p>

  </div>

  <ol class="build-week-story-steps">
    <li
      class="build-week-story-step"
      data-build-week-step="boundary"
      data-kicker="Eligibility boundary · July 13"
      data-title="The foundation existed before the cutoff."
      data-copy="The reciprocal room, teaching frame, and original design memory define the pre-cutoff foundation."
    >
      <p class="project-case-kicker">01 · Draw the boundary</p>
      <h3>Show what was already there.</h3>
      <p>The portfolio, COGS 125 framing, living heuristics, first 2D/3D desk, activity workbench, and reciprocal cliff-room topology all predate 9:00 AM. The last named baseline, <a href="https://github.com/DylanTao/dylantao.github.io/commit/a765c5291"><code>a765c5291</code></a>, was committed before the window opened.</p>
    </li>

    <li
      class="build-week-story-step"
      data-build-week-step="machine"
      data-kicker="Public surface · July 13"
      data-title="One research record gained human and machine routes."
      data-copy="The new AI profile and raw alternatives stay source-linked and human-auditable; they do not promise ranking or model inclusion."
    >
      <p class="project-case-kicker">02 · Make the record readable</p>
      <h3>Give the same research record two reading routes.</h3>
      <p><a href="https://github.com/DylanTao/dylantao.github.io/commit/d3f13be35"><code>d3f13be35</code></a> added the source-linked <a href="{{ '/ai/' | relative_url }}">Human/AI research profile</a>, publication catalog, and raw text alternatives. The canonical bibliography owns the facts; the new routes reduce visual decoding work.</p>
    </li>

    <li
      class="build-week-story-step"
      data-build-week-step="rhythm"
      data-kicker="Evidence story · July 15"
      data-title="An activity workbench became a reading lesson."
      data-copy="Build Week added guided interpretation, an origin case study, a reproduction brief, and explicit evidence boundaries."
    >
      <p class="project-case-kicker">03 · Guide the interpretation</p>
      <h3>Explain commits, changed lines, and tokens separately.</h3>
      <p><a href="https://github.com/DylanTao/dylantao.github.io/commit/6b4b7bd59"><code>6b4b7bd59</code></a> added the scroll-led <a href="{{ '/github-activity/' | relative_url }}">Build Rhythm</a> story. <a href="https://github.com/DylanTao/dylantao.github.io/commit/f05f02b41"><code>f05f02b41</code></a> added the first case-study and reproduction layer, while <a href="https://github.com/DylanTao/dylantao.github.io/commit/b183e4b75"><code>b183e4b75</code></a> wrote the surviving constraints into design memory. The original workbench began on July 11; the guided teaching layer is the Build Week extension.</p>
    </li>

    <li
      class="build-week-story-step"
      data-build-week-step="constellation"
      data-kicker="Paper map · July 15–16"
      data-title="The same paper graph now has a desktop atlas and a mobile trail."
      data-copy="Five papers, three threads, seven anonymous future nodes, and nine reviewed connections stay constant while the geometry changes."
    >
      <p class="project-case-kicker">04 · Change the representation</p>
      <h3>Make a desktop atlas and a mobile trail.</h3>
      <p><a href="https://github.com/DylanTao/dylantao.github.io/commit/855f1bce8"><code>855f1bce8</code></a> fixed the privacy-safe data contract; <a href="https://github.com/DylanTao/dylantao.github.io/commit/eeb0a5764"><code>eeb0a5764</code></a> built <a href="{{ '/projects/paper-constellation/' | relative_url }}">Paper Constellation</a>; and <a href="https://github.com/DylanTao/dylantao.github.io/commit/6832a6a05"><code>6832a6a05</code></a> replaced the compressed mobile map with a chronological trail. I reviewed every relationship and coordinate; GPT-5.6 did not discover the research lineage.</p>
    </li>

    <li
      class="build-week-story-step"
      data-build-week-step="artifacts"
      data-kicker="Reusable teaching artifacts · July 15–16"
      data-title="Six earlier experiments and one new paper map gained inspectable stories."
      data-copy="Six interactions predated Build Week; Paper Constellation was new. All seven gained origin stories, dated evidence, known limits, and downloadable guides."
    >
      <p class="project-case-kicker">05 · Show the work</p>
      <h3>Give six earlier experiments and one new paper map their own case studies.</h3>
      <p>Across <a href="https://github.com/DylanTao/dylantao.github.io/commit/f05f02b41"><code>f05f02b41</code></a>, <a href="https://github.com/DylanTao/dylantao.github.io/commit/1ec5d5f4f"><code>1ec5d5f4f</code></a>, <a href="https://github.com/DylanTao/dylantao.github.io/commit/2070991b0"><code>2070991b0</code></a>, and the constellation work, six pre-existing interactions gained project pages alongside the new Paper Constellation. All seven include evidence and downloadable reuse guides.</p>
    </li>

    <li
      class="build-week-story-step"
      data-build-week-step="evidence"
      data-kicker="Acceptance evidence · July 16–18"
      data-title="The final chapter verifies the work."
      data-copy="Paired captures, responsive viewports, reduced-motion states, and two browser engines make the accepted boundary easier to inspect."
    >
      <p class="project-case-kicker">06 · Publish the proof</p>
      <h3>Test more than the best-looking screenshot.</h3>
      <p><a href="https://github.com/DylanTao/dylantao.github.io/commit/739d2ba28"><code>739d2ba28</code></a> published paired desk evidence under a fixed capture rubric. <a href="https://github.com/DylanTao/dylantao.github.io/commit/1ae1ead39"><code>1ae1ead39</code></a> and <a href="https://github.com/DylanTao/dylantao.github.io/commit/c52de6932"><code>c52de6932</code></a> closed responsive and cross-engine gaps. The reciprocal room was the baseline; post-cutoff work polished its controls and evidence—it did not create the reciprocal room.</p>
    </li>

  </ol>
</section>

<h2 id="build-week-two-shapes">One record, two reading shapes</h2>

Paper Constellation is the clearest before-and-after within the Build Week extension. Both views use the same five papers, seven anonymous future nodes, three threads, and nine connections. Desktop makes comparison spatial; mobile puts chronology and readable titles first.

<section class="project-story-comparison build-week-constellation-pair" aria-labelledby="build-week-two-shapes">
  <figure class="project-case-media site-experiment-evidence-figure">
    <img src="{{ '/assets/img/project_pics/paper-constellation/paper-constellation-desktop-surface-6832a6a05-1440-light.png' | relative_url }}" alt="Desktop Paper Constellation atlas arranging accepted papers and anonymous future nodes across three research threads" loading="lazy" width="1012" height="753">
    <figcaption><strong>Desktop atlas.</strong> Stable, reviewed coordinates support relationship tracing; position encodes thread membership.</figcaption>
  </figure>
  <figure class="project-case-media site-experiment-evidence-figure build-week-mobile-evidence">
    <img src="{{ '/assets/img/project_pics/paper-constellation/paper-constellation-mobile-trail-390-light-2026-07-16.png' | relative_url }}" alt="Mobile Paper Constellation trail preserving three thread rails, accepted papers, and anonymous future nodes in chronological order" loading="lazy" width="360" height="270">
    <figcaption><strong>Mobile trail.</strong> The same record becomes a chronological path with readable labels and visible thread rails.</figcaption>
  </figure>
</section>

<h2 id="build-week-receipts">Seven experiments got their own case studies</h2>

Each page now answers four practical questions: why did I make this, what changed, what evidence survives, and what could someone else reuse?

<ul class="build-week-receipts" aria-labelledby="build-week-receipts">
  <li><a href="{{ '/projects/build-rhythm/' | relative_url }}"><strong>Build Rhythm</strong><span>See when building arrived in bursts.</span></a></li>
  <li><a href="{{ '/projects/paper-constellation/' | relative_url }}"><strong>Paper Constellation</strong><span>Trace five papers across three questions.</span></a></li>
  <li><a href="{{ '/projects/homepage-desk-scene/' | relative_url }}"><strong>Homepage desk</strong><span>Step from the paper desk into the same room.</span></a></li>
  <li><a href="{{ '/projects/ikea-project-cards/' | relative_url }}"><strong>Project cards</strong><span>Expand a project without losing its place.</span></a></li>
  <li><a href="{{ '/projects/scholar-lens/' | relative_url }}"><strong>Scholar Lens</strong><span>Follow one paper through its citation history.</span></a></li>
  <li><a href="{{ '/projects/wall-of-rejection/' | relative_url }}"><strong>Wall of Rejection</strong><span>Open each badge to read its rejection receipt.</span></a></li>
  <li><a href="{{ '/projects/dogtor-portal/' | relative_url }}"><strong>Dogtor’s portal</strong><span>Follow a clue through recovery and consent.</span></a></li>
</ul>

<h2 id="build-week-critique-loop">How I used Codex during the week</h2>

I gave Codex one bounded change at a time, inspected the rendered result, and decided whether it clarified the page. GPT-5.6 Sol made those build-and-review passes faster; it did not make the research or acceptance decisions.

<ol class="build-week-critique-loop" aria-labelledby="build-week-critique-loop">
  <li><span>01</span><strong>Name the question</strong><p>Say what a rushed visitor should understand.</p></li>
  <li><span>02</span><strong>Build one change</strong><p>Use Codex with GPT-5.6 Sol for a bounded implementation pass.</p></li>
  <li><span>03</span><strong>Check the page</strong><p>Compare fixed routes, viewports, themes, and states.</p></li>
  <li><span>04</span><strong>Decide</strong><p>Keep, revise, or revert based on meaning and access.</p></li>
  <li><span>05</span><strong>Save the rule</strong><p>Write useful recurring critique into design memory.</p></li>
</ol>

<section class="build-week-agency-split" aria-label="Codex contribution and human judgment">
  <article>
    <p class="project-case-kicker">Codex + GPT-5.6 accelerated</p>
    <h3>The implementation work</h3>
    <ul>
      <li>Tracing routes and implementation history</li>
      <li>Building bounded visual and responsive passes</li>
      <li>Writing focused source and browser checks</li>
      <li>Comparing failures across fixed states</li>
    </ul>
  </article>
  <article>
    <p class="project-case-kicker">Human critique decided</p>
    <h3>What to keep</h3>
    <ul>
      <li>The research claim and eligibility boundary</li>
      <li>Which visual relationships were defensible</li>
      <li>Which directions to simplify or reject</li>
      <li>Which lesson belonged in shared design memory</li>
    </ul>
  </article>
</section>

<aside class="project-story-note" aria-labelledby="build-week-claim-boundary-title">
  <p class="project-case-kicker">Claim boundary</p>
  <h2 id="build-week-claim-boundary-title">An inspectable method is not a measured learning outcome.</h2>
  <p>This page documents a workflow, not a learning study. I have not yet tested whether it helps students critique better; model and activity counts record provenance, not quality.</p>
</aside>

<h2 id="build-week-design-memory">What another student can reuse</h2>

The checklist turns recurring screenshot critiques into checks for hierarchy, mobile layout, accessibility, evidence, and provenance. Students can adapt the checks, then decide which ones improve their own page.

{% include heuristics_preview.liquid %}

<details class="project-story-disclosure site-experiment-technical-details">
  <summary id="build-week-evidence-summary">Exact evidence ledger and Codex provenance</summary>
  <div class="project-story-disclosure-body" aria-labelledby="build-week-evidence-summary">
    <p><strong>Primary retained build thread:</strong> <code>019f652f-7154-7822-ad1c-daa5a066134b</code>. The retained thread ran <strong>GPT-5.6 Sol</strong> at ultra reasoning effort. The model label records provenance, not isolated causality; model, prompt, retained context, implementation history, and human critique all changed together.</p>
    <ol class="site-experiment-ledger" aria-label="OpenAI Build Week evidence record">
      <li><time datetime="2026-07-13T04:29:03-07:00">Before start</time><code>a765c5291</code><span>Named baseline: reciprocal cliff-room scene committed before the 9:00 AM eligibility line.</span></li>
      <li><time datetime="2026-07-13">Jul 13</time><code>d3f13be35</code><span>Added the source-linked Human/AI profile, publication catalog, and raw alternatives.</span></li>
      <li><time datetime="2026-07-15">Jul 15</time><code>b183 · 6b4 · f05</code><span>Recorded durable rules, added the Build Rhythm teaching story, and published the first experiment case studies and reproduction briefs.</span></li>
      <li><time datetime="2026-07-15">Jul 15</time><code>855 · eeb</code><span>Fixed the privacy-safe Paper Constellation contract and built the desktop atlas.</span></li>
      <li><time datetime="2026-07-16">Jul 16</time><code>6832a6a05</code><span>Recomposed the constellation as a chronological mobile trail.</span></li>
      <li><time datetime="2026-07-16">Jul 16</time><code>739 · 1ec · 207</code><span>Published paired desk evidence and completed provenance-rich experiment stories.</span></li>
      <li><time datetime="2026-07-17">Jul 17–18</time><code>1ae · c52</code><span>Closed responsive storytelling gaps and stabilized cross-engine visual checkpoints.</span></li>
    </ol>
  </div>
</details>

## What comes next

Next I want to turn this into a classroom critique exercise with fixed viewports, one shared brief, comparable screenshots, and a worksheet for deciding which observations are worth keeping. Any claim about learning waits for an actual evaluation.

## Credits

This page documents work completed for [OpenAI Build Week](https://openai.devpost.com/) with Codex and GPT-5.6. The site is a customized fork of the open-source [al-folio](https://github.com/alshedivat/al-folio) academic theme and uses site-native graphics with static repository evidence.
