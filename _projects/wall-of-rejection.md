---
layout: page
title: Wall of Rejection
description: A rejection-only receipt wall that makes failed submissions visible without turning research life into a leaderboard.
img: assets/img/website-revamp/wall-of-rejection-steam-reference.png
image_aspect: 16 / 9
card_image_fit: cover
card_image_position: center
importance: -27
category: fun
site_experiment: true
debut_date: 2026-05-29T15:24:23-07:00
year: 2026
role: Designer, meme archivist
status: Living receipt wall
hide_title: true
---

<section class="project-case-hero site-experiment-hero">
  <div class="project-case-copy">
    <p class="project-case-kicker">Site experiment · first seen May 29, 2026</p>
    <h1>Wall of Rejection</h1>
    <p class="project-case-lede">
      Selected paper, grant, and fellowship rejections become compact badges with receipts. A small XP joke acknowledges the pattern, but accepted work stays in the bibliography and repeated badges never inflate the count.
    </p>
    <div class="project-case-facts">
      <span>Rejection-only</span>
      <span>Receipts close by</span>
      <span>No double counting</span>
      <span>No leaderboard</span>
    </div>
    <div class="project-case-actions">
      <a href="{{ '/publications/#wall-of-rejection-title' | relative_url }}">Open the wall</a>
      <a href="{{ '/assets/downloads/site-experiments/wall-of-rejection-reproduction.md' | relative_url }}" download>Download reproduction MD</a>
    </div>
  </div>
  <figure class="project-case-media site-experiment-evidence-figure">
    <img src="{{ '/assets/img/website-revamp/wall-of-rejection-steam-reference.png' | relative_url }}" alt="Steam-style rejection badge meme that preceded the website's Wall of Rejection">
    <figcaption>The lab meme that started the interaction, kept as origin evidence rather than copied platform UI.</figcaption>
  </figure>
</section>

<section class="project-case-summary" aria-label="Wall of Rejection summary">
  <div><span>Question</span><p>Can a publication page acknowledge failure honestly while keeping accepted scholarship easier to find?</p></div>
  <div><span>Artifact</span><p>Theme-aware badge shelves, click-to-open receipts, and one transparent XP rulebook.</p></div>
  <div><span>Boundary</span><p>Only selected rejections belong here. Combo badges celebrate patterns but add zero XP.</p></div>
</section>

## Origin

CHI said no. UIST said no. I made a Steam-style badge meme for labmates, then adapted that joke through the failure-CV tradition and the strange optimism of Spooder-Man. The website version keeps the humor but drops the commercial gaming skin: quiet cards, explicit evidence, accessible controls, and research content that still leads the page.

<ol class="site-experiment-ledger" aria-label="Wall of Rejection iteration record">
  <li><time datetime="2026-05-29">May 29</time><code>910f3c7f2</code><span>Replaced a generic review-achievement panel with rejection-only badges, receipts, and the first XP joke.</span></li>
  <li><time datetime="2026-05-29">May 29</time><code>77b8efbca</code><span>Restored the supplied lab meme as the real origin reference instead of a substitute.</span></li>
  <li><time datetime="2026-06-15">Jun 15</time><code>1dad10b5b</code><span>Aligned the ledger and CV evidence while keeping accepted work out of the rejection count.</span></li>
  <li><time datetime="2026-06-16">Jun 16</time><code>f51ff4f16</code><span>Quieted the evening hierarchy so the wall stayed secondary to the papers.</span></li>
</ol>

<aside class="site-experiment-reproduce" aria-labelledby="wall-reproduce-title">
  <p class="project-case-kicker">Reproduce the pattern</p>
  <h2 id="wall-reproduce-title">Start with a truthful event ledger.</h2>
  <p>The guide separates events, badges, shelves, and joke metrics so another academic site can adapt the idea without copying this history or a platform UI.</p>
  <a href="{{ '/assets/downloads/site-experiments/wall-of-rejection-reproduction.md' | relative_url }}" download>Download the coding-agent brief</a>
</aside>

## Credits

The wall nods to [Bradley Voytek’s failure-CV tradition](https://voyteklab.com/members), Sirui’s own post-UIST badge meme, and the [Spooder-Man meme](https://youtu.be/f_Pcu6wTzoA?si=2FKEbhC8hkqildqC). Those references shaped the honesty and tone, not the final interface skin.
