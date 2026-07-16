---
layout: page
title: Paper Constellation
description: A list-first publication browser that maps five accepted papers across Design, Evaluate, and Situate while keeping unannounced work deliberately anonymous.
img: assets/img/project_pics/paper-constellation/paper-constellation-teaser.png
image_aspect: 4 / 3
card_avoid_scaling: true
importance: -31
category: fun
year: 2026
role: Designer, writer, reviewer
status: Site experiment
site_experiment: true
debut_date: 2026-07-15T16:51:26-07:00
hide_title: true
---

<section class="project-case-hero">
  <div class="project-case-copy">
    <p class="project-case-kicker">Site experiment · Publication orientation</p>
    <h1>Paper Constellation</h1>
    <p class="project-case-lede">
      I wanted the publications page to show how my research questions move between designing alternatives, evaluating evidence, and fitting tools to context—without replacing the bibliography or pretending that work in progress is already a paper.
    </p>
    <div class="project-case-facts">
      <span>5 accepted papers</span>
      <span>3 stable research threads</span>
      <span>7 anonymous future markers</span>
      <span>List-first fallback</span>
    </div>
    <div class="project-case-actions">
      <a href="{{ '/publications/' | relative_url }}">Open the publication page</a>
      <a href="{{ '/assets/downloads/site-experiments/paper-constellation-reproduction.md' | relative_url }}" download>Download the reproduction guide</a>
    </div>
  </div>
</section>

<section class="project-case-summary" aria-label="Paper Constellation summary">
  <div>
    <span>Question</span>
    <p>Can a playful publication view teach the connections among papers while leaving the canonical citation list intact?</p>
  </div>
  <div>
    <span>Artifact</span>
    <p>A deterministic, filter-aware map with hover neighborhoods, click-to-pin details, citation halos, and a compact mobile reading order.</p>
  </div>
  <div>
    <span>Boundary</span>
    <p>Accepted work uses public bibliography data. Future work gets neutral IDs, question marks, coarse thread placement, and only already-public rejection receipts.</p>
  </div>
</section>

## The bibliography stays in charge

The publication list is still the default view and the only no-JavaScript view. It carries the titles, authors, venues, links, citation context, and search behavior people expect from an academic site. The constellation is an optional way to orient before returning to that evidence.

This order matters. A constellation can make relationships memorable, but it should not make a reader decode geometry before they can verify a paper. The view switch appears only after the enhancement script starts, so a failed script or a text-only browser still receives the full bibliography.

## One stable visual grammar

The horizontal positions mean the same thing on every visit: **Design**, **Evaluate**, and **Situate**. Published papers have hand-reviewed coordinates and explicit primary, bridge, or technical-adjacency memberships. Citation totals change the size of a quiet halo; they do not push papers around.

I chose deterministic geometry instead of a force simulation because stability is part of the explanation. A returning reader should find DesignWeaver, Physion, or HotSpot in the same place and be able to compare screenshots across revisions. HotSpot sits between Design and Situate as a technical graphics adjacency, not as a claim that it reports an HCI study.

Hover or keyboard focus previews a paper's immediate neighborhood. Selecting it pins the same evidence and asks the existing Scholar lens to highlight the corresponding citation trace. Filters flow the other way: when the Scholar lens removes a paper from the active set, that node becomes dimmed, disabled, and unreachable by Tab.

## Show direction without making a publication claim

Seven question marks hold space above the accepted-paper timeline: three larger near-term markers and four smaller earlier-stage markers. Five sit on the Design thread and two on Situate. Their identifiers are deliberately generic, and only one marker carries the already-public CHI '26 and UIST '26 rejection tags from the Wall of Rejection.

The implementation treats this as a privacy boundary, not a copywriting choice. Names, titles, collaborators, draft venues, and descriptive hints do not belong in the data file, HTML, JavaScript, downloads, analytics, alt text, comments, or commit messages. If a project becomes public, it should enter through the normal bibliography and project-page contracts instead of quietly gaining detail inside a future node.

## What I borrowed, and what I changed

[John Thompson](https://jrthomp.com/) shared Nadieh Bremer's [Royal Constellations](https://royalconstellations.visualcinnamon.com/) with me. Bremer's work made the useful interaction lesson vivid: stable semantic axes, contextual dimming, and a neighborhood that becomes legible through hover and selection. Her [process story](https://www.datasketch.es/project/royal-constellations) also shows how much care sits behind an apparently effortless map.

I borrowed those principles, not the royal-family data, layout, assets, D3 force-directed SVG implementation, or shortest-path behavior. This version uses ordinary server-rendered HTML and SVG, keeps the bibliography as the default, gives touch and keyboard users equivalent controls, and turns the graph into stacked thread lists on narrow screens.

## Iteration ledger

- **July 15, 2026 — Traceable implementation checkpoint.** The privacy-safe data-contract commit `855f1bce8` carries an author timestamp of <time datetime="2026-07-15T04:10:52-07:00">4:10 AM PDT</time>; the visitor-facing implementation commit `eeb0a5764` carries an author timestamp of <time datetime="2026-07-15T16:51:26-07:00">4:51 PM PDT</time>. The project card uses the latter to match the other experiments' author-time chronology; deployment happened later.
- **July 15, 2026 — List before constellation.** Kept the bibliography visible by default and hid the mode switch unless JavaScript successfully initialized.
- **July 15, 2026 — Stable threads, stable coordinates.** Replaced any temptation toward force-directed motion with reviewed Design/Evaluate/Situate positions and nine explicit edges.
- **July 15, 2026 — Privacy as schema.** Restricted future records to neutral IDs, size, thread, position, and an allowlisted public-rejection field.
- **July 15, 2026 — One evidence loop.** Connected constellation focus and filters to the existing Scholar lens instead of inventing a second citation model.
- **July 15, 2026 — Responsive and interruptible.** Added mobile thread lists, visible focus, click-to-pin and Escape recovery, disabled filtered nodes, and a motion-free equivalent.

## Reproduce the pattern

The [reproduction guide]({{ '/assets/downloads/site-experiments/paper-constellation-reproduction.md' | relative_url }}) documents the data schema, progressive-enhancement order, privacy checks, interaction contract, and acceptance evidence. The durable lesson is small: teach one stable visual grammar, keep authoritative evidence one click away, and make every speculative hint less specific than you first think it needs to be.
